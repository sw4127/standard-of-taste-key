/**
 * FR-T9.9 (Amendment of 2026-11-11): calls go from the page straight to Anthropic's Messages API with
 * the person's own key, through Anthropic's own library (@anthropic-ai/sdk), which adds the header
 * that permits a call from a browser, `anthropic-dangerous-direct-browser-access: true`. No server of
 * ours, no key of ours. Tests replace the network with a stand-in through `fetch`; no real key is ever
 * in a test.
 *
 * Settings chosen for this model (Claude Sonnet 5.5) and logged in the build log:
 * - No temperature. The PRD asks for a low one, but this API version (2026-10-21) refuses any
 *   temperature on every model. The fixed JSON shape and the checks take its place.
 * - `thinking: {type: "between_tools"}`: no thinking before the answer, so a reading costs about one
 *   cent, as the notice says. With thinking on, the cost could be two or three times that.
 * - `maxRetries: 0`: the library retries nothing by itself; the one retry is the PRD's, after a refusal.
 * - No fallback to another model on a refusal: E9-1 allows this model only. A refusal is a failed check.
 */
import Anthropic from "@anthropic-ai/sdk";
import { API_HOST, MAX_OUTPUT_TOKENS, MODEL_ID, MODEL_NAME } from "./constants";
import { checkReading, squash, type CheckedGuess } from "./check";
import { readingPrompt, SCHEMA, type Sent } from "./prompt";

export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export function client(key: string, fetchFn?: FetchLike): Anthropic {
  // The address is fixed here, and no other credential is read from the environment: the key goes to api.anthropic.com and nowhere else.
  return new Anthropic({ apiKey: key, authToken: null, baseURL: `https://${API_HOST}`, dangerouslyAllowBrowser: true, maxRetries: 0, timeout: 120_000, ...(fetchFn ? { fetch: fetchFn as never } : {}) });
}

/** The reason a call failed, in plain words (FR-T9.9: the key is wrong; no credit; a limit was reached). */
export function plainError(e: unknown): string {
  const msg = e instanceof Error ? e.message : "";
  if (e instanceof Anthropic.AuthenticationError) return "The key is wrong. Check that you pasted all of it, or make a new key in your Anthropic account.";
  if ((e instanceof Anthropic.APIError && e.status === 402) || /credit balance/i.test(msg)) return "The account has no credit. Add credit in your Anthropic account, under Billing.";
  if (e instanceof Anthropic.RateLimitError) return "A limit was reached. Wait a minute and try again, or raise the limit in your Anthropic account.";
  if (e instanceof Anthropic.PermissionDeniedError) return `This key is not allowed to use ${MODEL_NAME}. Check the key's workspace in your Anthropic account.`;
  if (e instanceof Anthropic.NotFoundError) return `Anthropic did not find ${MODEL_NAME} for this key.`;
  if (e instanceof Anthropic.APIConnectionError) return "The page could not reach Anthropic. Check your connection and try again.";
  if (e instanceof Anthropic.APIError && (e.status === 529 || (e.status ?? 0) >= 500)) return "Anthropic is busy. Try again in a few minutes.";
  return "Anthropic did not accept the call. Nothing was shown.";
}

export type PingResult = { ok: true; sentence: string } | { ok: false; sentence: string };

/** "Test the connection": sends the one word "ping" and asks for one word back. */
export async function ping(key: string, fetchFn?: FetchLike): Promise<PingResult> {
  try {
    await client(key, fetchFn).messages.create({
      model: MODEL_ID,
      max_tokens: 16,
      thinking: { type: "between_tools" },
      system: "Reply with one word.",
      messages: [{ role: "user", content: "ping" }],
    });
    return { ok: true, sentence: `Connected to ${MODEL_NAME}.` };
  } catch (e) {
    return { ok: false, sentence: plainError(e) };
  }
}

/** One call for a reading: the prompt, and the answer as the model wrote it (or null on a refusal). */
async function oneCall(key: string, prompt: string, fetchFn?: FetchLike): Promise<string | null> {
  const r = await client(key, fetchFn).messages.create({
    model: MODEL_ID,
    max_tokens: MAX_OUTPUT_TOKENS,
    thinking: { type: "between_tools" },
    output_config: { format: { type: "json_schema", schema: SCHEMA as unknown as Record<string, unknown> } },
    messages: [{ role: "user", content: prompt }],
  });
  if (r.stop_reason === "refusal" || r.stop_reason === "max_tokens") return null;
  return r.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
}

export type ReadingResult =
  | { status: "made"; guesses: CheckedGuess[]; attempts: 1 | 2 }
  | { status: "refused"; attempts: 1 | 2; reasons: string[] }
  | { status: "failed"; attempts: 0 | 1; sentence: string };

/**
 * One tap: one call, checked; if refused, one more call on the same tap; a second refusal ends it.
 * A failed call (the key, the credit, a limit) is not retried.
 */
export async function makeReading(key: string, sent: Sent, fetchFn?: FetchLike): Promise<ReadingResult> {
  const prompt = readingPrompt(sent);
  let reasons: string[] = [];
  for (const attempt of [1, 2] as const) {
    let text: string | null;
    try {
      text = await oneCall(key, prompt, fetchFn);
    } catch (e) {
      return attempt === 1 ? { status: "failed", attempts: 0, sentence: plainError(e) } : { status: "refused", attempts: 1, reasons: [...reasons, plainError(e)] };
    }
    const checked = text === null ? { ok: false as const, reasons: ["the model declined or stopped early"] } : checkReading(text, sent);
    if (checked.ok) return { status: "made", guesses: checked.guesses, attempts: attempt };
    reasons = [...reasons, ...checked.reasons];
  }
  return { status: "refused", attempts: 2, reasons };
}

/** A hash of what was sent (SHA-256, in hex), stored with the reading; the text itself is not kept twice. */
export async function hashOf(text: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ---- "Does this read clearly?" (FR-T9.4) ----------------------------------------------------------------

export const CLARITY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["spots"],
  properties: {
    spots: { type: "array", items: { type: "object", additionalProperties: false, required: ["text", "reason"], properties: { text: { type: "string" }, reason: { type: "string" } } } },
  },
} as const;

export function clarityPrompt(answer: string): string {
  return `Below is one answer a person wrote about a record in their life. Mark at most three spots a reader may find unclear. Each spot must be an exact part of the answer, copied character for character. For each, give one plain sentence of at most 20 words saying what is unclear (for example, who "he" is, or which year is meant). Do not rewrite anything, do not suggest other words, and do not comment on the content, the person or their feelings. If it reads clearly, return no spots. Return only JSON in the shape {"spots": [{"text": "...", "reason": "..."}]}.

ANSWER:
<<<
${answer}
>>>`;
}

export interface Spot {
  text: string;
  reason: string;
}

const REWRITES = /\b(?:try|instead|replace|rewrite|rephrase|change (?:it|this) to|could say|should say|consider|better (?:to|as)|you (?:could|should|might) (?:write|say|use))\b/i;

/** The checks on the marks: at most three; each spot his words; each reason one plain sentence that rewrites nothing. */
export function checkClarity(raw: unknown, answer: string, passes: (reason: string) => boolean): { ok: true; spots: Spot[] } | { ok: false } {
  let v = raw;
  if (typeof v === "string") {
    try {
      v = JSON.parse(v);
    } catch {
      return { ok: false };
    }
  }
  const spots = (v as { spots?: unknown })?.spots;
  if (!Array.isArray(spots) || spots.length > 3) return { ok: false };
  const a = squash(answer);
  for (const s of spots as Spot[]) {
    if (typeof s?.text !== "string" || typeof s?.reason !== "string" || !squash(s.text) || !a.includes(squash(s.text))) return { ok: false };
    const reason = squash(s.reason);
    if (!reason || reason.split(" ").length > 25 || /[.!?].+[.!?]$/.test(reason) || REWRITES.test(reason) || !passes(reason)) return { ok: false };
  }
  return { ok: true, spots: spots as Spot[] };
}

export type ClarityResult = { status: "checked"; spots: Spot[] } | { status: "refused" } | { status: "failed"; sentence: string };

export async function checkWording(key: string, answer: string, passes: (reason: string) => boolean, fetchFn?: FetchLike): Promise<ClarityResult> {
  try {
    const r = await client(key, fetchFn).messages.create({
      model: MODEL_ID,
      max_tokens: 600,
      thinking: { type: "between_tools" },
      output_config: { format: { type: "json_schema", schema: CLARITY_SCHEMA as unknown as Record<string, unknown> } },
      messages: [{ role: "user", content: clarityPrompt(answer) }],
    });
    const text = r.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    const c = r.stop_reason === "end_turn" ? checkClarity(text, answer, passes) : { ok: false as const };
    return c.ok ? { status: "checked", spots: c.spots } : { status: "refused" };
  } catch (e) {
    return { status: "failed", sentence: plainError(e) };
  }
}

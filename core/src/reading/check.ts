/**
 * FR-T9.9, code refuses the whole reading if any check fails. Rule 1 (amended): the model may quote
 * his words, choose which to place together and which library finding sits nearest, and phrase the
 * result as a question; code checks every quote word for word, and a reading that fails is not shown.
 *
 * The checks, in the PRD's order: valid to the shape; at most two guesses; every quote a
 * character-for-character part of his answer about the record it names (after runs of spaces and line
 * breaks are made one space, and nothing else); every guess joins two records, or a quote with a sent
 * fact; library IDs only from the shipping library; a "what it did" quote only from a sentence of his
 * that names the record, the song, the album or "it" as the thing that acted (a rule of thumb, backed by
 * the planted examples of FR-T9.10); and in the model's own words (everything outside his quotes): no
 * digit followed by "%" or "/", and the register and carve-out checks.
 *
 * Added by this build, each backed by a planted example (FR-T9.10 part 1), because the PRD's list of
 * planted outputs names them: advice, comfort, two events of his life tied to each other, a score, a
 * fragment in place of a sentence, and a question that asks why (rule 12).
 *
 * What it cannot do: read meaning. Rule 5 (nothing about a record from the model's own knowledge) is
 * judged by people, in the gate's fresh runs and in Bob's test.
 */
import { breaches } from "../checks";
import { SHIPPING } from "../library";
import type { Sent } from "./prompt";

export interface Quote {
  record_id: string;
  quote: string;
}

export interface Guess {
  question: string;
  quotes: Quote[];
  what_it_did: Quote[];
  fact_ids: string[];
  library_id: string;
  rests_on: number;
}

/** A guess that passed, with what code computed about it (the records it rests on, counted by code). */
export interface CheckedGuess extends Guess {
  records: string[];
}

export type Checked = { ok: true; guesses: CheckedGuess[] } | { ok: false; reasons: string[] };

export const MAX_GUESSES = 2;
export const MAX_QUESTION_WORDS = 45;

/** Runs of spaces and line breaks made one space, and nothing else (FR-T9.9). */
export const squash = (s: string) => s.replace(/\s+/g, " ").trim();

/** Words in a question: each run between spaces, and each Chinese, Japanese or Korean character on its own. */
export function wordCount(s: string): number {
  const cjk = s.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu)?.length ?? 0;
  const rest = s.replace(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu, " ").split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  return cjk + rest;
}

// ---- What the model may not say in its own words ---------------------------------------------------

/** FR-T9.9: a digit followed by "%" or "/". */
export const DIGIT_SCORE = /\d\s*[%/]/;
/** A score or a rank in words (rules 2 and 5). */
export const SCORE_WORDS = /\b(?:score[sd]?|scoring|rating|rated|rate[sd]?|ranks?|ranked|ranking|out of \d+|on a scale)\b|打分|评分|排名/i;
/** Advice (rule 3; rule 3's addition: no advice). */
export const ADVICE = /\b(?:you should|should you|you could try|try (?:to|playing|listening|writing)|consider (?:playing|listening|writing|talking)|it (?:might|may|could) help|i (?:suggest|recommend)|make sure|you need to|you must|give yourself|let yourself|allow yourself)\b|你应该|建议你|试着|不妨/i;
/** Comfort (rule 3's addition: no comfort). */
export const COMFORT = /\b(?:would be proud|be proud|it(?:'s| is) (?:okay|ok|alright|all right)|you(?:'re| are) not alone|be (?:kind|gentle) to yourself|it gets better|must have been (?:hard|difficult|painful|tough)|i(?:'m| am) (?:so )?sorry|sorry for your loss|healing|heal(?:ed|s)?|you did (?:your best|nothing wrong)|so brave|how brave|be at peace|rest in peace)\b|别难过|会好的|节哀|你已经尽力/i;
/** Two events of his life tied to each other (rule 3's addition), and "why" (rule 12). */
export const LIFE_LINK = /\b(?:because|caused?|causing|led (?:you )?to|lead (?:you )?to|leads (?:you )?to|due to|as a result|result(?:ed)? (?:of|in)|that's why|which is why|explains?|explained|the reason)\b|因为|所以|导致|由于/i;
export const WHY = /\bwhy\b|为什么|为何/i;
/** A finite verb a whole question needs (design rule 10: whole sentences, no fragments). */
const QUESTION_VERB = /\b(?:is|are|was|were|am|do|does|did|could|would|can|might|may|will|has|have|had|should)\b/i;

/** The record named as the thing that acted, then a verb of acting, in his own sentence (rule 9). */
const ACTED = "(?:tells?|told|made|makes|taught|teaches|gave|gives|helped|helps|shows?|showed|reminds?|reminded|brought|brings|kept|keeps|lets?|carried|carries|got|gets|pulled|pulls|says|said|took|takes|walked|walks|turned|turns)";
const ACTED_ZH = /(?:它|这首歌|那首歌|这首|那首|这张专辑|那张专辑|这张唱片|那张唱片|这个专辑|那个专辑|这张|那张|歌|专辑)[^。！？.!?]{0,8}?(?:让|告诉|使|给了|给我|带给|带我|陪|帮|教|提醒|拉|把我)/;
const PRONOUN = "(?:it|this|that|the (?:song|album|record|track)|this (?:song|album|record|track)|that (?:song|album|record|track))";
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Does this sentence of his name the record (by title, "the song", "the album" or "it") as the thing that acted? */
export function namesRecordActing(sentence: string, title: string): boolean {
  const ref = `(?:${escape(title)}|${PRONOUN})`;
  if (new RegExp(`(?:^|[^\\p{L}])${ref}(?:[^\\p{L}][^.!?。！？]{0,30}?)?\\b${ACTED}\\b`, "iu").test(sentence)) return true;
  return ACTED_ZH.test(sentence) || new RegExp(`${escape(title)}[^。！？.!?]{0,8}?(?:让|告诉|使|给了|带给|陪|帮|教|提醒)`).test(sentence);
}

/** In the model's own words: a record named as having given him something (rule 9). */
function claimsRecordActed(own: string, titles: string[]): boolean {
  const refs = [...titles.filter(Boolean).map(escape), "the (?:song|album|record|track)", "(?:this|that) (?:song|album|record|track)"];
  const verbs = "(?:give|gave|given|teach|taught|show|showed|shown|tell|told|make|made|help|helped|bring|brought|remind|reminded|let)";
  return new RegExp(`(?:${refs.join("|")})[^.!?]{0,30}?\\b${verbs}\\b`, "i").test(own);
}

/** The sentence of his answer that holds the quote: split on . ! ? and their full-width forms, and line breaks. */
function sentenceHolding(answer: string, quote: string): string | null {
  const a = squash(answer);
  const q = squash(quote);
  const at = a.indexOf(q);
  if (at < 0) return null;
  const before = a.slice(0, at);
  const start = Math.max(...[".", "!", "?", "。", "！", "？"].map((p) => before.lastIndexOf(p))) + 1;
  // A quote that ends its sentence ends there; otherwise the sentence runs to the next stop.
  if (/[.!?。！？]$/.test(q)) return a.slice(start, at + q.length).trim();
  const after = a.slice(at + q.length).search(/[.!?。！？]/);
  return a.slice(start, after < 0 ? a.length : at + q.length + after + 1).trim();
}

/** The question with his quotes taken out: what is left is the model's own words. */
export function ownWords(question: string, quotes: string[], answers: string[]): string {
  let t = squash(question);
  for (const q of [...quotes].map(squash).filter(Boolean).sort((a, b) => b.length - a.length)) t = t.split(q).join("…");
  // A span the model put in quotation marks that is his word for word is his, not the model's.
  t = t.replace(/[“"「『]([^”"」』]+)[”"」』]/g, (m, inner: string) => (answers.some((a) => squash(a).includes(squash(inner))) ? "“…”" : m));
  return t;
}

// ---- The shape ---------------------------------------------------------------------------------------

const isStr = (x: unknown): x is string => typeof x === "string";
const isQuote = (x: unknown): x is Quote => !!x && typeof x === "object" && isStr((x as Quote).record_id) && isStr((x as Quote).quote) && Object.keys(x).length === 2;

function shapeOf(raw: unknown): Guess[] | null {
  let v = raw;
  if (isStr(v)) {
    try {
      v = JSON.parse(v);
    } catch {
      return null;
    }
  }
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const g = (v as { guesses?: unknown }).guesses;
  if (!Array.isArray(g) || Object.keys(v).length !== 1) return null;
  const keys = ["fact_ids", "library_id", "question", "quotes", "rests_on", "what_it_did"].join();
  for (const x of g) {
    if (!x || typeof x !== "object" || Object.keys(x).sort().join() !== keys) return null;
    const y = x as Guess;
    if (!isStr(y.question) || !isStr(y.library_id) || !Number.isInteger(y.rests_on)) return null;
    if (!Array.isArray(y.quotes) || !y.quotes.every(isQuote)) return null;
    if (!Array.isArray(y.what_it_did) || !y.what_it_did.every(isQuote)) return null;
    if (!Array.isArray(y.fact_ids) || !y.fact_ids.every(isStr)) return null;
  }
  return g as Guess[];
}

// ---- The checks --------------------------------------------------------------------------------------

/** Why one guess must be refused, or [] when it passes. */
export function guessBreaches(g: Guess, sent: Sent): string[] {
  const out: string[] = [];
  const answerOf = new Map(sent.records.map((r) => [r.record_id, squash(r.answer)]));
  const titleOf = new Map(sent.records.map((r) => [r.record_id, r.title]));
  const factOf = new Map(sent.facts.map((f) => [f.fact_id, f]));
  const allAnswers = sent.records.map((r) => r.answer);

  for (const q of [...g.quotes, ...g.what_it_did]) {
    const answer = answerOf.get(q.record_id);
    const quote = squash(q.quote);
    if (!answer) out.push(`a quote names a record that was not sent: ${q.record_id}`);
    else if (!quote) out.push("an empty quote");
    else if (!answer.includes(quote)) {
      const elsewhere = sent.records.find((r) => squash(r.answer).includes(quote));
      out.push(elsewhere ? `a quote is from another record's answer: "${q.quote}"` : `a quote is not his words, character for character: "${q.quote}"`);
    }
  }
  for (const q of g.what_it_did) {
    const s = sentenceHolding(sent.records.find((r) => r.record_id === q.record_id)?.answer ?? "", q.quote);
    if (s !== null && !namesRecordActing(s, titleOf.get(q.record_id) ?? "")) out.push(`a "what it did" quote is not from a sentence naming the record as acting: "${q.quote}"`);
  }
  for (const f of g.fact_ids) if (!factOf.has(f)) out.push(`a fact that was not sent: ${f}`);
  if (g.library_id !== "none" && !SHIPPING.some((e) => e.id === g.library_id)) out.push(`a library ID outside the shipping library: ${g.library_id}`);

  // Joins two records, or his words with a sent fact; and every guess rests on at least one quote (rule 1).
  const quoted = new Set(g.quotes.map((q) => q.record_id));
  const factRecords = new Set(g.fact_ids.map((f) => factOf.get(f)?.record_id).filter(isStr));
  const records = new Set([...quoted, ...factRecords]);
  if (!g.quotes.length) out.push("a guess with no quote of his");
  else if (records.size < 2 && !factRecords.size) out.push("a guess that rests on one record and no fact");

  // The question: whole sentences, at most 45 words, a question.
  const q = squash(g.question);
  if (!q) out.push("an empty question");
  if (wordCount(q) > MAX_QUESTION_WORDS) out.push(`a question longer than ${MAX_QUESTION_WORDS} words`);
  const own = ownWords(g.question, [...g.quotes, ...g.what_it_did].map((x) => x.quote), allAnswers);
  const ownSentences = own.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (!/^[“"'(…A-Z]/.test(q) || !/[?？]$/.test(q) || !QUESTION_VERB.test(own) || ownSentences.some((s) => wordCount(s) < 4)) out.push("a fragment in place of a sentence");

  // The model's own words.
  if (DIGIT_SCORE.test(own)) out.push("a digit followed by % or / in the model's own words");
  if (SCORE_WORDS.test(own)) out.push("a score or a rank in the model's own words");
  if (ADVICE.test(own)) out.push("advice in the model's own words");
  if (COMFORT.test(own)) out.push("comfort in the model's own words");
  if (LIFE_LINK.test(own)) out.push("two events of his life tied to each other in the model's own words");
  if (WHY.test(own)) out.push("a question that asks why");
  out.push(...breaches(own, "offer", [...titleOf.values()]).map((b) => `register: ${b}`));
  if (claimsRecordActed(own, [...titleOf.values()]) && !g.what_it_did.length) out.push("says a record did something, with no sentence of his naming it as acting");
  return out;
}

/** The whole reading: refused if any check fails. */
export function checkReading(raw: unknown, sent: Sent): Checked {
  const guesses = shapeOf(raw);
  if (!guesses) return { ok: false, reasons: ["not valid to the shape"] };
  const reasons: string[] = [];
  if (guesses.length > MAX_GUESSES) reasons.push(`more than ${MAX_GUESSES} guesses`);
  guesses.forEach((g, i) => reasons.push(...guessBreaches(g, sent).map((r) => `guess ${i + 1}: ${r}`)));
  if (reasons.length) return { ok: false, reasons };
  const factOf = new Map(sent.facts.map((f) => [f.fact_id, f.record_id]));
  return {
    ok: true,
    guesses: guesses.map((g) => ({ ...g, records: [...new Set([...g.quotes.map((q) => q.record_id), ...g.fact_ids.map((f) => factOf.get(f)!)])] })),
  };
}

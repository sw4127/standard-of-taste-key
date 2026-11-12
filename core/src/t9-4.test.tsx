// @vitest-environment happy-dom
/**
 * T9.4 "In your words" (FR-T9.4, changed 2026-11-10): after the lines, optional; the prompts ask when
 * and where a record came into his life and what his days looked like, never why; the browser's
 * spelling check is on; with a key, "Does this read clearly?" sends that one answer after the notice
 * and marks up to three spots, each with a one-line reason, rewriting nothing; without a key the
 * control is absent.
 */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { passes } from "./checks";
import { checkClarity, clarityPrompt } from "./reading/call";
import { KIND_TEMPLATES } from "./templates";
import { messageReply, PERSON_A, STAND_IN_KEY, standIn } from "./testing/reading";
import { CLARITY_NOTICE, CLARITY_REFUSED, RecordWords, recordPrompt } from "../ui/RecordWords";
import { getState, seedForTests } from "../ui/store";

describe("questions to think with", () => {
  it("no question template contains 'why'", () => {
    for (const t of Object.values(KIND_TEMPLATES)) expect(t.question.toLowerCase()).not.toMatch(/\bwhy\b/);
  });
  it("no reading asks 'why' either (moment map: never ask why)", () => {
    for (const t of Object.values(KIND_TEMPLATES)) for (const r of t.readings) expect(r.ask.toLowerCase()).not.toMatch(/\bwhy\b/);
  });
  it("the prompt about a record asks when and where it came, and what his days looked like, never why", () => {
    const q = recordPrompt("Glass Harbour");
    expect(q).toBe("When and where did “Glass Harbour” come into your life, and what did your days look like then?");
    expect(q).not.toMatch(/\bwhy\b/i);
    expect(passes(q, "offer")).toBe(true);
  });
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;
afterEach(() => {
  if (root) act(() => root!.unmount());
  host?.remove();
  host = root = null;
});
async function draw(node: React.ReactNode) {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => root!.render(node));
  return host;
}
const button = (h: HTMLElement, text: string) => [...h.querySelectorAll("button")].find((b) => b.textContent?.trim() === text);
const click = async (b: HTMLElement) => act(async () => b.click());
const facts = Object.fromEntries(PERSON_A.songs.map((s) => [s.facts.recording_id, s.facts]));
const ANSWER = PERSON_A.words[0]!.text;

describe("the box about each record", () => {
  it("has the browser's spelling check on, and keeps his words about that record unchanged", async () => {
    seedForTests({ songs: PERSON_A.songs.map((s) => s.entry), facts });
    const h = await draw(<RecordWords songs={PERSON_A.songs} />);
    expect(h.textContent).toContain("In your words, if you like");
    await click(button(h, "Write about it")!);
    const box = h.querySelector("textarea")!;
    expect(box.getAttribute("spellcheck")).toBe("true");
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(box, "On the bus to work, 2023.");
      box.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await click(button(h, "Keep my words")!);
    const w = getState().words.at(-1)!;
    expect(w).toMatchObject({ about: "a1", text: "On the bus to work, 2023.", question: recordPrompt("Glass Harbour") });
  });
  it("without a key, 'Does this read clearly?' is absent", async () => {
    seedForTests({ songs: PERSON_A.songs.map((s) => s.entry), facts, words: PERSON_A.words });
    const h = await draw(<RecordWords songs={PERSON_A.songs} />);
    await click(button(h, "Read or change your words")!);
    expect(button(h, "Does this read clearly?")).toBeUndefined();
  });
  it("with a key: the notice first, then up to three spots marked with reasons; his words are not changed", async () => {
    seedForTests({ songs: PERSON_A.songs.map((s) => s.entry), facts, words: PERSON_A.words }, STAND_IN_KEY);
    const reply = { spots: [{ text: "that walk", reason: "It is not clear which walk this is." }] };
    const { fetchFn, seen } = standIn([{ status: 200, body: messageReply(JSON.stringify(reply)) }]);
    const h = await draw(<RecordWords songs={PERSON_A.songs} fetchFn={fetchFn} />);
    await click(button(h, "Read or change your words")!);
    await click(button(h, "Does this read clearly?")!);
    expect(h.textContent).toContain(CLARITY_NOTICE);
    expect(seen).toHaveLength(0);
    await click(button(h, "Send this answer")!);
    await vi.waitFor(() => expect(h.textContent).toContain("It is not clear which walk this is."));
    expect(seen).toHaveLength(1);
    expect(JSON.stringify(seen[0]!.body)).toContain(ANSWER);
    expect(JSON.stringify(seen[0]!.body)).not.toContain(PERSON_A.words[1]!.text);
    expect(h.querySelector("mark")?.textContent).toBe("that walk1");
    expect(h.textContent).toContain("Nothing in your words is changed unless you type.");
    expect(getState().words.find((w) => w.about === "a1")!.text).toBe(ANSWER);
    expect(getState().events.at(-1)).toMatchObject({ kind: "wording_checked" });
    expect(JSON.stringify(getState().events)).not.toContain(ANSWER);
  });
  it("marks that fail a check show nothing", async () => {
    seedForTests({ songs: PERSON_A.songs.map((s) => s.entry), facts, words: PERSON_A.words }, STAND_IN_KEY);
    const reply = { spots: [{ text: "that walk", reason: "Try writing the walk home instead." }] };
    const h = await draw(<RecordWords songs={PERSON_A.songs} fetchFn={standIn([{ status: 200, body: messageReply(JSON.stringify(reply)) }]).fetchFn} />);
    await click(button(h, "Read or change your words")!);
    await click(button(h, "Does this read clearly?")!);
    await click(button(h, "Send this answer")!);
    await vi.waitFor(() => expect(h.textContent).toContain(CLARITY_REFUSED));
  });
});

describe("the checks on the marks", () => {
  const ok = (r: string) => passes(r, "fact");
  it("pass up to three spots that are his words, each with one plain sentence", () => {
    expect(checkClarity({ spots: [] }, ANSWER, ok)).toEqual({ ok: true, spots: [] });
    expect(checkClarity({ spots: [{ text: "that walk", reason: "Which walk is meant is not said." }] }, ANSWER, ok).ok).toBe(true);
  });
  it("refuse four spots, a spot that is not his words, a rewrite, two sentences, a feeling named, or text that is not the shape", () => {
    const s = { text: "that walk", reason: "Which walk is meant is not said." };
    expect(checkClarity({ spots: [s, s, s, s] }, ANSWER, ok).ok).toBe(false);
    expect(checkClarity({ spots: [{ ...s, text: "the walk to work" }] }, ANSWER, ok).ok).toBe(false);
    expect(checkClarity({ spots: [{ ...s, reason: "Replace this with the walk home." }] }, ANSWER, ok).ok).toBe(false);
    expect(checkClarity({ spots: [{ ...s, reason: "Which walk? It is not said." }] }, ANSWER, ok).ok).toBe(false);
    expect(checkClarity({ spots: [{ ...s, reason: "You sound lonely here." }] }, ANSWER, ok).ok).toBe(false);
    expect(checkClarity("not json", ANSWER, ok).ok).toBe(false);
  });
  it("the request asks for marks only, never a rewrite", () => {
    const p = clarityPrompt(ANSWER);
    expect(p).toContain("Do not rewrite anything");
    expect(p).toContain(ANSWER);
  });
});

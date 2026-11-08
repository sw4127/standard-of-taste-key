/**
 * FR-CORE-2 Register and carve-out checks (T8.2). Run at test time on every template and at display
 * time on every filled sentence, because a song title or an artist's name can carry any word. A
 * filled sentence that fails is not shown; the next line, or the quiet line, takes its place.
 *
 * Which rules apply depends on who is speaking (the layers of the Stage 6 checks):
 * - "key":   a line the product states about the person or their record: no feeling word, no
 *            assertion about their inner life, no comparison, nothing in the carve-out.
 * - "fact":  a line about a song or its record (evidence, a gloss, a chance figure): the same.
 * - "offer": a question to the person: must be a question; no assertion, no comparison, no carve-out.
 *            A question may name a feeling, because it hands the feeling over to accept or refuse.
 * - "said":  a reading as the person kept it ("You said: …"): their own choice, so it may name a
 *            feeling; no assertion, no comparison, no carve-out.
 * - "story": a stored story: may name a feeling of its own people, never addresses the reader.
 * - "words": the person's own words: only the carve-out applies (they are theirs, shown to them).
 *
 * Names are quoted, not stated. A song called "Lost" says nothing about the person who named it, so
 * the feeling-word rule reads a filled sentence with its names masked; the carve-out and every other
 * rule read the whole sentence, names included ("a song titled with a carve-out word yields no line").
 *
 * Traditional Chinese is folded to simplified before checking (OpenCC tables, opencc-js 1.4.2,
 * MIT and Apache-2.0), because the Chinese lists are written in simplified characters.
 */
import * as OpenCC from "opencc-js/t2cn";
import { CARVE_OUT_PATTERNS } from "./carve-out";
import { ADDRESSES_READER, ASSERTIONS, COMPARISON, FEELING_WORDS, FEELING_WORDS_ZH } from "./register";

export type Layer = "key" | "fact" | "offer" | "said" | "story" | "words";

const toSimplified = OpenCC.Converter({ from: "tw", to: "cn" });

/** NFKC, then traditional to simplified, so full-width letters and traditional characters are caught. */
export const fold = (text: string) => toSimplified(text.normalize("NFKC"));

const hits = (text: string, ps: readonly RegExp[]) => ps.filter((p) => p.test(text)).map((p) => p.source);

const mask = (text: string, names: readonly string[]) =>
  [...names].filter(Boolean).sort((a, b) => b.length - a.length).reduce((t, n) => t.split(fold(n)).join("…"), text);

/** Why a sentence fails for its layer, or [] when it passes. `names` are quoted titles and names in it. */
export function breaches(text: string, layer: Layer, names: readonly string[] = []): string[] {
  const t = fold(text);
  const out = hits(t, CARVE_OUT_PATTERNS).map((p) => `carve-out: ${p}`);
  if (layer === "words") return out;
  out.push(...hits(t, COMPARISON).map((p) => `comparison: ${p}`));
  out.push(...hits(t, ASSERTIONS).map((p) => `assertion: ${p}`));
  if (layer === "key" || layer === "fact") {
    const m = mask(t, names);
    const f = FEELING_WORDS.exec(m) ?? FEELING_WORDS_ZH.exec(m);
    if (f) out.push(`names a feeling: ${f[0]}`);
  }
  if (layer === "story" && ADDRESSES_READER.test(t)) out.push("a story addresses the reader");
  if (layer === "offer" && !/[?？]\s*$/.test(t)) out.push("an offer is not a question");
  return out;
}

export const passes = (text: string, layer: Layer, names: readonly string[] = []) => breaches(text, layer, names).length === 0;

/**
 * T9.5 My taste note (FR-T9.5) and the rows it is built from: D6 Offered Readings (a person's choice
 * on a line) and D14 My Words (their answer to a question to think with). The note is assembled only
 * from readings the person kept and answers they chose to keep; nothing on it is generated.
 */
import type { Key } from "./design/key-colour";
import type { Evidence } from "./patterns";
import type { ReadingRow } from "./reading/rows";

export type ChoiceValue = "first" | "second" | "neither";

/** D6, with the line as it read when the person answered it (so the note's receipt never shifts). */
export interface Choice {
  question_id: string;
  person_id: string;
  source: "named songs" | "my plays" | "a history";
  pattern_kind: string;
  pattern_text: string;
  evidence: Evidence[];
  readings_offered: [string, string];
  /** The kept form of each offered reading, in the same order. */
  readings_kept: [string, string];
  choice: ChoiceValue;
  answered_at: string;
}

/** D14. */
export interface Words {
  words_id: string;
  person_id: string;
  question: string;
  about: string; // question_id of the line it answers
  text: string;
  written_at: string;
  in_note: boolean;
}

export interface NoteSentence {
  /** What the note shows. */
  text: string;
  /** The D6, D14 or D15 row it comes from. */
  from: { choice: string } | { words: string } | { guess: string };
  date: string;
  pattern?: string;
  evidence?: Evidence[];
  /** FR-T9.9: "A reading you accepted", or "Your words" written in place of a guess. */
  label?: "A reading you accepted" | "Your words";
  quotes?: string[];
}

/** FR-T9.9: guesses he marked "Yes", newest first. Only these, and his fixes, reach the note. */
export function acceptedGuesses(readings: ReadingRow[], person = "me"): NoteSentence[] {
  return readings
    .filter((r) => r.person_id === person)
    .flatMap((r) => r.guesses.filter((g) => g.verdict === "yes").map((g) => ({ g, at: g.verdict_at ?? r.made_at })))
    .sort((a, b) => b.at.localeCompare(a.at))
    .map(({ g, at }) => ({ text: g.question, from: { guess: g.guess_id }, date: localDay(at), label: "A reading you accepted" as const, quotes: g.quotes.map((q) => q.quote) }));
}

export const kept = (c: Choice) => c.choice !== "neither";

/** The date a person sees is their own calendar day, never the UTC one. */
export function localDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function noteAvailable(choices: Choice[], words: Words[], person = "me", readings: ReadingRow[] = []): boolean {
  const k = choices.filter((c) => c.person_id === person && kept(c)).length + acceptedGuesses(readings, person).length;
  const w = words.filter((x) => x.person_id === person && x.in_note && x.text.trim()).length;
  return k >= 2 || (k >= 1 && w >= 1);
}

export function assembleNote(choices: Choice[], words: Words[], keys: Key[], person = "me", readingRows: ReadingRow[] = []) {
  const guessIds = new Set(readingRows.flatMap((r) => r.guesses.map((g) => g.guess_id)));
  const accepted = acceptedGuesses(readingRows, person);
  const readings: NoteSentence[] = choices
    .filter((c) => c.person_id === person && kept(c))
    .sort((a, b) => b.answered_at.localeCompare(a.answered_at))
    .map((c) => ({
      text: `You said: ${c.readings_kept[c.choice === "first" ? 0 : 1]}.`,
      from: { choice: c.question_id },
      date: localDay(c.answered_at),
      pattern: c.pattern_text,
      evidence: c.evidence,
    }));
  const own: NoteSentence[] = words
    .filter((w) => w.person_id === person && w.in_note && w.text.trim())
    .sort((a, b) => b.written_at.localeCompare(a.written_at))
    .map((w) => ({ text: w.text.trim(), from: { words: w.words_id }, date: localDay(w.written_at), pattern: w.question, ...(guessIds.has(w.about) ? { label: "Your words" as const } : {}) }));
  const front = [...readings.map((s) => ({ s, at: s.date })), ...accepted.map((s) => ({ s, at: s.date }))].sort((a, b) => b.at.localeCompare(a.at)).map((x) => x.s);
  return { front: front.slice(0, 3), readings, accepted, own, swatches: keys };
}

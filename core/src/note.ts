/**
 * T9.5 My taste note (FR-T9.5) and the rows it is built from: D6 Offered Readings (a person's choice
 * on a line) and D14 My Words (their answer to a question to think with). The note is assembled only
 * from readings the person kept and answers they chose to keep; nothing on it is generated.
 */
import type { Key } from "./design/key-colour";
import type { Evidence } from "./patterns";

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
  /** The D6 or D14 row it comes from. */
  from: { choice: string } | { words: string };
  date: string;
  pattern?: string;
  evidence?: Evidence[];
}

export const kept = (c: Choice) => c.choice !== "neither";

/** The date a person sees is their own calendar day, never the UTC one. */
export function localDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function noteAvailable(choices: Choice[], words: Words[], person = "me"): boolean {
  const k = choices.filter((c) => c.person_id === person && kept(c)).length;
  const w = words.filter((x) => x.person_id === person && x.in_note && x.text.trim()).length;
  return k >= 2 || (k >= 1 && w >= 1);
}

export function assembleNote(choices: Choice[], words: Words[], keys: Key[], person = "me") {
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
    .map((w) => ({ text: w.text.trim(), from: { words: w.words_id }, date: localDay(w.written_at), pattern: w.question }));
  return { front: readings.slice(0, 3), readings, own, swatches: keys };
}

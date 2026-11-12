/**
 * D15 Readings and D16 Model connection (FR-T9.9, A5, Amendment of 2026-11-11), and the reading
 * sheet's file for the swap test with decoys (FR-T9.10 part 3).
 *
 * D15: when it was made; the model's identifier; a hash of what was sent; each guess with its quotes,
 * facts, library ID and his verdict. Shown unchanged on every later visit. In the export.
 * D16: the provider, the key, when it was saved, the last test. Kept in this browser only, in its own
 * store: never in the export, never in the usage log, never shown again after it is saved (only its
 * last four characters are). Deleted by "Remove key" and by "Erase everything".
 */
import { breaches } from "../checks";
import type { CheckedGuess } from "./check";
import type { Sent } from "./prompt";

export type Verdict = "yes" | "partly" | "neither";

export interface GuessRow {
  guess_id: string;
  question: string;
  quotes: { record_id: string; entry_id: string; title: string; quote: string }[];
  what_it_did: { record_id: string; entry_id: string; title: string; quote: string }[];
  facts: { fact_id: string; text: string }[];
  library_id: string;
  /** Counted by code: the records its quotes and facts are about. */
  rests_on: number;
  verdict?: Verdict;
  verdict_at?: string;
}

export interface ReadingRow {
  reading_id: string;
  person_id: string;
  made_at: string;
  model: string;
  sent_hash: string;
  guesses: GuessRow[];
}

export interface Connection {
  provider: "anthropic";
  key: string;
  saved_at: string;
  last_test?: { at: string; ok: boolean; sentence: string };
}

/** What a screen may know of the connection: never the key, only its last four characters. */
export type ConnectionView = Omit<Connection, "key"> & { key_last4: string };
export const viewOf = (c: Connection): ConnectionView => {
  const { key, ...rest } = c;
  return { ...rest, key_last4: key.slice(-4) };
};

/** A checked guess as stored, with each record and fact named, so it reads the same on every visit. */
export function guessRows(guesses: CheckedGuess[], sent: Sent, id: () => string): GuessRow[] {
  const rec = new Map(sent.records.map((r) => [r.record_id, r]));
  const quote = (q: { record_id: string; quote: string }) => ({ record_id: q.record_id, entry_id: rec.get(q.record_id)!.entry_id, title: rec.get(q.record_id)!.title, quote: q.quote });
  return guesses.map((g) => ({
    guess_id: id(),
    question: g.question,
    quotes: g.quotes.map(quote),
    what_it_did: g.what_it_did.map(quote),
    facts: g.fact_ids.map((f) => ({ fact_id: f, text: sent.facts.find((x) => x.fact_id === f)!.text })),
    library_id: g.library_id,
    rests_on: g.records.length,
  }));
}

/** "You have accepted A of B guesses so far." */
export function accepted(readings: ReadingRow[], person = "me"): { a: number; b: number } {
  const all = readings.filter((r) => r.person_id === person).flatMap((r) => r.guesses);
  return { a: all.filter((g) => g.verdict === "yes").length, b: all.length };
}

// ---- The swap test with decoys (FR-T9.10 part 3) ---------------------------------------------------------

export const QUESTIONS_FILE = "the-key-reading-questions";

export interface QuestionsFile {
  kind: typeof QUESTIONS_FILE;
  exported_at: string;
  questions: { id: string; question: string }[];
}

const REMOVED = "[…]";
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Every quote, fact and record name taken out of a question, so only its own words leave. */
export function redact(g: GuessRow): string {
  const out = [...g.quotes, ...g.what_it_did].flatMap((q) => [q.quote, q.title]).concat(g.facts.map((f) => f.text));
  return out
    .filter((x) => x.trim().length > 1)
    .sort((a, b) => b.length - a.length)
    .reduce((t, x) => t.replace(new RegExp(escapeRe(x.trim()).replace(/\s+/g, "\\s+"), "gi"), REMOVED), g.question);
}

/** The file a person makes of their own readings for someone else's sheet: the questions only. */
export function questionsFile(readings: ReadingRow[], at: string, person = "me"): QuestionsFile {
  return { kind: QUESTIONS_FILE, exported_at: at, questions: readings.filter((r) => r.person_id === person).flatMap((r) => r.guesses.map((g) => ({ id: g.guess_id, question: redact(g) }))) };
}

/**
 * Read a questions file, or null when it is not one. The file comes from someone else and may have
 * been edited, so every question passes the register and carve-out checks again here (rule 3);
 * one that fails is left out.
 */
export function readQuestionsFile(text: string): QuestionsFile | null {
  try {
    const v = JSON.parse(text) as QuestionsFile;
    if (v?.kind !== QUESTIONS_FILE || !Array.isArray(v.questions)) return null;
    const questions = v.questions
      .filter((q) => typeof q?.id === "string" && typeof q?.question === "string" && breaches(q.question, "offer").length === 0)
      .map((q) => ({ id: q.id, question: q.question }));
    return { kind: QUESTIONS_FILE, exported_at: String(v.exported_at ?? ""), questions };
  } catch {
    return null;
  }
}

/** The second person's guesses, held under their own person row: a reading row with questions alone. */
export function theirReading(f: QuestionsFile, person_id: string, at: string): ReadingRow {
  return {
    reading_id: `${person_id}:questions`,
    person_id,
    made_at: at,
    model: "from their own file",
    sent_hash: "",
    guesses: f.questions.map((q) => ({ guess_id: `${person_id}:${q.id}`, question: q.question, quotes: [], what_it_did: [], facts: [], library_id: "none", rests_on: 0 })),
  };
}

export interface SheetItem {
  id: string;
  question: string;
  owner: string;
}

/**
 * The reading sheet: his guesses and the second person's, each with every quote, fact and record name
 * taken out (so neither side gives itself away), mixed by a seeded shuffle, owners hidden from the screen.
 */
export function readingSheet(readings: ReadingRow[], me: string, them: string, mixFn: <L extends { id: string }>(a: L[], b: L[], oa: string, ob: string) => { line: L; owner: string }[]): SheetItem[] {
  const of = (p: string) => readings.filter((r) => r.person_id === p).flatMap((r) => r.guesses.map((g) => ({ id: g.guess_id, question: p === me ? redact(g) : g.question })));
  return mixFn(of(me), of(them), me, them).map((m) => ({ id: m.line.id, question: m.line.question, owner: m.owner }));
}

/** Per owner, how many of their guesses were marked "Mine", of how many answered. */
export function sheetCounts(items: SheetItem[], answers: Record<string, string | undefined>): Record<string, { mine: number; answered: number; of: number }> {
  const out: Record<string, { mine: number; answered: number; of: number }> = {};
  for (const it of items) {
    const c = (out[it.owner] ??= { mine: 0, answered: 0, of: 0 });
    c.of++;
    const a = answers[it.id];
    if (a) c.answered++;
    if (a === "Mine") c.mine++;
  }
  return out;
}

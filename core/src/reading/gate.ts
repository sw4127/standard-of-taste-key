/**
 * FR-T9.10, the gate before the reading is shown to anyone. Its counts live in `gate.json`, written
 * when the gate was run; code decides from the counts whether the reading may show. Part 1's counts
 * are checked against the planted outputs on every `npm test` (t9-10.test.ts), so the file cannot say
 * more than the test proves. Fails closed: if part 1 or part 2 fails, or the file says nothing,
 * `/reading` shows "The reading is not ready yet." and nothing else of FR-T9.9.
 */
import data from "./gate.json";

export interface GateRecord {
  run_on: string;
  note?: string;
  planted: { outputs: number; refused: number; good_passed: boolean };
  fresh: {
    model_level: string;
    runs: { person: "a" | "b" | "c"; run: number; quotes: number; quotes_word_for_word: number; guesses: number; refused_by_code: boolean; rules_broken: number }[];
  } | null;
}

export const NOT_READY = "The reading is not ready yet.";
export const MIN_PLANTED = 12;

/** Part 1: at least twelve planted outputs, every one refused, and the well-formed one passed. */
export const plantedPasses = (g: GateRecord) => g.planted.outputs >= MIN_PLANTED && g.planted.refused === g.planted.outputs && g.planted.good_passed;

/** Part 2: three fresh runs for each of the three people; every quote word for word; "none" for (b) three times in three; no rule broken. */
export function freshPasses(g: GateRecord): boolean {
  const f = g.fresh;
  if (!f) return false;
  const of = (p: "a" | "b" | "c") => f.runs.filter((r) => r.person === p);
  if (!(["a", "b", "c"] as const).every((p) => of(p).length >= 3)) return false;
  if (!f.runs.every((r) => r.quotes === r.quotes_word_for_word && r.rules_broken === 0)) return false;
  return of("b").every((r) => r.guesses === 0);
}

export const GATE = data as GateRecord;
export const readingReady = (g: GateRecord = GATE) => plantedPasses(g) && freshPasses(g);

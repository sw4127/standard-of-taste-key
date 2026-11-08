/**
 * FR-CORE-4 The check-A sheet and the swap test. Wherever a person judges lines, each line offers
 * five answers that cover every case exactly once (Bob's ruling, 2026-11-08, replacing the PRD's four,
 * which mixed novelty, truth, caring and feeling and left cases out). They are built from the three
 * conditions a line must meet: true when checked, new, and mattering to the person. Truth comes first;
 * only a true line is split by new or known; only a true new line is split by whether it matters.
 * The north star's success is the first answer. The swap test mixes lines from two people's songs, with whose they are
 * hidden, and asks of each "Mine · Not mine · Can't tell". It passes for the person answering when at
 * least half of the lines built from their songs are marked "Mine" and at most one line built from the
 * other person's songs is. Code counts; nothing here is a judgement of the person.
 */
import { seeded } from "./rng";

export const CHECK_A = [
  "True, new to me, and it matters to me",
  "True and new to me, but I don't care",
  "True, but I already knew it",
  "Not true when I check",
  "I can't check it",
] as const;
export type CheckA = (typeof CHECK_A)[number];

export const SWAP = ["Mine", "Not mine", "Can't tell"] as const;
export type Swap = (typeof SWAP)[number];

export interface Judged<T extends string> {
  line_id: string;
  owner: string;
  value: T;
}

export const isCheckA = (v: string | undefined): v is CheckA => (CHECK_A as readonly string[]).includes(v ?? "");

/** Counts per answer. An answer from an earlier answer set is not counted. */
export function tallyCheckA(answers: Judged<string>[]): Record<CheckA, number> {
  const out = Object.fromEntries(CHECK_A.map((a) => [a, 0])) as Record<CheckA, number>;
  for (const a of answers) if (isCheckA(a.value)) out[a.value]++;
  return out;
}

/** Lines from two people, interleaved in an order fixed by their ids, so it never sorts by owner. */
export function mix<L extends { id: string }>(a: L[], b: L[], ownerA: string, ownerB: string): { line: L; owner: string }[] {
  const all = [...a.map((line) => ({ line, owner: ownerA })), ...b.map((line) => ({ line, owner: ownerB }))];
  const seed = [...all.map((x) => x.owner + x.line.id).join("|")].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  const rnd = seeded(seed);
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [all[i], all[j]] = [all[j]!, all[i]!];
  }
  return all;
}

export interface SwapResult {
  own: { mine: number; of: number };
  other: { mine: number; of: number };
  passes: boolean;
}

/** The swap test's rule, for the person answering (`judge`). */
export function swapResult(answers: Judged<Swap>[], judge: string): SwapResult {
  const own = answers.filter((a) => a.owner === judge);
  const other = answers.filter((a) => a.owner !== judge);
  const r = {
    own: { mine: own.filter((a) => a.value === "Mine").length, of: own.length },
    other: { mine: other.filter((a) => a.value === "Mine").length, of: other.length },
  };
  return { ...r, passes: r.own.of > 0 && r.own.mine >= r.own.of / 2 && r.other.mine <= 1 };
}

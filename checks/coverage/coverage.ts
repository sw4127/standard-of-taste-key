/**
 * The coverage bar (FR-CORE-1 v7, acceptance c; T1.2; Bob's ruling of 2026-11-10: at least 8 in 10
 * nameable videos named on the hidden half, 0 wrong). Never shipped.
 *
 * - The titles are split in two by a seeded shuffle: an open half the rule may be tuned on, and a
 *   hidden half whose results are not produced until the rule's version is frozen.
 * - Freezing records a fingerprint of the rule's source files. The hidden half is run only when the
 *   rule's files still have that fingerprint; if the rule changes after the hidden half was seen, the
 *   result is void and a fresh hidden half is needed.
 * - On the hidden half, a video whose song is not on MusicBrainz, or which is a whole album, is
 *   marked and set aside. Of the rest, at least 8 in 10 must be named and none may be wrong.
 */
import { createHash } from "node:crypto";
import { seeded } from "../../core/src/rng";

export const COVERAGE_SEED = 20261111;
export const MIN_TITLES = 40;
export const BAR = 0.8;

export interface Split {
  open: string[];
  hidden: string[];
}

/** A seeded shuffle, then the first half open and the second half hidden. The same titles always split the same way. */
export function split(titles: string[], seed = COVERAGE_SEED): Split {
  const unique = [...new Set(titles.map((t) => t.trim()).filter(Boolean))];
  if (unique.length < MIN_TITLES) throw new Error(`The coverage bar needs at least ${MIN_TITLES} titles; this list has ${unique.length}.`);
  const rnd = seeded(seed);
  const order = unique.map((t) => ({ t, k: rnd() })).sort((a, b) => a.k - b.k).map((x) => x.t);
  const half = Math.ceil(order.length / 2);
  return { open: order.slice(0, half), hidden: order.slice(half) };
}

/** A fingerprint of the rule: the same text gives the same fingerprint, any change gives another. */
export function fingerprint(sources: string[]): string {
  const h = createHash("sha256");
  for (const s of sources) h.update(s.replace(/\r\n/g, "\n")).update("\u0000");
  return h.digest("hex").slice(0, 16);
}

export interface Frozen {
  rule_version: string;
  fingerprint: string;
  frozen_at: string;
}

export type HiddenState =
  | { state: "not frozen" }
  | { state: "may run" }
  | { state: "void"; why: string };

/** May the hidden half be run, or read, with the rule as it is now? */
export function hiddenState(frozen: Frozen | null, now: { rule_version: string; fingerprint: string }, hiddenSeen: boolean): HiddenState {
  if (!frozen) return { state: "not frozen" };
  if (frozen.fingerprint !== now.fingerprint || frozen.rule_version !== now.rule_version) {
    return hiddenSeen
      ? { state: "void", why: "The rule changed after the hidden half was seen. A fresh hidden half is needed." }
      : { state: "not frozen" };
  }
  return { state: "may run" };
}

/** One mark per hidden-half video, each case landing on exactly one. */
export const COVERAGE_MARKS = [
  "Named, and right",
  "Named, and wrong",
  "Silent, and the song is on MusicBrainz",
  "Silent, and the song is not on MusicBrainz",
  "A whole album, or not a song",
] as const;
export type CoverageMark = (typeof COVERAGE_MARKS)[number];

export interface Tally {
  videos: number;
  setAside: number;
  nameable: number;
  named: number;
  wrong: number;
  silent: number;
  share: number;
  passes: boolean;
  unmarked: number;
}

/** The bar: of the nameable videos, at least 8 in 10 named, and none wrong. A wrong name is nameable and fails the bar by itself. */
export function tally(marks: (CoverageMark | undefined)[]): Tally {
  const count = (m: CoverageMark) => marks.filter((x) => x === m).length;
  const named = count("Named, and right");
  const wrong = count("Named, and wrong");
  const silent = count("Silent, and the song is on MusicBrainz");
  const setAside = count("Silent, and the song is not on MusicBrainz") + count("A whole album, or not a song");
  const unmarked = marks.filter((x) => !x).length;
  const nameable = named + wrong + silent;
  const share = nameable ? named / nameable : 0;
  return { videos: marks.length, setAside, nameable, named, wrong, silent, share, unmarked, passes: unmarked === 0 && nameable > 0 && wrong === 0 && named * 10 >= nameable * 8 };
}

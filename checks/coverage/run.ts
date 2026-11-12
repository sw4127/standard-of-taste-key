/**
 * Running the coverage bar against MusicBrainz, and writing its sheet (never shipped). Only song and
 * artist names from the video titles are sent, to MusicBrainz's search, one call per 1.3 s.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { matchTitle, readBook, RULE_VERSION, silenceLine, trackForms, outsideParts } from "../../core/src/match/v7";
import { Gate, type FetchFn } from "../../core/src/sources/http";
import { COVERAGE_MARKS, fingerprint, hiddenState, split, tally, type CoverageMark, type Frozen } from "./coverage";
import { COVERAGE_COPIED_ON, COVERAGE_SECONDS, COVERAGE_TITLES, COVERAGE_UPLOADER } from "./titles";

const here = dirname(fileURLToPath(import.meta.url));
const core = join(here, "..", "..", "core", "src");
export const RULE_FILES = ["match/parse.ts", "match/v6.ts", "match/v7.ts", "match/studio.ts"];
export const ruleNow = () => ({ rule_version: RULE_VERSION, fingerprint: fingerprint(RULE_FILES.map((f) => readFileSync(join(core, f), "utf8"))) });

const FROZEN = join(here, "frozen.json");
const HIDDEN = join(here, "hidden-half.json");
const MARKS = join(here, "hidden-marks.json");
export const readJson = <T>(file: string): T | null => (existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as T) : null);
export const frozen = () => readJson<Frozen>(FROZEN);

export interface Row {
  title: string;
  named?: { title: string; artist: string; first?: string; record?: string; recording_id: string };
  silent?: string;
  line?: string;
  /** For a silent row: what MusicBrainz holds under the track and the names read, to judge whether the song is there. */
  lookup?: string[];
  error?: string;
}

const UA = "StandardOfTaste-TheKey/0.1 (private prototype; coverage check)";
const fetchFn: FetchFn = (u) => fetch(u, { headers: { "User-Agent": UA } });

async function lookup(title: string, gate: Gate): Promise<string[]> {
  const book = readBook(title);
  if (!book) return [];
  const track = trackForms(book.track).at(-1)!;
  const out: string[] = [];
  for (const name of outsideParts(book.outside).slice(0, 2)) {
    await gate.wait();
    const q = `recording:"${track.replace(/["\\]/g, "\\$&")}" AND artist:"${name.replace(/["\\]/g, "\\$&")}"`;
    try {
      const r = await fetch(`https://musicbrainz.org/ws/2/recording?query=${encodeURIComponent(q)}&limit=5&fmt=json`, { headers: { "User-Agent": UA } });
      const j = (await r.json()) as { recordings?: { title: string; score: number; "artist-credit"?: { name: string }[] }[] };
      for (const x of j.recordings ?? []) out.push(`${x.title} · ${(x["artist-credit"] ?? []).map((a) => a.name).join(" & ")} (score ${x.score})`);
    } catch {
      out.push("MusicBrainz did not answer this lookup.");
    }
  }
  return [...new Set(out)].slice(0, 5);
}

export async function runTitles(titles: string[], withLookup: boolean): Promise<Row[]> {
  const gate = new Gate(1300);
  const cache = new Map<string, unknown>();
  const rows: Row[] = [];
  for (const title of titles) {
    try {
      // The video's length, from Bob's paste, as the panel reads it from the player (rule v7.2).
      const r = await matchTitle(title, { fetchFn, gate, cache }, { videoSeconds: COVERAGE_SECONDS[title] });
      if (r.state === "certain") {
        rows.push({ title, named: { title: r.candidate.title, artist: r.candidate.artist_credit, first: r.candidate.first_release, record: r.candidate.record, recording_id: r.candidate.recording_id } });
      } else {
        rows.push({ title, silent: r.reason, line: silenceLine(r), lookup: withLookup ? await lookup(title, gate) : undefined });
      }
    } catch (e) {
      rows.push({ title, error: (e as Error).message });
    }
  }
  return rows;
}

const rowLine = (r: Row, i: number, mark?: string) =>
  `| ${i + 1} | ${r.title.replace(/\|/g, "¦")} | ${
    r.named ? `**${r.named.title} · ${r.named.artist}** · ${r.named.first ?? "no date"} · ${r.named.record ?? "no record"} · [recording](https://musicbrainz.org/recording/${r.named.recording_id})` : r.error ? `not run: ${r.error}` : `silent (${r.silent}): “${r.line}”${r.lookup?.length ? `<br>MusicBrainz holds: ${r.lookup.join("; ")}` : r.lookup ? "<br>MusicBrainz holds nothing under this title and these names." : ""}`
  } |${mark === undefined ? "" : ` ${mark} |`}`;

export function openSheet(rows: Row[]): string {
  const named = rows.filter((r) => r.named).length;
  return [
    `# Coverage bar: the open half (rule ${RULE_VERSION})`,
    "",
    `Uploader: ${COVERAGE_UPLOADER}. Copied by Bob on ${COVERAGE_COPIED_ON}. ${COVERAGE_TITLES.length} videos, split in two by a seeded shuffle. This is the half the rule may be tuned on; it is not the bar.`,
    "",
    `Named: ${named} of ${rows.length}. Silent: ${rows.filter((r) => r.silent).length}. Not run: ${rows.filter((r) => r.error).length}.`,
    "",
    "| # | Video title | What the rule did |",
    "|---|---|---|",
    ...rows.map((r, i) => rowLine(r, i)),
    "",
  ].join("\n");
}

export function hiddenSheet(rows: Row[], marks: Record<string, CoverageMark>, f: Frozen, markedBy: string): string {
  const t = tally(rows.map((r) => marks[r.title]));
  return [
    `# Coverage bar: the hidden half (rule ${f.rule_version}, frozen ${f.frozen_at}, fingerprint ${f.fingerprint})`,
    "",
    `Uploader: ${COVERAGE_UPLOADER}. Copied by Bob on ${COVERAGE_COPIED_ON}. These ${rows.length} videos were held back by a seeded shuffle; the rule's results on them were produced only after the rule was frozen.`,
    "",
    "**The bar (Bob, 2026-11-10):** of the videos whose song is on MusicBrainz, at least 8 in 10 are named and none is wrong. Whole-album videos and songs not on MusicBrainz are set aside.",
    "",
    `| Videos | Set aside | Nameable | Named, and right | Wrong | Silent though on MusicBrainz | Share named | Not yet marked |`,
    "|---|---|---|---|---|---|---|---|",
    `| ${t.videos} | ${t.setAside} | ${t.nameable} | ${t.named} | ${t.wrong} | ${t.silent} | ${t.nameable ? `${t.named} of ${t.nameable} (${Math.round(t.share * 100)} in 100)` : "none"} | ${t.unmarked} |`,
    "",
    `**Result: ${t.unmarked ? "not all rows are marked yet" : t.passes ? "the bar is met" : "the bar is not met"}.**`,
    "",
    `Marks: ${markedBy}`,
    "",
    `The marks a row can take: ${COVERAGE_MARKS.join(" · ")}.`,
    "",
    "| # | Video title | What the rule did | Mark |",
    "|---|---|---|---|",
    ...rows.map((r, i) => rowLine(r, i, marks[r.title] ?? "")),
    "",
  ].join("\n");
}

/** Freeze the rule as it is now. */
export function freeze(at: string): Frozen {
  const was = frozen();
  const now = ruleNow();
  // Once the hidden half has been seen, the rule cannot be frozen again in another form: that would
  // make a changed rule look as if it had been frozen before the hidden half was run.
  if (existsSync(HIDDEN) && was && was.fingerprint !== now.fingerprint) {
    throw new Error("The hidden half has been seen with another version of the rule. A fresh hidden half is needed before the rule is frozen again.");
  }
  const f: Frozen = { ...now, frozen_at: at };
  writeFileSync(FROZEN, JSON.stringify(f, null, 1) + "\n");
  return f;
}

export const paths = { FROZEN, HIDDEN, MARKS, openSheet: join(here, "..", "coverage-open-half.md"), hiddenSheet: join(here, "..", "coverage-hidden-half.md") };
export const halves = () => split(COVERAGE_TITLES);
export const stateNow = () => hiddenState(frozen(), ruleNow(), existsSync(HIDDEN));

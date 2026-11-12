/**
 * FR-T1.4 Fix, as replaced by the Amendments of 2026-11-10 (T1.4). When the panel is wrong or silent,
 * the person keeps the recording they actually played.
 *
 * - Up to eight rows. First: the studio recording by the artist read from the title (official album,
 *   single or EP; earliest first release), labelled "Studio recording · the original". Then other
 *   recordings by that artist, each labelled in plain words from MusicBrainz's own data.
 * - Every row shows title · artist · first release date · record · length. The row whose length is
 *   within 5 seconds of the playing video's is marked "same length as this video". A missing fact is
 *   said, never left blank.
 * - Recordings by other artists appear only when none by the read artist exists, under the heading
 *   "Same title, other artists".
 *
 * Pure functions over MusicBrainz search results; the screen and the searches are in NowPlaying.
 */
import { isStudio, normalise, studioDate, type MbRecording } from "./studio";
import { creditText } from "./studio";
import type { Candidate } from "./v6";

export const FIX_ROWS = 8;
export const SAME_LENGTH_SECONDS = 5;

export type FixKind = "original" | "studio" | "live" | "remix" | "dj-mix" | "edit" | "compilation" | "other";

export interface FixRow {
  candidate: Candidate;
  kind: FixKind;
  /** What this recording is, in plain words from MusicBrainz's own data. */
  label: string;
  /** title · artist · first release date · record · length, each said even when missing. */
  facts: string[];
  sameLength: boolean;
}

export interface FixList {
  rows: FixRow[];
  /** Set when no recording by the read artist exists: the rows are other artists' songs of the same title. */
  heading?: "Same title, other artists";
}

type Release = NonNullable<MbRecording["releases"]>[number] & { title?: string };
const releases = (r: MbRecording) => (r.releases ?? []) as Release[];
const secondaries = (x: Release) => x["release-group"]?.["secondary-types"] ?? [];
const official = (r: MbRecording) => releases(r).filter((x) => x.status === "Official");
const every = (r: MbRecording, type: string) => official(r).length > 0 && official(r).every((x) => secondaries(x).includes(type));

/** m:ss from MusicBrainz's milliseconds. */
export const mmss = (ms: number) => `${Math.floor(Math.round(ms / 1000) / 60)}:${String(Math.round(ms / 1000) % 60).padStart(2, "0")}`;

/** The earliest dated official release, and the record it is on. A studio release is preferred to any other. */
export function firstRelease(r: MbRecording): { date?: string; record?: string } {
  const dated = (xs: Release[]) => xs.filter((x) => x.date).sort((a, b) => a.date!.localeCompare(b.date!));
  const studio = official(r).filter((x) => ["Album", "Single", "EP"].includes(x["release-group"]?.["primary-type"] ?? "") && secondaries(x).length === 0);
  const pick = dated(studio)[0] ?? dated(official(r))[0] ?? dated(releases(r))[0];
  if (pick) return { date: pick.date, record: pick.title };
  const any = studio[0] ?? official(r)[0] ?? releases(r)[0];
  return { date: r["first-release-date"] || undefined, record: any?.title };
}

/** What kind of recording this is, read from its title, its note on MusicBrainz and the records it is on. */
export function kindOf(r: MbRecording): { kind: Exclude<FixKind, "original">; detail?: string } {
  const note = (r.disambiguation ?? "").trim();
  const text = `${r.title} ${note}`;
  if (/DJ[\s\-‐]?mix/i.test(text) || every(r, "DJ-mix")) return { kind: "dj-mix" };
  if (/^live\b/i.test(note) || /\(live\b/i.test(r.title) || /现场|演唱会/.test(text) || every(r, "Live")) {
    const where = note.replace(/^live[\s,:]*/i, "").trim();
    return { kind: "live", detail: where || undefined };
  }
  if (/remix|\bmix\)/i.test(text) || every(r, "Remix")) return { kind: "remix" };
  if (/\bedit\b/i.test(text)) return { kind: "edit" };
  if (isStudio(r, r.title)) return { kind: "studio" };
  if (every(r, "Compilation")) return { kind: "compilation" };
  return { kind: "other", detail: note || undefined };
}

const LABEL: Record<FixKind, string> = {
  original: "Studio recording · the original",
  studio: "Studio recording",
  live: "Live",
  remix: "Remix",
  "dj-mix": "DJ-mix excerpt",
  edit: "Edit",
  compilation: "On a compilation",
  other: "Another recording",
};

function labelFor(kind: FixKind, detail?: string): string {
  if (kind === "live" && detail) return `Live · ${detail}`;
  if (kind === "other" && detail) return `Another recording · MusicBrainz notes “${detail}”`;
  return LABEL[kind];
}

/** Earlier kinds come first in the list; within a kind, the earlier release comes first. */
const ORDER: FixKind[] = ["original", "studio", "edit", "live", "remix", "compilation", "dj-mix", "other"];

function toRow(r: MbRecording, kind: FixKind, detail: string | undefined, videoSeconds: number | undefined): FixRow {
  const first = firstRelease(r);
  const lead = r["artist-credit"]?.[0]?.artist;
  const sameLength = videoSeconds !== undefined && r.length !== undefined && Math.abs(r.length / 1000 - videoSeconds) <= SAME_LENGTH_SECONDS;
  return {
    candidate: { recording_id: r.id, title: r.title, artist_credit: creditText(r), first_release: first.date, record: first.record, lead: lead && { id: lead.id, name: lead.name } },
    kind,
    label: labelFor(kind, detail),
    facts: [
      r.title,
      creditText(r) || "no artist on MusicBrainz",
      first.date ?? "no release date on MusicBrainz",
      first.record ?? "no record on MusicBrainz",
      r.length !== undefined && r.length !== null ? mmss(r.length) : "no length on MusicBrainz",
    ],
    sameLength,
  };
}

/**
 * The list Fix shows. `byReadArtist` says whether a recording is by an artist read from the title
 * (version 7's check that a credited name stands in it); `sameTitle` whether it is the track read.
 */
export function fixList(found: MbRecording[], o: { byReadArtist: (r: MbRecording) => boolean; sameTitle?: (r: MbRecording) => boolean; videoSeconds?: number }): FixList {
  const unique = [...new Map(found.map((r) => [r.id, r])).values()];
  const titled = o.sameTitle ? unique.filter(o.sameTitle) : unique;
  const pool = titled.length ? titled : unique;
  const mine = pool.filter(o.byReadArtist);
  const use = mine.length ? mine : pool;

  const kinds = use.map((r) => ({ r, ...kindOf(r), date: studioDate(r) ?? firstRelease(r).date ?? "9999" }));
  // The original: the earliest-released studio recording by the read artist. Only a recording by the read artist can be it.
  const studio = kinds.filter((k) => k.kind === "studio").sort((a, b) => a.date.localeCompare(b.date));
  const originalId = mine.length ? studio[0]?.r.id : undefined;
  const rows = kinds
    .map((k) => ({ ...k, kind: (k.r.id === originalId ? "original" : k.kind) as FixKind }))
    .sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind) || a.date.localeCompare(b.date))
    .slice(0, FIX_ROWS)
    .map((k) => toRow(k.r, k.kind, k.detail, o.videoSeconds));
  return mine.length || !rows.length ? { rows } : { rows, heading: "Same title, other artists" };
}

/** The same rows for a typed search: the search's own order is kept, except that studio recordings come first. */
export function typedList(found: MbRecording[], videoSeconds?: number, typed = ""): FixRow[] {
  const unique = [...new Map(found.map((r) => [r.id, r])).values()];
  const kinds = unique.map((r, i) => ({ r, i, ...kindOf(r) }));
  // Among studio recordings of one title by one credit, the earliest is the original.
  const firstOf = new Map<string, { id: string; date: string }>();
  // Only a recording by an artist the person typed can be called the original: a cover band's studio
  // recording of the same title is a studio recording, never "the original".
  const byTyped = (r: MbRecording) => !typed.trim() || (r["artist-credit"] ?? []).some((a) => [a.name, a.artist.name].some((n) => stands(n, typed)));
  for (const k of kinds.filter((x) => x.kind === "studio" && byTyped(x.r))) {
    const key = `${normalise(k.r.title)}|${normalise(creditText(k.r))}`;
    const date = studioDate(k.r) ?? "9999";
    if (!firstOf.has(key) || date < firstOf.get(key)!.date) firstOf.set(key, { id: k.r.id, date });
  }
  const originals = new Set([...firstOf.values()].map((v) => v.id));
  return kinds
    .map((k) => ({ ...k, kind: (originals.has(k.r.id) ? "original" : k.kind) as FixKind }))
    .sort((a, b) => Number(b.kind === "original" || b.kind === "studio") - Number(a.kind === "original" || a.kind === "studio") || a.i - b.i)
    .slice(0, FIX_ROWS)
    .map((k) => toRow(k.r, k.kind, k.detail, videoSeconds));
}

// ---- The searches behind the list ------------------------------------------------------------------

import { getJson } from "../sources/http";
import { MB, mbGate, songQuery } from "../sources/musicbrainz";
import { parseTitle, stripNotes } from "./parse";
import { creditNames, fetchFor, type MatchDeps } from "./v6";
import { artistStands, readBook, sameTitle, searchesV7, searchUrlV7, stands, trackForms } from "./v7";

/**
 * The list for a video title, with the matching rule switched off: everything MusicBrainz holds under
 * the track by the names read from the title, and only when there is nothing by them, the same title
 * by anyone. The searches are the rule's own, so nothing new is sent that the rule would not send.
 */
export async function fixFor(title: string, d: MatchDeps, videoSeconds?: number): Promise<FixList> {
  const get = async (q: string) => ((await getJson(searchUrlV7(q), d.gate ?? mbGate, d.fetchFn, d.clock, d.cache)) as { recordings?: MbRecording[] }).recordings ?? [];
  const book = readBook(title);
  if (book) {
    const forms = trackForms(book.track);
    const byReadArtist = (r: MbRecording) => artistStands(r, book.outside);
    const titled = (r: MbRecording) => sameTitle(r.title, forms);
    const found: MbRecording[] = [];
    for (const q of searchesV7(book)) {
      found.push(...(await get(q)));
      if (found.some((r) => titled(r) && byReadArtist(r))) break;
    }
    return fixList(found, { byReadArtist, sameTitle: titled, videoSeconds });
  }
  const parsed = parseTitle(title);
  if (!parsed.queries.length) return { rows: [] };
  const found = await fetchFor(parsed, d);
  const tracks = new Set(parsed.queries.map((q) => normalise(q.track)));
  const names = new Set(parsed.queries.flatMap((q) => q.artists.map(normalise)));
  return fixList(found, {
    byReadArtist: (r) => [...creditNames(r)].some((n) => names.has(n)),
    sameTitle: (r) => tracks.has(normalise(stripNotes(r.title))),
    videoSeconds,
  });
}

export const typedUrl = (typed: string) => `${MB}/recording?query=${encodeURIComponent(songQuery(typed.trim()))}&limit=50&fmt=json`;

/** "Type the song and the artist": one MusicBrainz search, listed in the same form. */
export async function fixTyped(typed: string, d: MatchDeps, videoSeconds?: number): Promise<FixRow[]> {
  if (typed.trim().length < 2) return [];
  const body = (await getJson(typedUrl(typed), d.gate ?? mbGate, d.fetchFn, d.clock, d.cache)) as { recordings?: MbRecording[] };
  return typedList(body.recordings ?? [], videoSeconds, typed);
}

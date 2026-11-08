/**
 * T4.5 "Where next?" (FR-T4.5; moment map P-9). One next record, with its reasons in this order, each
 * with its evidence: an uploader whose videos gave the person songs they finished (their own count
 * from D1); their friend's plays (FR-T4.7); a new record (released in the last 12 months, MusicBrainz)
 * by an artist they have finished three or more songs by; a person credited on this song, only beside
 * another reason. It names one track to start with: the record's earliest track also released as a
 * single, otherwise track 1. Links (a Bilibili search, the uploader's page) open only on a tap.
 * Shown on a tap of "Where next?", or when a song ends after at least two other songs in the session.
 */
import { normalise } from "./match/studio";
import type { NextRow, PlayRow, SongFacts } from "./model";
import { getJson, type Clock, type FetchFn, type Gate } from "./sources/http";
import { MB, mbGate } from "./sources/musicbrainz";
import { sessionStart } from "./firstwords";
import { num } from "./patterns";

export type ReasonKind = NextRow["reasons"][number]["kind"];
export const REASON_ORDER: ReasonKind[] = ["uploader", "trusted_judge", "artist_new", "shared_person"];
export const FINISHED_FOR_NEW = 3;
export const UPLOADER_MIN_FINISHED = 2;
export const NEW_WITHIN_DAYS = 365;

const finished = (p: PlayRow) => p.reached_end === "yes" && !!p.recording_id && (p.match_state === "certain" || p.match_state === "fixed by me");

/** FR-T4.5's moment: at a song's end after at least two other songs in the same session. */
export function dueAtEnd(plays: PlayRow[], current: PlayRow): boolean {
  if (current.reached_end !== "yes") return false;
  const start = sessionStart(plays, current);
  return plays.filter((p) => p.play_id !== current.play_id && p.started_at >= start && p.started_at <= current.started_at).length >= 2;
}

/** The uploader reason: songs from this uploader the person played to the end (their own count). */
export function uploaderReason(plays: PlayRow[], current: PlayRow): NextRow["reasons"][number] | null {
  if (!current.uploader_id) return null;
  const done = plays.filter((p) => p.uploader_id === current.uploader_id && finished(p));
  const songs = [...new Set(done.map((p) => p.recording_id))];
  if (songs.length < UPLOADER_MIN_FINISHED) return null;
  return {
    kind: "uploader",
    text: `You've played ${num(songs.length)} songs from ${current.uploader_name || "this uploader"} all the way through.`,
    evidence: done.map((p) => `${p.started_at.slice(0, 10)} · ${p.song_title ?? p.page_title}`),
  };
}

/** Songs by this artist the person finished (distinct recordings). */
export function finishedByArtist(plays: PlayRow[], facts: Record<string, SongFacts>, artistId: string): string[] {
  return [...new Set(plays.filter((p) => finished(p) && facts[p.recording_id]?.lead_artist_id === artistId).map((p) => p.recording_id))];
}

export interface Track {
  recording_id: string;
  title: string;
}

/** The record's earliest track also released as a single; otherwise track 1. */
export function startTrack(tracks: Track[], singleTitles: string[]): Track | undefined {
  const singles = new Set(singleTitles.map(normalise));
  return tracks.find((t) => singles.has(normalise(t.title))) ?? tracks[0];
}

/** Reasons in the PRD's order; a shared person never stands alone. */
export function ordered(reasons: NextRow["reasons"]): NextRow["reasons"] {
  const out = [...reasons].sort((a, b) => REASON_ORDER.indexOf(a.kind) - REASON_ORDER.indexOf(b.kind));
  return out.every((r) => r.kind === "shared_person") ? [] : out;
}

export const searchLink = (artist: string, record: string) => `https://search.bilibili.com/all?keyword=${encodeURIComponent(`${artist} ${record}`)}`;
export const uploaderLink = (uploaderId: string) => `https://space.bilibili.com/${uploaderId}`;

// ---- MusicBrainz lookups ------------------------------------------------------------------------

export interface NextDeps {
  fetchFn: FetchFn;
  gate?: Gate;
  clock?: Clock;
  cache?: Map<string, unknown>;
}
const get = (url: string, d: NextDeps) => getJson(url, d.gate ?? mbGate, d.fetchFn, d.clock, d.cache);

interface MbReleaseGroup {
  id: string;
  title: string;
  "first-release-date"?: string;
  "primary-type"?: string;
  "secondary-types"?: string[];
}

const studioGroup = (g: MbReleaseGroup) => ["Album", "EP"].includes(g["primary-type"] ?? "") && !(g["secondary-types"] ?? []).length;

/** The artist's newest album or EP first released in the last 12 months, if any. */
export async function newRecord(artistId: string, today: Date, d: NextDeps): Promise<MbReleaseGroup | null> {
  const body = (await get(`${MB}/release-group?artist=${artistId}&type=album|ep&limit=100&fmt=json`, d)) as { "release-groups"?: MbReleaseGroup[] };
  const since = new Date(today.getTime() - NEW_WITHIN_DAYS * 864e5).toISOString().slice(0, 10);
  const recent = (body["release-groups"] ?? []).filter((g) => studioGroup(g) && (g["first-release-date"] ?? "") >= since && (g["first-release-date"] ?? "").length >= 7);
  return recent.sort((a, b) => (b["first-release-date"] ?? "").localeCompare(a["first-release-date"] ?? ""))[0] ?? null;
}

/** A record named in a friend's Spotify file, found in MusicBrainz by its title and the artist. */
export async function findRecord(title: string, artistId: string, d: NextDeps): Promise<MbReleaseGroup | null> {
  const q = encodeURIComponent(`releasegroup:"${title.replace(/["\\]/g, "\\$&")}" AND arid:${artistId}`);
  const body = (await get(`${MB}/release-group?query=${q}&limit=10&fmt=json`, d)) as { "release-groups"?: MbReleaseGroup[] };
  return (body["release-groups"] ?? []).find((g) => normalise(g.title) === normalise(title)) ?? null;
}

/** The record's tracks (from its earliest official release) and the artist's single titles. */
export async function tracksOf(rgId: string, artistId: string, d: NextDeps): Promise<{ tracks: Track[]; singles: string[] }> {
  const rel = (await get(`${MB}/release?release-group=${rgId}&inc=recordings&status=official&limit=25&fmt=json`, d)) as {
    releases?: { date?: string; media?: { tracks?: { recording: { id: string; title: string } }[] }[] }[];
  };
  const first = [...(rel.releases ?? [])].sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"))[0];
  const tracks = (first?.media ?? []).flatMap((m) => (m.tracks ?? []).map((t) => ({ recording_id: t.recording.id, title: t.recording.title })));
  const sg = (await get(`${MB}/release-group?artist=${artistId}&type=single&limit=100&fmt=json`, d)) as { "release-groups"?: MbReleaseGroup[] };
  return { tracks, singles: (sg["release-groups"] ?? []).map((g) => g.title) };
}

/** "What critics said": review links MusicBrainz lists, and Wikidata's stated review scores with who gave them. */
export async function criticsOf(rgId: string, d: NextDeps): Promise<{ reviews: string[]; scores: { score: string; by: string; source: string }[] }> {
  const rg = (await get(`${MB}/release-group/${rgId}?inc=url-rels&fmt=json`, d)) as { relations?: { type: string; url?: { resource: string } }[] };
  const reviews = (rg.relations ?? []).filter((r) => r.type === "review" && r.url).map((r) => r.url!.resource);
  const wd = (rg.relations ?? []).find((r) => r.type === "wikidata" && r.url)?.url!.resource.split("/").pop();
  if (!wd) return { reviews, scores: [] };
  try {
    const ent = (await d.fetchFn(`https://www.wikidata.org/wiki/Special:EntityData/${wd}.json`).then((r) => r.json())) as {
      entities?: Record<string, { claims?: Record<string, { mainsnak?: { datavalue?: { value?: unknown } }; qualifiers?: Record<string, { datavalue?: { value?: { id?: string } } }[]> }[]> }>;
    };
    const claims = ent.entities?.[wd]?.claims?.P444 ?? [];
    const raw = claims.map((c) => ({ score: String(c.mainsnak?.datavalue?.value ?? ""), byId: c.qualifiers?.P447?.[0]?.datavalue?.value?.id }));
    const ids = [...new Set(raw.map((r) => r.byId).filter((x): x is string => !!x))];
    let labels: Record<string, string> = {};
    if (ids.length) {
      const lab = (await d.fetchFn(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${ids.join("|")}&props=labels&languages=en&format=json&origin=*`).then((r) => r.json())) as {
        entities?: Record<string, { labels?: { en?: { value: string } } }>;
      };
      labels = Object.fromEntries(ids.map((i) => [i, lab.entities?.[i]?.labels?.en?.value ?? i]));
    }
    const source = `https://www.wikidata.org/wiki/${wd}`;
    return { reviews, scores: raw.filter((r) => r.score).map((r) => ({ score: r.score, by: r.byId ? labels[r.byId] ?? r.byId : "not stated", source })) };
  } catch {
    return { reviews, scores: [] };
  }
}

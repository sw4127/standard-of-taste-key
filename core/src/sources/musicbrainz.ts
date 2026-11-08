/**
 * MusicBrainz (FR-CORE-3; core data, CC0): T9.1's search as the person types, and the facts of the
 * recording they confirm. Genre associations and artist gender are never read in this build.
 */
import { breaches } from "../checks";
import type { CreditRole, Source } from "../model";
import { bareTitle, creditText, hasVersionWord, isStudio, leadArtist, normalise, pickStudio, studioDate, type MbRecording } from "../match/studio";
import { getJson, Gate, realClock, type Clock, type FetchFn } from "./http";

export const MB = "https://musicbrainz.org/ws/2";
export const mbGate = new Gate(1200);
const mbCache = new Map<string, unknown>();

export interface MbDeps {
  fetchFn: FetchFn;
  gate?: Gate;
  clock?: Clock;
  cache?: Map<string, unknown>;
}
const get = (url: string, d: MbDeps) => getJson(url, d.gate ?? mbGate, d.fetchFn, d.clock ?? realClock, d.cache ?? mbCache);

/** One song as the search shows it: a title by an artist, with the year of its earliest studio release. */
export interface Candidate {
  key: string;
  title: string;
  artist_credit: string;
  lead_artist_id: string;
  lead_artist: string;
  year?: number;
  recording_ids: string[];
  /** The search's own recordings for this song, kept so the studio rule has something to choose from. */
  recordings: MbRecording[];
}

const MAX_CANDIDATES = 5;
/** Named songs read release-format labels as studio (see `isStudio`). */
export const NAMED = { formatWords: true } as const;

/** Group search results into songs (one title by one lead artist), at most five; a song whose only recordings carry a version word is left out. */
export function candidatesFrom(recordings: MbRecording[], typed: string): Candidate[] {
  const groups = new Map<string, Candidate & { date: string }>();
  for (const r of recordings) {
    const lead = leadArtist(r);
    if (!lead || (hasVersionWord(r.title) && !hasVersionWord(typed))) continue;
    // One song = one title by one artist credit: "Queen" and "Queen + The Muppets" are two songs.
    const key = `${normalise(bareTitle(r.title))}|${lead.id}|${normalise(creditText(r))}`;
    // The year shown is the earliest studio release seen; with none on this page, no year is shown
    // until the song is confirmed (never a live album's or a compilation's year).
    const d = isStudio(r, typed, NAMED) ? studioDate(r)! : "9999";
    const g = groups.get(key);
    if (!g) {
      groups.set(key, { key, title: bareTitle(r.title) || r.title, artist_credit: creditText(r), lead_artist_id: lead.id, lead_artist: lead.name, recording_ids: [r.id], recordings: [r], date: d });
    } else {
      g.recording_ids.push(r.id);
      g.recordings.push(r);
      if (d < g.date) g.date = d;
    }
  }
  // Order: first a song whose title (then artist) the person typed ("晴天 周杰伦" → 晴天 before 星晴); then a song
  // MusicBrainz holds many recordings of (one per release), which is usually the original, where a
  // cover has one; otherwise the search's own order.
  const typedNorm = normalise(typed);
  const has = (x: string) => normalise(x).length > 0 && typedNorm.includes(normalise(x));
  const named = (g: Candidate) => (has(g.title) ? 2 : 0) + (has(g.lead_artist) ? 1 : 0);
  const ordered = [...groups.values()]
    // A carve-out word the person did not type is never shown (rule 3); one they typed is their own.
    .filter((g) => breaches(`${g.title} ${g.artist_credit}`, "words").every((b) => breaches(typed, "words").includes(b)))
    .map((g, i) => ({ g, i }))
    .sort((a, b) => named(b.g) - named(a.g) || b.g.recording_ids.length - a.g.recording_ids.length || a.i - b.i)
    .map((x) => x.g);
  return ordered.slice(0, MAX_CANDIDATES).map(({ date, ...c }) => ({ ...c, year: /^\d{4}/.test(date) && !date.startsWith("9999") ? Number(date.slice(0, 4)) : undefined }));
}

const lucene = (s: string) => s.replace(/([+\-!(){}[\]^"~*?:\\/]|&&|\|\|)/g, "\\$1");

/**
 * Only recordings that appear on an official album, single or EP. A recording that is also on
 * compilations stays in; live albums are refused later by the studio rule. Without this, a popular
 * song's hundreds of bootleg and live recordings fill the page and the studio original is never seen
 * (found by running it, 2026-11-08: Queen's 1975 "Bohemian Rhapsody" was missing from 100 results).
 */
export const OFFICIAL = "status:official AND (primarytype:album OR primarytype:single OR primarytype:ep)";

/**
 * The search query: every typed word must match the title or the artist, so "bohemian rhapsody
 * queen" finds Queen's song. MusicBrainz's plain "dismax" search was tried first and ranked covers
 * titled "Bohemian Rhapsody (Queen)" above Queen's own.
 */
export function songQuery(typed: string): string {
  const words = typed.trim().split(/\s+/).filter(Boolean).map(lucene);
  const each = words.map((w) => `(recording:${w} OR artistname:${w})`).join(" AND ");
  return `(recording:"${lucene(typed.trim())}"^5 OR (${each})) AND ${OFFICIAL}`;
}

export async function searchSongs(typed: string, d: MbDeps): Promise<Candidate[]> {
  const q = typed.trim();
  if (q.length < 2) return [];
  const url = `${MB}/recording?query=${encodeURIComponent(songQuery(q))}&limit=50&fmt=json`;
  const body = (await get(url, d)) as { recordings?: MbRecording[] };
  return candidatesFrom(body.recordings ?? [], q);
}

const PAGE = 100;
const MAX_PAGES = 3;

/** Every official recording of this title by this lead artist (up to 300), for the studio rule to choose among. */
export async function recordingsOf(c: Pick<Candidate, "title" | "lead_artist_id">, d: MbDeps): Promise<MbRecording[]> {
  const query = encodeURIComponent(`recording:"${lucene(c.title)}" AND arid:${c.lead_artist_id} AND ${OFFICIAL}`);
  const want = normalise(c.title);
  const out: MbRecording[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const body = (await get(`${MB}/recording?query=${query}&limit=${PAGE}&offset=${page * PAGE}&fmt=json`, d)) as { count?: number; recordings?: MbRecording[] };
    out.push(...(body.recordings ?? []));
    if ((page + 1) * PAGE >= (body.count ?? 0)) break;
  }
  return out.filter((r) => normalise(bareTitle(r.title)) === want && leadArtist(r)?.id === c.lead_artist_id);
}

// ---- The confirmed recording's facts ---------------------------------------------------------------

interface MbRelation {
  type: string;
  "target-type": string;
  artist?: { id: string; name: string };
  work?: { id: string; title: string; relations?: MbRelation[] };
}
export interface MbRecordingDetail extends MbRecording {
  relations?: MbRelation[];
}

/** MusicBrainz relationship types, as the roles the product shows (each with its meaning, FR-T4.1). */
const RECORDING_ROLE: Record<string, CreditRole> = {
  producer: "producer",
  recording: "recording engineer",
  mix: "mixer",
  mastering: "mastering engineer",
  programming: "programming",
  arranger: "arranger",
  "instrument arranger": "arranger",
  "vocal arranger": "arranger",
  instrument: "performer",
  vocal: "performer",
  performer: "performer",
};
const WORK_ROLE: Record<string, CreditRole> = { composer: "writer", lyricist: "writer", writer: "writer", librettist: "writer" };

export const recordingPage = (id: string): Source => ({ label: "MusicBrainz", url: `https://musicbrainz.org/recording/${id}` });

export function peopleOf(r: MbRecordingDetail): { name: string; role: CreditRole; source: Source }[] {
  const out: { name: string; role: CreditRole; source: Source }[] = [];
  const add = (name: string, role: CreditRole, source: Source) => {
    if (!out.some((p) => p.name === name && p.role === role)) out.push({ name, role, source });
  };
  for (const rel of r.relations ?? []) {
    if (rel["target-type"] === "artist" && rel.artist && RECORDING_ROLE[rel.type]) add(rel.artist.name, RECORDING_ROLE[rel.type]!, recordingPage(r.id));
    if (rel["target-type"] === "work" && rel.work) {
      for (const w of rel.work.relations ?? []) {
        if (w["target-type"] === "artist" && w.artist && WORK_ROLE[w.type]) {
          add(w.artist.name, WORK_ROLE[w.type]!, { label: "MusicBrainz", url: `https://musicbrainz.org/work/${rel.work.id}` });
        }
      }
    }
  }
  return out;
}

export async function recordingDetail(id: string, d: MbDeps): Promise<MbRecordingDetail> {
  const inc = "artist-credits+releases+release-groups+artist-rels+work-rels+work-level-rels";
  return (await get(`${MB}/recording/${id}?inc=${inc}&fmt=json`, d)) as MbRecordingDetail;
}

export { pickStudio };

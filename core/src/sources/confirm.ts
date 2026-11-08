/**
 * T9.1: the person taps a song the search found; code chooses the recording (FR-CORE-1's studio rule
 * among that title and artist) and gathers its facts (FR-CORE-3): credits and first release from
 * MusicBrainz, tempo and key from AcousticBrainz. Every fact keeps its source page.
 */
import type { SongFacts } from "../model";
import { creditText, isStudio, normalise, pickStudio, studioDate, type MbRecording } from "../match/studio";
import { measure } from "./acousticbrainz";
import type { Clock, FetchFn, Gate } from "./http";
import { NAMED, peopleOf, recordingDetail, recordingPage, recordingsOf, type Candidate } from "./musicbrainz";

export interface Deps {
  fetchFn: FetchFn;
  mbGate?: Gate;
  abGate?: Gate;
  clock?: Clock;
  cache?: Map<string, unknown>;
}

export type Confirmed =
  | { facts: SongFacts; matched_by: "rule" | "my pick" }
  | { error: "MusicBrainz did not answer" };

export async function confirmSong(c: Candidate, typed: string, d: Deps): Promise<Confirmed> {
  const mb = { fetchFn: d.fetchFn, gate: d.mbGate, clock: d.clock, cache: d.cache };
  let all: MbRecording[];
  try {
    all = await recordingsOf(c, mb);
  } catch {
    all = [];
  }
  const byId = new Map<string, MbRecording>([...c.recordings, ...all].map((r) => [r.id, r]));
  // Only recordings credited exactly as the song the person tapped (Queen's, never Queen + The Muppets').
  const credit = normalise(c.artist_credit);
  const pool = [...byId.values()].filter((r) => normalise(creditText(r)) === credit);
  const pick = pickStudio(pool, typed, NAMED);
  // The person confirmed this title and artist. If the studio rule is silent among them, keep the
  // recording they tapped (matched_by "my pick") rather than drop the song.
  const chosen = "recording" in pick ? pick.recording : c.recordings[0]!;
  const matched_by = "recording" in pick ? "rule" : "my pick";

  let detail;
  try {
    detail = await recordingDetail(chosen.id, mb);
  } catch {
    return { error: "MusicBrainz did not answer" };
  }

  const known = (x: string | null | undefined) => (x && !x.startsWith("9999") ? x : null);
  const date = known(studioDate(detail)) ?? known(studioDate(chosen)) ?? known(detail["first-release-date"]);
  const year = date && /^\d{4}/.test(date) && !date.startsWith("9999") ? Number(date.slice(0, 4)) : undefined;

  const siblings = pool.filter((r) => r.id !== chosen.id && isStudio(r, typed, NAMED)).map((r) => r.id);
  const m = await measure([chosen.id, ...siblings], { fetchFn: d.fetchFn, gate: d.abGate, clock: d.clock });

  const facts: SongFacts = {
    recording_id: chosen.id,
    title: c.title,
    artist_credit: c.artist_credit,
    lead_artist_id: c.lead_artist_id,
    lead_artist: c.lead_artist,
    first_release_year: year,
    date_source: recordingPage(chosen.id),
    date_disputed: false,
    key: m?.key ? { ...m.key, source: m.source } : undefined,
    bpm: m?.bpm ? { value: m.bpm, source: m.source } : undefined,
    people: peopleOf(detail),
  };
  return { facts, matched_by };
}

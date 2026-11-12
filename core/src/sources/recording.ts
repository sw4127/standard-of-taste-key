/**
 * T2.1 (FR-T2.1): on a certain match, fetch and cache the recording's credits and the release's facts
 * (FR-CORE-3): who did what, where and when it was recorded, its first studio release, and its tempo
 * and key. Every fact keeps its source page; MusicBrainz and AcousticBrainz data are CC0.
 */
import type { SongFacts } from "../model";
import { studioDate } from "../match/studio";
import type { Candidate } from "../match/v7";
import { measure } from "./acousticbrainz";
import type { Clock, FetchFn, Gate } from "./http";
import { peopleOf, placesOf, recordingDetail, recordingPage } from "./musicbrainz";

export interface FactDeps {
  fetchFn: FetchFn;
  mbGate?: Gate;
  abGate?: Gate;
  clock?: Clock;
  cache?: Map<string, unknown>;
}

const known = (x: string | null | undefined) => (x && !x.startsWith("9999") ? x : null);

/** The facts of one recording. If MusicBrainz does not answer, the candidate's own facts stand, with no credits. */
export async function recordingFacts(c: Candidate, d: FactDeps): Promise<SongFacts> {
  const base: SongFacts = {
    recording_id: c.recording_id, title: c.title, artist_credit: c.artist_credit,
    lead_artist_id: c.lead?.id ?? c.artist_credit, lead_artist: c.lead?.name ?? c.artist_credit,
    first_release_year: c.first_release && /^\d{4}/.test(c.first_release) ? Number(c.first_release.slice(0, 4)) : undefined,
    date_source: recordingPage(c.recording_id), date_disputed: false, people: [],
  };
  let facts = base;
  try {
    const detail = await recordingDetail(c.recording_id, { fetchFn: d.fetchFn, gate: d.mbGate, clock: d.clock, cache: d.cache });
    const date = known(studioDate(detail)) ?? known(detail["first-release-date"]);
    const places = placesOf(detail);
    facts = {
      ...base,
      first_release_year: date ? Number(date.slice(0, 4)) : base.first_release_year,
      people: peopleOf(detail),
      ...(places.length ? { places } : {}),
    };
  } catch {
    /* credits wait for the next play; the match itself stands */
  }
  const m = await measure([c.recording_id], { fetchFn: d.fetchFn, gate: d.abGate, clock: d.clock });
  return {
    ...facts,
    ...(m?.key ? { key: { ...m.key, source: m.source } } : {}),
    ...(m?.bpm ? { bpm: { value: m.bpm, source: m.source } } : {}),
  };
}

/** Test fixtures for the panel's words: invented plays, songs and a friend (synthetic; rule 8). */
import { EXAMPLE_CATALOGUE } from "../examples";
import type { HistoryRow, PlayRow, SongFacts } from "../model";
import type { Person } from "../storage";

export const SONG: SongFacts = EXAMPLE_CATALOGUE[0]!; // Glass Harbour · Juniper Varga
export const OTHER: SongFacts = EXAMPLE_CATALOGUE[1]!; // Second Lamp · The Quiet Lanterns
export const SAME_ARTIST: SongFacts = { ...EXAMPLE_CATALOGUE[0]!, recording_id: "example-1b", title: "Harbour Lights" };
export const FACTS: Record<string, SongFacts> = { [SONG.recording_id]: SONG, [OTHER.recording_id]: OTHER, [SAME_ARTIST.recording_id]: SAME_ARTIST };

let n = 0;
export function play(song: SongFacts | null, started_at: string, over: Partial<PlayRow> = {}): PlayRow {
  return {
    play_id: `p${++n}`, source: "live page", video_id: `BV1ex4y1Ex${String(n).padStart(2, "0")}`, part_number: 1,
    page_title: song ? `${song.artist_credit}《${song.title}》` : "A vlog", uploader_name: "Example Uploader", uploader_id: "1",
    list_title: "", list_position: null, page_tags: [], started_at, heard_seconds: 200, reached_end: "yes",
    recording_id: song?.recording_id ?? "", match_state: song ? "certain" : "unsure", match_rule_version: "v6",
    song_title: song?.title, song_artist: song?.artist_credit, ...over,
  };
}

export const FRIEND: Person = { person_id: "person-f", label: "my friend", source: "spotify export", consent_note: "They said yes (2026-11-08)", loaded_at: "2026-11-08T10:00:00Z" };

let h = 0;
export function friendPlays(count: number, artist: string, album: string, track: (i: number) => string, month = "2025-05", ms = 180_000): HistoryRow[] {
  return Array.from({ length: count }, (_, i) => ({
    history_id: `person-f:${h++}`, person_id: "person-f", ended_at_utc: `${month}-${String((i % 27) + 1).padStart(2, "0")}T20:00:00Z`,
    local_time: `${month}-${String((i % 27) + 1).padStart(2, "0")}T21:00:00`, country: "GB", track_uri: "x", track: track(i), artist, album, ms_played: ms,
  }));
}

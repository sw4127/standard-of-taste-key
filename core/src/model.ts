/**
 * The data model (PRD section 4), the parts each step needs. Store numbers follow the PRD (D2, D3, D6,
 * D11, D12, D13, D14). Storage in IndexedDB arrives with T1.6; these are the row shapes.
 */
import type { Key } from "./design/key-colour";

export const PARTS = [
  "the opening", "a verse", "the chorus", "the bridge", "the voice", "the words", "the beat", "the sound of it", "not sure",
] as const;
export type Part = (typeof PARTS)[number];

export const FOUND = ["this month", "this year", "a year or two ago", "longer ago", "can't say"] as const;
export type Found = (typeof FOUND)[number];

/** Where a fact came from: a page that states it, or the example data (which states nothing real). */
export interface Source {
  label: string; // "MusicBrainz", "AcousticBrainz", "Example data (fictional)"
  url?: string;
}

/** D2 + the D3 facts a pattern needs, gathered per recording. */
export interface SongFacts {
  recording_id: string;
  title: string;
  artist_credit: string;
  lead_artist_id: string;
  lead_artist: string;
  first_release_year?: number;
  date_source: Source;
  date_disputed: boolean;
  key?: Key & { strength: number; source: Source };
  bpm?: { value: number; source: Source };
  /** Credited people with their role (D3 kinds producer, writer, recording engineer, mixer…). */
  people: { name: string; role: CreditRole; source: Source }[];
}

export type CreditRole =
  | "producer" | "writer" | "recording engineer" | "mixer" | "mastering engineer" | "arranger" | "programming" | "performer";

/** D13 Named Songs. */
export interface NamedSong {
  entry_id: string;
  person_id: string;
  typed_text: string;
  recording_id: string;
  comes_back_for: Part | "unanswered";
  found_me: Found | "unanswered";
  entered_at: string; // ISO
}

/** D11 Listening History, as read from a Spotify export (every other field dropped at parse). */
export interface HistoryRow {
  history_id: string;
  person_id: string;
  ended_at_utc: string; // Spotify's ts
  local_time: string; // ISO date-time, local to the row's country
  country: string;
  track_uri: string;
  track: string;
  artist: string;
  album: string;
  ms_played: number;
}

/** A song a line is about: the person's answer and the record's facts together. */
export interface Song {
  entry: NamedSong;
  facts: SongFacts;
}

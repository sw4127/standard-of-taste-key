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
  people: { name: string; role: CreditRole; source: Source; /** e.g. "guitar", "lead vocals" */ detail?: string }[];
  /** Where it was recorded, mixed or mastered, and when, where MusicBrainz says (D3 studio / recording date). */
  places?: { name: string; role: PlaceRole; date?: string; source: Source }[];
}

export type PlaceRole = "recorded at" | "mixed at" | "mastered at";

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

/** D1 Plays: one row per Bilibili video played while the extension is installed (FR-T1.2). */
export interface PlayRow {
  play_id: string;
  source: "live page";
  video_id: string;
  part_number: number;
  page_title: string;
  uploader_name: string;
  uploader_id: string;
  list_title: string;
  list_position: number | null;
  page_tags: string[];
  started_at: string; // local time, ISO without zone
  heard_seconds: number;
  reached_end: "yes" | "no" | "unknown";
  recording_id: string; // empty until matched
  match_state: "certain" | "unsure" | "not a song" | "fixed by me";
  match_rule_version: string;
  /** The song as the status line names it (title · artist), kept with the play. */
  song_title?: string;
  song_artist?: string;
}

/** What the content script reads from the Bilibili page in front of the user (FR-T1.2). */
export interface PageFacts {
  video_id: string; // the BV number
  part_number: number;
  page_title: string;
  uploader_name: string;
  uploader_id: string;
  list_title: string;
  list_position: number | null;
  page_tags: string[];
}

/** The page as the panel hears it: its facts and its seconds heard so far. */
export interface LivePage {
  facts: PageFacts | null;
  /** One per viewing of a video: the panel keeps one play per token, however often it is opened. */
  play_token: string;
  heard_seconds: number;
  playing: boolean;
  ended: boolean;
}

/** D5 Keys: every line shown on the panel, with what the person did with it (T2.2–T2.6). */
export interface KeyRow {
  key_id: string;
  recording_id: string;
  play_id: string;
  template_id: string;
  /** What the line rests on, in words (play dates, counts), for the record. */
  evidence: string[];
  text_shown: string;
  shown_at: string;
  seconds_heard_when_shown: number;
  /** FR-T2.4: the threshold that applied (15 or 60), logged with the real seconds. */
  threshold_seconds: number;
  /** The quiet line's offer was shown with it (FR-T2.5). */
  offer_shown?: boolean;
  proof_opened_at?: string;
  dropped: boolean;
}

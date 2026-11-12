/**
 * The data model (PRD section 4), the parts each step needs. Store numbers follow the PRD (D2, D3, D6,
 * D11, D12, D13, D14). Storage in IndexedDB arrives with T1.6; these are the row shapes.
 */
import type { Key } from "./design/key-colour";

export const PARTS = [
  "the opening", "a verse", "the chorus", "the bridge", "the voice", "the words", "the beat", "the sound of it", "not sure",
] as const;
export type Part = (typeof PARTS)[number];

/** FR-T9.2 (changed 2026-11-10): what a person may come back for in a whole album. */
export const ALBUM_PARTS = ["one song on it", "how it flows from start to finish", "its overall sound", "its words", "can't say"] as const;
export type AlbumPart = (typeof ALBUM_PARTS)[number];

/**
 * FR-T9.8 (2026-11-10): when a record found the person, as nested ranges, each inside the next, so no
 * answer is two things at once. The person taps the narrowest range that is true; "can't say" sits beside.
 */
export const FOUND = ["this month", "this year", "the last three years", "longer ago", "can't say"] as const;
export type Found = (typeof FOUND)[number];
/** The ranges only, narrowest first; each lies inside the next. */
export const FOUND_RANGES = ["this month", "this year", "the last three years", "longer ago"] as const;

/** FR-T9.8: answers stored under the earlier five options are read as the PRD says. */
export function readFound(old: string): Found | "unanswered" {
  if (old === "a year or two ago") return "the last three years";
  return (FOUND as readonly string[]).includes(old) ? (old as Found) : "unanswered";
}

/** The ranges that light with a pick: the one tapped and every wider one. */
export const litRanges = (f: Found | "unanswered"): Found[] => {
  const i = (FOUND_RANGES as readonly string[]).indexOf(f);
  return i < 0 ? [] : [...FOUND_RANGES.slice(i)];
};

/** Where a fact came from: a page that states it, or the example data (which states nothing real). */
export interface Source {
  label: string; // "MusicBrainz", "AcousticBrainz", "Example data (fictional)"
  url?: string;
}

/** D2 + the D3 facts a pattern needs, gathered per recording. */
export interface SongFacts {
  /** A recording's MusicBrainz ID; for an album (FR-T9.1), "album:" and its release group's ID. */
  recording_id: string;
  /** FR-T9.1: an album is stored as an album, never as its title track. */
  kind?: "album";
  release_group_id?: string;
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
  comes_back_for: Part | AlbumPart | "unanswered";
  found_me: Found | "unanswered";
  /** FR-T9.8: for "longer ago", the year he gave, if any. */
  found_year?: number;
  /** FR-T9.1: a song or an album. Rows saved before 2026-11-12 have none and are songs. */
  kind?: "song" | "album";
  entered_at: string; // ISO
}

export const isAlbum = (x: { kind?: string }) => x.kind === "album";
export const albumId = (release_group_id: string) => `album:${release_group_id}`;

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
  /** The video's own length in seconds, read from the page's player, when it has one (FR-T1.4: "same length as this video"). */
  duration_seconds?: number;
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

/** D7 Next Records: every next record suggested, with its reasons (FR-T4.5). */
export interface NextRow {
  suggestion_id: string;
  from_recording_id: string;
  play_id: string;
  release_group_id: string;
  record_title: string;
  artist: string;
  first_release?: string;
  start_track_recording_id?: string;
  start_track_title?: string;
  /** Every recording on the record, so a later play of any of its tracks is noticed. */
  track_recording_ids: string[];
  reasons: { kind: "uploader" | "trusted_judge" | "artist_new" | "shared_person"; text: string; evidence: string[] }[];
  uploader_id?: string;
  shown_at: string;
  search_opened_at?: string;
  uploader_opened_at?: string;
  later_played_play_id?: string;
}

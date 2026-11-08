/**
 * FR-CORE-1's studio rule and normalisation, the parts T9.1 needs to pick the recording behind a
 * confirmed song. The title parser and the full v6 silence rules for Bilibili arrive with T1.2 (Step 5).
 */
import { fold } from "../checks";

/** Normalise for comparison: NFKC, traditional to simplified, lower case, every letter and digit of every script kept. */
export const normalise = (s: string) => fold(s).toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

/** A title with its bracketed notes removed: "晴天 (Live)" and "晴天" are one song to group. */
export const bareTitle = (s: string) => s.replace(/[(（[【][^)）\]】]*[)）\]】]/g, "").trim();

/** Version words: a recording whose title holds one is not the studio recording, unless the person typed one too. */
export const VERSION_WORDS =
  /\b(?:live|remix|instrumental|demo|acoustic|edit|karaoke|sped|slowed|version|clean|a cappella|cover)\b|伴奏|现场|演唱会|翻唱/i;
export const hasVersionWord = (s: string) => VERSION_WORDS.test(fold(s));

const ALLOWED_DISAMBIGUATION = new Set(["", "explicit", "clean", "album version"]);
const STUDIO_PRIMARY = new Set(["Album", "Single", "EP"]);
const NOT_STUDIO_SECONDARY = /^(?:Live|Compilation|Remix|DJ-mix|Demo|Mixtape)/;

/** The parts of a MusicBrainz recording the rule reads. */
export interface MbRecording {
  id: string;
  title: string;
  score?: number;
  disambiguation?: string;
  "first-release-date"?: string;
  "artist-credit"?: { name: string; joinphrase?: string; artist: { id: string; name: string } }[];
  releases?: {
    id: string;
    status?: string;
    date?: string;
    "release-group"?: { id: string; "primary-type"?: string; "secondary-types"?: string[] };
  }[];
}

/** The earliest date among the recording's official studio releases (Album, Single or EP, not live, compilation…). */
export function studioDate(r: MbRecording): string | null {
  const dates = (r.releases ?? [])
    .filter((x) => x.status === "Official")
    .filter((x) => STUDIO_PRIMARY.has(x["release-group"]?.["primary-type"] ?? ""))
    .filter((x) => !(x["release-group"]?.["secondary-types"] ?? []).some((t) => NOT_STUDIO_SECONDARY.test(t)))
    .map((x) => x.date || "9999"); // an empty date is unknown, never the earliest
  return dates.length ? dates.sort()[0]! : null;
}

/**
 * T9.1 only (a recorded deviation, build log step 3): MusicBrainz labels many original recordings with
 * their release formats ("single/LP/12″ version"), which FR-CORE-1's list would refuse, leaving a later
 * reissue to date the song. A label made only of format words passes; any other word (live, remix,
 * radio, edit, mix, a place, a date) still refuses the recording.
 */
const FORMAT_WORDS = new Set(["single", "lp", "ep", "album", "7", "10", "12", "7\"", "12\"", "7″", "10″", "12″", "inch", "original", "mono", "stereo", "version", "explicit", "clean"]);
const onlyFormatWords = (d: string) => {
  const words = d.toLowerCase().split(/[\s/,;&+]+/).filter(Boolean);
  return words.length > 0 && words.every((w) => FORMAT_WORDS.has(w));
};

export interface StudioOptions {
  /** Let a disambiguation made only of release-format words pass (named songs, T9.1). */
  formatWords?: boolean;
}

export function isStudio(r: MbRecording, typed = "", o: StudioOptions = {}): boolean {
  const d = (r.disambiguation ?? "").trim().toLowerCase();
  if (!ALLOWED_DISAMBIGUATION.has(d) && !(o.formatWords && onlyFormatWords(d))) return false;
  if (hasVersionWord(r.title) && !hasVersionWord(typed)) return false;
  return studioDate(r) !== null;
}

const isClean = (r: MbRecording) => (r.disambiguation ?? "").trim().toLowerCase() === "clean";

export type StudioPick = { recording: MbRecording; date: string } | { silent: "no studio recording" | "only clean edits" };

/** Among recordings of one title by one artist: the earliest-released studio recording that is not a clean edit. */
export function pickStudio(recordings: MbRecording[], typed = "", o: StudioOptions = {}): StudioPick {
  const studio = recordings.filter((r) => isStudio(r, typed, o));
  if (!studio.length) return { silent: "no studio recording" };
  const full = studio.filter((r) => !isClean(r));
  if (!full.length) return { silent: "only clean edits" };
  const dated = full.map((r) => ({ recording: r, date: studioDate(r)! }));
  return dated.sort((a, b) => a.date.localeCompare(b.date))[0]!;
}

export const creditText = (r: MbRecording) => (r["artist-credit"] ?? []).map((a) => a.name + (a.joinphrase ?? "")).join("");
export const leadArtist = (r: MbRecording) => r["artist-credit"]?.[0]?.artist;

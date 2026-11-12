/**
 * FR-CORE-1 The matching rule, v6 (T1.2, T1.3): which recording a Bilibili video is, or silence.
 * Silent unless certain: a wrong key is worse than no key.
 *
 * Search MusicBrainz for `recording:"<track>" AND artist:"<artist>"` with the first artist; if that
 * returns nothing, by the track alone. One query serves both scripts: MusicBrainz's search folds
 * traditional and simplified Chinese itself (measured 2026-11-08: 晴天/周杰伦 and 晴天/周杰倫 return
 * the same 10 recordings), so the PRD's second, traditional-script query is not sent.
 * Candidates: score ≥ 85; title (notes stripped) equal to the track, compared normalised; an artist
 * from the title in the recording's credit. Then the studio filter, the silences, the earliest.
 */
import { getJson, type Clock, type FetchFn, type Gate } from "../sources/http";
import { MB, mbGate } from "../sources/musicbrainz";
import { stripNotes, parseTitle, type Parsed } from "./parse";
import { creditText, hasVersionWord, normalise, type MbRecording } from "./studio";

export const RULE_VERSION = "v6.3";

/**
 * v6.1 (2026-11-08, after the first launch-gate run): a generic title names no song. "Main theme" by
 * Hans Zimmer matched his 1990 "Main Theme" (Bird on a Wire) for a video of The Dark Knight Rises,
 * because a prolific composer holds many recordings of one generic title and the rule took the
 * earliest. Such a title stays silent, whoever the artist is.
 */
export const GENERIC_TITLES = new Set([
  "maintheme", "maintitle", "maintitles", "theme", "themesong", "titletheme", "title", "titles", "opening", "openingtheme",
  "openingtitles", "openingcredits", "ending", "endingtheme", "endcredits", "endtitles", "closingcredits", "credits",
  "intro", "introduction", "outro", "overture", "prologue", "epilogue", "suite", "finale", "interlude", "ost", "soundtrack",
  "score", "主题曲", "主题", "片头曲", "片头", "片尾曲", "片尾", "插曲", "序曲", "配乐", "原声", "原声带",
]);

export type Silence =
  | "the title names no song"
  | "a generic title"
  | "the title names no artist"
  | "no candidate"
  | "no studio recording"
  | "different artists"
  | "only clean edits"
  | "versions months apart"
  /** Version 7: a recording by a named artist exists, but its credit does not fit the names in the title. */
  | "credits differ";

export interface Candidate {
  recording_id: string;
  title: string;
  artist_credit: string;
  first_release?: string;
  record?: string;
  lead?: { id: string; name: string };
}

export type MatchResult =
  | { state: "certain"; recording: MbRecording; candidate: Candidate; candidates: Candidate[]; parsed: Parsed }
  | { state: "silent"; reason: Silence; candidates: Candidate[]; parsed: Parsed };

export interface MatchDeps {
  fetchFn: FetchFn;
  gate?: Gate;
  clock?: Clock;
  cache?: Map<string, unknown>;
}

const OK_DISAMBIGUATION = /^(explicit|clean|explicit version|album version)(, ?(explicit|clean))?$/i;
const STUDIO_PRIMARY = ["Album", "Single", "EP"];
const NOT_STUDIO = /Live|Compilation|Remix|DJ-mix|Demo|Mixtape/;
const esc = (s: string) => s.replace(/["\\]/g, "\\$&");
const lead = (r: MbRecording) => normalise(r["artist-credit"]?.[0]?.name ?? "");

function goodReleases(r: MbRecording) {
  return (r.releases ?? []).filter(
    (x) => x.status === "Official" && STUDIO_PRIMARY.includes(x["release-group"]?.["primary-type"] ?? "") && !(x["release-group"]?.["secondary-types"] ?? []).some((t) => NOT_STUDIO.test(t)),
  );
}

export function toCandidate(r: MbRecording): Candidate {
  const good = goodReleases(r);
  const dates = good.map((x) => x.date).filter((d): d is string => !!d).sort();
  return {
    recording_id: r.id,
    title: r.title,
    artist_credit: creditText(r),
    first_release: dates[0] ?? r["first-release-date"] ?? undefined,
    record: (good[0] ?? r.releases?.[0]) && ((good[0] ?? r.releases![0]!) as { title?: string }).title,
    lead: r["artist-credit"]?.[0]?.artist,
  };
}

/**
 * v6.3 (2026-11-09, Bob's five-video check): the names a recording's credit holds, each name as
 * credited and the credit as a whole. An artist from the title must be one of these names, never a run
 * of letters inside one: "DEN" matched "Pinewood Garden" ("Show Me", 1971) for DEN's "Show Me". Every
 * name here is also inside the credit text, so v6.3 accepts nothing v6.2 refused on the artist.
 */
export function creditNames(r: MbRecording): Set<string> {
  const out = new Set<string>([normalise(creditText(r))]);
  // "Black Eyed Peas" is "The Black Eyed Peas": a leading "The" may be left out.
  for (const a of r["artist-credit"] ?? []) for (const n of [a.name, a.name.replace(/^the\s+/i, "")]) out.add(normalise(n));
  out.delete("");
  return out;
}

/** The rule itself, over recordings already fetched: pure, so every fixture can replay it. */
export function decide(parsed: Parsed, found: MbRecording[]): MatchResult {
  const byId = new Map(found.map((r) => [r.id, r]));
  const all = [...byId.values()];
  const candidates = (rs: MbRecording[]) => rs.slice(0, 8).map(toCandidate);
  if (!parsed.queries.length) return { state: "silent", reason: "the title names no song", candidates: [], parsed };
  if (parsed.queries.every((q) => GENERIC_TITLES.has(normalise(q.track)))) return { state: "silent", reason: "a generic title", candidates: candidates(all), parsed };
  if (!parsed.queries.some((q) => q.artists.length)) return { state: "silent", reason: "the title names no artist", candidates: candidates(all), parsed };

  const c = all.filter((r) =>
    (r.score ?? 0) >= 85 &&
    parsed.queries.some((q) => {
      if (normalise(stripNotes(r.title)) !== normalise(q.track)) return false;
      const names = creditNames(r);
      return q.artists.some((a) => names.has(normalise(a)));
    }),
  );
  if (!c.length) return { state: "silent", reason: "no candidate", candidates: candidates(all), parsed };
  return settle(parsed, c);
}

/**
 * The studio filter and the silences, over recordings already accepted on title and artist. Shared by
 * version 6.3 and version 7 so that both end the same way. `versionWord` says whether a recording's
 * title carries a version word; version 7 passes its own reading of bracketed notes.
 */
export function settle(parsed: Parsed, c: MbRecording[], versionWord: (r: MbRecording) => boolean = (r) => hasVersionWord(r.title)): MatchResult {
  const candidates = (rs: MbRecording[]) => rs.slice(0, 8).map(toCandidate);
  const studio = c
    .map((r) => {
      const good = goodReleases(r);
      const d = good.map((x) => x.date).filter((x): x is string => !!x).sort();
      return { r, good, first: d[0] ?? null, rgs: new Set(good.map((x) => x["release-group"]!.id)) };
    })
    .filter((o) => o.good.length && (parsed.version || (OK_DISAMBIGUATION.test((o.r.disambiguation ?? "").trim()) || !(o.r.disambiguation ?? "").trim()) && !versionWord(o.r)));
  if (!studio.length) return { state: "silent", reason: "no studio recording", candidates: candidates(c), parsed };
  if (new Set(studio.map((o) => lead(o.r))).size > 1) return { state: "silent", reason: "different artists", candidates: candidates(c), parsed };
  const full = studio.filter((o) => !/clean/i.test(o.r.disambiguation ?? ""));
  if (!full.length) return { state: "silent", reason: "only clean edits", candidates: candidates(c), parsed };
  full.sort((a, b) => (a.first ?? "9").localeCompare(b.first ?? "9") || b.good.length - a.good.length);
  const o = full[0]!;
  const days = (a: string, b: string) => Math.abs((Date.parse(a) - Date.parse(b)) / 864e5);
  const clash = full.slice(1).some((p) => [...p.rgs].some((g) => o.rgs.has(g)) && o.first && p.first && p.first.length >= 7 && o.first.length >= 7 && days(o.first, p.first) > 60);
  if (clash) return { state: "silent", reason: "versions months apart", candidates: candidates(c), parsed };
  return { state: "certain", recording: o.r, candidate: toCandidate(o.r), candidates: candidates([o.r, ...c.filter((x) => x.id !== o.r.id)]), parsed };
}

/** The MusicBrainz searches FR-CORE-1 sends for a parsed title, in order. */
export function searchesFor(parsed: Parsed): { withArtist: string[]; trackOnly: string[] } {
  const withArtist: string[] = [];
  const trackOnly: string[] = [];
  for (const q of parsed.queries) {
    if (q.artists[0]) withArtist.push(`recording:"${esc(q.track)}" AND artist:"${esc(q.artists[0])}"`);
    trackOnly.push(`recording:"${esc(q.track)}"`);
  }
  return { withArtist: [...new Set(withArtist)], trackOnly: [...new Set(trackOnly)] };
}

const searchUrl = (q: string) => `${MB}/recording?query=${encodeURIComponent(q)}&limit=50&fmt=json`;

export async function fetchFor(parsed: Parsed, d: MatchDeps): Promise<MbRecording[]> {
  const get = async (q: string) => ((await getJson(searchUrl(q), d.gate ?? mbGate, d.fetchFn, d.clock, d.cache)) as { recordings?: MbRecording[] }).recordings ?? [];
  const { withArtist, trackOnly } = searchesFor(parsed);
  const found: MbRecording[] = [];
  for (const q of withArtist) found.push(...(await get(q)));
  // If the artist searches return nothing, search by the track alone.
  if (!found.length) for (const q of trackOnly) found.push(...(await get(q)));
  return found;
}

export async function matchTitle(title: string, d: MatchDeps): Promise<MatchResult> {
  const parsed = parseTitle(title);
  if (!parsed.queries.length) return decide(parsed, []);
  return decide(parsed, await fetchFor(parsed, d));
}

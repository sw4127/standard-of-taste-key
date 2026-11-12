/**
 * FR-CORE-1, version 7 (T1.2; PRD Amendments of 2026-11-10, A2). Silent unless certain, as before.
 *
 * 1. Full-width punctuation is read as its half-width twin; 《》 and 【】 are kept as marks.
 * 2. If the title holds 《…》: the text inside the first pair is the track. Everything outside it,
 *    with any 【…】 tag removed, gives the artist candidates. MusicBrainz is searched for the track
 *    (official album, single or EP). A recording is a candidate only if one of its credited artists,
 *    or a listed alias of one, stands in the title outside the 《》 as a whole word (Latin) or an
 *    unbroken run (Chinese, Japanese, Korean). The studio rule and the silences then apply unchanged.
 * 3. If the title holds no 《…》: version 6.3 applies unchanged.
 *
 * How it is built (recorded in the build log): for a 《》 title, version 6.3 runs first, exactly as
 * it was, so every title it matched still matches the same recording. Only when it stays silent for
 * want of a candidate does the new part run. Everything 6.3 accepts on the artist, version 7 accepts
 * too: a name the title gives whole is also a credited name standing in the title.
 */
import { fold } from "../checks";
import { getJson } from "../sources/http";
import { MB, mbGate, OFFICIAL } from "../sources/musicbrainz";
import { parseTitle, stripNotes, type Parsed } from "./parse";
import { hasVersionWord, normalise, type MbRecording } from "./studio";
import { decide, fetchFor, GENERIC_TITLES, settle, toCandidate, type MatchDeps, type MatchResult } from "./v6";

export const RULE_VERSION = "v7.2";
export type { Candidate, MatchDeps, MatchResult, Silence } from "./v6";

/** Step 1: full-width punctuation read as its half-width twin. 《》 and 【】 are left as they are. */
const TWINS: Record<string, string> = { "，": ",", "／": "/", "：": ":", "（": "(", "）": ")", "！": "!", "＆": "&", "　": " ", "｜": "|", "－": "-", "＇": "'", "＂": '"' };
export const halfWidth = (s: string) => s.replace(/[，／：（）！＆　｜－＇＂]/g, (ch) => TWINS[ch]!);

export interface Book {
  /** The text inside the first 《…》 pair. */
  track: string;
  /** Everything outside the pair, tags and quoted lines removed: where an artist's name may stand. */
  outside: string;
}

/**
 * Step 2's reading of a title. A quoted line (a lyric or a tagline in ‘…’, “…”, '…' or "…") is not
 * where a name stands, so it is left out of the outside text.
 */
export function readBook(title: string): Book | null {
  const t = halfWidth(title);
  const open = t.indexOf("《");
  if (open < 0) return null;
  let depth = 0;
  let close = -1;
  for (let i = open; i < t.length; i++) {
    if (t[i] === "《") depth++;
    else if (t[i] === "》" && --depth === 0) {
      close = i;
      break;
    }
  }
  if (close < 0) return null;
  const track = t.slice(open + 1, close).trim();
  const outside = `${t.slice(0, open)} ${t.slice(close + 1)}`
    .replace(/【[^】]*】/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/‘[^’]*’|“[^”]*”|"[^"]*"|(?<![\p{L}\p{N}])'[^']*'(?![\p{L}\p{N}])/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  return track ? { track, outside } : null;
}

const FEAT = /\s*\((?:feat\.?|with|ft\.?|prod\.?)[^)]*\)/gi;
/** Words in a bracket that make it a version, never a note to drop. */
const VERSION_IN_BRACKET = /\d{4}|版|mix|edit|live|remix|reprise|interlude|part|pt\.?|skit|intro|outro|radio|extended|session|bonus|demo|acoustic|instrumental|karaoke|cover|version|伴奏|现场|演唱会|翻唱/i;

/** A title without its trailing brackets, when none of them names a version: "満ちてゆく (心海渐满)", "Sunflower (Spider-Man: Into the Spider-Verse)". */
export function bare(title: string): string {
  let t = halfWidth(title).replace(FEAT, "").trim();
  for (;;) {
    const m = /^(.*\S)\s*\(([^()]*)\)$/.exec(t);
    if (!m || VERSION_IN_BRACKET.test(m[2]!)) return t;
    t = m[1]!.trim();
  }
}

/** The ways a track may be written, most exact first. */
export function trackForms(track: string): string[] {
  const exact = stripNotes(halfWidth(track).replace(FEAT, "")).trim();
  return [...new Set([exact, bare(exact)].filter(Boolean))];
}

const hasCjk = (s: string) => /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af]/.test(s);
/** Words: a run of Chinese, Japanese or Korean characters is one word, and never joins the Latin letters beside it. */
const WORDS = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]+|(?:(?![\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}])[\p{L}\p{N}])+/gu;
const tokens = (s: string) => s.normalize("NFKC").toLowerCase().match(WORDS) ?? [];

/**
 * Does this name stand in the text? A Latin name must be whole words in a row ("DEN" never stands in
 * "Garden"); a Chinese, Japanese or Korean name must be an unbroken run inside one stretch of the
 * text. No name shorter than two characters ever counts.
 */
export function stands(name: string, outside: string): boolean {
  const n = normalise(name);
  if ([...n].length < 2) return false;
  if (hasCjk(name)) {
    return outside.split(/[\s,/&、|]+/).some((part) => normalise(part).includes(n));
  }
  // A name written with or without its hyphen or dots ("PattyCake", "Patty-Cake") stands when one
  // whole word of the title, punctuation removed, is the name: the comparison version 6.3 made.
  if (outside.split(/[\s,/&、|()]+/).some((w) => normalise(w) === n)) return true;
  const want = tokens(name);
  const have = tokens(outside);
  if (!want.length) return false;
  for (let i = 0; i + want.length <= have.length; i++) if (want.every((w, j) => have[i + j] === w)) return true;
  return false;
}

type Credit = NonNullable<MbRecording["artist-credit"]>[number];
/** Every name a credited artist goes by: as credited, the artist's own name, each listed alias, and without a leading "The". */
export function namesOf(a: Credit): string[] {
  const names = [a.name, a.artist.name, ...(a.artist.aliases ?? []).map((x) => x.name)];
  return [...new Set(names.flatMap((n) => [n, n.replace(/^the\s+/i, "")]).filter(Boolean))];
}

export const artistStands = (r: MbRecording, outside: string) => (r["artist-credit"] ?? []).some((a) => namesOf(a).some((n) => stands(n, outside)));

const GUEST = /feat|ft\.|featuring|\bwith\b.*\bguest/i;
/**
 * A recording co-credited to an artist the title does not name is another version: "Summer" by Joe
 * Hisaishi & Wiener Symphoniker (2024) is not the "Summer" a video titled with Joe Hisaishi alone
 * plays. Every credited artist must stand in the title, inside or outside the 《》, except a featured
 * guest (a credit joined by "feat."), whom uploaders often leave out or write in another script.
 */
export function noUnnamedCoArtist(r: MbRecording, book: Book): boolean {
  const credit = r["artist-credit"] ?? [];
  const text = `${book.outside} ${book.track}`;
  return credit.every((a, i) => (i > 0 && GUEST.test(credit[i - 1]!.joinphrase ?? "")) || namesOf(a).some((n) => stands(n, text)));
}

/**
 * The names standing together in each stretch of the title outside the 《》: stretches are cut at a
 * dash or a divider, names inside one at a comma, &, 、, / or feat. "- 澤野弘之,R!N⁄Gemie -" is one
 * stretch of two names; "百万级装备听 - Glass Animals" is two stretches of one name each.
 */
export function nameGroups(outside: string): string[][] {
  return outside
    .split(/\s*(?:\||\s[-–—]+\s?|\s?[-–—]+\s)\s*/)
    .map((seg) => seg.split(/\s*(?:&|、|,|\/|\sx\s|\sfeat\.?\s|\sft\.?\s)\s*/i).map((x) => x.trim()).filter((x) => [...x.replace(/\s/g, "")].length >= 2))
    .filter((g) => g.length > 0);
}

/**
 * Re-run of the coverage bar, 2026-11-12: "《Call your name》- 澤野弘之,R!N⁄Gemie" was named as a piano
 * version credited to 澤野弘之 alone. When the title names several artists together and the recording
 * is credited to one of them alone, it is another version, and the rule stays silent.
 */
export function creditCoversGroup(r: MbRecording, book: Book): boolean {
  const credit = r["artist-credit"] ?? [];
  for (const g of nameGroups(book.outside)) {
    if (g.length < 2) continue;
    const ours = credit.some((a) => namesOf(a).some((n) => g.some((part) => stands(n, part))));
    // Only a recording credited to one artist alone is refused: a title that adds a series or a label
    // to a duet ("国风新语&浮生梦&汐音社《探窗》", credited 浮生梦 & 汐音社) still names the song.
    if (ours && credit.length === 1) return false;
  }
  return true;
}

/** Both credit checks: no co-credited artist the title leaves out, and none of the title's named artists left out. */
export const creditFits = (r: MbRecording, book: Book) => noUnnamedCoArtist(r, book) && creditCoversGroup(r, book);

/** A recording's title against the track: equal as written (notes stripped), or equal with brackets that name no version dropped. */
export function sameTitle(recordingTitle: string, forms: string[], loose = true): boolean {
  const written = stripNotes(halfWidth(recordingTitle));
  const theirs = new Set(loose ? [normalise(written), normalise(bare(written))] : [normalise(written)]);
  return forms.some((f) => theirs.has(normalise(f)));
}

/** The names outside the 《》 that may be an artist, for the searches sent: split on the usual marks and on a dash. */
export function outsideParts(outside: string): string[] {
  const parts = outside
    .split(/\s*(?:&|、|,|\/|\||\sx\s|\sfeat\.?\s|\sft\.?\s|\s[-–—]+\s?|\s?[-–—]+\s|[()])\s*/i)
    .map((s) => s.trim().replace(/^[\s\-–—]+|[\s\-–—]+$/g, ""))
    .filter(Boolean);
  // A stretch mixing scripts ("用百万级豪华装备试听The Weeknd", "朱旭BooBoo") is also tried as its parts.
  const out: string[] = [];
  for (const p of parts) {
    out.push(p);
    const runs = p.match(/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af]+|[^\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af]+/g) ?? [];
    if (runs.length > 1) for (const r of runs) out.push(r.trim());
  }
  return [...new Set(out.filter((s) => [...s.replace(/\s/g, "")].length >= 2))];
}

const esc = (s: string) => s.replace(/["\\]/g, "\\$&");
/** At most this many names are asked for beside the track, all in one search. */
export const MAX_NAMES = 6;

/**
 * The MusicBrainz searches the new part sends, in order: for each way the track may be written, one
 * search for the track by any of the names read outside the 《》, then one for the track alone. Each
 * asks for official albums, singles and EPs only. One search for all the names keeps the calls few:
 * a video whose song MusicBrainz does not hold is answered in two calls for each way of writing it.
 */
export function searchesV7(book: Book): string[] {
  const out: string[] = [];
  const names = outsideParts(book.outside).slice(0, MAX_NAMES);
  for (const f of trackForms(book.track)) {
    if (names.length) out.push(`recording:"${esc(f)}" AND (${names.map((n) => `artist:"${esc(n)}"`).join(" OR ")}) AND ${OFFICIAL}`);
    out.push(`recording:"${esc(f)}" AND ${OFFICIAL}`);
  }
  return [...new Set(out)];
}

/** The last search, sent only when the others found nothing: the track by the names read, with no release filter. */
export function lastSearchV7(book: Book): string | null {
  const names = outsideParts(book.outside).slice(0, MAX_NAMES);
  if (!names.length) return null;
  return `recording:"${esc(trackForms(book.track).at(-1)!)}" AND (${names.map((n) => `artist:"${esc(n)}"`).join(" OR ")})`;
}

export const searchUrlV7 = (q: string) => `${MB}/recording?query=${encodeURIComponent(q)}&limit=100&fmt=json`;

/** The new part of the rule, over recordings already fetched: pure, so fixtures can replay it. */
export function decideV7(parsed: Parsed, book: Book, found: MbRecording[]): MatchResult {
  const byId = new Map(found.map((r) => [r.id, r]));
  const all = [...byId.values()];
  const forms = trackForms(book.track);
  if (forms.every((f) => GENERIC_TITLES.has(normalise(f)))) return { state: "silent", reason: "a generic title", candidates: all.slice(0, 8).map(toCandidate), parsed };
  const mayBe = all.filter((r) => (r.score ?? 0) >= 85 && artistStands(r, book.outside) && creditFits(r, book));
  // A recording whose title is the track as written comes first. Only when there is none does a title
  // with a bracket that names no version count ("Sunflower (Spider-Man: Into the Spider-Verse)"); so
  // "Heat Waves (stripped back)" never stands beside "Heat Waves".
  const exact = mayBe.filter((r) => sameTitle(r.title, forms, false));
  const c = exact.length ? exact : mayBe.filter((r) => sameTitle(r.title, forms));
  if (!c.length) {
    // A recording of the track by a named artist exists, and the credit checks refused it: the song may
    // well be on MusicBrainz, so the card must not say it is not (FR-CORE-1 v7, step 5).
    const refused = all.some((r) => (r.score ?? 0) >= 85 && artistStands(r, book.outside) && sameTitle(r.title, forms) && !creditFits(r, book));
    return { state: "silent", reason: refused ? "credits differ" : "no candidate", candidates: all.slice(0, 8).map(toCandidate), parsed };
  }
  const settled = settle(parsed, c, (r) => hasVersionWord(exact.length ? r.title : bare(r.title)));
  if (settled.state === "silent" && settled.reason === "no studio recording" && c.length === 1 && loneAndPlain(c[0]!)) {
    const only = c[0]!;
    return { state: "certain", recording: only, candidate: toCandidate(only), candidates: [toCandidate(only)], parsed };
  }
  return settled;
}

/**
 * Re-run of the coverage bar, 2026-11-12: Violet (郑润泽) and 我走后 (小咪) are each held by MusicBrainz as
 * one recording whose release has no status or no type filled in, so the studio rule could not see a
 * studio release. When the only recording of the title by an artist standing in the title has no note,
 * no version word, and no release marked live, remix, compilation, DJ-mix, demo, mixtape, bootleg or
 * promotion, it is the song.
 */
export function loneAndPlain(r: MbRecording): boolean {
  const rels = r.releases ?? [];
  return (
    !(r.disambiguation ?? "").trim() &&
    !hasVersionWord(r.title) &&
    rels.length > 0 &&
    rels.every((x) => x.status !== "Bootleg" && x.status !== "Promotion" && x.status !== "Pseudo-Release" && !(x["release-group"]?.["secondary-types"] ?? []).length)
  );
}

export async function fetchV7(book: Book, d: MatchDeps): Promise<MbRecording[]> {
  const get = async (q: string) => ((await getJson(searchUrlV7(q), d.gate ?? mbGate, d.fetchFn, d.clock, d.cache)) as { recordings?: MbRecording[] }).recordings ?? [];
  const found: MbRecording[] = [];
  for (const q of searchesV7(book)) {
    const rs = await get(q);
    found.push(...rs);
    // Stop as soon as a search holds a recording that could be the song: fewer calls, sooner words.
    if (rs.some((r) => (r.score ?? 0) >= 85 && sameTitle(r.title, trackForms(book.track)) && artistStands(r, book.outside))) return found;
  }
  const last = lastSearchV7(book);
  if (last) found.push(...(await get(last)));
  return found;
}

/**
 * Version 6.3 searched with the first name it read, and for these titles that name is often the
 * uploader's phrase, so its silence may only mean its search was thin. The new part runs after any
 * silence of 6.3's except the two that are about the title itself.
 */
const FINAL: ReadonlySet<string> = new Set(["the title names no song", "a generic title"]);

/**
 * Run 2 of the coverage bar, 2026-11-12: 「钢琴+不插电」I Knew It, I Knew You (a piano and an acoustic
 * version, 6:05) was named as the 2:59 single, and the 13:42 Thriller short film as the 5:58 album
 * version. Two checks, each of which only ever makes the rule silent:
 * 1. A version the video's title names outside the song's own name (钢琴 piano, 不插电 unplugged, live,
 *    remix…) must show on the recording, in its title or MusicBrainz's note.
 * 2. When the video's length is known, a recording more than LENGTH_SLACK seconds longer or shorter is
 *    another version. Bob ruled on 2026-11-08 that length is weak evidence that a version is right; it
 *    is used here only to stay silent.
 */
export const VIDEO_VERSION_WORDS =
  /\b(?:live|remix|instrumental|demo|acoustic|edit|karaoke|sped|slowed|clean|a cappella|cover|piano|unplugged|orchestral|nightcore|reprise)\b|伴奏|现场|演唱会|翻唱|钢琴|不插电|纯音乐|器乐|女版|男版|戏腔|加速|降速|慢速|混音|重混|演奏版|抒情版|弹唱/i;
export const LENGTH_SLACK = 30;

/** The video's title with the song's own name taken out: "Piano Man" names no version. */
export function versionNamed(title: string, parsed: Parsed): boolean {
  const book = readBook(title);
  let rest = fold(halfWidth(title));
  const tracks = [book?.track, ...parsed.queries.map((q) => q.track)].filter((t): t is string => !!t);
  for (const t of tracks) rest = rest.split(fold(halfWidth(t))).join(" ");
  return VIDEO_VERSION_WORDS.test(rest);
}

const showsVersion = (r: MbRecording) => VIDEO_VERSION_WORDS.test(fold(r.title)) || VIDEO_VERSION_WORDS.test(fold(r.disambiguation ?? ""));

export interface MatchOptions {
  /** The video's own length, when the page's player reports it. */
  videoSeconds?: number;
}

/** The two silent-only checks, on a result the rule has already reached. */
export function lastChecks(title: string, r: MatchResult, o: MatchOptions = {}): MatchResult {
  if (r.state !== "certain") return r;
  if (versionNamed(title, r.parsed) && !showsVersion(r.recording)) return { state: "silent", reason: "a version the recording lacks", candidates: r.candidates, parsed: r.parsed };
  const len = r.recording.length;
  if (o.videoSeconds && len && Math.abs(o.videoSeconds - len / 1000) > LENGTH_SLACK) return { state: "silent", reason: "lengths differ", candidates: r.candidates, parsed: r.parsed };
  return r;
}

export async function matchTitle(title: string, d: MatchDeps, o: MatchOptions = {}): Promise<MatchResult> {
  return lastChecks(title, await matchBeforeChecks(title, d), o);
}

async function matchBeforeChecks(title: string, d: MatchDeps): Promise<MatchResult> {
  const parsed = parseTitle(title);
  const book = readBook(title);
  const first = parsed.queries.length ? decide(parsed, await fetchFor(parsed, d)) : decide(parsed, []);
  if (!book) return first;
  // Re-run of the coverage bar, 2026-11-12: 6.3 named a 2002 duet credited 成龍 VS 鄧麗君 for a title
  // naming 邓丽君 alone. Its result now passes the same credit checks, or the new part decides.
  if (first.state === "certain" ? creditFits(first.recording, book) : FINAL.has(first.reason)) return first;
  const second = decideV7(parsed, book, await fetchV7(book, d));
  // Keep 6.3's candidates for Fix when the new part found none of its own.
  return second.state === "silent" && !second.candidates.length ? { ...second, candidates: first.candidates } : second;
}

/** FR-CORE-1 v7, step 5: why no song is named, in one line for the card. */
export function silenceLine(r: MatchResult): string {
  if (r.state !== "silent") return "";
  const readTrack = r.parsed.queries.length > 0 || !!readBook(r.parsed.title);
  return readTrack && r.reason === "no candidate" ? "This song is not on MusicBrainz." : "I couldn't read this title.";
}

export { isRemovedVideoTitle, REMOVED_VIDEO_TITLES } from "./removed";

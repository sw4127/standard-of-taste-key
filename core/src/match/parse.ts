/**
 * FR-CORE-1, part 1: parse a Bilibili video title into the track and the artists it names.
 *
 * - Every 【…】 is removed.
 * - If the title holds 《: the artist text is everything before the first 《; the track is the outer
 *   《…》 (nested 《》 handled by counting); a trailing note in （…） or (…) naming a theme song, an
 *   ending or opening song, an insert song, a drama, a film, a season, OST or theme is removed,
 *   repeatedly; everything after the closing 》 is ignored.
 * - Otherwise the Stage 6 rules (parse_v2): a leading 「…」 is a label (kept as an artist hint) unless
 *   nothing else is left; only the Latin text is read; "A - B" is tried both ways.
 * - Artists split on & ＆ 、 , ， / " x " "feat."; a name mixing scripts (吴琳珂Moske, G.E.M.邓紫棋) is
 *   also tried as its parts; no artist part shorter than two characters is ever used (阿YueYue must not
 *   yield 阿).
 */
import { fold } from "../checks";
import { hasVersionWord } from "./studio";

export interface Query {
  track: string;
  artists: string[];
}

export interface Parsed {
  title: string;
  /** Each reading of the title to try, in order. */
  queries: Query[];
  /** The video title itself carries a version word (live, remix, 伴奏…): versions are then allowed. */
  version: boolean;
}

const NOTE = /主题曲|片尾曲|片头曲|插曲|电视剧|电影|第.{1,3}季|\bOST\b|\btheme\b/i;
const OPEN: Record<string, string> = { "）": "（", ")": "(" };

/** Remove trailing notes like （电视剧《On Call 36小时》主题曲）, repeatedly. Exported: recording titles are stripped the same way. */
export function stripNotes(track: string): string {
  let t = track.trim();
  for (;;) {
    const close = t.at(-1);
    if (!close || !OPEN[close]) return t;
    let depth = 0;
    let start = -1;
    for (let i = t.length - 1; i >= 0; i--) {
      const ch = t[i]!;
      if (ch === "）" || ch === ")") depth++;
      else if (ch === "（" || ch === "(") {
        depth--;
        if (depth === 0) {
          start = i;
          break;
        }
      }
    }
    if (start <= 0) return t;
    const inner = t.slice(start + 1, -1);
    if (!NOTE.test(fold(inner))) return t;
    t = t.slice(0, start).trim();
  }
}

/** The outer 《…》 and the text before it, nested 《》 counted. */
function outerBook(t: string): { before: string; inner: string } | null {
  const first = t.indexOf("《");
  if (first < 0) return null;
  let depth = 0;
  for (let i = first; i < t.length; i++) {
    if (t[i] === "《") depth++;
    else if (t[i] === "》" && --depth === 0) return { before: t.slice(0, first), inner: t.slice(first + 1, i) };
  }
  return { before: t.slice(0, first), inner: t.slice(first + 1) };
}

const CJK = /[　-〿㐀-䶿一-鿿＀-￯·]+/g;
const latinParts = (s: string) => s.replace(CJK, " ").replace(/\s+/g, " ").trim().replace(/^[\s\-|/,]+|[\s\-|/,]+$/g, "");
const FEAT = /\s*[(（](?:feat\.?|with|ft\.?)[^)）]*[)）]/gi;
const isCjk = (ch: string) => /[㐀-䶿一-鿿]/.test(ch);

/** Split an artist text into the names to look for in a credit. */
export function artistParts(text: string): string[] {
  const names = text
    .replace(FEAT, "")
    .split(/\s*(?:&|＆|、|,|，|\/|／|\sx\s|\sfeat\.?\s|\sft\.?\s)\s*/i)
    .map((s) => s.trim().replace(/^[\s\-|]+|[\s\-|]+$/g, ""))
    .filter(Boolean);
  const out: string[] = [];
  for (const n of names) {
    out.push(n);
    // A name mixing scripts is also tried as its parts.
    const parts = n.match(/[㐀-䶿一-鿿]+|[^㐀-䶿一-鿿]+/g) ?? [];
    if (parts.length > 1 && parts.some((p) => isCjk(p[0]!)) && parts.some((p) => !isCjk(p[0]!))) {
      for (const p of parts) out.push(p.trim());
    }
  }
  // No artist part shorter than two characters is ever used.
  return [...new Set(out.filter((p) => [...p.replace(/\s/g, "")].length >= 2))];
}

export function parseTitle(title: string): Parsed {
  const version = hasVersionWord(title);
  let t = title.replace(/【[^】]*】/g, " ").replace(/\[[^\]]*Video[^\]]*\]/gi, " ").replace(/\s+/g, " ").trim();
  const book = outerBook(t);
  if (book) {
    const track = stripNotes(book.inner.replace(FEAT, "")).trim();
    return { title, version, queries: track ? [{ track, artists: artistParts(book.before) }] : [] };
  }

  // Stage 6 rules (parse_v2), for titles with no 《》.
  let hints: string[] = [];
  const label = /^\s*「([^」]*)」(.*)$/.exec(t);
  if (label) {
    const [, inner, rest] = label;
    if (rest!.trim()) {
      hints = artistParts(latinParts(inner!)).filter((h) => /[A-Za-z]{2}/.test(h));
      t = rest!;
    } else {
      t = inner!;
    }
  }
  const t2 = latinParts(t.replace(/，/g, ",").replace(/／/g, "/"));
  const clean = (s: string) => (version ? s : s.replace(/\b(remix|original version|version|live|acoustic|demo)\b/gi, "")).replace(FEAT, "").trim().replace(/^[\s()-]+|[\s()-]+$/g, "");
  const both = t2.split(/\s+[-–]\s+|\s[-–]|[-–]\s/);
  const queries: Query[] = [];
  if (both.length >= 2) {
    const [L, R] = [both[0]!, both.slice(1).join(" - ")];
    queries.push({ track: clean(L), artists: artistParts(R) });
    queries.push({ track: clean(R), artists: artistParts(L) });
  } else {
    queries.push({ track: clean(t2), artists: hints });
  }
  return { title, version, queries: queries.filter((q) => q.track) };
}

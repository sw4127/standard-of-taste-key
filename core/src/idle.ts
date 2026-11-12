/**
 * T1.7 The idle panel (FR-T1.7) and T1.8 his own words beside the record (FR-T1.8): what the panel
 * can show between songs, computed from the rows this browser keeps. Pure, so each state is tested.
 */
import type { Key } from "./design/key-colour";
import type { NamedSong, PlayRow, SongFacts } from "./model";
import type { Choice, Words } from "./note";
import { localDay } from "./note";
import { normalise } from "./match/studio";

export const RECENT_CARDS = 4;

export interface RecentSong {
  facts: SongFacts;
  plays: number;
  last: string; // local date-time of the latest play
}

const isMatched = (p: PlayRow) => !!p.recording_id && (p.match_state === "certain" || p.match_state === "fixed by me");

/** The songs on his panel record, most recent first: one entry per recording, counted only from plays the panel saw. */
export function recordSongs(plays: PlayRow[], facts: Record<string, SongFacts>): RecentSong[] {
  const by = new Map<string, RecentSong>();
  for (const p of plays) {
    if (!isMatched(p) || !facts[p.recording_id]) continue;
    const r = by.get(p.recording_id) ?? { facts: facts[p.recording_id]!, plays: 0, last: p.started_at };
    r.plays += 1;
    if (p.started_at > r.last) r.last = p.started_at;
    by.set(p.recording_id, r);
  }
  return [...by.values()].sort((a, b) => b.last.localeCompare(a.last));
}

const NUMBERS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "3 plays. The last was on 11 Nov." in whole sentences (design rule 10). */
export function playsSentence(r: RecentSong): string {
  const d = r.last.slice(0, 10);
  const day = `${Number(d.slice(8, 10))} ${MONTHS[Number(d.slice(5, 7)) - 1]}`;
  return r.plays === 1 ? `One play, on ${day}.` : `${r.plays} plays. The last was on ${day}.`;
}

/** Design rule 11, the panel saying where the record stands. */
export function recordSentence(songs: number): string {
  const n = songs <= 12 ? NUMBERS[songs]! : String(songs);
  return `${n} ${songs === 1 ? "song" : "songs"} in, there is nothing to say across them yet; lines come as the record grows.`;
}

/** Design rule 12: the songs with no measured key are counted in a sentence under the circle. */
export function unmeasuredSentence(n: number): string | null {
  if (n <= 0) return null;
  return n === 1 ? "One more song has no measured key." : `${n <= 12 ? NUMBERS[n] : n} more songs have no measured key.`;
}

export const measuredKeys = (songs: RecentSong[]): Key[] => songs.flatMap((s) => (s.facts.key && s.facts.key.strength >= 0.5 ? [s.facts.key] : []));

export type IdleState = "first-open" | "first-open on Bilibili" | "record" | "record on Bilibili";
export function idleState(songs: number, onBilibili: boolean): IdleState {
  return songs > 0 ? (onBilibili ? "record on Bilibili" : "record") : onBilibili ? "first-open on Bilibili" : "first-open";
}

export const ON_BILIBILI = "You are on Bilibili. Search pages are not read; a video page is.";
export const PLAY_HERE = "Play a music video on this page and I'll read it.";
export const PLAY_ON_BILIBILI = "Play a music video on Bilibili and I'll read it.";

// ---- T1.8 ---------------------------------------------------------------------------------------

export interface WordsAbout {
  words: Words;
  date: string;
}

const sameSong = (a: SongFacts, b: SongFacts) =>
  a.recording_id === b.recording_id || (normalise(a.title) === normalise(b.title) && normalise(a.lead_artist) === normalise(b.lead_artist));

/**
 * His "In your words" answers about this song: an answer belongs to the line it answers, and the line
 * to the songs it rests on. Returned unchanged, newest first. Words that fail the carve-out check are
 * left to his own words page (FR-T9.4); `passes` decides that.
 */
export function wordsAbout(
  song: SongFacts,
  o: { words: Words[]; choices: Choice[]; songs: NamedSong[]; facts: Record<string, SongFacts>; person: string; passes: (text: string) => boolean },
): WordsAbout[] {
  const mine = o.songs.filter((e) => e.person_id === o.person && o.facts[e.recording_id] && sameSong(o.facts[e.recording_id]!, song)).map((e) => e.entry_id);
  if (!mine.length) return [];
  const lines = new Set(o.choices.filter((c) => c.person_id === o.person && c.evidence.some((e) => e.entry_id && mine.includes(e.entry_id))).map((c) => c.question_id));
  return o.words
    .filter((w) => w.person_id === o.person && w.text.trim() && (lines.has(w.about) || mine.includes(w.about)) && o.passes(w.text))
    .sort((a, b) => b.written_at.localeCompare(a.written_at))
    .map((words) => ({ words, date: localDay(words.written_at) }));
}

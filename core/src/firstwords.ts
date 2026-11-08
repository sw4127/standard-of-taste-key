/**
 * The first words beside a song (moment map P-4; FR-T2.2, T2.4, T2.5, T2.6, T4.7). At most one line, in
 * this order of what exists: (a) a line from the person's own record (D1), once this recording or its
 * artist has plays on three or more separate days since install, with two readings and Neither;
 * (b) a consenting friend's plays of this artist (D11), with where to start; (c) the quiet line, which
 * carries one offer at most once per listening session. Never a credit fact, never a story (FR-T2.3).
 * A line the person dropped ("Not why I love it") is never shown again for that recording; the next
 * eligible line, or the quiet line, takes its place. Every sentence passes FR-CORE-2 before it shows.
 */
import { breaches } from "./checks";
import { MIN_MS, quarterPhrase, type Quarter } from "./lookback";
import { normalise } from "./match/studio";
import type { HistoryRow, KeyRow, PlayRow, SongFacts } from "./model";
import { num } from "./patterns";
import type { Person } from "./storage";

export const QUIET = "Nothing worth saying about this one yet.";
export const QUIET_OFFER = "Name a few songs that come to mind?";
/** FR-T2.4: seconds heard before the first line. */
export const KNOWN_WAIT = 15;
export const FIRST_PLAY_WAIT = 60;
/** FR-T2.5: a listening session ends after 30 minutes with no play. */
export const SESSION_GAP_MS = 30 * 60_000;
export const MIN_DAYS = 3;
export const FRIEND_MIN_PLAYS = 20;
export const SONG_MIN_PLAYS = 5;

export type FirstKind = "own-recording" | "own-artist" | "friend" | "quiet";

export interface Reading {
  template_id: string;
  ask: string;
  kept: string;
}

export interface FirstLine {
  kind: FirstKind;
  template_id: string;
  text: string;
  /** A second, quieter sentence under the line (the friend line's "where to start"). */
  under?: string;
  readings?: [Reading, Reading];
  /** The proof's items, in words, each with where it comes from. */
  proof: { text: string; source: string }[];
  /** The quiet line's offer is due with it. */
  offer?: boolean;
  /** Names quoted in the line and its proof (titles, records, artists): quoted, not stated (FR-CORE-2). */
  names?: string[];
  /** The friend line's record: the one they played most (where to start; FR-T4.5's trusted judge). */
  record?: string;
}

/** D4 reading templates for lines from the person's own record (hand-written; never "why"). */
export const OWN_READINGS: Record<"own-recording" | "own-artist", [Reading, Reading]> = {
  "own-recording": [
    { template_id: "own-recording/a", ask: "Does it belong to a certain time of day for you?", kept: "it may belong to a certain time of day for you" },
    { template_id: "own-recording/b", ask: "Or do you play it at any hour?", kept: "you play it at any hour" },
  ],
  "own-artist": [
    { template_id: "own-artist/a", ask: "Is there one song of theirs you keep returning to?", kept: "one song of theirs may be the one you return to" },
    { template_id: "own-artist/b", ask: "Or is it their sound, whichever song plays?", kept: "it is their sound, whichever song plays" },
  ],
};

const isMatched = (p: PlayRow) => !!p.recording_id && (p.match_state === "certain" || p.match_state === "fixed by me");
const dayOf = (p: PlayRow) => p.started_at.slice(0, 10);
const afterMidnight = (p: PlayRow) => Number(p.started_at.slice(11, 13)) < 5;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** FR-T2.4: 15 s on a recording D1 has seen before, 60 s on a first play. */
export function waitFor(plays: PlayRow[], recording_id: string, play_id: string): number {
  return plays.some((p) => p.play_id !== play_id && p.recording_id === recording_id && isMatched(p)) ? KNOWN_WAIT : FIRST_PLAY_WAIT;
}

function playsLine(ps: PlayRow[], kind: "own-recording" | "own-artist", who: string): FirstLine | null {
  const days = [...new Set(ps.map(dayOf))];
  if (days.length < MIN_DAYS) return null;
  const late = days.filter((d) => ps.some((p) => dayOf(p) === d && afterMidnight(p))).length;
  const tail = late >= 2 ? `, ${num(late)} of them after midnight` : "";
  return {
    kind,
    template_id: `first:${kind}`,
    text: `You've played ${who} on ${num(days.length)} separate days since you installed The Key${tail}.`,
    readings: OWN_READINGS[kind],
    names: [who, ...ps.map((p) => p.song_title ?? p.page_title)],
    proof: ps.map((p) => ({ text: `${p.started_at.slice(0, 10)} ${p.started_at.slice(11, 16)} · ${p.song_title ?? p.page_title}`, source: "Your plays on Bilibili, counted in this browser" })),
  };
}

/** (a) A line from the person's own record: this recording first, then its artist. */
export function ownRecordLine(plays: PlayRow[], facts: Record<string, SongFacts>, song: SongFacts): FirstLine | null {
  const mine = plays.filter(isMatched);
  const thisOne = playsLine(mine.filter((p) => p.recording_id === song.recording_id), "own-recording", "this");
  if (thisOne) return thisOne;
  const byArtist = mine.filter((p) => facts[p.recording_id]?.lead_artist_id === song.lead_artist_id);
  return playsLine(byArtist, "own-artist", song.lead_artist);
}

const quarterOf = (r: HistoryRow): Quarter => ({ year: Number(r.local_time.slice(0, 4)), q: (Math.floor((Number(r.local_time.slice(5, 7)) - 1) / 3) + 1) as Quarter["q"] });
const counts = <T,>(xs: T[], key: (x: T) => string) => {
  const m = new Map<string, number>();
  for (const x of xs) m.set(key(x), (m.get(key(x)) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
};

/** How a line names someone the person added: "my friend" becomes "your friend" mid-sentence; any other label stays as typed. */
export const theirName = (label: string) => (/^my\s+/i.test(label.trim()) ? `your ${label.trim().replace(/^my\s+/i, "")}` : label.trim());
/** At the start of a sentence: "Your friend". */
export const friendName = (label: string) => (/^my\s+/i.test(label.trim()) ? `Your ${label.trim().replace(/^my\s+/i, "")}` : cap(label.trim()));

/**
 * (b) FR-T4.7: a consenting friend with 20 or more plays of 30 s or more of this artist. Where to start:
 * their most-played record of the artist and the quarter they played it most, and their three most
 * played songs of the artist, never a song with fewer than five plays.
 */
export function friendLine(histories: Record<string, HistoryRow[]>, people: Person[], artist: string): FirstLine | null {
  const want = normalise(artist);
  if (!want) return null;
  let best: { person: Person; rows: HistoryRow[] } | null = null;
  for (const person of people) {
    if (person.person_id === "me" || !person.consent_note?.trim()) continue;
    const rows = (histories[person.person_id] ?? []).filter((r) => r.ms_played >= MIN_MS && normalise(r.artist) === want);
    if (rows.length >= FRIEND_MIN_PLAYS && (!best || rows.length > best.rows.length)) best = { person, rows };
  }
  if (!best) return null;
  const { person, rows } = best;
  const [album, albumPlays] = counts(rows, (r) => r.album)[0]!;
  const quarters = counts(rows.filter((r) => r.album === album), (r) => `${quarterOf(r).year}-${quarterOf(r).q}`);
  const [y, q] = quarters[0]![0].split("-").map(Number);
  const when = quarterPhrase({ year: y!, q: q as Quarter["q"] });
  const songs = counts(rows, (r) => r.track).filter(([, n]) => n >= SONG_MIN_PLAYS).slice(0, 3);
  const who = friendName(person.label);
  const source = `${who}'s Spotify file, counted in this browser`;
  return {
    kind: "friend",
    template_id: "first:friend",
    text: `${who} has played this artist ${rows.length} times.`,
    under: `Where to start: ${album}, the record they played most, mostly ${when}.`,
    names: [who, artist, album, ...songs.map(([t]) => t)],
    record: album,
    proof: [
      { text: `${rows.length} plays of ${artist}, each 30 seconds or longer`, source },
      { text: `${album}: ${albumPlays} plays, most of them ${when}`, source },
      ...(songs.length ? [{ text: `Their most-played songs by this artist: ${songs.map(([t, n]) => `${t} (${n})`).join(", ")}`, source }] : []),
    ],
  };
}

/** FR-T2.5: the listening session the current play belongs to starts after a 30-minute gap. */
export function sessionStart(plays: PlayRow[], current: PlayRow): string {
  const sorted = [...plays.filter((p) => p.play_id !== current.play_id), current].sort((a, b) => a.started_at.localeCompare(b.started_at));
  let i = sorted.findIndex((p) => p.play_id === current.play_id);
  const t = (s: string) => Date.parse(`${s}Z`);
  while (i > 0) {
    const prev = sorted[i - 1]!;
    if (t(sorted[i]!.started_at) - (t(prev.started_at) + prev.heard_seconds * 1000) > SESSION_GAP_MS) break;
    i--;
  }
  return sorted[i]!.started_at;
}

/** The offer under the quiet line, at most once per listening session. */
export function offerDue(plays: PlayRow[], keys: KeyRow[], current: PlayRow): boolean {
  const start = sessionStart(plays, current);
  return !keys.some((k) => k.offer_shown && k.shown_at >= start);
}

function passes(l: FirstLine, names: string[]): boolean {
  const all = [
    ...breaches(l.text, "key", names),
    ...(l.under ? breaches(l.under, "fact", names) : []),
    ...l.proof.flatMap((p) => breaches(p.text, "fact", names)),
    ...(l.readings ?? []).flatMap((r) => [...breaches(r.ask, "offer"), ...breaches(r.kept, "said")]),
  ];
  return all.length === 0;
}

export interface FirstWordsInput {
  song: SongFacts;
  play: PlayRow;
  plays: PlayRow[];
  facts: Record<string, SongFacts>;
  keys: KeyRow[];
  histories: Record<string, HistoryRow[]>;
  people: Person[];
}

/** The one line to show, in order of what exists, skipping lines dropped for this recording. */
export function firstLine(i: FirstWordsInput): FirstLine {
  const dropped = new Set(i.keys.filter((k) => k.recording_id === i.song.recording_id && k.dropped).map((k) => k.template_id));
  const names = [i.song.title, i.song.artist_credit, i.song.lead_artist];
  const own = ownRecordLine(i.plays, i.facts, i.song);
  const friend = friendLine(i.histories, i.people, i.song.lead_artist);
  for (const l of [own, friend]) {
    if (!l || dropped.has(l.template_id)) continue;
    if (passes(l, [...names, ...(l.names ?? [])])) return l;
  }
  return { kind: "quiet", template_id: "first:quiet", text: QUIET, proof: [], offer: offerDue(i.plays, i.keys, i.play) };
}

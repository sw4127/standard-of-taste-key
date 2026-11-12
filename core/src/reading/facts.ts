/**
 * FR-T9.9, the facts sent with a reading: computed by code from his record, per record he wrote about.
 * From what he named: what the record is, its first release year, the range he said it found him in
 * (and the year, and his age then if he gave his birth year), and what he comes back for. For a person
 * with a listening history on record: first play, number of plays, the months it was active, and a
 * return after a gap of six months or more. The plays themselves are never sent.
 */
import { MIN_MS } from "../lookback";
import { normalise } from "../match/studio";
import { isAlbum, type HistoryRow, type Song } from "../model";
import type { Words } from "../note";
import type { Sent, SentFact, SentRecord } from "./prompt";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const monthOf = (iso: string) => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
const monthIndex = (iso: string) => Number(iso.slice(0, 4)) * 12 + Number(iso.slice(5, 7)) - 1;
const GAP_MONTHS = 6;

/** His plays of this record in a listening history: same track (or album) and same artist, 30 seconds or more. */
export function playsOf(song: Song, history: HistoryRow[]): HistoryRow[] {
  const title = normalise(song.facts.title);
  const artist = normalise(song.facts.lead_artist);
  return history.filter((h) => h.ms_played >= MIN_MS && normalise(isAlbum(song.entry) ? h.album : h.track) === title && normalise(h.artist) === artist);
}

function historyFacts(song: Song, history: HistoryRow[]): string[] {
  const plays = playsOf(song, history).sort((a, b) => a.local_time.localeCompare(b.local_time));
  if (!plays.length) return [];
  const months = [...new Set(plays.map((p) => p.local_time.slice(0, 7)))];
  const out = [
    `In the listener's listening history, the first play of it was in ${monthOf(plays[0]!.local_time)}.`,
    `The listening history has ${plays.length} ${plays.length === 1 ? "play" : "plays"} of it.`,
    `It was played in ${months.length} different ${months.length === 1 ? "month" : "months"}.`,
  ];
  for (let i = 1; i < months.length; i++) {
    if (monthIndex(months[i]!) - monthIndex(months[i - 1]!) > GAP_MONTHS) {
      out.push(`The listener came back to it in ${monthOf(months[i]!)}, after more than six months without a play.`);
      break;
    }
  }
  return out;
}

function namedFacts(song: Song, birthYear?: number): string[] {
  const { entry, facts } = song;
  const what = isAlbum(entry) ? "an album" : "a song";
  const out = [
    facts.first_release_year
      ? `"${facts.title}" is ${what} by ${facts.artist_credit}, first released in ${facts.first_release_year}.`
      : `"${facts.title}" is ${what} by ${facts.artist_credit}; MusicBrainz lists no release year for it.`,
  ];
  if (entry.found_me !== "unanswered" && entry.found_me !== "can't say") {
    const year = entry.found_me === "longer ago" && entry.found_year ? `, about ${entry.found_year}` : "";
    out.push(`The listener says it found them ${entry.found_me}${year}.`);
    if (year && birthYear) out.push(`The listener was about ${entry.found_year! - birthYear} years old then.`);
  }
  if (entry.comes_back_for !== "unanswered" && entry.comes_back_for !== "can't say") out.push(`The listener comes back to it for ${entry.comes_back_for}.`);
  return out;
}

/** His answer about one record: the newest "In your words" written about that record itself. */
export function answerAbout(entry_id: string, words: Words[], person = "me"): Words | undefined {
  return words.filter((w) => w.person_id === person && w.about === entry_id && w.text.trim()).sort((a, b) => b.written_at.localeCompare(a.written_at))[0];
}

/**
 * What one reading sends: each record he wrote about (with his answer exactly as written) and the
 * facts about those records. `mayQuote(text)` is false for an answer that may not be sent (FR-T9.9:
 * if he has not let the reading quote hard subjects, an answer that fails the carve-out check is not sent).
 */
export function sentFor(songs: Song[], words: Words[], o: { birthYear?: number; history?: HistoryRow[]; mayQuote: (text: string) => boolean; person?: string }): Sent {
  const records: SentRecord[] = [];
  const facts: SentFact[] = [];
  for (const song of songs) {
    const w = answerAbout(song.entry.entry_id, words, o.person ?? "me");
    if (!w || !o.mayQuote(w.text)) continue;
    const record_id = `R${records.length + 1}`;
    records.push({ record_id, entry_id: song.entry.entry_id, title: song.facts.title, artist: song.facts.artist_credit, kind: isAlbum(song.entry) ? "album" : "song", answer: w.text });
    for (const text of [...namedFacts(song, o.birthYear), ...historyFacts(song, o.history ?? [])]) facts.push({ fact_id: `F${facts.length + 1}`, record_id, text });
  }
  return { records, facts };
}

/** FR-T9.9, "What is needed": answers about at least two records. */
export const MIN_RECORDS = 2;

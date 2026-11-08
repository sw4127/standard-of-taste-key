/**
 * T5.7 Look back over a stretch of my life (FR-T5.7). Three kinds of line over a chosen stretch, from
 * dated plays, counting only plays of 30 seconds or more (Spotify's own `skipped` field is never used):
 * - arrived and stayed: first heard in the stretch, then played on 3 or more separate days in it;
 * - left: in the top 20 of the two quarters before, with under 10% of that play count in the stretch;
 * - came back: absent for at least two quarters before the stretch, played on 3 or more days in it.
 * Each line has its plays behind a tap and one pair of readings, plus Neither.
 */
import { breaches } from "./checks";
import { num } from "./patterns";
import type { HistoryRow } from "./model";

export const MIN_MS = 30_000;
const PER_KIND = 3; // the card holds only what fits: the three strongest of each kind

export interface Quarter {
  year: number;
  q: 1 | 2 | 3 | 4;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const quarterLabel = (x: Quarter) => `${MONTHS[(x.q - 1) * 3]} to ${MONTHS[(x.q - 1) * 3 + 2]} ${x.year}`;
/** The same stretch inside a sentence: "between April and June 2024". */
export const quarterPhrase = (x: Quarter) => `between ${MONTHS[(x.q - 1) * 3]} and ${MONTHS[(x.q - 1) * 3 + 2]} ${x.year}`;
const qIndex = (x: Quarter) => x.year * 4 + (x.q - 1);
const fromIndex = (i: number): Quarter => ({ year: Math.floor(i / 4), q: ((i % 4) + 1) as Quarter["q"] });
const dateOf = (r: HistoryRow) => r.local_time.slice(0, 10);
const quarterOf = (r: HistoryRow): Quarter => ({ year: Number(r.local_time.slice(0, 4)), q: (Math.floor((Number(r.local_time.slice(5, 7)) - 1) / 3) + 1) as Quarter["q"] });

export function summary(rows: HistoryRow[]): { plays: number; first: string; last: string } | null {
  if (!rows.length) return null;
  const months = rows.map((r) => r.local_time.slice(0, 7)).sort();
  return { plays: rows.length, first: months[0]!, last: months[months.length - 1]! };
}

/** Every quarter from the first play to the last, newest first. */
export function quarters(rows: HistoryRow[]): Quarter[] {
  if (!rows.length) return [];
  const idx = rows.map((r) => qIndex(quarterOf(r)));
  const out: Quarter[] = [];
  for (let i = Math.max(...idx); i >= Math.min(...idx); i--) out.push(fromIndex(i));
  return out;
}

/** The most recent full quarter: the one before the quarter of the last play, if the data reaches it. */
export function defaultStretch(rows: HistoryRow[]): Quarter | null {
  const qs = quarters(rows);
  if (!qs.length) return null;
  return qs[1] ?? qs[0]!;
}

export type LookBackKind = "arrived" | "left" | "came-back";

export interface LookBackLine {
  id: string;
  kind: LookBackKind;
  artist: string;
  pattern: string;
  plays: { date: string; track: string }[];
  readings: [{ template_id: string; ask: string; kept: string }, { template_id: string; ask: string; kept: string }];
}

export const LOOKBACK_READINGS: Record<LookBackKind, LookBackLine["readings"]> = {
  arrived: [
    { template_id: "lb-arrived/a", ask: "Did something new start in your life around then?", kept: "something new may have started around then" },
    { template_id: "lb-arrived/b", ask: "Or did someone bring this music to you?", kept: "someone may have brought this music to you" },
  ],
  left: [
    { template_id: "lb-left/a", ask: "Did you move on from what this music gave you?", kept: "you may have moved on from what this music gave you" },
    { template_id: "lb-left/b", ask: "Or did your routine change?", kept: "your routine changed" },
  ],
  "came-back": [
    { template_id: "lb-came-back/a", ask: "Did something bring this music back to mind?", kept: "something brought this music back to mind" },
    { template_id: "lb-came-back/b", ask: "Or did they put out something new?", kept: "they put out something new" },
  ],
};

export function lookBack(all: HistoryRow[], stretch: Quarter): LookBackLine[] {
  const rows = all.filter((r) => r.ms_played >= MIN_MS);
  const s = qIndex(stretch);
  const byArtist = new Map<string, HistoryRow[]>();
  for (const r of rows) byArtist.set(r.artist, [...(byArtist.get(r.artist) ?? []), r]);

  const inQ = (r: HistoryRow, lo: number, hi: number) => {
    const i = qIndex(quarterOf(r));
    return i >= lo && i <= hi;
  };
  const days = (rs: HistoryRow[]) => new Set(rs.map(dateOf)).size;
  const playsOf = (rs: HistoryRow[]) =>
    rs.map((r) => ({ date: dateOf(r), track: r.track })).sort((a, b) => a.date.localeCompare(b.date));
  const label = quarterPhrase(stretch);

  const arrived: LookBackLine[] = [];
  const cameBack: LookBackLine[] = [];
  const prior = new Map<string, number>();

  for (const [artist, rs] of byArtist) {
    const inStretch = rs.filter((r) => inQ(r, s, s));
    const before = rs.filter((r) => qIndex(quarterOf(r)) < s);
    const lastTwo = rs.filter((r) => inQ(r, s - 2, s - 1));
    if (lastTwo.length) prior.set(artist, lastTwo.length);
    const d = days(inStretch);
    if (d >= 3 && before.length === 0) {
      arrived.push({
        id: `arrived:${artist}`, kind: "arrived", artist,
        pattern: `${artist} arrived ${label} and stayed: you played them on ${num(d)} separate days.`,
        plays: playsOf(inStretch), readings: LOOKBACK_READINGS.arrived,
      });
    }
    if (d >= 3 && before.length > 0 && lastTwo.length === 0) {
      const lastBefore = Math.max(...before.map((r) => qIndex(quarterOf(r))));
      const away = s - lastBefore - 1;
      cameBack.push({
        id: `came-back:${artist}`, kind: "came-back", artist,
        pattern: `${artist} came back ${label} after ${num(away * 3)} months away: you played them on ${num(d)} separate days.`,
        plays: playsOf(inStretch), readings: LOOKBACK_READINGS["came-back"],
      });
    }
  }

  const top20 = [...prior.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 20);
  const left: LookBackLine[] = [];
  for (const [artist, before] of top20) {
    const inStretch = byArtist.get(artist)!.filter((r) => inQ(r, s, s));
    if (inStretch.length >= before * 0.1) continue;
    const now = inStretch.length === 0 ? "none" : `only ${inStretch.length}`;
    left.push({
      id: `left:${artist}`, kind: "left", artist,
      pattern: `${artist} dropped off: ${before} plays in the six months before, ${now} ${label}.`,
      plays: playsOf(byArtist.get(artist)!.filter((r) => inQ(r, s - 2, s))),
      readings: LOOKBACK_READINGS.left,
    });
  }

  // FR-CORE-2 at display time: an artist's name or a track title can carry any word; a line that
  // fails is not shown, and the next strongest of its kind takes its place.
  const shown = (l: LookBackLine) => lookBackBreaches(l).length === 0;
  const strongest = (ls: LookBackLine[]) => {
    const out: LookBackLine[] = [];
    for (const l of ls.sort((a, b) => b.plays.length - a.plays.length || a.artist.localeCompare(b.artist))) {
      if (out.length === PER_KIND) break;
      if (shown(l)) out.push(l);
    }
    return out;
  };
  return [...strongest(arrived), ...strongest(left), ...strongest(cameBack)];
}

/** Why a look-back line may not be shown, or [] when every sentence in it passes. */
export function lookBackBreaches(l: LookBackLine): string[] {
  const names = [l.artist, ...l.plays.map((p) => p.track)];
  return [
    ...breaches(l.pattern, "key", names),
    ...l.plays.flatMap((p) => breaches(p.track, "fact", names)),
    ...l.readings.flatMap((r) => [...breaches(r.ask, "offer"), ...breaches(r.kept, "said")]),
  ];
}

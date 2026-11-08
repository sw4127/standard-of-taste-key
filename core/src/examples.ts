/**
 * EXAMPLE DATA. Every name here is invented and was checked against MusicBrainz on 2026-11-07 (no
 * artist found). Rule 8 / R-14: shown only under an "Example" label, never as anyone's taste.
 */
import { parseKey } from "./design/key-colour";
import type { CreditRole, HistoryRow, SongFacts, Source } from "./model";
import { seeded } from "./rng";

export const EXAMPLE_SOURCE: Source = { label: "Example data (fictional)" };

const song = (
  id: string, title: string, artist: string, year: number,
  key?: [string, "major" | "minor", number], bpm?: number,
  people: { name: string; role: CreditRole }[] = [],
): SongFacts => ({
  recording_id: `example-${id}`,
  title,
  artist_credit: artist,
  lead_artist_id: `example-artist-${artist}`,
  lead_artist: artist,
  first_release_year: year,
  date_source: EXAMPLE_SOURCE,
  date_disputed: false,
  key: key ? { ...parseKey(key[0], key[1])!, strength: key[2], source: EXAMPLE_SOURCE } : undefined,
  bpm: bpm ? { value: bpm, source: EXAMPLE_SOURCE } : undefined,
  people: people.map((p) => ({ ...p, source: EXAMPLE_SOURCE })),
});

/** Ten fictional songs to name on the questions way in. */
export const EXAMPLE_CATALOGUE: SongFacts[] = [
  song("1", "Glass Harbour", "Juniper Varga", 2020, ["A#", "major", 0.78], 92, [{ name: "Kasimir Fenwold", role: "producer" }]),
  song("2", "Second Lamp", "The Quiet Lanterns", 2021, ["A#", "major", 0.66], 120, [{ name: "Odile Brannock", role: "mixer" }]),
  song("3", "Kite Weather", "Tomasz Ilunga", 2019, ["G", "major", 0.71], 96, [{ name: "Kasimir Fenwold", role: "producer" }]),
  song("4", "The Long Stair", "Marisol Achterberg", 2020, ["A#", "major", 0.59], 184),
  song("5", "Copper Rain", "The Copper Orchard", 2014, ["D", "minor", 0.62], 140),
  song("6", "Small Hours Again", "Teodor Lumikki", 2021, ["F", "major", 0.55], 101, [{ name: "Odile Brannock", role: "mixer" }]),
  song("7", "Paper Bridge", "Ines Calloway", 2022),
  song("8", "Lantern Year", "Nell Okonkwo-Farr", 2023),
  song("9", "Saltwind", "Ottilie Sand", 2008, ["A", "minor", 0.48], 76),
  song("10", "Ninefold Morning", "The Linden Hours", 2017, ["E", "major", 0.81], 128),
];

/** T9.1's search, over the example catalogue only: up to five songs whose title or artist matches. */
export function searchExamples(text: string): SongFacts[] {
  const t = text.trim().toLowerCase();
  if (!t) return [];
  return EXAMPLE_CATALOGUE.filter((s) => s.title.toLowerCase().includes(t) || s.artist_credit.toLowerCase().includes(t)).slice(0, 5);
}

/**
 * A fictional Spotify history, 2025-01 to 2026-10, built so each kind of look-back line has something
 * to find in July–September 2026: one artist arrives, one leaves, one comes back, others stay steady.
 */
export function exampleHistory(): HistoryRow[] {
  const rnd = seeded(7);
  const rows: HistoryRow[] = [];
  const add = (artist: string, track: string, from: string, to: string, perWeek: number) => {
    const start = new Date(`${from}T00:00:00Z`).getTime(), end = new Date(`${to}T00:00:00Z`).getTime();
    for (let t = start; t < end; t += 86_400_000) {
      if (rnd() > perWeek / 7) continue;
      const d = new Date(t + Math.floor(rnd() * 86_400_000));
      const iso = d.toISOString().slice(0, 19);
      rows.push({
        history_id: `ex-${rows.length}`, person_id: "example", ended_at_utc: `${iso}Z`, local_time: iso, country: "GB",
        track_uri: `example:${track}`, track, artist, album: `${track} (example)`, ms_played: rnd() < 0.15 ? 12_000 : 180_000,
      });
    }
  };
  add("Juniper Varga", "Glass Harbour", "2025-01-01", "2026-10-20", 4); // steady throughout
  add("The Quiet Lanterns", "Second Lamp", "2025-01-01", "2026-10-20", 2); // steady throughout
  add("Halvard Mire", "Northern Stair", "2026-01-01", "2026-07-01", 6); // played hard, then left
  add("Aurelio Tamm", "Low Bell", "2026-07-08", "2026-10-20", 3); // arrives in July 2026 and stays
  add("Ottilie Sand", "Saltwind", "2025-01-01", "2025-09-30", 3); // away for a year…
  add("Ottilie Sand", "Saltwind", "2026-07-15", "2026-10-20", 2); // …and back
  add("Bruno Kettleby", "Rope Bridge", "2025-03-01", "2025-05-01", 1);
  return rows.sort((a, b) => a.local_time.localeCompare(b.local_time));
}

/** The panel's example song card: a fictional video, and a fictional friend's counts for its artist. */
export const EXAMPLE_PANEL_SONG = EXAMPLE_CATALOGUE[0]!;
export const EXAMPLE_FRIEND = {
  label: "your friend (example)",
  artistPlays: 214,
  record: { title: "Harbour Lights", plays: 131, quarter: "April to June 2025" },
  topSongs: [
    { title: "Glass Harbour", plays: 58 },
    { title: "Weather Vane", plays: 33 },
    { title: "Pilot Light", plays: 21 },
  ],
};

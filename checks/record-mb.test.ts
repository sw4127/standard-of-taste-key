/**
 * Records MusicBrainz's replies to every search FR-CORE-1 sends for the match fixtures, trimmed to
 * the fields the rule reads, into core/src/match/fixtures-mb.json (MusicBrainz data, CC0), so the
 * rule's test replays them offline. Run when the rule's searches change:
 *   RECORD=1 npx vitest run checks/record-mb.test.ts
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { it } from "vitest";
import { MATCH_FIXTURES } from "../core/src/match/fixtures";
import { parseTitle } from "../core/src/match/parse";
import { normalise, type MbRecording } from "../core/src/match/studio";
import { stripNotes } from "../core/src/match/parse";
import { searchesFor } from "../core/src/match/v6";
import { Gate, getJson } from "../core/src/sources/http";
import { MB } from "../core/src/sources/musicbrainz";

const fetchFn = (u: string) => fetch(u, { headers: { "User-Agent": "StandardOfTaste-TheKey/0.1 (private prototype; fixture recording)" } });

/** Keep what the rule reads; a recording whose title can never be a candidate keeps one release. */
function trim(r: MbRecording, tracks: string[]): MbRecording {
  const maybe = tracks.includes(normalise(stripNotes(r.title)));
  return {
    id: r.id, score: r.score, title: r.title, disambiguation: r.disambiguation || undefined, "first-release-date": r["first-release-date"],
    "artist-credit": (r["artist-credit"] ?? []).map((a) => ({ name: a.name, joinphrase: a.joinphrase || undefined, artist: { id: a.artist.id, name: a.artist.name } })),
    releases: (r.releases ?? []).slice(0, maybe ? undefined : 1).map((x) => ({
      id: x.id, title: (x as { title?: string }).title, status: x.status, date: x.date,
      "release-group": x["release-group"] && { id: x["release-group"].id, "primary-type": x["release-group"]["primary-type"], "secondary-types": x["release-group"]["secondary-types"]?.length ? x["release-group"]["secondary-types"] : undefined },
    })) as MbRecording["releases"],
  };
}

it.skipIf(!process.env.RECORD)("record MusicBrainz replies for the match fixtures", async () => {
  const gate = new Gate(1300);
  // Keep the replies already recorded; fetch only searches the rule now sends that are missing.
  const file = join(__dirname, "..", "core", "src", "match", "fixtures-mb.json");
  const out: Record<string, MbRecording[]> = existsSync(file) && !process.env.FRESH ? JSON.parse(readFileSync(file, "utf8")) : {};
  let skipped = 0;
  const get = async (q: string, tracks: string[]) => {
    if (out[q]) return out[q]!;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const body = (await getJson(`${MB}/recording?query=${encodeURIComponent(q)}&limit=50&fmt=json`, gate, fetchFn)) as { recordings?: MbRecording[] };
        out[q] = (body.recordings ?? []).map((r) => trim(r, tracks));
        writeFileSync(file, JSON.stringify(out)); // saved as it goes: a rerun continues from here
        return out[q]!;
      } catch {
        await new Promise((r) => setTimeout(r, 15_000)); // MusicBrainz busy: wait, then try again
      }
    }
    skipped++;
    return [];
  };
  let n = 0;
  for (const f of MATCH_FIXTURES) {
    const p = parseTitle(f.title);
    const tracks = p.queries.map((q) => normalise(q.track));
    const { withArtist, trackOnly } = searchesFor(p);
    let found = 0;
    for (const q of withArtist) found += (await get(q, tracks)).length;
    if (!found) for (const q of trackOnly) await get(q, tracks);
    if (++n % 20 === 0) console.log(`${n} of ${MATCH_FIXTURES.length}`);
  }
  writeFileSync(file, JSON.stringify(out));
  console.log(`${Object.keys(out).length} searches recorded; ${skipped} still missing (run again)`);
}, 3_600_000);

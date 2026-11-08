/**
 * A live run against MusicBrainz and AcousticBrainz (FR-CORE-3), skipped unless LIVE=1:
 *   LIVE=1 npx vitest run checks/live-sources.test.ts
 * It tells whether the services still answer the way the code expects. Never part of `npm test`'s verdict.
 */
import { describe, expect, it } from "vitest";
import { confirmSong } from "../core/src/sources/confirm";
import type { FetchFn } from "../core/src/sources/http";
import { searchSongs } from "../core/src/sources/musicbrainz";

const live = !!process.env.LIVE;
const fetchFn: FetchFn = (u) => fetch(u, { headers: { "User-Agent": "StandardOfTaste-TheKey/0.1 (private prototype)" } });

describe.skipIf(!live)("live sources", () => {
  for (const typed of ["晴天 周杰伦", "Bohemian Rhapsody Queen", "Dancing Queen ABBA", "bohemian rhapsody", "yesterday beatles", "说好不哭"]) {
    it(`finds and confirms "${typed}"`, async () => {
      const found = await searchSongs(typed, { fetchFn });
      console.log(typed, "→", found.map((c) => `${c.title} · ${c.artist_credit} · ${c.year} (${c.recording_ids.length} recordings)`));
      expect(found.length).toBeGreaterThan(0);
      const r = await confirmSong(found[0]!, typed, { fetchFn });
      if (!("facts" in r)) throw new Error(r.error);
      const f = r.facts;
      console.log(" chosen", f.recording_id, f.first_release_year, f.key ? `${f.key.pitch}/${f.key.mode} ${f.key.strength.toFixed(2)}` : "no key", f.bpm?.value.toFixed(0) ?? "no bpm", f.people.map((p) => `${p.role}:${p.name}`).join(", "));
      expect(f.date_source.url).toMatch(/musicbrainz\.org\/recording\//);
    }, 60_000);
  }
});

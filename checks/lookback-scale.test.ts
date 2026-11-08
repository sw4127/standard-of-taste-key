/**
 * Scale check for T5.7 (moment map L-1 "about 1–2 s"): a synthetic export of 90,000 plays by invented
 * artists, read and looked back over. Skipped unless SCALE=1; never part of `npm test`'s verdict.
 *   SCALE=1 npx vitest run checks/lookback-scale.test.ts
 */
import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { defaultStretch, lookBack } from "../core/src/lookback";
import { readExport } from "../core/src/spotify";

describe.skipIf(!process.env.SCALE)("a 90,000-play export", () => {
  it("is read and looked back over in a couple of seconds", () => {
    let seed = 1;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    const files: Record<string, Uint8Array> = {};
    const start = Date.parse("2023-01-01T00:00:00Z");
    for (let f = 0; f < 6; f++) {
      const plays = Array.from({ length: 15_000 }, (_, i) => {
        const a = Math.floor(rnd() ** 2 * 400);
        return {
          ts: new Date(start + (f * 15_000 + i) * 1_100_000).toISOString().replace(/\.\d+Z$/, "Z"), ms_played: rnd() < 0.2 ? 9000 : 200_000,
          conn_country: rnd() < 0.9 ? "GB" : "ES", ip_addr: "198.51.100.1", master_metadata_track_name: `Track ${a}-${Math.floor(rnd() * 12)}`,
          master_metadata_album_artist_name: `Invented Artist ${a}`, master_metadata_album_album_name: "Album", spotify_track_uri: `spotify:track:${a}`,
        };
      });
      files[`Spotify Extended Streaming History/Streaming_History_Audio_${f}.json`] = strToU8(JSON.stringify(plays));
    }
    const zip = zipSync(files);
    const t0 = performance.now();
    const r = readExport("big.zip", zip, "me");
    const t1 = performance.now();
    const lines = lookBack(r.rows, defaultStretch(r.rows)!);
    const t2 = performance.now();
    console.log(`zip ${(zip.length / 1e6).toFixed(1)} MB · ${r.rows.length} plays · read ${Math.round(t1 - t0)} ms · look back ${Math.round(t2 - t1)} ms · ${lines.length} lines`);
    expect(r.rows).toHaveLength(90_000);
    expect(t1 - t0 + (t2 - t1)).toBeLessThan(5000);
  }, 60_000);
});

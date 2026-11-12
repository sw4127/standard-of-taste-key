/**
 * Records MusicBrainz's replies to every search FR-CORE-1 sends for the match fixtures, trimmed to
 * the fields the rule reads, so the rule's test replays them offline (MusicBrainz data, CC0):
 *   core/src/match/fixtures-mb.json     the searches of version 6.3 (50 results each)
 *   core/src/match/fixtures-mb-v7.json  the searches version 7 adds (official releases, 100 results each)
 * Run when the rule's searches change. Replies already recorded are kept; only missing ones are fetched.
 *   RECORD=1 npx vitest run checks/record-mb.test.ts
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { it } from "vitest";
import { MATCH_FIXTURES } from "../core/src/match/fixtures";
import { parseTitle, stripNotes } from "../core/src/match/parse";
import { normalise, type MbRecording } from "../core/src/match/studio";
import { matchTitle, readBook, sameTitle, stands, trackForms } from "../core/src/match/v7";
import { Gate } from "../core/src/sources/http";

const live = (u: string) => fetch(u, { headers: { "User-Agent": "StandardOfTaste-TheKey/0.1 (private prototype; fixture recording)" } });
const dir = join(__dirname, "..", "core", "src", "match");
const FILES = { "50": join(dir, "fixtures-mb.json"), "100": join(dir, "fixtures-mb-v7.json") } as const;

/** Keep what the rule reads; a recording whose title can never be a candidate keeps one release. */
function trim(r: MbRecording, title: string): MbRecording {
  const p = parseTitle(title);
  const book = readBook(title);
  const tracks = p.queries.map((q) => normalise(q.track));
  const maybe = tracks.includes(normalise(stripNotes(r.title))) || (!!book && sameTitle(r.title, trackForms(book.track)));
  return {
    id: r.id, score: r.score, title: r.title, disambiguation: r.disambiguation || undefined, "first-release-date": r["first-release-date"], length: r.length ?? undefined,
    "artist-credit": (r["artist-credit"] ?? []).map((a) => {
      // Only the aliases that stand in this title are kept: the rule reads no others.
      const aliases = (a.artist.aliases ?? []).filter((x) => stands(x.name, title)).map((x) => ({ name: x.name }));
      return { name: a.name, joinphrase: a.joinphrase || undefined, artist: { id: a.artist.id, name: a.artist.name, ...(aliases.length ? { aliases } : {}) } };
    }),
    releases: (r.releases ?? []).slice(0, maybe ? undefined : 1).map((x) => ({
      id: x.id, title: (x as { title?: string }).title, status: x.status, date: x.date,
      "release-group": x["release-group"] && { id: x["release-group"].id, "primary-type": x["release-group"]["primary-type"], "secondary-types": x["release-group"]["secondary-types"]?.length ? x["release-group"]["secondary-types"] : undefined },
    })) as MbRecording["releases"],
  };
}

it.skipIf(!process.env.RECORD)("record MusicBrainz replies for the match fixtures", async () => {
  const gate = new Gate(1300);
  const out = Object.fromEntries(
    Object.entries(FILES).map(([limit, file]) => [limit, existsSync(file) && !process.env.FRESH ? (JSON.parse(readFileSync(file, "utf8")) as Record<string, MbRecording[]>) : {}]),
  ) as Record<"50" | "100", Record<string, MbRecording[]>>;
  let fetched = 0;
  let skipped = 0;
  let n = 0;
  for (const f of MATCH_FIXTURES) {
    // The rule itself decides which searches are sent; this stand-in answers from the files and fetches what is missing.
    const fetchFn = async (url: string) => {
      const u = new URL(url);
      const q = u.searchParams.get("query")!;
      const limit = u.searchParams.get("limit") as "50" | "100";
      if (!out[limit][q]) {
        let saved = false;
        for (let attempt = 0; attempt < 4 && !saved; attempt++) {
          try {
            await gate.wait();
            const res = await live(url);
            if (!res.ok) throw new Error(String(res.status));
            const body = (await res.json()) as { recordings?: MbRecording[] };
            out[limit][q] = (body.recordings ?? []).map((r) => trim(r, f.title));
            writeFileSync(FILES[limit], JSON.stringify(out[limit])); // saved as it goes: a rerun continues from here
            fetched++;
            saved = true;
          } catch {
            await new Promise((r) => setTimeout(r, 15_000)); // MusicBrainz busy: wait, then try again
          }
        }
        if (!saved) {
          skipped++;
          return { ok: true, status: 200, json: async () => ({ recordings: [] }) };
        }
      }
      return { ok: true, status: 200, json: async () => ({ recordings: out[limit][q] }) };
    };
    await matchTitle(f.title, { fetchFn, gate: new Gate(0) });
    if (++n % 20 === 0) console.log(`${n} of ${MATCH_FIXTURES.length}`);
  }
  for (const [limit, file] of Object.entries(FILES)) writeFileSync(file, JSON.stringify(out[limit as "50" | "100"]));
  writeFileSync(join(__dirname, "record-mb.out.txt"), `${Object.keys(out["50"]).length} + ${Object.keys(out["100"]).length} searches on file; ${fetched} fetched now; ${skipped} still missing (run again)\n`);
}, 7_200_000);

/** FR-T1.4's typed search, for the four videos Bob could not fix: what a person would type, and MusicBrainz's reply. */
export const TYPED = ["Heat Waves Glass Animals", "Yellow Coldplay", "Sunflower Post Malone", "Blinding Lights The Weeknd"];

it.skipIf(!process.env.RECORD_TYPED)("record MusicBrainz replies for Fix's typed search", async () => {
  const { typedUrl } = await import("../core/src/match/fix");
  const file = join(dir, "fixtures-mb-typed.json");
  const out: Record<string, MbRecording[]> = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
  const gate = new Gate(1300);
  for (const typed of TYPED) {
    if (out[typed]) continue;
    await gate.wait();
    const res = await live(typedUrl(typed));
    const body = (await res.json()) as { recordings?: MbRecording[] };
    out[typed] = (body.recordings ?? []).slice(0, 25).map((r) => ({
      id: r.id, score: r.score, title: r.title, disambiguation: r.disambiguation || undefined, "first-release-date": r["first-release-date"], length: r.length ?? undefined,
      "artist-credit": (r["artist-credit"] ?? []).map((a) => ({ name: a.name, joinphrase: a.joinphrase || undefined, artist: { id: a.artist.id, name: a.artist.name } })),
      // Twelve releases at most, the plain studio ones first and earliest first, so the trimmed reply still shows what the recording is.
      releases: [...(r.releases ?? [])]
        .sort((x, y) => Number(!!y["release-group"] && !(y["release-group"]["secondary-types"] ?? []).length && y.status === "Official") - Number(!!x["release-group"] && !(x["release-group"]["secondary-types"] ?? []).length && x.status === "Official") || (x.date || "9999").localeCompare(y.date || "9999"))
        .slice(0, 12)
        .map((x) => ({
        id: x.id, title: (x as { title?: string }).title, status: x.status, date: x.date,
        "release-group": x["release-group"] && { id: x["release-group"].id, "primary-type": x["release-group"]["primary-type"], "secondary-types": x["release-group"]["secondary-types"]?.length ? x["release-group"]["secondary-types"] : undefined },
      })) as MbRecording["releases"],
    }));
    writeFileSync(file, JSON.stringify(out));
  }
}, 600_000);

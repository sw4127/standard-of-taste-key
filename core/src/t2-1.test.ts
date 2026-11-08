/** T2.1 On a certain match, credits and facts are fetched, each with its source and licence (FR-T2.1). */
import { describe, expect, it } from "vitest";
import { toRows } from "./storage";
import { Gate, type Clock, type FetchFn } from "./sources/http";
import { recordingFacts } from "./sources/recording";

const clock = (): Clock => {
  let t = 0;
  return { now: () => t, sleep: async (ms) => void (t += ms) };
};
const json = (body: unknown, status = 200) => ({ ok: status === 200, status, json: async () => body });
const candidate = { recording_id: "rec1", title: "Glass Harbour", artist_credit: "Juniper Varga", first_release: "2020-03-01", lead: { id: "art-jv", name: "Juniper Varga" } };

describe("the recording's facts", () => {
  it("credits with what was played, places with dates, first release, tempo and key, each with a page", async () => {
    const c = clock();
    const fetchFn: FetchFn = async (u) => {
      if (u.includes("acousticbrainz")) return json({ rec1: { "0": { rhythm: { bpm: 92 }, tonal: { key_key: "A#", key_scale: "major", key_strength: 0.8 } } } });
      return json({
        id: "rec1", title: "Glass Harbour", "first-release-date": "2020-03-01",
        releases: [{ id: "r", status: "Official", date: "2020-03-01", "release-group": { id: "g", "primary-type": "Album" } }],
        relations: [
          { type: "instrument", "target-type": "artist", attributes: ["guitar"], artist: { id: "a1", name: "Pell Arnaut" } },
          { type: "vocal", "target-type": "artist", attributes: ["lead vocals"], artist: { id: "a2", name: "Juniper Varga" } },
          { type: "mix", "target-type": "artist", artist: { id: "a3", name: "Odile Brannock" } },
          { type: "recorded at", "target-type": "place", begin: "2019-06", end: "2019-07", place: { id: "pl1", name: "Example Studio" } },
        ],
      });
    };
    const f = await recordingFacts(candidate, { fetchFn, mbGate: new Gate(1200, c), abGate: new Gate(1000, c), clock: c, cache: new Map() });
    expect(f.people.map((p) => `${p.role}:${p.name}:${p.detail ?? ""}`)).toEqual(["performer:Pell Arnaut:guitar", "performer:Juniper Varga:lead vocals", "mixer:Odile Brannock:"]);
    expect(f.places).toEqual([{ name: "Example Studio", role: "recorded at", date: "2019-06 to 2019-07", source: { label: "MusicBrainz", url: "https://musicbrainz.org/place/pl1" } }]);
    expect(f.first_release_year).toBe(2020);
    expect(f.key?.source.url).toBe("https://acousticbrainz.org/rec1");
    // Stored as D3 rows: every fact keeps its source URL and its licence.
    const { facts } = toRows(f, "rule", "2026-11-08T10:00:00Z");
    expect(facts.length).toBeGreaterThanOrEqual(6);
    for (const r of facts) {
      expect(r.source_url).toMatch(/^https:\/\/(musicbrainz|acousticbrainz)\.org\//);
      expect(r.licence).toBe("CC0");
    }
  });
  it("if MusicBrainz does not answer, the match stands with no credits", async () => {
    const c = clock();
    const f = await recordingFacts(candidate, { fetchFn: async () => json(null, 500), mbGate: new Gate(1200, c), abGate: new Gate(1000, c), clock: c, cache: new Map() });
    expect(f.recording_id).toBe("rec1");
    expect(f.people).toEqual([]);
  });
});

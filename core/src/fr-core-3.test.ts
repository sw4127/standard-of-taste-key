/** FR-CORE-3 Facts from outside sources: polite fetching, only four AcousticBrainz fields, every fact with its source. */
import { describe, expect, it } from "vitest";
import { measure, readLowLevel } from "./sources/acousticbrainz";
import { confirmSong } from "./sources/confirm";
import { Gate, getJson, type Clock, type FetchFn } from "./sources/http";
import type { Candidate } from "./sources/musicbrainz";
import { peopleOf } from "./sources/musicbrainz";

/** A clock that only moves when someone sleeps, recording when each call went out. */
function fakeClock() {
  let t = 0;
  const clock: Clock = { now: () => t, sleep: async (ms) => void (t += ms) };
  return { clock, at: () => t };
}

const json = (body: unknown, status = 200) => ({ ok: status === 200, status, json: async () => body });

describe("polite fetching", () => {
  it("never sends two MusicBrainz calls less than 1.2 s apart", async () => {
    const { clock, at } = fakeClock();
    const gate = new Gate(1200, clock);
    const times: number[] = [];
    const fetchFn: FetchFn = async () => (times.push(at()), json({}));
    await Promise.all([1, 2, 3].map((i) => getJson(`u${i}`, gate, fetchFn, clock)));
    expect(times).toEqual([0, 1200, 2400]);
  });
  it("retries with back-off on HTTP 503, then gives up with an error", async () => {
    const { clock } = fakeClock();
    let n = 0;
    const flaky: FetchFn = async () => (++n < 3 ? json(null, 503) : json({ ok: 1 }));
    expect(await getJson("x", new Gate(1200, clock), flaky, clock)).toEqual({ ok: 1 });
    const down: FetchFn = async () => json(null, 503);
    await expect(getJson("y", new Gate(1200, clock), down, clock)).rejects.toThrow(/503/);
  });
});

describe("AcousticBrainz: tempo and key only", () => {
  const doc = {
    "0": {
      rhythm: { bpm: 92.4, danceability: 1.2 },
      tonal: { key_key: "A#", key_scale: "major", key_strength: 0.78, chords_key: "F" },
      highlevel: { mood_sad: { value: "sad", probability: 0.9 }, genre_rosamerica: { value: "pop" } },
      mood_happy: { value: "happy" },
    },
  };
  it("a response with mood and genre classifier fields: none of them reaches a fact", () => {
    const m = readLowLevel("r1", doc)!;
    expect(Object.keys(m).sort()).toEqual(["bpm", "key", "recording_id", "source"]);
    expect(Object.keys(m.key!).sort()).toEqual(["mode", "pitch", "strength"]);
    expect(JSON.stringify(m)).not.toMatch(/mood|genre|sad|happy|pop|dance/i);
    expect(m.source.url).toBe("https://acousticbrainz.org/r1");
  });
  it("asks for the four fields by name, never the high-level endpoint", async () => {
    const urls: string[] = [];
    const { clock } = fakeClock();
    await measure(["r1"], { fetchFn: async (u) => (urls.push(u), json({ r1: doc })), gate: new Gate(1000, clock), clock });
    expect(urls[0]).toMatch(/\/low-level\?recording_ids=r1&features=rhythm\.bpm;tonal\.key_key;tonal\.key_scale;tonal\.key_strength$/);
    expect(urls.join()).not.toMatch(/high-level/);
  });
  it("uses a sibling recording when the chosen one was never measured, and cites the sibling", async () => {
    const { clock } = fakeClock();
    const m = await measure(["r0", "r1"], { fetchFn: async () => json({ r1: doc }), gate: new Gate(1000, clock), clock });
    expect(m?.recording_id).toBe("r1");
  });
  it("if AcousticBrainz does not answer, there is no tempo and no key, and nothing breaks", async () => {
    const { clock } = fakeClock();
    expect(await measure(["r1"], { fetchFn: async () => { throw new Error("offline"); }, gate: new Gate(1000, clock), clock })).toBeNull();
    expect(await measure(["r1"], { fetchFn: async () => json(null, 500), gate: new Gate(1000, clock), clock })).toBeNull();
  });
});

describe("MusicBrainz credits", () => {
  it("maps relationship types to roles, writers from the work, each with its page", () => {
    const people = peopleOf({
      id: "rec1",
      title: "Glass Harbour",
      relations: [
        { type: "producer", "target-type": "artist", artist: { id: "a1", name: "Kasimir Fenwold" } },
        { type: "mix", "target-type": "artist", artist: { id: "a2", name: "Odile Brannock" } },
        { type: "engineer", "target-type": "artist", artist: { id: "a3", name: "Pell Arnaut" } },
        { type: "performance", "target-type": "work", work: { id: "w1", title: "Glass Harbour", relations: [{ type: "composer", "target-type": "artist", artist: { id: "a4", name: "Juniper Varga" } }] } },
      ],
    });
    expect(people.map((p) => `${p.role}:${p.name}`)).toEqual(["producer:Kasimir Fenwold", "mixer:Odile Brannock", "writer:Juniper Varga"]);
    expect(people[0]!.source.url).toBe("https://musicbrainz.org/recording/rec1");
    expect(people[2]!.source.url).toBe("https://musicbrainz.org/work/w1");
  });
});

describe("confirming a song gathers its facts, each with a source", () => {
  const rel = (id: string, primary: string, date: string, secondary: string[] = []) => ({ id: `rel-${id}`, status: "Official", date, "release-group": { id: `rg-${id}`, "primary-type": primary, "secondary-types": secondary } });
  const credit = [{ name: "Juniper Varga", artist: { id: "art-jv", name: "Juniper Varga" } }];
  const studio = { id: "rec-studio", title: "Glass Harbour", "artist-credit": credit, releases: [rel("a", "Album", "2020-03-01")] };
  const live = { id: "rec-live", title: "Glass Harbour (Live)", "artist-credit": credit, releases: [rel("b", "Album", "2019-01-01", ["Live"])] };
  const later = { id: "rec-later", title: "Glass Harbour", "artist-credit": credit, releases: [rel("c", "Album", "2023-05-05", ["Compilation"]), rel("d", "Single", "2021-02-02")] };
  const candidate: Candidate = { key: "k", title: "Glass Harbour", artist_credit: "Juniper Varga", lead_artist_id: "art-jv", lead_artist: "Juniper Varga", year: 2020, recording_ids: ["rec-later"], recordings: [later] };

  it("chooses the earliest studio recording, takes its year, and cites MusicBrainz and AcousticBrainz", async () => {
    const { clock } = fakeClock();
    const fetchFn: FetchFn = async (u) => {
      if (u.includes("/recording?query=")) return json({ recordings: [later, live, studio] });
      if (u.includes("/recording/rec-studio")) return json({ ...studio, relations: [{ type: "producer", "target-type": "artist", artist: { id: "a1", name: "Kasimir Fenwold" } }] });
      if (u.includes("acousticbrainz")) return json({ "rec-later": { "0": { rhythm: { bpm: 92 }, tonal: { key_key: "A#", key_scale: "major", key_strength: 0.8 } } } });
      return json(null, 404);
    };
    const r = await confirmSong(candidate, "glass harbour", { fetchFn, mbGate: new Gate(1200, clock), abGate: new Gate(1000, clock), clock, cache: new Map() });
    if (!("facts" in r)) throw new Error("expected facts");
    expect(r.matched_by).toBe("rule");
    expect(r.facts.recording_id).toBe("rec-studio");
    expect(r.facts.first_release_year).toBe(2020);
    expect(r.facts.date_source.url).toBe("https://musicbrainz.org/recording/rec-studio");
    expect(r.facts.key?.source.url).toBe("https://acousticbrainz.org/rec-later");
    expect(r.facts.bpm?.value).toBe(92);
    for (const p of r.facts.people) expect(p.source.url).toMatch(/^https:\/\/musicbrainz\.org\//);
  });
  it("with AcousticBrainz down the song still arrives, with no key and no tempo", async () => {
    const { clock } = fakeClock();
    const fetchFn: FetchFn = async (u) => {
      if (u.includes("acousticbrainz")) throw new Error("gone");
      if (u.includes("/recording?query=")) return json({ recordings: [studio] });
      return json(studio);
    };
    const r = await confirmSong(candidate, "glass harbour", { fetchFn, mbGate: new Gate(1200, clock), abGate: new Gate(1000, clock), clock, cache: new Map() });
    if (!("facts" in r)) throw new Error("expected facts");
    expect(r.facts.key).toBeUndefined();
    expect(r.facts.bpm).toBeUndefined();
  });
});

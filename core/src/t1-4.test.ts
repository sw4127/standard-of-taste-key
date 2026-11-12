/**
 * T1.4 Fix (FR-T1.4, as replaced by the Amendments of 2026-11-10): the studio original by the artist
 * read from the title comes first, every row says what it is in plain words, and a pick holds for
 * every later play of the same video. The MusicBrainz answers are stored ones (CC0), replayed offline.
 */
import { describe, expect, it } from "vitest";
import { earlierFix, viewingFor } from "../ui/NowPlaying";
import { firstRelease, fixFor, fixList, fixTyped, kindOf, mmss, typedList, FIX_ROWS, type FixList } from "./match/fix";
import MB_V6 from "./match/fixtures-mb.json";
import MB_TYPED from "./match/fixtures-mb-typed.json";
import MB_V7 from "./match/fixtures-mb-v7.json";
import type { MbRecording } from "./match/studio";
import type { PlayRow } from "./model";
import { Gate } from "./sources/http";
import { songQuery } from "./sources/musicbrainz";

// ---- Stored MusicBrainz answers -------------------------------------------------------------------

const FILES: Record<string, Record<string, MbRecording[]>> = { "100": MB_V7 as never, "50": MB_V6 as never };
const typedByQuery = Object.fromEntries(Object.entries(MB_TYPED as unknown as Record<string, MbRecording[]>).map(([typed, rs]) => [songQuery(typed), rs]));
const asked: string[] = [];
const stored = async (url: string) => {
  const u = new URL(url);
  const q = u.searchParams.get("query")!;
  asked.push(q);
  const reply = typedByQuery[q] ?? FILES[u.searchParams.get("limit")!]?.[q];
  if (!reply) throw new Error(`no stored MusicBrainz answer for: ${q}`);
  return { ok: true, status: 200, json: async () => ({ recordings: reply }) };
};
const deps = { fetchFn: stored, gate: new Gate(0) };

const FOUR = [
  { title: "百万级装备听《Heat Waves》- Glass Animals【Hi-Res】", original: "9f61e4a7", typed: "Heat Waves Glass Animals", seconds: 239 },
  { title: "百万级装备听《Yellow》- Coldplay【Hi-Res】", original: "729cf505", typed: "Yellow Coldplay", seconds: 269 },
  { title: "百万级装备听《Sunflower》- Post Malone，Swae Lee【Hi-Res】", original: "b6df9d04", typed: "Sunflower Post Malone", seconds: 158 },
  { title: "用百万级豪华装备试听The Weeknd《Blinding Lights》【Hi-Res】", original: "1a67e215", typed: "Blinding Lights The Weeknd", seconds: 200 },
];

describe("acceptance: Bob's four videos, with matching switched off", () => {
  for (const v of FOUR) {
    it(`${v.typed}: the studio original is the first row, labelled as the original`, async () => {
      const list = await fixFor(v.title, deps, v.seconds);
      expect(list.heading).toBeUndefined();
      expect(list.rows.length).toBeGreaterThan(0);
      expect(list.rows.length).toBeLessThanOrEqual(FIX_ROWS);
      const first = list.rows[0]!;
      expect(first.candidate.recording_id.slice(0, 8)).toBe(v.original);
      expect(first.label).toBe("Studio recording · the original");
      // Only one row is the original, and every row says what it is.
      expect(list.rows.filter((r) => r.kind === "original")).toHaveLength(1);
      for (const r of list.rows) expect(r.label.length).toBeGreaterThan(3);
    });
    it(`${v.typed}: one typed search reaches the studio original too`, async () => {
      const rows = await fixTyped(v.typed, deps, v.seconds);
      const at = rows.findIndex((r) => r.candidate.recording_id.startsWith(v.original));
      expect(at).toBeGreaterThanOrEqual(0);
      expect(rows[at]!.label).toBe("Studio recording · the original");
    });
  }
  it("every row shows title, artist, first release date, record and length; a missing fact is said, never left blank", async () => {
    for (const v of FOUR) {
      for (const r of (await fixFor(v.title, deps)).rows) {
        expect(r.facts).toHaveLength(5);
        for (const fact of r.facts) expect(fact.trim().length, `${v.typed}: ${r.facts.join(" | ")}`).toBeGreaterThan(0);
        expect(r.facts[4]).toMatch(/^\d+:\d\d$|^no length on MusicBrainz$/);
        expect(r.facts[2]).toMatch(/^\d{4}|^no release date on MusicBrainz$/);
      }
    }
  });
  it("the row within 5 seconds of the video's length is marked; without the video's length none is", async () => {
    const heat = await fixFor(FOUR[0]!.title, deps, 239);
    expect(heat.rows[0]!.sameLength).toBe(true);
    expect(heat.rows[0]!.facts[4]).toBe("3:59");
    expect(heat.rows.filter((r) => r.sameLength).length).toBeLessThan(heat.rows.length);
    expect((await fixFor(FOUR[0]!.title, deps)).rows.some((r) => r.sameLength)).toBe(false);
  });
  it("nothing is asked of MusicBrainz that the matching rule would not ask", () => {
    for (const q of asked) expect(q).toMatch(/^recording:"|^\(recording:"/);
  });
});

describe("a DJ-mix excerpt, a live take and another artist's song are each labelled as such (stored MusicBrainz answers)", () => {
  const all = (title: string) => Object.values(MB_V7 as unknown as Record<string, MbRecording[]>).flat().filter((r) => r.title === title);
  it("the DJ-mix excerpt Bob picked for Heat Waves in Stage 9 reads 'DJ-mix excerpt', and comes after the original", async () => {
    const mix = all("Heat Waves").find((r) => r.id.startsWith("df39979f"))!;
    expect(mix.disambiguation).toMatch(/DJ.mix/);
    expect(kindOf(mix).kind).toBe("dj-mix");
    const list = fixList(all("Heat Waves"), { byReadArtist: () => true });
    const at = (id: string) => list.rows.findIndex((r) => r.candidate.recording_id.startsWith(id));
    expect(list.rows[0]!.candidate.recording_id.slice(0, 8)).toBe("9f61e4a7");
    if (at("df39979f") >= 0) expect(list.rows[at("df39979f")]!.label).toBe("DJ-mix excerpt");
  });
  it("a live take of Yellow reads 'Live · place, date', from MusicBrainz's own note", () => {
    const lives = all("Yellow").filter((r) => /^live/.test(r.disambiguation ?? ""));
    expect(lives.length).toBeGreaterThan(3);
    for (const r of lives) expect(kindOf(r).kind).toBe("live");
    const hollywood = lives.find((r) => /Hollywood Bowl/.test(r.disambiguation!))!;
    expect(fixList([hollywood], { byReadArtist: () => true }).rows[0]!.label).toBe("Live · 2003-05-31: Hollywood Bowl, Los Angeles, California, US");
  });
  it("another artist's song of the same title appears only under its own heading, and is never called the original", () => {
    const sunflowers = all("Sunflower (Spider-Man: Into the Spider-Verse)");
    expect(sunflowers.length).toBeGreaterThan(0);
    const nobodyRead = fixList(sunflowers, { byReadArtist: () => false });
    expect(nobodyRead.heading).toBe("Same title, other artists");
    expect(nobodyRead.rows.some((r) => r.kind === "original")).toBe(false);
    // When the read artist has a recording, other artists' songs are not listed at all.
    const other: MbRecording = { id: "other", title: "Sunflower", score: 100, "artist-credit": [{ name: "Example Other Act", artist: { id: "x", name: "Example Other Act" } }], releases: [{ id: "r", status: "Official", date: "1995", "release-group": { id: "g", "primary-type": "Album" } }] };
    const mixed = fixList([...sunflowers, other], { byReadArtist: (r) => r.id !== "other" });
    expect(mixed.heading).toBeUndefined();
    expect(mixed.rows.some((r) => r.candidate.recording_id === "other")).toBe(false);
  });
});

describe("what a recording is, in plain words", () => {
  const rg = (primary: string, secondary?: string[]) => ({ id: `g-${primary}-${secondary}`, "primary-type": primary, "secondary-types": secondary });
  const rec = (over: Partial<MbRecording>): MbRecording => ({ id: "r", title: "Glass Harbour", score: 100, "artist-credit": [{ name: "Juniper Varga", artist: { id: "jv", name: "Juniper Varga" } }], releases: [{ id: "x", status: "Official", date: "2020-06-29", "release-group": rg("Single") }], ...over });
  it("studio, live, remix, DJ-mix excerpt, edit, compilation, and anything else with MusicBrainz's own note", () => {
    expect(kindOf(rec({})).kind).toBe("studio");
    expect(kindOf(rec({ disambiguation: "live, 2002-06-28: Example Farm" }))).toEqual({ kind: "live", detail: "2002-06-28: Example Farm" });
    expect(kindOf(rec({ releases: [{ id: "x", status: "Official", date: "2012", "release-group": rg("Album", ["Live"]) }] })).kind).toBe("live");
    expect(kindOf(rec({ title: "Glass Harbour (Example remix)" })).kind).toBe("remix");
    expect(kindOf(rec({ disambiguation: "part of “Example: MegaMix” DJ‐mix" })).kind).toBe("dj-mix");
    expect(kindOf(rec({ disambiguation: "radio edit" })).kind).toBe("edit");
    expect(kindOf(rec({ releases: [{ id: "x", status: "Official", date: "2021", "release-group": rg("Album", ["Compilation"]) }] })).kind).toBe("compilation");
    expect(kindOf(rec({ disambiguation: "music video" }))).toEqual({ kind: "other", detail: "music video" });
  });
  it("the earliest studio recording by the read artist is the original; a second studio recording is not", () => {
    const early = rec({ id: "early" });
    const late = rec({ id: "late", releases: [{ id: "y", status: "Official", date: "2023-01-01", "release-group": rg("Album") }] });
    const list = fixList([late, early], { byReadArtist: () => true });
    expect(list.rows.map((r) => [r.candidate.recording_id, r.label])).toEqual([["early", "Studio recording · the original"], ["late", "Studio recording"]]);
  });
  it("a missing date, record or length is said in words", () => {
    const bare: MbRecording = { id: "b", title: "Glass Harbour", "artist-credit": [{ name: "Juniper Varga", artist: { id: "jv", name: "Juniper Varga" } }], releases: [] };
    expect(fixList([bare], { byReadArtist: () => true }).rows[0]!.facts).toEqual(["Glass Harbour", "Juniper Varga", "no release date on MusicBrainz", "no record on MusicBrainz", "no length on MusicBrainz"]);
    expect(firstRelease(bare)).toEqual({ date: undefined, record: undefined });
  });
  it("in a typed search, a cover band's studio recording is never called the original", () => {
    const glass = rec({ id: "jv" });
    const cover = rec({ id: "cover", "artist-credit": [{ name: "Example Cover Band", artist: { id: "cb", name: "Example Cover Band" } }] });
    const rows = typedList([cover, glass], undefined, "Glass Harbour Juniper Varga");
    expect(rows.find((r) => r.candidate.recording_id === "jv")!.label).toBe("Studio recording · the original");
    expect(rows.find((r) => r.candidate.recording_id === "cover")!.label).toBe("Studio recording");
  });
  it("lengths read as m:ss; the list never holds more than eight rows", () => {
    expect(mmss(238805)).toBe("3:59");
    expect(mmss(60000)).toBe("1:00");
    const many = Array.from({ length: 20 }, (_, i) => rec({ id: `r${i}`, disambiguation: `live, 20${String(i).padStart(2, "0")}` }));
    expect(fixList(many, { byReadArtist: () => true }).rows).toHaveLength(8);
    expect(typedList(many)).toHaveLength(8);
  });
});

// ---- A pick holds (unchanged from the first build) -------------------------------------------------

describe("a pick holds for every later play of the same video, until it is undone", () => {
  const play = (over: Partial<PlayRow>): PlayRow => ({
    play_id: Math.random().toString(), source: "live page", video_id: "BV1ab4y1c7DE", part_number: 1, page_title: "t", uploader_name: "", uploader_id: "",
    list_title: "", list_position: null, page_tags: [], started_at: "2026-11-08T10:00:00", heard_seconds: 0, reached_end: "no",
    recording_id: "", match_state: "unsure", match_rule_version: "v7.0", ...over,
  });
  const facts = { video_id: "BV1ab4y1c7DE", part_number: 1, page_title: "t", uploader_name: "", uploader_id: "", list_title: "", list_position: null, page_tags: [] };
  it("the latest pick for this video and part is used; other videos and parts are not", () => {
    const plays = [
      play({ match_state: "fixed by me", recording_id: "first-pick", started_at: "2026-11-08T09:00:00" }),
      play({ match_state: "fixed by me", recording_id: "second-pick", started_at: "2026-11-08T09:30:00" }),
      play({ match_state: "unsure" }),
      play({ part_number: 2, match_state: "not a song" }),
      play({ video_id: "BV1zz4y1c7ZZ", match_state: "fixed by me", recording_id: "elsewhere" }),
    ];
    expect(earlierFix(plays, facts)?.recording_id).toBe("second-pick");
    expect(earlierFix(plays, { ...facts, part_number: 2 })?.match_state).toBe("not a song");
    expect(earlierFix(plays, { ...facts, video_id: "BV1qq4y1c7QQ" })).toBeUndefined();
  });
  it("an undone pick no longer holds: the play is as it was before", () => {
    const before = play({ match_state: "unsure" });
    const picked = { ...before, match_state: "fixed by me" as const, recording_id: "picked" };
    expect(earlierFix([picked], facts)?.recording_id).toBe("picked");
    expect(earlierFix([before], facts)).toBeUndefined();
  });
});

describe("a viewing whose title changes is matched again (Bob's five-video check)", () => {
  const row = { play_id: "play-tok1", page_title: "Juniper Varga《Glass Harbour》" } as PlayRow;
  it("reuses the play only while the page shows the title it was matched on", () => {
    expect(viewingFor([row], "tok1", "Juniper Varga《Glass Harbour》")).toEqual({ row, sameTitle: true });
    expect(viewingFor([row], "tok1", "Example Singer《Paper Lantern》")).toEqual({ row, sameTitle: false });
    expect(viewingFor([row], "tok2", "Juniper Varga《Glass Harbour》")).toEqual({ row: undefined, sameTitle: false });
  });
});

describe("a pick is kept with its recording", () => {
  it("the snapshot holds every recording the store knows, whatever order the saves ran in", async () => {
    const { toSnapshot } = await import("../ui/store");
    const { EXAMPLE_CATALOGUE } = await import("./examples");
    const f = EXAMPLE_CATALOGUE[0]!;
    const snap = toSnapshot({ ready: true, people: [], songs: [], facts: { [f.recording_id]: f }, matchedBy: { [f.recording_id]: "my fix" }, disputed: [], choices: [], words: [], events: [], histories: {}, plays: [], keys: [], nexts: [], story_shown_count: 0 });
    expect(snap.recordings.map((r) => [r.recording_id, r.matched_by])).toEqual([[f.recording_id, "my fix"]]);
  });
});

export type { FixList };

/** T4.5 Where next? (FR-T4.5): reason order; a shared person never alone; one track to start; nothing opens without a tap. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { dueAtEnd, finishedByArtist, newRecord, ordered, searchLink, startTrack, uploaderLink, uploaderReason } from "./nextrecord";
import { Gate, type Clock } from "./sources/http";
import { FACTS, OTHER, play, SAME_ARTIST, SONG } from "./testing/panel";

const r = (kind: "uploader" | "trusted_judge" | "artist_new" | "shared_person") => ({ kind, text: kind, evidence: [] });

describe("reasons", () => {
  it("come in the PRD's order: uploader, friend, new record, shared person", () => {
    expect(ordered([r("artist_new"), r("shared_person"), r("uploader"), r("trusted_judge")]).map((x) => x.kind)).toEqual(["uploader", "trusted_judge", "artist_new", "shared_person"]);
  });
  it("a shared person never appears alone", () => {
    expect(ordered([r("shared_person")])).toEqual([]);
    expect(ordered([r("shared_person"), r("artist_new")])).toHaveLength(2);
  });
  it("the uploader reason counts songs from that uploader played to the end, from D1", () => {
    const now = play(SONG, "2026-11-08T21:00:00", { uploader_id: "77", uploader_name: "Example Uploader" });
    const plays = [play(OTHER, "2026-11-01T10:00:00", { uploader_id: "77" }), play(SAME_ARTIST, "2026-11-02T10:00:00", { uploader_id: "77" }), play(SONG, "2026-11-03T10:00:00", { uploader_id: "77", reached_end: "no" }), now];
    expect(uploaderReason(plays, now)?.text).toBe("Example Uploader gave you 3 songs you played to the end.");
    expect(uploaderReason([now], now)).toBeNull();
  });
  it("finished songs by an artist are distinct recordings played to the end", () => {
    const plays = [play(SONG, "2026-11-01T10:00:00"), play(SONG, "2026-11-02T10:00:00"), play(SAME_ARTIST, "2026-11-03T10:00:00"), play(SAME_ARTIST, "2026-11-04T10:00:00", { reached_end: "no" })];
    expect(finishedByArtist(plays, FACTS, SONG.lead_artist_id).sort()).toEqual([SAME_ARTIST.recording_id, SONG.recording_id].sort());
  });
});

describe("one track to start with", () => {
  const tracks = [{ recording_id: "t1", title: "Intro" }, { recording_id: "t2", title: "Glass Harbour" }, { recording_id: "t3", title: "Low Bell" }];
  it("the earliest track also released as a single, otherwise track 1", () => {
    expect(startTrack(tracks, ["Low Bell", "Glass Harbour"])?.recording_id).toBe("t2");
    expect(startTrack(tracks, ["Something Else"])?.recording_id).toBe("t1");
  });
});

describe("when it comes by itself", () => {
  it("at a song's end after at least two other songs in the same session; never mid-song", () => {
    const a = play(OTHER, "2026-11-08T20:00:00");
    const b = play(SAME_ARTIST, "2026-11-08T20:04:00");
    const end = play(SONG, "2026-11-08T20:08:00");
    expect(dueAtEnd([a, b, end], end)).toBe(true);
    expect(dueAtEnd([b, end], end)).toBe(false);
    expect(dueAtEnd([a, b, { ...end, reached_end: "no" }], { ...end, reached_end: "no" })).toBe(false);
    const yesterday = play(OTHER, "2026-11-07T20:00:00");
    expect(dueAtEnd([yesterday, b, end], end)).toBe(false);
  });
});

describe("a new record", () => {
  it("is an album or EP first released in the last 12 months, the newest first", async () => {
    let t = 0;
    const clock: Clock = { now: () => t, sleep: async (ms) => void (t += ms) };
    const fetchFn = async () => ({ ok: true, status: 200, json: async () => ({ "release-groups": [
      { id: "old", title: "Old", "first-release-date": "2024-01-01", "primary-type": "Album" },
      { id: "live", title: "Live One", "first-release-date": "2026-05-01", "primary-type": "Album", "secondary-types": ["Live"] },
      { id: "ep", title: "New EP", "first-release-date": "2026-03-01", "primary-type": "EP" },
      { id: "lp", title: "New LP", "first-release-date": "2026-09-01", "primary-type": "Album" },
    ] }) });
    const g = await newRecord("art", new Date("2026-11-08T12:00:00Z"), { fetchFn, gate: new Gate(1200, clock), clock, cache: new Map() });
    expect(g?.id).toBe("lp");
  });
  it("a record older than 12 months is never new", async () => {
    let t = 0;
    const clock: Clock = { now: () => t, sleep: async (ms) => void (t += ms) };
    const fetchFn = async () => ({ ok: true, status: 200, json: async () => ({ "release-groups": [{ id: "old", title: "Old", "first-release-date": "2025-10-01", "primary-type": "Album" }] }) });
    expect(await newRecord("art", new Date("2026-11-08T12:00:00Z"), { fetchFn, gate: new Gate(1200, clock), clock, cache: new Map() })).toBeNull();
  });
});

describe("nothing opens without a tap", () => {
  it("links are plain anchors; the code never opens a window or moves the page itself", () => {
    const src = readFileSync(join(__dirname, "..", "ui", "WhereNext.tsx"), "utf8");
    expect(src).not.toMatch(/window\.open|location\.(href|assign|replace)\s*=|\.click\(\)/);
    expect(searchLink("Juniper Varga", "Harbour Lights")).toBe("https://search.bilibili.com/all?keyword=Juniper%20Varga%20Harbour%20Lights");
    expect(uploaderLink("77")).toBe("https://space.bilibili.com/77");
  });
});

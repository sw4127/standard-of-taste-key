/** T5.7 Look back (FR-T5.7): the three kinds compute as specified on a synthetic history. */
import { describe, expect, it } from "vitest";
import { exampleHistory } from "./examples";
import { defaultStretch, lookBack, quarterLabel, summary, type Quarter } from "./lookback";
import type { HistoryRow } from "./model";

let i = 0;
const play = (artist: string, day: string, ms = 180_000): HistoryRow => ({
  history_id: `h${++i}`, person_id: "me", ended_at_utc: `${day}T20:00:00Z`, local_time: `${day}T20:00:00`, country: "GB",
  track_uri: `t:${artist}`, track: `${artist} song`, artist, album: "a", ms_played: ms,
});
const Q3: Quarter = { year: 2026, q: 3 };

describe("arrived and stayed", () => {
  it("first heard in the stretch and played on 3 or more separate days", () => {
    const rows = [play("A", "2026-07-02"), play("A", "2026-07-02"), play("A", "2026-08-01"), play("A", "2026-09-01")];
    expect(lookBack(rows, Q3).map((l) => l.id)).toEqual(["arrived:A"]);
    expect(lookBack(rows.slice(0, 3), Q3)).toEqual([]); // two separate days
  });
  it("plays under 30 seconds never count (and Spotify's skipped flag is not read)", () => {
    const rows = [play("A", "2026-07-02"), play("A", "2026-08-01"), play("A", "2026-09-01", 29_999)];
    expect(lookBack(rows, Q3)).toEqual([]);
  });
  it("an artist heard before the stretch did not arrive in it", () => {
    const rows = [play("A", "2026-06-30"), play("A", "2026-07-02"), play("A", "2026-08-01"), play("A", "2026-09-01")];
    expect(lookBack(rows, Q3).some((l) => l.kind === "arrived")).toBe(false);
  });
});

describe("left", () => {
  it("top 20 of the two quarters before, under 10% of that count in the stretch", () => {
    const before = Array.from({ length: 20 }, (_, k) => play("B", `2026-0${1 + (k % 6)}-1${k % 9}`));
    expect(lookBack([...before, play("B", "2026-07-05")], Q3).map((l) => l.id)).toEqual(["left:B"]); // 1 < 2
    expect(lookBack([...before, play("B", "2026-07-05"), play("B", "2026-07-06")], Q3)).toEqual([]); // 2 is not under 2
  });
});

describe("came back", () => {
  it("absent the two quarters before, played on 3 or more days in the stretch", () => {
    const rows = [play("C", "2025-11-01"), play("C", "2026-07-02"), play("C", "2026-08-02"), play("C", "2026-09-02")];
    const lines = lookBack(rows, Q3);
    expect(lines.map((l) => l.id)).toEqual(["came-back:C"]);
    expect(lines[0]!.pattern).toBe("C came back between July and September 2026 after six months away: you played them on three separate days.");
    // present one quarter before the stretch: not "came back"
    expect(lookBack([play("C", "2026-05-01"), ...rows.slice(1)], Q3).some((l) => l.kind === "came-back")).toBe(false);
  });
});

describe("the example history", () => {
  const rows = exampleHistory();
  it("reads its span and defaults to the most recent full quarter", () => {
    expect(summary(rows)).toMatchObject({ first: "2025-01", last: "2026-10" });
    expect(quarterLabel(defaultStretch(rows)!)).toBe("July to September 2026");
  });
  it("finds one of each kind in July to September 2026", () => {
    const ids = lookBack(rows, defaultStretch(rows)!).map((l) => l.id);
    expect(ids).toEqual(expect.arrayContaining(["arrived:Aurelio Tamm", "left:Halvard Mire", "came-back:Ottilie Sand"]));
    expect(ids.some((id) => id.includes("Juniper Varga"))).toBe(false); // steady: no line
  });
  it("every line has its plays and one pair of readings offered as questions", () => {
    for (const l of lookBack(rows, defaultStretch(rows)!)) {
      expect(l.plays.length).toBeGreaterThan(0);
      expect(l.readings.every((r) => r.ask.endsWith("?"))).toBe(true);
    }
  });
});

// ---- Reading a real export (Step 4) ---------------------------------------------------------------

import { strToU8, zipSync } from "fflate";
import { IDBFactory } from "fake-indexeddb";
import { localTime, NotAnExport, readExport, zoneFor } from "./spotify";
import { deleteHistory, eraseAll, loadAll, loadHistories, openDb, putHistory } from "./storage";

/** A synthetic export, in Spotify's own field names, with invented artists. */
const spPlay = (ts: string, track: string, artist: string, ms = 180_000, country = "GB") => ({
  ts, platform: "android", ms_played: ms, conn_country: country, ip_addr: "203.0.113.7",
  master_metadata_track_name: track, master_metadata_album_artist_name: artist, master_metadata_album_album_name: `${track} (album)`,
  spotify_track_uri: `spotify:track:${track.replace(/\W/g, "")}`, episode_name: null, reason_start: "trackdone", reason_end: "trackdone",
  shuffle: false, skipped: false, offline: false, incognito_mode: false,
});
const podcast = { ts: "2026-07-02T08:00:00Z", ms_played: 900_000, conn_country: "GB", ip_addr: "203.0.113.7", master_metadata_track_name: null, master_metadata_album_artist_name: null, episode_name: "An episode" };

function fakeExport() {
  return zipSync({
    "Spotify Extended Streaming History/Streaming_History_Audio_2025-2026_1.json": strToU8(JSON.stringify([spPlay("2026-07-14T20:05:00Z", "Low Bell", "Aurelio Tamm"), podcast])),
    "Spotify Extended Streaming History/Streaming_History_Audio_2025_0.json": strToU8(JSON.stringify([spPlay("2025-03-01T10:00:00Z", "Glass Harbour", "Juniper Varga", 12_000, "CN")])),
    "Spotify Extended Streaming History/Streaming_History_Video_2025.json": strToU8(JSON.stringify([spPlay("2025-05-05T10:00:00Z", "A video", "Nobody")])),
    "Spotify Extended Streaming History/ReadMeFirst_ExtendedStreamingHistory.pdf": strToU8("pdf"),
  });
}

describe("reading a Spotify export in the browser", () => {
  const r = readExport("my_spotify_data.zip", fakeExport(), "me");
  it("reads only the Streaming_History_Audio files, in time order", () => {
    expect(r.files).toBe(2);
    expect(r.rows.map((x) => x.track)).toEqual(["Glass Harbour", "Low Bell"]);
  });
  it("keeps exactly the D11 fields: the IP address and every other field never reach a row", () => {
    for (const row of r.rows) {
      expect(Object.keys(row).sort()).toEqual(["album", "artist", "country", "ended_at_utc", "history_id", "local_time", "ms_played", "person_id", "track", "track_uri"]);
    }
    expect(JSON.stringify(r.rows)).not.toMatch(/203\.0\.113|ip_addr|android|shuffle|skipped|trackdone/);
  });
  it("leaves out plays that name no song (podcasts), and counts them", () => {
    expect(r.leftOut).toBe(1);
  });
  it("keeps short plays in the file; the look back counts only plays of 30 seconds or more", () => {
    expect(r.rows.find((x) => x.track === "Glass Harbour")!.ms_played).toBe(12_000);
  });
  it("gives each play its local time from its country", () => {
    expect(r.rows.find((x) => x.track === "Low Bell")!.local_time).toBe("2026-07-14T21:05:00"); // London, summer time
    expect(r.rows.find((x) => x.track === "Glass Harbour")!.local_time).toBe("2025-03-01T18:00:00"); // Shanghai
    expect(localTime("2026-01-14T20:05:00Z", "GB")).toBe("2026-01-14T20:05:00"); // London, winter
    expect(localTime("2026-07-01T03:00:00Z", "US")).toBe("2026-06-30T23:00:00"); // one zone stands for the country
    expect(zoneFor("US").approximate).toBe(true);
    expect(zoneFor("GB").approximate).toBe(false);
  });
  it("a play just after midnight UTC falls in the right local quarter", () => {
    expect(localTime("2026-09-30T23:30:00Z", "CN").slice(0, 10)).toBe("2026-10-01");
  });
  it("refuses a file that holds no listening history, reading nothing", () => {
    expect(() => readExport("photos.zip", zipSync({ "a.jpg": strToU8("x") }), "me")).toThrow(NotAnExport);
    expect(() => readExport("notes.txt", strToU8("hello"), "me")).toThrow(NotAnExport);
    expect(() => readExport("Userdata.json", strToU8("{}"), "me")).toThrow(NotAnExport);
  });
  it("also reads one Streaming_History_Audio json dropped by itself", () => {
    const one = readExport("Streaming_History_Audio_2026_3.json", strToU8(JSON.stringify([spPlay("2026-08-01T10:00:00Z", "Saltwind", "Ottilie Sand")])), "me");
    expect(one.rows).toHaveLength(1);
  });
  it("feeds the look back: the summary reads the file's own span", () => {
    expect(summary(r.rows)).toEqual({ plays: 2, first: "2025-03", last: "2026-07" });
  });
});

describe("D11 in this browser", () => {
  it("keeps each person's plays apart, replaces them on a second read, and the erase clears them", async () => {
    const factory = new IDBFactory();
    const db = await openDb(factory);
    const mine = readExport("a.zip", fakeExport(), "me").rows;
    const theirs = readExport("b.zip", fakeExport(), "person-x").rows;
    await putHistory(db, "me", mine);
    await putHistory(db, "person-x", theirs);
    await putHistory(db, "me", mine.slice(0, 1));
    let h = await loadHistories(await openDb(factory));
    expect(h.me).toHaveLength(1);
    expect(h["person-x"]).toHaveLength(2);
    await deleteHistory(db, "person-x");
    h = await loadHistories(db);
    expect(Object.keys(h)).toEqual(["me"]);
    await eraseAll(db, "2026-11-08T12:00:00.000Z");
    expect(await loadHistories(db)).toEqual({});
    expect((await loadAll(db)).settings).toEqual([{ settings_id: 1, last_erased_at: "2026-11-08T12:00:00.000Z" }]);
  });
});

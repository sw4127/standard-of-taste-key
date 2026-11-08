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
    expect(lines[0]!.pattern).toBe("C came back in July to September 2026 after 2 quarters away: you played them on 3 separate days.");
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

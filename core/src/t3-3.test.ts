/** T3.3 "Since you installed" (FR-T3.3): plays, hours grouped, songs just before and after, from D1 only. */
import { describe, expect, it } from "vitest";
import { hourGroup, sinceInstalled } from "./proof";
import { OTHER, play, SAME_ARTIST, SONG } from "./testing/panel";

describe("since you installed", () => {
  const d1 = [
    play(OTHER, "2026-11-01T08:00:00"),
    play(SONG, "2026-11-01T08:04:00"),
    play(SAME_ARTIST, "2026-11-01T08:08:00"),
    play(OTHER, "2026-11-02T23:50:00"),
    play(SONG, "2026-11-03T00:20:00"),
    play(null, "2026-11-03T00:25:00"),
    play(SONG, "2026-11-04T14:00:00"),
  ];
  it("counts plays and groups their hours", () => {
    const s = sinceInstalled(d1, SONG.recording_id)!;
    expect(s.plays).toBe(3);
    expect(s.hours).toEqual({ morning: 1, afternoon: 1, evening: 0, "after midnight": 1 });
  });
  it("counts the songs played just before and just after", () => {
    const s = sinceInstalled(d1, SONG.recording_id)!;
    expect(s.before).toEqual([{ song: "Second Lamp · The Quiet Lanterns", times: 2 }, { song: "A vlog", times: 1 }]);
    expect(s.after).toEqual([{ song: "A vlog", times: 1 }, { song: "Harbour Lights · Juniper Varga", times: 1 }]);
  });
  it("is empty for a song D1 has never played", () => {
    expect(sinceInstalled(d1, "never")).toBeNull();
  });
  it("hour groups: after midnight to 04:59, morning to 11:59, afternoon to 16:59, evening to 23:59", () => {
    expect(["T00:00", "T04:59", "T05:00", "T11:59", "T12:00", "T16:59", "T17:00", "T23:59"].map((t) => hourGroup(`2026-11-01${t}:00`))).toEqual([
      "after midnight", "after midnight", "morning", "morning", "afternoon", "afternoon", "evening", "evening",
    ]);
  });
});

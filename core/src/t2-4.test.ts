/** T2.4 Timing (FR-T2.4): the first line at 15 s heard on a known recording, 60 s on a first play; not on pause. */
import { describe, expect, it } from "vitest";
import { FIRST_PLAY_WAIT, KNOWN_WAIT, waitFor } from "./firstwords";
import { HeardClock } from "../../extension/src/page";
import { play, SONG, OTHER } from "./testing/panel";

describe("the wait", () => {
  it("is 60 s on a first play and 15 s on a recording played before", () => {
    const first = play(SONG, "2026-11-08T10:00:00");
    expect(waitFor([first], SONG.recording_id, first.play_id)).toBe(FIRST_PLAY_WAIT);
    const again = play(SONG, "2026-11-09T10:00:00");
    expect(waitFor([first, again], SONG.recording_id, again.play_id)).toBe(KNOWN_WAIT);
    expect(waitFor([first, again], OTHER.recording_id, "x")).toBe(FIRST_PLAY_WAIT);
  });
  it("an unmatched earlier play of the same video does not make it known", () => {
    const earlier = play(SONG, "2026-11-08T10:00:00", { match_state: "unsure" });
    expect(waitFor([earlier], SONG.recording_id, "now")).toBe(FIRST_PLAY_WAIT);
  });
});

describe("simulated play events", () => {
  const due = (events: [number, boolean][], wait: number) => {
    const c = new HeardClock();
    let shownAt: number | null = null;
    for (const [t, playing] of events) {
      c.tick(t, playing);
      if (shownAt === null && c.heard >= wait) shownAt = t;
    }
    return shownAt;
  };
  const steady = (from: number, to: number, playing = true): [number, boolean][] => Array.from({ length: Math.round((to - from) / 0.25) + 1 }, (_, i) => [from + i * 0.25, playing]);
  it("the line comes at 15 s and 60 s heard respectively", () => {
    expect(due(steady(0, 20), KNOWN_WAIT)).toBeCloseTo(15, 0);
    expect(due(steady(0, 70), FIRST_PLAY_WAIT)).toBeCloseTo(60, 0);
  });
  it("not while paused: paused time is not heard", () => {
    const events = [...steady(0, 10), ...steady(10, 60, false), ...steady(60, 64)];
    expect(due(events, KNOWN_WAIT)).toBeNull();
  });
});

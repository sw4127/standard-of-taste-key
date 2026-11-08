/** T2.5 The quiet line and its offer, at most once per listening session (FR-T2.5). */
import { describe, expect, it } from "vitest";
import { offerDue, QUIET, QUIET_OFFER, sessionStart } from "./firstwords";
import type { KeyRow } from "./model";
import { play, SONG } from "./testing/panel";

const key = (shown_at: string, offer_shown: boolean): KeyRow => ({
  key_id: shown_at, recording_id: SONG.recording_id, play_id: "x", template_id: "first:quiet", evidence: [], text_shown: QUIET,
  shown_at, seconds_heard_when_shown: 60, threshold_seconds: 60, offer_shown, dropped: false,
});

describe("the words", () => {
  it("are the PRD's", () => {
    expect(QUIET).toBe("Nothing worth saying about this one yet.");
    expect(QUIET_OFFER).toBe("Name a few songs that come to mind?");
  });
});

describe("once per listening session", () => {
  // Plays of 200 s; the session ends after 30 minutes with no play.
  const a = play(SONG, "2026-11-08T20:00:00");
  const b = play(SONG, "2026-11-08T20:10:00");
  const c = play(SONG, "2026-11-08T21:30:00");
  it("a session runs while plays come within 30 minutes of the last one ending", () => {
    expect(sessionStart([a, b], b)).toBe("2026-11-08T20:00:00");
    expect(sessionStart([a, b, c], c)).toBe("2026-11-08T21:30:00");
  });
  it("the offer is due the first time in a session, not again in it, and again in the next session", () => {
    expect(offerDue([a], [], a)).toBe(true);
    const shown = [key("2026-11-08T20:01:00", true)];
    expect(offerDue([a, b], shown, b)).toBe(false);
    expect(offerDue([a, b, c], shown, c)).toBe(true);
  });
  it("a quiet line shown without its offer does not use the session's offer up", () => {
    expect(offerDue([a, b], [key("2026-11-08T20:01:00", false)], b)).toBe(true);
  });
});

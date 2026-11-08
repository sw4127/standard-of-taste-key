/** T2.6 "Not why I love it" (FR-T2.6): a dropped line never returns on that recording; the next line takes its place. */
import { describe, expect, it } from "vitest";
import { firstLine } from "./firstwords";
import type { KeyRow } from "./model";
import { FACTS, FRIEND, friendPlays, OTHER, play, SONG } from "./testing/panel";

const dropped = (template_id: string, recording_id = SONG.recording_id): KeyRow => ({
  key_id: template_id + recording_id, recording_id, play_id: "x", template_id, evidence: [], text_shown: "", shown_at: "2026-11-08T10:00:00",
  seconds_heard_when_shown: 60, threshold_seconds: 60, dropped: true,
});

describe("a dropped line", () => {
  const own = [play(SONG, "2026-11-01T10:00:00"), play(SONG, "2026-11-02T10:00:00")];
  const current = play(SONG, "2026-11-03T10:00:00");
  const histories = { "person-f": friendPlays(25, "Juniper Varga", "Harbour Lights", () => "Glass Harbour") };
  const base = { song: SONG, play: current, plays: [...own, current], facts: FACTS, histories, people: [FRIEND] };
  it("is replaced at once by the next eligible line, then by the quiet line", () => {
    expect(firstLine({ ...base, keys: [] }).kind).toBe("own-recording");
    expect(firstLine({ ...base, keys: [dropped("first:own-recording")] }).kind).toBe("friend");
    expect(firstLine({ ...base, keys: [dropped("first:own-recording"), dropped("first:friend")] }).kind).toBe("quiet");
  });
  it("is dropped for that recording only", () => {
    const otherPlays = [play(OTHER, "2026-11-01T10:00:00"), play(OTHER, "2026-11-02T10:00:00")];
    const now = play(OTHER, "2026-11-03T10:00:00");
    const l = firstLine({ song: OTHER, play: now, plays: [...otherPlays, now], facts: FACTS, histories: {}, people: [], keys: [dropped("first:own-recording")] });
    expect(l.kind).toBe("own-recording");
  });
});

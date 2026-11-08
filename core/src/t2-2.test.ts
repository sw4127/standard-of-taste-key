/** T2.2 First words (FR-T2.2): own record, then a friend's plays, then the quiet line; never a credit or a story. */
import { describe, expect, it } from "vitest";
import { firstLine, ownRecordLine, QUIET } from "./firstwords";
import type { KeyRow, PlayRow } from "./model";
import { FACTS, FRIEND, friendPlays, OTHER, play, SAME_ARTIST, SONG } from "./testing/panel";

const now = (plays: PlayRow[], current: PlayRow, extra: Partial<Parameters<typeof firstLine>[0]> = {}) =>
  firstLine({ song: SONG, play: current, plays: [...plays, current], facts: FACTS, keys: [], histories: {}, people: [], ...extra });

describe("with an empty record and no friend's file", () => {
  it("the line is the quiet line", () => {
    const l = now([], play(SONG, "2026-11-08T10:00:00"));
    expect(l.kind).toBe("quiet");
    expect(l.text).toBe(QUIET);
  });
});

describe("(a) a line from the person's own record", () => {
  it("appears once this recording has plays on three or more separate days, naming the late ones when two or more", () => {
    const plays = [play(SONG, "2026-11-01T01:10:00"), play(SONG, "2026-11-01T22:00:00"), play(SONG, "2026-11-03T02:30:00")];
    const l = now(plays, play(SONG, "2026-11-05T20:00:00"));
    expect(l.kind).toBe("own-recording");
    expect(l.text).toBe("You've played this on three separate days since you installed, two of them after midnight.");
    expect(l.readings?.every((r) => r.ask.endsWith("?"))).toBe(true);
    expect(l.proof).toHaveLength(4);
  });
  it("one late day is not named: the clause needs two or more", () => {
    const plays = [play(SONG, "2026-11-01T01:10:00"), play(SONG, "2026-11-02T22:00:00")];
    expect(now(plays, play(SONG, "2026-11-03T20:00:00")).text).toBe("You've played this on three separate days since you installed.");
  });
  it("two days are not enough; several plays on one day count once", () => {
    const plays = [play(SONG, "2026-11-01T10:00:00"), play(SONG, "2026-11-01T11:00:00"), play(SONG, "2026-11-01T12:00:00")];
    expect(now(plays, play(SONG, "2026-11-02T10:00:00")).kind).toBe("quiet");
  });
  it("falls back to the artist: plays of their songs on three or more days", () => {
    const plays = [play(SAME_ARTIST, "2026-11-01T10:00:00"), play(SAME_ARTIST, "2026-11-02T10:00:00")];
    const l = ownRecordLine([...plays, play(SONG, "2026-11-03T10:00:00")], FACTS, SONG)!;
    expect(l.kind).toBe("own-artist");
    expect(l.text).toBe("You've played Juniper Varga on three separate days since you installed.");
  });
  it("plays the rule could not match, or marked not a song, never count", () => {
    const plays = [play(SONG, "2026-11-01T10:00:00", { match_state: "unsure" }), play(SONG, "2026-11-02T10:00:00", { match_state: "not a song" })];
    expect(now(plays, play(SONG, "2026-11-03T10:00:00")).kind).toBe("quiet");
  });
});

describe("(b) a friend's line, when there is no own-record line", () => {
  const histories = { "person-f": friendPlays(25, "Juniper Varga", "Harbour Lights", (i) => (i % 2 ? "Glass Harbour" : "Low Bell")) };
  it("comes before the quiet line, and after the person's own record", () => {
    expect(now([], play(SONG, "2026-11-08T10:00:00"), { histories, people: [FRIEND] }).kind).toBe("friend");
    const own = [play(SONG, "2026-11-01T10:00:00"), play(SONG, "2026-11-02T10:00:00")];
    expect(now(own, play(SONG, "2026-11-03T10:00:00"), { histories, people: [FRIEND] }).kind).toBe("own-recording");
  });
});

describe("never a credit fact, never a story, as the first line", () => {
  it("no first line names a credited person, a role or a story", () => {
    const histories = { "person-f": friendPlays(25, "Juniper Varga", "Harbour Lights", () => "Glass Harbour") };
    const lines = [
      now([], play(SONG, "2026-11-08T10:00:00")),
      now([], play(SONG, "2026-11-08T10:00:00"), { histories, people: [FRIEND] }),
      now([play(SONG, "2026-11-01T10:00:00"), play(SONG, "2026-11-02T10:00:00")], play(SONG, "2026-11-03T10:00:00")),
    ];
    for (const l of lines) {
      expect(l.text).not.toMatch(/Kasimir Fenwold|producer|mixer|writer|story/i);
      expect(l.template_id).toMatch(/^first:(own-recording|own-artist|friend|quiet)$/);
    }
  });
});

describe("a line whose words fail the checks is not shown", () => {
  it("an artist named with a carve-out word gives the quiet line instead", () => {
    const grim = { ...OTHER, recording_id: "example-grim", lead_artist_id: "grim", lead_artist: "Trauma Parade", artist_credit: "Trauma Parade" };
    const facts = { ...FACTS, [grim.recording_id]: grim };
    const plays = [play(grim, "2026-11-01T10:00:00"), play(grim, "2026-11-02T10:00:00")];
    const keys: KeyRow[] = [];
    const l = firstLine({ song: grim, play: play(grim, "2026-11-03T10:00:00"), plays, facts, keys, histories: {}, people: [] });
    expect(l.kind).toBe("quiet");
  });
});

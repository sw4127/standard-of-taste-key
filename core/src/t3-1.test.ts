/** T3.1 The proof (FR-T3.1): every item has its source; a story only with its label and its sources. */
import { describe, expect, it } from "vitest";
import { breaches } from "./checks";
import { firstLine } from "./firstwords";
import { STORIES, STORY_LABEL, storyFor } from "./stories";
import { FACTS, FRIEND, friendPlays, play, SONG } from "./testing/panel";

describe("proof items", () => {
  it("every item of an own-record line and of a friend line names where it comes from", () => {
    const own = [play(SONG, "2026-11-01T10:00:00"), play(SONG, "2026-11-02T10:00:00")];
    const now = play(SONG, "2026-11-03T10:00:00");
    const a = firstLine({ song: SONG, play: now, plays: [...own, now], facts: FACTS, keys: [], histories: {}, people: [] });
    const b = firstLine({ song: SONG, play: now, plays: [now], facts: FACTS, keys: [], histories: { "person-f": friendPlays(25, "Juniper Varga", "H", () => "Glass Harbour") }, people: [FRIEND] });
    for (const l of [a, b]) {
      expect(l.proof.length).toBeGreaterThan(0);
      for (const p of l.proof) expect(p.source.length).toBeGreaterThan(5);
    }
  });
});

describe("stories", () => {
  it("are the ten accepted in Stage 6, each with at least one source page", () => {
    expect(STORIES).toHaveLength(10);
    for (const s of STORIES) {
      expect(s.sources.length).toBeGreaterThan(0);
      for (const u of s.sources) expect(u).toMatch(/^https:\/\//);
    }
  });
  it("pass the story checks: they may name their own people's feelings, never address the reader", () => {
    for (const s of STORIES) expect(breaches(s.text, "story"), s.song).toEqual([]);
  });
  it("are found by title and lead artist only", () => {
    expect(storyFor("Gasoline", "The Weeknd")?.text).toMatch(/Purgatorio/);
    expect(storyFor("Gasoline", "Someone Else")).toBeUndefined();
    expect(storyFor("Glass Harbour", "Juniper Varga")).toBeUndefined();
  });
  it("carry their label", () => {
    expect(STORY_LABEL).toBe("A story chosen for this song");
  });
});

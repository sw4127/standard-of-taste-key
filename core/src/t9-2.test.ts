/** T9.2 The two one-tap questions (FR-T9.2, changed 2026-11-10): an album has its own options; a song keeps its own; both skippable. */
import { describe, expect, it } from "vitest";
import { actions, getState, seedForTests } from "../ui/store";
import { EXAMPLE_CATALOGUE } from "./examples";
import { ALBUM_PARTS, PARTS } from "./model";
import { albumFacts } from "./sources/albums";

describe("what do you come back for?", () => {
  it("for an album: one song on it · how it flows from start to finish · its overall sound · its words · can't say", () => {
    expect([...ALBUM_PARTS]).toEqual(["one song on it", "how it flows from start to finish", "its overall sound", "its words", "can't say"]);
    expect(ALBUM_PARTS).not.toContain("the chorus");
  });
  it("for a song: as before", () => {
    expect([...PARTS]).toEqual(["the opening", "a verse", "the chorus", "the bridge", "the voice", "the words", "the beat", "the sound of it", "not sure"]);
  });
  it("an answer is stored on its own entry and can be cleared; skipping leaves it unanswered", () => {
    seedForTests({});
    const a = actions.addSong(albumFacts({ key: "album:rg1", kind: "album", release_group_id: "rg1", title: "Lantern Year", artist_credit: "Juniper Varga", lead_artist_id: "jv", lead_artist: "Juniper Varga" }), "lantern year")!;
    const s = actions.addSong(EXAMPLE_CATALOGUE[0]!, "glass harbour")!;
    actions.answer(a, "comes_back_for", "its overall sound");
    const at = (id: string) => getState().songs.find((x) => x.entry_id === id)!;
    expect(at(a).comes_back_for).toBe("its overall sound");
    expect(at(s).comes_back_for).toBe("unanswered");
    actions.answer(a, "comes_back_for", "unanswered");
    expect(at(a).comes_back_for).toBe("unanswered");
  });
});

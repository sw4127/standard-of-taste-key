/** T1.8 His own words beside the record (FR-T1.8): an "In your words" answer shown unchanged, with its date. No model. */
import { describe, expect, it } from "vitest";
import { passes } from "./checks";
import { EXAMPLE_CATALOGUE } from "./examples";
import { wordsAbout } from "./idle";
import type { NamedSong } from "./model";
import type { Choice, Words } from "./note";

const song = EXAMPLE_CATALOGUE[0]!;
const other = EXAMPLE_CATALOGUE[1]!;
const facts = { [song.recording_id]: song, [other.recording_id]: other };
const entry = (entry_id: string, person_id: string, f: typeof song): NamedSong => ({ entry_id, person_id, typed_text: f.title, recording_id: f.recording_id, comes_back_for: "unanswered", found_me: "unanswered", entered_at: "2026-11-09T10:00:00Z" });
const named = [entry("e1", "me", song), entry("e2", "me", other), entry("f1", "person-f", song)];
const choice = (question_id: string, entry_ids: string[], person_id = "me") =>
  ({ question_id, person_id, source: "named songs", pattern_kind: "release window", pattern_text: "x", evidence: entry_ids.map((entry_id) => ({ entry_id, text: "t", source: { label: "MusicBrainz" } })), readings_offered: ["a", "b"], readings_kept: ["a", "b"], choice: "first", answered_at: "2026-11-09T10:00:00Z" }) as Choice;
const words = (words_id: string, about: string, text: string, written_at: string, person_id = "me"): Words => ({ words_id, person_id, question: "What was happening in your life around then?", about, text, written_at, in_note: false });
const o = (w: Words[], c: Choice[]) => ({ words: w, choices: c, songs: named, facts, person: "me", passes: (t: string) => passes(t, "words") });

describe("his words about the song playing", () => {
  it("an answer to a line resting on this song is shown unchanged, with its date", () => {
    const text = "I was moving between two cities that year, and this was on every train.";
    const r = wordsAbout(song, o([words("w1", "q1", text, "2026-11-09T12:00:00Z")], [choice("q1", ["e1", "e2"])]));
    expect(r).toHaveLength(1);
    expect(r[0]!.words.text).toBe(text);
    expect(r[0]!.date).toMatch(/^2026-11-(09|10)$/);
  });
  it("an answer to a line that does not rest on this song is not shown; nor another person's answer", () => {
    expect(wordsAbout(song, o([words("w1", "q2", "Something else.", "2026-11-09T12:00:00Z")], [choice("q2", ["e2"])]))).toEqual([]);
    expect(wordsAbout(song, o([words("w1", "q1", "Theirs.", "2026-11-09T12:00:00Z", "person-f")], [choice("q1", ["f1"], "person-f")]))).toEqual([]);
  });
  it("a line resting only on someone else's song is not about his song, even when it is the same song", () => {
    expect(wordsAbout(song, o([words("w1", "q3", "On every train.", "2026-11-09T12:00:00Z")], [choice("q3", ["f1"])]))).toEqual([]);
  });
  it("words that fail the carve-out check stay on his own words page, never beside the record", () => {
    expect(passes("That year I was depressed and this song kept me going.", "words")).toBe(false);
    expect(wordsAbout(song, o([words("w1", "q1", "That year I was depressed and this song kept me going.", "2026-11-09T12:00:00Z")], [choice("q1", ["e1"])]))).toEqual([]);
  });
  it("the same song matched by another recording of it still finds his words", () => {
    const sameSongOtherId = { ...song, recording_id: "another-recording" };
    expect(wordsAbout(sameSongOtherId, o([words("w1", "q1", "On every train.", "2026-11-09T12:00:00Z")], [choice("q1", ["e1"])]))).toHaveLength(1);
  });
  it("newest first", () => {
    const r = wordsAbout(song, o([words("old", "q1", "First.", "2026-11-01T12:00:00Z"), words("new", "q1", "Second.", "2026-11-09T12:00:00Z")], [choice("q1", ["e1"])]));
    expect(r.map((x) => x.words.words_id)).toEqual(["new", "old"]);
  });
});

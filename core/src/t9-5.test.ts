/** T9.5 My taste note (FR-T9.5): available at its threshold; every sentence traces to a D6 or D14 row. */
import { describe, expect, it } from "vitest";
import { assembleNote, localDay, noteAvailable, type Choice, type Words } from "./note";

const choice = (id: string, c: Choice["choice"], at: string, person = "me"): Choice => ({
  question_id: id, person_id: person, source: "named songs", pattern_kind: "release-window",
  pattern_text: `Pattern ${id}.`, evidence: [], readings_offered: [`${id}/a`, `${id}/b`],
  readings_kept: [`kept ${id} a`, `kept ${id} b`], choice: c, answered_at: at,
});
const words = (id: string, text: string, inNote: boolean, person = "me"): Words => ({
  words_id: id, person_id: person, question: "What was happening in your life around then?", about: "q1", text, written_at: "2026-11-07T10:00:00Z", in_note: inNote,
});

describe("when the note becomes available", () => {
  it("two kept readings, or one reading and one kept answer; 'Neither' keeps nothing", () => {
    expect(noteAvailable([choice("q1", "first", "2026-11-07T10:00:00Z")], [])).toBe(false);
    expect(noteAvailable([choice("q1", "first", "1"), choice("q2", "neither", "2")], [])).toBe(false);
    expect(noteAvailable([choice("q1", "first", "1"), choice("q2", "second", "2")], [])).toBe(true);
    expect(noteAvailable([choice("q1", "first", "1")], [words("w1", "A summer of night buses.", true)])).toBe(true);
    expect(noteAvailable([choice("q1", "first", "1")], [words("w1", "A summer of night buses.", false)])).toBe(false);
  });
  it("a second person's choices never count toward the first person's note", () => {
    expect(noteAvailable([choice("q1", "first", "1"), choice("q2", "first", "2", "friend")], [])).toBe(false);
  });
});

describe("what the note holds", () => {
  const cs = [choice("q1", "first", "2026-11-01T09:00:00Z"), choice("q2", "second", "2026-11-03T09:00:00Z"), choice("q3", "neither", "2026-11-04T09:00:00Z"),
    choice("q4", "first", "2026-11-05T09:00:00Z"), choice("q5", "first", "2026-11-06T09:00:00Z"), choice("q6", "first", "2026-11-06T10:00:00Z", "friend")];
  const ws = [words("w1", "  A summer of night buses. ", true), words("w2", "Not for the note.", false), words("w3", "Friend's words.", true, "friend")];
  const note = assembleNote(cs, ws, []);
  it("every sentence traces to a D6 choice or a D14 row of this person; nothing else", () => {
    const choiceIds = new Set(cs.filter((c) => c.person_id === "me" && c.choice !== "neither").map((c) => c.question_id));
    for (const s of note.readings) expect("choice" in s.from && choiceIds.has(s.from.choice)).toBe(true);
    for (const s of note.own) expect("words" in s.from && s.from.words === "w1").toBe(true);
    expect(note.readings.map((s) => s.text)).toEqual(["You said: kept q5 a.", "You said: kept q4 a.", "You said: kept q2 b.", "You said: kept q1 a."]);
    expect(note.own.map((s) => s.text)).toEqual(["A summer of night buses."]);
  });
  it("the front holds the three most recent kept readings, each dated", () => {
    // Most recent first; each date is the local day of its answer, whatever the time zone.
    expect(note.front.map((s) => s.date)).toEqual(["2026-11-06T09:00:00Z", "2026-11-05T09:00:00Z", "2026-11-03T09:00:00Z"].map(localDay));
  });
});

describe("dates on the note", () => {
  it("are the person's local calendar day", async () => {
    const d = new Date(2026, 10, 7, 23, 59); // 23:59 local on 7 November
    expect(localDay(d.toISOString())).toBe("2026-11-07");
  });
});

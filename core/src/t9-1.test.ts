/** T9.1 Name songs that come to mind (FR-T9.1): search found as you type, the studio rule, nothing ranked, a second person kept apart. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { pickStudio, type MbRecording } from "./match/studio";
import { candidatesFrom } from "./sources/musicbrainz";
import { assembleNote, type Choice } from "./note";

const credit = (id: string, name: string) => [{ name, artist: { id, name } }];
const rel = (date: string, primary = "Album", secondary: string[] = [], status = "Official") => ({ id: `rel-${date}`, status, date, "release-group": { id: `rg-${date}`, "primary-type": primary, "secondary-types": secondary } });
const rec = (id: string, title: string, artist: [string, string], releases: ReturnType<typeof rel>[], disambiguation = ""): MbRecording => ({ id, title, disambiguation, "artist-credit": credit(...artist), releases });

const JV: [string, string] = ["art-jv", "Juniper Varga"];
const QL: [string, string] = ["art-ql", "The Quiet Lanterns"];

describe("the search shows songs, not recordings", () => {
  const found = [
    rec("r1", "Glass Harbour", JV, [rel("2020-03-01")]),
    rec("r2", "Glass Harbour (Live)", JV, [rel("2019-01-01", "Album", ["Live"])]),
    rec("r3", "Glass Harbour", JV, [rel("2022-01-01", "Album", ["Compilation"]), rel("2020-06-01", "Single")]),
    rec("r4", "Glass Harbour", QL, [rel("2024-01-01")]),
    rec("r5", "Glass Harbour", QL, [rel("2021-01-01", "Album", [], "Bootleg")]),
  ];
  it("groups one title by one artist, keeps those with a studio recording, and shows the earliest studio year", () => {
    const c = candidatesFrom(found, "glass harbour");
    expect(c.map((x) => `${x.title} · ${x.artist_credit} · ${x.year}`)).toEqual(["Glass Harbour · Juniper Varga · 2020", "Glass Harbour · The Quiet Lanterns · 2024"]);
    expect(c[0]!.recording_ids).toEqual(["r1", "r3"]);
  });
  it("shows at most five songs", () => {
    const many = Array.from({ length: 9 }, (_, i) => rec(`m${i}`, `Song ${i}`, [`a${i}`, `Artist ${i}`], [rel("2020-01-01")]));
    expect(candidatesFrom(many, "song")).toHaveLength(5);
  });
  it("a live version shows only when the person typed a version word", () => {
    const onlyLive = [rec("r2", "Glass Harbour (Live)", JV, [rel("2019-01-01", "Single")])];
    expect(candidatesFrom(onlyLive, "glass harbour")).toHaveLength(0);
    expect(candidatesFrom(onlyLive, "glass harbour live")).toHaveLength(1);
  });
  it("traditional and simplified spellings of one title are one song", () => {
    const two = [rec("t1", "說好不哭", JV, [rel("2019-09-16", "Single")]), rec("t2", "说好不哭", JV, [rel("2019-10-01")])];
    expect(candidatesFrom(two, "说好不哭")).toHaveLength(1);
  });
});

describe("the studio rule chooses the recording", () => {
  it("the earliest-released studio recording that is not a clean edit", () => {
    const pick = pickStudio([
      rec("late", "Glass Harbour", JV, [rel("2023-01-01")]),
      rec("clean", "Glass Harbour", JV, [rel("2019-01-01")], "clean"),
      rec("early", "Glass Harbour", JV, [rel("2020-01-01", "EP")]),
      rec("demo", "Glass Harbour", JV, [rel("2018-01-01", "Album", ["Demo"])]),
      rec("odd", "Glass Harbour", JV, [rel("2017-01-01")], "rehearsal take"),
    ]);
    expect("recording" in pick && pick.recording.id).toBe("early");
  });
  it("is silent when only clean edits or no studio recording remain", () => {
    expect(pickStudio([rec("c", "X", JV, [rel("2020-01-01")], "clean")])).toEqual({ silent: "only clean edits" });
    expect(pickStudio([rec("l", "X", JV, [rel("2020-01-01", "Album", ["Live"])])])).toEqual({ silent: "no studio recording" });
  });
});

describe("nothing orders, ranks or scores songs (rule 5)", () => {
  it("the songs screen never numbers, sorts or scores the person's songs", () => {
    const src = readFileSync(join(__dirname, "..", "ui", "Songs.tsx"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "")
      .replaceAll("Any order. No ranking.", "");
    expect(src).toMatch(/Songs/);
    expect(src).not.toMatch(/\.sort\(|rank|score|favou?rite|#\{|top \d/i);
    expect(src).not.toMatch(/<ol\b/);
  });
});

describe("a second person's songs stay apart", () => {
  it("their choices never enter the first person's note", () => {
    const c = (person_id: string, q: string): Choice => ({
      question_id: q, person_id, source: "named songs", pattern_kind: "tempo", pattern_text: `pattern ${q}`, evidence: [],
      readings_offered: ["a", "b"], readings_kept: ["kept a", "kept b"], choice: "first", answered_at: "2026-11-08T10:00:00Z",
    });
    const note = assembleNote([c("me", "q1"), c("friend-1", "q2"), c("friend-1", "q3")], [], [], "me");
    expect(note.readings.map((r) => r.pattern)).toEqual(["pattern q1"]);
  });
});

describe("named songs: a label made only of release formats is a studio recording (recorded deviation)", () => {
  const orig = rec("orig", "Glass Harbour", JV, [rel("1976-08-15", "Single")], "single/LP/12″ version");
  const reissue = rec("re", "Glass Harbour", JV, [rel("2011-01-01")]);
  it("the original, labelled with its formats, is chosen over a later reissue", () => {
    const p = pickStudio([reissue, orig], "", { formatWords: true });
    expect("recording" in p && p.recording.id).toBe("orig");
    expect(candidatesFrom([reissue, orig], "glass harbour")[0]!.year).toBe(1976);
  });
  it("any other word in the label still refuses it", () => {
    for (const d of ["live, Europe", "radio edit", "part of a DJ-mix", "12″ remix", "rehearsal take"]) {
      const p = pickStudio([rec("x", "Glass Harbour", JV, [rel("1976-01-01")], d), reissue], "", { formatWords: true });
      expect("recording" in p && p.recording.id, d).toBe("re");
    }
  });
  it("FR-CORE-1's own list is unchanged without the option", () => {
    const p = pickStudio([reissue, orig]);
    expect("recording" in p && p.recording.id).toBe("re");
  });
  it("an empty release date is unknown, never the earliest", () => {
    const blank = rec("blank", "Glass Harbour", JV, [{ ...rel("2016-11-06"), date: "" }, rel("2016-11-06")]);
    const p = pickStudio([blank]);
    expect("recording" in p && p.date).toBe("2016-11-06");
  });
});

describe("the search's order and what it never shows", () => {
  it("a song whose title (then artist) the person typed comes first, then the song with the most recordings", () => {
    const found = [
      rec("a1", "Star Weather", JV, [rel("2000-01-01")]),
      rec("a2", "Star Weather", JV, [rel("2001-01-01")]),
      rec("b1", "Weather", JV, [rel("2003-01-01")]),
      rec("c1", "Weather", QL, [rel("2010-01-01")]),
      rec("c2", "Weather", QL, [rel("2011-01-01")]),
    ];
    expect(candidatesFrom(found, "weather juniper varga").map((c) => `${c.title}/${c.artist_credit}`)).toEqual(["Weather/Juniper Varga", "Weather/The Quiet Lanterns", "Star Weather/Juniper Varga"]);
    expect(candidatesFrom(found, "weather").map((c) => `${c.title}/${c.artist_credit}`)).toEqual(["Weather/The Quiet Lanterns", "Weather/Juniper Varga", "Star Weather/Juniper Varga"]);
  });
  it("shows no year for a song with no studio release on the page, never a live album's year", () => {
    const live = [rec("l1", "Glass Harbour", JV, [rel("1999-01-01", "Album", ["Live"])])];
    expect(candidatesFrom(live, "glass harbour")[0]!.year).toBeUndefined();
  });
  it("a carve-out word the person did not type is never shown; one they typed is theirs", () => {
    const found = [rec("x1", "Glass Harbour", ["art-x", "Your Anxiety Buddy"], [rel("2025-01-01")]), rec("r1", "Glass Harbour", JV, [rel("2020-01-01")])];
    expect(candidatesFrom(found, "glass harbour").map((c) => c.artist_credit)).toEqual(["Juniper Varga"]);
    expect(candidatesFrom(found, "glass harbour anxiety").map((c) => c.artist_credit)).toContain("Your Anxiety Buddy");
  });
});

describe("one song is one title by one artist credit", () => {
  it("a collaboration is its own song, never labelled with the original's year", () => {
    const muppets = { ...rec("m1", "Glass Harbour", JV, [rel("2009-01-01", "Single")]), "artist-credit": [{ name: "Juniper Varga", joinphrase: " + ", artist: { id: "art-jv", name: "Juniper Varga" } }, { name: "The Puppets", artist: { id: "art-p", name: "The Puppets" } }] };
    const c = candidatesFrom([muppets, rec("o1", "Glass Harbour", JV, [rel("1975-01-01")])], "glass harbour");
    expect(c.map((x) => `${x.artist_credit} · ${x.year}`).sort()).toEqual(["Juniper Varga + The Puppets · 2009", "Juniper Varga · 1975"]);
  });
});

describe("a song typed while the last one is still being added is kept (the friend's walk-through)", () => {
  it("the box empties only if it still holds what was searched", async () => {
    const { afterAdding } = await import("../ui/Songs");
    expect(afterAdding("Clocks Coldplay", "Clocks Coldplay")).toBe("");
    expect(afterAdding("Hey Ya OutKast", "Clocks Coldplay")).toBe("Hey Ya OutKast");
  });
});

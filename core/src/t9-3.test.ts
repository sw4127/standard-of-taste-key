/** T9.3 Lines across my songs (FR-T9.3): thresholds, no line from one song, every reading grounded. */
import { describe, expect, it } from "vitest";
import { EXAMPLE_CATALOGUE } from "./examples";
import type { Part, Song, SongFacts } from "./model";
import { linesAcross, sharedKeyChance, tempoDistance } from "./patterns";
import { KIND_TEMPLATES } from "./templates";

const NOW = new Date("2026-11-07T12:00:00Z");
const byTitle = (t: string) => EXAMPLE_CATALOGUE.find((s) => s.title === t)!;
let n = 0;
const named = (facts: SongFacts, part: Part | "unanswered" = "unanswered", found: Song["entry"]["found_me"] = "unanswered"): Song => ({
  entry: { entry_id: `e${++n}`, person_id: "me", typed_text: facts.title, recording_id: facts.recording_id, comes_back_for: part, found_me: found, entered_at: NOW.toISOString() },
  facts,
});
const kinds = (songs: Song[]) => linesAcross(songs, NOW).map((l) => l.kind);

describe("nothing before the third song", () => {
  it("two songs give no line, however much they share", () => {
    expect(linesAcross([named(byTitle("Glass Harbour"), "the bridge"), named(byTitle("Second Lamp"), "the bridge")], NOW)).toEqual([]);
  });
});

describe("mode and key", () => {
  const four = ["Glass Harbour", "Second Lamp", "The Long Stair", "Kite Weather"].map((t) => named(byTitle(t)));
  it("needs at least four songs measured at key strength 0.5 or more", () => {
    const three = ["Glass Harbour", "Second Lamp", "The Long Stair"].map((t) => named(byTitle(t)));
    expect(kinds(three)).not.toContain("key-major");
    expect(kinds(three)).not.toContain("key-shared");
    // Saltwind's key strength is 0.48: it does not count as measured.
    expect(kinds([...three, named(byTitle("Saltwind"))])).not.toContain("key-major");
  });
  it("names the major share and the shared key, and says it cannot tell whether this is unusual (FR-T9.3 (c))", () => {
    const line = linesAcross(four, NOW).find((l) => l.kind === "key-major")!;
    expect(line.pattern).toBe("All four songs whose key could be measured are in a major key, and three are in B-flat major.");
    expect(line.chance).toBe("I can't tell you whether this is unusual.");
    expect(line.gloss).toBeTruthy();
    expect(line.sound?.key).toBeTruthy();
  });
  it("a key shared only by one artist's songs is not a shared key", () => {
    const one = (t: string, i: number): Song => named({ ...byTitle("Glass Harbour"), recording_id: `x${i}`, title: t });
    const songs = [one("A", 1), one("B", 2), one("C", 3), named(byTitle("Copper Rain")), named(byTitle("Saltwind"))];
    // four measured (Saltwind is too weak): three B-flat by one artist + one D minor → 3/4 major holds, but no shared key
    const line = linesAcross(songs, NOW).find((l) => l.kind.startsWith("key"))!;
    expect(line.pattern).not.toMatch(/share one/);
  });
  it("the shared-key chance is the PRD's worked figure: three of six on one key, about 3 in 100", () => {
    expect(Math.round(sharedKeyChance(3, 6) * 100)).toBe(3);
  });
});

describe("tempo", () => {
  it("treats half and double tempo as the same", () => {
    expect(tempoDistance(92, 184)).toBe(0);
    expect(tempoDistance(96, 101)).toBe(5);
  });
  it("three songs from two or more artists within ±8 BPM make a line, stating the folded reading", () => {
    const songs = ["Glass Harbour", "Kite Weather", "The Long Stair"].map((t) => named(byTitle(t)));
    const line = linesAcross(songs, NOW).find((l) => l.kind === "tempo")!;
    expect(line.pattern).toBe("Three of your songs, by three different artists, move at nearly the same pace: 92 to 96 BPM.");
    expect(line.evidence.some((e) => /read at half speed/.test(e.text))).toBe(true);
  });
});

describe("FR-T9.3 (a): a line built from the count of a single answer is never shown on its own", () => {
  const titles = ["Glass Harbour", "Second Lamp", "Kite Weather", "Copper Rain"];
  it("every answer the same part, or three of four: no part line among the lines", () => {
    expect(kinds(titles.map((t) => named(byTitle(t), "the bridge"))).some((k) => k.startsWith("part:"))).toBe(false);
    expect(kinds(titles.map((t, i) => named(byTitle(t), i < 3 ? "the bridge" : "a verse"))).some((k) => k.startsWith("part:"))).toBe(false);
  });
});

describe("when they came out, and 'That date is wrong'", () => {
  const songs = () => ["Glass Harbour", "Second Lamp", "The Long Stair", "Copper Rain"].map((t) => named(byTitle(t)));
  it("half or more of the songs inside one three-year window, at least three", () => {
    const line = linesAcross(songs(), NOW).find((l) => l.kind === "release-window")!;
    expect(line.pattern).toBe("Three of your four songs came out between 2020 and 2021.");
    expect(line.evidence.every((e) => /first released in \d{4}, according to /.test(e.text) && e.date_of)).toBe(true);
  });
  it("a whole set reads \"All three of your songs\", never \"Three of your three songs\"", () => {
    const three = ["Glass Harbour", "Second Lamp", "The Long Stair"].map((t) => named(byTitle(t)));
    const line = linesAcross(three, NOW).find((l) => l.kind === "release-window")!;
    expect(line.pattern).toMatch(/^All three of your songs came out /);
  });
  it("a disputed date takes the song out of every date line", () => {
    const s = songs();
    s[0]!.facts = { ...s[0]!.facts, date_disputed: true };
    const line = linesAcross(s, NOW).find((l) => l.kind === "release-window");
    expect(line?.entry_ids ?? []).not.toContain(s[0]!.entry.entry_id);
  });
});

describe("found you later", () => {
  it("two or more songs found at least two years after release, judged on the earliest year the answer allows", () => {
    const songs = [
      named(byTitle("Copper Rain"), "unanswered", "this year"), // 2014 → 2026
      named(byTitle("Saltwind"), "unanswered", "the last three years"), // 2008 → no earlier than 2024
      named(byTitle("Lantern Year"), "unanswered", "the last three years"), // 2023 → 2024: not two years
    ];
    const line = linesAcross(songs, NOW).find((l) => l.kind === "found-later")!;
    expect(line.entry_ids).toHaveLength(2);
    expect(kinds([songs[0]!, songs[2]!, named(byTitle("Glass Harbour"), "unanswered", "longer ago")])).not.toContain("found-later");
  });
});

describe("one person behind different singers", () => {
  it("a producer on songs by two lead artists, with the role's meaning beside it", () => {
    const songs = ["Glass Harbour", "Kite Weather", "Copper Rain"].map((t) => named(byTitle(t)));
    const line = linesAcross(songs, NOW).find((l) => l.kind === "shared-person")!;
    expect(line.pattern).toBe("One producer, Kasimir Fenwold, worked on songs by Juniper Varga and Tomasz Ilunga.");
    expect(line.gloss).toMatch(/^Producer: /);
  });
});

describe("every line", () => {
  const all = EXAMPLE_CATALOGUE.map((f, i) => named(f, (["the bridge", "the bridge", "a verse", "the bridge"] as Part[])[i % 4], "this year"));
  const lines = linesAcross(all, NOW);
  it("rests on two or more songs, and offers two grounded readings as questions", () => {
    expect(lines.length).toBeGreaterThanOrEqual(5);
    for (const l of lines) {
      expect(new Set(l.entry_ids).size).toBeGreaterThanOrEqual(2);
      for (const r of l.readings) {
        expect(r.ask.trim().endsWith("?")).toBe(true);
        expect(r.grounding.url).toMatch(/^https:\/\//);
        expect(r.grounding.citation.length).toBeGreaterThan(10);
      }
    }
  });
  it("keeps the pattern to about 20 words", () => {
    for (const l of lines) expect(l.pattern.split(/\s+/).length).toBeLessThanOrEqual(22);
  });
  it("every template kind has two readings and a question", () => {
    for (const t of Object.values(KIND_TEMPLATES)) {
      expect(t.readings).toHaveLength(2);
      expect(t.question.trim().endsWith("?")).toBe(true);
    }
  });
});

describe("thresholds held exactly (each added after a mutation survived)", () => {
  it("the part line needs at least half of the answers, not a plurality", () => {
    const parts: Part[] = ["the bridge", "the bridge", "a verse", "the chorus", "the opening"];
    const songs = ["Glass Harbour", "Second Lamp", "Kite Weather", "Copper Rain", "Saltwind"].map((t, i) => named(byTitle(t), parts[i]));
    expect(kinds(songs).some((k) => k.startsWith("part:"))).toBe(false); // 2 of 5 is under half
  });
  it("the release window needs at least three songs in it, even when two make half", () => {
    const songs = ["Glass Harbour", "Second Lamp", "Saltwind"].map((t) => named(byTitle(t))); // 2020, 2021, 2008
    expect(kinds(songs)).not.toContain("release-window");
  });
  it("one person behind one artist's songs is not a line, however many songs", () => {
    const same = (t: string, i: number): Song =>
      named({ ...byTitle("Glass Harbour"), recording_id: `same${i}`, title: t });
    expect(kinds([same("A", 1), same("B", 2), same("C", 3)])).not.toContain("shared-person");
  });
});

// ---- The rework of 2026-11-10 (FR-T9.3 changed), built in R6 -----------------------------------

import { CANT_SAY_UNUSUAL, foundYears, isSoundLine, restsOnSentence } from "./patterns";
import { LIBRARY, SHIPPING, shipping } from "./library";

const found = (facts: SongFacts, f: Song["entry"]["found_me"], year?: number): Song => {
  const s = named(facts, "unanswered", f);
  return year ? { ...s, entry: { ...s.entry, found_year: year } } : s;
};

describe("(b) the period line", () => {
  const four = () => [
    found(byTitle("Glass Harbour"), "longer ago", 2020),
    found(byTitle("Second Lamp"), "longer ago", 2021),
    found(byTitle("Kite Weather"), "longer ago", 2022),
    found(byTitle("Copper Rain"), "this year"),
  ];
  it("with a birth year: ages; the reading is LIB-2's finding as a question, answered Yes, No, something else, or Neither", () => {
    const line = linesAcross(four(), NOW, { birthYear: 2001 }).find((l) => l.kind === "period")!;
    expect(line.pattern).toBe("Three of your four records found you between the ages of 18 and 21.");
    expect(line.prompt).toBe(`${shipping("LIB-2").sentence} Is that what these records are for you?`);
    expect(line.readings.map((r) => r.answer)).toEqual(["Yes", "No, something else"]);
    expect(line.readings.every((r) => r.grounding.library_id === "LIB-2")).toBe(true);
    expect(line.evidence.every((e) => e.source.label === "Your answer")).toBe(true);
  });
  it("without a birth year: years, not ages", () => {
    expect(linesAcross(four(), NOW).find((l) => l.kind === "period")!.pattern).toBe("Three of your four records found you between 2020 and 2022.");
  });
  it("needs at least three records with a found year or range; \"longer ago\" with no year has none", () => {
    expect(foundYears(found(byTitle("Glass Harbour"), "longer ago").entry, 2026)).toBeNull();
    expect(foundYears(found(byTitle("Glass Harbour"), "the last three years").entry, 2026)).toEqual([2024, 2026]);
    const two = [found(byTitle("Glass Harbour"), "longer ago", 2020), found(byTitle("Second Lamp"), "longer ago", 2021), found(byTitle("Kite Weather"), "longer ago")];
    expect(kinds(two)).not.toContain("period");
  });
  it("three placed records, only two of them in one stretch: no period line", () => {
    const songs = [found(byTitle("Glass Harbour"), "longer ago", 2020), found(byTitle("Second Lamp"), "longer ago", 2021), found(byTitle("Kite Weather"), "longer ago", 2010)];
    expect(kinds(songs)).not.toContain("period");
  });
  it("the records must sit inside one stretch of five years, and be at least half of those placed", () => {
    const spread = [2000, 2008, 2016, 2024].map((y, i) => found(EXAMPLE_CATALOGUE[i]!, "longer ago", y));
    expect(kinds(spread)).not.toContain("period");
  });
});

describe("(c) key and tempo sit behind \"More patterns, in sound\", each saying it cannot tell whether this is unusual", () => {
  const songs = () => ["Glass Harbour", "Second Lamp", "The Long Stair", "Kite Weather"].map((t) => named(byTitle(t)));
  it("they come after every other line, say so, and carry what to hear", () => {
    const lines = linesAcross(songs(), NOW);
    const firstSound = lines.findIndex((l) => isSoundLine(l));
    expect(firstSound).toBeGreaterThan(-1);
    expect(lines.slice(firstSound).every((l) => isSoundLine(l))).toBe(true);
    for (const l of lines.filter((x) => isSoundLine(x))) {
      expect(l.chance).toBe(CANT_SAY_UNUSUAL);
      expect(l.sound?.key ?? l.sound?.bpm).toBeTruthy();
    }
  });
  it("the readings for tempo and mode cite LIB-9", () => {
    expect(KIND_TEMPLATES["key-major"]!.readings.every((r) => r.grounding.library_id === "LIB-9")).toBe(true);
    expect(KIND_TEMPLATES.tempo!.readings.every((r) => r.grounding.library_id === "LIB-9")).toBe(true);
  });
});

describe("(d) every line says how many of his records it rests on", () => {
  it("in a whole sentence, counting each record once", () => {
    const songs = ["Glass Harbour", "Second Lamp", "The Long Stair", "Copper Rain"].map((t) => named(byTitle(t)));
    for (const l of linesAcross(songs, NOW)) {
      expect(l.restsOn).toBe(new Set(l.entry_ids).size);
      expect(restsOnSentence(l.restsOn, l.entry_ids, songs)).toMatch(/^This rests on (two|three|four|five|six|seven|eight|nine|ten) of your songs\.$/);
    }
  });
});

describe("(f) only library entries marked \"may ship\" are used", () => {
  it("the library is one data file of twelve entries; LIB-4, LIB-8 and LIB-11 do not ship; no entry was added", () => {
    expect(LIBRARY.map((e) => e.id)).toEqual(["LIB-1", "LIB-2", "LIB-3", "LIB-4", "LIB-5", "LIB-6", "LIB-7", "LIB-8", "LIB-9", "LIB-10", "LIB-11", "PHIL-1"]);
    expect(SHIPPING.map((e) => e.id)).toEqual(["LIB-1", "LIB-2", "LIB-3", "LIB-5", "LIB-6", "LIB-7", "LIB-9", "LIB-10", "PHIL-1"]);
    for (const id of ["LIB-4", "LIB-8", "LIB-11"]) expect(() => shipping(id)).toThrow(/may not ship/);
  });
  it("every entry says its citation, its address, when it was opened and how it was read; PHIL-1 is labelled as philosophy", () => {
    for (const e of LIBRARY) {
      expect(e.sentence.length, e.id).toBeGreaterThan(30);
      expect(e.citation.length, e.id).toBeGreaterThan(10);
      expect(e.read_as.length, e.id).toBeGreaterThan(3);
      if (e.ships) expect(e.url, e.id).toMatch(/^https:\/\//);
      if (e.ships) expect(e.opened, e.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    expect(shipping("PHIL-1").label).toMatch(/philosophy/);
    expect(shipping("PHIL-1").sentence).toMatch(/^A philosopher's account, not a study/);
  });
  it("no reading cites an entry that may not ship, and no reading cites a finding from outside the library", () => {
    const notShipping = LIBRARY.filter((e) => !e.ships);
    const definitions = new Set(["https://help.suno.com/en/articles/9010177", "https://en.wikipedia.org/wiki/Key_(music)", "https://musicbrainz.org/relationships/artist-recording"]);
    for (const t of Object.values(KIND_TEMPLATES)) {
      for (const r of t.readings) {
        if (r.grounding.library_id) expect(shipping(r.grounding.library_id).url, r.template_id).toBe(r.grounding.url);
        else expect(definitions.has(r.grounding.url), `${r.template_id}: ${r.grounding.url}`).toBe(true);
        for (const e of notShipping) expect(r.grounding.citation.includes(e.citation), r.template_id).toBe(false);
      }
    }
  });
});

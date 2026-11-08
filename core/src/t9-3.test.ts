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
  it("names the major share and the shared key, with the chance figure and its assumption", () => {
    const line = linesAcross(four, NOW).find((l) => l.kind === "key-major")!;
    expect(line.pattern).toBe("Four of your four measured songs are in a major key, and three share one: B-flat major.");
    expect(line.chance).toMatch(/if major and minor were equally likely/);
    expect(line.chance).toMatch(/if all 24 keys were equally likely/);
    expect(line.gloss).toBeTruthy();
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

describe("the part named most", () => {
  const titles = ["Glass Harbour", "Second Lamp", "Kite Weather", "Copper Rain"];
  it("a part named for at least half of three or more answers", () => {
    const songs = titles.map((t, i) => named(byTitle(t), i < 3 ? "the bridge" : "a verse"));
    const line = linesAcross(songs, NOW).find((l) => l.kind === "part:the bridge")!;
    expect(line.pattern).toBe("Where you named the part you come back for, it was the bridge in three of four songs, and never the chorus.");
    expect(line.evidence.every((e) => e.source.label === "Your answer")).toBe(true);
  });
  it("two answers are not enough; a tie is no line; 'not sure' does not count", () => {
    expect(kinds(titles.slice(0, 3).map((t, i) => named(byTitle(t), i < 2 ? "the bridge" : "not sure")))).not.toContain("part:the bridge");
    expect(kinds(titles.map((t, i) => named(byTitle(t), i < 2 ? "the bridge" : "a verse"))).some((k) => k.startsWith("part:"))).toBe(false);
  });
  it("a part with no cited definition (the voice, the words) gives no line", () => {
    expect(kinds(titles.map((t) => named(byTitle(t), "the voice"))).some((k) => k.startsWith("part:"))).toBe(false);
    expect(kinds(titles.map((t) => named(byTitle(t), "the words"))).some((k) => k.startsWith("part:"))).toBe(false);
  });
});

describe("when they came out, and 'That date is wrong'", () => {
  const songs = () => ["Glass Harbour", "Second Lamp", "The Long Stair", "Copper Rain"].map((t) => named(byTitle(t)));
  it("half or more of the songs inside one three-year window, at least three", () => {
    const line = linesAcross(songs(), NOW).find((l) => l.kind === "release-window")!;
    expect(line.pattern).toBe("Three of your four songs came out between 2020 and 2021.");
    expect(line.evidence.every((e) => /first release .* lists: \d{4}/.test(e.text) && e.date_of)).toBe(true);
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
      named(byTitle("Saltwind"), "unanswered", "a year or two ago"), // 2008 → no earlier than 2024
      named(byTitle("Lantern Year"), "unanswered", "a year or two ago"), // 2023 → 2024: not two years
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

/** T8.2 Template checks before shipping (FR-T8.2 = FR-CORE-2): register and carve-out, at test time and at display time. */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { breaches, type Layer } from "./checks";
import { EXAMPLE_CATALOGUE, exampleHistory } from "./examples";
import { LOOKBACK_READINGS, lookBack, type LookBackLine } from "./lookback";
import type { HistoryRow, Part, Song, SongFacts } from "./model";
import { lineBreaches, linesAcross, namesIn } from "./patterns";
import { KIND_TEMPLATES, ROLE_MEANING } from "./templates";

/**
 * The 30 planted specimens of the Stage 6 checks (21 must fail, 9 must pass), ported as fixtures.
 * One change: a real producer's name in specimen 23 is replaced by an invented one (fixtures are
 * synthetic); the specimen tests the same shape.
 */
const SPECIMENS: [Layer, string, boolean][] = [
  ["key", "You were sad that week.", false],
  ["key", "You keep coming back to it because you feel lost.", false],
  ["key", "This shows you are a romantic.", false],
  ["key", "Deep down, this is your song.", false],
  ["key", "You played it more than most listeners.", false],
  ["key", "Your childhood is in this record.", false],
  ["key", "You played it four times; maybe it eased your anxiety.", false],
  ["fact", "A sad song, recorded in 1971.", false],
  ["fact", "Recorded in a week; the band was grieving its drummer.", false],
  ["fact", "Mixed by the same engineer as your favourites, which proves you love warm mixes.", false],
  ["story", "You will know this feeling when you walk home.", false],
  ["story", "A song for anyone who has been through trauma.", false],
  ["story", "Written after the singer's suicide attempt.", false],
  ["story", "Better than average for a breakup song.", false],
  ["story", "听这首歌的人，大多数人都哭过。", false],
  ["key", "你一定很孤独。", false],
  ["key", "这说明你是个念旧的人。", false],
  ["story", "那年他刚走出抑郁。", false],
  ["offer", "This song is about your loss.", false],
  ["offer", "You feel it at night.", false],
  ["story", "A song for the therapy you never had.", false],
  ["key", "You saved it in March 2025, eleven months after it came out.", true],
  ["key", "Three of the songs you saved share one producer: Kasimir Fenwold.", true],
  ["fact", "Five people are credited on this recording. Two of them wrote it.", true],
  ["fact", "The words are not the singer's own: two other writers are credited.", true],
  ["story", "A slow song that waits a long time before the drums come in.", true],
  ["story", "In 1757 a philosopher told a story about two men, a cask of wine, and a key.", true],
  ["story", "Some songs are for the walk home, not the party.", true],
  ["story", "那年冬天，他每天坐最后一班车回家。", true],
  ["offer", "Was it the song, or where you were when it played?", true],
];

describe("the planted specimens", () => {
  it("are 30: 21 must fail and 9 must pass", () => {
    expect(SPECIMENS).toHaveLength(30);
    expect(SPECIMENS.filter((s) => !s[2])).toHaveLength(21);
  });
  it.each(SPECIMENS)("%s · %s → passes: %s", (layer, text, shouldPass) => {
    expect(breaches(text, layer).length === 0).toBe(shouldPass);
  });
});

describe("traditional characters and full-width letters are caught too", () => {
  it("folds traditional Chinese before the Chinese lists read it", () => {
    expect(breaches("創傷", "fact").length).toBeGreaterThan(0);
    expect(breaches("憂鬱的你一定很孤獨", "key").length).toBeGreaterThan(0);
    expect(breaches("ＴＲＡＵＭＡ", "fact").length).toBeGreaterThan(0);
  });
});

describe("every template passes before it ships", () => {
  const fills = { key: "B-flat major", role: "producer" };
  const sub = (t: string) => t.replace(/\{(\w+)\}/g, (_, k: string) => fills[k as keyof typeof fills] ?? "x");
  it("readings are questions; kept readings, questions and glossary meanings pass", () => {
    for (const t of Object.values(KIND_TEMPLATES)) {
      for (const r of t.readings) {
        expect(breaches(sub(r.ask), "offer"), r.ask).toEqual([]);
        expect(breaches(sub(r.kept), "said"), r.kept).toEqual([]);
        expect(breaches(`You said: ${sub(r.kept)}.`, "said")).toEqual([]);
      }
      expect(breaches(t.question, "offer"), t.question).toEqual([]);
    }
    for (const [role, meaning] of Object.entries(ROLE_MEANING)) expect(breaches(`${role}: ${meaning}.`, "fact")).toEqual([]);
    for (const pair of Object.values(LOOKBACK_READINGS)) {
      for (const r of pair) {
        expect(breaches(r.ask, "offer")).toEqual([]);
        expect(breaches(r.kept, "said")).toEqual([]);
      }
    }
  });

  it("every fixed sentence on the shared screens passes", () => {
    const dir = join(__dirname, "..", "ui");
    const texts: string[] = [];
    for (const f of readdirSync(dir).filter((x) => x.endsWith(".tsx"))) {
      const src = readFileSync(join(dir, f), "utf8");
      for (const m of src.matchAll(/>([^<>{}]*[A-Za-z][^<>{}]*)</g)) texts.push(m[1]!.trim());
      for (const m of src.matchAll(/"([A-Z][^"]{8,})"/g)) texts.push(m[1]!);
    }
    expect(texts.length).toBeGreaterThan(40);
    // The person's own voice on a control: the PRD's wording for the drop (FR-T2.6), held to "said".
    const OWN_VOICE = new Set(["Not why I love it"]);
    for (const t of texts) expect(breaches(t, OWN_VOICE.has(t) ? "said" : "fact"), t).toEqual([]);
  });

  it("every line the example songs can make passes as filled", () => {
    const parts: Part[] = ["the bridge", "a verse", "the chorus", "the opening", "the beat", "the sound of it"];
    for (const top of parts.slice(0, 1)) {
      const songs: Song[] = EXAMPLE_CATALOGUE.map((f, i) => ({
        entry: { entry_id: `e${i}`, person_id: "me", typed_text: f.title, recording_id: f.recording_id, comes_back_for: i < 6 ? top : "a verse", found_me: "this year", entered_at: "2026-11-07T12:00:00Z" },
        facts: f,
      }));
      const lines = linesAcross(songs, new Date("2026-11-07T12:00:00Z"), { birthYear: 2001 });
      // The part line is never shown on its own (FR-T9.3 (a)); the period line needs the birth year.
      expect(lines.some((l) => l.kind.startsWith("part:"))).toBe(false);
      expect(lines.map((l) => l.kind)).toEqual(expect.arrayContaining(["period", "release-window", "key-major", "tempo"]));
      for (const l of lines) expect(lineBreaches(l, namesIn(songs))).toEqual([]);
    }
  });
});

describe("filled sentences, checked at display time", () => {
  const NOW = new Date("2026-11-07T12:00:00Z");
  const as = (f: SongFacts, i: number): Song => ({
    entry: { entry_id: `x${i}`, person_id: "me", typed_text: f.title, recording_id: f.recording_id, comes_back_for: "the bridge", found_me: "unanswered", entered_at: NOW.toISOString() },
    facts: f,
  });
  const three = EXAMPLE_CATALOGUE.slice(0, 3);
  const kinds = (fs: SongFacts[]) => linesAcross(fs.map(as), NOW).map((l) => l.kind);

  it("a song titled with a carve-out word yields no line", () => {
    expect(kinds(three)).toContain("release-window");
    for (const title of ["Trauma Bond", "Therapy Session", "抑郁症", "憂鬱症", "創傷"]) {
      const renamed = [{ ...three[0]!, title }, three[1]!, three[2]!];
      expect(kinds(renamed), title).not.toContain("release-window");
    }
  });
  it("an artist or a credited person named with a carve-out word yields no line either", () => {
    expect(kinds([{ ...three[0]!, artist_credit: "The Anxiety Club" }, three[1]!, three[2]!])).not.toContain("release-window");
    const shared = ["Glass Harbour", "Kite Weather", "Copper Rain"].map((t) => EXAMPLE_CATALOGUE.find((s) => s.title === t)!);
    expect(kinds(shared)).toContain("shared-person");
    const relabel = shared.map((s) => ({ ...s, people: s.people.map((p) => ({ ...p, name: "Dr. Self-Harm" })) }));
    expect(kinds(relabel)).not.toContain("shared-person");
  });
  it("a title that is a feeling word is quoted, not stated: the line still shows", () => {
    const renamed = [{ ...three[0]!, title: "Lost" }, { ...three[1]!, title: "Lonely Hearts" }, three[2]!];
    expect(kinds(renamed)).toContain("release-window");
  });
  it("a look-back artist named with a carve-out word yields no line; the next strongest takes its place", () => {
    const stretch = { year: 2026, q: 3 } as const;
    const rows: HistoryRow[] = exampleHistory().map((r) => (r.artist === "Aurelio Tamm" ? { ...r, artist: "Grief Machine" } : r));
    const before = lookBack(exampleHistory(), stretch).map((l: LookBackLine) => l.kind);
    const after = lookBack(rows, stretch);
    expect(before).toContain("arrived");
    expect(after.map((l) => l.kind)).not.toContain("arrived");
    expect(after.some((l) => /Grief/.test(l.pattern))).toBe(false);
  });
});

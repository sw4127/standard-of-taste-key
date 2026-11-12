/**
 * T9.10 The gate before the reading is shown to anyone (FR-T9.10).
 * Part 1: made-up model outputs, each breaking one rule; every one refused by code, and one
 * well-formed output passed. Part 2's counts (fresh runs on made-up people) are read from gate.json
 * and re-checked here against the stored outputs. Part 3: the reading sheet for the swap test with
 * decoys. Part 4: fails closed.
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { mix } from "./judge";
import { checkReading, squash, type Guess, type Quote } from "./reading/check";
import { sentFor } from "./reading/facts";
import { freshPasses, GATE, MIN_PLANTED, NOT_READY, plantedPasses, readingReady, type GateRecord } from "./reading/gate";
import { questionsFile, readingSheet, readQuestionsFile, redact, sheetCounts, theirReading, type ReadingRow } from "./reading/rows";
import { GOOD_A, PERSON_A, PERSON_B, PERSON_C, type ExamplePerson } from "./testing/reading";

const here = dirname(fileURLToPath(import.meta.url));
const sentOf = (p: ExamplePerson) => sentFor(p.songs, p.words, { mayQuote: () => true });
const SENT_A = sentOf(PERSON_A);
const good = GOOD_A.guesses[0]!;
const one = (over: Partial<Guess>) => ({ guesses: [{ ...good, ...over }] });

/** Each planted output breaks one rule. The name says which. */
export const PLANTED: { name: string; output: unknown; sent?: ReturnType<typeof sentOf> }[] = [
  { name: "an altered quote (a word changed)", output: one({ quotes: [{ record_id: "R1", quote: "I worked night shifts in a bakery in Leeds" }, good.quotes[1]!] }) },
  { name: "a quote taken from the wrong record's answer", output: one({ quotes: [{ record_id: "R2", quote: "I worked night shifts at a bakery in Leeds" }, good.quotes[1]!] }) },
  { name: "a third guess", output: { guesses: [good, good, good] } },
  { name: "a guess resting on one record", output: one({ quotes: [{ record_id: "R1", quote: "I worked night shifts at a bakery in Leeds" }, { record_id: "R1", quote: "when the streets were empty" }], fact_ids: [] }) },
  { name: "a guess tying two events of the person's life to each other", output: one({ question: "Did the night shifts at the bakery lead to the walk home at five in the morning, the winter both records arrived?" }) },
  {
    name: "a claim that a record gave a belief his sentence does not credit to it",
    output: one({ question: "Did Glass Harbour teach you that slowing down is a kind of rest?", what_it_did: [{ record_id: "R2", quote: "My days then were upside down: sleep until two, flour on everything." }] }),
  },
  { name: "advice", output: one({ question: "Both records arrived that winter at the bakery. Should you play them on the walk home again?" }) },
  { name: "a word of diagnosis", output: one({ question: "Were these the records of a depressed winter at the bakery?" }) },
  { name: "comfort", output: one({ question: "That winter must have been hard. Did both records arrive during the night shifts at the bakery?" }) },
  { name: "a score", output: one({ question: "Your two answers score 9/10 for that winter. Is the bakery what joins these records?" }) },
  { name: "a library ID that may not ship", output: one({ library_id: "LIB-4" }) },
  { name: "a fragment in place of a sentence", output: one({ question: "The bakery, the walk home, that winter?" }) },
  // Added by this build, each a rule the PRD names:
  { name: "a percentage", output: one({ question: "Is the bakery 80% of what joins these two records?" }) },
  { name: "a question that asks why", output: one({ question: "Why did both records arrive in the winter of the night shifts?" }) },
  { name: "not valid to the shape (a field missing)", output: { guesses: [{ question: good.question, quotes: good.quotes, fact_ids: [], library_id: "none", rests_on: 2 }] } },
  { name: "not valid to the shape (not JSON)", output: "Here is a reading: both records came in winter." },
  { name: "a question longer than 45 words", output: one({ question: `${"Both records arrived in the same winter of night shifts at the bakery, ".repeat(4)}is that right?` }) },
  { name: "a fact that was not sent", output: one({ fact_ids: ["F99"] }) },
  { name: "a library ID that does not exist", output: one({ library_id: "LIB-99" }) },
  {
    name: "a quote translated from Chinese",
    sent: sentOf(PERSON_C),
    output: { guesses: [{ question: "Did both records arrive in the summer you moved to Chengdu?", quotes: [{ record_id: "R1", quote: "I had just moved to Chengdu" }, { record_id: "R2", quote: "也是那个夏天" }], what_it_did: [], fact_ids: [], library_id: "none", rests_on: 2 }] },
  },
  { name: "a record said to have helped, with no sentence of his naming it so", output: one({ question: "Did the song help you through the night shifts at the bakery?", what_it_did: [] }) },
];

describe("FR-T9.10 part 1: planted outputs, each refused by code", () => {
  it(`there are at least ${MIN_PLANTED}`, () => expect(PLANTED.length).toBeGreaterThanOrEqual(MIN_PLANTED));
  for (const p of PLANTED) {
    it(`refuses ${p.name}`, () => {
      const r = checkReading(typeof p.output === "string" ? p.output : JSON.stringify(p.output), p.sent ?? SENT_A);
      expect(r.ok, JSON.stringify(r)).toBe(false);
    });
  }
  it("passes the well-formed output, and counts the records it rests on by code", () => {
    const r = checkReading(JSON.stringify(GOOD_A), SENT_A);
    expect(r).toMatchObject({ ok: true });
    if (r.ok) expect(r.guesses[0]!.records).toEqual(["R1", "R2"]);
  });
  it("passes a quote whose spaces and line breaks differ, and nothing else", () => {
    const spaced = one({ quotes: [{ record_id: "R1", quote: "I worked night  shifts\nat a bakery in Leeds" }, good.quotes[1]!] });
    expect(checkReading(JSON.stringify(spaced), SENT_A).ok).toBe(true);
    const cased = one({ quotes: [{ record_id: "R1", quote: "I Worked night shifts at a bakery in Leeds" }, good.quotes[1]!] });
    expect(checkReading(JSON.stringify(cased), SENT_A).ok).toBe(false);
  });
  it("passes none, for a person whose records have no story", () => {
    expect(checkReading('{"guesses": []}', sentOf(PERSON_B))).toEqual({ ok: true, guesses: [] });
  });
  it("passes a Chinese quote word for word, and a sentence of his that names the song as acting", () => {
    const c = { guesses: [{ question: "Both records came in the summer of 2021. Was that the summer you rode to the internship and worked late?", quotes: [{ record_id: "R1", quote: "2021年夏天，我刚搬到成都" }, { record_id: "R2", quote: "也是那个夏天" }], what_it_did: [{ record_id: "R1", quote: "它让我在堵车的时候也不着急。" }], fact_ids: [], library_id: "none", rests_on: 2 }] };
    expect(checkReading(JSON.stringify(c), sentOf(PERSON_C)).ok).toBe(true);
  });
  it("gate.json's planted counts are what this file proves", () => {
    const refused = PLANTED.filter((p) => !checkReading(typeof p.output === "string" ? p.output : JSON.stringify(p.output), p.sent ?? SENT_A).ok).length;
    expect(GATE.planted).toEqual({ outputs: PLANTED.length, refused, good_passed: checkReading(JSON.stringify(GOOD_A), SENT_A).ok });
  });
});

describe("FR-T9.10 part 2: fresh runs on made-up people, re-checked from the stored outputs", () => {
  const dir = join(here, "..", "..", "checks", "reading-gate");
  const runs = GATE.fresh?.runs ?? [];
  it("the prompts the runs were given are the prompts the build sends now (a changed prompt needs fresh runs)", async () => {
    const { readingPrompt } = await import("./reading/prompt");
    const { writeFileSync, mkdirSync } = await import("node:fs");
    for (const p of [PERSON_A, PERSON_B, PERSON_C]) {
      const file = join(dir, `prompt-${p.id}.txt`);
      if (process.env.GATE_WRITE_PROMPTS) {
        mkdirSync(dir, { recursive: true });
        writeFileSync(file, readingPrompt(sentOf(p)));
      }
      expect(readFileSync(file, "utf8")).toBe(readingPrompt(sentOf(p)));
    }
  });
  it("every run in gate.json has its output stored, and the counts are what the checks give", () => {
    for (const r of runs) {
      const file = join(dir, `${r.person}-${r.run}.json`);
      expect(existsSync(file), file).toBe(true);
      const out = readFileSync(file, "utf8");
      const p = { a: PERSON_A, b: PERSON_B, c: PERSON_C }[r.person];
      const checked = checkReading(out, sentOf(p));
      expect(checked.ok, `${r.person}-${r.run}`).toBe(!r.refused_by_code);
      const parsed = JSON.parse(out) as { guesses: { quotes: Quote[]; what_it_did: Quote[] }[] };
      const quotes = parsed.guesses.flatMap((g) => [...g.quotes, ...g.what_it_did]);
      const answers = sentOf(p).records;
      expect(parsed.guesses.length).toBe(r.guesses);
      expect(quotes.length).toBe(r.quotes);
      expect(quotes.filter((q) => squash(answers.find((x) => x.record_id === q.record_id)?.answer ?? "").includes(squash(q.quote))).length).toBe(r.quotes_word_for_word);
    }
  });
});

describe("FR-T9.10 part 3: the reading sheet for the swap test with decoys", () => {
  const mine: ReadingRow = { reading_id: "r-me", person_id: "me", made_at: "2026-11-12T10:00:00Z", model: "m", sent_hash: "h", guesses: [] };
  // Two made-up people's guesses: "me" (person A's) and a second person's (person C's), each with quotes and record names.
  mine.guesses = [
    { guess_id: "g1", question: "Did Glass Harbour arrive on the walk home from the bakery?", quotes: [{ record_id: "R1", entry_id: "a1", title: "Glass Harbour", quote: "the walk home" }], what_it_did: [], facts: [], library_id: "none", rests_on: 2 },
    { guess_id: "g2", question: "Is Second Lamp the record of the night shifts?", quotes: [{ record_id: "R2", entry_id: "a2", title: "Second Lamp", quote: "night shift" }], what_it_did: [], facts: [], library_id: "none", rests_on: 2 },
  ];
  const theirs: ReadingRow = {
    reading_id: "r-them", person_id: "me", made_at: "2026-11-12T10:00:00Z", model: "m", sent_hash: "h",
    guesses: [
      { guess_id: "t1", question: "Did Kite Weather come in the summer you wrote “我刚搬到成都”?", quotes: [{ record_id: "R1", entry_id: "c1", title: "Kite Weather", quote: "我刚搬到成都" }], what_it_did: [], facts: [{ fact_id: "F1", text: "The listener says it found them longer ago, about 2021." }], library_id: "none", rests_on: 2 },
      { guess_id: "t2", question: "Is The Long Stair the record of the balcony?", quotes: [{ record_id: "R2", entry_id: "c2", title: "The Long Stair", quote: "the balcony" }], what_it_did: [], facts: [], library_id: "none", rests_on: 2 },
    ],
  };
  const file = questionsFile([theirs], "2026-11-12T11:00:00Z");
  const back = readQuestionsFile(JSON.stringify(file))!;
  const held = theirReading(back, "person-r", "2026-11-12T11:05:00Z");

  it("a question in their file that fails the register or carve-out check is left out on import", () => {
    const edited = { ...file, questions: [...file.questions, { id: "x", question: "Were these the songs of your depression?" }, { id: "y", question: "You are a lonely listener." }] };
    expect(readQuestionsFile(JSON.stringify(edited))!.questions.map((q) => q.id)).toEqual(file.questions.map((q) => q.id));
  });
  it("the second person's file holds no quote, fact or record name", () => {
    const text = JSON.stringify(file);
    for (const x of ["Kite Weather", "The Long Stair", "我刚搬到成都", "the balcony", "about 2021"]) expect(text).not.toContain(x);
    expect(file.questions).toHaveLength(2);
  });
  it("mixes both people's guesses by a seeded shuffle, the same order every time", () => {
    const a = readingSheet([mine, held], "me", "person-r", mix);
    const b = readingSheet([mine, held], "me", "person-r", mix);
    expect(a).toEqual(b);
    expect(a.map((x) => x.id).sort()).toEqual(["g1", "g2", "person-r:t1", "person-r:t2"]);
    expect(a.map((x) => x.owner)).not.toEqual(["me", "me", "person-r", "person-r"]);
  });
  it("hides whose they are: his own questions are shown with quotes and record names taken out too", () => {
    const sheet = readingSheet([mine, held], "me", "person-r", mix);
    const text = sheet.map((x) => x.question).join(" ");
    for (const x of ["Glass Harbour", "Second Lamp", "the walk home", "night shift"]) expect(text).not.toContain(x);
    expect(redact(mine.guesses[0]!)).toBe("Did […] arrive on […] from the bakery?");
  });
  it("counts, per owner, how many were marked Mine", () => {
    const sheet = readingSheet([mine, held], "me", "person-r", mix);
    const answers = { g1: "Mine", g2: "Can't tell", "person-r:t1": "Mine", "person-r:t2": "Not mine" };
    expect(sheetCounts(sheet, answers)).toEqual({ me: { mine: 1, answered: 2, of: 2 }, "person-r": { mine: 1, answered: 2, of: 2 } });
  });
});

describe("FR-T9.10 part 4: fails closed", () => {
  const passing: GateRecord = {
    run_on: "x",
    planted: { outputs: 12, refused: 12, good_passed: true },
    fresh: { model_level: "sonnet", runs: (["a", "b", "c"] as const).flatMap((person) => [1, 2, 3].map((run) => ({ person, run, quotes: 2, quotes_word_for_word: 2, guesses: person === "b" ? 0 : 1, refused_by_code: false, rules_broken: 0 }))) },
  };
  it("passes only when both parts pass", () => {
    expect(readingReady(passing)).toBe(true);
    expect(readingReady({ ...passing, fresh: null })).toBe(false);
    expect(readingReady({ ...passing, planted: { outputs: 11, refused: 11, good_passed: true } })).toBe(false);
    expect(readingReady({ ...passing, planted: { outputs: 12, refused: 11, good_passed: true } })).toBe(false);
    expect(plantedPasses({ ...passing, planted: { outputs: 12, refused: 12, good_passed: false } })).toBe(false);
  });
  it("part 2 fails on one altered quote, one guess for (b), or one broken rule", () => {
    const f = passing.fresh!;
    expect(freshPasses({ ...passing, fresh: { ...f, runs: f.runs.map((r, i) => (i === 0 ? { ...r, quotes_word_for_word: 1 } : r)) } })).toBe(false);
    expect(freshPasses({ ...passing, fresh: { ...f, runs: f.runs.map((r) => (r.person === "b" && r.run === 2 ? { ...r, guesses: 1 } : r)) } })).toBe(false);
    expect(freshPasses({ ...passing, fresh: { ...f, runs: f.runs.map((r, i) => (i === 4 ? { ...r, rules_broken: 1 } : r)) } })).toBe(false);
    expect(freshPasses({ ...passing, fresh: { ...f, runs: f.runs.filter((r) => !(r.person === "c" && r.run === 3)) } })).toBe(false);
  });
  it("the words shown when closed", () => expect(NOT_READY).toBe("The reading is not ready yet."));
  it("round 1 of the fresh runs is kept, and it failed: one question was over 45 words", () => {
    const round1 = readFileSync(join(here, "..", "..", "checks", "reading-gate", "round-1", "counts.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l) as { reasons: string[] });
    expect(round1).toHaveLength(9);
    expect(round1.flatMap((r) => r.reasons)).toEqual(["guess 1: a question longer than 45 words"]);
  });
});

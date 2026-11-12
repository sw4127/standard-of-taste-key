/**
 * T1.2, the coverage bar (FR-CORE-1 v7, acceptance c): the split, the hiding of the second half until
 * the rule is frozen, and the count Bob's bar is read from. The live runs are in coverage-run.test.ts.
 */
import { describe, expect, it } from "vitest";
import { MATCH_FIXTURES } from "../core/src/match/fixtures";
import { GATE_TUNING_TITLES } from "./gate/tuning-titles";
import { COVERAGE_MARKS, fingerprint, hiddenState, MIN_TITLES, split, tally, type CoverageMark, type Frozen } from "./coverage/coverage";
import { COVERAGE_TITLES } from "./coverage/titles";

describe("the titles Bob pasted", () => {
  it("at least 40, each once", () => {
    expect(COVERAGE_TITLES.length).toBeGreaterThanOrEqual(MIN_TITLES);
    expect(new Set(COVERAGE_TITLES).size).toBe(COVERAGE_TITLES.length);
  });
  it("none is a title the rule was already tuned or tested on", () => {
    const seen = new Set([...MATCH_FIXTURES.map((f) => f.title), ...GATE_TUNING_TITLES]);
    expect(COVERAGE_TITLES.filter((t) => seen.has(t))).toEqual([]);
  });
});

describe("the split", () => {
  const titles = Array.from({ length: 41 }, (_, i) => `title ${i}`);
  it("is the same every time, covers every title once, and gives the hidden half no more than the open half", () => {
    const a = split(titles), b = split(titles);
    expect(a).toEqual(b);
    expect([...a.open, ...a.hidden].sort()).toEqual([...titles].sort());
    expect(a.open.length).toBe(21);
    expect(a.hidden.length).toBe(20);
  });
  it("is a shuffle: the hidden half is not simply the end of the list", () => {
    expect(split(titles).hidden).not.toEqual(titles.slice(21));
    expect(split(titles, 1).hidden).not.toEqual(split(titles, 2).hidden);
  });
  it("refuses fewer than 40 titles", () => {
    expect(() => split(titles.slice(0, 39))).toThrow(/at least 40/);
  });
});

describe("the hidden half stays hidden until the rule is frozen, and is void if the rule changes afterwards", () => {
  const now = { rule_version: "v7.0", fingerprint: fingerprint(["the rule"]) };
  const frozen: Frozen = { ...now, frozen_at: "2026-11-11T12:00Z" };
  it("not frozen: the hidden half may not be run", () => {
    expect(hiddenState(null, now, false).state).toBe("not frozen");
  });
  it("frozen and unchanged: it may run", () => {
    expect(hiddenState(frozen, now, false)).toEqual({ state: "may run" });
    expect(hiddenState(frozen, now, true)).toEqual({ state: "may run" });
  });
  it("the rule changed before the hidden half was seen: freeze again first", () => {
    expect(hiddenState(frozen, { ...now, fingerprint: fingerprint(["the rule, changed"]) }, false).state).toBe("not frozen");
  });
  it("the rule changed after the hidden half was seen: the result is void and a fresh hidden half is needed", () => {
    const s = hiddenState(frozen, { ...now, fingerprint: fingerprint(["the rule, changed"]) }, true);
    expect(s.state).toBe("void");
    expect(s.state === "void" && s.why).toMatch(/fresh hidden half/);
    expect(hiddenState(frozen, { ...now, rule_version: "v7.1" }, true).state).toBe("void");
  });
  it("the fingerprint ignores line endings and nothing else", () => {
    expect(fingerprint(["a\r\nb"])).toBe(fingerprint(["a\nb"]));
    expect(fingerprint(["a\nb"])).not.toBe(fingerprint(["a\nb "]));
    expect(fingerprint(["a", "b"])).not.toBe(fingerprint(["ab"]));
  });
});

describe("the freeze cannot be redone in another form once the hidden half has been seen", () => {
  it("the runner refuses to freeze a changed rule after the hidden half was run", async () => {
    const src = (await import("node:fs")).readFileSync(new URL("./coverage/run.ts", import.meta.url), "utf8");
    expect(src).toMatch(/existsSync\(HIDDEN\) && was && was\.fingerprint !== now\.fingerprint/);
    expect(src).toMatch(/A fresh hidden half is needed before the rule is frozen again/);
  });
});

describe("the bar: at least 8 in 10 nameable videos named, none wrong", () => {
  const marks = (n: Partial<Record<CoverageMark, number>>) => COVERAGE_MARKS.flatMap((m) => Array<CoverageMark>(n[m] ?? 0).fill(m));
  it("8 named of 10 nameable meets it; 7 of 10 does not", () => {
    expect(tally(marks({ "Named, and right": 8, "Silent, and the song is on MusicBrainz": 2 })).passes).toBe(true);
    expect(tally(marks({ "Named, and right": 7, "Silent, and the song is on MusicBrainz": 3 })).passes).toBe(false);
    expect(tally(marks({ "Named, and right": 15, "Silent, and the song is on MusicBrainz": 4 })).passes).toBe(false); // 15 of 19 is under 8 in 10
    expect(tally(marks({ "Named, and right": 16, "Silent, and the song is on MusicBrainz": 4 })).passes).toBe(true);
  });
  it("one wrong song fails it, however many are named", () => {
    const t = tally(marks({ "Named, and right": 30, "Named, and wrong": 1 }));
    expect(t.passes).toBe(false);
    expect(t.wrong).toBe(1);
  });
  it("songs not on MusicBrainz and whole albums are set aside: they neither help nor hurt", () => {
    const t = tally(marks({ "Named, and right": 8, "Silent, and the song is on MusicBrainz": 2, "Silent, and the song is not on MusicBrainz": 20, "A whole album, or not a song": 3 }));
    expect(t).toMatchObject({ videos: 33, setAside: 23, nameable: 10, named: 8, passes: true });
  });
  it("an unmarked row means no result yet; and nothing nameable is no pass", () => {
    expect(tally([...marks({ "Named, and right": 9 }), undefined]).passes).toBe(false);
    expect(tally(marks({ "Silent, and the song is not on MusicBrainz": 5 })).passes).toBe(false);
  });
});

describe("reading a pasted video list (run 3 onward)", () => {
  it("each length line is followed by its title; counts, dates and page tabs are left out", async () => {
    const { readPaste } = await import("./coverage/paste");
    const raw = ["音频", "0", "TA的视频", "最新发布", "", "04:24", "「戳爷She’s the Best」FF - Troye Sivan", "作词 : Troye Sivan", "9378", "1", "10月15日", "", "34:06", "「后摇之神」I - II - III- IV - V - VI By Athletics", "作词 : 作曲 :", "14.1万", "485", "6月11日", "1:02:03", "A long video"].join("\n");
    expect(readPaste(raw)).toEqual([
      { title: "「戳爷She’s the Best」FF - Troye Sivan", seconds: 264 },
      { title: "「后摇之神」I - II - III- IV - V - VI By Athletics", seconds: 2046 },
      { title: "A long video", seconds: 3723 },
    ]);
  });
  it("run 2's lengths are on file for every title", async () => {
    const { COVERAGE_SECONDS } = await import("./coverage/titles");
    for (const t of COVERAGE_TITLES) expect(COVERAGE_SECONDS[t], t).toBeGreaterThan(60);
  });
});

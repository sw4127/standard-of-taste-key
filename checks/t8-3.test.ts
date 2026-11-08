/** T8.3 The launch gate (FR-T8.3): a fresh list of 50, from another uploader; 0 wrong or unprovable matches to pass. */
import { describe, expect, it } from "vitest";
import { MATCH_FIXTURES } from "../core/src/match/fixtures";
import { GATE_SIZE, listProblems, MARKS, RIGHT, sheetMarkdown, titlesFrom, TUNING_UPLOADER, verdict, type GateRow, type Mark } from "./gate/gate";

const fresh = (n: number) => Array.from({ length: n }, (_, i) => `Example Singer ${i}《Example Song ${i}》`);
const match = (i: number, mark?: Mark, dateDoubtful = false): GateRow => ({
  i, title: `t${i}`, mark, dateDoubtful,
  result: { state: "certain", candidate: { recording_id: `r${i}`, title: `Song ${i}`, artist_credit: "Example Singer", first_release: "2001" } },
});
const silent = (i: number): GateRow => ({ i, title: `t${i}`, result: { state: "silent", reason: "no candidate" } });
const sheet = (matched: GateRow[]) => [...matched, ...Array.from({ length: GATE_SIZE - matched.length }, (_, k) => silent(matched.length + k))];

describe("the list", () => {
  it("takes one title per line, leaving out durations, counts, dates and repeats", () => {
    expect(titlesFrom("Singer《Song》\n03:45\n12.3万\n2026-11-01\n\n  Singer《Song》 \n另一位《歌》\n1234播放")).toEqual(["Singer《Song》", "另一位《歌》"]);
  });
  it("must be exactly 50 titles, from a named uploader other than the one that tuned v6, none seen before", () => {
    expect(listProblems("Example Uploader", fresh(50))).toEqual([]);
    expect(listProblems("Example Uploader", fresh(49))[0]).toMatch(/exactly 50/);
    expect(listProblems("", fresh(50))[0]).toMatch(/Name the uploader/);
    expect(listProblems(TUNING_UPLOADER, fresh(50)).join()).toMatch(/other than/);
    expect(listProblems("Example Uploader", [...fresh(49), `某人《某歌》${TUNING_UPLOADER}`]).join()).toMatch(/other than/);
    expect(listProblems("Example Uploader", [...fresh(49), MATCH_FIXTURES[60]!.title]).join()).toMatch(/used to write or tune/);
  });
});

describe("the marks", () => {
  it("are five, one per case, with Right the only pass", () => {
    expect(MARKS).toHaveLength(5);
    expect(MARKS[0]).toBe(RIGHT);
  });
});

describe("the verdict", () => {
  it("passes only when every match is marked Right, and still states the rule of three", () => {
    const v = verdict(sheet([match(0, RIGHT), match(1, RIGHT)]));
    expect(v.state).toBe("pass");
    expect(v.reason).toMatch(/about 6%/);
    expect(v.matched).toBe(2);
    expect(v.silent).toBe(48);
  });
  it("fails on any wrong or unprovable mark, even before the rest are marked", () => {
    for (const m of MARKS.slice(1)) expect(verdict(sheet([match(0, RIGHT), match(1, m), match(2)])).state).toBe("fail");
  });
  it("fails when every match is marked and just one is not Right", () => {
    for (const m of MARKS.slice(1)) expect(verdict(sheet([match(0, RIGHT), match(1, RIGHT), match(2, m)])).state).toBe("fail");
  });
  it("waits while matches are unmarked", () => {
    expect(verdict(sheet([match(0, RIGHT), match(1)])).state).toBe("not yet marked");
  });
  it("a doubtful date is listed, never counted against the rule", () => {
    const v = verdict(sheet([match(0, RIGHT, true)]));
    expect(v.state).toBe("pass");
    expect(v.datesDoubtful).toBe(1);
  });
  it("titles still to run are reported as waiting, never as failed", () => {
    const rows = sheet([match(0, RIGHT)]);
    rows[7] = { i: 7, title: "t7", result: { state: "waiting" } };
    const v = verdict(rows);
    expect(v.state).toBe("incomplete");
    expect(v.reason).toMatch(/1 title still to run/);
    expect(v.errors).toBe(0);
  });
  it("a title that could not be run leaves the gate incomplete", () => {
    const rows = sheet([match(0, RIGHT)]);
    rows[5] = { i: 5, title: "t5", result: { state: "error" } };
    expect(verdict(rows).state).toBe("incomplete");
  });
  it("silence is never counted as wrong: coverage is reported, not gated", () => {
    expect(verdict(sheet([])).state).toBe("pass");
  });
});

describe("the sheet file", () => {
  it("lists every title with what v6 did, the mark, a link to the recording, and the verdict", () => {
    const md = sheetMarkdown("Example Uploader", "a list page", sheet([match(0, RIGHT, true)]), "2026-11-08T20:00:00Z");
    expect(md).toMatch(/Verdict: PASS/);
    expect(md).toMatch(/https:\/\/musicbrainz\.org\/recording\/r0/);
    expect(md.split("\n").filter((l) => /^\| \d+ \|/.test(l))).toHaveLength(50);
  });
});

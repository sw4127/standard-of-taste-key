/** FR-CORE-4 The check-A sheet and the swap test: five answers that cover every case, mixed lines, the pass rule as written. */
import { describe, expect, it } from "vitest";
import { CHECK_A, mix, SWAP, swapResult, tallyCheckA, type Judged, type Swap } from "./judge";

describe("check A", () => {
  it("offers five answers, in Bob's ruling's words", () => {
    expect(CHECK_A).toEqual([
      "True, new to me, and it matters to me",
      "True and new to me, but I don't care",
      "True, but I already knew it",
      "Not true when I check",
      "I can't check it",
    ]);
  });
  it("every case of true × new × matters lands on exactly one answer", () => {
    type Truth = "true" | "not true" | "can't check";
    const answerFor = (truth: Truth, isNew: boolean, matters: boolean): string[] =>
      CHECK_A.filter((a) => {
        if (a === "I can't check it") return truth === "can't check";
        if (a === "Not true when I check") return truth === "not true";
        if (truth !== "true") return false;
        if (a === "True, but I already knew it") return !isNew;
        if (a === "True, new to me, and it matters to me") return isNew && matters;
        return isNew && !matters;
      });
    for (const truth of ["true", "not true", "can't check"] as Truth[])
      for (const isNew of [true, false])
        for (const matters of [true, false]) expect(answerFor(truth, isNew, matters), `${truth}/${isNew}/${matters}`).toHaveLength(1);
  });
  it("counts each answer, and ignores answers from the earlier set", () => {
    const t = tallyCheckA([
      { line_id: "a", owner: "me", value: "Not true when I check" },
      { line_id: "b", owner: "me", value: "True, new to me, and it matters to me" },
      { line_id: "c", owner: "me", value: "Not true when I check" },
      { line_id: "d", owner: "me", value: "Neither" },
    ]);
    expect(t["Not true when I check"]).toBe(2);
    expect(t["True, new to me, and it matters to me"]).toBe(1);
    expect(Object.values(t).reduce((x, y) => x + y)).toBe(3);
  });
});

describe("the swap test", () => {
  it("asks Mine · Not mine · Can't tell", () => {
    expect(SWAP).toEqual(["Mine", "Not mine", "Can't tell"]);
  });
  it("mixes both people's lines in a fixed order that is not grouped by owner", () => {
    const a = ["a1", "a2", "a3", "a4"].map((id) => ({ id }));
    const b = ["b1", "b2", "b3", "b4"].map((id) => ({ id }));
    const m = mix(a, b, "me", "friend");
    expect(m).toHaveLength(8);
    expect(mix(a, b, "me", "friend")).toEqual(m);
    const owners = m.map((x) => x.owner).join(",");
    expect(owners).not.toBe("me,me,me,me,friend,friend,friend,friend");
    expect(owners).not.toBe("friend,friend,friend,friend,me,me,me,me");
  });
  const j = (owner: string, value: Swap, i: number): Judged<Swap> => ({ line_id: `${owner}${i}`, owner, value });
  it("passes when at least half of one's own lines are Mine and at most one of the other's is", () => {
    const pass = [j("me", "Mine", 1), j("me", "Can't tell", 2), j("friend", "Mine", 1), j("friend", "Not mine", 2)];
    expect(swapResult(pass, "me")).toEqual({ own: { mine: 1, of: 2 }, other: { mine: 1, of: 2 }, passes: true });
  });
  it("fails when under half of one's own are Mine, or two of the other's are", () => {
    expect(swapResult([j("me", "Mine", 1), j("me", "Not mine", 2), j("me", "Can't tell", 3)], "me").passes).toBe(false);
    expect(swapResult([j("me", "Mine", 1), j("friend", "Mine", 1), j("friend", "Mine", 2)], "me").passes).toBe(false);
  });
  it("judged from the other person's side, the same answers read the other way", () => {
    const answers = [j("me", "Not mine", 1), j("friend", "Mine", 1), j("friend", "Mine", 2)];
    expect(swapResult(answers, "friend").passes).toBe(true);
  });
});

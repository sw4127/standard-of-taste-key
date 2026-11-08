/** FR-CORE-4 The check-A sheet and the swap test: four answers, mixed lines, the pass rule as written. */
import { describe, expect, it } from "vitest";
import { CHECK_A, mix, SWAP, swapResult, tallyCheckA, type Judged, type Swap } from "./judge";

describe("check A", () => {
  it("offers exactly the four answers, in the PRD's words", () => {
    expect(CHECK_A).toEqual(["New to me, and true when I check", "New to me, but I don't care", "Moved me, taught me nothing", "Neither"]);
  });
  it("counts each answer", () => {
    const t = tallyCheckA([
      { line_id: "a", owner: "me", value: "Neither" },
      { line_id: "b", owner: "me", value: "New to me, and true when I check" },
      { line_id: "c", owner: "me", value: "Neither" },
    ]);
    expect(t.Neither).toBe(2);
    expect(t["New to me, and true when I check"]).toBe(1);
    expect(t["Moved me, taught me nothing"]).toBe(0);
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

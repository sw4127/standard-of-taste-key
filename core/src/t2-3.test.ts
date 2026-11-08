/** T2.3 Credit facts appear only in a proof or in "How it was made" (FR-T2.3). */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { OWN_READINGS, QUIET, QUIET_OFFER } from "./firstwords";

describe("no first-words template needs a credit", () => {
  it("the first-words module never reads people, places, key or tempo", () => {
    const src = readFileSync(join(__dirname, "firstwords.ts"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(src).not.toMatch(/(song|facts\[[^\]]*\]\??)\.(people|places|key|bpm)\b|ROLE_MEANING|STORIES|storyFor/);
  });
  it("its fixed words name no role", () => {
    const words = [QUIET, QUIET_OFFER, ...Object.values(OWN_READINGS).flat().flatMap((r) => [r.ask, r.kept])];
    for (const w of words) expect(w).not.toMatch(/producer|mixer|engineer|writer|arranger|performer|credited/i);
  });
});

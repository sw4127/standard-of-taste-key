/** T3.4 Sancho's story (FR-T3.4): by itself on the first proof, once more on a later day, then only on tap. */
import { describe, expect, it } from "vitest";
import { breaches } from "./checks";
import { sanchoByItself } from "./proof";
import { SANCHO } from "./stories";

describe("when the story shows by itself, over three simulated days", () => {
  it("first proof ever: yes; again that day: no; first proof the next day: yes; then never by itself", () => {
    let count = 0;
    let last: string | undefined;
    const open = (day: string) => {
      const show = sanchoByItself(count, last, day);
      if (show) {
        count++;
        last = day;
      }
      return show;
    };
    expect([open("2026-11-08"), open("2026-11-08"), open("2026-11-09"), open("2026-11-09"), open("2026-11-10"), open("2026-11-11")]).toEqual([true, false, true, false, false, false]);
  });
});

describe("the story", () => {
  it("is a three-sentence retelling plus Hume's own line, with its source on davidhume.org", () => {
    expect(SANCHO.retelling).toHaveLength(3);
    expect(SANCHO.hume).toMatch(/leathern thong/);
    expect(SANCHO.source.url).toBe("https://davidhume.org/texts/empl1/st");
  });
  it("passes the story checks: it never addresses the reader", () => {
    for (const t of [...SANCHO.retelling, SANCHO.hume]) expect(breaches(t, "story")).toEqual([]);
  });
});

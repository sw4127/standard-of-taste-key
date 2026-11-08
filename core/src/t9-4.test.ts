/** T9.4 A question to think with (FR-T9.4): about memory and context, never "why". */
import { describe, expect, it } from "vitest";
import { KIND_TEMPLATES } from "./templates";

describe("questions to think with", () => {
  it("no question template contains 'why'", () => {
    for (const t of Object.values(KIND_TEMPLATES)) expect(t.question.toLowerCase()).not.toMatch(/\bwhy\b/);
  });
  it("no reading asks 'why' either (moment map: never ask why)", () => {
    for (const t of Object.values(KIND_TEMPLATES)) for (const r of t.readings) expect(r.ask.toLowerCase()).not.toMatch(/\bwhy\b/);
  });
});

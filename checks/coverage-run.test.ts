/**
 * The coverage bar's live runs (FR-CORE-1 v7, acceptance c; never part of `npm test`: each step
 * needs its own switch).
 *   COVERAGE=open    npx vitest run checks/coverage-run.test.ts   run the open half, write its sheet
 *   COVERAGE=freeze  …                                            freeze the rule as it is now
 *   COVERAGE=hidden  …                                            run the hidden half (refused unless frozen and unchanged)
 *   COVERAGE=sheet   …                                            rewrite the hidden half's sheet from its results and marks
 */
import { writeFileSync } from "node:fs";
import { expect, it } from "vitest";
import type { CoverageMark } from "./coverage/coverage";
import { freeze, frozen, halves, hiddenSheet, openSheet, paths, readJson, runTitles, stateNow, type Row } from "./coverage/run";

const mode = process.env.COVERAGE;

it.skipIf(mode !== "open")("the open half", async () => {
  const rows = await runTitles(halves().open, true);
  writeFileSync(paths.openSheet, openSheet(rows));
}, 3_600_000);

it.skipIf(mode !== "freeze")("freeze the rule", () => {
  freeze(new Date().toISOString().slice(0, 16) + "Z");
});

it.skipIf(mode !== "hidden")("the hidden half, only when the rule is frozen and unchanged", async () => {
  expect(stateNow()).toEqual({ state: "may run" });
  const rows = await runTitles(halves().hidden, true);
  writeFileSync(paths.HIDDEN, JSON.stringify(rows, null, 1) + "\n");
  writeFileSync(paths.hiddenSheet, hiddenSheet(rows, readJson<Record<string, CoverageMark>>(paths.MARKS) ?? {}, frozen()!, "none yet."));
}, 3_600_000);

it.skipIf(mode !== "sheet")("rewrite the hidden half's sheet", () => {
  const rows = readJson<Row[]>(paths.HIDDEN)!;
  const marks = readJson<Record<string, CoverageMark> & { _marked_by?: string }>(paths.MARKS) ?? {};
  writeFileSync(paths.hiddenSheet, hiddenSheet(rows, marks, frozen()!, (marks._marked_by as string | undefined) ?? "none yet."));
});

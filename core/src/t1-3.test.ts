/** T1.3 When the rule is silent (FR-T1.3): each silence reason gives the silent state, with recordings to pick from. */
import { describe, expect, it } from "vitest";
import { parseTitle } from "./match/parse";
import type { MbRecording } from "./match/studio";
import { decide } from "./match/v6";

const rec = (id: string, title: string, artist: string, extra: Partial<MbRecording> = {}): MbRecording => ({
  id, title, score: 100, "artist-credit": [{ name: artist, artist: { id: artist, name: artist } }],
  releases: [{ id: `r${id}`, status: "Official", date: "2015-01-01", "release-group": { id: `rg${id}`, "primary-type": "Album" } }], ...extra,
});

describe("FR-T1.3: every silence reason gives the silent state, with recordings to pick from", () => {
  const p = parseTitle("Juniper Varga《Glass Harbour》");
  const cases: [string, MbRecording[]][] = [
    ["no candidate", [rec("a", "Other Song", "Juniper Varga")]],
    ["no studio recording", [rec("a", "Glass Harbour", "Juniper Varga", { releases: [{ id: "r", status: "Bootleg", date: "2015", "release-group": { id: "g", "primary-type": "Album" } }] })]],
    ["only clean edits", [rec("a", "Glass Harbour", "Juniper Varga", { disambiguation: "clean" })]],
  ];
  it.each(cases)("%s", (reason, rs) => {
    const r = decide(p, rs);
    expect(r.state).toBe("silent");
    expect(r.state === "silent" && r.reason).toBe(reason);
    expect(r.candidates.length).toBeGreaterThan(0);
    expect(r.candidates.length).toBeLessThanOrEqual(8);
  });
  it("a title naming no song or no artist is silent too", () => {
    expect(decide(parseTitle("【4K】"), []).state).toBe("silent");
    expect(decide(parseTitle("《Glass Harbour》"), []).state).toBe("silent");
  });
  it("Fix offers at most eight recordings, each with title, artist, first release and record", () => {
    const many = Array.from({ length: 12 }, (_, i) => rec(`m${i}`, "Glass Harbour", `Someone ${i}`));
    const r = decide(p, many);
    expect(r.candidates).toHaveLength(8);
    expect(r.candidates[0]).toMatchObject({ title: "Glass Harbour", artist_credit: "Someone 0", first_release: "2015-01-01" });
  });
});


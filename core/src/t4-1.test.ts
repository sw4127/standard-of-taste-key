/** T4.1 How it was made (FR-T4.1): credits grouped in plain words, every role followed by its meaning. */
import { describe, expect, it } from "vitest";
import { breaches } from "./checks";
import type { CreditRole } from "./model";
import { howItWasMade, MADE_GROUPS, NO_CREDITS } from "./proof";
import { ROLE_MEANING } from "./templates";
import { SONG } from "./testing/panel";

const src = { label: "MusicBrainz", url: "https://musicbrainz.org/recording/x" };

describe("how it was made", () => {
  it("every role shown has a glossary entry, and every role has a group", () => {
    const roles = Object.keys(ROLE_MEANING) as CreditRole[];
    for (const r of roles) expect(MADE_GROUPS.some((g) => g.roles.includes(r)), r).toBe(true);
    for (const g of MADE_GROUPS) for (const r of g.roles) expect(ROLE_MEANING[r]).toBeTruthy();
  });
  it("groups the credits, each as name, role (what was played): meaning", () => {
    const made = howItWasMade({
      ...SONG,
      people: [
        { name: "Odile Brannock", role: "mixer", source: src },
        { name: "Pell Arnaut", role: "performer", detail: "guitar", source: src },
        { name: "Juniper Varga", role: "writer", source: src },
      ],
      places: [{ name: "Example Studio", role: "recorded at", date: "2019-06", source: src }],
    })!;
    expect(made.map((g) => g.heading)).toEqual(["Who wrote it", "Who played and sang", "Who produced, recorded, mixed and mastered it", "Where and when"]);
    expect(made[1]!.lines[0]!.text).toBe("Pell Arnaut, performer (guitar): a person who plays or sings on the recording.");
    expect(made[2]!.lines[0]!.text).toBe("Odile Brannock, mixer: the person who balances the parts into the final sound.");
    expect(made[3]!.lines[0]!.text).toBe("Recorded at Example Studio, 2019-06.");
    for (const g of made) for (const l of g.lines) expect(breaches(l.text, "fact", ["Odile Brannock", "Pell Arnaut", "Juniper Varga", "Example Studio"])).toEqual([]);
  });
  it("a song with no credits says so", () => {
    expect(howItWasMade({ ...SONG, people: [] })).toBeNull();
    expect(NO_CREDITS).toBe("MusicBrainz lists no credits for this recording yet.");
  });
});

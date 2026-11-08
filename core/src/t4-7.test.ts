/** T4.7 A friend's plays of this artist (FR-T4.7): thresholds on a synthetic history. */
import { describe, expect, it } from "vitest";
import { friendLine, friendName } from "./firstwords";
import type { Person } from "./storage";
import { FRIEND, friendPlays } from "./testing/panel";

describe("the friend line", () => {
  it("needs 20 or more plays of 30 seconds or more of this artist", () => {
    const short = friendPlays(30, "Juniper Varga", "Harbour Lights", () => "Glass Harbour", "2025-05", 12_000);
    expect(friendLine({ "person-f": [...friendPlays(19, "Juniper Varga", "Harbour Lights", () => "Glass Harbour"), ...short] }, [FRIEND], "Juniper Varga")).toBeNull();
    expect(friendLine({ "person-f": friendPlays(20, "Juniper Varga", "Harbour Lights", () => "Glass Harbour") }, [FRIEND], "Juniper Varga")?.text).toBe("Your friend has played this artist 20 times.");
  });
  it("names where to start: the most-played record and the quarter it was played most", () => {
    const rows = [
      ...friendPlays(15, "Juniper Varga", "Harbour Lights", () => "Glass Harbour", "2025-05"),
      ...friendPlays(4, "Juniper Varga", "Harbour Lights", () => "Glass Harbour", "2025-09"),
      ...friendPlays(8, "Juniper Varga", "Second Album", () => "Low Bell", "2026-02"),
    ];
    const l = friendLine({ "person-f": rows }, [FRIEND], "Juniper Varga")!;
    expect(l.under).toBe("Where to start: Harbour Lights, the record they played most, in April to June 2025.");
  });
  it("lists the three most played songs, never one with fewer than five plays", () => {
    const rows = [
      ...friendPlays(12, "Juniper Varga", "A", () => "One"),
      ...friendPlays(6, "Juniper Varga", "A", () => "Two"),
      ...friendPlays(4, "Juniper Varga", "A", () => "Three"),
    ];
    const l = friendLine({ "person-f": rows }, [FRIEND], "Juniper Varga")!;
    expect(l.proof.at(-1)!.text).toBe("Their most played songs by this artist: One (12), Two (6)");
  });
  it("matches the artist across traditional and simplified spellings, and needs a consent note", () => {
    const rows = friendPlays(20, "周杰倫", "葉惠美", () => "晴天");
    expect(friendLine({ "person-f": rows }, [FRIEND], "周杰伦")).not.toBeNull();
    const noConsent: Person = { ...FRIEND, consent_note: "" };
    expect(friendLine({ "person-f": rows }, [noConsent], "周杰伦")).toBeNull();
    expect(friendLine({ me: rows.map((r) => ({ ...r, person_id: "me" })) }, [{ ...FRIEND, person_id: "me" }], "周杰伦")).toBeNull();
  });
  it("calls the friend what the person calls them", () => {
    expect(friendName("my friend")).toBe("Your friend");
    expect(friendName("my sister")).toBe("Your sister");
    expect(friendName("Ana")).toBe("Ana");
  });
});

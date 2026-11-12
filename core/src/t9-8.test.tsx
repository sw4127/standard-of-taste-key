// @vitest-environment happy-dom
/**
 * T9.8 When it found you (FR-T9.8): one bar of nested ranges, the narrowest true one tapped, the wider
 * ones lit with it; "can't say" beside; an optional year for "longer ago"; an optional birth year in
 * this browser. Also T9.2 (changed): an album's own options for "What do you come back for?".
 */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { NavContext } from "../ui/nav";
import { Songs } from "../ui/Songs";
import { fromSnapshot, getState, seedForTests, toSnapshot } from "../ui/store";
import { EXAMPLE_CATALOGUE } from "./examples";
import { ALBUM_PARTS, FOUND, FOUND_RANGES, litRanges, readFound, type NamedSong } from "./model";
import { foundNoEarlierThan } from "./patterns";
import { albumFacts } from "./sources/albums";

const song = EXAMPLE_CATALOGUE[0]!;
const entry = (over: Partial<NamedSong> = {}): NamedSong => ({ entry_id: "e1", person_id: "me", typed_text: song.title, recording_id: song.recording_id, comes_back_for: "unanswered", found_me: "unanswered", entered_at: "2026-11-12T10:00:00Z", ...over });

describe("the ranges", () => {
  it("four nested ranges and \"can't say\"; each range lies inside the next", () => {
    expect([...FOUND]).toEqual(["this month", "this year", "the last three years", "longer ago", "can't say"]);
    expect([...FOUND_RANGES]).toEqual(["this month", "this year", "the last three years", "longer ago"]);
  });
  it("a pick lights itself and every wider range; \"can't say\" lights none", () => {
    expect(litRanges("this month")).toEqual(["this month", "this year", "the last three years", "longer ago"]);
    expect(litRanges("the last three years")).toEqual(["the last three years", "longer ago"]);
    expect(litRanges("can't say")).toEqual([]);
    expect(litRanges("unanswered")).toEqual([]);
  });
  it("answers stored under the earlier five options are read as the PRD says", () => {
    expect(["this month", "this year", "a year or two ago", "longer ago", "can't say", "unanswered", "nonsense"].map(readFound)).toEqual(["this month", "this year", "the last three years", "longer ago", "can't say", "unanswered", "unanswered"]);
  });
  it("an old answer saved in this browser comes back as the new range", () => {
    const snap = toSnapshot({ ...getState(), ready: true, songs: [entry({ found_me: "a year or two ago" as never })] });
    expect(fromSnapshot(snap).songs[0]!.found_me).toBe("the last three years");
  });
  it("the found-later line reads the ranges and the year: no claim made on a guess", () => {
    expect(foundNoEarlierThan(entry({ found_me: "this month" }), 2026)).toBe(2026);
    expect(foundNoEarlierThan(entry({ found_me: "the last three years" }), 2026)).toBe(2024);
    expect(foundNoEarlierThan(entry({ found_me: "longer ago" }), 2026)).toBeUndefined();
    expect(foundNoEarlierThan(entry({ found_me: "longer ago", found_year: 2015 }), 2026)).toBe(2015);
    expect(foundNoEarlierThan(entry({ found_me: "can't say" }), 2026)).toBeUndefined();
  });
});

describe("the bar on the screen", () => {
  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.stubGlobal("fetch", () => Promise.reject(new Error("no network in tests")));
  });
  let host: HTMLElement;
  let un: (() => void) | null = null;
  afterEach(() => {
    un?.();
    un = null;
  });
  async function open(songs: NamedSong[], facts = { [song.recording_id]: song }) {
    seedForTests({ songs, facts });
    host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => root.render(<NavContext.Provider value={{ go: () => {} }}><Songs /></NavContext.Provider>));
    un = () => {
      act(() => root.unmount());
      host.remove();
    };
    const opener = [...host.querySelectorAll("button")].find((b) => b.textContent === "Answer the two questions")!;
    await act(async () => opener.click());
  }
  const button = (label: string) => [...host.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent === label)!;

  it("a pick of \"this month\" stores one range, never two, and the wider ranges light", async () => {
    await open([entry()]);
    await act(async () => button("this month").click());
    expect(getState().songs[0]!.found_me).toBe("this month");
    const lit = [...host.querySelectorAll(".found-range.lit")].map((b) => b.textContent);
    expect(lit).toEqual(["longer ago", "the last three years", "this year", "this month"]);
    expect(host.querySelectorAll('.found-range[aria-pressed="true"]')).toHaveLength(1);
  });
  it("the ranges are drawn one inside the next: each narrower than the one around it", async () => {
    await open([entry()]);
    const widths = [...host.querySelectorAll<HTMLElement>(".found-range")].map((b) => parseInt(b.style.width));
    expect(widths).toEqual([100, 75, 50, 25]);
  });
  it("\"longer ago\" offers an optional year, kept with that range only", async () => {
    await open([entry()]);
    await act(async () => button("longer ago").click());
    const year = host.querySelector<HTMLInputElement>('input[type="number"].year-field:not(#birth-year)')!;
    expect(year).not.toBeNull();
    await act(async () => {
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      set.call(year, "2015");
      year.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(getState().songs[0]).toMatchObject({ found_me: "longer ago", found_year: 2015 });
    await act(async () => button("this year").click());
    expect(getState().songs[0]!.found_year).toBeUndefined();
  });
  it("an album asks \"When did this album find you?\" and offers its own options, never \"the chorus\"", async () => {
    const a = albumFacts({ key: "album:rg1", kind: "album", release_group_id: "rg1", title: "Lantern Year", artist_credit: "Juniper Varga", lead_artist_id: "jv", lead_artist: "Juniper Varga", year: 2021 });
    await open([entry({ recording_id: a.recording_id, kind: "album" })], { [a.recording_id]: a });
    expect(host.textContent).toContain("When did this album find you?");
    for (const p of ALBUM_PARTS) expect(button(p), p).toBeTruthy();
    expect(host.textContent).not.toContain("the chorus");
    await act(async () => button("how it flows from start to finish").click());
    expect(getState().songs[0]!.comes_back_for).toBe("how it flows from start to finish");
  });
  it("a song keeps its own options", async () => {
    await open([entry()]);
    expect(button("the chorus")).toBeTruthy();
    expect(host.textContent).toContain("When did this song find you?");
  });
});

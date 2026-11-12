// @vitest-environment happy-dom
/**
 * T9.1, the additions of 2026-11-10 (FR-T9.1): albums in the search, labelled; an album stored as an
 * album, never as its title track; "Add several at once"; the screen's sentence. Albums count as
 * records in the date lines and take no part in key, tempo or "part named most" lines. Every album
 * and song here is made up (rule 8).
 */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { lineQuery } from "../ui/Naming";
import { NavContext } from "../ui/nav";
import { Songs } from "../ui/Songs";
import { actions, getState, seedForTests } from "../ui/store";
import { EXAMPLE_CATALOGUE } from "./examples";
import { albumId, isAlbum, type NamedSong, type SongFacts } from "./model";
import { linesAcross } from "./patterns";
import { albumFacts, albumQuery, albumsFrom, type MbReleaseGroup } from "./sources/albums";
import { fromRows, toRows } from "./storage";

const rg = (id: string, title: string, artist: string, date: string, over: Partial<MbReleaseGroup> = {}): MbReleaseGroup => ({
  id, title, score: 100, "primary-type": "Album", "first-release-date": date, "artist-credit": [{ name: artist, artist: { id: `a-${artist}`, name: artist } }], ...over,
});

describe("the search lists albums, labelled, and only an artist's own studio albums", () => {
  it("every typed word must stand in the title or the artist; the exact title is boosted", () => {
    expect(albumQuery("Lantern Year Juniper")).toBe('(releasegroup:"Lantern Year Juniper"^5 OR ((releasegroup:Lantern OR artistname:Lantern) AND (releasegroup:Year OR artistname:Year) AND (releasegroup:Juniper OR artistname:Juniper))) AND primarytype:album');
  });
  it("compilations, live albums and soundtracks are left out; a typed title comes first; at most three", () => {
    const got = albumsFrom([
      rg("1", "Greatest Lanterns", "Juniper Varga", "2019", { "secondary-types": ["Compilation"] }),
      rg("2", "Live at the Harbour", "Juniper Varga", "2018", { "secondary-types": ["Live"] }),
      rg("3", "Second Lamp", "Juniper Varga", "2015"),
      rg("4", "Lantern Year", "Juniper Varga", "2021-01-22"),
      rg("5", "Single Lamp", "Juniper Varga", "2016", { "primary-type": "Single" }),
      rg("6", "Low Score", "Juniper Varga", "2017", { score: 60 }),
      rg("7", "Third Lamp", "Juniper Varga", "2022"),
      rg("8", "Fourth Lamp", "Juniper Varga", "2023"),
    ], "lantern year");
    expect(got.map((a) => a.title)).toEqual(["Lantern Year", "Second Lamp", "Third Lamp"]);
    expect(got[0]).toMatchObject({ kind: "album", release_group_id: "4", year: 2021, key: "album:4" });
  });
});

describe("an album is stored as an album, never as its title track (Stage 9: Dawn FM)", () => {
  const facts = albumFacts({ key: "album:rg9", kind: "album", release_group_id: "rg9", title: "Lantern Year", artist_credit: "Juniper Varga", lead_artist_id: "jv", lead_artist: "Juniper Varga", year: 2021 });
  it("its row is the release group: kind album, its own ID, its first release year and source page", () => {
    expect(facts).toMatchObject({ recording_id: albumId("rg9"), kind: "album", release_group_id: "rg9", title: "Lantern Year", first_release_year: 2021 });
    expect(facts.date_source.url).toBe("https://musicbrainz.org/release-group/rg9");
    expect(facts.key).toBeUndefined();
    expect(facts.bpm).toBeUndefined();
  });
  it("survives being saved and read back from this browser's database", () => {
    const { recording, facts: rows } = toRows(facts, "my pick", "2026-11-12T10:00:00Z");
    expect(fromRows(recording, rows)).toMatchObject({ recording_id: "album:rg9", kind: "album", release_group_id: "rg9" });
  });
  it("adding it makes an album entry, and the same title track can be named beside it as a song", () => {
    seedForTests({});
    const a = actions.addSong(facts, "lantern year", "me");
    const track: SongFacts = { ...EXAMPLE_CATALOGUE[7]!, title: "Lantern Year" };
    const t = actions.addSong(track, "lantern year", "me");
    const songs = getState().songs;
    expect(songs.find((s) => s.entry_id === a)!.kind).toBe("album");
    expect(isAlbum(songs.find((s) => s.entry_id === t)!)).toBe(false);
  });
});

describe("albums in the lines across records", () => {
  const entry = (f: SongFacts, i: number, kind?: "album", over: Partial<NamedSong> = {}): { entry: NamedSong; facts: SongFacts } => ({
    entry: { entry_id: `e${i}`, person_id: "me", typed_text: f.title, recording_id: f.recording_id, comes_back_for: "unanswered", found_me: "unanswered", entered_at: "2026-11-12T10:00:00Z", ...(kind ? { kind } : {}), ...over },
    facts: f,
  });
  const album = (i: number, year: number): SongFacts => albumFacts({ key: `album:x${i}`, kind: "album", release_group_id: `x${i}`, title: `Example Album ${i}`, artist_credit: `Example Act ${i}`, lead_artist_id: `ea${i}`, lead_artist: `Example Act ${i}`, year });
  it("an album counts as a record in the date line, which then says \"records\"", () => {
    const songs = [entry(album(1, 2020), 1, "album"), entry(EXAMPLE_CATALOGUE[0]!, 2), entry(EXAMPLE_CATALOGUE[5]!, 3)]; // 2020, 2020, 2021
    const line = linesAcross(songs).find((l) => l.kind === "release-window")!;
    expect(line.pattern).toBe("All three of your records came out between 2020 and 2021.");
    expect(line.evidence.some((e) => e.text.includes("(album)"))).toBe(true);
  });
  it("an album's answers never enter the part named most: three songs naming the bridge still make the line beside three albums", () => {
    const songs = [
      ...[0, 2, 4].map((i, n) => entry(EXAMPLE_CATALOGUE[i]!, n, undefined, { comes_back_for: "the bridge" })),
      ...[1, 2, 3].map((i) => entry(album(i, 1990 + i * 9), 10 + i, "album", { comes_back_for: "its overall sound" })),
    ];
    // FR-T9.3 (a), R6: a part line is never shown on its own, so neither songs nor albums make one now.
    expect(linesAcross(songs).some((l) => l.kind.startsWith("part:"))).toBe(false);
  });
  it("albums take no part in key, tempo or \"part named most\" lines", () => {
    const songs = [1, 2, 3].map((i) => entry(album(i, 2000 + i * 7), i, "album", { comes_back_for: "its words" }));
    expect(linesAcross(songs).map((l) => l.kind)).toEqual([]);
  });
});

describe("the screen", () => {
  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.stubGlobal("fetch", () => Promise.reject(new Error("no network in tests")));
  });
  let un: (() => void) | null = null;
  afterEach(() => {
    un?.();
    un = null;
  });
  it("says any songs or albums will do, and offers \"Add several at once\"", async () => {
    seedForTests({});
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => root.render(<NavContext.Provider value={{ go: () => {} }}><Songs /></NavContext.Provider>));
    un = () => {
      act(() => root.unmount());
      host.remove();
    };
    expect(host.textContent).toContain("Any songs or albums that come to mind will do. They need not be your best.");
    expect(host.textContent).toContain("Name a few songs or albums that come to mind.");
    expect(host.textContent).toContain("Add several at once");
    expect(host.textContent).toContain("The year you were born (optional)");
  });
});

describe("\"Add several at once\": each line read as the matching rule reads a title", () => {
  it("a title with 《》 or \"Song - Artist\" becomes the song and its artist; anything else is searched as words", () => {
    expect(lineQuery("Glass Harbour - Juniper Varga")).toBe("Glass Harbour Juniper Varga");
    expect(lineQuery("百万级装备听《Glass Harbour》- Juniper Varga【Hi-Res】")).toContain("Glass Harbour");
    expect(lineQuery("glass harbour")).toBe("glass harbour");
    expect(lineQuery("【Hi-Res】Glass Harbour")).toBe("Hi-Res Glass Harbour");
  });
});

// @vitest-environment happy-dom
/**
 * T1.7 The idle panel (FR-T1.7): one test for each of the four states, and no text node on the ground.
 * Songs are made up (rule 8); plays are synthetic.
 */
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { PanelFoot, PanelHead } from "../ui/Chrome";
import { NavContext } from "../ui/nav";
import { PanelHome } from "../ui/PanelHome";
import { seedForTests, type State } from "../ui/store";
import { EXAMPLE_CATALOGUE } from "./examples";
import { idleState, ON_BILIBILI, PLAY_HERE, PLAY_ON_BILIBILI, playsSentence, recordSentence, recordSongs, unmeasuredSentence } from "./idle";
import { play } from "./testing/panel";

const facts = Object.fromEntries(EXAMPLE_CATALOGUE.map((f) => [f.recording_id, f]));
const [a, b, c, d, e] = EXAMPLE_CATALOGUE as [typeof EXAMPLE_CATALOGUE[0], typeof EXAMPLE_CATALOGUE[0], typeof EXAMPLE_CATALOGUE[0], typeof EXAMPLE_CATALOGUE[0], typeof EXAMPLE_CATALOGUE[0]];
const g = EXAMPLE_CATALOGUE[6]!; // Paper Bridge: no measured key
const RECORD: Partial<State> = {
  facts,
  plays: [
    play(a, "2026-11-08T21:00:00"), play(a, "2026-11-09T21:00:00"), play(a, "2026-11-10T22:00:00"),
    play(b, "2026-11-09T20:00:00"), play(c, "2026-11-10T20:00:00"), play(d, "2026-11-10T20:30:00"),
    play(e, "2026-11-10T20:40:00"), play(g, "2026-11-11T09:00:00"), play(null, "2026-11-11T10:00:00"),
  ],
};

let unmount: (() => void) | null = null;
async function draw(node: ReactNode): Promise<HTMLElement> {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(<NavContext.Provider value={{ go: () => {} }}><div className="panel"><PanelHead atHome onHome={() => {}} /><main className="panel-body">{node}</main><PanelFoot /></div></NavContext.Provider>));
  unmount = () => {
    act(() => root.unmount());
    host.remove();
  };
  return host;
}
const onGround = (host: HTMLElement) => {
  const loose: string[] = [];
  const walk = (n: Node) => (n.nodeType === 3 ? (n.textContent ?? "").trim() && !n.parentElement?.closest(".card") && loose.push(n.textContent!.trim()) : n.childNodes.forEach(walk));
  walk(host);
  return loose;
};

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal("fetch", () => Promise.reject(new Error("no network in tests")));
});
afterEach(() => {
  unmount?.();
  unmount = null;
});

describe("what the idle panel computes", () => {
  it("the songs on record, most recent first, one per recording, counted from matched plays only", () => {
    const songs = recordSongs(RECORD.plays!, facts);
    expect(songs.map((s) => s.facts.title)).toEqual(["Paper Bridge", "Glass Harbour", "Copper Rain", "The Long Stair", "Kite Weather", "Second Lamp"]);
    expect(songs.find((s) => s.facts.title === "Glass Harbour")!.plays).toBe(3);
    // A play the rule stayed silent on is not a song on his record, even when the recording is known.
    const unsure = play(EXAMPLE_CATALOGUE[9]!, "2026-11-11T11:00:00", { match_state: "unsure" });
    expect(recordSongs([...RECORD.plays!, unsure], facts).map((s) => s.facts.title)).not.toContain(EXAMPLE_CATALOGUE[9]!.title);
  });
  it("whole sentences: the plays, where the record stands, and the songs with no measured key", () => {
    const songs = recordSongs(RECORD.plays!, facts);
    expect(playsSentence(songs.find((s) => s.facts.title === "Glass Harbour")!)).toBe("3 plays. The last was on 10 Nov.");
    expect(playsSentence(songs[0]!)).toBe("One play, on 11 Nov.");
    expect(recordSentence(4)).toBe("Four songs in, there is nothing to say across them yet; lines come as the record grows.");
    expect(recordSentence(1)).toBe("One song in, there is nothing to say across them yet; lines come as the record grows.");
    expect(unmeasuredSentence(0)).toBeNull();
    expect(unmeasuredSentence(1)).toBe("One more song has no measured key.");
    expect(unmeasuredSentence(2)).toBe("Two more songs have no measured key.");
  });
  it("four states", () => {
    expect([idleState(0, false), idleState(0, true), idleState(3, false), idleState(3, true)]).toEqual(["first-open", "first-open on Bilibili", "record", "record on Bilibili"]);
  });
});

describe("the four states, drawn", () => {
  it("no record, not on Bilibili: the three offers alone, each on a card, with Open Bilibili", async () => {
    seedForTests({});
    const host = await draw(<PanelHome />);
    expect(host.textContent).toContain(PLAY_ON_BILIBILI);
    expect(host.textContent).toContain("Open Bilibili");
    expect(host.textContent).toContain("Name songs or albums");
    expect(host.textContent).toContain("Add a Spotify file, yours or a friend's");
    expect(host.querySelector(".key-circle")).toBeNull();
    expect(onGround(host)).toEqual([]);
  });
  it("no record, on a Bilibili page that is not a video page: says search pages are not read, and no Open Bilibili", async () => {
    seedForTests({});
    const host = await draw(<PanelHome onBilibili />);
    expect(host.textContent).toContain(PLAY_HERE);
    expect(host.textContent).toContain(ON_BILIBILI);
    expect(host.textContent).not.toContain("Open Bilibili");
    expect(onGround(host)).toEqual([]);
  });
  it("a record, not on Bilibili: the four most recent songs as cards, the circle and its sentences, where the record stands, one filled button, one link", async () => {
    seedForTests(RECORD);
    const host = await draw(<PanelHome />);
    const titles = [...host.querySelectorAll(".song-title")].map((t) => t.textContent);
    expect(titles).toEqual(["Paper Bridge", "Glass Harbour", "Copper Rain", "The Long Stair"]);
    expect(host.querySelectorAll(".card.keyed")).toHaveLength(3); // Paper Bridge has no measured key, so no rule
    expect(host.textContent).toContain("Key not measured");
    expect(host.querySelector(".key-circle")).not.toBeNull();
    expect(host.textContent).toContain("Twelve musical keys form a circle.");
    expect(host.textContent).toContain("Six songs in, there is nothing to say across them yet; lines come as the record grows.");
    expect(host.textContent).toContain("One more song has no measured key.");
    expect(host.querySelectorAll(".act-fill")).toHaveLength(1);
    expect(host.querySelector(".act-fill")!.textContent).toContain("Name songs or albums");
    expect(host.textContent).toContain("Add a Spotify file, yours or a friend's");
    expect(host.textContent).toContain("Open Bilibili");
    expect(onGround(host)).toEqual([]);
  });
  it("a record, on a Bilibili page that is not a video page: the same, with the search-page sentence and no Open Bilibili", async () => {
    seedForTests(RECORD);
    const host = await draw(<PanelHome onBilibili />);
    expect(host.textContent).toContain(ON_BILIBILI);
    expect(host.textContent).not.toContain("Open Bilibili");
    expect(host.querySelectorAll(".song-title")).toHaveLength(4);
    expect(onGround(host)).toEqual([]);
  });
  it("a tap on a dot of the circle lists the songs in that key", async () => {
    seedForTests(RECORD);
    const host = await draw(<PanelHome />);
    const dot = host.querySelector<SVGGElement>(".key-dot-button")!;
    await act(async () => dot.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    const list = host.querySelector('[aria-label="Songs in this key"]');
    expect(list).not.toBeNull();
    expect(list!.textContent!.length).toBeGreaterThan(3);
  });
  it("while a song plays, the product's line about playing a video is not shown", async () => {
    seedForTests(RECORD);
    const host = await draw(<PanelHome playing />);
    expect(host.textContent).not.toContain(PLAY_ON_BILIBILI);
    expect(host.querySelectorAll(".song-title")).toHaveLength(4);
  });
});

// @vitest-environment happy-dom
/**
 * T2.5 (FR-T2.5 as replaced 2026-11-10): the acceptance test. Seconds heard are driven from 0 to 61;
 * the card shows a thin bar that fills and "Listening. Words come after a minute of this song.", then
 * the line or the quiet sentence, in the same place on the card. Made-up song (rule 8).
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { NavContext } from "../ui/nav";
import { SongWords } from "../ui/SongWords";
import { seedForTests } from "../ui/store";
import { firstLine, LISTENING_FIRST, LISTENING_KNOWN, QUIET, QUIET_FIRST, QUIET_OFFER } from "./firstwords";
import { play, SONG } from "./testing/panel";

let root: Root | null = null;
let host: HTMLElement | null = null;
beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal("fetch", () => Promise.reject(new Error("no network in tests")));
});
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

const slot = () => host!.querySelector('[data-slot="words"]')!;
async function heardAt(p: ReturnType<typeof play>, s: number) {
  if (!host) {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  }
  await act(async () =>
    root!.render(
      <NavContext.Provider value={{ go: () => {} }}>
        <article className="card">
          <SongWords song={SONG} play={p} heard={s} />
        </article>
      </NavContext.Provider>,
    ),
  );
  await act(async () => new Promise((r) => setTimeout(r, 5)));
}

describe("the first-play quiet sentence", () => {
  it("on a first play the quiet line says it is on his record now; on a known song it stays the short one", () => {
    expect(QUIET_FIRST).toBe("First play. Nothing worth saying about this one yet; it is on your record now.");
    const first = play(SONG, "2026-11-08T20:00:00");
    const base = { song: SONG, facts: { [SONG.recording_id]: SONG }, keys: [], histories: {}, people: [] };
    expect(firstLine({ ...base, play: first, plays: [first] }).text).toBe(QUIET_FIRST);
    const again = play(SONG, "2026-11-09T20:00:00");
    expect(firstLine({ ...base, play: again, plays: [first, again] }).text).toBe(QUIET);
  });
});

describe("the bar, then the words, in the same place", () => {
  it("a first play: the bar fills from 0 to 60 seconds, then the quiet sentence takes its place", async () => {
    const p = play(SONG, "2026-11-08T20:00:00", { heard_seconds: 0 });
    seedForTests({ facts: { [SONG.recording_id]: SONG }, plays: [p] });
    const seen: string[] = [];
    for (const s of [0, 1, 30, 59, 60, 61]) {
      await heardAt(p, s);
      const bar = slot().querySelector<HTMLElement>('[role="progressbar"]');
      seen.push(bar ? `bar ${bar.getAttribute("aria-valuenow")}/60 ${(bar.firstElementChild as HTMLElement).style.width}` : `words: ${slot().textContent}`);
      if (bar) expect(slot().textContent).toContain(LISTENING_FIRST);
    }
    expect(seen).toEqual(["bar 0/60 0%", "bar 1/60 2%", "bar 30/60 50%", "bar 59/60 98%", `words: ${QUIET_FIRST}${QUIET_OFFER}`, `words: ${QUIET_FIRST}${QUIET_OFFER}`]); // the offer, once in the session
  });
  it("a known song waits 15 seconds, and says so", async () => {
    const before = play(SONG, "2026-11-07T20:00:00");
    const p = play(SONG, "2026-11-08T20:00:00", { heard_seconds: 0 });
    seedForTests({ facts: { [SONG.recording_id]: SONG }, plays: [before, p] });
    await heardAt(p, 14);
    expect(slot().querySelector('[role="progressbar"]')!.getAttribute("aria-valuemax")).toBe("15");
    expect(slot().textContent).toContain(LISTENING_KNOWN);
    await heardAt(p, 15);
    expect(slot().querySelector('[role="progressbar"]')).toBeNull();
    expect(slot().textContent!.length).toBeGreaterThan(10);
  });
});

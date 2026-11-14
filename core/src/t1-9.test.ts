// @vitest-environment happy-dom
/**
 * T1.9 A record with the panel closed (FR-T1.9, Amendment of 2026-11-14). The background script is run
 * as Chrome would run it, with Chrome's messaging replaced by a stand-in: a play reported while no
 * panel is open is stored once in D1, marked "panel closed"; nothing is stored while a panel is open in
 * that window; the idle panel says how many plays were recorded, in one whole sentence.
 * Titles and uploaders are made up (rule 8).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { IDBFactory } from "fake-indexeddb";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { closedSentence } from "./idle";
import type { LivePage, PageFacts, PlayRow } from "./model";
import { needsRule, recordClosed, rowFor, waitingClosed } from "./recorder";
import { loadPlays, openDb, putPlay } from "./storage";

const FACTS: PageFacts = {
  video_id: "BV1ex4y1Ex01", part_number: 1, page_title: "Juniper Varga《Glass Harbour》", uploader_name: "Example Uploader",
  uploader_id: "123456", list_title: "Example Sessions", list_position: 2, page_tags: ["音乐"],
};
const msg = (over: Partial<LivePage> = {}): LivePage & { type: "key:page" } => ({
  type: "key:page", facts: FACTS, play_token: "tok-1", heard_seconds: 3, playing: true, ended: false, ...over,
});

describe("the recorder (core/src/recorder.ts)", () => {
  it("stores a played video once, marked panel closed, with the fields a play has today", async () => {
    const db = await openDb(new IDBFactory());
    await recordClosed(db, msg({ heard_seconds: 3 }), "2026-11-14T20:00:00");
    await recordClosed(db, msg({ heard_seconds: 4 }), "2026-11-14T20:00:01");
    await recordClosed(db, msg({ heard_seconds: 31, playing: false, ended: true }), "2026-11-14T20:00:28");
    const plays = await loadPlays(db);
    expect(plays).toHaveLength(1);
    expect(plays[0]).toMatchObject({
      play_id: "play-tok-1", source: "live page", video_id: FACTS.video_id, page_title: FACTS.page_title, uploader_name: "Example Uploader",
      list_title: "Example Sessions", list_position: 2, page_tags: ["音乐"], started_at: "2026-11-14T20:00:00",
      heard_seconds: 31, reached_end: "yes", recording_id: "", match_state: "unsure", match_rule_version: "", recorded_with: "panel closed",
    });
  });
  it("a second viewing of the same video is a second play", async () => {
    const db = await openDb(new IDBFactory());
    await recordClosed(db, msg({ play_token: "a" }));
    await recordClosed(db, msg({ play_token: "b" }));
    expect((await loadPlays(db)).map((p) => p.play_id).sort()).toEqual(["play-a", "play-b"]);
  });
  it("stores nothing for a page that is not a video page, or a video that has not been played", async () => {
    const db = await openDb(new IDBFactory());
    await recordClosed(db, msg({ facts: null }));
    await recordClosed(db, msg({ playing: false, heard_seconds: 0 }));
    expect(await loadPlays(db)).toEqual([]);
  });
  it("adds to a play the open panel stored and matched, and never replaces what it matched", async () => {
    const db = await openDb(new IDBFactory());
    const matched = { ...rowFor(msg(), null, "2026-11-14T19:00:00")!, recording_id: "rec-1", match_state: "certain" as const, match_rule_version: "v7.2", song_title: "Glass Harbour", recorded_with: "panel open" as const, heard_seconds: 40 };
    await putPlay(db, matched);
    await recordClosed(db, msg({ heard_seconds: 10 })); // fewer seconds than kept: nothing is lost
    await recordClosed(db, msg({ heard_seconds: 55 }));
    const [p] = await loadPlays(db);
    expect(p).toMatchObject({ recording_id: "rec-1", match_state: "certain", match_rule_version: "v7.2", recorded_with: "panel open", started_at: "2026-11-14T19:00:00", heard_seconds: 55 });
  });
  it("takes the page's latest title for a closed play not yet matched (Bilibili redraws a title late)", async () => {
    const db = await openDb(new IDBFactory());
    await recordClosed(db, msg({ facts: { ...FACTS, page_title: "The last video's title" } }), "2026-11-14T20:00:00");
    await recordClosed(db, msg({ heard_seconds: 9 }));
    const [p] = await loadPlays(db);
    expect(p).toMatchObject({ page_title: FACTS.page_title, started_at: "2026-11-14T20:00:00", heard_seconds: 9 });
  });
  it("the panel, opened on a play kept while it was closed, tries the rule on it rather than showing it as already ruled", () => {
    const closed = rowFor(msg(), null, "2026-11-14T20:00:00")!;
    expect(needsRule(closed)).toBe(true);
    expect(needsRule({ ...closed, match_rule_version: "v7.2" })).toBe(false);
    const src = readFileSync(join(import.meta.dirname, "../ui/NowPlaying.tsx"), "utf8");
    expect(src).toContain("if (again && sameTitle && !needsRule(again))");
  });
  it("counts only closed plays the rule has not yet been tried on", () => {
    const base = rowFor(msg(), null, "2026-11-14T20:00:00")!;
    const rows: PlayRow[] = [base, { ...base, play_id: "x", match_rule_version: "v7.2" }, { ...base, play_id: "y", recorded_with: "panel open" }, { ...base, play_id: "z", recorded_with: undefined }];
    expect(waitingClosed(rows).map((r) => r.play_id)).toEqual([base.play_id]);
  });
});

// ---- The background script, run with a stand-in for Chrome ------------------------------------------

type Listener = (m: unknown, sender: { tab?: { windowId: number } }) => void;
async function loadBackground(panelWindows: number[]) {
  vi.resetModules();
  const factory = new IDBFactory();
  vi.stubGlobal("indexedDB", factory);
  const listeners: Listener[] = [];
  const touched: string[] = [];
  const fetchSpy = vi.fn();
  vi.stubGlobal("fetch", fetchSpy);
  const chromeStub = {
    sidePanel: { setPanelBehavior: () => Promise.resolve() },
    runtime: {
      onInstalled: { addListener: () => {} },
      onStartup: { addListener: () => {} },
      onMessage: { addListener: (l: Listener) => listeners.push(l) },
      getContexts: async () => panelWindows.map((windowId) => ({ contextType: "SIDE_PANEL", windowId })),
    },
    // Anything that would draw or remind is recorded if touched.
    action: new Proxy({}, { get: (_t, k) => (touched.push(`action.${String(k)}`), () => {}) }),
    notifications: new Proxy({}, { get: (_t, k) => (touched.push(`notifications.${String(k)}`), () => {}) }),
  };
  vi.stubGlobal("chrome", chromeStub);
  await import("../../extension/src/background");
  const send = async (m: unknown, windowId = 1) => {
    for (const l of listeners) l(m, { tab: { windowId } });
    await new Promise((r) => setTimeout(r, 30));
  };
  return { send, plays: async () => loadPlays(await openDb(factory)), touched, fetchSpy };
}

describe("the background script (extension/src/background.ts)", () => {
  beforeEach(() => vi.unstubAllGlobals());
  it("with no panel open: a play message is stored once, marked panel closed; later messages update it", async () => {
    const bg = await loadBackground([]);
    await bg.send(msg({ heard_seconds: 2 }));
    await bg.send(msg({ heard_seconds: 3 }));
    await bg.send(msg({ heard_seconds: 4 }));
    const plays = await bg.plays();
    expect(plays).toHaveLength(1);
    expect(plays[0]).toMatchObject({ recorded_with: "panel closed", heard_seconds: 4, match_rule_version: "" });
    expect(bg.fetchSpy).not.toHaveBeenCalled();
    expect(bg.touched).toEqual([]);
  });
  it("with the panel open in that window, stores nothing (the panel keeps it); open in another window, stores it", async () => {
    const same = await loadBackground([1]);
    await same.send(msg(), 1);
    expect(await same.plays()).toEqual([]);
    const other = await loadBackground([2]);
    await other.send(msg(), 1);
    expect(await other.plays()).toHaveLength(1);
    const unknown = await loadBackground([-1]); // a panel whose window is not given: the play is kept, never lost
    await unknown.send(msg(), 1);
    expect(await unknown.plays()).toHaveLength(1);
  });
  it("ignores messages that are not a page report", async () => {
    const bg = await loadBackground([]);
    await bg.send({ type: "key:hello" });
    await bg.send(msg({ facts: null }));
    expect(await bg.plays()).toEqual([]);
  });
  it("its source makes no network call and draws nothing: no fetch, no badge, no notification", () => {
    const src = readFileSync(join(import.meta.dirname, "../../extension/src/background.ts"), "utf8").replace(/\/\/.*$/gm, "");
    for (const banned of ["fetch(", "chrome.action", "notifications", "setBadge", "setIcon", "scripting", "XMLHttpRequest"]) expect(src).not.toContain(banned);
    const manifest = JSON.parse(readFileSync(join(import.meta.dirname, "../../extension/public/manifest.json"), "utf8"));
    expect(manifest.permissions).toEqual(["sidePanel"]); // no notifications, no new permission
    expect(Number(manifest.minimum_chrome_version)).toBeGreaterThanOrEqual(116); // chrome.runtime.getContexts
  });
});

// ---- The content script: a replay after the end is a new play -----------------------------------------

describe("the content script (extension/src/content.ts)", () => {
  it("playing again after the end starts a new play with a new token", async () => {
    vi.resetModules();
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
    history.replaceState(null, "", "/video/BV1ex4y1Ex01");
    Object.defineProperty(window, "location", { value: new URL("https://www.bilibili.com/video/BV1ex4y1Ex01"), configurable: true });
    document.body.innerHTML = `<h1 class="video-title">Juniper Varga《Glass Harbour》</h1><video></video>`;
    const sent: LivePage[] = [];
    vi.stubGlobal("chrome", { runtime: { sendMessage: (m: LivePage) => (sent.push(m), Promise.resolve()), onMessage: { addListener: () => {} } } });
    vi.useFakeTimers();
    await import("../../extension/src/content");
    const video = document.querySelector("video")!;
    video.dispatchEvent(new Event("play"));
    video.dispatchEvent(new Event("ended"));
    video.dispatchEvent(new Event("play"));
    vi.useRealTimers();
    const tokens = [...new Set(sent.map((m) => m.play_token))];
    expect(tokens).toHaveLength(2);
  });
});

// ---- The idle panel's sentence ------------------------------------------------------------------------

describe("the idle panel says how many plays were recorded while it was closed", () => {
  it("in one whole sentence, and says nothing when there are none", () => {
    expect(closedSentence(0)).toBeNull();
    expect(closedSentence(1)).toBe("The Key recorded one play while this panel was closed.");
    expect(closedSentence(4)).toBe("The Key recorded four plays while this panel was closed.");
    expect(closedSentence(40)).toBe("The Key recorded 40 plays while this panel was closed.");
  });
  it("counted from D1 when the panel opens, and shown on a card on the idle panel", async () => {
    vi.resetModules();
    vi.unstubAllGlobals();
    const factory = new IDBFactory();
    vi.stubGlobal("indexedDB", factory);
    const db = await openDb(factory);
    await recordClosed(db, msg({ play_token: "one" }), "2026-11-14T20:00:00");
    db.close();
    const { PanelHome } = await import("../ui/PanelHome");
    const { NavContext } = await import("../ui/nav");
    const { hydrate } = await import("../ui/store");
    await hydrate();
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => root.render(createElement(NavContext.Provider, { value: { go: () => {} } }, createElement(PanelHome, { onBilibili: false }))));
    const line = [...host.querySelectorAll("p")].find((p) => p.textContent === "The Key recorded one play while this panel was closed.");
    expect(line).toBeTruthy();
    expect(line!.closest(".card")).toBeTruthy(); // design rule 2: no text on the ground
    act(() => root.unmount());
    host.remove();
  });
});

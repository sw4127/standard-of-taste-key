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
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { closedSentence } from "./idle";
import type { LivePage, PageFacts, PlayRow } from "./model";
import { countClosedAtOpening, localIso, lookupFailed, mayStore, needsRule, recordClosed, rowFor, uncounted } from "./recorder";
import { exportRecord } from "./numbers";
import { eraseAll, loadPlays, loadSettings, openDb, putPlay, type Settings } from "./storage";

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
  it("a lookup MusicBrainz refused leaves the play not yet tried, so it is tried again later", () => {
    const tried = { ...rowFor(msg(), null, "2026-11-14T20:00:00")!, match_rule_version: "v7.2" };
    expect(needsRule(lookupFailed(tried))).toBe(true);
    expect(lookupFailed(tried)).toMatchObject({ recorded_with: "panel closed", heard_seconds: tried.heard_seconds, started_at: tried.started_at });
    const src = readFileSync(join(import.meta.dirname, "../ui/NowPlaying.tsx"), "utf8");
    expect(src).toMatch(/play\.current = lookupFailed\(play\.current \?\? row\);\s*void actions\.savePlay\(play\.current\);\s*setStatus\(\{ kind: "unreachable" \}\)/);
  });
  it("a play counted by an opening is not counted again; plays stored with the panel open, or before T1.9, are never counted", () => {
    const base = rowFor(msg(), null, "2026-11-14T20:00:00")!;
    const rows: PlayRow[] = [
      base, { ...base, play_id: "named", match_rule_version: "v7.2" }, { ...base, play_id: "counted", counted_at_opening: "2026-11-14T21:00:00" },
      { ...base, play_id: "open", recorded_with: "panel open" }, { ...base, play_id: "old", recorded_with: undefined },
    ];
    expect(rows.filter(uncounted).map((r) => r.play_id)).toEqual([base.play_id, "named"]);
  });
});

// ---- Defect A (2026-11-15): each closed play is counted once, at the first opening after it was stored ----

/** One opening of the panel: a fresh panel document reads the record, as Chrome loads the side panel anew each time. */
async function openPanel(factory: IDBFactory) {
  vi.resetModules();
  vi.stubGlobal("indexedDB", factory);
  const store = await import("../ui/store");
  await store.hydrate();
  return { store, sentence: closedSentence(store.getState().closed_at_open ?? 0) };
}

describe("defect A: the panel's sentence counts each play stored with the panel closed exactly once", () => {
  beforeEach(() => vi.unstubAllGlobals());
  it("seven closed plays, two of them named by the catch-up before the panel was next opened: the sentence says seven, then nothing", async () => {
    const factory = new IDBFactory();
    const db = await openDb(factory);
    for (let i = 1; i <= 7; i++) await recordClosed(db, msg({ play_token: `p${i}` }), `2026-11-15T00:0${i}:00`);
    // Two of the seven were already named (a rule version and a song), as an earlier catch-up leaves them.
    for (const id of ["play-p1", "play-p2"]) {
      const row = (await loadPlays(db)).find((p) => p.play_id === id)!;
      await putPlay(db, { ...row, recording_id: "rec-x", match_state: "certain", match_rule_version: "v7.2" });
    }
    db.close();
    expect((await openPanel(factory)).sentence).toBe("The Key recorded seven plays while this panel was closed.");
    expect((await openPanel(factory)).sentence).toBeNull(); // no sentence when the number is zero
    const marks = (await loadPlays(await openDb(factory))).map((p) => p.counted_at_opening);
    expect(marks.every(Boolean)).toBe(true);
  });
  it("a play MusicBrainz refused is counted at the first opening only, not again at the next", async () => {
    const factory = new IDBFactory();
    const db = await openDb(factory);
    await recordClosed(db, msg({ play_token: "refused" }), "2026-11-15T01:00:00");
    db.close();
    const first = await openPanel(factory);
    expect(first.sentence).toBe("The Key recorded one play while this panel was closed.");
    const { catchUp } = await import("../ui/catchup");
    const refused = await catchUp({ fetchFn: vi.fn(), match: async () => Promise.reject(new Error("HTTP 503")) });
    expect(refused.failed).toBe(1);
    // The refused play is left to be tried again.
    expect(needsRule((await loadPlays(await openDb(factory)))[0]!)).toBe(true);
    const second = await openPanel(factory);
    expect(second.sentence).toBeNull();
    await catchUp({ fetchFn: vi.fn(), match: async () => Promise.reject(new Error("HTTP 503")) });
    expect((await openPanel(factory)).sentence).toBeNull();
  });
  it("plays made in a second window while a panel stays open in the first are counted at the next opening, once", async () => {
    const bg = await loadBackground([1]); // a panel is open in window 1
    const factory = (globalThis as { indexedDB: IDBFactory }).indexedDB;
    const db = await openDb(factory);
    await recordClosed(db, msg({ play_token: "before" }), "2026-11-15T02:00:00");
    db.close();
    const panel1 = await openPanel(factory);
    expect(panel1.sentence).toBe("The Key recorded one play while this panel was closed.");
    await bg.send(msg({ play_token: "w2-a", heard_seconds: 5 }), 2);
    await bg.send(msg({ play_token: "w2-b", heard_seconds: 5 }), 2);
    await bg.send(msg({ play_token: "w1", heard_seconds: 5 }), 1); // window 1's panel keeps its own play: not stored here
    expect((await bg.plays()).filter((p) => p.recorded_with === "panel closed").map((p) => p.play_id).sort()).toEqual(["play-before", "play-w2-a", "play-w2-b"]);
    // Panel 1 is still open: its sentence was read once, when it opened, and is not changed.
    expect(panel1.store.getState().closed_at_open).toBe(1);
    expect((await openPanel(factory)).sentence).toBe("The Key recorded two plays while this panel was closed.");
    expect((await openPanel(factory)).sentence).toBeNull();
  });
  it("the background part's write of a play never drops the mark an opening panel writes at the same moment", async () => {
    const factory = new IDBFactory();
    const db = await openDb(factory);
    await recordClosed(db, msg({ play_token: "race", heard_seconds: 3 }), "2026-11-15T03:00:00");
    // The two run together: the background part adds seconds while the panel marks the play counted, the
    // panel starting a moment after the background part began (its read is under way).
    const bgWrite = recordClosed(db, msg({ play_token: "race", heard_seconds: 9 }));
    await new Promise((r) => setTimeout(r, 2));
    const n = await countClosedAtOpening(db, "2026-11-15T03:00:05");
    await bgWrite;
    await recordClosed(db, msg({ play_token: "race", heard_seconds: 12 }));
    const [p] = await loadPlays(db);
    expect(n).toBe(1);
    expect(p).toMatchObject({ heard_seconds: 12, counted_at_opening: "2026-11-15T03:00:05" });
    expect(await countClosedAtOpening(db)).toBe(0);
  });
  it("a closed play the panel then opens on, in the same tab, keeps its mark when the panel saves it, and is not counted again", async () => {
    const factory = new IDBFactory();
    const db = await openDb(factory);
    await recordClosed(db, msg({ play_token: "same-tab", heard_seconds: 20 }), "2026-11-15T04:00:00");
    db.close();
    const first = await openPanel(factory);
    expect(first.sentence).toBe("The Key recorded one play while this panel was closed.");
    // The card on screen matches the play: MusicBrainz (a stand-in) finds nothing, and the play is saved with more seconds.
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ count: 0, recordings: [] }), { status: 200, headers: { "content-type": "application/json" } })));
    const { NowPlaying } = await import("../ui/NowPlaying");
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => root.render(createElement(NowPlaying, { live: { ...msg({ play_token: "same-tab", heard_seconds: 26 }), facts: FACTS } })));
    await act(async () => new Promise((r) => setTimeout(r, 1500)));
    act(() => root.unmount());
    host.remove();
    const [p] = await loadPlays(await openDb(factory));
    expect(p).toMatchObject({ play_id: "play-same-tab", heard_seconds: 26, recorded_with: "panel closed" });
    expect(p!.counted_at_opening).toBeTruthy();
    expect((await openPanel(factory)).sentence).toBeNull();
  });
  it("the background part reads and writes a play in one step (a gap too short for a test to time is closed by the code's shape)", () => {
    const src = readFileSync(join(import.meta.dirname, "recorder.ts"), "utf8");
    const body = src.slice(src.indexOf("export async function recordClosed"), src.indexOf("export const needsRule"));
    expect(body).toContain("await updatePlay(db, playIdOf(msg.play_token), (earlier) => {");
    expect(body).not.toMatch(/getPlay|putPlay/);
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
  const settings = async (st: Settings) => {
    const d = await openDb(factory);
    const tx = d.transaction("D8", "readwrite");
    tx.objectStore("D8").put(st);
    await new Promise((r) => (tx.oncomplete = r));
    d.close();
  };
  return { send, plays: async () => loadPlays(await openDb(factory)), touched, fetchSpy, settings };
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
    vi.advanceTimersByTime(4000); // T1.9 defect fix: a page just opened is read once it has settled (SETTLE_MS)
    const video = document.querySelector("video")!;
    video.dispatchEvent(new Event("play"));
    video.dispatchEvent(new Event("ended"));
    video.dispatchEvent(new Event("play"));
    vi.useRealTimers();
    const tokens = [...new Set(sent.map((m) => m.play_token))];
    expect(tokens).toHaveLength(2);
    // FR-T1.9: each play says when it first played; the new play carries its own start; a page not yet played carries none.
    for (const t of tokens) expect(sent.filter((m) => m.play_token === t && m.playing).every((m) => /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d$/.test(m.began_at ?? ""))).toBe(true);
    expect(sent[0]!.playing).toBe(false);
    expect(sent[0]!.began_at).toBeUndefined();
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

// ==== Step 2: FR-T1.9 points 3 to 5 ====================================================================

const T0 = "2026-11-14T20:00:00";
const putSettings = async (db: IDBDatabase, s: Settings) => {
  const tx = db.transaction("D8", "readwrite");
  tx.objectStore("D8").put(s);
  await new Promise((r) => (tx.oncomplete = r));
};

describe("the store rule (mayStore): pause, resume, erase", () => {
  it("refuses every play while paused, and a play begun before recording was switched back on or before an erase", () => {
    expect(mayStore(T0, null)).toBe(true);
    expect(mayStore(T0, { recording_paused: true })).toBe(false);
    expect(mayStore("2026-11-14T19:59:59", { recording_resumed_at: T0 })).toBe(false);
    expect(mayStore(T0, { recording_resumed_at: T0 })).toBe(true);
    const erasedUtc = new Date(2026, 10, 14, 20, 0, 0).toISOString(); // 20:00 local, kept in UTC as D8 keeps it
    expect(mayStore("2026-11-14T19:59:00", { last_erased_at: erasedUtc })).toBe(false);
    expect(mayStore("2026-11-14T20:00:30", { last_erased_at: erasedUtc })).toBe(true);
  });
  it("the recorder stores nothing while paused; after resuming, a play begun while paused stays out and a new one is kept", async () => {
    const db = await openDb(new IDBFactory());
    await putSettings(db, { settings_id: 1, recording_paused: true });
    await recordClosed(db, msg({ play_token: "first", began_at: "2026-11-14T20:00:00" }));
    expect(await loadPlays(db)).toEqual([]);
    await putSettings(db, { settings_id: 1, recording_resumed_at: "2026-11-14T20:05:00" });
    await recordClosed(db, msg({ play_token: "first", began_at: "2026-11-14T20:00:00", heard_seconds: 400 })); // still playing after the switch
    await recordClosed(db, msg({ play_token: "second", began_at: "2026-11-14T20:06:00" }));
    expect((await loadPlays(db)).map((p) => p.play_id)).toEqual(["play-second"]);
  });
  it("a play already on the record keeps being added to after recording is switched back on", async () => {
    const db = await openDb(new IDBFactory());
    await recordClosed(db, msg({ began_at: "2026-11-14T19:00:00", heard_seconds: 10 }));
    await putSettings(db, { settings_id: 1, recording_resumed_at: "2026-11-14T19:30:00" });
    await recordClosed(db, msg({ began_at: "2026-11-14T19:00:00", heard_seconds: 20 }));
    expect((await loadPlays(db))[0]!.heard_seconds).toBe(20);
  });
  it("the background script, check 2: paused, one video; switched off, another; only the second is stored", async () => {
    const bg = await loadBackground([]);
    await bg.settings({ settings_id: 1, recording_paused: true });
    await bg.send(msg({ play_token: "a", began_at: localIso(new Date(Date.now() - 60_000)) }));
    await bg.settings({ settings_id: 1, recording_resumed_at: localIso(new Date(Date.now() - 30_000)) });
    await bg.send(msg({ play_token: "a", began_at: localIso(new Date(Date.now() - 60_000)), heard_seconds: 50 }));
    await bg.send(msg({ play_token: "b", began_at: localIso() }));
    expect((await bg.plays()).map((p) => p.play_id)).toEqual(["play-b"]);
  });
});

describe("erase and export (FR-T1.9 point 5)", () => {
  it("erase clears the closed plays; a video still playing from before the erase is not stored again; a pause survives the erase", async () => {
    const db = await openDb(new IDBFactory());
    await recordClosed(db, msg({ play_token: "old", began_at: localIso(new Date(Date.now() - 120_000)) }));
    expect(await loadPlays(db)).toHaveLength(1);
    await eraseAll(db, new Date(Date.now() - 1000).toISOString(), { recording_paused: false });
    expect(await loadPlays(db)).toEqual([]);
    await recordClosed(db, msg({ play_token: "old", began_at: localIso(new Date(Date.now() - 120_000)), heard_seconds: 90 }));
    expect(await loadPlays(db)).toEqual([]);
    await recordClosed(db, msg({ play_token: "new", began_at: localIso(new Date(Date.now() + 1000)) }));
    expect((await loadPlays(db)).map((p) => p.play_id)).toEqual(["play-new"]);
    await eraseAll(db, new Date().toISOString(), { recording_paused: true });
    expect(await loadSettings(db)).toMatchObject({ recording_paused: true });
  });
  it("the export carries each play with recorded_with", () => {
    const closed = rowFor(msg(), null, T0)!;
    const open = { ...closed, play_id: "play-open", recorded_with: "panel open" as const };
    const empty = { recordings: [], facts: [], choices: [], settings: [], events: [], people: [], songs: [], words: [], readings: [] };
    const out = exportRecord({ snapshot: empty, plays: [closed, open], keys: [], nexts: [], histories: {} }, false, "2026-11-14T21:00:00Z");
    expect(out.D1_plays.map((p) => p.recorded_with)).toEqual(["panel closed", "panel open"]);
    expect(out.D1_plays[0]).toMatchObject({ page_title: FACTS.page_title, heard_seconds: 3 });
  });
});

// ---- The panel: its store, the catch-up, the setting --------------------------------------------------

async function freshPanel() {
  vi.resetModules();
  vi.unstubAllGlobals();
  vi.stubGlobal("fetch", () => new Promise(() => {})); // credits fetched after a name never answer in a test
  const store = await import("../ui/store");
  const catchup = await import("../ui/catchup");
  const { RULE_VERSION } = await import("./match/v7");
  return { ...store, ...catchup, RULE_VERSION };
}
const waitingRow = (id: string, started_at: string, over: Partial<PlayRow> = {}): PlayRow => ({ ...rowFor(msg({ play_token: id }), null, started_at)!, ...over });
const named = (id: string) => ({ state: "certain", candidate: { recording_id: `rec-${id}`, title: `Song ${id}`, artist_credit: "Juniper Varga" }, candidates: [], parsed: {} });
const okFetch = async () => ({ ok: true, status: 200, json: async () => ({}) });

describe("the open panel's own plays obey the same rule (core/ui/store.ts)", () => {
  it("while paused, a play is not kept and nothing about it is logged; after resuming, it stays out and a new play is kept", async () => {
    const p = await freshPanel();
    p.seedForTests({ recording_paused: true });
    const row = waitingRow("x", localIso(), { recorded_with: "panel open" });
    await p.actions.savePlay(row);
    p.actions.log("song_started", { play_id: row.play_id });
    expect(p.getState().plays).toEqual([]);
    expect(p.getState().events).toEqual([]);
    p.actions.setRecordingPaused(false);
    await p.actions.savePlay({ ...row, heard_seconds: 99 });
    p.actions.log("key_ready", { play_id: row.play_id });
    expect(p.getState().plays).toEqual([]);
    expect(p.getState().events).toEqual([]);
    const later = waitingRow("y", localIso(new Date(Date.now() + 2000)), { recorded_with: "panel open" });
    await p.actions.savePlay(later);
    expect(p.getState().plays.map((x) => x.play_id)).toEqual(["play-y"]);
  });
});

describe("the catch-up when the panel opens (core/ui/catchup.ts, FR-T1.9 point 3)", () => {
  it("matches waiting plays oldest first, one at a time, and names or marks each", async () => {
    const p = await freshPanel();
    const starts: Record<string, string> = { c: "2026-11-14T22:00:00", a: "2026-11-14T20:00:00", b: "2026-11-14T21:00:00" };
    p.seedForTests({ plays: ["c", "a", "b"].map((x) => waitingRow(x, starts[x]!, { page_title: `Title ${x}` })) });
    const order: string[] = [];
    let inFlight = 0;
    let most = 0;
    const match = vi.fn(async (title: string) => {
      inFlight++;
      most = Math.max(most, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      const id = `play-${title.slice(-1)}`;
      order.push(id);
      return (id === "play-b" ? { state: "silent", reason: "no candidate", candidates: [], parsed: {} } : named(id)) as never;
    });
    const out = await p.catchUp({ fetchFn: okFetch, match: match as never });
    expect(order).toEqual(["play-a", "play-b", "play-c"]);
    expect(most).toBe(1);
    expect(out).toMatchObject({ named: 2, silent: 1, failed: 0 });
    const by = Object.fromEntries(p.getState().plays.map((x) => [x.play_id, x]));
    expect(by["play-a"]).toMatchObject({ match_state: "certain", recording_id: "rec-play-a", match_rule_version: p.RULE_VERSION, recorded_with: "panel closed" });
    expect(by["play-b"]).toMatchObject({ match_state: "unsure", recording_id: "", match_rule_version: p.RULE_VERSION });
    expect(p.getState().facts["rec-play-a"]).toBeTruthy(); // the song is on the record, so the idle panel's cards can show it
  });
  it("waits for a named song's credits before the next lookup, so it never queues more than one call", async () => {
    const p = await freshPanel();
    p.seedForTests({ plays: ["a", "b"].map((x, i) => waitingRow(x, `2026-11-14T2${i}:00:00`, { page_title: `Title ${x}` })) });
    const events: string[] = [];
    const fetchFn = vi.fn(async (url: string) => {
      events.push("credits");
      await new Promise((r) => setTimeout(r, 5));
      void url;
      return { ok: false, status: 404, json: async () => ({}) };
    });
    const match = vi.fn(async (title: string) => {
      events.push(`match ${title}`);
      return named(`play-${title.slice(-1)}`) as never;
    });
    await p.catchUp({ fetchFn, match: match as never });
    const second = events.indexOf("match Title b");
    expect(events.slice(0, second)).toContain("credits"); // a's credits were asked for, and answered, before b's lookup
  });
  it("passes the video's length to the rule, leaves a refused lookup to be tried again, and stops after three refusals in a row", async () => {
    const p = await freshPanel();
    p.seedForTests({ plays: ["a", "b", "c", "d"].map((x, i) => waitingRow(x, `2026-11-14T2${i}:00:00`, { page_title: `Title ${x}`, duration_seconds: 200 })) });
    const lengths: (number | undefined)[] = [];
    const match = vi.fn(async (_t: string, _d: unknown, o?: { videoSeconds?: number }) => {
      lengths.push(o?.videoSeconds);
      throw new Error("HTTP 503");
    });
    const out = await p.catchUp({ fetchFn: okFetch, match: match as never });
    expect(out).toMatchObject({ failed: 3, stopped: true });
    expect(match).toHaveBeenCalledTimes(3);
    expect(lengths).toEqual([200, 200, 200]);
    expect(p.getState().plays.every(needsRule)).toBe(true);
  });
  it("skips the play on screen, uses a fix made before with no call, and never re-rules a fixed play", async () => {
    const p = await freshPanel();
    const fixedBefore = waitingRow("old", "2026-11-13T20:00:00", { match_state: "fixed by me", recording_id: "rec-mine", song_title: "My pick", match_rule_version: "v7.2" });
    const sameVideo = waitingRow("again", "2026-11-14T20:00:00");
    const onScreen = waitingRow("now", "2026-11-14T21:00:00", { video_id: "BV1ex4y1Ex99", page_title: "Another" });
    const pickedNoVersion = waitingRow("picked", "2026-11-14T19:00:00", { video_id: "BV1ex4y1Ex98", match_state: "not a song", page_title: "A vlog", match_rule_version: "" });
    p.seedForTests({ plays: [fixedBefore, sameVideo, onScreen, pickedNoVersion] });
    const match = vi.fn();
    await p.catchUp({ fetchFn: okFetch, match: match as never, skip: () => "play-now" });
    expect(match).not.toHaveBeenCalled();
    const by = Object.fromEntries(p.getState().plays.map((x) => [x.play_id, x]));
    expect(by["play-again"]).toMatchObject({ match_state: "fixed by me", recording_id: "rec-mine" });
    expect(needsRule(by["play-now"]!)).toBe(true);
    expect(by["play-picked"]).toMatchObject({ match_state: "not a song" });
  });
  it("names plays while recording is paused (naming a stored play stores no new play), and the panel draws while it runs", async () => {
    const p = await freshPanel();
    p.seedForTests({ recording_paused: true, plays: [waitingRow("a", T0, { page_title: "Title a" })] });
    let release: () => void = () => {};
    const match = vi.fn(() => new Promise((r) => (release = () => r(named("play-a")))));
    const running = p.catchUp({ fetchFn: okFetch, match: match as never });
    const { PanelHome } = await import("../ui/PanelHome");
    const { NavContext } = await import("../ui/nav");
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => root.render(createElement(NavContext.Provider, { value: { go: () => {} } }, createElement(PanelHome, { onBilibili: false }))));
    expect(host.textContent).toContain("Name songs or albums"); // usable while the rule runs
    release();
    await running;
    expect(p.getState().plays[0]).toMatchObject({ match_state: "certain", recording_id: "rec-play-a" });
    act(() => root.unmount());
    host.remove();
  });
});

describe("the settings sentence and the switch (FR-T1.9 point 4)", () => {
  it("the panel's settings hold Bob's sentence word for word and one switch; paused, they say so; the website shows neither", async () => {
    const p = await freshPanel();
    p.seedForTests({});
    const { PanelFoot, SiteFoot } = await import("../ui/Chrome");
    const { NavContext } = await import("../ui/nav");
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    const wrap = (n: unknown) => createElement(NavContext.Provider, { value: { go: () => {} } }, n as never);
    await act(async () => root.render(wrap(createElement(PanelFoot))));
    const sentence = "The Key keeps a record of every Bilibili video you play, also while this panel is closed. The record stays in this browser.";
    const p1 = [...host.querySelectorAll("p")].find((x) => x.textContent === sentence);
    expect(p1?.closest(".card")).toBeTruthy();
    expect(host.querySelectorAll('input[role="switch"]')).toHaveLength(1);
    const box = host.querySelector<HTMLInputElement>('input[role="switch"]')!;
    expect(box.closest("label")!.textContent!.trim()).toBe("Pause recording");
    await act(async () => box.click());
    expect(p.getState().recording_paused).toBe(true);
    expect(host.textContent).toContain("Recording is paused. Nothing you play is kept until you switch this off.");
    await act(async () => host.querySelector<HTMLInputElement>('input[role="switch"]')!.click());
    expect(p.getState().recording_paused).toBe(false);
    expect(p.getState().recording_resumed_at).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d$/);
    await act(async () => root.render(wrap(createElement(SiteFoot))));
    expect(host.textContent).not.toContain(sentence);
    act(() => root.unmount());
    host.remove();
  });
  it("the pause is kept in D8 and survives a save; the panel does not read the playing video while paused", async () => {
    const p = await freshPanel();
    p.seedForTests({ recording_paused: true, recording_resumed_at: T0 });
    expect(p.toSnapshot(p.getState()).settings[0]).toMatchObject({ recording_paused: true, recording_resumed_at: T0 });
    expect(p.fromSnapshot(p.toSnapshot(p.getState()))).toMatchObject({ recording_paused: true, recording_resumed_at: T0 });
    const side = readFileSync(join(import.meta.dirname, "../../extension/src/sidepanel.tsx"), "utf8");
    expect(side).toContain("const playing = !st.recording_paused && live?.facts ? live : null;");
    const np = readFileSync(join(import.meta.dirname, "../ui/NowPlaying.tsx"), "utf8");
    expect(np).toContain('match_rule_version: fix ? RULE_VERSION : "",'); // written when the rule answers, never before
  });
});

describe("the export reads D1 afresh (FR-T1.9 point 5)", () => {
  it("a play the background part kept after the panel opened is in the export", async () => {
    vi.resetModules();
    vi.unstubAllGlobals();
    const factory = new IDBFactory();
    vi.stubGlobal("indexedDB", factory);
    const store = await import("../ui/store");
    await store.hydrate();
    expect(store.getState().plays).toEqual([]);
    const db = await openDb(factory);
    await recordClosed(db, msg({ play_token: "elsewhere" }), T0); // another window, while this panel was open
    db.close();
    const plays = await store.actions.freshPlays();
    expect(plays.map((p) => p.play_id)).toEqual(["play-elsewhere"]);
    const src = readFileSync(join(import.meta.dirname, "../ui/MyNumbers.tsx"), "utf8");
    expect(src).toContain("const plays = await actions.freshPlays();");
    expect(src).toMatch(/exportRecord\(\{ snapshot: toSnapshot\(st\), plays,/);
  });
});

describe("a pause holds for plays already on the record, and through the panel's erase", () => {
  it("while paused, a play already on the record is not added to", async () => {
    const db = await openDb(new IDBFactory());
    await recordClosed(db, msg({ began_at: "2026-11-14T19:00:00", heard_seconds: 10 }));
    await putSettings(db, { settings_id: 1, recording_paused: true });
    await recordClosed(db, msg({ began_at: "2026-11-14T19:00:00", heard_seconds: 60 }));
    expect((await loadPlays(db))[0]!.heard_seconds).toBe(10);
  });
  it("the panel's Erase everything keeps the pause, in the panel and in D8", async () => {
    vi.resetModules();
    vi.unstubAllGlobals();
    const factory = new IDBFactory();
    vi.stubGlobal("indexedDB", factory);
    const store = await import("../ui/store");
    await store.hydrate();
    store.actions.setRecordingPaused(true);
    await store.actions.eraseEverything();
    expect(store.getState().recording_paused).toBe(true);
    const db = await openDb(factory);
    expect(await loadSettings(db)).toMatchObject({ recording_paused: true });
    expect(await loadPlays(db)).toEqual([]);
    db.close();
  });
});

describe("the open panel adds nothing to a play on the record while paused", () => {
  it("seconds heard stop growing while paused", async () => {
    const p = await freshPanel();
    const row = waitingRow("kept", T0, { recorded_with: "panel open", heard_seconds: 10 });
    p.seedForTests({ plays: [row], recording_paused: true });
    await p.actions.savePlay({ ...row, heard_seconds: 70 });
    expect(p.getState().plays[0]!.heard_seconds).toBe(10);
  });
});

describe("the content script stands alone (a classic script cannot import)", () => {
  it("its copy of the local-time helper agrees with core's", async () => {
    const { localIso: inPage } = await import("../../extension/src/page");
    for (const d of [new Date(2026, 0, 1, 0, 0, 0), new Date(2026, 10, 14, 23, 59, 59), new Date(2026, 6, 1, 12, 30, 5)]) expect(inPage(d)).toBe(localIso(d));
  });
  it("content.ts imports nothing from core but types, so nothing it uses can be split into a shared chunk", () => {
    const src = readFileSync(join(import.meta.dirname, "../../extension/src/content.ts"), "utf8");
    const imports = [...src.matchAll(/^import (type )?.* from "([^"]+)";$/gm)];
    for (const m of imports) if (!m[1]) expect(m[2]).toBe("./page");
  });
});

describe("whole-build red-team: a hidden tab, the erase sentence, the paused offer", () => {
  it("a video playing in a hidden tab (where Chrome slows the one-second timer) still reports seconds heard every two seconds, and a new video is noticed before its seconds count", async () => {
    vi.resetModules();
    vi.unstubAllGlobals();
    vi.useFakeTimers({ toFake: ["setInterval", "Date"] }); // the one-second timer never fires: a hidden tab
    vi.setSystemTime(new Date(2026, 10, 14, 20, 0, 0));
    const at = (u: string) => Object.defineProperty(window, "location", { value: new URL(u), configurable: true });
    at("https://www.bilibili.com/video/BV1ex4y1Ex01");
    document.body.innerHTML = `<h1 class="video-title">Juniper Varga《Glass Harbour》</h1><video></video>`;
    const sent: LivePage[] = [];
    vi.stubGlobal("chrome", { runtime: { sendMessage: (m: LivePage) => (sent.push(m), Promise.resolve()), onMessage: { addListener: () => {} } } });
    await import("../../extension/src/content");
    const video = document.querySelector("video")!;
    Object.defineProperty(video, "paused", { value: false, configurable: true });
    let t = 0;
    const tick = () => {
      t += 0.25;
      vi.setSystemTime(Date.now() + 250);
      Object.defineProperty(video, "currentTime", { value: t, configurable: true, writable: true });
      video.dispatchEvent(new Event("timeupdate"));
    };
    video.dispatchEvent(new Event("play"));
    for (let i = 0; i < 4 * 30; i++) tick(); // thirty seconds of media time, no timer
    const first = sent.filter((m) => m.play_token === sent.at(-1)!.play_token);
    expect(first.length).toBeGreaterThanOrEqual(14);
    expect(Math.abs(first.at(-1)!.heard_seconds - 30)).toBeLessThanOrEqual(2);
    // Bilibili moves on to the next video in the hidden tab: the address changes, the time starts again.
    at("https://www.bilibili.com/video/BV1ex4y1Ex02");
    document.querySelector("h1")!.textContent = "The Quiet Lanterns《Second Lamp》";
    t = 0;
    for (let i = 0; i < 4 * 10; i++) tick();
    const tokens = [...new Set(sent.map((m) => m.play_token))];
    expect(tokens).toHaveLength(2);
    const second = sent.filter((m) => m.play_token === tokens[1]);
    expect(second[0]!.facts!.video_id).toBe("BV1ex4y1Ex02");
    expect(sent.filter((m) => m.play_token === tokens[0]).at(-1)!.heard_seconds).toBeLessThanOrEqual(31); // the next video's seconds were not added to the first
    expect(Math.abs(second.at(-1)!.heard_seconds - 10)).toBeLessThanOrEqual(2);
    const before = sent.length;
    window.dispatchEvent(new Event("pagehide"));
    expect(sent.length).toBeGreaterThan(before); // the last seconds go when the tab closes
    expect(sent.at(-1)!.play_token).toBe(tokens[1]);
    vi.useRealTimers();
  });
  it("the erase sentence is as it was before T1.9 (nothing else changes)", () => {
    const src = readFileSync(join(import.meta.dirname, "../ui/Footer.tsx"), "utf8");
    expect(src).toContain("This erases all your songs, answers, kept readings and words saved in this browser. You can't undo it.");
  });
  it("while paused, the panel does not offer to read a video", () => {
    const side = readFileSync(join(import.meta.dirname, "../../extension/src/sidepanel.tsx"), "utf8");
    expect(side).toContain("<PanelHome playing={!!playing?.facts || !!st.recording_paused} onBilibili={onBilibili} />");
  });
});

// ---- Defect B (2026-11-15): a change of video inside one Bilibili page --------------------------------
// The content script runs on a stand-in page with a stand-in media element. Its messages are then fed to
// the real recorder, so the rows are what D1 would hold with the panel closed. Titles, IDs and lengths
// are made up (rule 8); the order of events follows what Bob's three exports show.

const A = { url: "https://www.bilibili.com/video/BV1ex4y1Ex0A", title: "Juniper Varga《Glass Harbour》", length: 257 };
const B = { url: "https://www.bilibili.com/video/BV1ex4y1Ex0B", title: "The Quiet Lanterns《Second Lamp》", length: 226 };

async function stagePage(start: { url: string; title: string }, opts: { playingAtLoad?: { length: number } } = {}) {
  vi.resetModules();
  vi.unstubAllGlobals();
  vi.useFakeTimers({ toFake: ["setInterval", "Date"] });
  vi.setSystemTime(new Date(2026, 10, 15, 2, 0, 0));
  const at = (u: string) => Object.defineProperty(window, "location", { value: new URL(u), configurable: true });
  at(start.url);
  document.body.innerHTML = `<h1 class="video-title">${start.title}</h1><video></video>`;
  const video = document.querySelector("video")!;
  let t = 0;
  let duration = Number.NaN;
  let paused = true;
  Object.defineProperty(video, "paused", { get: () => paused, configurable: true });
  Object.defineProperty(video, "currentTime", { get: () => t, set: (v: number) => (t = v), configurable: true });
  Object.defineProperty(video, "duration", { get: () => duration, configurable: true });
  const fire = (e: string) => video.dispatchEvent(new Event(e));
  if (opts.playingAtLoad) {
    // A tab Chrome restores: its player is already playing when the script starts.
    duration = opts.playingAtLoad.length;
    paused = false;
  }
  const sent: LivePage[] = [];
  vi.stubGlobal("chrome", { runtime: { sendMessage: (m: LivePage) => (sent.push(m), Promise.resolve()), onMessage: { addListener: () => {} } } });
  await import("../../extension/src/content");
  const stage = {
    sent,
    /** The page's address and, if given, its title change (Bilibili draws the title on its own time). */
    page: (url: string, title?: string) => {
      at(url);
      if (title !== undefined) document.querySelector("h1")!.textContent = title;
    },
    title: (title: string) => void (document.querySelector("h1")!.textContent = title),
    /** The player loads another video: emptied, loadstart, then its length. */
    load: (length: number) => {
      fire("emptied");
      fire("loadstart");
      t = 0;
      duration = length;
      fire("durationchange");
    },
    /** The player moves to another video without reloading: its time starts again and its length changes. */
    swap: (length: number) => {
      t = 0;
      duration = length;
      fire("durationchange");
    },
    play: () => {
      paused = false;
      fire("play");
    },
    end: () => {
      t = duration;
      paused = true;
      fire("pause");
      fire("ended");
    },
    /** Seconds of time pass; while playing, the media's clock moves and its time events fire. */
    run: (seconds: number) => {
      for (let i = 0; i < seconds * 4; i++) {
        vi.advanceTimersByTime(250);
        if (!paused) {
          t += 0.25;
          fire("timeupdate");
        }
      }
    },
    /** The rows D1 would hold once the listener stops: the messages fed to the real recorder, in order. */
    rows: async (settings?: Settings) => {
      paused = true;
      fire("pause"); // the listener stops: the last seconds are sent (a closing tab sends them the same way, on pagehide)
      vi.useRealTimers();
      const db = await openDb(new IDBFactory());
      if (settings) await putSettings(db, settings);
      for (const m of sent) await recordClosed(db, m, m.began_at ?? "2026-11-15T02:00:00");
      return (await loadPlays(db)).map((p) => ({ title: p.page_title, video: p.video_id, heard: p.heard_seconds, length: p.duration_seconds }));
    },
  };
  return stage;
}

/** No message pairs one video's page with another's length, and no token is used for two videos. */
function noMixing(sent: LivePage[], lengths: Record<string, number>) {
  for (const m of sent) if (m.facts && m.duration_seconds !== undefined) expect(m.duration_seconds).toBe(lengths[m.facts.video_id]);
  const videosOf = new Map<string, Set<string>>();
  for (const m of sent) {
    if (!m.facts) continue;
    if (!videosOf.has(m.play_token)) videosOf.set(m.play_token, new Set());
    videosOf.get(m.play_token)!.add(m.facts.video_id);
  }
  for (const v of videosOf.values()) expect(v.size).toBe(1);
}
const LENGTHS = { BV1ex4y1Ex0A: A.length, BV1ex4y1Ex0B: B.length };

describe("defect B: a change of video inside one page never mixes two videos' facts", () => {
  afterEach(() => vi.useRealTimers());
  it("(1) a list click: the earlier play keeps its own length, and no second of the next video is added to it", async () => {
    const s = await stagePage(A);
    s.load(A.length);
    s.play();
    s.run(A.length + 1); // a whole pass, as Bob's loop made
    s.end();
    s.play(); // the loop's next pass: a new play
    s.run(13);
    // The click in the list: the player loads the next video and plays it; the address follows, the title a moment later.
    s.load(B.length);
    s.play();
    s.run(0.5);
    s.page(B.url);
    s.run(2);
    s.title(B.title);
    s.run(0.5);
    // The player has the new video and the page shows its address and title: the panel hears of it at once.
    expect(s.sent.some((m) => m.facts?.video_id === "BV1ex4y1Ex0B")).toBe(true);
    s.run(29.5);
    noMixing(s.sent, LENGTHS);
    const rows = await s.rows();
    expect(rows.map((r) => [r.title, r.length])).toEqual([[A.title, 257], [A.title, 257], [B.title, 226]]);
    expect(rows[1]!.heard).toBeGreaterThanOrEqual(12);
    expect(rows[1]!.heard).toBeLessThanOrEqual(13); // the next video's seconds are not in it
    expect(Math.abs(rows[2]!.heard - 32.5)).toBeLessThanOrEqual(1); // every second of the next video is its own
  });
  it("(1b) a list click where the address changes first and the old video plays on a moment: those seconds stay with it", async () => {
    const s = await stagePage(A);
    s.load(A.length);
    s.play();
    s.run(20);
    s.page(B.url); // the address first
    s.run(1); // the old video still playing
    s.load(B.length);
    s.play();
    s.run(1);
    s.title(B.title);
    s.run(20);
    noMixing(s.sent, LENGTHS);
    const rows = await s.rows();
    expect(rows.map((r) => [r.title, r.length])).toEqual([[A.title, 257], [B.title, 226]]);
    expect(Math.abs(rows[0]!.heard - 21)).toBeLessThanOrEqual(1);
    expect(Math.abs(rows[1]!.heard - 21)).toBeLessThanOrEqual(1);
  });
  it("(1e) the address and title change together and the player loads the next video a second later: the old video's last second stays with it", async () => {
    const s = await stagePage(A);
    s.load(A.length);
    s.play();
    s.run(20);
    s.page(B.url, B.title);
    s.run(1); // the old video still playing under the new page
    s.load(B.length);
    s.play();
    s.run(20);
    noMixing(s.sent, LENGTHS);
    const rows = await s.rows();
    expect(rows.map((r) => [r.title, r.length])).toEqual([[A.title, 257], [B.title, 226]]);
    expect(Math.abs(rows[0]!.heard - 21)).toBeLessThanOrEqual(1);
    expect(Math.abs(rows[1]!.heard - 20)).toBeLessThanOrEqual(1);
  });
  it("(1c) a player that moves to the next video without reloading (only its length changes): the earlier play keeps its own length", async () => {
    const s = await stagePage(A);
    s.load(A.length);
    s.play();
    s.run(20);
    s.swap(B.length); // the player's source stays; its time starts again and its length changes
    s.run(1);
    s.page(B.url, B.title);
    s.run(20);
    noMixing(s.sent, LENGTHS);
    const rows = await s.rows();
    expect(rows.map((r) => [r.title, r.length])).toEqual([[A.title, 257], [B.title, 226]]);
    expect(rows[0]!.heard).toBeLessThanOrEqual(20);
    expect(Math.abs(rows[1]!.heard - 21)).toBeLessThanOrEqual(1);
  });
  it("(1d) the next video is as long as the one before and its address comes a second after the player loads it: no second of it goes to the earlier play", async () => {
    const C = { url: "https://www.bilibili.com/video/BV1ex4y1Ex0C", title: "Marrow & Tide《Low Bell》", length: A.length };
    const s = await stagePage(A);
    s.load(A.length);
    s.play();
    s.run(20);
    s.load(C.length);
    s.play();
    s.run(1);
    s.page(C.url);
    s.run(1);
    s.title(C.title);
    s.run(20);
    const rows = await s.rows();
    expect(rows.map((r) => [r.title, r.length])).toEqual([[A.title, 257], [C.title, 257]]);
    expect(rows[0]!.heard).toBeLessThanOrEqual(20);
    expect(Math.abs(rows[1]!.heard - 22)).toBeLessThanOrEqual(1);
  });
  it("(2) a click after the earlier video ended, or Bilibili's own autoplay: no row with the old title, 0 seconds and the next length", async () => {
    const changeAfterEnd = async () => {
      const s = await stagePage(A);
      s.load(A.length);
      s.play();
      s.run(30);
      s.end(); // the earlier video's clock has ended
      const resumedAt = localIso(); // recording switched back on here (Bob's check 2)
      s.run(2);
      s.load(B.length); // the player plays the next video while the page still shows the old one
      s.play();
      s.run(1);
      s.page(B.url);
      s.run(5); // the title is drawn late
      s.title(B.title);
      s.run(15);
      return { s, resumedAt };
    };
    const { s } = await changeAfterEnd();
    noMixing(s.sent, LENGTHS);
    const rows = await s.rows();
    expect(rows.map((r) => [r.title, r.length])).toEqual([[A.title, 257], [B.title, 226]]);
    expect(rows.every((r) => r.heard >= 1)).toBe(true);
    // After recording is switched back on, the earlier play (begun while paused) stays out and the next is kept alone.
    const again = await changeAfterEnd();
    noMixing(again.s.sent, LENGTHS);
    const resumed = await again.s.rows({ settings_id: 1, recording_resumed_at: again.resumedAt });
    expect(resumed.map((r) => [r.title, r.length])).toEqual([[B.title, 226]]);
    expect(Math.abs(resumed[0]!.heard - 21)).toBeLessThanOrEqual(1);
  });
  it("(3) a tab Chrome restored: its page shows one video while its player plays another; only the played video gets a row", async () => {
    const s = await stagePage(A, { playingAtLoad: { length: B.length } });
    s.run(1);
    s.page(B.url, B.title); // a second later the page catches up with its player
    s.run(40);
    noMixing(s.sent, LENGTHS);
    const rows = await s.rows();
    expect(rows.map((r) => [r.title, r.length])).toEqual([[B.title, 226]]);
    expect(Math.abs(rows[0]!.heard - 41)).toBeLessThanOrEqual(1);
  });
  it("the same video reloaded by its player (a change of quality) stays one play, and a page opened but never played leaves no row", async () => {
    const s = await stagePage(A);
    s.load(A.length);
    s.play();
    s.run(20);
    s.load(A.length); // the player reloads the same video
    s.play();
    s.run(20);
    const rows = await s.rows();
    expect(rows.map((r) => r.title)).toEqual([A.title]);
    expect(Math.abs(rows[0]!.heard - 40)).toBeLessThanOrEqual(1);
    const idle = await stagePage(A);
    idle.load(A.length);
    idle.run(30); // opened, never played
    expect(await idle.rows()).toEqual([]);
  });
  it("(2), with the panel open (as in Bob's check 2): the panel's card, fed the same messages, keeps only the played video, with its own length", async () => {
    const s = await stagePage(A);
    s.load(A.length);
    s.play();
    s.run(30);
    s.end();
    s.run(2);
    s.load(B.length);
    s.play();
    s.run(1);
    s.page(B.url);
    s.run(5);
    s.title(B.title);
    s.run(15);
    await s.rows(); // the listener stops; real timers from here
    vi.resetModules();
    vi.unstubAllGlobals();
    const factory = new IDBFactory();
    vi.stubGlobal("indexedDB", factory);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ count: 0, recordings: [] }), { status: 200, headers: { "content-type": "application/json" } })));
    const { hydrate } = await import("../ui/store");
    const { NowPlaying } = await import("../ui/NowPlaying");
    await hydrate();
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    for (const m of s.sent) if (m.facts) await act(async () => root.render(createElement(NowPlaying, { live: { ...m, facts: m.facts! } })));
    await act(async () => new Promise((r) => setTimeout(r, 300)));
    act(() => root.unmount());
    host.remove();
    const rows = (await loadPlays(await openDb(factory))).map((p) => [p.page_title, p.duration_seconds, p.heard_seconds >= 1, p.recorded_with]);
    expect(rows).toEqual([[A.title, 257, true, "panel open"], [B.title, 226, true, "panel open"]]);
  });
  it("the open panel keeps no row for a video not yet heard for a second, then keeps it at its first second", async () => {
    vi.resetModules();
    vi.unstubAllGlobals();
    vi.stubGlobal("indexedDB", new IDBFactory());
    const { actions, getState, hydrate } = await import("../ui/store");
    await hydrate();
    const row = { ...rowFor(msg({ play_token: "panel", heard_seconds: 1 }), null, "2026-11-15T02:00:00")!, recorded_with: "panel open" as const };
    await actions.savePlay({ ...row, heard_seconds: 0 });
    expect(getState().plays).toEqual([]);
    await actions.savePlay(row);
    expect(getState().plays.map((p) => p.play_id)).toEqual(["play-panel"]);
    const src = readFileSync(join(import.meta.dirname, "../ui/NowPlaying.tsx"), "utf8");
    expect(src).toContain("const first = savedHeard.current < 1 && live.heard_seconds >= 1;");
  });
  it("the recorder keeps a play's first length and never lets a row take another video's page", () => {
    const first = rowFor(msg({ duration_seconds: 257 }), null, "2026-11-15T02:00:00")!;
    expect(rowFor(msg({ duration_seconds: 226, heard_seconds: 9 }), first, "2026-11-15T02:00:09")).toMatchObject({ duration_seconds: 257, heard_seconds: 9 });
    expect(rowFor(msg({ facts: { ...FACTS, video_id: "BV1ex4y1Ex0B" }, heard_seconds: 9 }), first, "2026-11-15T02:00:09")).toBeNull();
    expect(rowFor(msg({ heard_seconds: 0, playing: true }), null, "2026-11-15T02:00:00")).toBeNull();
  });
});

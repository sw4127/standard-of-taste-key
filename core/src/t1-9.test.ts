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
import { localIso, lookupFailed, mayStore, needsRule, recordClosed, rowFor, waitingClosed } from "./recorder";
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

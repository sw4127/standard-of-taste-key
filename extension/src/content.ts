/**
 * The content script (FR-T1.2), on Bilibili pages. On a video page it reads the page already open and the
 * play, pause, time and ended events of its media element; on any other Bilibili page it reads nothing
 * and only answers that the page is Bilibili, so the idle panel can say search pages are not read
 * (FR-T1.7). It tells The Key's side panel, fetches nothing from Bilibili or anywhere, and nothing it
 * reads leaves this browser.
 *
 * T1.9 defect fix (2026-11-15): when the video changes inside one page (a click in its list, Bilibili's
 * own autoplay, a tab Chrome restores), the page and its player do not change at the same moment. The
 * play under way is frozen as soon as either changes, keeping its own seconds and its own length; what
 * the player plays next is counted apart, and becomes a play only once the page has settled on a video.
 */
import type { LivePage } from "@sot/core/src/model";
import { HeardClock, localIso, mediaOf, readPage, SETTLE_MS, titleStillOld, type PageFacts } from "./page";

export type LiveMessage = { type: "key:page" } & LivePage;

// ---- The play under way -------------------------------------------------------------------------------

let facts: PageFacts | null = null;
let clock = new HeardClock();
const newToken = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
let token = newToken();
/** FR-T1.9: local time this viewing first played; the store rule compares it with a pause or an erase. */
let began: string | undefined;
/** The play's own video length, read from the player only while the page shows that video. */
let length: number | undefined;

let media: HTMLMediaElement | null = null;
let playing = false;
let lastUrl = "";

/**
 * While the page or its player is changing video, what plays is counted here, apart from the play under
 * way, until the page has settled. `started`: when the hold began; `since`: when the page's facts last
 * changed; `mediaChanged`: whether the player itself has loaded something new.
 */
interface Hold {
  clock: HeardClock;
  began?: string;
  started: number;
  since: number;
  key: string;
  mediaChanged: boolean;
}
const newHold = (mediaChanged: boolean, key: string): Hold => ({ clock: new HeardClock(), started: Date.now(), since: Date.now(), key, mediaChanged });
/** A page just opened has not settled either: a restored tab can show one video's page while its player loads another. */
let hold: Hold | null = newHold(false, "");

const keyOf = (f: PageFacts | null) => (f ? `${f.video_id}:${f.part_number}:${f.page_title}` : "");
const sameVideo = (a: PageFacts | null, b: PageFacts | null) => !!a && !!b && a.video_id === b.video_id && a.part_number === b.part_number;
const mediaLength = () => (media && Number.isFinite(media.duration) && media.duration > 0 ? Math.round(media.duration) : undefined);

/** A new play: its own clock, its own token. */
function newPlay(c = new HeardClock(), at?: string) {
  clock = c;
  token = newToken();
  began = at;
}

const snapshot = (): LiveMessage => {
  // While held, the play under way is frozen: it is not playing, and nothing more is added to it.
  const live = playing && !hold;
  if (live && !began) began = localIso();
  return { type: "key:page", facts, play_token: token, heard_seconds: Math.floor(clock.heard), playing: live, ended: clock.ended, duration_seconds: length, ...(began ? { began_at: began } : {}) };
};

let lastSent = 0;
/** How often the media's own time events report a playing video (FR-T1.9: seconds heard within five of the listener's count). */
export const REPORT_EVERY_MS = 2000;

/** Tell the panel and the background part about the play under way. Nothing is sent outside the extension. */
function report() {
  lastSent = Date.now();
  chrome.runtime.sendMessage(snapshot()).catch(() => undefined);
}
/** Reports wait while the page is changing video: the play under way has said its last, the next is not known yet. */
function send() {
  if (!hold) report();
}

// ---- Holding a change of video ------------------------------------------------------------------------

/** The page or its player began to change video: freeze the play under way and count what plays next apart. */
function holdOn(mediaChanged: boolean) {
  if (hold) {
    if (mediaChanged && !hold.mediaChanged) {
      // The address changed first and the old video played on a moment: those seconds were its own.
      clock.absorb(hold.clock);
      clock.pause();
      if (facts) report();
      hold.clock = new HeardClock();
      hold.began = undefined;
      hold.mediaChanged = true;
    }
    return;
  }
  clock.pause();
  hold = newHold(mediaChanged, keyOf(facts));
  if (facts) report(); // the play under way says its last, with its own seconds and length, not playing
}

/** The page has settled on what it shows: go on with the same play, or begin the next with what was counted while held. */
function settle(next: PageFacts | null) {
  const h = hold!;
  hold = null;
  lastUrl = location.href;
  const d = mediaLength();
  // The same video reloaded by its player (a change of quality, say) is the same play, unless it had
  // reached its end (a replay is a new play) or the player now holds a video of another length.
  const same = sameVideo(facts, next) && (!h.mediaChanged || !length || !d || Math.abs(d - length) <= 1);
  if (same && !(clock.ended && h.clock.heard > 0)) {
    clock.absorb(h.clock);
    began ??= h.began;
  } else {
    newPlay(h.clock, h.began);
    if (!same) length = undefined;
  }
  facts = next;
  if (facts && !length) length = d;
  send();
}

/** Bilibili changes video without reloading the page: watch the address, the title and the player. */
function check() {
  bind(mediaOf(document));
  const next = readPage(document, location.href);
  const now = Date.now();
  if (!hold) {
    if (sameVideo(next, facts) || (!next && !facts)) {
      // The same video: a title redrawn late is taken as it is.
      lastUrl = location.href;
      if (keyOf(next) !== keyOf(facts)) {
        facts = next;
        send();
      } else if (playing) send();
      return;
    }
    holdOn(false);
  }
  const h = hold!;
  if (keyOf(next) !== h.key) {
    h.key = keyOf(next);
    h.since = now;
  }
  if (next && !next.page_title) return; // the page has not drawn its title yet
  if (next && titleStillOld(facts, next, now - h.started)) return; // the last video's title is still drawn
  // The player has loaded something new and the page already shows another video under another title:
  // nothing is left to wait for. Otherwise (a page just opened or restored, whose address can trail its
  // player) the page must hold still for SETTLE_MS.
  const caughtUp = h.mediaChanged && !!facts && !!next && !sameVideo(facts, next) && next.page_title !== facts.page_title;
  if (!caughtUp && now - h.since < SETTLE_MS) return; // the page is still changing
  settle(next);
}

// ---- The media's events -------------------------------------------------------------------------------

/**
 * The media's own time events, which keep firing in a tab that is not in front, where Chrome slows the
 * one-second timer below to about once a minute. So a video playing in a hidden tab still reports every
 * two seconds, and a change of video is noticed before its seconds are counted.
 */
const onTime = () => {
  if (!media) return;
  if (hold || location.href !== lastUrl) check();
  (hold ? hold.clock : clock).tick(media.currentTime, !media.paused);
  if (hold && !media.paused) hold.began ??= localIso();
  if (!hold && facts && !media.paused && Date.now() - lastSent >= REPORT_EVERY_MS) send();
};
const onPlay = () => {
  playing = true;
  if (hold) return; // what plays while held becomes a play when the page settles
  // FR-T1.9: playing a video again after it reached its end is a new play, with its own row.
  if (clock.ended) newPlay();
  send();
};
const onPause = () => {
  playing = false;
  (hold ? hold.clock : clock).pause();
  send();
};
const onEnded = () => {
  playing = false;
  (hold ? hold.clock : clock).end();
  send();
};
/** The player loads something new: Bilibili moves to another video, or reloads this one. */
const onLoad = () => holdOn(true);
/** The player reports a length: the play's own, or, if it differs from the play's, a sign the player holds another video. */
const onDuration = () => {
  const d = mediaLength();
  if (!d) return;
  if (hold) {
    if (!hold.mediaChanged && length && Math.abs(d - length) > 1) holdOn(true);
    return;
  }
  if (!length) {
    if (facts) length = d;
    send();
  } else if (Math.abs(d - length) > 1) holdOn(true);
};

const EVENTS: [string, () => void][] = [
  ["timeupdate", onTime], ["play", onPlay], ["pause", onPause], ["ended", onEnded],
  ["emptied", onLoad], ["loadstart", onLoad], ["durationchange", onDuration],
];

function bind(m: HTMLMediaElement | null) {
  if (m === media) return;
  const replaced = !!media && !!m;
  if (media) for (const [e, f] of EVENTS) media.removeEventListener(e, f);
  media = m;
  if (!m) return;
  for (const [e, f] of EVENTS) m.addEventListener(e, f);
  playing = !m.paused;
  if (replaced) holdOn(true); // Bilibili put a new player element in the page
}

chrome.runtime.onMessage.addListener((msg: { type?: string }, _sender, reply) => {
  if (msg?.type === "key:hello") reply(snapshot());
});

setInterval(check, 1000);
// The last seconds heard before the tab closes or leaves the page. A video still held when the tab closes
// is let go: its page has not settled, so its title is not known for sure.
addEventListener("pagehide", () => facts && report());
check();

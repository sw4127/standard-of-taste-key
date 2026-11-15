/**
 * The content script (FR-T1.2), on Bilibili pages. On a video page it reads the page already open and the
 * play, pause, time and ended events of its media element; on any other Bilibili page it reads nothing
 * and only answers that the page is Bilibili, so the idle panel can say search pages are not read
 * (FR-T1.7). It tells The Key's side panel, fetches nothing from Bilibili or anywhere, and nothing it
 * reads leaves this browser.
 */
import type { LivePage } from "@sot/core/src/model";
import { HeardClock, localIso, mediaOf, readPage, titleStillOld, type PageFacts } from "./page";

export type LiveMessage = { type: "key:page" } & LivePage;

let facts: PageFacts | null = null;
let clock = new HeardClock();
let media: HTMLMediaElement | null = null;
let playing = false;
let lastUrl = "";
let pendingUrl = "";
let pendingSince = 0;
const newToken = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
let token = newToken();
/** FR-T1.9: local time this viewing first played; the store rule compares it with a pause or an erase. */
let began: string | undefined;

/** A new play: its own clock, its own token, not yet played. */
function newPlay() {
  clock = new HeardClock();
  token = newToken();
  began = undefined;
}

const duration = () => (media && Number.isFinite(media.duration) && media.duration > 0 ? Math.round(media.duration) : undefined);
const snapshot = (): LiveMessage => {
  if (playing && !began) began = localIso();
  return { type: "key:page", facts, play_token: token, heard_seconds: Math.floor(clock.heard), playing, ended: clock.ended, duration_seconds: duration(), ...(began ? { began_at: began } : {}) };
};

function send() {
  // The open panel hears this, and so does the background part, which keeps the play while the
  // panel is closed (FR-T1.9). Nothing is sent outside the extension.
  chrome.runtime.sendMessage(snapshot()).catch(() => undefined);
}

const onTime = () => media && clock.tick(media.currentTime, !media.paused);
const onPlay = () => {
  // FR-T1.9: playing a video again after it reached its end is a new play, with its own row.
  if (clock.ended) newPlay();
  playing = true;
  send();
};
const onPause = () => {
  playing = false;
  clock.pause();
  send();
};
const onEnded = () => {
  playing = false;
  clock.end();
  send();
};

function bind(m: HTMLMediaElement | null) {
  if (m === media) return;
  if (media) {
    media.removeEventListener("timeupdate", onTime);
    media.removeEventListener("play", onPlay);
    media.removeEventListener("pause", onPause);
    media.removeEventListener("ended", onEnded);
  }
  media = m;
  if (!m) return;
  m.addEventListener("timeupdate", onTime);
  m.addEventListener("play", onPlay);
  m.addEventListener("pause", onPause);
  m.addEventListener("ended", onEnded);
  playing = !m.paused;
}

/** Bilibili changes video without reloading the page: watch the address and the title. */
function check() {
  bind(mediaOf(document));
  const url = location.href;
  const next = readPage(document, url);
  const key = (f: PageFacts | null) => (f ? `${f.video_id}:${f.part_number}:${f.page_title}` : "");
  if (url !== lastUrl || key(next) !== key(facts)) {
    const newVideo = !facts || !next || next.video_id !== facts.video_id || next.part_number !== facts.part_number;
    if (next && !next.page_title) return; // the page has not drawn its title yet
    if (url !== pendingUrl) {
      pendingUrl = url;
      pendingSince = Date.now();
    }
    if (next && titleStillOld(facts, next, Date.now() - pendingSince)) return; // the last video's title is still drawn
    lastUrl = url;
    facts = next;
    if (newVideo) newPlay();
    send();
  } else if (playing) {
    send();
  }
}

chrome.runtime.onMessage.addListener((msg: { type?: string }, _sender, reply) => {
  if (msg?.type === "key:hello") reply(snapshot());
});

setInterval(check, 1000);
check();

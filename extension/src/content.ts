/**
 * The content script (FR-T1.2), on Bilibili video pages only. It reads the page already open and the
 * play, pause, time and ended events of its media element, and tells The Key's side panel. It fetches
 * nothing, from Bilibili or anywhere; nothing it reads leaves this browser.
 */
import type { LivePage } from "@sot/core/src/model";
import { HeardClock, mediaOf, readPage, titleStillOld, type PageFacts } from "./page";

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

const snapshot = (): LiveMessage => ({ type: "key:page", facts, play_token: token, heard_seconds: Math.floor(clock.heard), playing, ended: clock.ended });

function send() {
  // The panel may be closed: then nobody listens, and that is fine.
  chrome.runtime.sendMessage(snapshot()).catch(() => undefined);
}

const onTime = () => media && clock.tick(media.currentTime, !media.paused);
const onPlay = () => {
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
    if (newVideo) {
      clock = new HeardClock();
      token = newToken();
    }
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

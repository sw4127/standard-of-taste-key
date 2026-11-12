/**
 * T1.2: what the content script reads from the Bilibili page already open (FR-T1.2). It reads the page
 * in front of the user, never fetches anything from Bilibili, and never reads comments or history.
 * Pure functions over a Document, so the test can feed them a page-shaped fixture.
 */

import { isRemovedVideoTitle } from "@sot/core/src/match/removed";
import type { PageFacts } from "@sot/core/src/model";
export type { PageFacts };

const BV = /\/video\/(BV[0-9A-Za-z]{10})/;
const text = (el: Element | null | undefined) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();

export function videoIdOf(url: string): string | null {
  return BV.exec(url)?.[1] ?? null;
}

export function readPage(doc: Document, url: string): PageFacts | null {
  const video_id = videoIdOf(url);
  if (!video_id) return null;
  const u = new URL(url);
  const og = doc.querySelector('meta[property="og:title"]')?.getAttribute("content") ?? "";
  const page_title = text(doc.querySelector("h1.video-title")) || text(doc.querySelector("h1")) || og.replace(/_哔哩哔哩_bilibili$/, "").trim();

  // FR-CORE-1 v7, step 4: Bilibili's notice for a removed video is not a video; nothing is read or stored.
  if (isRemovedVideoTitle(page_title)) return null;

  // One uploader shows .up-name; a video by several shows .staff-name, the first being the uploader.
  const up = doc.querySelector<HTMLAnchorElement>("a.up-name, .up-name, .staff-name");
  const upLink = up?.closest("a") ?? up;
  const href = (upLink as HTMLAnchorElement | null)?.getAttribute?.("href") ?? "";
  const uploader_name = text(up) || doc.querySelector('meta[name="author"]')?.getAttribute("content") || "";
  const uploader_id = /space\.bilibili\.com\/(?:[^/]+\/)?(\d+)/.exec(href)?.[1] ?? "";

  const pod = doc.querySelector(".video-pod__header .title, .base-video-sections-v1 .first-line-title, .video-sections-head_first-line .first-line-title");
  const items = [...doc.querySelectorAll(".video-pod__item, .video-section-list .video-episode-card")];
  const active = items.findIndex((el) => el.classList.contains("active") || el.querySelector(".active") !== null);

  const page_tags = [...doc.querySelectorAll(".tag-link")].map((e) => text(e).replace(/^#/, "")).filter(Boolean);
  const p = Number(u.searchParams.get("p") ?? "1");

  return {
    video_id,
    part_number: Number.isFinite(p) && p > 0 ? p : 1,
    page_title,
    uploader_name: uploader_name.trim(),
    uploader_id,
    list_title: text(pod),
    list_position: active >= 0 ? active + 1 : null,
    page_tags,
  };
}

/** How long to wait for Bilibili to redraw the title after it has changed the address. */
export const TITLE_WAIT_MS = 4000;

/**
 * Bilibili changes the address to the next video before it redraws the title, so for a moment the page
 * shows the new video with the last one's title (Bob's five-video check). Wait for the title to change,
 * up to TITLE_WAIT_MS; two videos can share a title, so after that the title is taken as it is.
 */
export function titleStillOld(prev: PageFacts | null, next: PageFacts, waitedMs: number): boolean {
  const newVideo = !!prev && (next.video_id !== prev.video_id || next.part_number !== prev.part_number);
  return newVideo && next.page_title === prev!.page_title && waitedMs < TITLE_WAIT_MS;
}

/** The page's media element: a plain <video>, or Bilibili's own player element where it uses one. */
export function mediaOf(doc: Document): HTMLMediaElement | null {
  return doc.querySelector<HTMLMediaElement>("video") ?? doc.querySelector<HTMLMediaElement>("bwp-video");
}

/**
 * Seconds heard: play time only. Pauses, seeks and buffering add nothing; a jump forward is not
 * counted as heard.
 */
export class HeardClock {
  private last: number | null = null;
  heard = 0;
  ended = false;
  /** Call on every timeupdate while the media plays. */
  tick(currentTime: number, playing: boolean) {
    if (!playing) {
      this.last = null;
      return;
    }
    if (this.last !== null) {
      const d = currentTime - this.last;
      if (d > 0 && d < 2) this.heard += d; // a seek jumps more than 2 s, or backwards
    }
    this.last = currentTime;
  }
  pause() {
    this.last = null;
  }
  end() {
    this.ended = true;
    this.last = null;
  }
}

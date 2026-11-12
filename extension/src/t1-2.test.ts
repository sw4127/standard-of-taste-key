// @vitest-environment happy-dom
/** T1.2 The content script reads the page in front of the user (FR-T1.2): facts, seconds heard, nothing fetched. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { HeardClock, mediaOf, readPage, TITLE_WAIT_MS, titleStillOld, videoIdOf } from "./page";

/** A page shaped like a Bilibili video page (fictional uploader and songs; the class names are Bilibili's). */
const PAGE = `
<head><meta property="og:title" content="Juniper Varga《Glass Harbour》Example Uploader_哔哩哔哩_bilibili"><meta name="author" content="Example Uploader"></head>
<body>
  <h1 class="video-title special-text-indent">Juniper Varga《Glass Harbour》Example Uploader</h1>
  <div class="up-detail-top"><a class="up-name" href="//space.bilibili.com/zh-Hans/123456">Example Uploader</a></div>
  <div class="video-pod"><div class="video-pod__header"><div class="header-top"><div class="left"><a class="title jumpable">Example Sessions</a></div></div></div>
    <div class="video-pod__item">One</div><div class="video-pod__item active">Two</div><div class="video-pod__item">Three</div></div>
  <div class="tag-panel"><a class="tag-link">#音乐</a><a class="tag-link">#Example</a></div>
  <video></video>
</body>`;

describe("reading the page", () => {
  document.documentElement.innerHTML = PAGE;
  it("reads the title, the uploader and their ID, the list and its position, the tags and the part", () => {
    expect(readPage(document, "https://www.bilibili.com/zh-Hans/video/BV1ab4y1c7DE/?p=2&spm_id_from=x")).toEqual({
      video_id: "BV1ab4y1c7DE", part_number: 2, page_title: "Juniper Varga《Glass Harbour》Example Uploader",
      uploader_name: "Example Uploader", uploader_id: "123456", list_title: "Example Sessions", list_position: 2, page_tags: ["音乐", "Example"],
    });
  });
  it("finds the media element", () => {
    expect(mediaOf(document)?.tagName).toBe("VIDEO");
  });
  it("reads nothing off a page that is not a video", () => {
    expect(videoIdOf("https://www.bilibili.com/c/music/")).toBeNull();
    expect(readPage(document, "https://www.bilibili.com/")).toBeNull();
  });
  it("the 音乐 tag is read as a clue and never gates a match", () => {
    const src = readFileSync(join(__dirname, "..", "..", "core", "src", "match", "v6.ts"), "utf8");
    expect(src).not.toMatch(/音乐|page_tags/);
  });
});

describe("a removed video is not a video (FR-CORE-1 v7, step 4)", () => {
  // Bob's panel export of 2026-11-10 held three such pages stored as plays, each with 0 seconds heard.
  const removed = (title: string) => `<head><meta property="og:title" content="${title}_哔哩哔哩_bilibili"></head><body><h1 class="video-title">${title}</h1><video></video></body>`;
  it("Bilibili's notice for a removed video gives no page facts, so nothing is stored", () => {
    for (const t of ["视频去哪了呢？", "视频去哪了呢"]) {
      document.documentElement.innerHTML = removed(t);
      expect(readPage(document, "https://www.bilibili.com/video/BV1ex4y1Ex01/"), t).toBeNull();
    }
  });
  it("a real video whose title merely holds those words is still read", () => {
    document.documentElement.innerHTML = removed("视频去哪了呢？一首歌的故事");
    expect(readPage(document, "https://www.bilibili.com/video/BV1ex4y1Ex01/")?.page_title).toBe("视频去哪了呢？一首歌的故事");
  });
});

describe("moving to the next video without a reload (Bob's five-video check)", () => {
  const first = { video_id: "BV1ab4y1c7DE", part_number: 1, page_title: "Juniper Varga《Glass Harbour》", uploader_name: "", uploader_id: "", list_title: "", list_position: null, page_tags: [] };
  const second = { ...first, video_id: "BV1zz4y1c7ZZ", page_title: "Example Singer《Paper Lantern》" };
  it("waits while the new address still shows the last video's title", () => {
    expect(titleStillOld(first, { ...second, page_title: first.page_title }, 500)).toBe(true);
  });
  it("reads the new video once its title is drawn, or after the wait if two videos share a title", () => {
    expect(titleStillOld(first, second, 500)).toBe(false);
    expect(titleStillOld(first, { ...second, page_title: first.page_title }, TITLE_WAIT_MS)).toBe(false);
    expect(titleStillOld(null, second, 0)).toBe(false);
  });
});

describe("seconds heard count play time only", () => {
  it("adds time while playing, nothing while paused, and never a jump", () => {
    const c = new HeardClock();
    for (let t = 0; t <= 10; t += 0.25) c.tick(t, true);
    expect(Math.round(c.heard)).toBe(10);
    c.pause();
    c.tick(10, false);
    c.tick(70, true); // a seek forward while paused, then play resumes
    for (let t = 70.25; t <= 75; t += 0.25) c.tick(t, true);
    expect(Math.round(c.heard)).toBe(15);
    c.tick(30, true); // a seek backwards
    expect(Math.round(c.heard)).toBe(15);
    c.end();
    expect(c.ended).toBe(true);
  });
});

describe("the content script fetches nothing", () => {
  it("has no fetch, XMLHttpRequest or Bilibili API address in it", () => {
    for (const f of ["content.ts", "page.ts"]) {
      const src = readFileSync(join(__dirname, f), "utf8");
      expect(src).not.toMatch(/fetch\(|XMLHttpRequest|api\.bilibili|sendBeacon|WebSocket/);
    }
  });
  it("runs on Bilibili pages only, and reads page facts only from a video page (FR-T1.7 needs to know a search page is Bilibili)", () => {
    const m = JSON.parse(readFileSync(join(__dirname, "..", "public", "manifest.json"), "utf8"));
    expect(m.content_scripts[0].matches).toEqual(["https://*.bilibili.com/*"]);
    document.documentElement.innerHTML = "<head><title>search</title></head><body><h1>Glass Harbour</h1><video></video></body>";
    expect(readPage(document, "https://search.bilibili.com/all?keyword=x")).toBeNull();
    expect(m.host_permissions).toEqual(["https://musicbrainz.org/*", "https://acousticbrainz.org/*", "https://www.wikidata.org/*"]);
    expect(m.host_permissions.join()).not.toMatch(/bilibili/);
  });
});

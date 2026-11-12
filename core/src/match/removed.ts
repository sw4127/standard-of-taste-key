/**
 * FR-CORE-1 v7, step 4 (T1.2): a page whose title is Bilibili's notice for a removed video is not a
 * video, and nothing is stored for it. Kept apart from the rule so the content script, which fetches
 * nothing, can read it without carrying the matching code.
 */
export const REMOVED_VIDEO_TITLES = ["视频去哪了呢？", "视频去哪了呢", "视频不见了"];
export const isRemovedVideoTitle = (title: string) => REMOVED_VIDEO_TITLES.includes(title.replace(/_哔哩哔哩_bilibili$/, "").trim());

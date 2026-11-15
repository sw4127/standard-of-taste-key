/**
 * T1.9 A record with the panel closed (FR-T1.9, Amendment of 2026-11-14). The extension's background
 * part hears the content script's messages while no side panel is open, and keeps each play in D1, the
 * store the panel reads, marked `recorded_with: "panel closed"`. It makes no network call, matches
 * nothing and draws nothing: matching waits until the panel is opened. Nothing here leaves the browser.
 */
import type { LivePage, PageFacts, PlayRow } from "./model";
import { getPlay, putPlay } from "./storage";

/** The play's ID, the same one the open panel uses for the same viewing (NowPlaying). */
export const playIdOf = (token: string) => `play-${token}`;

/** Local time, ISO without zone, as D1's started_at is kept. */
export function localIso(d: Date = new Date()): string {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 19);
}

const pageFields = (f: PageFacts) => ({
  video_id: f.video_id, part_number: f.part_number, page_title: f.page_title, uploader_name: f.uploader_name, uploader_id: f.uploader_id,
  list_title: f.list_title, list_position: f.list_position, page_tags: f.page_tags,
});

/**
 * The row to store for one message, or null when there is nothing to store: a page that is not a
 * video page, or a video page that has not been played. An earlier row for the same play is added to,
 * never replaced: its start, how it was recorded and anything the panel matched are kept.
 */
export function rowFor(msg: LivePage, earlier: PlayRow | null, at: string): PlayRow | null {
  const f = msg.facts;
  if (!f) return null;
  if (!earlier && !msg.playing && msg.heard_seconds <= 0) return null;
  const heard = Math.max(earlier?.heard_seconds ?? 0, msg.heard_seconds);
  const reached_end: PlayRow["reached_end"] = msg.ended || earlier?.reached_end === "yes" ? "yes" : "no";
  if (earlier && earlier.match_rule_version) return { ...earlier, heard_seconds: heard, reached_end };
  // Not matched yet: the page's latest facts are taken, since Bilibili can redraw a title late.
  if (earlier) return { ...earlier, ...pageFields(f), heard_seconds: heard, reached_end };
  return {
    play_id: playIdOf(msg.play_token), source: "live page", ...pageFields(f),
    started_at: at, heard_seconds: heard, reached_end,
    // Not matched yet: the empty rule version says the rule has not been tried on this play.
    recording_id: "", match_state: "unsure", match_rule_version: "",
    recorded_with: "panel closed",
  };
}

/** Store one message's play while the panel is closed. Returns the row stored, or null. */
export async function recordClosed(db: IDBDatabase, msg: LivePage, at: string = localIso()): Promise<PlayRow | null> {
  if (!msg.facts) return null;
  const earlier = await getPlay(db, playIdOf(msg.play_token));
  const row = rowFor(msg, earlier, at);
  if (!row) return null;
  if (earlier && JSON.stringify(earlier) === JSON.stringify(row)) return earlier;
  await putPlay(db, row);
  return row;
}

/** A play the rule has not yet been tried on: kept with the panel closed, matching waits for the panel. */
export const needsRule = (p: PlayRow) => !p.match_rule_version;

/**
 * A lookup that could not reach MusicBrainz (it refuses some calls with "busy", HTTP 503) has not tried
 * the rule: the play is kept as not yet tried, so the panel tries it again later (FR-T1.9, point 3).
 */
export const lookupFailed = (p: PlayRow): PlayRow => ({ ...p, match_rule_version: "" });

/** Plays recorded while the panel was closed that the rule has not yet been tried on (FR-T1.9, point 3). */
export const waitingClosed = (plays: PlayRow[]) => plays.filter((p) => p.recorded_with === "panel closed" && needsRule(p));

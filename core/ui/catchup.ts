"use client";
/**
 * T1.9 point 3 (FR-T1.9): when the panel opens, the plays the rule has not yet been tried on (those kept
 * while the panel was closed, and any whose lookup MusicBrainz refused) are matched one at a time,
 * oldest first, through the same rate gate as every other MusicBrainz call (one call per 1.2 s), while
 * the panel stays usable: nothing waits for it. A video the person fixed before uses the fix and makes
 * no call. Only a recording's name leaves the browser, as for a play matched live (rule 6).
 */
import { matchTitle, RULE_VERSION } from "../src/match/v7";
import type { PageFacts, PlayRow } from "../src/model";
import { needsRule } from "../src/recorder";
import type { FetchFn } from "../src/sources/http";
import { earlierFix, keepWithFacts } from "./NowPlaying";
import { actions, getState } from "./store";

/** After this many lookups in a row that MusicBrainz refuses, the run stops; the next opening tries again. */
export const STOP_AFTER_FAILURES = 3;

export interface CatchUpDeps {
  fetchFn: FetchFn;
  /** The play the panel is showing now: NowPlaying matches it itself. */
  skip?: () => string | undefined;
  /** For tests: the rule, replaced by a stand-in. */
  match?: typeof matchTitle;
}

export interface CatchUpResult {
  named: number;
  silent: number;
  fixed: number;
  failed: number;
  stopped: boolean;
}

let running: Promise<CatchUpResult> | null = null;

/** Match the plays waiting for the rule. One run at a time; a second call while one runs joins it. */
export function catchUp(d: CatchUpDeps): Promise<CatchUpResult> {
  return (running ??= run(d).finally(() => (running = null)));
}

async function run(d: CatchUpDeps): Promise<CatchUpResult> {
  const match = d.match ?? matchTitle;
  const out: CatchUpResult = { named: 0, silent: 0, fixed: 0, failed: 0, stopped: false };
  const waiting = getState().plays.filter(needsRule).sort((a, b) => a.started_at.localeCompare(b.started_at)).map((p) => p.play_id);
  let failuresInRow = 0;
  for (const id of waiting) {
    // Read the row as it is now: the panel may have matched it, or seconds heard may have grown.
    const row = getState().plays.find((p) => p.play_id === id);
    if (!row || !needsRule(row) || d.skip?.() === id) continue;
    const fix = earlierFix(getState().plays, row as PageFacts);
    if (fix) {
      await actions.saveMatch({ ...row, recording_id: fix.recording_id, match_state: fix.match_state, song_title: fix.song_title, song_artist: fix.song_artist, match_rule_version: RULE_VERSION });
      out.fixed++;
      continue;
    }
    let next: PlayRow;
    try {
      const result = await match(row.page_title, { fetchFn: d.fetchFn }, { videoSeconds: row.duration_seconds });
      failuresInRow = 0;
      if (result.state === "certain") {
        // Waited for, so the catch-up never has more than one call in MusicBrainz's queue: the song on screen waits one turn at most.
        await keepWithFacts(result.candidate, "rule", row.play_id, d.fetchFn);
        next = { ...row, recording_id: result.candidate.recording_id, match_state: "certain", song_title: result.candidate.title, song_artist: result.candidate.artist_credit, match_rule_version: RULE_VERSION };
        out.named++;
      } else {
        next = { ...row, match_rule_version: RULE_VERSION };
        out.silent++;
      }
    } catch {
      out.failed++;
      if (++failuresInRow >= STOP_AFTER_FAILURES) {
        out.stopped = true;
        break;
      }
      continue; // left as not yet tried
    }
    // Merge into the newest row: seconds heard may have grown while the rule ran.
    const latest = getState().plays.find((p) => p.play_id === id) ?? row;
    if (!needsRule(latest)) continue; // the panel matched or fixed it meanwhile
    await actions.saveMatch({ ...latest, recording_id: next.recording_id, match_state: next.match_state, song_title: next.song_title, song_artist: next.song_artist, match_rule_version: next.match_rule_version });
  }
  return out;
}


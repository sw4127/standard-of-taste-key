/** T1.4 Fix a match (FR-T1.4): a pick holds for every later play of the same video and part. */
import { describe, expect, it } from "vitest";
import { earlierFix } from "../ui/NowPlaying";
import type { PlayRow } from "./model";

describe("FR-T1.4: a pick holds for every later play of the same video", () => {
  const play = (over: Partial<PlayRow>): PlayRow => ({
    play_id: Math.random().toString(), source: "live page", video_id: "BV1ab4y1c7DE", part_number: 1, page_title: "t", uploader_name: "", uploader_id: "",
    list_title: "", list_position: null, page_tags: [], started_at: "2026-11-08T10:00:00", heard_seconds: 0, reached_end: "no",
    recording_id: "", match_state: "unsure", match_rule_version: "v6", ...over,
  });
  const facts = { video_id: "BV1ab4y1c7DE", part_number: 1, page_title: "t", uploader_name: "", uploader_id: "", list_title: "", list_position: null, page_tags: [] };
  it("the latest pick for this video and part is used; other videos and parts are not", () => {
    const plays = [
      play({ match_state: "fixed by me", recording_id: "first-pick", started_at: "2026-11-08T09:00:00" }),
      play({ match_state: "fixed by me", recording_id: "second-pick", started_at: "2026-11-08T09:30:00" }),
      play({ match_state: "unsure" }),
      play({ part_number: 2, match_state: "not a song" }),
      play({ video_id: "BV1zz4y1c7ZZ", match_state: "fixed by me", recording_id: "elsewhere" }),
    ];
    expect(earlierFix(plays, facts)?.recording_id).toBe("second-pick");
    expect(earlierFix(plays, { ...facts, part_number: 2 })?.match_state).toBe("not a song");
    expect(earlierFix(plays, { ...facts, video_id: "BV1qq4y1c7QQ" })).toBeUndefined();
  });
});

describe("a pick is kept with its recording", () => {
  it("the snapshot holds every recording the store knows, whatever order the saves ran in", async () => {
    const { toSnapshot } = await import("../ui/store");
    const { EXAMPLE_CATALOGUE } = await import("./examples");
    const f = EXAMPLE_CATALOGUE[0]!;
    const snap = toSnapshot({ ready: true, people: [], songs: [], facts: { [f.recording_id]: f }, matchedBy: { [f.recording_id]: "my fix" }, disputed: [], choices: [], words: [], events: [], histories: {}, plays: [], keys: [], nexts: [], story_shown_count: 0 });
    expect(snap.recordings.map((r) => [r.recording_id, r.matched_by])).toEqual([[f.recording_id, "my fix"]]);
  });
});

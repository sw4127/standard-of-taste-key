/** T8.1 A usage log, my numbers, and an export (FR-T8.1): times from a fixture log; the export leaves a friend's rows out by default. */
import { describe, expect, it } from "vitest";
import { exportRecord, laterPlayed, songTimes } from "./numbers";
import type { NextRow } from "./model";
import { EVENT_KINDS, type Snapshot, type UsageEvent } from "./storage";
import { FRIEND, friendPlays, play, SONG } from "./testing/panel";

const e = (kind: UsageEvent["kind"], at: string, play_id?: string, extra: Partial<UsageEvent> = {}): UsageEvent => ({ event_id: `${kind}${at}`, kind, at, ...(play_id ? { play_id } : {}), ...extra });

describe("the log", () => {
  it("has every kind the PRD lists for D9, and the eight A5 added for the reading", () => {
    expect(EVENT_KINDS).toHaveLength(29);
    expect(EVENT_KINDS).toContain("next_search_opened");
    for (const k of ["reading_made", "reading_refused", "guess_accepted", "guess_fixed", "guess_rejected"] as const) expect(EVENT_KINDS).toContain(k);
  });
});

describe("my numbers", () => {
  const p1 = play(SONG, "2026-11-08T20:00:00");
  const p2 = play(SONG, "2026-11-08T20:05:00");
  const log = [
    e("song_started", "2026-11-08T12:00:00.000Z", p1.play_id),
    e("key_ready", "2026-11-08T12:00:02.000Z", p1.play_id),
    e("key_shown", "2026-11-08T12:01:00.000Z", p1.play_id),
    e("made_opened", "2026-11-08T12:01:30.000Z", p1.play_id),
    e("proof_opened", "2026-11-08T12:02:00.000Z", p1.play_id),
    e("song_started", "2026-11-08T12:05:00.000Z", p2.play_id),
    e("key_ready", "2026-11-08T12:05:01.000Z", p2.play_id),
    e("song_named", "2026-11-08T12:06:00.000Z"),
  ];
  it("ready, shown and the first act, in seconds from the song's start; 'no act' when none", () => {
    const t = songTimes(log, [p1, p2]);
    expect(t).toHaveLength(2);
    expect(t[0]).toMatchObject({ song: "Glass Harbour · Juniper Varga", ready: 2, shown: 60, firstAct: { kind: "made_opened", after: 90 } });
    expect(t[1]!.ready).toBe(1);
    expect(t[1]!.shown).toBeUndefined();
    expect(t[1]!.firstAct).toBeUndefined();
  });
  it("lists suggested records later played", () => {
    const n: NextRow = { suggestion_id: "s", from_recording_id: SONG.recording_id, play_id: p1.play_id, release_group_id: "rg", record_title: "Harbour Lights", artist: "Juniper Varga", track_recording_ids: [], reasons: [], shown_at: "2026-11-08T20:01:00", later_played_play_id: p2.play_id };
    expect(laterPlayed([n], [p1, p2])).toEqual([{ record: "Harbour Lights", artist: "Juniper Varga", played_at: "2026-11-08T20:05:00" }]);
  });
});

describe("the export", () => {
  const snapshot: Snapshot = {
    recordings: [], facts: [], settings: [{ settings_id: 1 }],
    choices: [
      { question_id: "q1", person_id: "me", source: "named songs", pattern_kind: "tempo", pattern_text: "p", evidence: [], readings_offered: ["a", "b"], readings_kept: ["a", "b"], choice: "first", answered_at: "x" },
      { question_id: "q2", person_id: "person-f", source: "a history", pattern_kind: "look-back:arrived", pattern_text: "friend's", evidence: [{ text: "a friend's track", source: { label: "Spotify file" } }], readings_offered: ["a", "b"], readings_kept: ["a", "b"], choice: "first", answered_at: "x" },
    ],
    events: [e("song_named", "x", undefined, { person_id: "me" }), e("history_loaded", "y", undefined, { person_id: "person-f" })],
    people: [{ person_id: "me", label: "me", source: "named songs", loaded_at: "x" }, FRIEND],
    songs: [], words: [], readings: [],
  };
  const histories = { me: friendPlays(3, "A", "B", () => "C").map((r, i) => ({ ...r, person_id: "me", history_id: `me:${i}` })), "person-f": friendPlays(30, "A", "B", () => "C") };
  it("leaves the friend's D11 rows, and their readings, people row and events, out by default", () => {
    const x = exportRecord({ snapshot, plays: [], keys: [], nexts: [], histories }, false, "2026-11-08T20:00:00Z");
    expect(x.D11_listening_history).toHaveLength(3);
    expect(x.D6_offered_readings.map((c) => c.question_id)).toEqual(["q1"]);
    expect(x.D12_people.map((p) => p.person_id)).toEqual(["me"]);
    expect(JSON.stringify(x)).not.toMatch(/a friend's track|person-f/);
  });
  it("includes them only when the person ticks to", () => {
    const x = exportRecord({ snapshot, plays: [], keys: [], nexts: [], histories }, true, "2026-11-08T20:00:00Z");
    expect(x.D11_listening_history).toHaveLength(33);
    expect(x.D6_offered_readings).toHaveLength(2);
  });
});

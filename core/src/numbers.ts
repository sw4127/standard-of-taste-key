/**
 * T8.1 My numbers and my record (FR-T8.1). Song by song, three times measured from the song's start:
 * ready (song_started → key_ready), shown (→ key_shown) and first act (→ the first of proof_opened,
 * made_opened, next_search_opened, uploader_opened, line_dropped), or "no act". No averages are
 * presented as findings. The export is one JSON file of every store; other people's rows (a friend's
 * plays, songs, readings, words and events) stay out unless the person ticks to include them.
 */
import type { HistoryRow, KeyRow, NextRow, PlayRow } from "./model";
import type { Snapshot, UsageEvent } from "./storage";

export const ACTS = ["proof_opened", "made_opened", "next_search_opened", "uploader_opened", "line_dropped"] as const;

export interface SongTimes {
  play_id: string;
  song: string;
  started_at: string;
  /** Seconds from the song's start; undefined when it never happened. */
  ready?: number;
  shown?: number;
  firstAct?: { kind: (typeof ACTS)[number]; after: number };
}

const secs = (from: string, to: string) => Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / 1000));

export function songTimes(events: UsageEvent[], plays: PlayRow[]): SongTimes[] {
  const byPlay = new Map<string, UsageEvent[]>();
  for (const e of events) if (e.play_id) byPlay.set(e.play_id, [...(byPlay.get(e.play_id) ?? []), e]);
  const out: SongTimes[] = [];
  for (const [play_id, es] of byPlay) {
    const sorted = [...es].sort((a, b) => a.at.localeCompare(b.at));
    const start = sorted.find((e) => e.kind === "song_started");
    if (!start) continue;
    const p = plays.find((x) => x.play_id === play_id);
    const first = (k: string) => sorted.find((e) => e.kind === k && e.at >= start.at);
    const ready = first("key_ready");
    const shown = first("key_shown");
    const act = sorted.find((e) => (ACTS as readonly string[]).includes(e.kind) && e.at >= start.at);
    out.push({
      play_id,
      song: p?.song_title ? `${p.song_title} · ${p.song_artist ?? ""}`.replace(/ · $/, "") : p?.page_title ?? "a video",
      // Shown in the person's own local time (the play's), measured on the log's clock.
      started_at: p?.started_at ?? start.at,
      ...(ready ? { ready: secs(start.at, ready.at) } : {}),
      ...(shown ? { shown: secs(start.at, shown.at) } : {}),
      ...(act ? { firstAct: { kind: act.kind as (typeof ACTS)[number], after: secs(start.at, act.at) } } : {}),
    });
  }
  return out.sort((a, b) => a.started_at.localeCompare(b.started_at));
}

/** Suggested records later played (D7 later_played_play_id). */
export function laterPlayed(nexts: NextRow[], plays: PlayRow[]): { record: string; artist: string; played_at: string }[] {
  return nexts
    .filter((n) => n.later_played_play_id)
    .map((n) => ({ record: n.record_title, artist: n.artist, played_at: plays.find((p) => p.play_id === n.later_played_play_id)?.started_at ?? "" }));
}

export interface Everything {
  snapshot: Snapshot;
  plays: PlayRow[];
  keys: KeyRow[];
  nexts: NextRow[];
  histories: Record<string, HistoryRow[]>;
}

/** The export: every store; rows about anyone but "me" only when the person asks for them. */
export function exportRecord(all: Everything, includeOthers: boolean, at: string) {
  const mine = <T extends { person_id?: string }>(rows: T[]) => (includeOthers ? rows : rows.filter((r) => !r.person_id || r.person_id === "me"));
  const s = all.snapshot;
  return {
    exported_at: at,
    note: includeOthers ? "Includes other people's rows, as the person chose." : "Other people's rows (their plays, songs, readings, words and events) are left out.",
    D1_plays: all.plays,
    D2_recordings: s.recordings,
    D3_credit_facts: s.facts,
    D5_keys: all.keys,
    D6_offered_readings: mine(s.choices),
    D7_next_records: all.nexts,
    D8_settings: s.settings,
    D9_usage_events: mine(s.events),
    D11_listening_history: Object.values(all.histories).flat().filter((r) => includeOthers || r.person_id === "me"),
    D12_people: mine(s.people),
    D13_named_songs: mine(s.songs),
    D14_my_words: mine(s.words),
    // FR-T9.9: the readings, shown as they were made. D16 (the key) is never part of an export.
    D15_readings: mine(s.readings ?? []),
  };
}

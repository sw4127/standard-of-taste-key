/**
 * The proof behind a line (moment map P-5 to P-8; FR-T3.1, T3.3, T3.4, T4.1).
 * - "Since you installed" (FR-T3.3): plays of this song, the hours grouped, and the songs played just
 *   before and after it, counted only from D1.
 * - Sancho's story (FR-T3.4): by itself on the first proof ever opened, once more on the first proof of
 *   a later day, then only by tapping "The key in the barrel".
 * - How it was made (FR-T4.1): the credits in plain words, grouped, each role followed by its meaning.
 */
import type { CreditRole, PlayRow, SongFacts, Source } from "./model";
import { ROLE_MEANING } from "./templates";

export const HOURS = ["morning", "afternoon", "evening", "after midnight"] as const;
export type HourGroup = (typeof HOURS)[number];

/** 05:00–11:59 morning, 12:00–16:59 afternoon, 17:00–23:59 evening, 00:00–04:59 after midnight. */
export function hourGroup(localIso: string): HourGroup {
  const h = Number(localIso.slice(11, 13));
  return h < 5 ? "after midnight" : h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
}

const songOf = (p: PlayRow) => (p.song_title ? `${p.song_title} · ${p.song_artist ?? ""}`.replace(/ · $/, "") : p.page_title);

export interface SinceInstalled {
  plays: number;
  hours: Record<HourGroup, number>;
  before: { song: string; times: number }[];
  after: { song: string; times: number }[];
}

export function sinceInstalled(plays: PlayRow[], recording_id: string): SinceInstalled | null {
  const sorted = [...plays].sort((a, b) => a.started_at.localeCompare(b.started_at));
  const idx = sorted.map((p, i) => (p.recording_id === recording_id ? i : -1)).filter((i) => i >= 0);
  if (!idx.length) return null;
  const hours = Object.fromEntries(HOURS.map((h) => [h, 0])) as Record<HourGroup, number>;
  const before = new Map<string, number>();
  const after = new Map<string, number>();
  for (const i of idx) {
    hours[hourGroup(sorted[i]!.started_at)]++;
    const prev = sorted[i - 1];
    const next = sorted[i + 1];
    if (prev && prev.recording_id !== recording_id) before.set(songOf(prev), (before.get(songOf(prev)) ?? 0) + 1);
    if (next && next.recording_id !== recording_id) after.set(songOf(next), (after.get(songOf(next)) ?? 0) + 1);
  }
  const top = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 3).map(([song, times]) => ({ song, times }));
  return { plays: idx.length, hours, before: top(before), after: top(after) };
}

/** FR-T3.4: does Sancho's story show by itself as this proof opens? */
export function sanchoByItself(shownCount: number, lastShownOn: string | undefined, today: string): boolean {
  if (shownCount === 0) return true;
  return shownCount === 1 && lastShownOn !== undefined && lastShownOn < today;
}

// ---- How it was made ------------------------------------------------------------------------------

export const MADE_GROUPS: { heading: string; roles: CreditRole[] }[] = [
  { heading: "Who wrote it", roles: ["writer", "arranger"] },
  { heading: "Who played and sang", roles: ["performer", "programming"] },
  { heading: "Who produced, recorded, mixed and mastered it", roles: ["producer", "recording engineer", "mixer", "mastering engineer"] },
];
export const NO_CREDITS = "MusicBrainz lists no credits for this recording yet.";

export interface MadeLine {
  text: string;
  source: Source;
}

/** FR-T4.1: each credit as "Name, role (detail): meaning." grouped; places and dates under "Where and when". */
export function howItWasMade(f: SongFacts): { heading: string; lines: MadeLine[] }[] | null {
  const groups = MADE_GROUPS.map((g) => ({
    heading: g.heading,
    lines: f.people
      .filter((p) => g.roles.includes(p.role))
      .sort((a, b) => g.roles.indexOf(a.role) - g.roles.indexOf(b.role))
      .map((p) => ({ text: `${p.name}, ${p.role}${p.detail ? ` (${p.detail})` : ""}: ${ROLE_MEANING[p.role]}.`, source: p.source })),
  }));
  const places = (f.places ?? []).map((p) => ({ text: `${p.role === "recorded at" ? "Recorded" : p.role === "mixed at" ? "Mixed" : "Mastered"} at ${p.name}${p.date ? `, ${p.date}` : ""}.`, source: p.source }));
  const out = [...groups, { heading: "Where and when", lines: places }].filter((g) => g.lines.length);
  return out.length ? out : null;
}

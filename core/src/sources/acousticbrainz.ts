/**
 * AcousticBrainz low-level data (FR-CORE-3; CC0): tempo and key only, read from a fixed list of
 * fields. Its high-level mood and genre classifiers are never requested and never read (R-3): the
 * request names only the four fields below, and the parser copies only those four, whatever arrives.
 *
 * AcousticBrainz stopped collecting in 2022 and keeps its API up "for now". If it does not answer,
 * the song has no tempo and no key ("Key not measured"); nothing else breaks.
 */
import { parseKey, type Key } from "../design/key-colour";
import type { Source } from "../model";
import { getJson, Gate, realClock, type Clock, type FetchFn } from "./http";

export const AB = "https://acousticbrainz.org/api/v1";
export const abGate = new Gate(1000);
const FEATURES = "rhythm.bpm;tonal.key_key;tonal.key_scale;tonal.key_strength";
const MAX_IDS = 25;

export interface Measured {
  recording_id: string;
  bpm?: number;
  key?: Key & { strength: number };
  source: Source;
}

export const abPage = (id: string): Source => ({ label: "AcousticBrainz", url: `https://acousticbrainz.org/${id}` });

/** Copy the four fields and nothing else from one recording's first submission. */
export function readLowLevel(id: string, doc: unknown): Measured | null {
  const sub = (doc as Record<string, unknown> | undefined)?.["0"] as
    | { rhythm?: { bpm?: unknown }; tonal?: { key_key?: unknown; key_scale?: unknown; key_strength?: unknown } }
    | undefined;
  if (!sub) return null;
  const bpm = typeof sub.rhythm?.bpm === "number" && sub.rhythm.bpm > 0 ? sub.rhythm.bpm : undefined;
  const t = sub.tonal;
  const k = typeof t?.key_key === "string" && typeof t.key_scale === "string" ? parseKey(t.key_key, t.key_scale) : null;
  const strength = typeof t?.key_strength === "number" ? t.key_strength : undefined;
  const key = k && strength !== undefined ? { ...k, strength } : undefined;
  if (bpm === undefined && !key) return null;
  return { recording_id: id, bpm, key, source: abPage(id) };
}

/**
 * Tempo and key for a song. AcousticBrainz is keyed by recording, and MusicBrainz often holds one
 * studio recording several times (once per release); the chosen recording is asked first, then its
 * siblings of the same title and artist, and the first one measured is used, its own page cited.
 */
export async function measure(ids: string[], d: { fetchFn: FetchFn; gate?: Gate; clock?: Clock }): Promise<Measured | null> {
  const ask = [...new Set(ids)].slice(0, MAX_IDS);
  if (!ask.length) return null;
  try {
    const url = `${AB}/low-level?recording_ids=${ask.join(";")}&features=${FEATURES}`;
    const body = (await getJson(url, d.gate ?? abGate, d.fetchFn, d.clock ?? realClock)) as Record<string, unknown>;
    for (const id of ask) {
      const m = readLowLevel(id, body[id]);
      if (m) return m;
    }
    return null;
  } catch {
    return null; // AcousticBrainz did not answer: tempo and key patterns are skipped
  }
}

/**
 * T9.3 Lines across my songs (FR-T9.3). From the third confirmed song, code finds patterns no single
 * song shows; each line has three layers: the pattern, its evidence (with the chance figure where code
 * can compute it), and two readings offered as questions, each grounded in a cited fact, plus Neither.
 *
 * Thresholds are the PRD's. A line that only restates one answer is never built; no line rests on one
 * song. A release date the person marked wrong takes that song out of every date line.
 */
import { isAlbum } from "./model";
import { breaches } from "./checks";
import { keyName, type Key } from "./design/key-colour";
import type { CreditRole, Part, Song, Source } from "./model";
import { inHundred, seeded } from "./rng";
import { fill, KIND_TEMPLATES, ROLE_MEANING, type Grounding, type PatternKind } from "./templates";

export interface Evidence {
  entry_id?: string;
  text: string;
  source: Source;
  /** A date line's evidence carries the recording, so "That date is wrong" can act on it. */
  date_of?: string;
}

export interface OfferedReading {
  template_id: string;
  ask: string;
  kept: string;
  grounding: Grounding;
}

export interface PatternLine {
  id: string;
  kind: PatternKind;
  pattern: string;
  /** A specialist term in the pattern, with its plain meaning (rule 11). */
  gloss?: string;
  evidence: Evidence[];
  chance?: string;
  readings: [OfferedReading, OfferedReading];
  question: string;
  entry_ids: string[];
}

const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
export const num = (n: number) => (n >= 0 && n <= 10 ? WORDS[n]! : String(n));
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
const songLabel = (s: Song) => `${s.facts.title} · ${s.facts.artist_credit}${isAlbum(s.entry) ? " (album)" : ""}`;
/** FR-T9.1: albums count as records; a line that holds one says "records", never "songs". */
const what = (ss: Song[]) => (ss.some((s) => isAlbum(s.entry)) ? "records" : "songs");
const YOUR_ANSWER: Source = { label: "Your answer" };

function offered(kind: string, values: Record<string, string> = {}): Pick<PatternLine, "readings" | "question"> {
  const t = KIND_TEMPLATES[kind]!;
  const r = t.readings.map((x) => ({ ...x, ask: fill(x.ask, values), kept: fill(x.kept, values) })) as [OfferedReading, OfferedReading];
  return { readings: r, question: t.question };
}

// ---- Mode and key -----------------------------------------------------------------------------

const KEY_STRENGTH_FLOOR = 0.5;
const KEY_MIN_MEASURED = 4;

function binomialAtLeast(k: number, n: number, p = 0.5): number {
  let total = 0;
  for (let i = k; i <= n; i++) {
    let c = 1;
    for (let j = 0; j < i; j++) c = (c * (n - j)) / (j + 1);
    total += c * p ** i * (1 - p) ** (n - i);
  }
  return total;
}

/** Chance that at least `k` of `n` songs land on one key, if each of the 24 keys were equally likely. */
export function sharedKeyChance(k: number, n: number, trials = 20000, seed = 24): number {
  const rnd = seeded(seed);
  let hits = 0;
  for (let t = 0; t < trials; t++) {
    const counts = new Array(24).fill(0) as number[];
    let max = 0;
    for (let i = 0; i < n; i++) {
      const c = ++counts[Math.floor(rnd() * 24)]!;
      if (c > max) max = c;
    }
    if (max >= k) hits++;
  }
  return hits / trials;
}

function keyLine(songs: Song[]): PatternLine | null {
  const measured = songs.filter((s) => s.facts.key && s.facts.key.strength >= KEY_STRENGTH_FLOOR);
  const n = measured.length;
  if (n < KEY_MIN_MEASURED) return null;
  const major = measured.filter((s) => s.facts.key!.mode === "major").length;
  const majorHolds = major / n >= 2 / 3;

  const groups = new Map<string, Song[]>();
  for (const s of measured) {
    const id = `${s.facts.key!.pitch}-${s.facts.key!.mode}`;
    groups.set(id, [...(groups.get(id) ?? []), s]);
  }
  const shared = [...groups.values()]
    .filter((g) => g.length >= 3 && new Set(g.map((s) => s.facts.lead_artist_id)).size >= 2)
    .sort((a, b) => b.length - a.length)[0];
  if (!majorHolds && !shared) return null;

  const sharedKey = shared ? keyName(shared[0]!.facts.key as Key) : "";
  const evidence: Evidence[] = measured.map((s) => ({
    entry_id: s.entry.entry_id,
    text: `${songLabel(s)} · ${keyName(s.facts.key!)} (how clearly the key came through: ${s.facts.key!.strength.toFixed(2)} out of 1)`,
    source: s.facts.key!.source,
  }));
  const chances: string[] = [];
  if (majorHolds) {
    chances.push(
      `If major and minor were equally likely, ${inHundred(binomialAtLeast(major, n))} random sets of ${num(n)} songs would have ${num(major)} or more in a major key. Real music isn't split evenly, so the true chance is different.`,
    );
  }
  if (shared) {
    chances.push(
      `If all 24 keys were equally likely, ${inHundred(sharedKeyChance(shared.length, n))} random sets of ${num(n)} songs would have ${num(shared.length)} or more in one key. Real songs favour some keys, so the true chance is higher.`,
    );
  }
  const gloss = "A key is the set of notes a song is built on, with one home note it keeps returning to.";
  const ids = (majorHolds ? measured : shared!).map((s) => s.entry.entry_id);

  if (majorHolds) {
    const tail = shared ? `, and ${num(shared.length)} are in ${sharedKey}.` : ".";
    return {
      id: `key-major:${major}/${n}${shared ? `:${sharedKey}` : ""}`,
      kind: "key-major",
      pattern: major === n ? `All ${num(n)} songs whose key could be measured are in a major key${tail}` : `Of the ${num(n)} songs whose key could be measured, ${num(major)} are in a major key${tail}`,
      gloss,
      evidence,
      chance: chances.join(" "),
      ...offered("key-major"),
      entry_ids: ids,
    };
  }
  const artists = new Set(shared!.map((s) => s.facts.lead_artist_id)).size;
  return {
    id: `key-shared:${sharedKey}:${shared!.length}/${n}`,
    kind: "key-shared",
    pattern: `${shared!.length === n ? `All ${num(n)}` : `${cap(num(shared!.length))} of the ${num(n)}`} songs whose key could be measured are in ${sharedKey}, and they're by ${num(artists)} different artists.`,
    gloss,
    evidence,
    chance: chances.join(" "),
    ...offered("key-shared", { key: sharedKey }),
    entry_ids: ids,
  };
}

// ---- Tempo ------------------------------------------------------------------------------------

/** Distance between two tempos, treating half and double tempo as the same. */
export function tempoDistance(a: number, b: number): number {
  return Math.min(Math.abs(a - b), Math.abs(2 * a - b), Math.abs(a - 2 * b));
}

function tempoLine(songs: Song[]): PatternLine | null {
  const timed = songs.filter((s) => s.facts.bpm);
  if (timed.length < 3) return null;
  let best: Song[] = [];
  for (const c of timed) {
    const cluster = timed.filter((s) => tempoDistance(c.facts.bpm!.value, s.facts.bpm!.value) <= 8);
    if (cluster.length < 3 || new Set(cluster.map((s) => s.facts.lead_artist_id)).size < 2) continue;
    if (cluster.length > best.length) best = cluster;
  }
  if (!best.length) return null;
  // Show every tempo on the scale of the first song, so "half or double" reads as one range.
  const ref = best[0]!.facts.bpm!.value;
  const onScale = (v: number) => [v, v * 2, v / 2].sort((x, y) => Math.abs(x - ref) - Math.abs(y - ref))[0]!;
  const vals = best.map((s) => onScale(s.facts.bpm!.value));
  const lo = Math.round(Math.min(...vals)), hi = Math.round(Math.max(...vals));
  const artists = new Set(best.map((s) => s.facts.lead_artist_id)).size;
  return {
    id: `tempo:${lo}-${hi}:${best.length}`,
    kind: "tempo",
    pattern: `${cap(num(best.length))} of your songs, by ${num(artists)} different artists, move at nearly the same pace: ${lo} to ${hi} BPM.`,
    gloss: "BPM, beats per minute: how fast a song moves.",
    evidence: best.map((s) => {
      const v = s.facts.bpm!.value, shown = onScale(v);
      const folded = Math.round(shown) !== Math.round(v) ? ` (measured ${Math.round(v)}, read at ${shown > v ? "double" : "half"} speed)` : "";
      return { entry_id: s.entry.entry_id, text: `${songLabel(s)} · ${Math.round(shown)} BPM${folded}`, source: s.facts.bpm!.source };
    }),
    ...offered("tempo"),
    entry_ids: best.map((s) => s.entry.entry_id),
  };
}

// ---- The part named most ----------------------------------------------------------------------

function partLine(songs: Song[]): PatternLine | null {
  // FR-T9.1: an album's answer comes from its own options (FR-T9.2), so only songs count here.
  const answered = songs.filter((s) => !isAlbum(s.entry) && s.entry.comes_back_for !== "unanswered" && s.entry.comes_back_for !== "not sure");
  const m = answered.length;
  if (m < 3) return null;
  const counts = new Map<Part, number>();
  for (const s of answered) counts.set(s.entry.comes_back_for as Part, (counts.get(s.entry.comes_back_for as Part) ?? 0) + 1);
  const [top, c] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]!;
  if (c < 2 || c < m / 2) return null;
  // A tie at the top is no "part named most".
  if ([...counts.values()].filter((v) => v === c).length > 1) return null;
  const kind = `part:${top}` as const;
  if (!KIND_TEMPLATES[kind]) return null; // no cited definition for this part: no readings, no line
  const never = top !== "the chorus" && !counts.has("the chorus") ? ", and never “the chorus”." : ".";
  return {
    id: `${kind}:${c}/${m}`,
    kind,
    pattern: `In ${c === m ? `all ${num(m)}` : `${num(c)} of the ${num(m)}`} songs where you said what you come back for, you picked “${top}”${never}`,
    evidence: answered.map((s) => ({ entry_id: s.entry.entry_id, text: `${songLabel(s)}: ${s.entry.comes_back_for}`, source: YOUR_ANSWER })),
    ...offered(kind),
    entry_ids: answered.map((s) => s.entry.entry_id),
  };
}

// ---- When they came out -----------------------------------------------------------------------

const dated = (songs: Song[]) => songs.filter((s) => s.facts.first_release_year !== undefined && !s.facts.date_disputed);

function releaseLine(songs: Song[]): PatternLine | null {
  const d = dated(songs);
  const n = d.length;
  if (n < 3) return null;
  let best: Song[] = [];
  const years = d.map((s) => s.facts.first_release_year!);
  for (let y = Math.min(...years); y <= Math.max(...years); y++) {
    const w = d.filter((s) => s.facts.first_release_year! >= y && s.facts.first_release_year! <= y + 2);
    if (w.length > best.length) best = w;
  }
  if (best.length < 3 || best.length < n / 2) return null;
  const ys = best.map((s) => s.facts.first_release_year!);
  const y1 = Math.min(...ys), y2 = Math.max(...ys);
  const when = y1 === y2 ? `in ${y1}` : `between ${y1} and ${y2}`;
  return {
    id: `release-window:${y1}-${y2}:${best.length}/${n}`,
    kind: "release-window",
    // "Four of your four songs" reads as a slip: a whole set is "All four of your songs".
    pattern: best.length === n ? `All ${num(n)} of your ${what(d)} came out ${when}.` : `${cap(num(best.length))} of your ${num(n)} ${what(d)} came out ${when}.`,
    evidence: d.map((s) => ({
      entry_id: s.entry.entry_id,
      text: `${songLabel(s)} · first released in ${s.facts.first_release_year}, according to ${s.facts.date_source.label}`,
      source: s.facts.date_source,
      date_of: s.facts.recording_id,
    })),
    ...offered("release-window"),
    entry_ids: best.map((s) => s.entry.entry_id),
  };
}

// ---- Found you later --------------------------------------------------------------------------

/**
 * The earliest year an answer allows, so "two or more years later" is never claimed on a guess.
 * FR-T9.8: "the last three years" is this year and the two before it; "longer ago" has a floor only
 * when he gave a year.
 */
export function foundNoEarlierThan(entry: Song["entry"], nowYear: number): number | undefined {
  const found = entry.found_me;
  if (found === "this month" || found === "this year") return nowYear;
  if (found === "the last three years") return nowYear - 2;
  if (found === "longer ago" && entry.found_year) return entry.found_year;
  return undefined; // "can't say" and unanswered say nothing
}

function foundLaterLine(songs: Song[], now: Date): PatternLine | null {
  const later = dated(songs).filter((s) => {
    const f = foundNoEarlierThan(s.entry, now.getFullYear());
    return f !== undefined && f - s.facts.first_release_year! >= 2;
  });
  if (later.length < 2) return null;
  return {
    id: `found-later:${later.length}`,
    kind: "found-later",
    pattern: `${cap(num(later.length))} of your ${what(later)} found you at least two years after they came out.`,
    evidence: later.map((s) => ({
      entry_id: s.entry.entry_id,
      text: `${songLabel(s)} · first released in ${s.facts.first_release_year}, according to ${s.facts.date_source.label} · found you: ${s.entry.found_me}${s.entry.found_year ? `, about ${s.entry.found_year}` : ""} (your answer)`,
      source: s.facts.date_source,
      date_of: s.facts.recording_id,
    })),
    ...offered("found-later"),
    entry_ids: later.map((s) => s.entry.entry_id),
  };
}

// ---- One person behind different singers -----------------------------------------------------

const PERSON_ROLES: CreditRole[] = ["producer", "writer", "recording engineer", "mixer"];

function sharedPersonLine(songs: Song[]): PatternLine | null {
  const by = new Map<string, { name: string; role: CreditRole; songs: Song[]; source: Source }>();
  for (const s of songs) {
    for (const p of s.facts.people) {
      if (!PERSON_ROLES.includes(p.role)) continue;
      const k = `${p.role}|${p.name}`;
      const e = by.get(k) ?? { name: p.name, role: p.role, songs: [], source: p.source };
      if (!e.songs.includes(s)) e.songs.push(s);
      by.set(k, e);
    }
  }
  const best = [...by.values()]
    .filter((e) => new Set(e.songs.map((s) => s.facts.lead_artist_id)).size >= 2)
    .sort((a, b) => b.songs.length - a.songs.length)[0];
  if (!best) return null;
  const artists = [...new Set(best.songs.map((s) => s.facts.lead_artist))];
  return {
    id: `shared-person:${best.role}:${best.name}`,
    kind: "shared-person",
    pattern: `One ${best.role}, ${best.name}, worked on songs by ${list(artists)}.`,
    gloss: `${cap(best.role)}: ${ROLE_MEANING[best.role]}.`,
    evidence: best.songs.map((s) => ({ entry_id: s.entry.entry_id, text: `${songLabel(s)} · ${best.role}: ${best.name}`, source: best.source })),
    ...offered("shared-person", { role: best.role }),
    entry_ids: best.songs.map((s) => s.entry.entry_id),
  };
}

// ---- All lines --------------------------------------------------------------------------------

export const MIN_SONGS_FOR_LINES = 3;

/** Every name a line can quote: titles, artist credits, credited people. */
export const namesIn = (songs: Song[]) =>
  songs.flatMap((s) => [s.facts.title, s.facts.artist_credit, s.facts.lead_artist, ...s.facts.people.map((p) => p.name)]);

/** FR-CORE-2 at display time: why a filled line may not be shown, or [] when every sentence in it passes. */
export function lineBreaches(l: PatternLine, names: readonly string[]): string[] {
  return [
    ...breaches(l.pattern, "key", names),
    ...(l.gloss ? breaches(l.gloss, "fact", names) : []),
    ...(l.chance ? breaches(l.chance, "fact", names) : []),
    ...l.evidence.flatMap((e) => breaches(e.text, "fact", names)),
    ...l.readings.flatMap((r) => [...breaches(r.ask, "offer", names), ...breaches(r.kept, "said", names)]),
    ...breaches(l.question, "offer", names),
  ];
}

export function linesAcross(songs: Song[], now: Date = new Date()): PatternLine[] {
  if (songs.length < MIN_SONGS_FOR_LINES) return [];
  const names = namesIn(songs);
  return [keyLine(songs), tempoLine(songs), partLine(songs), releaseLine(songs), foundLaterLine(songs, now), sharedPersonLine(songs)]
    .filter((l): l is PatternLine => l !== null)
    // No pattern is built from a single song.
    .filter((l) => new Set(l.entry_ids).size >= 2)
    // A filled sentence that fails the register or carve-out check is not shown; the next line takes its place.
    .filter((l) => lineBreaches(l, names).length === 0);
}

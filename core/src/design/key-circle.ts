/**
 * THE CIRCLE OF KEYS (Card stock, second version; PRD A3; design rules 6 and 12).
 * Twelve places, one per key, never one per song. C major (with A minor, the minor key that uses the
 * same notes) is at the top; each step clockwise is a fifth. A key's dot grows with the number of the
 * person's songs in it, in four steps, and the largest step is small enough that two neighbours never
 * touch. From two songs up the count is written outside the dot. A dark centre means some of those
 * songs are in the minor key that uses the same notes.
 */
import { circlePlace, type Key } from "./key-colour";

export interface Place {
  /** 0 (C major / A minor, at the top) to 11, clockwise by fifths. */
  place: number;
  /** The major key at this place, by pitch class. */
  majorPitch: number;
  major: number; // songs in the major key
  minor: number; // songs in the minor key that uses the same notes
  total: number;
  /** 0 none · 1 one song · 2 two or three · 3 four or more. */
  step: 0 | 1 | 2 | 3;
}

export const sizeStep = (n: number): Place["step"] => (n <= 0 ? 0 : n === 1 ? 1 : n <= 3 ? 2 : 3);

/** Count songs by place. Songs with no measured key are not passed in; the caller counts them in a sentence. */
export function circlePlaces(keys: Key[]): Place[] {
  const places: Place[] = Array.from({ length: 12 }, (_, place) => ({ place, majorPitch: (place * 7) % 12, major: 0, minor: 0, total: 0, step: 0 as const }));
  for (const k of keys) {
    const p = places[circlePlace(k)]!;
    p[k.mode] += 1;
    p.total += 1;
  }
  for (const p of places) p.step = sizeStep(p.total);
  return places;
}

/** Geometry of the large circle, in CSS pixels (the drawing is 150 px square). */
export const LARGE = { size: 150, ring: 45, radius: [3.75, 6.25, 8, 10] as const, centre: 4, countAt: 62 };
/** Geometry of the small circle beside a song's key name (30 px square). */
export const SMALL = { size: 30, ring: 11.5, tick: 1, dot: 3.6 };

/** Where a place sits: the top is place 0, and places run clockwise. */
export function placeXY(place: number, ring: number, size: number): { x: number; y: number } {
  const a = ((place * 30 - 90) * Math.PI) / 180;
  const r2 = (v: number) => Math.round(v * 100) / 100;
  return { x: r2(size / 2 + ring * Math.cos(a)), y: r2(size / 2 + ring * Math.sin(a)) };
}

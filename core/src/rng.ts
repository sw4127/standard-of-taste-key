/** A seeded random number generator (mulberry32), so a chance figure is the same on every run. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** "in about 3 sets in 100", rounded to a whole number out of 100; under 1 reads "in fewer than 1 set in 100". */
export function inHundred(p: number): string {
  const n = Math.round(p * 100);
  return n < 1 ? "in fewer than 1 set in 100" : `in about ${n} ${n === 1 ? "set" : "sets"} in 100`;
}

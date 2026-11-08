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

/** "about 3 in 100", rounded to a whole number out of 100; under 1 reads "fewer than 1 in 100". */
export function inHundred(p: number): string {
  const n = Math.round(p * 100);
  return n < 1 ? "fewer than 1 in 100" : `about ${n} in 100`;
}

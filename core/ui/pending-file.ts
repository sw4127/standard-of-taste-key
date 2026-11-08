/** A Spotify file dropped on the panel's offer, handed to the look back it opens (never stored). */
let pending: File | null = null;
export const handOver = (f: File | undefined) => void (pending = f ?? null);
export const takeHandedFile = (): File | null => {
  const f = pending;
  pending = null;
  return f;
};

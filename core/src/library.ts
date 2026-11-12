/**
 * The shipping library (PRD A4): one data file, `library.json`. Lines across records (FR-T9.3 (f))
 * and the reading (FR-T9.9) use only entries marked as shipping; LIB-4, LIB-8 and LIB-11 do not ship.
 */
import data from "./library.json";

export interface LibraryEntry {
  id: string;
  ships: boolean;
  not_shipped_because?: string;
  label?: string;
  sentence: string;
  citation: string;
  url: string;
  opened: string;
  read_as: string;
}

export const LIBRARY: readonly LibraryEntry[] = data.entries as LibraryEntry[];
export const SHIPPING: readonly LibraryEntry[] = LIBRARY.filter((e) => e.ships);

/** A shipping entry by its ID; asking for one that does not ship is an error, never a quiet fallback. */
export function shipping(id: string): LibraryEntry {
  const e = LIBRARY.find((x) => x.id === id);
  if (!e) throw new Error(`no library entry ${id}`);
  if (!e.ships) throw new Error(`library entry ${id} may not ship: ${e.not_shipped_because}`);
  return e;
}

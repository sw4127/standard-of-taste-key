/**
 * Reading a pasted Bilibili video list (never shipped): each video's length line ("04:24") is
 * followed by its title. Counts, dates, page tabs and descriptions are left out. Used to build the
 * coverage bar's title lists with each video's length, which rule v7.2's length check reads.
 */
export interface Pasted {
  title: string;
  seconds: number;
}

const LENGTH = /^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})$/;

export function readPaste(raw: string): Pasted[] {
  const lines = raw.split(/\r?\n/).map((l) => l.trim());
  const out: Pasted[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = LENGTH.exec(lines[i]!);
    if (!m) continue;
    const title = lines.slice(i + 1).find((l) => l.length > 0);
    if (!title || LENGTH.test(title)) continue;
    out.push({ title, seconds: Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]) });
  }
  return out;
}

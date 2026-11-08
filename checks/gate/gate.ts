/**
 * T8.3 The launch gate (FR-T8.3), never shipped. Bob copies 50 titles by hand from an uploader list
 * page the rule has never seen, from an uploader other than the one whose lists tuned v6. Rule v6
 * matches each; Bob marks every match. The gate passes only with 0 wrong or unprovable songs, artists
 * or versions in the 50. A doubtful release date is listed beside the result and never counted:
 * it does not put a key on the wrong recording. Coverage is reported, not gated.
 */
import { MATCH_FIXTURES } from "../../core/src/match/fixtures";
import { GATE_TUNING_TITLES } from "./tuning-titles";
import { normalise } from "../../core/src/match/studio";
import type { Candidate, Silence } from "../../core/src/match/v6";

export const GATE_SIZE = 50;
/** The uploader whose lists tuned v6 (Stage 7). */
export const TUNING_UPLOADER = "百万豪装录音棚大声听";
/** Every uploader whose lists have tuned the rule: v6 (Stage 7), and v6.1 after the first gate run (2026-11-08). */
export const TUNING_UPLOADERS = [TUNING_UPLOADER, "JLRS-jayfm"];

/**
 * Each match gets exactly one mark, and every case lands on one: check the song, then the artist, then
 * the version; the first that is wrong is the mark. If none is shown wrong but one cannot be shown
 * right, "Can't prove all three". Only "Right" passes.
 */
export const MARKS = [
  "Right: song, artist and version",
  "Wrong song",
  "Right song, wrong artist",
  "Right song and artist, wrong version",
  "Can't prove all three",
] as const;
export const RIGHT: Mark = "Right: song, artist and version";
export type Mark = (typeof MARKS)[number];

export interface GateRow {
  i: number;
  title: string;
  result: { state: "certain"; candidate: Candidate } | { state: "silent"; reason: Silence } | { state: "error" } | { state: "waiting" };
  mark?: Mark;
  dateDoubtful?: boolean;
}

/**
 * Titles from what Bob pasted: one per line. Lines that are only a duration, a count or a date (as a
 * list page shows beside each title) are left out, and so are repeats.
 */
export function titlesFrom(pasted: string): string[] {
  // Bilibili shows dates as 2023年2月20日 or 2月20日, counts as 365.3万; found in Bob's first gate run.
  const junk = /^(?:\d{1,2}:\d{2}(?::\d{2})?|[\d.,]+\s*(?:万|亿|k|K)?|\d{4}-\d{1,2}-\d{1,2}|\d{1,2}-\d{1,2}|(?:\d{4}年)?\d{1,2}月\d{1,2}日|\d+\s*(?:播放|弹幕|views?)|\d+\s*(?:小时|分钟|天)前|昨天|前天)$/;
  // Copying an uploader's space page also brings its tabs and times like "昨天 00:14" (Bob's second run).
  const when = /^(?:昨天|前天|今天)\s*\d{1,2}:\d{2}$/;
  const pageLabels = new Set(["TA的视频", "最新发布", "最多播放", "最多收藏", "播放全部", "全部", "视频", "合集", "合集和列表", "收藏夹", "动态", "主页", "投稿", "查看更多", "更多", "默认排序"]);
  const out: string[] = [];
  for (const raw of pasted.split(/\r?\n/)) {
    const t = raw.replace(/\s+/g, " ").trim();
    if (!t || junk.test(t) || when.test(t) || pageLabels.has(t)) continue;
    if (!out.includes(t)) out.push(t);
  }
  return out;
}

const SEEN = new Set([...MATCH_FIXTURES.map((f) => f.title), ...GATE_TUNING_TITLES].map(normalise));

/** Why this list cannot be the gate's list, or [] when it can. */
export function listProblems(uploader: string, titles: string[]): string[] {
  const out: string[] = [];
  if (!uploader.trim()) out.push("Name the uploader whose list the titles come from.");
  const tuned = TUNING_UPLOADERS.find((u) => normalise(uploader).includes(normalise(u)) || titles.some((t) => t.includes(u)));
  if (tuned) {
    out.push(`The list must come from an uploader whose lists have not tuned the rule (not ${TUNING_UPLOADERS.join(" or ")}).`);
  }
  const seen = titles.filter((t) => SEEN.has(normalise(t)));
  if (seen.length) out.push(`${seen.length} of these titles were used to write or tune the rule: ${seen.slice(0, 3).join(" · ")}${seen.length > 3 ? " …" : ""}`);
  if (titles.length !== GATE_SIZE) out.push(`The gate needs exactly ${GATE_SIZE} titles; this list has ${titles.length}.`);
  return out;
}

export interface Verdict {
  matched: number;
  silent: number;
  errors: number;
  marked: number;
  counted: Record<Mark, number>;
  datesDoubtful: number;
  /** "pass" only when every match is marked Right and nothing failed to run. */
  state: "not yet marked" | "pass" | "fail" | "incomplete";
  reason: string;
}

export function verdict(rows: GateRow[]): Verdict {
  const matches = rows.filter((r) => r.result.state === "certain");
  const counted = Object.fromEntries(MARKS.map((m) => [m, 0])) as Record<Mark, number>;
  for (const r of matches) if (r.mark) counted[r.mark]++;
  const marked = matches.filter((r) => r.mark).length;
  const errors = rows.filter((r) => r.result.state === "error").length;
  const waiting = rows.filter((r) => r.result.state === "waiting").length;
  const bad = matches.length ? matches.length - counted[RIGHT] : 0;
  const base = {
    matched: matches.length,
    silent: rows.filter((r) => r.result.state === "silent").length,
    errors,
    marked,
    counted,
    datesDoubtful: matches.filter((r) => r.dateDoubtful).length,
  };
  if (waiting > 0) return { ...base, state: "incomplete", reason: `${waiting} ${waiting === 1 ? "title" : "titles"} still to run.` };
  if (rows.length !== GATE_SIZE || errors > 0) {
    return { ...base, state: "incomplete", reason: errors ? `${errors} ${errors === 1 ? "title" : "titles"} could not be run (couldn't reach MusicBrainz); retry ${errors === 1 ? "it" : "them"}.` : `The gate needs ${GATE_SIZE} titles.` };
  }
  if (marked < matches.length) {
    const wrongSoFar = matches.filter((r) => r.mark && r.mark !== RIGHT).length;
    if (wrongSoFar > 0) return { ...base, state: "fail", reason: `Marked wrong or unprovable so far: ${wrongSoFar}. The gate allows none.` };
    return { ...base, state: "not yet marked", reason: `${matches.length - marked} of ${matches.length} matches still to mark.` };
  }
  if (bad > 0) return { ...base, state: "fail", reason: `Marked wrong or unprovable: ${bad} of ${matches.length} matches. The gate allows none.` };
  if (!matches.length) return { ...base, state: "pass", reason: `No title matched, so none could be wrong; coverage 0 of ${GATE_SIZE}.` };
  return { ...base, state: "pass", reason: `All ${matches.length} matches are right. Even so, the true rate of wrong keys could be as high as about ${Math.round((3 / GATE_SIZE) * 100)}% (rule of three: 3 ÷ ${GATE_SIZE}).` };
}

const cell = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");

/** The sheet as a Markdown file for checks/: every title, what v6 did, Bob's mark, and the verdict. */
export function sheetMarkdown(uploader: string, listNote: string, rows: GateRow[], at: string): string {
  const v = verdict(rows);
  const lines = [
    `# Launch gate (T8.3), ${at.slice(0, 10)}`,
    "",
    `Uploader: ${uploader}. List: ${listNote || "(not given)"}. Titles copied by hand by Bob; rule v6 run in the browser against MusicBrainz.`,
    "",
    `**Verdict: ${v.state.toUpperCase()}.** ${v.reason}`,
    "",
    `Matched ${v.matched} of ${rows.length} (coverage, not gated) · silent ${v.silent} · ${MARKS.map((m) => `${m}: ${v.counted[m]}`).join(" · ")} · dates doubtful (not counted): ${v.datesDoubtful}`,
    "",
    "| # | Video title | Rule v6 | Recording (title · credit · first release · record) | Bob's mark | Date doubtful |",
    "|---|---|---|---|---|---|",
    ...rows.map((r) => {
      const res = r.result.state === "certain" ? "match" : r.result.state === "silent" ? `silent (${r.result.reason})` : r.result.state === "waiting" ? "still to run" : "not run";
      const c = r.result.state === "certain" ? r.result.candidate : null;
      const rec = c ? `[${c.title} · ${c.artist_credit} · ${c.first_release ?? "no date"}${c.record ? ` · ${c.record}` : ""}](https://musicbrainz.org/recording/${c.recording_id})` : "—";
      return `| ${r.i + 1} | ${cell(r.title)} | ${res} | ${cell(rec)} | ${c ? r.mark ?? "not marked" : "—"} | ${c && r.dateDoubtful ? "yes" : ""} |`;
    }),
    "",
  ];
  return lines.join("\n");
}

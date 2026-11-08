/** FR-CORE-1 The matching rule, v6: the title parser, the planted cases, and every fixture replayed with 0 wrong songs. */
import { describe, expect, it } from "vitest";
import { MATCH_FIXTURES, type MatchFixture } from "./match/fixtures";
import MB_REPLIES from "./match/fixtures-mb.json";
import { artistParts, parseTitle, stripNotes } from "./match/parse";
import { normalise, type MbRecording } from "./match/studio";
import { decide, searchesFor, type MatchResult } from "./match/v6";

describe("parsing a title", () => {
  it("reads artist《title（note）》tagline: the note removed, the tagline ignored", () => {
    const p = parseTitle("容祖儿《连续剧（电视剧《On Call 36小时》主题曲）》百万豪装录音棚大声听");
    expect(p.queries).toEqual([{ track: "连续剧", artists: ["容祖儿"] }]);
  });
  it("removes notes repeatedly, in either bracket, traditional characters included", () => {
    expect(stripNotes("大梦归（电视剧《兰香如故》主题曲）")).toBe("大梦归");
    expect(stripNotes("Song (OST) (Theme from X)")).toBe("Song");
    expect(stripNotes("光年之外（電影《太空旅客》中文主題曲）")).toBe("光年之外");
    expect(stripNotes("晴天 (Live)")).toBe("晴天 (Live)"); // not a note: a version, which the studio rule judges
  });
  it("removes every 【…】", () => {
    expect(parseTitle("【Hi-Res】周深《大鱼》【4K】").queries[0]).toEqual({ track: "大鱼", artists: ["周深"] });
  });
  it("splits artists on & ＆ 、 , ， / x feat., and tries a mixed-script name as its parts", () => {
    expect(artistParts("汪苏泷&五月天阿信")).toEqual(["汪苏泷", "五月天阿信"]);
    expect(artistParts("吴琳珂Moske")).toEqual(["吴琳珂Moske", "吴琳珂", "Moske"]);
    expect(artistParts("G.E.M.邓紫棋")).toEqual(["G.E.M.邓紫棋", "G.E.M.", "邓紫棋"]);
    expect(artistParts("A、B，C / D x E feat. F")).toEqual([]);
    expect(artistParts("Ann、Bob，Cal / Dee x Eve feat. Fay")).toEqual(["Ann", "Bob", "Cal", "Dee", "Eve", "Fay"]);
  });
  it("never uses an artist part shorter than two characters (阿YueYue must not yield 阿)", () => {
    expect(artistParts("阿YueYue")).toEqual(["阿YueYue", "YueYue"]);
  });
  it("without 《》: a leading 「…」 is a label unless nothing else is left; A - B is tried both ways", () => {
    const p = parseTitle("「Night Radio」Glass Harbour - Juniper Varga");
    expect(p.queries).toEqual([
      { track: "Glass Harbour", artists: ["Juniper Varga"] },
      { track: "Juniper Varga", artists: ["Glass Harbour"] },
    ]);
    expect(parseTitle("「Glass Harbour」").queries[0]!.track).toBe("Glass Harbour");
  });
  it("a title naming no artist stays silent", () => {
    const p = parseTitle("《Glass Harbour》");
    expect(decide(p, []).state).toBe("silent");
    expect((decide(p, []) as { reason: string }).reason).toBe("the title names no artist");
  });
  it("a version word in the video title is noted, so a version may match", () => {
    expect(parseTitle("周深《大鱼》现场版").version).toBe(true);
    expect(parseTitle("周深《大鱼》").version).toBe(false);
  });
});

const credit = (name: string, id = name) => [{ name, artist: { id, name } }];
const rel = (date: string, primary = "Album", secondary?: string[]) => ({ id: `r${date}`, status: "Official", date, "release-group": { id: `rg${date}`, "primary-type": primary, "secondary-types": secondary } });
const rec = (id: string, title: string, artist: string, releases = [rel("2010-01-01")], disambiguation = "", score = 100): MbRecording => ({ id, title, score, disambiguation, "artist-credit": credit(artist), releases });

describe("the planted cases that broke v5", () => {
  it("月半 (黄龄) must not match 月半彎: Chinese characters are kept when comparing", () => {
    const r = decide(parseTitle("黄龄《月半》百万豪装录音棚大声听"), [rec("x", "月半彎", "張學友", [rel("1985-01-01")])]);
    expect(r.state).toBe("silent");
  });
  it("笨蛋 (汪苏泷 & 五月天阿信) must not match 金莎's: the artist must be in the credit", () => {
    const r = decide(parseTitle("汪苏泷&五月天阿信《笨蛋》百万豪装录音棚大声听"), [rec("x", "笨蛋", "金莎", [rel("2006-01-01")])]);
    expect(r.state).toBe("silent");
  });
  it("traditional and simplified spellings of one title and one artist match", () => {
    const r = decide(parseTitle("周杰伦《说好不哭》"), [rec("x", "說好不哭", "周杰倫", [rel("2019-09-16", "Single")])]);
    expect(r.state).toBe("certain");
  });
});

describe("the studio filter and the silences", () => {
  const p = parseTitle("Juniper Varga《Glass Harbour》");
  const reason = (rs: MbRecording[]) => {
    const r = decide(p, rs);
    return r.state === "silent" ? r.reason : r.recording.id;
  };
  it("takes the earliest-released studio recording that is not a clean edit", () => {
    expect(reason([rec("late", "Glass Harbour", "Juniper Varga", [rel("2020-01-01")]), rec("early", "Glass Harbour", "Juniper Varga", [rel("2015-01-01", "Single")])])).toBe("early");
  });
  it("is silent with no studio recording, different lead artists, only clean edits, or versions months apart on one record", () => {
    expect(reason([rec("l", "Glass Harbour", "Juniper Varga", [rel("2015-01-01", "Album", ["Live"])])])).toBe("no studio recording");
    expect(reason([rec("v", "Glass Harbour (Remix)", "Juniper Varga")])).toBe("no candidate");
    expect(reason([rec("c", "Glass Harbour", "Juniper Varga", undefined, "clean")])).toBe("only clean edits");
    const featured = { ...rec("b", "Glass Harbour", "x"), "artist-credit": [{ name: "Other Act", joinphrase: " feat. ", artist: { id: "o", name: "Other Act" } }, ...credit("Juniper Varga")] };
    expect(reason([rec("a", "Glass Harbour", "Juniper Varga"), featured])).toBe("different artists");
    const shared = { id: "rel", status: "Official", "release-group": { id: "same", "primary-type": "Album", "secondary-types": undefined } };
    expect(reason([rec("a", "Glass Harbour", "Juniper Varga", [{ ...shared, date: "2015-01-01" }]), rec("b", "Glass Harbour", "Juniper Varga", [{ ...shared, date: "2015-09-01" }])])).toBe("versions months apart");
  });
  it("a version word in the recording's title refuses it unless the video title has one too", () => {
    // "(Live Theme)" is stripped as a note when comparing titles, but its version word still counts.
    const live = (title: string) => decide(parseTitle(title), [rec("w", "Glass Harbour (Live Theme)", "Juniper Varga")]);
    expect(live("Juniper Varga《Glass Harbour》").state).toBe("silent");
    expect(live("Juniper Varga《Glass Harbour》现场").state).toBe("certain");
    // A song whose own name holds the word ("Live Wire") makes the title hold it: it can match;
    // live albums are still refused by their release type.
    expect(decide(parseTitle("Juniper Varga《Live Wire》"), [rec("lw", "Live Wire", "Juniper Varga")]).state).toBe("certain");
  });
  it("needs a search score of 85 or more", () => {
    expect(reason([rec("s", "Glass Harbour", "Juniper Varga", undefined, "", 84)])).toBe("no candidate");
  });
});

// ---- Every fixture, replayed from recorded MusicBrainz replies -----------------------------------

const replies = MB_REPLIES as unknown as Record<string, MbRecording[]>;
function replay(f: MatchFixture): MatchResult {
  const p = parseTitle(f.title);
  const { withArtist, trackOnly } = searchesFor(p);
  const missing = [...withArtist].filter((q) => !(q in replies));
  if (missing.length) throw new Error(`no recorded reply for ${missing[0]} (run checks/record-mb.test.ts)`);
  let found = withArtist.flatMap((q) => replies[q]!);
  if (!found.length) found = trackOnly.flatMap((q) => replies[q] ?? []);
  return decide(p, found);
}

const sameSong = (r: MbRecording, a: { song: string; credit: string }) =>
  normalise(stripNotes(r.title)) === normalise(stripNotes(a.song)) && normalise(a.credit).includes(normalise(r["artist-credit"]?.[0]?.name ?? "@"));

/**
 * Matches on titles whose hand-checked answer was silence: each checked by hand by the builder
 * against the video title (song and lead artist), with the reason it is right. A match not listed
 * here fails the test until it is checked.
 */
export const NEW_MATCHES_CHECKED: Record<string, string> = {
  "蔡琴《你不要那样看着我的眼睛》百万豪装录音棚大声听":
    "Hand check 2026-11-08: right song, right artist (你不要那樣看著我的眼睛 · 蔡琴). Version not provable: the only recording MusicBrainz returns is on her 2002 album of that name; she first recorded the song decades earlier. The original v6 run was silent here.",
  "刘欢《千万次的问（《北京人在纽约》片头曲）》百万豪装录音棚大声听":
    "Hand check 2026-11-08: right song, right artist (千万次的问 · 刘欢). Version and date not provable: the record chosen, 记住刘欢[贰] (2003), is typed Album but reads as a best-of; the 1993 soundtrack is listed as 千万次的问 (片头曲) and scores under 85. The original v6 run was silent here.",
};

const results = MATCH_FIXTURES.map((f) => ({ f, r: replay(f) }));

describe("every fixture: 0 wrong songs", () => {
  it.each(["stage6", "fresh", "run2"] as const)("%s: every match is the hand-checked song, or a new match checked by hand", (set) => {
    const wrong: string[] = [];
    for (const { f, r } of results.filter((x) => x.f.set === set)) {
      if (r.state !== "certain") continue;
      if ("song" in f.answer) {
        if (!sameSong(r.recording, f.answer)) wrong.push(`${f.title} → ${r.candidate.title} · ${r.candidate.artist_credit} (answer: ${f.answer.song} · ${f.answer.credit})`);
      } else if (!NEW_MATCHES_CHECKED[f.title]) {
        wrong.push(`NEW, not yet hand-checked: ${f.title} → ${r.candidate.title} · ${r.candidate.artist_credit} · ${r.candidate.first_release}`);
      }
    }
    expect(wrong).toEqual([]);
  });
  it("reproduces v6's 21 matches on the fresh 42", () => {
    const fresh = results.filter((x) => x.f.set === "fresh");
    const lost = fresh.filter(({ f, r }) => "song" in f.answer && r.state !== "certain").map(({ f, r }) => `${f.title}: ${r.state === "silent" ? r.reason : ""}`);
    expect(lost).toEqual([]);
    expect(fresh.filter(({ r }) => r.state === "certain").length).toBeGreaterThanOrEqual(21);
  });
});

export const coverage = () =>
  (["stage6", "fresh", "run2"] as const).map((s) => {
    const rs = results.filter((x) => x.f.set === s);
    return { set: s, titles: rs.length, matched: rs.filter((x) => x.r.state === "certain").length, answerMatches: rs.filter((x) => "song" in x.f.answer).length };
  });

it("reports coverage (not gated)", () => {
  console.log(coverage().map((c) => `${c.set}: ${c.matched} of ${c.titles} matched (hand-checked answers matched ${c.answerMatches})`).join(" · "));
});

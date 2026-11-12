/**
 * FR-CORE-1, version 7 (T1.2; PRD Amendments of 2026-11-10, A2): the reading of a 《》 title, the
 * check that a credited artist's name stands in the title, and every fixture replayed through the
 * rule as the panel runs it, from recorded MusicBrainz replies. The version 6.3 tests stay in
 * fr-core-1.test.ts; this file holds what version 7 adds.
 */
import { describe, expect, it } from "vitest";
import { MATCH_FIXTURES, type MatchFixture } from "./match/fixtures";
import MB_V6 from "./match/fixtures-mb.json";
import MB_V7 from "./match/fixtures-mb-v7.json";
import { parseTitle, stripNotes } from "./match/parse";
import { normalise, type MbRecording } from "./match/studio";
import { decide, fetchFor } from "./match/v6";
import { artistStands, bare, decideV7, halfWidth, isRemovedVideoTitle, lastChecks, matchTitle, versionNamed, outsideParts, readBook, RULE_VERSION, sameTitle, searchesV7, silenceLine, stands, trackForms, type MatchResult } from "./match/v7";
import { Gate } from "./sources/http";

const artist = (name: string, aliases: string[] = []) => ({ name, artist: { id: name, name, aliases: aliases.map((a) => ({ name: a })) } });
const rel = (date: string, primary = "Album", secondary?: string[], rg = `rg${date}`) => ({ id: `r${date}`, status: "Official", date, "release-group": { id: rg, "primary-type": primary, "secondary-types": secondary } });
const rec = (id: string, title: string, credit: ReturnType<typeof artist>[], releases = [rel("2010-01-01")], disambiguation = "", score = 100): MbRecording => ({ id, title, score, disambiguation, "artist-credit": credit, releases });
const v7 = (title: string, found: MbRecording[]) => decideV7(parseTitle(title), readBook(title)!, found);
const outcome = (r: MatchResult) => (r.state === "certain" ? r.recording.id : r.reason);

describe("step 1: full-width punctuation is read as its half-width twin", () => {
  it("，／：（）！＆ and the full-width space; 《》 and 【】 are kept", () => {
    expect(halfWidth("Post Malone，Swae Lee／A：B（c）！＆　d")).toBe("Post Malone,Swae Lee/A:B(c)!& d");
    expect(halfWidth("【Hi-Res】《Yellow》")).toBe("【Hi-Res】《Yellow》");
  });
});

describe("step 2: reading a title that holds 《…》", () => {
  it("the text inside the first pair is the track; the rest, with tags removed, is where a name may stand", () => {
    expect(readBook("百万级装备听《Heat Waves》- Glass Animals【Hi-Res】")).toEqual({ track: "Heat Waves", outside: "百万级装备听 - Glass Animals" });
    expect(readBook("用百万级豪华装备试听The Weeknd《Blinding Lights》【Hi-Res】")).toEqual({ track: "Blinding Lights", outside: "用百万级豪华装备试听The Weeknd" });
    expect(readBook("Juniper Varga - Glass Harbour")).toBeNull();
  });
  it("a quoted line is not where a name stands", () => {
    expect(readBook("【Hi-Res】｜《Glass Harbour》- Juniper Varga -‘the lantern year is over now’")!.outside).toBe("| - Juniper Varga -");
    expect(readBook("《Glass Harbour》- Juniper Varga “second lamp”")!.outside).toBe("- Juniper Varga");
    // An apostrophe inside a name is not a quotation.
    expect(readBook("《Glass Harbour》 - Lanterns N' Lamps -")!.outside).toBe("- Lanterns N' Lamps -");
  });
  it("the names searched: split on the usual marks and on a dash; a stretch mixing scripts also as its parts; never under two characters", () => {
    expect(outsideParts("百万级装备听 - Glass Animals")).toEqual(["百万级装备听", "Glass Animals"]);
    expect(outsideParts("用百万级豪华装备试听The Weeknd")).toEqual(["用百万级豪华装备试听The Weeknd", "用百万级豪华装备试听", "The Weeknd"]);
    expect(outsideParts("| - Juniper Varga,Ines Calloway -")).toEqual(["Juniper Varga", "Ines Calloway"]);
    expect(outsideParts("- 阿 - Ne-Yo -")).toEqual(["Ne-Yo"]);
  });
  it("the track is tried as written, then without a trailing bracket that names no version", () => {
    expect(trackForms("Glass Harbour (玻璃港)")).toEqual(["Glass Harbour (玻璃港)", "Glass Harbour"]);
    expect(trackForms("Glass Harbour (feat. Ines Calloway)")).toEqual(["Glass Harbour"]);
    expect(trackForms("Glass Harbour (remix)")).toEqual(["Glass Harbour (remix)"]);
    expect(trackForms("玻璃港 (女版)")).toEqual(["玻璃港 (女版)"]);
    expect(bare("Glass Harbour (Lantern Year: The Film)")).toBe("Glass Harbour");
    expect(bare("Glass Harbour (2003-07: Example Hall)")).toBe("Glass Harbour (2003-07: Example Hall)");
    expect(bare("Glass Harbour (stripped back)")).toBe("Glass Harbour");
  });
  it("one search for the track by any of the names (six at most), then the track alone; each asks for official albums, singles and EPs", () => {
    const qs = searchesV7(readBook("甲乙、丙丁、戊己、庚辛、壬癸、子丑、寅卯《Glass Harbour》")!);
    expect(qs).toEqual([
      'recording:"Glass Harbour" AND (artist:"甲乙" OR artist:"丙丁" OR artist:"戊己" OR artist:"庚辛" OR artist:"壬癸" OR artist:"子丑") AND status:official AND (primarytype:album OR primarytype:single OR primarytype:ep)',
      'recording:"Glass Harbour" AND status:official AND (primarytype:album OR primarytype:single OR primarytype:ep)',
    ]);
    expect(searchesV7(readBook("《Glass Harbour (玻璃港)》- Juniper Varga")!)).toHaveLength(4);
  });
});

describe("a credited artist's name must stand in the title, outside the 《》", () => {
  it("a Latin name stands only as whole words in a row", () => {
    expect(stands("DEN", "Show Me - DEN")).toBe(true);
    expect(stands("DEN", "Pinewood Garden")).toBe(false); // the wrong song of Bob's five-video check
    expect(stands("The Weeknd", "用百万级豪华装备试听The Weeknd")).toBe(true);
    expect(stands("Glass Animals", "Animals in a Glass")).toBe(false);
    expect(stands("P!NK", "- P!NK,Nate Ruess -")).toBe(true);
    expect(stands("Guns N' Roses", "- Guns N' Roses -")).toBe(true);
  });
  it("a Chinese, Japanese or Korean name stands as an unbroken run inside one stretch", () => {
    expect(stands("周杰倫", "| - 周杰伦 -")).toBe(true); // traditional and simplified are one name
    expect(stands("藤井風", "- 藤井风 -")).toBe(true);
    expect(stands("五月天", "汪苏泷&五月天阿信")).toBe(true);
    expect(stands("月亮", "月 亮")).toBe(false); // never joined across a gap
  });
  it("no name shorter than two characters ever counts", () => {
    expect(stands("阿", "阿YueYue")).toBe(false);
    expect(stands("V", "V - Glass Harbour")).toBe(false);
  });
  it("a listed alias counts; so does the name without a leading The", () => {
    const jay = rec("j", "Glass Harbour", [artist("Jay Chou", ["周杰伦", "周杰倫"])]);
    expect(artistStands(jay, "- 周杰伦 -")).toBe(true);
    expect(artistStands(rec("b", "x", [artist("The Linden Hours")]), "- Linden Hours -")).toBe(true);
    expect(artistStands(rec("o", "x", [artist("Ottilie Sand")]), "- 周杰伦 -")).toBe(false);
  });
  it("a name standing only in a quoted line does not count", () => {
    const title = "《Glass Harbour》- Juniper Varga -‘Ottilie Sand was right’";
    expect(outcome(v7(title, [rec("wrong", "Glass Harbour", [artist("Ottilie Sand")])]))).toBe("no candidate");
    expect(outcome(v7(title, [rec("right", "Glass Harbour", [artist("Juniper Varga")])]))).toBe("right");
  });
});

describe("which recording, or silence", () => {
  const T = "百万级装备听《Glass Harbour》- Juniper Varga【Hi-Res】";
  const JV = [artist("Juniper Varga")];
  it("names the earliest studio recording by an artist standing in the title", () => {
    expect(outcome(v7(T, [rec("late", "Glass Harbour", JV, [rel("2020-01-01")]), rec("early", "Glass Harbour", JV, [rel("2015-01-01", "Single")]), rec("other", "Glass Harbour", [artist("Ottilie Sand")], [rel("1999-01-01")])]))).toBe("early");
  });
  it("another artist's song of the same title is never named", () => {
    expect(outcome(v7(T, [rec("other", "Glass Harbour", [artist("Ottilie Sand")])]))).toBe("no candidate");
  });
  it("a title as written comes first: 'Glass Harbour (stripped back)' never stands beside 'Glass Harbour'", () => {
    const same = "rg-one";
    const original = rec("original", "Glass Harbour", JV, [rel("2020-06-29", "Single", undefined, same)]);
    const stripped = rec("stripped", "Glass Harbour (stripped back)", JV, [rel("2022-08-05", "Single", undefined, same)]);
    expect(outcome(v7(T, [original, stripped]))).toBe("original"); // Heat Waves, 2026-11-11: this pair silenced the rule as "versions months apart"
  });
  it("with no recording titled as written, a title with a bracket that names no version is the song", () => {
    const film = rec("film", "Glass Harbour (Lantern Year: The Film)", JV, [rel("2018-10-18", "Single")]);
    const remix = rec("remix", "Glass Harbour (remix)", JV, [rel("2019-01-01", "Single")]);
    expect(outcome(v7(T, [film, remix]))).toBe("film"); // Sunflower (Spider-Man: Into the Spider-Verse)
    expect(outcome(v7(T, [remix]))).toBe("no candidate");
  });
  it("live takes, compilations, DJ-mix excerpts and labelled versions are refused by the studio rule, unchanged", () => {
    expect(outcome(v7(T, [rec("live", "Glass Harbour", JV, [rel("2015-01-01", "Album", ["Live"])])]))).toBe("no studio recording");
    expect(outcome(v7(T, [rec("mix", "Glass Harbour", JV, [rel("2022-11-30", "Album", ["DJ-mix"])], "part of a DJ-mix")]))).toBe("no studio recording");
    expect(outcome(v7(T, [rec("edit", "Glass Harbour", JV, undefined, "radio edit")]))).toBe("no studio recording");
    expect(outcome(v7(T, [rec("clean", "Glass Harbour", JV, undefined, "clean")]))).toBe("only clean edits");
  });
  it("two lead artists who both stand in the title: silent", () => {
    const t = "《Glass Harbour》- Juniper Varga,Ottilie Sand";
    // Each is credited alone while the title names both together: neither is named (re-run of 2026-11-12).
    expect(v7(t, [rec("a", "Glass Harbour", JV), rec("b", "Glass Harbour", [artist("Ottilie Sand")])]).state).toBe("silent");
  });
  it("a generic title names no song; a search score under 85 is no candidate", () => {
    expect(outcome(v7("百万级装备听《Main Theme》- Juniper Varga", [rec("x", "Main Theme", JV)]))).toBe("a generic title");
    expect(outcome(v7(T, [rec("s", "Glass Harbour", JV, undefined, "", 84)]))).toBe("no candidate");
  });
  it("a recording title is compared with Chinese characters kept, as in version 6", () => {
    expect(sameTitle("月半彎", ["月半"])).toBe(false);
    expect(sameTitle("煙花易冷", ["烟花易冷"])).toBe(true);
  });
});

describe("step 4 and step 5", () => {
  it("Bilibili's notice for a removed video is not a video", () => {
    expect(isRemovedVideoTitle("视频去哪了呢？")).toBe(true);
    expect(isRemovedVideoTitle("视频去哪了呢？_哔哩哔哩_bilibili")).toBe(true);
    expect(isRemovedVideoTitle("Juniper Varga《Glass Harbour》")).toBe(false);
  });
  it("when no song is named the card says why, in one of two whole sentences", () => {
    const none = v7("百万级装备听《Glass Harbour》- Juniper Varga", []);
    expect(silenceLine(none)).toBe("This song is not on MusicBrainz.");
    const unsure = v7("百万级装备听《Glass Harbour》- Juniper Varga", [rec("live", "Glass Harbour", [artist("Juniper Varga")], [rel("2015-01-01", "Album", ["Live"])])]);
    expect(silenceLine(unsure)).toBe("I couldn't read this title.");
    expect(silenceLine(decide(parseTitle("【4K】"), []))).toBe("I couldn't read this title.");
    expect(silenceLine(v7("《Glass Harbour》- Juniper Varga", [rec("ok", "Glass Harbour", [artist("Juniper Varga")])]))).toBe("");
  });
});

// ---- Every fixture, replayed through the rule as the panel runs it --------------------------------

const FILES: Record<string, Record<string, MbRecording[]>> = { "50": MB_V6 as never, "100": MB_V7 as never };
const missing: string[] = [];
const recorded = async (url: string) => {
  const u = new URL(url);
  const q = u.searchParams.get("query")!;
  const reply = FILES[u.searchParams.get("limit")!]?.[q];
  if (!reply) missing.push(q);
  return { ok: true, status: 200, json: async () => ({ recordings: reply ?? [] }) };
};
const deps = { fetchFn: recorded, gate: new Gate(0) };
const replayV6 = async (f: MatchFixture) => {
  const p = parseTitle(f.title);
  return p.queries.length ? decide(p, await fetchFor(p, deps)) : decide(p, []);
};
const results = await Promise.all(MATCH_FIXTURES.map(async (f) => ({ f, v6: await replayV6(f), v7: await matchTitle(f.title, deps) })));

const sameSong = (r: MbRecording, a: { song: string; credit: string }) =>
  normalise(bare(stripNotes(r.title))) === normalise(bare(stripNotes(a.song))) && normalise(a.credit).includes(normalise(r["artist-credit"]?.[0]?.name ?? "@"));

/**
 * Songs version 7 names on titles whose earlier hand-checked answer was silence. Each was checked by
 * the builder against the video title (song and artist) from MusicBrainz's own record, 2026-11-11.
 * A new match not listed here fails the test until it is checked.
 */
export const V7_NEW_MATCHES_CHECKED: Record<string, string> = {
  "百万级装备听《LOVE.》- Kendrick Lamar, Zacari【Hi-Res】": "Right: LOVE. · Kendrick Lamar ft. Zacari, on DAMN. (official album, 2017-04-14). Version 6.3 searched the uploader's phrase as the artist.",
  "百万级装备听《Sunflower》- Post Malone，Swae Lee【Hi-Res】": "Right: the studio original b6df9d04 (Sunflower single, 2018-10-18), the recording Bob's Stage 9 check named (verdict record, broken row 4).",
  "百万级装备听《Runaway》- Kanye West, Pusha T 【Hi-Res】": "Right: Runaway · Kanye West feat. Pusha T, the album version on My Beautiful Dark Twisted Fantasy (2010).",
  "叶倩文《潇洒走一回》百万豪装录音棚大声听": "Right: 瀟灑走一回 · 葉蒨文, on the 1991 album of that name; 叶倩文 is a listed alias.",
  "小峰理纱《Resuscitated Hope（《GOSICK》片尾曲）》百万豪装录音棚大声听": "Right: Resuscitated Hope · コミネリサ, the 2011-04-27 single; 小峰理紗 is a listed alias. (Rule v5 had named an English cover here.)",
  "Martynas Levickis&David Garrett《Por Una Cabeza（一步之遥）》百万豪装录音棚大声听": "Right: Por una cabeza · Martynas with David Garrett, on the album Martynas (2013-10); Martynas Levickis is a listed alias.",
  "邓丽君《我只在乎你》百万豪装录音棚大声听": "Right: 我只在乎你 · 鄧麗君, earliest official studio release 酒醉的探戈 (1986-12-25), the Mandarin original.",
  "棱镜乐队《这是我一生中最勇敢的瞬间》百万豪装录音棚大声听": "Right: 这是我一生中最勇敢的瞬间 · 棱镜, on 我想以世纪和你在一起 (2019-12-31).",
};

describe(`every fixture under rule ${RULE_VERSION}`, () => {
  it("every search the rule sends has a recorded reply", () => {
    expect([...new Set(missing)]).toEqual([]);
  });
  it("acceptance (a): every title version 6.3 matched matches the same recording", () => {
    const changed = results.filter((x) => x.v6.state === "certain" && !(x.v7.state === "certain" && x.v7.recording.id === x.v6.recording.id)).map((x) => x.f.title);
    expect(changed).toEqual([]);
    expect(results.filter((x) => x.v6.state === "certain").length).toBeGreaterThan(100);
  });
  it("acceptance (b): Bob's four videos name the studio original, with nothing typed", () => {
    const four = results.filter((x) => x.f.set === "v7" && "song" in x.f.answer);
    expect(four).toHaveLength(4);
    for (const { f, v7 } of four) {
      expect(v7.state, f.title).toBe("certain");
      expect(v7.state === "certain" && v7.recording.id.slice(0, 8), f.title).toBe((f.answer as { recording_id: string }).recording_id);
    }
  });
  it("acceptance (b): a 《》 that holds a film, a show or an album and no song stays silent or names the right song, never a wrong one", () => {
    const three = results.filter((x) => x.f.set === "v7" && "silent" in x.f.answer);
    expect(three).toHaveLength(3);
    for (const { f, v7 } of three) expect(v7.state, f.title).toBe("silent");
  });
  it("0 wrong songs: every match is the hand-checked song, or a new match checked by hand", () => {
    const wrong: string[] = [];
    for (const { f, v7 } of results) {
      if (v7.state !== "certain") continue;
      if ("song" in f.answer) {
        if (!sameSong(v7.recording, f.answer)) wrong.push(`${f.title} → ${v7.candidate.title} · ${v7.candidate.artist_credit} (answer: ${f.answer.song} · ${f.answer.credit})`);
      } else if (!V7_NEW_MATCHES_CHECKED[f.title] && !NEW_IN_V6[f.title]) {
        wrong.push(`NEW, not yet hand-checked: ${f.title} → ${v7.candidate.title} · ${v7.candidate.artist_credit} · ${v7.candidate.first_release} · ${v7.candidate.recording_id}`);
      }
    }
    expect(wrong).toEqual([]);
  });
  it("coverage on the tuning sets rises and never falls (reported, not the bar)", () => {
    const count = (set: string, which: "v6" | "v7") => results.filter((x) => x.f.set === set && x[which].state === "certain").length;
    for (const set of ["stage6", "fresh", "run2"]) expect(count(set, "v7"), set).toBeGreaterThanOrEqual(count(set, "v6"));
    expect(count("stage6", "v7")).toBeGreaterThan(count("stage6", "v6"));
  });
});

/** The three matches version 6 already made on titles answered "silent", hand-checked in fr-core-1.test.ts. */
const NEW_IN_V6: Record<string, true> = {
  "「NF｜全新EP」FEAR - NF (Nate Feuerstein)": true,
  "蔡琴《你不要那样看着我的眼睛》百万豪装录音棚大声听": true,
  "刘欢《千万次的问（《北京人在纽约》片头曲）》百万豪装录音棚大声听": true,
};

export const v7Coverage = () =>
  ["stage6", "fresh", "run2", "v7"].map((s) => {
    const rs = results.filter((x) => x.f.set === s);
    return `${s}: v6.3 ${rs.filter((x) => x.v6.state === "certain").length}, v7 ${rs.filter((x) => x.v7.state === "certain").length} of ${rs.length}`;
  });

describe("a co-credited artist the title does not name means another version", () => {
  const jh = { name: "Joe Hisaishi", artist: { id: "jh", name: "Joe Hisaishi", aliases: [{ name: "久石让" }] } };
  const orch = { name: "Wiener Symphoniker", artist: { id: "ws", name: "Wiener Symphoniker" } };
  const r = (id: string, credit: MbRecording["artist-credit"], date: string): MbRecording => ({ id, title: "Summer", score: 100, "artist-credit": credit, releases: [{ id: `x${id}`, status: "Official", date, "release-group": { id: `g${id}`, "primary-type": "Album" } }] });
  const title = "久石让《Summer（菊次郎的夏天）》百万豪装录音棚大声听";
  it("a 2024 recording credited to the composer and an orchestra is refused when the title names only the composer", () => {
    const rerecording = r("2024", [{ ...jh, joinphrase: " & " }, orch], "2024-10-24");
    expect(outcome(v7(title, [rerecording]))).toBe("credits differ");
    expect(outcome(v7(title, [rerecording, r("1999", [jh], "1999-05-26")]))).toBe("1999");
  });
  it("a featured guest the title leaves out does not refuse the recording", () => {
    const withGuest = r("feat", [{ ...jh, joinphrase: " feat. " }, orch], "2001-01-01");
    expect(outcome(v7(title, [withGuest]))).toBe("feat");
  });
});

describe("re-run of the coverage bar, 2026-11-12: the credit must fit the names in the title", () => {
  const duo = [{ ...artist("Juniper Varga"), joinphrase: " & " }, artist("Ottilie Sand")];
  it("a recording credited to one artist alone, when the title names several together, is another version", () => {
    const t = "《Glass Harbour》- Juniper Varga,Ottilie Sand -";
    const solo = v7(t, [rec("solo", "Glass Harbour", [artist("Juniper Varga")])]);
    expect(outcome(solo)).toBe("credits differ");
    expect(silenceLine(solo)).toBe("I couldn't read this title."); // never "not on MusicBrainz": it is there
    expect(outcome(v7(t, [rec("both", "Glass Harbour", duo)]))).toBe("both");
  });
  it("a title that adds a series name to a duet still names the duet", () => {
    expect(outcome(v7("Lantern Series&Juniper Varga&Ottilie Sand《Glass Harbour》", [rec("both", "Glass Harbour", duo)]))).toBe("both");
  });
  it("a name written without its hyphen stands for the hyphenated word, and only for the whole word", () => {
    expect(stands("PattyCake", "Patty-Cake 百万豪装录音棚大声听")).toBe(true);
    expect(stands("DEN", "Pinewood Garden")).toBe(false);
    // A hyphen still separates whole words: "Garden" stands in "Pinewood-Garden", "DEN" never does.
    expect(stands("DEN", "Pinewood-Garden")).toBe(false);
  });
  it("version 6.3's own result must fit the credit too, or the new part decides (the 成龍 VS 鄧麗君 duet)", async () => {
    const duet: MbRecording = { id: "duet", title: "Glass Harbour", score: 100, "artist-credit": [{ name: "Example Star", joinphrase: " VS ", artist: { id: "es", name: "Example Star" } }, { name: "Juniper Varga", artist: { id: "jv", name: "Juniper Varga" } }], releases: [{ id: "x", status: "Official", date: "2002-02", "release-group": { id: "g1", "primary-type": "Album" } }] };
    const original = rec("original", "Glass Harbour", [artist("Juniper Varga")], [rel("1986-12-25")]);
    const fetchFn = async (url: string) => {
      const q = new URL(url).searchParams.get("query")!;
      return { ok: true, status: 200, json: async () => ({ recordings: /status:official/.test(q) ? [duet, original] : [duet] }) };
    };
    const r = await matchTitle("Juniper Varga《Glass Harbour》百万豪装录音棚大声听", { fetchFn, gate: new Gate(0) });
    expect(outcome(r)).toBe("original");
  });
  it("a lone recording whose release has no status or type is named only when nothing marks it as another version", () => {
    const t = "《Glass Harbour》- Juniper Varga -";
    const plain: MbRecording = { id: "plain", title: "Glass Harbour", score: 100, "artist-credit": [artist("Juniper Varga")], releases: [{ id: "x" }] };
    expect(outcome(v7(t, [plain]))).toBe("plain");
    expect(v7(t, [{ ...plain, disambiguation: "live" }]).state).toBe("silent");
    expect(v7(t, [{ ...plain, releases: [{ id: "x", status: "Bootleg" }] }]).state).toBe("silent");
    expect(v7(t, [{ ...plain, releases: [{ id: "x", "release-group": { id: "g", "secondary-types": ["Compilation"] } }] }]).state).toBe("silent");
    expect(v7(t, [plain, { ...plain, id: "second" }]).state).toBe("silent"); // two recordings: not lone
  });
});

describe("run 2 of the coverage bar, 2026-11-12: two checks that only make the rule silent", () => {
  const JV = [artist("Juniper Varga")];
  const plain = (len?: number) => ({ ...rec("plain", "Glass Harbour", JV, [rel("2020-06-29", "Single")]), length: len });
  const certain = (title: string, r: MbRecording): MatchResult => ({ state: "certain", recording: r, candidate: { recording_id: r.id, title: r.title, artist_credit: "Juniper Varga" }, candidates: [], parsed: parseTitle(title) });
  it("a version the title names outside the song's own name (钢琴 piano, 不插电 unplugged) must show on the recording", () => {
    const t = "「钢琴+不插电」Glass Harbour - Juniper Varga";
    expect(lastChecks(t, certain(t, plain())).state).toBe("silent");
    expect((lastChecks(t, certain(t, plain())) as { reason: string }).reason).toBe("a version the recording lacks");
    const piano = { ...plain(), title: "Glass Harbour (Piano Version)" };
    expect(lastChecks(t, certain(t, piano)).state).toBe("certain");
    const noted = { ...plain(), disambiguation: "acoustic, unplugged" };
    expect(lastChecks(t, certain(t, noted)).state).toBe("certain");
  });
  it("each Chinese version word counts on its own", () => {
    for (const w of ["钢琴", "不插电", "纯音乐", "伴奏", "现场", "戏腔", "女版", "混音", "加速", "降速"]) {
      const t = `「${w}」Glass Harbour - Juniper Varga`;
      expect(versionNamed(t, parseTitle(t)), w).toBe(true);
    }
  });
  it("a version word that is part of the song's own name names no version", () => {
    for (const t of ["「怀旧经典」Piano Man - Juniper Varga", "Juniper Varga《Live Wire》"]) {
      const r = { ...plain(), title: t.includes("Piano") ? "Piano Man" : "Live Wire" };
      expect(lastChecks(t, certain(t, r)).state, t).toBe("certain");
    }
    expect(versionNamed("「怀旧经典」Piano Man - Juniper Varga", parseTitle("「怀旧经典」Piano Man - Juniper Varga"))).toBe(false);
    expect(versionNamed("「钢琴+不插电」Glass Harbour - Juniper Varga", parseTitle("「钢琴+不插电」Glass Harbour - Juniper Varga"))).toBe(true);
    expect(versionNamed("2026年最新版！Juniper Varga《Glass Harbour》MV", parseTitle("2026年最新版！Juniper Varga《Glass Harbour》MV"))).toBe(false); // 最新版 is "latest edition", MV is no version
  });
  it("a recording more than 30 seconds longer or shorter than the video is another version; with no length known, nothing changes", () => {
    const t = "Juniper Varga《Glass Harbour》";
    expect(lastChecks(t, certain(t, plain(358_000)), { videoSeconds: 822 }).state).toBe("silent"); // the Thriller short film
    expect((lastChecks(t, certain(t, plain(178_000)), { videoSeconds: 365 }) as { reason: string }).reason).toBe("lengths differ");
    expect(lastChecks(t, certain(t, plain(238_805)), { videoSeconds: 239 }).state).toBe("certain");
    expect(lastChecks(t, certain(t, plain(200_000)), { videoSeconds: 230 }).state).toBe("certain"); // 30 s exactly is kept
    expect(lastChecks(t, certain(t, plain(200_000)), { videoSeconds: 231 }).state).toBe("silent");
    expect(lastChecks(t, certain(t, plain(undefined)), { videoSeconds: 822 }).state).toBe("certain");
    expect(lastChecks(t, certain(t, plain(358_000))).state).toBe("certain");
  });
  it("either silence says \"I couldn't read this title.\"", () => {
    const t = "Juniper Varga《Glass Harbour》";
    expect(silenceLine(lastChecks(t, certain(t, plain(358_000)), { videoSeconds: 822 }))).toBe("I couldn't read this title.");
  });
});

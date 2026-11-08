/** T1.6 Erase everything in this browser (FR-T1.6), and the stores it erases: rows survive a reload, then are gone. */
import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it } from "vitest";
import { ALL_KEYS } from "./design/key-colour";
import { EXAMPLE_CATALOGUE } from "./examples";
import { eraseAll, fromRows, loadAll, openDb, saveAll, STORES, toRows, type Snapshot } from "./storage";

const AT = "2026-11-08T10:00:00.000Z";

function snapshot(): Snapshot {
  const rows = EXAMPLE_CATALOGUE.slice(0, 3).map((f) => toRows(f, "rule", AT));
  return {
    recordings: rows.map((r) => r.recording),
    facts: rows.flatMap((r) => r.facts),
    choices: [{ question_id: "q1", person_id: "me", source: "named songs", pattern_kind: "tempo", pattern_text: "p", evidence: [], readings_offered: ["a", "b"], readings_kept: ["ka", "kb"], choice: "first", answered_at: AT }],
    settings: [{ settings_id: 1, installed_at: AT }],
    events: [{ event_id: "ev1", kind: "check_a_answered", at: AT, question_id: "q1", person_id: "me", judge_id: "me", value: "Neither", line_text: "p" }],
    people: [{ person_id: "me", label: "me", source: "named songs", loaded_at: AT }],
    songs: [{ entry_id: "e1", person_id: "me", typed_text: "glass", recording_id: EXAMPLE_CATALOGUE[0]!.recording_id, comes_back_for: "the bridge", found_me: "unanswered", entered_at: AT }],
    words: [{ words_id: "w1", person_id: "me", question: "q?", about: "q1", text: "my words", written_at: AT, in_note: true }],
  };
}

describe("the stores", () => {
  it("keep every row across a reload", async () => {
    const factory = new IDBFactory();
    await saveAll(await openDb(factory), snapshot());
    const back = await loadAll(await openDb(factory));
    expect(back.songs).toEqual(snapshot().songs);
    expect(back.words).toEqual(snapshot().words);
    expect(back.choices).toEqual(snapshot().choices);
    expect(back.facts.length).toBe(snapshot().facts.length);
  });
  it("a song's facts come back exactly as they went in, every key included", () => {
    for (const f of EXAMPLE_CATALOGUE) {
      const { recording, facts } = toRows(f, "rule", AT);
      expect(fromRows(recording, facts)).toEqual(JSON.parse(JSON.stringify(f)));
    }
    for (const k of ALL_KEYS) {
      const f = { ...EXAMPLE_CATALOGUE[0]!, key: { ...k, strength: 0.7, source: { label: "AcousticBrainz", url: "https://acousticbrainz.org/x" } } };
      const { recording, facts } = toRows(f, "rule", AT);
      expect(fromRows(recording, facts).key).toEqual(f.key);
    }
  });
  it("every fact keeps its source and licence", () => {
    const { facts } = toRows({ ...EXAMPLE_CATALOGUE[0]!, people: [{ name: "Kasimir Fenwold", role: "producer", source: { label: "MusicBrainz", url: "https://musicbrainz.org/recording/r" } }] }, "rule", AT);
    const p = facts.find((x) => x.kind === "producer")!;
    expect(p.source_url).toBe("https://musicbrainz.org/recording/r");
    expect(p.licence).toBe("CC0");
  });
});

describe("Erase everything in this browser", () => {
  it("after erase, every store is empty except D8's timestamp", async () => {
    const factory = new IDBFactory();
    const db = await openDb(factory);
    await saveAll(db, snapshot());
    await eraseAll(db, "2026-11-08T11:00:00.000Z");
    const after = await loadAll(await openDb(factory));
    for (const [k, rows] of Object.entries(after)) {
      if (k === "settings") expect(rows).toEqual([{ settings_id: 1, last_erased_at: "2026-11-08T11:00:00.000Z" }]);
      else expect(rows, k).toEqual([]);
    }
    expect([...db.objectStoreNames].sort()).toEqual(Object.keys(STORES).sort());
  });
});

describe("reading the stores back", () => {
  it("keeps songs in the order they were named, whatever order the database returns", async () => {
    const { fromSnapshot } = await import("../ui/store");
    const snap = snapshot();
    const a = { ...snap.songs[0]!, entry_id: "zzz", entered_at: "2026-11-08T09:00:00.000Z" };
    const b = { ...snap.songs[0]!, entry_id: "aaa", entered_at: "2026-11-08T09:05:00.000Z" };
    expect(fromSnapshot({ ...snap, songs: [b, a] }).songs.map((s) => s.entry_id)).toEqual(["zzz", "aaa"]);
  });
});

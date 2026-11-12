"use client";
/**
 * The person's rows: people (D12), named songs (D13), the facts of their recordings (D2/D3), their
 * choices on lines (D6), their own words (D14), and their check-A and swap-test answers (D9). Kept in
 * IndexedDB in this browser (src/storage.ts) and saved after every change; read once when a page opens.
 */
import { useSyncExternalStore } from "react";
import { readFound, type AlbumPart, type Found, type HistoryRow, type KeyRow, type NamedSong, type NextRow, type Part, type PlayRow, type Song, type SongFacts } from "../src/model";
import type { Choice, Words } from "../src/note";
import { deleteHistory, eraseAll, fromRows, loadAll, loadHistories, loadKeys, loadNexts, loadPlays, openDb, putHistory, putKey, putNext, putPlay, saveAll, toRows, type Person, type RecordingRow, type Snapshot, type UsageEvent } from "../src/storage";

export interface State {
  /** False until the rows saved in this browser have been read. */
  ready: boolean;
  people: Person[];
  songs: NamedSong[];
  facts: Record<string, SongFacts>;
  matchedBy: Record<string, RecordingRow["matched_by"]>;
  disputed: string[]; // recording_ids whose release date the person marked wrong
  choices: Choice[];
  words: Words[];
  events: UsageEvent[];
  /** D11, by person: Spotify plays read from a file dropped in this browser. */
  histories: Record<string, HistoryRow[]>;
  /** D1, in the order played. */
  plays: PlayRow[];
  /** D5, in the order shown. */
  keys: KeyRow[];
  /** D7, in the order shown. */
  nexts: NextRow[];
  story_shown_count: number;
  story_last_shown_on?: string;
  /** FR-T9.8: optional, kept in this browser, used only to say how old he was when a record found him. */
  birth_year?: number;
  installed_at?: string;
  last_erased_at?: string;
}

const EMPTY: State = { ready: false, people: [], songs: [], facts: {}, matchedBy: {}, disputed: [], choices: [], words: [], events: [], histories: {}, plays: [], keys: [], nexts: [], story_shown_count: 0 };

let state: State = EMPTY;
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const emit = () => listeners.forEach((l) => l());

/** The rows as they are now, for code outside a screen. */
export const getState = () => state;

export function useStore(): State {
  return useSyncExternalStore(subscribe, () => state, () => EMPTY);
}

const id = () => Math.random().toString(36).slice(2, 10);
const now = () => new Date().toISOString();
type Refs = Omit<UsageEvent, "event_id" | "kind" | "at">;
/** FR-T8.1: an event for D9. */
const ev = (kind: UsageEvent["kind"], refs: Refs = {}): UsageEvent => ({ event_id: id(), kind, at: now(), ...refs });
export const MAX_SONGS = 10;
export const ME = "me";

// ---- Persistence ---------------------------------------------------------------------------------------

const hasIdb = () => typeof indexedDB !== "undefined";
let dbp: Promise<IDBDatabase> | null = null;
const db = () => (dbp ??= openDb());

export function toSnapshot(s: State): Snapshot {
  // Every recording a song, a play or a fix brought in: the order of saves can never drop one.
  const rows = Object.keys(s.facts).map((r) => toRows({ ...s.facts[r]!, date_disputed: s.disputed.includes(r) }, s.matchedBy[r] ?? "my pick", now()));
  const people = s.people.some((p) => p.person_id === ME) ? s.people : [{ person_id: ME, label: "me", source: "named songs" as const, loaded_at: s.installed_at ?? now() }, ...s.people];
  return {
    recordings: rows.map((r) => r.recording),
    facts: rows.flatMap((r) => r.facts),
    choices: s.choices,
    settings: [{
      settings_id: 1, installed_at: s.installed_at ?? now(), ...(s.last_erased_at ? { last_erased_at: s.last_erased_at } : {}),
      story_shown_count: s.story_shown_count, ...(s.story_last_shown_on ? { story_last_shown_on: s.story_last_shown_on } : {}),
      ...(s.birth_year ? { birth_year: s.birth_year } : {}),
    }],
    events: s.events,
    people,
    songs: s.songs,
    words: s.words,
  };
}

export function fromSnapshot(snap: Snapshot): State {
  const facts: Record<string, SongFacts> = {};
  const matchedBy: Record<string, RecordingRow["matched_by"]> = {};
  for (const r of snap.recordings) {
    facts[r.recording_id] = { ...fromRows(r, snap.facts), date_disputed: false };
    matchedBy[r.recording_id] = r.matched_by;
  }
  const settings = snap.settings[0];
  // IndexedDB returns rows in key order; songs are kept in the order they were named.
  const byTime = <T,>(rows: T[], at: (r: T) => string) => [...rows].sort((a, b) => at(a).localeCompare(at(b)));
  return {
    ready: true,
    people: byTime(snap.people, (p) => p.loaded_at),
    // FR-T9.8: answers saved under the earlier five options are read as the nested ranges.
    songs: byTime(snap.songs, (e) => e.entered_at).map((e) => ({ ...e, found_me: readFound(e.found_me) })),
    facts,
    matchedBy,
    disputed: snap.recordings.filter((r) => r.date_disputed).map((r) => r.recording_id),
    choices: byTime(snap.choices, (c) => c.answered_at),
    words: byTime(snap.words, (w) => w.written_at),
    events: byTime(snap.events, (e) => e.at),
    histories: {},
    plays: [],
    keys: [],
    nexts: [],
    story_shown_count: settings?.story_shown_count ?? 0,
    story_last_shown_on: settings?.story_last_shown_on,
    birth_year: settings?.birth_year,
    installed_at: settings?.installed_at,
    last_erased_at: settings?.last_erased_at,
  };
}

let saving: Promise<void> = Promise.resolve();
let saveFailed = false;
function save() {
  if (!hasIdb() || !state.ready) return;
  const snap = toSnapshot(state);
  saving = saving.then(async () => {
    try {
      await saveAll(await db(), snap);
    } catch {
      saveFailed = true; // the page keeps working from memory; nothing is sent anywhere
    }
  });
}

const set = (next: State) => {
  state = next;
  emit();
  save();
};

let hydrating: Promise<void> | null = null;
/** Read the rows saved in this browser once. Pages call it on mount. */
export function hydrate(): Promise<void> {
  if (hydrating) return hydrating;
  hydrating = (async () => {
    if (!hasIdb()) {
      state = { ...state, ready: true };
      emit();
      return;
    }
    try {
      const d = await db();
      const loaded = fromSnapshot(await loadAll(d));
      state = { ...loaded, histories: await loadHistories(d), plays: await loadPlays(d), keys: await loadKeys(d), nexts: await loadNexts(d), installed_at: loaded.installed_at ?? now() };
    } catch {
      state = { ...state, ready: true };
    }
    emit();
  })();
  return hydrating;
}

export const storageFailed = () => saveFailed;

/** For tests of the screens only: put rows in place without a database. */
export function seedForTests(rows: Partial<State>): void {
  state = { ...EMPTY, ready: true, ...rows };
  hydrating = Promise.resolve();
  emit();
}

// ---- Actions -----------------------------------------------------------------------------------------

export const actions = {
  addSong(facts: SongFacts, typed: string, person = ME, matched_by: RecordingRow["matched_by"] = "my pick"): string | null {
    const mine = state.songs.filter((s) => s.person_id === person);
    if (mine.length >= MAX_SONGS || mine.some((s) => s.recording_id === facts.recording_id)) return null;
    const entry: NamedSong = {
      entry_id: id(), person_id: person, typed_text: typed, recording_id: facts.recording_id,
      comes_back_for: "unanswered", found_me: "unanswered", entered_at: now(), ...(facts.kind === "album" ? { kind: "album" as const } : {}),
    };
    set({
      ...state,
      events: [...state.events, ev("song_named", { entry_id: entry.entry_id, person_id: person })],
      songs: [...state.songs, entry],
      facts: { ...state.facts, [facts.recording_id]: facts },
      matchedBy: { ...state.matchedBy, [facts.recording_id]: matched_by },
    });
    return entry.entry_id;
  },
  removeSong(entry_id: string) {
    set({ ...state, songs: state.songs.filter((s) => s.entry_id !== entry_id) });
  },
  answer<F extends "comes_back_for" | "found_me">(entry_id: string, field: F, value: F extends "comes_back_for" ? Part | AlbumPart | "unanswered" : Found | "unanswered") {
    set({
      ...state,
      events: [...state.events, ev(field === "comes_back_for" ? "part_answered" : "found_answered", { entry_id, value: String(value) })],
      // FR-T9.8: one range is stored, never two; a year belongs only to "longer ago".
      songs: state.songs.map((s) => (s.entry_id === entry_id ? { ...s, [field]: value, ...(field === "found_me" && value !== "longer ago" ? { found_year: undefined } : {}) } : s)),
    });
  },
  /** FR-T9.8: the optional year for "longer ago". */
  foundYear(entry_id: string, year: number | undefined) {
    set({ ...state, songs: state.songs.map((s) => (s.entry_id === entry_id && s.found_me === "longer ago" ? { ...s, found_year: year } : s)) });
  },
  /** FR-T9.8: the optional birth year, kept in this browser. */
  setBirthYear(year: number | undefined) {
    set({ ...state, birth_year: year });
  },
  disputeDate(recording_id: string) {
    if (!state.disputed.includes(recording_id)) set({ ...state, disputed: [...state.disputed, recording_id] });
  },
  choose(c: Omit<Choice, "answered_at">) {
    set({
      ...state,
      events: [...state.events, ev("reading_chosen", { question_id: c.question_id, person_id: c.person_id, value: c.choice })],
      choices: [...state.choices.filter((x) => x.question_id !== c.question_id || x.person_id !== c.person_id), { ...c, answered_at: now() }],
    });
  },
  write(w: Omit<Words, "words_id" | "written_at">) {
    set({
      ...state,
      events: [...state.events, ev("words_written", { question_id: w.about, person_id: w.person_id })],
      words: [...state.words.filter((x) => x.about !== w.about || x.person_id !== w.person_id), { ...w, words_id: id(), written_at: now() }],
    });
  },
  /** FR-T9.1: a second person for the swap test, with the consent note in the user's own words. */
  addPerson(label: string, consent_note: string, source: Person["source"] = "named songs"): string {
    const p: Person = { person_id: `person-${id()}`, label: label.trim(), source, consent_note: `${consent_note.trim()} (${now().slice(0, 10)})`, loaded_at: now() };
    set({ ...state, people: [...state.people, p] });
    return p.person_id;
  },
  /** FR-CORE-4: one answer per line per test; a later answer replaces an earlier one. */
  judge(e: Omit<UsageEvent, "event_id" | "at">) {
    const others = state.events.filter((x) => !(x.kind === e.kind && x.question_id === e.question_id && x.person_id === e.person_id && x.judge_id === e.judge_id));
    set({ ...state, events: [...others, { ...e, event_id: id(), at: now() }] });
  },
  /** FR-T8.1: log what happened on the panel or a page (D9). */
  log(kind: UsageEvent["kind"], refs: Refs = {}) {
    set({ ...state, events: [...state.events, ev(kind, refs)] });
  },
  /** T5.7: keep a person's plays read from their Spotify file (replacing any read before). */
  async keepHistory(person_id: string, rows: HistoryRow[]) {
    const mine = rows.map((r, i) => ({ ...r, person_id, history_id: `${person_id}:${i}` }));
    set({ ...state, events: [...state.events, ev("history_loaded", { person_id, value: String(mine.length) })], histories: { ...state.histories, [person_id]: mine } });
    if (hasIdb()) await putHistory(await db(), person_id, mine).catch(() => void (saveFailed = true));
  },
  async removeHistory(person_id: string) {
    const { [person_id]: _gone, ...rest } = state.histories;
    set({ ...state, histories: rest });
    if (hasIdb()) await deleteHistory(await db(), person_id).catch(() => void (saveFailed = true));
  },
  /** FR-T1.2: add or update one play (its seconds heard grow while it plays). */
  async savePlay(row: PlayRow) {
    const i = state.plays.findIndex((p) => p.play_id === row.play_id);
    const plays = i < 0 ? [...state.plays, row] : state.plays.map((p, j) => (j === i ? row : p));
    state = { ...state, plays };
    emit();
    if (hasIdb() && state.ready) await putPlay(await db(), row).catch(() => void (saveFailed = true));
  },
  /** FR-T2.2–T2.6: add or update one line shown (D5). */
  async saveKey(row: KeyRow) {
    const i = state.keys.findIndex((k) => k.key_id === row.key_id);
    state = { ...state, keys: i < 0 ? [...state.keys, row] : state.keys.map((k, j) => (j === i ? row : k)) };
    emit();
    if (hasIdb() && state.ready) await putKey(await db(), row).catch(() => void (saveFailed = true));
  },
  /** FR-T4.5: add or update one next record (D7). */
  async saveNext(row: NextRow) {
    const i = state.nexts.findIndex((n) => n.suggestion_id === row.suggestion_id);
    state = { ...state, nexts: i < 0 ? [...state.nexts, row] : state.nexts.map((n, j) => (j === i ? row : n)) };
    emit();
    if (hasIdb() && state.ready) await putNext(await db(), row).catch(() => void (saveFailed = true));
  },
  /** FR-T3.4: Sancho's story showed by itself today. */
  storyShown(day: string) {
    set({ ...state, story_shown_count: state.story_shown_count + 1, story_last_shown_on: day });
  },
  /** A recording a play or a fix pointed at (D2), kept with how it was matched. */
  keepRecording(facts: SongFacts, matched_by: RecordingRow["matched_by"]) {
    set({ ...state, facts: { ...state.facts, [facts.recording_id]: facts }, matchedBy: { ...state.matchedBy, [facts.recording_id]: matched_by } });
  },
  /** FR-T1.6: clears every store in this browser; only the time of the erase is kept. */
  async eraseEverything() {
    const at = now();
    if (hasIdb()) {
      await saving;
      await eraseAll(await db(), at);
    }
    state = { ...EMPTY, ready: true, installed_at: undefined, last_erased_at: at };
    emit();
  },
};

/** A person's songs with their facts, a disputed date applied. Kept in the order they were named. */
export function songsOf(s: State, person = ME): Song[] {
  return s.songs
    .filter((e) => e.person_id === person && s.facts[e.recording_id])
    .map((entry) => {
      const f = s.facts[entry.recording_id]!;
      return { entry, facts: s.disputed.includes(f.recording_id) ? { ...f, date_disputed: true } : f };
    });
}

export const others = (s: State) => s.people.filter((p) => p.person_id !== ME);

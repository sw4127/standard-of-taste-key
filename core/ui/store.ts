"use client";
/**
 * The person's rows: people (D12), named songs (D13), the facts of their recordings (D2/D3), their
 * choices on lines (D6), their own words (D14), and their check-A and swap-test answers (D9). Kept in
 * IndexedDB in this browser (src/storage.ts) and saved after every change; read once when a page opens.
 */
import { useSyncExternalStore } from "react";
import type { Found, NamedSong, Part, Song, SongFacts } from "../src/model";
import type { Choice, Words } from "../src/note";
import { eraseAll, fromRows, loadAll, openDb, saveAll, toRows, type Person, type RecordingRow, type Snapshot, type UsageEvent } from "../src/storage";

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
  installed_at?: string;
  last_erased_at?: string;
}

const EMPTY: State = { ready: false, people: [], songs: [], facts: {}, matchedBy: {}, disputed: [], choices: [], words: [], events: [] };

let state: State = EMPTY;
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const emit = () => listeners.forEach((l) => l());

export function useStore(): State {
  return useSyncExternalStore(subscribe, () => state, () => EMPTY);
}

const id = () => Math.random().toString(36).slice(2, 10);
const now = () => new Date().toISOString();
export const MAX_SONGS = 10;
export const ME = "me";

// ---- Persistence ---------------------------------------------------------------------------------------

const hasIdb = () => typeof indexedDB !== "undefined";
let dbp: Promise<IDBDatabase> | null = null;
const db = () => (dbp ??= openDb());

export function toSnapshot(s: State): Snapshot {
  const ids = new Set(s.songs.map((e) => e.recording_id));
  const rows = [...ids].filter((r) => s.facts[r]).map((r) => toRows({ ...s.facts[r]!, date_disputed: s.disputed.includes(r) }, s.matchedBy[r] ?? "my pick", now()));
  const people = s.people.some((p) => p.person_id === ME) ? s.people : [{ person_id: ME, label: "me", source: "named songs" as const, loaded_at: s.installed_at ?? now() }, ...s.people];
  return {
    recordings: rows.map((r) => r.recording),
    facts: rows.flatMap((r) => r.facts),
    choices: s.choices,
    settings: [{ settings_id: 1, installed_at: s.installed_at ?? now(), ...(s.last_erased_at ? { last_erased_at: s.last_erased_at } : {}) }],
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
    songs: byTime(snap.songs, (e) => e.entered_at),
    facts,
    matchedBy,
    disputed: snap.recordings.filter((r) => r.date_disputed).map((r) => r.recording_id),
    choices: byTime(snap.choices, (c) => c.answered_at),
    words: byTime(snap.words, (w) => w.written_at),
    events: byTime(snap.events, (e) => e.at),
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
      const loaded = fromSnapshot(await loadAll(await db()));
      state = { ...loaded, installed_at: loaded.installed_at ?? now() };
    } catch {
      state = { ...state, ready: true };
    }
    emit();
  })();
  return hydrating;
}

export const storageFailed = () => saveFailed;

// ---- Actions -----------------------------------------------------------------------------------------

export const actions = {
  addSong(facts: SongFacts, typed: string, person = ME, matched_by: RecordingRow["matched_by"] = "my pick"): string | null {
    const mine = state.songs.filter((s) => s.person_id === person);
    if (mine.length >= MAX_SONGS || mine.some((s) => s.recording_id === facts.recording_id)) return null;
    const entry: NamedSong = {
      entry_id: id(), person_id: person, typed_text: typed, recording_id: facts.recording_id,
      comes_back_for: "unanswered", found_me: "unanswered", entered_at: now(),
    };
    set({
      ...state,
      songs: [...state.songs, entry],
      facts: { ...state.facts, [facts.recording_id]: facts },
      matchedBy: { ...state.matchedBy, [facts.recording_id]: matched_by },
    });
    return entry.entry_id;
  },
  removeSong(entry_id: string) {
    set({ ...state, songs: state.songs.filter((s) => s.entry_id !== entry_id) });
  },
  answer<F extends "comes_back_for" | "found_me">(entry_id: string, field: F, value: F extends "comes_back_for" ? Part | "unanswered" : Found | "unanswered") {
    set({ ...state, songs: state.songs.map((s) => (s.entry_id === entry_id ? { ...s, [field]: value } : s)) });
  },
  disputeDate(recording_id: string) {
    if (!state.disputed.includes(recording_id)) set({ ...state, disputed: [...state.disputed, recording_id] });
  },
  choose(c: Omit<Choice, "answered_at">) {
    set({ ...state, choices: [...state.choices.filter((x) => x.question_id !== c.question_id || x.person_id !== c.person_id), { ...c, answered_at: now() }] });
  },
  write(w: Omit<Words, "words_id" | "written_at">) {
    set({ ...state, words: [...state.words.filter((x) => x.about !== w.about || x.person_id !== w.person_id), { ...w, words_id: id(), written_at: now() }] });
  },
  /** FR-T9.1: a second person for the swap test, with the consent note in the user's own words. */
  addPerson(label: string, consent_note: string): string {
    const p: Person = { person_id: `person-${id()}`, label: label.trim(), source: "named songs", consent_note: `${consent_note.trim()} (${now().slice(0, 10)})`, loaded_at: now() };
    set({ ...state, people: [...state.people, p] });
    return p.person_id;
  },
  /** FR-CORE-4: one answer per line per test; a later answer replaces an earlier one. */
  judge(e: Omit<UsageEvent, "event_id" | "at">) {
    const others = state.events.filter((x) => !(x.kind === e.kind && x.question_id === e.question_id && x.person_id === e.person_id && x.judge_id === e.judge_id));
    set({ ...state, events: [...others, { ...e, event_id: id(), at: now() }] });
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

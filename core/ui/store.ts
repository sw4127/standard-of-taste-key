"use client";
/**
 * The person's rows while a page is open: named songs (D13), the facts of their recordings (D2/D3),
 * their choices on lines (D6) and their own words (D14). Held in memory in this step; T1.6 moves the
 * same rows into IndexedDB in this browser.
 */
import { useSyncExternalStore } from "react";
import type { Found, NamedSong, Part, Song, SongFacts } from "../src/model";
import type { Choice, Words } from "../src/note";

export interface State {
  songs: NamedSong[];
  facts: Record<string, SongFacts>;
  disputed: string[]; // recording_ids whose release date the person marked wrong
  choices: Choice[];
  words: Words[];
}

let state: State = { songs: [], facts: {}, disputed: [], choices: [], words: [] };
const listeners = new Set<() => void>();
const set = (next: State) => {
  state = next;
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useStore(): State {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

const id = () => Math.random().toString(36).slice(2, 10);
const now = () => new Date().toISOString();
export const MAX_SONGS = 10;

export const actions = {
  addSong(facts: SongFacts, typed: string, person = "me"): string | null {
    const mine = state.songs.filter((s) => s.person_id === person);
    if (mine.length >= MAX_SONGS || mine.some((s) => s.recording_id === facts.recording_id)) return null;
    const entry: NamedSong = {
      entry_id: id(), person_id: person, typed_text: typed, recording_id: facts.recording_id,
      comes_back_for: "unanswered", found_me: "unanswered", entered_at: now(),
    };
    set({ ...state, songs: [...state.songs, entry], facts: { ...state.facts, [facts.recording_id]: facts } });
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
};

/** A person's songs with their facts, a disputed date applied. Kept in the order they were named. */
export function songsOf(s: State, person = "me"): Song[] {
  return s.songs
    .filter((e) => e.person_id === person)
    .map((entry) => {
      const f = s.facts[entry.recording_id]!;
      return { entry, facts: s.disputed.includes(f.recording_id) ? { ...f, date_disputed: true } : f };
    });
}

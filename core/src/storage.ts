/**
 * The stores in this browser (PRD section 4): IndexedDB, private to this site or this extension.
 * This step keeps D2 Recordings, D3 Credit Facts, D6 Offered Readings, D8 Settings, D9 Usage Events
 * (check A and the swap test only, until T8.1), D12 People, D13 Named Songs and D14 My Words.
 * Nothing here leaves the browser (rule 6).
 *
 * FR-T1.6: "Erase everything in this browser" clears every store and records last_erased_at in D8.
 */
import { keyName, parseKey } from "./design/key-colour";
import type { CreditRole, HistoryRow, KeyRow, NamedSong, NextRow, PlaceRole, PlayRow, SongFacts, Source } from "./model";
import type { Choice, Words } from "./note";

export const DB_NAME = "the-key";
const VERSION = 5; // 2: D11 Listening History; 3: D1 Plays; 4: D5 Keys; 5: D7 Next Records

export const STORES = {
  D1: "play_id",
  D2: "recording_id",
  D3: "fact_id",
  D5: "key_id",
  D6: ["person_id", "question_id"],
  D7: "suggestion_id",
  D8: "settings_id",
  D9: "event_id",
  D11: "history_id",
  D12: "person_id",
  D13: "entry_id",
  D14: "words_id",
} as const;
export type StoreName = keyof typeof STORES;

/** D2. */
export interface RecordingRow {
  recording_id: string;
  title: string;
  artist_credit: string;
  lead_artist_id: string;
  lead_artist: string;
  first_release_date?: string;
  date_source: Source;
  date_disputed: boolean;
  matched_by: "rule" | "my fix" | "my pick";
  credits_fetched_at: string;
}

/** D3. */
export interface FactRow {
  fact_id: string;
  recording_id: string;
  kind: "key" | "tempo_bpm" | "studio" | CreditRole;
  person_or_place?: string;
  role_detail?: string;
  value?: string;
  confidence?: number;
  source_label: string;
  source_url?: string;
  licence: "CC0" | "none (example data)";
  fetched_at: string;
}

/** D12. */
export interface Person {
  person_id: string;
  label: string;
  source: "named songs" | "spotify export" | "bilibili panel";
  /** Required for anyone but "me": the user's own words and the date. */
  consent_note?: string;
  loaded_at: string;
}

/** D9, the kinds this step logs. */
/** D9's kinds (PRD section 4), every one logged (FR-T8.1). */
export const EVENT_KINDS = [
  "song_started", "key_ready", "key_shown", "proof_opened", "story_shown", "made_opened", "next_shown", "next_search_opened",
  "uploader_opened", "line_dropped", "match_fixed", "song_named", "part_answered", "found_answered", "reading_chosen",
  "words_written", "note_opened", "history_loaded", "export_made", "check_a_answered", "swap_answered",
] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

/** D9 Usage Events: what happened, when, and what it points at. */
export interface UsageEvent {
  event_id: string;
  kind: EventKind;
  at: string;
  play_id?: string;
  key_id?: string;
  question_id?: string;
  entry_id?: string;
  /** Whose row it concerns (a line's owner, a history's person). */
  person_id?: string;
  /** Check A and the swap test: who answered, the answer, the line as it read. */
  judge_id?: string;
  value?: string;
  line_text?: string;
}

export interface Settings {
  settings_id: 1;
  installed_at?: string;
  last_erased_at?: string;
  /** FR-T3.4: how often Sancho's story has shown by itself, and on which local day last. */
  story_shown_count?: number;
  story_last_shown_on?: string;
}

export interface Snapshot {
  recordings: RecordingRow[];
  facts: FactRow[];
  choices: Choice[];
  settings: Settings[];
  events: UsageEvent[];
  people: Person[];
  songs: NamedSong[];
  words: Words[];
}

const SNAPSHOT_STORE: Record<keyof Snapshot, StoreName> = {
  recordings: "D2", facts: "D3", choices: "D6", settings: "D8", events: "D9", people: "D12", songs: "D13", words: "D14",
};

// ---- SongFacts ⇄ D2 + D3 --------------------------------------------------------------------------

const licenceOf = (s: Source): FactRow["licence"] => (s.url ? "CC0" : "none (example data)");

export function toRows(f: SongFacts, matched_by: RecordingRow["matched_by"], at: string): { recording: RecordingRow; facts: FactRow[] } {
  const id = f.recording_id;
  const facts: FactRow[] = [];
  if (f.key) {
    facts.push({ fact_id: `${id}:key`, recording_id: id, kind: "key", value: keyName(f.key), confidence: f.key.strength, source_label: f.key.source.label, source_url: f.key.source.url, licence: licenceOf(f.key.source), fetched_at: at });
  }
  if (f.bpm) {
    facts.push({ fact_id: `${id}:tempo`, recording_id: id, kind: "tempo_bpm", value: String(f.bpm.value), source_label: f.bpm.source.label, source_url: f.bpm.source.url, licence: licenceOf(f.bpm.source), fetched_at: at });
  }
  f.people.forEach((p, i) => {
    facts.push({ fact_id: `${id}:person:${i}`, recording_id: id, kind: p.role, person_or_place: p.name, ...(p.detail ? { role_detail: p.detail } : {}), source_label: p.source.label, source_url: p.source.url, licence: licenceOf(p.source), fetched_at: at });
  });
  (f.places ?? []).forEach((p, i) => {
    facts.push({ fact_id: `${id}:place:${i}`, recording_id: id, kind: "studio", person_or_place: p.name, role_detail: p.role, ...(p.date ? { value: p.date } : {}), source_label: p.source.label, source_url: p.source.url, licence: licenceOf(p.source), fetched_at: at });
  });
  return {
    recording: {
      recording_id: id, title: f.title, artist_credit: f.artist_credit, lead_artist_id: f.lead_artist_id, lead_artist: f.lead_artist,
      first_release_date: f.first_release_year !== undefined ? String(f.first_release_year) : undefined,
      date_source: f.date_source, date_disputed: f.date_disputed, matched_by, credits_fetched_at: at,
    },
    facts,
  };
}

const MAJOR = /^(.+) (major|minor)$/;
const PITCH_NAMES: Record<string, string> = { "B-flat": "Bb", "E-flat": "Eb", "A-flat": "Ab", "D-flat": "Db", "G-flat": "Gb", "C-sharp": "C#", "F-sharp": "F#", "G-sharp": "G#", "D-sharp": "D#", "A-sharp": "A#" };

export function fromRows(r: RecordingRow, facts: FactRow[]): SongFacts {
  const mine = facts.filter((x) => x.recording_id === r.recording_id);
  const src = (x: FactRow): Source => ({ label: x.source_label, ...(x.source_url ? { url: x.source_url } : {}) });
  const k = mine.find((x) => x.kind === "key");
  const m = k?.value ? MAJOR.exec(k.value) : null;
  const parsed = m ? parseKey(PITCH_NAMES[m[1]!] ?? m[1]!, m[2]!) : null;
  const t = mine.find((x) => x.kind === "tempo_bpm");
  return {
    recording_id: r.recording_id, title: r.title, artist_credit: r.artist_credit, lead_artist_id: r.lead_artist_id, lead_artist: r.lead_artist,
    first_release_year: r.first_release_date ? Number(r.first_release_date.slice(0, 4)) : undefined,
    date_source: r.date_source, date_disputed: r.date_disputed,
    key: parsed && k ? { ...parsed, strength: k.confidence ?? 0, source: src(k) } : undefined,
    bpm: t?.value ? { value: Number(t.value), source: src(t) } : undefined,
    people: mine
      .filter((x) => x.kind !== "key" && x.kind !== "tempo_bpm" && x.kind !== "studio" && x.person_or_place)
      .map((x) => ({ name: x.person_or_place!, role: x.kind as CreditRole, source: src(x), ...(x.role_detail ? { detail: x.role_detail } : {}) })),
    ...(mine.some((x) => x.kind === "studio")
      ? { places: mine.filter((x) => x.kind === "studio").map((x) => ({ name: x.person_or_place!, role: x.role_detail as PlaceRole, ...(x.value ? { date: x.value } : {}), source: src(x) })) }
      : {}),
  };
}

// ---- IndexedDB ---------------------------------------------------------------------------------------

const req = <T>(r: IDBRequest<T>) => new Promise<T>((ok, no) => { r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });
const done = (tx: IDBTransaction) => new Promise<void>((ok, no) => { tx.oncomplete = () => ok(); tx.onerror = () => no(tx.error); tx.onabort = () => no(tx.error); });

export function openDb(factory: IDBFactory = indexedDB): Promise<IDBDatabase> {
  const open = factory.open(DB_NAME, VERSION);
  open.onupgradeneeded = () => {
    for (const [name, keyPath] of Object.entries(STORES)) {
      if (!open.result.objectStoreNames.contains(name)) {
        const os = open.result.createObjectStore(name, { keyPath: keyPath as string | string[] });
        if (name === "D11") os.createIndex("person", "person_id");
      }
    }
  };
  return req(open);
}

// D11 is kept apart from the snapshot: a history is tens of thousands of rows, written once when a
// file is read and removed with its person or by the erase, never rewritten on every change.

/** Remove one person's rows inside a transaction, through the person index. */
async function clearPerson(os: IDBObjectStore, person_id: string): Promise<void> {
  const keys = await req(os.index("person").getAllKeys(person_id));
  for (const k of keys) os.delete(k);
}

/** Replace one person's listening history. */
export async function putHistory(db: IDBDatabase, person_id: string, rows: HistoryRow[]): Promise<void> {
  const tx = db.transaction("D11", "readwrite");
  const os = tx.objectStore("D11");
  await clearPerson(os, person_id);
  for (const r of rows) os.put(r);
  await done(tx);
}

export async function deleteHistory(db: IDBDatabase, person_id: string): Promise<void> {
  const tx = db.transaction("D11", "readwrite");
  await clearPerson(tx.objectStore("D11"), person_id);
  await done(tx);
}

/** Every history in this browser, by person, in time order. */
export async function loadHistories(db: IDBDatabase): Promise<Record<string, HistoryRow[]>> {
  const rows = (await req(db.transaction("D11").objectStore("D11").getAll())) as HistoryRow[];
  const out: Record<string, HistoryRow[]> = {};
  for (const r of rows) (out[r.person_id] ??= []).push(r);
  for (const k of Object.keys(out)) out[k]!.sort((a, b) => a.ended_at_utc.localeCompare(b.ended_at_utc));
  return out;
}

export async function loadAll(db: IDBDatabase): Promise<Snapshot> {
  const tx = db.transaction(Object.keys(STORES), "readonly");
  const out = {} as Record<keyof Snapshot, unknown[]>;
  await Promise.all(
    (Object.entries(SNAPSHOT_STORE) as [keyof Snapshot, StoreName][]).map(async ([k, s]) => {
      out[k] = await req(tx.objectStore(s).getAll());
    }),
  );
  return out as unknown as Snapshot;
}

/** Replace every store's rows with the snapshot's, in one transaction. */
export async function saveAll(db: IDBDatabase, snap: Snapshot): Promise<void> {
  const tx = db.transaction(Object.keys(STORES), "readwrite");
  for (const [k, s] of Object.entries(SNAPSHOT_STORE) as [keyof Snapshot, StoreName][]) {
    const os = tx.objectStore(s);
    os.clear();
    for (const row of snap[k] as object[]) os.put(row);
  }
  await done(tx);
}

/** FR-T1.6: clear every store in this browser, then record when. */
export async function eraseAll(db: IDBDatabase, at: string): Promise<void> {
  const names = [...db.objectStoreNames];
  const tx = db.transaction(names, "readwrite");
  for (const n of names) tx.objectStore(n).clear();
  tx.objectStore("D8").put({ settings_id: 1, last_erased_at: at } satisfies Settings);
  await done(tx);
}

// D1 is written one play at a time (its seconds heard change while the song plays).

export async function putPlay(db: IDBDatabase, row: PlayRow): Promise<void> {
  const tx = db.transaction("D1", "readwrite");
  tx.objectStore("D1").put(row);
  await done(tx);
}

export async function loadPlays(db: IDBDatabase): Promise<PlayRow[]> {
  const rows = (await req(db.transaction("D1").objectStore("D1").getAll())) as PlayRow[];
  return rows.sort((a, b) => a.started_at.localeCompare(b.started_at));
}

// D5 is written one line at a time (shown, its proof opened, dropped).

export async function putKey(db: IDBDatabase, row: KeyRow): Promise<void> {
  const tx = db.transaction("D5", "readwrite");
  tx.objectStore("D5").put(row);
  await done(tx);
}

export async function loadKeys(db: IDBDatabase): Promise<KeyRow[]> {
  const rows = (await req(db.transaction("D5").objectStore("D5").getAll())) as KeyRow[];
  return rows.sort((a, b) => a.shown_at.localeCompare(b.shown_at));
}

// D7 is written one suggestion at a time (shown, a link opened, a later play noticed).

export async function putNext(db: IDBDatabase, row: NextRow): Promise<void> {
  const tx = db.transaction("D7", "readwrite");
  tx.objectStore("D7").put(row);
  await done(tx);
}

export async function loadNexts(db: IDBDatabase): Promise<NextRow[]> {
  const rows = (await req(db.transaction("D7").objectStore("D7").getAll())) as NextRow[];
  return rows.sort((a, b) => a.shown_at.localeCompare(b.shown_at));
}

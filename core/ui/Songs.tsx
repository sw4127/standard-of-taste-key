"use client";
/**
 * The questions way in (moment map Q-0 to Q-5; T9.1–T9.5). Songs are found in MusicBrainz as the
 * person types (debounced; at most one call per 1.2 s), kept in the order they were named, and never
 * numbered, ordered or scored (rule 5). A second person's songs (for the swap test) are kept apart.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { FOUND, PARTS, type Found, type NamedSong, type Part, type SongFacts } from "../src/model";
import { linesAcross, MIN_SONGS_FOR_LINES } from "../src/patterns";
import { theirName } from "../src/firstwords";
import { noteAvailable } from "../src/note";
import { confirmSong } from "../src/sources/confirm";
import type { FetchFn } from "../src/sources/http";
import { searchSongs, type Candidate } from "../src/sources/musicbrainz";
import { edgeStyle, KeyChip } from "./KeyChip";
import { LineAcross } from "./LineAcross";
import { setJudgeSource } from "./judge-source";
import { Go } from "./nav";
import { actions, hydrate, MAX_SONGS, ME, others, songsOf, useStore } from "./store";

const fetchFn: FetchFn = (url) => fetch(url);
const DEBOUNCE_MS = 450;

function Choices<T extends string>({ legend, options, value, onPick }: { legend: string; options: readonly T[]; value: T | "unanswered"; onPick: (v: T | "unanswered") => void }) {
  return (
    <fieldset className="choices">
      <legend className="label">{legend}</legend>
      <div className="chip-row">
        {options.map((o) => (
          <button key={o} type="button" className="act act-button" aria-pressed={value === o} onClick={() => onPick(value === o ? "unanswered" : o)}>
            {o}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function SongEntry({ entry, facts, open, onToggle }: { entry: NamedSong; facts: SongFacts; open: boolean; onToggle: () => void }) {
  const answers = [entry.comes_back_for, entry.found_me].filter((a) => a !== "unanswered");
  return (
    <li className="card stack" style={edgeStyle(facts.key)}>
      <p className="meta">
        <span className="song-name">{facts.title}</span> · {facts.artist_credit} · {facts.first_release_year ?? "year not listed"}
      </p>
      <p className="chip-row">
        <KeyChip k={facts.key} />
        {facts.bpm && <span className="meta">{Math.round(facts.bpm.value)} BPM</span>}
      </p>
      {open ? (
        <>
          <Choices legend="What do you come back for?" options={PARTS} value={entry.comes_back_for} onPick={(v) => actions.answer(entry.entry_id, "comes_back_for", v as Part | "unanswered")} />
          <Choices legend="When did this song find you?" options={FOUND} value={entry.found_me} onPick={(v) => actions.answer(entry.entry_id, "found_me", v as Found | "unanswered")} />
          <p className="meta">Both are optional. Tap again to clear.</p>
        </>
      ) : (
        answers.length > 0 && <p className="record">{answers.length === 1 ? "Your answer" : "Your answers"}: {answers.join(" · ")}</p>
      )}
      <div className="row">
        <button type="button" className="act" aria-expanded={open} onClick={onToggle}>
          {open ? "Done" : "Answer the two questions"}
        </button>
        <button type="button" className="act" onClick={() => actions.removeSong(entry.entry_id)}>
          Remove
        </button>
      </div>
    </li>
  );
}

type Search = { state: "idle" } | { state: "looking" } | { state: "found"; results: Candidate[] } | { state: "failed" };

function SongSearch({ person, full, have, onAdded }: { person: string; full: boolean; have: Set<string>; onAdded: (entry_id: string) => void }) {
  const [text, setText] = useState("");
  const [search, setSearch] = useState<Search>({ state: "idle" });
  const [adding, setAdding] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    const q = text.trim();
    const mine = ++seq.current;
    if (q.length < 2) {
      setSearch({ state: "idle" });
      return;
    }
    setSearch({ state: "looking" });
    const t = setTimeout(() => {
      searchSongs(q, { fetchFn }).then(
        (results) => mine === seq.current && setSearch({ state: "found", results }),
        () => mine === seq.current && setSearch({ state: "failed" }),
      );
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [text]);

  const pick = async (c: Candidate) => {
    setAdding(c.key);
    setProblem(null);
    const r = await confirmSong(c, text, { fetchFn });
    setAdding(null);
    if ("error" in r) {
      setProblem(`${r.error}. Try the song again in a moment.`);
      return;
    }
    if (have.has(r.facts.recording_id)) {
      setProblem(`${c.title} is already on the list.`);
      return;
    }
    const added = actions.addSong(r.facts, text, person, r.matched_by);
    setText("");
    // A newly confirmed song opens its two questions.
    if (added) onAdded(added);
  };

  const results = search.state === "found" ? search.results : [];
  return (
    <div className="card stack">
      <label className="label" htmlFor="song-search">
        A song, and its artist if you know it
      </label>
      <input
        id="song-search"
        className="field"
        type="search"
        autoComplete="off"
        placeholder={full ? "Ten songs is the limit" : "For example: Dancing Queen ABBA"}
        disabled={full}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      {search.state === "looking" && <p className="meta" role="status">Looking in MusicBrainz…</p>}
      {search.state === "failed" && <p className="meta" role="status">Couldn't reach MusicBrainz. Try again in a moment.</p>}
      {search.state === "found" && results.length === 0 && (
        <p className="meta" role="status">MusicBrainz has no studio song matching “{text.trim()}”. Adding the artist&#39;s name can help.</p>
      )}
      {results.length > 0 && (
        <ul className="plain stack" aria-label="Songs found">
          {results.map((c) => (
            <li key={c.key}>
              <button type="button" className="act" disabled={adding !== null} onClick={() => pick(c)}>
                {c.title} · {c.artist_credit}
                {c.year ? ` · ${c.year}` : ""}
              </button>
              {adding === c.key && <span className="meta" role="status"> Finding its studio recording…</span>}
            </li>
          ))}
        </ul>
      )}
      {problem && <p className="meta" role="status">{problem}</p>}
    </div>
  );
}

function AddPerson({ onAdded }: { onAdded: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [consent, setConsent] = useState("");
  if (!open) {
    return (
      <button type="button" className="act" onClick={() => setOpen(true)}>
        Add someone else&#39;s songs
      </button>
    );
  }
  const ready = label.trim().length > 0 && consent.trim().length > 0;
  return (
    <form
      className="card stack"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) onAdded(actions.addPerson(label, consent));
      }}
    >
      <p className="record">Their songs and lines stay separate from yours and never appear on your note. They&#39;re used for the swap test: lines from both of you, mixed, to see if you can pick out your own.</p>
      <label className="label" htmlFor="person-label">What you call them</label>
      <input id="person-label" className="field" value={label} placeholder="my friend" onChange={(e) => setLabel(e.target.value)} />
      <label className="label" htmlFor="person-consent">Their agreement, in your words</label>
      <textarea id="person-consent" className="field words-box" value={consent} placeholder="They said I can keep their songs here." onChange={(e) => setConsent(e.target.value)} />
      <div className="row">
        <button type="submit" className="act" disabled={!ready}>
          Add them
        </button>
        <button type="button" className="act" onClick={() => setOpen(false)}>
          Not now
        </button>
      </div>
    </form>
  );
}

export function Songs() {
  const st = useStore();
  useEffect(() => void hydrate(), []);
  const [person, setPerson] = useState(ME);
  const songs = useMemo(() => songsOf(st, person), [st, person]);
  const [open, setOpen] = useState<string | null>(null);
  const [lineIndex, setLineIndex] = useState(0);
  const lines = useMemo(() => linesAcross(songs), [songs]);
  const line = lines[Math.min(lineIndex, lines.length - 1)];
  const full = songs.length >= MAX_SONGS;
  const people = others(st);
  const who = person === ME ? null : people.find((p) => p.person_id === person);

  if (!st.ready) return <p className="meta" role="status">Reading what this browser keeps…</p>;

  return (
    <section className="stack-lg">
      {people.length > 0 && (
        <div className="chip-row" role="group" aria-label="Whose songs">
          <button type="button" className="act act-button" aria-pressed={person === ME} onClick={() => setPerson(ME)}>
            Your songs
          </button>
          {people.map((p) => (
            <button key={p.person_id} type="button" className="act act-button" aria-pressed={person === p.person_id} onClick={() => setPerson(p.person_id)}>
              Songs {theirName(p.label)} named
            </button>
          ))}
        </div>
      )}
      <p className="line">{who ? `Songs ${theirName(who.label)} named. Any order. No ranking.` : "Name a few songs that come to mind. Any order. No ranking."}</p>

      <SongSearch person={person} full={full} have={new Set(songs.map((s) => s.facts.recording_id))} onAdded={setOpen} />

      {songs.length > 0 && (
        <ul className="plain" aria-label={who ? `Songs ${theirName(who.label)} named` : "Your songs"}>
          {songs.map((s) => (
            <SongEntry key={s.entry.entry_id} entry={s.entry} facts={s.facts} open={open === s.entry.entry_id} onToggle={() => setOpen(open === s.entry.entry_id ? null : s.entry.entry_id)} />
          ))}
        </ul>
      )}

      {songs.length > 0 && songs.length < MIN_SONGS_FOR_LINES && (
        <p className="record">
          {MIN_SONGS_FOR_LINES - songs.length === 1 ? "One more song" : "Two more songs"}, and lines across these songs can start.
        </p>
      )}

      {songs.length >= MIN_SONGS_FOR_LINES && !line && (
        <p className="record">No pattern across these songs is strong enough to show yet. Another song, or an answer to the two questions, may change that.</p>
      )}

      {line && (
        <LineAcross
          key={`${person}:${line.id}`}
          line={line}
          person={person}
          onNext={lines.length > 1 ? () => setLineIndex((i) => (i + 1) % lines.length) : undefined}
          nextLabel={lineIndex + 1 >= lines.length ? "Back to the first line" : "Next line"}
        />
      )}
      {lines.length > 1 && <p className="meta">Line {Math.min(lineIndex, lines.length - 1) + 1} of {lines.length} across these songs.</p>}

      <div className="row">
        {person === ME && noteAvailable(st.choices, st.words, ME) && <Go to="note">Your taste in words, so far</Go>}
        {lines.length > 0 && <Go to="judge" onGo={() => setJudgeSource("named songs")}>Judge these lines</Go>}
      </div>
      {person === ME && <AddPerson onAdded={setPerson} />}
    </section>
  );
}

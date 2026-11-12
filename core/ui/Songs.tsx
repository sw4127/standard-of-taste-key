"use client";
/**
 * The questions way in (moment map Q-0 to Q-5; T9.1–T9.5). Songs are found in MusicBrainz as the
 * person types (debounced; at most one call per 1.2 s), kept in the order they were named, and never
 * numbered, ordered or scored (rule 5). A second person's songs (for the swap test) are kept apart.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { ALBUM_PARTS, isAlbum, PARTS, type AlbumPart, type NamedSong, type Part, type SongFacts } from "../src/model";
import { albumFacts, searchAlbums, type AlbumCandidate } from "../src/sources/albums";
import { BirthYear, FoundBar, SeveralAtOnce } from "./Naming";
import { isSoundLine, linesAcross, MIN_SONGS_FOR_LINES } from "../src/patterns";
import { Hear } from "./Hear";
import { theirName } from "../src/firstwords";
import { noteAvailable } from "../src/note";
import { confirmSong } from "../src/sources/confirm";
import type { FetchFn } from "../src/sources/http";
import { searchSongs, type Candidate } from "../src/sources/musicbrainz";
import { edgeClass, edgeStyle, KeyChip } from "./KeyChip";
import { LineAcross } from "./LineAcross";
import { RecordWords } from "./RecordWords";
import { setJudgeSource } from "./judge-source";
import { Go } from "./nav";
import { actions, hydrate, MAX_SONGS, ME, others, songsOf, useStore } from "./store";

const fetchFn: FetchFn = (url) => fetch(url);
const DEBOUNCE_MS = 450;

/** After a song is added, the box empties, unless a next song was typed while the last was being found. */
export const afterAdding = (now: string, typed: string) => (now === typed ? "" : now);

function Choices<T extends string>({ legend, options, value, onPick }: { legend: string; options: readonly T[]; value: T | "unanswered"; onPick: (v: T | "unanswered") => void }) {
  return (
    <fieldset className="choices">
      <legend className="label">{legend}</legend>
      <div className="chip-row">
        {options.map((o) => (
          <button key={o} type="button" className="act choice" aria-pressed={value === o} onClick={() => onPick(value === o ? "unanswered" : o)}>
            {o}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function SongEntry({ entry, facts, open, onToggle }: { entry: NamedSong; facts: SongFacts; open: boolean; onToggle: () => void }) {
  const album = isAlbum(entry);
  const found = entry.found_me === "longer ago" && entry.found_year ? `longer ago, about ${entry.found_year}` : entry.found_me;
  const answers = [entry.comes_back_for, found].filter((a) => a !== "unanswered");
  return (
    <li className={`card stack${album ? "" : edgeClass(facts.key)}`} style={album ? {} : edgeStyle(facts.key)}>
      <p className="meta">
        <span className="song-name">{facts.title}</span> · {facts.artist_credit} · {facts.first_release_year ?? "year not listed"}
        {album ? " · album" : ""}
      </p>
      {!album && (
        <p className="chip-row">
          <KeyChip k={facts.key} />
          {facts.bpm && <span className="meta">{Math.round(facts.bpm.value)} BPM</span>}
        </p>
      )}
      {!album && (facts.bpm || facts.key) && <Hear bpm={facts.bpm?.value} k={facts.key && facts.key.strength >= 0.5 ? facts.key : null} />}
      {open ? (
        <>
          {album ? (
            <Choices legend="What do you come back for?" options={ALBUM_PARTS} value={entry.comes_back_for as AlbumPart | "unanswered"} onPick={(v) => actions.answer(entry.entry_id, "comes_back_for", v as AlbumPart | "unanswered")} />
          ) : (
            <Choices legend="What do you come back for?" options={PARTS} value={entry.comes_back_for as Part | "unanswered"} onPick={(v) => actions.answer(entry.entry_id, "comes_back_for", v as Part | "unanswered")} />
          )}
          <FoundBar entry={entry} noun={album ? "album" : "song"} />
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

type Search = { state: "idle" } | { state: "looking" } | { state: "found"; results: Candidate[]; albums: AlbumCandidate[] } | { state: "failed" };

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
      // FR-T9.1: songs and albums, one search after the other (one call per 1.2 s to MusicBrainz).
      searchSongs(q, { fetchFn })
        .then(async (results) => [results, await searchAlbums(q, { fetchFn }).catch(() => [] as AlbumCandidate[])] as const)
        .then(
          ([results, albums]) => mine === seq.current && setSearch({ state: "found", results, albums }),
          () => mine === seq.current && setSearch({ state: "failed" }),
        );
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [text]);

  const pick = async (c: Candidate) => {
    const typed = text;
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
    const added = actions.addSong(r.facts, typed, person, r.matched_by);
    // Finding the studio recording can take seconds; a next song typed meanwhile is kept.
    setText((now) => afterAdding(now, typed));
    // A newly confirmed song opens its two questions.
    if (added) onAdded(added);
  };

  const pickAlbum = (a: AlbumCandidate) => {
    setProblem(null);
    const facts = albumFacts(a);
    if (have.has(facts.recording_id)) {
      setProblem(`${a.title} is already on the list.`);
      return;
    }
    const added = actions.addSong(facts, text, person, "my pick");
    setText("");
    if (added) onAdded(added);
  };

  const results = search.state === "found" ? search.results : [];
  const albums = search.state === "found" ? search.albums : [];
  return (
    <div className="card stack">
      <label className="label" htmlFor="song-search">
        A song or an album, and its artist if you know it
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
      {search.state === "found" && results.length === 0 && albums.length === 0 && (
        <p className="meta" role="status">MusicBrainz has no studio song or album matching “{text.trim()}”. Adding the artist&#39;s name can help.</p>
      )}
      {(results.length > 0 || albums.length > 0) && (
        <ul className="plain stack" aria-label="Songs and albums found">
          {albums.map((a) => (
            <li key={a.key}>
              <button type="button" className="act" disabled={adding !== null} onClick={() => pickAlbum(a)}>
                album: {a.title} · {a.artist_credit}
                {a.year ? ` · ${a.year}` : ""}
              </button>
            </li>
          ))}
          {results.map((c) => (
            <li key={c.key}>
              <button type="button" className="act" disabled={adding !== null} onClick={() => pick(c)}>
                song: {c.title} · {c.artist_credit}
                {c.year ? ` · ${c.year}` : ""}
              </button>
              {adding === c.key && <span className="meta" role="status"> Finding its studio recording…</span>}
            </li>
          ))}
        </ul>
      )}
      {problem && <p className="meta" role="status">{problem}</p>}
      {!full && <SeveralAtOnce person={person} room={MAX_SONGS - have.size} />}
    </div>
  );
}

function AddPerson({ onAdded }: { onAdded: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [consent, setConsent] = useState("");
  if (!open) {
    return (
      <div className="card slim">
        <button type="button" className="act" onClick={() => setOpen(true)}>
          Add someone else&#39;s songs
        </button>
      </div>
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
  const [more, setMore] = useState(false);
  const [inSound, setInSound] = useState(false);
  const all = useMemo(() => linesAcross(songs, new Date(), { birthYear: person === ME ? st.birth_year : undefined }), [songs, st.birth_year, person]);
  // FR-T9.3 (e): one line first, "N more" opens the rest; (c) key and tempo sit behind their own tap.
  const lines = all.filter((l) => !isSoundLine(l));
  const sound = all.filter((l) => isSoundLine(l));
  const line = lines[0];
  const full = songs.length >= MAX_SONGS;
  const people = others(st);
  const who = person === ME ? null : people.find((p) => p.person_id === person);

  if (!st.ready) return <p className="card meta" role="status">Reading what this browser keeps…</p>;

  return (
    <section className="stack-lg">
      <div className="card stack">
      {people.length > 0 && (
        <div className="chip-row" role="group" aria-label="Whose songs">
          <button type="button" className="act choice" aria-pressed={person === ME} onClick={() => setPerson(ME)}>
            Your songs
          </button>
          {people.map((p) => (
            <button key={p.person_id} type="button" className="act choice" aria-pressed={person === p.person_id} onClick={() => setPerson(p.person_id)}>
              Songs {theirName(p.label)} named
            </button>
          ))}
        </div>
      )}
      <p className="line">{who ? `Songs and albums ${theirName(who.label)} named. Any order. No ranking.` : "Name a few songs or albums that come to mind. Any order. No ranking."}</p>
      {!who && <p className="record">Any songs or albums that come to mind will do. They need not be your best.</p>}
      </div>

      <SongSearch person={person} full={full} have={new Set(songs.map((s) => s.facts.recording_id))} onAdded={setOpen} />

      {songs.length > 0 && (
        <ul className="plain" aria-label={who ? `Songs ${theirName(who.label)} named` : "Your songs"}>
          {songs.map((s) => (
            <SongEntry key={s.entry.entry_id} entry={s.entry} facts={s.facts} open={open === s.entry.entry_id} onToggle={() => setOpen(open === s.entry.entry_id ? null : s.entry.entry_id)} />
          ))}
        </ul>
      )}

      {songs.length > 0 && songs.length < MIN_SONGS_FOR_LINES && (
        <p className="card record">
          {MIN_SONGS_FOR_LINES - songs.length === 1 ? "One more song" : "Two more songs"}, and lines across these songs can start.
        </p>
      )}

      {songs.length >= MIN_SONGS_FOR_LINES && !line && !sound.length && (
        <p className="card record">No pattern across these songs is strong enough to show yet. Another song, or an answer to the two questions, may change that.</p>
      )}

      {line && <LineAcross key={`${person}:${line.id}`} line={line} person={person} />}
      {lines.length > 1 && !more && (
        <div className="card slim">
          <button type="button" className="act" onClick={() => setMore(true)}>
            {lines.length - 1} more
          </button>
        </div>
      )}
      {more && lines.slice(1).map((l) => <LineAcross key={`${person}:${l.id}`} line={l} person={person} />)}
      {sound.length > 0 && (
        <div className="card slim">
          <button type="button" className="act" aria-expanded={inSound} onClick={() => setInSound((x) => !x)}>
            {inSound ? "Hide the patterns in sound" : "More patterns, in sound"}
          </button>
        </div>
      )}
      {inSound && sound.map((l) => <LineAcross key={`${person}:${l.id}`} line={l} person={person} />)}
      {person === ME && <RecordWords songs={songs} />}

      {((person === ME && noteAvailable(st.choices, st.words, ME, st.readings)) || all.length > 0) && (
        <div className="card row">
          {person === ME && noteAvailable(st.choices, st.words, ME, st.readings) && <Go to="note">Your taste in words, so far</Go>}
          {all.length > 0 && <Go to="judge" onGo={() => setJudgeSource("named songs")}>Judge these lines</Go>}
        </div>
      )}
      {person === ME && <BirthYear value={st.birth_year} />}
      {person === ME && <AddPerson onAdded={setPerson} />}
    </section>
  );
}

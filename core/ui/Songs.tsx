"use client";
/**
 * The questions way in (moment map Q-0 to Q-5; T9.1–T9.5). Songs are kept in the order they were
 * named and never numbered, ordered or scored (rule 5). In this build the search runs over the
 * example catalogue only.
 */
import { useMemo, useState } from "react";
import { searchExamples } from "../src/examples";
import { FOUND, PARTS, type Found, type NamedSong, type Part, type SongFacts } from "../src/model";
import { linesAcross, MIN_SONGS_FOR_LINES } from "../src/patterns";
import { noteAvailable } from "../src/note";
import { edgeStyle, KeyChip } from "./KeyChip";
import { LineAcross } from "./LineAcross";
import { ExampleLabel, Go } from "./nav";
import { actions, MAX_SONGS, songsOf, useStore } from "./store";

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
        <span className="song-name">{facts.title}</span> · {facts.artist_credit} · {facts.first_release_year ?? "year unknown"}
      </p>
      {open ? (
        <>
          <Choices legend="What do you come back for?" options={PARTS} value={entry.comes_back_for} onPick={(v) => actions.answer(entry.entry_id, "comes_back_for", v as Part | "unanswered")} />
          <Choices legend="When did this song find you?" options={FOUND} value={entry.found_me} onPick={(v) => actions.answer(entry.entry_id, "found_me", v as Found | "unanswered")} />
          <p className="meta">Both are optional. Tap again to clear.</p>
        </>
      ) : (
        answers.length > 0 && <p className="record">Your answer: {answers.join(" · ")}</p>
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

export function Songs({ person = "me" }: { person?: string }) {
  const st = useStore();
  const songs = useMemo(() => songsOf(st, person), [st, person]);
  const [text, setText] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [lineIndex, setLineIndex] = useState(0);
  const results = useMemo(() => searchExamples(text).filter((f) => !songs.some((s) => s.facts.recording_id === f.recording_id)), [text, songs]);
  const lines = useMemo(() => linesAcross(songs), [songs]);
  const line = lines[Math.min(lineIndex, lines.length - 1)];
  const full = songs.length >= MAX_SONGS;

  return (
    <section className="stack-lg">
      <ExampleLabel>Every song and artist you can find here is made up.</ExampleLabel>
      <p className="line">Name a few songs that come to mind. Any order. No ranking.</p>

      <div className="card stack">
        <label className="label" htmlFor="song-search">
          A song or an artist
        </label>
        <input
          id="song-search"
          className="field"
          type="search"
          autoComplete="off"
          placeholder={full ? "Ten songs is the most" : "Try “harbour”, “lantern” or “rain”"}
          disabled={full}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        {results.length > 0 && (
          <ul className="plain stack" aria-label="Songs found">
            {results.map((f) => (
              <li key={f.recording_id}>
                <button
                  type="button"
                  className="act"
                  onClick={() => {
                    const id = actions.addSong(f, text, person);
                    setText("");
                    setOpen(id);
                  }}
                >
                  {f.title} · {f.artist_credit} · {f.first_release_year}
                </button>
              </li>
            ))}
          </ul>
        )}
        {text.trim() && results.length === 0 && <p className="meta">No example song matches “{text.trim()}”.</p>}
      </div>

      {songs.length > 0 && (
        <ul className="plain" aria-label="Your songs">
          {songs.map((s) => (
            <SongEntry key={s.entry.entry_id} entry={s.entry} facts={s.facts} open={open === s.entry.entry_id} onToggle={() => setOpen(open === s.entry.entry_id ? null : s.entry.entry_id)} />
          ))}
        </ul>
      )}

      {songs.length > 0 && songs.length < MIN_SONGS_FOR_LINES && (
        <p className="record">
          {MIN_SONGS_FOR_LINES - songs.length === 1 ? "One more song" : "Two more songs"}, and lines across your songs can start.
        </p>
      )}

      {songs.length >= MIN_SONGS_FOR_LINES && !line && (
        <p className="record">No pattern across these songs is strong enough to show yet. Another song, or an answer to the two questions, may change that.</p>
      )}

      {line && (
        <LineAcross
          key={line.id}
          line={line}
          person={person}
          onNext={lines.length > 1 ? () => setLineIndex((i) => (i + 1) % lines.length) : undefined}
          nextLabel={lineIndex + 1 >= lines.length ? "Back to the first line" : "Next line"}
        />
      )}
      {lines.length > 1 && <p className="meta">Line {Math.min(lineIndex, lines.length - 1) + 1} of {lines.length} across these songs.</p>}

      {noteAvailable(st.choices, st.words, person) && (
        <p className="record">
          <Go to="note">Your taste in words, so far</Go>
        </p>
      )}
    </section>
  );
}

"use client";
/**
 * My taste note (moment map Q-5; T9.5): a calling card assembled only from readings the person kept
 * and their own words. Front: heading, the three most recent kept readings, the swatch row. Turn it
 * over for every kept reading and answer, with dates and receipts.
 */
import { useEffect, useState } from "react";
import { passes } from "../src/checks";
import { keyVars, keyName } from "../src/design/key-colour";
import { assembleNote, noteAvailable } from "../src/note";
import { ExampleLabel, Go, SourceRef } from "./nav";
import { actions, hydrate, songsOf, useStore } from "./store";

export function TasteNote({ person = "me" }: { person?: string }) {
  const st = useStore();
  useEffect(() => void hydrate(), []);
  useEffect(() => {
    if (st.ready && noteAvailable(st.choices, st.words, person, st.readings)) actions.log("note_opened", { person_id: person });
  }, [st.ready]); // eslint-disable-line react-hooks/exhaustive-deps
  const [back, setBack] = useState(false);
  const [receipt, setReceipt] = useState<string | null>(null);
  const songs = songsOf(st, person);
  const measured = songs.filter((s) => s.facts.key && s.facts.key.strength >= 0.5);
  const note = assembleNote(st.choices, st.words, measured.map((s) => s.facts.key!), person, st.readings);
  const example = songs.some((s) => s.facts.recording_id.startsWith("example-"));
  // FR-T9.4: the person's words pass FR-CORE-2 before they are shown again on the note; words that
  // do not are kept, unchanged, and shown only here on the back, labelled.
  const own = note.own.filter((w) => passes(w.text, "words"));
  const keptAside = note.own.filter((w) => !passes(w.text, "words"));

  if (!st.ready) return <p className="card meta" role="status">Reading what this browser keeps…</p>;

  if (!noteAvailable(st.choices, st.words, person, st.readings)) {
    return (
      <section className="stack-lg">
        <div className="card stack">
          <p className="record">Your note starts once you keep two readings, or one reading and an answer in your own words.</p>
          <Go to="songs">Name a few songs that come to mind</Go>
        </div>
      </section>
    );
  }

  return (
    <section className="stack-lg">
      {example && <ExampleLabel>Built from made-up songs; the readings and words are yours.</ExampleLabel>}
      {!back ? (
        <article className="card note-front">
          <p className="label">Your taste in words, so far</p>
          <ul className="plain note-lines">
            {note.front.map((s) => (
              <li key={JSON.stringify(s.from)}>
                {s.label && <span className="label">{s.label}: </span>}
                <span className="voice">{s.text}</span> <span className="meta">{s.date}</span>
              </li>
            ))}
          </ul>
          <div className="swatches" aria-label={`Keys of your measured songs: ${measured.map((s) => keyName(s.facts.key!)).join(", ") || "none measured"}`}>
            {measured.map((s) => (
              <span key={s.entry.entry_id} className="swatch" title={`${s.facts.title}: ${keyName(s.facts.key!)}`} style={keyVars(s.facts.key!)} />
            ))}
          </div>
        </article>
      ) : (
        <article className="card note-back stack">
          <p className="label">Every reading you kept</p>
          <ul className="plain stack">
            {note.readings.map((s) => {
              const id = JSON.stringify(s.from);
              return (
                <li key={id} className="stack">
                  <p className="record">{s.pattern}</p>
                  <p className="voice">{s.text}</p>
                  <p className="meta">
                    {s.date} ·{" "}
                    <button type="button" className="act" aria-expanded={receipt === id} onClick={() => setReceipt(receipt === id ? null : id)}>
                      {receipt === id ? "Hide the evidence" : "See the evidence"}
                    </button>
                  </p>
                  {receipt === id && (
                    <ul className="plain">
                      {s.evidence!.map((e, i) => (
                        <li key={i} className="meta">
                          {e.text} · <SourceRef source={e.source} />
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
          {note.accepted.length > 0 && (
            <>
              <hr className="rule" />
              <p className="label">A reading you accepted</p>
              <ul className="plain stack">
                {note.accepted.map((s) => (
                  <li key={JSON.stringify(s.from)} className="stack">
                    <p className="voice">{s.text}</p>
                    {s.quotes!.length > 0 && <p className="meta">Your words: {s.quotes!.map((q) => `“${q}”`).join(" ")}</p>}
                    <p className="meta">{s.date}</p>
                  </li>
                ))}
              </ul>
            </>
          )}
          {own.length > 0 && (
            <>
              <hr className="rule" />
              <p className="label">In your words</p>
              <ul className="plain stack">
                {own.map((w) => (
                  <li key={JSON.stringify(w.from)} className="stack">
                    <p className="meta">{w.label ? `${w.label}, in place of the guess: ` : ""}{w.pattern}</p>
                    <p className="own">{w.text}</p>
                    <p className="meta">{w.date}</p>
                  </li>
                ))}
              </ul>
            </>
          )}
          {keptAside.length > 0 && (
            <>
              <hr className="rule" />
              <p className="label">Your words, kept but left off the note</p>
              <p className="meta">These words are kept off the front of the note. They stay here, unchanged, and nowhere else.</p>
              <ul className="plain stack">
                {keptAside.map((w) => (
                  <li key={JSON.stringify(w.from)} className="stack">
                    <p className="meta">{w.pattern}</p>
                    <p className="own">{w.text}</p>
                    <p className="meta">{w.date}</p>
                  </li>
                ))}
              </ul>
            </>
          )}
        </article>
      )}
      <div className="card slim">
        <button type="button" className="act" onClick={() => setBack((b) => !b)}>
          {back ? "Turn to the front" : "Turn over"}
        </button>
      </div>
    </section>
  );
}

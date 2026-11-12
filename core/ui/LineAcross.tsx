"use client";
/**
 * One line across songs, in three layers (FR-T9.3): the pattern; its evidence behind a tap; what it
 * might say, as two readings plus Neither. After a reading is picked (never after Neither), one
 * optional question to think with (FR-T9.4), answered "In your words".
 */
import { useId, useState } from "react";
import { CANT_SAY_UNUSUAL, isSoundLine, restsOnSentence, type PatternLine } from "../src/patterns";
import { Hear } from "./Hear";
import { actions, useStore } from "./store";
import { SourceRef } from "./nav";

const short = (citation: string) => citation.split(":")[0]!;

export function LineAcross({ line, person = "me", onNext, nextLabel }: { line: PatternLine; person?: string; onNext?: () => void; nextLabel?: string }) {
  const st = useStore();
  const songs = st.songs.filter((e) => line.entry_ids.includes(e.entry_id)).map((entry) => ({ entry, facts: st.facts[entry.recording_id]! })).filter((x) => x.facts);
  const [evidence, setEvidence] = useState(false);
  const choice = st.choices.find((c) => c.question_id === line.id && c.person_id === person);
  const saved = st.words.find((w) => w.about === line.id && w.person_id === person);
  const [draft, setDraft] = useState(saved?.text ?? "");
  const [inNote, setInNote] = useState(saved?.in_note ?? true);
  const ids = useId();

  const pick = (c: "first" | "second" | "neither") =>
    actions.choose({
      question_id: line.id, person_id: person, source: "named songs", pattern_kind: line.kind,
      pattern_text: line.pattern, evidence: line.evidence,
      readings_offered: [line.readings[0].template_id, line.readings[1].template_id],
      readings_kept: [line.readings[0].kept, line.readings[1].kept], choice: c,
    });

  return (
    <article className="card stack">
      <p className="label">A line across your records</p>
      <p className="line line-arrives">{line.pattern}</p>
      <p className="meta">{restsOnSentence(line.restsOn, line.entry_ids, songs)}</p>
      {line.gloss && <p className="record">{line.gloss}</p>}
      {isSoundLine(line) && (
        <>
          <p className="record">{CANT_SAY_UNUSUAL}</p>
          <Hear bpm={line.sound?.bpm} k={line.sound?.key} />
        </>
      )}

      <button type="button" className="act" aria-expanded={evidence} aria-controls={`${ids}-ev`} onClick={() => setEvidence((o) => !o)}>
        {evidence ? "Hide the evidence" : "See the evidence"}
      </button>
      {evidence && (
        <div id={`${ids}-ev`} className="evidence stack">
          <ul className="plain">
            {line.evidence.map((e, i) => (
              <li key={i} className="record">
                {e.text} <span className="meta">· <SourceRef source={e.source} /></span>
                {e.date_of && (
                  <>
                    {" "}
                    <button type="button" className="act" onClick={() => actions.disputeDate(e.date_of!)}>
                      That date is wrong
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
          {line.chance && !isSoundLine(line) && <p className="record">How often by chance: {line.chance}</p>}
        </div>
      )}

      <hr className="rule" />
      <p className="label">What it might say</p>
      {line.prompt && <p className="voice">{line.prompt}</p>}
      <div className="readings stack">
        {line.readings.map((r, i) => (
          <button
            key={r.template_id}
            type="button"
            className="act choice reading"
            aria-pressed={choice?.choice === (i === 0 ? "first" : "second")}
            onClick={() => pick(i === 0 ? "first" : "second")}
          >
            {r.answer ?? r.ask}
          </button>
        ))}
        <button type="button" className="act choice" aria-pressed={choice?.choice === "neither"} onClick={() => pick("neither")}>
          Neither
        </button>
      </div>
      <p className="meta">
        {line.prompt ? "The finding is from" : "Both readings draw on"}: <SourceRef source={{ label: short(line.readings[0].grounding.citation), url: line.readings[0].grounding.url }} />
      </p>

      {choice && choice.choice !== "neither" && (
        <div className="stack think">
          <hr className="rule" />
          <p className="label">A question to think with, if you like</p>
          <p className="voice">{line.question}</p>
          <label className="label" htmlFor={`${ids}-w`}>
            In your words
          </label>
          <textarea id={`${ids}-w`} className="own words-box" rows={3} value={draft} onChange={(e) => setDraft(e.target.value)} />
          <label className="meta check">
            <input type="checkbox" checked={inNote} onChange={(e) => setInNote(e.target.checked)} /> Keep this on my taste note
          </label>
          <button
            type="button"
            className="act choice"
            disabled={!draft.trim()}
            onClick={() => actions.write({ person_id: person, question: line.question, about: line.id, text: draft, in_note: inNote })}
          >
            {saved && saved.text === draft && saved.in_note === inNote ? "Kept" : "Keep my words"}
          </button>
        </div>
      )}

      {choice && onNext && (
        <button type="button" className="act" onClick={onNext}>
          {nextLabel ?? "Next line"}
        </button>
      )}
    </article>
  );
}

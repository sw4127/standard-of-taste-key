"use client";
/**
 * "In your words" about each record (FR-T9.4, changed 2026-11-10). It sits after the lines and is
 * optional. The prompt asks when and where a record came into his life and what his days looked like,
 * never why. The box has the browser's spelling check on. With a key connected (FR-T9.9), "Does this
 * read clearly?" sends that one answer, after the notice, and marks up to three spots as unclear, each
 * with a one-line reason; it never rewrites, and nothing changes unless he types. Without a key the
 * control is absent. An answer is stored in D14 about its record (entry_id), unchanged.
 */
import { useState } from "react";
import { passes } from "../src/checks";
import { MODEL_NAME } from "../src/reading/constants";
import { checkWording, type FetchLike, type Spot } from "../src/reading/call";
import { answerAbout } from "../src/reading/facts";
import { squash } from "../src/reading/check";
import { localDay } from "../src/note";
import type { Song } from "../src/model";
import { Go } from "./nav";
import { actions, ME, savedKey, useStore } from "./store";

export const recordPrompt = (title: string) => `When and where did “${title}” come into your life, and what did your days look like then?`;
export const CLARITY_NOTICE = `This sends this one answer to Anthropic's ${MODEL_NAME}, with your own API key. It goes to nobody else, and nothing else is sent. It costs a small fraction of a cent.`;
export const CLARITY_REFUSED = "No marks this time. Nothing was shown because a check failed.";

/** His answer with the unclear spots marked, in order; the text itself is never changed. */
function Marked({ text, spots }: { text: string; spots: Spot[] }) {
  const t = squash(text);
  const at = spots.map((s, i) => ({ i, from: t.indexOf(squash(s.text)), len: squash(s.text).length })).filter((x) => x.from >= 0).sort((a, b) => a.from - b.from);
  const parts: React.ReactNode[] = [];
  let pos = 0;
  for (const x of at) {
    if (x.from < pos) continue;
    parts.push(t.slice(pos, x.from), <mark key={x.i}>{t.slice(x.from, x.from + x.len)}<sup>{x.i + 1}</sup></mark>);
    pos = x.from + x.len;
  }
  parts.push(t.slice(pos));
  return <p className="own">{parts}</p>;
}

type Clarity = { at: "idle" } | { at: "notice" } | { at: "sending" } | { at: "marked"; spots: Spot[]; text: string } | { at: "refused" } | { at: "failed"; sentence: string };

function OneRecord({ song, fetchFn }: { song: Song; fetchFn?: FetchLike }) {
  const st = useStore();
  const saved = answerAbout(song.entry.entry_id, st.words, ME);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(saved?.text ?? "");
  const [inNote, setInNote] = useState(saved?.in_note ?? true);
  const [clarity, setClarity] = useState<Clarity>({ at: "idle" });
  const question = recordPrompt(song.facts.title);
  const box = `words-${song.entry.entry_id}`;

  const check = async () => {
    setClarity({ at: "sending" });
    const key = await savedKey();
    if (!key || !saved) return setClarity({ at: "failed", sentence: "No key is saved in this browser." });
    const r = await checkWording(key, saved.text, (reason) => passes(reason, "fact"), fetchFn);
    actions.wordingChecked();
    setClarity(r.status === "checked" ? { at: "marked", spots: r.spots, text: saved.text } : r.status === "refused" ? { at: "refused" } : { at: "failed", sentence: r.sentence });
  };

  return (
    <li className="stack">
      <p className="meta">
        <span className="song-name">{song.facts.title}</span> · {song.facts.artist_credit}
        {saved ? ` · you wrote about it on ${localDay(saved.written_at)}` : ""}
      </p>
      <button type="button" className="act" aria-expanded={open} aria-controls={box} onClick={() => setOpen((o) => !o)}>
        {open ? "Close" : saved ? "Read or change your words" : "Write about it"}
      </button>
      {open && (
        <div id={box} className="stack">
          <label className="voice" htmlFor={`${box}-t`}>
            {question}
          </label>
          <textarea id={`${box}-t`} className="own words-box" rows={4} spellCheck value={draft} onChange={(e) => setDraft(e.target.value)} />
          <label className="meta check">
            <input type="checkbox" checked={inNote} onChange={(e) => setInNote(e.target.checked)} /> Keep this on my taste note
          </label>
          <div className="row">
            <button
              type="button"
              className="act choice"
              disabled={!draft.trim()}
              onClick={() => {
                actions.write({ person_id: ME, question, about: song.entry.entry_id, text: draft, in_note: inNote });
                setClarity({ at: "idle" });
              }}
            >
              {saved && saved.text === draft && saved.in_note === inNote ? "Kept" : "Keep my words"}
            </button>
            {st.connection && saved && saved.text === draft && clarity.at === "idle" && (
              <button type="button" className="act" onClick={() => setClarity({ at: "notice" })}>
                Does this read clearly?
              </button>
            )}
          </div>
          {clarity.at === "notice" && (
            <div className="stack">
              <p className="meta">{CLARITY_NOTICE}</p>
              <div className="row">
                <button type="button" className="act" onClick={() => void check()}>
                  Send this answer
                </button>
                <button type="button" className="act" onClick={() => setClarity({ at: "idle" })}>
                  Not now
                </button>
              </div>
            </div>
          )}
          {clarity.at === "sending" && (
            <p className="meta" role="status">
              Checking your wording…
            </p>
          )}
          {clarity.at === "marked" && (
            <div className="evidence stack">
              {clarity.spots.length === 0 ? (
                <p className="record">No spot was marked as unclear.</p>
              ) : (
                <>
                  <Marked text={clarity.text} spots={clarity.spots} />
                  <ol className="stack">
                    {clarity.spots.map((s, i) => (
                      <li key={i} className="record">
                        {s.reason}
                      </li>
                    ))}
                  </ol>
                </>
              )}
              <p className="meta">Nothing in your words is changed unless you type.</p>
            </div>
          )}
          {clarity.at === "refused" && <p className="record">{CLARITY_REFUSED}</p>}
          {clarity.at === "failed" && <p className="record">{clarity.sentence}</p>}
        </div>
      )}
    </li>
  );
}

export function RecordWords({ songs, fetchFn }: { songs: Song[]; fetchFn?: FetchLike }) {
  const st = useStore();
  if (!songs.length) return null;
  const written = songs.filter((s) => answerAbout(s.entry.entry_id, st.words, ME)).length;
  return (
    <section className="card stack" aria-label="In your words">
      <p className="label">In your words, if you like</p>
      <p className="record">You can write about any record you named: when and where it came into your life, and what your days looked like then. All of it is optional.</p>
      <ul className="plain stack">
        {songs.map((s) => (
          <OneRecord key={s.entry.entry_id} song={s} fetchFn={fetchFn} />
        ))}
      </ul>
      {written >= 2 && <Go to="reading">A reading of your words</Go>}
    </section>
  );
}

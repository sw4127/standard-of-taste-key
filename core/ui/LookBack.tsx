"use client";
/**
 * The look back (moment map L-0 to L-4; T5.7). A Spotify export is read in this browser (src/spotify.ts),
 * never uploaded. "Whose file is this?" comes before any line; someone else's file needs their
 * agreement in the user's own words. The plays are kept in this browser (D11) until removed or erased.
 */
import { useContext, useEffect, useMemo, useState } from "react";
import { exampleHistory } from "../src/examples";
import { defaultStretch, lookBack, quarterLabel, quarters, summary, type LookBackLine, type Quarter } from "../src/lookback";
import type { HistoryRow } from "../src/model";
import { NotAnExport, readExport } from "../src/spotify";
import { setJudgeSource } from "./judge-source";
import { takeHandedFile } from "./pending-file";
import { ExampleLabel, NavContext } from "./nav";
import { actions, hydrate, ME, useStore, type State } from "./store";

const EXAMPLE = "example";
const SPOTIFY: { label: string } = { label: "Spotify file" };
export const lookBackQuestion = (q: Quarter, line: LookBackLine) => `lb:${q.year}-${q.q}:${line.id}`;

function LookBackCard({ line, stretch, owner }: { line: LookBackLine; stretch: Quarter; owner: string }) {
  const st = useStore();
  const [plays, setPlays] = useState(false);
  const qid = lookBackQuestion(stretch, line);
  const [localPick, setLocalPick] = useState<"first" | "second" | "neither" | null>(null);
  const stored = st.choices.find((c) => c.question_id === qid && c.person_id === owner)?.choice ?? null;
  const pick = owner === EXAMPLE ? localPick : stored;
  const choose = (c: "first" | "second" | "neither") => {
    if (owner === EXAMPLE) return setLocalPick(c);
    actions.choose({
      question_id: qid, person_id: owner, source: "a history", pattern_kind: `look-back:${line.kind}`, pattern_text: line.pattern,
      evidence: line.plays.map((p) => ({ text: `${p.date} · ${p.track}`, source: SPOTIFY })),
      readings_offered: [line.readings[0].template_id, line.readings[1].template_id],
      readings_kept: [line.readings[0].kept, line.readings[1].kept], choice: c,
    });
  };
  return (
    <article className="card stack">
      <p className="label">{line.kind === "arrived" ? "Arrived and stayed" : line.kind === "left" ? "Left" : "Came back"}</p>
      <p className="line line-arrives">{line.pattern}</p>
      <button type="button" className="act" aria-expanded={plays} onClick={() => setPlays((o) => !o)}>
        {plays ? "Hide the plays" : `See the ${line.plays.length} plays`}
      </button>
      {plays && (
        <ul className="plain plays">
          {line.plays.map((p, i) => (
            <li key={i} className="meta">
              {p.date} · {p.track}
            </li>
          ))}
        </ul>
      )}
      <hr className="rule" />
      <p className="label">What it might say</p>
      <div className="readings stack">
        {line.readings.map((r, i) => (
          <button key={r.template_id} type="button" className="act act-button reading" aria-pressed={pick === (i ? "second" : "first")} onClick={() => choose(i ? "second" : "first")}>
            {r.ask}
          </button>
        ))}
        <button type="button" className="act act-button" aria-pressed={pick === "neither"} onClick={() => choose("neither")}>
          Neither
        </button>
      </div>
    </article>
  );
}

type Read = { rows: HistoryRow[]; files: number; leftOut: number };

function Whose({ read, onKept, onCancel }: { read: Read; onKept: (person: string) => void; onCancel: () => void }) {
  const [someoneElse, setSomeoneElse] = useState(false);
  const [label, setLabel] = useState("");
  const [consent, setConsent] = useState("");
  const s = summary(read.rows)!;
  // Lines show at once; the rows are written to this browser's store behind them.
  const keep = (person: string) => {
    void actions.keepHistory(person, read.rows);
    onKept(person);
  };
  return (
    <div className="card stack">
      <p className="record">
        Read {s.plays.toLocaleString("en-GB")} plays, {s.first} to {s.last}.
      </p>
      {read.leftOut > 0 && (
        <p className="meta">
          {read.leftOut === 1 ? "1 play with no song named (a podcast or audiobook) was left out." : `${read.leftOut.toLocaleString("en-GB")} plays with no song named (podcasts, audiobooks) were left out.`}
        </p>
      )}
      <p className="label">Whose file is this?</p>
      <div className="row">
        <button type="button" className="act act-button" onClick={() => keep(ME)}>
          Mine
        </button>
        <button type="button" className="act act-button" aria-pressed={someoneElse} onClick={() => setSomeoneElse(true)}>
          Someone else&#39;s
        </button>
        <button type="button" className="act" onClick={onCancel}>
          Put it away
        </button>
      </div>
      {someoneElse && (
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            if (label.trim() && consent.trim()) keep(actions.addPerson(label, consent, "spotify export"));
          }}
        >
          <label className="label" htmlFor="lb-label">What you call them</label>
          <input id="lb-label" className="field" value={label} placeholder="my friend" onChange={(e) => setLabel(e.target.value)} />
          <label className="label" htmlFor="lb-consent">How did they agree to this? In your words</label>
          <textarea id="lb-consent" className="field words-box" rows={2} value={consent} onChange={(e) => setConsent(e.target.value)} />
          <button type="submit" className="act act-button" disabled={!label.trim() || !consent.trim()}>
            Show the lines
          </button>
        </form>
      )}
    </div>
  );
}

const nameOf = (st: State, person: string) => (person === ME ? "Your file" : `${st.people.find((p) => p.person_id === person)?.label ?? "Someone"}'s file`);

export function LookBack() {
  const st = useStore();
  useEffect(() => void hydrate(), []);
  const nav = useContext(NavContext);
  const [reading, setReading] = useState(false);
  const [read, setRead] = useState<Read | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [stretch, setStretch] = useState<Quarter | null>(null);
  const [over, setOver] = useState(false);

  const kept = Object.keys(st.histories).filter((p) => st.histories[p]!.length > 0);
  const owner = viewing ?? (kept.includes(ME) ? ME : kept[0] ?? null);
  const example = useMemo(() => (owner === EXAMPLE ? exampleHistory() : null), [owner]);
  const rows = example ?? (owner ? st.histories[owner] ?? null : null);
  const s = rows ? summary(rows) : null;
  const qs = useMemo(() => (rows ? quarters(rows) : []), [rows]);
  const chosen = stretch && qs.some((q) => q.year === stretch.year && q.q === stretch.q) ? stretch : rows ? defaultStretch(rows) : null;
  const lines = useMemo(() => (rows && chosen ? lookBack(rows, chosen) : []), [rows, chosen]);

  const readFile = (file: File | undefined) => {
    if (!file) return;
    setNotice(null);
    setReading(true);
    file
      .arrayBuffer()
      .then((buf) => new Promise<Read>((ok, no) => setTimeout(() => {
        try {
          ok(readExport(file.name, new Uint8Array(buf), "pending"));
        } catch (e) {
          no(e);
        }
      }, 0)))
      .then((r) => setRead(r))
      .catch((e) =>
        setNotice(
          e instanceof NotAnExport
            ? "This file holds no Spotify listening history. The look back reads the .zip from Spotify's “Extended streaming history” request, which holds files named Streaming_History_Audio."
            : "This file could not be read. Nothing from it was kept.",
        ),
      )
      .finally(() => setReading(false));
  };

  // A file dropped on the panel's "Have a Spotify file?" offer is read here at once.
  useEffect(() => {
    const f = takeHandedFile();
    if (f) readFile(f);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const showDrop = !read && (adding || (kept.length === 0 && owner !== EXAMPLE));

  if (!st.ready) return <p className="meta" role="status">Reading what this browser keeps…</p>;

  return (
    <section className="stack-lg">
      {owner === EXAMPLE && <ExampleLabel>A made-up listening history; every artist in it is invented.</ExampleLabel>}
      <p className="line">Drop your Spotify export. It is read in this browser and never uploaded.</p>

      {kept.length > 0 && !read && (
        <div className="chip-row" role="group" aria-label="Files kept in this browser">
          {kept.map((p) => (
            <button key={p} type="button" className="act act-button" aria-pressed={owner === p && !adding} onClick={() => { setViewing(p); setAdding(false); }}>
              {nameOf(st, p)} · {st.histories[p]!.length.toLocaleString("en-GB")} plays
            </button>
          ))}
          <button type="button" className="act" onClick={() => setAdding(true)}>
            Read another file
          </button>
        </div>
      )}

      {showDrop && (
        <div
          className={`card drop stack${over ? " drop-over" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            readFile(e.dataTransfer.files[0]);
          }}
        >
          <p className="record">Drop the .zip Spotify sent you here, or</p>
          <label className="act">
            choose the file
            <input type="file" accept=".zip,.json" className="visually-hidden" onChange={(e) => readFile(e.target.files?.[0])} />
          </label>
          {kept.length === 0 && (
            <button type="button" className="act" onClick={() => setViewing(EXAMPLE)}>
              Try the example file
            </button>
          )}
          {reading && <p className="meta" role="status">Reading the file in this browser…</p>}
          {notice && <p className="record" role="status">{notice}</p>}
        </div>
      )}

      {read && (
        <Whose
          read={read}
          onCancel={() => setRead(null)}
          onKept={(p) => {
            setRead(null);
            setAdding(false);
            setViewing(p);
            setStretch(null);
          }}
        />
      )}

      {!read && !showDrop && rows && s && chosen && (
        <>
          <div className="card stack">
            <p className="record">
              {owner === EXAMPLE ? "The example file" : nameOf(st, owner!)}: {s.plays.toLocaleString("en-GB")} plays, {s.first} to {s.last}.
            </p>
            <label className="label" htmlFor="stretch">
              A stretch of time
            </label>
            <select
              id="stretch"
              className="field"
              value={`${chosen.year}-${chosen.q}`}
              onChange={(e) => {
                const [y, q] = e.target.value.split("-").map(Number);
                setStretch({ year: y!, q: q as Quarter["q"] });
              }}
            >
              {qs.map((q) => (
                <option key={`${q.year}-${q.q}`} value={`${q.year}-${q.q}`}>
                  {quarterLabel(q)}
                </option>
              ))}
            </select>
            <p className="meta">Only plays of 30 seconds or more are counted.</p>
          </div>
          {lines.length === 0 && <p className="record">Nothing arrived, left or came back in {quarterLabel(chosen)}.</p>}
          {lines.map((l) => (
            <LookBackCard key={`${owner}:${quarterLabel(chosen)}:${l.id}`} line={l} stretch={chosen} owner={owner!} />
          ))}
          {owner !== EXAMPLE && (
            <div className="row">
              <button
                type="button"
                className="act"
                onClick={() => {
                  setJudgeSource("look-back");
                  nav.go("judge");
                }}
              >
                Judge these lines
              </button>
              <button type="button" className="act" onClick={() => { void actions.removeHistory(owner!); setViewing(null); }}>
                Remove this file from this browser
              </button>
            </div>
          )}
          {owner === EXAMPLE && (
            <button type="button" className="act" onClick={() => setViewing(null)}>
              Put the example away
            </button>
          )}
        </>
      )}
    </section>
  );
}

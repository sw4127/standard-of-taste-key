"use client";
/**
 * The look back (moment map L-0 to L-3; T5.7). Drop a Spotify export; it is read in this browser.
 * In this build it reads the example file only; reading a real export arrives with T5.7's parser.
 */
import { useMemo, useState } from "react";
import { exampleHistory } from "../src/examples";
import { defaultStretch, lookBack, quarterLabel, quarters, summary, type LookBackLine, type Quarter } from "../src/lookback";
import type { HistoryRow } from "../src/model";
import { ExampleLabel } from "./nav";

type Owner = { who: "me" } | { who: "someone else"; consent: string };

function LookBackCard({ line }: { line: LookBackLine }) {
  const [plays, setPlays] = useState(false);
  const [pick, setPick] = useState<"first" | "second" | "neither" | null>(null);
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
          <button key={r.template_id} type="button" className="act act-button reading" aria-pressed={pick === (i ? "second" : "first")} onClick={() => setPick(i ? "second" : "first")}>
            {r.ask}
          </button>
        ))}
        <button type="button" className="act act-button" aria-pressed={pick === "neither"} onClick={() => setPick("neither")}>
          Neither
        </button>
      </div>
    </article>
  );
}

export function LookBack() {
  const [rows, setRows] = useState<HistoryRow[] | null>(null);
  const [isExample, setIsExample] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [owner, setOwner] = useState<Owner | null>(null);
  const [consent, setConsent] = useState("");
  const [askingConsent, setAskingConsent] = useState(false);
  const [stretch, setStretch] = useState<Quarter | null>(null);
  const [over, setOver] = useState(false);

  const s = rows ? summary(rows) : null;
  const qs = useMemo(() => (rows ? quarters(rows) : []), [rows]);
  const chosen = stretch ?? (rows ? defaultStretch(rows) : null);
  const lines = useMemo(() => (rows && chosen && owner ? lookBack(rows, chosen) : []), [rows, chosen, owner]);

  const useExample = () => {
    setRows(exampleHistory());
    setIsExample(true);
    setNotice(null);
  };
  const refuseRealFile = () =>
    setNotice("This version reads the example file only. Your own file stays where it is; nothing was read.");

  return (
    <section className="stack-lg">
      {isExample && <ExampleLabel>A made-up listening history; every artist in it is invented.</ExampleLabel>}
      <p className="line">Drop your Spotify export. It is read in this browser and never uploaded.</p>

      {!rows && (
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
            refuseRealFile();
          }}
        >
          <p className="record">Drop the .zip Spotify sent you here, or</p>
          <label className="act">
            choose the file
            <input type="file" accept=".zip,.json" className="visually-hidden" onChange={refuseRealFile} />
          </label>
          <button type="button" className="act" onClick={useExample}>
            Try the example file
          </button>
          {notice && <p className="record">{notice}</p>}
        </div>
      )}

      {rows && s && !owner && (
        <div className="card stack">
          <p className="record">
            Read {s.plays.toLocaleString("en-GB")} plays, {s.first} to {s.last}.
          </p>
          <p className="label">Whose file is this?</p>
          <div className="row">
            <button type="button" className="act act-button" onClick={() => setOwner({ who: "me" })}>
              Mine
            </button>
            <button type="button" className="act act-button" aria-pressed={askingConsent} onClick={() => setAskingConsent(true)}>
              Someone else's
            </button>
          </div>
          {askingConsent && (
            <div className="stack">
              <label className="label" htmlFor="consent">
                How did they agree to this? In your words
              </label>
              <textarea id="consent" className="own words-box" rows={2} value={consent} onChange={(e) => setConsent(e.target.value)} />
              <button type="button" className="act act-button" disabled={!consent.trim()} onClick={() => setOwner({ who: "someone else", consent })}>
                Show the lines
              </button>
            </div>
          )}
        </div>
      )}

      {rows && s && owner && chosen && (
        <>
          <div className="card stack">
            <p className="record">
              Read {s.plays.toLocaleString("en-GB")} plays, {s.first} to {s.last}.
              {owner.who === "someone else" && " Someone else's file, with their agreement noted."}
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
            <LookBackCard key={`${quarterLabel(chosen)}:${l.id}`} line={l} />
          ))}
        </>
      )}
    </section>
  );
}

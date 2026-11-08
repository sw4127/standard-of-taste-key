/**
 * The launch-gate sheet (T8.3), on this computer only. Paste 50 titles, run rule v6 against
 * MusicBrainz, mark every match, download the sheet. Kept in this browser between visits; nothing is
 * sent anywhere but MusicBrainz's search.
 */
import "../../core/design/fonts";
import "../../core/design/cardstock.css";
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { matchTitle } from "../../core/src/match/v6";
import { GATE_SIZE, listProblems, MARKS, sheetMarkdown, titlesFrom, verdict, type GateRow, type Mark } from "./gate";

const KEY = "the-key-launch-gate";
interface Saved {
  uploader: string;
  listNote: string;
  pasted: string;
  rows: GateRow[];
}
const load = (): Saved => {
  try {
    return { uploader: "", listNote: "", pasted: "", rows: [], ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return { uploader: "", listNote: "", pasted: "", rows: [] };
  }
};

function Gate() {
  const [s, setS] = useState<Saved>(load);
  const [running, setRunning] = useState<number | null>(null);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch {
      /* the sheet still works for this visit */
    }
  }, [s]);

  const titles = titlesFrom(s.pasted);
  const problems = listProblems(s.uploader, titles);
  const v = s.rows.length ? verdict(s.rows) : null;

  const run = async () => {
    const rows: GateRow[] = titles.map((title, i) => ({ i, title, result: { state: "waiting" } }));
    setS((x) => ({ ...x, rows }));
    for (let i = 0; i < rows.length; i++) {
      setRunning(i);
      try {
        const r = await matchTitle(rows[i]!.title, { fetchFn: (u) => fetch(u) });
        rows[i] = { ...rows[i]!, result: r.state === "certain" ? { state: "certain", candidate: r.candidate } : { state: "silent", reason: r.reason } };
      } catch {
        rows[i] = { ...rows[i]!, result: { state: "error" } };
      }
      setS((x) => ({ ...x, rows: [...rows] }));
    }
    setRunning(null);
  };

  const rerunFailed = async () => {
    const rows = [...s.rows];
    for (const r of rows.filter((x) => x.result.state === "error")) {
      setRunning(r.i);
      try {
        const m = await matchTitle(r.title, { fetchFn: (u) => fetch(u) });
        rows[r.i] = { ...r, result: m.state === "certain" ? { state: "certain", candidate: m.candidate } : { state: "silent", reason: m.reason } };
      } catch {
        /* still not run */
      }
      setS((x) => ({ ...x, rows: [...rows] }));
    }
    setRunning(null);
  };

  const mark = (i: number, patch: Partial<GateRow>) => setS((x) => ({ ...x, rows: x.rows.map((r) => (r.i === i ? { ...r, ...patch } : r)) }));

  const download = () => {
    const md = sheetMarkdown(s.uploader, s.listNote, s.rows, new Date().toISOString());
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([md], { type: "text/markdown" }));
    a.download = `launch-gate-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
  };

  return (
    <main className="stack-lg" style={{ maxWidth: 760, margin: "0 auto", padding: 16 }}>
      <p className="label">Launch gate (T8.3) · on this computer only, never shipped</p>
      <p className="line">Fifty titles the rule has never seen. It passes only if no match is wrong or unprovable.</p>

      <section className="card stack">
        <p className="label">1 · The list</p>
        <p className="record">
          Open a Bilibili uploader&#39;s list page (not {"“"}百万豪装录音棚大声听{"”"}), copy 50 video titles, and paste them here, one per line. Durations, play counts and dates copied with them are left out.
        </p>
        <label className="label" htmlFor="uploader">Uploader</label>
        <input id="uploader" className="field" value={s.uploader} onChange={(e) => setS({ ...s, uploader: e.target.value })} />
        <label className="label" htmlFor="list">Which list (its name or address, as a note)</label>
        <input id="list" className="field" value={s.listNote} onChange={(e) => setS({ ...s, listNote: e.target.value })} />
        <label className="label" htmlFor="titles">Titles</label>
        <textarea id="titles" className="field words-box" rows={12} value={s.pasted} onChange={(e) => setS({ ...s, pasted: e.target.value })} />
        <p className="meta">{titles.length} of {GATE_SIZE} titles.</p>
        {problems.length > 0 && (
          <ul className="plain">
            {problems.map((p) => (
              <li key={p} className="record">{p}</li>
            ))}
          </ul>
        )}
        <button type="button" className="act" disabled={problems.length > 0 || running !== null} onClick={run}>
          Run rule v6 on these {titles.length}
        </button>
        {running !== null && <p className="meta" role="status">Running {running + 1} of {s.rows.length}… (one MusicBrainz call every 1.2 s)</p>}
      </section>

      {s.rows.length > 0 && v && (
        <>
          <section className="card stack">
            <p className="label">2 · Mark every match</p>
            <p className="record">
              For each match, open the recording on MusicBrainz and compare it with the video. Check the song, then the artist, then the version; the first that is wrong is the mark. If nothing is shown wrong but something can&#39;t be shown right, mark {"“"}Can&#39;t prove all three{"”"}. A doubtful release date is noted separately and never counted.
            </p>
            <p className="record" role="status">
              <strong>{v.state === "pass" ? "Passes" : v.state === "fail" ? "Fails" : v.state === "incomplete" ? "Incomplete" : "Not yet decided"}.</strong> {v.reason}
            </p>
            <p className="meta">
              Matched {v.matched} of {s.rows.length} (coverage, not gated) · silent {v.silent} · dates doubtful {v.datesDoubtful}
            </p>
            {v.errors > 0 && running === null && (
              <button type="button" className="act" onClick={rerunFailed}>
                Run the {v.errors} titles that did not run
              </button>
            )}
            <button type="button" className="act" onClick={download}>
              Download the sheet
            </button>
          </section>

          <ol className="stack" style={{ paddingLeft: 20 }}>
            {s.rows.map((r) => (
              <li key={r.i} className="card stack">
                <p className="record">{r.title}</p>
                {r.result.state === "certain" ? (
                  <>
                    <p className="line">
                      {r.result.candidate.title} · {r.result.candidate.artist_credit}
                    </p>
                    <p className="meta">
                      First release {r.result.candidate.first_release ?? "not listed"}
                      {r.result.candidate.record ? ` · ${r.result.candidate.record}` : ""} ·{" "}
                      <a className="act" href={`https://musicbrainz.org/recording/${r.result.candidate.recording_id}`} target="_blank" rel="noreferrer">
                        open on MusicBrainz
                      </a>
                    </p>
                    <div className="chip-row" role="group" aria-label={`Mark for title ${r.i + 1}`}>
                      {MARKS.map((m) => (
                        <button key={m} type="button" className="act act-button" aria-pressed={r.mark === m} onClick={() => mark(r.i, { mark: r.mark === m ? undefined : (m as Mark) })}>
                          {m}
                        </button>
                      ))}
                    </div>
                    <label className="meta">
                      <input type="checkbox" checked={!!r.dateDoubtful} onChange={(e) => mark(r.i, { dateDoubtful: e.target.checked })} /> The release date looks doubtful (noted, not counted)
                    </label>
                  </>
                ) : r.result.state === "silent" ? (
                  <p className="meta">Silent: {r.result.reason}. Nothing to mark.</p>
                ) : r.result.state === "waiting" ? (
                  <p className="meta">{running === null ? "Not run yet." : "Waiting…"}</p>
                ) : (
                  <p className="meta">Not run: MusicBrainz did not answer.</p>
                )}
              </li>
            ))}
          </ol>
        </>
      )}
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Gate />
  </StrictMode>,
);

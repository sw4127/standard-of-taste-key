"use client";
/**
 * My numbers (FR-T8.1; moment map P-14): song by song, how long until the line was ready, shown, and
 * first acted on; the suggested records later played; and "Export my record", one JSON file of every
 * store, other people's rows left out unless ticked. Counts only: no averages presented as findings.
 */
import { useEffect, useState } from "react";
import { exportRecord, laterPlayed, songTimes } from "../src/numbers";
import { actions, hydrate, others, toSnapshot, useStore } from "./store";

const ACT_WORDS: Record<string, string> = {
  proof_opened: "opened the proof",
  made_opened: "opened how it was made",
  next_search_opened: "searched for the next record",
  uploader_opened: "opened the uploader's page",
  line_dropped: "dropped the line",
};
const s = (n?: number) => (n === undefined ? "—" : `${n} s`);

export function MyNumbers() {
  const st = useStore();
  useEffect(() => void hydrate(), []);
  const [includeOthers, setIncludeOthers] = useState(false);
  if (!st.ready) return <p className="meta" role="status">Reading what this browser keeps…</p>;
  const times = songTimes(st.events, st.plays);
  const later = laterPlayed(st.nexts, st.plays);
  const people = others(st);

  const download = () => {
    const at = new Date().toISOString();
    const data = exportRecord({ snapshot: toSnapshot(st), plays: st.plays, keys: st.keys, nexts: st.nexts, histories: st.histories }, includeOthers, at);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: "application/json" }));
    a.download = `my-record-${at.slice(0, 10)}.json`;
    a.click();
    actions.log("export_made", { value: includeOthers ? "with other people's rows" : "mine only" });
  };

  return (
    <section className="stack-lg">
      <p className="line">My numbers</p>
      <p className="record">For each song played beside the panel: seconds from the start until its line was ready, until it was shown, and until you first acted on it.</p>

      {times.length === 0 ? (
        <p className="record">No song has played beside the panel yet.</p>
      ) : (
        <ul className="plain stack">
          {times.map((t) => (
            <li key={t.play_id} className="card stack">
              <p className="meta">
                <span className="song-name">{t.song}</span> · {t.started_at.slice(0, 16).replace("T", " ")}
              </p>
              <p className="record">
                Ready {s(t.ready)} · shown {s(t.shown)} · {t.firstAct ? `first act: ${ACT_WORDS[t.firstAct.kind]}, ${t.firstAct.after} s` : "no act"}
              </p>
            </li>
          ))}
        </ul>
      )}

      <div className="card stack">
        <p className="label">Suggested records you later played</p>
        {later.length === 0 ? (
          <p className="record">None yet.</p>
        ) : (
          <ul className="plain">
            {later.map((l, i) => (
              <li key={i} className="record">
                {l.record} · {l.artist} · played {l.played_at.slice(0, 10)}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card stack">
        <p className="label">Export my record</p>
        <p className="record">One file with everything this browser keeps for The Key: your plays, songs, readings, words, the lines shown and this log.</p>
        {people.length > 0 && (
          <label className="record">
            <input type="checkbox" checked={includeOthers} onChange={(e) => setIncludeOthers(e.target.checked)} /> Include other people&#39;s rows ({people.map((p) => p.label).join(", ")})
          </label>
        )}
        <button type="button" className="act" onClick={download}>
          Export my record
        </button>
      </div>
    </section>
  );
}

"use client";
/**
 * The words beside a matched song (moment map P-4 to P-8, P-10, P-11; T2.2, T2.4–T2.6, T3.1, T3.3, T3.4,
 * T4.1, T4.7, T9.2). One line, after 15 s heard on a known recording or 60 s on a first play; the proof
 * one tap away; "Not why I love it"; "How it was made" at any time; and, after a song heard to the end,
 * "What do you come back for?" on a tap of the song's name.
 */
import { useEffect, useMemo, useState } from "react";
import { firstLine, QUIET_OFFER, waitFor, type FirstLine } from "../src/firstwords";
import { localDay } from "../src/note";
import { PARTS, type KeyRow, type Part, type PlayRow, type SongFacts } from "../src/model";
import { HOURS, howItWasMade, NO_CREDITS, sanchoByItself, sinceInstalled } from "../src/proof";
import { SANCHO, STORY_LABEL, storyFor } from "../src/stories";
import { KeyChip } from "./KeyChip";
import { Go, SourceRef } from "./nav";
import { actions, ME, useStore } from "./store";

const localNow = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 19);
};

function Sancho() {
  return (
    <div className="stack">
      <p className="label">{SANCHO.title}</p>
      {SANCHO.retelling.map((s) => (
        <p key={s} className="record">{s}</p>
      ))}
      <p className="record">“{SANCHO.hume}”</p>
      <p className="meta">
        <SourceRef source={SANCHO.source} />
      </p>
    </div>
  );
}

function Proof({ line, song, play }: { line: FirstLine; song: SongFacts; play: PlayRow }) {
  const st = useStore();
  const [story, setStory] = useState(false);
  const [barrel, setBarrel] = useState(false);
  const today = localDay(new Date().toISOString());
  // FR-T3.4: decided once, as the proof opens.
  const [sancho] = useState(() => sanchoByItself(st.story_shown_count, st.story_last_shown_on, today));
  useEffect(() => {
    if (sancho) actions.storyShown(today);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const since = sinceInstalled(st.plays, song.recording_id);
  // One source for every item is said once, under the list.
  const oneSource = new Set(line.proof.map((p) => p.source)).size === 1 ? line.proof[0]!.source : null;
  const chosen = storyFor(song.title, song.lead_artist);
  const qid = `play:${play.play_id}:${line.template_id}`;
  const choice = st.choices.find((c) => c.question_id === qid && c.person_id === ME)?.choice;
  const pick = (c: "first" | "second" | "neither") =>
    line.readings &&
    actions.choose({
      question_id: qid, person_id: ME, source: "my plays", pattern_kind: line.kind, pattern_text: line.text,
      evidence: line.proof.map((p) => ({ text: p.text, source: { label: p.source } })),
      readings_offered: [line.readings[0].template_id, line.readings[1].template_id],
      readings_kept: [line.readings[0].kept, line.readings[1].kept], choice: c,
    });
  return (
    <div className="evidence stack">
      {sancho && <Sancho />}
      <p className="label">Behind this line</p>
      <ul className="plain">
        {line.proof.map((p, i) => (
          <li key={i} className="record">
            {p.text}
            {!oneSource && <span className="meta"> · {p.source}</span>}
          </li>
        ))}
      </ul>
      {oneSource && <p className="meta">{oneSource}.</p>}
      {since && (
        <div className="stack">
          <p className="label">Since you installed</p>
          <p className="record">
            {since.plays} {since.plays === 1 ? "play" : "plays"}: {HOURS.filter((h) => since.hours[h]).map((h) => (h === "after midnight" ? `${since.hours[h]} after midnight` : `${since.hours[h]} in the ${h}`)).join(", ")}.
          </p>
          {since.before.length > 0 && <p className="record">Played just before it: {since.before.map((b) => `${b.song} (${b.times})`).join(", ")}.</p>}
          {since.after.length > 0 && <p className="record">Played just after it: {since.after.map((b) => `${b.song} (${b.times})`).join(", ")}.</p>}
          <p className="meta">Counted from your plays in this browser.</p>
        </div>
      )}
      {line.readings && (
        <div className="stack">
          <p className="label">What it might say</p>
          {line.readings.map((r, i) => (
            <button key={r.template_id} type="button" className="act act-button reading" aria-pressed={choice === (i ? "second" : "first")} onClick={() => pick(i ? "second" : "first")}>
              {r.ask}
            </button>
          ))}
          <button type="button" className="act act-button" aria-pressed={choice === "neither"} onClick={() => pick("neither")}>
            Neither
          </button>
        </div>
      )}
      <div className="row">
        {chosen && (
          <button type="button" className="act" aria-expanded={story} onClick={() => setStory((x) => !x)}>
            {STORY_LABEL}
          </button>
        )}
        {!sancho && (
          <button type="button" className="act" aria-expanded={barrel} onClick={() => setBarrel((x) => !x)}>
            {SANCHO.title}
          </button>
        )}
      </div>
      {story && chosen && (
        <div className="stack">
          <p className="label">{STORY_LABEL}</p>
          <p className="record">{chosen.text}</p>
          <p className="meta">
            Checked against:{" "}
            {chosen.sources.map((u, i) => (
              <span key={u}>
                {i > 0 && " · "}
                <a className="act" href={u} target="_blank" rel="noreferrer">
                  {new URL(u).hostname.replace(/^www\./, "")}
                </a>
              </span>
            ))}
          </p>
        </div>
      )}
      {barrel && <Sancho />}
    </div>
  );
}

function HowItWasMade({ song }: { song: SongFacts }) {
  const made = howItWasMade(song);
  if (!made) return <p className="record">{NO_CREDITS}</p>;
  return (
    <div className="evidence stack">
      {made.map((g) => (
        <div key={g.heading} className="stack">
          <p className="label">{g.heading}</p>
          <ul className="plain">
            {g.lines.map((l, i) => (
              <li key={i} className="record">
                {l.text} <span className="meta">· <SourceRef source={l.source} /></span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** FR-T9.2 on the panel: offered only after the song was heard to the end, on a tap of its name. */
function ComeBackFor({ song, play }: { song: SongFacts; play: PlayRow }) {
  const st = useStore();
  const entry = st.songs.find((e) => e.person_id === ME && e.recording_id === song.recording_id);
  const answer = (p: Part) => {
    const id = entry?.entry_id ?? actions.addSong(song, play.page_title, ME, st.matchedBy[song.recording_id] ?? "rule");
    if (id) actions.answer(id, "comes_back_for", p);
  };
  return (
    <fieldset className="choices">
      <legend className="label">What do you come back for in this song?</legend>
      <div className="chip-row">
        {PARTS.map((p) => (
          <button key={p} type="button" className="act act-button" aria-pressed={entry?.comes_back_for === p} onClick={() => answer(p)}>
            {p}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function SongWords({ song, play, heard }: { song: SongFacts; play: PlayRow; heard: number }) {
  const st = useStore();
  const [proof, setProof] = useState(false);
  const [made, setMade] = useState(false);
  const [asking, setAsking] = useState(false);
  const wait = useMemo(() => waitFor(st.plays, song.recording_id, play.play_id), [song.recording_id, play.play_id]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = [...st.keys].reverse().find((k) => k.play_id === play.play_id && !k.dropped);
  const [line, setLine] = useState<FirstLine | null>(null);

  // FR-T2.4: the first line once the seconds heard pass the wait; logged with the real seconds (D5).
  useEffect(() => {
    if (heard < wait || (shown && line)) return;
    const l = firstLine({ song, play, plays: st.plays, facts: st.facts, keys: st.keys, histories: st.histories, people: st.people });
    setLine(l);
    if (shown && shown.template_id === l.template_id) return;
    const row: KeyRow = {
      key_id: `key-${play.play_id}-${l.template_id}`, recording_id: song.recording_id, play_id: play.play_id, template_id: l.template_id,
      evidence: l.proof.map((p) => p.text), text_shown: l.text, shown_at: localNow(), seconds_heard_when_shown: heard, threshold_seconds: wait,
      ...(l.offer ? { offer_shown: true } : {}), dropped: false,
    };
    void actions.saveKey(row);
  }, [heard >= wait, shown?.key_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const drop = () => {
    if (!shown) return;
    setProof(false);
    setLine(null);
    void actions.saveKey({ ...shown, dropped: true });
  };
  const openProof = () => {
    setProof((p) => !p);
    if (shown && !shown.proof_opened_at) void actions.saveKey({ ...shown, proof_opened_at: localNow() });
  };

  return (
    <div className="stack">
      {play.reached_end === "yes" && (
        <button type="button" className="act" aria-expanded={asking} onClick={() => setAsking((x) => !x)}>
          {asking ? "Done" : "What do you come back for?"}
        </button>
      )}
      {asking && play.reached_end === "yes" && <ComeBackFor song={song} play={play} />}

      {line && shown && line.kind !== "quiet" && (
        <div className="stack line-arrives">
          <button type="button" className="line line-button" aria-expanded={proof} onClick={openProof}>
            {line.text}
          </button>
          {line.under && <p className="record">{line.under}</p>}
          <div className="row">
            <KeyChip k={song.key} />
            <button type="button" className="act" aria-expanded={proof} onClick={openProof}>
              {proof ? "Hide the proof" : "The proof"}
            </button>
            <button type="button" className="act" onClick={drop}>
              Not why I love it
            </button>
          </div>
          {proof && <Proof line={line} song={song} play={play} />}
        </div>
      )}
      {line && shown && line.kind === "quiet" && (
        <div className="stack line-arrives">
          <p className="line">{line.text}</p>
          {shown.offer_shown && <Go to="songs">{QUIET_OFFER}</Go>}
        </div>
      )}

      <button type="button" className="act" aria-expanded={made} onClick={() => setMade((x) => !x)}>
        {made ? "Hide how it was made" : "How it was made"}
      </button>
      {made && <HowItWasMade song={song} />}
    </div>
  );
}

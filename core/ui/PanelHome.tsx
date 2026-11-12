"use client";
/**
 * The panel between songs (FR-T1.7, moment map P-1; T1.1, T1.7). With no record yet: the three offers,
 * each on its own card. With at least one song on record: the four most recent songs as cards, the
 * circle of keys with his songs marked, where the record stands in one sentence, one filled button and
 * one link. On a Bilibili page that is not a video page, it says that page is not read.
 */
import { useContext, useEffect, useState } from "react";
import { circlePlace } from "../src/design/key-colour";
import { idleState, measuredKeys, ON_BILIBILI, PLAY_HERE, PLAY_ON_BILIBILI, playsSentence, recordSentence, recordSongs, RECENT_CARDS, unmeasuredSentence, type RecentSong } from "../src/idle";
import { noteAvailable } from "../src/note";
import { linesAcross } from "../src/patterns";
import { CIRCLE_SENTENCES, edgeClass, edgeStyle, KeyChip, KeyCircle } from "./KeyChip";
import { Go, NavContext } from "./nav";
import { handOver } from "./pending-file";
import { hydrate, ME, songsOf, useStore } from "./store";

function SongCard({ s }: { s: RecentSong }) {
  return (
    <article className={`card between${edgeClass(s.facts.key)}`} style={edgeStyle(s.facts.key)}>
      <div className="stack">
        <p className="song-title">{s.facts.title}</p>
        <p className="artist">{s.facts.artist_credit}</p>
        <p className="meta">{playsSentence(s)}</p>
      </div>
      <KeyChip k={s.facts.key && s.facts.key.strength >= 0.5 ? s.facts.key : null} />
    </article>
  );
}

function useDrop() {
  const nav = useContext(NavContext);
  const [over, setOver] = useState(false);
  return {
    over,
    props: {
      onDragOver: (e: React.DragEvent) => {
        e.preventDefault();
        setOver(true);
      },
      onDragLeave: () => setOver(false),
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        setOver(false);
        handOver(e.dataTransfer.files[0]);
        nav.go("look-back");
      },
    },
  };
}

export function PanelHome({ playing = false, onBilibili = false }: { playing?: boolean; onBilibili?: boolean }) {
  const st = useStore();
  useEffect(() => void hydrate(), []);
  const drop = useDrop();
  const [picked, setPicked] = useState<number | null>(null);
  const songs = recordSongs(st.plays, st.facts);
  const state = idleState(songs.length, onBilibili);
  const note = noteAvailable(st.choices, st.words) && (
    <article className="card">
      <Go to="note">Your taste in words, so far</Go>
    </article>
  );

  if (state === "first-open" || state === "first-open on Bilibili") {
    return (
      <section className="stack-lg">
        {!playing && (
          <article className="card stack">
            <p className="voice">{onBilibili ? PLAY_HERE : PLAY_ON_BILIBILI}</p>
            {onBilibili ? (
              <p className="record">{ON_BILIBILI}</p>
            ) : (
              <div className="row">
                <a className="act" href="https://www.bilibili.com/" target="_blank" rel="noreferrer">
                  Open Bilibili
                </a>
                <Go to="example-song">See an example song card</Go>
              </div>
            )}
          </article>
        )}
        <article className="card stack">
          <p className="voice">Or name a few songs or albums that come to mind.</p>
          <Go to="songs" className="act-fill">
            <span>Name songs or albums</span>
            <span aria-hidden="true">→</span>
          </Go>
        </article>
        <article className={`card stack drop${drop.over ? " drop-over" : ""}`} {...drop.props}>
          <p className="voice">Have a Spotify file, yours or a friend&#39;s? Drop it here.</p>
          <Go to="look-back">Add a Spotify file, yours or a friend&#39;s</Go>
        </article>
        {note}
      </section>
    );
  }

  const keys = measuredKeys(songs);
  const lines = linesAcross(songsOf(st, ME));
  const inPlace = picked === null ? [] : songs.filter((s) => s.facts.key && s.facts.key.strength >= 0.5 && circlePlace(s.facts.key) === picked);
  return (
    <section className="stack-lg">
      {!playing && (
        <article className="card stack">
          <p className="line">{onBilibili ? PLAY_HERE : PLAY_ON_BILIBILI}</p>
          {onBilibili ? (
            <p className="record">{ON_BILIBILI}</p>
          ) : (
            <a className="act" href="https://www.bilibili.com/" target="_blank" rel="noreferrer">
              Open Bilibili
            </a>
          )}
        </article>
      )}
      {songs.slice(0, RECENT_CARDS).map((s) => (
        <SongCard key={s.facts.recording_id} s={s} />
      ))}
      <article className={`card stack drop-quiet${drop.over ? " drop-over" : ""}`} {...drop.props}>
        <div className="between">
          <KeyCircle keys={keys} onPick={(p) => setPicked(picked === p ? null : p)} picked={picked} />
          <p className="meta">{CIRCLE_SENTENCES}</p>
        </div>
        {inPlace.length > 0 && (
          <ul className="plain" aria-label="Songs in this key">
            {inPlace.map((s) => (
              <li key={s.facts.recording_id} className="record">
                {s.facts.title} · {s.facts.artist_credit}
              </li>
            ))}
          </ul>
        )}
        {unmeasuredSentence(songs.length - keys.length) && <p className="meta">{unmeasuredSentence(songs.length - keys.length)}</p>}
        <p className="voice">{lines.length ? lines[0]!.pattern : recordSentence(songs.length)}</p>
        <Go to="songs" className="act-fill">
          <span>Name songs or albums</span>
          <span aria-hidden="true">→</span>
        </Go>
        <Go to="look-back">Add a Spotify file, yours or a friend&#39;s</Go>
      </article>
      {note}
    </section>
  );
}

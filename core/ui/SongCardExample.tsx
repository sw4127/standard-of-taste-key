"use client";
/**
 * One song card on example data (moment map P-2, P-4, P-5, P-11; T2.2, T2.4, T2.5, T2.6, T4.7, T3.1).
 * A made-up video and a made-up friend. The clock below stands in for the video playing: it counts
 * only while "playing", like the panel's count of seconds heard. First play: the line waits 60 s.
 */
import { useEffect, useState } from "react";
import { EXAMPLE_FRIEND, EXAMPLE_PANEL_SONG as SONG } from "../src/examples";
import { edgeStyle, KeyChip } from "./KeyChip";
import { ExampleLabel, Go } from "./nav";

const FIRST_PLAY_WAIT = 60;
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export function SongCardExample() {
  const [read, setRead] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [heard, setHeard] = useState(0);
  const [proof, setProof] = useState(false);
  const [dropped, setDropped] = useState(false);

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setHeard((h) => h + 1), 1000);
    return () => clearInterval(t);
  }, [playing]);
  useEffect(() => {
    if (!playing || read) return;
    const t = setTimeout(() => setRead(true), 900);
    return () => clearTimeout(t);
  }, [playing, read]);

  const lineDue = heard >= FIRST_PLAY_WAIT;
  const f = EXAMPLE_FRIEND;

  return (
    <section className="stack-lg">
      <ExampleLabel>A made-up song and a made-up friend, to show how a song card behaves.</ExampleLabel>

      <article className="card stack" style={read ? edgeStyle(SONG.key) : {}}>
        <p className="meta" aria-live="polite">
          {!playing && heard === 0 ? "Waiting for a video to play." : read ? `${SONG.title} · ${SONG.artist_credit}` : "Reading this video…"}
        </p>

        {lineDue && !dropped && (
          <div className="stack line-arrives">
            <button type="button" className="line line-button" aria-expanded={proof} onClick={() => setProof((p) => !p)}>
              Your friend has played this artist {f.artistPlays} times.
            </button>
            <p className="record">
              Where to start: {f.record.title}, the record they played most, in {f.record.quarter}.
            </p>
            <div className="row">
              <KeyChip k={SONG.key} />
              <button type="button" className="act" aria-expanded={proof} onClick={() => setProof((p) => !p)}>
                {proof ? "Hide the proof" : "The proof"}
              </button>
              <button type="button" className="act" onClick={() => setDropped(true)}>
                Not why I love it
              </button>
            </div>
            {proof && (
              <div className="evidence stack">
                <p className="label">Behind this line</p>
                <ul className="plain">
                  <li className="record">{f.artistPlays} plays of {SONG.artist_credit} of 30 seconds or more</li>
                  <li className="record">
                    {f.record.title}: {f.record.plays} plays, most of them in {f.record.quarter}
                  </li>
                  <li className="record">Their most played songs by this artist: {f.topSongs.map((s) => `${s.title} (${s.plays})`).join(", ")}</li>
                </ul>
                <p className="meta">From your friend's Spotify file (example), counted in this browser.</p>
              </div>
            )}
          </div>
        )}

        {lineDue && dropped && (
          <div className="stack line-arrives">
            <p className="line">Nothing worth saying about this one yet.</p>
            <Go to="songs">Name a few songs that come to mind?</Go>
          </div>
        )}
      </article>

      <div className="card stack example-controls">
        <p className="label">Example controls: stand in for the video</p>
        <p className="record">
          Heard {mmss(heard)} of this song. On a first play the line waits until {mmss(FIRST_PLAY_WAIT)} heard; on a song you have played before, until 0:15.
        </p>
        <div className="row">
          <button type="button" className="act act-button" onClick={() => setPlaying((p) => !p)}>
            {playing ? "Pause" : heard ? "Play on" : "Play"}
          </button>
          <button type="button" className="act act-button" disabled={!playing} onClick={() => setHeard((h) => h + 15)}>
            Skip ahead 15 s
          </button>
          <button
            type="button"
            className="act"
            onClick={() => {
              setPlaying(false);
              setHeard(0);
              setRead(false);
              setProof(false);
              setDropped(false);
            }}
          >
            Start again
          </button>
        </div>
      </div>
    </section>
  );
}

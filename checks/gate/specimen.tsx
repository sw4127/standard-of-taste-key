/**
 * Card stock, second version (PRD A3): a specimen for Bob to judge light and dark mode on, on this
 * computer only. Never shipped. Every song and artist here is made up and labelled as an example.
 */
import "../../core/design/fonts";
import "../../core/design/cardstock.css";
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { parseKey, type Key } from "../../core/src/design/key-colour";
import { CIRCLE_SENTENCES, edgeClass, edgeStyle, KeyChip, KeyCircle } from "../../core/ui/KeyChip";

const SONGS: { title: string; artist: string; plays: string; key: Key | null }[] = [
  { title: "Glass Harbour", artist: "Juniper Varga", plays: "3 plays. The last was on Monday.", key: parseKey("A#", "major") },
  { title: "Copper Rain", artist: "The Copper Orchard", plays: "1 play, on Sunday.", key: parseKey("F", "minor") },
  { title: "Ninefold Morning", artist: "The Linden Hours", plays: "1 play, on Sunday.", key: parseKey("E", "major") },
  { title: "Paper Bridge", artist: "Ines Calloway", plays: "1 play, on Saturday.", key: null },
];
const FOURTEEN: Key[] = (
  [["A#", "major"], ["A#", "major"], ["A#", "major"], ["A#", "major"], ["G#", "major"], ["G#", "major"], ["F", "minor"], ["A", "major"], ["A", "major"], ["G", "major"], ["E", "major"], ["C#", "major"], ["D#", "major"], ["F", "major"]] as const
).map(([k, m]) => parseKey(k, m)!);

function Specimen() {
  const [picked, setPicked] = useState("The bridge");
  const [many, setMany] = useState(false);
  const keys = many ? FOURTEEN : SONGS.flatMap((s) => (s.key ? [s.key] : []));
  return (
    <div style={{ maxWidth: 380, margin: "0 auto", padding: 16 }} className="stack-lg">
      <p className="card slim label">
        <span className="example-tag">Example</span> Made-up songs and artists, to show the design.
      </p>
      <article className="card">
        <p className="line">Play a music video on this page and I'll read it.</p>
      </article>
      {SONGS.map((s) => (
        <article key={s.title} className={`card between${edgeClass(s.key)}`} style={edgeStyle(s.key)}>
          <div className="stack">
            <p className="song-title">{s.title}</p>
            <p className="artist">{s.artist}</p>
            <p className="meta">{s.plays}</p>
          </div>
          <KeyChip k={s.key} />
        </article>
      ))}
      <article className="card stack">
        <div className="between">
          <KeyCircle keys={keys} />
          <p className="meta">{CIRCLE_SENTENCES}</p>
        </div>
        <p className="voice">Four songs in, there is nothing to say across them yet; lines come as the record grows.</p>
        <button type="button" className="act-fill">
          <span>Name songs or albums</span>
          <span aria-hidden="true">→</span>
        </button>
        <button type="button" className="act">
          Add a Spotify file, yours or a friend's
        </button>
        <hr className="rule" />
        <div className="row">
          <button type="button" className="act" onClick={() => setMany((m) => !m)}>
            {many ? "Show the circle with four songs" : "Show the circle with fourteen songs"}
          </button>
        </div>
      </article>
      <article className="card stack">
        <p className="label">What do you come back for?</p>
        <div className="chip-row">
          {["The opening", "A verse", "The chorus", "The bridge", "The voice", "Not sure"].map((o) => (
            <button key={o} type="button" className="act choice" aria-pressed={picked === o} onClick={() => setPicked(o)}>
              {o}
            </button>
          ))}
        </div>
        <p className="label">In your words</p>
        <p className="own">I was moving between two cities that year, and this was on every train.</p>
        <input className="field" defaultValue="Type the song and the artist" aria-label="An example field" />
      </article>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Specimen />
  </StrictMode>,
);

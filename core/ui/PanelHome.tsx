"use client";
/** The panel's empty state (moment map P-1; T1.1): three one-line offers, each one tap. No form. */
import { noteAvailable } from "../src/note";
import { useContext, useEffect, useState } from "react";
import { Go, NavContext } from "./nav";
import { handOver } from "./pending-file";
import { hydrate, useStore } from "./store";

export function PanelHome({ playing = false }: { playing?: boolean }) {
  const st = useStore();
  useEffect(() => void hydrate(), []);
  const nav = useContext(NavContext);
  const [over, setOver] = useState(false);
  return (
    <section className="stack-lg">
      {!playing && <article className="card stack">
        <p className="voice">Play a music video on Bilibili and I'll read it.</p>
        <div className="row">
          <a className="act" href="https://www.bilibili.com/" target="_blank" rel="noreferrer">
            Open Bilibili
          </a>
          <Go to="example-song">See an example song card</Go>
        </div>
      </article>}
      <article className="card stack">
        <p className="voice">Or name a few songs that come to mind.</p>
        <Go to="songs">Name songs</Go>
      </article>
      <article
        className={`card stack${over ? " drop-over" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          handOver(e.dataTransfer.files[0]);
          nav.go("look-back");
        }}
      >
        <p className="voice">Have a Spotify file? Drop it here.</p>
        <Go to="look-back">Open the look back</Go>
      </article>
      {noteAvailable(st.choices, st.words) && (
        <p>
          <Go to="note">Your taste in words, so far</Go>
        </p>
      )}
    </section>
  );
}

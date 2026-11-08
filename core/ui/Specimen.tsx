"use client";

import { useState } from "react";
import { ALL_KEYS, chipColour, edgeColour, keyName, type Key } from "../src/design/key-colour";

/**
 * A specimen of Card stock: every speaker and the key colour on one card, with no song on it.
 * Step 1 only. Step 2 replaces it with the three ways in.
 */
const B_FLAT_MAJOR: Key = { pitch: 10, mode: "major" };

export function KeyChip({ k }: { k: Key | null }) {
  if (!k) return <span className="key-chip">Key not measured</span>;
  return (
    <span
      className="key-chip"
      style={{ ["--chip-light" as string]: chipColour(k, "light"), ["--chip-dark" as string]: chipColour(k, "dark") }}
    >
      {keyName(k)}
    </span>
  );
}

export function Specimen() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <article className="card stack" style={{ ["--edge" as string]: edgeColour(B_FLAT_MAJOR) }}>
        <p className="label">Specimen · not a song</p>
        <p className="meta">Song · artist · year</p>
        <p className="line line-arrives">The product speaks here, one line at a time.</p>
        <p className="record">The record speaks under it: 4 plays on 3 separate days.</p>
        <p className="own">Your own words are set like this.</p>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <KeyChip k={B_FLAT_MAJOR} />
          <KeyChip k={null} />
          <button type="button" className="act" aria-expanded={open} aria-controls="key-colours" onClick={() => setOpen((o) => !o)}>
            {open ? "Hide the key colours" : "Show the key colours"}
          </button>
        </div>
      </article>
      {open && (
        <article className="card" id="key-colours">
          <p className="label">The 24 keys, in circle-of-fifths order</p>
          <p className="record" style={{ marginBottom: 8 }}>
            Each major key sits beside the minor key with the same notes, which takes its colour, deeper.
          </p>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
            {ALL_KEYS.map((k) => (
              <li key={`${k.pitch}-${k.mode}`} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span aria-hidden style={{ width: 3, alignSelf: "stretch", background: edgeColour(k) }} />
                <KeyChip k={k} />
              </li>
            ))}
          </ul>
        </article>
      )}
    </>
  );
}

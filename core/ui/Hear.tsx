"use client";
/** T9.7: "Hear this tempo" and "Hear this key", made by the browser; nothing recorded is played. */
import { keyName, type Key } from "../src/design/key-colour";
import { MADE_BY_BROWSER, playKey, playTempo, type AudioLike } from "../src/sound";

let ctx: AudioLike | null = null;
const audio = (): AudioLike | null => {
  if (ctx) return ctx;
  const C = (globalThis as { AudioContext?: new () => AudioLike }).AudioContext;
  ctx = C ? new C() : null;
  return ctx;
};

export function Hear({ bpm, k }: { bpm?: number; k?: Key | null }) {
  if (!bpm && !k) return null;
  return (
    <div className="stack">
      <div className="row">
        {bpm ? (
          <button type="button" className="act" onClick={() => { const a = audio(); if (a) playTempo(a, bpm); }}>
            Hear this tempo ({Math.round(bpm)} BPM)
          </button>
        ) : null}
        {k ? (
          <button type="button" className="act" onClick={() => { const a = audio(); if (a) playKey(a, k); }}>
            Hear this key ({keyName(k)})
          </button>
        ) : null}
      </div>
      <p className="meta">{MADE_BY_BROWSER}</p>
    </div>
  );
}

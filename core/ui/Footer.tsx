"use client";
/** The footer every screen carries (PRD 6.3; moment map P-1), with the erase control (FR-T1.6). */
import { useState } from "react";
import { actions } from "./store";

/** Rule 6 as amended: the one thing that leaves on purpose is a reading he asks for, after its notice. */
export const PRIVACY_LINE = "Everything stays in this browser. The one exception is a reading you ask for, which sends your written answers to Anthropic after telling you what goes.";

export function PrivacyLine() {
  return <p className="meta">{PRIVACY_LINE}</p>;
}

/** FR-T1.6: asks inside the page (no browser dialog), then clears every store in this browser. */
export function EraseEverything() {
  const [asking, setAsking] = useState(false);
  const [erased, setErased] = useState(false);
  if (erased) return <p className="meta" role="status">Everything The Key saved in this browser has been erased.</p>;
  if (!asking) {
    return (
      <button type="button" className="act" onClick={() => setAsking(true)}>
        Erase everything in this browser
      </button>
    );
  }
  return (
    <div className="stack" role="group" aria-label="Erase everything">
      <p className="record">This erases all your songs, answers, kept readings and words saved in this browser. You can't undo it.</p>
      <div className="row">
        <button
          type="button"
          className="act"
          onClick={async () => {
            await actions.eraseEverything();
            setAsking(false);
            setErased(true);
          }}
        >
          Erase everything
        </button>
        <button type="button" className="act" onClick={() => setAsking(false)}>
          Don't erase
        </button>
      </div>
    </div>
  );
}

export function DataCredits() {
  return (
    <p className="meta">
      Song facts from{" "}
      <a className="act" href="https://musicbrainz.org/doc/About/Data_License" target="_blank" rel="noreferrer">
        MusicBrainz
      </a>{" "}
      and{" "}
      <a className="act" href="https://acousticbrainz.org/data" target="_blank" rel="noreferrer">
        AcousticBrainz
      </a>
      , review scores from{" "}
      <a className="act" href="https://www.wikidata.org/wiki/Wikidata:Licensing" target="_blank" rel="noreferrer">
        Wikidata
      </a>
      ; all three under CC0 (free to reuse, no rights reserved).
    </p>
  );
}

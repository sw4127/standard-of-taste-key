/** The footer every screen carries (PRD 6.3; moment map P-1). The erase control joins it with T1.6. */
export function PrivacyLine() {
  return <p className="meta">Everything stays in this browser.</p>;
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

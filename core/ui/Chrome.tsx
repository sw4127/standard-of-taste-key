"use client";
/**
 * The head and foot every screen carries, each on its own card (Card stock, second version, design
 * rule 2: no product text on the ground). The panel and the website share them so one test covers both.
 */
import { DataCredits, EraseEverything, PrivacyLine, RecordingSetting } from "./Footer";
import { Go } from "./nav";

export function PanelHead({ atHome, onHome }: { atHome: boolean; onHome: () => void }) {
  return (
    <header className="card slim">
      {atHome ? (
        <p className="label">The Key</p>
      ) : (
        <button type="button" className="act" onClick={onHome}>
          Back to The Key
        </button>
      )}
    </header>
  );
}

export function PanelFoot() {
  return (
    <footer className="card stack">
      <PrivacyLine />
      <RecordingSetting />
      <div className="row">
        <Go to="numbers">My numbers and export</Go>
        <Go to="reading">A reading of your words</Go>
        <EraseEverything />
      </div>
    </footer>
  );
}

export function SiteHead() {
  return (
    <header className="card slim">
      <Go to="home">Standard of Taste</Go>
    </header>
  );
}

export function SiteFoot() {
  return (
    <footer className="card stack">
      <PrivacyLine />
      <DataCredits />
      <div className="row">
        <Go to="numbers">My numbers and export</Go>
        <Go to="reading">A reading of your words</Go>
        <EraseEverything />
      </div>
    </footer>
  );
}

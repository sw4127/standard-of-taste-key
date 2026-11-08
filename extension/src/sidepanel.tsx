import "@sot/core/design/fonts";
import "@sot/core/design/cardstock.css";
import "./panel.css";
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { EraseEverything, PrivacyLine } from "@sot/core/ui/Footer";
import { Judge } from "@sot/core/ui/Judge";
import { LookBack } from "@sot/core/ui/LookBack";
import { NavContext, type View } from "@sot/core/ui/nav";
import { NowPlaying } from "@sot/core/ui/NowPlaying";
import { PanelHome } from "@sot/core/ui/PanelHome";
import { useLivePage } from "./live";
import { SongCardExample } from "@sot/core/ui/SongCardExample";
import { Songs } from "@sot/core/ui/Songs";
import { TasteNote } from "@sot/core/ui/TasteNote";

const SCREENS: Record<View, () => React.ReactNode> = {
  home: () => <PanelHome />,
  "example-song": () => <SongCardExample />,
  songs: () => <Songs />,
  "look-back": () => <LookBack />,
  note: () => <TasteNote />,
  judge: () => <Judge />,
};

function Panel() {
  const [view, setView] = useState<View>("home");
  const live = useLivePage();
  return (
    <NavContext.Provider value={{ go: setView }}>
      <div className="panel">
        <header className="panel-head">
          {view === "home" ? (
            <p className="label">The Key</p>
          ) : (
            <button type="button" className="act" onClick={() => setView("home")}>
              ← The Key
            </button>
          )}
        </header>
        <main className="panel-body stack-lg">
          {view === "home" && live?.facts && <NowPlaying live={{ ...live, facts: live.facts }} />}
          {view === "home" ? <PanelHome playing={!!live?.facts} /> : SCREENS[view]()}
        </main>
        <footer className="panel-foot stack">
          <PrivacyLine />
          <EraseEverything />
        </footer>
      </div>
    </NavContext.Provider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Panel />
  </StrictMode>,
);

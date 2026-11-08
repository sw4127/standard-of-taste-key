import "@sot/core/design/fonts";
import "@sot/core/design/cardstock.css";
import "./panel.css";
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { PrivacyLine } from "@sot/core/ui/Footer";
import { LookBack } from "@sot/core/ui/LookBack";
import { NavContext, type View } from "@sot/core/ui/nav";
import { PanelHome } from "@sot/core/ui/PanelHome";
import { SongCardExample } from "@sot/core/ui/SongCardExample";
import { Songs } from "@sot/core/ui/Songs";
import { TasteNote } from "@sot/core/ui/TasteNote";

const SCREENS: Record<View, () => React.ReactNode> = {
  home: () => <PanelHome />,
  "example-song": () => <SongCardExample />,
  songs: () => <Songs />,
  "look-back": () => <LookBack />,
  note: () => <TasteNote />,
};

function Panel() {
  const [view, setView] = useState<View>("home");
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
        <main className="panel-body">{SCREENS[view]()}</main>
        <footer className="panel-foot">
          <PrivacyLine />
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

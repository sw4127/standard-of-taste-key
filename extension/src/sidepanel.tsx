import "@sot/core/design/fonts";
import "@sot/core/design/cardstock.css";
import "./panel.css";
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { PanelFoot, PanelHead } from "@sot/core/ui/Chrome";
import { Judge } from "@sot/core/ui/Judge";
import { MyNumbers } from "@sot/core/ui/MyNumbers";
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
  numbers: () => <MyNumbers />,
};

function Panel() {
  const [view, setView] = useState<View>("home");
  const { live, onBilibili } = useLivePage();
  return (
    <NavContext.Provider value={{ go: setView }}>
      <div className="panel">
        <PanelHead atHome={view === "home"} onHome={() => setView("home")} />
        <main className="panel-body stack-lg">
          {view === "home" && live?.facts && <NowPlaying live={{ ...live, facts: live.facts }} />}
          {view === "home" ? <PanelHome playing={!!live?.facts} onBilibili={onBilibili} /> : SCREENS[view]()}
        </main>
        <PanelFoot />
      </div>
    </NavContext.Provider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Panel />
  </StrictMode>,
);

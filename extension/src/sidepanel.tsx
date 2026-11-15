import "@sot/core/design/fonts";
import "@sot/core/design/cardstock.css";
import "./panel.css";
import { StrictMode, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { PanelFoot, PanelHead } from "@sot/core/ui/Chrome";
import { Judge } from "@sot/core/ui/Judge";
import { MyNumbers } from "@sot/core/ui/MyNumbers";
import { LookBack } from "@sot/core/ui/LookBack";
import { NavContext, type View } from "@sot/core/ui/nav";
import { NowPlaying } from "@sot/core/ui/NowPlaying";
import { PanelHome } from "@sot/core/ui/PanelHome";
import { ReadingLink } from "@sot/core/ui/Reading";
import { useLivePage } from "./live";
import { catchUp } from "@sot/core/ui/catchup";
import { hydrate, useStore } from "@sot/core/ui/store";
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
  reading: () => <ReadingLink />,
};

function Panel() {
  const [view, setView] = useState<View>("home");
  const { live, onBilibili } = useLivePage();
  const st = useStore();
  // FR-T1.9 point 3: once the record is read, the plays waiting for the rule are matched, oldest first,
  // while the panel stays usable. The play on screen is left to its card.
  const showing = useRef<string | undefined>(undefined);
  showing.current = live?.facts ? `play-${live.play_token}` : undefined;
  useEffect(() => {
    void hydrate().then(() => catchUp({ fetchFn: (url: string) => fetch(url), skip: () => showing.current }));
  }, []);
  // FR-T1.9 point 4: while recording is paused, the playing video is not read at all.
  const playing = !st.recording_paused && live?.facts ? live : null;
  return (
    <NavContext.Provider value={{ go: setView }}>
      <div className="panel">
        <PanelHead atHome={view === "home"} onHome={() => setView("home")} />
        <main className="panel-body stack-lg">
          {view === "home" && playing?.facts && <NowPlaying live={{ ...playing, facts: playing.facts }} />}
          {/* While paused, the offer to read a video is not made: the panel would not read it. */}
          {view === "home" ? <PanelHome playing={!!playing?.facts || !!st.recording_paused} onBilibili={onBilibili} /> : SCREENS[view]()}
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

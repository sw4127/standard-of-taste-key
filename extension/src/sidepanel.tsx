import "@sot/core/design/fonts";
import "@sot/core/design/cardstock.css";
import "./panel.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { PrivacyLine } from "@sot/core/ui/Footer";
import { Specimen } from "@sot/core/ui/Specimen";

function Panel() {
  return (
    <div className="panel">
      <main className="panel-body">
        <p className="label" style={{ marginBottom: 12 }}>The Key</p>
        <Specimen />
      </main>
      <footer className="panel-foot">
        <PrivacyLine />
      </footer>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Panel />
  </StrictMode>,
);

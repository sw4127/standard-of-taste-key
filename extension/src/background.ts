/// <reference types="chrome" />
// T1.1: nothing shows on any page; clicking the toolbar icon opens the side panel (moment map P-0, P-1).
// T1.9: while no side panel is open in a video's window, the plays the content script reports are kept
// in D1, the store the panel reads, marked "panel closed" (FR-T1.9). No network call, no matching, no
// badge, nothing drawn: this file calls no chrome.action, notifications or fetch.
import { recordClosed } from "@sot/core/src/recorder";
import { openDb } from "@sot/core/src/storage";
import type { LiveMessage } from "./content";

const openOnClick = () => chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
chrome.runtime.onInstalled.addListener(openOnClick);
chrome.runtime.onStartup.addListener(openOnClick);

let dbp: Promise<IDBDatabase> | null = null;
const db = () =>
  (dbp ??= openDb().then((d) => {
    d.onversionchange = () => {
      d.close(); // a newer panel is upgrading the store: let it
      dbp = null;
    };
    return d;
  }));

/** Is a side panel of this extension open in this window? (chrome.runtime.getContexts, Chrome 116.) */
async function panelOpenIn(windowId: number): Promise<boolean> {
  const open = await chrome.runtime.getContexts({ contextTypes: ["SIDE_PANEL" as chrome.runtime.ContextType] });
  // Only a panel in this window hears this tab. Were a panel's window unknown, the play is stored too:
  // a play stored twice is merged into one row, while a play not stored is lost for good.
  return open.some((c) => c.windowId === windowId);
}

// Messages arrive about once a second while a video plays; each is read and written in turn, so two
// messages for one play never race and never make two rows.
let queue: Promise<unknown> = Promise.resolve();

chrome.runtime.onMessage.addListener((msg: LiveMessage, sender) => {
  if (msg?.type !== "key:page" || !msg.facts || !sender.tab) return;
  const windowId = sender.tab.windowId;
  queue = queue
    .then(async () => {
      if (await panelOpenIn(windowId)) return; // the open panel keeps this play itself
      await recordClosed(await db(), msg);
    })
    .catch(() => undefined);
});

/**
 * The panel's ear on the page: the active tab's content script tells the panel what is playing.
 * Only messages from the tab in front are heard; a tab that is not a Bilibili video says nothing.
 */
import { useEffect, useState } from "react";
import type { LivePage } from "@sot/core/src/model";
import type { LiveMessage } from "./content";

/** The page in front: what plays on it, and whether it is a Bilibili page at all (FR-T1.7). */
export function useLivePage(): { live: LivePage | null; onBilibili: boolean } {
  const [live, setLive] = useState<LivePage | null>(null);
  const [onBilibili, setOnBilibili] = useState(false);
  useEffect(() => {
    if (typeof chrome === "undefined" || !chrome.tabs?.query) return;
    let active: number | undefined;
    const hello = async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      active = tab?.id;
      if (active === undefined) {
        setOnBilibili(false);
        return setLive(null);
      }
      try {
        const r = (await chrome.tabs.sendMessage(active, { type: "key:hello" })) as LiveMessage | undefined;
        setOnBilibili(!!r);
        setLive(r?.facts ? r : null);
      } catch {
        setOnBilibili(false); // no content script here: not a Bilibili page
        setLive(null);
      }
    };
    const onMessage = (m: LiveMessage, sender: chrome.runtime.MessageSender) => {
      if (m?.type === "key:page" && sender.tab?.id === active) {
        setOnBilibili(true);
        setLive(m.facts ? m : null);
      }
    };
    const onActivated = () => void hello();
    const onUpdated = (tabId: number, info: { status?: string }) => {
      if (tabId === active && info.status === "complete") void hello();
    };
    chrome.runtime.onMessage.addListener(onMessage);
    chrome.tabs.onActivated.addListener(onActivated);
    chrome.tabs.onUpdated.addListener(onUpdated);
    void hello();
    return () => {
      chrome.runtime.onMessage.removeListener(onMessage);
      chrome.tabs.onActivated.removeListener(onActivated);
      chrome.tabs.onUpdated.removeListener(onUpdated);
    };
  }, []);
  return { live, onBilibili };
}

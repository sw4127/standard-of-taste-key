/// <reference types="chrome" />
// T1.1: nothing shows on any page; clicking the toolbar icon opens the side panel (moment map P-0, P-1).
const openOnClick = () => chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
chrome.runtime.onInstalled.addListener(openOnClick);
chrome.runtime.onStartup.addListener(openOnClick);

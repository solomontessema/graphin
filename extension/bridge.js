// Runs on Graphin's own pages (see manifest.json). When the extension saves to a network, it tells the open Graphin tab,
// and this passes the news to the page itself, which then shows the change. The page only accepts messages from this
// same window, so nothing else on the page can trigger it.
chrome.runtime.onMessage.addListener((message) => {
  if (message && message.type === 'graphin-changed') {
    window.postMessage({ source: 'graphin-save', networkId: message.networkId }, window.location.origin);
  }
});

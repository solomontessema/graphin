// Shared by the popup, the options page, and the background worker.

// The two addresses Graphin runs on in development. Both are listed in manifest.json.
// The desktop app listens on 127.0.0.1:8765 (see desktop/src-tauri/src/main.rs).
export const ADDRESSES = ['http://localhost:8100', 'http://localhost:5173', 'http://127.0.0.1:8765'];
const DEFAULT_ADDRESS = ADDRESSES[0];

export async function getAddress() {
  const { address } = await chrome.storage.local.get('address');
  return ADDRESSES.includes(address) ? address : DEFAULT_ADDRESS;
}

export async function setAddress(address) {
  await chrome.storage.local.set({ address });
}

export async function getLastNetwork() {
  const { lastNetwork } = await chrome.storage.local.get('lastNetwork');
  return lastNetwork || null;
}

export async function setLastNetwork(id) {
  await chrome.storage.local.set({ lastNetwork: id });
}

/** Calls the Graphin API. Throws with the server's message on failure. */
export async function api(address, method, path, body) {
  let response;
  try {
    response = await fetch(address + '/api' + path, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error(`Graphin is not running at ${address}. Start the server, then try again.`);
  }
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

/**
 * Reads the page in the active tab: its address, title, highlighted text, og:image thumbnail,
 * and favicon. Runs inside the page, so it must not use anything from this file.
 */
export function readPage() {
  const httpOnly = (value) => (value && /^https?:\/\//i.test(value) ? value : null);
  const absolute = (value) => {
    try {
      return httpOnly(new URL(value, location.href).href);
    } catch {
      return null;
    }
  };
  const og = document.querySelector('meta[property="og:image"]');
  const icon = document.querySelector('link[rel~="icon"]');
  return {
    url: location.href,
    title: (document.title || location.hostname).slice(0, 255),
    commentary: String(window.getSelection() || '').trim().slice(0, 5000),
    thumbnail_url: og ? absolute(og.content) : null,
    favicon_url: icon ? absolute(icon.getAttribute('href')) : null,
  };
}

/** The page info for a tab, or throws for pages that scripts cannot read (browser pages, the store). */
export async function pageInfo(tab) {
  if (!tab || !/^https?:\/\//i.test(tab.url || '')) {
    throw new Error('This page cannot be saved. Open a normal web page first.');
  }
  const [result] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: readPage });
  return result.result;
}

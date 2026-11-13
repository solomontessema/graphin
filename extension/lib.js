// Shared by the popup, the options page, and the background worker.

// Where Graphin runs. The first is the live site (graphin.org, with the app and its API under index.php). The others
// are for development and for the desktop app. All of them are listed in manifest.json.
// The desktop app listens on 127.0.0.1:8765 (see desktop/src-tauri/src/main.rs).
export const ADDRESSES = ['https://graphin.org/index.php', 'http://localhost:8100', 'http://localhost:5173', 'http://127.0.0.1:8765'];
const DEFAULT_ADDRESS = ADDRESSES[0];
// Bumped when the default changes, so a copy of the extension that saved an older choice (such as localhost) moves to the
// new default once.
const SETTINGS_VERSION = 2;

export async function getAddress() {
  const { address, settingsVersion } = await chrome.storage.local.get(['address', 'settingsVersion']);
  if (settingsVersion !== SETTINGS_VERSION) return DEFAULT_ADDRESS;
  return ADDRESSES.includes(address) ? address : DEFAULT_ADDRESS;
}

export async function setAddress(address) {
  await chrome.storage.local.set({ address, settingsVersion: SETTINGS_VERSION });
}

export async function getLastNetwork() {
  const { lastNetwork } = await chrome.storage.local.get('lastNetwork');
  return lastNetwork || null;
}

export async function setLastNetwork(id) {
  await chrome.storage.local.set({ lastNetwork: id });
}

/** Who is signed in to Graphin at this address: {mode, user} where user is null when nobody is. */
export function session(address) {
  return api(address, 'GET', '/auth/me');
}

/** Calls the Graphin API. Throws with the server's message on failure. */
export async function api(address, method, path, body) {
  let response;
  try {
    response = await fetch(address + '/api' + path, {
      method,
      // Sends the Graphin sign-in cookie, so the extension acts as the person who is logged in to Graphin.
      credentials: 'include',
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

import { api, getAddress, pageInfo, session, setLastNetwork, tellGraphin } from './lib.js';

// Right-click menu. Each kind of save has its own entry, and under it one entry per network, so the person picks the
// network when saving. The list of networks is kept in storage and refreshed when the browser starts, when the extension
// is installed, and when the popup opens (so a new network appears after the next time the popup is used).
const KINDS = [
  { kind: 'link', title: 'Save link to Graphin', contexts: ['link'] },
  { kind: 'selection', title: 'Save selection to Graphin', contexts: ['selection'] },
  { kind: 'page', title: 'Save page to Graphin', contexts: ['page'] },
];
const NETWORK_LIMIT = 40;

function clearMenu() {
  return new Promise((resolve) => chrome.contextMenus.removeAll(resolve));
}

/** Builds the menu from the saved list of networks. */
async function buildMenu() {
  const { networks = [], signedIn = false } = await chrome.storage.local.get(['networks', 'signedIn']);
  await clearMenu();
  for (const item of KINDS) {
    chrome.contextMenus.create({ id: item.kind, title: item.title, contexts: item.contexts });
    if (!signedIn) {
      chrome.contextMenus.create({ id: `${item.kind}|login`, parentId: item.kind, title: 'Log in to Graphin first', contexts: item.contexts });
    } else if (networks.length === 0) {
      chrome.contextMenus.create({ id: `${item.kind}|none`, parentId: item.kind, title: 'No networks yet', contexts: item.contexts });
    } else {
      for (const network of networks) {
        chrome.contextMenus.create({ id: `${item.kind}|${network.id}`, parentId: item.kind, title: network.name, contexts: item.contexts });
      }
    }
  }
}

/** Asks Graphin which networks this person has, keeps the list, and rebuilds the menu. */
async function refreshNetworks() {
  const address = await getAddress();
  try {
    const who = await session(address);
    if (who.user) {
      const networks = await api(address, 'GET', '/networks');
      await chrome.storage.local.set({
        signedIn: true,
        networks: networks.slice(0, NETWORK_LIMIT).map((n) => ({ id: n.id, name: n.name })),
      });
    } else {
      await chrome.storage.local.set({ signedIn: false, networks: [] });
    }
  } catch {
    // Graphin is not reachable: the menu offers the log-in entry until it is.
    await chrome.storage.local.set({ signedIn: false, networks: [] });
  }
  await buildMenu();
}

chrome.runtime.onInstalled.addListener(refreshNetworks);
chrome.runtime.onStartup.addListener(refreshNetworks);

// The popup asks for a refresh when it opens.
chrome.runtime.onMessage.addListener((message) => {
  if (message && message.type === 'networks-changed') {
    refreshNetworks();
  }
});

function flash(text, color) {
  chrome.action.setBadgeBackgroundColor({ color });
  chrome.action.setBadgeText({ text });
  setTimeout(() => chrome.action.setBadgeText({ text: '' }), 2500);
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  // The menu item is "kind|network id", or "kind|login" or "kind|none" when there is nothing to save into.
  const [kind, networkId] = String(info.menuItemId).split('|');
  if (!KINDS.some((item) => item.kind === kind)) return;
  const address = await getAddress();
  if (networkId === 'login') {
    chrome.tabs.create({ url: address });
    return;
  }
  if (networkId === 'none') return;

  const isLink = kind === 'link';
  const isSelection = kind === 'selection';

  try {
    // The page's own title, thumbnail, and favicon are used only when saving the page itself.
    let page = null;
    if (!isLink) {
      page = await pageInfo(tab).catch(() => null);
    }

    const url = isLink ? info.linkUrl : page ? page.url : info.pageUrl;
    const title = isLink ? info.linkUrl : page ? page.title : tab.title || info.pageUrl;
    const commentary = isSelection ? (info.selectionText || '').trim().slice(0, 5000) : page?.commentary || '';

    await api(address, 'POST', `/networks/${networkId}/nodes`, {
      url,
      title: title.slice(0, 255),
      commentary: commentary || null,
      thumbnail_url: page?.thumbnail_url || null,
      favicon_url: page?.favicon_url || null,
    });
    await setLastNetwork(networkId);
    tellGraphin(networkId).catch(() => {});
    flash('✓', '#2e7d32');
  } catch (e) {
    console.error('Graphin Save failed:', e.message);
    flash('!', '#c62828');
  }
});

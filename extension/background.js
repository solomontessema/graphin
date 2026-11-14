import { api, getAddress, getLastNetwork, pageInfo, tellGraphin } from './lib.js';

// Right-click menu: save a link, the highlighted text, or the page itself to the last network used.
const MENU = [
  { id: 'save-link', title: 'Save link to Graphin', contexts: ['link'] },
  { id: 'save-selection', title: 'Save selection to Graphin', contexts: ['selection'] },
  { id: 'save-page', title: 'Save page to Graphin', contexts: ['page'] },
];

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    for (const item of MENU) {
      chrome.contextMenus.create(item);
    }
  });
});

function flash(text, color) {
  chrome.action.setBadgeBackgroundColor({ color });
  chrome.action.setBadgeText({ text });
  setTimeout(() => chrome.action.setBadgeText({ text: '' }), 2500);
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const networkId = await getLastNetwork();
  if (!networkId) {
    // Nothing to save into yet. Saving once from the toolbar popup picks a network.
    flash('!', '#c62828');
    return;
  }

  const address = await getAddress();
  const isLink = info.menuItemId === 'save-link';
  const isSelection = info.menuItemId === 'save-selection';

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
    tellGraphin(networkId).catch(() => {});
    flash('✓', '#2e7d32');
  } catch (e) {
    console.error('Graphin Save failed:', e.message);
    flash('!', '#c62828');
  }
});

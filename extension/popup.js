import { api, getAddress, getLastNetwork, pageInfo, session, setLastNetwork } from './lib.js';

const el = {
  network: document.getElementById('network'),
  title: document.getElementById('title'),
  url: document.getElementById('url'),
  commentary: document.getElementById('commentary'),
  save: document.getElementById('save'),
  status: document.getElementById('status'),
  options: document.getElementById('options'),
};

let address = '';
let networks = [];
let thumbnail = null;
let favicon = null;

function say(message, isError = false) {
  el.status.textContent = message;
  el.status.className = isError ? 'status error' : 'status';
}

async function init() {
  address = await getAddress();
  el.options.addEventListener('click', (event) => {
    event.preventDefault();
    chrome.runtime.openOptionsPage();
  });

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try {
    const info = await pageInfo(tab);
    el.title.value = info.title;
    el.url.value = info.url;
    el.commentary.value = info.commentary;
    thumbnail = info.thumbnail_url;
    favicon = info.favicon_url;
  } catch (e) {
    say(e.message, true);
    return;
  }

  // Saving needs the person to be logged in to Graphin in this browser. Check that first, so the message says what to do.
  let who;
  try {
    who = await session(address);
  } catch (e) {
    say(e.message, true);
    return;
  }
  if (!who.user) {
    el.network.innerHTML = '<option value="">Not logged in</option>';
    say('You are not logged in to Graphin. Log in there, then open this again.', true);
    openLink('Open Graphin', address);
    return;
  }

  try {
    networks = await api(address, 'GET', '/networks');
  } catch (e) {
    say(e.message, true);
    return;
  }

  if (networks.length === 0) {
    el.network.innerHTML = '<option value="">No networks yet</option>';
    say(`Create a network at ${address} first.`, true);
    return;
  }

  el.network.innerHTML = networks.map((n) => `<option value="${n.id}">${escapeHtml(n.name)}</option>`).join('');
  const last = await getLastNetwork();
  if (last && networks.some((n) => n.id === last)) {
    el.network.value = last;
  }
  el.network.disabled = false;
  el.save.disabled = false;
  say(`Signed in as ${who.user.email}.`);
}

/** Adds a link to the status line that opens the address in a new tab. */
function openLink(label, url) {
  const link = document.createElement('a');
  link.href = '#';
  link.textContent = ` ${label}`;
  link.addEventListener('click', (event) => {
    event.preventDefault();
    chrome.tabs.create({ url });
  });
  el.status.append(link);
}

async function save(event) {
  event.preventDefault();
  const title = el.title.value.trim();
  if (!title) {
    say('Give the link a title first.', true);
    return;
  }
  el.save.disabled = true;
  say('Saving…');
  try {
    await api(address, 'POST', `/networks/${el.network.value}/nodes`, {
      url: el.url.value,
      title,
      commentary: el.commentary.value.trim() || null,
      thumbnail_url: thumbnail,
      favicon_url: favicon,
    });
    await setLastNetwork(el.network.value);
    const name = networks.find((n) => n.id === el.network.value)?.name || 'Graphin';
    say(`Saved to ${name}.`);
    const open = document.createElement('a');
    open.href = '#';
    open.textContent = ' Open in Graphin';
    open.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: `${address}/#/networks/${el.network.value}` });
    });
    el.status.append(open);
    setTimeout(() => window.close(), 2000);
  } catch (e) {
    say(e.message, true);
    el.save.disabled = false;
  }
}

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

el.save.addEventListener('click', save);
init();

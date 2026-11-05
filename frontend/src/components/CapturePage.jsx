import { useEffect, useState } from 'react';
import { api } from '../api.js';

const LAST_NETWORK_KEY = 'graphin:last-network';

/**
 * Opened by the bookmarklet in a small window. It shows what was captured, lets you pick a network
 * and edit the commentary, then saves the link.
 */
export default function CapturePage() {
  const params = new URLSearchParams(window.location.search);
  const [networks, setNetworks] = useState(null);
  const [networkId, setNetworkId] = useState('');
  const [title, setTitle] = useState(params.get('title') || '');
  const [commentary, setCommentary] = useState(params.get('commentary') || '');
  const url = params.get('url') || '';
  const thumbnail = params.get('thumbnail_url') || '';
  const favicon = params.get('favicon_url') || '';
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .networks()
      .then((list) => {
        setNetworks(list);
        let remembered = '';
        try {
          remembered = window.localStorage.getItem(LAST_NETWORK_KEY) || '';
        } catch {
          remembered = '';
        }
        const match = list.find((n) => n.id === remembered);
        setNetworkId(match ? match.id : list[0]?.id || '');
      })
      .catch((e) => setError(e.message));
  }, []);

  async function save(event) {
    event.preventDefault();
    setStatus('saving');
    setError('');
    try {
      await api.createNode(networkId, {
        url,
        title,
        commentary: commentary.trim() || null,
        thumbnail_url: thumbnail || null,
        favicon_url: favicon || null,
      });
      try {
        window.localStorage.setItem(LAST_NETWORK_KEY, networkId);
      } catch {
        // Remembering the network is a convenience only.
      }
      setStatus('saved');
      // Closes the window when the bookmarklet opened it as a pop-up. In a tab, it does nothing.
      window.close();
    } catch (e) {
      setError(e.message);
      setStatus('idle');
    }
  }

  if (status === 'saved') {
    return (
      <main className="capture">
        <h1>Saved to Graphin</h1>
        <p className="muted">You can close this tab, or go back to the page you were reading.</p>
      </main>
    );
  }

  if (!url) {
    return (
      <main className="capture">
        <h1>Graphin</h1>
        <p className="muted">Nothing to save. Open this window from the "Save to Graphin" bookmark.</p>
      </main>
    );
  }

  return (
    <main className="capture">
      <h1>Save to Graphin</h1>

      {thumbnail && <img className="capture-thumb" src={thumbnail} alt="" referrerPolicy="no-referrer" />}

      <form onSubmit={save} className="details-form">
        <label>
          Network
          {networks === null && <span className="muted">Loading…</span>}
          {networks && networks.length === 0 && (
            <span className="error">No networks yet. Create one in the Graphin tab first.</span>
          )}
          {networks && networks.length > 0 && (
            <select value={networkId} onChange={(e) => setNetworkId(e.target.value)}>
              {networks.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name}
                </option>
              ))}
            </select>
          )}
        </label>
        <label>
          Title
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={255} required />
        </label>
        <label>
          Link
          <input value={url} readOnly className="readonly" />
        </label>
        <label>
          Commentary (highlighted text and your notes)
          <textarea value={commentary} onChange={(e) => setCommentary(e.target.value)} rows={6} maxLength={20000} />
        </label>
        {error && <p className="error">{error}</p>}
        <div className="form-row end">
          <button type="submit" disabled={!networkId || status === 'saving'}>
            {status === 'saving' ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </main>
  );
}

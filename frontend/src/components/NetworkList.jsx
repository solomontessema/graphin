import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { COVERS, DEFAULT_COVER } from '../covers.js';

/** Dark or light text, whichever reads better on the given #rrggbb background. */
function readableOn(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#111827' : '#ffffff';
}


/** The picture and background colour choices of a tile. Used by the edit form and the "Create New" window. */
function TileFields({ draft, setDraft }) {
  return (
    <>
      <div className="field">
        <span>Picture</span>
        <div className="cover-choices">
          {COVERS.map((cover) => (
            <button
              key={cover.url}
              type="button"
              className={`cover-choice${(draft.cover || DEFAULT_COVER) === cover.url ? ' on' : ''}`}
              onClick={() => setDraft({ ...draft, cover: cover.url === DEFAULT_COVER ? '' : cover.url })}
              title={`${cover.name} (${cover.licence})`}
            >
              <img src={cover.url} alt={cover.name} loading="lazy" referrerPolicy="no-referrer" />
            </button>
          ))}
        </div>
        <input
          value={draft.cover}
          onChange={(e) => setDraft({ ...draft, cover: e.target.value })}
          placeholder="Or paste a link to any image"
          aria-label="Link to a picture"
          maxLength={2000}
        />
      </div>
      <div className="field color-field">
        <span>Background colour</span>
        <input type="color" value={draft.color || '#ffffff'} onChange={(e) => setDraft({ ...draft, color: e.target.value })} aria-label="Background colour" />
        {draft.color && (
          <button type="button" className="ghost" onClick={() => setDraft({ ...draft, color: '' })}>
            Default
          </button>
        )}
      </div>
    </>
  );
}

export default function NetworkList({ user, onLogout }) {
  const [networks, setNetworks] = useState(null);
  // The "Create New" window: closed (null) or open with the values typed so far.
  const [creating, setCreating] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // The network being edited, or null, and the values typed so far.
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState({ name: '', cover: '', color: '' });

  const load = () => api.networks().then(setNetworks).catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  async function create(event) {
    event.preventDefault();
    const name = creating.name.trim();
    if (!name) return;
    setError('');
    setBusy(true);
    try {
      const network = await api.createNetwork(name);
      // The picture and colour, if chosen, are saved the same way an edit saves them.
      if (creating.cover.trim() || creating.color) {
        await api.editNetwork(network.id, { name, cover_url: creating.cover.trim() || null, tile_color: creating.color || null });
      }
      window.location.hash = `#/networks/${network.id}`;
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  function startEdit(network) {
    if (editing === network.id) {
      setEditing(null);
      return;
    }
    setEditing(network.id);
    setDraft({ name: network.name, cover: network.cover_url || '', color: network.tile_color || '' });
  }

  async function saveEdit(event, network) {
    event.preventDefault();
    const name = draft.name.trim();
    if (!name) return;
    setError('');
    try {
      const updated = await api.editNetwork(network.id, {
        name,
        cover_url: draft.cover.trim() || null,
        tile_color: draft.color || null,
      });
      setNetworks((list) =>
        list.map((n) => (n.id === network.id ? { ...n, name: updated.name, cover_url: updated.cover_url, tile_color: updated.tile_color } : n))
      );
      setEditing(null);
    } catch (e) {
      setError(e.message);
    }
  }

  async function remove(network) {
    if (!window.confirm(`Delete "${network.name}" and all its links?`)) return;
    try {
      await api.deleteNetwork(network.id);
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <main className="page page-wide">
      {user && (
        <div className="account-bar">
          <span title="You are signed in as">{user.email}</span>
          <button className="ghost" onClick={onLogout}>
            Log out
          </button>
        </div>
      )}
      <header className="page-header">
        <h1>Graphin</h1>
        <p className="tagline">A visual network for research, ideas, and knowledge.</p>
      </header>

      {error && <p className="error">{error}</p>}

      {networks === null && <p className="muted">Loading…</p>}
      {networks && (
        <ul className="network-tiles">
          <li className="network-new">
            <button type="button" onClick={() => setCreating({ name: '', cover: '', color: '' })}>
              <span className="plus" aria-hidden="true">+</span>
              <span>Create New</span>
            </button>
          </li>
          {networks.map((network) => (
            <li
              key={network.id}
              className="network-tile"
              style={network.tile_color ? { '--tile': network.tile_color, '--tile-text': readableOn(network.tile_color) } : undefined}
            >
              <a className="network-cover" href={`#/networks/${network.id}`} tabIndex={-1} aria-hidden="true">
                <img
                  src={network.cover_url || DEFAULT_COVER}
                  alt=""
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    // A cover that no longer loads falls back to the default picture.
                    if (e.currentTarget.src !== DEFAULT_COVER) e.currentTarget.src = DEFAULT_COVER;
                  }}
                />
              </a>
              <div className="network-body">
                <div className="network-head">
                  <a className="network-name" href={`#/networks/${network.id}`}>
                    <strong>{network.name}</strong>
                    <span>{network.node_count} links</span>
                  </a>
                  <button className="icon-btn" onClick={() => startEdit(network)} aria-expanded={editing === network.id} aria-label={`Edit ${network.name}`} title="Edit name, picture and colour">
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                    </svg>
                  </button>
                  <button className="icon-btn danger" onClick={() => remove(network)} aria-label={`Delete ${network.name}`} title="Delete">
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M3 6h18" />
                      <path d="M8 6V4h8v2" />
                      <path d="M19 6l-1 14H6L5 6" />
                      <path d="M10 11v5M14 11v5" />
                    </svg>
                  </button>
                </div>
                {editing === network.id && (
                  <form className="tile-edit" onSubmit={(e) => saveEdit(e, network)} onKeyDown={(e) => e.key === 'Escape' && setEditing(null)}>
                    <label>
                      Name
                      <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} maxLength={255} autoFocus />
                    </label>
                    <TileFields draft={draft} setDraft={setDraft} />
                    <div className="tile-edit-buttons">
                      <button type="submit" disabled={!draft.name.trim()}>
                        Save
                      </button>
                      <button type="button" className="ghost" onClick={() => setEditing(null)}>
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {creating && (
        <div className="overlay" onMouseDown={() => !busy && setCreating(null)}>
          <form
            className="dialog new-network-dialog"
            onMouseDown={(e) => e.stopPropagation()}
            onSubmit={create}
            onKeyDown={(e) => e.key === 'Escape' && !busy && setCreating(null)}
          >
            <h2>Create a new network</h2>
            <label>
              Name
              <input
                value={creating.name}
                onChange={(e) => setCreating({ ...creating, name: e.target.value })}
                placeholder="For example: AI Career Network"
                maxLength={255}
                autoFocus
              />
            </label>
            <div className="tile-edit">
              <TileFields draft={creating} setDraft={setCreating} />
            </div>
            {error && <p className="error">{error}</p>}
            <div className="form-row end">
              <button type="button" className="ghost" onClick={() => setCreating(null)} disabled={busy}>
                Cancel
              </button>
              <button type="submit" disabled={busy || !creating.name.trim()}>
                {busy ? 'Creating…' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}

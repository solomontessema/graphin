import { useEffect, useState } from 'react';
import { api } from '../api.js';

/**
 * Shares a network as a link. Anyone who has the link can read the network without an account, and can copy it into their own
 * account. They cannot change it. The owner can stop sharing at any time, or make a new link so the old one stops working.
 */
export default function ShareDialog({ networkId, onClose }) {
  // null while the state is being read, then { shared, token }.
  const [state, setState] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .shareStatus(networkId)
      .then(setState)
      .catch((e) => setError(e.message));
  }, [networkId]);

  // The address of the app's own page, with the secret after it.
  const link = state?.token ? `${new URL('./', window.location.href).href}#/shared/${state.token}` : '';

  async function change(work) {
    setError('');
    setCopied(false);
    setBusy(true);
    try {
      await work();
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  }

  const start = (regenerate = false) => change(async () => setState(await api.share(networkId, regenerate)));
  const stop = () =>
    change(async () => {
      await api.unshare(networkId);
      setState({ shared: false, token: null });
    });

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="dialog" onMouseDown={(e) => e.stopPropagation()}>
        <h2>Share this graph</h2>

        {state === null && !error && <p className="muted">Loading…</p>}

        {state && !state.shared && (
          <>
            <p>
              Make a link that lets anyone read this graph, without an account. They can look around and open tiles, but they cannot change
              anything. They can also copy it into their own account.
            </p>
            <div className="form-row end">
              <button type="button" className="ghost" onClick={onClose}>
                Cancel
              </button>
              <button type="button" disabled={busy} onClick={() => start()}>
                {busy ? 'One moment…' : 'Create share link'}
              </button>
            </div>
          </>
        )}

        {state?.shared && (
          <>
            <p>Anyone with this link can read this graph. They cannot change it.</p>
            <input className="share-link" readOnly value={link} onFocus={(e) => e.target.select()} aria-label="Share link" />
            <div className="form-row end">
              <button type="button" onClick={copy}>
                {copied ? 'Copied' : 'Copy link'}
              </button>
            </div>
            <p className="muted small">
              Stop sharing and the link stops working at once. Make a new link if the old one has gone further than you meant: the old
              link stops working and you share the new one.
            </p>
            <div className="form-row end">
              <button type="button" className="ghost" disabled={busy} onClick={() => start(true)}>
                Make a new link
              </button>
              <button type="button" className="danger" disabled={busy} onClick={stop}>
                Stop sharing
              </button>
            </div>
          </>
        )}

        {error && <p className="error">{error}</p>}

        {state?.shared && (
          <div className="form-row end">
            <button type="button" onClick={onClose}>
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

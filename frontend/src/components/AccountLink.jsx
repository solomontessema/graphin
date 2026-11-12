import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';

const PASSWORD_MIN = 8;

/**
 * The page an emailed link opens. #/verify?token=… confirms a new address and signs the person in. #/reset?token=…
 * lets them choose a new password, then they log in with it. Each link works once.
 */
export default function AccountLink({ kind, token, onSignedIn, onBack }) {
  const [status, setStatus] = useState(kind === 'verify' ? 'working' : 'form'); // working | form | done | failed
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  // React can run an effect twice in development; the link is used only once, so the request is sent once.
  const started = useRef(false);

  useEffect(() => {
    if (kind !== 'verify' || started.current) return;
    started.current = true;
    api
      .verify(token)
      .then((result) => onSignedIn(result.user))
      .catch((e) => {
        setMessage(e.message);
        setStatus('failed');
      });
  }, [kind, token, onSignedIn]);

  async function reset(event) {
    event.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      setMessage((await api.resetPassword(token, password)).message);
      setStatus('done');
    } catch (e) {
      // A wrong password keeps the form open; a link that cannot be used any more ends it.
      if (e.status === 422) {
        setError(e.message);
      } else {
        setMessage(e.message);
        setStatus('failed');
      }
    }
    setBusy(false);
  }

  return (
    <main className="account-page">
      <div className="account-card">
        {status === 'working' && <p className="account-text">Confirming your email address…</p>}

        {status === 'failed' && (
          <>
            <h2 className="join-title">This link cannot be used</h2>
            <p className="account-text">{message}</p>
            <button type="button" className="join-submit" onClick={() => onBack()}>
              Back to Graphin
            </button>
          </>
        )}

        {status === 'done' && (
          <>
            <h2 className="join-title">Password changed</h2>
            <p className="account-text">{message}</p>
            <button type="button" className="join-submit" onClick={() => onBack('Your password has been changed. Log in with the new password.')}>
              Log in
            </button>
          </>
        )}

        {status === 'form' && (
          <form onSubmit={reset}>
            <h2 className="join-title">Choose a new password</h2>
            <label>
              New password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                placeholder={`At least ${PASSWORD_MIN} characters`}
                required
                minLength={PASSWORD_MIN}
                maxLength={200}
                autoFocus
              />
            </label>
            <label>
              Confirm new password
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                required
                minLength={PASSWORD_MIN}
                maxLength={200}
              />
            </label>
            {error && <p className="error" role="alert">{error}</p>}
            <button type="submit" className="join-submit" disabled={busy}>
              {busy ? 'Saving…' : 'Save new password'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

import { useEffect, useState } from 'react';
import { api } from './api.js';
import NetworkList from './components/NetworkList.jsx';
import NetworkView from './components/NetworkView.jsx';
import CapturePage from './components/CapturePage.jsx';
import Landing from './components/Landing.jsx';
import AccountLink from './components/AccountLink.jsx';

/** The network id from the hash, as in #/networks/{id}. */
function readNetworkId() {
  const match = window.location.hash.match(/^#\/networks\/(.+)$/);
  return match ? match[1] : null;
}

/** The link from an email, as in #/verify?token=… or #/reset?token=…: { kind, token }, or null. */
function readAccountLink() {
  const match = window.location.hash.match(/^#\/(verify|reset)\?token=([a-f0-9]{64})$/);
  return match ? { kind: match[1], token: match[2] } : null;
}

// The bookmarklet opens the capture form in a small window: at /capture on its own server, or as index.html?capture=1
// in a subfolder of shared hosting, where /capture would not reach the app.
const isCapturePage = () => window.location.pathname === '/capture' || new URLSearchParams(window.location.search).get('capture') === '1';

export default function App() {
  const [networkId, setNetworkId] = useState(readNetworkId);
  // Who is signed in: null while we ask the server, then { mode, user }. mode "local" means no accounts (the desktop app).
  const [auth, setAuth] = useState(null);
  // A link from an email that is being handled (confirm an address, or choose a new password).
  const [accountLink, setAccountLink] = useState(readAccountLink);
  // A message for the sign-in page, such as "your password has been changed".
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const onHashChange = () => {
      setNetworkId(readNetworkId());
      setAccountLink(readAccountLink());
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  function leaveAccountLink(message = '') {
    setNotice(typeof message === 'string' ? message : '');
    setAccountLink(null);
    window.location.hash = '';
  }

  function signedInFromLink(user) {
    setAuth({ mode: 'accounts', user });
    leaveAccountLink();
  }

  useEffect(() => {
    api
      .me()
      .then(setAuth)
      .catch(() => setAuth({ mode: 'accounts', user: null }));
    // Any request answered "please log in" sends the person back to the landing page.
    const onUnauthorized = () => setAuth({ mode: 'accounts', user: null });
    window.addEventListener('graphin:unauthorized', onUnauthorized);
    return () => window.removeEventListener('graphin:unauthorized', onUnauthorized);
  }, []);

  async function logout() {
    await api.logout().catch(() => {});
    window.location.hash = '';
    setAuth({ mode: 'accounts', user: null });
  }

  if (auth === null) {
    return <div className="boot" aria-busy="true" />;
  }
  if (accountLink) {
    return <AccountLink kind={accountLink.kind} token={accountLink.token} onSignedIn={signedInFromLink} onBack={leaveAccountLink} />;
  }
  if (auth.mode === 'accounts' && !auth.user) {
    // The bookmarklet window has no room for a landing page: it asks to sign in first.
    if (isCapturePage()) {
      return (
        <main className="page">
          <h1>Graphin</h1>
          <p>Log in to Graphin in your main window first, then use the bookmarklet again.</p>
          <p>
            <a href="./">Open Graphin</a>
          </p>
        </main>
      );
    }
    return <Landing onAuth={setAuth} notice={notice} />;
  }

  // The bookmarklet opens /capture in a small window. It is a separate page, not a canvas view.
  if (isCapturePage()) {
    return <CapturePage />;
  }
  if (networkId) {
    return <NetworkView key={networkId} networkId={networkId} user={auth.user} onLogout={logout} />;
  }
  return <NetworkList user={auth.user} onLogout={logout} />;
}

import { useEffect, useState } from 'react';
import NetworkList from './components/NetworkList.jsx';
import NetworkView from './components/NetworkView.jsx';
import CapturePage from './components/CapturePage.jsx';

/** The network id from the hash, as in #/networks/{id}. */
function readNetworkId() {
  const match = window.location.hash.match(/^#\/networks\/(.+)$/);
  return match ? match[1] : null;
}

export default function App() {
  const [networkId, setNetworkId] = useState(readNetworkId);

  useEffect(() => {
    const onHashChange = () => setNetworkId(readNetworkId());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // The bookmarklet opens /capture in a small window. It is a separate page, not a canvas view.
  if (window.location.pathname === '/capture') {
    return <CapturePage />;
  }
  if (networkId) {
    return <NetworkView key={networkId} networkId={networkId} />;
  }
  return <NetworkList />;
}

import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function NetworkList() {
  const [networks, setNetworks] = useState(null);
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const load = () => api.networks().then(setNetworks).catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  async function create(event) {
    event.preventDefault();
    if (!name.trim()) return;
    try {
      const network = await api.createNetwork(name.trim());
      window.location.hash = `#/networks/${network.id}`;
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
    <main className="page">
      <header className="page-header">
        <h1>Graphin</h1>
        <p className="tagline">A visual network for research, ideas, and knowledge.</p>
      </header>

      <form className="create-row" onSubmit={create}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New network, for example AI Career Network"
          maxLength={255}
        />
        <button type="submit">Create network</button>
      </form>

      {error && <p className="error">{error}</p>}

      {networks === null && <p className="muted">Loading…</p>}
      {networks && networks.length === 0 && <p className="muted">No networks yet. Create one to start.</p>}
      {networks && networks.length > 0 && (
        <ul className="network-list">
          {networks.map((network) => (
            <li key={network.id}>
              <a href={`#/networks/${network.id}`}>
                <strong>{network.name}</strong>
                <span className="muted">{network.node_count} links</span>
              </a>
              <button className="ghost" onClick={() => remove(network)}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

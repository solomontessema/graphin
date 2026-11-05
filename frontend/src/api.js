const BASE = '/api';

/** Sends a JSON request. Returns the parsed body, or null for 204 responses. Throws with the server's message. */
async function request(method, path, body) {
  const response = await fetch(BASE + path, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (response.status === 204) {
    return null;
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }
  return data;
}

export const api = {
  networks: () => request('GET', '/networks'),
  createNetwork: (name) => request('POST', '/networks', { name }),
  renameNetwork: (id, name) => request('PUT', `/networks/${id}`, { name }),
  deleteNetwork: (id) => request('DELETE', `/networks/${id}`),
  graph: (id) => request('GET', `/networks/${id}/graph`),
  savePositions: (id, items) => request('PUT', `/networks/${id}/positions`, items),
  createNode: (networkId, data) => request('POST', `/networks/${networkId}/nodes`, data),
  updateNode: (id, data) => request('PUT', `/nodes/${id}`, data),
  updateEdge: (id, data) => request('PUT', `/edges/${id}`, data),
  deleteNode: (id) => request('DELETE', `/nodes/${id}`),
  createEdge: (networkId, data) => request('POST', `/networks/${networkId}/edges`, data),
  deleteEdge: (id) => request('DELETE', `/edges/${id}`),
};

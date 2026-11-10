const BASE = '/api';

/** Sends a JSON request. Returns the parsed body, or null for 204 responses. Throws with the server's message. */
async function request(method, path, body) {
  const response = await fetch(BASE + path, {
    method,
    // The second header marks the request as coming from Graphin itself; the server refuses changes without it.
    headers: { 'X-Requested-With': 'graphin', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (response.status === 204) {
    return null;
  }
  const data = await response.json().catch(() => ({}));
  if (response.status === 401 && !path.startsWith('/auth/')) {
    // The session ended: App shows the sign-in page.
    window.dispatchEvent(new Event('graphin:unauthorized'));
  }
  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }
  return data;
}

export const api = {
  me: () => request('GET', '/auth/me'),
  register: (email, password) => request('POST', '/auth/register', { email, password }),
  login: (email, password) => request('POST', '/auth/login', { email, password }),
  logout: () => request('POST', '/auth/logout'),
  networks: () => request('GET', '/networks'),
  createNetwork: (name) => request('POST', '/networks', { name }),
  editNetwork: (id, fields) => request('PUT', `/networks/${id}`, fields),
  renameNetwork: (id, name) => request('PUT', `/networks/${id}`, { name }),
  setTagColours: (id, tagColors) => request('PUT', `/networks/${id}`, { tag_colors: tagColors }),
  deleteNetwork: (id) => request('DELETE', `/networks/${id}`),
  graph: (id) => request('GET', `/networks/${id}/graph`),
  savePositions: (id, items) => request('PUT', `/networks/${id}/positions`, items),
  restoreState: (id, state) => request('PUT', `/networks/${id}/restore`, state),
  embeddable: (url) => request('GET', `/embeddable?url=${encodeURIComponent(url)}`),
  createNode: (networkId, data) => request('POST', `/networks/${networkId}/nodes`, data),
  updateNode: (id, data) => request('PUT', `/nodes/${id}`, data),
  updateEdge: (id, data) => request('PUT', `/edges/${id}`, data),
  deleteNode: (id) => request('DELETE', `/nodes/${id}`),
  createEdge: (networkId, data) => request('POST', `/networks/${networkId}/edges`, data),
  deleteEdge: (id) => request('DELETE', `/edges/${id}`),
};

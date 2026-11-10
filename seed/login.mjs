// Signs the seed scripts in. The web product has accounts, so a script must act as a user. Set the account in the
// environment, then run a seed script as usual:
//
//   GRAPHIN_EMAIL=you@example.com GRAPHIN_PASSWORD=secret node seed/pandemics.mjs
//
// Calling login(base) once makes every later fetch() in the process send the session cookie. Without GRAPHIN_EMAIL
// it does nothing, which is right for the desktop app, which has no accounts.
export async function login(base) {
  const email = process.env.GRAPHIN_EMAIL;
  if (!email) return;
  const headers = { 'Content-Type': 'application/json', 'X-Requested-With': 'graphin' };
  const response = await fetch(base + '/api/auth/login', { method: 'POST', headers, body: JSON.stringify({ email, password: process.env.GRAPHIN_PASSWORD || '' }) });
  if (!response.ok) throw new Error(`Could not log in as ${email}: ${(await response.json().catch(() => ({}))).error || response.status}`);
  const cookie = response.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  const plain = globalThis.fetch;
  globalThis.fetch = (url, options = {}) => plain(url, { ...options, headers: { ...(options.headers || {}), Cookie: cookie, 'X-Requested-With': 'graphin' } });
}

import { useState } from 'react';
import { api } from '../api.js';
import appShot from '../assets/landing-app.jpg';

const FEATURES = [
  {
    icon: 'Connect',
    title: 'Think in connections',
    text: 'Save web pages, videos, images, PDFs and your own notes as tiles on an open canvas. Draw links between them and see how ideas relate, instead of burying them in folders.',
  },
  {
    icon: 'Code',
    title: 'Code your material with tags',
    text: 'Tag tiles and links with themes, concepts, stance or confidence. Filter by tag, and colour the whole graph by tag to see patterns at a glance.',
  },
  {
    icon: 'Relate',
    title: 'Say how things relate',
    text: 'Choose from standard relationships such as supports, contradicts, causes and leads to, or write your own. Reference links and your commentary stay attached to each tile.',
  },
  {
    icon: 'Locate',
    title: 'Put it on a map',
    text: 'Give a tile a place and see your research on a world map you can switch between types. Lay a whole graph out by geography in one click.',
  },
  {
    icon: 'Date',
    title: 'Move through time',
    text: 'Date your tiles, even millions of years back, then scrub the time slider to watch a story unfold. A timeline layout lines everything up by date.',
  },
  {
    icon: 'Search',
    title: 'Find and focus',
    text: 'Search titles, notes and tags, show only the part of the graph you need, and keep every graph in its own picture tile on your home page.',
  },
];

const AUDIENCE = [
  ['Students', 'Map a course, a reading list or a thesis chapter, and see how the authors and ideas connect.'],
  ['Researchers', 'Code sources with tags, record how studies support or contradict each other, and keep your notes next to the evidence.'],
  ['Teachers', 'Build a graph of a topic to teach from, with dates, places and linked sources your class can follow.'],
  ['Writers and curious minds', 'Gather what you find on a subject and turn it into a structure you can write from.'],
]

const STEPS = [
  ['1', 'Collect', 'Drop in pages, notes, images and videos as tiles.'],
  ['2', 'Connect and code', 'Link them, name the relationship and add tags.'],
  ['3', 'Explore', 'Filter by tag, then see it on the map and through time.'],
];

/** A drawn network: the hero picture. Pure decoration. */
function HeroGraphic() {
  const nodes = [
    [70, 60, 16, '#6aa9ff'], [190, 30, 12, '#34d399'], [300, 90, 18, '#f59e0b'], [150, 140, 22, '#a78bfa'],
    [40, 190, 12, '#f472b6'], [260, 200, 14, '#6aa9ff'], [370, 40, 10, '#34d399'], [350, 170, 12, '#f472b6'], [210, 260, 12, '#f59e0b'],
    [90, 280, 10, '#34d399'], [330, 280, 16, '#a78bfa'],
  ];
  const links = [[0, 3], [1, 3], [1, 2], [2, 3], [3, 4], [3, 5], [2, 6], [2, 7], [5, 7], [3, 8], [8, 9], [8, 10], [5, 10], [4, 9], [0, 1]];
  return (
    <svg className="hero-graphic" viewBox="0 0 420 320" role="img" aria-label="A network of connected, colour-coded tiles">
      <defs>
        <radialGradient id="glow" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="#1e3a5f" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#1e3a5f" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="420" height="320" fill="url(#glow)" />
      {links.map(([a, b], i) => (
        <line key={i} x1={nodes[a][0]} y1={nodes[a][1]} x2={nodes[b][0]} y2={nodes[b][1]} stroke="#8a93a6" strokeWidth="1.5" opacity="0.8" />
      ))}
      {nodes.map(([x, y, r, colour], i) => (
        <g key={i} className="hero-node" style={{ animationDelay: `${i * 0.35}s` }}>
          <circle cx={x} cy={y} r={r + 7} fill={colour} opacity="0.18" />
          <circle cx={x} cy={y} r={r} fill="#ffffff" stroke={colour} strokeWidth="3" />
        </g>
      ))}
    </svg>
  );
}

/**
 * The page people see before they sign in: what Graphin is, that it is free, and the forms to sign up, log in and reset
 * a forgotten password. A new account must confirm its email address (the link is emailed) before it can log in.
 * `notice` is a message to show on the log-in form, for example after a password was reset.
 */
export default function Landing({ onAuth, notice = '' }) {
  // 'login' (the default), 'register' (sign-up), or 'forgot' (asks for a link to choose a new password).
  const [mode, setMode] = useState('login');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState(notice);
  const [busy, setBusy] = useState(false);
  // After signing up: the address the confirmation link was sent to.
  const [awaiting, setAwaiting] = useState('');
  // A log-in refused because the address is not confirmed yet.
  const [unconfirmed, setUnconfirmed] = useState(false);
  const registering = mode === 'register';

  async function submit(event) {
    event.preventDefault();
    setError('');
    setInfo('');
    setUnconfirmed(false);
    setBusy(true);
    try {
      if (mode === 'forgot') {
        setInfo((await api.forgotPassword(email)).message);
      } else if (registering) {
        const result = await api.register({ firstName: firstName.trim(), lastName: lastName.trim(), email, password });
        setAwaiting(result.email || email);
        setPassword('');
      } else {
        onAuth(await api.login(email, password));
      }
    } catch (e) {
      setError(e.message);
      setUnconfirmed(mode === 'login' && e.status === 403);
    }
    setBusy(false);
  }

  async function resend(address) {
    setError('');
    setInfo('');
    setBusy(true);
    try {
      setInfo((await api.resendVerification(address)).message);
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  }

  function show(next) {
    setMode(next);
    setError('');
    setInfo('');
    setUnconfirmed(false);
    setAwaiting('');
    document.getElementById('join')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  return (
    <div className="landing">
      <nav className="landing-nav">
        <span className="landing-logo">Graphin</span>
        <div>
          <button className="ghost" onClick={() => show('login')}>
            Log in
          </button>
          <button onClick={() => show('register')}>Sign up free</button>
        </div>
      </nav>

      <header className="landing-hero">
        <div className="hero-copy">
          <span className="free-badge">100% free to use</span>
          <h1>Make sense of what you read: see how ideas connect.</h1>
          <p>
            Graphin is a free visual workspace for studying and research. Collect sources and notes as a network, connect them, code them
            with tags, and explore the result on a map and through time.
          </p>
          <ul className="hero-points">
            <li>Free account. No credit card.</li>
            <li>Tags, maps and timelines included.</li>
            <li>Works in your browser, nothing to install.</li>
          </ul>
        </div>

        <div id="join" className="join-card">
          {awaiting ? (
            <>
              <h2 className="join-title">Check your email</h2>
              <p className="join-text">
                We sent a link to <strong>{awaiting}</strong>. Open it to confirm your address and you will be signed in. The link works for 48 hours.
              </p>
              {info && <p className="join-note" role="status">{info}</p>}
              {error && <p className="error" role="alert">{error}</p>}
              <button type="button" className="join-submit" disabled={busy} onClick={() => resend(awaiting)}>
                {busy ? 'One moment…' : 'Send a new link'}
              </button>
              <p className="join-note">
                Wrong address?{' '}
                <button type="button" className="link-button" onClick={() => show('register')}>
                  Start again
                </button>
              </p>
            </>
          ) : (
            <form onSubmit={submit}>
              {mode === 'forgot' ? (
                <>
                  <h2 className="join-title">Reset your password</h2>
                  <p className="join-text">Enter the email address you signed up with. We will send a link to choose a new password.</p>
                </>
              ) : (
                <div className="join-tabs" role="tablist">
                  <button type="button" role="tab" aria-selected={registering} className={registering ? 'on' : ''} onClick={() => show('register')}>
                    Create free account
                  </button>
                  <button type="button" role="tab" aria-selected={!registering} className={!registering ? 'on' : ''} onClick={() => show('login')}>
                    Log in
                  </button>
                </div>
              )}
              {registering && (
                <div className="name-row">
                  <label>
                    First name
                    <input value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" required maxLength={100} />
                  </label>
                  <label>
                    Last name
                    <input value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" required maxLength={100} />
                  </label>
                </div>
              )}
              <label>
                Email (your username)
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" placeholder="you@example.com" required maxLength={254} />
              </label>
              {mode !== 'forgot' && (
                <label>
                  Password
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={registering ? 'new-password' : 'current-password'}
                    placeholder={registering ? 'At least 8 characters' : 'Your password'}
                    required
                    maxLength={200}
                  />
                </label>
              )}
              {!registering && mode !== 'forgot' && (
                <p className="join-note">
                  <button type="button" className="link-button" onClick={() => show('forgot')}>
                    Forgot password?
                  </button>
                </p>
              )}
              {info && <p className="join-note" role="status">{info}</p>}
              {error && <p className="error" role="alert">{error}</p>}
              {unconfirmed && (
                <p className="join-note">
                  <button type="button" className="link-button" disabled={busy} onClick={() => resend(email)}>
                    Send me a new confirmation link
                  </button>
                </p>
              )}
              <button type="submit" className="join-submit" disabled={busy}>
                {busy
                  ? 'One moment…'
                  : mode === 'forgot'
                    ? 'Send reset link'
                    : registering
                      ? 'Create my free account'
                      : 'Log in'}
              </button>
              <p className="join-note">
                {mode === 'forgot' ? (
                  <button type="button" className="link-button" onClick={() => show('login')}>
                    Back to log in
                  </button>
                ) : registering ? (
                  <>
                    Free to use. Already have an account?{' '}
                    <button type="button" className="link-button" onClick={() => show('login')}>
                      Log in
                    </button>
                  </>
                ) : (
                  <>
                    New to Graphin?{' '}
                    <button type="button" className="link-button" onClick={() => show('register')}>
                      Create a free account
                    </button>
                  </>
                )}
              </p>
            </form>
          )}
        </div>
      </header>

      <section className="landing-showcase">
        <div className="showcase-shot">
          <div className="shot-bar"><i /><i /><i /></div>
          <img src={appShot} alt="A Graphin graph about human evolution and migration: colour-coded tiles joined by labelled links" loading="lazy" />
        </div>
      </section>

      <section className="landing-section">
        <h2>Everything you need to make sense of a topic</h2>
        <p className="section-lead">One canvas, from the first scattered link to a finished picture of how it all fits together.</p>
        <div className="feature-grid">
          {FEATURES.map((f) => (
            <article key={f.title} className="feature">
              <span className="feature-icon">{f.icon}</span>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section">
        <h2>Who uses Graphin</h2>
        <p className="section-lead">Anyone who needs to understand how many sources fit together.</p>
        <div className="audience-grid">
          {AUDIENCE.map(([who, text]) => (
            <article key={who} className="audience">
              <h3>{who}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section">
        <h2>How it works</h2>
        <ol className="steps">
          {STEPS.map(([n, title, text]) => (
            <li key={n}>
              <span className="step-number">{n}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="landing-cta">
        <HeroGraphic />
        <h2>Start your first graph today. It is free.</h2>
        <button className="cta-button" onClick={() => show('register')}>
          Create my free account
        </button>
      </section>

      <footer className="landing-footer">Graphin: a free visual network for study, research and teaching.</footer>
    </div>
  );
}

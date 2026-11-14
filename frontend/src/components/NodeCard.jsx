import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { asHttpUrl, hostFromUrl } from '../utils.js';
import { referenceName } from './ReferencesBadge.jsx';
import { KIND_LABEL, kindOf, linksOf, mediaOf } from '../links.js';
import { tagColour } from '../tags.js';
import StyleEditor from './StyleEditor.jsx';
import TagEditor from './TagEditor.jsx';

/**
 * A small card that opens beside a node, as in NeuLexi's graph previews. For a web page it has a link to the
 * site; hovering the link reveals the saved page in an iframe. The commentary is shown on the node itself.
 * The card scrolls on its own. Edit switches it to the link's details and relationships.
 */
export default function NodeCard({
  node,
  style,
  mode,
  onMode,
  onClose,
  edges,
  titles,
  onChange,
  onDelete,
  onDeleteEdge,
  onOpenNode,
  onEnter,
  onLeave,
  onShape,
  allTags,
  tagColours,
}) {
  return (
    <div className="node-card" style={style} role="dialog" aria-label={node.title} onMouseEnter={onEnter} onMouseLeave={onLeave}>
      <header className="card-header">
        <div className="card-title">
          {(node.type === 'text' || node.type === 'shape') && <span className="type-badge">{node.type === 'text' ? 'label' : 'shape'}</span>}
          <strong title={node.title}>{node.title}</strong>
        </div>
        <div className="card-actions">
          <button className="ghost small" onClick={() => onMode(mode === 'edit' ? 'preview' : 'edit')}>
            {mode === 'edit' ? 'Preview' : 'Edit'}
          </button>
          {linksOf(node)[0] && (
            <a href={linksOf(node)[0].url} target="_blank" rel="noreferrer">
              Open ↗
            </a>
          )}
          <button className="ghost small" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
      </header>

      {mode === 'edit' ? (
        <DetailsBody
          key={node.id}
          node={node}
          edges={edges}
          titles={titles}
          onChange={onChange}
          onDelete={onDelete}
          onDeleteEdge={onDeleteEdge}
          onOpenNode={onOpenNode}
          onShape={onShape}
          allTags={allTags}
          tagColours={tagColours}
        />
      ) : (
        <PreviewBody node={node} tagColours={tagColours} />
      )}
    </div>
  );
}

function PreviewBody({ node, tagColours }) {
  // The first image or video is shown at the top; every link is listed below, whatever it points to.
  const media = mediaOf(node);
  const links = linksOf(node);

  return (
    <div className="card-body preview-body">
      {node.tags?.length > 0 && (
        <p className="tag-chips">
          {node.tags.map((tag) => (
            <span key={tag} className="tag-chip" style={{ '--tag': tagColour(tag, tagColours) }}>
              {tag}
            </span>
          ))}
        </p>
      )}

      {media?.src && <img className="preview-image" src={media.src} alt={node.title} referrerPolicy="no-referrer" />}

      {links.length > 0 && (
        <div className="ref-links">
          <h3>External References</h3>
          <ul>
            {links.map((link, i) => (
              <li key={`${i}-${link.url}`}>
                <span className="ref-kind">{KIND_LABEL[kindOf(link.url)]}</span>{' '}
                <a href={link.url} target="_blank" rel="noreferrer" title={link.url}>
                  {referenceName(link)} ↗
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function DetailsBody({ node, edges, titles, onChange, onDelete, onDeleteEdge, onOpenNode, onShape, allTags, tagColours }) {
  const [title, setTitle] = useState(node.title);
  const [commentary, setCommentary] = useState(node.commentary || '');
  const [time, setTime] = useState(node.time || '');
  const [latitude, setLatitude] = useState(node.latitude ?? '');
  const [longitude, setLongitude] = useState(node.longitude ?? '');
  const [country, setCountry] = useState(node.country || '');
  const [error, setError] = useState('');
  // 'saved', 'unsaved' (a change waits to be saved), 'saving', or 'error'. Shown in the bar at the top of the card.
  const [status, setStatus] = useState('saved');
  const [countryNames, setCountryNames] = useState([]);
  // Edits are saved by themselves (see below). These keep what to save, and whether anything is waiting.
  const values = {
    title,
    commentary: commentary.trim() || null,
    time: time.trim() || null,
    latitude: latitude === '' ? null : Number(latitude),
    longitude: longitude === '' ? null : Number(longitude),
    country: country.trim() || null,
  };
  const latest = useRef(values);
  latest.current = values;
  const dirty = useRef(false);
  const mounted = useRef(false);
  const timer = useRef(null);
  const sequence = useRef(0);
  // The countries of the world map are offered as you type; any other name can still be written.
  useEffect(() => {
    let live = true;
    import('../worldCountries.js').then((m) => live && setCountryNames(m.COUNTRIES.map((c) => c.n).sort()));
    return () => {
      live = false;
    };
  }, []);

  // Sends the edits to the server. A failed save is kept and tried again on the next change, and says so.
  async function flush() {
    clearTimeout(timer.current);
    if (!dirty.current) return;
    const toSave = latest.current;
    if (!toSave.title.trim()) {
      setStatus('error');
      setError('Give the tile a title. It is saved once it has one.');
      return;
    }
    dirty.current = false;
    const mine = ++sequence.current;
    setStatus('saving');
    setError('');
    try {
      const updated = await api.updateNode(node.id, toSave);
      onChange(updated);
      if (mine === sequence.current && !dirty.current) setStatus('saved');
    } catch (e) {
      dirty.current = true;
      setStatus('error');
      setError(e.message);
    }
  }

  // Any change marks the tile as unsaved and saves it shortly after the last change.
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return undefined;
    }
    dirty.current = true;
    setStatus('unsaved');
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 700);
    return undefined;
  }, [title, commentary, time, latitude, longitude, country]);

  // A change made just before the card closes is still saved.
  useEffect(() => () => {
    if (dirty.current) flush();
  }, []);

  const related = edges.filter((e) => e.source_id === node.id || e.target_id === node.id);

  return (
    <div className="card-body">
      {/* The status stays at the top of the card, so it is in view however far the card is scrolled. */}
      <div className="card-save-bar">
        <span className={`autosave autosave-${status}`} role="status" aria-live="polite">
          {status === 'saving' && 'Saving…'}
          {status === 'unsaved' && 'Changes saving…'}
          {status === 'saved' && '✓ All changes saved'}
          {status === 'error' && error}
        </span>
      </div>
      <form className="details-form" onSubmit={(event) => { event.preventDefault(); flush(); }} onBlur={flush}>
        <label>
          Title
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={255} required />
        </label>
        <label>
          Notes
          <textarea value={commentary} onChange={(e) => setCommentary(e.target.value)} rows={5} maxLength={20000} />
        </label>
        <h3>When and where</h3>
        <div className="place-grid">
          <label className="wide">
            Time
            <input
              value={time}
              onChange={(e) => setTime(e.target.value)}
              placeholder="1945, 1945-08-06, or -300000 for 300,000 BCE"
              maxLength={16}
            />
          </label>
          <label>
            Latitude
            <input type="number" step="any" min={-90} max={90} value={latitude} onChange={(e) => setLatitude(e.target.value)} />
          </label>
          <label>
            Longitude
            <input type="number" step="any" min={-180} max={180} value={longitude} onChange={(e) => setLongitude(e.target.value)} />
          </label>
          <label className="wide">
            Country
            <input value={country} list="country-names" onChange={(e) => setCountry(e.target.value)} maxLength={100} />
            <datalist id="country-names">
              {countryNames.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </label>
        </div>
        <div className="form-row">
          <button type="button" className="danger" onClick={() => onDelete(node)}>
            Delete tile
          </button>
        </div>
      </form>

      {node.type !== 'text' && (
        <>
          <h3>Tags</h3>
          <TagEditor
            tags={node.tags || []}
            known={allTags}
            colours={tagColours}
            onChange={async (tags) => onChange(await api.updateNode(node.id, { tags }))}
          />
          <LinksEditor node={node} onChange={onChange} />
        </>
      )}

      {node.type !== 'text' && (
        <>
          <h3>Shape</h3>
          <label className="shape-pick">
            Shape of the item
            <select value={node.shape || 'rect'} onChange={(e) => onShape(e.target.value)}>
              <option value="rect">Rectangle</option>
              <option value="rounded">Rounded rectangle</option>
              <option value="pill">Pill</option>
              <option value="ellipse">Ellipse</option>
              <option value="circle">Circle</option>
            </select>
          </label>
        </>
      )}

      <h3>Appearance</h3>
      <StyleEditor
        key={node.id}
        style={node.style}
        fields={['fill', 'stroke', 'width', 'text']}
        labels={{ fill: 'Background', stroke: 'Frame colour', width: 'Frame width', text: 'Text colour' }}
        min={0}
        max={8}
        onSave={async (look) => onChange(await api.updateNode(node.id, { style: look }))}
      />

      <h3>Relationships</h3>
      {related.length === 0 && <p className="muted">No links yet. Drag from one node's handle to another.</p>}
      <ul className="relation-list">
        {related.map((edge) => {
          const outgoing = edge.source_id === node.id;
          const otherId = outgoing ? edge.target_id : edge.source_id;
          return (
            <li key={edge.id}>
              <span className="relation-text">
                {outgoing ? '→' : '←'} <em>{edge.relationship.replace(/_/g, ' ').toLowerCase()}</em>{' '}
                <button className="link-button" onClick={() => onOpenNode(otherId)}>
                  {titles.get(otherId) || 'Unknown'}
                </button>
                {edge.is_bidirectional && <span className="muted"> (both ways)</span>}
              </span>
              <button className="ghost small" onClick={() => onDeleteEdge(edge)} aria-label="Remove relationship">
                ×
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * The links of a tile: any number of web pages, pictures, videos and PDFs. Paste one or more links, one to a line (a title can
 * be given when adding a single link), and they are saved at once. Each can be removed. A tile's older single "url" is
 * folded into this list the first time it is saved.
 */
function LinksEditor({ node, onChange }) {
  const references = linksOf(node);
  const [links, setLinks] = useState('');
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');

  async function save(next) {
    setError('');
    try {
      onChange(await api.updateNode(node.id, { references: next, url: null }));
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    }
  }

  async function add(event) {
    event.preventDefault();
    const words = links.split(/\s+/).filter(Boolean);
    const urls = words.map(asHttpUrl);
    if (words.length === 0) return;
    if (urls.includes(null)) {
      setError('Each reference must be an http or https link, such as https://example.org/page.');
      return;
    }
    const known = new Set(references.map((r) => r.url));
    const fresh = [...new Set(urls)].filter((url) => !known.has(url));
    const named = fresh.length === 1 && title.trim() ? { title: title.trim() } : {};
    const next = [...references, ...fresh.map((url) => ({ url, ...named }))];
    if (fresh.length === 0 || (await save(next))) {
      setLinks('');
      setTitle('');
    }
  }

  return (
    <>
      <h3>External References{references.length > 0 && <span className="muted"> ({references.length})</span>}</h3>
      {references.length > 0 && (
        <ul className="relation-list ref-edit-list">
          {references.map((reference, i) => (
            <li key={`${i}-${reference.url}`}>
              <span className="relation-text">
                <span className="ref-kind">{KIND_LABEL[kindOf(reference.url)]}</span>{' '}
                <a href={reference.url} target="_blank" rel="noreferrer" title={reference.url}>
                  {referenceName(reference)}
                </a>
                {reference.title && <span className="muted"> {hostFromUrl(reference.url)}</span>}
              </span>
              <button
                className="ghost small"
                onClick={() => save(references.filter((_, j) => j !== i))}
                aria-label={`Remove ${referenceName(reference)}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <form className="details-form ref-add" onSubmit={add}>
        <label>
          Add references
          <textarea value={links} onChange={(e) => setLinks(e.target.value)} rows={2} placeholder="https://… (one link per line)" />
        </label>
        <label>
          Title (optional, for a single link)
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={255} />
        </label>
        {error && <p className="error">{error}</p>}
        <div className="form-row">
          <button type="submit" disabled={!links.trim()}>
            Add reference
          </button>
        </div>
      </form>
    </>
  );
}

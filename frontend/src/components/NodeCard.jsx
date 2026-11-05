import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { hostFromUrl, youtubeEmbedUrl } from '../utils.js';
import StyleEditor from './StyleEditor.jsx';

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
}) {
  return (
    <div className="node-card" style={style} role="dialog" aria-label={node.title} onMouseEnter={onEnter} onMouseLeave={onLeave}>
      <header className="card-header">
        <div className="card-title">
          <span className="type-badge">{node.type}</span>
          <strong title={node.title}>{node.title}</strong>
        </div>
        <div className="card-actions">
          <button className="ghost small" onClick={() => onMode(mode === 'edit' ? 'preview' : 'edit')}>
            {mode === 'edit' ? 'Preview' : 'Edit'}
          </button>
          {node.url && (
            <a href={node.url} target="_blank" rel="noreferrer">
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
        />
      ) : (
        <PreviewBody node={node} />
      )}
    </div>
  );
}

function PreviewBody({ node }) {
  // The page is shown only while the pointer is on its link at the top of the commentary, or inside what it reveals.
  const [framed, setFramed] = useState(false);
  const webPage = node.url && node.type !== 'image';

  return (
    <div className="card-body preview-body">
      {node.type === 'group' && (
        <>
          <p className="muted">A group. Nodes that belong to it sit inside its frame. Click Edit to change its title, shape and colours.</p>
        </>
      )}

      {node.url && node.type === 'image' && <img className="preview-image" src={node.url} alt={node.title} />}

      {webPage && (
        <div className="web-reveal" onMouseLeave={() => setFramed(false)}>
          <a className="web-link" href={node.url} target="_blank" rel="noreferrer" onMouseEnter={() => setFramed(true)}>
            ↗ {hostFromUrl(node.url)}
          </a>
          {framed && (
            <>
              <iframe
                className="preview-frame"
                src={youtubeEmbedUrl(node.url) || node.url}
                title={node.title}
                referrerPolicy="strict-origin-when-cross-origin"
                allow="fullscreen; autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
              />
              <p className="frame-hint muted">Blank? That site does not allow embedding. Use Open ↗.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function DetailsBody({ node, edges, titles, onChange, onDelete, onDeleteEdge, onOpenNode, onShape }) {
  const [title, setTitle] = useState(node.title);
  const [url, setUrl] = useState(node.url || '');
  const [commentary, setCommentary] = useState(node.commentary || '');
  const [time, setTime] = useState(node.time || '');
  const [latitude, setLatitude] = useState(node.latitude ?? '');
  const [longitude, setLongitude] = useState(node.longitude ?? '');
  const [country, setCountry] = useState(node.country || '');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSaved(false);
  }, [title, url, commentary, time, latitude, longitude, country]);

  async function save(event) {
    event.preventDefault();
    setError('');
    try {
      const updated = await api.updateNode(node.id, {
        title,
        url: url.trim() || null,
        commentary: commentary.trim() || null,
        time: time.trim() || null,
        latitude: latitude === '' ? null : Number(latitude),
        longitude: longitude === '' ? null : Number(longitude),
        country: country.trim() || null,
      });
      onChange(updated);
      setSaved(true);
    } catch (e) {
      setError(e.message);
    }
  }

  const related = edges.filter((e) => e.source_id === node.id || e.target_id === node.id);

  return (
    <div className="card-body">
      <form className="details-form" onSubmit={save}>
        <label>
          Title
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={255} required />
        </label>
        <label>
          Link
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" maxLength={2048} />
        </label>
        <label>
          Commentary
          <textarea value={commentary} onChange={(e) => setCommentary(e.target.value)} rows={5} maxLength={20000} />
        </label>
        <h3>When and where</h3>
        <div className="place-grid">
          <label className="wide">
            Time
            <input
              value={time}
              onChange={(e) => setTime(e.target.value)}
              placeholder="1945, 1945-08 or 1945-08-06"
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
            <input value={country} onChange={(e) => setCountry(e.target.value)} maxLength={100} />
          </label>
        </div>
        {error && <p className="error">{error}</p>}
        <div className="form-row">
          <button type="submit">{saved ? 'Saved' : 'Save'}</button>
          <button type="button" className="danger" onClick={() => onDelete(node)}>
            Delete link
          </button>
        </div>
      </form>

      {node.type === 'group' && (
        <>
          <h3>Shape</h3>
          <label className="shape-pick">
            Shape of the group
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
        labels={
          node.type === 'group'
            ? { fill: 'Group background', stroke: 'Frame colour', width: 'Frame width', text: 'Title colour' }
            : { fill: 'Background', stroke: 'Frame colour', width: 'Frame width', text: 'Text colour' }
        }
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

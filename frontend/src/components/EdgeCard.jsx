import { useState } from 'react';
import { api } from '../api.js';
import StyleEditor from './StyleEditor.jsx';
import RelationshipPicker from './RelationshipPicker.jsx';
import TagEditor from './TagEditor.jsx';
import { bendOf, withBend, withoutBend } from '../edgeBend.js';

/**
 * The card by a link (relationship line): its label, its direction, its colour and weight, and deleting it.
 * When several relationships join the same two items, they are listed first; picking one edits that one.
 * Membership links are not shown on the canvas, so this card is only for links between items.
 */
export default function EdgeCard({ edge, pair = [edge], onPick, titles, style, used, allTags, tagColours, onSaved, onDeleted, onClose }) {
  const from = titles.get(edge.source_id) || 'Unknown';
  const to = titles.get(edge.target_id) || 'Unknown';
  const label = edge.relationship.replace(/_/g, ' ').toLowerCase();
  const [relationship, setRelationship] = useState(edge.relationship);
  const [error, setError] = useState('');

  async function change(body) {
    setError('');
    try {
      onSaved(await api.updateEdge(edge.id, body));
    } catch (e) {
      setError(e.message);
    }
  }

  async function saveLabel(event) {
    event.preventDefault();
    if (!relationship) return;
    await change({ relationship });
  }

  async function remove() {
    if (!window.confirm(`Delete the link "${label}" between ${from} and ${to}?`)) return;
    try {
      await api.deleteEdge(edge.id);
      onDeleted(edge.id);
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="edge-card" style={style} role="dialog" aria-label="Link">
      <header className="card-header">
        <div className="card-title">
          <strong title={`${from} ${label} ${to}`}>
            {from} → <em>{label}</em> → {to}
          </strong>
        </div>
        <button className="ghost small" onClick={onClose} aria-label="Close">
          ×
        </button>
      </header>
      <div className="card-body">
        {pair.length > 1 && (
          <>
            <h3>Relationships between these two ({pair.length})</h3>
            <ul className="edge-pair-list">
              {pair.map((other) => (
                <li key={other.id}>
                  <button
                    type="button"
                    className={`link-button${other.id === edge.id ? ' is-current' : ''}`}
                    aria-pressed={other.id === edge.id}
                    onClick={() => onPick?.(other.id)}
                  >
                    {other.relationship.replace(/_/g, ' ').toLowerCase()}
                  </button>
                  {other.is_bidirectional && <span className="muted"> (both ways)</span>}{' '}
                  <span className="muted small">
                    {titles.get(other.source_id) || 'Unknown'} → {titles.get(other.target_id) || 'Unknown'}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}

        <form className="edge-label" onSubmit={saveLabel}>
          <label>
            Relationship
            <RelationshipPicker value={relationship} onChange={setRelationship} used={used} />
          </label>
          <button type="submit" disabled={!relationship || relationship === edge.relationship}>
            Save relationship
          </button>
        </form>

        <h3>Tags</h3>
        <TagEditor tags={edge.tags || []} known={allTags} colours={tagColours} onChange={(tags) => change({ tags })} />

        <div className="edge-actions">
          <button className="ghost small" onClick={() => change({ reverse: true })}>
            Swap direction
          </button>
          {bendOf(edge.style) && (
            <button className="ghost small" onClick={() => change({ style: withoutBend(edge.style) })}>
              Straighten line
            </button>
          )}
          <label className="radio">
            <input
              type="checkbox"
              checked={Boolean(edge.is_bidirectional)}
              onChange={(e) => change({ is_bidirectional: e.target.checked })}
            />
            Arrows both ways
          </label>
        </div>

        <StyleEditor
          key={edge.id}
          style={withoutBend(edge.style)}
          fields={['stroke', 'width']}
          labels={{ stroke: 'Line colour', width: 'Line weight' }}
          min={0.5}
          max={12}
          onSave={async (look) => change({ style: withBend(edge.style, look) })}
        />

        {error && <p className="error">{error}</p>}

        <div className="form-row end">
          <button type="button" className="danger" onClick={remove}>
            Delete link
          </button>
        </div>
      </div>
    </div>
  );
}

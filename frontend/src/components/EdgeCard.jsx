import { api } from '../api.js';
import StyleEditor from './StyleEditor.jsx';

/** A small card by a link (relationship line), to change its colour and weight. */
export default function EdgeCard({ edge, titles, style, onSaved, onClose }) {
  const from = titles.get(edge.source_id) || 'Unknown';
  const to = titles.get(edge.target_id) || 'Unknown';
  const label = edge.relationship.replace(/_/g, ' ').toLowerCase();

  async function save(look) {
    const updated = await api.updateEdge(edge.id, { style: look });
    onSaved(updated);
  }

  return (
    <div className="edge-card" style={style} role="dialog" aria-label="Link style">
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
        <StyleEditor
          key={edge.id}
          style={edge.style}
          fields={['stroke', 'width']}
          labels={{ stroke: 'Line colour', width: 'Line weight' }}
          min={0.5}
          max={12}
          onSave={save}
        />
      </div>
    </div>
  );
}

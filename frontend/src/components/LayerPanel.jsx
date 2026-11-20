import { useMemo, useState } from 'react';
import { layersOf, newLayerId } from '../layers.js';
import { tagColour } from '../tags.js';

/**
 * The panel opened by the Layers button. A layer is a named group of tags. Switch layers on and off to see a crowded graph
 * a part at a time. Anyone can switch layers on and off; the owner can also make, change and delete layers.
 *
 * Props: layers [{id, name, tags}], off (Set of layer ids switched off), otherOff (items in no layer are switched off),
 * tags (every tag with its counts), items (the node objects of tiles and text), colours, readOnly, and the handlers.
 */
export default function LayerPanel({ layers, off, otherOff, tags, items, colours, readOnly, onToggle, onToggleOther, onSolo, onShowAll, onSave, onClose }) {
  // The layer being made or changed: { id, name, tags, isNew }, or null.
  const [editing, setEditing] = useState(null);

  const counts = useMemo(() => {
    const byLayer = new Map(layers.map((layer) => [layer.id, 0]));
    let other = 0;
    for (const node of items) {
      const own = layersOf(node.tags, layers);
      if (own.length === 0) other += 1;
      for (const id of own) byLayer.set(id, (byLayer.get(id) || 0) + 1);
    }
    return { byLayer, other };
  }, [items, layers]);

  const anyHidden = off.size > 0 || otherOff;

  function startNew() {
    setEditing({ id: newLayerId(), name: '', tags: [], isNew: true });
  }

  function save(event) {
    event.preventDefault();
    const name = editing.name.trim();
    if (!name) return;
    const layer = { id: editing.id, name, tags: editing.tags };
    onSave(editing.isNew ? [...layers, layer] : layers.map((l) => (l.id === layer.id ? layer : l)));
    setEditing(null);
  }

  function toggleTag(tag) {
    const has = editing.tags.includes(tag);
    setEditing({ ...editing, tags: has ? editing.tags.filter((t) => t !== tag) : [...editing.tags, tag] });
  }

  return (
    <div className="tag-panel layer-panel" role="dialog" aria-label="Layers">
      <header>
        <strong>Layers</strong>
        <button className="ghost small" onClick={onClose} aria-label="Close the layers panel">
          ×
        </button>
      </header>

      {layers.length === 0 && !editing && (
        <p className="muted">
          {readOnly
            ? 'This graph has no layers.'
            : 'A layer is a group of tags. Make layers, then switch them on and off to see a crowded graph a part at a time.'}
        </p>
      )}

      {layers.length > 0 && (
        <ul className="layer-list">
          {layers.map((layer) => (
            <li key={layer.id} className={off.has(layer.id) ? 'off' : ''}>
              <input type="checkbox" checked={!off.has(layer.id)} onChange={() => onToggle(layer.id)} aria-label={`Show the layer ${layer.name}`} />
              <span className="layer-name" title={layer.tags.join(', ') || 'No tags yet'}>
                {layer.name}
              </span>
              <span className="muted tag-count" title={`${counts.byLayer.get(layer.id) || 0} tiles`}>
                {counts.byLayer.get(layer.id) || 0}
              </span>
              <button className="ghost small" onClick={() => onSolo(layer.id)} title="Show only this layer">
                Only
              </button>
              {!readOnly && (
                <>
                  <button
                    className="ghost small"
                    onClick={() => setEditing({ ...layer, isNew: false })}
                    aria-label={`Change the layer ${layer.name}`}
                    title="Change name and tags"
                  >
                    ✎
                  </button>
                  <button
                    className="ghost small"
                    onClick={() => window.confirm(`Delete the layer "${layer.name}"? The tiles and tags stay.`) && onSave(layers.filter((l) => l.id !== layer.id))}
                    aria-label={`Delete the layer ${layer.name}`}
                    title="Delete this layer"
                  >
                    🗑
                  </button>
                </>
              )}
            </li>
          ))}
          <li className={`layer-other${otherOff ? ' off' : ''}`}>
            <input type="checkbox" checked={!otherOff} onChange={onToggleOther} aria-label="Show tiles that are in no layer" />
            <span className="layer-name muted">Not in any layer</span>
            <span className="muted tag-count">{counts.other}</span>
          </li>
        </ul>
      )}

      {anyHidden && (
        <div className="form-row">
          <button className="ghost" onClick={onShowAll}>
            Show all layers
          </button>
        </div>
      )}

      {editing && !readOnly && (
        <form className="layer-edit" onSubmit={save} onKeyDown={(e) => e.key === 'Escape' && setEditing(null)}>
          <label>
            {editing.isNew ? 'New layer' : 'Layer name'}
            <input
              value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              placeholder="For example: People, or Before 1900"
              maxLength={60}
              autoFocus
            />
          </label>
          <span className="muted small">Tiles with any of the ticked tags are in this layer.</span>
          {tags.length === 0 ? (
            <p className="muted">No tags yet. Add tags to tiles first, then group them here.</p>
          ) : (
            <ul className="layer-tags">
              {tags.map(({ tag, tiles }) => (
                <li key={tag}>
                  <label>
                    <input type="checkbox" checked={editing.tags.includes(tag)} onChange={() => toggleTag(tag)} />
                    <span className="tag-dot" style={{ background: tagColour(tag, colours) }} aria-hidden="true" />
                    <span className="tag-name">{tag}</span>
                    <span className="muted tag-count">{tiles}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          <div className="form-row end">
            <button type="button" className="ghost" onClick={() => setEditing(null)}>
              Cancel
            </button>
            <button type="submit" disabled={!editing.name.trim()}>
              Save layer
            </button>
          </div>
        </form>
      )}

      {!editing && !readOnly && (
        <div className="form-row">
          <button onClick={startNew}>+ New layer</button>
        </div>
      )}
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { layersOf, newLayerId } from '../layers.js';
import { tagColour } from '../tags.js';

/**
 * The layers sidebar, at the left of the canvas. A layer is a named group of tags. Switch layers on and off to see a crowded
 * graph a part at a time. Anyone can switch layers on and off; the owner can also make, change and delete layers.
 *
 * It has three states (mode): 'pinned' is docked open beside the canvas, 'auto' is a slim tab that opens over the canvas while the
 * pointer is on it and folds away when the pointer leaves, and 'hidden' (the parent shows nothing; the toolbar button brings it back).
 *
 * Props: layers [{id, name, tags}], off (Set of layer ids switched off), otherOff (items in no layer are switched off),
 * tags (every tag with its counts), items (the node objects of tiles and text), colours, readOnly, and the handlers.
 */
export default function LayerPanel({ mode, onMode, layers, off, otherOff, tags, items, colours, readOnly, onToggle, onToggleOther, onSetAll, onSave }) {
  // In 'auto' mode: whether the tab is opened out. A tap or the pointer opens it; leaving closes it unless a box is being typed in.
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const expanded = mode === 'pinned' || open;
  const keepOpen = () => clearTimeout(timer.current);
  function leave() {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const active = document.activeElement;
      if (root.current?.contains(active) && active.matches('input[type=text], input:not([type]), textarea, select')) return;
      setOpen(false);
    }, 350);
  }

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

  // "Select all" covers every layer and the tiles in no layer: ticked when all are on, dashed when some are, empty when none.
  const total = layers.length + 1;
  const hiddenNow = off.size + (otherOff ? 1 : 0);
  const allOn = hiddenNow === 0;
  const noneOn = hiddenNow === total;
  const selectAll = useRef(null);
  useEffect(() => {
    if (selectAll.current) selectAll.current.indeterminate = !allOn && !noneOn;
  });

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

  const hiddenCount = off.size + (otherOff ? 1 : 0);

  return (
    <aside
      ref={root}
      className={`layer-sidebar ${mode}${expanded ? ' expanded' : ''}`}
      aria-label="Layers"
      onMouseEnter={mode === 'auto' ? () => { keepOpen(); setOpen(true); } : undefined}
      onMouseLeave={mode === 'auto' ? leave : undefined}
    >
      {!expanded && (
        <button className="layer-rail" onClick={() => setOpen(true)} aria-label="Open the layers" title="Layers">
          <span>Layers{hiddenCount > 0 ? ` (${hiddenCount} off)` : layers.length > 0 ? ` (${layers.length})` : ''}</span>
        </button>
      )}
      {expanded && (
    <div className="layer-body">
      <header>
        <strong>Layers</strong>
        <span className="layer-bar-buttons">
          {mode === 'auto' && (
            <button className="ghost small" onClick={() => setOpen(false)} title="Fold the bar back into its tab">
              Fold
            </button>
          )}
          <button className="ghost small layer-pin" onClick={() => onMode(mode === 'pinned' ? 'auto' : 'pinned')} aria-pressed={mode === 'pinned'} title={mode === 'pinned' ? 'Unpin: fold the bar into a tab that opens when you point at it' : 'Pin: keep the bar open beside the graph'}>
            {mode === 'pinned' ? 'Unpin' : 'Pin'}
          </button>
          <button className="ghost small" onClick={() => onMode('hidden')} title="Hide the bar. The Layers button in the toolbar brings it back.">
            Hide
          </button>
        </span>
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
          <li className="layer-all">
            <input ref={selectAll} type="checkbox" checked={allOn} onChange={() => onSetAll(!allOn)} aria-label="Select all layers" />
            <span className="layer-name">Select all</span>
          </li>
          {layers.map((layer) => (
            <li key={layer.id} className={off.has(layer.id) ? 'off' : ''}>
              <input type="checkbox" checked={!off.has(layer.id)} onChange={() => onToggle(layer.id)} aria-label={`Show the layer ${layer.name}`} />
              <span className="layer-name" title={layer.tags.join(', ') || 'No tags yet'}>
                {layer.name}
              </span>
              <span className="muted tag-count" title={`${counts.byLayer.get(layer.id) || 0} tiles`}>
                {counts.byLayer.get(layer.id) || 0}
              </span>
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
      )}
    </aside>
  );
}

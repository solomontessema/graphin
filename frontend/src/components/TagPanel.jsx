import { useState } from 'react';
import { normalizeTag, tagColour } from '../tags.js';

const MODES = [
  { id: 'off', label: 'Off' },
  { id: 'border', label: 'Border' },
  { id: 'fill', label: 'Fill' },
];

/**
 * The panel opened by the Tags button: every tag in the graph with how many tiles and links carry it. Tick tags to show
 * only the items that carry them (any one of them, or all of them), choose how tiles are coloured by tag, change a tag's
 * colour, rename a tag everywhere (renaming it to another tag merges them) or remove it everywhere.
 */
export default function TagPanel({ tags, colours, chosen, onToggle, onClear, match, onMatch, mode, onMode, onColour, onRename, onRemove, onClose }) {
  const [renaming, setRenaming] = useState(null);
  const [draft, setDraft] = useState('');

  function finishRename(from) {
    const to = normalizeTag(draft);
    setRenaming(null);
    if (to && to !== from) onRename(from, to);
  }

  return (
    <div className="tag-panel" role="dialog" aria-label="Tags">
      <header>
        <strong>Tags</strong>
        <button className="ghost small" onClick={onClose} aria-label="Close the tags panel">
          ×
        </button>
      </header>

      <div className="tag-options">
        <label>
          Colour tiles by their first tag
          <select value={mode} onChange={(e) => onMode(e.target.value)}>
            {MODES.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Show items with
          <select value={match} onChange={(e) => onMatch(e.target.value)}>
            <option value="any">any ticked tag</option>
            <option value="all">all ticked tags</option>
          </select>
        </label>
      </div>

      {tags.length === 0 ? (
        <p className="muted">No tags yet. Open a tile or a link, and add tags in its card. They will be listed here.</p>
      ) : (
        <ul className="tag-list">
          {tags.map(({ tag, tiles, links }) => (
            <li key={tag}>
              <input type="checkbox" checked={chosen.has(tag)} onChange={() => onToggle(tag)} aria-label={`Show only items tagged ${tag}`} />
              <input
                type="color"
                className="colour-well"
                value={tagColour(tag, colours)}
                onChange={(e) => onColour(tag, e.target.value)}
                aria-label={`Colour of ${tag}`}
                title="Colour of this tag"
              />
              {renaming === tag ? (
                <input
                  className="tag-rename"
                  value={draft}
                  autoFocus
                  maxLength={40}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => finishRename(tag)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') finishRename(tag);
                    else if (e.key === 'Escape') setRenaming(null);
                  }}
                />
              ) : (
                <span className="tag-name" title={tag}>
                  {tag}
                </span>
              )}
              <span className="muted tag-count" title={`${tiles} tiles, ${links} links`}>
                {tiles + links}
              </span>
              <button
                className="ghost small"
                onClick={() => {
                  setDraft(tag);
                  setRenaming(tag);
                }}
                aria-label={`Rename ${tag}`}
                title="Rename or merge"
              >
                ✎
              </button>
              <button
                className="ghost small"
                onClick={() => window.confirm(`Remove the tag "${tag}" from all ${tiles + links} items that carry it?`) && onRemove(tag)}
                aria-label={`Remove ${tag} everywhere`}
                title="Remove from every item"
              >
                🗑
              </button>
            </li>
          ))}
        </ul>
      )}

      {chosen.size > 0 && (
        <div className="form-row">
          <button className="ghost" onClick={onClear}>
            Show everything
          </button>
          <span className="muted">Showing items tagged {[...chosen].join(match === 'all' ? ' and ' : ' or ')}</span>
        </div>
      )}
    </div>
  );
}

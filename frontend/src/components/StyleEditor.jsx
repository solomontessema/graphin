import { useEffect, useRef, useState } from 'react';

// Colours offered as one-click swatches. Any other colour can be picked with the colour well.
const SWATCHES = ['#1d4ed8', '#0891b2', '#047857', '#65a30d', '#fbbf24', '#ea580c', '#b91c1c', '#be185d', '#6d28d9', '#334155', '#ffffff', '#000000'];
const SAVE_DELAY = 350;

/**
 * Edits the appearance of one node or link: a background colour, a frame or line colour, and
 * a width. Changes are saved a moment after the last one, so dragging the width slider saves once.
 * The editor starts from the style it is given and does not follow later changes, so it never jumps
 * back while you are still editing. Give it a key that changes with the item.
 *
 * fields: which of 'fill', 'stroke', 'width' to show. labels: the names for those fields.
 */
export default function StyleEditor({ style, fields, labels, min = 0, max = 8, onSave }) {
  const [draft, setDraft] = useState(style || {});
  const [error, setError] = useState('');
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  function commit(next) {
    const cleaned = Object.fromEntries(Object.entries(next).filter(([, v]) => v !== undefined && v !== null));
    setDraft(cleaned);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setError('');
      onSave(Object.keys(cleaned).length ? cleaned : null).catch((e) => setError(e.message));
    }, SAVE_DELAY);
  }

  function reset() {
    clearTimeout(timer.current);
    setDraft({});
    setError('');
    onSave(null).catch((e) => setError(e.message));
  }

  const width = draft.width ?? (max + min) / 2;

  return (
    <div className="style-editor">
      {fields.includes('fill') && (
        <Colour
          label={labels.fill}
          value={draft.fill}
          allowNone
          onChange={(fill) => commit({ ...draft, fill })}
        />
      )}
      {fields.includes('text') && (
        <Colour
          label={labels.text}
          value={draft.text}
          allowNone
          onChange={(text) => commit({ ...draft, text })}
        />
      )}
      {fields.includes('stroke') && (
        <Colour
          label={labels.stroke}
          value={draft.stroke}
          onChange={(stroke) => commit({ ...draft, stroke })}
        />
      )}
      {fields.includes('width') && (
        <label className="style-row">
          <span>{labels.width}</span>
          <input
            type="range"
            min={min}
            max={max}
            step={0.5}
            value={width}
            onChange={(e) => commit({ ...draft, width: Number(e.target.value) })}
          />
          <span className="style-value">{width}px</span>
        </label>
      )}
      <div className="form-row">
        <button type="button" className="ghost small" onClick={reset}>
          Reset to default
        </button>
        {error && <span className="error small">{error}</span>}
      </div>
    </div>
  );
}

/** A colour: swatches, a colour well for any other colour, and "none" for backgrounds. */
function Colour({ label, value, onChange, allowNone = false }) {
  return (
    <div className="style-row">
      <span>{label}</span>
      <div className="swatches">
        {allowNone && (
          <button
            type="button"
            className={`swatch none ${value ? '' : 'is-on'}`}
            onClick={() => onChange(undefined)}
            title="Default: no colour set"
            aria-label={`${label}: none`}
          />
        )}
        {SWATCHES.map((c) => (
          <button
            key={c}
            type="button"
            className={`swatch ${value === c ? 'is-on' : ''}`}
            style={{ background: c }}
            onClick={() => onChange(c)}
            title={c}
            aria-label={`${label}: ${c}`}
          />
        ))}
        <input
          type="color"
          className="colour-well"
          value={value || '#7a869c'}
          onChange={(e) => onChange(e.target.value)}
          aria-label={`${label}: choose a colour`}
          title="Choose any colour"
        />
      </div>
    </div>
  );
}

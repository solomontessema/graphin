import { useState } from 'react';
import { RELATIONSHIPS, RELATIONSHIP_IDS, toRelationship } from '../relationships.js';

const OTHER = '__other';

/**
 * Chooses the kind of a relationship: one of the standard kinds, one already used in this graph, or a new one typed
 * in. value is the stored form (SUPPORTS); onChange gets the stored form of the new choice.
 *
 * used: the relationships already in the graph.
 */
export default function RelationshipPicker({ value, onChange, used = [], autoFocus = false }) {
  const custom = used.filter((r) => !RELATIONSHIP_IDS.has(r));
  const known = RELATIONSHIP_IDS.has(value) || custom.includes(value);
  const [typing, setTyping] = useState(!known && value !== '');
  const selected = typing ? OTHER : value;
  const label = (id) => id.replace(/_/g, ' ').toLowerCase();

  return (
    <div className="relationship-picker">
      <select
        value={selected}
        autoFocus={autoFocus}
        aria-label="Kind of relationship"
        onChange={(e) => {
          if (e.target.value === OTHER) {
            setTyping(true);
          } else {
            setTyping(false);
            onChange(e.target.value);
          }
        }}
      >
        <optgroup label="Standard">
          {RELATIONSHIPS.map((r) => (
            <option key={r.id} value={r.id} title={r.hint}>
              {r.label}
            </option>
          ))}
        </optgroup>
        {custom.length > 0 && (
          <optgroup label="Used in this graph">
            {custom.map((r) => (
              <option key={r} value={r}>
                {label(r)}
              </option>
            ))}
          </optgroup>
        )}
        <option value={OTHER}>Other… (type your own)</option>
      </select>
      {typing && (
        <input
          value={value.replace(/_/g, ' ').toLowerCase()}
          onChange={(e) => onChange(toRelationship(e.target.value))}
          placeholder="for example mentored by"
          maxLength={50}
          aria-label="Your own relationship"
          autoFocus
        />
      )}
      {!typing && RELATIONSHIPS.find((r) => r.id === value)?.hint && <span className="muted small">{RELATIONSHIPS.find((r) => r.id === value).hint}</span>}
    </div>
  );
}

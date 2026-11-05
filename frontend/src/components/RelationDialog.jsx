import { useState } from 'react';

const PRESETS = ['SUPPORTS', 'USES', 'REFERENCES', 'EXPLAINS', 'DEPENDS_ON', 'IMPLEMENTS', 'CONTRADICTS', 'RELATED'];

/**
 * Asks how two nodes are related when you connect them on the canvas.
 * direction: forward draws an arrow from source to target, backward reverses it, both draws no arrow.
 * belongs: one of the two is a group. Then the only question is whether to add the node to it.
 */
export default function RelationDialog({ source, target, belongs = false, onCancel, onSave }) {
  const [relationship, setRelationship] = useState('SUPPORTS');
  const [direction, setDirection] = useState('forward');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const group = source.type === 'group' ? source : target;
  const member = source.type === 'group' ? target : source;

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await onSave(belongs ? { relationship: 'BELONGS_TO' } : { relationship, direction });
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  if (belongs) {
    return (
      <div className="overlay" onMouseDown={onCancel}>
        <form className="dialog" onMouseDown={(e) => e.stopPropagation()} onSubmit={submit}>
          <h2>Add to group?</h2>
          <p>
            <strong>{member.title}</strong> will belong to <strong>{group.title}</strong>. Members sit inside their
            group, so no arrow is drawn, and the group grows to fit them.
          </p>
          {error && <p className="error">{error}</p>}
          <div className="form-row end">
            <button type="button" className="ghost" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" disabled={busy}>
              Add to group
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="overlay" onMouseDown={onCancel}>
      <form className="dialog" onMouseDown={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>How is this related?</h2>
        <p className="relation-pair">
          <strong>{source.title}</strong> and <strong>{target.title}</strong>
        </p>

        <label>
          Relationship
          <input
            list="relationship-presets"
            value={relationship}
            onChange={(e) => setRelationship(e.target.value)}
            maxLength={50}
            required
            autoFocus
          />
          <datalist id="relationship-presets">
            {PRESETS.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </label>

        <fieldset>
          <legend>Direction</legend>
          <label className="radio">
            <input type="radio" name="direction" checked={direction === 'forward'} onChange={() => setDirection('forward')} />
            {source.title} → {target.title}
          </label>
          <label className="radio">
            <input type="radio" name="direction" checked={direction === 'backward'} onChange={() => setDirection('backward')} />
            {source.title} ← {target.title}
          </label>
          <label className="radio">
            <input type="radio" name="direction" checked={direction === 'both'} onChange={() => setDirection('both')} />
            {source.title} ↔ {target.title}
          </label>
        </fieldset>

        {error && <p className="error">{error}</p>}

        <div className="form-row end">
          <button type="button" className="ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" disabled={busy}>
            Connect
          </button>
        </div>
      </form>
    </div>
  );
}

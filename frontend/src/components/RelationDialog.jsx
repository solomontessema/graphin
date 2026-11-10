import { useState } from 'react';
import RelationshipPicker from './RelationshipPicker.jsx';

/**
 * Asks how two items are related when you connect them on the canvas.
 * direction: forward draws an arrow from source to target, backward reverses it, both draws no arrow.
 */
export default function RelationDialog({ source, target, used, existing = [], onCancel, onSave }) {
  // The first standard kind these two items are not already linked by.
  const [relationship, setRelationship] = useState(() => ['SUPPORTS', 'RELATED', 'CAUSES', 'LEADS_TO'].find((r) => !existing.includes(r)) || '');
  const [direction, setDirection] = useState('forward');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const stored = relationship.trim().toUpperCase().replace(/[ -]+/g, '_');
  const taken = stored !== '' && existing.includes(stored);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await onSave({ relationship, direction });
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <div className="overlay" onMouseDown={onCancel}>
      <form className="dialog" onMouseDown={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>How is this related?</h2>
        <p className="relation-pair">
          <strong>{source.title}</strong> and <strong>{target.title}</strong>
        </p>

        {existing.length > 0 && (
          <p className="muted small">
            Already linked by: {existing.map((r) => r.replace(/_/g, ' ').toLowerCase()).join(', ')}. Add another link with a different relationship.
          </p>
        )}

        <label>
          Relationship
          <RelationshipPicker value={relationship} onChange={setRelationship} used={used} autoFocus />
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

        {taken && <p className="error">These two items are already linked by that relationship. Choose a different one.</p>}
        {error && <p className="error">{error}</p>}

        <div className="form-row end">
          <button type="button" className="ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" disabled={busy || taken || stored === ''}>
            Connect
          </button>
        </div>
      </form>
    </div>
  );
}

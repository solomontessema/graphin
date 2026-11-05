/**
 * The edit and trash icons in the top-right corner of a node or group. They do not start a drag, and
 * they are faint until the item is hovered or selected (see styles.css).
 */
export default function NodeTools({ label, onEdit, onRemove }) {
  const stop = (event) => event.stopPropagation();
  return (
    <div className="node-tools nodrag" onPointerDown={stop} onClick={stop}>
      <button type="button" onClick={onEdit} title={`Edit ${label}`} aria-label={`Edit ${label}`}>
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
          <path d="M4 20h4L19 9l-4-4L4 16z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        </svg>
      </button>
      <button type="button" onClick={onRemove} title={`Delete ${label}`} aria-label={`Delete ${label}`}>
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
          <path
            d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}

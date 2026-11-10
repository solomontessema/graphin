import { useState } from 'react';
import { NodeResizer } from '@xyflow/react';
import NodeTools from './NodeTools.jsx';
import SideHandles from './SideHandles.jsx';
import { useDoubleClick } from '../useDoubleClick.js';

/**
 * A label: free text written straight on the canvas, without a box. Double-click to write; click away to save.
 */
export default function TextNode({ id, data, selected }) {
  const { node, actions } = data;
  const [draft, setDraft] = useState(null);
  const text = node.commentary || '';
  const onDouble = useDoubleClick(() => setDraft(text));

  function finish() {
    const next = draft.trim() || null;
    setDraft(null);
    if (next !== (node.commentary || null)) actions.saveText(id, next);
  }

  return (
    <div
      className={`text-node${selected ? ' selected' : ''}`}
      style={node.width != null ? { width: node.width, minHeight: node.height } : undefined}
      onClick={() => draft === null && onDouble()}
    >
      <SideHandles />

      <NodeTools label={node.title} onEdit={() => actions.edit(id)} onRemove={() => actions.remove(id)} />

      <NodeResizer
        minWidth={120}
        minHeight={40}
        isVisible={selected}
        onResize={(_, box) => actions.resizeTile(id, box, false)}
        onResizeEnd={(_, box) => actions.resizeTile(id, box, true)}
        lineStyle={{ borderWidth: 6, borderColor: 'transparent' }}
      />

      {draft === null ? (
        <div className="text-body">{text || <span className="muted">Double-click to write</span>}</div>
      ) : (
        <textarea
          className="text-input nodrag nowheel"
          autoFocus
          onFocus={(e) => e.target.setSelectionRange(e.target.value.length, e.target.value.length)}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={finish}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setDraft(null);
          }}
          rows={Math.max(2, draft.split('\n').length)}
        />
      )}
    </div>
  );
}

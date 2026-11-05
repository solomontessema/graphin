import { NodeResizer, useReactFlow } from '@xyflow/react';
import { appearanceVars } from '../utils.js';
import NodeTools from './NodeTools.jsx';
import SideHandles from './SideHandles.jsx';

/**
 * A group: a box, circle, or other shape that holds the nodes which belong to it. The whole frame can be
 * dragged, except where a tile sits on top of it (a tile is then the thing you move). The shape is chosen
 * in the group's card. A circle is resized from its radius handle; the other shapes from their edges.
 */
export default function GroupNode({ id, data, selected }) {
  const { node, members, actions } = data;
  const shape = node.shape || 'rect';
  const circle = shape === 'circle';
  const { screenToFlowPosition } = useReactFlow();

  // Dragging the radius handle: the centre stays put and the radius follows the pointer.
  function dragRadius(event, final) {
    const point = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    const cx = node.x + node.width / 2;
    const cy = node.y + node.height / 2;
    const r = Math.hypot(point.x - cx, point.y - cy);
    actions.resize(id, { x: cx - r, y: cy - r, width: 2 * r, height: 2 * r }, final);
  }

  function startRadius(event) {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  return (
    <div className={`group-box shape-${shape}`} style={appearanceVars(node.style, 'group')}>
      <div className="group-title">
        <strong title={node.title}>{node.title}</strong>
        <span className="muted small">
          {members} {members === 1 ? 'member' : 'members'}
        </span>
      </div>

      <NodeTools label={node.title} onEdit={() => actions.edit(id)} onRemove={() => actions.remove(id)} />

      {!circle && (
        <NodeResizer
          minWidth={0}
          minHeight={0}
          isVisible={selected}
          onResize={(_, box) => actions.resize(id, box, false)}
          onResizeEnd={(_, box) => actions.resize(id, box, true)}
          // A wider, invisible edge: the dashed border shows where it is, and the cursor says it can be dragged.
          lineStyle={{ borderWidth: 6, borderColor: 'transparent' }}
        />
      )}

      {circle && (
        <svg
          className="group-ring nodrag"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          title="Drag the edge to change the size"
          onPointerDown={startRadius}
          onPointerMove={(e) => e.currentTarget.hasPointerCapture(e.pointerId) && dragRadius(e, false)}
          onPointerUp={(e) => {
            if (e.currentTarget.hasPointerCapture(e.pointerId)) {
              dragRadius(e, true);
              e.currentTarget.releasePointerCapture(e.pointerId);
            }
          }}
        >
          <circle cx="50" cy="50" r="50" vectorEffect="non-scaling-stroke" />
        </svg>
      )}

      {/* Connection points sit off the middle of each side, so the middle of each edge can be dragged to resize. */}
      <SideHandles offset />
    </div>
  );
}

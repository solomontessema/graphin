import { Handle, Position } from '@xyflow/react';

// Every side of an item has a point an arrow can leave from (source) and arrive at (target). NetworkView picks
// the sides that face each other, so an arrow runs straight between two items instead of looping round.
const SIDES = [
  { side: 'top', position: Position.Top },
  { side: 'right', position: Position.Right },
  { side: 'bottom', position: Position.Bottom },
  { side: 'left', position: Position.Left },
];

// A point at 28% along a side, so the middle of the side stays free for resizing a container.
function offsetFor(side) {
  return side === 'top' || side === 'bottom' ? { left: '28%' } : { top: '28%' };
}

/** The connection points of a tile or a container: a source and a target on each of the four sides. */
export default function SideHandles({ offset = false }) {
  return (
    <>
      {SIDES.map(({ side, position }) => (
        <Handle
          key={`t-${side}`}
          id={`t-${side}`}
          type="target"
          position={position}
          style={offset ? offsetFor(side) : undefined}
        />
      ))}
      {SIDES.map(({ side, position }) => (
        <Handle
          key={`s-${side}`}
          id={`s-${side}`}
          type="source"
          position={position}
          style={offset ? offsetFor(side) : undefined}
        />
      ))}
    </>
  );
}

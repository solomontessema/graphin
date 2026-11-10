import { Handle, Position } from '@xyflow/react';

// Every side of an item has a point an arrow can leave from (source) and arrive at (target). NetworkView picks
// the sides that face each other, so an arrow runs straight between two items instead of looping round.
const SIDES = [
  { side: 'top', position: Position.Top },
  { side: 'right', position: Position.Right },
  { side: 'bottom', position: Position.Bottom },
  { side: 'left', position: Position.Left },
];

/** The connection points of a tile: a source and a target at the centre of each of the four sides. */
export default function SideHandles() {
  return (
    <>
      {SIDES.map(({ side, position }) => (
        <Handle key={`t-${side}`} id={`t-${side}`} type="target" position={position} />
      ))}
      {SIDES.map(({ side, position }) => (
        <Handle key={`s-${side}`} id={`s-${side}`} type="source" position={position} />
      ))}
    </>
  );
}

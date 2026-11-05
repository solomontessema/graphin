// Geometry for groups. A group has a shape: rectangle, rounded rectangle, pill, ellipse, or circle.
// Adding a member makes the group grow to hold it; resizing it can make it any size, down to 0.
// Boxes are { x, y, width, height } in canvas coordinates. A circle's box is a square.

// Space a group leaves around its members: the title bar sits above them.
export const GROUP_PAD = 40;
export const GROUP_TOP = 56;

/** The corners of a box: four points. */
function corners(box) {
  return [
    [box.x, box.y],
    [box.x + box.width, box.y],
    [box.x, box.y + box.height],
    [box.x + box.width, box.y + box.height],
  ];
}

/** The radius a circle centred at (cx, cy) needs so that every member fits inside with room to spare. */
export function circleRadiusFor(cx, cy, members) {
  let radius = 0;
  for (const member of members) {
    for (const [x, y] of corners(member)) {
      radius = Math.max(radius, Math.hypot(x - cx, y - cy) + GROUP_PAD);
    }
  }
  return radius;
}

/** The smallest rectangle that holds the group as it is now and every member. It only grows. */
export function growToInclude(group, members) {
  let left = group.x;
  let top = group.y;
  let right = group.x + group.width;
  let bottom = group.y + group.height;
  for (const m of members) {
    left = Math.min(left, m.x - GROUP_PAD);
    top = Math.min(top, m.y - GROUP_TOP);
    right = Math.max(right, m.x + m.width + GROUP_PAD);
    bottom = Math.max(bottom, m.y + m.height + GROUP_PAD);
  }
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/**
 * Grows the group's own shape until it holds the members. A circle grows its radius and keeps its
 * centre. Every other shape grows as a rectangle, which contains them.
 */
export function growBox(group, members) {
  if (group.shape !== 'circle') {
    return growToInclude(group, members);
  }
  const cx = group.x + group.width / 2;
  const cy = group.y + group.height / 2;
  const radius = Math.max(group.width / 2, circleRadiusFor(cx, cy, members));
  return { x: cx - radius, y: cy - radius, width: 2 * radius, height: 2 * radius };
}

/** True when the box is a valid size for the shape. Any size from 0 up is allowed; a circle stays square. */
export function isValidBox(shape, box) {
  if (box.width < 0 || box.height < 0) return false;
  return shape !== 'circle' || Math.abs(box.width - box.height) <= 0.5;
}

/**
 * The box for a group that changes shape. A circle takes the smaller side of the frame, centred on it.
 * Any other shape keeps the frame as it is.
 */
export function convertShape(group, next) {
  if (next !== 'circle') {
    return { x: group.x, y: group.y, width: group.width, height: group.height };
  }
  const cx = group.x + group.width / 2;
  const cy = group.y + group.height / 2;
  const size = Math.min(group.width, group.height);
  return { x: cx - size / 2, y: cy - size / 2, width: size, height: size };
}

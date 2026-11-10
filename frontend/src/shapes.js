// Shapes of a tile: rectangle, rounded rectangle, pill, ellipse, or circle.
// A box is { x, y, width, height } in canvas coordinates. A circle's box is a square.

/**
 * The box for a tile that changes shape. A circle takes the smaller side of the box, centred on it.
 * Any other shape keeps the box as it is.
 */
export function convertShape(item, next) {
  if (next !== 'circle') {
    return { x: item.x, y: item.y, width: item.width, height: item.height };
  }
  const cx = item.x + item.width / 2;
  const cy = item.y + item.height / 2;
  const size = Math.min(item.width, item.height);
  return { x: cx - size / 2, y: cy - size / 2, width: size, height: size };
}

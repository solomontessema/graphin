// A link can be bent through points, "vertices": the line is a smooth curve through them. The vertices are saved in the
// link's style as pts, a list of [x, y] offsets from the middle of the straight line between the two items, in canvas
// units, so the shape travels with the link when an item is moved. Older links saved one bend as bx and by.

/** The saved vertices of a style as a list of [x, y], empty when the link is not bent. */
export function ptsOf(style) {
  if (style && Array.isArray(style.pts) && style.pts.length > 0) return style.pts;
  if (style && (style.bx || style.by)) return [[style.bx || 0, style.by || 0]];
  return [];
}

/** Whether the link has been bent by the user. */
export function bendOf(style) {
  return ptsOf(style).length > 0;
}

/** The style without its bend: what colour and weight a format painter copies. */
export function withoutBend(style) {
  if (!style) return null;
  const { bx, by, pts, ...look } = style;
  return Object.keys(look).length > 0 ? look : null;
}

/** A style with these vertices (none: straight back to the default curve), keeping its colour and weight. */
export function withPts(style, pts) {
  const look = withoutBend(style);
  if (!pts || pts.length === 0) return look;
  return { ...(look || {}), pts };
}

/** A new look (colour and weight, or null for the default) with the link's bend kept. */
export function withBend(style, look) {
  return withPts({ ...(look || {}), pts: ptsOf(style) }, ptsOf(style));
}

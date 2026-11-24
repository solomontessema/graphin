import { RoughGenerator } from 'roughjs/bin/generator';

// The sketchy, hand-made look: lines and outlines drawn the way a marker would, slightly wobbly and doubled up. It is the
// rough.js generator (the library Excalidraw uses), used only to make the shapes of the strokes; they are drawn as plain SVG
// paths. A shape is made once for its size and seed and kept, so it costs nothing on the next draw, and the seed (taken from the
// item's id) keeps a line from changing its wobble every time something is redrawn.

const generator = new RoughGenerator();

/**
 * The looks a graph can be drawn in. clean is the plain look (nothing is sketched). The others differ in how much the lines
 * wobble (roughness), how much they bow, whether each line is drawn twice (as with a pencil), and how thick they are.
 */
export const STYLES = [
  { id: 'clean', label: 'Clean', hint: 'Crisp lines and outlines' },
  { id: 'sketch', label: 'Sketch', hint: 'Pencil lines, drawn twice, slightly wobbly', line: { roughness: 0.9, bowing: 0.8 }, box: { roughness: 1.1, bowing: 0.9 }, width: 1 },
  { id: 'freehand', label: 'Free hand', hint: 'One smooth, flowing pen stroke', line: { roughness: 0.45, bowing: 1.6, disableMultiStroke: true }, box: { roughness: 0.6, bowing: 1.8, disableMultiStroke: true }, width: 1 },
  { id: 'marker', label: 'Marker', hint: 'Thick, confident marker strokes', line: { roughness: 0.6, bowing: 1, disableMultiStroke: true }, box: { roughness: 0.8, bowing: 1.1, disableMultiStroke: true }, width: 1.9 },
];
const BY_ID = Object.fromEntries(STYLES.map((s) => [s.id, s]));

/** The stroke width factor of a look (1 for the others). */
export const widthOf = (look) => BY_ID[look]?.width ?? 1;

// Every shape made so far, by what it was made from. The list is emptied when it gets long.
const made = new Map();
const LIMIT = 4000;

function remember(key, make) {
  let paths = made.get(key);
  if (!paths) {
    if (made.size >= LIMIT) made.clear();
    paths = make();
    made.set(key, paths);
  }
  return paths;
}

/** A whole number from an id, the same every time, for rough.js to start its randomness from. */
export function seedOf(id) {
  let hash = 7;
  for (const ch of String(id)) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return (hash % 2147483646) + 1;
}

/** The pieces of a drawing as plain path strings. */
const pathsOf = (drawable) => generator.toPaths(drawable).map((p) => p.d);

/** The strokes of a line that follows the SVG path d. Returns a list of path strings. */
export function sketchLine(d, seed, width, look = 'sketch') {
  return remember(`l|${look}|${seed}|${width}|${d}`, () =>
    pathsOf(generator.path(d, { seed, ...BY_ID[look]?.line, strokeWidth: width, fill: undefined, preserveVertices: false }))
  );
}

const RADIUS = { rounded: 26, pill: 999 };

/** The strokes of a tile's outline, for a box of w by h pixels. Returns a list of path strings. */
export function sketchBox(shape, w, h, seed, width, look = 'sketch') {
  const key = `b|${look}|${shape}|${Math.round(w)}|${Math.round(h)}|${seed}|${width}`;
  return remember(key, () => {
    const options = { seed, ...BY_ID[look]?.box, strokeWidth: width };
    if (shape === 'ellipse' || shape === 'circle') {
      return pathsOf(generator.ellipse(w / 2, h / 2, Math.max(4, w - 2), Math.max(4, h - 2), options));
    }
    const r = Math.min(RADIUS[shape] ?? 10, w / 2, h / 2);
    const d = `M ${r} 1 H ${w - r} A ${r - 1} ${r - 1} 0 0 1 ${w - 1} ${r} V ${h - r} A ${r - 1} ${r - 1} 0 0 1 ${w - r} ${h - 1} H ${r} A ${r - 1} ${r - 1} 0 0 1 1 ${h - r} V ${r} A ${r - 1} ${r - 1} 0 0 1 ${r} 1 Z`;
    return pathsOf(generator.path(d, options));
  });
}

/** Below this zoom the lines are drawn plainly: the wobble cannot be seen and is not worth drawing. */
export const SKETCH_MIN_ZOOM = 0.2;

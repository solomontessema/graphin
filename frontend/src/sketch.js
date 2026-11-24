import { RoughGenerator } from 'roughjs/bin/generator';

// The sketchy, hand-made look: lines and outlines drawn the way a marker would, slightly wobbly and doubled up. It is the
// rough.js generator (the library Excalidraw uses), used only to make the shapes of the strokes; they are drawn as plain SVG
// paths. A shape is made once for its size and seed and kept, so it costs nothing on the next draw, and the seed (taken from the
// item's id) keeps a line from changing its wobble every time something is redrawn.

const generator = new RoughGenerator();

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
export function sketchLine(d, seed, width) {
  return remember(`l|${seed}|${width}|${d}`, () =>
    pathsOf(generator.path(d, { seed, roughness: 0.9, bowing: 0.8, strokeWidth: width, fill: undefined, preserveVertices: false }))
  );
}

const RADIUS = { rounded: 26, pill: 999 };

/** The strokes of a tile's outline, for a box of w by h pixels. Returns a list of path strings. */
export function sketchBox(shape, w, h, seed, width) {
  const key = `b|${shape}|${Math.round(w)}|${Math.round(h)}|${seed}|${width}`;
  return remember(key, () => {
    const options = { seed, roughness: 1.1, bowing: 0.9, strokeWidth: width };
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

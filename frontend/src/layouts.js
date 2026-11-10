// Layouts arrange the items of a network, in the spirit of the layouts in Gephi.
// A unit is one item, with the size of its box: { id, width, height, lat, lon, year }.
// A link is [fromUnitId, toUnitId]. Every layout returns the centre of each unit as Map<id, { x, y }>.

export const LAYOUTS = [
  { id: 'force', label: 'Force-directed', hint: 'Linked items pull together, the rest push apart.' },
  { id: 'timeline', label: 'Timeline', hint: 'Left to right by date, in rows so nothing overlaps. Undated items go below.' },
  { id: 'grid', label: 'Grid', hint: 'Evenly spaced rows and columns.' },
  { id: 'geo', label: 'Geo', hint: 'Placed by latitude and longitude.' },
];

import { MAP_HEIGHT, MAP_WIDTH } from './worldMap.js';
import { toPosition } from './timeScale.js';

const GAP = 60;
const RING = 340;

// options.compactness, from 0 (loose) to 1 (tight), sets how far force-directed items spread. Default 0.5.
// options.timeScale is how the timeline shares its length out between dates (see timeScale.js). Default 'linear'.
export function computeLayout(kind, units, links, options = {}) {
  if (units.length === 0) return new Map();
  const graph = graphOf(units, links);
  switch (kind) {
    case 'timeline':
      return timeline(units, options.timeScale ?? 'linear');
    case 'grid':
      return grid(units, graph);
    case 'geo':
      return geo(units);
    default:
      return force(units, graph, options.compactness ?? 0.5);
  }
}

// Neighbours of each unit, the number of links of each unit, and the units ordered by links (most first).
function graphOf(units, links) {
  const ids = new Set(units.map((u) => u.id));
  const neighbours = new Map(units.map((u) => [u.id, []]));
  for (const [a, b] of links) {
    if (!ids.has(a) || !ids.has(b) || a === b) continue;
    neighbours.get(a).push(b);
    neighbours.get(b).push(a);
  }
  const ranked = [...units].sort((a, b) => neighbours.get(b.id).length - neighbours.get(a.id).length);
  return { neighbours, ranked, links: links.filter(([a, b]) => ids.has(a) && ids.has(b) && a !== b) };
}

// Pushes overlapping units apart until none overlap (or the passes run out).
function separate(units, at, passes = 60) {
  for (let pass = 0; pass < passes; pass++) {
    let moved = false;
    for (let i = 0; i < units.length; i++) {
      for (let j = i + 1; j < units.length; j++) {
        const a = at.get(units[i].id);
        const b = at.get(units[j].id);
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const needX = (units[i].width + units[j].width) / 2 + GAP / 2;
        const needY = (units[i].height + units[j].height) / 2 + GAP / 2;
        const overlapX = needX - Math.abs(dx);
        const overlapY = needY - Math.abs(dy);
        if (overlapX <= 0 || overlapY <= 0) continue;
        moved = true;
        if (overlapX < overlapY) {
          const push = (dx >= 0 ? 1 : -1) * overlapX / 2;
          a.x -= push;
          b.x += push;
        } else {
          const push = (dy >= 0 ? 1 : -1) * overlapY / 2;
          a.y -= push;
          b.y += push;
        }
      }
    }
    if (!moved) break;
  }
  return at;
}

// Force-directed: a Fruchterman–Reingold simulation. Every pair repels, linked units attract, and
// units that overlap are kept apart. The temperature cools so the layout settles.
// Compactness scales the charge (how strongly units repel) and adds a pull toward the centre, so a
// tighter setting keeps the whole network from spreading out.
function force(units, { links }, compactness) {
  const n = units.length;
  const c = Math.min(1, Math.max(0, compactness));
  const charge = 1 + (0.5 - c) * 1.2;
  const pull = c * 0.25;
  // Linked items sit about one item's width apart, plus the gap, so the result is as compact as the charge allows.
  const ideal = units.reduce((s, u) => s + (u.width + u.height) / 2, 0) / n + GAP;
  const at = new Map(
    units.map((u, i) => {
      const angle = (i / n) * 2 * Math.PI;
      const radius = ideal * Math.sqrt(n) * 0.5;
      return [u.id, { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius }];
    })
  );
  const iterations = 300;
  for (let step = 0; step < iterations; step++) {
    const temperature = 160 * (1 - step / iterations) + 2;
    const push = new Map(units.map((u) => [u.id, { x: 0, y: 0 }]));
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = at.get(units[i].id);
        const b = at.get(units[j].id);
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const d = Math.max(Math.hypot(dx, dy), 0.01);
        const repel = ((ideal * ideal) / d) * charge;
        push.get(units[i].id).x += (dx / d) * repel;
        push.get(units[i].id).y += (dy / d) * repel;
        push.get(units[j].id).x -= (dx / d) * repel;
        push.get(units[j].id).y -= (dy / d) * repel;
      }
    }
    for (const [a, b] of links) {
      const pa = at.get(a);
      const pb = at.get(b);
      const dx = pa.x - pb.x;
      const dy = pa.y - pb.y;
      const d = Math.max(Math.hypot(dx, dy), 0.01);
      const attract = (d * d) / ideal;
      push.get(a).x -= (dx / d) * attract;
      push.get(a).y -= (dy / d) * attract;
      push.get(b).x += (dx / d) * attract;
      push.get(b).y += (dy / d) * attract;
    }
    for (const u of units) {
      const p = push.get(u.id);
      const here = at.get(u.id);
      p.x -= here.x * pull;
      p.y -= here.y * pull;
      const length = Math.max(Math.hypot(p.x, p.y), 0.01);
      const move = Math.min(length, temperature);
      const pos = at.get(u.id);
      pos.x += (p.x / length) * move;
      pos.y += (p.y / length) * move;
    }
  }
  return separate(units, at);
}

// Grid: rows and columns in the order of the most connected units first.
function grid(units, { ranked }) {
  const cols = Math.ceil(Math.sqrt(units.length));
  const cellWidth = Math.max(...units.map((u) => u.width)) + GAP;
  const cellHeight = Math.max(...units.map((u) => u.height)) + GAP;
  return new Map(
    ranked.map((u, i) => [u.id, { x: (i % cols) * cellWidth, y: Math.floor(i / cols) * cellHeight }])
  );
}

// Geo: latitude and longitude on a flat map (equirectangular). Units without coordinates sit in a row below.
function geo(units) {
  // The size of the world map drawn behind this layout, so every item lands on its place on it.
  const width = MAP_WIDTH;
  const height = MAP_HEIGHT;
  const at = new Map();
  const unplaced = [];
  for (const u of units) {
    if (u.lat == null || u.lon == null) {
      unplaced.push(u);
      continue;
    }
    at.set(u.id, { x: ((u.lon + 180) / 360) * width, y: ((90 - u.lat) / 180) * height });
  }
  separate(units.filter((u) => at.has(u.id)), at);
  placeLeftovers(unplaced, at, height + RING);
  return at;
}

// Timeline: left to right by date. Units that would overlap in time go to the next row down, so none overlap. Units
// with no date sit in a row below.
function timeline(units, scale) {
  const dated = units.filter((u) => u.year != null).sort((a, b) => a.year - b.year);
  const at = new Map();
  if (dated.length > 0) {
    const min = dated[0].year;
    const max = dated[dated.length - 1].year;
    const width = Math.max(2400, dated.length * 260);
    const rowHeight = Math.max(...dated.map((u) => u.height)) + GAP;
    const rowEnds = [];
    for (const u of dated) {
      const x = max > min ? toPosition(scale, u.year, min, max) * width : 0;
      const left = x - u.width / 2;
      let row = rowEnds.findIndex((end) => end + GAP <= left);
      if (row < 0) row = rowEnds.length;
      rowEnds[row] = left + u.width;
      at.set(u.id, { x, y: row * rowHeight });
    }
    placeLeftovers(units, at, rowEnds.length * rowHeight + rowHeight);
  } else {
    placeLeftovers(units, at, 0);
  }
  return at;
}

// Puts the units a layout could not place in a row, starting at the given y, centred on x = 0.
function placeLeftovers(units, at, startY) {
  const rest = units.filter((u) => !at.has(u.id));
  if (rest.length === 0) return;
  const total = rest.reduce((s, u) => s + u.width + GAP, -GAP);
  let x = -total / 2;
  for (const u of rest) {
    at.set(u.id, { x: x + u.width / 2, y: startY });
    x += u.width + GAP;
  }
}

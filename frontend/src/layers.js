// Layers: named groups of tags that can be switched on and off, to see a crowded graph a part at a time.
// A tile belongs to a layer when it carries one of the layer's tags. A tile in several layers is shown while any of them
// is on. A tile in no layer is shown unless "not in any layer" is switched off. Frames are never hidden by layers.

/** A short id for a new layer. */
export function newLayerId() {
  return `l${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** The ids of the layers a tile with these tags belongs to. */
export function layersOf(tags, layers) {
  const own = new Set(tags || []);
  return layers.filter((layer) => layer.tags.some((tag) => own.has(tag))).map((layer) => layer.id);
}

/**
 * The ids of the items hidden by switched-off layers, or null when nothing is hidden. off is the set of layer ids that
 * are switched off; otherOff is true when the items in no layer are switched off.
 */
export function layerHidden(nodes, layers, off, otherOff) {
  if (layers.length === 0 || (off.size === 0 && !otherOff)) return null;
  const hidden = new Set();
  for (const n of nodes) {
    if (n.type === 'shape') continue;
    const own = layersOf(n.data.node.tags, layers);
    const show = own.length > 0 ? own.some((id) => !off.has(id)) : !otherOff;
    if (!show) hidden.add(n.id);
  }
  return hidden;
}

/** Black or white text, whichever reads better on this #rrggbb background. */
export function readableOn(hex) {
  const n = parseInt(hex.slice(1), 16);
  const luma = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return luma > 0.6 ? '#111827' : '#ffffff';
}

/**
 * How a tile with these tags is coloured by its layers: { color, fill } from the first layer (in the sidebar's order) that
 * the tile is in and that has that colour, or null when no layer colours it.
 */
export function layerLook(tags, layers) {
  const own = new Set(tags || []);
  let color = null;
  let fill = null;
  for (const layer of layers) {
    if (!layer.tags.some((tag) => own.has(tag))) continue;
    if (!color && layer.color) color = layer.color;
    if (!fill && layer.fill) fill = layer.fill;
  }
  return color || fill ? { color, fill } : null;
}

/** A light shade of a #rrggbb colour: the colour mixed with white. Used as the default fill for a layer's line colour. */
export function lighten(hex, amount = 0.82) {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c) => Math.round(c + (255 - c) * amount).toString(16).padStart(2, '0');
  return `#${mix((n >> 16) & 255)}${mix((n >> 8) & 255)}${mix(n & 255)}`;
}

/** Ready-made colour pairs for a layer: a strong line colour and a light shade that dark text reads well on. */
export const LAYER_PRESETS = [
  { name: 'Blue', color: '#2563eb', fill: '#dbeafe' },
  { name: 'Sky', color: '#0891b2', fill: '#cffafe' },
  { name: 'Teal', color: '#0f766e', fill: '#ccfbf1' },
  { name: 'Green', color: '#15803d', fill: '#dcfce7' },
  { name: 'Lime', color: '#65a30d', fill: '#ecfccb' },
  { name: 'Yellow', color: '#ca8a04', fill: '#fef9c3' },
  { name: 'Orange', color: '#d97706', fill: '#fde8c8' },
  { name: 'Red', color: '#dc2626', fill: '#fee2e2' },
  { name: 'Pink', color: '#be185d', fill: '#fce7f3' },
  { name: 'Purple', color: '#7c3aed', fill: '#ede9fe' },
  { name: 'Indigo', color: '#4f46e5', fill: '#e0e7ff' },
  { name: 'Slate', color: '#475569', fill: '#e2e8f0' },
];

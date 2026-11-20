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

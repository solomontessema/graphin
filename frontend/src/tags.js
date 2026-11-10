// Tags (codes) on tiles and links. A tag is a short lower-case label such as "trust" or "stance: against". Researchers
// use them to code their material and then filter and colour the graph by code.

// Colours a tag gets until the user picks one. A tag always gets the same colour from its name.
export const TAG_PALETTE = ['#2563eb', '#dc2626', '#15803d', '#d97706', '#7c3aed', '#0891b2', '#be185d', '#65a30d', '#ea580c', '#4f46e5', '#0f766e', '#a16207'];

/** A tag as it is stored: trimmed, single spaces, lower case, no commas, at most 40 characters. */
export function normalizeTag(text) {
  return text.replace(/,/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 40);
}

/** The colour of a tag: the one the user chose, or one from the palette picked by the tag's name. */
export function tagColour(tag, chosen) {
  if (chosen && chosen[tag]) return chosen[tag];
  let hash = 0;
  for (const ch of tag) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return TAG_PALETTE[hash % TAG_PALETTE.length];
}

/** Every tag in use, with how many tiles and links carry it, most used first. */
export function collectTags(nodes, edges) {
  const found = new Map();
  const count = (tags, kind) => {
    for (const tag of tags || []) {
      if (!found.has(tag)) found.set(tag, { tag, tiles: 0, links: 0 });
      found.get(tag)[kind] += 1;
    }
  };
  for (const node of nodes) if (node.type !== 'shape' && node.type !== 'text') count(node.tags, 'tiles');
  for (const edge of edges) count(edge.tags, 'links');
  return [...found.values()].sort((a, b) => b.tiles + b.links - (a.tiles + a.links) || a.tag.localeCompare(b.tag));
}

/** Whether an item's tags match the chosen ones: any of them, or all of them. */
export function matchesTags(tags, chosen, mode) {
  if (chosen.size === 0) return true;
  const own = new Set(tags || []);
  return mode === 'all' ? [...chosen].every((t) => own.has(t)) : [...chosen].some((t) => own.has(t));
}

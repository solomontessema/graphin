// The standard kinds of relationship between two items. Choosing one keeps links comparable across a graph: a
// researcher can filter by "contradicts" and mean the same thing every time. A free-text label is still possible.
// colour: the line colour a new link of this kind starts with.
export const RELATIONSHIPS = [
  { id: 'SUPPORTS', label: 'supports', hint: 'A gives evidence for B.', colour: '#15803d' },
  { id: 'CONTRADICTS', label: 'contradicts', hint: 'A gives evidence against B.', colour: '#dc2626' },
  { id: 'CAUSES', label: 'causes', hint: 'A brings B about.', colour: '#d97706' },
  { id: 'LEADS_TO', label: 'leads to', hint: 'B follows A in time or in an argument.', colour: '#2563eb' },
  { id: 'INFLUENCES', label: 'influences', hint: 'A shapes B without fully causing it.', colour: '#7c3aed' },
  { id: 'RESPONDS_TO', label: 'responds to', hint: 'A is a reaction to B.', colour: '#0891b2' },
  { id: 'EXAMPLE_OF', label: 'example of', hint: 'A is a case of B.', colour: '#65a30d' },
  { id: 'PART_OF', label: 'part of', hint: 'A is a piece of B.', colour: '#0f766e' },
  { id: 'EXPLAINS', label: 'explains', hint: 'A helps understand B.', colour: '#4f46e5' },
  { id: 'CITES', label: 'cites', hint: 'A refers to B as a source.', colour: '#a16207' },
  { id: 'USES', label: 'uses', hint: 'A makes use of B.', colour: '#be185d' },
  { id: 'RELATED', label: 'related to', hint: 'A connection that has no better word.', colour: '#7a869c' },
];

export const RELATIONSHIP_IDS = new Set(RELATIONSHIPS.map((r) => r.id));

/** The preset for a stored relationship such as "SUPPORTS", or undefined for a custom one. */
export const presetFor = (relationship) => RELATIONSHIPS.find((r) => r.id === relationship);

/** The stored form of a typed relationship: "leads to" becomes LEADS_TO. */
export const toRelationship = (text) => text.trim().toUpperCase().replace(/[\s-]+/g, '_');

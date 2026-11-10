// The kinds of map that can sit behind the canvas in the Geo layout. All use the same projection, so items stay where
// their latitude and longitude put them whichever is chosen.
export const MAP_TYPES = [
  { id: 'geographic', label: 'Geographic', hint: 'Land and sea.' },
  { id: 'political', label: 'Political', hint: 'Countries in colour, with their names.' },
  { id: 'topographic', label: 'Topographic', hint: 'Shaded relief of the land and the depth of the sea.' },
  { id: 'satellite', label: 'Satellite', hint: 'The Earth from space (NASA Blue Marble).' },
  { id: 'dark', label: 'Dark', hint: 'Pale land on a dark sea, so bright tiles stand out.' },
  { id: 'outline', label: 'Outline', hint: 'Black outlines on white, for printing.' },
];

export const DEFAULT_MAP_TYPE = 'geographic';

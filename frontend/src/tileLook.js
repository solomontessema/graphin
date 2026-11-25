import { layerLook, readableOn } from './layers.js';
import { tagColour } from './tags.js';
import { readableText } from './utils.js';

/**
 * The background a tile has on the canvas, so the expanded tile and its preview can keep it: a layer's shade first, then the
 * colour of its first tag (when tags fill the tiles), then the tile's own fill. Returns { className, style } for the element
 * that holds the tile's content, or null for a plain tile (which follows the theme). The theme's colour names are set to
 * match the background, so the text, lines and buttons inside stay readable whatever the theme is.
 */
export function tilePaint(node, tagColours, tagMode, layers) {
  const tags = node.tags || [];
  let fill = layerLook(tags, layers)?.fill;
  let text = fill ? readableOn(fill) : null;
  if (!fill && tagMode === 'fill' && tags.length > 0) {
    const tint = tagColour(tags[0], tagColours);
    if (tint) {
      fill = `color-mix(in srgb, ${tint} 22%, white)`;
      text = '#111827';
    }
  }
  if (!fill && node.style?.fill) {
    fill = node.style.fill;
    text = node.style.text || readableText(fill);
  }
  if (!fill) return null;
  const dark = text === '#ffffff';
  const mix = (share) => `color-mix(in srgb, ${text} ${share}%, ${fill})`;
  return {
    className: `painted ${dark ? 'painted-dark' : 'painted-light'}`,
    style: {
      '--bg': fill,
      '--surface': fill,
      '--surface-2': mix(7),
      '--text': text,
      '--muted': mix(70),
      '--border': mix(22),
      '--accent': dark ? '#bfdbfe' : '#1d4ed8',
      '--accent-ink': dark ? '#0b1220' : '#ffffff',
      colorScheme: dark ? 'dark' : 'light',
      background: fill,
      color: text,
    },
  };
}

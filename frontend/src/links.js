import { youtubeThumbUrl } from './utils.js';

// A tile has one list of links: web pages, pictures, videos and PDFs, in the order they were added. What a link is
// follows from its address, so a tile needs no "type". Older tiles kept their first link in "url" and the others in
// "references"; linksOf reads both as one list.

const IMAGE = /\.(png|jpe?g|gif|webp|svg|avif)(\?|#|$)/i;
const PDF = /\.pdf(\?|#|$)/i;
const VIDEO_HOST = /(^|\.)(youtube\.com|youtu\.be|vimeo\.com)$/i;
const VIDEO_FILE = /\.(mp4|webm|mov|m4v)(\?|#|$)/i;

/** What a link points to: 'image', 'video', 'pdf' or 'page'. */
export function kindOf(url) {
  let host = '';
  let path = url;
  try {
    const parsed = new URL(url);
    host = parsed.hostname;
    path = parsed.pathname + parsed.search;
  } catch {
    // Not a valid address: treat it as a page.
  }
  if (IMAGE.test(path)) return 'image';
  if (PDF.test(path)) return 'pdf';
  if (VIDEO_HOST.test(host) || VIDEO_FILE.test(path)) return 'video';
  return 'page';
}

export const KIND_LABEL = { image: 'Image', video: 'Video', pdf: 'PDF', page: 'Page' };

/** Every link of a tile as [{url, title?}], the first one first, without repeats. */
export function linksOf(node) {
  const seen = new Set();
  const list = [];
  for (const link of [...(node.url ? [{ url: node.url }] : []), ...(node.references || [])]) {
    if (!link?.url || seen.has(link.url)) continue;
    seen.add(link.url);
    list.push(link);
  }
  return list;
}

/**
 * The picture a tile shows on top: its first image or video link. For an image that is the image itself; for a video it
 * is the still YouTube publishes, or the tile's saved thumbnail. Returns null when the tile has no image or video.
 */
export function mediaOf(node) {
  const link = linksOf(node).find((l) => ['image', 'video'].includes(kindOf(l.url)));
  if (!link) return null;
  const kind = kindOf(link.url);
  return { kind, url: link.url, src: kind === 'image' ? link.url : youtubeThumbUrl(link.url) || node.thumbnail_url || null };
}

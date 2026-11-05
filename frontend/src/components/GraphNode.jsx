import { useEffect, useRef, useState } from 'react';
import { NodeResizer, useStore } from '@xyflow/react';
import { appearanceVars, youtubeEmbedUrl, youtubeThumbUrl } from '../utils.js';
import NodeTools from './NodeTools.jsx';
import SideHandles from './SideHandles.jsx';

// The kinds of item that link to a page. Their type badge is the link. Notes have no badge.
const LINKED_TYPES = ['webpage', 'pdf', 'image', 'video'];

/**
 * A saved link on the canvas. When zoomed far out it shows only the title (semantic zoom),
 * and when zoomed in it adds the thumbnail, favicon, and commentary.
 */
export default function GraphNode({ id, data, selected }) {
  const zoom = useStore((state) => state.transform[2]);
  const { node, dim, highlight, actions } = data;
  const compact = zoom < 0.6;
  const linked = Boolean(node.url) && LINKED_TYPES.includes(node.type);
  // Images and videos show a picture on top and their text below, like the tiles of a media app.
  const isMedia = node.type === 'image' || node.type === 'video';
  const mediaSrc =
    node.type === 'image' ? node.url : node.thumbnail_url || (node.url && youtubeThumbUrl(node.url)) || null;

  // A tile squeezed by its container has a stored size; otherwise it sizes itself.
  const sized = node.width != null;
  const className = [
    'link-node',
    compact && 'compact',
    selected && 'selected',
    dim && 'dim',
    highlight && 'highlight',
  ]
    .filter(Boolean)
    .join(' ');
  // The stored height is a minimum: the node grows to fit all of its commentary.
  const size = sized ? { width: node.width, minHeight: node.height } : {};

  // Broken images hide themselves rather than showing a broken-image icon.
  const hideOnError = (event) => {
    event.currentTarget.style.display = 'none';
  };

  return (
    <div className={className} data-type={node.type} style={{ ...appearanceVars(node.style, 'node'), ...size }}>
      <SideHandles />

      <NodeTools label={node.title} onEdit={() => actions.edit(id)} onRemove={() => actions.remove(id)} />

      {/* Dragging an edge of a selected tile changes its size. The stored height is the least it can be. */}
      <NodeResizer
        minWidth={140}
        minHeight={70}
        isVisible={selected}
        onResize={(_, box) => actions.resizeTile(id, box, false)}
        onResizeEnd={(_, box) => actions.resizeTile(id, box, true)}
        lineStyle={{ borderWidth: 6, borderColor: 'transparent' }}
      />

      {!compact && isMedia && (
        <div className="thumb-media">
          {mediaSrc ? (
            <img src={mediaSrc} alt="" loading="lazy" referrerPolicy="no-referrer" onError={hideOnError} />
          ) : (
            <span className="thumb-placeholder">{node.type === 'video' ? '▶ Video' : 'Image'}</span>
          )}
        </div>
      )}

      {!compact && !isMedia && node.thumbnail_url && (
        <img className="node-thumb" src={node.thumbnail_url} alt="" loading="lazy" referrerPolicy="no-referrer" onError={hideOnError} />
      )}

      {node.type !== 'note' && (
        <div className="node-head">
          {!compact && node.favicon_url && (
            <img className="node-favicon" src={node.favicon_url} alt="" referrerPolicy="no-referrer" onError={hideOnError} />
          )}
          {linked ? (
            <PageBadge url={node.url} type={node.type} title={node.title} />
          ) : (
            <span className="type-badge">{node.type}</span>
          )}
        </div>
      )}

      <div className="node-title">{node.title}</div>

      {!compact && node.commentary && <div className="node-commentary">{node.commentary}</div>}

    </div>
  );
}

/**
 * The type badge of a linked tile (WEBPAGE, PDF, IMAGE). Clicking it opens the page in a new tab. Hovering it
 * shows the page above the tile: an iframe, or the picture for an image. The page hides when the pointer leaves
 * the badge and what it reveals.
 */
function PageBadge({ url, type, title }) {
  const [shown, setShown] = useState(false);
  const closing = useRef(null);
  useEffect(() => () => clearTimeout(closing.current), []);
  // The window closes a moment after the pointer leaves, so the pointer can cross the gap to it.
  const open = () => {
    clearTimeout(closing.current);
    setShown(true);
  };
  const close = () => {
    closing.current = setTimeout(() => setShown(false), 400);
  };
  return (
    <span className="page-badge nodrag" onMouseEnter={open} onMouseLeave={close}>
      <a
        className="type-badge type-link"
        href={url}
        target="_blank"
        rel="noreferrer"
        onClick={(event) => event.stopPropagation()}
      >
        {type}
      </a>
      {shown && (
        <div className="page-window nowheel">
          <div className="page-window-bar">{title}</div>
          {type === 'image' ? (
            <img className="page-window-image" src={url} alt={title} />
          ) : (
            <iframe
              className="page-window-frame"
              src={youtubeEmbedUrl(url) || url}
              title={title}
              referrerPolicy="strict-origin-when-cross-origin"
              allow="fullscreen; autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          )}
        </div>
      )}
    </span>
  );
}

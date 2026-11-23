import { useLayoutEffect, useRef, useState } from 'react';
import { NodeResizer } from '@xyflow/react';
import { appearanceVars } from '../utils.js';
import { linksOf, mediaOf } from '../links.js';
import NodeTools from './NodeTools.jsx';
import SideHandles from './SideHandles.jsx';
import ReferencesBadge from './ReferencesBadge.jsx';
import TexText from './TexText.jsx';
import RichText from './RichText.jsx';
import { tagColour } from '../tags.js';
import { readableOn } from '../layers.js';

/**
 * A saved link on the canvas. It always shows everything, and a circle or ellipse grows until its text fits inside it.
 * Zooming only scales the picture (the tiles and the arrows together); a tile never changes its layout with the zoom.
 */
export default function GraphNode({ id, data, selected }) {
  const { node, dim, highlight, actions, tagColours, tagMode, readOnly, layerLook } = data;
  // A layer can give all its tiles one shape; it then wins over the tile's own shape.
  const shape = layerLook?.shape || node.shape;
  const circle = shape === 'circle';
  const round = circle || shape === 'ellipse';
  const baseW = node.width ?? (circle ? 170 : 220);
  const baseH = node.height ?? (circle ? baseW : null);

  // A circle or ellipse grows until its text fits inside the curve, measured from its content.
  const contentRef = useRef(null);
  const [fit, setFit] = useState(null);
  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!round || !el) {
      setFit(null);
      return undefined;
    }
    const measure = () => {
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const next = circle
        ? { w: Math.ceil(Math.hypot(w, h)) + 28, h: Math.ceil(Math.hypot(w, h)) + 28 }
        : { w: Math.ceil(w * 1.42) + 28, h: Math.ceil(h * 1.42) + 24 };
      setFit((prev) => (prev && prev.w === next.w && prev.h === next.h ? prev : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [round, circle, node.title, node.commentary, node.url, node.references]);
  // A tile has one list of links. If one of them is an image or a video, the first of these is shown on top of the tile.
  const links = linksOf(node);
  const media = mediaOf(node);

  // A tile the user has resized has a stored size; otherwise it sizes itself.
  const sized = node.width != null;
  const className = [
    'link-node',
    selected && 'selected',
    dim && 'dim',
    highlight && 'highlight',
    shape && shape !== 'rect' && `shape-${shape}`,
  ]
    .filter(Boolean)
    .join(' ');
  // The size the tile is drawn at: it grows to fit all of its text. The stored height is a minimum.
  let size;
  if (round && fit) {
    const width = Math.max(baseW, fit.w);
    size = circle ? { width, height: width } : { width, height: Math.max(baseH ?? 130, fit.h) };
  } else {
    size = sized ? { width: node.width, minHeight: node.height } : {};
  }
  // Broken images hide themselves rather than showing a broken-image icon.
  const hideOnError = (event) => {
    event.currentTarget.style.display = 'none';
  };

  // Colour by tag: the tile takes the colour of its first tag, as its frame or as a light background.
  const tags = node.tags || [];
  const tint = tagMode && tagMode !== 'off' && tags.length > 0 ? tagColour(tags[0], tagColours) : null;
  const tintVars = !tint
    ? {}
    : tagMode === 'fill'
      ? { '--node-fill': `color-mix(in srgb, ${tint} 22%, white)`, '--node-text': '#111827' }
      : { '--node-frame': tint, '--node-frame-w': '4px' };
  // Layers colour a tile too: a line colour for its frame and a shade for its background. They win over the tag colour.
  if (layerLook?.color) Object.assign(tintVars, { '--node-frame': layerLook.color, '--node-frame-w': '4px' });
  if (layerLook?.fill) Object.assign(tintVars, { '--node-fill': layerLook.fill, '--node-text': readableOn(layerLook.fill) });

  return (
    <div className={className} style={{ ...appearanceVars(node.style, 'node'), ...tintVars, ...size }}>
      <SideHandles />

      <NodeTools
        label={node.title}
        onEdit={readOnly ? undefined : () => actions.edit(id)}
        onRemove={readOnly ? undefined : () => actions.remove(id)}
        onMaximize={() => actions.maximize(id)}
      />

      {/* Dragging an edge of a selected tile changes its size. The stored height is the least it can be. */}
      <NodeResizer
        minWidth={140}
        minHeight={70}
        keepAspectRatio={circle}
        isVisible={selected && !readOnly}
        onResize={(_, box) => actions.resizeTile(id, box, false)}
        onResizeEnd={(_, box) => actions.resizeTile(id, box, true)}
        lineStyle={{ borderWidth: 6, borderColor: 'transparent' }}
      />

      <div className="tile-content" ref={contentRef}>
        {media && (
          <div className="thumb-media">
            {media.src ? (
              <img src={media.src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={hideOnError} />
            ) : (
              <span className="thumb-placeholder">{media.kind === 'video' ? '▶ Video' : 'Image'}</span>
            )}
          </div>
        )}

        {!media && node.thumbnail_url && (
          <img className="node-thumb" src={node.thumbnail_url} alt="" loading="lazy" referrerPolicy="no-referrer" onError={hideOnError} />
        )}

        {node.favicon_url && (
          <div className="node-head">
            <img className="node-favicon" src={node.favicon_url} alt="" referrerPolicy="no-referrer" onError={hideOnError} />
          </div>
        )}

        <div className="node-title">
          <TexText text={node.title} />
        </div>

        {node.commentary && (
          <div className="node-commentary">
            <RichText text={node.commentary} />
          </div>
        )}

        {tags.length > 0 && (
          <div className="tile-tags">
            {tags.slice(0, 4).map((tag) => (
              <span key={tag} className="tag-chip" style={{ '--tag': tagColour(tag, tagColours) }} title={tag}>
                {tag}
              </span>
            ))}
            {tags.length > 4 && <span className="muted">+{tags.length - 4}</span>}
          </div>
        )}

        {links.length > 0 && (
          <div className="node-refs">
            <ReferencesBadge references={links} />
          </div>
        )}
      </div>

    </div>
  );
}

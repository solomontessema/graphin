import { useLayoutEffect, useRef, useState } from 'react';
import { NodeResizer, useStore } from '@xyflow/react';
import { appearanceVars } from '../utils.js';
import { linksOf, mediaOf } from '../links.js';
import NodeTools from './NodeTools.jsx';
import SideHandles from './SideHandles.jsx';
import ReferencesBadge from './ReferencesBadge.jsx';
import { tagColour } from '../tags.js';

// The largest title size that fits a box with room to spare, from a rough count of the characters that fit on a line.
// Bold letters are wide, words break early, and the box keeps a margin, so the estimate is cautious.
function fitTitleSize(title, width, height) {
  const text = title.trim() || ' ';
  const usableWidth = width * 0.9;
  const usableHeight = height * 0.8;
  for (let size = 34; size >= 14; size -= 2) {
    const perLine = Math.max(1, Math.floor(usableWidth / (size * 0.68)));
    const lines = Math.ceil((text.length * 1.15) / perLine);
    if (lines * size * 1.25 <= usableHeight) return size;
  }
  return 14;
}

/**
 * A saved link on the canvas. Zoomed in, it shows everything, and a circle or ellipse grows until its text fits
 * inside it. Zoomed far out (semantic zoom) it shows only its title, bold and as large as fits the tile.
 */
export default function GraphNode({ id, data, selected }) {
  const zoom = useStore((state) => state.transform[2]);
  const { node, dim, highlight, actions, tagColours, tagMode } = data;
  // Detail grows smoothly with the zoom instead of switching in steps. Under 40% only the title shows. Above that the
  // title shrinks gradually from its big far-out size to its normal size, the commentary appears one line at a time
  // (fading in) until 100%, where all of it shows, and the badge and picture fade in.
  const compact = zoom < 0.4;
  const ease = (from, to) => {
    const x = Math.min(1, Math.max(0, (zoom - from) / (to - from)));
    return x * x * (3 - 2 * x);
  };
  const near = ease(0.3, 0.8);
  const fadeCommentary = ease(0.4, 0.6);
  const fadeExtras = ease(0.45, 0.7);
  const circle = node.shape === 'circle';
  const round = circle || node.shape === 'ellipse';
  const baseW = node.width ?? (circle ? 170 : 220);
  const baseH = node.height ?? (circle ? baseW : null);

  // The commentary shows one more line at each step of the zoom until all of it shows at 100%. The number of lines it
  // has in all is estimated from its length and the width of the text.
  const textWidth = round ? (node.shape === 'ellipse' ? 200 : 180) : baseW - 16;
  const totalLines = Math.max(2, Math.ceil((node.commentary?.length ?? 0) / Math.max(12, Math.floor(textWidth / 6.6))));
  const commentaryLines = zoom >= 1 ? null : Math.max(1, Math.round(1 + ((zoom - 0.4) / 0.6) * (totalLines - 1)));

  // A circle or ellipse grows until its text fits inside the curve, measured from its content.
  const contentRef = useRef(null);
  const [fit, setFit] = useState(null);
  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!round || compact || !el) {
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
  }, [round, circle, compact, node.title, node.commentary, node.url, node.references]);
  // A tile has one list of links. If one of them is an image or a video, the first of these is shown on top of the tile.
  const links = linksOf(node);
  const media = mediaOf(node);

  // A tile the user has resized has a stored size; otherwise it sizes itself.
  const sized = node.width != null;
  const className = [
    'link-node',
    compact && 'compact',
    selected && 'selected',
    dim && 'dim',
    highlight && 'highlight',
    node.shape && node.shape !== 'rect' && `shape-${node.shape}`,
  ]
    .filter(Boolean)
    .join(' ');
  // The size the tile is drawn at. Far out it keeps its own size; zoomed in it grows to fit all of its text. The
  // stored height is a minimum.
  let size;
  if (compact) {
    size = round ? { width: baseW, height: circle ? baseW : (baseH ?? 130) } : { width: baseW, minHeight: node.height ?? undefined };
  } else if (round && fit) {
    const width = Math.max(baseW, fit.w);
    size = circle ? { width, height: width } : { width, height: Math.max(baseH ?? 130, fit.h) };
  } else {
    size = sized ? { width: node.width, minHeight: node.height } : {};
  }
  // Far out, the title is the only text: bold, and as large as fits the tile. As the zoom rises it eases down to the
  // normal title size and weight, so there is no sudden change.
  const farTitle =
    zoom < 0.8
      ? fitTitleSize(
          node.title,
          circle ? baseW * 0.7 : round ? baseW * 0.78 : baseW - 28,
          circle ? baseW * 0.7 : round ? (baseH ?? 130) * 0.55 : 100
        )
      : null;
  const titleStyle =
    farTitle === null ? undefined : { fontSize: Math.round(farTitle + (14 - farTitle) * near), fontWeight: Math.round(800 - 200 * near) };
  const titleCentred = zoom < 0.55;

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

  return (
    <div className={className} style={{ ...appearanceVars(node.style, 'node'), ...tintVars, ...size }}>
      <SideHandles />

      <NodeTools label={node.title} onEdit={() => actions.edit(id)} onRemove={() => actions.remove(id)} />

      {/* Dragging an edge of a selected tile changes its size. The stored height is the least it can be. */}
      <NodeResizer
        minWidth={140}
        minHeight={70}
        keepAspectRatio={node.shape === 'circle'}
        isVisible={selected}
        onResize={(_, box) => actions.resizeTile(id, box, false)}
        onResizeEnd={(_, box) => actions.resizeTile(id, box, true)}
        lineStyle={{ borderWidth: 6, borderColor: 'transparent' }}
      />

      <div className="tile-content" ref={contentRef}>
        {!compact && media && (
          <div className="thumb-media fade" style={{ opacity: fadeExtras }}>
            {media.src ? (
              <img src={media.src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={hideOnError} />
            ) : (
              <span className="thumb-placeholder">{media.kind === 'video' ? '▶ Video' : 'Image'}</span>
            )}
          </div>
        )}

        {!compact && !media && node.thumbnail_url && (
          <img className="node-thumb fade" style={{ opacity: fadeExtras }} src={node.thumbnail_url} alt="" loading="lazy" referrerPolicy="no-referrer" onError={hideOnError} />
        )}

        {!compact && node.favicon_url && (
          <div className="node-head fade" style={{ opacity: fadeExtras }}>
            <img className="node-favicon" src={node.favicon_url} alt="" referrerPolicy="no-referrer" onError={hideOnError} />
          </div>
        )}

        <div
          className={`node-title${titleCentred ? ' centred' : ''}`}
          style={titleStyle}
        >
          {node.title}
        </div>

        {!compact && node.commentary && (
          <div
            className={`node-commentary fade${commentaryLines ? ' clamped' : ''}`}
            style={{ opacity: fadeCommentary, WebkitLineClamp: commentaryLines ?? undefined }}
          >
            {node.commentary}
          </div>
        )}

        {!compact && tags.length > 0 && (
          <div className="tile-tags fade" style={{ opacity: fadeExtras }}>
            {tags.slice(0, 4).map((tag) => (
              <span key={tag} className="tag-chip" style={{ '--tag': tagColour(tag, tagColours) }} title={tag}>
                {tag}
              </span>
            ))}
            {tags.length > 4 && <span className="muted">+{tags.length - 4}</span>}
          </div>
        )}

        {!compact && links.length > 0 && (
          <div className="node-refs fade" style={{ opacity: fadeExtras }}>
            <ReferencesBadge references={links} />
          </div>
        )}
      </div>

    </div>
  );
}

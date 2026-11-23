import { useLayoutEffect, useRef, useState } from 'react';
import { NodeResizer, useStore } from '@xyflow/react';
import { appearanceVars, textScale } from '../utils.js';
import { linksOf, mediaOf } from '../links.js';
import NodeTools from './NodeTools.jsx';
import SideHandles from './SideHandles.jsx';
import ReferencesBadge from './ReferencesBadge.jsx';
import TexText from './TexText.jsx';
import RichText from './RichText.jsx';
import { tagColour } from '../tags.js';
import { readableOn } from '../layers.js';

// The largest title size that fits a box with room to spare, from a rough count of the characters that fit on a line.
// Bold letters are wide, words break early, and the box keeps a margin, so the estimate is cautious.
function fitTitleSize(title, width, height) {
  const text = title.trim() || ' ';
  const usableWidth = width * 0.9;
  const usableHeight = height * 0.8;
  for (let size = 72; size >= 14; size -= 2) {
    const perLine = Math.max(1, Math.floor(usableWidth / (size * 0.68)));
    const lines = Math.ceil((text.length * 1.15) / perLine);
    // The longest word must fit on one line, or it would be broken in the middle.
    const longest = Math.max(...text.split(/\s+/).map((word) => word.length));
    if (longest * size * 0.62 <= usableWidth && lines * size * 1.25 <= usableHeight) return size;
  }
  return 14;
}

/**
 * A saved link on the canvas. The tile's box never depends on the zoom (it is sized by its full content, kept in an
 * invisible copy), so tiles and arrows scale together. What is shown inside changes with the zoom (semantic zoom): far out
 * only the title, then part of the description, then everything. The text is scaled up as the zoom falls, but more slowly
 * than the tile shrinks, so it stays readable at a distance.
 */
export default function GraphNode({ id, data, selected }) {
  const zoom = useStore((state) => state.transform[2]);
  const { node, dim, highlight, actions, tagColours, tagMode, readOnly, layerLook } = data;
  // Detail grows smoothly with the zoom instead of switching in steps. Under 40% only the title shows. Above that the
  // commentary appears one line at a time (fading in) until 100%, where all of it shows, and the badge and picture fade in.
  const far = zoom < 0.4;
  const ease = (from, to) => {
    const x = Math.min(1, Math.max(0, (zoom - from) / (to - from)));
    return x * x * (3 - 2 * x);
  };
  const near = ease(0.3, 0.8);
  const fadeCommentary = ease(0.4, 0.6);
  const fadeExtras = ease(0.45, 0.7);
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
  // The size the tile is drawn at: it grows to fit all of its text, at every zoom. The stored height is a minimum.
  let size;
  if (round && fit) {
    const width = Math.max(baseW, fit.w);
    size = circle ? { width, height: width } : { width, height: Math.max(baseH ?? 130, fit.h) };
  } else {
    size = sized ? { width: node.width, minHeight: node.height } : {};
  }
  // The box the visible layer fills (the same as the tile's inside), measured so the title can be sized to fit it.
  const viewRef = useRef(null);
  const [box, setBox] = useState(null);
  useLayoutEffect(() => {
    const el = viewRef.current;
    if (!el) return undefined;
    const measure = () => setBox((prev) => (prev && prev.w === el.offsetWidth && prev.h === el.offsetHeight ? prev : { w: el.offsetWidth, h: el.offsetHeight }));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // The text is drawn larger as the zoom falls, but more slowly than the tile shrinks. It never grows past what lets the
  // title fit inside the tile.
  const fitScale = box
    ? fitTitleSize(node.title, circle ? box.w * 0.7 : round ? box.w * 0.78 : box.w - 28, circle ? box.h * 0.7 : round ? box.h * 0.55 : box.h * 0.8) / 14
    : 1;
  // Where only the title is left (under 40%) it grows to the largest size that fits the tile, so there is room for big text
  // that can be read from far away. It eases up to that size as the description fades out.
  const usual = Math.min(textScale(zoom), fitScale);
  const scale = Math.max(1, usual + (fitScale - usual) * (1 - ease(0.3, 0.45)));
  // The title is bold when far, easing to its normal weight as the zoom rises.
  const titleStyle = zoom < 0.8 ? { fontWeight: Math.round(800 - 200 * near) } : undefined;
  // The commentary shows one more line at each step of the zoom until all of it shows at 100%. The number of lines it has
  // in all is estimated from its length and the width of the text (narrower, the larger the text is drawn).
  const textWidth = (round ? (shape === 'ellipse' ? 200 : 180) : baseW - 16) / scale;
  const totalLines = Math.max(2, Math.ceil((node.commentary?.length ?? 0) / Math.max(12, Math.floor(textWidth / 6.6))));
  const commentaryLines = zoom >= 1 ? null : Math.max(1, Math.round(1 + ((zoom - 0.4) / 0.6) * (totalLines - 1)));

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

  // What is inside the tile. ghost is the invisible full copy that sizes the tile; the other is what is seen at this zoom.
  const content = (ghost) => {
    const fade = (opacity) => (ghost ? undefined : { opacity });
    const hidden = !ghost && far;
    return (
      <>
        {!hidden && media && (
          <div className="thumb-media fade" style={fade(fadeExtras)}>
            {media.src ? (
              <img src={media.src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={hideOnError} />
            ) : (
              <span className="thumb-placeholder">{media.kind === 'video' ? '▶ Video' : 'Image'}</span>
            )}
          </div>
        )}

        {!hidden && !media && node.thumbnail_url && (
          <img className="node-thumb fade" style={fade(fadeExtras)} src={node.thumbnail_url} alt="" loading="lazy" referrerPolicy="no-referrer" onError={hideOnError} />
        )}

        {!hidden && node.favicon_url && (
          <div className="node-head fade" style={fade(fadeExtras)}>
            <img className="node-favicon" src={node.favicon_url} alt="" referrerPolicy="no-referrer" onError={hideOnError} />
          </div>
        )}

        <div className="node-title" style={ghost ? undefined : titleStyle}>
          <TexText text={node.title} />
        </div>

        {!hidden && node.commentary && (
          <div
            className={`node-commentary fade${!ghost && commentaryLines ? ' clamped' : ''}`}
            style={ghost ? undefined : { opacity: fadeCommentary, WebkitLineClamp: commentaryLines ?? undefined }}
          >
            <RichText text={node.commentary} />
          </div>
        )}

        {!hidden && tags.length > 0 && (
          <div className="tile-tags fade" style={fade(fadeExtras)}>
            {tags.slice(0, 4).map((tag) => (
              <span key={tag} className="tag-chip" style={{ '--tag': tagColour(tag, tagColours) }} title={tag}>
                {tag}
              </span>
            ))}
            {tags.length > 4 && <span className="muted">+{tags.length - 4}</span>}
          </div>
        )}

        {!hidden && links.length > 0 && (
          <div className="node-refs fade" style={fade(fadeExtras)}>
            <ReferencesBadge references={links} />
          </div>
        )}
      </>
    );
  };

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

      <div className="tile-stack">
        {/* An invisible copy of the full content gives the tile its size at every zoom. */}
        <div className="tile-ghost" ref={contentRef} aria-hidden="true">
          {content(true)}
        </div>
        <div className={`tile-view${zoom < 1 ? ' clipped' : ''}`} ref={viewRef}>
          <div className="tile-scale" style={{ width: `${100 / scale}%`, transform: `scale(${scale})` }}>
            {content(false)}
          </div>
        </div>
      </div>

    </div>
  );
}

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
import { SKETCH_MIN_ZOOM, seedOf, sketchBox } from '../sketch.js';

/**
 * A saved link on the canvas. The tile's box never depends on the zoom (it is sized by its full content, kept in an
 * invisible copy), so tiles and arrows scale together. What is shown inside changes with the zoom (semantic zoom): far out
 * only the title, then part of the description, then everything. The text is scaled up as the zoom falls, but more slowly
 * than the tile shrinks, so it stays readable at a distance.
 */
export default function GraphNode({ id, data, selected }) {
  const zoom = useStore((state) => state.transform[2]);
  const { node, dim, highlight, actions, tagColours, tagMode, readOnly, layerLook, sketchy } = data;
  // The sketchy look draws the tile's outline by hand-made strokes, only while the view is close enough for the wobble to show.
  const sketch = Boolean(sketchy) && zoom >= SKETCH_MIN_ZOOM;
  // Detail grows smoothly with the zoom instead of switching in steps. Under 40% only the title shows. Above that the
  // commentary appears one line at a time (fading in) until 100%, where all of it shows, and the badge and picture fade in.
  const far = zoom < 0.4;
  const ease = (from, to) => {
    const x = Math.min(1, Math.max(0, (zoom - from) / (to - from)));
    return x * x * (3 - 2 * x);
  };
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
    sketch && 'sketchy',
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

  // The sketchy look: the tile's outline is drawn by hand-made strokes instead of the plain border. The tile's whole box is
  // measured for it, and only while it is on and the view is close enough for the wobble to show.
  const rootRef = useRef(null);
  const [outer, setOuter] = useState(null);
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!sketch || !el) return undefined;
    const measure = () => setOuter((prev) => (prev && prev.w === el.offsetWidth && prev.h === el.offsetHeight ? prev : { w: el.offsetWidth, h: el.offsetHeight }));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [sketch]);

  // How much the title can be enlarged and still fit inside the tile, found by measuring a hidden copy of the title (words
  // break if they must). It is only needed once the view is zoomed out.
  const probeRef = useRef(null);
  const zoomedOut = zoom < 0.9;
  const [titleFit, setTitleFit] = useState({ s: 1, breaks: true });
  useLayoutEffect(() => {
    const probe = probeRef.current;
    if (!probe || !box) return;
    const width = circle ? box.w * 0.7 : round ? box.w * 0.78 : box.w - 12;
    const height = circle ? box.h * 0.7 : round ? box.h * 0.55 : box.h - 12;
    const fits = (s) => {
      probe.style.width = `${width / s}px`;
      // It must fit in height, and no unbroken word may stick out at the side.
      return probe.offsetHeight * s <= height && probe.scrollWidth <= Math.ceil(width / s) + 1;
    };
    // The largest enlargement that fits, searched between 1 and 10 times.
    const search = (wrap) => {
      probe.style.overflowWrap = wrap;
      if (!fits(1)) return 1;
      let lo = 1;
      let hi = 10;
      for (let i = 0; i < 9; i += 1) {
        const mid = (lo + hi) / 2;
        if (fits(mid)) lo = mid;
        else hi = mid;
      }
      return lo;
    };
    // A word is only broken when keeping it whole would cost a quarter or more of the size.
    const whole = search('normal');
    const broken = search('anywhere');
    const next = whole >= broken * 0.75 ? { s: whole, breaks: false } : { s: broken, breaks: true };
    setTitleFit((prev) => (Math.abs(prev.s - next.s) < 0.01 && prev.breaks === next.breaks ? prev : next));
  }, [box?.w, box?.h, node.title, round, circle, zoomedOut]);

  // The text is drawn larger as the zoom falls, but more slowly than the tile shrinks, and never so large that the title no
  // longer fits the tile. Where only the title is left (under 40%) the title fills the tile: it is drawn as large as fits.
  // The description under it is whatever fits in the rest of the tile, cut off softly at the tile's edge.
  const usual = Math.min(textScale(zoom, 0.9), titleFit.s);
  const scale = zoom >= 1 ? 1 : Math.max(1, usual + (titleFit.s - usual) * (1 - ease(0.3, 0.45)));
  // The title is in a light, regular weight when it is all that shows, easing to its normal weight as the zoom rises.
  const titleStyle = zoom < 0.8 ? { fontWeight: Math.round(400 + 200 * ease(0.4, 0.8)), overflowWrap: titleFit.breaks ? 'anywhere' : 'normal' } : undefined;

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
          <div className="node-commentary fade" style={ghost ? undefined : { opacity: fadeCommentary }}>
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
    <div ref={rootRef} className={className} style={{ ...appearanceVars(node.style, 'node'), ...tintVars, ...size }}>
      {sketch && outer && (
        <svg className="sketch-outline" width={outer.w} height={outer.h} viewBox={`0 0 ${outer.w} ${outer.h}`} aria-hidden="true">
          {sketchBox(shape || 'rect', outer.w, outer.h, seedOf(id), 1.6).map((d, i) => (
            <path key={i} d={d} />
          ))}
        </svg>
      )}
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

      {/* A hidden copy of the title, measured to find how large it can be drawn inside the tile. */}
      {zoomedOut && (
        <div className="node-title tile-probe" ref={probeRef} aria-hidden="true">
          <TexText text={node.title} />
        </div>
      )}

      <div className="tile-stack">
        {/* An invisible copy of the full content gives the tile its size at every zoom. */}
        <div className="tile-ghost" ref={contentRef} aria-hidden="true">
          {content(true)}
        </div>
        <div className={`tile-view${zoom < 1 ? ' clipped' : ''}${far ? ' title-only' : ''}`} ref={viewRef}>
          <div className="tile-scale" style={{ width: `${100 / scale}%`, height: far ? `${100 / scale}%` : undefined, transform: `scale(${scale})` }}>
            {content(false)}
          </div>
        </div>
      </div>

    </div>
  );
}

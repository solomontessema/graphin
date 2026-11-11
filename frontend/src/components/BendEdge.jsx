import { useLayoutEffect, useRef, useState } from 'react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath, useReactFlow } from '@xyflow/react';
import { tagColour } from '../tags.js';

// How far, in screen pixels, the pointer must move before pressing the label or a point counts as a drag and not a click.
const DRAG_DISTANCE = 4;

// The way a line leaves or enters an item through each side of it.
const OUT = { left: [-1, 0], right: [1, 0], top: [0, -1], bottom: [0, 1] };

/**
 * The line as cubic curves through its points. The ends keep the direction of the default curve, leaving and entering the
 * items straight out of their sides, and the points in between are joined smoothly, so the line can be concave in one
 * place and convex in the next.
 */
function curveThrough(source, mids, target, sourceSide, targetSide) {
  const all = [source, ...mids, target];
  const sOut = OUT[sourceSide] || [1, 0];
  const tOut = OUT[targetSide] || [-1, 0];
  const segments = [];
  for (let i = 0; i < all.length - 1; i += 1) {
    const a = all[i];
    const b = all[i + 1];
    const reach = Math.max(Math.hypot(b.x - a.x, b.y - a.y) * 0.4, 24);
    const c1 = i === 0 ? { x: a.x + sOut[0] * reach, y: a.y + sOut[1] * reach } : { x: a.x + (b.x - all[i - 1].x) / 6, y: a.y + (b.y - all[i - 1].y) / 6 };
    const c2 = i === all.length - 2 ? { x: b.x + tOut[0] * reach, y: b.y + tOut[1] * reach } : { x: b.x - (all[i + 2].x - a.x) / 6, y: b.y - (all[i + 2].y - a.y) / 6 };
    segments.push([a, c1, c2, b]);
  }
  const d = `M ${source.x},${source.y} ` + segments.map(([, c1, c2, b]) => `C ${c1.x},${c1.y} ${c2.x},${c2.y} ${b.x},${b.y}`).join(' ');
  return { d, segments };
}

const pointOn = ([a, c1, c2, b], t) => {
  const u = 1 - t;
  return {
    x: u * u * u * a.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * b.x,
    y: u * u * u * a.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * b.y,
  };
};

/**
 * A link between two items, with its relationship written on it.
 *
 * Hold the label and drag it to bend the line: the line passes through where the label is let go. A second drag bends it
 * further. Double-click the line to add a point there, and drag any point to move it. While the link's card is open (click its
 * label), its points show; double-click a point to remove it. Double-click the label to straighten the whole line.
 *
 * data: { label, pts, fan, active, tags, tagColours, actions: { move(id, pts), commit(id, pts), reset(id), click(event, id) } }
 */
export default function BendEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerStart, markerEnd, style, data }) {
  const { screenToFlowPosition } = useReactFlow();
  const { label, pts: saved = [], fan = 0, active = false, actions, tags = [], tagColours, twoWay = false } = data;
  const drag = useRef(null);
  const dragged = useRef(false);
  const pathRef = useRef(null);
  const [chevron, setChevron] = useState(null);

  const middle = { x: (sourceX + targetX) / 2, y: (sourceY + targetY) / 2 };
  const source = { x: sourceX, y: sourceY };
  const target = { x: targetX, y: targetY };

  // The points the line passes through. Links that share the same two items are spread apart with a point of their own.
  let offsets = saved;
  if (offsets.length === 0 && fan !== 0) {
    const dx = targetX - sourceX;
    const dy = targetY - sourceY;
    const length = Math.hypot(dx, dy) || 1;
    offsets = [[(-dy / length) * fan, (dx / length) * fan]];
  }
  const mids = offsets.map(([x, y]) => ({ x: middle.x + x, y: middle.y + y }));
  const bent = mids.length > 0;

  let path;
  let labelX;
  let labelY;
  let segments = [];
  if (bent) {
    ({ d: path, segments } = curveThrough(source, mids, target, sourcePosition, targetPosition));
    // The label sits on the middle point, or on the middle of the middle stretch when there is an even number of them.
    const onPoint = mids.length % 2 === 1;
    const at = onPoint ? mids[(mids.length - 1) / 2] : pointOn(segments[mids.length / 2], 0.5);
    labelX = at.x;
    labelY = at.y;
  } else {
    [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  }

  // A small arrow on the line, a little past the label towards the target, so the direction can be read without
  // looking at the ends. It is placed from the drawn line itself, so it follows any bend.
  useLayoutEffect(() => {
    const el = pathRef.current;
    if (!el || twoWay) {
      setChevron(null);
      return;
    }
    const length = el.getTotalLength();
    if (length < 80) {
      setChevron(null);
      return;
    }
    // Where the label is along the line.
    let at = 0;
    let best = Infinity;
    for (let step = 0; step <= 60; step += 1) {
      const p = el.getPointAtLength((length * step) / 60);
      const d = Math.hypot(p.x - labelX, p.y - labelY);
      if (d < best) {
        best = d;
        at = (length * step) / 60;
      }
    }
    // Clear of the label (about half its width), but never past the last quarter of the line.
    const spot = length >= 260 ? Math.min(at + 90, length * 0.8) : Math.min(length * 0.8, at + 55);
    const a = el.getPointAtLength(Math.max(spot - 2, 0));
    const b = el.getPointAtLength(Math.min(spot + 2, length));
    const next = { x: Math.round(b.x * 10) / 10, y: Math.round(b.y * 10) / 10, angle: Math.round((Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI) };
    setChevron((old) => (old && old.x === next.x && old.y === next.y && old.angle === next.angle ? old : next));
  }, [path, labelX, labelY, twoWay]);

  const toOffsets = (list) => list.map((p) => [Math.round((p.x - middle.x) * 10) / 10, Math.round((p.y - middle.y) * 10) / 10]);

  // Begins dragging a point. index is the point's place in the list; for the label it is where a new point would go.
  function begin(event, index, base) {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      screen: { x: event.clientX, y: event.clientY },
      flow: screenToFlowPosition({ x: event.clientX, y: event.clientY }),
      base,
      index,
      to: base,
      moved: false,
    };
    dragged.current = false;
  }

  function onMove(event) {
    const d = drag.current;
    if (!d) return;
    if (!d.moved && Math.hypot(event.clientX - d.screen.x, event.clientY - d.screen.y) < DRAG_DISTANCE) return;
    d.moved = true;
    const now = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    d.to = d.base.map((p, i) => (i === d.index ? [Math.round((p[0] + now.x - d.flow.x) * 10) / 10, Math.round((p[1] + now.y - d.flow.y) * 10) / 10] : p));
    actions.move(id, d.to);
  }

  function onUp(event) {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    if (d.moved) {
      dragged.current = true;
      actions.commit(id, d.to);
    }
  }

  // The label is on a point when the line has an odd number of them. Otherwise a drag adds a point where the label is.
  function onLabelDown(event) {
    if (mids.length % 2 === 1) {
      begin(event, (mids.length - 1) / 2, offsets);
      return;
    }
    const index = mids.length / 2;
    const added = [...offsets];
    added.splice(index, 0, toOffsets([{ x: labelX, y: labelY }])[0]);
    begin(event, index, added);
  }

  function onLabelClick(event) {
    // The label sits inside the link in React's tree, so its click would also reach the link. This handles it.
    event.stopPropagation();
    // The click that ends a drag is not a click on the link.
    if (dragged.current) {
      dragged.current = false;
      return;
    }
    // The second click of a double-click straightens the line; a single click opens the link's card.
    if (event.detail >= 2) {
      if (saved.length > 0 || bent) actions.reset(id);
      return;
    }
    actions.click(event, id);
  }

  // A double-click on the line adds a point where it was clicked, in the stretch of the line it was clicked on.
  function onLineDouble(event) {
    event.stopPropagation();
    const at = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    const stretches = bent ? segments : [[source, source, target, target]];
    let best = { distance: Infinity, index: 0 };
    stretches.forEach((segment, index) => {
      for (let step = 0; step <= 24; step += 1) {
        const p = bent ? pointOn(segment, step / 24) : { x: source.x + ((target.x - source.x) * step) / 24, y: source.y + ((target.y - source.y) * step) / 24 };
        const distance = Math.hypot(p.x - at.x, p.y - at.y);
        if (distance < best.distance) best = { distance, index };
      }
    });
    const next = [...offsets];
    next.splice(best.index, 0, toOffsets([at])[0]);
    actions.commit(id, next);
  }

  function onPointClick(event, index) {
    event.stopPropagation();
    if (dragged.current) {
      dragged.current = false;
      return;
    }
    if (event.detail >= 2) actions.commit(id, offsets.filter((_, i) => i !== index));
  }

  return (
    <>
      <BaseEdge id={id} path={path} markerStart={markerStart} markerEnd={markerEnd} style={style} interactionWidth={24} />
      <path ref={pathRef} d={path} fill="none" stroke="none" pointerEvents="none" />
      {chevron && (
        <path
          className="edge-chevron"
          d="M -6,-6 L 4,0 L -6,6"
          transform={`translate(${chevron.x} ${chevron.y}) rotate(${chevron.angle})`}
          fill="none"
          stroke={style?.stroke}
          strokeWidth={Math.max(2.5, (style?.strokeWidth || 2.5) + 0.5)}
          strokeLinecap="round"
          strokeLinejoin="round"
          pointerEvents="none"
        />
      )}
      <path d={path} fill="none" stroke="transparent" strokeWidth={24} style={{ pointerEvents: 'stroke' }} onClick={(event) => event.stopPropagation()} onDoubleClick={onLineDouble}>
        <title>Double-click to add a point, then drag it to shape the line.</title>
      </path>
      <EdgeLabelRenderer>
        <div
          className="edge-label-chip nodrag nopan"
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          title="Drag to bend the line. Double-click to straighten it."
          onPointerDown={onLabelDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onClick={onLabelClick}
        >
          {label}
          {tags.length > 0 && (
            <span className="edge-label-tags">
              {tags.map((tag) => (
                <span key={tag} className="tag-chip" style={{ '--tag': tagColour(tag, tagColours) }}>
                  {tag}
                </span>
              ))}
            </span>
          )}
        </div>
        {active &&
          mids.map((p, index) => (
            <div
              key={index}
              className="edge-point nodrag nopan"
              style={{ transform: `translate(-50%, -50%) translate(${p.x}px, ${p.y}px)` }}
              title="Drag to move this point. Double-click to remove it."
              onPointerDown={(event) => begin(event, index, offsets)}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
              onClick={(event) => onPointClick(event, index)}
            />
          ))}
      </EdgeLabelRenderer>
    </>
  );
}

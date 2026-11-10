import { NodeResizer, NodeToolbar, Position } from '@xyflow/react';

// The shapes a canvas shape can take. The first five are drawn with a CSS border; the others are polygons.
export const SHAPE_KINDS = [
  { id: 'rect', label: 'Rectangle' },
  { id: 'rounded', label: 'Rounded rectangle' },
  { id: 'pill', label: 'Pill' },
  { id: 'ellipse', label: 'Ellipse' },
  { id: 'circle', label: 'Circle' },
  { id: 'triangle', label: 'Triangle' },
  { id: 'diamond', label: 'Diamond' },
  { id: 'pentagon', label: 'Pentagon' },
  { id: 'hexagon', label: 'Hexagon' },
  { id: 'star', label: 'Star' },
  { id: 'arrow', label: 'Arrow' },
];

const LINE_TYPES = [
  { id: 'solid', label: 'Solid' },
  { id: 'dashed', label: 'Dashed' },
  { id: 'dotted', label: 'Dotted' },
];

// Corner points of the polygon shapes, in a 100 by 100 box.
const POLYGONS = {
  triangle: '50,2 98,98 2,98',
  diamond: '50,2 98,50 50,98 2,50',
  pentagon: '50,2 98,38 80,98 20,98 2,38',
  hexagon: '25,5 75,5 98,50 75,95 25,95 2,50',
  star: '50,2 61,36 98,38 69,60 79,96 50,75 21,96 31,60 2,38 39,36',
  arrow: '2,30 58,30 58,8 98,50 58,92 58,70 2,70',
};

const RADIUS = { rect: '0', rounded: '28px', pill: '999px', ellipse: '50%', circle: '50%' };

export const SHAPE_DEFAULTS = { fill: '#dbeafe', stroke: '#2563eb', width: 2, dash: 'solid', opacity: 0.5 };

// A colour such as #2563eb with an opacity from 0 to 1, as a CSS colour.
function withOpacity(hex, opacity) {
  const n = parseInt((hex || '#000000').slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${opacity})`;
}

function dashArray(dash, weight) {
  const w = Math.max(weight, 1);
  if (dash === 'dashed') return `${w * 4} ${w * 3}`;
  if (dash === 'dotted') return `${w} ${w * 2}`;
  return undefined;
}

/**
 * A shape drawn on the canvas to organize tiles: a frame with a fill, behind the tiles. It does not hold the tiles
 * or move them. Select it to change its shape, line and shade; drag its edges to resize it.
 */
export default function ShapeNode({ id, data, selected }) {
  const { node, actions } = data;
  const style = { ...SHAPE_DEFAULTS, ...(node.style || {}) };
  const kind = node.shape || 'rect';
  const fill = withOpacity(style.fill, style.opacity);
  const polygon = kind === 'polygon' ? style.points || POLYGONS.triangle : POLYGONS[kind];

  const set = (patch) => actions.styleShape(id, { style: { ...style, ...patch } });

  return (
    <div className="shape-node">
      <NodeResizer
        minWidth={40}
        minHeight={40}
        keepAspectRatio={kind === 'circle'}
        isVisible={selected}
        onResize={(_, box) => actions.resizeTile(id, box, false)}
        onResizeEnd={(_, box) => actions.resizeTile(id, box, true)}
        lineStyle={{ borderWidth: 6, borderColor: 'transparent' }}
      />

      {polygon ? (
        <svg className="shape-fill" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <polygon
            points={polygon}
            fill={fill}
            stroke={style.stroke}
            strokeWidth={style.width}
            strokeDasharray={dashArray(style.dash, style.width)}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      ) : (
        <div
          className="shape-fill"
          style={{
            background: fill,
            border: `${style.width}px ${style.dash} ${style.stroke}`,
            borderRadius: RADIUS[kind] ?? '0',
          }}
        />
      )}

      {node.commentary && <div className="shape-label">{node.commentary}</div>}

      <NodeToolbar isVisible={selected} position={Position.Top} offset={10}>
        <div className="shape-panel nodrag nopan nowheel" onPointerDown={(e) => e.stopPropagation()}>
          <label>
            Shape
            <select value={kind} onChange={(e) => actions.styleShape(id, { shape: e.target.value })}>
              {kind === 'polygon' && <option value="polygon">Drawn polygon</option>}
              {SHAPE_KINDS.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Line
            <select value={style.dash} onChange={(e) => set({ dash: e.target.value })}>
              {LINE_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Weight
            <input type="range" min="0" max="12" step="0.5" value={style.width} onChange={(e) => set({ width: Number(e.target.value) })} />
            <output>{style.width}</output>
          </label>
          <label>
            Line colour
            <input type="color" value={style.stroke} onChange={(e) => set({ stroke: e.target.value })} />
          </label>
          <label>
            Shade
            <input type="color" value={style.fill} onChange={(e) => set({ fill: e.target.value })} />
          </label>
          <label>
            Transparency
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={Math.round((1 - style.opacity) * 100)}
              onChange={(e) => set({ opacity: 1 - Number(e.target.value) / 100 })}
            />
            <output>{Math.round((1 - style.opacity) * 100)}%</output>
          </label>
          <label className="shape-panel-label">
            Label
            <input
              type="text"
              value={node.commentary || ''}
              maxLength={200}
              placeholder="Optional"
              onChange={(e) => actions.styleShape(id, { commentary: e.target.value })}
            />
          </label>
          <button type="button" className="ghost" onClick={() => actions.remove(id)}>
            Delete
          </button>
        </div>
      </NodeToolbar>
    </div>
  );
}

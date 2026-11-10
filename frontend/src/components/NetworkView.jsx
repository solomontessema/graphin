import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useReactFlow,
} from '@xyflow/react';
import { api } from '../api.js';
import { asHttpUrl, hostFromUrl } from '../utils.js';
import GraphNode from './GraphNode.jsx';
import EdgeCard from './EdgeCard.jsx';
import RightToolbar, { ITEMS } from './RightToolbar.jsx';
import { convertShape } from '../shapes.js';
import NodeCard from './NodeCard.jsx';
import RelationDialog from './RelationDialog.jsx';
import TextNode from './TextNode.jsx';
import MapNode from './MapNode.jsx';
import ShapeNode, { SHAPE_DEFAULTS } from './ShapeNode.jsx';
import TimeBar from './TimeBar.jsx';
import { parseYear, toPosition } from '../timeScale.js';
import { MAP_HEIGHT, MAP_WIDTH } from '../worldMap.js';
import BookmarkletDialog from './BookmarkletDialog.jsx';
import { LAYOUTS, computeLayout } from '../layouts.js';

import BendEdge from './BendEdge.jsx';
import TagPanel from './TagPanel.jsx';
import { collectTags, matchesTags, tagColour } from '../tags.js';
import { presetFor } from '../relationships.js';
import NameEditor from './NameEditor.jsx';
import { DEFAULT_MAP_TYPE, MAP_TYPES } from '../mapTypes.js';
import { bendOf, ptsOf, withBend, withPts, withoutBend } from '../edgeBend.js';

const nodeTypes = { link: GraphNode, text: TextNode, map: MapNode, shape: ShapeNode };
const edgeTypes = { bend: BendEdge };

// The world map behind the Geo layout is a node of its own that is never saved, selected or moved.
const MAP_NODE = {
  id: '__map',
  type: 'map',
  position: { x: 0, y: 0 },
  width: MAP_WIDTH,
  height: MAP_HEIGHT,
  zIndex: -10,
  draggable: false,
  selectable: false,
  connectable: false,
  focusable: false,
  data: {},
};
// Arrowheads and lines are drawn large enough to read at the default zoom.
const EDGE_COLOR = '#7a869c';
// Arrowheads grow with the line weight, so a heavy line keeps a proportionate arrow.
const arrowFor = (color, weight) => {
  const size = Math.round(20 + weight * 2.4);
  return { type: MarkerType.ArrowClosed, width: size, height: size, color };
};
// The card closes shortly after the pointer leaves both the node and the card.
const CLOSE_DELAY = 300;
const CARD_WIDTH = 380;
const CARD_MAX_HEIGHT = 460; // matches .node-card max-height in styles.css
// The title a new item gets when it is placed. Its details are added afterwards, from its edit icon.
const PLACEHOLDER_TITLE = { webpage: 'New web page', pdf: 'New PDF', image: 'New image', video: 'New video', note: 'New note', text: 'Text', shape: 'Shape' };
const CARD_GAP = 12;

/** Where the card goes: beside the node, on the right, or on the left when there is no room. */
function placeBeside(rect) {
  const height = Math.min(CARD_MAX_HEIGHT, window.innerHeight - 16);
  const right = rect.right + CARD_GAP;
  const left = right + CARD_WIDTH > window.innerWidth - 8 ? rect.left - CARD_WIDTH - CARD_GAP : right;
  const top = Math.min(Math.max(8, rect.top), window.innerHeight - height - 8);
  return { left: Math.max(8, left), top: Math.max(8, top) };
}

// The whole canvas as the server stores it: every item with its current position, and every link.
function canvasState(rfNodes, edges) {
  return {
    nodes: rfNodes.map((n) => ({ ...n.data.node, x: n.position.x, y: n.position.y })),
    edges: edges.map((e) => ({ ...e })),
  };
}

// The same canvas in a fixed order, so two states can be compared.
function stateKey(state) {
  const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  return JSON.stringify({ nodes: [...state.nodes].sort(byId), edges: [...state.edges].sort(byId) });
}

function toFlowNode(node) {
  const type = node.type === 'text' ? 'text' : node.type === 'shape' ? 'shape' : 'link';
  return { id: node.id, type, position: { x: node.x, y: node.y }, data: { node } };
}

// The sides an arrow leaves and arrives on: the sides that face each other, so the arrow runs straight between
// the two items. The side is the one nearest the other item along its longer direction.
function sidesBetween(from, to) {
  if (!from || !to) return {};
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? { sourceHandle: 's-right', targetHandle: 't-left' }
      : { sourceHandle: 's-left', targetHandle: 't-right' };
  }
  return dy >= 0
    ? { sourceHandle: 's-bottom', targetHandle: 't-top' }
    : { sourceHandle: 's-top', targetHandle: 't-bottom' };
}

// A dashed outline of the tile that will be placed, under the pointer. It is centred on the pointer, as the tile is.
function PlacePreview({ type, at, zoom }) {
  return (
    <div className="place-preview" style={{ left: at.x - 115 * zoom, top: at.y - 40 * zoom, transform: `scale(${zoom})` }}>
      {type !== 'note' && <span className="type-badge">{type}</span>}
      <div className="place-preview-title">{PLACEHOLDER_TITLE[type]}</div>
    </div>
  );
}

// What to tell the user at each step of drawing a shape, by how many points are fixed so far (0, 1, 2 or more).
const DRAW_HINT = {
  rect: ['Click the first corner of the rectangle. Esc cancels.', 'Click the opposite corner. Esc cancels.', ''],
  circle: ['Click the centre of the circle. Esc cancels.', 'Click to set the radius. Esc cancels.', ''],
  polygon: [
    'Click the first corner of the polygon. Esc cancels.',
    'Click the next corner. Backspace removes the last one. Esc cancels.',
    'Click the next corner, or click the first corner (or press Enter) to close the shape. Backspace undoes a corner.',
  ],
};

// The shape being drawn, following the pointer: rubber-banding from the fixed points to where the pointer is.
function DrawPreview({ drawing, pointer, toScreen }) {
  const { kind, points } = drawing;
  const fill = `rgba(37, 99, 235, 0.18)`;
  const pts = points.map((p) => toScreen(p));
  let body = null;
  if (kind === 'rect' && pts.length === 1) {
    const x = Math.min(pts[0].x, pointer.x);
    const y = Math.min(pts[0].y, pointer.y);
    body = <rect x={x} y={y} width={Math.abs(pointer.x - pts[0].x)} height={Math.abs(pointer.y - pts[0].y)} className="draw-shape" fill={fill} />;
  } else if (kind === 'circle' && pts.length === 1) {
    const r = Math.hypot(pointer.x - pts[0].x, pointer.y - pts[0].y);
    body = (
      <>
        <circle cx={pts[0].x} cy={pts[0].y} r={r} className="draw-shape" fill={fill} />
        <line x1={pts[0].x} y1={pts[0].y} x2={pointer.x} y2={pointer.y} className="draw-guide" />
      </>
    );
  } else if (kind === 'polygon' && pts.length > 0) {
    const all = [...pts, pointer].map((p) => `${p.x},${p.y}`).join(' ');
    const closing = pts.length >= 3 && Math.hypot(pointer.x - pts[0].x, pointer.y - pts[0].y) < 12;
    body = (
      <>
        <polygon points={all} className="draw-shape" fill={fill} />
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={i === 0 ? (closing ? 8 : 5) : 3.5} className={i === 0 ? 'draw-start' : 'draw-dot'} />
        ))}
      </>
    );
  }
  return (
    <svg className="draw-overlay" aria-hidden="true">
      {body}
      <circle cx={pointer.x} cy={pointer.y} r={3} className="draw-dot" />
    </svg>
  );
}

function firstLine(text, max) {
  return text.trim().split('\n')[0].slice(0, max);
}

export default function NetworkView({ networkId, user, onLogout }) {
  return (
    <ReactFlowProvider>
      <Board networkId={networkId} user={user} onLogout={onLogout} />
    </ReactFlowProvider>
  );
}

function Board({ networkId, user, onLogout }) {
  const { screenToFlowPosition, flowToScreenPosition, fitView, getNode, getViewport } = useReactFlow();
  const [networkName, setNetworkName] = useState('');
  const [renamingNetwork, setRenamingNetwork] = useState(false);
  // Tags (codes). The colours the user chose for them, the tags ticked to filter by, whether a filter needs any or all
  // of them, and how tiles are coloured by tag ('off', 'border' or 'fill', remembered for this network).
  const [tagColours, setTagColours] = useState({});
  const [tagFilter, setTagFilter] = useState(() => new Set());
  const [tagMatch, setTagMatch] = useState('any');
  const [tagPanelOpen, setTagPanelOpen] = useState(false);
  const tagModeKey = `graphin:tag-mode:${networkId}`;
  const [tagMode, setTagModeState] = useState(() => {
    try {
      return window.localStorage.getItem(tagModeKey) || 'off';
    } catch {
      return 'off';
    }
  });
  function setTagMode(mode) {
    setTagModeState(mode);
    try {
      window.localStorage.setItem(tagModeKey, mode);
    } catch {
      // Remembering the choice is a convenience only.
    }
  }
  const [rfNodes, setRfNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [query, setQuery] = useState('');
  // The open card: { id, left, top, pinned }. A pinned card (after a click, or in Edit) stays until closed.
  const [card, setCard] = useState(null);
  const [cardMode, setCardMode] = useState('preview');
  const [pending, setPending] = useState(null);
  // The style card for a link: { id, left, top }, opened by clicking the link.
  const [edgeCard, setEdgeCard] = useState(null);
  // The kind of item the right-hand toolbar is placing ("webpage", "pdf", "image" or "note"), or null.
  // While it is set, the next click on the canvas puts a new item there.
  const [addType, setAddType] = useState(null);
  // True while a connection is being dragged between two items. The connection points show only then.
  const [connecting, setConnecting] = useState(false);
  // The format painter: 'source' while the look to copy is being picked, then { kind, style } while others are given it.
  const [painting, setPainting] = useState(null);
  useEffect(() => {
    if (!painting) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') setPainting(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [painting]);
  // Where the pointer is while placing, so the new tile can be previewed under it.
  const [pointer, setPointer] = useState(null);
  // Drawing a shape, as in a CAD program: { kind: 'rect' | 'circle' | 'polygon', points } in canvas coordinates.
  // A rectangle takes two opposite corners, a circle its centre then a point on its edge, a polygon each corner.
  const [drawing, setDrawing] = useState(null);
  const [shapeMenu, setShapeMenu] = useState(false);
  const drawingRef = useRef(null);
  drawingRef.current = drawing;
  const drawKind = drawing?.kind;
  useEffect(() => {
    if (!addType && !drawKind) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') {
        setAddType(null);
        setDrawing(null);
      } else if (event.key === 'Enter' && drawingRef.current?.kind === 'polygon') {
        finishDrawing(drawingRef.current);
      } else if (event.key === 'Backspace' && drawingRef.current?.kind === 'polygon') {
        setDrawing((d) => (d && d.points.length > 0 ? { ...d, points: d.points.slice(0, -1) } : d));
      }
    };
    const onMove = (event) => setPointer({ x: event.clientX, y: event.clientY });
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointermove', onMove);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointermove', onMove);
      setPointer(null);
    };
    // finishDrawing is read at the time of the key press, through drawingRef and the latest render's closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addType, drawKind]);
  const [showBookmarklet, setShowBookmarklet] = useState(false);
  const [layoutOpen, setLayoutOpen] = useState(false);
  // How tightly the force-directed layout packs items, 0 (loose) to 100 (tight).
  const [compactness, setCompactness] = useState(50);
  // Focus: show the whole network, or only the nodes linked to the selected one (1 or 2 links away).
  const [scope, setScope] = useState('all');
  const [selectedId, setSelectedId] = useState(null);
  // The canvas grid can be switched off. The choice is remembered on this computer.
  const [showGrid, setShowGrid] = useState(() => {
    try {
      return window.localStorage.getItem('graphin:grid') !== 'off';
    } catch {
      return true;
    }
  });

  // The world map behind the Geo layout. Applying Geo turns it on, any other layout turns it off, and the button
  // switches it by hand. The choice is remembered for this network on this computer.
  const mapKey = `graphin:map:${networkId}`;
  // Until it is switched by hand, the map shows when most items have a place.
  const [mapChoice, setMapChoice] = useState(() => {
    try {
      return window.localStorage.getItem(mapKey);
    } catch {
      return null;
    }
  });
  const placedCount = rfNodes.filter((n) => n.data.node.latitude != null && n.data.node.longitude != null).length;
  const showMap = mapChoice === 'on';

  // The kind of map (geographic, political, topographic, ...), remembered on this computer for all networks.
  const [mapType, setMapTypeState] = useState(() => {
    try {
      const saved = window.localStorage.getItem('graphin:map-type');
      return MAP_TYPES.some((t) => t.id === saved) ? saved : DEFAULT_MAP_TYPE;
    } catch {
      return DEFAULT_MAP_TYPE;
    }
  });

  function setMapType(type) {
    setMapTypeState(type);
    try {
      window.localStorage.setItem('graphin:map-type', type);
    } catch {
      // Remembering the choice is a convenience only.
    }
  }

  function setShowMap(on) {
    setMapChoice(on ? 'on' : 'off');
    try {
      window.localStorage.setItem(mapKey, on ? 'on' : 'off');
    } catch {
      // Remembering the choice is a convenience only.
    }
  }

  // How big tiles are drawn, from 30% to 150%. It only changes how they look, so crowded tiles can be made small
  // without touching their saved size or place. Remembered for this network on this computer.
  const sizeKey = `graphin:tile-size:${networkId}`;
  const [tilePercent, setTilePercentState] = useState(() => {
    try {
      const saved = Number(window.localStorage.getItem(sizeKey));
      return saved >= 30 && saved <= 150 ? saved : 100;
    } catch {
      return 100;
    }
  });
  const tileScale = tilePercent / 100;

  function setTilePercent(value) {
    setTilePercentState(value);
    try {
      window.localStorage.setItem(sizeKey, String(value));
    } catch {
      // Remembering the choice is a convenience only.
    }
  }

  function toggleGrid() {
    setShowGrid((on) => {
      try {
        window.localStorage.setItem('graphin:grid', on ? 'off' : 'on');
      } catch {
        // Remembering the choice is a convenience only.
      }
      return !on;
    });
  }

  const wrapRef = useRef(null);
  const openTimer = useRef(null);
  const closeTimer = useRef(null);
  const dragging = useRef(false);
  // The edit and trash icons on nodes reach these functions through this ref.
  const actionsRef = useRef({});
  // The last click on an item, to tell a double-click from two separate clicks.
  const lastNodeClick = useRef(null);

  // Undo and redo. A change is recorded once the canvas has been still for a moment, so one drag or one typed
  // passage is one step. Undo and redo restore a whole saved state, with the same ids, through the server.
  const history = useRef({ past: [], future: [], committed: null, pending: null, timer: null, skip: false });
  const [, setHistoryTick] = useState(0);
  const bumpHistory = () => setHistoryTick((t) => t + 1);

  function commitPending() {
    const h = history.current;
    const snap = h.pending;
    h.pending = null;
    if (!snap || stateKey(snap) === stateKey(h.committed)) return;
    h.past.push(h.committed);
    if (h.past.length > 50) h.past.shift();
    h.committed = snap;
    h.future = [];
    bumpHistory();
  }

  useEffect(() => {
    if (!loaded) return undefined;
    const h = history.current;
    const snap = canvasState(rfNodes, edges);
    if (h.committed === null || h.skip) {
      h.skip = false;
      h.committed = snap;
      return undefined;
    }
    if (stateKey(snap) === stateKey(h.committed)) {
      h.pending = null;
      return undefined;
    }
    h.pending = snap;
    h.timer = setTimeout(commitPending, 400);
    return () => clearTimeout(h.timer);
  }, [loaded, rfNodes, edges]);

  // Puts a saved state back on the canvas, through the server, and reloads what it now holds.
  async function applyState(state) {
    const h = history.current;
    try {
      closeCard();
      await api.restoreState(networkId, state);
      const graph = await api.graph(networkId);
      h.skip = true;
      setRfNodes(graph.nodes.map(toFlowNode));
      setEdges(graph.edges);
      h.committed = state;
    } catch (e) {
      setError(e.message);
    }
    bumpHistory();
  }

  function undo() {
    const h = history.current;
    clearTimeout(h.timer);
    commitPending();
    if (h.past.length === 0) return;
    const target = h.past.pop();
    h.future.push(h.committed);
    applyState(target);
  }

  function redo() {
    const h = history.current;
    clearTimeout(h.timer);
    commitPending();
    if (h.future.length === 0) return;
    const target = h.future.pop();
    h.past.push(h.committed);
    applyState(target);
  }

  // Ctrl+Z undoes, Ctrl+Y or Ctrl+Shift+Z redoes. While a text box has focus the keys edit the text instead.
  useEffect(() => {
    const onKey = (event) => {
      if (event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (key === 'z' && !event.shiftKey) {
        event.preventDefault();
        undo();
      } else if (key === 'y' || (key === 'z' && event.shiftKey)) {
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  useEffect(() => {
    api
      .graph(networkId)
      .then((graph) => {
        setNetworkName(graph.network.name);
        setTagColours(graph.network.tag_colors || {});
        setRfNodes(graph.nodes.map(toFlowNode));
        setEdges(graph.edges);
        setLoaded(true);
      })
      .catch((e) => setError(e.message));
    return () => {
      clearTimeout(openTimer.current);
      clearTimeout(closeTimer.current);
    };
  }, [networkId]);

  // Escape closes the card and the open menus.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        closeCard();
        setEdgeCard(null);
        setLayoutOpen(false);
        setTagPanelOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const titles = useMemo(() => new Map(rfNodes.map((n) => [n.id, n.data.node.title])), [rfNodes]);
  const activeNode = card ? rfNodes.find((n) => n.id === card.id)?.data.node : null;
  const relationships = useMemo(() => [...new Set(edges.map((e) => e.relationship))].sort(), [edges]);
  const allTags = useMemo(() => collectTags(rfNodes.map((n) => n.data.node), edges), [rfNodes, edges]);
  const tagNames = useMemo(() => allTags.map((t) => t.tag), [allTags]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    const hit = (value) => value && value.toLowerCase().includes(q);
    return new Set(
      rfNodes
        .filter(({ data: { node } }) => hit(node.title) || hit(node.url) || hit(node.commentary) || (node.tags || []).some(hit))
        .map((n) => n.id)
    );
  }, [query, rfNodes]);

  // Nodes linked to the selected node, up to the chosen number of links away. Null shows everything.
  const adjacency = useMemo(() => {
    const map = new Map();
    const link = (a, b) => map.set(a, [...(map.get(a) || []), b]);
    for (const e of edges) {
      link(e.source_id, e.target_id);
      link(e.target_id, e.source_id);
    }
    return map;
  }, [edges]);

  const visibleIds = useMemo(() => {
    if (scope === 'all' || !selectedId) return null;
    const seen = new Set([selectedId]);
    let frontier = [selectedId];
    for (let step = 0; step < Number(scope); step += 1) {
      const next = [];
      for (const id of frontier) {
        for (const other of adjacency.get(id) || []) {
          if (!seen.has(other)) {
            seen.add(other);
            next.push(other);
          }
        }
      }
      frontier = next;
    }
    return seen;
  }, [scope, selectedId, adjacency]);

  // The time slider. Items dated outside the chosen range are hidden; items with no date stay. The scale is
  // remembered for this network on this computer. Without a choice, a long span of time starts on a logarithmic scale.
  const years = useMemo(() => {
    const map = new Map();
    for (const n of rfNodes) {
      const year = n.type === 'shape' ? null : parseYear(n.data.node.time);
      if (year != null) map.set(n.id, year);
    }
    return map;
  }, [rfNodes]);
  const yearList = useMemo(() => [...years.values()], [years]);
  const yearMin = yearList.length ? Math.min(...yearList) : 0;
  const yearMax = yearList.length ? Math.max(...yearList) : 0;
  const hasTime = yearList.length >= 2 && yearMax > yearMin;
  const scaleKey = `graphin:time-scale:${networkId}`;
  const [scaleChoice, setScaleChoice] = useState(() => {
    try {
      return window.localStorage.getItem(scaleKey);
    } catch {
      return null;
    }
  });
  const timeScale = scaleChoice || (yearMax - yearMin > 20000 ? 'logarithmic' : 'linear');
  const [timeRange, setTimeRange] = useState([0, 1]);
  // The slider can be closed, which shows everything again. Whether it is open is remembered on this computer.
  const [timeOpen, setTimeOpenState] = useState(() => {
    try {
      return window.localStorage.getItem('graphin:time-open') !== 'no';
    } catch {
      return true;
    }
  });

  function setTimeOpen(open) {
    setTimeOpenState(open);
    if (!open) setTimeRange([0, 1]);
    try {
      window.localStorage.setItem('graphin:time-open', open ? 'yes' : 'no');
    } catch {
      // Remembering the choice is a convenience only.
    }
  }

  function chooseTimeScale(next) {
    setScaleChoice(next);
    setTimeRange([0, 1]);
    try {
      window.localStorage.setItem(scaleKey, next);
    } catch {
      // Remembering the choice is a convenience only.
    }
  }

  // The items on show: those the focus view includes, and those dated inside the time range.
  const shownIds = useMemo(() => {
    const timed = hasTime && (timeRange[0] > 0 || timeRange[1] < 1);
    const tagged = tagFilter.size > 0;
    if (!visibleIds && !timed && !tagged) return null;
    // With tags ticked, the tiles that carry one stay, and so do both ends of every link that carries one.
    let byTag = null;
    if (tagged) {
      byTag = new Set();
      for (const n of rfNodes) if (n.type === 'link' && matchesTags(n.data.node.tags, tagFilter, tagMatch)) byTag.add(n.id);
      for (const e of edges) {
        if (!matchesTags(e.tags, tagFilter, tagMatch)) continue;
        byTag.add(e.source_id);
        byTag.add(e.target_id);
      }
    }
    const shown = new Set();
    for (const n of rfNodes) {
      if (visibleIds && !visibleIds.has(n.id)) continue;
      if (byTag && n.type === 'link' && !byTag.has(n.id)) continue;
      const year = years.get(n.id);
      if (timed && year != null) {
        const position = toPosition(timeScale, year, yearMin, yearMax);
        if (position < timeRange[0] - 1e-9 || position > timeRange[1] + 1e-9) continue;
      }
      shown.add(n.id);
    }
    return shown;
  }, [rfNodes, edges, visibleIds, years, hasTime, timeRange, timeScale, yearMin, yearMax, tagFilter, tagMatch]);

  // Fit shows every tile on show. Shapes are frames around tiles, so they do not decide the view, and a time range
  // that hides most tiles brings the view in on the rest.
  function fitShown() {
    const tiles = rfNodes.filter((n) => n.type !== 'shape' && (!shownIds || shownIds.has(n.id))).map((n) => ({ id: n.id }));
    fitView({ nodes: tiles.length > 0 ? tiles : undefined, padding: 0.2, duration: 400 });
  }

  // On the map, a pin marks the true place of every item that has one. A tile may sit a little away from its place so
  // that tiles do not cover each other; a line joins it to its pin.
  const pins = useMemo(() => {
    if (!showMap) return [];
    return rfNodes
      .filter((n) => n.data.node.latitude != null && n.data.node.longitude != null && (!shownIds || shownIds.has(n.id)))
      .map((n) => ({
        id: n.id,
        lat: n.data.node.latitude,
        lon: n.data.node.longitude,
        cx: n.position.x + ((n.data.node.width ?? 230) * tileScale) / 2,
        cy: n.position.y + ((n.data.node.height ?? 130) * tileScale) / 2,
        color: n.data.node.style?.stroke || '#334155',
      }));
  }, [showMap, rfNodes, shownIds, tileScale]);


  // Opens at a readable zoom, centred on the graph. A focused view fits the nodes it shows.
  // Fit (in the toolbar) shows everything.
  useEffect(() => {
    if (!loaded) return;
    const timer = setTimeout(() => {
      if (visibleIds) {
        fitView({ nodes: [...visibleIds].map((id) => ({ id })), padding: 0.25, duration: 400, maxZoom: 1 });
      } else {
        fitView({ padding: 0.2, minZoom: 0.6, duration: 400 });
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [loaded, visibleIds, fitView]);

  const displayNodes = useMemo(
    () =>
      rfNodes
        .filter((n) => !shownIds || shownIds.has(n.id))
        .map((n) => ({
          ...n,
          // Shapes sit behind the tiles and the map behind the shapes.
          zIndex: n.type === 'shape' ? -5 : 1,
          width: n.data.node.width != null && n.type === 'link' ? n.data.node.width * tileScale : (n.data.node.width ?? undefined),
          height: n.type === 'shape' ? (n.data.node.height ?? undefined) : undefined,
          data: {
            ...n.data,
            dim: matches !== null && !matches.has(n.id),
            tagColours,
            tagMode,
            actions: {
              resizeTile,
              styleShape,
              saveText,
              edit: (id) => actionsRef.current.edit(id),
              remove: (id) => actionsRef.current.remove(id),
            },
          },
        })),
    [rfNodes, matches, shownIds, tileScale, tagColours, tagMode]
  );

  // The middle of every item, to pick the side each arrow leaves and arrives on.
  const centres = useMemo(
    () =>
      new Map(
        rfNodes.map((n) => {
          const node = n.data.node;
          const measured = getNode(n.id)?.measured;
          const width = node.width ?? measured?.width ?? 230;
          const height = node.height ?? measured?.height ?? 130;
          return [n.id, { x: n.position.x + width / 2, y: n.position.y + height / 2 }];
        })
      ),
    [rfNodes]
  );

  // What the link's label does when it is held and dragged (see BendEdge). The functions are kept in a ref so the
  // object handed to every link stays the same between renders.
  const edgeHandlers = useRef({});
  edgeHandlers.current = {
    // Moves a point of the link's line while it is dragged. It is saved when the drag ends.
    move: (id, pts) => setEdges((es) => es.map((e) => (e.id === id ? { ...e, style: withPts(e.style, pts) } : e))),
    commit: (id, pts) => updateEdgeStyle(id, withPts(edges.find((e) => e.id === id)?.style, pts)),
    reset: (id) => updateEdgeStyle(id, withoutBend(edges.find((e) => e.id === id)?.style)),
    click: (event, id) => onEdgeClick(event, { id }),
  };
  const edgeActions = useMemo(
    () => ({
      move: (...a) => edgeHandlers.current.move(...a),
      commit: (...a) => edgeHandlers.current.commit(...a),
      reset: (...a) => edgeHandlers.current.reset(...a),
      click: (...a) => edgeHandlers.current.click(...a),
    }),
    []
  );

  const displayEdges = useMemo(() => {
    const shown = edges
      .filter((e) => filter === 'ALL' || e.relationship === filter)
      .filter((e) => !shownIds || (shownIds.has(e.source_id) && shownIds.has(e.target_id)));
    // Links that join the same two items, in either direction, are fanned out so none hides another.
    const groups = new Map();
    for (const e of shown) {
      const key = e.source_id < e.target_id ? `${e.source_id}|${e.target_id}` : `${e.target_id}|${e.source_id}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(e);
    }
    const fanOf = (e) => {
      const key = e.source_id < e.target_id ? `${e.source_id}|${e.target_id}` : `${e.target_id}|${e.source_id}`;
      const group = groups.get(key);
      if (group.length < 2) return 0;
      const spread = (group.indexOf(e) - (group.length - 1) / 2) * 48;
      // The sideways direction follows each link's own direction, so the sign is set from one fixed end.
      return e.source_id < e.target_id ? spread : -spread;
    };
    return shown.map((e) => {
          // The link's own colour and weight. The default line is used where none is set.
          const tagTint = tagMode !== 'off' && e.tags?.length > 0 ? tagColour(e.tags[0], tagColours) : null;
          const stroke = tagTint || e.style?.stroke || EDGE_COLOR;
          const width = e.style?.width || 2.5;
          return {
            id: e.id,
            source: e.source_id,
            target: e.target_id,
            ...sidesBetween(centres.get(e.source_id), centres.get(e.target_id)),
            type: 'bend',
            data: { label: e.relationship.replace(/_/g, ' ').toLowerCase(), pts: ptsOf(e.style), active: edgeCard?.id === e.id, fan: fanOf(e), tags: e.tags || [], tagColours, actions: edgeActions },
            markerStart: e.is_bidirectional ? arrowFor(stroke, width) : undefined,
            markerEnd: e.is_bidirectional ? undefined : arrowFor(stroke, width),
            style: { stroke, strokeWidth: width },
            className: 'graph-edge',
          };
    });
  }, [edges, filter, shownIds, centres, edgeActions, tagColours, tagMode, edgeCard]);

  // The link whose style card is open, read from the current list so the card shows saved values.
  const activeEdge = edgeCard ? edges.find((e) => e.id === edgeCard.id) : null;

  const relationshipOptions = relationships;

  // ---- Card: opens beside a node on hover, pins on click, closes when the pointer leaves.

  function clearTimers() {
    clearTimeout(openTimer.current);
    clearTimeout(closeTimer.current);
  }

  // ---- Tags: filtering, colours, and changing a tag everywhere.

  function toggleTag(tag) {
    setTagFilter((chosen) => {
      const next = new Set(chosen);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }

  async function chooseTagColour(tag, colour) {
    const next = { ...tagColours, [tag]: colour };
    setTagColours(next);
    try {
      await api.setTagColours(networkId, next);
    } catch (e) {
      setError(e.message);
    }
  }

  // Renames a tag on every tile and link that carries it. Renaming it to a tag already in use merges the two. A null
  // name removes the tag everywhere.
  async function retag(from, to) {
    const swap = (tags) => {
      const out = [];
      for (const tag of tags || []) {
        const next = tag === from ? to : tag;
        if (next && !out.includes(next)) out.push(next);
      }
      return out;
    };
    try {
      for (const n of rfNodes.filter((m) => (m.data.node.tags || []).includes(from))) {
        const updated = await api.updateNode(n.id, { tags: swap(n.data.node.tags) });
        setRfNodes((ns) => ns.map((m) => (m.id === n.id ? { ...m, data: { ...m.data, node: { ...m.data.node, tags: updated.tags } } } : m)));
      }
      for (const e of edges.filter((x) => (x.tags || []).includes(from))) {
        const updated = await api.updateEdge(e.id, { tags: swap(e.tags) });
        setEdges((es) => es.map((x) => (x.id === e.id ? { ...x, tags: updated.tags } : x)));
      }
      setTagFilter((chosen) => {
        if (!chosen.has(from)) return chosen;
        const next = new Set(chosen);
        next.delete(from);
        if (to) next.add(to);
        return next;
      });
      if (tagColours[from]) {
        const { [from]: colour, ...rest } = tagColours;
        const next = to && !rest[to] ? { ...rest, [to]: colour } : rest;
        setTagColours(next);
        await api.setTagColours(networkId, next);
      }
    } catch (e) {
      setError(e.message);
    }
  }

  // Renames the network from the title bar.
  async function renameNetwork(next) {
    setRenamingNetwork(false);
    try {
      const updated = await api.renameNetwork(networkId, next);
      setNetworkName(updated.name);
    } catch (e) {
      setError(e.message);
    }
  }

  function closeCard() {
    clearTimers();
    setCard(null);
    setCardMode('preview');
  }

  // Closes an unpinned card after a pause. A pinned card stays until it is closed.
  function scheduleClose() {
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setCard((c) => (c && !c.pinned ? null : c)), CLOSE_DELAY);
  }

  function cardEnter() {
    clearTimeout(closeTimer.current);
  }

  function onNodeMouseLeave() {
    clearTimeout(openTimer.current);
    scheduleClose();
  }

  // A click selects a tile. Its Edit icon opens the card, so a click does not open one.
  function onNodeClick(event, node) {
    if (drawingRef.current) {
      drawClick(event);
      return;
    }
    // While placing, a click on a tile puts the new item there, as a click on empty canvas does.
    if (addType) {
      const at = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      setAddType(null);
      addPlaceholder(addType, at);
      return;
    }
    if (painting) {
      paintNode(node);
      return;
    }
    // Two quick clicks on the same item open its edit card. The item's own controls keep their clicks.
    const previous = lastNodeClick.current;
    const now = Date.now();
    lastNodeClick.current = { id: node.id, at: now };
    const ownControl = event.target?.closest?.('.text-node, .page-badge, .node-tools, .react-flow__handle');
    if (previous?.id === node.id && now - previous.at < 400 && node.type !== 'text' && node.type !== 'shape' && !ownControl) {
      lastNodeClick.current = null;
      openEditCard(node.id);
      return;
    }
    // The clicked item is the only one selected: whatever was selected before is released.
    setRfNodes((ns) => ns.map((n) => (n.selected === (n.id === node.id) ? n : { ...n, selected: n.id === node.id })));
    setSelectedId(node.id);
    growTileForText(node);
  }

  // Format painter. The first click copies the look of a tile or a line. Clicks on other tiles, or other lines, then
  // give them that look, until Esc is pressed.
  function paintNode(node) {
    if (painting === 'source') {
      setPainting({ kind: 'tile', style: node.data.node.style ?? null, shape: node.data.node.shape || 'rect' });
      return;
    }
    if (painting.kind !== 'tile') return;
    // The shape is taken too. A shape change keeps the tile's centre.
    if ((node.data.node.shape || 'rect') !== painting.shape) changeShape(node.id, painting.shape);
    updateNodeStyle(node.id, painting.style);
  }

  // The click gives the canvas edge; its saved style is read from the link list.
  function paintEdge(canvasEdge) {
    if (painting === 'source') {
      const saved = edges.find((e) => e.id === canvasEdge.id);
      setPainting({ kind: 'edge', style: withoutBend(saved?.style) });
      return;
    }
    // Colour and weight are painted; the link keeps its own bend.
    if (painting.kind === 'edge') updateEdgeStyle(canvasEdge.id, withBend(edges.find((e) => e.id === canvasEdge.id)?.style, painting.style));
  }

  async function updateNodeStyle(id, style) {
    try {
      const updated = await api.updateNode(id, { style });
      setRfNodes((ns) =>
        ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, node: { ...n.data.node, style: updated.style } } } : n))
      );
    } catch (e) {
      setError(e.message);
    }
  }

  async function updateEdgeStyle(id, style) {
    try {
      const updated = await api.updateEdge(id, { style });
      setEdges((es) => es.map((e) => (e.id === id ? { ...e, style: updated.style } : e)));
    } catch (e) {
      setError(e.message);
    }
  }

  // One click while drawing a shape: it fixes a corner, the centre or an edge point, or closes a polygon.
  function drawClick(event) {
    const d = drawingRef.current;
    const at = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    const near = (p) => {
      const s = flowToScreenPosition(p);
      return Math.hypot(s.x - event.clientX, s.y - event.clientY) < 12;
    };
    if (d.kind === 'polygon') {
      const last = d.points[d.points.length - 1];
      // A click on the first corner, or a second click on the last one (a double-click), closes the shape.
      if (d.points.length >= 3 && (near(d.points[0]) || near(last))) {
        finishDrawing(d);
        return;
      }
      if (last && near(last)) return;
      setDrawing({ ...d, points: [...d.points, at] });
      return;
    }
    if (d.points.length === 0) {
      setDrawing({ ...d, points: [at] });
      return;
    }
    finishDrawing({ ...d, points: [d.points[0], at] });
  }

  // Creates the shape from what was drawn. A polygon's corners are saved in a 100 by 100 box over its bounds.
  async function finishDrawing(d) {
    setDrawing(null);
    const [a, b] = d.points;
    let box;
    let style = SHAPE_DEFAULTS;
    let shape = d.kind;
    if (d.kind === 'rect') {
      box = { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y) };
    } else if (d.kind === 'circle') {
      const r = Math.hypot(a.x - b.x, a.y - b.y);
      box = { x: a.x - r, y: a.y - r, width: 2 * r, height: 2 * r };
    } else {
      if (d.points.length < 3) return;
      const xs = d.points.map((p) => p.x);
      const ys = d.points.map((p) => p.y);
      const x = Math.min(...xs);
      const y = Math.min(...ys);
      const width = Math.max(...xs) - x;
      const height = Math.max(...ys) - y;
      box = { x, y, width, height };
      const pct = (v, origin, size) => (size > 0 ? Math.round(((v - origin) / size) * 10000) / 100 : 50);
      style = { ...SHAPE_DEFAULTS, points: d.points.map((p) => `${pct(p.x, x, width)},${pct(p.y, y, height)}`).join(' ') };
      shape = 'polygon';
    }
    if (box.width < 10 || box.height < 10) return;
    try {
      const node = await api.createNode(networkId, { type: 'shape', title: PLACEHOLDER_TITLE.shape, ...box, shape, style });
      setRfNodes((ns) => [...ns, toFlowNode(node)]);
    } catch (e) {
      setError(e.message);
    }
  }

  function chooseAdd(type) {
    setDrawing(null);
    setAddType(null);
    setShapeMenu(false);
    if (type === 'shape') setShapeMenu(true);
    else setAddType(type);
  }

  function startDrawing(kind) {
    setShapeMenu(false);
    setDrawing({ kind, points: [] });
  }

  function onPaneClick(event) {
    if (drawingRef.current) {
      drawClick(event);
      return;
    }
    setShapeMenu(false);
    if (addType) {
      const at = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      setAddType(null);
      addPlaceholder(addType, at);
      return;
    }
    closeCard();
    setEdgeCard(null);
  }

  // Puts a new item of the chosen kind where the user clicked. Its title and details come later, from its edit icon.
  async function addPlaceholder(type, at) {
    try {
      const node = await api.createNode(networkId, { type, title: PLACEHOLDER_TITLE[type], x: at.x - 115, y: at.y - 40 });
      setRfNodes((ns) => [...ns, toFlowNode(node)]);
    } catch (e) {
      setError(e.message);
    }
  }

  // Clicking a link opens a small card to change its colour and weight, beside the click.
  function onEdgeClick(event, edge) {
    if (painting) {
      paintEdge(edge);
      return;
    }
    closeCard();
    setEdgeCard({
      id: edge.id,
      left: Math.max(8, Math.min(event.clientX + 12, window.innerWidth - 340)),
      top: Math.max(8, Math.min(event.clientY + 12, window.innerHeight - 220)),
    });
  }

  function savedEdge(updated) {
    setEdges((es) => es.map((e) => (e.id === updated.id ? { ...e, ...updated } : e)));
  }

  function deletedEdge(id) {
    setEdges((es) => es.filter((e) => e.id !== id));
    setEdgeCard(null);
  }

  // Edit is for changing the link, so it pins the card.
  function changeCardMode(mode) {
    setCardMode(mode);
    if (mode === 'edit' && card) {
      setCard({ ...card, pinned: true });
    }
  }

  function openNode(id) {
    const el = document.querySelector(`.react-flow__node[data-id="${id}"]`);
    if (!el) return;
    clearTimers();
    setCard({ id, ...placeBeside(el.getBoundingClientRect()), pinned: true });
    setCardMode('preview');
    setSelectedId(id);
  }

  // Moving the canvas or dragging a node closes the card, as NeuLexi's preview closes on scroll.
  function onMoveStart() {
    if (card) closeCard();
  }

  function onNodeDragStart() {
    dragging.current = true;
    closeCard();
  }

  // When a drag ends, every item that moved is saved. Dragging several selected items moves them together.
  function onNodeDragStop(_, node, dragged) {
    dragging.current = false;
    const moved = dragged && dragged.length > 0 ? dragged : [node];
    savePositions(moved.map((n) => ({ id: n.id, x: n.position.x, y: n.position.y })));
  }

  function savePositions(items) {
    api.savePositions(networkId, items).catch((e) => setError(e.message));
  }

  // Arranges the whole network with the chosen layout. A link between two items pulls them together.
  function applyLayout(kind) {
    setLayoutOpen(false);
    if (kind === 'geo') setShowMap(true);
    // Shapes are frames the user drew, so a layout leaves them where they are.
    const units = rfNodes.filter((n) => n.type !== 'shape').map((n) => {
      const node = n.data.node;
      const measured = getNode(n.id)?.measured;
      return {
        id: n.id,
        width: node.width ?? measured?.width ?? 220,
        height: node.height ?? measured?.height ?? 120,
        lat: node.latitude,
        lon: node.longitude,
        year: parseYear(node.time),
      };
    });
    const links = edges.map((e) => [e.source_id, e.target_id]);
    const centres = computeLayout(kind, units, links, { compactness: compactness / 100, timeScale });

    const moved = new Map();
    for (const unit of units) {
      const centre = centres.get(unit.id);
      if (centre) moved.set(unit.id, { x: centre.x - unit.width / 2, y: centre.y - unit.height / 2 });
    }
    if (moved.size === 0) return;
    setRfNodes((ns) => ns.map((n) => (moved.has(n.id) ? { ...n, position: moved.get(n.id) } : n)));
    savePositions([...moved].map(([id, p]) => ({ id, x: p.x, y: p.y })));
    setTimeout(() => fitView({ padding: 0.2, duration: 400 }), 50);
  }

  // A tile selected while the view is zoomed in grows to a comfortable width, so its whole text shows. Its height
  // follows the text. Circles keep their size.
  function growTileForText(node) {
    const item = node.data.node;
    if (item.type === 'text' || item.type === 'shape' || item.shape === 'circle') return;
    if (getViewport().zoom < 1) return;
    const current = item.width ?? getNode(node.id)?.measured?.width ?? 220;
    const width = Math.max(current, 320);
    if (width === item.width) return;
    setRfNodes((ns) => ns.map((n) => (n.id === node.id ? { ...n, data: { ...n.data, node: { ...n.data.node, width } } } : n)));
    savePositions([{ id: node.id, x: node.position.x, y: node.position.y, width }]);
  }

  // Saves the text written on a canvas text item. The text is the item's commentary.
  async function saveText(id, text) {
    try {
      const updated = await api.updateNode(id, { commentary: text });
      setRfNodes((ns) =>
        ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, node: { ...n.data.node, commentary: updated.commentary } } } : n))
      );
    } catch (e) {
      setError(e.message);
    }
  }

  // Resizes a tile from one of its edges. Its stored size is what it keeps.
  function resizeTile(id, drawn, final) {
    const found = rfNodes.find((n) => n.id === id);
    const scale = found?.type === 'link' ? tileScale : 1;
    const box = { x: drawn.x, y: drawn.y, width: drawn.width / scale, height: drawn.height / scale };
    setRfNodes((ns) =>
      ns.map((n) =>
        n.id === id
          ? { ...n, position: { x: box.x, y: box.y }, data: { ...n.data, node: { ...n.data.node, x: box.x, y: box.y, width: box.width, height: box.height } } }
          : n
      )
    );
    if (final) {
      savePositions([{ id, x: box.x, y: box.y, width: box.width, height: box.height }]);
    }
  }

  // Changes a canvas shape's look, its label or its shape. The screen updates at once; the change is saved a moment
  // after the last one, so dragging a slider or a colour picker sends one request.
  const shapeSaves = useRef({});
  function styleShape(id, patch) {
    const found = rfNodes.find((n) => n.id === id);
    if (!found) return;
    let size = null;
    if (patch.shape === 'circle') {
      const side = Math.min(found.data.node.width ?? 420, found.data.node.height ?? 300);
      size = { width: side, height: side };
    }
    setRfNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, node: { ...n.data.node, ...patch, ...size } } } : n)));
    const pending = shapeSaves.current[id] ?? { patch: {}, timer: null };
    clearTimeout(pending.timer);
    pending.patch = { ...pending.patch, ...patch };
    pending.timer = setTimeout(() => {
      const send = pending.patch;
      delete shapeSaves.current[id];
      api.updateNode(id, send).catch((e) => setError(e.message));
      if (size) savePositions([{ id, x: found.position.x, y: found.position.y, ...size }]);
    }, 400);
    shapeSaves.current[id] = pending;
  }

  // Changes a tile's shape in place. A circle takes the smaller side of the tile; other shapes keep its size.
  async function changeShape(id, shape) {
    const found = rfNodes.find((n) => n.id === id);
    if (!found) return;
    // A tile has no stored size until it is resized, so its size is the one it is drawn at.
    const tile = {
      x: found.position.x,
      y: found.position.y,
      width: found.data.node.width ?? (getNode(id)?.measured?.width ?? 230 * tileScale) / tileScale,
      height: found.data.node.height ?? (getNode(id)?.measured?.height ?? 130 * tileScale) / tileScale,
    };
    const box = convertShape(tile, shape);
    try {
      const updated = await api.updateNode(id, { shape });
      setRfNodes((ns) =>
        ns.map((n) =>
          n.id === id ? { ...n, position: { x: box.x, y: box.y }, data: { ...n.data, node: { ...n.data.node, ...updated, ...box } } } : n
        )
      );
      savePositions([{ id, x: box.x, y: box.y, width: box.width, height: box.height }]);
    } catch (e) {
      setError(e.message);
    }
  }

  // Opens the card for a node in Edit mode, beside it. The edit icon uses this.
  function openEditCard(id) {
    const el = document.querySelector(`.react-flow__node[data-id="${id}"]`);
    if (!el) return;
    clearTimers();
    setCard({ id, ...placeBeside(el.getBoundingClientRect()), pinned: true });
    setCardMode('edit');
    setSelectedId(id);
  }

  // The icons on nodes call these through actionsRef, so they always reach the current functions.
  actionsRef.current = {
    edit: openEditCard,
    remove: (id) => {
      const node = rfNodes.find((n) => n.id === id)?.data.node;
      if (node) deleteNode(node);
    },
  };

  function replaceNode(updated) {
    setRfNodes((ns) =>
      ns.map((n) => (n.id === updated.id ? { ...n, data: { ...n.data, node: { ...n.data.node, ...updated } } } : n))
    );
  }

  function removeNodes(ids) {
    const gone = new Set(ids);
    setRfNodes((ns) => ns.filter((n) => !gone.has(n.id)));
    setEdges((es) => es.filter((e) => !gone.has(e.source_id) && !gone.has(e.target_id)));
    if (card && gone.has(card.id)) closeCard();
    if (gone.has(selectedId)) setSelectedId(null);
  }

  async function deleteNode(node) {
    const message = `Delete "${node.title}" and its relationships?`;
    if (!window.confirm(message)) return;
    try {
      await api.deleteNode(node.id);
      removeNodes([node.id]);
    } catch (e) {
      setError(e.message);
    }
  }

  async function deleteEdge(edge) {
    try {
      await api.deleteEdge(edge.id);
      setEdges((es) => es.filter((e) => e.id !== edge.id));
    } catch (e) {
      setError(e.message);
    }
  }

  // Dragging a handle from one node to another asks how they are related before any link is saved.
  function onConnect(connection) {
    const source = rfNodes.find((n) => n.id === connection.source)?.data.node;
    const target = rfNodes.find((n) => n.id === connection.target)?.data.node;
    if (!source || !target || source.id === target.id) return;
    setPending({ source, target });
  }

  function onConnectEnd() {
    setConnecting(false);
  }

  async function saveRelation({ relationship, direction }) {
    const { source, target } = pending;
    const reversed = direction === 'backward';
    const edge = await api.createEdge(networkId, {
      source_id: reversed ? target.id : source.id,
      target_id: reversed ? source.id : target.id,
      relationship,
      is_bidirectional: direction === 'both',
      // A standard kind of relationship starts with its own colour.
      style: presetFor(relationship) ? { stroke: presetFor(relationship).colour } : undefined,
    });
    setEdges((es) => [...es, edge]);
    setPending(null);
  }

  async function createNodeAt(data, at) {
    try {
      const node = await api.createNode(networkId, { ...data, x: at.x, y: at.y });
      setRfNodes((ns) => [...ns, toFlowNode(node)]);
    } catch (e) {
      setError(e.message);
    }
  }

  // Dropped links become link nodes. Dropped text becomes a note, with the text as its commentary.
  function onDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }

  function onDrop(event) {
    event.preventDefault();
    const text = event.dataTransfer.getData('text/uri-list') || event.dataTransfer.getData('text/plain');
    if (!text.trim()) return;
    const at = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    const url = asHttpUrl(text);
    if (url) {
      createNodeAt({ url, title: hostFromUrl(url) }, at);
    } else {
      createNodeAt({ title: firstLine(text, 120), commentary: text.trim() }, at);
    }
  }

  function onSearchKey(event) {
    if (event.key === 'Enter' && matches && matches.size > 0) {
      fitView({ nodes: [{ id: [...matches][0] }], duration: 500, maxZoom: 1.2 });
    }
  }

  return (
    <div className={`board${addType || drawing ? ' placing' : ''}${connecting ? ' connecting' : ''}${painting ? ' painting' : ''}`}>
      <header className="toolbar">
        <a className="back" href="#/">
          ← Networks
        </a>
        {renamingNetwork ? (
          <NameEditor name={networkName} className="title-editor" onSave={renameNetwork} onCancel={() => setRenamingNetwork(false)} />
        ) : (
          <h2 className="network-title" title="Click to rename" onClick={() => setRenamingNetwork(true)}>
            {networkName}
          </h2>
        )}
        <input
          className="search"
          type="search"
          placeholder="Search titles, links, commentary"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onSearchKey}
        />
        <select value={scope} onChange={(e) => setScope(e.target.value)} aria-label="Show">
          <option value="all">Whole network</option>
          <option value="1">Linked to selected</option>
          <option value="2">Within 2 links of selected</option>
        </select>
        {visibleIds && (
          <span className="muted small">
            {visibleIds.size} of {rfNodes.length} nodes
          </span>
        )}
        <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter by relationship">
          <option value="ALL">All relationships</option>
          {relationshipOptions.map((r) => (
            <option key={r} value={r}>
              {r.replace(/_/g, ' ').toLowerCase()}
            </option>
          ))}
        </select>
        <button className="ghost" onClick={() => setTagPanelOpen((open) => !open)} aria-expanded={tagPanelOpen} title="Tags: code, filter and colour your material">
          Tags{tagFilter.size > 0 ? ` (${tagFilter.size} ticked)` : allTags.length > 0 ? ` (${allTags.length})` : ''}
        </button>
        <button className="ghost" onClick={toggleGrid} aria-pressed={showGrid}>
          Grid: {showGrid ? 'on' : 'off'}
        </button>
        <button
          className="ghost"
          onClick={() => setShowMap(!showMap)}
          aria-pressed={showMap}
          title={placedCount > 0 ? `${placedCount} of ${rfNodes.length} items have a place. ${showMap ? 'Turn the map off.' : 'Turn the map on to see them.'}` : 'No item has a place yet. Add a latitude and longitude in an item\'s card.'}
        >
          Map: {showMap ? 'on' : 'off'}
          {!showMap && placedCount > 0 && <span className="dot" aria-hidden="true" />}
        </button>
        {showMap && (
          <select value={mapType} onChange={(e) => setMapType(e.target.value)} aria-label="Map type" title={MAP_TYPES.find((t) => t.id === mapType)?.hint}>
            {MAP_TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        )}
        <button className="ghost" onClick={fitShown}>
          Fit
        </button>
        <button className="ghost icon-button" onClick={undo} disabled={history.current.past.length === 0} title="Undo (Ctrl+Z)" aria-label="Undo">
          ↶
        </button>
        <button className="ghost icon-button" onClick={redo} disabled={history.current.future.length === 0} title="Redo (Ctrl+Y)" aria-label="Redo">
          ↷
        </button>
        <button
          className="ghost icon-button"
          onClick={() => setPainting(painting ? null : 'source')}
          aria-pressed={Boolean(painting)}
          aria-label="Match style"
          title={painting === 'source' ? 'Match from' : painting ? 'Match to' : 'Match style'}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z" />
          </svg>
        </button>
        <div className="layout-menu">
          <button className="ghost" onClick={() => setLayoutOpen((open) => !open)} aria-expanded={layoutOpen}>
            Layout ▾
          </button>
          {layoutOpen && (
            <ul className="layout-list" role="menu">
              <li className="layout-compact">
                <label>
                  Compactness <output>{compactness}</output>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={compactness}
                    onChange={(e) => setCompactness(Number(e.target.value))}
                  />
                </label>
                <span>How tightly Force-directed packs items. Higher pulls them together and limits spread.</span>
              </li>
              {LAYOUTS.map((l) => (
                <li key={l.id}>
                  <button role="menuitem" onClick={() => applyLayout(l.id)}>
                    <strong>{l.label}</strong>
                    <span>{l.hint}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button className="ghost" onClick={() => setShowBookmarklet(true)}>
          Bookmarklet
        </button>
        {user && (
          <div className="toolbar-account">
            <span className="avatar" title={user.email} aria-label={`Signed in as ${user.email}`}>
              {user.email.charAt(0).toUpperCase()}
            </span>
            <button className="ghost" onClick={onLogout}>
              Log out
            </button>
          </div>
        )}
      </header>

      {scope !== 'all' && !selectedId && <div className="banner">Click a node to show the links around it.</div>}

      {error && (
        <div className="banner error" role="alert" onClick={() => setError('')}>
          {error} <span className="muted">(click to dismiss)</span>
        </div>
      )}

      <div className="canvas-wrap" ref={wrapRef} onDragOver={onDragOver} onDrop={onDrop} style={{ '--tile-scale': tileScale }}>
        {!loaded && <p className="muted canvas-msg">Loading…</p>}
        {loaded && rfNodes.length === 0 && (
          <p className="muted canvas-msg">
            Add a web page, PDF, image or note from the toolbar on the right, drop a link or highlighted text here, or use the Bookmarklet on any page.
          </p>
        )}

        <ReactFlow
          nodes={showMap ? [{ ...MAP_NODE, data: { pins, mapType } }, ...displayNodes] : displayNodes}
          edges={displayEdges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onNodeDragStart={onNodeDragStart}
          onNodeDragStop={onNodeDragStop}
          onMoveStart={onMoveStart}
          onConnect={onConnect}
          onConnectStart={() => setConnecting(true)}
          onConnectEnd={onConnectEnd}
          connectionMode="loose"
          elevateNodesOnSelect={false}
          onNodeClick={onNodeClick}
          onNodeMouseLeave={onNodeMouseLeave}
          onPaneClick={onPaneClick}
          onEdgeClick={onEdgeClick}
          deleteKeyCode={null}
          minZoom={0.02}
          maxZoom={1000}
        >
          {showGrid && <Background />}
          <Controls />
          <MiniMap pannable zoomable />
        </ReactFlow>

        {hasTime && !timeOpen && (
          <button className="ghost time-reopen" onClick={() => setTimeOpen(true)} title="Open the time slider">
            Time
          </button>
        )}
        {hasTime && timeOpen && (
          <TimeBar
            years={yearList}
            scale={timeScale}
            onScale={chooseTimeScale}
            range={timeRange}
            onRange={setTimeRange}
            onClose={() => setTimeOpen(false)}
          />
        )}

        <div className="size-bar">
          <label>
            Tile size
            <input type="range" min="30" max="150" step="5" value={tilePercent} onChange={(e) => setTilePercent(Number(e.target.value))} />
            <output>{tilePercent}%</output>
          </label>
          <button className="ghost" onClick={() => setTilePercent(100)} disabled={tilePercent === 100}>
            Reset
          </button>
        </div>

        <RightToolbar onAdd={chooseAdd} />

        {tagPanelOpen && (
          <TagPanel
            tags={allTags}
            colours={tagColours}
            chosen={tagFilter}
            onToggle={toggleTag}
            onClear={() => setTagFilter(new Set())}
            match={tagMatch}
            onMatch={setTagMatch}
            mode={tagMode}
            onMode={setTagMode}
            onColour={chooseTagColour}
            onRename={(from, to) => retag(from, to)}
            onRemove={(tag) => retag(tag, null)}
            onClose={() => setTagPanelOpen(false)}
          />
        )}

        {shapeMenu && (
          <div className="shape-menu" role="menu" aria-label="Shape to draw">
            <span className="rt-title">Draw a</span>
            <button className="ghost" role="menuitem" onClick={() => startDrawing('rect')}>
              Rectangle
            </button>
            <button className="ghost" role="menuitem" onClick={() => startDrawing('circle')}>
              Circle
            </button>
            <button className="ghost" role="menuitem" onClick={() => startDrawing('polygon')}>
              Polygon
            </button>
          </div>
        )}

        {drawing && pointer && (
          <DrawPreview drawing={drawing} pointer={pointer} toScreen={flowToScreenPosition} />
        )}
        {drawing && <div className="placing-hint" role="status">{DRAW_HINT[drawing.kind][Math.min(drawing.points.length, 2)]}</div>}

        {addType && pointer && <PlacePreview type={addType} at={pointer} zoom={getViewport().zoom} />}

        {addType && (
          <div className="placing-hint" role="status">
            Click on the canvas to place the {ITEMS.find((i) => i.type === addType)?.label.toLowerCase()}. Press Esc to cancel.
          </div>
        )}

        {card && activeNode && (
          <NodeCard
            node={activeNode}
            style={{ left: card.left, top: card.top }}
            mode={cardMode}
            onMode={changeCardMode}
            onClose={closeCard}
            edges={edges}
            titles={titles}
            onChange={replaceNode}
            onDelete={deleteNode}
            onDeleteEdge={deleteEdge}
            onOpenNode={openNode}
            onEnter={cardEnter}
            onLeave={scheduleClose}
            onShape={(shape) => changeShape(activeNode.id, shape)}
            allTags={tagNames}
            tagColours={tagColours}
          />
        )}
      </div>

      {edgeCard && activeEdge && (
        <EdgeCard
          edge={activeEdge}
          titles={titles}
          used={relationships}
          allTags={tagNames}
          tagColours={tagColours}
          style={{ left: edgeCard.left, top: edgeCard.top }}
          onSaved={savedEdge}
          onDeleted={deletedEdge}
          onClose={() => setEdgeCard(null)}
        />
      )}


      {pending && (
        <RelationDialog
          source={pending.source}
          target={pending.target}
          used={relationships}
          existing={edges
            .filter((e) => (e.source_id === pending.source.id && e.target_id === pending.target.id) || (e.source_id === pending.target.id && e.target_id === pending.source.id))
            .map((e) => e.relationship)}
          onCancel={() => setPending(null)}
          onSave={saveRelation}
        />
      )}

      {showBookmarklet && <BookmarkletDialog onClose={() => setShowBookmarklet(false)} />}
    </div>
  );
}

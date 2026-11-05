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
import GroupNode from './GroupNode.jsx';
import EdgeCard from './EdgeCard.jsx';
import RightToolbar, { ITEMS } from './RightToolbar.jsx';
import { convertShape, growBox, isValidBox } from '../groupShape.js';
import NodeCard from './NodeCard.jsx';
import RelationDialog from './RelationDialog.jsx';
import BookmarkletDialog from './BookmarkletDialog.jsx';
import { LAYOUTS, computeLayout } from '../layouts.js';

const nodeTypes = { link: GraphNode, group: GroupNode };
// Arrowheads and lines are drawn large enough to read at the default zoom.
const EDGE_COLOR = '#7a869c';
// Arrowheads grow with the line weight, so a heavy line keeps a proportionate arrow.
const arrowFor = (color, weight) => {
  const size = Math.round(20 + weight * 2.4);
  return { type: MarkerType.ArrowClosed, width: size, height: size, color };
};
const GROUP_WIDTH = 600;
const GROUP_HEIGHT = 420;
// The card closes shortly after the pointer leaves both the node and the card.
const CLOSE_DELAY = 300;
const CARD_WIDTH = 380;
const CARD_MAX_HEIGHT = 460; // matches .node-card max-height in styles.css
// The smallest a tile gets when its container is squeezed.
const TILE_MIN = { width: 80, height: 50 };
// The title a new item gets when it is placed. Its details are added afterwards, from its edit icon.
const PLACEHOLDER_TITLE = { webpage: 'New web page', pdf: 'New PDF', image: 'New image', video: 'New video', note: 'New note' };
// The size a placed item takes, used to grow a container around it.
const PLACEHOLDER_SIZE = { width: 230, height: 130 };
const CARD_GAP = 12;

/** Where the card goes: beside the node, on the right, or on the left when there is no room. */
function placeBeside(rect) {
  const height = Math.min(CARD_MAX_HEIGHT, window.innerHeight - 16);
  const right = rect.right + CARD_GAP;
  const left = right + CARD_WIDTH > window.innerWidth - 8 ? rect.left - CARD_WIDTH - CARD_GAP : right;
  const top = Math.min(Math.max(8, rect.top), window.innerHeight - height - 8);
  return { left: Math.max(8, left), top: Math.max(8, top) };
}

function toFlowNode(node) {
  return { id: node.id, type: node.type === 'group' ? 'group' : 'link', position: { x: node.x, y: node.y }, data: { node } };
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

function firstLine(text, max) {
  return text.trim().split('\n')[0].slice(0, max);
}

export default function NetworkView({ networkId }) {
  return (
    <ReactFlowProvider>
      <Board networkId={networkId} />
    </ReactFlowProvider>
  );
}

function Board({ networkId }) {
  const { screenToFlowPosition, fitView, getNode, getViewport } = useReactFlow();
  const [networkName, setNetworkName] = useState('');
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
  useEffect(() => {
    if (!addType) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') setAddType(null);
    };
    const onMove = (event) => setPointer({ x: event.clientX, y: event.clientY });
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointermove', onMove);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointermove', onMove);
      setPointer(null);
    };
  }, [addType]);
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
  // While a group is dragged, its members move with it. These are their positions at the start.
  const groupDrag = useRef(null);
  // The layout of a group and its contents when its resize began, so every step of the resize scales from it.
  const resizeSnap = useRef(null);

  useEffect(() => {
    api
      .graph(networkId)
      .then((graph) => {
        setNetworkName(graph.network.name);
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

  // Escape closes the card.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        closeCard();
        setEdgeCard(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const titles = useMemo(() => new Map(rfNodes.map((n) => [n.id, n.data.node.title])), [rfNodes]);
  const activeNode = card ? rfNodes.find((n) => n.id === card.id)?.data.node : null;
  const relationships = useMemo(() => [...new Set(edges.map((e) => e.relationship))].sort(), [edges]);

  // Memberships: every container each node belongs to. A node can belong to several containers at once,
  // and a container can belong to another one.
  const memberships = useMemo(() => {
    const map = new Map();
    for (const e of edges) {
      if (e.relationship !== 'BELONGS_TO') continue;
      map.set(e.source_id, [...(map.get(e.source_id) || []), e.target_id]);
    }
    return map;
  }, [edges]);
  const memberCount = useMemo(() => {
    const counts = new Map();
    for (const e of edges) {
      if (e.relationship === 'BELONGS_TO') counts.set(e.target_id, (counts.get(e.target_id) || 0) + 1);
    }
    return counts;
  }, [edges]);
  // The direct members of a container: the nodes and containers that belong to it.
  const membersOf = (groupId) =>
    edges.filter((e) => e.relationship === 'BELONGS_TO' && e.target_id === groupId).map((e) => e.source_id);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    const hit = (value) => value && value.toLowerCase().includes(q);
    return new Set(
      rfNodes
        .filter(({ data: { node } }) => hit(node.title) || hit(node.url) || hit(node.commentary))
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

  // Groups go first so they are drawn behind their members. Groups have no drag from the body,
  // only from the title bar, and their size comes from the stored width and height.
  const displayNodes = useMemo(
    () =>
      rfNodes
        .filter((n) => !visibleIds || visibleIds.has(n.id))
        .map((n) => {
          const node = n.data.node;
          const isGroup = node.type === 'group';
          return {
            ...n,
            zIndex: isGroup ? 0 : 1,
            // The stored size wins over the resize handles, so a refused resize springs back.
            width: node.width ?? undefined,
            height: isGroup ? node.height : undefined,
            data: {
              ...n.data,
              dim: matches !== null && !matches.has(n.id),
              members: memberCount.get(n.id) || 0,
              actions: {
                resize: resizeGroup,
                resizeTile,
                edit: (id) => actionsRef.current.edit(id),
                remove: (id) => actionsRef.current.remove(id),
              },
            },
          };
        })
        .sort((a, b) => (a.data.node.type === 'group' ? 0 : 1) - (b.data.node.type === 'group' ? 0 : 1)),
    [rfNodes, matches, visibleIds, memberCount]
  );

  // Membership is drawn as containment, so BELONGS_TO links are not drawn as arrows.
  // The middle of every item, to pick the side each arrow leaves and arrives on.
  const centres = useMemo(
    () =>
      new Map(
        rfNodes.map((n) => {
          const node = n.data.node;
          const measured = getNode(n.id)?.measured;
          const width = node.type === 'group' ? node.width : (node.width ?? measured?.width ?? 230);
          const height = node.type === 'group' ? node.height : (node.height ?? measured?.height ?? 130);
          return [n.id, { x: n.position.x + width / 2, y: n.position.y + height / 2 }];
        })
      ),
    [rfNodes]
  );

  const displayEdges = useMemo(
    () =>
      edges
        .filter((e) => e.relationship !== 'BELONGS_TO')
        .filter((e) => filter === 'ALL' || e.relationship === filter)
        .filter((e) => !visibleIds || (visibleIds.has(e.source_id) && visibleIds.has(e.target_id)))
        .map((e) => {
          // The link's own colour and weight. The default line is used where none is set.
          const stroke = e.style?.stroke || EDGE_COLOR;
          const width = e.style?.width || 2.5;
          return {
            id: e.id,
            source: e.source_id,
            target: e.target_id,
            ...sidesBetween(centres.get(e.source_id), centres.get(e.target_id)),
            label: e.relationship.replace(/_/g, ' ').toLowerCase(),
            markerStart: e.is_bidirectional ? arrowFor(stroke, width) : undefined,
            markerEnd: e.is_bidirectional ? undefined : arrowFor(stroke, width),
            style: { stroke, strokeWidth: width },
            labelStyle: { fill: 'var(--text)', fontSize: 18, fontWeight: 600 },
            labelBgStyle: { fill: 'var(--surface)', fillOpacity: 0.95 },
            labelBgPadding: [8, 4],
            labelBgBorderRadius: 4,
            className: 'graph-edge',
          };
        }),
    [edges, filter, visibleIds, centres]
  );

  // The link whose style card is open, read from the current list so the card shows saved values.
  const activeEdge = edgeCard ? edges.find((e) => e.id === edgeCard.id) : null;

  const relationshipOptions = relationships.filter((r) => r !== 'BELONGS_TO');

  // ---- Card: opens beside a node on hover, pins on click, closes when the pointer leaves.

  function clearTimers() {
    clearTimeout(openTimer.current);
    clearTimeout(closeTimer.current);
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

  // A click selects a tile or a container. Their Edit icons open the card, so a click does not open one.
  function onNodeClick(event, node) {
    // While placing, a click on a container or tile puts the new item there, as a click on empty canvas does.
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
    setSelectedId(node.id);
  }

  // Format painter. The first click copies the look of a tile, a container or a line. Clicks on other items of the
  // same kind then give them that look, until Esc is pressed.
  function paintNode(node) {
    const kind = node.type === 'group' ? 'group' : 'tile';
    if (painting === 'source') {
      setPainting({ kind, style: node.data.node.style ?? null, shape: kind === 'group' ? node.data.node.shape || 'rect' : null });
      return;
    }
    if (kind !== painting.kind) return;
    // A container also takes the shape of the one it copies from.
    if (kind === 'group' && node.data.node.shape !== painting.shape) changeShape(node.id, painting.shape);
    updateNodeStyle(node.id, painting.style);
  }

  // The click gives the canvas edge; its saved style is read from the link list.
  function paintEdge(canvasEdge) {
    if (painting === 'source') {
      const saved = edges.find((e) => e.id === canvasEdge.id);
      setPainting({ kind: 'edge', style: saved?.style ?? null });
      return;
    }
    if (painting.kind === 'edge') updateEdgeStyle(canvasEdge.id, painting.style);
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

  function onPaneClick(event) {
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
  // A container that holds the spot takes the item as a member, and grows to hold it if it does not fit.
  async function addPlaceholder(type, at) {
    const holds = groupsAt(at.x, at.y);
    const x = at.x - 115;
    const y = at.y - 40;
    try {
      const node = await api.createNode(networkId, { type, title: PLACEHOLDER_TITLE[type], x, y });
      setRfNodes((ns) => [...ns, toFlowNode(node)]);
      for (const groupId of holds) {
        await setMembership(node.id, groupId, true);
        growGroupToHold(groupId, [{ x, y, width: PLACEHOLDER_SIZE.width, height: PLACEHOLDER_SIZE.height }]);
      }
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

  // The rectangle a node or group occupies now, from its live position on the canvas.
  function boxOf(id) {
    const n = rfNodes.find((item) => item.id === id);
    if (!n) return null;
    if (n.data.node.type === 'group') {
      return { x: n.position.x, y: n.position.y, width: n.data.node.width, height: n.data.node.height };
    }
    const size = getNode(id)?.measured;
    return { x: n.position.x, y: n.position.y, width: size?.width ?? 220, height: size?.height ?? 120 };
  }

  // Whether a container's frame holds the point. A circle is tested by its radius.
  function frameHolds(g, x, y) {
    return g.shape === 'circle'
      ? Math.hypot(x - (g.x + g.width / 2), y - (g.y + g.height / 2)) <= g.width / 2
      : x >= g.x && x <= g.x + g.width && y >= g.y && y <= g.y + g.height;
  }

  // Every container whose frame holds the point, smallest first.
  function groupsAt(x, y) {
    return rfNodes
      .filter((n) => n.data.node.type === 'group')
      .map((n) => ({ id: n.id, g: { ...n.data.node, x: n.position.x, y: n.position.y } }))
      .filter(({ g }) => frameHolds(g, x, y))
      .sort((a, b) => a.g.width * a.g.height - b.g.width * b.g.height)
      .map(({ id }) => id);
  }

  // The smallest container whose frame holds the point, or null.
  function groupAt(x, y) {
    return groupsAt(x, y)[0] ?? null;
  }

  // Every node and container inside a container, at all levels. Moving a container moves all of them.
  function descendantsOf(groupId, seen = new Set()) {
    if (seen.has(groupId)) return [];
    seen.add(groupId);
    return membersOf(groupId).flatMap((m) => [m, ...descendantsOf(m, seen)]);
  }

  // Adds or removes one membership (a BELONGS_TO link).
  async function setMembership(nodeId, groupId, on) {
    const existing = edges.find(
      (e) => e.relationship === 'BELONGS_TO' && e.source_id === nodeId && e.target_id === groupId
    );
    try {
      if (on && !existing) {
        const edge = await api.createEdge(networkId, { source_id: nodeId, target_id: groupId, relationship: 'BELONGS_TO' });
        setEdges((es) => [...es, edge]);
      } else if (!on && existing) {
        await api.deleteEdge(existing.id);
        setEdges((es) => es.filter((e) => e.id !== existing.id));
      }
    } catch (e) {
      setError(e.message);
    }
  }

  // Shift-drag: a node belongs to exactly the containers whose frame holds its centre. A container is never
  // made to contain itself or anything it already contains.
  function resyncMembership(id) {
    const box = boxOf(id);
    if (!box) return;
    const below = new Set(descendantsOf(id));
    const inside = groupsAt(box.x + box.width / 2, box.y + box.height / 2).filter((g) => g !== id && !below.has(g));
    const current = memberships.get(id) || [];
    for (const g of inside) {
      if (!current.includes(g)) {
        setMembership(id, g, true).then(() => growGroup(g, [id]));
      }
    }
    for (const g of current) {
      if (!inside.includes(g)) setMembership(id, g, false);
    }
  }

  function onNodeDragStart(event, node) {
    dragging.current = true;
    closeCard();
    groupDrag.current = {
      isGroup: node.type === 'group',
      shift: Boolean(event?.shiftKey),
      origin: { ...node.position },
      members: descendantsOf(node.id),
      snapshot: new Map(
        rfNodes.map((n) => [
          n.id,
          { x: n.position.x, y: n.position.y, width: n.data.node.width, height: n.data.node.height },
        ])
      ),
    };
  }

  // Dragging a top-level container carries everything inside it and pushes aside the tiles that are neither
  // inside it nor containers. Shift-drag does the same, and dropping it outside its parent removes it.
  // Dragging a tile, or a container nested in another one, stops at the walls of the containers it is in and
  // pushes away the containers it is not in.
  function onNodeDrag(_, node) {
    const drag = groupDrag.current;
    if (!drag) return;
    const nested = (memberships.get(node.id) || []).length > 0;
    if (drag.isGroup && (drag.shift || !nested)) {
      moveContainer(drag, node);
    } else {
      pushAround(node, drag);
    }
  }

  function moveContainer(drag, node) {
    const dx = node.position.x - drag.origin.x;
    const dy = node.position.y - drag.origin.y;
    const inside = new Set(drag.members);
    const frame = { ...boxOf(node.id), x: node.position.x, y: node.position.y };
    const GAP = 16;
    const pushed = new Map();
    for (const n of rfNodes) {
      if (n.id === node.id || inside.has(n.id) || n.data.node.type === 'group') continue;
      const r = boxOf(n.id);
      const overlaps =
        r.x < frame.x + frame.width && r.x + r.width > frame.x && r.y < frame.y + frame.height && r.y + r.height > frame.y;
      if (!overlaps) continue;
      // The nearest way out of the frame: left, right, above, or below it.
      const options = [
        { x: frame.x - GAP - r.width, y: r.y },
        { x: frame.x + frame.width + GAP, y: r.y },
        { x: r.x, y: frame.y - GAP - r.height },
        { x: r.x, y: frame.y + frame.height + GAP },
      ];
      const best = options.reduce((a, b) =>
        Math.abs(a.x - r.x) + Math.abs(a.y - r.y) <= Math.abs(b.x - r.x) + Math.abs(b.y - r.y) ? a : b
      );
      pushed.set(n.id, best);
    }
    setRfNodes((ns) =>
      ns.map((n) => {
        if (inside.has(n.id)) {
          const s = drag.snapshot.get(n.id);
          return s ? { ...n, position: { x: s.x + dx, y: s.y + dy } } : n;
        }
        if (pushed.has(n.id)) return { ...n, position: pushed.get(n.id) };
        return n;
      })
    );
  }

  // A tile or a container nested in another one: it stops at the walls of the containers it is in, and those
  // walls do not move. Containers it is not in are pushed away, together with everything inside them.
  function pushAround(node, drag) {
    const self = rfNodes.find((n) => n.id === node.id);
    const size =
      self?.data.node.type === 'group'
        ? { width: self.data.node.width, height: self.data.node.height }
        : (getNode(node.id)?.measured ?? { width: 220, height: 120 });
    const GAP = 16;
    const mine = new Set(memberships.get(node.id) || []);
    const below = new Set(descendantsOf(node.id));
    const pos = new Map(rfNodes.map((n) => [n.id, { x: n.position.x, y: n.position.y }]));
    const dims = new Map(
      rfNodes
        .filter((n) => n.data.node.type === 'group')
        .map((n) => [n.id, { width: n.data.node.width, height: n.data.node.height }])
    );

    // Kept inside the walls of every container it is in: the part of the canvas all of those frames share.
    let at = { x: node.position.x, y: node.position.y };
    const frames = [...mine].filter((gid) => pos.has(gid) && dims.has(gid)).map((gid) => ({ ...pos.get(gid), ...dims.get(gid) }));
    if (frames.length > 0) {
      const left = Math.max(...frames.map((f) => f.x));
      const top = Math.max(...frames.map((f) => f.y));
      const right = Math.min(...frames.map((f) => f.x + f.width));
      const bottom = Math.min(...frames.map((f) => f.y + f.height));
      at = {
        x: Math.max(left, Math.min(at.x, right - size.width)),
        y: Math.max(top, Math.min(at.y, bottom - size.height)),
      };
    }
    const rect = { x: at.x, y: at.y, width: size.width, height: size.height };
    pos.set(node.id, at);

    // A container dragged by its frame takes what is inside it along.
    if (drag?.isGroup) {
      const dx = at.x - drag.origin.x;
      const dy = at.y - drag.origin.y;
      for (const id of drag.members) {
        const s = drag.snapshot.get(id);
        if (s) pos.set(id, { x: s.x + dx, y: s.y + dy });
      }
    }

    // The containers the tile is not in are pushed away, with everything inside them.
    for (const n of rfNodes) {
      if (n.data.node.type !== 'group' || n.id === node.id || mine.has(n.id) || below.has(n.id)) continue;
      const p = pos.get(n.id);
      const d = dims.get(n.id);
      const frame = { x: p.x, y: p.y, width: d.width, height: d.height };
      const overlaps =
        rect.x < frame.x + frame.width && rect.x + rect.width > frame.x && rect.y < frame.y + frame.height && rect.y + rect.height > frame.y;
      if (!overlaps) continue;
      const moves = [
        [rect.x - GAP - (frame.x + frame.width), 0],
        [rect.x + rect.width + GAP - frame.x, 0],
        [0, rect.y - GAP - (frame.y + frame.height)],
        [0, rect.y + rect.height + GAP - frame.y],
      ];
      const [dx, dy] = moves.reduce((a, b) =>
        Math.abs(a[0]) + Math.abs(a[1]) <= Math.abs(b[0]) + Math.abs(b[1]) ? a : b
      );
      for (const id of [n.id, ...descendantsOf(n.id)]) {
        const q = pos.get(id);
        if (q && id !== node.id) pos.set(id, { x: q.x + dx, y: q.y + dy });
      }
    }

    setRfNodes((ns) =>
      ns.map((n) => {
        const p = pos.get(n.id);
        if (!p) return n;
        if (n.data.node.type === 'group') {
          const d = dims.get(n.id);
          return {
            ...n,
            position: { x: p.x, y: p.y },
            data: { ...n.data, node: { ...n.data.node, x: p.x, y: p.y, width: d.width, height: d.height } },
          };
        }
        return { ...n, position: { x: p.x, y: p.y } };
      })
    );
  }

  function savePositions(items) {
    api.savePositions(networkId, items).catch((e) => setError(e.message));
  }

  // Arranges the whole network with the chosen layout. Each item outside a container is a unit, and a container
  // moves with everything inside it. A link between two items becomes a link between their units.
  function applyLayout(kind) {
    setLayoutOpen(false);
    const topOf = (id) => {
      let current = id;
      const seen = new Set([current]);
      while ((memberships.get(current) || []).length > 0) {
        current = memberships.get(current)[0];
        if (seen.has(current)) break;
        seen.add(current);
      }
      return current;
    };
    const units = rfNodes
      .filter((n) => (memberships.get(n.id) || []).length === 0)
      .map((n) => {
        const node = n.data.node;
        const measured = getNode(n.id)?.measured;
        const width = node.type === 'group' ? node.width : (node.width ?? measured?.width ?? 220);
        const height = node.type === 'group' ? node.height : (node.height ?? measured?.height ?? 120);
        return { id: n.id, width, height, lat: node.latitude, lon: node.longitude };
      });
    const links = edges
      .filter((e) => e.relationship !== 'BELONGS_TO')
      .map((e) => [topOf(e.source_id), topOf(e.target_id)]);
    const centres = computeLayout(kind, units, links, { compactness: compactness / 100 });

    const byId = new Map(rfNodes.map((n) => [n.id, n]));
    const moved = new Map();
    for (const unit of units) {
      const centre = centres.get(unit.id);
      if (!centre || moved.has(unit.id)) continue;
      const from = byId.get(unit.id).position;
      const dx = centre.x - unit.width / 2 - from.x;
      const dy = centre.y - unit.height / 2 - from.y;
      for (const id of [unit.id, ...descendantsOf(unit.id)]) {
        const n = byId.get(id);
        if (!n || moved.has(id)) continue;
        moved.set(id, { x: n.position.x + dx, y: n.position.y + dy });
      }
    }
    if (moved.size === 0) return;

    setRfNodes((ns) =>
      ns.map((n) => {
        const p = moved.get(n.id);
        if (!p) return n;
        if (n.data.node.type === 'group') {
          return { ...n, position: p, data: { ...n.data, node: { ...n.data.node, x: p.x, y: p.y } } };
        }
        return { ...n, position: p };
      })
    );
    savePositions(
      [...moved].map(([id, p]) => {
        const n = byId.get(id);
        return n.data.node.type === 'group'
          ? { id, x: p.x, y: p.y, width: n.data.node.width, height: n.data.node.height }
          : { id, x: p.x, y: p.y };
      })
    );
    setTimeout(() => fitView({ padding: 0.2, duration: 400 }), 50);
  }

  // When a drag ends, every node and container that moved is saved. A shift-drag then sets membership from
  // where the node was dropped; a plain drag leaves membership as it is.
  function onNodeDragStop(_, node) {
    dragging.current = false;
    const drag = groupDrag.current;
    groupDrag.current = null;
    if (!drag) return;

    setRfNodes((ns) =>
      ns.map((n) =>
        n.data.node.type === 'group'
          ? { ...n, data: { ...n.data, node: { ...n.data.node, x: n.position.x, y: n.position.y } } }
          : n
      )
    );

    const items = [];
    for (const n of rfNodes) {
      const s = drag.snapshot.get(n.id);
      if (!s) continue;
      const isGroup = n.data.node.type === 'group';
      const moved =
        s.x !== n.position.x ||
        s.y !== n.position.y ||
        (isGroup && (s.width !== n.data.node.width || s.height !== n.data.node.height));
      if (!moved) continue;
      items.push(
        isGroup
          ? { id: n.id, x: n.position.x, y: n.position.y, width: n.data.node.width, height: n.data.node.height }
          : { id: n.id, x: n.position.x, y: n.position.y }
      );
    }
    if (items.length > 0) savePositions(items);

    if (drag.shift) resyncMembership(node.id);
  }

  // Grows a container so the given members fit inside it. Saves the new box.
  function growGroup(groupId, memberIds) {
    growGroupToHold(groupId, rectsOf(memberIds));
  }

  // Grows a container so the given rectangles fit inside it. Saves the new box.
  function growGroupToHold(groupId, rects) {
    const found = rfNodes.find((n) => n.id === groupId);
    if (!found) return;
    const group = { ...found.data.node, x: found.position.x, y: found.position.y };
    const box = growBox(group, rects);
    const unchanged = box.x === group.x && box.y === group.y && box.width === group.width && box.height === group.height;
    if (unchanged) return;
    setRfNodes((ns) =>
      ns.map((n) =>
        n.id === groupId ? { ...n, position: { x: box.x, y: box.y }, data: { ...n.data, node: { ...n.data.node, ...box } } } : n
      )
    );
    savePositions([{ id: groupId, x: box.x, y: box.y, width: box.width, height: box.height }]);
  }

  // The rectangles of the given nodes, as they are on the canvas now.
  function rectsOf(ids) {
    return ids
      .map((id) => {
        const member = rfNodes.find((n) => n.id === id);
        if (!member) return null;
        const size = getNode(id)?.measured;
        return { x: member.position.x, y: member.position.y, width: size?.width ?? 220, height: size?.height ?? 120 };
      })
      .filter(Boolean);
  }

  // Where every item of a group and its contents goes when the group takes the box `box`. The snapshot is
  // taken once, when the resize starts, so each step scales from the same starting layout.
  // Shrinking compresses the contents into the new frame (tiles get smaller, never below TILE_MIN). Growing
  // leaves the contents where they are.
  function fitContents(snap, box) {
    const sx = snap.old.width > 0 ? Math.min(1, box.width / snap.old.width) : 1;
    const sy = snap.old.height > 0 ? Math.min(1, box.height / snap.old.height) : 1;
    const out = new Map();
    for (const [id, m] of snap.members) {
      if (id === snap.id) continue;
      const x = sx < 1 ? box.x + (m.x - snap.old.x) * sx : m.x;
      const y = sy < 1 ? box.y + (m.y - snap.old.y) * sy : m.y;
      const width = m.type === 'group' ? m.width * sx : Math.max(TILE_MIN.width, m.width * sx);
      const height = m.type === 'group' ? m.height * sy : Math.max(TILE_MIN.height, m.height * sy);
      out.set(id, { x, y, width, height });
    }
    out.set(snap.id, { x: box.x, y: box.y, width: box.width, height: box.height });
    return out;
  }

  // Resizes a group from its edge, corner, or radius handle. Any size from 0 up is allowed. Shrinking
  // compresses the contents to fit; they stay members.
  function resizeGroup(id, box, final) {
    const found = rfNodes.find((n) => n.id === id);
    if (!found || !isValidBox(found.data.node.shape === 'circle' ? 'circle' : 'rect', box)) return;
    if (!resizeSnap.current || resizeSnap.current.id !== id) {
      const members = new Map();
      for (const did of [id, ...descendantsOf(id)]) {
        const n = rfNodes.find((item) => item.id === did);
        if (!n) continue;
        const isGroup = n.data.node.type === 'group';
        const measured = getNode(did)?.measured;
        members.set(did, {
          type: n.data.node.type,
          x: n.position.x,
          y: n.position.y,
          width: isGroup ? n.data.node.width : (n.data.node.width ?? measured?.width ?? 220),
          height: isGroup ? n.data.node.height : (n.data.node.height ?? measured?.height ?? 120),
        });
      }
      resizeSnap.current = { id, old: members.get(id), members };
    }
    const snap = resizeSnap.current;
    const placed = fitContents(snap, box);
    const next = { ...found.data.node, x: box.x, y: box.y, width: box.width, height: box.height };
    setRfNodes((ns) =>
      ns.map((n) => {
        const p = placed.get(n.id);
        if (!p) return n;
        if (n.id === id) return { ...n, position: { x: box.x, y: box.y }, data: { ...n.data, node: next } };
        if (n.data.node.type === 'group') {
          return { ...n, position: { x: p.x, y: p.y }, data: { ...n.data, node: { ...n.data.node, x: p.x, y: p.y, width: p.width, height: p.height } } };
        }
        return { ...n, position: { x: p.x, y: p.y }, data: { ...n.data, node: { ...n.data.node, width: p.width, height: p.height } } };
      })
    );
    if (final) {
      savePositions([...placed].map(([did, p]) => ({ id: did, x: p.x, y: p.y, width: p.width, height: p.height })));
      resizeSnap.current = null;
    }
  }

  // Resizes a tile from one of its edges. Its stored size is what it keeps; a container it is in grows to hold it.
  function resizeTile(id, box, final) {
    setRfNodes((ns) =>
      ns.map((n) =>
        n.id === id
          ? { ...n, position: { x: box.x, y: box.y }, data: { ...n.data, node: { ...n.data.node, x: box.x, y: box.y, width: box.width, height: box.height } } }
          : n
      )
    );
    if (final) {
      savePositions([{ id, x: box.x, y: box.y, width: box.width, height: box.height }]);
      for (const groupId of memberships.get(id) || []) {
        growGroupToHold(groupId, [box]);
      }
    }
  }

  // Changes a group's shape in place. A circle takes the smaller side of the frame; other shapes keep it.
  async function changeShape(id, shape) {
    const found = rfNodes.find((n) => n.id === id);
    if (!found) return;
    const group = { ...found.data.node, x: found.position.x, y: found.position.y };
    const box = convertShape(group, shape);
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

  // Opens the card for a node or group in Edit mode, beside it. The edit icon uses this.
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
    const message =
      node.type === 'group'
        ? `Delete the group "${node.title}"? Its members stay on the canvas.`
        : `Delete "${node.title}" and its relationships?`;
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

  // Dragging a handle from one node to another asks how they are related before any edge is saved.
  // A group and a node always mean "belongs to": the node goes inside the group.
  function onConnect(connection) {
    const source = rfNodes.find((n) => n.id === connection.source)?.data.node;
    const target = rfNodes.find((n) => n.id === connection.target)?.data.node;
    if (!source || !target || source.id === target.id) return;
    if (source.type === 'group' && target.type === 'group') return;
    const belongs = source.type === 'group' || target.type === 'group';
    if (belongs) {
      // A tile that is already a member of this group needs no change, so nothing happens.
      const member = source.type === 'group' ? target : source;
      const group = source.type === 'group' ? source : target;
      if ((memberships.get(member.id) || []).includes(group.id)) return;
    }
    setPending({ source, target, belongs });
  }

  // A connection dropped on a group's outline, not on one of its handles, still counts as connecting to the
  // group. A drop on a tile is left to React Flow, so tile-to-tile links are unaffected.
  function onConnectEnd(event, state) {
    setConnecting(false);
    if (state.toHandle || !state.fromNode) return;
    if (event.target?.closest?.('.react-flow__node-link')) return;
    const point = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    const groupId = groupAt(point.x, point.y);
    if (!groupId) return;
    onConnect({ source: state.fromNode.id, target: groupId });
  }

  async function saveRelation({ relationship, direction }) {
    const { source, target, belongs } = pending;

    if (belongs) {
      const member = source.type === 'group' ? target : source;
      const group = source.type === 'group' ? source : target;
      const edge = await api.createEdge(networkId, {
        source_id: member.id,
        target_id: group.id,
        relationship: 'BELONGS_TO',
      });
      setEdges((es) => [...es, edge]);
      setPending(null);
      growGroup(group.id, [member.id]);
      return;
    }

    const reversed = direction === 'backward';
    const edge = await api.createEdge(networkId, {
      source_id: reversed ? target.id : source.id,
      target_id: reversed ? source.id : target.id,
      relationship,
      is_bidirectional: direction === 'both',
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

  function centerPoint() {
    const rect = wrapRef.current.getBoundingClientRect();
    return screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
  }

  // A new group is an empty box in the middle of the view. Drag nodes into it with Connect.
  async function createGroup() {
    const name = window.prompt('Name the group, for example Deep Learning', 'New group');
    if (!name || !name.trim()) return;
    const at = centerPoint();
    await createNodeAt(
      { type: 'group', title: name.trim().slice(0, 255), width: GROUP_WIDTH, height: GROUP_HEIGHT },
      { x: at.x - GROUP_WIDTH / 2, y: at.y - GROUP_HEIGHT / 2 }
    );
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
    <div className={`board${addType ? ' placing' : ''}${connecting ? ' connecting' : ''}${painting ? ' painting' : ''}`}>
      <header className="toolbar">
        <a className="back" href="#/">
          ← Networks
        </a>
        <h2 title={networkName}>{networkName}</h2>
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
        <button className="ghost" onClick={createGroup}>
          + Group
        </button>
        <button className="ghost" onClick={toggleGrid} aria-pressed={showGrid}>
          Grid: {showGrid ? 'on' : 'off'}
        </button>
        <button className="ghost" onClick={() => fitView({ padding: 0.2, duration: 400 })}>
          Fit
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
      </header>

      {scope !== 'all' && !selectedId && <div className="banner">Click a node to show the links around it.</div>}

      {error && (
        <div className="banner error" role="alert" onClick={() => setError('')}>
          {error} <span className="muted">(click to dismiss)</span>
        </div>
      )}

      <div className="canvas-wrap" ref={wrapRef} onDragOver={onDragOver} onDrop={onDrop}>
        {!loaded && <p className="muted canvas-msg">Loading…</p>}
        {loaded && rfNodes.length === 0 && (
          <p className="muted canvas-msg">
            Add a web page, PDF, image or note from the toolbar on the right, drop a link or highlighted text here, or use the Bookmarklet on any page.
          </p>
        )}

        <ReactFlow
          nodes={displayNodes}
          edges={displayEdges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onNodeDragStart={onNodeDragStart}
          onNodeDrag={onNodeDrag}
          onNodeDragStop={onNodeDragStop}
          onMoveStart={onMoveStart}
          onConnect={onConnect}
          onConnectStart={() => setConnecting(true)}
          onConnectEnd={onConnectEnd}
          connectionMode="loose"
          onNodeClick={onNodeClick}
          onNodeMouseLeave={onNodeMouseLeave}
          onPaneClick={onPaneClick}
          onEdgeClick={onEdgeClick}
          deleteKeyCode={null}
          minZoom={0.1}
          maxZoom={2.5}
        >
          {showGrid && <Background />}
          <Controls />
          <MiniMap pannable zoomable />
        </ReactFlow>

        <RightToolbar onAdd={setAddType} />

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
          />
        )}
      </div>

      {edgeCard && activeEdge && (
        <EdgeCard
          edge={activeEdge}
          titles={titles}
          style={{ left: edgeCard.left, top: edgeCard.top }}
          onSaved={savedEdge}
          onClose={() => setEdgeCard(null)}
        />
      )}


      {pending && (
        <RelationDialog
          source={pending.source}
          target={pending.target}
          belongs={pending.belongs}
          onCancel={() => setPending(null)}
          onSave={saveRelation}
        />
      )}

      {showBookmarklet && <BookmarkletDialog onClose={() => setShowBookmarklet(false)} />}
    </div>
  );
}

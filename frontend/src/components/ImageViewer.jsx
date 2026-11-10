import { useRef, useState } from 'react';

// Zoom levels: Fit shows the whole picture across the window; zooming in lets the reader pan around it.
const MAX_ZOOM = 8;

/**
 * A picture in a window for close inspection. Zoom with + and −, Fit returns to the window's width, and when zoomed
 * the picture can be dragged to move around it. Scrolling inside the window scrolls the picture, not the canvas.
 */
export default function ImageViewer({ src, alt }) {
  const [zoom, setZoom] = useState(1);
  const scroller = useRef(null);
  const drag = useRef(null);

  function change(next) {
    setZoom(Math.min(MAX_ZOOM, Math.max(1, next)));
  }

  function onPointerDown(event) {
    if (zoom <= 1) return;
    drag.current = { x: event.clientX, y: event.clientY, left: scroller.current.scrollLeft, top: scroller.current.scrollTop };
    scroller.current.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event) {
    if (!drag.current) return;
    scroller.current.scrollLeft = drag.current.left - (event.clientX - drag.current.x);
    scroller.current.scrollTop = drag.current.top - (event.clientY - drag.current.y);
  }

  function onPointerUp(event) {
    drag.current = null;
    if (scroller.current?.hasPointerCapture(event.pointerId)) scroller.current.releasePointerCapture(event.pointerId);
  }

  return (
    <div className="image-viewer">
      <div className="image-viewer-tools nodrag">
        <button type="button" onClick={() => change(zoom / 1.25)} aria-label="Zoom out">
          −
        </button>
        <span>{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={() => change(zoom * 1.25)} aria-label="Zoom in">
          +
        </button>
        <button type="button" onClick={() => change(1)}>
          Fit
        </button>
      </div>
      <div
        ref={scroller}
        className={`image-viewer-scroll nowheel nodrag${zoom > 1 ? ' zoomed' : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <img src={src} alt={alt} draggable={false} style={{ width: `${zoom * 100}%` }} />
      </div>
    </div>
  );
}

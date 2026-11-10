import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { hostFromUrl } from '../utils.js';
import PageView, { useFramable } from './PageView.jsx';
import ImageViewer from './ImageViewer.jsx';

const isImage = (url) => /\.(png|jpe?g|gif|webp|svg|avif)(\?|#|$)/i.test(url);

/** What a reference is called: the title it was given, or the site it is on. */
export const referenceName = (reference) => reference.title || hostFromUrl(reference.url);

/**
 * The references of a tile: any number of extra pages on its topic. Hovering the badge opens a window with the list on
 * the left; the reference under the pointer is shown on the right, in a frame where its site allows it. Clicking a
 * reference opens it in a new tab. The window closes shortly after the pointer leaves the badge and the window.
 */
export default function ReferencesBadge({ references }) {
  const [shown, setShown] = useState(false);
  const [active, setActive] = useState(0);
  const closing = useRef(null);
  useEffect(() => () => clearTimeout(closing.current), []);

  const open = () => {
    clearTimeout(closing.current);
    setShown(true);
  };
  const close = () => {
    closing.current = setTimeout(() => setShown(false), 400);
  };
  // The window opens level with the badge. Where that would cut it off at the edge of the screen it is moved just
  // enough to stay in view. The offsets are in canvas units, relative to where it would open.
  const windowRef = useRef(null);
  const [shift, setShift] = useState(null);
  useLayoutEffect(() => {
    const el = windowRef.current;
    if (!shown || !el) {
      setShift(null);
      return;
    }
    const tileEl = el.closest('.react-flow__node');
    const badge = el.offsetParent?.getBoundingClientRect();
    if (!tileEl || !badge) return;
    const tile = tileEl.getBoundingClientRect();
    const box = el.getBoundingClientRect();
    const zoom = tile.width / tileEl.offsetWidth || 1;
    const margin = 8;
    const top = Math.min(Math.max(badge.top, margin), window.innerHeight - box.height - margin);
    const left = Math.min(Math.max(badge.left + 64 * zoom, margin), window.innerWidth - box.width - margin);
    setShift({ top: (top - badge.top) / zoom, left: (left - badge.left) / zoom });
  }, [shown]);

  const current = references[Math.min(active, references.length - 1)];

  return (
    <span className="page-badge ref-badge nodrag" onMouseEnter={open} onMouseLeave={close}>
      <span className="type-badge ref-chip">
        References · {references.length}
      </span>
      {shown && (
        <div ref={windowRef} className="page-window ref-window nowheel" style={shift ?? undefined}>
          <div className="page-window-bar">References ({references.length})</div>
          <div className="ref-body">
            <ul className="ref-list">
              {references.map((reference, i) => (
                <li key={`${i}-${reference.url}`}>
                  <a
                    href={reference.url}
                    target="_blank"
                    rel="noreferrer"
                    className={i === active ? 'is-active' : undefined}
                    title={reference.url}
                    onMouseEnter={() => setActive(i)}
                    onFocus={() => setActive(i)}
                    onClick={(event) => event.stopPropagation()}
                  >
                    {referenceName(reference)}
                  </a>
                </li>
              ))}
            </ul>
            <ReferencePreview reference={current} />
          </div>
        </div>
      )}
    </span>
  );
}

/** One reference shown on the right of the window: a picture, a page in a frame, or a button when the page cannot be framed. */
function ReferencePreview({ reference }) {
  const image = isImage(reference.url);
  const framable = useFramable(image ? null : reference.url);
  return (
    <div className="ref-preview">
      {image ? (
        <ImageViewer src={reference.url} alt={referenceName(reference)} />
      ) : framable === true ? (
        <PageView url={reference.url} title={referenceName(reference)} className="page-window-frame" />
      ) : (
        <a className="page-open-float ref-open" href={reference.url} target="_blank" rel="noreferrer">
          {framable === null ? 'Checking…' : `Read on ${hostFromUrl(reference.url)} ↗`}
        </a>
      )}
    </div>
  );
}

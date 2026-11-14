import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { hostFromUrl } from '../utils.js';
import { KIND_LABEL, kindOf } from '../links.js';
import PageView, { useFramable } from './PageView.jsx';
import ImageViewer from './ImageViewer.jsx';

// The player address for a video link that can be shown in a frame, or null.
function videoEmbed(url) {
  const youtube = url.match(/(?:youtube\.com\/watch\?(?:.*&)?v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]{11})/);
  if (youtube) return `https://www.youtube.com/embed/${youtube[1]}`;
  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return vimeo ? `https://player.vimeo.com/video/${vimeo[1]}` : null;
}

/** What a reference is called: the title it was given, or the site it is on. */
export const referenceName = (reference) => reference.title || hostFromUrl(reference.url);

/** A small icon for what a reference points to: a web page, a PDF, a video or a picture. Its name is the tooltip. */
function KindIcon({ kind }) {
  return (
    <svg className="ref-icon" viewBox="0 0 16 16" role="img" aria-label={KIND_LABEL[kind]}>
      <title>{KIND_LABEL[kind]}</title>
      {kind === 'pdf' && (
        <>
          <path d="M4 1.5h5.5L13 5v9.5H4z" />
          <path d="M9.5 1.5V5H13" />
        </>
      )}
      {kind === 'video' && (
        <>
          <rect x="1.5" y="3" width="13" height="10" rx="2" />
          <path d="M6.8 6.2v3.6l3.2-1.8z" fill="currentColor" />
        </>
      )}
      {kind === 'image' && (
        <>
          <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" />
          <circle cx="5.5" cy="6" r="1.2" />
          <path d="M2 12.5l3.5-3.5 2.5 2.5 2-2 3.5 3.5" />
        </>
      )}
      {kind === 'page' && (
        <>
          <circle cx="8" cy="8" r="6.5" />
          <path d="M1.5 8h13M8 1.5c2 2.2 2 10.8 0 13M8 1.5c-2 2.2-2 10.8 0 13" />
        </>
      )}
    </svg>
  );
}

/**
 * The links of a tile: any number of pages, pictures, videos and PDFs, listed under a "References:" heading. Hovering a link
 * opens a window that shows that link: a picture, a page in a frame where its site allows it, or a button to open it.
 * The window has a close button, and it also closes shortly after the pointer leaves the link and the window.
 * Clicking a link opens it in a new tab.
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
    <div className="ref-block nodrag">
      <span className="ref-heading">References:</span>
      {shown && (
        <div ref={windowRef} className="page-window ref-window nowheel" style={shift ?? undefined} onMouseEnter={open} onMouseLeave={close}>
          <div className="page-window-bar">
            <span className="ref-window-title">{referenceName(current)}</span>
            <button
              type="button"
              className="ref-toggle"
              aria-label="Close preview"
              onClick={(event) => {
                event.stopPropagation();
                clearTimeout(closing.current);
                setShown(false);
              }}
            >
              ×
            </button>
          </div>
          <div className="ref-body">
            <ReferencePreview reference={current} />
          </div>
        </div>
      )}
      {/* Only the links open the preview window, so hovering the rest of the tile does not. */}
      <ul className="tile-ref-list" onMouseLeave={close}>
        {references.map((reference, i) => (
          <li key={`${i}-${reference.url}`}>
            <a
              href={reference.url}
              target="_blank"
              rel="noreferrer"
              title={reference.url}
              onClick={(event) => event.stopPropagation()}
              onMouseEnter={() => {
                setActive(i);
                open();
              }}
              onFocus={() => {
                setActive(i);
                open();
              }}
              onBlur={close}
            >
              <KindIcon kind={kindOf(reference.url)} />
              {referenceName(reference)}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Every reference of a tile as a link in a narrow list on the left, and the one picked (by hovering or focusing its link)
 * shown on the right. Used by the hover window and by the maximized view.
 */
export function ReferenceViewer({ references, active, onPick }) {
  const current = references[Math.min(active, references.length - 1)];
  return (
    <>
      <ul className="ref-list">
        {references.map((reference, i) => (
          <li key={`${i}-${reference.url}`}>
            <a
              href={reference.url}
              target="_blank"
              rel="noreferrer"
              className={i === active ? 'is-active' : undefined}
              title={reference.url}
              onMouseEnter={() => onPick(i)}
              onFocus={() => onPick(i)}
              onClick={(event) => event.stopPropagation()}
            >
              <KindIcon kind={kindOf(reference.url)} />
              {referenceName(reference)}
            </a>
          </li>
        ))}
      </ul>
      <ReferencePreview reference={current} />
    </>
  );
}

/** One reference shown on the right of the window: a picture, a page in a frame, or a button when the page cannot be framed. */
function ReferencePreview({ reference }) {
  const kind = kindOf(reference.url);
  const image = kind === 'image';
  const embed = kind === 'video' ? videoEmbed(reference.url) : null;
  const framable = useFramable(image || embed ? null : reference.url);
  return (
    <div className="ref-preview">
      {image ? (
        <ImageViewer src={reference.url} alt={referenceName(reference)} />
      ) : embed ? (
        <iframe className="ref-video" src={embed} title={referenceName(reference)} allow="fullscreen; picture-in-picture" allowFullScreen />
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

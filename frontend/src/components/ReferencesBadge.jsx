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

/**
 * The links of a tile: any number of pages, pictures, videos and PDFs, all listed under a "References:" heading. Hovering the
 * heading opens a window with the list on
 * the left; the reference under the pointer is shown on the right, in a frame where its site allows it. Clicking a
 * reference opens it in a new tab. The window closes shortly after the pointer leaves the badge and the window.
 */
export default function ReferencesBadge({ references }) {
  const [shown, setShown] = useState(false);
  const [active, setActive] = useState(0);
  // The list of links on the left can be hidden to give the page more room. It stays as chosen while the window is open.
  const [listHidden, setListHidden] = useState(false);
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
            External References ({references.length})
            <button
              type="button"
              className="ref-toggle"
              aria-expanded={!listHidden}
              onClick={(event) => {
                event.stopPropagation();
                setListHidden((hidden) => !hidden);
              }}
            >
              {listHidden ? 'Show list' : 'Hide list'}
            </button>
          </div>
          <div className="ref-body">
            {!listHidden && (
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
                      <span className="ref-kind">{KIND_LABEL[kindOf(reference.url)]}</span> {referenceName(reference)}
                    </a>
                  </li>
                ))}
              </ul>
            )}
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
              <span className="ref-kind">{KIND_LABEL[kindOf(reference.url)]}</span> {referenceName(reference)}
            </a>
          </li>
        ))}
      </ul>
    </div>
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

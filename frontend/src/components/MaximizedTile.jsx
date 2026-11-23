import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import TexText from './TexText.jsx';
import RichText from './RichText.jsx';
import { KindIcon, ReferencePreview, referenceName } from './ReferencesBadge.jsx';
import { kindOf, linksOf, mediaOf } from '../links.js';
import { hostFromUrl } from '../utils.js';
import { tagColour } from '../tags.js';
import { readableOn } from '../layers.js';

// The database stores times in UTC without a zone, so one is added before the date is read.
function formatDate(value) {
  if (!value) return '—';
  const date = new Date(`${value.replace(' ', 'T')}Z`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function placeOf(node) {
  const coordinates = node.latitude != null && node.longitude != null ? `${node.latitude.toFixed(3)}, ${node.longitude.toFixed(3)}` : null;
  return [node.country, coordinates].filter(Boolean).join(' · ') || null;
}

const relationName = (relationship) => relationship.replace(/_/g, ' ').toLowerCase();

/**
 * Where the preview goes: just to the right of the hovered item, level with it, or to its left when there is no room on
 * the right. It is kept inside the window.
 */
function placeBeside(rect, tall, measured) {
  const margin = 8;
  const gap = 10;
  const width = Math.min(560, window.innerWidth * 0.44);
  const limit = Math.min(window.innerHeight * 0.7, 620);
  // A page needs the full height. A tile's content takes only the height it needs, up to the same limit, so its real height
  // (measured once it is shown) decides whether it has to move up to stay on the screen. A small tile stays level with the link.
  const height = tall ? limit : Math.min(measured ?? limit, limit);
  const left = rect.right + gap + width <= window.innerWidth - margin ? rect.right + gap : Math.max(margin, rect.left - gap - width);
  const top = Math.min(Math.max(margin, rect.top - 8), window.innerHeight - height - margin);
  return { left, top, width, height: tall ? limit : undefined, maxHeight: limit };
}

/**
 * The floating window of a preview, placed beside the hovered item (rect is its place). After it is shown, its real height is
 * measured and it is placed again, before the screen is drawn, so a short preview stays close to the item instead of moving up
 * to make room for the tallest one it could be.
 */
function FloatingPreview({ rect, tall, contentKey, className, onEnter, onLeave, children }) {
  const ref = useRef(null);
  const [style, setStyle] = useState(() => placeBeside(rect, tall));
  useLayoutEffect(() => {
    const next = placeBeside(rect, tall, ref.current?.offsetHeight);
    setStyle((old) => (JSON.stringify(old) === JSON.stringify(next) ? old : next));
  }, [rect, tall, contentKey]);
  return (
    <div ref={ref} className={`max-preview${className ? ` ${className}` : ''}`} style={style} role="dialog" aria-label="Preview" onMouseEnter={onEnter} onMouseLeave={onLeave}>
      {children}
    </div>
  );
}

/**
 * What a tile holds: picture or video, title, tags, notes, when and where, dates, and its external references. With
 * linkHover, hovering a reference previews it (the maximized tile). Without it, references are plain links (the preview
 * of a related tile).
 */
export function TileBody({ node, tagColours, linkHover }) {
  const links = linksOf(node);
  const media = mediaOf(node);
  // The same picture the tile shows: its first picture or video link, or else the preview image saved with the page.
  const picture = media?.src || node.thumbnail_url || null;
  const place = placeOf(node);
  return (
    <>
      {picture && (
        <img
          className="max-media"
          src={picture}
          alt={node.title}
          referrerPolicy="no-referrer"
          onError={(event) => {
            event.currentTarget.style.display = 'none';
          }}
        />
      )}

      <h2 className="max-heading">
        <TexText text={node.title} />
      </h2>

      {node.tags?.length > 0 && (
        <p className="tag-chips">
          {node.tags.map((tag) => (
            <span key={tag} className="tag-chip" style={{ '--tag': tagColour(tag, tagColours) }}>
              {tag}
            </span>
          ))}
        </p>
      )}

      {node.commentary && <RichText text={node.commentary} className="max-notes" />}

      <dl className="max-meta">
        {node.time && (
          <>
            <dt>When</dt>
            <dd>{node.time}</dd>
          </>
        )}
        {place && (
          <>
            <dt>Where</dt>
            <dd>{place}</dd>
          </>
        )}
        <dt>Added</dt>
        <dd>{formatDate(node.created_at)}</dd>
        <dt>Last changed</dt>
        <dd>{formatDate(node.updated_at)}</dd>
      </dl>

      {links.length > 0 && (
        <section className="max-links">
          <h3>External references ({links.length})</h3>
          <ul>
            {links.map((link, i) => (
              <li key={`${i}-${link.url}`}>
                <KindIcon kind={kindOf(link.url)} />
                <a
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  title={link.url}
                  onMouseEnter={linkHover ? (event) => linkHover.enter(link, event.currentTarget) : undefined}
                  onFocus={linkHover ? (event) => linkHover.enter(link, event.currentTarget) : undefined}
                  onMouseLeave={linkHover ? linkHover.leave : undefined}
                  onBlur={linkHover ? linkHover.leave : undefined}
                >
                  {referenceName(link)}
                </a>
                {link.title && <span className="muted small">{hostFromUrl(link.url)}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

/**
 * The relationships of the tile, each written as a sentence that reads forward, with "this" for the tile being shown:
 * "This supports Gradient" when the relationship goes out from it, "Evolution leads to this" when it comes in.
 */
function RelationList({ relations, show, hide, onOpenTile }) {
  return (
    <ul>
      {relations.map((relation) => {
        const other = (
          <button
            type="button"
            className="max-tile-link"
            title={`Open ${relation.other.title}`}
            onMouseEnter={(event) => show({ kind: 'tile', node: relation.other }, event.currentTarget)}
            onFocus={(event) => show({ kind: 'tile', node: relation.other }, event.currentTarget)}
            onMouseLeave={hide}
            onBlur={hide}
            onClick={() => onOpenTile(relation.other.id)}
          >
            {relation.other.title}
          </button>
        );
        const type = <span className="relation-type">{relationName(relation.relationship)}</span>;
        return (
          <li key={relation.id}>
            {relation.outgoing ? (
              <>
                This {type} {other}
              </>
            ) : (
              <>
                {other} {type} this
              </>
            )}
            {relation.twoWay && <span className="muted small"> (both ways)</span>}
          </li>
        );
      })}
    </ul>
  );
}

/** The colours the tile's layers give it, as the enlarged tile's frame and background (nothing when no layer colours it). */
function maxLookStyle(look) {
  if (!look) return undefined;
  const style = {};
  if (look.fill) Object.assign(style, { background: look.fill, color: readableOn(look.fill) });
  if (look.color) Object.assign(style, { border: `5px solid ${look.color}`, boxSizing: 'border-box' });
  return style;
}

/**
 * A tile enlarged to fill the canvas: its content, its external references (hover one to preview it), and its
 * relationships to and from other tiles (hover one to preview that tile; click it to open that tile here instead).
 */
export default function MaximizedTile({ node, relations, tagColours, look, onEdit, onClose, onOpenTile }) {
  // The one floating preview: { kind: 'link', link } or { kind: 'tile', node }, or null.
  const [preview, setPreview] = useState(null);
  const closing = useRef(null);
  useEffect(() => () => clearTimeout(closing.current), []);

  // The preview opens beside the item that was hovered, so the item's place on the screen is kept with it.
  const show = (next, element) => {
    clearTimeout(closing.current);
    setPreview({ ...next, rect: element.getBoundingClientRect() });
  };
  // The preview stays while the pointer is on it, and closes a moment after the pointer leaves the item and the preview.
  const hide = () => {
    closing.current = setTimeout(() => setPreview(null), 350);
  };
  const keep = () => clearTimeout(closing.current);
  const closeNow = () => {
    clearTimeout(closing.current);
    setPreview(null);
  };

  // Opening another tile replaces this one, so the preview goes too.
  const open = (id) => {
    closeNow();
    onOpenTile(id);
  };

  // The ones that go out from this tile come first, then the ones that come in.
  const ordered = [...relations.filter((r) => r.outgoing), ...relations.filter((r) => !r.outgoing)];

  return (
    <div className="max-tile" style={maxLookStyle(look)}>
      <div className="focus-bar">
        <div className="max-back">
          <button type="button" className="ghost small" onClick={onClose}>
            ← Back to graph
          </button>
          <span className="focus-title">{node.title}</span>
        </div>
        <div className="max-actions">
          {onEdit && (
            <button type="button" className="ghost small" onClick={onEdit}>
              Edit
            </button>
          )}
          <button type="button" className="ghost small" onClick={onClose} aria-label="Close maximized tile">
            ×
          </button>
        </div>
      </div>

      <div className="max-scroll">
        <article className="max-body">
          <TileBody node={node} tagColours={tagColours} linkHover={{ enter: (link, element) => show({ kind: 'link', link }, element), leave: hide }} />

          {relations.length > 0 && (
            <section className="max-relations">
              <h3>Relationships ({relations.length})</h3>
              <RelationList relations={ordered} show={show} hide={hide} onOpenTile={open} />
            </section>
          )}
        </article>
      </div>

      {preview && (
        <FloatingPreview
          rect={preview.rect}
          tall={preview.kind === 'link'}
          contentKey={preview.kind === 'link' ? preview.link.url : preview.node.id}
          onEnter={keep}
          onLeave={hide}
        >
          <div className="max-preview-bar">
            <span className="focus-title">{preview.kind === 'link' ? referenceName(preview.link) : preview.node.title}</span>
            <button type="button" className="ref-toggle" aria-label="Close preview" onClick={closeNow}>
              ×
            </button>
          </div>
          {preview.kind === 'link' ? (
            <div className="max-preview-frame">
              <ReferencePreview reference={preview.link} />
            </div>
          ) : (
            <div className="max-preview-body">
              <TileBody node={preview.node} tagColours={tagColours} />
            </div>
          )}
        </FloatingPreview>
      )}
    </div>
  );
}

/**
 * The preview of a tile beside an item on the screen (rect is the item's place): used when a [[wiki link]] is hovered. The
 * preview stays while the pointer is on it.
 */
export function TilePreviewWindow({ node, rect, tagColours, className, onEnter, onLeave, onClose }) {
  return (
    <FloatingPreview rect={rect} tall={false} contentKey={node.id} className={className} onEnter={onEnter} onLeave={onLeave}>
      <div className="max-preview-bar">
        <span className="focus-title">{node.title}</span>
        <button type="button" className="ref-toggle" aria-label="Close preview" onClick={onClose}>
          ×
        </button>
      </div>
      <div className="max-preview-body">
        <TileBody node={node} tagColours={tagColours} />
      </div>
    </FloatingPreview>
  );
}

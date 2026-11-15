import TexText from './TexText.jsx';
import RichText from './RichText.jsx';
import { KindIcon, referenceName } from './ReferencesBadge.jsx';
import { kindOf, linksOf, mediaOf } from '../links.js';
import { hostFromUrl } from '../utils.js';
import { tagColour } from '../tags.js';

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

/**
 * A tile enlarged to fill the canvas: its title, picture or video, notes, tags, when and where, its dates, and every
 * external reference as a link. The tile itself, not the page it links to.
 */
export default function MaximizedTile({ node, tagColours, onEdit, onClose }) {
  const links = linksOf(node);
  const media = mediaOf(node);
  const place = placeOf(node);

  return (
    <div className="max-tile">
      <div className="focus-bar">
        <span className="focus-title">{node.title}</span>
        <div className="max-actions">
          <button type="button" className="ghost small" onClick={onEdit}>
            Edit
          </button>
          <button type="button" className="ghost small" onClick={onClose} aria-label="Close maximized tile">
            ×
          </button>
        </div>
      </div>

      <div className="max-scroll">
        <article className="max-body">
          {media?.src && <img className="max-media" src={media.src} alt={node.title} referrerPolicy="no-referrer" />}

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
                    <a href={link.url} target="_blank" rel="noreferrer" title={link.url}>
                      {referenceName(link)}
                    </a>
                    {link.title && <span className="muted small">{hostFromUrl(link.url)}</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </article>
      </div>
    </div>
  );
}

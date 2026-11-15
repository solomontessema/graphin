import { useMemo } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { useWiki, wikiPattern } from './wikilinks.jsx';

// Links in a note open in a new tab. Set once for every note. A wiki link has no address and is handled by the page.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A' && node.hasAttribute('href')) {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

// Maths as in TexText: $$...$$ on its own line, $...$ inline. A dollar sign followed by a space is plain text.
const MATH = /\$\$([\s\S]+?)\$\$|(?<!\\)\$(?![\s$])([^$\n]+?)(?<![\s\\])\$/g;
// Placeholders, chosen so no Markdown or text uses them: one for \$, one around each piece of maths, one around each wiki link.
const ESCAPED = '\u0002';
const MARK = '\u0003';
const WIKI = '\u0004';

const escapeHtml = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Renders a note, a label or a shape's text as Markdown (headings, lists, bold, italic, links, code, quotes) with LaTeX
 * maths and [[wiki links]]. The maths and the wiki links are set aside before the Markdown is read and put back afterwards,
 * so the two do not interfere. The result is cleaned before it is shown, so a note cannot run scripts or load anything hidden.
 * A wiki link is shown as a link to that tile: hover it to preview the tile, click it to open it.
 */
export default function RichText({ text, className }) {
  const wiki = useWiki();
  const html = useMemo(() => render(text, wiki), [text, wiki]);

  // The links are inside HTML that was made as a string, so one handler for the whole text finds them.
  const linkOf = (event) => event.target.closest?.('.wikilink');
  return (
    <div
      className={`rich${className ? ` ${className}` : ''}`}
      dangerouslySetInnerHTML={{ __html: html }}
      onClick={(event) => {
        const link = linkOf(event);
        if (link) {
          event.preventDefault();
          event.stopPropagation();
          wiki.open(link.dataset.target);
        }
      }}
      onKeyDown={(event) => {
        const link = linkOf(event);
        if (link && event.key === 'Enter') wiki.open(link.dataset.target);
      }}
      onMouseOver={(event) => {
        const link = linkOf(event);
        if (link) wiki.preview(link.dataset.target, link);
      }}
      onMouseOut={(event) => {
        if (linkOf(event)) wiki.hide();
      }}
    />
  );
}

function render(text, wiki) {
  if (!text) return '';
  const links = [];
  const maths = [];
  const source = text
    .replace(/\\\$/g, ESCAPED)
    .replace(wikiPattern(), (_, target, __, display) => {
      links.push({ target, display: display || '' });
      return `${WIKI}${links.length - 1}${WIKI}`;
    })
    .replace(MATH, (_, display, inline) => {
      const isDisplay = display !== undefined;
      // Invalid maths is shown as its red source rather than breaking the tile.
      maths.push(katex.renderToString(isDisplay ? display : inline, { displayMode: isDisplay, throwOnError: false, output: 'html' }));
      return `${MARK}${maths.length - 1}${MARK}`;
    });
  const markdown = marked.parse(source, { gfm: true, breaks: true, async: false });
  const restored = markdown
    .replace(new RegExp(`${MARK}(\\d+)${MARK}`, 'g'), (_, i) => maths[Number(i)])
    .replace(new RegExp(`${WIKI}(\\d+)${WIKI}`, 'g'), (_, i) => {
      const { target, display } = links[Number(i)];
      const missing = wiki && !wiki.exists(target);
      return `<a class="wikilink nodrag${missing ? ' wikilink-missing' : ''}" role="link" tabindex="0" data-target="${escapeHtml(target)}" title="${
        missing ? `No tile called &quot;${escapeHtml(target)}&quot;` : `Open ${escapeHtml(target)}`
      }">${escapeHtml(display || target)}</a>`;
    });
  return DOMPurify.sanitize(restored.split(ESCAPED).join('$'));
}

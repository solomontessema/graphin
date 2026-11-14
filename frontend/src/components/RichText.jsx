import { useMemo } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import katex from 'katex';
import 'katex/dist/katex.min.css';

// Links in a note open in a new tab. Set once for every note.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

// Maths as in TexText: $$...$$ on its own line, $...$ inline. A dollar sign followed by a space is plain text.
const MATH = /\$\$([\s\S]+?)\$\$|(?<!\\)\$(?![\s$])([^$\n]+?)(?<![\s\\])\$/g;
// Placeholders, chosen so no Markdown or text uses them: one for \$, and one around each piece of maths.
const ESCAPED = '\u0002';
const MARK = '\u0003';

/**
 * Renders a note, a label or a shape's text as Markdown (headings, lists, bold, italic, links, code, quotes) with LaTeX
 * maths. The maths is set aside before the Markdown is read and put back afterwards, so the two do not interfere. The
 * result is cleaned before it is shown, so a note cannot run scripts or load anything hidden.
 */
export default function RichText({ text, className }) {
  const html = useMemo(() => render(text), [text]);
  return <div className={`rich${className ? ` ${className}` : ''}`} dangerouslySetInnerHTML={{ __html: html }} />;
}

function render(text) {
  if (!text) return '';
  const maths = [];
  const source = text.replace(/\\\$/g, ESCAPED).replace(MATH, (_, display, inline) => {
    const isDisplay = display !== undefined;
    // Invalid maths is shown as its red source rather than breaking the tile.
    maths.push(katex.renderToString(isDisplay ? display : inline, { displayMode: isDisplay, throwOnError: false, output: 'html' }));
    return `${MARK}${maths.length - 1}${MARK}`;
  });
  const markdown = marked.parse(source, { gfm: true, breaks: true, async: false });
  const withMaths = markdown.replace(new RegExp(`${MARK}(\\d+)${MARK}`, 'g'), (_, i) => maths[Number(i)]);
  return DOMPurify.sanitize(withMaths.split(ESCAPED).join('$'));
}

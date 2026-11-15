import katex from 'katex';
import 'katex/dist/katex.min.css';
import { WikiLink, wikiPattern } from './wikilinks.jsx';

// Maths in a note or a title: $$...$$ is shown on its own line, $...$ inside the text. A dollar sign followed by a space,
// or written as \$, stays a plain dollar sign, so prices such as "$5 and $10" are left alone.
const MATH = /\$\$([\s\S]+?)\$\$|(?<!\\)\$(?![\s$])([^$\n]+?)(?<![\s\\])\$/;
// One pass finds both kinds: wiki links (groups 1 to 3) and maths (groups 4 and 5).
const TOKEN = new RegExp(`${wikiPattern().source}|${MATH.source}`, 'g');
// A placeholder for \$ while the text is split, so an escaped dollar sign is never read as the start of maths.
const ESCAPED = '\u0001';

function render(tex, display) {
  // Invalid maths is shown as the red source rather than breaking the tile.
  return katex.renderToString(tex, { displayMode: display, throwOnError: false, output: 'html' });
}

/**
 * Text as written, with any LaTeX in it drawn as maths and any [[wiki link]] shown as a link to that tile. The text itself
 * is shown as plain text, so nothing in it is read as HTML; only the maths is drawn by KaTeX.
 */
export default function TexText({ text, className }) {
  if (!text) return null;
  const parts = [];
  const source = text.replace(/\\\$/g, ESCAPED);
  let last = 0;
  for (const match of source.matchAll(TOKEN)) {
    if (match.index > last) parts.push({ plain: source.slice(last, match.index) });
    if (match[1] !== undefined) {
      parts.push({ wiki: { target: match[1], display: match[3] || '' } });
    } else {
      const display = match[4] !== undefined;
      parts.push({ tex: display ? match[4] : match[5], display });
    }
    last = match.index + match[0].length;
  }
  if (last < source.length) parts.push({ plain: source.slice(last) });

  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (part.wiki) return <WikiLink key={i} target={part.wiki.target} display={part.wiki.display} />;
        if (part.tex !== undefined) {
          return <span key={i} className={part.display ? 'tex-display' : undefined} dangerouslySetInnerHTML={{ __html: render(part.tex, part.display) }} />;
        }
        return <span key={i}>{part.plain.split(ESCAPED).join('$')}</span>;
      })}
    </span>
  );
}

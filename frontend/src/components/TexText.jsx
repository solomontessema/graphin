import katex from 'katex';
import 'katex/dist/katex.min.css';

// Maths in a note or a title: $$...$$ is shown on its own line, $...$ inside the text. A dollar sign followed by a space,
// or written as \$, stays a plain dollar sign, so prices such as "$5 and $10" are left alone.
const MATH = /\$\$([\s\S]+?)\$\$|(?<!\\)\$(?![\s$])([^$\n]+?)(?<![\s\\])\$/g;
// A placeholder for \$ while the text is split, so an escaped dollar sign is never read as the start of maths.
const ESCAPED = '\u0001';

function render(tex, display) {
  // Invalid maths is shown as the red source rather than breaking the tile.
  return katex.renderToString(tex, { displayMode: display, throwOnError: false, output: 'html' });
}

/**
 * Text as written, with any LaTeX in it drawn as maths. The text itself is shown as plain text, so nothing in it is read as
 * HTML; only the maths is drawn by KaTeX.
 */
export default function TexText({ text, className }) {
  if (!text) return null;
  const parts = [];
  const source = text.replace(/\\\$/g, ESCAPED);
  let last = 0;
  for (const match of source.matchAll(MATH)) {
    if (match.index > last) parts.push({ plain: source.slice(last, match.index) });
    const display = match[1] !== undefined;
    parts.push({ tex: display ? match[1] : match[2], display });
    last = match.index + match[0].length;
  }
  if (last < source.length) parts.push({ plain: source.slice(last) });

  return (
    <span className={className}>
      {parts.map((part, i) =>
        part.tex !== undefined ? (
          <span key={i} className={part.display ? 'tex-display' : undefined} dangerouslySetInnerHTML={{ __html: render(part.tex, part.display) }} />
        ) : (
          <span key={i}>{part.plain.split(ESCAPED).join('$')}</span>
        )
      )}
    </span>
  );
}

import { createContext, useContext, useEffect, useRef, useState } from 'react';

/**
 * Wiki links in a tile's title or notes: [[Target tile | relationship | text to show]]. The relationship and the text to show
 * are optional. The server makes the arrow when a relationship is written (see src/WikiLinks.php); the page shows the link:
 * hover it to preview the target tile, click it to open that tile.
 *
 * A function, because a global pattern remembers where it last matched.
 */
export const wikiPattern = () => /\[\[([^\[\]|]+?)\s*(?:\|\s*([^\[\]|]*?)\s*)?(?:\|\s*([^\[\]]*?)\s*)?\]\]/g;

/**
 * What the views need from the network to work with wiki links. NetworkView provides the real one.
 *   exists(target)               is there a tile with this title (or id)?
 *   open(target)                 open that tile, in the maximized view
 *   preview(target, element)     show that tile beside the element
 *   hide()                       close the preview shortly
 *   suggest(typed, exceptId)     the titles of the tiles that begin with what has been typed, to offer while writing a link
 */
export const WikiContext = createContext({
  exists: () => true,
  open: () => {},
  preview: () => {},
  hide: () => {},
  suggest: () => [],
});

export const useWiki = () => useContext(WikiContext);

/** A wiki link written as a React element, for text that is not Markdown (titles). */
export function WikiLink({ target, display }) {
  const wiki = useWiki();
  const missing = !wiki.exists(target);
  return (
    <a
      className={`wikilink nodrag${missing ? ' wikilink-missing' : ''}`}
      role="link"
      tabIndex={0}
      title={missing ? `No tile called "${target}"` : `Open ${target}`}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        wiki.open(target);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') wiki.open(target);
      }}
      onMouseEnter={(event) => wiki.preview(target, event.currentTarget)}
      onMouseLeave={wiki.hide}
      onFocus={(event) => wiki.preview(target, event.currentTarget)}
      onBlur={wiki.hide}
    >
      {display || target}
    </a>
  );
}

/**
 * The part of a wiki link typed so far: the text after the last "[[" before the caret, as long as that link has no "|" or
 * "]]" yet and is on one line. Null when the caret is not in the target part of a link.
 */
function targetTypedAt(text, caret) {
  const before = text.slice(0, caret);
  const start = before.lastIndexOf('[[');
  if (start < 0) return null;
  const typed = before.slice(start + 2);
  return /[\]|\n]/.test(typed) ? null : typed;
}

/**
 * True while a wiki link is being written: the caret is inside a link and what was typed last is not a "|" or ",". Those two
 * mark a part of the link as finished, so they (and leaving the link) are when its arrow may be made or removed. Until then the
 * label may be half typed.
 */
function writingLinkAt(text, caret) {
  const before = text.slice(0, caret);
  const start = before.lastIndexOf('[[');
  if (start < 0) return false;
  const inside = before.slice(start + 2);
  if (inside.includes(']]') || inside.includes('\n')) return false;
  return !/[|,]$/.test(inside);
}

/**
 * A text box or a text area (as="input" or the default "textarea") that helps write wiki links. After "[[" it lists the tiles
 * whose titles begin with what has been typed, narrowing as more is typed. Clicking a title, or pressing Enter or Tab on
 * the highlighted one, types it, closes the link, and leaves the caret before the "]]" so a relationship can follow after "|".
 * The arrow keys move through the list and Escape closes it.
 *
 * value is the text and onValue(text) receives each change; other props go to the box. exceptId is a tile to leave out of the
 * list (the tile being written, which cannot link to itself). onWriting(true or false), when given, says whether a link is being
 * written right now (see writingLinkAt), so a save can wait before the arrows are made or removed.
 */
export function WikiField({ as: Tag = 'textarea', value, onValue, exceptId, onKeyDown, onBlur, onFocus, onWriting, ...rest }) {
  const wiki = useWiki();
  const field = useRef(null);
  const chosen = useRef(false);
  const [caret, setCaret] = useState(0);
  const [picked, setPicked] = useState(0);
  const [hidden, setHidden] = useState(false);

  const text = value ?? '';
  const typed = targetTypedAt(text, caret);
  const options = typed === null ? [] : wiki.suggest(typed, exceptId);
  // Once the whole title has been typed and it is the only match, there is nothing left to offer.
  const complete = options.length === 1 && options[0].trim().toLowerCase() === typed?.trim().toLowerCase();
  const open = options.length > 0 && !hidden && !complete;

  // A new list starts at the top and shows again, except straight after one was chosen.
  useEffect(() => {
    setPicked(0);
    if (chosen.current) {
      chosen.current = false;
      setHidden(true);
    } else {
      setHidden(false);
    }
  }, [typed]);

  // Tells the owner when a link starts or stops being written.
  const writing = writingLinkAt(text, caret);
  useEffect(() => {
    onWriting?.(writing);
  }, [writing]);

  const track = (event) => setCaret(event.target.selectionStart ?? 0);

  function choose(title) {
    const start = text.slice(0, caret).lastIndexOf('[[') + 2;
    const after = text.slice(caret);
    const position = start + title.length;
    chosen.current = true;
    onValue(text.slice(0, start) + title + (after.startsWith(']]') ? '' : ']]') + after);
    setCaret(position);
    requestAnimationFrame(() => {
      field.current?.focus();
      field.current?.setSelectionRange(position, position);
    });
  }

  function keys(event) {
    if (open) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setPicked((i) => (i + 1) % options.length);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setPicked((i) => (i - 1 + options.length) % options.length);
        return;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        choose(options[picked]);
        return;
      }
      if (event.key === 'Escape') {
        // Closes the list only, not the card or the editor around it.
        event.preventDefault();
        event.stopPropagation();
        setHidden(true);
        return;
      }
    }
    onKeyDown?.(event);
  }

  return (
    <div className="wiki-field">
      <Tag
        ref={field}
        {...rest}
        value={text}
        onChange={(event) => {
          onValue(event.target.value);
          track(event);
        }}
        onKeyUp={track}
        onClick={track}
        onSelect={track}
        onKeyDown={keys}
        onFocus={(event) => {
          // Coming back to the box: say again whether the caret is in a link.
          const at = event.target.selectionStart ?? 0;
          setCaret(at);
          onWriting?.(writingLinkAt(event.target.value, at));
          onFocus?.(event);
        }}
        onBlur={(event) => {
          // Leaving the box ends any link being written.
          onWriting?.(false);
          onBlur?.(event);
        }}
      />
      {open && (
        <ul className="wiki-menu" role="listbox" aria-label="Tiles to link to">
          {options.map((title, i) => (
            <li
              key={title}
              role="option"
              aria-selected={i === picked}
              className={i === picked ? 'is-picked' : undefined}
              // Pressing on the list must not take the focus away from the box, or the box would close the list first.
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setPicked(i)}
              onClick={() => choose(title)}
            >
              {title}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

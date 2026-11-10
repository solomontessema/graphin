import { useEffect, useId, useRef, useState } from 'react';
import { normalizeTag, tagColour } from '../tags.js';

/**
 * The tags of one tile or link: its tags as coloured chips with a remove button, and a box to add more. Type a tag and
 * press Enter or comma to add it; tags already used in the graph are offered as you type. Backspace in an empty box
 * removes the last tag. Every change is passed to onChange as the whole new list.
 *
 * tags: the item's tags. known: every tag in the graph. colours: the colours chosen for tags.
 */
export default function TagEditor({ tags, known, colours, onChange }) {
  const [text, setText] = useState('');
  const listId = useId();
  // The newest list, so two tags added in quick succession do not overwrite each other while the first is saving.
  const latest = useRef(tags);
  useEffect(() => {
    latest.current = tags;
  }, [tags]);

  function change(next) {
    latest.current = next;
    onChange(next);
  }

  function add(raw) {
    const incoming = raw.split(',').map(normalizeTag).filter(Boolean);
    const next = [...latest.current];
    for (const tag of incoming) if (!next.includes(tag)) next.push(tag);
    setText('');
    if (next.length !== latest.current.length) change(next);
  }

  return (
    <div className="tag-editor">
      <div className="tag-chips">
        {tags.map((tag) => (
          <span key={tag} className="tag-chip" style={{ '--tag': tagColour(tag, colours) }}>
            {tag}
            <button type="button" onClick={() => change(latest.current.filter((t) => t !== tag))} aria-label={`Remove the tag ${tag}`}>
              ×
            </button>
          </span>
        ))}
        <input
          value={text}
          list={listId}
          maxLength={40}
          placeholder={tags.length === 0 ? 'Add a tag, for example trust' : 'Add another'}
          aria-label="Add a tag"
          onChange={(e) => {
            // A comma ends a tag.
            if (e.target.value.includes(',')) add(e.target.value);
            else setText(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (text.trim()) add(text);
            } else if (e.key === 'Backspace' && text === '' && latest.current.length > 0) {
              change(latest.current.slice(0, -1));
            }
          }}
          onBlur={() => text.trim() && add(text)}
        />
        <datalist id={listId}>
          {known
            .filter((t) => !tags.includes(t))
            .map((t) => (
              <option key={t} value={t} />
            ))}
        </datalist>
      </div>
    </div>
  );
}

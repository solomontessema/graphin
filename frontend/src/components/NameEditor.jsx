import { useEffect, useRef, useState } from 'react';

/**
 * A text box for renaming a network, shown in place of its name. Enter or leaving the box saves the new name, and Esc
 * keeps the old one. An empty or unchanged name is not saved.
 */
export default function NameEditor({ name, onSave, onCancel, className }) {
  const [value, setValue] = useState(name);
  const input = useRef(null);
  const finished = useRef(false);

  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);

  function commit() {
    if (finished.current) return;
    finished.current = true;
    const next = value.trim();
    if (!next || next === name) onCancel();
    else onSave(next);
  }

  function cancel() {
    finished.current = true;
    onCancel();
  }

  return (
    <input
      ref={input}
      className={`name-editor ${className || ''}`}
      value={value}
      maxLength={255}
      aria-label="Network name"
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
        else if (e.key === 'Escape') cancel();
      }}
    />
  );
}

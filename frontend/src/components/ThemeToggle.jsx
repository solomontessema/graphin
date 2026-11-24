import { useState } from 'react';
import { THEMES, getTheme, setTheme } from '../theme.js';

/** A button that steps through Auto (the system's choice), Light and Dark. */
export default function ThemeToggle() {
  const [theme, setCurrent] = useState(getTheme);
  function next() {
    const t = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
    setTheme(t);
    setCurrent(t);
  }
  return (
    <button className="ghost theme-toggle" onClick={next} title="Colour theme: Auto follows your system. Click to change.">
      Theme: {theme}
    </button>
  );
}

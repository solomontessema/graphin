// The colour theme: 'auto' follows the system (the page's own default is dark), or 'light' / 'dark' is chosen.
// The choice is kept in this browser and written on the page as data-theme, which the styles read.

const KEY = 'graphin:theme';
export const THEMES = ['auto', 'light', 'dark'];

export function getTheme() {
  try {
    const t = window.localStorage.getItem(KEY);
    return THEMES.includes(t) ? t : 'auto';
  } catch {
    return 'auto';
  }
}

export function setTheme(theme) {
  if (theme === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', theme);
  try {
    window.localStorage.setItem(KEY, theme);
  } catch {
    // Remembering the choice is a convenience only.
  }
}

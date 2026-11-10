import { useRef } from 'react';

/**
 * Returns a click handler that runs action on a second click made soon after the first. React Flow does not pass
 * native double-clicks on its nodes through, so the pair of clicks is counted here instead.
 */
export function useDoubleClick(action) {
  const lastClick = useRef(0);
  return () => {
    const now = Date.now();
    if (now - lastClick.current < 400) {
      lastClick.current = 0;
      action();
    } else {
      lastClick.current = now;
    }
  };
}

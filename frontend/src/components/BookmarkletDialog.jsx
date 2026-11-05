import { useEffect, useRef, useState } from 'react';
import { bookmarkletCode } from '../utils.js';

/**
 * Shows the bookmarklet. Drag the "Save to Graphin" link to the bookmarks bar once. After that,
 * clicking it on any page saves that page (and any text you highlighted) to Graphin.
 */
export default function BookmarkletDialog({ onClose }) {
  const linkRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const code = bookmarkletCode(window.location.origin);

  // Set the href by hand. React warns about javascript: URLs passed as props.
  useEffect(() => {
    linkRef.current?.setAttribute('href', code);
  }, [code]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="dialog" onMouseDown={(e) => e.stopPropagation()}>
        <h2>Save from any browser</h2>
        <p>
          Drag this button to your bookmarks bar in Edge or Chrome. On any page, click it to save the page to
          Graphin. Highlight a passage first, and it is saved as the commentary.
        </p>
        <p className="bookmarklet-row">
          <a ref={linkRef} className="bookmarklet" href="#" onClick={(e) => e.preventDefault()}>
            Save to Graphin
          </a>
        </p>
        <p className="muted small">
          Bookmarklets run on the page you are on, so they work in Edge and Chrome without installing anything.
        </p>
        <div className="form-row end">
          <button type="button" className="ghost" onClick={copy}>
            {copied ? 'Copied' : 'Copy code'}
          </button>
          <button type="button" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

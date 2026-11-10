import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { youtubeEmbedUrl } from '../utils.js';

// Whether each address may be framed, remembered for the rest of the session. Checked once per address.
const framable = new Map();

/**
 * Whether a page may be shown inside another page: true or false once checked, null while the check runs.
 * A null url gives null.
 */
export function useFramable(url) {
  const check = url ? youtubeEmbedUrl(url) || url : null;
  const [allowed, setAllowed] = useState(() => (check ? framable.get(check) ?? null : null));

  useEffect(() => {
    if (!check) {
      setAllowed(null);
      return undefined;
    }
    if (framable.has(check)) {
      setAllowed(framable.get(check));
      return undefined;
    }
    let live = true;
    api
      .embeddable(check)
      .then((r) => {
        framable.set(check, r.embeddable);
        if (live) setAllowed(r.embeddable);
      })
      .catch(() => framable.set(check, false));
    return () => {
      live = false;
    };
  }, [check]);

  return allowed;
}

/** A page shown inside a window, for a page that allows it. Pages that do not are not shown here. */
export default function PageView({ url, title, className }) {
  return (
    <iframe
      className={className}
      src={youtubeEmbedUrl(url) || url}
      title={title}
      referrerPolicy="strict-origin-when-cross-origin"
      allow="fullscreen; autoplay; encrypted-media; picture-in-picture"
      allowFullScreen
    />
  );
}

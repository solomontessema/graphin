/** The host of a link without "www.", or the raw text when it is not a valid link. */
export function hostFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/** The http or https link in the text, or null. Used for dropped and pasted text. */
export function asHttpUrl(text) {
  const value = (text || '').trim();
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

/** An embeddable YouTube player address for a watch or short link, or null. */
export function youtubeEmbedUrl(url) {
  const match = url.match(/(?:youtube\.com\/watch\?(?:.*&)?v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]{11})/);
  return match ? `https://www.youtube.com/embed/${match[1]}` : null;
}

/** The still picture YouTube publishes for a video, or null when the link is not a YouTube video. */
export function youtubeThumbUrl(url) {
  const match = url.match(/(?:youtube\.com\/watch\?(?:.*&)?v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]{11})/);
  return match ? `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg` : null;
}

/**
 * The bookmarklet: run on any page, it opens Graphin's capture window with the page's
 * address, title, highlighted text, thumbnail (og:image), and favicon. folder is Graphin's address, ending in "/".
 * Written without "#" or "%" so it survives being stored as a bookmark.
 */
export function bookmarkletCode(folder) {
  return (
    'javascript:(function(){' +
    'var s=String(window.getSelection()).trim().slice(0,5000);' +
    'var m=document.querySelector(\'meta[property="og:image"]\');' +
    'var i=document.querySelector(\'link[rel~="icon"]\');' +
    'var q=new URLSearchParams({url:location.href,title:document.title,commentary:s});' +
    'try{if(m&&m.content)q.set("thumbnail_url",new URL(m.content,location.href).href);}catch(e){}' +
    'try{if(i&&i.href)q.set("favicon_url",i.href);}catch(e){}' +
    `var u="${folder}index.html?capture=1&"+q.toString();` +
    // Browsers often block a pop-up that a bookmark opens. If that happens, open the capture form
    // in the current tab instead, so the save still works.
    'if(!window.open(u,"graphin","width=560,height=680")){location.href=u;}' +
    '})();'
  );
}

/**
 * CSS variables for a node's appearance. prefix is "node"; the stylesheet falls back to the default look for any
 * variable that is not set.
 */
export function appearanceVars(style, prefix) {
  const vars = {};
  if (!style) return vars;
  if (style.fill) vars[`--${prefix}-fill`] = style.fill;
  // The text colour: the user's choice when set, otherwise chosen to contrast with the background.
  const text = style.text || (style.fill ? readableText(style.fill) : null);
  if (text) vars[`--${prefix}-text`] = text;
  if (style.stroke) vars[`--${prefix}-frame`] = style.stroke;
  if (style.width !== undefined) vars[`--${prefix}-frame-w`] = `${style.width}px`;
  return vars;
}

/**
 * Black or white text, whichever reads better on the given background colour (#rrggbb). Uses the WCAG
 * contrast ratio, so the choice follows how bright the colour actually looks.
 */
export function readableText(hex) {
  const channel = (i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  const againstWhite = 1.05 / (luminance + 0.05);
  const againstDark = (luminance + 0.05) / (0.0086 + 0.05); // #111827, the dark text colour
  return againstWhite >= againstDark ? '#ffffff' : '#111827';
}

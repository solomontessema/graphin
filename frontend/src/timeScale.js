// Time on the time slider. A time is a number of years: 1945 is 1945, and -300000 is 300,000 years before the
// common era. A scale decides how the slider's length is shared out between times.
//
//   linear       every step of the slider is the same number of years.
//   logarithmic  recent times get more room: each step multiplies the years back from the latest time.
//   exponential  older times get more room: each step multiplies the years since the earliest time.

export const TIME_SCALES = [
  { id: 'linear', label: 'Linear', hint: 'Equal years along the slider.' },
  { id: 'logarithmic', label: 'Logarithmic', hint: 'More room for recent times.' },
  { id: 'exponential', label: 'Exponential', hint: 'More room for older times.' },
];

/** The year a stored time means, or null when it has none: "1945-08-06" is 1945.6, "-300000" is -300000. */
export function parseYear(text) {
  if (!text) return null;
  const match = /^(-?\d{1,9})(?:-(\d{2}))?(?:-(\d{2}))?/.exec(text);
  if (!match) return null;
  const year = Number(match[1]);
  // A month and day only count for ordinary four-digit years.
  if (/^\d{4}-/.test(text)) return year + (Number(match[2] || 1) - 1) / 12 + (Number(match[3] || 1) - 1) / 365;
  return year;
}

/** The slider position, from 0 (earliest) to 1 (latest), of a year on a scale over [min, max]. */
export function toPosition(scale, year, min, max) {
  const span = max - min;
  if (span <= 0) return 0;
  const t = Math.min(Math.max(year, min), max);
  if (scale === 'logarithmic') return 1 - Math.log1p(max - t) / Math.log1p(span);
  if (scale === 'exponential') return Math.log1p(t - min) / Math.log1p(span);
  return (t - min) / span;
}

/** The year at a slider position: the opposite of toPosition. */
export function toYear(scale, position, min, max) {
  const span = max - min;
  if (scale === 'logarithmic') return max - (Math.exp((1 - position) * Math.log1p(span)) - 1);
  if (scale === 'exponential') return min + (Math.exp(position * Math.log1p(span)) - 1);
  return min + position * span;
}

const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

/** A year for reading: "1945", "44 BCE", or "300,000 years ago" for the far past. */
export function formatYear(year) {
  const y = Math.round(year);
  if (y <= -10000) {
    const ago = -y;
    return ago >= 1_000_000 ? `${(ago / 1_000_000).toFixed(ago >= 10_000_000 ? 0 : 1).replace(/\.0$/, '')} million years ago` : `${number.format(Math.round(ago / 100) * 100)} years ago`;
  }
  return y < 0 ? `${number.format(-y)} BCE` : `${y}`;
}

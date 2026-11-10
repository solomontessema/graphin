import { useState } from 'react';
import { TIME_SCALES, formatYear, toPosition, toYear } from '../timeScale.js';

const STEPS = 1000;
// The slider's thumbs are this many pixels across, so their centres run half of that in from each end of the track.
const THUMB = 18;

// Where a position from 0 (past) to 1 (present) is on the track, measured from its top: the present is at the top.
const topOf = (position) => `calc(${THUMB / 2}px + ${1 - position} * (100% - ${THUMB}px))`;

/**
 * The time slider: a slim vertical track down the left of the canvas, with the present at the top and the past at the
 * bottom. Two handles choose a range of time, and the year each stands at is written beside it. Items dated outside the
 * range are hidden, and items with no date always stay. The gear opens the rest: the scale, which decides how the
 * track's length is shared out between times, All, and closing the slider.
 *
 * years: the year of every dated item. range: [from, to], each from 0 (past) to 1 (present) along the slider.
 */
export default function TimeBar({ years, scale, onScale, range, onRange, onClose }) {
  const [menu, setMenu] = useState(false);
  const min = Math.min(...years);
  const max = Math.max(...years);
  const [from, to] = range;
  const full = from <= 0 && to >= 1;
  const inside = years.filter((y) => {
    const p = toPosition(scale, y, min, max);
    return p >= from - 1e-9 && p <= to + 1e-9;
  }).length;

  const setFrom = (value) => onRange([Math.min(value / STEPS, to), to]);
  const setTo = (value) => onRange([from, Math.max(value / STEPS, from)]);

  return (
    <div className="time-bar" title={`${inside} of ${years.length} dated items shown`}>
      <button className="ghost time-gear" onClick={() => setMenu(!menu)} aria-label="Time slider settings" aria-expanded={menu} title="Time slider settings">
        ⚙
      </button>

      {menu && (
        <div className="time-menu">
          <strong>Time</strong>
          <label>
            Scale
            <select value={scale} onChange={(e) => onScale(e.target.value)} title={TIME_SCALES.find((s) => s.id === scale)?.hint}>
              {TIME_SCALES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <span className="muted">
            {inside} of {years.length} dated
          </span>
          <div className="form-row">
            <button className="ghost" onClick={() => onRange([0, 1])} disabled={full}>
              All
            </button>
            <button className="ghost" onClick={onClose} title="Close the time slider and show everything">
              Close slider
            </button>
          </div>
        </div>
      )}

      <div className="time-track">
        <div className="time-fill" style={{ top: topOf(to), height: `calc(${to - from} * (100% - ${THUMB}px))` }} />
        {years.map((y, i) => (
          <i key={i} className="time-tick" style={{ top: topOf(toPosition(scale, y, min, max)) }} />
        ))}
        <input type="range" min="0" max={STEPS} value={Math.round(from * STEPS)} onChange={(e) => setFrom(Number(e.target.value))} aria-label="From" />
        <input type="range" min="0" max={STEPS} value={Math.round(to * STEPS)} onChange={(e) => setTo(Number(e.target.value))} aria-label="To" />
        <span className="time-label" style={{ top: topOf(to) }}>
          {formatYear(toYear(scale, to, min, max))}
        </span>
        <span className="time-label" style={{ top: topOf(from) }}>
          {formatYear(toYear(scale, from, min, max))}
        </span>
      </div>
    </div>
  );
}

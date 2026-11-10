import { memo, useEffect, useState } from 'react';
import { MAP_HEIGHT, MAP_WIDTH, WORLD_PATH } from '../worldMap.js';
import satellite from '../assets/maps/satellite.jpg';
import topographic from '../assets/maps/topographic.jpg';

const SCALE = MAP_WIDTH / 360;
const LATITUDES = [-60, -30, 0, 30, 60];
const LONGITUDES = [-120, -60, 0, 60, 120];

// Colours of the countries on the political map. Neighbouring countries always have different numbers.
const COUNTRY_COLOURS = ['#f6d58e', '#b8d8a0', '#f2b5b5', '#a9cfe8', '#d9bfe6'];

// The map types drawn from a picture. The picture covers the whole world in the same projection as the vector maps.
const PICTURES = { satellite, topographic };

// The countries are loaded the first time a political map is shown, so the map code in every other case stays small.
function useCountries(wanted) {
  const [countries, setCountries] = useState(null);
  useEffect(() => {
    if (!wanted || countries) return;
    let live = true;
    import('../worldCountries.js').then((m) => live && setCountries(m.COUNTRIES));
    return () => {
      live = false;
    };
  }, [wanted, countries]);
  return countries;
}

// The world behind the canvas in the Geo layout. It is not saved with the network and cannot be selected or moved.
function MapNode({ data }) {
  const pins = data?.pins ?? [];
  const type = data?.mapType ?? 'geographic';
  const picture = PICTURES[type];
  const countries = useCountries(type === 'political');

  return (
    <svg className={`world-map map-${type}`} width={MAP_WIDTH} height={MAP_HEIGHT} viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} aria-label={`World map, ${type}`}>
      <rect width={MAP_WIDTH} height={MAP_HEIGHT} className="world-sea" />
      {picture && <image href={picture} width={MAP_WIDTH} height={MAP_HEIGHT} preserveAspectRatio="none" />}
      {LATITUDES.map((lat) => (
        <line key={`lat${lat}`} x1="0" x2={MAP_WIDTH} y1={(90 - lat) * SCALE} y2={(90 - lat) * SCALE} className={lat === 0 ? 'world-equator' : 'world-grid'} />
      ))}
      {LONGITUDES.map((lon) => (
        <line key={`lon${lon}`} y1="0" y2={MAP_HEIGHT} x1={(lon + 180) * SCALE} x2={(lon + 180) * SCALE} className={lon === 0 ? 'world-equator' : 'world-grid'} />
      ))}
      {!picture && type !== 'political' && <path d={WORLD_PATH} className="world-land" />}
      {type === 'political' && (
        <>
          {/* Until the countries have loaded, the land shows in one colour. */}
          {!countries && <path d={WORLD_PATH} className="world-land" />}
          {countries?.map((c) => (
            <path key={c.n} d={c.d} className="world-country" fill={COUNTRY_COLOURS[c.c % COUNTRY_COLOURS.length]} />
          ))}
          {countries
            ?.filter((c) => c.s)
            .map((c) => (
              <text key={c.n} x={c.x} y={c.y} fontSize={c.s} className="world-label">
                {c.n}
              </text>
            ))}
        </>
      )}
      {pins.map((p) => {
        const x = (p.lon + 180) * SCALE;
        const y = (90 - p.lat) * SCALE;
        return (
          <g key={p.id}>
            <line x1={x} y1={y} x2={p.cx} y2={p.cy} stroke={p.color} className="world-pin-line" />
            <circle cx={x} cy={y} r="30" fill={p.color} className="world-pin" />
          </g>
        );
      })}
    </svg>
  );
}

export default memo(MapNode);

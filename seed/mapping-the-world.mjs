// Builds a small sample network, "How we learned to map the world", through the Graphin API. 13 tiles that mix pictures,
// videos, Wikipedia articles and web pages that can be previewed in place. Notes carry Markdown links and [[wiki links]];
// some tile pairs are joined by two or three different relationships, and several tiles have more than one reference.
//
//   GRAPHIN_EMAIL=you@example.com GRAPHIN_PASSWORD=secret node seed/mapping-the-world.mjs https://graphin.org/index.php
//   node seed/mapping-the-world.mjs                       (local: http://localhost:8100)
//
// Try: hover a link for a preview, open a tile (maximize), Layout > Timeline, Map on, Tags.
// Run it once: if the network already exists, it stops.

import { login } from './login.mjs';

const BASE = process.argv[2] || 'http://localhost:8100';
const SITE = BASE.replace(/\/index\.php$/, '');
const NAME = 'How we learned to map the world';
const W = 'https://en.wikipedia.org/wiki/';
const IMG = 'https://upload.wikimedia.org/wikipedia/commons/';
const YT = (id) => `https://www.youtube.com/watch?v=${id}`;

// Tiles. `url` is the main link (a picture or video shows on the tile); `refs` are more links. Positions are x, y.
const NODES = [
  { key: 'eratosthenes', title: 'Eratosthenes measures the Earth', time: '-240', lat: 31.2, lon: 29.9, country: 'Egypt', tags: ['idea', 'ancient'],
    url: IMG + '9/98/Eratosthenes.png', x: 0, y: 0,
    text: `Around 240 BCE the librarian of Alexandria compared the noon shadow in his city with a well at Syene, where the Sun shone straight down. The angle gave him the Earth's size, within a few percent. Try it yourself in the [interactive experiment](https://javalab.org/en/measuring_the_earth_en/). Later mapmakers, starting with [[Ptolemy's Geography | INFLUENCES | Ptolemy]], built on this idea of a round, measurable world.`,
    refs: [{ url: W + 'Eratosthenes', title: 'Eratosthenes (Wikipedia)' }, { url: 'https://javalab.org/en/measuring_the_earth_en/', title: 'Measuring the Earth: an experiment' }] },
  { key: 'ptolemy', title: "Ptolemy's Geography", time: '150', lat: 31.2, lon: 29.9, country: 'Egypt', tags: ['idea', 'ancient', 'map'],
    url: IMG + 'thumb/4/4e/1482_Ulm_Ptolemy_World_Map.jpg/1280px-1482_Ulm_Ptolemy_World_Map.jpg', x: 520, y: 0,
    text: `Ptolemy gave places a **latitude and longitude** and showed how to draw a round world on a flat page. His book was lost to Western Europe for centuries. It came back in the 1400s, and this printed map from Ulm (1482) is one of the first. It still put the Indian Ocean as a closed lake.`,
    refs: [{ url: W + 'Geography_(Ptolemy)', title: 'Geography (Ptolemy)' }, { url: W + 'Ptolemy', title: 'Ptolemy' }] },
  { key: 'idrisi', title: "Al-Idrisi's world map", time: '1154', lat: 38.1, lon: 13.4, country: 'Italy', tags: ['map', 'medieval'],
    url: W + 'Tabula_Rogeriana', x: 1040, y: 0,
    text: `Working at the court of King Roger II of Sicily, the geographer Muhammad al-Idrisi drew the world in 1154 from travellers' reports. His map has south at the top. For centuries it was the most accurate view of Africa, Asia and Europe together. The same Islamic scholars refined the [astrolabe](https://en.wikipedia.org/wiki/Astrolabe), a tool that helped travellers find their position by the stars.`,
    refs: [{ url: W + 'Muhammad_al-Idrisi', title: 'Muhammad al-Idrisi' }, { url: IMG + '1/18/Astrolabe-Persian-18C.jpg', title: 'A Persian astrolabe, 18th century' }] },
  { key: 'astrolabe', title: 'The astrolabe: a map of the sky', time: '800', lat: 33.3, lon: 44.4, country: 'Iraq', tags: ['tool', 'medieval'],
    url: IMG + '1/18/Astrolabe-Persian-18C.jpg', x: 1560, y: 0,
    text: `A brass disc with a movable dial, used to tell time, find direction and measure the height of a star above the horizon. Scholars in the Islamic world made it precise. Sailors later used simpler versions to work out their [[Longitude problem | LEADS_TO | latitude and longitude at sea]].`,
    refs: [{ url: W + 'Astrolabe', title: 'Astrolabe' }] },

  { key: 'magellan', title: 'The first voyage around the world', time: '1522', lat: 36.5, lon: -6.3, country: 'Spain', tags: ['voyage', 'exploration'],
    url: W + 'Magellan%E2%80%93Elcano_circumnavigation', x: 0, y: 420,
    text: `Five ships left Spain in 1519 under Magellan; one came back in 1522 under Elcano, with 18 of about 240 men. The trip proved the Earth could be sailed around, and it showed how big the Pacific is. It also asked a new question: if you sail west and gain a day, which day is it? Maps now needed [[Mercator 1569 | INFLUENCES | a way to show the oceans]].`,
    refs: [{ url: W + 'Ferdinand_Magellan', title: 'Ferdinand Magellan' }, { url: W + 'Juan_Sebasti%C3%A1n_Elcano', title: 'Juan Sebastián Elcano' }] },
  { key: 'mercator', title: 'Mercator 1569', time: '1569', lat: 51.2, lon: 4.4, country: 'Belgium', tags: ['map', 'idea'],
    url: IMG + 'b/b2/Mercator_1569.png', x: 520, y: 420,
    text: `Gerardus Mercator drew the world so that a **straight line on the map is a steady compass course**. That helped sailors enormously. The price is size: Greenland looks as big as Africa, though Africa is about 14 times larger. [[Why every flat map lies | EXPLAINS | A short video]] shows this in two minutes.`,
    refs: [{ url: W + 'Mercator_projection', title: 'Mercator projection' }, { url: W + 'History_of_cartography', title: 'History of cartography' }] },
  { key: 'flatmaps', title: 'Why every flat map lies', time: '', lat: null, lon: null, country: null, tags: ['idea', 'video'],
    url: YT('kIID5FDi2JQ'), x: 1040, y: 420,
    text: `You cannot flatten a sphere without stretching something. This short video explains why, and why no map is "right". It is a good place to start for a class: ask students which distortion matters for **their** purpose (navigation, area, or looks).`,
    refs: [{ url: W + 'Map_projection', title: 'Map projection' }] },
  { key: 'longitude', title: 'Longitude problem', time: '1714', lat: 51.48, lon: 0, country: 'United Kingdom', tags: ['problem', 'exploration'],
    url: W + 'Longitude_rewards', x: 1560, y: 420,
    text: `Latitude is easy to find from the Sun and stars. Longitude needs the **time at home** compared with local time, and no clock could keep time on a rocking ship. In 1714 Britain offered a large prize. Ships were lost for want of an answer. The solution was [[John Harrison's clock | LEADS_TO | a watch that held steady at sea]].`,
    refs: [{ url: W + 'Longitude_rewards', title: 'Longitude rewards' }] },

  { key: 'harrison', title: "John Harrison's clock", time: '1761', lat: 51.48, lon: 0, country: 'United Kingdom', tags: ['tool', 'exploration'],
    url: IMG + '0/0d/Harrison_H4_chronometer.jpg', x: 0, y: 840,
    text: `Harrison, a carpenter and clockmaker, built a series of sea clocks over 30 years. His fourth, **H4**, looks like a big pocket watch. On a test voyage to Jamaica in 1761 it lost only a few seconds. [[Longitude problem | SOLVES | The problem]] was solved, after a long fight over the prize.`,
    refs: [{ url: W + 'John_Harrison', title: 'John Harrison' }, { url: 'https://www.rmg.co.uk/stories/topics/longitude-found-john-harrison', title: 'Royal Museums Greenwich: Longitude found' }] },
  { key: 'survey', title: 'Great Trigonometrical Survey', time: '1802', lat: 13.1, lon: 80.3, country: 'India', tags: ['survey', 'map'],
    url: W + 'Great_Trigonometrical_Survey', x: 520, y: 840,
    text: `Starting in 1802 a team measured India from tip to Himalaya using chains of triangles and a heavy, precise theodolite. The work fixed the height of the world's tallest mountains, and it served the British Empire's wish to govern and tax what it measured. Maps are never neutral: ask **who paid for this one, and why**.`,
    refs: [{ url: W + 'Theodolite', title: 'Theodolite' }, { url: W + 'George_Everest', title: 'George Everest' }] },
  { key: 'meridian', title: 'Agreeing where zero is', time: '1884', lat: 38.9, lon: -77.0, country: 'United States', tags: ['agreement', 'idea'],
    url: W + 'International_Meridian_Conference', x: 1040, y: 840,
    text: `In 1884 delegates from 25 countries met in Washington and chose the line through Greenwich as zero degrees. France abstained and kept its own for years. Standard **time zones** followed. [Read about the prime meridian](https://www.nationalgeographic.org/encyclopedia/prime-meridian/) and compare it with [[John Harrison's clock | USES | the clock that made it practical]].`,
    refs: [{ url: 'https://www.nationalgeographic.org/encyclopedia/prime-meridian/', title: 'National Geographic: Prime meridian' }, { url: W + 'Prime_meridian', title: 'Prime meridian' }] },
  { key: 'bluemarble', title: 'The Blue Marble', time: '1972-12', lat: 28.5, lon: -80.6, country: 'United States', tags: ['space', 'idea'],
    url: IMG + '9/97/The_Earth_seen_from_Apollo_17.jpg', x: 1560, y: 840,
    text: `On 7 December 1972 the crew of Apollo 17 photographed the whole Earth for the first time in daylight. For the first time almost everyone could **see** the world mapmakers had worked on for 2,000 years. The picture shaped the early environmental movement.`,
    refs: [{ url: W + 'Apollo_17', title: 'Apollo 17' }, { url: W + 'The_Blue_Marble', title: 'The Blue Marble' }] },

  { key: 'gps', title: 'GPS: a map in your pocket', time: '1995', lat: 38.9, lon: -77.0, country: 'United States', tags: ['tool', 'space'],
    url: YT('RSA3feQ9gKk'), x: 520, y: 1260,
    text: `Satellites broadcast the time, and your phone works out where it is by comparing signals. The system depends on the very same idea as [[John Harrison's clock | EXAMPLE_OF | Harrison's]]: knowing where you are is knowing the time. It also has to correct for Einstein's relativity to stay accurate.`,
    refs: [{ url: W + 'Global_Positioning_System', title: 'Global Positioning System' }, { url: 'https://spaceplace.nasa.gov/gps/en/', title: 'NASA Space Place: GPS' }] },
  { key: 'osm', title: 'OpenStreetMap: everyone maps', time: '2004', lat: 51.5, lon: -0.13, country: 'United Kingdom', tags: ['community', 'map'],
    url: W + 'OpenStreetMap', x: 1040, y: 1260,
    text: `Since 2004 volunteers have drawn the world's roads, rivers and buildings into one open database, anyone may use. Aid groups use it after disasters. Mapping has moved from kings and companies to everyone. A question for discussion: *who is still missing from the map, and who decides?* See also [[The Blue Marble | CONNECTS | the first whole-Earth picture]].`,
    refs: [{ url: 'https://www.openstreetmap.org/about', title: 'About OpenStreetMap' }, { url: 'https://www.hotosm.org/', title: 'Humanitarian OpenStreetMap Team' }] },
];

// Arrows that the [[wiki links]] in the notes already draw are not repeated here.
// [from, to, relationship, tags] — some pairs have two or three different relationships.
const EDGES = [
  ['ptolemy', 'idrisi', 'INFLUENCES'],
  ['idrisi', 'astrolabe', 'CITES'],
  ['ptolemy', 'mercator', 'INFLUENCES'],
  ['mercator', 'flatmaps', 'EXAMPLE_OF'],
  ['flatmaps', 'mercator', 'CRITIQUES'],
  ['harrison', 'meridian', 'INFLUENCES'],
  ['harrison', 'gps', 'INFLUENCES'],
  ['meridian', 'gps', 'LEADS_TO'],
  ['survey', 'meridian', 'RESPONDS_TO'],
  ['survey', 'flatmaps', 'CRITIQUES'],
  ['bluemarble', 'gps', 'LEADS_TO'],
  ['gps', 'osm', 'LEADS_TO'],
  ['osm', 'bluemarble', 'EXAMPLE_OF'],
  ['osm', 'bluemarble', 'CONTRASTS_WITH'],
  ['meridian', 'survey', 'COMPETES_WITH'],
  ['magellan', 'eratosthenes', 'SUPPORTS'],
];

const TAG_COLOURS = {
  idea: '#7c3aed', ancient: '#a16207', map: '#2563eb', medieval: '#be185d', tool: '#d97706', voyage: '#0e7490',
  exploration: '#15803d', problem: '#dc2626', survey: '#0369a1', agreement: '#64748b', space: '#4f46e5', community: '#65a30d', video: '#e11d48',
};

const EDGE_COLOURS = {
  SUPPORTS: '#15803d', CRITIQUES: '#e11d48', LEADS_TO: '#2563eb', INFLUENCES: '#7c3aed', RESPONDS_TO: '#0891b2', EXAMPLE_OF: '#65a30d',
  EXPLAINS: '#4f46e5', CITES: '#a16207', COMPETES_WITH: '#ea580c', CONTRASTS_WITH: '#64748b', SOLVES: '#16a34a', USES: '#0e7490', CONNECTS: '#9333ea',
};

async function call(method, path, body) {
  const response = await fetch(BASE + '/api' + path, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${method} ${path}: ${data.error || response.status}`);
  return data;
}

async function main() {
  const keys = new Set(NODES.map((n) => n.key));
  if (keys.size !== NODES.length) throw new Error('Duplicate tile key.');
  const pairs = new Set();
  for (const [from, to, rel] of EDGES) {
    if (!keys.has(from) || !keys.has(to)) throw new Error(`Unknown tile in link: ${from} -> ${to}`);
    const pair = [from, to].sort().join('|') + '|' + rel;
    if (pairs.has(pair)) throw new Error(`Same relationship twice between two tiles: ${from} ${rel} ${to}`);
    pairs.add(pair);
  }

  await login(BASE);
  const existing = await call('GET', '/networks');
  if (existing.some((n) => n.name === NAME)) {
    console.log(`"${NAME}" already exists. Delete it in Graphin first, then run this again.`);
    return;
  }
  const network = await call('POST', '/networks', { name: NAME });
  const N = `/networks/${network.id}`;
  const ids = new Map();

  for (const n of NODES) {
    const created = await call('POST', `${N}/nodes`, {
      type: 'webpage',
      url: n.url,
      title: n.title,
      commentary: n.text,
      x: n.x,
      y: n.y,
      time: n.time || undefined,
      latitude: n.lat ?? undefined,
      longitude: n.lon ?? undefined,
      country: n.country || undefined,
      tags: n.tags,
      references: n.refs,
    });
    ids.set(n.key, created.id);
  }

  for (const [from, to, relationship, tags] of EDGES) {
    await call('POST', `${N}/edges`, {
      source_id: ids.get(from),
      target_id: ids.get(to),
      relationship,
      tags,
      style: { stroke: EDGE_COLOURS[relationship] || '#7a869c' },
    });
  }
  // Wiki links draw their arrows once every tile exists: save each note again.
  for (const n of NODES) await call('PUT', `/nodes/${ids.get(n.key)}`, { commentary: n.text });
  await call('PUT', N, { tag_colors: TAG_COLOURS });

  console.log(`Created "${NAME}": ${NODES.length} tiles, ${EDGES.length} links.`);
  console.log(`Open it at ${SITE}/#/networks/${network.id}`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});

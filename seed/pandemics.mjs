// Builds the network "Pandemics: how humanity met them" through the Graphin API. It shows tags in use: every tile
// has a category tag first (outbreak, response, concept, lesson) and then coding tags, and links carry tags too.
//
//   node seed/pandemics.mjs                    (uses http://localhost:8100)
//
// Try: the Tags button (filter "vaccine", then colour by Border), Map on, the time slider, Layout > Timeline or Geo.
// Run it once: if the network already exists, it stops.

import { login } from './login.mjs';

const BASE = process.argv[2] || 'http://localhost:8100';
const NAME = 'Pandemics: how humanity met them';
const W = 'https://en.wikipedia.org/wiki/';

// Eras are columns, left to right; lanes are rows: outbreaks on top, responses in the middle, ideas at the bottom.
const ERA = { ancient: 0, medieval: 1100, early: 2200, modern: 3300, now: 4400 };
const LANE = { outbreak: 0, response: 300, concept: 620 };

// key, kind (page | note), title, era, lane, offset x, time, place, tags (first = category), commentary, references
const NODES = [
  // ---- Outbreaks
  { key: 'athens', title: 'Plague of Athens', era: 'ancient', lane: 'outbreak', dx: 0, time: '-430', lat: 37.98, lon: 23.73, country: 'Greece',
    tags: ['outbreak', 'unknown cause', 'war'], url: W + 'Plague_of_Athens',
    text: 'Thucydides described it as it struck a besieged, overcrowded city in the second year of the Peloponnesian War, killing perhaps a quarter of the population, including Pericles. The cause is still debated: typhus, typhoid and others have been proposed.',
    refs: [{ url: 'https://en.wikipedia.org/wiki/Thucydides', title: 'Thucydides, the eyewitness' }] },
  { key: 'antonine', title: 'Antonine Plague', era: 'ancient', lane: 'outbreak', dx: 520, time: '165', lat: 41.9, lon: 12.5, country: 'Italy',
    tags: ['outbreak', 'viral', 'trade'], url: W + 'Antonine_Plague',
    text: 'Brought back by legions returning from the East, probably smallpox or measles. It spread along the roads and sea lanes of the Roman Empire and weakened its army and tax base.' },
  { key: 'justinian', title: 'Plague of Justinian', era: 'medieval', lane: 'outbreak', dx: 0, time: '541', lat: 41.01, lon: 28.98, country: 'Turkey',
    tags: ['outbreak', 'bacterial', 'trade'], url: W + 'Plague_of_Justinian',
    text: 'The first recorded pandemic of Yersinia pestis, carried on grain ships to Constantinople. Ancient DNA from European graves has confirmed the bacterium.' },
  { key: 'blackdeath', title: 'The Black Death', era: 'medieval', lane: 'outbreak', dx: 560, time: '1347', lat: 38.19, lon: 15.55, country: 'Italy',
    tags: ['outbreak', 'bacterial', 'trade', 'inequality'], url: W + 'Black_Death',
    text: 'Reached Sicily by ship in 1347 and killed perhaps a third to half of Europe in five years. Labour became scarce, wages rose and the old feudal order loosened. It also set off massacres of Jews and other scapegoats.',
    refs: [{ url: 'https://en.wikipedia.org/wiki/Yersinia_pestis', title: 'The bacterium' }] },
  { key: 'smallpox-americas', title: 'Smallpox in the Americas', era: 'early', lane: 'outbreak', dx: 0, time: '1520', lat: 19.43, lon: -99.13, country: 'Mexico',
    tags: ['outbreak', 'viral', 'inequality', 'contested'], url: W + 'Columbian_exchange',
    text: 'Diseases new to the Americas killed a large share of the people there within decades of contact. How large is argued: estimates of pre-contact population and of the death toll differ widely.' },
  { key: 'london1665', title: 'Great Plague of London', era: 'early', lane: 'outbreak', dx: 560, time: '1665', lat: 51.51, lon: -0.12, country: 'United Kingdom',
    tags: ['outbreak', 'bacterial', 'inequality'], url: W + 'Great_Plague_of_London',
    text: 'The last major plague epidemic in England. Houses of the sick were shut up with the healthy inside, and the poor, who could not leave the city, suffered most.' },
  { key: 'cholera', title: 'Cholera in Soho', era: 'modern', lane: 'outbreak', dx: 0, time: '1854-08-31', lat: 51.51, lon: -0.14, country: 'United Kingdom',
    tags: ['outbreak', 'bacterial', 'sanitation'], url: W + '1854_Broad_Street_cholera_outbreak',
    text: 'About 600 people died within weeks around one water pump on Broad Street. The outbreak became the textbook case of mapping disease to find its cause.' },
  { key: 'flu1918', title: '1918 influenza', era: 'modern', lane: 'outbreak', dx: 560, time: '1918', lat: 37.7, lon: -97.3, country: 'United States',
    tags: ['outbreak', 'viral', 'war', 'contested'], url: W + '1918_flu_pandemic',
    text: 'Killed an estimated 50 million people worldwide, many of them young adults. It is called "Spanish" only because neutral Spain reported it openly; where it began is still unsettled.' },
  { key: 'hiv', title: 'HIV/AIDS', era: 'modern', lane: 'outbreak', dx: 1120, time: '1981', lat: 34.05, lon: -118.24, country: 'United States',
    tags: ['outbreak', 'viral', 'inequality', 'stigma'], url: W + 'HIV/AIDS',
    text: 'First recognised in 1981. Stigma delayed action, then activists changed how drugs are tested and approved. Antiretroviral therapy turned a death sentence into a manageable illness, but access remains unequal.' },
  { key: 'sars', title: 'SARS', era: 'now', lane: 'outbreak', dx: 0, time: '2003-02', lat: 23.13, lon: 113.26, country: 'China',
    tags: ['outbreak', 'viral', 'surveillance'], url: W + 'Severe_acute_respiratory_syndrome',
    text: 'A coronavirus that spread to 29 countries and was contained within months by isolation, contact tracing and travel measures. It was a rehearsal that many countries remembered.' },
  { key: 'ebola', title: 'Ebola in West Africa', era: 'now', lane: 'outbreak', dx: 560, time: '2014', lat: 8.57, lon: -10.13, country: 'Guinea',
    tags: ['outbreak', 'viral', 'inequality', 'surveillance'], url: W + 'Western_African_Ebola_epidemic',
    text: 'Over 11,000 deaths in Guinea, Liberia and Sierra Leone. Weak health systems, mistrust and a slow international response let it spread; community burial teams and trusted local voices finally turned it.' },
  { key: 'covid', title: 'COVID-19', era: 'now', lane: 'outbreak', dx: 1120, time: '2019-12', lat: 30.59, lon: 114.3, country: 'China',
    tags: ['outbreak', 'viral', 'trade', 'inequality', 'contested'], url: W + 'COVID-19_pandemic',
    text: 'Spread worldwide within weeks along air routes. Its origin remains debated, while its effects on health, schooling, work and inequality are measured every day.' },

  // ---- Responses
  { key: 'ragusa', title: 'Quarantine in Ragusa', era: 'medieval', lane: 'response', dx: 1100, time: '1377', lat: 42.65, lon: 18.09, country: 'Croatia',
    tags: ['response', 'quarantine', 'evidence: strong'], url: W + 'Quarantine',
    text: 'The port city made arriving ships and travellers wait thirty days (a trentino), later forty (quarantena) before landing. The word quarantine comes from the forty days.' },
  { key: 'variolation', title: 'Variolation and vaccination', era: 'early', lane: 'response', dx: 1100, time: '1796', lat: 51.69, lon: -2.45, country: 'United Kingdom',
    tags: ['response', 'vaccine', 'evidence: strong'], url: W + 'Edward_Jenner',
    text: 'Edward Jenner showed that cowpox exposure protected against smallpox. Earlier, variolation (deliberate mild infection) was used in Asia, Africa and the Ottoman world.',
    refs: [{ url: 'https://en.wikipedia.org/wiki/Variolation', title: 'Variolation before Jenner' }] },
  { key: 'snow', title: 'John Snow maps the cholera', era: 'modern', lane: 'response', dx: 0, time: '1854-09-08', lat: 51.51, lon: -0.14, country: 'United Kingdom',
    tags: ['response', 'sanitation', 'surveillance', 'evidence: strong'], url: W + 'John_Snow',
    text: 'Snow plotted deaths by house and traced them to the Broad Street pump. The handle was removed. He argued cholera spread by water, against the dominant "bad air" theory.' },
  { key: 'germ', title: 'Germ theory', era: 'modern', lane: 'response', dx: 560, time: '1882', lat: 52.52, lon: 13.4, country: 'Germany',
    tags: ['concept', 'science', 'evidence: strong'], url: W + 'Germ_theory_of_disease',
    text: 'Pasteur and Koch (who identified the tuberculosis bacterium in 1882) established that specific microbes cause specific diseases. It moved public health from smell and superstition to cause and proof.' },
  { key: 'penicillin', title: 'Penicillin and antibiotics', era: 'modern', lane: 'response', dx: 1120, time: '1928', lat: 51.52, lon: -0.17, country: 'United Kingdom',
    tags: ['response', 'antibiotics', 'bacterial', 'evidence: strong'], url: W + 'Penicillin',
    text: 'Discovered by Alexander Fleming in 1928 and made into a drug in the 1940s. Bacterial infections that once killed became curable, and resistance is the cost of using them too freely.' },
  { key: 'smallpox-end', title: 'Smallpox eradicated', era: 'now', lane: 'response', dx: 0, time: '1980', lat: 46.2, lon: 6.14, country: 'Switzerland',
    tags: ['response', 'vaccine', 'surveillance', 'evidence: strong'], url: W + 'Smallpox#Eradication',
    text: 'The WHO declared smallpox gone in 1980: the only human disease eradicated. Surveillance and ring vaccination (vaccinate the contacts of each case) did more than mass vaccination alone.' },
  { key: 'mrna', title: 'mRNA vaccines', era: 'now', lane: 'response', dx: 1120, time: '2020-12', lat: 50.0, lon: 8.27, country: 'Germany',
    tags: ['response', 'vaccine', 'science', 'evidence: strong'], url: W + 'MRNA_vaccine',
    text: 'Decades of basic research on RNA let vaccines be designed within days of the genome being published, and be tested and approved within a year.' },

  // ---- Concepts
  { key: 'r0', title: 'Basic reproduction number (R0)', era: 'modern', lane: 'concept', dx: 280, time: '1952', tags: ['concept', 'science'], url: W + 'Basic_reproduction_number',
    text: 'How many people one case infects, on average, in a population with no immunity. Below 1 an outbreak dies out; above 1 it grows.' },
  { key: 'herd', title: 'Herd immunity', era: 'modern', lane: 'concept', dx: 840, time: '1923', tags: ['concept', 'vaccine', 'science'], url: W + 'Herd_immunity',
    text: 'When enough people are immune, the chain of infection breaks and even the unprotected are safer. The threshold depends on R0.' },
  { key: 'onehealth', title: 'One Health', era: 'now', lane: 'concept', dx: 280, time: '2004', tags: ['concept', 'surveillance'], url: W + 'One_Health',
    text: 'Human, animal and environmental health are linked: most new diseases are zoonotic, crossing from animals to people. Watching animals and ecosystems is part of watching for pandemics.' },
  { key: 'epi', title: 'Epidemiology', era: 'now', lane: 'concept', dx: 840, time: null, tags: ['concept', 'science'], url: W + 'Epidemiology',
    text: 'The study of how often disease occurs, who gets it and why. Its tools, such as case counting and contact tracing, are how outbreaks are measured and controlled.' },

  // ---- Lessons (notes written for this graph)
  { key: 'n-trade', kind: 'note', title: 'Disease travels the trade routes', era: 'medieval', lane: 'concept', dx: 280, tags: ['lesson', 'trade'],
    text: 'Athens by sea and siege, Rome by legions, Constantinople by grain ships, Sicily by galleys, the world by jets. Each increase in speed and volume of travel made the next pandemic wider. Quarantine is an answer to the same fact: control the arrival.' },
  { key: 'n-unequal', kind: 'note', title: 'The burden is never shared equally', era: 'early', lane: 'concept', dx: 280, tags: ['lesson', 'inequality'],
    text: 'In London the poor could not leave; in the Americas one population met the disease with no immunity; in HIV and COVID access to treatment followed wealth. Who suffers is a social question, not only a biological one.' },
  { key: 'n-science', kind: 'note', title: 'Understanding came after action', era: 'early', lane: 'response', dx: 560, tags: ['lesson', 'science', 'contested'],
    text: 'Quarantine worked before anyone knew about microbes, and the Broad Street pump was shut before germ theory won. Practice often leads theory. But the later science (vaccines, antibiotics) did what practice alone could not.' },
  { key: 'n-open', kind: 'note', title: 'Open question: how will we know the next one early?', era: 'now', lane: 'concept', dx: 1400, tags: ['lesson', 'surveillance', 'contested'],
    text: 'SARS and Ebola showed that early local detection decides the outcome. What would a trusted, global, affordable warning system look like, and who would pay for it? Add your own notes and tags here.' },
];

// Labels on the canvas and shapes behind groups of tiles.
const SHAPES = [
  { era: 'ancient', title: 'Antiquity', fill: '#fef3c7', stroke: '#d97706', lane: 'top' },
  { era: 'medieval', title: 'The Middle Ages', fill: '#fee2e2', stroke: '#dc2626', lane: 'top' },
  { era: 'early', title: 'The early modern world', fill: '#ede9fe', stroke: '#7c3aed', lane: 'top' },
  { era: 'modern', title: 'Science and cities', fill: '#dbeafe', stroke: '#2563eb', lane: 'top' },
  { era: 'now', title: 'A connected world', fill: '#dcfce7', stroke: '#15803d', lane: 'top' },
];

// [from, to, relationship, tags, bend]
const EDGES = [
  ['athens', 'antonine', 'RELATED', ['recurring'], null],
  ['antonine', 'justinian', 'LEADS_TO', ['recurring'], null],
  ['justinian', 'blackdeath', 'LEADS_TO', ['recurring', 'evidence: strong'], null],
  ['n-trade', 'antonine', 'EXPLAINS', [], null],
  ['n-trade', 'justinian', 'EXPLAINS', [], null],
  ['n-trade', 'blackdeath', 'EXPLAINS', [], null],
  ['n-trade', 'covid', 'EXPLAINS', [], { bx: 0, by: -180 }],
  ['blackdeath', 'ragusa', 'CAUSES', ['evidence: strong'], null],
  ['ragusa', 'sars', 'INFLUENCES', ['evidence: strong'], { bx: 0, by: 150 }],
  ['smallpox-americas', 'n-unequal', 'EXAMPLE_OF', [], null],
  ['london1665', 'n-unequal', 'EXAMPLE_OF', [], null],
  ['hiv', 'n-unequal', 'EXAMPLE_OF', [], null],
  ['covid', 'n-unequal', 'EXAMPLE_OF', ['contested'], { bx: 40, by: 220 }],
  ['variolation', 'smallpox-end', 'LEADS_TO', ['evidence: strong'], { bx: 0, by: 130 }],
  ['smallpox-end', 'herd', 'USES', [], null],
  ['herd', 'r0', 'USES', [], null],
  ['r0', 'covid', 'EXPLAINS', ['contested'], null],
  ['cholera', 'snow', 'RESPONDS_TO', ['evidence: strong'], null],
  ['snow', 'germ', 'SUPPORTS', ['evidence: strong'], null],
  ['n-science', 'snow', 'EXPLAINS', [], null],
  ['n-science', 'ragusa', 'EXPLAINS', [], null],
  ['germ', 'penicillin', 'LEADS_TO', ['evidence: strong'], null],
  ['flu1918', 'epi', 'INFLUENCES', [], { bx: 0, by: 200 }],
  ['flu1918', 'penicillin', 'CONTRADICTS', ['contested'], { bx: 0, by: -100 }],
  ['hiv', 'penicillin', 'RELATED', ['contested'], null],
  ['sars', 'onehealth', 'SUPPORTS', ['evidence: strong'], null],
  ['ebola', 'onehealth', 'SUPPORTS', [], null],
  ['sars', 'covid', 'LEADS_TO', ['recurring'], null],
  ['covid', 'mrna', 'CAUSES', ['evidence: strong'], null],
  ['mrna', 'smallpox-end', 'CITES', [], { bx: 0, by: 120 }],
  ['epi', 'n-open', 'RELATED', [], null],
  ['onehealth', 'n-open', 'LEADS_TO', [], null],
  ['ebola', 'n-open', 'LEADS_TO', ['evidence: strong'], null],
];

const TAG_COLOURS = {
  outbreak: '#dc2626',
  response: '#15803d',
  concept: '#2563eb',
  lesson: '#d97706',
  viral: '#7c3aed',
  bacterial: '#0f766e',
  inequality: '#be185d',
  contested: '#6b7280',
  'evidence: strong': '#16a34a',
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
  await login(BASE);
  const existing = await call('GET', '/networks');
  if (existing.some((n) => n.name === NAME)) {
    console.log(`"${NAME}" already exists. Delete it in Graphin first, then run this again.`);
    return;
  }
  const network = await call('POST', '/networks', { name: NAME });
  const N = `/networks/${network.id}`;
  const ids = new Map();

  // Shapes first, so they sit behind the tiles.
  for (const s of SHAPES) {
    await call('POST', `${N}/nodes`, {
      type: 'shape', title: s.title, commentary: s.title, shape: 'rounded', x: ERA[s.era] - 60, y: -140, width: s.era === 'ancient' ? 1020 : 1060, height: 1180,
      style: { fill: s.fill, stroke: s.stroke, width: 2, dash: 'dashed', opacity: 0.35 },
    });
  }
  // Lane labels at the left edge.
  for (const [label, y] of [['OUTBREAKS: what happened', LANE.outbreak - 60], ['RESPONSES: what people did', LANE.response - 60], ['IDEAS AND LESSONS: what it taught', LANE.concept - 60]]) {
    await call('POST', `${N}/nodes`, { type: 'text', title: label, commentary: label, x: -280, y: y + 60, style: { text: '#475569' } });
  }

  for (const n of NODES) {
    const created = await call('POST', `${N}/nodes`, {
      type: n.kind === 'note' ? 'note' : 'webpage',
      url: n.kind === 'note' ? undefined : n.url,
      title: n.title,
      commentary: n.text,
      x: ERA[n.era] + n.dx,
      y: LANE[n.lane],
      time: n.time || undefined,
      latitude: n.lat,
      longitude: n.lon,
      country: n.country,
      tags: n.tags,
      references: n.refs,
    });
    ids.set(n.key, created.id);
  }

  for (const [from, to, relationship, tags, bend] of EDGES) {
    const colours = {
      SUPPORTS: '#15803d', CONTRADICTS: '#dc2626', CAUSES: '#d97706', LEADS_TO: '#2563eb', INFLUENCES: '#7c3aed',
      RESPONDS_TO: '#0891b2', EXAMPLE_OF: '#65a30d', PART_OF: '#0f766e', EXPLAINS: '#4f46e5', CITES: '#a16207', USES: '#be185d', RELATED: '#7a869c',
    };
    await call('POST', `${N}/edges`, {
      source_id: ids.get(from),
      target_id: ids.get(to),
      relationship,
      tags,
      style: { stroke: colours[relationship], ...(bend || {}) },
    });
  }
  await call('PUT', N, { tag_colors: TAG_COLOURS });

  console.log(`Created "${NAME}": ${NODES.length} tiles, ${EDGES.length} links, ${SHAPES.length} shapes.`);
  console.log(`Open it at ${BASE}/#/networks/${network.id}`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});

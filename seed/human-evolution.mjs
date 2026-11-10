// Builds the network "Human evolution and migration" through the Graphin API, coded with tags: the first tag of every
// tile is its group (early apes, australopith, early homo, archaic human, homo sapiens, settled peoples, science),
// then its region, its kind of evidence and whether the finding is contested. Links are tagged too.
//
//   node seed/human-evolution.mjs                 (uses http://127.0.0.1:8100)
//
// Try: Tags > colour by Border, then tick "contested" or "dna" to filter. Run it once per graph name.
import { login } from './login.mjs';

const BASE = process.argv[2] ? process.argv[2] + '/api' : 'http://127.0.0.1:8100/api';
const api = async (method, path, body) => {
  const res = await fetch(`${BASE}${path}`, { method, headers: body === undefined ? {} : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${await res.text()}`);
  return res.status === 204 ? null : res.json();
};
await login(BASE.replace('/api', ''));
const net = await api('POST', '/networks', { name: 'Human evolution and migration' });
const N = `/networks/${net.id}`;

const COLOR = { ape: '#7c2d12', austra: '#b45309', homo: '#15803d', archaic: '#7c3aed', sapiens: '#2563eb', holo: '#e11d48', sci: '#475569' };
const W = 230, H = 130;
const wiki = (p) => `https://en.wikipedia.org/wiki/${p}`;

// [key, era, title, commentary, lat, lon, country, url (optional)]

// Years before the common era are negative: -300000 is 300,000 years ago. Years after are ordinary. Items with no
// single date (the DNA people carry today) have none, and stay visible whatever range the Time slider is set to.
const TIME = {
  sahelanthropus: -7000000, ardi: -4400000, lucy: -3200000, laetoli: -3700000, africanus: -2500000, habilis: -2300000,
  turkana: -1500000, fire: -1000000, naledi: -300000, irhoud: -315000, omo: -233000, eve: -170000, blombos: -75000,
  bantu: -3000, madagascar: 700, gesher: -780000, dmanisi: -1800000, java: -1500000, zhoukoudian: -750000,
  atapuerca: -850000, heidelbergensis: -600000, neanderthal: -400000, denisova: -200000, baishiya: -160000,
  levant: -120000, babel: -70000, toba: -74000, flores: -100000, sulawesi: -51000, madjedbebe: -65000, mungo: -42000,
  lapita: -1300, hawaii: 1000, rapanui: 1200, nz: 1280, chauvet: -36000, cromagnon: -28000, mix: -50000, yana: -31000,
  malta: -24000, gobekli: -9600, farming: -9000, yamnaya: -3000, beringia: -20000, bluefish: -24000,
  whitesands: -23000, clovis: -11000, monteverde: -12500,
};

const items = [
  // Africa: the first apes and hominins
  ['sahelanthropus', 'ape', 'Sahelanthropus tchadensis', 'About 7 million years ago. A skull from Chad, close to the split from the chimpanzee line.', 16.3, 17.5, 'Chad', wiki('Sahelanthropus')],
  ['ardi', 'ape', 'Ardipithecus ramidus ("Ardi")', 'About 4.4 million years ago. Walked upright in woodland and still climbed trees.', 10.4, 40.2, 'Ethiopia', wiki('Ardipithecus')],
  ['lucy', 'austra', 'Australopithecus afarensis ("Lucy")', 'About 3.2 million years ago. A small, upright walker with a chimpanzee-sized brain.', 11.6, 40.6, 'Ethiopia', wiki('Lucy_(Australopithecus)')],
  ['laetoli', 'austra', 'Laetoli footprints', 'About 3.7 million years ago. Footprints in volcanic ash show two-legged walking.', -3.2, 35.2, 'Tanzania', wiki('Laetoli')],
  ['africanus', 'austra', 'Australopithecus africanus', 'About 2.5 million years ago. The Taung Child, found in South Africa in 1924.', -27.6, 24.2, 'South Africa', wiki('Australopithecus_africanus')],
  ['habilis', 'homo', 'Homo habilis', 'About 2.3 million years ago. The "handy man", linked to the first stone tools at Olduvai Gorge.', -3.0, 34.8, 'Tanzania', wiki('Homo_habilis')],
  ['turkana', 'homo', 'Homo erectus: Turkana Boy', 'About 1.5 million years ago. Tall, long-legged, built for walking and running.', 3.9, 36.1, 'Kenya', wiki('Turkana_Boy')],
  ['fire', 'homo', 'Early control of fire', 'About 1 million years ago. Burnt bone and ash at Wonderwerk Cave. Cooking spreads soon after.', -27.8, 23.6, 'South Africa', wiki('Control_of_fire_by_early_humans')],
  ['naledi', 'homo', 'Homo naledi', 'About 300,000 years ago. A small-brained human that lived alongside early Homo sapiens.', -25.9, 27.8, 'South Africa', wiki('Homo_naledi')],
  ['irhoud', 'sapiens', 'Jebel Irhoud', 'About 315,000 years ago. The oldest known Homo sapiens fossils, in Morocco.', 31.9, -8.9, 'Morocco', wiki('Jebel_Irhoud')],
  ['omo', 'sapiens', 'Omo Kibish', 'About 230,000 years ago. Early Homo sapiens skulls on the Omo River.', 5.4, 36.0, 'Ethiopia', wiki('Omo_remains')],
  ['eve', 'sci', 'Mitochondrial Eve', 'About 150,000 to 200,000 years ago. The most recent common maternal ancestor of all living people.', -1.0, 24.0, 'Africa', wiki('Mitochondrial_Eve')],
  ['blombos', 'sapiens', 'Blombos Cave', 'About 75,000 years ago. Ochre engraved with patterns, beads: symbolic thinking.', -34.4, 21.2, 'South Africa', wiki('Blombos_Cave')],
  ['bantu', 'holo', 'Bantu expansion', 'From about 5,000 years ago. Farmers and iron-workers spread from Cameroon across central and southern Africa.', 5.5, 12.0, 'Cameroon', wiki('Bantu_expansion')],
  ['madagascar', 'holo', 'Settlement of Madagascar', 'About 1,300 years ago. Austronesian sailors from Borneo arrive, with Bantu settlers.', -19.0, 47.0, 'Madagascar', wiki('Prehistory_of_Madagascar')],

  // Leaving Africa
  ['gesher', 'homo', 'Gesher Benot Yaʿaqov', 'About 780,000 years ago. Evidence of fire and a shared hearth, on the route out of Africa.', 33.0, 35.6, 'Israel', wiki('Gesher_Benot_Ya%27aqov')],
  ['dmanisi', 'homo', 'Dmanisi', 'About 1.8 million years ago. The oldest known humans outside Africa.', 41.3, 44.3, 'Georgia', wiki('Dmanisi')],
  ['java', 'homo', 'Java Man', 'About 1.5 million years ago. Homo erectus reaches the tropical islands of Southeast Asia.', -7.4, 110.8, 'Indonesia', wiki('Java_Man')],
  ['zhoukoudian', 'homo', 'Peking Man', 'About 750,000 years ago. Homo erectus at Zhoukoudian near Beijing, using fire.', 39.7, 115.9, 'China', wiki('Peking_Man')],
  ['atapuerca', 'archaic', 'Atapuerca', 'About 850,000 and 430,000 years ago. Homo antecessor, then the bones of the Sima de los Huesos.', 42.35, -3.5, 'Spain', wiki('Atapuerca_Mountains')],
  ['heidelbergensis', 'archaic', 'Homo heidelbergensis', 'About 600,000 years ago. A common ancestor of Neanderthals, Denisovans and us, or close to it.', 49.4, 8.7, 'Germany', wiki('Homo_heidelbergensis')],
  ['neanderthal', 'archaic', 'Neanderthals', 'About 400,000 to 40,000 years ago. Named for the Neander valley. Adapted to Ice Age Europe and western Asia.', 51.2, 6.9, 'Germany', wiki('Neanderthal')],
  ['denisova', 'archaic', 'Denisovans', 'About 200,000 to 50,000 years ago. Known from a finger bone, teeth and DNA from Denisova Cave.', 51.4, 84.7, 'Russia', wiki('Denisovan')],
  ['baishiya', 'archaic', 'Baishiya Karst Cave', 'About 160,000 years ago. A Denisovan jaw at 3,280 m on the Tibetan Plateau.', 35.3, 102.4, 'China', wiki('Baishiya_Karst_Cave')],
  ['levant', 'sapiens', 'Skhul and Qafzeh', 'About 120,000 years ago. Early Homo sapiens in the Levant, an early push out of Africa.', 32.6, 35.1, 'Israel', wiki('Skhul_and_Qafzeh_hominins')],
  ['babel', 'sapiens', 'Southern route', 'About 70,000 years ago. Crossing the Bab-el-Mandeb strait and following the coast to Asia.', 12.7, 43.3, 'Yemen', wiki('Recent_African_origin_of_modern_humans')],
  ['toba', 'sci', 'Toba eruption', 'About 74,000 years ago. A huge eruption in Sumatra, once thought to have nearly ended humanity.', 2.7, 98.8, 'Indonesia', wiki('Youngest_Toba_eruption')],
  ['flores', 'archaic', 'Homo floresiensis', 'About 100,000 to 50,000 years ago. A very small human on an island. Nicknamed "the hobbit".', -8.5, 120.4, 'Indonesia', wiki('Homo_floresiensis')],
  ['sulawesi', 'sapiens', 'Sulawesi cave art', 'About 51,000 years ago. Among the oldest known figurative paintings.', -4.9, 119.7, 'Indonesia', wiki('Cave_painting')],

  // Australia and Oceania
  ['madjedbebe', 'sapiens', 'Madjedbebe', 'About 65,000 years ago. Possibly the earliest people in Australia, across the sea from Sunda.', -12.6, 132.9, 'Australia', wiki('Madjedbebe')],
  ['mungo', 'sapiens', 'Lake Mungo', 'About 42,000 years ago. Burials and hearths of Aboriginal Australians.', -33.7, 143.1, 'Australia', wiki('Lake_Mungo')],
  ['png', 'sci', 'Denisovan ancestry in Melanesia', 'Today, up to about 5% of the DNA of people in Papua New Guinea comes from Denisovans.', -6.0, 145.0, 'Papua New Guinea', wiki('Denisovan')],
  ['lapita', 'holo', 'Lapita voyagers', 'About 3,300 years ago. Pottery and canoes reach Vanuatu, Fiji, Samoa and Tonga.', -15.4, 167.0, 'Vanuatu', wiki('Lapita_culture')],
  ['hawaii', 'holo', 'Hawaii', 'About 1,000 years ago. Polynesian navigators cross the Pacific without instruments.', 20.0, -155.5, 'United States', wiki('Polynesian_navigation')],
  ['rapanui', 'holo', 'Rapa Nui (Easter Island)', 'About 1200 CE. The far east of Polynesia.', -27.1, -109.4, 'Chile', wiki('Easter_Island')],
  ['nz', 'holo', 'Aotearoa New Zealand', 'About 1280 CE. The last large land settled by people, by Maori ancestors.', -41.3, 174.8, 'New Zealand', wiki('History_of_New_Zealand')],

  // Europe and Asia
  ['chauvet', 'sapiens', 'Chauvet Cave', 'About 36,000 years ago. Painted horses, lions and rhinos in the Ardeche.', 44.4, 4.4, 'France', wiki('Chauvet_Cave')],
  ['cromagnon', 'sapiens', 'Cro-Magnon', 'About 28,000 years ago. Anatomically modern humans in Europe, alongside the last Neanderthals.', 44.9, 1.0, 'France', wiki('Cro-Magnon')],
  ['mix', 'sci', 'Neanderthal DNA in people today', 'Most people outside Africa carry about 1 to 2% Neanderthal DNA, from mixing in western Asia.', 36.0, 38.0, 'Syria', wiki('Interbreeding_between_archaic_and_modern_humans')],
  ['yana', 'sapiens', 'Yana RHS', 'About 31,000 years ago. People living in the Arctic of Siberia.', 71.0, 135.0, 'Russia', wiki('Yana_Rhinoceros_Horn_Site')],
  ['malta', 'sapiens', 'Mal’ta boy', 'About 24,000 years ago. DNA from Siberia links ancestors of Europeans and Native Americans.', 53.0, 103.5, 'Russia', wiki('Mal%27ta%E2%80%93Buret%27_culture')],
  ['gobekli', 'holo', 'Gobekli Tepe', 'About 11,600 years ago. Monumental stone circles built before farming.', 37.2, 38.9, 'Turkey', wiki('G%C3%B6bekli_Tepe')],
  ['farming', 'holo', 'Neolithic farming', 'From about 11,000 years ago. Wheat, barley and sheep in the Fertile Crescent. Farmers spread to Europe.', 34.5, 42.0, 'Iraq', wiki('Neolithic_Revolution')],
  ['yamnaya', 'holo', 'Yamnaya steppe herders', 'About 5,000 years ago. Herders spread from the steppe and bring new genes and languages to Europe and Asia.', 48.5, 45.0, 'Russia', wiki('Yamnaya_culture')],

  // Americas
  ['beringia', 'sapiens', 'Beringia', 'About 20,000 years ago. A land bridge, now under the Bering Strait, joins Siberia and Alaska.', 66.0, -170.0, 'United States', wiki('Beringia')],
  ['bluefish', 'sapiens', 'Bluefish Caves', 'About 24,000 years ago. Marks on mammoth and horse bones in the Yukon.', 68.6, -140.8, 'Canada', wiki('Bluefish_Caves')],
  ['whitesands', 'sapiens', 'White Sands footprints', 'About 23,000 years ago. Human footprints in New Mexico, older than Clovis.', 32.8, -106.2, 'United States', wiki('White_Sands_fossil_footprints')],
  ['clovis', 'sapiens', 'Clovis culture', 'About 13,000 years ago. Fluted spear points across North America.', 34.0, -103.3, 'United States', wiki('Clovis_culture')],
  ['monteverde', 'sapiens', 'Monte Verde', 'About 14,500 years ago. A village in southern Chile: people had already gone nearly the length of the Americas.', -41.5, -73.2, 'Chile', wiki('Monte_Verde')],
];

// Links between items: [from, to, label, colour]
const links = [
  ['sahelanthropus', 'ardi', 'earlier than'], ['ardi', 'lucy', 'earlier than'], ['lucy', 'laetoli', 'walked like'], ['lucy', 'africanus', 'relative of'],
  ['lucy', 'habilis', 'leads to'], ['habilis', 'turkana', 'leads to'], ['turkana', 'fire', 'used'],
  ['turkana', 'dmanisi', 'migrated to'], ['turkana', 'gesher', 'migrated to'], ['dmanisi', 'java', 'migrated to'], ['dmanisi', 'zhoukoudian', 'migrated to'],
  ['gesher', 'heidelbergensis', 'ancestors of'], ['heidelbergensis', 'atapuerca', 'lived at'], ['heidelbergensis', 'neanderthal', 'gave rise to'], ['heidelbergensis', 'denisova', 'gave rise to'],
  ['heidelbergensis', 'irhoud', 'related to'], ['irhoud', 'omo', 'earlier than'], ['omo', 'eve', 'near the time of'], ['naledi', 'omo', 'lived beside'],
  ['omo', 'levant', 'migrated to'], ['omo', 'blombos', 'spread to'], ['omo', 'babel', 'migrated to'],
  ['levant', 'mix', 'interbred with'], ['neanderthal', 'mix', 'interbred with'], ['mix', 'cromagnon', 'ancestors of'],
  ['babel', 'toba', 'near the time of'], ['babel', 'madjedbebe', 'migrated to'], ['babel', 'sulawesi', 'migrated to'],
  ['denisova', 'baishiya', 'also lived at'], ['denisova', 'png', 'interbred with'], ['madjedbebe', 'mungo', 'spread to'], ['madjedbebe', 'png', 'near'],
  ['java', 'flores', 'may have led to'], ['mix', 'cromagnon', 'ancestors of'], ['cromagnon', 'chauvet', 'near'], ['neanderthal', 'cromagnon', 'met'],
  ['babel', 'malta', 'ancestors reached'], ['malta', 'yana', 'related to'], ['malta', 'beringia', 'migrated to'], ['yana', 'beringia', 'migrated to'],
  ['beringia', 'bluefish', 'settled'], ['beringia', 'whitesands', 'migrated to'], ['whitesands', 'clovis', 'earlier than'], ['clovis', 'monteverde', 'later than'], ['beringia', 'monteverde', 'migrated to'],
  ['gobekli', 'farming', 'precedes'], ['farming', 'yamnaya', 'spread to'], ['mix', 'gobekli', 'ancestors of'],
  ['bantu', 'madagascar', 'settled'], ['lapita', 'hawaii', 'sailed to'], ['hawaii', 'rapanui', 'sailed to'], ['hawaii', 'nz', 'sailed to'], ['lapita', 'madagascar', 'related voyagers'],
  ['sulawesi', 'lapita', 'ancestors of'], ['png', 'lapita', 'near'],
];

const seen = new Set();
const edges = links.filter(([a, b]) => { const k = `${a}>${b}`; if (seen.has(k)) return false; seen.add(k); return true; });

// Place each tile on the map at its coordinates (10 units per degree), then push overlapping tiles apart while
// a weak pull keeps each close to its true place.
const MAPW = 3600, MAPH = 1800;
const spot = new Map(items.map(([key, , , , lat, lon]) => [key, { x: (lon + 180) * 40, y: (90 - lat) * 40 }]));
const pos = new Map([...spot].map(([k, p]) => [k, { ...p }]));
for (let pass = 0; pass < 400; pass++) {
  const keys = [...pos.keys()];
  for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) {
    const a = pos.get(keys[i]), b = pos.get(keys[j]);
    const dx = b.x - a.x, dy = b.y - a.y;
    const ox = W + 40 - Math.abs(dx), oy = H + 40 - Math.abs(dy);
    if (ox > 0 && oy > 0) {
      if (ox < oy) { const s = (dx >= 0 ? 1 : -1) * ox / 2; a.x -= s; b.x += s; }
      else { const s = (dy >= 0 ? 1 : -1) * oy / 2; a.y -= s; b.y += s; }
    }
  }
  for (const [k, p] of pos) { const s = spot.get(k); p.x += (s.x - p.x) * 0.03; p.y += (s.y - p.y) * 0.03; }
}

const GROUP_TAG = { ape: 'early apes', austra: 'australopith', homo: 'early homo', archaic: 'archaic human', sapiens: 'homo sapiens', holo: 'settled peoples', sci: 'science' };
const REGION_OVERRIDE = { levant: 'asia', babel: 'asia', gobekli: 'asia', java: 'asia', hawaii: 'oceania', rapanui: 'oceania', dmanisi: 'asia' };
const region = (key, lat, lon) => {
  if (REGION_OVERRIDE[key]) return REGION_OVERRIDE[key];
  if (lon < -30) return 'americas';
  if (lat < -5 && lon > 100) return 'oceania';
  if (lon > 100) return 'asia';
  if (lon >= -30 && lon <= 60 && lat < 33) return 'africa';
  if (lon <= 40 && lat >= 36) return 'europe';
  return 'asia';
};
const EXTRA = {
  fossil: ['sahelanthropus', 'ardi', 'lucy', 'africanus', 'habilis', 'turkana', 'naledi', 'irhoud', 'omo', 'dmanisi', 'java', 'zhoukoudian', 'atapuerca', 'heidelbergensis', 'neanderthal', 'denisova', 'baishiya', 'levant', 'flores', 'mungo', 'cromagnon', 'yana', 'malta'],
  dna: ['eve', 'mix', 'png', 'malta', 'denisova', 'yamnaya', 'baishiya', 'yana'],
  art: ['blombos', 'sulawesi', 'chauvet'],
  tools: ['habilis', 'fire', 'gesher', 'clovis', 'whitesands', 'bluefish'],
  voyage: ['lapita', 'hawaii', 'rapanui', 'nz', 'madagascar', 'babel'],
  farming: ['gobekli', 'farming', 'yamnaya', 'bantu'],
  contested: ['naledi', 'java', 'fire', 'eve', 'toba', 'flores', 'madjedbebe', 'sulawesi', 'bluefish', 'whitesands', 'monteverde', 'heidelbergensis', 'babel'],
  footprints: ['laetoli', 'whitesands'],
};
const tagsFor = (key, era, lat, lon) => {
  const tags = [GROUP_TAG[era], region(key, lat, lon)];
  for (const [tag, keys] of Object.entries(EXTRA)) if (keys.includes(key)) tags.push(tag);
  return tags;
};

const id = {};
const placed = [];
for (const [key, era, title, commentary, lat, lon, country, url] of items) {
  const p = pos.get(key);
  const x = Math.round(p.x - W / 2), y = Math.round(p.y - H / 2);
  const n = await api('POST', `${N}/nodes`, {
    type: url ? 'webpage' : 'note', title, commentary, url, latitude: lat, longitude: lon, country, tags: tagsFor(key, era, lat, lon), time: TIME[key] === undefined ? undefined : String(TIME[key]), x, y, shape: 'rounded',
    style: { fill: '#ffffff', stroke: COLOR[era], width: 3, text: '#0f172a' },
  });
  id[key] = n.id;
  placed.push({ id: n.id, x, y, width: W, height: H });
}

const heading = await api('POST', `${N}/nodes`, { type: 'text', title: 'Text', commentary: "HUMAN EVOLUTION AND MIGRATION: where and when each step happened. Use the Time slider to see any period", x: 200, y: 200 });
placed.push({ id: heading.id, x: 80, y: 30, width: 1500, height: 70 });
const legend = await api('POST', `${N}/nodes`, {
  type: 'text', title: 'Text',
  commentary: 'Border colour: brown early apes · orange australopiths · green early Homo · purple archaic humans (Neanderthals, Denisovans) · blue Homo sapiens · red settled and farming peoples · grey science. Dates are approximate.',
  x: 80, y: 6700,
});
placed.push({ id: legend.id, x: 80, y: 6700, width: 1800, height: 120 });
await api('PUT', `${N}/positions`, placed);

const MIGRATE = new Set(['migrated to', 'spread to', 'sailed to', 'settled', 'ancestors reached']);
for (const [a, b, label] of edges) {
  const tags = MIGRATE.has(label) ? ['migration'] : label === 'interbred with' ? ['interbreeding', 'dna'] :
    ['ancestors of', 'gave rise to', 'leads to', 'may have led to', 'precedes', 'earlier than', 'later than'].includes(label) ? ['descent'] : ['context'];
  if (label === 'may have led to') tags.push('contested');
  const style = MIGRATE.has(label) ? { stroke: '#dc2626', width: 3 } : { stroke: '#64748b', width: 2 };
  await api('POST', `${N}/edges`, { source_id: id[a], target_id: id[b], relationship: label.toUpperCase().replace(/ /g, '_'), tags, style });
}
await api('PUT', N, {
  tag_colors: {
    'early apes': COLOR.ape, australopith: COLOR.austra, 'early homo': COLOR.homo, 'archaic human': COLOR.archaic,
    'homo sapiens': COLOR.sapiens, 'settled peoples': COLOR.holo, science: COLOR.sci,
    migration: '#dc2626', interbreeding: '#a21caf', descent: '#0f766e', context: '#94a3b8', contested: '#6b7280', dna: '#7c3aed',
  },
});
const g = await api('GET', `${N}/graph`);
console.log(`Open it at ${BASE.replace('/api', '')}/#/networks/${net.id}`);
console.log(JSON.stringify({ networkId: net.id, nodes: g.nodes.length, edges: g.edges.length }));
void MAPW; void MAPH;

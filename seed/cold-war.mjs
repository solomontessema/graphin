// Builds the network "The Cold War: from the end of WWII to 1991" through the Graphin API.
//
//   node seed/cold-war.mjs                      (uses http://localhost:8100)
//   node seed/cold-war.mjs http://127.0.0.1:8765   (the desktop app, while it is running)
//
// Each era is a group. Its members sit inside the group and have no arrows to the group.
// Every link is a Wikipedia article, which allows embedding. Commentaries are short summaries;
// dates and figures are from memory of standard histories, so check them before relying on them.
// Run it once: if the network already exists, it stops.

const BASE = process.argv[2] || 'http://localhost:8100';
const NETWORK_NAME = 'The Cold War: from the end of WWII to 1991';

const WIDTH = 480; // group width
const CARD_ROW = 170; // vertical distance between member rows
const GROUP_GAP = 60; // space between groups

// Each era is a group. Members are listed in reading order: two per row.
const GROUPS = [
  {
    key: 'origins',
    title: 'Origins (1945–1947)',
    members: [
      { key: 'ww2', title: 'World War II', url: 'https://en.wikipedia.org/wiki/World_War_II',
        commentary: '1939–1945. The Soviet Union, the United States and Britain fought together against Nazi Germany and Imperial Japan. The alliance held together under war pressure, and its disagreements over the postwar order were postponed, not settled.' },
      { key: 'yalta', title: 'Yalta Conference', url: 'https://en.wikipedia.org/wiki/Yalta_Conference',
        commentary: 'February 1945: Roosevelt, Churchill and Stalin agreed on occupation zones for Germany, the United Nations, and Soviet entry into the war against Japan. Their vague promises on free elections in Poland became early Cold War disputes.' },
      { key: 'potsdam', title: 'Potsdam Conference', url: 'https://en.wikipedia.org/wiki/Potsdam_Conference',
        commentary: 'July–August 1945: the Allies agreed to demilitarise and divide Germany. Truman told Stalin about a new weapon here, and the Soviet leadership later treated the atomic bomb as a warning.' },
      { key: 'hiroshima', title: 'Atomic bombings of Hiroshima and Nagasaki', url: 'https://en.wikipedia.org/wiki/Atomic_bombings_of_Hiroshima_and_Nagasaki',
        commentary: 'August 1945: the first and only use of nuclear weapons in war. They ended the Pacific war and began the nuclear age, in which nuclear deterrence came to shape the Cold War.' },
      { key: 'longtel', title: 'The Long Telegram (Kennan, 1946)', url: 'https://en.wikipedia.org/wiki/Long_Telegram',
        commentary: 'February 1946: George F. Kennan, the US chargé in Moscow, explained Soviet behaviour as expansionist and driven by insecurity. The cable became the intellectual basis of containment.' },
      { key: 'iron', title: 'Iron Curtain', url: 'https://en.wikipedia.org/wiki/Iron_Curtain',
        commentary: 'Churchill\'s March 1946 speech at Fulton, Missouri, described a divided Europe, with Soviet-controlled states on one side. The phrase became the name for the border between the two blocs.' },
      { key: 'containment', title: 'Containment', url: 'https://en.wikipedia.org/wiki/Containment',
        commentary: 'The US strategy of checking Soviet expansion through political, economic and military means, without direct war. Kennan\'s 1947 article in Foreign Affairs gave it its public form. It shaped US policy for decades.' },
      { key: 'cold', title: 'Cold War (overview)', url: 'https://en.wikipedia.org/wiki/Cold_War',
        commentary: 'The rivalry between the US and the Soviet Union and their allies, from about 1947 to 1991. It was fought with alliances, espionage, proxy wars, arms races and propaganda, but the two superpowers never fought each other directly.' },
    ],
  },
  {
    key: 'blocs',
    title: 'Blocs and first crises (1947–1955)',
    members: [
      { key: 'truman', title: 'Truman Doctrine', url: 'https://en.wikipedia.org/wiki/Truman_Doctrine',
        commentary: 'March 1947: aid to Greece and Turkey to resist communist pressure. It framed the conflict as a global struggle between free peoples and totalitarian regimes, and it made containment official policy.' },
      { key: 'marshall', title: 'Marshall Plan', url: 'https://en.wikipedia.org/wiki/Marshall_Plan',
        commentary: '1948–1952: about $13 billion of US aid for European reconstruction. It rebuilt Western economies and tied them to the US. The Soviet bloc answered by forming its own economic council.' },
      { key: 'comecon', title: 'Comecon', url: 'https://en.wikipedia.org/wiki/Comecon',
        commentary: 'The Council for Mutual Economic Assistance, founded in 1949 to coordinate the economies of the Soviet bloc. It was the Eastern answer to the Marshall Plan and never matched Western growth.' },
      { key: 'blockade', title: 'Berlin Blockade', url: 'https://en.wikipedia.org/wiki/Berlin_Blockade',
        commentary: 'June 1948 to May 1949: Stalin cut road, rail and canal access to West Berlin. The Western airlift supplied the city for about eleven months, and the crisis hardened the division of Germany.' },
      { key: 'nato', title: 'NATO', url: 'https://en.wikipedia.org/wiki/NATO',
        commentary: 'Founded in April 1949 as a collective defence alliance. An attack on one member is an attack on all (Article 5). It made a permanent US military commitment to Europe.' },
      { key: 'sovbomb', title: 'Soviet atomic bomb project', url: 'https://en.wikipedia.org/wiki/Soviet_atomic_bomb_project',
        commentary: 'The USSR tested its first atomic bomb in August 1949, ending the US nuclear monopoly. The arms race that followed became the central fact of the Cold War.' },
      { key: 'chinese', title: 'Chinese Civil War', url: 'https://en.wikipedia.org/wiki/Chinese_Civil_War',
        commentary: 'Ended in 1949 with the communist victory and the proclamation of the People\'s Republic of China. The most populous country joined the communist side, which changed the balance of power in Asia.' },
      { key: 'korea', title: 'Korean War', url: 'https://en.wikipedia.org/wiki/Korean_War',
        commentary: '1950–1953: the first major hot war of the Cold War, fought over the division of Korea. It turned containment into a military commitment in Asia, and it drove the US rearmament that followed.' },
      { key: 'warsaw', title: 'Warsaw Pact', url: 'https://en.wikipedia.org/wiki/Warsaw_Pact',
        commentary: 'Founded in 1955 as the Soviet bloc\'s military alliance, in direct response to West Germany joining NATO. It kept Soviet troops in Eastern Europe and enforced the bloc\'s unity.' },
    ],
  },
  {
    key: 'confrontation',
    title: 'Confrontation (1956–1972)',
    members: [
      { key: 'hungary', title: 'Hungarian Revolution of 1956', url: 'https://en.wikipedia.org/wiki/Hungarian_Revolution_of_1956',
        commentary: 'The uprising against Soviet-backed rule was crushed by Soviet troops in November 1956. The West did not intervene, and the bloc showed it would enforce its control by force.' },
      { key: 'sputnik', title: 'Sputnik 1', url: 'https://en.wikipedia.org/wiki/Sputnik_1',
        commentary: 'October 1957: the first artificial satellite, launched by the USSR. It shocked the United States, began the space race, and drove heavy US investment in science and missiles.' },
      { key: 'space', title: 'Space Race', url: 'https://en.wikipedia.org/wiki/Space_Race',
        commentary: 'A contest in rockets and spaceflight, marked by Gagarin\'s orbit (1961) and the Apollo 11 landing (1969). It was technology and propaganda at once, a public test of the two systems.' },
      { key: 'bay', title: 'Bay of Pigs Invasion', url: 'https://en.wikipedia.org/wiki/Bay_of_Pigs_Invasion',
        commentary: 'April 1961: a CIA-backed landing of Cuban exiles failed. Cuba moved closer to the Soviet Union, and the failure set up the confrontation of the following year.' },
      { key: 'berlinwall', title: 'Berlin Wall', url: 'https://en.wikipedia.org/wiki/Berlin_Wall',
        commentary: 'Built from August 1961 to stop emigration from East Germany to the West. It became the symbol of the Cold War division and stood until November 1989.' },
      { key: 'cuban', title: 'Cuban Missile Crisis', url: 'https://en.wikipedia.org/wiki/Cuban_missile_crisis',
        commentary: 'October 1962: Soviet nuclear missiles in Cuba and a US naval quarantine brought the world closest to nuclear war. It ended with Soviet missiles withdrawn and a US pledge not to invade Cuba. US missiles in Turkey were removed secretly.' },
      { key: 'mad', title: 'Mutual assured destruction', url: 'https://en.wikipedia.org/wiki/Mutual_assured_destruction',
        commentary: 'The doctrine that a full nuclear exchange would destroy both sides, so neither would start one. It stabilised the superpower rivalry and encouraged arms-control talks.' },
      { key: 'nuclear', title: 'Nuclear arms race', url: 'https://en.wikipedia.org/wiki/Nuclear_arms_race',
        commentary: 'The build-up of nuclear arsenals from the 1950s, with thousands of warheads and intercontinental missiles. Its cost and danger drove the later arms-control agreements.' },
      { key: 'domino', title: 'Domino theory', url: 'https://en.wikipedia.org/wiki/Domino_theory',
        commentary: 'The belief that if one country fell to communism, its neighbours would follow. It justified US intervention in Southeast Asia, and the later outcome in the region discredited it.' },
      { key: 'vietnam', title: 'Vietnam War', url: 'https://en.wikipedia.org/wiki/Vietnam_War',
        commentary: 'US involvement grew through the 1960s to fight communist forces in South Vietnam. It drained US resources and political support, and it exposed the limits of containment.' },
      { key: 'prague', title: 'Prague Spring', url: 'https://en.wikipedia.org/wiki/Prague_Spring',
        commentary: '1968 reforms under Alexander Dubček. Warsaw Pact troops invaded in August and ended them. The invasion was the occasion for the Brezhnev Doctrine.' },
      { key: 'brezhnev', title: 'Brezhnev Doctrine', url: 'https://en.wikipedia.org/wiki/Brezhnev_Doctrine',
        commentary: 'Soviet policy that the USSR may intervene in a socialist state when socialism there is threatened. It made reform in the Eastern bloc depend on Moscow\'s approval.' },
    ],
  },
  {
    key: 'detente-era',
    title: 'Détente and new fronts (1972–1985)',
    members: [
      { key: 'detente', title: 'Détente', url: 'https://en.wikipedia.org/wiki/D%C3%A9tente',
        commentary: 'A relaxation of superpower tension in the early 1970s, through arms control, trade and diplomacy under Nixon, Kissinger and Brezhnev. It was weakened by Soviet moves in Africa and by the war in Afghanistan.' },
      { key: 'salt', title: 'Strategic Arms Limitation Talks', url: 'https://en.wikipedia.org/wiki/Strategic_Arms_Limitation_Talks',
        commentary: 'SALT I (1972) limited missile launchers and the anti-ballistic missile systems. SALT II (1979) was signed but never ratified by the US Senate. Both set the pattern of negotiated limits.' },
      { key: 'sino', title: 'Sino-Soviet split', url: 'https://en.wikipedia.org/wiki/Sino-Soviet_split',
        commentary: 'The rift between China and the USSR over ideology and borders, which grew through the 1960s. It let the US open relations with China in 1972 and weakened the communist bloc as a single force.' },
      { key: 'afghan', title: 'Soviet–Afghan War', url: 'https://en.wikipedia.org/wiki/Soviet%E2%80%93Afghan_War',
        commentary: 'December 1979 to February 1989: a costly Soviet occupation fought against the Afghan mujahideen, who received outside support including from the US. It drained Soviet resources and became a symbol of overreach.' },
      { key: 'solidarity', title: 'Solidarity (Polish trade union)', url: 'https://en.wikipedia.org/wiki/Solidarity_(Polish_trade_union)',
        commentary: 'The independent trade union founded in Poland in 1980. It was the first such union in the Soviet bloc with mass membership. Martial law in 1981 suppressed it, but its survival showed the limits of communist rule.' },
      { key: 'sdi', title: 'Strategic Defense Initiative', url: 'https://en.wikipedia.org/wiki/Strategic_Defense_Initiative',
        commentary: 'Proposed by Reagan in 1983 as a shield against ballistic missiles. Its technical promise was doubtful, but it pressured Soviet planners to match it, adding to their economic strain.' },
      { key: 'reagan', title: 'Reagan Doctrine', url: 'https://en.wikipedia.org/wiki/Reagan_Doctrine',
        commentary: 'From 1985: US support for anti-communist movements in the Third World, including the Afghan mujahideen and the Nicaraguan contras. It raised the cost of Soviet commitments abroad.' },
    ],
  },
  {
    key: 'collapse',
    title: 'Collapse (1985–1991)',
    members: [
      { key: 'gorbachev', title: 'Mikhail Gorbachev', url: 'https://en.wikipedia.org/wiki/Mikhail_Gorbachev',
        commentary: 'General Secretary of the Soviet Communist Party from 1985. His reforms opened the system and ended the policy of forcing change with Soviet troops, and they led to the end of the USSR.' },
      { key: 'perestroika', title: 'Perestroika', url: 'https://en.wikipedia.org/wiki/Perestroika',
        commentary: 'Economic restructuring from 1985. It loosened central planning but did not bring growth, and it weakened the party\'s control of the economy.' },
      { key: 'glasnost', title: 'Glasnost', url: 'https://en.wikipedia.org/wiki/Glasnost',
        commentary: 'Openness: a freer press, public debate and a reappraisal of Soviet history. It exposed the system\'s failures and encouraged nationalist and reform movements inside the USSR.' },
      { key: 'withdraw', title: 'Soviet withdrawal from Afghanistan', url: 'https://en.wikipedia.org/wiki/Soviet%E2%80%93Afghan_War',
        commentary: 'Gorbachev withdrew Soviet troops between 1988 and February 1989. It ended a costly commitment and signalled that Moscow would no longer prop up its allies by force.' },
      { key: 'revs1989', title: 'Revolutions of 1989', url: 'https://en.wikipedia.org/wiki/Revolutions_of_1989',
        commentary: 'The collapse of communist rule across Central and Eastern Europe, from Poland and Hungary to Czechoslovakia, Bulgaria and Romania. Moscow did not send troops to prop up the regimes.' },
      { key: 'wallfall', title: 'Fall of the Berlin Wall', url: 'https://en.wikipedia.org/wiki/Berlin_Wall',
        commentary: 'On 9 November 1989 East Germany opened its borders, and crowds crossed and dismantled the wall. German reunification followed in October 1990.' },
      { key: 'dissolution', title: 'Dissolution of the Soviet Union', url: 'https://en.wikipedia.org/wiki/Dissolution_of_the_Soviet_Union',
        commentary: 'On 31 December 1991 the USSR ceased to exist, and its republics became independent states. This ended the central rivalry of the Cold War.' },
    ],
  },
];

// Notes sit above the groups and are not members of any group.
const NOTES = [
  { key: 'note-causes', title: 'Note: why the Cold War began',
    commentary: 'Ideological rivalry between capitalism and communism, a power vacuum in Europe after 1945, nuclear weapons that made direct war unthinkable, and mutual fear. Each side\'s security measures looked threatening to the other, which historians call the security dilemma.' },
  { key: 'note-end', title: 'Note: why it ended',
    commentary: 'Economic strain from the arms race and the planned economy, failed reform, the loss of control over Eastern Europe once force was ruled out, and popular movements such as Solidarity. Gorbachev\'s choices made the end largely peaceful. Historians still debate the weight of each cause.' },
  { key: 'note-turning', title: 'Note: turning points',
    commentary: '1945 Yalta and Potsdam, and the atomic bombs. 1947 Truman Doctrine and Marshall Plan. 1949 NATO and the Soviet bomb. 1962 Cuban Missile Crisis. 1972 SALT I. 1979 Afghanistan. 1989 the Berlin Wall falls. 1991 the USSR is dissolved.' },
  { key: 'note-reading', title: 'Note: how to read this network',
    commentary: 'Each group is an era, and the links show cause, response and influence. Hover a node to preview its page and click it to pin the card. Use Edit to add your own commentary. Some pages may refuse embedding; use Open ↗ for those.' },
];

// [from, to, relationship]
const EDGES = [
  ['ww2', 'yalta', 'LED_TO'],
  ['yalta', 'potsdam', 'LED_TO'],
  ['yalta', 'iron', 'LED_TO'],
  ['hiroshima', 'sovbomb', 'SPURRED'],
  ['potsdam', 'hiroshima', 'PRECEDED'],
  ['longtel', 'containment', 'INFORMED'],
  ['containment', 'truman', 'SHAPED'],
  ['iron', 'containment', 'DESCRIBES'],
  ['truman', 'marshall', 'LED_TO'],
  ['marshall', 'comecon', 'PROVOKED'],
  ['marshall', 'blockade', 'CONTRIBUTED_TO'],
  ['blockade', 'nato', 'LED_TO'],
  ['nato', 'warsaw', 'PROVOKED'],
  ['sovbomb', 'nuclear', 'ACCELERATED'],
  ['chinese', 'korea', 'PRECEDED'],
  ['korea', 'nato', 'ACCELERATED'],
  ['cold', 'containment', 'DEFINED_BY'],
  ['cold', 'mad', 'DEFINED_BY'],
  ['hungary', 'warsaw', 'DEMONSTRATED'],
  ['sputnik', 'space', 'SPURRED'],
  ['bay', 'cuban', 'ACCELERATED'],
  ['berlinwall', 'iron', 'SYMBOLIZES'],
  ['cuban', 'mad', 'LED_TO'],
  ['nuclear', 'salt', 'LED_TO'],
  ['mad', 'nuclear', 'RESTRAINED'],
  ['domino', 'vietnam', 'JUSTIFIED'],
  ['vietnam', 'detente', 'LED_TO'],
  ['prague', 'brezhnev', 'PROVOKED'],
  ['detente', 'salt', 'PRODUCED'],
  ['sino', 'detente', 'ENABLED'],
  ['afghan', 'detente', 'UNDERMINED'],
  ['afghan', 'reagan', 'PROVOKED'],
  ['solidarity', 'brezhnev', 'CHALLENGED'],
  ['sdi', 'gorbachev', 'PRESSURED'],
  ['gorbachev', 'perestroika', 'LAUNCHED'],
  ['gorbachev', 'glasnost', 'LAUNCHED'],
  ['gorbachev', 'withdraw', 'ORDERED'],
  ['withdraw', 'revs1989', 'ENCOURAGED'],
  ['perestroika', 'revs1989', 'ENCOURAGED'],
  ['glasnost', 'revs1989', 'ENCOURAGED'],
  ['solidarity', 'revs1989', 'PRECEDED'],
  ['revs1989', 'wallfall', 'INCLUDES'],
  ['revs1989', 'dissolution', 'LED_TO'],
  ['dissolution', 'cold', 'ENDED'],
  ['note-causes', 'containment', 'SUMMARIZES'],
  ['note-causes', 'mad', 'SUMMARIZES'],
  ['note-end', 'gorbachev', 'SUMMARIZES'],
  ['note-end', 'solidarity', 'SUMMARIZES'],
  ['note-turning', 'yalta', 'SUMMARIZES'],
  ['note-turning', 'cuban', 'SUMMARIZES'],
  ['note-turning', 'dissolution', 'SUMMARIZES'],
];

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
  const existing = await call('GET', '/networks');
  if (existing.some((n) => n.name === NETWORK_NAME)) {
    console.log(`"${NETWORK_NAME}" already exists. Delete it in Graphin first, then run this again.`);
    return;
  }

  const network = await call('POST', '/networks', { name: NETWORK_NAME });
  const ids = new Map();
  let x = 0;

  // Groups first, each sized to hold its members in two columns.
  for (const group of GROUPS) {
    const rows = Math.ceil(group.members.length / 2);
    const height = 80 + rows * CARD_ROW + 40;
    const created = await call('POST', `/networks/${network.id}/nodes`, {
      type: 'group',
      title: group.title,
      x,
      y: 0,
      width: WIDTH,
      height,
    });
    ids.set(group.key, created.id);

    group.members.forEach((member, index) => {
      member.x = x + 40 + (index % 2) * 210;
      member.y = 80 + Math.floor(index / 2) * CARD_ROW;
      member.group = group.key;
    });
    x += WIDTH + GROUP_GAP;
  }

  // The notes go above the groups.
  NOTES.forEach((note, index) => {
    note.x = index * (WIDTH + GROUP_GAP);
    note.y = -320;
  });

  const members = GROUPS.flatMap((group) => group.members);
  for (const member of members) {
    const created = await call('POST', `/networks/${network.id}/nodes`, {
      title: member.title,
      url: member.url,
      commentary: member.commentary,
      x: member.x,
      y: member.y,
    });
    ids.set(member.key, created.id);
  }
  for (const note of NOTES) {
    const created = await call('POST', `/networks/${network.id}/nodes`, {
      type: 'note',
      title: note.title,
      commentary: note.commentary,
      x: note.x,
      y: note.y,
    });
    ids.set(note.key, created.id);
  }

  // Membership: each member belongs to its era group, drawn as containment.
  for (const member of members) {
    await call('POST', `/networks/${network.id}/edges`, {
      source_id: ids.get(member.key),
      target_id: ids.get(member.group),
      relationship: 'BELONGS_TO',
    });
  }

  for (const [from, to, relationship] of EDGES) {
    if (!ids.has(from) || !ids.has(to)) {
      throw new Error(`Unknown key in edge ${from} -> ${to}`);
    }
    await call('POST', `/networks/${network.id}/edges`, {
      source_id: ids.get(from),
      target_id: ids.get(to),
      relationship,
    });
  }

  const nodeCount = members.length + NOTES.length + GROUPS.length;
  console.log(`Created "${NETWORK_NAME}": ${nodeCount} nodes (${GROUPS.length} groups), ${EDGES.length + members.length} relationships.`);
  console.log(`Open it at ${BASE}/#/networks/${network.id}`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});

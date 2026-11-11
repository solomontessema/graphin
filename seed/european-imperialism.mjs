// Builds the network "European imperialism and colonization, 1415 to today" through the Graphin API. It uses most of what
// Graphin offers: a time for every dated event (time slider and Timeline layout), a place for each (Map and Geo layout),
// tags in three layers (a category first, then power, region and theme), tagged links, shapes behind each era, text
// labels, notes with questions to discuss, and references. Tiles that carry two different relationships show how two
// items can be joined by more than one link.
//
//   GRAPHIN_EMAIL=you@example.com GRAPHIN_PASSWORD=secret node seed/european-imperialism.mjs https://graphin.org/index.php
//   node seed/european-imperialism.mjs                       (local: http://localhost:8100)
//
// Try: Tags (colour by Border, filter "slavery" or "contested"), Map on, the time slider, Layout > Timeline or Geo.
// Run it once: if the network already exists, it stops.

import { login } from './login.mjs';

const BASE = process.argv[2] || 'http://localhost:8100';
const SITE = BASE.replace(/\/index\.php$/, '');
const NAME = 'European imperialism and colonization, 1415 to today';
const W = 'https://en.wikipedia.org/wiki/';

// Eras are columns, left to right; lanes are rows. A tile sits in one of up to eight slots in its era and lane:
// four columns (dx) and two rows (dy).
const ERA = { discovery: 0, mercantile: 1400, industrial: 2800, scramble: 4200, after: 5600 };
const LANE = { expansion: 0, resistance: 420, idea: 840 };
const COL = [0, 320, 640, 960];
const ROW = [0, 170];

// key, kind ('note' for a note; otherwise a web page), title, era, lane, slot [column, row], time, place, tags (first is the
// category: conquest, commerce, diplomacy, resistance, idea, legacy), url, text, refs
const NODES = [
  // ================= 1415 to 1600: conquest and silver
  { key: 'ceuta', title: 'Portugal takes Ceuta', era: 'discovery', lane: 'expansion', slot: [0, 0], time: '1415-08', lat: 35.89, lon: -5.32, country: 'Morocco',
    tags: ['conquest', 'portugal', 'africa', 'trade'], url: W + 'Conquest_of_Ceuta',
    text: `Portugal captured the Moroccan port in 1415. It is often taken as the start of European overseas empire. The prize was gold, trade and a base against Muslim power; the voyages that followed down the West African coast looked for gold and a sea route to Asia.` },
  { key: 'elmina', title: 'Elmina: a fort for gold, later for people', era: 'discovery', lane: 'expansion', slot: [1, 1], time: '1482', lat: 5.08, lon: -1.35, country: 'Ghana',
    tags: ['commerce', 'portugal', 'africa', 'slavery'], url: W + 'Elmina_Castle',
    text: `Portugal built Elmina on the Gold Coast to trade for gold. In the 1500s it began shipping enslaved Africans too, and the Dutch took it in 1637. It stands for how a trading post became part of the Atlantic slave trade.` },
  { key: 'columbus', title: 'Columbus reaches the Caribbean', era: 'discovery', lane: 'expansion', slot: [1, 0], time: '1492-10', lat: 24.05, lon: -74.5, country: 'Bahamas',
    tags: ['conquest', 'spain', 'americas', 'columbian exchange'], url: W + 'Voyages_of_Christopher_Columbus',
    text: `Sailing for Spain in search of Asia, Columbus landed in the Bahamas in October 1492. Spanish colonies on Hispaniola followed within a year. Contact between the Americas and the rest of the world became permanent, with huge consequences for the people who already lived there.` },
  { key: 'tordesillas', title: 'Treaty of Tordesillas', era: 'discovery', lane: 'expansion', slot: [2, 0], time: '1494-06', lat: 41.5, lon: -4.95, country: 'Spain',
    tags: ['diplomacy', 'spain', 'portugal', 'treaty'], url: W + 'Treaty_of_Tordesillas',
    text: `Spain and Portugal, with the Pope's backing, agreed to divide the non-European world along a line west of Cape Verde. Other powers never accepted it. It helps explain why Brazil speaks Portuguese while most of Latin America speaks Spanish.` },
  { key: 'dagama', title: 'Da Gama reaches India', era: 'discovery', lane: 'expansion', slot: [2, 1], time: '1498-05', lat: 11.25, lon: 75.78, country: 'India',
    tags: ['commerce', 'portugal', 'asia', 'spice trade'], url: W + 'Vasco_da_Gama',
    text: `The first European sea route to India. Portugal then built a chain of fortified ports, from Goa (1510) to Malacca (1511), to control the spice trade by force at sea. It was an empire of coasts and trade, not of territory.` },
  { key: 'cortes', title: 'Fall of the Aztec Empire', era: 'discovery', lane: 'expansion', slot: [3, 0], time: '1521-08', lat: 19.43, lon: -99.13, country: 'Mexico',
    tags: ['conquest', 'spain', 'americas', 'disease', 'contested'], url: W + 'Spanish_conquest_of_the_Aztec_Empire',
    text: `Cortes took Tenochtitlan in 1521. He did not do it alone: thousands of Indigenous allies, especially Tlaxcalans who resented Aztec rule, fought with the Spanish, and smallpox struck the city. Historians still argue over how much weight to give each cause.` },
  { key: 'pizarro', title: 'Fall of the Inca Empire', era: 'discovery', lane: 'expansion', slot: [3, 1], time: '1532-11', lat: -7.16, lon: -78.5, country: 'Peru',
    tags: ['conquest', 'spain', 'americas', 'disease'], url: W + 'Spanish_conquest_of_the_Inca_Empire',
    text: `Pizarro captured the Inca ruler Atahualpa at Cajamarca in 1532. The empire was already weakened by a civil war and by epidemics that spread ahead of the Spanish. Resistance went on for decades afterwards.` },
  { key: 'potosi', title: 'The silver of Potosi', era: 'discovery', lane: 'expansion', slot: [0, 1], time: '1545', lat: -19.58, lon: -65.75, country: 'Bolivia',
    tags: ['commerce', 'spain', 'americas', 'extraction', 'forced labour'], url: W + 'Potos%C3%AD',
    text: `A mountain of silver found in 1545. Indigenous workers were drafted into the mines under the mita labour system. The silver paid for Spanish wars, flowed on to China, and tied the world's economies together. It is an early picture of empire as extraction.`,
    refs: [{ url: W + 'Mercantilism', title: 'The economic thinking behind it' }] },

  { key: 'neoinca', title: 'Neo-Inca State holds out', era: 'discovery', lane: 'resistance', slot: [3, 0], time: '1572', lat: -12.9, lon: -72.9, country: 'Peru',
    tags: ['resistance', 'spain', 'americas', 'indigenous', 'rebellion'], url: W + 'Neo-Inca_State',
    text: `After Manco Inca's rebellion in 1536, the Inca court withdrew to Vilcabamba and kept fighting for 36 years. Spain executed the last ruler, Tupac Amaru, in 1572. Conquest was a long war, not a single defeat.` },

  { key: 'columbian', title: 'The Columbian Exchange', era: 'discovery', lane: 'idea', slot: [0, 0], time: '1492',
    tags: ['idea', 'disease', 'americas', 'trade', 'evidence: strong'], url: W + 'Columbian_exchange',
    text: `Crops moved both ways: potatoes, maize and tomatoes went east; wheat, sugar and horses went west. So did diseases. Illnesses new to the Americas killed a large share of the people there within decades. How large is argued, because estimates of the pre-contact population differ widely.` },
  { key: 'doctrine', title: 'The Doctrine of Discovery', era: 'discovery', lane: 'idea', slot: [1, 0], time: '1493-05', lat: 41.9, lon: 12.5, country: 'Italy',
    tags: ['idea', 'religion', 'law', 'spain', 'contested'], url: W + 'Discovery_doctrine',
    text: `Papal bulls such as Inter caetera (1493) gave Christian rulers a claim to lands not already held by Christians. Later European lawyers turned the idea into a rule of international law. It is still discussed in Indigenous land-rights cases and in apologies by churches.`,
    refs: [{ url: W + 'Inter_caetera', title: 'The 1493 papal bull' }] },
  { key: 'valladolid', title: 'The debate at Valladolid', era: 'discovery', lane: 'idea', slot: [2, 0], time: '1550', lat: 41.65, lon: -4.73, country: 'Spain',
    tags: ['idea', 'spain', 'religion', 'race', 'contested'], url: W + 'Valladolid_debate',
    text: `Bartolome de las Casas argued that Indigenous Americans were fully human and should not be enslaved. Juan Gines de Sepulveda argued the opposite. Neither side clearly won, and Las Casas himself was criticised for first suggesting that Africans be enslaved instead, something he later regretted.`,
    refs: [{ url: W + 'Bartolom%C3%A9_de_las_Casas', title: 'Las Casas' }] },

  // ================= 1600 to 1800: companies and plantations
  { key: 'eic', title: 'The British East India Company', era: 'mercantile', lane: 'expansion', slot: [0, 0], time: '1600-12', lat: 51.51, lon: -0.08, country: 'United Kingdom',
    tags: ['commerce', 'britain', 'asia', 'company rule'], url: W + 'East_India_Company',
    text: `Chartered on the last day of 1600 as a trading company. Within 150 years it had an army larger than most states, and it ended up ruling much of India. A private company running a country is one of the strangest facts of the story.` },
  { key: 'voc', title: 'The Dutch East India Company (VOC)', era: 'mercantile', lane: 'expansion', slot: [1, 0], time: '1602-03', lat: -6.21, lon: 106.85, country: 'Indonesia',
    tags: ['commerce', 'netherlands', 'asia', 'company rule', 'extraction'], url: W + 'Dutch_East_India_Company',
    text: `The first company to sell shares to the public, with a state monopoly and its own warships. It founded Batavia (now Jakarta) in 1619 and enforced its spice monopoly with violence, including the killing or enslaving of most people on the Banda Islands in 1621.` },
  { key: 'jamestown', title: 'Jamestown, the first lasting English colony', era: 'mercantile', lane: 'expansion', slot: [2, 0], time: '1607-05', lat: 37.21, lon: -76.78, country: 'United States',
    tags: ['conquest', 'britain', 'americas', 'settler colonialism', 'tobacco'], url: W + 'Jamestown,_Virginia',
    text: `Founded in 1607 and kept alive by tobacco. The first enslaved Africans arrived in Virginia in 1619. Settlers took Powhatan land, and wars followed. Here empire meant settling and taking land, not only trading.` },
  { key: 'newfrance', title: 'New France: Quebec and the fur trade', era: 'mercantile', lane: 'expansion', slot: [3, 0], time: '1608-07', lat: 46.81, lon: -71.21, country: 'Canada',
    tags: ['commerce', 'france', 'americas', 'fur trade', 'alliances'], url: W + 'New_France',
    text: `France built a colony on the St Lawrence on fur, with a small settler population and alliances with Indigenous nations such as the Huron-Wendat. It is a reminder that European empires depended on local partners, and that those partnerships shaped who won later wars.` },
  { key: 'cape', title: 'The Dutch Cape Colony', era: 'mercantile', lane: 'expansion', slot: [0, 1], time: '1652-04', lat: -33.92, lon: 18.42, country: 'South Africa',
    tags: ['conquest', 'netherlands', 'africa', 'settler colonialism', 'slavery'], url: W + 'Dutch_Cape_Colony',
    text: `A refreshment station for VOC ships that grew into a settler colony. Local Khoikhoi lost their land and cattle, and enslaved people were brought in from Africa and Asia. The roots of later South African history lie here.` },
  { key: 'triangular', title: 'Plantation slavery and the Atlantic trade', era: 'mercantile', lane: 'expansion', slot: [1, 1], time: '1700', lat: 18.0, lon: -76.8, country: 'Jamaica',
    tags: ['commerce', 'britain', 'atlantic', 'slavery', 'extraction', 'evidence: strong'], url: W + 'Atlantic_slave_trade',
    text: `Over four centuries about 12.5 million people were put on ships in Africa, and roughly 10.7 million survived the crossing. Sugar, tobacco and cotton from the plantations they worked made fortunes in European ports. The trade was at its height in the 1700s.`,
    refs: [{ url: 'https://www.slavevoyages.org/', title: 'Slave Voyages: the database of voyages' }] },
  { key: 'plassey', title: 'The Battle of Plassey', era: 'mercantile', lane: 'expansion', slot: [2, 1], time: '1757-06', lat: 23.8, lon: 88.25, country: 'India',
    tags: ['conquest', 'britain', 'asia', 'company rule', 'contested'], url: W + 'Battle_of_Plassey',
    text: `Robert Clive's small force beat the Nawab of Bengal in 1757, helped by the Nawab's own commander, who had been bribed to stand aside. In 1765 the Company took over Bengal's tax collection. Historians debate whether it was a battle or a deal.`,
    refs: [{ url: W + 'Robert_Clive', title: 'Robert Clive' }] },
  { key: 'sevenyears', title: "The Seven Years' War and the Treaty of Paris", era: 'mercantile', lane: 'expansion', slot: [3, 1], time: '1763-02', lat: 48.86, lon: 2.35, country: 'France',
    tags: ['diplomacy', 'britain', 'france', 'americas', 'asia', 'treaty'], url: W + 'Treaty_of_Paris_(1763)',
    text: `The first truly global war. France gave up Canada and the lands east of the Mississippi to Britain, and British power in India was left unchallenged by France. The war's cost also set Britain on the taxing of its American colonies.` },

  { key: 'palmares', title: 'Palmares: a free kingdom of the escaped', era: 'mercantile', lane: 'resistance', slot: [0, 0], time: '1694-02', lat: -9.0, lon: -36.0, country: 'Brazil',
    tags: ['resistance', 'portugal', 'americas', 'slavery', 'maroon'], url: W + 'Quilombo_dos_Palmares',
    text: `A large community of people who escaped slavery in northeast Brazil, lasting most of the 1600s and holding off Portuguese and Dutch attacks until its fall in 1694. Maroon communities across the Americas show that enslaved people resisted in every way they could.` },
  { key: 'americanrev', title: 'The American Revolution', era: 'mercantile', lane: 'resistance', slot: [1, 0], time: '1776-07', lat: 39.95, lon: -75.15, country: 'United States',
    tags: ['resistance', 'britain', 'americas', 'independence', 'settler colonialism', 'contested'], url: W + 'American_Revolution',
    text: `Settlers rebelled against rule from London and founded a republic. For Indigenous peoples and for the enslaved, independence did not bring the freedoms it promised. It is both a revolt against an empire and the start of a new one expanding west.` },
  { key: 'tupac', title: 'The Tupac Amaru II rebellion', era: 'mercantile', lane: 'resistance', slot: [2, 0], time: '1780-11', lat: -13.52, lon: -71.97, country: 'Peru',
    tags: ['resistance', 'spain', 'americas', 'indigenous', 'rebellion'], url: W + 'T%C3%BApac_Amaru_II',
    text: `A descendant of the last Inca ruler led a huge uprising against Spanish rule in the Andes in 1780. It was put down with great cruelty, and Spain banned many Inca symbols afterwards. The name later inspired movements in Peru and beyond.` },
  { key: 'haiti', title: 'The Haitian Revolution', era: 'mercantile', lane: 'resistance', slot: [3, 0], time: '1791-08', lat: 19.76, lon: -72.2, country: 'Haiti',
    tags: ['resistance', 'france', 'americas', 'slavery', 'independence', 'evidence: strong'], url: W + 'Haitian_Revolution',
    text: `Enslaved people in the richest French colony rose in 1791. Under leaders such as Toussaint Louverture they defeated French, Spanish and British armies, and Haiti became independent in 1804, the first state founded by formerly enslaved people. In 1825 France forced Haiti to pay a huge indemnity for its freedom.`,
    refs: [{ url: W + 'Toussaint_Louverture', title: 'Toussaint Louverture' }] },

  { key: 'mercantilism', title: 'Mercantilism', era: 'mercantile', lane: 'idea', slot: [0, 0], time: '1651',
    tags: ['idea', 'economy', 'extraction', 'europe'], url: W + 'Mercantilism',
    text: `The idea that a state grows rich by selling more than it buys and by holding gold and silver. Colonies were meant to supply raw materials and to be captive markets. England's Navigation Acts of 1651 required colonial trade to go on English ships.` },
  { key: 'abolitionism', title: 'The abolitionist movement', era: 'mercantile', lane: 'idea', slot: [1, 0], time: '1787-05', lat: 51.51, lon: -0.12, country: 'United Kingdom',
    tags: ['idea', 'britain', 'slavery', 'reform', 'evidence: strong'], url: W + 'Abolitionism_in_the_United_Kingdom',
    text: `In 1787 a group of Quakers and Anglicans founded a society in London to end the slave trade. They used pamphlets, petitions, boycotts of slave-grown sugar and the testimony of formerly enslaved people such as Olaudah Equiano. It was one of the first mass campaigns of its kind.` },

  // ================= 1800 to 1870: industry, free trade and revolt
  { key: 'algeria', title: 'The French conquest of Algeria', era: 'industrial', lane: 'expansion', slot: [0, 0], time: '1830-07', lat: 36.75, lon: 3.06, country: 'Algeria',
    tags: ['conquest', 'france', 'africa', 'settler colonialism', 'violence'], url: W + 'French_conquest_of_Algeria',
    text: `France took Algiers in 1830 and fought for decades to control the country. Algeria was later declared part of France itself, and a large European settler population, the pieds-noirs, took the best land. The legacy of this settlement shaped a bitter independence war.` },
  { key: 'opium', title: 'The First Opium War', era: 'industrial', lane: 'expansion', slot: [1, 0], time: '1839-09', lat: 22.3, lon: 114.17, country: 'Hong Kong',
    tags: ['conquest', 'britain', 'asia', 'opium', 'free trade'], url: W + 'First_Opium_War',
    text: `China tried to stop the import of opium, much of it grown in British India. Britain went to war to protect the trade and to force China to open its markets. It is a stark example of imperial power used to defend a drug trade.` },
  { key: 'nanking', title: 'The Treaty of Nanking and the unequal treaties', era: 'industrial', lane: 'expansion', slot: [2, 0], time: '1842-08', lat: 32.05, lon: 118.78, country: 'China',
    tags: ['diplomacy', 'britain', 'asia', 'treaty', 'free trade'], url: W + 'Treaty_of_Nanking',
    text: `China gave Hong Kong to Britain, opened five ports, paid a large indemnity and accepted that foreigners would be tried by their own courts. Other powers demanded the same. The treaties became a lasting symbol of national humiliation in China.`,
    refs: [{ url: W + 'Unequal_treaties', title: 'The unequal treaties' }] },
  { key: 'suez', title: 'The Suez Canal opens', era: 'industrial', lane: 'expansion', slot: [3, 0], time: '1869-11', lat: 30.46, lon: 32.35, country: 'Egypt',
    tags: ['commerce', 'france', 'britain', 'africa', 'middle east', 'technology'], url: W + 'Suez_Canal',
    text: `Built by a French company under Ferdinand de Lesseps, with Egyptian labour, it cut the sea route to India by thousands of kilometres. Britain bought Egypt's shares in 1875 and occupied the country in 1882 to protect the route.` },

  { key: 'latinindep', title: 'Latin American independence', era: 'industrial', lane: 'resistance', slot: [0, 0], time: '1824-12', lat: -13.16, lon: -74.22, country: 'Peru',
    tags: ['resistance', 'spain', 'americas', 'independence', 'contested'], url: W + 'Spanish_American_wars_of_independence',
    text: `Between 1810 and 1825 most of Spanish America broke away, led by Creole elites such as Bolivar and San Martin. The last big battle was Ayacucho in 1824. Independence changed who ruled, but Indigenous and Afro-descended people won much less than the new republics promised.` },
  { key: 'abolition1833', title: 'Britain ends slavery in its empire', era: 'industrial', lane: 'resistance', slot: [1, 0], time: '1833-08', lat: 51.5, lon: -0.12, country: 'United Kingdom',
    tags: ['diplomacy', 'britain', 'slavery', 'law', 'contested'], url: W + 'Slavery_Abolition_Act_1833',
    text: `Britain banned the slave trade in 1807 and slavery in most of its empire in 1833. The government paid about 20 million pounds in compensation, to slave owners and not to the enslaved, who were bound as unpaid apprentices until 1838. Debate continues over how much credit abolition deserves.`,
    refs: [{ url: 'https://www.ucl.ac.uk/lbs/', title: 'Legacies of British Slavery database (UCL)' }] },
  { key: 'abdelkader', title: "Abd el-Kader's resistance", era: 'industrial', lane: 'resistance', slot: [2, 1], time: '1832-11', lat: 35.4, lon: 0.14, country: 'Algeria',
    tags: ['resistance', 'france', 'africa', 'state-building'], url: W + 'Abdelkader_El_Djezairi',
    text: `A scholar and Sufi leader who built a state in the Algerian interior and fought the French from 1832 to 1847. He is remembered both as a national hero and for his later work protecting Christians in Damascus.` },
  { key: 'rebellion1857', title: 'The Indian Rebellion of 1857', era: 'industrial', lane: 'resistance', slot: [2, 0], time: '1857-05', lat: 28.61, lon: 77.21, country: 'India',
    tags: ['resistance', 'britain', 'asia', 'rebellion', 'company rule', 'contested'], url: W + 'Indian_Rebellion_of_1857',
    text: `It began as a revolt of Indian soldiers in the Company's army and spread across north India. It was crushed with great violence. The name itself is contested: British writers said mutiny, many Indians call it the first war of independence.` },
  { key: 'crownraj', title: 'The Crown takes over: the British Raj', era: 'industrial', lane: 'resistance', slot: [3, 0], time: '1858-08', lat: 28.61, lon: 77.21, country: 'India',
    tags: ['diplomacy', 'britain', 'asia', 'raj', 'law'], url: W + 'British_Raj',
    text: `After 1857 the British government ended Company rule and governed India directly. The Raj kept a policy of promising respect for Indian religions and customs while leaning on divisions between communities to hold power.` },

  { key: 'industrial', title: 'Steam, quinine and rifles: tools of empire', era: 'industrial', lane: 'idea', slot: [0, 0], time: '1850',
    tags: ['idea', 'technology', 'economy', 'contested'], url: W + 'Industrial_Revolution',
    text: `Steamships and the telegraph made distance matter less. Quinine let Europeans survive malaria in the tropics, and breech-loading rifles and machine guns gave small forces a large advantage. Historians such as Daniel Headrick call these the tools of empire, though not everyone agrees technology was decisive.` },
  { key: 'scientificracism', title: 'Scientific racism', era: 'industrial', lane: 'idea', slot: [1, 0], time: '1853',
    tags: ['idea', 'race', 'science', 'europe', 'contested'], url: W + 'Scientific_racism',
    text: `In the 1800s many European thinkers, among them Arthur de Gobineau (1853), claimed to show by science that human groups were unequal. The ideas were used to justify conquest and slavery. They were later discredited by genetics and anthropology, but they left deep marks.` },

  // ================= 1870 to 1914: the new imperialism
  { key: 'scramble', title: 'The Scramble for Africa', era: 'scramble', lane: 'expansion', slot: [0, 0], time: '1881', lat: 2.0, lon: 22.0, country: 'Africa',
    tags: ['conquest', 'europe', 'africa', 'borders', 'evidence: strong'], url: W + 'Scramble_for_Africa',
    text: `Around 1870 Europeans controlled roughly a tenth of Africa. By 1914 they held about nine tenths. Only Ethiopia and Liberia stayed independent. The pace was driven by rivalry between European powers as much as by anything in Africa.` },
  { key: 'berlin', title: 'The Berlin Conference', era: 'scramble', lane: 'expansion', slot: [1, 0], time: '1884-11', lat: 52.52, lon: 13.38, country: 'Germany',
    tags: ['diplomacy', 'germany', 'africa', 'borders', 'contested'], url: W + 'Berlin_Conference',
    text: `Fourteen states, with no African representatives, met in Berlin in 1884 and 1885 to agree rules for claiming African territory, including that a claim needed real occupation. A popular myth says they drew Africa's borders at the table. They did not: the borders came later, in many separate deals.` },
  { key: 'congo', title: 'The Congo Free State', era: 'scramble', lane: 'expansion', slot: [2, 0], time: '1885-02', lat: -4.32, lon: 15.31, country: 'DR Congo',
    tags: ['conquest', 'belgium', 'africa', 'forced labour', 'extraction', 'violence'], url: W + 'Congo_Free_State',
    text: `King Leopold II of Belgium ruled the Congo as his personal property. Villages had to deliver quotas of rubber, enforced by hostage-taking, mutilation and killing. The population fell sharply; estimates of the dead run to millions and the exact figure is debated. Campaigns by E. D. Morel and Roger Casement forced Belgium to take over in 1908.`,
    refs: [{ url: W + 'King_Leopold%27s_Ghost', title: "Adam Hochschild's history of the Congo" }] },
  { key: 'fashoda', title: 'The Fashoda Incident', era: 'scramble', lane: 'expansion', slot: [3, 0], time: '1898-09', lat: 9.88, lon: 32.12, country: 'South Sudan',
    tags: ['conquest', 'britain', 'france', 'africa', 'rivalry'], url: W + 'Fashoda_Incident',
    text: `A French expedition reached the Nile at Fashoda just as a British army arrived from the north. France backed down. The crisis ended British and French rivalry in Africa and helped lead to their friendly agreement of 1904, the Entente Cordiale.` },
  { key: 'indochina', title: 'French Indochina', era: 'scramble', lane: 'expansion', slot: [0, 1], time: '1887-10', lat: 21.03, lon: 105.85, country: 'Vietnam',
    tags: ['conquest', 'france', 'asia', 'extraction', 'rubber'], url: W + 'French_Indochina',
    text: `France joined Vietnam, Cambodia and later Laos into one colony run from Hanoi. Rubber plantations, rice exports and a state opium monopoly funded it. Vietnamese nationalists, including Ho Chi Minh, organised against it.` },
  { key: 'benin', title: 'The British expedition to Benin', era: 'scramble', lane: 'expansion', slot: [1, 1], time: '1897-02', lat: 6.34, lon: 5.63, country: 'Nigeria',
    tags: ['conquest', 'britain', 'africa', 'looting', 'restitution'], url: W + 'Benin_Expedition_of_1897',
    text: `A British force sacked Benin City in 1897 and took thousands of brass and ivory works of art, which were sold to museums across Europe and America. The Benin Bronzes are now at the centre of the debate on returning looted objects. Germany began returning pieces in 2022.` },
  { key: 'boerwar', title: 'The Second Boer War', era: 'scramble', lane: 'expansion', slot: [2, 1], time: '1899-10', lat: -26.2, lon: 28.04, country: 'South Africa',
    tags: ['conquest', 'britain', 'africa', 'settler colonialism', 'gold', 'camps'], url: W + 'Second_Boer_War',
    text: `Britain fought the Boer republics after gold was found in the Transvaal. Its scorched-earth tactics put civilians in concentration camps, where tens of thousands of Boer and Black African people died. Black South Africans fought and worked on both sides and gained nothing from the peace.` },
  { key: 'herero', title: 'The Herero and Nama genocide', era: 'scramble', lane: 'expansion', slot: [3, 1], time: '1904-01', lat: -22.57, lon: 17.08, country: 'Namibia',
    tags: ['conquest', 'germany', 'africa', 'genocide', 'settler colonialism', 'evidence: strong'], url: W + 'Herero_and_Nama_genocide',
    text: `The Herero and Nama rose against German settler rule in 1904. General von Trotha ordered the Herero driven out and killed, and survivors were pushed into the desert or sent to camps. Tens of thousands died. In 2021 Germany called it genocide and offered a development fund; many Herero and Nama leaders rejected the terms.`,
    refs: [{ url: W + 'Lothar_von_Trotha', title: 'General von Trotha' }] },

  { key: 'congress', title: 'The Indian National Congress is founded', era: 'scramble', lane: 'resistance', slot: [0, 0], time: '1885-12', lat: 18.96, lon: 72.82, country: 'India',
    tags: ['resistance', 'britain', 'asia', 'nationalism', 'independence'], url: W + 'Indian_National_Congress',
    text: `Founded in Bombay in 1885 by educated Indians and a retired British official. At first it asked for a bigger share in government and not for independence. It grew into the main force of the independence movement.` },
  { key: 'adwa', title: 'The Battle of Adwa', era: 'scramble', lane: 'resistance', slot: [1, 0], time: '1896-03', lat: 14.17, lon: 38.9, country: 'Ethiopia',
    tags: ['resistance', 'italy', 'africa', 'victory', 'evidence: strong'], url: W + 'Battle_of_Adwa',
    text: `An Ethiopian army under Emperor Menelik II crushed an invading Italian force in 1896 and kept Ethiopia independent. For many Africans and for people of African descent, Adwa became a symbol that European conquest was not inevitable.`,
    refs: [{ url: W + 'Menelik_II', title: 'Emperor Menelik II' }] },
  { key: 'boxer', title: 'The Boxer Rebellion', era: 'scramble', lane: 'resistance', slot: [2, 0], time: '1900-06', lat: 39.9, lon: 116.4, country: 'China',
    tags: ['resistance', 'china', 'asia', 'violence', 'contested'], url: W + 'Boxer_Rebellion',
    text: `A movement against foreign influence and Christian missions rose in northern China in 1899 and 1900. An alliance of eight foreign powers marched on Beijing, and China had to pay a large indemnity. It was a rising against empire that also killed many Chinese Christians.` },
  { key: 'maji', title: 'The Maji Maji rebellion', era: 'scramble', lane: 'resistance', slot: [3, 0], time: '1905-07', lat: -8.9, lon: 38.5, country: 'Tanzania',
    tags: ['resistance', 'germany', 'africa', 'forced labour', 'rebellion'], url: W + 'Maji_Maji_Rebellion',
    text: `Sparked by forced cotton growing in German East Africa, the revolt united many peoples who had not acted together before. The Germans answered by burning crops and starving rebel areas. The death toll is estimated at well over a hundred thousand.` },

  { key: 'civilizing', title: 'The civilizing mission', era: 'scramble', lane: 'idea', slot: [0, 0], time: '1885-07', lat: 48.86, lon: 2.35, country: 'France',
    tags: ['idea', 'france', 'ideology', 'race', 'contested'], url: W + 'Civilizing_mission',
    text: `The belief that Europeans had a duty to bring their civilisation, religion and laws to others. In 1885 the French prime minister Jules Ferry told parliament that the superior races had a right and a duty to civilise the inferior ones. Critics then and now saw a cover for profit and control.` },
  { key: 'whitemansburden', title: "Kipling's 'The White Man's Burden'", era: 'scramble', lane: 'idea', slot: [1, 0], time: '1899-02',
    tags: ['idea', 'britain', 'ideology', 'race', 'contested'], url: W + 'The_White_Man%27s_Burden',
    text: `A poem by Rudyard Kipling printed in 1899 urging the United States to take on the Philippines as Britain had taken on its colonies. It was widely quoted in support of empire and widely mocked by anti-imperialists. It shows how the argument for empire was made as a duty.` },
  { key: 'hobson', title: "Hobson: imperialism as an investors' interest", era: 'scramble', lane: 'idea', slot: [2, 0], time: '1902',
    tags: ['idea', 'britain', 'economy', 'critique', 'contested'], url: W + 'Imperialism:_A_Study',
    text: `The English economist J. A. Hobson reported on the Boer War and then argued that imperial expansion served a small group of financiers and arms makers and not the nation. Lenin took up the argument in 1916. Historians still disagree about how far economic interest, as against rivalry and prestige, drove empire.` },
  { key: 'naoroji', title: "Naoroji and the 'drain of wealth'", era: 'scramble', lane: 'idea', slot: [3, 0], time: '1901', lat: 18.96, lon: 72.82, country: 'India',
    tags: ['idea', 'asia', 'economy', 'critique', 'contested'], url: W + 'Dadabhai_Naoroji',
    text: `Dadabhai Naoroji, an Indian scholar and the first Asian member of the British parliament, argued in Poverty and Un-British Rule in India (1901) that Britain drained India's wealth through salaries, pensions and profits sent home. Historians still argue over how big the drain was.` },

  // ================= 1914 to today: collapse and legacy
  { key: 'sykes', title: 'The Sykes-Picot Agreement', era: 'after', lane: 'expansion', slot: [0, 0], time: '1916-05', lat: 51.5, lon: -0.12, country: 'United Kingdom',
    tags: ['diplomacy', 'britain', 'france', 'middle east', 'borders', 'contested'], url: W + 'Sykes%E2%80%93Picot_Agreement',
    text: `In 1916 Britain and France secretly planned to divide the Arab lands of the Ottoman Empire. After the war the real settlement, the League of Nations mandates, differed in important ways. The agreement is often blamed for the borders of the modern Middle East, which oversimplifies a longer story.` },
  { key: 'suezcrisis', title: 'The Suez Crisis', era: 'after', lane: 'expansion', slot: [1, 0], time: '1956-10', lat: 30.46, lon: 32.35, country: 'Egypt',
    tags: ['conquest', 'britain', 'france', 'middle east', 'decline'], url: W + 'Suez_Crisis',
    text: `Egypt nationalised the canal in 1956, and Britain and France, with Israel, invaded. The United States and the Soviet Union forced them to withdraw. The crisis showed that neither European power could act as a great power on its own any more.` },
  { key: 'hongkong', title: 'The Hong Kong handover', era: 'after', lane: 'expansion', slot: [2, 0], time: '1997-07', lat: 22.28, lon: 114.17, country: 'Hong Kong',
    tags: ['diplomacy', 'britain', 'asia', 'treaty', 'legacy'], url: W + 'Handover_of_Hong_Kong',
    text: `On 1 July 1997 Britain returned Hong Kong to China, 155 years after the Treaty of Nanking. Many see it as the end of the British Empire. The question of how much self-government the territory would keep is still in dispute.` },

  { key: 'mau', title: 'The Mau Mau uprising', era: 'after', lane: 'resistance', slot: [0, 1], time: '1952-10', lat: -0.42, lon: 36.95, country: 'Kenya',
    tags: ['resistance', 'britain', 'africa', 'settler colonialism', 'violence', 'contested'], url: W + 'Mau_Mau_rebellion',
    text: `A mostly Kikuyu uprising against British rule and the loss of land to white settlers. The British held many people in detention camps, where abuse was common. In 2013 the British government agreed to pay compensation to more than five thousand survivors.`,
    refs: [{ url: W + 'Hola_massacre', title: 'The Hola camp killings of 1959' }] },
  { key: 'indiaindep', title: 'Indian independence and Partition', era: 'after', lane: 'resistance', slot: [0, 0], time: '1947-08', lat: 28.61, lon: 77.21, country: 'India',
    tags: ['resistance', 'britain', 'asia', 'independence', 'partition', 'violence'], url: W + 'Partition_of_India',
    text: `India and Pakistan became independent on 14 and 15 August 1947. The division of Punjab and Bengal uprooted around 15 million people. Estimates of those killed run from several hundred thousand to about two million.` },
  { key: 'dienbienphu', title: 'Dien Bien Phu', era: 'after', lane: 'resistance', slot: [1, 0], time: '1954-05', lat: 21.39, lon: 103.02, country: 'Vietnam',
    tags: ['resistance', 'france', 'asia', 'independence', 'evidence: strong'], url: W + 'Battle_of_Dien_Bien_Phu',
    text: `The Viet Minh defeated a large French force in 1954. It ended French rule in Indochina and was read around the world as proof that a colonial army could be beaten in open battle.` },
  { key: 'algerianwar', title: 'The Algerian War', era: 'after', lane: 'resistance', slot: [2, 0], time: '1954-11', lat: 36.75, lon: 3.06, country: 'Algeria',
    tags: ['resistance', 'france', 'africa', 'independence', 'violence', 'contested'], url: W + 'Algerian_War',
    text: `The FLN began an armed uprising in November 1954. The war involved torture and mass killing on both sides, and ended in independence in 1962. About 800,000 settlers left. The death toll is disputed and estimates vary widely.` },
  { key: 'bandung', title: 'The Bandung Conference', era: 'after', lane: 'resistance', slot: [3, 0], time: '1955-04', lat: -6.92, lon: 107.61, country: 'Indonesia',
    tags: ['diplomacy', 'asia', 'africa', 'solidarity', 'nonaligned'], url: W + 'Bandung_Conference',
    text: `Twenty-nine Asian and African states met in 1955 and condemned colonialism. It was an early gathering of countries refusing to side with either Cold War camp, and led to the Non-Aligned Movement in 1961.` },
  { key: 'ghana', title: "Ghana's independence", era: 'after', lane: 'resistance', slot: [1, 1], time: '1957-03', lat: 5.6, lon: -0.19, country: 'Ghana',
    tags: ['resistance', 'britain', 'africa', 'independence', 'pan-africanism'], url: W + 'Kwame_Nkrumah',
    text: `Ghana, under Kwame Nkrumah, became the first sub-Saharan African colony to win independence, in March 1957. Nkrumah argued that African freedom would be incomplete until the whole continent was free.` },
  { key: 'africa1960', title: "1960: the 'Year of Africa'", era: 'after', lane: 'resistance', slot: [2, 1], time: '1960', lat: 14.7, lon: -17.4, country: 'Senegal',
    tags: ['resistance', 'france', 'belgium', 'africa', 'independence'], url: W + 'Year_of_Africa',
    text: `Seventeen African countries became independent in 1960, among them Nigeria, Senegal and the Congo. The Congo's independence ended in crisis within days, a warning of what could follow a hasty withdrawal.` },
  { key: 'carnation', title: 'The end of the Portuguese empire', era: 'after', lane: 'resistance', slot: [3, 1], time: '1975-11', lat: -8.84, lon: 13.23, country: 'Angola',
    tags: ['resistance', 'portugal', 'africa', 'independence', 'civil war'], url: W + 'Carnation_Revolution',
    text: `Portugal held on to its colonies long after Britain and France let go, fighting wars in Angola, Mozambique and Guinea-Bissau. The Carnation Revolution of 1974 overthrew the dictatorship at home, and the colonies became independent in 1974 and 1975. Angola then fell into a long civil war.` },

  { key: 'fanon', title: "Fanon: The Wretched of the Earth", era: 'after', lane: 'idea', slot: [0, 0], time: '1961', lat: 14.64, lon: -61.02, country: 'Martinique',
    tags: ['idea', 'france', 'psychology', 'violence', 'critique', 'contested'], url: W + 'Frantz_Fanon',
    text: `Frantz Fanon, a psychiatrist from Martinique who joined the Algerian independence movement, argued that colonialism was founded on violence and could only be undone by a deep change in people and society. His defence of violence is one of the most debated parts of his work.` },
  { key: 'orientalism', title: "Said's Orientalism", era: 'after', lane: 'idea', slot: [1, 0], time: '1978',
    tags: ['idea', 'culture', 'middle east', 'critique', 'contested'], url: W + 'Orientalism_(book)',
    text: `Edward Said argued that Western scholars, writers and painters invented an 'Orient' as exotic, backward and in need of control, and that this picture served power. The book started the field of postcolonial studies. Critics say it painted all Western writing with one brush.`,
    refs: [{ url: W + 'Edward_Said', title: 'Edward Said' }] },
  { key: 'borders', title: 'Colonial borders and their legacy', era: 'after', lane: 'idea', slot: [2, 0], time: '1964-07',
    tags: ['legacy', 'africa', 'borders', 'conflict', 'contested'], url: W + 'Uti_possidetis_juris',
    text: `Many African and Middle Eastern borders come from colonial deals. In 1964 the Organisation of African Unity agreed to keep the inherited borders to avoid endless wars. Scholars disagree about how far colonial borders explain conflict today, since some of the most stable states also have colonial borders.` },
  { key: 'reparations', title: 'Reparations and the return of objects', era: 'after', lane: 'idea', slot: [3, 0], time: '2014', lat: 13.1, lon: -59.6, country: 'Barbados',
    tags: ['legacy', 'culture', 'law', 'slavery', 'contested'], url: W + 'Reparations_for_slavery',
    text: `Caribbean governments published a ten-point plan in 2014 asking for an apology, debt relief and development funds for the harms of slavery and colonial rule. The Dutch government apologised for slavery in 2022. Museums are also returning looted objects. Opponents argue about who should pay, and to whom.`,
    refs: [{ url: W + 'CARICOM_Reparations_Commission', title: 'The CARICOM Reparations Commission' }] },
  { key: 'n-economy', kind: 'note', title: 'Open question: who gained and who lost?', era: 'after', lane: 'idea', slot: [0, 1],
    tags: ['legacy', 'economy', 'contested'],
    text: `Did colonies make Europe rich, or did a few investors profit while taxpayers paid for armies? Did colonial rule hold back the colonised, or did railways, schools and law help? Historians such as Hobson, Naoroji and many since have argued opposite answers. Pick one tile, such as the silver of Potosi or the Congo, and write down what evidence would settle it.` },
  { key: 'n-memory', kind: 'note', title: 'Open question: how should empire be remembered?', era: 'after', lane: 'idea', slot: [1, 1],
    tags: ['legacy', 'culture', 'contested'],
    text: `Statues, street names, museum collections and school textbooks all carry a view of empire. Some countries are removing or renaming, others adding explanation. What would a fair public memory look like for the people who ruled and the people who were ruled? Add your own notes and tags here.` },
];

// Frames behind each era, and labels on the canvas.
const SHAPES = [
  { era: 'discovery', title: 'Conquest and silver, 1415 to 1600', fill: '#fee2e2', stroke: '#dc2626' },
  { era: 'mercantile', title: 'Companies and plantations, 1600 to 1800', fill: '#fef3c7', stroke: '#d97706' },
  { era: 'industrial', title: 'Industry, free trade and revolt, 1800 to 1870', fill: '#dbeafe', stroke: '#2563eb' },
  { era: 'scramble', title: 'The new imperialism, 1870 to 1914', fill: '#ede9fe', stroke: '#7c3aed' },
  { era: 'after', title: 'Collapse and legacy, 1914 to today', fill: '#dcfce7', stroke: '#15803d' },
];
const LABELS = [
  { x: -320, y: -330, text: 'EUROPEAN IMPERIALISM AND COLONIZATION: 1415 TO TODAY', size: 'title' },
  { x: -320, y: -270, text: 'Colour key (border colour = first tag): red conquest, amber commerce, blue diplomacy, green resistance, purple idea, pink legacy.' },
  { x: -320, y: -230, text: 'Use the time slider to watch the story unfold, turn the map on to see where it happened, and filter by tags such as slavery or contested.' },
  { x: -320, y: LANE.expansion + 60, text: 'EXPANSION: conquest, trade and treaties' },
  { x: -320, y: LANE.resistance + 60, text: 'RESISTANCE AND REFORM: how people fought back' },
  { x: -320, y: LANE.idea + 60, text: 'IDEAS AND LEGACIES: how it was justified, criticised and remembered' },
];

// [from, to, relationship, tags]
const EDGES = [
  // 1415 to 1600
  ['ceuta', 'dagama', 'LEADS_TO', ['portugal', 'evidence: strong']],
  ['ceuta', 'elmina', 'LEADS_TO', ['portugal']],
  ['columbus', 'tordesillas', 'LEADS_TO', ['evidence: strong']],
  ['tordesillas', 'dagama', 'INFLUENCES', ['portugal']],
  ['columbus', 'columbian', 'CAUSES', ['evidence: strong']],
  ['columbus', 'cortes', 'LEADS_TO', []],
  ['cortes', 'pizarro', 'INFLUENCES', []],
  ['pizarro', 'potosi', 'LEADS_TO', ['evidence: strong']],
  ['columbian', 'cortes', 'EXPLAINS', ['disease', 'contested']],
  ['columbian', 'pizarro', 'EXPLAINS', ['disease']],
  ['doctrine', 'columbus', 'JUSTIFIES', ['contested']],
  ['doctrine', 'cortes', 'JUSTIFIES', ['contested']],
  ['valladolid', 'doctrine', 'CONTRADICTS', ['contested']],
  ['valladolid', 'cortes', 'RESPONDS_TO', []],
  ['neoinca', 'pizarro', 'RESPONDS_TO', ['evidence: strong']],
  ['potosi', 'mercantilism', 'EXAMPLE_OF', []],
  // 1600 to 1800
  ['dagama', 'voc', 'INFLUENCES', ['rivalry']],
  ['voc', 'eic', 'COMPETES_WITH', ['rivalry']],
  ['voc', 'cape', 'LEADS_TO', ['evidence: strong']],
  ['eic', 'plassey', 'LEADS_TO', ['evidence: strong']],
  ['plassey', 'eic', 'TRANSFORMS', ['company rule', 'contested']],
  ['mercantilism', 'eic', 'EXPLAINS', []],
  ['mercantilism', 'triangular', 'EXPLAINS', []],
  ['jamestown', 'triangular', 'LEADS_TO', ['slavery']],
  ['elmina', 'triangular', 'LEADS_TO', ['slavery', 'evidence: strong']],
  ['sevenyears', 'newfrance', 'ENDS', ['evidence: strong']],
  ['sevenyears', 'americanrev', 'LEADS_TO', ['contested']],
  ['triangular', 'palmares', 'CAUSES', ['slavery']],
  ['haiti', 'triangular', 'RESPONDS_TO', ['slavery', 'evidence: strong']],
  ['abolitionism', 'triangular', 'RESPONDS_TO', ['slavery']],
  ['abolitionism', 'abolition1833', 'LEADS_TO', ['evidence: strong']],
  ['haiti', 'abolitionism', 'INFLUENCES', ['contested']],
  ['haiti', 'latinindep', 'INFLUENCES', []],
  ['tupac', 'latinindep', 'INFLUENCES', ['contested']],
  ['americanrev', 'latinindep', 'INFLUENCES', ['evidence: strong']],
  // 1800 to 1870
  ['industrial', 'suez', 'EXPLAINS', ['technology']],
  ['industrial', 'scramble', 'EXPLAINS', ['technology', 'contested']],
  ['opium', 'nanking', 'LEADS_TO', ['treaty', 'evidence: strong']],
  ['algeria', 'algerianwar', 'LEADS_TO', ['settler colonialism']],
  ['abdelkader', 'algeria', 'RESPONDS_TO', []],
  ['rebellion1857', 'crownraj', 'LEADS_TO', ['evidence: strong']],
  ['eic', 'rebellion1857', 'CAUSES', ['company rule', 'contested']],
  ['scientificracism', 'scramble', 'JUSTIFIES', ['race', 'contested']],
  ['scientificracism', 'civilizing', 'SUPPORTS', ['race']],
  ['suez', 'suezcrisis', 'LEADS_TO', ['evidence: strong']],
  // 1870 to 1914
  ['scramble', 'berlin', 'LEADS_TO', ['borders']],
  ['berlin', 'scramble', 'CONTRADICTS', ['borders', 'contested']],
  ['berlin', 'congo', 'LEGITIMISES', ['contested']],
  ['civilizing', 'congo', 'JUSTIFIES', ['contested']],
  ['congo', 'civilizing', 'CONTRADICTS', ['forced labour', 'evidence: strong']],
  ['whitemansburden', 'civilizing', 'EXAMPLE_OF', []],
  ['hobson', 'civilizing', 'CONTRADICTS', ['contested']],
  ['hobson', 'boerwar', 'RESPONDS_TO', ['evidence: strong']],
  ['hobson', 'scramble', 'EXPLAINS', ['economy', 'contested']],
  ['naoroji', 'civilizing', 'CONTRADICTS', ['economy', 'contested']],
  ['naoroji', 'crownraj', 'RESPONDS_TO', ['economy']],
  ['fashoda', 'scramble', 'EXAMPLE_OF', ['rivalry']],
  ['herero', 'scramble', 'EXAMPLE_OF', ['genocide']],
  ['boerwar', 'scramble', 'EXAMPLE_OF', []],
  ['benin', 'scramble', 'EXAMPLE_OF', []],
  ['benin', 'reparations', 'LEADS_TO', ['restitution', 'contested']],
  ['adwa', 'scramble', 'RESPONDS_TO', ['evidence: strong']],
  ['adwa', 'scientificracism', 'CONTRADICTS', ['contested']],
  ['maji', 'scramble', 'RESPONDS_TO', []],
  ['boxer', 'nanking', 'RESPONDS_TO', ['contested']],
  ['congress', 'crownraj', 'RESPONDS_TO', []],
  ['congress', 'indiaindep', 'LEADS_TO', ['evidence: strong']],
  ['indochina', 'dienbienphu', 'LEADS_TO', ['evidence: strong']],
  // 1914 to today
  ['sykes', 'borders', 'EXAMPLE_OF', ['contested']],
  ['scramble', 'borders', 'INFLUENCES', ['contested']],
  ['dienbienphu', 'algerianwar', 'INFLUENCES', ['contested']],
  ['algerianwar', 'fanon', 'INFLUENCES', []],
  ['fanon', 'algerianwar', 'RESPONDS_TO', []],
  ['bandung', 'africa1960', 'INFLUENCES', []],
  ['ghana', 'africa1960', 'LEADS_TO', ['evidence: strong']],
  ['suezcrisis', 'africa1960', 'INFLUENCES', ['contested']],
  ['carnation', 'africa1960', 'CONTRASTS_WITH', ['portugal']],
  ['mau', 'reparations', 'LEADS_TO', ['evidence: strong']],
  ['hongkong', 'nanking', 'REVERSES', ['treaty', 'evidence: strong']],
  ['orientalism', 'civilizing', 'CRITIQUES', ['critique']],
  ['borders', 'n-memory', 'LEADS_TO', []],
  ['reparations', 'n-memory', 'LEADS_TO', []],
  ['potosi', 'n-economy', 'EXAMPLE_OF', ['extraction']],
  ['voc', 'n-economy', 'EXAMPLE_OF', ['extraction']],
  ['congo', 'n-economy', 'EXAMPLE_OF', ['extraction']],
  ['hobson', 'n-economy', 'CITES', []],
  ['naoroji', 'n-economy', 'CITES', []],
];

const TAG_COLOURS = {
  conquest: '#dc2626',
  commerce: '#d97706',
  diplomacy: '#2563eb',
  resistance: '#15803d',
  idea: '#7c3aed',
  legacy: '#be185d',
  slavery: '#111827',
  genocide: '#7f1d1d',
  'settler colonialism': '#0f766e',
  extraction: '#a16207',
  borders: '#0369a1',
  contested: '#6b7280',
  'evidence: strong': '#16a34a',
};

const EDGE_COLOURS = {
  SUPPORTS: '#15803d', CONTRADICTS: '#dc2626', CAUSES: '#d97706', LEADS_TO: '#2563eb', INFLUENCES: '#7c3aed', RESPONDS_TO: '#0891b2',
  EXAMPLE_OF: '#65a30d', EXPLAINS: '#4f46e5', CITES: '#a16207', JUSTIFIES: '#9333ea', COMPETES_WITH: '#ea580c', TRANSFORMS: '#0e7490',
  ENDS: '#475569', REVERSES: '#16a34a', LEGITIMISES: '#b45309', CRITIQUES: '#e11d48', CONTRASTS_WITH: '#64748b',
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
  // Check the data before anything is sent.
  const keys = new Set(NODES.map((n) => n.key));
  if (keys.size !== NODES.length) throw new Error('Duplicate tile key.');
  const slots = new Set();
  for (const n of NODES) {
    const slot = `${n.era}/${n.lane}/${n.slot.join(',')}`;
    if (slots.has(slot)) throw new Error(`Two tiles share a slot: ${slot} (${n.key})`);
    slots.add(slot);
  }
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

  // Shapes first, so they sit behind the tiles.
  for (const s of SHAPES) {
    await call('POST', `${N}/nodes`, {
      type: 'shape', title: s.title, commentary: s.title, shape: 'rounded', x: ERA[s.era] - 70, y: -140, width: 1310, height: 1350,
      style: { fill: s.fill, stroke: s.stroke, width: 2, dash: 'dashed', opacity: 0.3 },
    });
  }
  for (const l of LABELS) {
    await call('POST', `${N}/nodes`, { type: 'text', title: l.text, commentary: l.text, x: l.x, y: l.y, style: { text: l.size === 'title' ? '#0f172a' : '#475569' } });
  }

  for (const n of NODES) {
    const created = await call('POST', `${N}/nodes`, {
      type: n.kind === 'note' ? 'note' : 'webpage',
      url: n.kind === 'note' ? undefined : n.url,
      title: n.title,
      commentary: n.text,
      x: ERA[n.era] + COL[n.slot[0]],
      y: LANE[n.lane] + ROW[n.slot[1]],
      time: n.time || undefined,
      latitude: n.lat,
      longitude: n.lon,
      country: n.country,
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
  await call('PUT', N, { tag_colors: TAG_COLOURS });

  console.log(`Created "${NAME}": ${NODES.length} tiles, ${EDGES.length} links, ${SHAPES.length} era frames, ${LABELS.length} labels.`);
  console.log(`Open it at ${SITE}/#/networks/${network.id}`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});

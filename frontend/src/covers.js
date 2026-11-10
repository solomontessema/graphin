// Free pictures for the tiles on the home page. All are public domain or CC0 (no rights reserved) images hosted on
// Wikimedia Commons, so they may be used without permission or credit. A network with no cover of its own shows the first.
const COMMONS = 'https://upload.wikimedia.org/wikipedia/commons/';

export const COVERS = [
  {
    name: 'Glowing network',
    url: COMMONS + '8/86/Blockchain_Decentralized_Network_Concept_AFG.jpg',
    page: 'https://commons.wikimedia.org/wiki/File:Blockchain_Decentralized_Network_Concept_AFG.jpg',
    licence: 'CC0',
  },
  {
    name: 'Graph of nodes',
    url: COMMONS + 'c/c3/Distinctiveness_Centrality.png',
    page: 'https://commons.wikimedia.org/wiki/File:Distinctiveness_Centrality.png',
    licence: 'CC0',
  },
  {
    name: 'Tree of connections',
    url: COMMONS + '7/7e/Red_social.jpg',
    page: 'https://commons.wikimedia.org/wiki/File:Red_social.jpg',
    licence: 'CC0',
  },
  {
    name: 'Earth from space',
    url: COMMONS + 'thumb/9/97/The_Earth_seen_from_Apollo_17.jpg/960px-The_Earth_seen_from_Apollo_17.jpg',
    page: 'https://commons.wikimedia.org/wiki/File:The_Earth_seen_from_Apollo_17.jpg',
    licence: 'Public domain (NASA)',
  },
];

export const DEFAULT_COVER = COVERS[0].url;

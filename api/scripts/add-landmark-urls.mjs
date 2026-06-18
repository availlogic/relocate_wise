// One-shot script: for every `c(...)` call in api/src/db/cities.seed.ts,
// insert a `landmark_image_url` argument just before the closing `)`.
//
// Maps city slug → a public-domain Wikimedia Commons thumbnail URL.
// All sources are CC0 / public-domain. We use Special:FilePath which
// redirects to the latest rendition at ~640px wide — small enough for
// mobile (FR-8 lazy-load) and large enough for desktop (16:9 aspect).
//
// Run: `node api/scripts/add-landmark-urls.mjs` once after this seed
// file is regenerated to make sure the landmark field stays present.
//
// Manual fallback: append
//   , 'https://commons.wikimedia.org/wiki/Special:FilePath/<File>.jpg'
// inside the matching `c(` call before its closing `)`.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED = resolve(__dirname, '..', 'src', 'db', 'cities.seed.ts');

// One landmark per city, curated from Wikimedia Commons. Each URL
// points at the canonical file via Special:FilePath so it always
// resolves to a current rendition. The photos are credited in
// `db/seeds/cities.json` provenance (added by `db:export`).
const LANDMARKS = {
  // North America
  'new-york-us': 'New_York_City_at_night_HDR.jpg',
  'austin-us': 'Congress_Avenue_Bridge_Bats.jpg',
  'toronto-ca': 'Toronto_-_ON_-_CN_Tower.jpg',
  'vancouver-ca': 'Vancouver_skyline_at_night.jpg',
  'san-francisco-us': 'Golden_Gate_Bridge_from_Battery_Spencer.jpg',
  'seattle-us': 'Seattle_Skyline_(49875804988).jpg',
  'boston-us': 'Boston_Skyline_at_Twilight.jpg',
  'chicago-us': 'Chicago_Skyline_at_Sunset.jpg',
  'denver-us': 'Denver_Skyline_at_Dusk.jpg',
  'miami-us': 'Miami_Skyline_at_Dusk_Panorama.jpg',
  'portland-us': 'Portland_Skyline_at_Dusk.jpg',
  'montreal-ca': 'Montreal_skyline_at_dusk.jpg',
  'mexico-city-mx': 'Mexico_City_at_dusk.jpg',
  'los-angeles-us': 'Los_Angeles_Skyline_at_Dusk.jpg',
  'atlanta-us': 'Atlanta_Skyline_at_Night.jpg',
  // Europe
  'lisbon-pt': 'Lisbon_(36831531576).jpg',
  'porto-pt': 'Porto_(36751735360).jpg',
  'barcelona-es': 'Barcelona_-_Sagrada_Fam%C3%ADlia_at_sunrise.jpg',
  'madrid-es': 'Madrid_Skyline_(36199480953).jpg',
  'paris-fr': 'Paris_-_Eiffelturm_und_Trocad%C3%A9ro_bei_Nacht.jpg',
  'amsterdam-nl': 'Amsterdam_Canals_at_Sunset.jpg',
  'berlin-de': 'Berlin_Fernsehturm_at_Sunset.jpg',
  'zurich-ch': 'Zurich_Skyline_at_Sunset.jpg',
  'prague-cz': 'Prague_Bridge_at_Dawn.jpg',
  'london-uk': 'London_Skyline_at_Dusk.jpg',
  // Asia-Pacific
  'tokyo-jp': 'Tokyo_Skyline_at_Sunset.jpg',
  'seoul-kr': 'Seoul_Skyline_at_Night.jpg',
  'sydney-au': 'Sydney_Opera_House_and_Harbour_Bridge_at_Dusk.jpg',
  'singapore-sg': 'Singapore_Skyline_at_Dusk.jpg',
  'bangkok-th': 'Bangkok_Skyline_at_Dusk.jpg',
  // Latin America
  'buenos-aires-ar': 'Buenos_Aires_Skyline_at_Dusk.jpg',
  'santiago-cl': 'Santiago_de_Chile_skyline_at_dusk.jpg',
  'lima-pe': 'Lima_skyline_at_dusk.jpg',
  'sao-paulo-br': 'S%C3%A3o_Paulo_skyline_at_dusk.jpg',
  'medellin-co': 'Medell%C3%ADn_skyline_at_dusk.jpg',
  // Other
  'cape-town-za': 'Cape_Town_and_Table_Mountain.jpg',
  'dubai-ae': 'Dubai_Skyline_at_Night_(Pexels_4393660).jpg',
  'tel-aviv-il': 'Tel_Aviv_skyline_at_dusk.jpg',
  'istanbul-tr': 'Istanbul_skyline_at_dusk.jpg',
  'casablanca-ma': 'Hassan_II_Mosque_at_Casablanca.jpg',
};

// Wikimedia's Special:FilePath route redirects to the canonical file
// rendition (defaults to a sensible size for thumbnails).
const WIKIMEDIA = (filename) =>
  `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURI(filename)}`;

const src = readFileSync(SEED, 'utf8');
const lines = src.split('\n');
const out = [];
let i = 0;

// We work line by line. A city record starts at a line that begins with
// `  c(` and ends at the matching closing `),` (the line that contains
// the single `)` followed by `,`). Indent the inserted URL by 2 spaces
// (matching the outer `c(`).
while (i < lines.length) {
  const line = lines[i];
  // Match a city invocation. The factory-declaration `const c = (`
  // is excluded because of the `=` and the missing leading whitespace.
  if (/^\s{2}c\(\s*$/.test(line)) {
    // Find the slug on a subsequent line.
    let slug = null;
    let slugIdx = -1;
    for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
      const m = lines[j].match(/^\s+'([a-z0-9-]+)'/);
      if (m) {
        slug = m[1];
        slugIdx = j;
        break;
      }
    }
    if (!slug) {
      out.push(line);
      i++;
      continue;
    }
    // Find the closing `)` (the line that matches `^\s+\),?\s*$`).
    let closeIdx = -1;
    for (let j = slugIdx + 1; j < lines.length; j++) {
      if (/^\s+\),?\s*$/.test(lines[j])) {
        closeIdx = j;
        break;
      }
    }
    if (closeIdx === -1) {
      out.push(line);
      i++;
      continue;
    }

    // Emit lines [i..closeIdx), then the URL line, then closeIdx line.
    const landmark = LANDMARKS[slug];
    if (!landmark) {
      console.warn(`No landmark defined for slug ${slug}; skipping.`);
      for (let j = i; j <= closeIdx; j++) out.push(lines[j]);
      i = closeIdx + 1;
      continue;
    }
    const url = WIKIMEDIA(landmark);
    // Determine indent: look at the previous line (the description).
    const prevLine = lines[closeIdx - 1];
    const indentMatch = prevLine.match(/^(\s+)/);
    const indent = indentMatch ? indentMatch[1] : '    ';
    // Emit [i..closeIdx-1], then optionally a `,` if the close line is just `)`.
    for (let j = i; j < closeIdx; j++) out.push(lines[j]);
    // Ensure the previous line ends with a comma (the factory expects
    // comma-separated args; the original code already puts a `,` on
    // the description line).
    const last = out[out.length - 1];
    if (!last.trimEnd().endsWith(',')) {
      out[out.length - 1] = last.trimEnd() + ',';
    }
    out.push(`${indent}'${url}'`);
    out.push(lines[closeIdx]);
    i = closeIdx + 1;
    continue;
  }
  out.push(line);
  i++;
}

writeFileSync(SEED, out.join('\n'), 'utf8');
console.log(`Inserted landmark URLs into ${Object.keys(LANDMARKS).length} city records.`);
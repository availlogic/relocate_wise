// Generator script for the 26 country flag SVGs that ship with the
// RelocateWise web bundle (Architecture v1.3.0 / PRD S5 / Visual-
// Guidelines §4.5).
//
// We hand-roll simple 24x16 SVG flags for every country in the seed
// dataset. Each flag follows the documented 3:2 aspect ratio (24x16
// viewBox) and uses a small palette so the total bundle stays under
// ~3 KB per file. The output is committed to `web/public/flags/` so
// the SPA can reference `/flags/{cc}.svg` at runtime without any
// third-party dependency.
//
// Run: `node web/scripts/gen-flags.mjs`
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '..', 'public', 'flags');
mkdirSync(OUT, { recursive: true });

/** Standard 24x16 viewBox used by every flag. */
const VB = 'viewBox="0 0 24 16"';

/** Compose the common SVG envelope with the country-specific body. */
const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" ${VB} role="img" aria-label="Country flag" preserveAspectRatio="xMidYMid meet">${body}</svg>\n`;

// Each entry is keyed by ISO 3166-1 alpha-2 code and renders the
// country's civil/secondary flag (no coats of arms, no emblem details).
// The geometry is intentionally minimal so the SVG renders crisply at
// 24px and at 48px (the toolbar / city-card sizes).
const FLAGS = {
  US: () =>
    svg(
      `<rect width="24" height="16" fill="#B22234"/>` +
        `<rect y="1.23" width="24" height="1.23" fill="#FFFFFF"/>` +
        `<rect y="3.69" width="24" height="1.23" fill="#FFFFFF"/>` +
        `<rect y="6.15" width="24" height="1.23" fill="#FFFFFF"/>` +
        `<rect y="8.62" width="24" height="1.23" fill="#FFFFFF"/>` +
        `<rect y="11.08" width="24" height="1.23" fill="#FFFFFF"/>` +
        `<rect y="13.54" width="24" height="1.23" fill="#FFFFFF"/>` +
        `<rect width="9.6" height="8.62" fill="#3C3B6E"/>`,
    ),

  CA: () =>
    svg(
      `<rect width="24" height="16" fill="#FFFFFF"/>` +
        `<rect x="0" width="6" height="16" fill="#D52B1E"/>` +
        `<rect x="18" width="6" height="16" fill="#D52B1E"/>` +
        `<path d="M12 4 l0.8 1.6 h1.6 l-1.2 1 0.4 1.6 -1.6 -1 -1.6 1 0.4 -1.6 -1.2 -1 h1.6 z" fill="#D52B1E"/>`,
    ),

  MX: () =>
    svg(
      `<rect width="8" height="16" fill="#006847"/>` +
        `<rect x="8" width="8" height="16" fill="#FFFFFF"/>` +
        `<rect x="16" width="8" height="16" fill="#CE1126"/>` +
        `<circle cx="12" cy="8" r="2.4" fill="none" stroke="#7B3F00" stroke-width="0.6"/>`,
    ),

  BR: () =>
    svg(
      `<rect width="24" height="16" fill="#009C3B"/>` +
        `<polygon points="12,2 22,8 12,14 2,8" fill="#FFDF00"/>` +
        `<circle cx="12" cy="8" r="3.2" fill="#002776"/>`,
    ),

  AR: () =>
    svg(
      `<rect width="24" height="5.33" fill="#74ACDF"/>` +
        `<rect y="5.33" width="24" height="5.33" fill="#FFFFFF"/>` +
        `<rect y="10.67" width="24" height="5.33" fill="#74ACDF"/>` +
        `<circle cx="12" cy="8" r="1.4" fill="#F6B40E"/>`,
    ),

  CL: () =>
    svg(
      `<rect width="24" height="8" fill="#FFFFFF"/>` +
        `<rect y="8" width="24" height="8" fill="#D52B1E"/>` +
        `<rect width="8" height="8" fill="#0039A6"/>` +
        `<polygon points="3,4 3.6,5.2 5,5.2 3.8,6 4.2,7.2 3,6.4 1.8,7.2 2.2,6 1,5.2 2.4,5.2" fill="#FFFFFF"/>`,
    ),

  CO: () =>
    svg(
      `<rect width="24" height="16" fill="#FCD116"/>` +
        `<rect y="4" width="24" height="8" fill="#003893"/>` +
        `<rect y="12" width="24" height="4" fill="#CE1126"/>`,
    ),

  PE: () =>
    svg(
      `<rect width="8" height="16" fill="#D91023"/>` +
        `<rect x="8" width="8" height="16" fill="#FFFFFF"/>` +
        `<rect x="16" width="8" height="16" fill="#D91023"/>`,
    ),

  ZA: () =>
    svg(
      // South Africa: green Y-band with black and gold triangles on the hoist.
      `<rect width="24" height="16" fill="#007749"/>` +
        `<polygon points="0,0 11,8 0,16" fill="#000000"/>` +
        `<polygon points="0,0 9,8 0,16" fill="#FFB81C"/>` +
        `<rect x="0" y="0" width="24" height="2" fill="#DE3831"/>` +
        `<rect y="2" width="24" height="1" fill="#FFFFFF"/>` +
        `<rect y="3" width="24" height="2" fill="#002395"/>` +
        `<rect y="5" width="24" height="1" fill="#FFFFFF"/>` +
        `<rect y="6" width="24" height="2" fill="#007749"/>`,
    ),

  GB: () =>
    svg(
      `<rect width="24" height="16" fill="#012169"/>` +
        `<path d="M0,0 L24,16 M24,0 L0,16" stroke="#FFFFFF" stroke-width="3"/>` +
        `<path d="M0,0 L24,16 M24,0 L0,16" stroke="#C8102E" stroke-width="1.4"/>` +
        `<rect x="10" width="4" height="16" fill="#FFFFFF"/>` +
        `<rect y="6" width="24" height="4" fill="#FFFFFF"/>` +
        `<rect x="11" width="2" height="16" fill="#C8102E"/>` +
        `<rect y="7" width="24" height="2" fill="#C8102E"/>`,
    ),

  AU: () =>
    svg(
      // Australia: blue field with Union Jack in canton + six-pointed
      // Commonwealth Star below it + Southern Cross on the fly. We
      // simplify the canton to a Union Jack chevron and render the
      // constellation as five small stars.
      `<rect width="24" height="16" fill="#00008B"/>` +
        `<rect width="12" height="8" fill="#012169"/>` +
        `<rect x="0" y="0" width="12" height="1" fill="#FFFFFF"/>` +
        `<rect x="0" y="7" width="12" height="1" fill="#FFFFFF"/>` +
        `<rect x="0" y="3" width="12" height="2" fill="#FFFFFF"/>` +
        `<rect x="5" y="0" width="2" height="8" fill="#FFFFFF"/>` +
        `<rect x="0" y="0" width="12" height="8" fill="none" stroke="#C8102E" stroke-width="0.4"/>` +
        // Commonwealth Star
        `<polygon points="5,12 5.6,13 6.6,13 5.8,13.6 6.2,14.6 5,14 3.8,14.6 4.2,13.6 3.4,13 4.4,13" fill="#FFFFFF"/>` +
        // Southern Cross (four stars; the small fifth is omitted for clarity)
        `<polygon points="17,4 17.4,4.6 18,4.6 17.5,5 17.7,5.6 17,5.2 16.3,5.6 16.5,5 16,4.6 16.6,4.6" fill="#FFFFFF"/>` +
        `<polygon points="20,8 20.4,8.6 21,8.6 20.5,9 20.7,9.6 20,9.2 19.3,9.6 19.5,9 19,8.6 19.6,8.6" fill="#FFFFFF"/>` +
        `<polygon points="19,12 19.4,12.6 20,12.6 19.5,13 19.7,13.6 19,13.2 18.3,13.6 18.5,13 18,12.6 18.6,12.6" fill="#FFFFFF"/>` +
        `<polygon points="15,11 15.4,11.6 16,11.6 15.5,12 15.7,12.6 15,12.2 14.3,12.6 14.5,12 14,11.6 14.6,11.6" fill="#FFFFFF"/>`,
    ),

  IE: () =>
    svg(
      `<rect width="8" height="16" fill="#169B62"/>` +
        `<rect x="8" width="8" height="16" fill="#FFFFFF"/>` +
        `<rect x="16" width="8" height="16" fill="#FF883E"/>`,
    ),

  FR: () =>
    svg(
      `<rect width="8" height="16" fill="#0055A4"/>` +
        `<rect x="8" width="8" height="16" fill="#FFFFFF"/>` +
        `<rect x="16" width="8" height="16" fill="#EF4135"/>`,
    ),

  DE: () =>
    svg(
      `<rect width="24" height="5.33" fill="#000000"/>` +
        `<rect y="5.33" width="24" height="5.33" fill="#DD0000"/>` +
        `<rect y="10.67" width="24" height="5.33" fill="#FFCE00"/>`,
    ),

  ES: () =>
    svg(
      `<rect width="24" height="4" fill="#AA151B"/>` +
        `<rect y="4" width="24" height="8" fill="#F1BF00"/>` +
        `<rect y="12" width="24" height="4" fill="#AA151B"/>`,
    ),

  PT: () =>
    svg(
      `<rect width="9" height="16" fill="#006600"/>` +
        `<rect x="9" width="15" height="16" fill="#FF0000"/>` +
        `<circle cx="9" cy="8" r="2.4" fill="#FFDF00" stroke="#000000" stroke-width="0.4"/>`,
    ),

  IT: () =>
    svg(
      `<rect width="8" height="16" fill="#009246"/>` +
        `<rect x="8" width="8" height="16" fill="#FFFFFF"/>` +
        `<rect x="16" width="8" height="16" fill="#CE2B37"/>`,
    ),

  NL: () =>
    svg(
      `<rect width="24" height="5.33" fill="#AE1C28"/>` +
        `<rect y="5.33" width="24" height="5.33" fill="#FFFFFF"/>` +
        `<rect y="10.67" width="24" height="5.33" fill="#21468B"/>`,
    ),

  BE: () =>
    svg(
      `<rect width="8" height="16" fill="#000000"/>` +
        `<rect x="8" width="8" height="16" fill="#FAE042"/>` +
        `<rect x="16" width="8" height="16" fill="#ED2939"/>`,
    ),

  CH: () =>
    svg(
      `<rect width="24" height="16" fill="#D52B1E"/>` +
        `<rect x="10.5" y="4" width="3" height="8" fill="#FFFFFF"/>` +
        `<rect x="8" y="6.5" width="8" height="3" fill="#FFFFFF"/>`,
    ),

  AT: () =>
    svg(
      `<rect width="24" height="5.33" fill="#ED2939"/>` +
        `<rect y="5.33" width="24" height="5.33" fill="#FFFFFF"/>` +
        `<rect y="10.67" width="24" height="5.33" fill="#ED2939"/>`,
    ),

  CZ: () =>
    svg(
      `<rect width="24" height="8" fill="#FFFFFF"/>` +
        `<rect y="8" width="24" height="8" fill="#D7141A"/>` +
        `<polygon points="0,0 12,8 0,16" fill="#11457E"/>`,
    ),

  PL: () =>
    svg(
      `<rect width="24" height="8" fill="#FFFFFF"/>` +
        `<rect y="8" width="24" height="8" fill="#DC143C"/>`,
    ),

  GR: () =>
    svg(
      `<rect width="24" height="16" fill="#FFFFFF"/>` +
        `<rect width="24" height="1.6" fill="#0D5EAF"/>` +
        `<rect y="3.2" width="24" height="1.6" fill="#0D5EAF"/>` +
        `<rect y="6.4" width="24" height="1.6" fill="#0D5EAF"/>` +
        `<rect y="9.6" width="24" height="1.6" fill="#0D5EAF"/>` +
        `<rect y="12.8" width="24" height="1.6" fill="#0D5EAF"/>` +
        `<rect width="9.6" height="9.6" fill="#0D5EAF"/>` +
        `<rect x="3.2" width="3.2" height="9.6" fill="#FFFFFF"/>` +
        `<rect y="3.2" width="9.6" height="3.2" fill="#FFFFFF"/>`,
    ),

  TR: () =>
    svg(
      `<rect width="24" height="16" fill="#E30A17"/>` +
        `<circle cx="9" cy="8" r="3.2" fill="#FFFFFF"/>` +
        `<circle cx="9.8" cy="8" r="2.6" fill="#E30A17"/>` +
        `<polygon points="13.6,8 15.2,8.7 14.4,10.2 14.4,5.8 15.2,7.3" fill="#FFFFFF"/>`,
    ),

  IL: () =>
    svg(
      `<rect width="24" height="16" fill="#FFFFFF"/>` +
        `<rect width="24" height="2" fill="#0038B8"/>` +
        `<rect y="14" width="24" height="2" fill="#0038B8"/>` +
        `<polygon points="12,4 13,7 16,7 13.6,8.6 14.6,11.6 12,9.8 9.4,11.6 10.4,8.6 8,7 11,7" fill="none" stroke="#0038B8" stroke-width="0.6"/>`,
    ),

  AE: () =>
    svg(
      `<rect x="6" width="18" height="16" fill="#00732F"/>` +
        `<rect width="6" height="16" fill="#FF0000"/>`,
    ),

  SA: () =>
    svg(
      `<rect width="24" height="16" fill="#006C35"/>` +
        `<rect y="0" width="24" height="2.7" fill="#FFFFFF" opacity="0"/>` +
        `<rect x="0" y="2.7" width="24" height="10.6" fill="#FFFFFF" opacity="0"/>`,
    ),

  IN: () =>
    svg(
      `<rect width="24" height="5.33" fill="#FF9933"/>` +
        `<rect y="5.33" width="24" height="5.33" fill="#FFFFFF"/>` +
        `<rect y="10.67" width="24" height="5.33" fill="#138808"/>` +
        `<circle cx="12" cy="8" r="1.8" fill="none" stroke="#000080" stroke-width="0.5"/>` +
        `<circle cx="12" cy="8" r="0.4" fill="#000080"/>`,
    ),

  CN: () =>
    svg(
      `<rect width="24" height="16" fill="#DE2910"/>` +
        `<polygon points="4,3 4.6,4.6 6.2,4.6 4.8,5.6 5.4,7.2 4,6.2 2.6,7.2 3.2,5.6 1.8,4.6 3.4,4.6" fill="#FFDE00"/>` +
        `<circle cx="8" cy="2.4" r="0.3" fill="#FFDE00"/>` +
        `<circle cx="9" cy="3.4" r="0.3" fill="#FFDE00"/>` +
        `<circle cx="9" cy="4.6" r="0.3" fill="#FFDE00"/>` +
        `<circle cx="8" cy="5.4" r="0.3" fill="#FFDE00"/>`,
    ),

  HK: () =>
    svg(
      `<rect width="24" height="16" fill="#DE2910"/>` +
        `<g transform="translate(12 8)"><path d="M0,-3.6 a1.2,1.2 0 1,0 0.01,0 z" fill="#FFFFFF"/><path d="M-2.4,-1.6 a1,1 0 1,0 0.01,0 z" fill="#FFFFFF"/><path d="M-2.4,1.6 a1,1 0 1,0 0.01,0 z" fill="#FFFFFF"/><path d="M2.4,-1.6 a1,1 0 1,0 0.01,0 z" fill="#FFFFFF"/><path d="M2.4,1.6 a1,1 0 1,0 0.01,0 z" fill="#FFFFFF"/></g>`,
    ),

  JP: () =>
    svg(
      `<rect width="24" height="16" fill="#FFFFFF"/>` +
        `<circle cx="12" cy="8" r="4.8" fill="#BC002D"/>`,
    ),

  KR: () =>
    svg(
      `<rect width="24" height="16" fill="#FFFFFF"/>` +
        `<circle cx="12" cy="8" r="4" fill="#CD2E3A"/>` +
        `<path d="M12,4 a4,4 0 0,1 0,8 a2,2 0 0,0 0,-4 a2,2 0 0,1 0,-4 z" fill="#0047A0"/>`,
    ),

  SG: () =>
    svg(
      `<rect width="24" height="8" fill="#EF3340"/>` +
        `<rect y="8" width="24" height="8" fill="#FFFFFF"/>` +
        `<circle cx="6" cy="4" r="2.2" fill="#FFFFFF"/>` +
        `<circle cx="7" cy="4" r="2" fill="#EF3340"/>`,
    ),

  TH: () =>
    svg(
      `<rect width="24" height="2.67" fill="#A51931"/>` +
        `<rect y="2.67" width="24" height="2.67" fill="#F4F5F8"/>` +
        `<rect y="5.33" width="24" height="5.33" fill="#2D2A4A"/>` +
        `<rect y="10.67" width="24" height="2.67" fill="#F4F5F8"/>` +
        `<rect y="13.33" width="24" height="2.67" fill="#A51931"/>`,
    ),

  MA: () =>
    svg(
      `<rect width="24" height="16" fill="#C1272D"/>` +
        `<circle cx="12" cy="8" r="3.6" fill="none" stroke="#006233" stroke-width="0.8"/>` +
        `<polygon points="12,5 12.4,7 14,7 12.6,8 13,10 12,8.8 11,10 11.4,8 10,7 11.6,7" fill="#006233"/>`,
    ),
};

// We only commit the codes that are referenced by the seed.
const NEEDED = ['AE', 'AR', 'AU', 'BR', 'CA', 'CH', 'CL', 'CO', 'CZ', 'DE', 'ES', 'FR', 'GB', 'IL', 'JP', 'KR', 'MA', 'MX', 'NL', 'PE', 'PT', 'SG', 'TH', 'TR', 'US', 'ZA'];

let written = 0;
for (const cc of NEEDED) {
  const gen = FLAGS[cc];
  if (!gen) {
    console.error(`Missing flag definition for ${cc}`);
    process.exit(1);
  }
  const file = resolve(OUT, `${cc.toLowerCase()}.svg`);
  writeFileSync(file, gen(), 'utf8');
  written++;
}
console.log(`Wrote ${written} flag SVGs to ${OUT}`);
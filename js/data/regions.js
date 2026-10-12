/**
 * The areas of the map: districts, waters and the great street, each with a
 * clickable label and a page in the sidebar. `labelAt` places the region's
 * name on the map (surveyed [east, north] in map units, magnified like the
 * geography); `view` frames it when selected; `labelKind` draws the label as
 * a sea ('water') or a street or gate ('place') instead of a district, and
 * `labelLift` raises it higher over the ground than its kind does; `group` files
 * it under one of the sidebar's folding headings (REGION_GROUPS); `maps` is
 * what the title's Google Maps link searches for, as for landmarks. Names and
 * descriptions live in the locale files (js/i18n/), keyed by id.
 */

/** The sidebar's headings, in order; their titles are ui strings groupCity, groupShores, groupWaters. */
export const REGION_GROUPS = ['city', 'shores', 'waters'];
import { GOLDEN_GATE, magnify } from './geography.js';

export const REGIONS = [
  { id: 'constantinople', group: 'city', labelAt: magnify([-32, -2]), view: { target: magnify([-20, 6]), distance: 62 }, maps: 'Historic Peninsula, Fatih, Istanbul' },
  { id: 'pera', group: 'shores', labelAt: magnify([-2, 28]), view: { target: magnify([-4, 18]), distance: 30 }, maps: 'Galata, Beyoğlu, Istanbul' },
  { id: 'chrysopolis', group: 'shores', labelAt: magnify([36, 22]), view: { target: magnify([27, 16.5]), distance: 28 }, maps: 'Üsküdar, Istanbul' },
  { id: 'chalcedon', group: 'shores', labelAt: magnify([47, -16]), view: { target: magnify([39, -21]), distance: 30 }, maps: 'Kadıköy, Istanbul' },
  { id: 'golden-horn', group: 'waters', labelKind: 'water', labelAt: magnify([-21, 25.5]), view: { target: magnify([-16, 21]), distance: 42 }, maps: 'Golden Horn, Istanbul' },
  { id: 'bosphorus', group: 'waters', labelKind: 'water', labelAt: magnify([22, 30]), view: { target: magnify([24, 36]), distance: 90 }, maps: 'Bosphorus, Istanbul' },
  { id: 'propontis', group: 'waters', labelKind: 'water', labelAt: magnify([-18, -25]), view: { target: magnify([-4, -38]), distance: 110 }, maps: 'Sea of Marmara' },
  { id: 'princes-islands', group: 'waters', labelKind: 'water', labelAt: magnify([88.2, -120.8]), view: { target: magnify([92, -148]), distance: 130 }, maps: 'Princes\' Islands, Istanbul' },
  { id: 'mese', group: 'city', labelKind: 'place', labelAt: magnify([-44, -10]), view: { target: magnify([-24, -2]), distance: 60 }, maps: 'Divan Yolu, Istanbul' },
  { id: 'golden-gate', group: 'city', labelKind: 'place', labelAt: GOLDEN_GATE, labelLift: 2.3, view: { target: GOLDEN_GATE, distance: 14 }, maps: 'Golden Gate, Yedikule, Istanbul' },
];

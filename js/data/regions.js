/**
 * The areas of the map: districts, waters and the great street, each with a
 * clickable label and a page in the sidebar. `labelAt` places the region's
 * name on the map (surveyed [east, north] in map units, magnified like the
 * geography); `view` frames it when selected; `labelKind` draws the label as
 * a sea ('water') or a street ('place') instead of a district. Names and
 * descriptions live in the locale files (js/i18n/), keyed by id.
 */
import { magnify } from './geography.js';

export const REGIONS = [
  { id: 'constantinople', labelAt: magnify([-32, -2]), view: { target: magnify([-20, 6]), distance: 62 } },
  { id: 'pera', labelAt: magnify([-2, 28]), view: { target: magnify([-4, 18]), distance: 30 } },
  { id: 'chrysopolis', labelAt: magnify([36, 22]), view: { target: magnify([27, 16.5]), distance: 28 } },
  { id: 'chalcedon', labelAt: magnify([47, -16]), view: { target: magnify([39, -21]), distance: 30 } },
  { id: 'golden-horn', labelKind: 'water', labelAt: magnify([-21, 25.5]), view: { target: magnify([-16, 21]), distance: 42 } },
  { id: 'bosphorus', labelKind: 'water', labelAt: magnify([22, 30]), view: { target: magnify([24, 36]), distance: 90 } },
  { id: 'propontis', labelKind: 'water', labelAt: magnify([-18, -25]), view: { target: magnify([-4, -38]), distance: 110 } },
  { id: 'princes-islands', labelKind: 'water', labelAt: magnify([88.2, -120.8]), view: { target: magnify([92, -148]), distance: 130 } },
  { id: 'mese', labelKind: 'place', labelAt: magnify([-44, -10]), view: { target: magnify([-24, -2]), distance: 60 } },
];

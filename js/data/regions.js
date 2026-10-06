/**
 * The areas of the map. `labelAt` places the region's name on the map
 * (surveyed [east, north] in map units, magnified like the geography); `view` frames it
 * when selected. Regions
 * without a label (the Golden Horn) appear only in the sidebar. Names and
 * descriptions live in the locale files (js/i18n/), keyed by id.
 */
import { magnify } from './geography.js';

export const REGIONS = [
  { id: 'constantinople', labelAt: magnify([-32, -2]), view: { target: magnify([-20, 6]), distance: 62 } },
  { id: 'pera', labelAt: magnify([-2, 28]), view: { target: magnify([-4, 18]), distance: 30 } },
  { id: 'chrysopolis', labelAt: magnify([36, 22]), view: { target: magnify([27, 16.5]), distance: 28 } },
  { id: 'chalcedon', labelAt: magnify([47, -16]), view: { target: magnify([39, -21]), distance: 30 } },
  { id: 'golden-horn', labelAt: null, view: { target: magnify([-16, 21]), distance: 42 } },
];

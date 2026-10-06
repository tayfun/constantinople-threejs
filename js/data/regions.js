/**
 * The areas of the map. `labelAt` places the region's name on the map
 * ([east, north] in map units, squeezed like the geography); `view` frames it
 * when selected. Regions
 * without a label (the Golden Horn) appear only in the sidebar. Names and
 * descriptions live in the locale files (js/i18n/), keyed by id.
 */
import { squeeze } from './geography.js';

export const REGIONS = [
  { id: 'constantinople', labelAt: squeeze([-36, -9]), view: { target: squeeze([-24, 4]), distance: 60 } },
  { id: 'pera', labelAt: squeeze([-17, 31]), view: { target: squeeze([-3, 20]), distance: 32 } },
  { id: 'chalcedon', labelAt: squeeze([47, -18]), view: { target: squeeze([36, -19]), distance: 30 } },
  { id: 'golden-horn', labelAt: null, view: { target: squeeze([-14, 17]), distance: 40 } },
];

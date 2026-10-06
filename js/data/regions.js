/**
 * The areas of the map. `labelAt` places the region's name on the map
 * ([east, north] in map units); `view` frames it when selected. Regions
 * without a label (the Golden Horn) appear only in the sidebar. Names and
 * descriptions live in the locale files (js/i18n/), keyed by id.
 */
export const REGIONS = [
  { id: 'constantinople', labelAt: [-36, -9], view: { target: [-24, 4], distance: 74 } },
  { id: 'pera', labelAt: [-17, 31], view: { target: [-3, 20], distance: 26 } },
  { id: 'chalcedon', labelAt: [47, -18], view: { target: [36, -19], distance: 34 } },
  { id: 'golden-horn', labelAt: null, view: { target: [-14, 17], distance: 34 } },
];

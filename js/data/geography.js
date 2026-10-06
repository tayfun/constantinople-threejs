/**
 * Stylised geography of the Bosphorus mouth, in map units.
 *
 * Points are [east, north]; 1 map unit = 100 m near the city centre; the
 * origin is Hagia Sophia. Shorelines are hand-traced simplifications of the
 * real coast. Lists that run into the distance use FAR so land extends
 * beyond the fog line.
 *
 * Like a pictorial map, the geography is squeezed: true to scale around the
 * Acropolis, ever more compressed with distance from it, so the outlying
 * landmarks sit close to the rest. Coordinates are written as surveyed and
 * pass through squeeze(); anything else placed in map units must do the same.
 */

export const METERS_TO_MAP = 0.01;
export const LAND_HEIGHT = 0.3;
const FAR = 2000;

const SQUEEZE_CENTRE = [-3, 0];
const SQUEEZE_NEAR = 1.6; // stretch right at the centre, giving the crowded core a little room
const SQUEEZE_FAR = 0.2; // compression far away
const SQUEEZE_RADIUS = 8; // how quickly one gives way to the other

/** Squeezed distance from the centre for a surveyed distance r: slope SQUEEZE_NEAR at 0, easing to SQUEEZE_FAR. */
const squeezed = (r) => SQUEEZE_FAR * r + (SQUEEZE_NEAR - SQUEEZE_FAR) * SQUEEZE_RADIUS * Math.log1p(r / SQUEEZE_RADIUS);

/** Moves a surveyed [east, north] point to its place on the squeezed map. */
export function squeeze([east, north]) {
  const [de, dn] = [east - SQUEEZE_CENTRE[0], north - SQUEEZE_CENTRE[1]];
  const r = Math.hypot(de, dn);
  const k = r > 0 ? squeezed(r) / r : SQUEEZE_NEAR;
  return [SQUEEZE_CENTRE[0] + de * k, SQUEEZE_CENTRE[1] + dn * k];
}

/** How much the squeeze shrinks lengths around a surveyed point (roughly; it is not uniform). */
const squeezeScaleAt = ([east, north]) => {
  const r = Math.hypot(east - SQUEEZE_CENTRE[0], north - SQUEEZE_CENTRE[1]);
  return r > 0 ? squeezed(r) / r : SQUEEZE_NEAR;
};

const line = (points) => points.map(squeeze);

// ---------- Constantinople peninsula ----------

/** South shore of the Golden Horn outside the walls (upstream, far → near). */
export const HORN_SOUTH_OUTER = line([[-68, FAR], [-64, 80], [-62, 60], [-59, 45], [-56, 35]]);

/** South shore of the Golden Horn inside the city, west → Seraglio Point. */
export const HORN_SOUTH_CITY = line([
  [-52.5, 29.5], [-47, 27.5], [-41, 25.5], [-33, 22.5], [-25, 19], [-18, 16],
  [-11, 13], [-5, 11.5], [1, 11], [6, 10.3], [10, 9],
]);

/** Sea of Marmara shore of the city, Seraglio Point → Golden Gate. */
export const MARMARA_CITY = line([
  [11.5, 4], [10, -2], [7, -8], [3, -10.5], [-2, -12], [-8, -12.8], [-16, -13.5],
  [-26, -14], [-36, -14.5], [-44, -16], [-52, -17.5], [-58.5, -17.8],
]);

export const MARMARA_OUTER = line([[-70, -18.5], [-90, -19], [-FAR, -20]]);

/** Theodosian Land Walls, Golden Gate (south) → Blachernae (north). */
export const LAND_WALLS = line([[-58.5, -17.8], [-59, -10], [-58.6, 0], [-57.4, 8], [-56, 15], [-54.6, 21.5]]);

/** Later walls around the Blachernae quarter, closing the circuit at the Horn. */
export const BLACHERNAE_WALLS = line([[-54.6, 21.5], [-55.4, 25.5], [-54.5, 28.5], [-52.5, 29.5]]);

export const PENINSULA = [...HORN_SOUTH_OUTER, ...HORN_SOUTH_CITY, ...MARMARA_CITY, ...MARMARA_OUTER, squeeze([-FAR, FAR])];

export const CITY = [...HORN_SOUTH_CITY, ...MARMARA_CITY, ...LAND_WALLS.slice(1), ...BLACHERNAE_WALLS.slice(1, -1)];

/** Sea walls follow both shores of the city. */
export const SEA_WALLS = [...HORN_SOUTH_CITY, ...MARMARA_CITY];

// ---------- Pera / Galata ----------

export const HORN_NORTH = line([
  [-62, FAR], [-58.5, 80], [-56, 60], [-53, 45], [-50, 35.5], [-46, 32.5], [-40, 30.5],
  [-32, 27.5], [-24, 24.5], [-17, 22], [-10, 18.6], [-5, 17.2], [0, 16],
]);

export const BOSPHORUS_WEST = line([[4, 18], [8, 23], [12, 30], [16, 38], [20, 48], [24, 62], [30, 90], [45, FAR]]);

export const PERA = [...HORN_NORTH, ...BOSPHORUS_WEST];

/** Genoese land walls of Galata, Golden Horn → tower → Bosphorus. */
export const GALATA_WALLS = line([[-10.3, 18.8], [-8.5, 21], [-5, 23.2], [-1.5, 22.3], [2, 20.5], [4.6, 19.3]]);

/** Galata's waterfront, Bosphorus → Golden Horn (closes the walled area). */
export const GALATA_SHORE = line([[4.2, 18.3], [0, 16.1], [-5, 17.3], [-10, 18.7]]);

export const GALATA = [...GALATA_WALLS, ...GALATA_SHORE];

export const GALATA_TOWER = squeeze([-5, 23.2]);

// ---------- Asian shore: Chrysopolis and Chalcedon ----------

export const ASIA = line([
  [62, FAR], [42, 70], [36, 50], [31, 35], [28, 24], [27, 16], [27.5, 8], [29, 0], [31, -7],
  [32.5, -13], [33.5, -19], [34.5, -25], [36.5, -30.5], [39.5, -31.5], [42, -29.5], [45, -33],
  [48, -39], [52, -41], [58, -40], [70, -42], [FAR, -45], [FAR, FAR],
]);

export const CHRYSOPOLIS = line([[29, 14], [33, 14], [34, 22], [30, 24]]);

export const CHALCEDON_TOWN = line([[35, -16], [42, -15], [43, -27], [37, -29]]);

// ---------- streets, harbours and routes ----------

/** The Mese, Constantinople's colonnaded main street, and its northern branch. */
export const MESE = line([[-2, 0.5], [-11, -2], [-18, -1.5], [-25, 1.5], [-36, -4], [-47, -11], [-58.3, -17.3]]);
export const MESE_NORTH = line([[-25, 1.5], [-33, 6], [-44, 11], [-56.2, 15]]);

export const FORUM_OF_CONSTANTINE = squeeze([-14.5, -1.75]);

/**
 * Constantinople's seven hills, like Rome's: centre, height and spread in map
 * units. Heights are exaggerated (the real hills rise 40–80 m), like the
 * landmarks, so that they read from the overview.
 */
export const SEVEN_HILLS = [
  { at: [2, 2], height: 1.5, radius: 4.5 }, // I: the Acropolis — Hagia Sophia, the palace
  { at: [-14, -1], height: 1.4, radius: 4 }, // II: Forum of Constantine
  { at: [-21, 7], height: 1.7, radius: 4.5 }, // III: above the Golden Horn
  { at: [-32, 9], height: 1.8, radius: 4.5 }, // IV: Holy Apostles
  { at: [-40, 17], height: 1.5, radius: 4 }, // V: above the Horn
  { at: [-49, 15], height: 1.9, radius: 5 }, // VI: towards Blachernae
  { at: [-42, -7], height: 1.4, radius: 6 }, // VII: Xerolophos, the broad south-western hill
].map(({ at, height, radius }) => ({ at: squeeze(at), height, radius: radius * squeezeScaleAt(at) }));

/** Ends of the great chain that could close the Golden Horn. */
export const CHAIN_SOUTH = squeeze([6, 10.2]);
export const CHAIN_NORTH = squeeze([0.4, 16.1]);

/** Leander's Tower islet off Chrysopolis. */
export const ARKLA_ISLET = squeeze([21, 12.5]);

export const HORN_PATROL = line([
  [-4, 14.2], [-12, 16.3], [-21, 19.8], [-30, 23.5], [-38, 26.8], [-31, 24.6], [-22, 20.9], [-13, 17.4],
]);

export const MARMARA_ROUTE = line([[-50, -32], [-10, -24], [20, -18], [24, -30], [-15, -38]]);
export const BOSPHORUS_ROUTE = line([[19, 2], [20, 25], [24, 48], [28, 47], [24, 24], [23, 0]]);

// ---------- labels (text in the locale files, keyed by id) ----------

export const WATER_LABELS = [
  { id: 'golden-horn', at: squeeze([-27, 22.7]) },
  { id: 'bosphorus', at: squeeze([20, 34]) },
  { id: 'propontis', at: squeeze([-18, -30]) },
];

export const PLACE_LABELS = [
  { id: 'chrysopolis', at: squeeze([34, 18]) },
  { id: 'mese', at: squeeze([-51, -13.4]) },
];

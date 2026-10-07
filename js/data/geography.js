/**
 * Geography of the Bosphorus mouth, in map units.
 *
 * Points are [east, north]; 1 map unit = 100 m; the origin is Hagia Sophia.
 * Shores are simplified from the OpenStreetMap coastline (© OpenStreetMap
 * contributors, ODbL), with modern landfill (Yenikapı, the Haydarpaşa port,
 * the Kadıköy waterfront) put back to the older shore, and the walls follow
 * their surviving course. Lists that run into the distance use FAR so land
 * extends beyond the fog line.
 *
 * The landmarks are drawn far above true scale, so the crowded heart of the
 * city around the Acropolis is gently magnified, like an inset on a pictorial
 * map: about 1.6× at the centre, fading to true scale within 1.5–2 km, which
 * leaves the Golden Horn, the Bosphorus and the Asian shore true to shape.
 * Coordinates are written as surveyed and pass through magnify(); anything
 * else placed by surveyed position must do the same.
 */

export const METERS_TO_MAP = 0.01;
export const LAND_HEIGHT = 0.3;
const FAR = 400;

const MAGNIFY_CENTRE = [-3, -3];
const MAGNIFY_STRENGTH = 0.6; // extra scale at the centre
const MAGNIFY_RADIUS = 10; // how far the magnification reaches

/** Local magnification at a surveyed distance r from the centre. */
const magnification = (r) => 1 + MAGNIFY_STRENGTH * Math.exp(-((r / MAGNIFY_RADIUS) ** 2));

/** Moves a surveyed [east, north] point to its place on the map. */
export function magnify([east, north]) {
  const [de, dn] = [east - MAGNIFY_CENTRE[0], north - MAGNIFY_CENTRE[1]];
  const k = magnification(Math.hypot(de, dn));
  return [MAGNIFY_CENTRE[0] + de * k, MAGNIFY_CENTRE[1] + dn * k];
}

const magnificationAt = ([east, north]) => magnification(Math.hypot(east - MAGNIFY_CENTRE[0], north - MAGNIFY_CENTRE[1]));

const line = (points) => points.map(magnify);
const reversed = (points) => [...points].reverse();

// ---------- Constantinople ----------

/** South shore of the Golden Horn inside the city, Blachernae → Seraglio Point. */
export const HORN_SOUTH_CITY = line([
  [-31.9, 36.6], [-29.7, 35.9], [-27.9, 31.4], [-26, 29.7], [-25.6, 26.4], [-23.3, 24.9], [-22.7, 22.9],
  [-19.1, 22], [-17.2, 19.7], [-16.6, 17.8], [-14.4, 15.9], [-13.8, 14.1], [-12, 13.1], [-8.9, 12.3],
  [-7.4, 10.8], [-5.9, 10.8], [-2.8, 9], [1.3, 9], [4.3, 10.2], [5.5, 9.7],
]);

/** Sea of Marmara shore of the city, Seraglio Point → the end of the land walls. */
export const MARMARA_CITY = line([
  [5.5, 9.7], [6.6, 4.9], [6.4, 1.8], [4.9, -2.5], [1.5, -6.2], [-0.1, -7.3], [-2, -8.2], [-6, -8.5],
  [-10.9, -7.2], [-14.5, -7.6], [-20, -8.2], [-26, -8.6], [-31, -8.2], [-34.8, -7.6], [-38, -9.7],
  [-40.2, -14.8], [-43.5, -19.2], [-46.6, -22.6], [-50.3, -23],
]);

/** Theodosian Land Walls, Marmara (south, past the Golden Gate) → Tekfur Sarayı (north). */
export const LAND_WALLS = line([
  [-50.3, -23], [-50.2, -20.6], [-48.6, -17.6], [-48.8, -16], [-50.1, -9.6], [-49, -3], [-48.3, 0.4],
  [-48.8, 6.1], [-46.9, 11.8], [-42.9, 17.3], [-38.6, 22.6], [-34, 27.4],
]);

/** The Golden Gate, where the Mese leaves the city through the land walls. */
export const GOLDEN_GATE = magnify([-48.7, -17.4]);

/** Later walls around the Blachernae quarter, closing the circuit at the Horn. */
export const BLACHERNAE_WALLS = line([[-34, 27.4], [-34.5, 29.3], [-34.4, 32], [-32.7, 33.6], [-32.3, 34.6], [-31.9, 36.6]]);

export const CITY = [...HORN_SOUTH_CITY, ...MARMARA_CITY, ...LAND_WALLS.slice(1), ...BLACHERNAE_WALLS.slice(1, -1)];

/** Sea walls follow both shores of the city. */
export const SEA_WALLS = [...HORN_SOUTH_CITY, ...MARMARA_CITY];

// ---------- Pera / Galata ----------

/** Genoese land walls of Galata, Golden Horn → tower → Bosphorus. */
export const GALATA_WALLS = line([[-9.9, 17], [-8.4, 19.6], [-5.1, 18.9], [-1.6, 18.9], [1.2, 17.6]]);

/** Galata's waterfront, Bosphorus → Golden Horn (closes the walled area). */
export const GALATA_SHORE = line([[1.2, 17.6], [-2.9, 14.7], [-5.1, 14.7], [-8.6, 15.3], [-9.9, 17]]);

export const GALATA = [...GALATA_WALLS, ...GALATA_SHORE.slice(1, -1)];

export const GALATA_TOWER = magnify([-5.1, 18.9]);

/**
 * The hill of Galata and the Pera ridge behind it, climbing from the Horn
 * towards Taksim: the tower stands 35 m above the water and the ridge reaches
 * 75 m. Heights are exaggerated like the city's seven hills.
 */
export const PERA_HILLS = [
  { at: [-4.8, 18.6], height: 1.0, radius: 3 }, // the crest of Galata, under the tower
  { at: [-3.5, 23.5], height: 1.5, radius: 4 }, // Tünel and Galatasaray
  { at: [1, 29.5], height: 1.8, radius: 5.5 }, // Taksim
].map(({ at, height, radius }) => ({ at: magnify(at), height, radius: radius * magnificationAt(at) }));

/** The shore under the ridge, Golden Horn → Galata's point → the Bosphorus; the hills fade to the water. */
export const PERA_SHORE = line([
  [-20.6, 28], [-16.2, 28.1], [-12.9, 24.6], [-10.8, 22.6], [-11.9, 21.6], [-10.9, 18.1], [-9.9, 17], [-8.6, 15.3],
  [-5.1, 14.7], [-2.9, 14.7], [1.2, 17.6], [7, 21.7], [10, 26.7], [11.4, 29.3], [13.9, 32.1],
]);

/** The land the ridge rises over: Galata and Pera between the two shores, closed well beyond the hills. */
export const PERA = [...PERA_SHORE, ...line([[16, 36], [12, 44], [0, 48], [-14, 42], [-22, 34]])];

// ---------- the European shore ----------

/** Sea of Marmara shore outside the walls, far west → the land walls. */
const MARMARA_OUTER = line([
  [-FAR, -48], [-86, -38], [-76, -32], [-66, -32.5], [-60.3, -30.3], [-57.5, -25.3], [-54.6, -23.8], [-50.3, -23],
]);

/** The Golden Horn upstream of the walls: south shore to its head, then the north shore back to Galata. */
const HORN_UPPER = line([
  [-31.9, 36.6], [-32.6, 36.9], [-34, 37.7], [-35.5, 43], [-37.9, 45.8], [-37.6, 48], [-34.4, 51.9],
  [-28.2, 53.7], [-28.7, 57.4], [-30, 61.5], [-29, 63], [-27.6, 62.6], [-27.7, 59.1], [-26.7, 54.4],
  [-27.3, 52.1], [-33.5, 48.8], [-34.6, 45.3], [-32.5, 41], [-28.1, 38.3], [-26.5, 35.9], [-24.7, 32.1],
  [-23.1, 29.7], [-20.6, 28], [-16.2, 28.1], [-12.9, 24.6], [-10.8, 22.6], [-11.9, 21.6], [-10.9, 18.1],
  [-9.9, 17],
]);

/** West shore of the Bosphorus, Galata → the Black Sea. */
const BOSPHORUS_WEST = line([
  [1.2, 17.6], [7, 21.7], [10, 26.7], [11.4, 29.3], [13.9, 32.1], [30.8, 38.8], [37.5, 43], [44.2, 45.7],
  [47.4, 56.6], [50.9, 60.3], [52.1, 64.6], [55.6, 65.9], [53.7, 73.8], [54, 77], [62.6, 80.6], [63.5, 85],
  [64.5, 106], [74, 124], [66, 146], [65, 177], [80, 240], [100, FAR],
]);

/** Thrace: the peninsula, and Galata and Pera beyond the Golden Horn, one landmass round the Horn's head. */
export const EUROPE = [
  ...MARMARA_OUTER,
  ...reversed(MARMARA_CITY).slice(1),
  ...reversed(HORN_SOUTH_CITY).slice(1),
  ...HORN_UPPER.slice(1),
  ...reversed(GALATA_SHORE).slice(1),
  ...BOSPHORUS_WEST.slice(1),
  [-FAR, FAR],
];

// ---------- Asian shore: Chrysopolis and Chalcedon ----------

export const ASIA = line([
  [110, FAR], [104, 160], [100, 135], [83, 112], [73, 100], [71, 83], [70.6, 77], [63.7, 73.1], [64.5, 64.3],
  [60.7, 58.8], [61.4, 54.3], [60, 50.6], [60.4, 44.1], [50.8, 38.8], [35.3, 26], [31.4, 23.7], [27.8, 19.6],
  [24.6, 19.3], [22.9, 17.2], [22.1, 14.3], [23.9, 11.8], [25.3, 8.3], [26, 4.9], [24.9, 0.7], [25.6, -2.5],
  [27.6, -6.3], [30.6, -9.8], [33.2, -12.6], [35.2, -14.1], [36.7, -15.6], [36.4, -17.6], [34.6, -20.2],
  [33.6, -25.9], [33.3, -30.5], [34.6, -33], [37.5, -32.1], [41.4, -32.1], [45, -29.6], [48.7, -33.4],
  [49.8, -36.4], [48.6, -40.5], [45.8, -42.2], [43.3, -45.3], [45.6, -46.8], [48.2, -44.2], [51.8, -47.7],
  [54.8, -43.4], [59.3, -44.8], [61.5, -47], [65.6, -49.6], [69.1, -51.7], [76.4, -54.2], [FAR, -75], [FAR, FAR],
]);

export const CHRYSOPOLIS = line([[24.5, 12.5], [31, 12.5], [34, 22], [28, 20]]);

export const CHALCEDON_TOWN = line([[36.5, -14.5], [44, -15], [44, -28], [35, -29]]);

// ---------- streets, harbours and routes ----------

/**
 * The Mese, Constantinople's colonnaded main street, from the Milion past the
 * fora of Constantine, the Ox and Arcadius to the Golden Gate, and its
 * northern branch past the Holy Apostles to the Charisian Gate. The Forum of
 * Constantine is set some 450 m west of its true site, making room for the
 * Hippodrome and the Basilica Cistern at their exaggerated size.
 */
const FORUM_SITE = [-12, 1.25];
export const MESE = line([[-1.5, 0.3], FORUM_SITE, [-19.5, 4], [-27, 1], [-36.3, -5.7], [-43, -12], [-48.7, -17.4]]);
export const MESE_NORTH = line([[-19.5, 4], [-25.8, 11.5], [-32, 17], [-38.4, 22.8]]);

export const FORUM_OF_CONSTANTINE = magnify(FORUM_SITE);

/**
 * Constantinople's seven hills, like Rome's: centre, height and spread in map
 * units. Heights are exaggerated (the real hills rise 40–80 m), like the
 * landmarks, so that they read from the overview.
 */
export const SEVEN_HILLS = [
  { at: [2, 2], height: 1.0, radius: 4 }, // I: the Acropolis — Hagia Sophia, the palace; the lowest of the seven
  { at: [-11.5, 1], height: 1.4, radius: 3.5 }, // II: Forum of Constantine
  { at: [-14, 8.2], height: 1.6, radius: 4 }, // III: Süleymaniye, above the Forum of Theodosius and the Golden Horn
  { at: [-25.8, 12], height: 1.7, radius: 4.5 }, // IV: Holy Apostles
  { at: [-25.8, 21], height: 1.6, radius: 3.5 }, // V: above the Horn
  { at: [-34.5, 25.3], height: 1.9, radius: 4.5 }, // VI: Edirnekapı and Chora, the highest, just inside the Charisian Gate
  { at: [-38, -6.2], height: 1.4, radius: 6 }, // VII: Xerolophos, the broad south-western hill
].map(({ at, height, radius }) => ({ at: magnify(at), height, radius: radius * magnificationAt(at) }));

/** Ends of the great chain that could close the Golden Horn. */
export const CHAIN_SOUTH = magnify([0, 9]);
export const CHAIN_NORTH = magnify([-2.4, 14.7]);

/** Leander's Tower islet off Chrysopolis. */
export const ARKLA_ISLET = magnify([20.1, 13.9]);

export const HORN_PATROL = line([
  [-3, 12], [-9, 14.3], [-14, 18], [-19.5, 23.8], [-24.5, 28.3], [-26.8, 33], [-25.2, 30.2], [-20.5, 25.8],
  [-15, 20.5], [-9.5, 15.8], [-4, 13.2],
]);

export const MARMARA_ROUTE = line([[-50, -32], [-10, -22], [18, -18], [24, -30], [-15, -38]]);
export const BOSPHORUS_ROUTE = line([[14, 2], [15, 20], [29, 32], [42, 40], [45, 37.5], [33, 28], [19, 16], [20, 2]]);

// ---------- labels (text in the locale files, keyed by id) ----------

export const WATER_LABELS = [
  { id: 'golden-horn', at: magnify([-21, 25.5]) },
  { id: 'bosphorus', at: magnify([22, 30]) },
  { id: 'propontis', at: magnify([-18, -25]) },
];

export const PLACE_LABELS = [
  { id: 'mese', at: magnify([-44, -10]) },
];

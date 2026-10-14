import * as THREE from 'three';
import { materials as M } from './lib/materials.js';
import {
  archShape, archedWallGeometry, box, colonnade, crenellationGeometry, cylinder, gableRoof, groundPlane, mesh, windowRow,
} from './lib/primitives.js';
import { scatterHouses } from './lib/buildings.js';
import { createWaterMaterial } from './lib/water.js';
import { finalizeModel } from './lib/merge.js';
import { labelAt, labelled } from './lib/parts.js';
import { createRandom } from '../util/random.js';
import { createMerchantShip } from './merchantShip.js';
import { createDromon } from './dromon.js';
import { HORN_SOUTH_CITY, LAND_HEIGHT, MARMARA_CITY, METERS_TO_MAP } from '../data/geography.js';

/**
 * The city's three great harbours: the Harbour of Theodosius at the mouth of
 * the Lycus (Yenikapı), the Harbour of Julian — later of Sophia, the
 * Kontoskalion — below the Hippodrome, both on the Marmara shore, and the
 * Neorion on the Golden Horn.
 *
 * Each is built the same way: x runs along the shore, the sea lies to +z,
 * the shoreline is z = 0 and the city's sea wall runs 10 m inland of it,
 * where the map draws its own sea walls, built here to the same height and
 * thickness so the two meet. The basin lies inside the wall, entered by an
 * arched water gate between two towers; quays of dressed stone surround it
 * at y = 0, and the water lies WATER below them.
 *
 * On the map the model stands on the land, whose top is its y = 0; a basin
 * sunk below that would be hidden by the ground, so the whole precinct is
 * raised MAP_LIFT on a stone platform, the water just above the land, and
 * whatever stands in the sea (the moles) reaches down to the map's sea far
 * below. (Müller-Wiener, Die Häfen von Byzantion, Konstantinupolis, Istanbul;
 * the Yenikapı excavation reports.)
 */

const WATER = -2.2; // the water's surface, below the quays
const WALL = { line: -10, height: 9.5, thickness: 3.5, tower: 7.5, towerHeight: 15 }; // as the map's sea walls, at its scale
const SCALE = 4; // map exaggeration of every harbour
const MAP_LIFT = 3.4; // on the map, how far the precinct is raised over the land so its water stands clear of the ground
const SEA_DROP = LAND_HEIGHT / (SCALE * METERS_TO_MAP); // on the map, from the land's top down to the sea, in model metres

/** The water of the map's basins, matched to the map's own sea (its ripples are per model metre here). */
const mapWater = Object.assign(createWaterMaterial({ scale: 0.9 * METERS_TO_MAP * SCALE, deep: 0x19587a, shallow: 0x3c8da3, sky: 0xb4d2dc }), {
  // Drawn over the city's ground, which is itself pulled forward (polygonOffset -2 to -6) over the land.
  polygonOffset: true,
  polygonOffsetFactor: -8,
  polygonOffsetUnits: -8,
});

/**
 * Where each harbour stands on the map: its origin on the shore at a given
 * east coordinate, turned to the shore there, and the stretch of the shore it
 * takes up (half its length along x, in model metres) so the map's sea wall
 * can leave the harbour its own.
 */
export const HARBOURS = {
  'theodosian-harbour': { shore: MARMARA_CITY, east: -23.66, seaward: 'south', halfLength: 78 },
  'harbour-of-julian': { shore: MARMARA_CITY, east: -14.4, seaward: 'south', halfLength: 58 },
  neorion: { shore: HORN_SOUTH_CITY, east: -1.2, seaward: 'north', halfLength: 32 },
};

/** The map placement of a harbour (see landmarks.js). */
export function harbourPlacement(id) {
  const { shore, east, seaward } = HARBOURS[id];
  const { at, angle } = shorePoint(shore, east);
  // The model's +z is the sea: south for an unturned model, so a harbour facing north turns about.
  const rotation = (angle * 180) / Math.PI + (seaward === 'north' ? 180 : 0);
  return { at, rotation, scale: SCALE, clearance: 0.2 };
}

/**
 * The stretch of the map's sea-wall line each harbour builds itself, as
 * [from, to] in map units, for the map's sea walls to leave out.
 */
export function harbourWallSpans() {
  return Object.keys(HARBOURS).map((id) => {
    const { halfLength } = HARBOURS[id];
    const { at, rotation } = harbourPlacement(id);
    const r = (rotation * Math.PI) / 180;
    const metre = SCALE * METERS_TO_MAP;
    const point = (x) => [at[0] + (x * Math.cos(r) - WALL.line * Math.sin(r)) * metre, at[1] + (x * Math.sin(r) + WALL.line * Math.cos(r)) * metre];
    return [point(-halfLength), point(halfLength)];
  });
}

/**
 * The map's sea-wall line (a polyline of [east, north], already set back from
 * the shore) with the stretches the harbours build themselves cut out: the
 * pieces that remain, for the map to draw its sea walls along.
 */
export function withoutHarbours(line) {
  const along = [0];
  for (let i = 1; i < line.length; i++) along.push(along[i - 1] + Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]));
  // How far along the line its nearest point to p lies.
  const project = ([px, py]) => {
    let best = [Infinity, 0];
    for (let i = 1; i < line.length; i++) {
      const [[ax, ay], [bx, by]] = [line[i - 1], line[i]];
      const lengthSq = (bx - ax) ** 2 + (by - ay) ** 2 || 1;
      const t = Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / lengthSq));
      const distance = Math.hypot(px - (ax + t * (bx - ax)), py - (ay + t * (by - ay)));
      if (distance < best[0]) best = [distance, along[i - 1] + t * (along[i] - along[i - 1])];
    }
    return best[1];
  };
  const pointAt = (s) => {
    const i = Math.max(1, along.findIndex((value) => value >= s));
    const t = (s - along[i - 1]) / (along[i] - along[i - 1] || 1);
    return [line[i - 1][0] + t * (line[i][0] - line[i - 1][0]), line[i - 1][1] + t * (line[i][1] - line[i - 1][1])];
  };
  const slice = (s0, s1) => [pointAt(s0), ...line.filter((_, i) => along[i] > s0 && along[i] < s1), pointAt(s1)];
  const cuts = harbourWallSpans().map((span) => span.map(project).sort((a, b) => a - b)).sort((a, b) => a[0] - b[0]);
  const pieces = [];
  let start = 0;
  for (const [s0, s1] of cuts) {
    if (s0 > start) pieces.push(slice(start, s0));
    start = Math.max(start, s1);
  }
  if (start < along.at(-1)) pieces.push(slice(start, along.at(-1)));
  return pieces;
}

/** The point of a shore polyline at a given east coordinate, and the shore's heading there (eastwards, radians). */
function shorePoint(line, east) {
  for (let i = 1; i < line.length; i++) {
    const [a, b] = [line[i - 1], line[i]];
    const [west, eastEnd] = a[0] < b[0] ? [a, b] : [b, a];
    if (east < west[0] || east > eastEnd[0]) continue;
    const t = (east - west[0]) / (eastEnd[0] - west[0]);
    return { at: [east, west[1] + t * (eastEnd[1] - west[1])], angle: Math.atan2(eastEnd[1] - west[1], eastEnd[0] - west[0]) };
  }
  throw new Error(`no shore at east ${east}`);
}

// ---------- the harbours ----------

/**
 * The Harbour of Theodosius (Portus Theodosiacus), built under Theodosius I
 * where the Lycus reached the Marmara: a broad basin inside the sea wall,
 * sheltered by a breakwater, its quays lined with granaries and a portico,
 * the stream entering at its north-west corner — the silt it carried
 * finally filled the harbour. Merchantmen lie at the quays. The basin's
 * outline and the breakwater are a reconstruction: the excavations at
 * Yenikapı found the harbour's floor and its wrecks, not its plan.
 */
export function createTheodosianHarbour({ lod = 'detail' } = {}) {
  const detail = lod === 'detail';
  const harbour = harbourSite({
    detail,
    basin: { x: [-62, 62], z: [-88, -11.5] },
    precinct: { x: [-78, 78], z: [-122, -11.5] },
    gate: { x: 0, width: 16 },
    towers: [-78, -40, -15, 15, 40, 78],
    channel: [-59, -51], // the Lycus
    extent: { x: [-100, 100], z: [-150, 70] },
  });

  // The breakwater, out in the sea before the mouth, with a light at its eastern end.
  labelled(harbour, 'harbourMole', () => {
    mole(harbour, detail, { x: [-46, 30], z: [24, 31] });
    mole(harbour, detail, { x: [30, 37], z: [6, 31] });
  });
  lighthouse(harbour, detail, 33.5, 27.5);

  labelAt(harbour, 'lycusMouth', -55, 3, -110); // the stream enters at the north-west corner, through its cut in the quay

  // Granaries (horrea) along the north quay, and a portico on the east quay.
  labelled(harbour, 'horrea', () => {
    for (const x of [-30, 8, 46]) warehouse(harbour, detail, { x, z: -106, length: 34, depth: 14, height: 10, material: M.brick });
  });
  labelled(harbour, 'harbourPortico', () => portico(harbour, detail, { x: 70, z: -50, length: 70, along: 'z' }));
  labelAt(harbour, 'theodosianBasin', 0, 4, -50);

  ships(harbour, detail, [
    { x: -40, z: -82, heading: 0, banner: 'byzantine' },
    { x: 8, z: -82, heading: 0.05, banner: 'byzantine' },
    { x: 54, z: -45, heading: Math.PI / 2, banner: 'venice' },
    { x: -30, z: -40, heading: 0.4, banner: 'byzantine', sail: true },
  ]);
  return finishHarbour(harbour, detail, { houses: { area: [-95, -148, 95, -126], count: 16, seed: 390 } });
}

/**
 * The Harbour of Julian, later of Sophia — the Kontoskalion: a smaller,
 * deep basin below the Hippodrome, given a mole by Anastasius I and dredged
 * by Justin II, walled with dressed stone and chained by Michael VIII, its
 * mouth closed with iron gates by Andronikos II; along its north side the
 * arsenal begun by Theophilos, with ship-sheds open to the water. Galleys of
 * the imperial fleet lie in the basin.
 */
export function createHarbourOfJulian({ lod = 'detail' } = {}) {
  const detail = lod === 'detail';
  const harbour = harbourSite({
    detail,
    basin: { x: [-44, 44], z: [-70, -11.5] },
    precinct: { x: [-58, 58], z: [-104, -11.5] },
    gate: { x: -6, width: 14, ironGates: true },
    towers: [-58, -30, -18, 6, 30, 58],
    extent: { x: [-80, 80], z: [-130, 60] },
  });
  labelAt(harbour, 'kontoskalionGates', -6, WALL.towerHeight + 2, WALL.line);

  // The mole of Anastasius, hooked round the mouth against the south-west wind.
  labelled(harbour, 'anastasiusMole', () => {
    mole(harbour, detail, { x: [20, 27], z: [-8, 30] });
    mole(harbour, detail, { x: [-26, 20], z: [24, 30] });
  });

  // The arsenal: ship-sheds along the north quay, each with a slipway down into the basin.
  labelled(harbour, 'arsenal', () => {
    for (let i = 0; i < 6; i++) shipShed(harbour, detail, { x: -35 + i * 14, back: -100, front: -72, water: -70, width: 12 });
  });

  galleys(harbour, detail, [
    { x: -20, z: -48, heading: 0.15 },
    { x: 18, z: -36, heading: -0.1 },
  ]);
  ships(harbour, detail, [{ x: 34, z: -58, heading: Math.PI / 2, banner: 'byzantine' }]);
  return finishHarbour(harbour, detail, { houses: { area: [-75, -128, 75, -110], count: 10, seed: 362 } });
}

/**
 * The Neorion, the dockyard harbour on the Golden Horn: a small basin inside
 * the sea wall with slipways where hulls stand on the stocks, storehouses
 * along its quays, and the Porta Neoriou, the gate in the sea wall beside
 * its mouth. A timber landing stage reaches out into the Horn.
 */
export function createNeorion({ lod = 'detail' } = {}) {
  const detail = lod === 'detail';
  const harbour = harbourSite({
    detail,
    basin: { x: [-22, 22], z: [-46, -11.5] },
    precinct: { x: [-32, 32], z: [-58, -11.5] },
    gate: { x: -4, width: 12 },
    towers: [-32, -14, 6, 32],
    landGate: 26,
    extent: { x: [-50, 50], z: [-80, 45] },
  });
  labelAt(harbour, 'portaNeoriou', 26, WALL.height + 2, WALL.line);
  labelAt(harbour, 'neorionBasin', 0, 4, -30);

  // Slipways on the west quay, a hull on the stocks on one of them.
  labelled(harbour, 'slipways', () => {
    for (const z of [-40, -26]) harbour.add(slipway(detail, { x: -22, z, length: 10, width: 6, toward: 'x' }));
  });
  // The hull stands on the stocks at the head of the slipway, bow to the water.
  const onStocks = createMerchantShip({ lod, banner: 'byzantine', sail: false });
  onStocks.scale.setScalar(0.75);
  onStocks.rotation.set(0, 0, -0.1);
  onStocks.position.set(-21, 0.4, -40);
  delete onStocks.userData.animate;
  harbour.add(onStocks);

  labelled(harbour, 'storehouses', () => {
    warehouse(harbour, detail, { x: -8, z: -52, length: 24, depth: 10, height: 8, material: M.plaster });
    warehouse(harbour, detail, { x: 16, z: -52, length: 18, depth: 10, height: 7, material: M.plaster });
    warehouse(harbour, detail, { x: 27.5, z: -32, length: 22, depth: 9, height: 7, material: M.plaster, along: 'z' });
  });

  // The landing stage out in the Horn, west of the mouth.
  const stage = new THREE.Group();
  stage.add(box(5, 0.5, 22, M.wood, -20, -0.9, 10));
  if (detail) {
    for (let k = 0; k < 4; k++) for (const side of [-1, 1]) stage.add(cylinder(0.25, 0.25, 4, M.wood, -20 + side * 2.2, WATER - 2.6, 2 + k * 5.5, 6));
  } else {
    stage.add(box(4.6, SEA_DROP + MAP_LIFT - 1.4, 21.6, M.wood, -20, -(SEA_DROP + MAP_LIFT), 10)); // its piles, down to the map's sea
  }
  harbour.add(stage);

  ships(harbour, detail, [
    { x: 8, z: -30, heading: 0.1, banner: 'byzantine', scale: 0.75 },
    { x: -8, z: 22, heading: Math.PI / 2 + 0.1, banner: 'genoa' },
  ]);
  return finishHarbour(harbour, detail, { houses: { area: [-45, -78, 45, -64], count: 6, seed: 697 } });
}

// ---------- the harbour site ----------

/**
 * The common ground of a harbour: the quays round the basin, the water, the
 * sea wall with its towers and water gate, and — in the diorama — the land
 * running back to the plinth's edge and the sea beyond the shore.
 */
function harbourSite({ detail, basin, precinct, gate, towers, landGate = null, channel = null, extent }) {
  const harbour = new THREE.Group();
  const foot = detail ? -6 : -MAP_LIFT;
  const land = detail ? extent : { x: precinct.x, z: [precinct.z[0], precinct.z[1]] };
  const [bx0, bx1] = basin.x;
  const [bz0, bz1] = basin.z;
  const [lx0, lx1] = land.x;
  const [lz0] = land.z;

  // The quays: the land round the basin, its edge dropping to the water.
  const ground = (x0, x1, z0, z1) => harbour.add(box(x1 - x0, -foot, z1 - z0, M.paving, (x0 + x1) / 2, foot, (z0 + z1) / 2));
  ground(lx0, bx0, lz0, bz1);
  ground(bx1, lx1, lz0, bz1);
  if (channel) {
    // A stream's channel cut back through the quay behind the basin.
    ground(bx0, channel[0], lz0, bz0);
    ground(channel[1], bx1, lz0, bz0);
  } else {
    ground(bx0, bx1, lz0, bz0);
  }
  // A kerb of dressed stone along the quay's edge.
  for (const [x0, x1, z0, z1] of [[bx0 - 1.2, bx0, bz0 - 1.2, bz1], [bx1, bx1 + 1.2, bz0 - 1.2, bz1], [bx0, bx1, bz0 - 1.2, bz0]]) {
    harbour.add(box(x1 - x0, 0.3, z1 - z0, M.stone, (x0 + x1) / 2, 0, (z0 + z1) / 2));
  }

  // The water: on the map just the basin (the map has its sea); in the diorama the basin and the sea as one sheet.
  if (detail) {
    harbour.add(groundPlane(extent.x[1] - extent.x[0], extent.z[1] - lz0, M.water, 0, WATER, (extent.z[1] + lz0) / 2));
  } else {
    harbour.add(groundPlane(bx1 - bx0, bz1 + 0.5 - bz0, mapWater, (bx0 + bx1) / 2, WATER, (bz0 + bz1 + 0.5) / 2));
    if (channel) harbour.add(groundPlane(channel[1] - channel[0], bz0 - lz0, mapWater, (channel[0] + channel[1]) / 2, WATER, (bz0 + lz0) / 2));
  }

  // In the diorama, the strip of shore outside the wall, broken by the channel from the water gate.
  if (detail) {
    const half = gate.width / 2;
    const shoreTop = -1;
    const strip = (x0, x1) => harbour.add(box(x1 - x0, shoreTop + 6, -WALL.line - 1.7, M.stone, (x0 + x1) / 2, -6, (WALL.line + 1.7) / 2));
    strip(extent.x[0], gate.x - half);
    strip(gate.x + half, extent.x[1]);
  }

  seaWall(harbour, detail, { x: [lx0 + 0.3, lx1 - 0.3], foot, gate, towers, landGate }); // its ends a step inside the quay's
  return harbour;
}

/**
 * The stretch of sea wall along the harbour, pierced by the water gate (and
 * a land gate if given): curtain of banded masonry, a crenellated parapet on
 * the seaward side and square towers, at the height of the map's sea walls.
 */
function seaWall(harbour, detail, { x: [x0, x1], foot, gate, towers, landGate }) {
  const length = x1 - x0;
  const centre = (x0 + x1) / 2;
  const height = WALL.height - foot;
  const spring = WATER - foot + 1.5; // the water gate's jambs stand 1.5 m above the water
  const openings = [{ x: gate.x - centre, width: gate.width, bottom: 0, spring }];
  if (landGate !== null) openings.push({ x: landGate - centre, width: 4, bottom: -foot + 0.12, spring: -foot + 3.5 }); // a step up from the quay
  harbour.add(mesh(archedWallGeometry({ length, height, thickness: WALL.thickness, openings, curveSegments: detail ? 10 : 5 }), M.banded, centre, foot, WALL.line));
  const parapet = mesh(crenellationGeometry(length - 0.4, { merlon: 1.2, gap: 1, height: 1.3, thickness: 0.8 }), M.banded, centre, WALL.height, WALL.line + WALL.thickness / 2 - 0.45);
  harbour.add(parapet);

  for (const x of towers) {
    const t = WALL.tower;
    harbour.add(box(t, WALL.towerHeight - foot, t, M.banded, x, foot, WALL.line));
    harbour.add(box(t + 0.6, 0.6, t + 0.6, M.stone, x, WALL.towerHeight - 0.5, WALL.line)); // a string course below the merlons
    for (const [dx, dz, turn] of [[0, t / 2 - 0.4, 0], [0, -t / 2 + 0.4, 0], [t / 2 - 0.4, 0, Math.PI / 2], [-t / 2 + 0.4, 0, Math.PI / 2]]) {
      const merlons = mesh(crenellationGeometry(t - 1.6, { merlon: 1.1, gap: 0.9, height: 1.3, thickness: 0.8 }), M.banded, x + dx, WALL.towerHeight, WALL.line + dz);
      merlons.rotation.y = turn;
      harbour.add(merlons);
    }
  }

  // The water gate: on the map a dark passage (the land beyond it is not the harbour's water), in the diorama open water.
  if (!detail) {
    const passage = new THREE.ShapeGeometry(archShape(gate.width - 0.1, spring + gate.width / 2 - 0.1), 8);
    for (const side of [-1, 1]) {
      const plane = mesh(passage, M.opening, gate.x, foot, WALL.line + side * (WALL.thickness / 2 - 0.6));
      plane.rotation.y = side > 0 ? 0 : Math.PI;
      harbour.add(plane);
    }
  }
  if (gate.ironGates) {
    // Andronikos II's iron gates, swung open into the basin against the wall's inner face.
    const leaf = gate.width / 2 - 0.4;
    for (const side of [-1, 1]) {
      harbour.add(box(leaf, 5.5, 0.3, M.iron, gate.x + side * (gate.width / 2 + leaf / 2 + 0.2), WATER, WALL.line - WALL.thickness / 2 - 0.4));
    }
  }
}

/** A breakwater of big stones out in the sea: on the map it reaches down to the map's sea. */
function mole(harbour, detail, { x: [x0, x1], z }) {
  const [z0, z1] = z;
  const bottom = detail ? -6 : -(SEA_DROP + MAP_LIFT);
  const top = -0.6;
  harbour.add(box(x1 - x0, top - bottom, z1 - z0, M.stoneDark, (x0 + x1) / 2, bottom, (z0 + z1) / 2));
  if (detail) {
    // Tumbled blocks along its foot, against the waves.
    // Spaced along each long side so no two touch, each standing to its own height.
    const rnd = createRandom(Math.round(x0 * 7 + z0 * 13));
    const alongX = x1 - x0 > z1 - z0;
    const [from, to] = alongX ? [x0, x1] : [z0, z1];
    for (const side of [-1, 1]) {
      for (let t = from + 1.5, k = 0; t < to - 1.5; t += 3.4, k++) {
        const edge = side < 0 ? (alongX ? z0 : x0) - 0.9 : (alongX ? z1 : x1) + 0.9;
        const block = box(1.5 + rnd.next() * 0.6, 0.9 + (k % 5) * 0.12 + rnd.next() * 0.05, 1.4 + rnd.next() * 0.5, M.stoneDark, 0, WATER - 0.6, 0);
        block.position.x = alongX ? t : edge;
        block.position.z = alongX ? edge : t;
        block.rotation.y = rnd.next() * Math.PI;
        harbour.add(block);
      }
    }
  }
}

/** A small round light-tower with a fire on its top. */
function lighthouse(harbour, detail, x, z) {
  harbour.add(cylinder(2.6, 3, 9, M.stone, x, -0.6, z, detail ? 16 : 8));
  harbour.add(cylinder(3.1, 3.1, 0.6, M.stoneDark, x, 8.4, z, detail ? 16 : 8));
  harbour.add(cylinder(1.4, 1.4, 1.2, M.fire, x, 9, z, 8));
  labelAt(harbour, 'harbourLight', x, 12, z);
}

/**
 * A long warehouse with a tiled gable roof, its doors on the quay side (+z,
 * or +x when `along` is 'z').
 */
function warehouse(harbour, detail, { x, z, length, depth, height, material, along = 'x' }) {
  const building = new THREE.Group();
  building.add(box(length, height, depth, material, 0, 0, 0));
  building.add(gableRoof(length, depth, depth * 0.3, M.roof, 0, height, 0, 0.5));
  if (detail) {
    const doors = windowRow({ count: Math.max(2, Math.round(length / 6)), spacing: 5.6, width: 2.6, height: 4, y: 0 });
    doors.position.z = depth / 2 + 0.06;
    building.add(doors);
    const windows = windowRow({ count: Math.max(2, Math.round(length / 4)), spacing: 3.8, width: 0.9, height: 1.4, y: height - 2.6 });
    windows.position.z = depth / 2 + 0.06;
    building.add(windows);
  }
  building.position.set(x, 0, z);
  if (along === 'z') building.rotation.y = -Math.PI / 2;
  harbour.add(building);
}

/** A colonnade with a lean-to roof along the quay, open to the water on +z (-x when along z). */
function portico(harbour, detail, { x, z, length, along }) {
  const group = new THREE.Group();
  const columns = colonnade({ length: length - 2, count: Math.round(length / 4.5), height: 5.5, radius: 0.4 });
  if (detail) group.add(columns);
  else group.add(box(length - 2, 5.5, 0.8, M.marble, 0, 0, 0)); // on the map the colonnade reads as a screen
  group.add(box(length, 6.4, 1, M.stone, 0, 0, -6.5)); // the back wall
  const roof = box(length + 0.6, 0.5, 8.2, M.roof, 0, 5.6, -3.2);
  roof.rotation.x = -0.12;
  group.add(roof);
  group.position.set(x, 0, z);
  if (along === 'z') group.rotation.y = -Math.PI / 2; // its open side (+z) turned to face -x
  harbour.add(group);
}

/**
 * A ship-shed: an open-fronted hall with a tiled roof over a slipway that
 * runs down from the back of the quay into the basin.
 */
function shipShed(harbour, detail, { x, back, front, water, width }) {
  const depth = front - back;
  const shed = new THREE.Group();
  const height = 7;
  for (const side of [-1, 1]) shed.add(box(1, height, depth, M.brick, side * (width / 2 - 0.5), 0, 0));
  shed.add(box(width - 2, height, 1, M.brick, 0, 0, -depth / 2 + 0.5));
  const roof = gableRoof(depth, width, 3, M.roof, 0, height, 0, 0.4); // its ridge running out towards the water
  roof.rotation.y = Math.PI / 2;
  shed.add(roof);
  shed.position.set(x, 0, back + depth / 2);
  harbour.add(shed);
  harbour.add(slipway(detail, { x, z: water, length: 10, width: width - 4, toward: 'z' }));
}

/**
 * A timber slipway running from the quay's edge at (x, z) down into the
 * water towards +x or +z (`toward`).
 */
function slipway(detail, { x, z, length, width, toward }) {
  const group = new THREE.Group();
  const drop = -WATER + 0.6;
  const ramp = box(length, 0.4, width, M.wood, 0, -0.2, 0);
  ramp.rotation.z = -Math.atan2(drop, length);
  ramp.position.y = -drop / 2 + 0.05;
  group.add(ramp);
  if (detail) {
    for (const dz of [-width / 2 + 0.6, width / 2 - 0.6]) {
      const rail = box(length, 0.25, 0.3, M.wood, 0, 0.2, dz);
      rail.rotation.z = ramp.rotation.z;
      rail.position.y = ramp.position.y + 0.25;
      group.add(rail);
    }
  }
  // Built centred and sloping down towards +x, from the quay's edge outwards.
  const [dx, dz] = toward === 'z' ? [0, length / 2] : [length / 2, 0];
  group.position.set(x + dx, 0, z + dz);
  if (toward === 'z') group.rotation.y = -Math.PI / 2;
  return group;
}

/** Merchantmen moored in the basin; on the map they lie still. */
function ships(harbour, detail, list) {
  for (const { x, z, heading, banner, sail = false, scale = 1 } of list) {
    const ship = createMerchantShip({ lod: detail ? 'detail' : 'map', banner, sail });
    ship.scale.setScalar(scale);
    // On the map a ship outside the wall floats on the map's sea, far below the raised basin.
    const atSea = !detail && z > WALL.line;
    ship.position.set(x, atSea ? -(SEA_DROP + MAP_LIFT) : WATER, z);
    ship.rotation.y = heading;
    if (!detail) delete ship.userData.animate;
    const holder = new THREE.Group();
    holder.add(ship);
    harbour.add(holder);
  }
}

/** Galleys of the fleet at their moorings, oars shipped: they neither row nor bob. */
function galleys(harbour, detail, list) {
  for (const { x, z, heading } of list) {
    const galley = createDromon({ lod: detail ? 'detail' : 'map' });
    // Moored, with its oars shipped: leave out the oars and the dromon diorama's own patch of sea.
    const drop = [];
    galley.traverse((object) => {
      delete object.userData.animate;
      if (object.userData.dynamic || object.material === M.water || object.material === M.waterSide) drop.push(object);
    });
    for (const object of drop) object.removeFromParent();
    galley.scale.setScalar(0.8);
    galley.position.set(x, WATER, z);
    galley.rotation.y = heading;
    harbour.add(galley);
  }
}

/** Houses behind the precinct in the diorama, the merge, and on the map the platform the harbour stands on. */
function finishHarbour(harbour, detail, { houses }) {
  if (detail) {
    const [x0, z0, x1, z1] = houses.area;
    scatterHouses(harbour, createRandom(houses.seed), { count: houses.count, area: [x0, z0, x1, z1] });
  }
  finalizeModel(harbour);
  if (!detail) harbour.position.y = MAP_LIFT;
  const root = new THREE.Group();
  root.add(harbour);
  // The diorama's camera looks in from +z: turned about, it looks across the basin to the wall and the sea beyond.
  if (detail) root.rotation.y = Math.PI;
  return root;
}

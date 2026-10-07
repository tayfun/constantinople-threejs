import * as THREE from 'three';
import { materials as M, tinted, cloth } from './lib/materials.js';
import {
  archGeometry, box, colonnade, crenelRingGeometry, crenellationGeometry, cylinder, cypress, dome, faceToward, flag,
  gableRoof, groundPlane, hipRoof, landGeometry, mesh, pyramid, roundTree, windowRow,
} from './lib/primitives.js';
import { createHouse } from './lib/buildings.js';
import { createHull } from './lib/hull.js';
import { createMerchantShip } from './merchantShip.js';
import { finalizeModel } from './lib/merge.js';
import { mapMeadow } from './lib/textures.js';
import { createRandom } from '../util/random.js';

/**
 * Chrysopolis (Üsküdar), "the city of gold", on the Asian shore facing the
 * Acropolis of Constantinople. Shown in Byzantine times, when it was the
 * ferry landing of the capital and the muster point of every road and army
 * bound into Anatolia: the harbour quay behind its mole, the walled customs
 * post (heir to the toll Alcibiades levied on Black Sea shipping in 410 BC),
 * warehouses and a market along the strand, the road climbing the terraced
 * slope into Asia, the monastery of Philippikos on the hill, the imperial
 * Scutarion palace on the low point that gave the town its later name, and
 * offshore the islet of Damalis, walled and towered by the Komnenoi (the
 * Maiden's Tower). The sea lies to the west (-x); the land rises eastward.
 *
 * The map build is the same town pared down: the terraces, harbour, customs
 * post, palace and monastery keep their massing and materials, but lose the
 * windows, figures, boats, ground planes and most of the scattered houses
 * (the map supplies its own), and the islet, which the map draws itself.
 */

const GROUND = 3;
const COAST = [
  [-40, -110], [130, -110], [130, 110], [-30, 110], [-58, 84], [-84, 62], [-84, 20], [-68, 4],
  [-66, -30], [-68, -62], [-58, -92],
];
const ROAD_Z = -12;

// The slope up from the shore, as four terraces whose edges wander a little with z.
// The lowest terrace widens southward, so the point by the islet stays a low shelf.
const TERRACE_HEIGHTS = [GROUND, 6, 9.5, 13, 17];
const TERRACE_BASE_X = [-34, 8, 50, 92];
const terraceBoundary = (i, z) =>
  TERRACE_BASE_X[i] + 3.5 * Math.sin(z / 23 + i * 1.7) + 1.5 * Math.sin(z / 9 + i) + Math.max(0, z - 40) * 1.4;
const terraceHeight = (x, z) => {
  let height = GROUND;
  for (let i = 0; i < TERRACE_BASE_X.length; i++) if (x >= terraceBoundary(i, z)) height = TERRACE_HEIGHTS[i + 1];
  return height;
};
const nearTerraceEdge = (x, z, margin) => TERRACE_BASE_X.some((_, i) => Math.abs(x - terraceBoundary(i, z)) < margin);

/** x of the western shoreline at a given z (the COAST's seaward edge). */
const SHORE = [[-110, -40], [-92, -58], [-62, -68], [-30, -66], [4, -68], [20, -84], [62, -84], [84, -58], [110, -30]];
function shoreX(z) {
  for (let i = 1; i < SHORE.length; i++) {
    const [z0, x0] = SHORE[i - 1];
    const [z1, x1] = SHORE[i];
    if (z <= z1) return x0 + ((z - z0) / (z1 - z0)) * (x1 - x0);
  }
  return SHORE[SHORE.length - 1][1];
}

const PLASTER = [0xf4e9d4, 0xf7f1e3, 0xe9d3ae, 0xf1dcbf, 0xdcb98e, 0xf5eee0, 0xe6c8a0];

const MONASTERY = [71, -55];
const MAP_MERLONS = { merlon: 1.6, gap: 1.2 }; // coarser battlements, for the map build

/** Square posts standing in for a colonnade on the map: the same rhythm and height at a tenth of the triangles. */
function posts({ length, count, height, radius = 0.4, material = M.marble }) {
  const group = new THREE.Group();
  const step = count > 1 ? length / (count - 1) : 0;
  for (let i = 0; i < count; i++) group.add(box(radius * 2, height, radius * 2, material, -length / 2 + step * i, 0, 0));
  return group;
}
const PALACE = [-28, 78];
const CUSTOMS = [-54, 24];

export function createChrysopolis({ lod = 'detail' } = {}) {
  const detail = lod === 'detail';
  const town = new THREE.Group();
  const rnd = createRandom(324);
  const elevation = terraceHeight;

  if (detail) {
    addLand(town);
    // Sea only beyond the shore: the plane's landward edges meet the land's bounds (x 130, z ±110).
    town.add(groundPlane(340, 220, M.water, -40, 0.6, 0));
  } else {
    town.position.y = -GROUND; // stand directly on the map's land, which supplies the shore strip
    addTerraces(town, 10, [-104, 101], detail); // kept inside the footprint of the harbour and houses
  }

  addHarbour(town, detail);
  addCustomsPost(town, detail);
  addRoad(town, detail, elevation);
  addMonastery(town, detail, elevation);
  addPalace(town, detail, elevation);
  addHeiferColumn(town);

  const avoid = [
    [-50, -66, 12], [-50, -50, 12], [-50, -34, 12], [-50, -18, 12], [-56, 2, 13], [CUSTOMS[0], CUSTOMS[1], 19],
    [MONASTERY[0], MONASTERY[1], 32], [PALACE[0], PALACE[1], 27], [-18, -19, 7], [-66, 52, 7], [112, -6, 5],
  ];
  scatterTown(town, rnd, { count: detail ? 54 : 24, avoid, elevation, detail });
  addPlanting(town, rnd, detail, elevation);

  finalizeModel(town);
  const banner = flag('byzantine', { width: 3, height: 2, pole: 6 });
  banner.position.set(CUSTOMS[0] - 11, GROUND + 14.6, CUSTOMS[1] + 10);
  town.add(banner);
  if (detail) {
    addDamalis(town);
    addShipping(town);
  }
  return town;
}

/** The shore strip and the terraces stepping up behind it, drier and scrubbier towards the top. */
function addLand(town) {
  town.add(mesh(landGeometry(COAST, GROUND, 6), M.grass));
  addTerraces(town, 5, [-110, 110], true);
  // The sandy strand behind the quay, where small boats are drawn up.
  town.add(groundPlane(5, 70, M.sand, -60.5, GROUND + 0.02, -36));
}

const mapLawns = new Map();
/** The map's meadow texture as a material, optionally tinted (for the drier upper terraces); one per tint. */
function mapLawn(tint = 0xffffff) {
  if (!mapLawns.has(tint)) mapLawns.set(tint, new THREE.MeshStandardMaterial({ map: mapMeadow(), color: tint, roughness: 0.95 }));
  return mapLawns.get(tint);
}

/** The four terraces of the slope, each a step of land whose western edge is sampled every `step` metres between the given z. */
function addTerraces(town, step, [zMin, zMax], detail = true) {
  // On the map the slope stands on the map's own meadow, so it is clad in that texture rather than the diorama's darker grass.
  const lawn = detail ? M.grass : mapLawn();
  const scrub = detail ? tinted('grass', 0xd8cf9c) : mapLawn(0xe8dfb2);
  for (let i = 0; i < TERRACE_BASE_X.length; i++) {
    const outline = [];
    for (let z = zMin; z <= zMax; z += step) outline.push([Math.min(130, terraceBoundary(i, z)), z]);
    if (outline[outline.length - 1][1] < zMax) outline.push([Math.min(130, terraceBoundary(i, zMax)), zMax]);
    outline.push([130, zMax], [130, zMin]);
    const height = TERRACE_HEIGHTS[i + 1];
    town.add(mesh(landGeometry(outline, height, height - TERRACE_HEIGHTS[i] + 0.5), i >= 2 ? scrub : lawn));
  }
}

// ---------- the harbour ----------

/** The quay, the mole with its beacon, warehouses and the fish market under its awnings. */
function addHarbour(town, detail) {
  // Quay along the shore, its face dropping into the water, with a darker coping.
  town.add(box(7, GROUND + 1, 74, M.stone, -66, -1, -36));
  town.add(box(7.4, 0.4, 74.4, M.stoneDark, -66, GROUND - 0.05, -36));
  // The mole, angled out from the north end to shelter the landing from the Bosphorus current.
  const mole = box(6, GROUND + 1.2, 42, M.stone, -82, -1, -84);
  mole.rotation.y = 0.6;
  town.add(mole);
  const beacon = [-94, -101];
  town.add(cylinder(2.6, 3, 7, M.stone, beacon[0], GROUND - 0.4, beacon[1], 10));
  town.add(cylinder(3.1, 3.1, 0.6, M.stoneDark, beacon[0], GROUND + 6.6, beacon[1], 10));
  town.add(cylinder(1.4, 1.4, 0.9, M.iron, beacon[0], GROUND + 7.2, beacon[1], 8));
  town.add(mesh(new THREE.IcosahedronGeometry(1.1, 0), M.fire, beacon[0], GROUND + 8.6, beacon[1]));
  if (detail) {
    for (const z of [-66, -52, -38, -24, -10]) town.add(cylinder(0.45, 0.5, 1.1, M.stoneDark, -68.5, GROUND + 0.35, z, 8));
    // Stone steps down to the ferries.
    for (let i = 0; i < 4; i++) town.add(box(0.8, 0.6, 6, M.stoneDark, -69.9 - i * 0.8, GROUND - 0.9 - i * 0.6, -36));
  }

  // Warehouses turned gable-end to the water, as in every Byzantine port.
  for (const [z, w, h] of [[-66, 15, 5.5], [-50, 17, 6], [-34, 14, 5], [-18, 16, 6]]) {
    const store = warehouse(w, 10, h, detail);
    store.position.set(-50, GROUND, z);
    town.add(store);
  }

  // The fish market by the landing: awnings on poles, a stall and amphorae.
  for (const [z, colour] of [[-5, 0xc4553d], [2, 0xe8dcc0], [9, 0x3f6f8c]]) {
    const awning = new THREE.Group();
    for (const [dx, dz] of [[-2.4, -2.4], [2.4, -2.4], [-2.4, 2.4], [2.4, 2.4]]) awning.add(cylinder(0.08, 0.1, 3, M.wood, dx, 0, dz, detail ? 5 : 3));
    const canvas = mesh(new THREE.PlaneGeometry(5.6, 5.6).rotateX(-Math.PI / 2), cloth(colour), 0, 3, 0);
    canvas.rotation.z = 0.12;
    awning.add(canvas);
    awning.add(box(3.6, 0.9, 1.4, M.wood, 0, 0, 0));
    awning.position.set(-56, GROUND, z);
    town.add(awning);
  }
  if (detail) {
    const jar = tinted('brick', 0xc98a5a);
    for (let i = 0; i < 7; i++) town.add(cylinder(0.3, 0.42, 0.9, jar, -62 + (i % 3) * 0.9, GROUND, -14 + i * 0.8, 6));
  }
}

function warehouse(w, d, h, detail) {
  const store = new THREE.Group();
  store.add(box(w, h, d, M.brick, 0, 0, 0));
  store.add(gableRoof(w, d, d * 0.32, M.roof, 0, h, 0, 0.5));
  if (detail) {
    const door = mesh(archGeometry(2.4, 3.6), M.opening, -w / 2 - 0.03, 0, 0);
    door.rotation.y = -Math.PI / 2;
    store.add(door);
    const vent = mesh(archGeometry(0.8, 1.2), M.opening, -w / 2 - 0.03, h - 2, 0);
    vent.rotation.y = -Math.PI / 2;
    store.add(vent);
  }
  return store;
}

// ---------- the customs post ----------

/** The walled customs post (kommerkion) above the landing, where ships out of the Black Sea paid their tithe. */
function addCustomsPost(town, detail) {
  const [x, z] = CUSTOMS;
  const [w, d, height] = [24, 22, 5];
  for (const side of [-1, 1]) {
    town.add(box(w, height, 1.8, M.stone, x, GROUND, z + side * d / 2));
    town.add(box(1.8, height, d, M.stone, x + side * w / 2, GROUND, z));
  }
  // A tower at the seaward corner watches the strait; the gate faces the quay.
  const tower = [x - w / 2 + 1, z + d / 2 - 1];
  town.add(box(7, 12, 7, M.stone, tower[0], GROUND, tower[1]));
  town.add(pyramid(8, 8, 2.6, M.roof, tower[0], GROUND + 12, tower[1]));
  town.add(box(2.4, 4.2, 3.4, M.opening, x - w / 2, GROUND, z - 4));
  town.add(box(5, 1.2, 2.6, M.stone, x - w / 2, GROUND + 4.2, z - 4));
  // The customs house inside, with a loggia where the tax-farmers sat.
  town.add(box(13, 6, 9, M.plaster, x + 2.5, GROUND, z));
  town.add(hipRoof(13, 9, 2.8, M.roof, x + 2.5, GROUND + 6, z, 0.5));
  const merlons = detail ? {} : MAP_MERLONS;
  for (const side of [-1, 1]) {
    town.add(mesh(crenellationGeometry(w - 1, merlons), M.stone, x, GROUND + height, z + side * (d / 2 + 0.55)));
    const parapet = mesh(crenellationGeometry(d - 1, merlons), M.stone, x + side * (w / 2 + 0.55), GROUND + height, z);
    parapet.rotation.y = Math.PI / 2;
    town.add(parapet);
  }
  const loggia = (detail ? colonnade : posts)({ length: 8, count: 4, height: 3.2, radius: 0.28 });
  loggia.rotation.y = Math.PI / 2;
  loggia.position.set(x - 5.5, GROUND, z);
  town.add(loggia);
  town.add(box(3, 0.4, 9.5, M.wood, x - 5.5, GROUND + 3.2, z));
  if (detail) {
    const windows = windowRow({ count: 3, spacing: 3, width: 0.8, height: 1.4, y: GROUND + 3.6 });
    windows.rotation.y = -Math.PI / 2;
    windows.position.set(x - 4.03, 0, z);
    town.add(windows);
    const slit = mesh(archGeometry(0.7, 1.6), M.opening, tower[0] - 3.53, GROUND + 8, tower[1]);
    slit.rotation.y = -Math.PI / 2;
    town.add(slit);
  }
}

// ---------- the road into Anatolia ----------

/** The paved road from the landing, climbing each terrace by a ramp, with its milestone and a wayside fountain. */
function addRoad(town, detail, elevation) {
  const breaks = TERRACE_BASE_X.map((_, i) => terraceBoundary(i, ROAD_Z));
  let from = -62;
  for (let i = 0; i <= breaks.length; i++) {
    const to = i < breaks.length ? breaks[i] - 4 : 130;
    const y = TERRACE_HEIGHTS[i];
    town.add(groundPlane(to - from, 7, M.paving, (from + to) / 2, y + 0.03, ROAD_Z));
    if (i < breaks.length) {
      // A ramp of paving between terraces, with a retaining wall each side.
      const rise = TERRACE_HEIGHTS[i + 1] - y;
      const length = 8;
      const ramp = box(Math.hypot(length, rise) + 0.6, 0.5, 7, M.paving, 0, 0, 0);
      ramp.position.set(breaks[i], y + rise / 2 - 0.2, ROAD_Z);
      ramp.rotation.z = Math.atan2(rise, length);
      town.add(ramp);
      for (const side of [-1, 1]) town.add(box(length + 2, rise + 0.6, 0.8, M.stone, breaks[i], y - 0.2, ROAD_Z + side * 3.9));
      from = breaks[i] + 4;
    }
  }
  if (!detail) return;
  // The milestone at the edge of town, and a fountain where travellers watered their beasts.
  town.add(cylinder(0.7, 0.8, 2.6, M.marble, 112, elevation(112, ROAD_Z + 6), ROAD_Z + 6, 10));
  const [fx, fz] = [-18, ROAD_Z - 7];
  const fy = elevation(fx, fz);
  town.add(box(7, 1.1, 2.6, M.marble, fx, fy, fz));
  town.add(box(7.4, 0.3, 3, M.marble, fx, fy + 1.1, fz));
  town.add(box(6, 2.6, 0.8, M.marble, fx, fy, fz - 1.6));
  town.add(mesh(new THREE.PlaneGeometry(6.4, 2).rotateX(-Math.PI / 2), M.water, fx, fy + 1.2, fz + 0.1));
}

// ---------- the monastery ----------

/** The monastery of Philippikos on the hill: a domed cross-in-square church inside its walled court, with the monks' range and refectory. */
function addMonastery(town, detail, elevation) {
  const [x, z] = MONASTERY;
  const y = elevation(x, z);
  // The church: a cross-in-square, apse to the east, narthex to the west.
  town.add(box(16, 8, 16, M.brick, x, y, z));
  town.add(box(18, 11, 6.5, M.brick, x, y, z));
  town.add(box(6.5, 11, 18, M.brick, x, y, z));
  town.add(hipRoof(16, 16, 1.5, M.roof, x, y + 8, z, 0.4));
  town.add(gableRoof(18, 6.5, 2.2, M.roof, x, y + 11, z, 0.4));
  const transept = gableRoof(18, 6.5, 2.2, M.roof, x, y + 11, z, 0.4);
  transept.rotation.y = Math.PI / 2;
  town.add(transept);
  for (const [dz, r, h] of [[0, 3.2, 7], [-5.5, 1.5, 5], [5.5, 1.5, 5]]) {
    town.add(faceToward(cylinder(r, r, h, M.brick, x + 8, y, z + dz, 10, { thetaStart: -Math.PI / 2, thetaLength: Math.PI }), 1, 0));
    town.add(faceToward(dome(r, M.roof, x + 8, y + h, z + dz, { phiLength: Math.PI, heightScale: 0.6, segments: 12 }), 1, 0));
  }
  town.add(cylinder(3.2, 3.2, 4.5, M.brick, x, y + 13.2, z, 12));
  town.add(dome(3.2, M.lead, x, y + 17.7, z, { heightScale: 0.72 }));
  addCross(town, x, y + 20, z, 2.2);
  town.add(box(4.5, 7, 16, M.brick, x - 10.25, y, z));
  town.add(hipRoof(4.5, 16, 1.5, M.roof, x - 10.25, y + 7, z, 0.4));
  if (detail) {
    const drumWindows = windowRow({ count: 4, spacing: 1.6, width: 0.6, height: 2.2, y: y + 14.2 });
    drumWindows.position.set(x, 0, z + 3.23);
    town.add(drumWindows);
    for (const side of [-1, 1]) {
      const windows = windowRow({ count: 3, spacing: 2.2, width: 0.7, height: 2.4, y: y + 7.8 });
      windows.position.set(x, 0, z + side * 3.28);
      windows.rotation.y = side > 0 ? 0 : Math.PI;
      town.add(windows);
    }
    const door = mesh(archGeometry(2, 3.6), M.opening, x - 12.53, y, z);
    door.rotation.y = -Math.PI / 2;
    town.add(door);
  }
  // The enclosure wall with its gate, the monks' range with an arcaded walk, and the refectory.
  const [cx, ew, ed] = [x, 32, 48];
  for (const side of [-1, 1]) {
    town.add(box(ew, 3.6, 1, M.stone, cx, y, z + side * ed / 2));
    town.add(box(1, 3.6, ed, M.stone, cx + side * ew / 2, y, z));
  }
  town.add(box(3, 5, 4, M.stone, cx - ew / 2, y, z + 8));
  town.add(box(2.2, 4, 1.4, M.opening, cx - ew / 2, y, z + 8));
  const rangeZ = z + ed / 2 - 5;
  town.add(box(28, 5.5, 7, M.plaster, cx, y, rangeZ));
  town.add(gableRoof(28, 7, 2.4, M.roof, cx, y + 5.5, rangeZ, 0.5));
  town.add(box(12, 6, 9, M.plaster, cx + 8, y, z - 18.5));
  town.add(hipRoof(12, 9, 2.6, M.roof, cx + 8, y + 6, z - 18.5, 0.5));
  const walk = (detail ? colonnade : posts)({ length: 24, count: 7, height: 3, radius: 0.26 });
  walk.position.set(cx, y, rangeZ - 5.2);
  town.add(walk);
  town.add(box(26, 0.4, 4, M.roof, cx, y + 3, rangeZ - 5.3));
  if (detail) {
    const cells = windowRow({ count: 6, spacing: 4.4, width: 0.7, height: 1.2, y: y + 3.6 });
    cells.position.set(cx, 0, rangeZ - 3.47);
    town.add(cells);
    town.add(cylinder(2, 2.2, 0.9, M.marble, cx - 8, y, z + 6, 12));
  }
  for (const [dx, dz] of [[-12, -16], [12, -14], [-12, 6], [12, 10]]) town.add(cypress(10, x + dx, y, z + dz));
}

// ---------- the Scutarion palace ----------

/** The imperial Scutarion palace on the low point by the islet, its loggia looking across the strait to the capital. */
function addPalace(town, detail, elevation) {
  const [x, z] = PALACE;
  const terrace = 2.5;
  const y = elevation(x, z);
  town.add(box(36, terrace, 32, M.banded, x, y - 0.5, z));
  town.add(groundPlane(36, 32, M.paving, x, y + terrace - 0.47, z));
  const floor = y + terrace - 0.5;

  // The hall, with a two-storey colonnaded loggia on its seaward side.
  town.add(box(12, 12, 24, M.plasterOchre, x + 4, floor, z));
  town.add(hipRoof(12, 24, 3.4, M.roof, x + 4, floor + 12, z, 0.6));
  const seaward = x - 4;
  for (const level of [0, 5.5]) {
    const loggia = (detail ? colonnade : posts)({ length: 21, count: 7, height: 5, radius: 0.38 });
    loggia.rotation.y = Math.PI / 2;
    loggia.position.set(seaward, floor + level, z);
    town.add(loggia);
    town.add(box(4.4, 0.5, 24, M.marble, seaward, floor + level + 5, z));
  }
  town.add(hipRoof(4.4, 24, 1.1, M.roof, seaward, floor + 11, z, 0.4));
  // A wing with the domed palace chapel, and the garden with its fountain.
  town.add(box(14, 7.5, 8, M.plasterOchre, x + 8, floor, z - 11));
  town.add(hipRoof(14, 8, 2.4, M.roof, x + 8, floor + 7.5, z - 11, 0.5));
  town.add(box(7, 6.5, 7, M.brick, x - 10, floor, z - 11));
  town.add(cylinder(2.3, 2.3, 2.2, M.brick, x - 10, floor + 6.5, z - 11, 12));
  town.add(dome(2.3, M.lead, x - 10, floor + 8.7, z - 11, { heightScale: 0.72 }));
  addCross(town, x - 10, floor + 10.3, z - 11, 1.4);
  town.add(cylinder(2.4, 2.6, 0.8, M.marble, x - 11, floor, z + 8, 16));
  town.add(cylinder(0.4, 0.45, 2, M.marble, x - 11, floor, z + 8, 8));
  if (detail) {
    for (const side of [-1, 1]) {
      const windows = windowRow({ count: 4, spacing: 5.2, width: 1.1, height: 2.4, y: floor + 7.5 });
      windows.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
      windows.position.set(x + 4 + side * 6.05, 0, z);
      town.add(windows);
    }
    town.add(mesh(new THREE.CircleGeometry(2.2, 16).rotateX(-Math.PI / 2), M.water, x - 11, floor + 0.7, z + 8));
  }
  // The stair down from the terrace towards the palace landing.
  for (let i = 0; i < 3; i++) town.add(box(1.3, 0.7 * (3 - i), 6, M.stone, x - 18.6 - i * 1.3, y, z + 2));
  for (const [dx, dz] of [[-16, -14], [-16, 14], [16, 14], [16, -14]]) town.add(cypress(9, x + dx, floor, z + dz));
  for (const [dx, dz] of [[-15, 4], [-6, 13], [-14, 11]]) town.add(roundTree(5, x + dx, floor, z + dz));
}

/** The column of the bronze heifer (Damalis) on the shore, the ancient landmark of the crossing. */
function addHeiferColumn(town) {
  const [x, z] = [-66, 52];
  town.add(box(3, 1.2, 3, M.marble, x, GROUND, z));
  town.add(cylinder(0.6, 0.7, 7, M.marble, x, GROUND + 1.2, z, 10));
  town.add(cylinder(1, 0.7, 0.7, M.marble, x, GROUND + 8.2, z, 10));
  const heifer = new THREE.Group();
  heifer.add(box(2.4, 1.1, 0.9, M.bronze, 0, 0.8, 0));
  heifer.add(box(0.8, 0.8, 0.6, M.bronze, 1.5, 1.2, 0));
  for (const [dx, dz] of [[-0.8, -0.25], [-0.8, 0.25], [0.8, -0.25], [0.8, 0.25]]) heifer.add(box(0.22, 0.8, 0.22, M.bronze, dx, 0, dz));
  heifer.position.set(x, GROUND + 8.9, z);
  heifer.rotation.y = Math.PI / 2;
  town.add(heifer);
}

function addCross(town, x, y, z, size) {
  town.add(box(0.18, size, 0.18, M.gold, x, y, z));
  town.add(box(size * 0.6, 0.18, 0.18, M.gold, x, y + size * 0.62, z));
}

// ---------- the town ----------

/** Houses on the terraces, denser near the harbour, never straddling a terrace edge, the road or the shore. */
function scatterTown(town, rnd, { count, avoid, elevation, detail }) {
  let placed = 0;
  for (let attempt = 0; attempt < count * 30 && placed < count; attempt++) {
    const x = rnd.chance(0.55) ? rnd.range(-56, 20) : rnd.range(20, 122);
    const z = rnd.range(-100, 100);
    const w = rnd.range(7, 13);
    const d = rnd.range(6, 10);
    const r = Math.max(w, d) / 2;
    if (x - r < shoreX(z) + 5 || Math.abs(z - ROAD_Z) < r + 5 || (!detail && Math.abs(z) + r > 100)) continue;
    if (avoid.some(([ax, az, ar]) => Math.hypot(x - ax, z - az) < ar)) continue;
    if (nearTerraceEdge(x, z, r + 2.5)) continue;
    const tall = rnd.chance(0.3);
    const house = createHouse({
      w, d, h: tall ? rnd.range(7.5, 10) : rnd.range(4.5, 6.5), color: rnd.pick(PLASTER),
      roof: rnd.chance(0.55) ? 'hip' : 'gable', windows: detail,
    });
    house.position.set(x, elevation(x, z), z);
    house.rotation.y = rnd.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]) + rnd.range(-0.12, 0.12);
    town.add(house);
    avoid.push([x, z, r + 5]);
    placed++;
  }
}

/** Cypresses in the town, and the olive groves and scrub of the hillside above it. */
function addPlanting(town, rnd, detail, elevation) {
  for (let i = 0; i < (detail ? 30 : 16); i++) {
    const x = rnd.range(-50, 126);
    const z = rnd.range(-104, 104);
    if (Math.abs(z - ROAD_Z) < 8 || Math.hypot(x - MONASTERY[0], z - MONASTERY[1]) < 30 || Math.hypot(x - PALACE[0], z - PALACE[1]) < 26) continue;
    if (x < shoreX(z) + 6 || nearTerraceEdge(x, z, 3) || (!detail && Math.abs(z) > 98)) continue;
    const y = elevation(x, z);
    town.add(x > 60 ? roundTree(rnd.range(5, 7), x, y, z) : rnd.chance(0.5) ? cypress(rnd.range(9, 13), x, y, z) : roundTree(rnd.range(6, 9), x, y, z));
  }
  // Olive groves in rows on the top terrace and on the shelf south of the town; the map thins them to every other tree.
  for (let row = 0; row < 4; row++) {
    for (let k = 0; k < 6; k++) {
      if (!detail && (row + k) % 2) continue;
      const x = 102 + row * 7;
      const z = -95 + k * 9 + (row % 2) * 4;
      town.add(roundTree(4.5, x, elevation(x, z), z));
    }
  }
  for (let row = 0; row < 4; row++) {
    for (let k = 0; k < (detail ? 4 : 3); k++) {
      if (!detail && (row + k) % 2) continue;
      const x = 62 + row * 7;
      const z = 72 + k * 9 + (row % 2) * 4;
      town.add(roundTree(4.5, x, elevation(x, z), z));
    }
  }
}

// ---------- offshore ----------

/** Damalis, the islet offshore: the rock ringed with the Komnenian wall and crowned by the tower that became the Maiden's Tower. */
function addDamalis(town) {
  const [x, z] = [-128, 82];
  town.add(cylinder(12, 15, 3.4, M.stoneDark, x, -1, z, 18));
  town.add(cylinder(11.5, 11.5, 1.4, M.stone, x, 2.4, z, 18));
  // The curtain wall round the rock, with its landing stage towards the shore.
  town.add(cylinder(10.6, 10.6, 3.2, M.stone, x, 3.8, z, 18, { open: true }));
  town.add(cylinder(9.6, 9.6, 3.2, M.stone, x, 3.8, z, 18, { open: true }));
  town.add(mesh(new THREE.RingGeometry(9.6, 10.6, 18).rotateX(-Math.PI / 2), M.stone, x, 7, z));
  town.add(mesh(crenelRingGeometry(10.1, { count: 20, merlon: 1.2, height: 0.9, thickness: 0.7 }), M.stone, x, 7, z));
  town.add(box(6, 4.2, 4, M.stone, x + 10, 0, z + 2));
  town.add(box(2.2, 3.2, 1.2, M.opening, x + 10.2, 3.8, z + 2));
  // The tower itself: a stone base, a timbered upper storey and a leaded roof, as the Komnenoi left it.
  town.add(cylinder(4.2, 4.6, 9, M.stone, x, 3.8, z, 12));
  town.add(cylinder(4.6, 4.6, 0.8, M.stoneDark, x, 12.8, z, 12));
  town.add(cylinder(3.9, 3.9, 5.5, M.wood, x, 13.6, z, 12));
  town.add(cylinder(4.5, 4.5, 0.8, M.wood, x, 19.1, z, 12));
  town.add(pyramid(6.6, 6.6, 4.8, M.lead, x, 19.9, z));
  const window = mesh(archGeometry(0.9, 1.6), M.opening, x + 3.93, 15.6, z);
  window.rotation.y = Math.PI / 2;
  town.add(window);
  town.add(box(1.4, 2.4, 0.5, M.opening, x + 4.3, 4.6, z));
  const banner = flag('byzantine', { width: 2.4, height: 1.6, pole: 5 });
  banner.position.set(x, 24.4, z);
  town.add(banner);
}

/** Ferries moored at the quay and crossing the strait, and a merchant ship riding inside the mole. */
function addShipping(town) {
  const { geometry, deck } = createHull({ length: 10, beam: 2.8, depth: 1.1, bowRise: 0.6, sternRise: 0.7, segments: 16, ribs: 8 });
  for (const [x, z, rotation, crossing] of [[-73, -46, 1.5, false], [-74, -26, 1.65, false], [-118, -40, 0.4, true], [-72, -8, 1.4, false]]) {
    const boat = new THREE.Group();
    boat.add(mesh(geometry, M.hull, 0, 0.6, 0), mesh(deck, M.wood, 0, 0.4, 0));
    boat.add(cylinder(0.08, 0.1, 6, M.wood, 0.8, 0.4, 0, 6));
    boat.position.set(x, 0, z);
    boat.rotation.y = rotation;
    const phase = x + z;
    boat.userData.animate = (time) => {
      boat.position.y = 0.4 + Math.sin(time * 1.3 + phase) * 0.12;
      // One plies slowly to and fro across the strait.
      if (crossing) boat.position.z = z + Math.sin(time * 0.15) * 22;
    };
    town.add(boat);
  }
  const ship = createMerchantShip({ banner: 'byzantine', sail: false });
  ship.scale.setScalar(0.75);
  ship.position.set(-84, 0, -58);
  ship.rotation.y = Math.PI / 2 + 0.15;
  town.add(ship);
}

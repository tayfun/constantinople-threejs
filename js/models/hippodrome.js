import * as THREE from 'three';
import { materials as M, cloth } from './lib/materials.js';
import {
  archedWallGeometry, archGeometry, box, boxGeometry, colonnade, cone, crenellationGeometry, cylinder, cylinderGeometry,
  hipRoof, mesh, placeOnCircle, regularOpenings, windowRow,
} from './lib/primitives.js';
import { createChariot, createHorse } from './lib/figures.js';
import { finalizeModel } from './lib/merge.js';
import { createObeliskOfTheodosius } from './obeliskOfTheodosius.js';
import { createSerpentColumn } from './serpentColumn.js';
import { createWalledObelisk } from './walledObelisk.js';

/**
 * The Hippodrome: a chariot-racing stadium about 450 m long and 130 m
 * wide, seating perhaps 100,000 on thirty-odd rows of marble benches under
 * a colonnade. Local x runs along the track: the curved sphendone, carried
 * on its twenty-five great vaults, at -x (south-west), the twelve starting
 * gates (carceres) with the gilded quadriga at +x (north-east). The
 * imperial box (kathisma) is on the +z side, facing the Great Palace.
 *
 * Sources: Bardill's reconstruction for Byzantium 1200 / the Pera Museum
 * (2010); Robert de Clari's thirty or forty rows; Clavijo's columns on the
 * sphendone; the sphendone's 25 surviving vaults.
 */

const SPHENDONE_X = -160; // centre of the curved end
const GATES_X = 215; // line of the starting gates
const ARENA = 38; // half-width of the track
const OUTER = 62; // half-width to the outer façade
const META_X = [-114, 134]; // turning posts at each end of the spina

const PODIUM = 2.6; // the wall between the track and the first row of seats
const SEATS_TOP = 59.5; // half-width where the rows give way to the upper walkway
const CAVEA_HEIGHT = 16.6; // top of the last row above the arena
const FACADE_HEIGHT = 17; // the arcaded outer wall, capped by the walkway
const PORTICO_HEIGHT = 6.5; // the colonnade crowning the stands
const KATHISMA_X = 40;

/** Height of the spina's top above the arena, where the monuments stand. */
export const SPINA_TOP = 1.6;

/**
 * Where each monument stands along the spina (local x, metres). On the map
 * they are landmarks in their own right, placed here by js/data/landmarks.js;
 * the detail model builds them in.
 */
export const SPINA_MONUMENTS = {
  'obelisk-of-theodosius': { x: 72, create: createObeliskOfTheodosius },
  'serpent-column': { x: 22, create: createSerpentColumn },
  'walled-obelisk': { x: -62, create: createWalledObelisk },
};

export function createHippodrome({ lod = 'detail' } = {}) {
  const detail = lod === 'detail';
  const stadium = new THREE.Group();

  stadium.add(box(520, 1, 190, M.paving, 30, -1, 0));
  stadium.add(mesh(new THREE.ShapeGeometry(arenaShape(), 24).rotateX(-Math.PI / 2), M.sand, 0, 0.05, 0));

  addCavea(stadium, detail);
  addFacade(stadium, detail);
  if (detail) addPortico(stadium);
  addSpina(stadium, lod);
  addKathisma(stadium, detail);
  addCarceres(stadium, detail);

  finalizeModel(stadium);
  if (detail) addChariots(stadium);
  return stadium;
}

function arenaShape() {
  const shape = new THREE.Shape();
  shape.moveTo(GATES_X, ARENA);
  shape.lineTo(SPHENDONE_X, ARENA);
  shape.absarc(SPHENDONE_X, 0, ARENA, Math.PI / 2, Math.PI * 1.5, false);
  shape.lineTo(GATES_X, -ARENA);
  return shape;
}

/** U-shaped band between two half-widths, open at the starting gates. */
function standsShape(inner, outer) {
  const shape = new THREE.Shape();
  shape.moveTo(GATES_X, outer);
  shape.lineTo(SPHENDONE_X, outer);
  shape.absarc(SPHENDONE_X, 0, outer, Math.PI / 2, Math.PI * 1.5, false);
  shape.lineTo(GATES_X, -outer);
  shape.lineTo(GATES_X, -inner);
  shape.lineTo(SPHENDONE_X, -inner);
  shape.absarc(SPHENDONE_X, 0, inner, Math.PI * 1.5, Math.PI / 2, true);
  shape.lineTo(GATES_X, inner);
  shape.lineTo(GATES_X, outer);
  return shape;
}

/** A U-shaped slab between two half-widths, its base at y. */
function band(inner, outer, y, height, material, segments = 24) {
  const geometry = new THREE.ExtrudeGeometry(standsShape(inner, outer), { depth: height, bevelEnabled: false, curveSegments: segments });
  return mesh(geometry.rotateX(-Math.PI / 2), material, 0, y, 0);
}

/**
 * The seating: a marble podium wall, then rows of benches climbing to the
 * walkway under the portico. Each modelled row stands for two or three of
 * the real ones; a landing halfway up divides the lower and upper tiers.
 */
function addCavea(stadium, detail) {
  const rows = detail ? 14 : 3;
  const run = (SEATS_TOP - ARENA) / rows;
  const rise = (CAVEA_HEIGHT - PODIUM) / rows;
  for (let k = 0; k < rows; k++) {
    const inner = ARENA + k * run;
    const landing = detail && k === 7;
    stadium.add(band(inner, inner + run, 0, PODIUM + (k + 1) * rise - (landing ? rise * 0.5 : 0), landing ? M.stone : M.marble, detail ? 28 : 16));
  }
  // The upper walkway, which also caps the façade wall.
  stadium.add(band(SEATS_TOP, OUTER + 2, CAVEA_HEIGHT, FACADE_HEIGHT + 0.5 - CAVEA_HEIGHT, M.stone, detail ? 28 : 16));
}

/** Arcaded outer walls, and the great vaulted sphendone at the curved end. */
function addFacade(stadium, detail) {
  const length = GATES_X - SPHENDONE_X;
  const centre = (GATES_X + SPHENDONE_X) / 2;
  for (const side of [-1, 1]) {
    const wall = detail
      ? mesh(archedWallGeometry({
        length,
        height: FACADE_HEIGHT,
        thickness: 2,
        openings: [
          ...regularOpenings(length, 46, { width: 4.4, bottom: 0, spring: 5.5 }),
          ...regularOpenings(length, 46, { width: 3.2, bottom: 9, spring: 13 }),
        ],
      }), M.banded)
      : box(length, FACADE_HEIGHT, 2, M.banded);
    wall.position.set(centre, 0, side * (OUTER + 1));
    stadium.add(wall);
  }

  const ring = new THREE.Shape();
  ring.moveTo(SPHENDONE_X, OUTER + 2);
  ring.absarc(SPHENDONE_X, 0, OUTER + 2, Math.PI / 2, Math.PI * 1.5, false);
  ring.lineTo(SPHENDONE_X, -OUTER + 1);
  ring.absarc(SPHENDONE_X, 0, OUTER - 1, Math.PI * 1.5, Math.PI / 2, true);
  ring.lineTo(SPHENDONE_X, OUTER + 2);
  const sphendone = new THREE.ExtrudeGeometry(ring, { depth: FACADE_HEIGHT, bevelEnabled: false, curveSegments: 32 });
  stadium.add(mesh(sphendone.rotateX(-Math.PI / 2), M.banded));

  if (detail) {
    // The twenty-five vaults of the sphendone, with a gallery of windows above.
    const vaults = 25;
    const lower = archGeometry(4.4, 7.5);
    const upper = archGeometry(3, 5);
    for (let i = 1; i <= vaults; i++) {
      const angle = Math.PI / 2 + (i / (vaults + 1)) * Math.PI;
      stadium.add(placeOnCircle(mesh(lower, M.opening), angle, OUTER + 2.05, 0, SPHENDONE_X, 0));
      stadium.add(placeOnCircle(mesh(upper, M.opening), angle, OUTER + 2.05, 10, SPHENDONE_X, 0));
    }
  }
}

/** The colonnade that crowned the stands, roofed with tiles, open towards the track. */
function addPortico(stadium) {
  const y = FACADE_HEIGHT + 0.5;
  const radius = OUTER + 0.5;
  const spacing = 7.5;
  const length = GATES_X - SPHENDONE_X;
  const count = Math.round(length / spacing) + 1;
  for (const side of [-1, 1]) {
    const columns = colonnade({ length, count, height: PORTICO_HEIGHT, radius: 0.5, capitalMaterial: M.marble });
    columns.position.set((GATES_X + SPHENDONE_X) / 2, y, side * radius);
    stadium.add(columns);
  }
  const arcCount = Math.round((Math.PI * radius) / spacing);
  const shaft = cylinderGeometry(0.425, 0.5, PORTICO_HEIGHT - 0.8, 10);
  const base = boxGeometry(1.2, 0.3, 1.2);
  const capital = cylinderGeometry(0.8, 0.45, 0.5, 10);
  for (let i = 1; i < arcCount; i++) {
    const angle = Math.PI / 2 + (i / arcCount) * Math.PI;
    const x = SPHENDONE_X + Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    stadium.add(mesh(base, M.marble, x, y, z));
    stadium.add(mesh(shaft, M.marble, x, y + 0.3, z));
    stadium.add(mesh(capital, M.marble, x, y + PORTICO_HEIGHT - 0.5, z));
  }
  const top = y + PORTICO_HEIGHT;
  stadium.add(band(radius - 1.6, radius + 1.6, top, 1.0, M.marble, 32));
  stadium.add(band(radius - 4.2, radius + 2.4, top + 1.0, 0.9, M.roof, 32));
}

/** The central barrier: a marble platform with the turning posts, water basins and monuments. */
function addSpina(stadium, lod) {
  const [start, end] = META_X;
  const length = end - start - 8;
  const centre = (start + end) / 2;
  stadium.add(box(length, SPINA_TOP, 7, M.marble, centre, 0, 0));
  stadium.add(box(length, 0.35, 7.6, M.marble, centre, SPINA_TOP - 0.35, 0));
  for (const x of META_X) {
    stadium.add(cylinder(3.8, 3.8, SPINA_TOP, M.marble, x, 0, 0, 20));
    for (const z of [-2, 0, 2]) stadium.add(cone(0.8, 6, M.gold, x, SPINA_TOP, z, 10));
  }

  // The euripus: long basins of water between the monuments.
  for (const [a, b] of [[-50, -30], [-16, 16], [52, 64], [80, 102]]) {
    const mid = (a + b) / 2;
    for (const z of [-2.1, 2.1]) stadium.add(box(b - a, 0.3, 0.4, M.marble, mid, SPINA_TOP, z));
    for (const x of [a + 0.2, b - 0.2]) stadium.add(box(0.4, 0.3, 4.6, M.marble, x, SPINA_TOP, 0));
    stadium.add(box(b - a - 0.8, 0.22, 3.8, M.waterSide, mid, SPINA_TOP, 0));
  }

  // On the map the monuments are separate, clickable landmarks standing on this spina.
  if (lod === 'detail') {
    for (const { x, create } of Object.values(SPINA_MONUMENTS)) {
      const monument = create({ lod });
      monument.position.set(x, SPINA_TOP, 0);
      stadium.add(monument);
    }
  }

  // Columns crowned with bronze statues of charioteers and emperors.
  for (const x of [-96, -24, 46, 110]) {
    stadium.add(box(1.8, 0.5, 1.8, M.marble, x, SPINA_TOP, 0));
    stadium.add(cylinder(0.6, 0.72, 8.5, M.marble, x, SPINA_TOP + 0.5, 0, 10));
    stadium.add(cylinder(0.9, 0.6, 0.5, M.marble, x, SPINA_TOP + 9, 0, 10));
    stadium.add(cylinder(0.35, 0.5, 2.2, M.bronze, x, SPINA_TOP + 9.5, 0, 8));
    stadium.add(cylinder(0.3, 0.3, 0.6, M.bronze, x, SPINA_TOP + 11.7, 0, 8));
  }
  // Bronze horses among the trophies, like the pair from the temple of Artemis at Ephesus.
  for (const x of [-82, 122]) {
    stadium.add(box(3.2, 1.2, 2, M.marble, x, SPINA_TOP, 0));
    const horse = createHorse(M.bronze);
    horse.scale.setScalar(1.2);
    horse.position.set(x, SPINA_TOP + 1.2, 0);
    stadium.add(horse);
  }
}

/**
 * The imperial box: a tall block rising through the stands, the emperor's
 * loggia on its top floor behind a colonnade hung with purple, and behind
 * it the spiral stair (kochlias) and covered passage to the Great Palace.
 */
function addKathisma(stadium, detail) {
  const x = KATHISMA_X;
  const floor = FACADE_HEIGHT;
  stadium.add(box(30, floor, 30, M.banded, x, 0, 65));
  stadium.add(box(30, 0.6, 30, M.marble, x, floor, 65));
  stadium.add(box(30, 7.5, 20, M.banded, x, floor + 0.6, 70));
  stadium.add(box(31, 1.2, 31, M.marble, x, floor + 8.1, 65));
  stadium.add(hipRoof(31, 31, 6, M.lead, x, floor + 9.3, 65));

  // The private way to the palace: a round stair tower and a covered passage.
  stadium.add(cylinder(4, 4, floor + 9, M.banded, x + 18, 0, 77, 12));
  stadium.add(cone(4.6, 3.2, M.lead, x + 18, floor + 9, 77, 12));
  stadium.add(box(8, 5, 12, M.banded, x, floor - 5, 86));
  stadium.add(box(9, 0.6, 13, M.lead, x, floor, 86));

  // Purple hangings mark the emperor's box from across the arena.
  stadium.add(box(28, 7.5, 0.3, cloth(0x5c1f63), x, floor + 0.6, 60.3));
  stadium.add(box(28, 2.2, 0.3, cloth(0x5c1f63), x, floor + 5.9, 51.2));
  if (!detail) return;

  const front = colonnade({ length: 26, count: 7, height: 7.5, radius: 0.4, capitalMaterial: M.gold });
  front.position.set(x, floor + 0.6, 51.5);
  stadium.add(front);
  for (const side of [-1, 1]) {
    const flank = colonnade({ length: 6, count: 2, height: 7.5, radius: 0.4, capitalMaterial: M.gold });
    flank.position.set(x + side * 13, floor + 0.6, 56);
    flank.rotation.y = Math.PI / 2;
    stadium.add(flank);
  }
  // The throne, gilded, at the centre of the loggia.
  stadium.add(box(2.4, 0.5, 2.4, M.marble, x, floor + 0.6, 57));
  stadium.add(box(1.4, 1.6, 1.2, M.gold, x, floor + 1.1, 57.4));
}

/** The twelve starting gates under their gallery, the flanking towers, and the gilded quadriga over the central gateway. */
function addCarceres(stadium, detail) {
  const x = GATES_X + 6;
  stadium.add(box(12, 13, 124, M.banded, x, 0, 0));
  stadium.add(box(14, 20, 16, M.banded, x, 0, 0));
  stadium.add(box(16, 0.8, 18, M.marble, x, 20, 0));
  for (const side of [-1, 1]) {
    stadium.add(box(15, 22, 15, M.banded, x, 0, side * 66));
    stadium.add(mesh(crenellationGeometry(15), M.banded, x, 22, side * 66 + 7));
  }

  if (!detail) return;

  // The quadriga: four gilded horses and their chariot, looking down the track.
  const quadriga = createChariot({ horseMaterial: M.gildedBronze, carMaterial: M.gold, colorMaterial: M.gildedBronze });
  quadriga.scale.setScalar(1.8);
  quadriga.rotation.y = Math.PI;
  quadriga.position.set(x + 1, 20.8, 0);
  stadium.add(quadriga);

  const gates = windowRow({ count: 12, spacing: 9.5, width: 5, height: 8, y: 0.5, skip: (z) => Math.abs(z) < 8 });
  gates.position.x = GATES_X - 0.05;
  gates.rotation.y = -Math.PI / 2;
  stadium.add(gates);
  const gallery = windowRow({ count: 11, spacing: 9.5, width: 2.4, height: 3.2, y: 9, skip: (z) => Math.abs(z) < 8 });
  gallery.position.x = GATES_X - 0.05;
  gallery.rotation.y = -Math.PI / 2;
  stadium.add(gallery);

  // The ceremonial gateway through the middle of the carceres.
  for (const [dx, facing] of [[-7.05, -Math.PI / 2], [7.05, Math.PI / 2]]) {
    const arch = mesh(archGeometry(6, 11), M.opening, x + dx, 0.5, 0);
    arch.rotation.y = facing;
    stadium.add(arch);
  }
  const windows = windowRow({ count: 2, spacing: 8, width: 2, height: 4, y: 13.5 });
  windows.position.set(x - 7.05, 0, 0);
  windows.rotation.y = -Math.PI / 2;
  stadium.add(windows);
}

/** Four teams — Blues, Greens, Reds and Whites — racing round the spina. */
function addChariots(stadium) {
  const teams = [
    { color: 0x2f5da8, lane: 15, speed: 17, offset: 0 },
    { color: 0x3a8a3c, lane: 19, speed: 16.4, offset: 30 },
    { color: 0xb3302c, lane: 23, speed: 16.8, offset: 70 },
    { color: 0xf2efe6, lane: 27, speed: 16, offset: 110 },
  ];
  for (const { color, lane, speed, offset } of teams) {
    const chariot = createChariot({ horseMaterial: M.trunk, carMaterial: M.gold, colorMaterial: cloth(color) });
    chariot.scale.setScalar(1.6);
    chariot.position.y = 0.05;
    const perimeter = 2 * (META_X[1] - META_X[0]) + 2 * Math.PI * lane;
    chariot.userData.animate = (time) => {
      const { x, z, heading } = trackPoint((time * speed + offset) % perimeter, lane);
      chariot.position.x = x;
      chariot.position.z = z;
      chariot.rotation.y = heading;
    };
    stadium.add(chariot);
  }
}

/** Position and heading at distance s along a lap of the given radius. */
function trackPoint(s, radius) {
  const [x0, x1] = META_X;
  const straight = x1 - x0;
  const turn = Math.PI * radius;
  if (s < straight) return { x: x0 + s, z: radius, heading: 0 };
  s -= straight;
  if (s < turn) {
    const a = s / radius;
    return { x: x1 + radius * Math.sin(a), z: radius * Math.cos(a), heading: a };
  }
  s -= turn;
  if (s < straight) return { x: x1 - s, z: -radius, heading: Math.PI };
  const a = (s - straight) / radius;
  return { x: x0 - radius * Math.sin(a), z: -radius * Math.cos(a), heading: Math.PI + a };
}

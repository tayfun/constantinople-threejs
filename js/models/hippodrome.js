import * as THREE from 'three';
import { materials as M, cloth } from './lib/materials.js';
import {
  archedWallGeometry, archGeometry, box, colonnade, cone, crenellationGeometry, cylinder, hipRoof, mesh,
  placeOnCircle, regularOpenings, windowRow,
} from './lib/primitives.js';
import { createChariot, createHorse } from './lib/figures.js';
import { finalizeModel } from './lib/merge.js';
import { createObeliskOfTheodosius } from './obeliskOfTheodosius.js';
import { createSerpentColumn } from './serpentColumn.js';
import { createWalledObelisk } from './walledObelisk.js';

/**
 * The Hippodrome: a 450 m chariot-racing stadium seating perhaps 100,000.
 * Local x runs along the track: the curved sphendone at -x (south-west),
 * the starting gates (carceres) with the bronze quadriga at +x. The imperial
 * box (kathisma) is on the +z side, facing the Great Palace.
 */

const SPHENDONE_X = -160; // centre of the curved end
const GATES_X = 215; // line of the starting gates
const ARENA = 38; // half-width of the track
const OUTER = 62; // half-width to the outer façade
const META_X = [-114, 134]; // turning posts at each end of the spina

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

  // Tiered marble seating, stepping up and back towards the façade.
  const tiers = detail ? 7 : 3;
  for (let k = 0; k < tiers; k++) {
    const inner = ARENA + (k * (OUTER - ARENA)) / tiers;
    const height = 1.6 + ((k + 1) * 12) / tiers;
    const geometry = new THREE.ExtrudeGeometry(standsShape(inner, OUTER), { depth: height, bevelEnabled: false, curveSegments: 24 });
    stadium.add(mesh(geometry.rotateX(-Math.PI / 2), k % 2 ? M.marble : M.stone));
  }

  addFacade(stadium, detail);
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

/** Arcaded outer walls, and the tall curved sphendone at the south end. */
function addFacade(stadium, detail) {
  const length = GATES_X - SPHENDONE_X;
  const centre = (GATES_X + SPHENDONE_X) / 2;
  const height = 17;
  for (const side of [-1, 1]) {
    const wall = detail
      ? mesh(archedWallGeometry({
        length,
        height,
        thickness: 2,
        openings: [
          ...regularOpenings(length, 46, { width: 4.4, bottom: 0, spring: 5.5 }),
          ...regularOpenings(length, 46, { width: 3.2, bottom: 9, spring: 13 }),
        ],
      }), M.banded)
      : box(length, height, 2, M.banded);
    wall.position.set(centre, 0, side * (OUTER + 1));
    stadium.add(wall);
  }

  const ring = new THREE.Shape();
  ring.moveTo(SPHENDONE_X, OUTER + 2);
  ring.absarc(SPHENDONE_X, 0, OUTER + 2, Math.PI / 2, Math.PI * 1.5, false);
  ring.lineTo(SPHENDONE_X, -OUTER + 1);
  ring.absarc(SPHENDONE_X, 0, OUTER - 1, Math.PI * 1.5, Math.PI / 2, true);
  ring.lineTo(SPHENDONE_X, OUTER + 2);
  const sphendone = new THREE.ExtrudeGeometry(ring, { depth: height + 3, bevelEnabled: false, curveSegments: 32 });
  stadium.add(mesh(sphendone.rotateX(-Math.PI / 2), M.banded));

  if (detail) {
    const lower = archGeometry(4.4, 7.5);
    const upper = archGeometry(3, 5);
    for (let i = 1; i < 24; i++) {
      const angle = Math.PI / 2 + (i / 24) * Math.PI;
      stadium.add(placeOnCircle(mesh(lower, M.opening), angle, OUTER + 2.05, 0, SPHENDONE_X, 0));
      stadium.add(placeOnCircle(mesh(upper, M.opening), angle, OUTER + 2.05, 10, SPHENDONE_X, 0));
    }
  }
}

/** The central barrier with its turning posts and monuments. */
function addSpina(stadium, lod) {
  const [start, end] = META_X;
  stadium.add(box(end - start - 8, SPINA_TOP, 7, M.marble, (start + end) / 2, 0, 0));
  for (const x of META_X) {
    stadium.add(cylinder(3.8, 3.8, SPINA_TOP, M.marble, x, 0, 0, 20));
    for (const z of [-2, 0, 2]) stadium.add(cone(0.8, 6, M.gold, x, SPINA_TOP, z, 10));
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
  for (const x of [-95, -25, 45, 105]) {
    stadium.add(cylinder(0.65, 0.75, 9, M.marble, x, SPINA_TOP, 0, 10));
    stadium.add(cylinder(0.35, 0.5, 2.2, M.bronze, x, 10.6, 0, 8));
    stadium.add(cylinder(0.3, 0.3, 0.6, M.bronze, x, 12.8, 0, 8));
  }
}

/** The imperial box, linked by a private stair to the Great Palace behind. */
function addKathisma(stadium, detail) {
  const x = 40;
  stadium.add(box(32, 22, 16, M.banded, x, 0, 68));
  stadium.add(hipRoof(32, 16, 5, M.lead, x, 22, 68));
  stadium.add(box(28, 1, 7, M.marble, x, 13, 56.5));
  stadium.add(box(28, 0.3, 7.5, cloth(0x5c1f63), x, 20, 56.5));
  // Purple hangings fall from the canopy's front edge, marking the emperor's box from across the arena.
  stadium.add(box(28, 3.5, 0.3, cloth(0x5c1f63), x, 16.5, 52.9));
  if (detail) {
    const columns = colonnade({ length: 26, count: 6, height: 7, radius: 0.35, capitalMaterial: M.gold });
    columns.position.set(x, 14, 53.4);
    stadium.add(columns);
  }
}

/** Starting gates, flanking towers and the gilded quadriga above them. */
function addCarceres(stadium, detail) {
  const x = GATES_X + 6;
  stadium.add(box(12, 13, 124, M.banded, x, 0, 0));
  for (const side of [-1, 1]) {
    stadium.add(box(15, 22, 15, M.banded, x, 0, side * 66));
    const merlons = mesh(crenellationGeometry(15), M.banded, x, 22, side * 66 + 7);
    stadium.add(merlons);
  }
  if (!detail) return;

  const gates = windowRow({ count: 12, spacing: 9.5, width: 5, height: 8, y: 0.5 });
  gates.position.x = GATES_X - 0.05;
  gates.rotation.y = -Math.PI / 2;
  stadium.add(gates);

  stadium.add(box(10, 3, 14, M.marble, x, 13, 0));
  for (const z of [-3.6, -1.2, 1.2, 3.6]) {
    const horse = createHorse(M.gildedBronze, { rearing: Math.abs(z) < 2 });
    horse.scale.setScalar(1.4);
    horse.rotation.y = Math.PI;
    horse.position.set(x + 1, 16, z);
    stadium.add(horse);
  }
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

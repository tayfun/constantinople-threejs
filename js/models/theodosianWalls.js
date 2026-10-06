import * as THREE from 'three';
import { materials as M } from './lib/materials.js';
import {
  archedWallGeometry, box, crenelRingGeometry, crenellationGeometry, cylinder, flag, groundPlane, mesh,
} from './lib/primitives.js';
import { mapStone, wallAlongGeometry } from './lib/mapWalls.js';
import { scatterHouses } from './lib/buildings.js';
import { finalizeModel } from './lib/merge.js';
import { createRandom } from '../util/random.js';
import { GOLDEN_GATE, LAND_HEIGHT, LAND_WALLS } from '../data/geography.js';

/**
 * The Theodosian Land Walls (408–413, doubled after 447): inner wall, outer
 * wall and moat — a triple barrier 5.7 km long from the Sea of Marmara to
 * the Golden Horn.
 *
 * Detail: a 240 m section with a military gate, city at -z, enemy at +z.
 * Map: the whole circuit traced along LAND_WALLS in map units (absolute).
 */
export function createTheodosianWalls({ lod = 'detail' } = {}) {
  return lod === 'detail' ? createSection() : createMapCircuit();
}

// ---------- detail section ----------

const LENGTH = 240;
const OUTER_Z = 16;
const MOAT = [33.5, 53.5];

function createSection() {
  const walls = new THREE.Group();

  // Ground: city and terraces, the moat, and the open country beyond.
  walls.add(box(LENGTH + 20, 4, 113.5, M.grass, 0, -4, -23.25));
  walls.add(groundPlane(LENGTH, 30, M.dirt, 0, 0.02, 17.5));
  walls.add(box(LENGTH + 20, 4, 20, M.dirt, 0, -11, 43.5));
  walls.add(box(LENGTH + 20, 4, 36.5, M.grass, 0, -4, 71.75));
  for (const z of [MOAT[0] + 0.5, MOAT[1] - 0.5]) walls.add(box(LENGTH + 20, 7, 1, M.stone, 0, -7, z));
  walls.add(groundPlane(LENGTH + 20, 19, M.water, 0, -5, 43.5));

  // Inner wall: 12 m high, 5 m thick, pierced by the gate.
  const gate = { x: 0, width: 6, bottom: 0, spring: 7 };
  walls.add(mesh(archedWallGeometry({ length: LENGTH, height: 12, thickness: 5, openings: [gate] }), M.banded));
  walls.add(mesh(crenellationGeometry(LENGTH), M.banded, 0, 12, 2.2));

  // Inner towers: square and octagonal, with the gate between two great towers.
  const innerTowers = [[-110, 'octagon'], [-62, 'square'], [-12, 'gate'], [12, 'gate'], [62, 'square'], [110, 'octagon']];
  for (const [x, kind] of innerTowers) {
    if (kind === 'octagon') {
      walls.add(cylinder(7, 7, 20, M.banded, x, 0, 4, 8));
      walls.add(mesh(crenelRingGeometry(6.6, { count: 12 }), M.banded, x, 20, 4));
    } else {
      const width = kind === 'gate' ? 12 : 10;
      const height = kind === 'gate' ? 23 : 20;
      walls.add(box(width, height, 14, M.banded, x, 0, 3));
      walls.add(battlements(width, 14, x, height, 3));
    }
  }

  // Outer wall: 8.5 m high with smaller towers between the inner ones.
  walls.add(mesh(archedWallGeometry({ length: LENGTH, height: 8.5, thickness: 2, openings: [{ x: 0, width: 5, bottom: 0, spring: 5.5 }] }), M.banded, 0, 0, OUTER_Z));
  walls.add(mesh(crenellationGeometry(LENGTH), M.banded, 0, 8.5, OUTER_Z + 0.7));
  for (const [x, round] of [[-86, true], [-37, false], [37, false], [86, true]]) {
    if (round) {
      walls.add(cylinder(4.5, 4.5, 12, M.banded, x, 0, OUTER_Z + 1, 14, { thetaStart: -Math.PI / 2, thetaLength: Math.PI }));
      walls.add(box(9, 12, 2, M.banded, x, 0, OUTER_Z));
    } else {
      walls.add(box(8, 12, 8, M.banded, x, 0, OUTER_Z + 3));
      walls.add(battlements(8, 8, x, 12, OUTER_Z + 3));
    }
  }

  // Breastwork along the moat, broken by the bridge.
  for (const side of [-1, 1]) {
    const length = LENGTH / 2 - 4;
    const x = side * (4 + length / 2);
    walls.add(box(length, 2, 1.5, M.stone, x, 0, MOAT[0] - 0.75));
    walls.add(mesh(crenellationGeometry(length, { merlon: 0.8, gap: 0.8, height: 0.8, thickness: 1.3 }), M.stone, x, 2, MOAT[0] - 0.75));
  }
  walls.add(box(7, 1.2, 23, M.stone, 0, -1.2, 43.5));

  // Roads through the gate, and the city behind.
  walls.add(groundPlane(6, 36, M.dirt, 0, 0.03, 72));
  walls.add(groundPlane(6, 66, M.dirt, 0, 0.03, -46));
  scatterHouses(walls, createRandom(413), { count: 22, area: [-120, -76, 120, -18], avoid: [[0, -40, 10], [0, -20, 10], [0, -60, 10]] });

  finalizeModel(walls);
  for (const x of [-12, 12]) {
    const banner = flag('byzantine', { width: 3.2, height: 2.2, pole: 6 });
    banner.position.set(x, 23, 3);
    walls.add(banner);
  }
  return walls;
}

/** Merlons around the four edges of a flat tower roof. */
function battlements(width, depth, x, y, z) {
  const group = new THREE.Group();
  for (const side of [-1, 1]) {
    group.add(mesh(crenellationGeometry(width), M.banded, x, y, z + side * (depth / 2 - 0.35)));
    const flank = mesh(crenellationGeometry(depth - 1.4), M.banded, x + side * (width / 2 - 0.35), y, z);
    flank.rotation.y = Math.PI / 2;
    group.add(flank);
  }
  return group;
}

// ---------- map circuit ----------

const moatMaterial = new THREE.MeshStandardMaterial({ color: 0x2f5f6a, roughness: 0.3 });

function createMapCircuit() {
  const walls = new THREE.Group();
  const y = LAND_HEIGHT;
  // Offsets are to the west (left of travel, since the line runs south → north).
  walls.add(mesh(wallAlongGeometry(LAND_WALLS, { height: 0.75, thickness: 0.3, y, towerSpacing: 2.6, towerWidth: 0.62, towerHeight: 1.25 }), mapStone));
  walls.add(mesh(wallAlongGeometry(LAND_WALLS, { height: 0.5, thickness: 0.16, y, offset: 0.9, towerSpacing: 2.6, towerWidth: 0.4, towerHeight: 0.75 }), mapStone));
  walls.add(mesh(wallAlongGeometry(LAND_WALLS, { height: 0.04, thickness: 1.1, y: y - 0.02, offset: 2.1 }), moatMaterial));

  // The Golden Gate: a triumphal marble gateway between two great towers.
  const golden = new THREE.Group();
  golden.add(box(1.0, 1.7, 1.0, M.marble, 0, 0, -1.1));
  golden.add(box(1.0, 1.7, 1.0, M.marble, 0, 0, 1.1));
  golden.add(box(0.8, 1.2, 1.4, M.marble, 0, 0, 0));
  golden.add(box(0.82, 0.12, 1.42, M.gold, 0, 1.2, 0));
  // Set in the wall beside Yedikule, turned to run along it.
  const [east, north] = GOLDEN_GATE;
  const [[e0, n0], [e1, n1]] = LAND_WALLS.slice(2, 4);
  golden.position.set(east, y, -north);
  golden.rotation.y = Math.atan2(e0 - e1, n1 - n0);
  walls.add(golden);
  return finalizeModel(walls);
}

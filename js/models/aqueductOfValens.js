import * as THREE from 'three';
import { materials as M } from './lib/materials.js';
import { archShape, box, cypress, groundPlane, mesh, roundTree, scaleUV } from './lib/primitives.js';
import { scatterHouses } from './lib/buildings.js';
import { createRandom } from '../util/random.js';
import { finalizeModel } from './lib/merge.js';

/**
 * The Aqueduct of Valens (Bozdoğan Kemeri), completed in 368: a bridge of
 * limestone ashlar, 971 m long and up to 29 m high, carrying the city's
 * water across the valley between the Third and Fourth Hills. Where the
 * valley is deepest it has two tiers of arches: a tall lower order of 4 m
 * spans between 3.7 m piers, and a shorter upper order under the water
 * channel. Shown as a 300 m stretch running along x; the specus with its
 * parapets runs along the top.
 *
 * Sources: Wikipedia, Aqueduct of Valens (971 m, 7.75–8.24 m wide, c. 29 m
 * high, piers 3.70 m, lower spans c. 4 m, arches 18–73 double); Byzantium
 * 1200; archnet.
 */

const HALF = 152; // 39 bays of 7.7 m
const SPAN = 7.7; // bay pitch: a 4 m arch plus a 3.7 m pier
const RADIUS = 2; // lower arches
const UPPER_RADIUS = 1.75;
const WIDTH = 8; // thickness of the bridge
const TOP = 12.2; // top of the upper arcade (the parapets rise above it)
const STRING = 2.0; // string course between the tiers
const LOWER_SPRING = -1.2; // lower arches close just under the string course
const UPPER_BOTTOM = STRING + 0.6;
const UPPER_SPRING = 8.6;

/** Valley profile: ground height at x (deepest, -14 m, in the middle). */
const valley = (x) => -14 * Math.pow(Math.cos((Math.min(Math.abs(x), HALF) / HALF) * (Math.PI / 2)), 1.4);

export function createAqueductOfValens({ lod = 'detail' } = {}) {
  const detail = lod === 'detail';
  // On the flat map both tiers stand on level ground, as the aqueduct is usually pictured.
  const ground = detail ? valley : () => -13;
  const aqueduct = new THREE.Group();
  const structure = new THREE.Group();
  aqueduct.add(structure);

  const bays = Math.round((HALF * 2) / SPAN);
  const wall = new THREE.ExtrudeGeometry(arcadeShape(ground, bays), { depth: WIDTH, bevelEnabled: false, curveSegments: 8 });
  structure.add(mesh(wall.translate(0, 0, -WIDTH / 2), M.stone));

  // String course between the orders, cornice, and the channel with its parapets on top.
  structure.add(box(HALF * 2 + 1, 0.6, WIDTH + 0.8, M.stone, 0, STRING, 0));
  structure.add(box(HALF * 2 + 1, 0.7, WIDTH + 1, M.stone, 0, TOP, 0));
  for (const side of [-1, 1]) structure.add(box(HALF * 2, 2.2, 1.6, M.stone, 0, TOP + 0.7, side * (WIDTH / 2 - 0.8)));
  structure.add(box(HALF * 2, 0.4, WIDTH - 3.2, M.stone, 0, TOP + 0.7, 0)); // channel bed
  structure.add(groundPlane(HALF * 2, 2.2, M.water, 0, TOP + 2.3, 0)); // the water in the specus

  if (detail) {
    addDetails(structure, bays);
    structure.add(createValleyGround());
    structure.add(groundPlane(8, 160, M.paving, -28, valley(-28) + 0.08, 0));
    const rnd = createRandom(368);
    const avoid = [[-28, 0, 8], ...Array.from({ length: 41 }, (_, i) => [-HALF + i * 10, 0, 12])];
    scatterHouses(structure, rnd, { count: 26, area: [-HALF, -70, HALF, 70], groundAt: (x) => valley(x), avoid });
    for (let i = 0; i < 14; i++) {
      const x = rnd.range(-HALF, HALF);
      structure.add(cypress(rnd.range(9, 14), x, valley(x), rnd.pick([-1, 1]) * rnd.range(16, 70)));
    }
    for (let i = 0; i < 8; i++) {
      const x = rnd.range(-HALF + 10, HALF - 10);
      structure.add(roundTree(rnd.range(6, 9), x, valley(x), rnd.pick([-1, 1]) * rnd.range(14, 70)));
    }
  } else {
    structure.position.y = 13;
  }
  return finalizeModel(aqueduct);
}

/** Brick arch rings, imposts and pier footings that give the ashlar its rhythm. */
function addDetails(structure, bays) {
  const upperRing = archRingGeometry(UPPER_RADIUS, UPPER_SPRING - UPPER_BOTTOM, 0.42);
  for (let i = 0; i < bays; i++) {
    const centre = -HALF + (i + 0.5) * SPAN;
    const deep = valley(centre) < LOWER_SPRING - 2;
    for (const side of [-1, 1]) {
      const ring = mesh(upperRing, M.brick, centre, UPPER_BOTTOM, side * (WIDTH / 2 + 0.02));
      if (side < 0) ring.rotation.y = Math.PI;
      structure.add(ring);
      if (!deep) continue;
      const foot = valley(centre);
      const lower = mesh(archRingGeometry(RADIUS, LOWER_SPRING - foot, 0.5), M.brick, centre, foot, side * (WIDTH / 2 + 0.02));
      if (side < 0) lower.rotation.y = Math.PI;
      structure.add(lower);
    }
    // Pier footings where the piers stand deep in the valley, and imposts at the springing.
    const pierX = -HALF + i * SPAN;
    const foot = valley(pierX);
    if (foot < LOWER_SPRING - 3) {
      structure.add(box(SPAN - RADIUS * 2 + 1.2, 1.6, WIDTH + 1.4, M.stone, pierX, foot - 0.3, 0));
      structure.add(box(SPAN - RADIUS * 2 + 0.6, 0.5, WIDTH + 0.6, M.stone, pierX, LOWER_SPRING - 0.5, 0));
    }
  }
}

/**
 * A brick ring around an arch of the given radius whose jambs rise from
 * y = 0 to `spring` (the arch crown is then at spring + radius), as a thin
 * plate facing +z.
 */
function archRingGeometry(radius, spring, thickness) {
  const outer = archShape((radius + thickness) * 2, spring + radius + thickness, 0, 0);
  outer.holes.push(archShape(radius * 2, spring + radius, 0, 0));
  return new THREE.ShapeGeometry(outer, 8);
}

/** Elevation of the arcade: ground-following foot, lower arches, upper arches as holes. */
function arcadeShape(ground, bays) {
  const shape = new THREE.Shape();
  shape.moveTo(-HALF, ground(-HALF));
  for (let i = 0; i < bays; i++) {
    const centre = -HALF + (i + 0.5) * SPAN;
    const left = centre - RADIUS;
    const right = centre + RADIUS;
    shape.lineTo(left, ground(left));
    if (ground(centre) < LOWER_SPRING - 2) {
      shape.lineTo(left, LOWER_SPRING);
      shape.absarc(centre, LOWER_SPRING, RADIUS, Math.PI, 0, true);
    }
    shape.lineTo(right, ground(right));
    shape.holes.push(archShape(UPPER_RADIUS * 2, UPPER_SPRING - UPPER_BOTTOM + UPPER_RADIUS, centre, UPPER_BOTTOM));
  }
  shape.lineTo(HALF, ground(HALF));
  shape.lineTo(HALF, TOP);
  shape.lineTo(-HALF, TOP);
  shape.lineTo(-HALF, ground(-HALF));
  return shape;
}

function createValleyGround() {
  const width = HALF * 2 + 60;
  const depth = 160;
  const geometry = new THREE.PlaneGeometry(width, depth, 96, 1).rotateX(-Math.PI / 2);
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) position.setY(i, valley(position.getX(i)) - 0.05);
  scaleUV(geometry, width, depth);
  geometry.computeVertexNormals();
  return mesh(geometry, M.grass);
}

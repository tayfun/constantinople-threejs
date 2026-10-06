import * as THREE from 'three';
import { materials as M } from './lib/materials.js';
import { archShape, box, cypress, groundPlane, mesh, scaleUV } from './lib/primitives.js';
import { scatterHouses } from './lib/buildings.js';
import { createRandom } from '../util/random.js';
import { finalizeModel } from './lib/merge.js';

/**
 * The Aqueduct of Valens (Bozdoğan Kemeri), completed in 368: two tiers of
 * arches carrying the city's water across the valley between the Third and
 * Fourth Hills. Shown as a 300 m stretch; the arches are tallest where the
 * valley is deepest. Runs along x; the water channel is on top.
 */

const HALF = 152; // 38 bays of 8 m
const TOP = 15;
const SPAN = 8;
const PIER = 3;
const RADIUS = (SPAN - PIER) / 2;
const LOWER_SPRING = -RADIUS - 0.8; // lower arches close just under the impost at y = 0
const UPPER_BOTTOM = 1.2;
const UPPER_SPRING = 8.5;

/** Valley profile: ground height at x (deepest, -14 m, in the middle). */
const valley = (x) => -14 * Math.pow(Math.cos((Math.min(Math.abs(x), HALF) / HALF) * (Math.PI / 2)), 1.4);

export function createAqueductOfValens({ lod = 'detail' } = {}) {
  const detail = lod === 'detail';
  // On the flat map both tiers stand on level ground, as the aqueduct is usually pictured.
  const ground = detail ? valley : () => -13;
  const aqueduct = new THREE.Group();
  const structure = new THREE.Group();
  aqueduct.add(structure);

  const wall = new THREE.ExtrudeGeometry(arcadeShape(ground), { depth: 8, bevelEnabled: false, curveSegments: 8 });
  structure.add(mesh(wall.translate(0, 0, -4), M.banded));
  structure.add(box(HALF * 2 + 1, 0.6, 9, M.stone, 0, 0, 0));
  structure.add(box(HALF * 2 + 1, 0.7, 9, M.stone, 0, TOP, 0));
  structure.add(box(HALF * 2, 1.6, 6.5, M.stone, 0, TOP + 0.7, 0));

  if (detail) {
    structure.add(createValleyGround());
    structure.add(groundPlane(8, 160, M.paving, -28, valley(-28) + 0.08, 0));
    const rnd = createRandom(368);
    const avoid = [[-28, 0, 8], ...Array.from({ length: 41 }, (_, i) => [-HALF + i * 10, 0, 12])];
    scatterHouses(structure, rnd, { count: 26, area: [-HALF, -70, HALF, 70], groundAt: (x) => valley(x), avoid });
    for (let i = 0; i < 14; i++) {
      const x = rnd.range(-HALF, HALF);
      structure.add(cypress(rnd.range(9, 14), x, valley(x), rnd.pick([-1, 1]) * rnd.range(16, 70)));
    }
  } else {
    structure.position.y = 13;
  }
  return finalizeModel(aqueduct);
}

/** Elevation of the arcade: ground-following foot, lower arches, upper arches as holes. */
function arcadeShape(ground) {
  const shape = new THREE.Shape();
  shape.moveTo(-HALF, ground(-HALF));
  const bays = Math.round((HALF * 2) / SPAN);
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
    shape.holes.push(archShape(RADIUS * 2, UPPER_SPRING - UPPER_BOTTOM + RADIUS, centre, UPPER_BOTTOM));
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

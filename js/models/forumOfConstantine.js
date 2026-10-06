import * as THREE from 'three';
import { materials as M, tinted } from './lib/materials.js';
import {
  archedWallGeometry, box, cone, cylinder, cylinderGeometry, faceToward, gableRoof, groundPlane, mesh,
} from './lib/primitives.js';
import { scatterHouses } from './lib/buildings.js';
import { finalizeModel } from './lib/merge.js';
import { createRandom } from '../util/random.js';

/**
 * The Forum of Constantine (c. 328–330): an oval plaza on the Second Hill
 * ringed by two-storey colonnades, entered through arches where the Mese
 * crosses it (along x), with the Senate house on its north side (-z). At the
 * centre stands Constantine's column of porphyry drums bound with bronze
 * laurel wreaths, crowned by his gilded statue as the sun god.
 */

const OUTER = [62, 50]; // semi-axes of the outer wall
const PORTICO = 6; // depth of the colonnaded walk
const GATE_HALF_WIDTH = 9;
const SENATE_HALF_WIDTH = 15;

export function createForumOfConstantine({ lod = 'detail' } = {}) {
  const detail = lod === 'detail';
  const forum = new THREE.Group();
  const [a, b] = OUTER;
  const inner = [a - PORTICO, b - PORTICO];

  // Paving: the oval plaza in marble, the Mese running straight through it.
  if (detail) forum.add(box(240, 1, 190, M.paving, 0, -1, 0));
  forum.add(mesh(ellipseGeometry(a, b), M.marble, 0, 0.03, 0));
  forum.add(groundPlane(detail ? 240 : 2 * a + 20, 10, tinted('paving', 0xc9b48e), 0, 0.06, 0));

  // The ring of porticoes, broken by the two gates and the Senate's entrance.
  const gate = GATE_HALF_WIDTH / b; // half-angle of the gaps (approximate, near the axes)
  const senate = SENATE_HALF_WIDTH / a;
  const sectors = [
    [gate, Math.PI / 2 - senate],
    [Math.PI / 2 + senate, Math.PI - gate],
    [Math.PI + gate, Math.PI * 2 - gate],
  ];
  for (const [start, end] of sectors) {
    forum.add(ring(a - 1, b - 1, a, b, start, end, 0, 13, M.stone)); // back wall
    forum.add(ring(inner[0] - 0.6, inner[1] - 0.6, a, b, start, end, 6.5, 0.8, M.marble)); // upper floor
    forum.add(ring(inner[0] - 0.8, inner[1] - 0.8, a + 0.4, b + 0.4, start, end, 12.4, 0.7, M.roof)); // roof
    if (detail) {
      for (const [x, z] of ellipsePoints(...inner, 4.4, start, end)) {
        forum.add(column(x, 0, z, 6.5, 0.38));
        forum.add(column(x, 7.3, z, 5.1, 0.3));
      }
    }
  }

  // Triumphal arches where the Mese enters and leaves.
  for (const side of [-1, 1]) {
    const arch = detail
      ? mesh(archedWallGeometry({ length: 22, height: 17, thickness: 9, openings: [{ x: 0, width: 9, bottom: 0, spring: 9.5 }] }), M.marble)
      : box(22, 17, 9, M.marble);
    arch.rotation.y = Math.PI / 2;
    arch.position.x = side * (a - 2);
    forum.add(arch);
    forum.add(box(10, 1.2, 23, M.marble, side * (a - 2), 17, 0));
  }

  addSenate(forum, detail, b);
  addColumn(forum, detail);

  if (detail) {
    // Bronze statues on pedestals round the plaza.
    for (const angle of [0.6, 2.55, 3.75, 4.71, 5.65]) {
      const x = Math.cos(angle) * (inner[0] - 12);
      const z = -Math.sin(angle) * (inner[1] - 12);
      forum.add(box(2.4, 2.6, 2.4, M.marble, x, 0, z));
      forum.add(cylinder(0.45, 0.6, 2.6, M.bronze, x, 2.6, z, 8));
      forum.add(cylinder(0.32, 0.32, 0.6, M.bronze, x, 5.2, z, 8));
    }
    const rnd = createRandom(330);
    const clear = Array.from({ length: 24 }, (_, i) => {
      const angle = (i / 24) * Math.PI * 2;
      return [Math.cos(angle) * a, Math.sin(angle) * b, 16];
    });
    scatterHouses(forum, rnd, { count: 30, area: [-115, -90, 115, 90], avoid: [[0, 0, 70], [0, -70, 26], [-100, 0, 10], [100, 0, 10], ...clear] });
  }

  return finalizeModel(forum);
}

/** Constantine's column: porphyry drums with bronze wreaths on a marble base, and his gilded statue. */
function addColumn(forum, detail) {
  forum.add(box(11, 1.2, 11, M.marble, 0, 0, 0));
  forum.add(box(9, 1, 9, M.marble, 0, 1.2, 0));
  forum.add(box(7.5, 6, 7.5, M.marble, 0, 2.2, 0));
  forum.add(box(8.3, 0.8, 8.3, M.marble, 0, 8.2, 0));

  const drums = 7;
  const drumHeight = 4.6;
  const drum = cylinderGeometry(1.55, 1.6, drumHeight, 24);
  const wreath = new THREE.TorusGeometry(1.62, 0.16, 8, 32).rotateX(Math.PI / 2);
  let y = 9;
  for (let i = 0; i < drums; i++) {
    forum.add(mesh(drum, M.porphyry, 0, y, 0));
    if (i > 0) forum.add(mesh(wreath, M.bronze, 0, y, 0));
    y += drumHeight;
  }
  forum.add(cylinder(2.3, 1.6, 1.6, M.marble, 0, y, 0, 24)); // capital
  forum.add(box(3.6, 0.6, 3.6, M.marble, 0, y + 1.6, 0));
  forum.add(createStatue(detail, y + 2.2));
}

/** Constantine as Helios: gilded, with a radiate crown, a spear and an orb. */
function createStatue(detail, base) {
  const statue = new THREE.Group();
  statue.add(cylinder(0.7, 0.95, 4, M.gold, 0, base, 0, 12));
  statue.add(mesh(new THREE.SphereGeometry(0.55, 14, 10), M.gold, 0, base + 4.5, 0));
  const spear = cylinder(0.07, 0.07, 6.5, M.gold, 1.1, base + 0.4, 0, 6);
  spear.rotation.z = -0.08;
  statue.add(spear);
  statue.add(mesh(new THREE.SphereGeometry(0.4, 12, 8), M.gold, -1, base + 2.6, 0.3));
  if (detail) {
    for (let i = 0; i < 7; i++) {
      const angle = (i / 7) * Math.PI * 2;
      const ray = cone(0.09, 0.9, M.gold, Math.cos(angle) * 0.5, base + 4.7, Math.sin(angle) * 0.5, 5);
      ray.rotation.set(Math.sin(angle) * 0.9, 0, -Math.cos(angle) * 0.9);
      statue.add(ray);
    }
  }
  return statue;
}

/** The Senate house on the north side, fronted by a porch of porphyry columns. */
function addSenate(forum, detail, b) {
  const z = -(b + 13);
  forum.add(box(34, 15, 22, M.stone, 0, 0, z));
  forum.add(gableRoof(34, 22, 5, M.roof, 0, 15, z));
  forum.add(box(32, 1, 8, M.marble, 0, 12, -(b - 2)));
  if (detail) {
    for (let i = 0; i < 6; i++) forum.add(column(-12.5 + i * 5, 0, -(b - 4.5), 12, 0.55, M.porphyry));
  }
  forum.add(faceToward(cylinder(5, 5, 12, M.stone, 0, 0, z - 11, 12, { thetaStart: -Math.PI / 2, thetaLength: Math.PI }), 0, -1));
}

function column(x, y, z, height, radius, material = M.marble) {
  const group = new THREE.Group();
  group.add(box(radius * 2.6, radius * 0.6, radius * 2.6, M.marble, 0, 0, 0));
  group.add(cylinder(radius * 0.85, radius, height - radius * 1.6, material, 0, radius * 0.6, 0, 10));
  group.add(cylinder(radius * 1.6, radius * 0.9, radius, M.marble, 0, height - radius, 0, 10));
  group.position.set(x, y, z);
  return group;
}

// ---------- ellipse helpers (shape angle 0 = east, PI/2 = north) ----------

function ellipseGeometry(a, b) {
  const shape = new THREE.Shape();
  shape.absellipse(0, 0, a, b, 0, Math.PI * 2, false);
  return new THREE.ShapeGeometry(shape, 48).rotateX(-Math.PI / 2);
}

/** A slab in the band between two ellipses, between two angles, `height` thick from `y`. */
function ring(innerA, innerB, outerA, outerB, start, end, y, height, material) {
  const shape = new THREE.Shape();
  shape.absellipse(0, 0, outerA, outerB, start, end, false);
  shape.lineTo(innerA * Math.cos(end), innerB * Math.sin(end));
  shape.absellipse(0, 0, innerA, innerB, end, start, true);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, curveSegments: 40 });
  return mesh(geometry.rotateX(-Math.PI / 2), material, 0, y, 0);
}

/** Points roughly `spacing` apart along an ellipse between two angles, as world [x, z]. */
function ellipsePoints(a, b, spacing, start, end) {
  const points = [];
  let travelled = spacing / 2;
  let previous = [a * Math.cos(start), b * Math.sin(start)];
  for (let i = 1; i <= 400; i++) {
    const angle = start + ((end - start) * i) / 400;
    const current = [a * Math.cos(angle), b * Math.sin(angle)];
    travelled += Math.hypot(current[0] - previous[0], current[1] - previous[1]);
    if (travelled >= spacing) {
      points.push([current[0], -current[1]]);
      travelled = 0;
    }
    previous = current;
  }
  return points;
}

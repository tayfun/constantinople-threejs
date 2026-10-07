import * as THREE from 'three';
import { materials as M, tinted } from './lib/materials.js';
import {
  archedWallGeometry, box, cone, cylinder, cylinderGeometry, faceToward, gableRoof, groundPlane, mesh,
} from './lib/primitives.js';
import { scatterHouses } from './lib/buildings.js';
import { finalizeModel } from './lib/merge.js';
import { createRandom } from '../util/random.js';

/**
 * The Forum of Constantine (c. 328–330): an oval plaza on the Second Hill,
 * just outside Byzantium's old wall, ringed by a two-storey colonnade of
 * white marble and entered through arches of Proconnesian marble where the
 * Mese crosses it (along x). The Senate house, with its porch of porphyry
 * columns, stands on the north side (-z) and a nymphaeum faces it across
 * the square. At the centre rises Constantine's column: nine drums of
 * Egyptian porphyry, their joints hidden by carved laurel wreaths, on a tall
 * marble pedestal and stepped platform, crowned by the gilded statue of the
 * emperor as Helios with a radiate crown, spear and orb — close to 50 m in
 * all. The square was crowded with antique bronzes: Athena, the Judgement
 * of Paris, hippocamps on porphyry columns, an elephant…
 *
 * Sources: Bauer, "The Forum of Constantine in Constantinople" (brewminate);
 * Wikipedia, Column of Constantine (37–40 m shaft and base, 7-point radiate
 * crown, laurel-wreath joints); Byzantium 1200 reconstruction.
 */

const OUTER = [62, 50]; // semi-axes of the outer wall
const PORTICO = 6.5; // depth of the colonnaded walk
const GATE_HALF_WIDTH = 9;
const SENATE_HALF_WIDTH = 15;
const LOWER_STOREY = 7.2;
const UPPER_STOREY = 5.4;
const FLOOR = 0.8;
const WALL_HEIGHT = LOWER_STOREY + FLOOR + UPPER_STOREY + 0.6;

export function createForumOfConstantine({ lod = 'detail' } = {}) {
  const detail = lod === 'detail';
  const forum = new THREE.Group();
  const [a, b] = OUTER;
  const inner = [a - PORTICO, b - PORTICO];

  // Paving: the oval plaza in Proconnesian marble, the Mese running straight through it.
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
  const upperBase = LOWER_STOREY + FLOOR;
  for (const [start, end] of sectors) {
    forum.add(ring(a - 1.2, b - 1.2, a, b, start, end, 0, WALL_HEIGHT, M.stone)); // back wall
    forum.add(ring(inner[0] - 0.9, inner[1] - 0.9, a + 0.2, b + 0.2, start, end, LOWER_STOREY, FLOOR, M.marble)); // entablature and upper floor
    forum.add(ring(inner[0] - 0.9, inner[1] - 0.9, inner[0] - 0.4, inner[1] - 0.4, start, end, upperBase, 1, M.marble)); // balustrade
    forum.add(ring(inner[0] - 1.2, inner[1] - 1.2, a + 0.6, b + 0.6, start, end, upperBase + UPPER_STOREY, 0.7, M.marble)); // cornice
    forum.add(ring(inner[0] - 1.4, inner[1] - 1.4, a + 0.9, b + 0.9, start, end, upperBase + UPPER_STOREY + 0.7, 0.8, M.roof)); // roof
    if (detail) {
      for (const [x, z] of ellipsePoints(...inner, 4.2, start, end)) {
        forum.add(column(x, 0, z, LOWER_STOREY, 0.42));
        forum.add(column(x, upperBase, z, UPPER_STOREY, 0.32));
      }
    }
  }

  addGates(forum, detail, a);
  addSenate(forum, detail, b);
  if (detail) addNymphaeum(forum, b);
  addColumn(forum, detail);

  if (detail) {
    addStatues(forum, inner);
    const rnd = createRandom(330);
    const clear = Array.from({ length: 24 }, (_, i) => {
      const angle = (i / 24) * Math.PI * 2;
      return [Math.cos(angle) * a, Math.sin(angle) * b, 16];
    });
    scatterHouses(forum, rnd, { count: 30, area: [-115, -90, 115, 90], avoid: [[0, 0, 70], [0, -70, 26], [-100, 0, 10], [100, 0, 10], ...clear] });
  }

  return finalizeModel(forum);
}

/** Triumphal arches of Proconnesian marble where the Mese enters and leaves, each carrying bronze figures. */
function addGates(forum, detail, a) {
  for (const side of [-1, 1]) {
    const x = side * (a - 2);
    const arch = detail
      ? mesh(archedWallGeometry({ length: 24, height: 17, thickness: 9, openings: [{ x: 0, width: 9, bottom: 0, spring: 10 }] }), M.marble)
      : box(24, 17, 9, M.marble);
    arch.rotation.y = Math.PI / 2;
    arch.position.x = x;
    forum.add(arch);
    forum.add(box(10, 1.4, 25.5, M.marble, x, 17, 0)); // cornice
    forum.add(box(8.5, 3.6, 22, M.marble, x, 18.4, 0)); // attic
    forum.add(box(9.5, 0.6, 23, M.marble, x, 22, 0));
    if (!detail) continue;
    for (const dz of [-9.5, 9.5]) {
      for (const dx of [-3.5, 3.5]) forum.add(box(1.4, 15.5, 1.4, M.marble, x + dx, 0, dz)); // pilasters
    }
    for (const dz of [-7, 7]) forum.add(figure(x, 22.6, dz, 3.4, M.bronze)); // the bronze women of the arches
    forum.add(figure(x, 22.6, 0, 3.8, M.bronze));
  }
}

/** Constantine's column: a stepped marble platform and pedestal, nine porphyry drums bound by laurel wreaths, and his gilded statue. */
function addColumn(forum, detail) {
  const porphyry = detail ? porphyryMaterial() : M.porphyry;
  // A platform of five steps, built as stacked slabs.
  for (let i = 0; i < 5; i++) forum.add(box(16 - i * 1.6, 0.4 * (i + 1), 16 - i * 1.6, M.marble, 0, 0, 0));
  let y = 2;
  forum.add(box(8.4, 0.8, 8.4, M.marble, 0, y, 0)); // plinth
  forum.add(box(7.2, 5.6, 7.2, M.marble, 0, y + 0.8, 0)); // pedestal with its carved frieze
  if (detail) {
    for (const side of [-1, 1]) {
      forum.add(box(5.6, 1.6, 0.25, M.gildedBronze, 0, y + 3, side * 3.62));
      forum.add(box(0.25, 1.6, 5.6, M.gildedBronze, side * 3.62, y + 3, 0));
    }
  }
  forum.add(box(8.4, 0.8, 8.4, M.marble, 0, y + 6.4, 0)); // cornice
  y += 7.2;
  forum.add(cylinder(2.1, 2.5, 0.8, M.marble, 0, y, 0, 24)); // torus base
  y += 0.8;

  const drums = detail ? 9 : 3;
  const drumHeight = 29.7 / drums;
  const drum = cylinderGeometry(1.3, 1.45, drumHeight, 24);
  const wreath = new THREE.TorusGeometry(1.5, 0.22, 8, 32).rotateX(Math.PI / 2);
  for (let i = 0; i < drums; i++) {
    forum.add(mesh(drum, porphyry, 0, y, 0));
    if (i > 0 && detail) forum.add(mesh(wreath, M.gildedBronze, 0, y, 0));
    y += drumHeight;
  }
  forum.add(cylinder(1.9, 1.3, 1.6, M.marble, 0, y, 0, 24)); // capital
  forum.add(box(3.8, 0.6, 3.8, M.marble, 0, y + 1.6, 0)); // abacus
  forum.add(createStatue(detail, y + 2.2));
}

/** Egyptian imperial porphyry: deep purple-red stone flecked with pale feldspar. */
let porphyryCache = null;
function porphyryMaterial() {
  if (porphyryCache) return porphyryCache;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgb(104, 42, 62)';
  ctx.fillRect(0, 0, 128, 128);
  const rnd = createRandom(330);
  for (let i = 0; i < 1400; i++) {
    const pale = rnd.chance(0.75);
    ctx.fillStyle = pale ? `rgba(230, 190, 200, ${0.35 + rnd.next() * 0.4})` : `rgba(60, 20, 36, ${0.4 + rnd.next() * 0.4})`;
    const s = 1 + rnd.next() * 2;
    ctx.fillRect(rnd.next() * 128, rnd.next() * 128, s, s);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1 / 1.5, 1 / 1.5);
  porphyryCache = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.42, metalness: 0 });
  return porphyryCache;
}

/** Constantine as Helios: gilded, with a seven-point radiate crown, a spear and an orb. */
function createStatue(detail, base) {
  const statue = new THREE.Group();
  statue.add(cylinder(0.75, 1.0, 4.4, M.gold, 0, base, 0, 12));
  statue.add(cylinder(1.3, 0.9, 1.3, M.gold, 0, base + 3.6, 0, 12)); // shoulders
  statue.add(mesh(new THREE.SphereGeometry(0.6, 14, 10), M.gold, 0, base + 5.4, 0));
  const spear = cylinder(0.08, 0.08, 7.5, M.gold, 1.25, base + 0.3, 0, 6);
  spear.rotation.z = -0.06;
  statue.add(spear);
  statue.add(cylinder(0.2, 0.25, 2.6, M.gold, -1.3, base + 2.6, 0.3, 8)); // arm holding the orb
  statue.add(mesh(new THREE.SphereGeometry(0.45, 12, 8), M.gold, -1.3, base + 5.1, 0.3));
  if (detail) {
    for (let i = 0; i < 7; i++) {
      const angle = Math.PI * (0.05 + (0.9 * i) / 6); // a fan of rays over the brow
      const ray = cone(0.1, 1.2, M.gold, Math.cos(angle) * 0.55, base + 5.5 + Math.sin(angle) * 0.45, 0, 5);
      ray.rotation.z = angle - Math.PI / 2;
      statue.add(ray);
    }
  }
  return statue;
}

/** The Senate house on the north side: a basilica hall with an apse, fronted by a pedimented porch of four porphyry columns. */
function addSenate(forum, detail, b) {
  const z = -(b + 13);
  forum.add(box(36, 16, 24, M.stone, 0, 0, z));
  forum.add(gableRoof(36, 24, 6, M.roof, 0, 16, z));
  forum.add(faceToward(cylinder(6, 6, 14, M.stone, 0, 0, z - 12, 12, { thetaStart: -Math.PI / 2, thetaLength: Math.PI }), 0, -1));
  forum.add(faceToward(mesh(new THREE.SphereGeometry(6.2, 12, 6, 0, Math.PI, 0, Math.PI / 2).scale(1, 0.6, 1), M.lead, 0, 14, z - 12), 0, -1));

  // The porch, opening south onto the square.
  const porchZ = -(b - 1);
  forum.add(box(26, 0.8, 10, M.marble, 0, 0, porchZ));
  forum.add(box(26, 1.2, 10, M.marble, 0, 12.8, porchZ)); // entablature
  const pediment = gableRoof(10, 26, 3.4, M.roof, 0, 14, porchZ, 0.3);
  pediment.rotation.y = Math.PI / 2;
  forum.add(pediment);
  forum.add(box(25, 2.6, 0.4, M.marble, 0, 14, porchZ + 5)); // tympanum face
  forum.add(box(6, 9, 0.5, M.bronze, 0, 0.8, -(b + 1.1))); // the bronze doors from Ephesos
  if (detail) {
    for (const x of [-9.75, -3.25, 3.25, 9.75]) forum.add(column(x, 0.8, porchZ + 3.6, 12, 0.6, M.porphyry));
    forum.add(windowed(-(b + 1.25)));
    // The colossal Athena from Lindos beside the entrance.
    forum.add(box(3, 3, 3, M.marble, -17, 0, -(b - 6)));
    forum.add(figure(-17, 3, -(b - 6), 6.5, M.bronze));
  }
}

/** A row of high clerestory windows on the Senate's south face. */
function windowed(z) {
  const group = new THREE.Group();
  for (let i = 0; i < 5; i++) group.add(box(2, 3, 0.3, M.opening, -10 + i * 5, 9, z));
  return group;
}

/** The nymphaeum opposite the Senate: a screen of niches over a semicircular basin. */
function addNymphaeum(forum, b) {
  const z = b - PORTICO - 2;
  forum.add(box(22, 9, 1.6, M.marble, 0, 0, z + 1.4));
  for (let i = 0; i < 3; i++) {
    const x = -7 + i * 7;
    forum.add(box(2.4, 5, 0.6, M.opening, x, 2, z + 0.5));
    forum.add(figure(x, 2.2, z + 0.5, 2.8, M.marble));
  }
  forum.add(box(22, 0.7, 2.2, M.marble, 0, 9, z + 1.4));
  forum.add(faceToward(cylinder(7, 7, 1.2, M.marble, 0, 0, z - 0.2, 20, { thetaStart: -Math.PI / 2, thetaLength: Math.PI }), 0, 1));
  const basin = mesh(new THREE.CircleGeometry(6.2, 20, Math.PI, Math.PI).rotateX(-Math.PI / 2), M.water, 0, 0.9, z - 0.2);
  forum.add(basin);
}

/** The antique bronzes gathered in the square. */
function addStatues(forum, inner) {
  const pedestal = (x, z, size = 2.6) => forum.add(box(size, 2.4, size, M.marble, x, 0, z));

  // The Judgement of Paris: three goddesses before the shepherd prince.
  for (const [i, dx] of [-2.4, 0, 2.4].entries()) {
    pedestal(-30 + dx, 24, 1.8);
    forum.add(figure(-30 + dx, 2.4, 24, 2.4 + (i === 1 ? 0.4 : 0), M.bronze));
  }
  pedestal(-30, 29, 1.8);
  forum.add(figure(-30, 2.4, 29, 2.4, M.bronze));

  // Hippocamps on two porphyry columns.
  for (const x of [28, 36]) {
    forum.add(box(2.2, 1, 2.2, M.marble, x, 0, 22));
    forum.add(cylinder(0.5, 0.6, 7, M.porphyry, x, 1, 22, 12));
    forum.add(cylinder(0.8, 0.5, 0.6, M.marble, x, 8, 22, 12));
    forum.add(box(2.2, 1.1, 1.2, M.bronze, x, 8.6, 22));
    forum.add(cylinder(0.3, 0.4, 1.4, M.bronze, x + 0.9, 9.4, 22, 6));
  }

  // The bronze elephant.
  pedestal(30, -24, 4);
  const elephant = new THREE.Group();
  elephant.add(box(4.2, 2.4, 2.2, M.bronze, 0, 1.8, 0));
  for (const dx of [-1.4, 1.4]) for (const dz of [-0.7, 0.7]) elephant.add(cylinder(0.32, 0.38, 1.8, M.bronze, dx, 0, dz, 8));
  elephant.add(mesh(new THREE.SphereGeometry(1.1, 10, 8), M.bronze, 2.6, 3.2, 0));
  const trunk = cylinder(0.14, 0.3, 2.4, M.bronze, 3.4, 1.4, 0, 6);
  trunk.rotation.z = 0.2;
  elephant.add(trunk);
  elephant.position.set(30, 2.4, -24);
  forum.add(elephant);

  // Thetis with her crown of crabs, and other gods along the walks.
  for (const [angle, height] of [[0.35, 3.2], [2.85, 3.0], [3.9, 3.4], [5.6, 3.1]]) {
    const x = Math.cos(angle) * (inner[0] - 10);
    const z = -Math.sin(angle) * (inner[1] - 10);
    pedestal(x, z);
    forum.add(figure(x, 2.4, z, height, M.bronze));
  }
}

/** A stylised standing figure (body, shoulders and head) of a given height. */
function figure(x, y, z, height, material) {
  const group = new THREE.Group();
  group.add(cylinder(height * 0.12, height * 0.17, height * 0.72, material, 0, 0, 0, 10));
  group.add(cylinder(height * 0.2, height * 0.14, height * 0.14, material, 0, height * 0.68, 0, 10));
  group.add(mesh(new THREE.SphereGeometry(height * 0.1, 10, 8), material, 0, height * 0.9, 0));
  group.position.set(x, y, z);
  return group;
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

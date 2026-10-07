import * as THREE from 'three';
import { materials as M } from './lib/materials.js';
import {
  archGeometry, box, cone, crenellationGeometry, cylinder, gableRoof, mesh, placeOnCircle,
} from './lib/primitives.js';
import { createHouse } from './lib/buildings.js';
import { finalizeModel } from './lib/merge.js';

/**
 * The Galata Tower — Turris Sancte Crucis, the "Tower of the Holy Cross",
 * later Christea Turris — raised by the Genoese in 1348 as the keep at the
 * apex of their walled colony, shown as it stands today, the form everyone
 * knows: a round shaft of rough-cut rubble 16.45 m across, lit by a few small
 * arched windows, under a moulded cornice; above it the arcaded storey of
 * tall round-arched bays in pale ashlar, the corbelled viewing balcony with
 * its iron railing, a short set-back top storey, and the steep lead cone
 * with its dormers and gilded finial, 62.59 m high without the finial and
 * about 67 m with it. The arcaded top is Ottoman work, and the cone was
 * rebuilt in 1965–67 after a century without one (Buondelmonti drew the
 * Genoese tower in the 1420s with battlements and a plain cone).
 * The colony walls step down the hill of Galata from it to either side (the
 * Golden Horn lies to the +z side).
 *
 * Measured values from the surviving tower (Wikipedia, Structurae);
 * proportions of the upper storeys from Sébah's photograph (1880s) and
 * recent photographs.
 */

const BASE_RADIUS = 8.22; // 16.45 m external diameter
const SHAFT_TOP = 32; // the moulded cornice
const SHAFT_TOP_RADIUS = 7.7;
const ARCADE_TOP = 39.4;
const BALCONY = 40.5; // the viewing deck
const EAVES = 44.4;
const APEX = 62.59;
const FINIAL_TIP = 66.9;

export function createGalataTower({ lod = 'detail' } = {}) {
  const detail = lod === 'detail';
  const tower = new THREE.Group();
  addGalataKeep(tower, { detail });

  // The colony walls leave the keep to either side and step down the hill. The map
  // has no hill under the keep, so there the same stretch runs level in two steps.
  const steps = detail ? [[0, 16, 13], [-5, 14, 12], [-10, 10, 11]] : [[0, 9, 13], [0, 10, 12]];
  const runs = [[Math.PI * 0.8, steps], [Math.PI * 0.2, steps]];
  for (const [angle, steps] of runs) {
    const wall = new THREE.Group();
    let x = BASE_RADIUS - 1;
    for (const [i, [y, length, height]] of steps.entries()) {
      wall.add(box(length + 1, height - y, 3.2, M.stone, x + length / 2, y - 1, 0));
      wall.add(mesh(crenellationGeometry(length, { merlon: 1.1, gap: 0.8, height: 1.3, thickness: 0.7 }), M.stone, x + length / 2, height, 1.25));
      x += length;
      const last = i === steps.length - 1;
      const towerHeight = last ? height + 6 : height + 3.5;
      const size = last ? 7 : 6;
      wall.add(box(size, towerHeight - y + 1, size, M.stone, x, y - 1, 0));
      wall.add(mesh(crenellationGeometry(size, { merlon: 0.9, gap: 0.7, height: 1.2 }), M.stone, x, towerHeight, size / 2 - 0.35));
      wall.add(mesh(crenellationGeometry(size, { merlon: 0.9, gap: 0.7, height: 1.2 }), M.stone, x, towerHeight, -(size / 2 - 0.35)));
      x += size / 2;
    }
    wall.rotation.y = Math.atan2(-Math.sin(angle), Math.cos(angle));
    tower.add(wall);
  }

  if (detail) addHill(tower);

  return finalizeModel(tower);
}

/**
 * The tower itself, standing at the origin of `group`; shared with the
 * Genoese colony's diorama. `detail: false` keeps the silhouette and leaves
 * out the small windows, dormers and the railing's posts.
 */
export function addGalataKeep(group, { detail = true } = {}) {
  const segments = detail ? 40 : 24;
  const radiusAt = (y) => BASE_RADIUS + (SHAFT_TOP_RADIUS - BASE_RADIUS) * (y / SHAFT_TOP);

  // The rubble shaft, tapering a little, and the moulded cornice that crowns it.
  group.add(cylinder(SHAFT_TOP_RADIUS, BASE_RADIUS, SHAFT_TOP, M.rubble, 0, 0, 0, segments));
  for (const [y, h, out] of [[SHAFT_TOP - 0.6, 0.5, 0.25], [SHAFT_TOP - 0.1, 0.45, 0.55], [SHAFT_TOP + 0.35, 0.55, 0.85]]) {
    group.add(cylinder(SHAFT_TOP_RADIUS + out, SHAFT_TOP_RADIUS + out, h, M.stone, 0, y, 0, segments));
  }

  // The door, and the shaft's few small arched windows: a ring of little lights under the
  // cornice, larger windows below them, and a handful scattered down the shaft.
  const front = Math.PI / 2;
  group.add(placeOnCircle(mesh(archGeometry(2.2, 3.6), M.opening), front, BASE_RADIUS + 0.03, 0.2));
  group.add(placeOnCircle(mesh(archGeometry(3.2, 4.4), M.stone), front, BASE_RADIUS + 0.01, 0));
  const rows = detail
    ? [[28.6, 8, 0.7, 1.3, 0.1], [24.2, 4, 1.2, 2, 0.25], [18.5, 3, 0.8, 1.6, 0.6], [11, 3, 0.7, 1.4, 0.1]]
    : [[28.6, 8, 0.9, 1.5, 0.1], [24.2, 4, 1.4, 2.2, 0.25]];
  for (const [y, count, width, height, offset] of rows) {
    const window = archGeometry(width, height);
    for (let i = 0; i < count; i++) {
      group.add(placeOnCircle(mesh(window, M.opening), ((i + offset) / count) * Math.PI * 2, radiusAt(y) + 0.04, y));
    }
  }

  // The arcaded storey: piers carrying round arches, a tall arched window in each bay.
  const arcadeBase = SHAFT_TOP + 0.9;
  const bays = 12;
  group.add(cylinder(7.3, 7.3, ARCADE_TOP - arcadeBase, M.stone, 0, arcadeBase, 0, segments));
  for (let i = 0; i < bays; i++) {
    const pier = (i / bays) * Math.PI * 2;
    group.add(placeOnCircle(box(1.3, ARCADE_TOP - arcadeBase, 1.1, M.stone), pier, 7.6, arcadeBase));
    const bay = pier + Math.PI / bays;
    group.add(placeOnCircle(mesh(archGeometry(3.0, 5.4), M.stoneDark), bay, 7.32, arcadeBase + 0.3)); // the deep arch
    group.add(placeOnCircle(mesh(archGeometry(1.6, 3.4), M.opening), bay, 7.35, arcadeBase + 0.9)); // the window in it
  }
  group.add(cylinder(8.0, 8.0, 0.7, M.stone, 0, ARCADE_TOP - 0.7, 0, segments)); // band over the arches

  // The balcony: a flaring corbel course, the deck, and an iron railing.
  group.add(cylinder(9.2, 8.0, BALCONY - 0.3 - ARCADE_TOP, M.stone, 0, ARCADE_TOP, 0, segments));
  group.add(cylinder(9.2, 9.2, 0.3, M.stone, 0, BALCONY - 0.3, 0, segments));
  const rail = mesh(new THREE.TorusGeometry(9.05, 0.07, 4, segments * 2).rotateX(Math.PI / 2), M.iron, 0, BALCONY + 1.1, 0);
  group.add(rail);
  const posts = detail ? 64 : 0;
  for (let i = 0; i < posts; i++) group.add(placeOnCircle(box(0.07, 1.1, 0.07, M.iron), (i / posts) * Math.PI * 2, 9.05, BALCONY));
  if (!detail) group.add(cylinder(9.05, 9.05, 1.1, M.iron, 0, BALCONY, 0, segments, { open: true }));

  // The set-back top storey with its doors onto the balcony, and the eaves.
  group.add(cylinder(6.6, 6.6, EAVES - BALCONY, M.stone, 0, BALCONY, 0, segments));
  const doors = detail ? 16 : 8;
  for (let i = 0; i < doors; i++) group.add(placeOnCircle(mesh(archGeometry(1.1, 2.5), M.opening), ((i + 0.5) / doors) * Math.PI * 2, 6.62, BALCONY + 0.3));
  group.add(cylinder(7.2, 7.2, 0.4, M.stoneDark, 0, EAVES, 0, segments));

  // The steep lead cone, narrower than the balcony, with its little dormers, and the gilded finial.
  const coneBase = EAVES + 0.4;
  const coneHeight = APEX - coneBase;
  const coneRadius = 7.1;
  group.add(cone(coneRadius, coneHeight, M.lead, 0, coneBase, 0, segments));
  if (detail) {
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const rise = 5;
      const dormer = new THREE.Group();
      dormer.add(box(0.9, 1.1, 1.4, M.lead, 0, 0, -0.5));
      dormer.add(gableRoof(1.4, 0.9, 0.45, M.lead, 0, 1.1, -0.5, 0.06).rotateY(Math.PI / 2));
      dormer.add(mesh(archGeometry(0.5, 0.9), M.opening, 0, 0.1, 0.21));
      group.add(placeOnCircle(dormer, angle, coneRadius * (1 - rise / coneHeight), coneBase + rise));
    }
  }
  group.add(cylinder(0.14, 0.24, 1.3, M.gold, 0, APEX - 0.4, 0, 8));
  group.add(mesh(new THREE.SphereGeometry(0.5, 12, 8), M.gold, 0, APEX + 1.3, 0));
  group.add(cylinder(0.09, 0.13, 1.0, M.gold, 0, APEX + 1.7, 0, 8));
  group.add(mesh(new THREE.SphereGeometry(0.3, 10, 8), M.gold, 0, APEX + 2.9, 0));
  group.add(cone(0.12, FINIAL_TIP - APEX - 3.1, M.gold, 0, APEX + 3.1, 0, 8));
  return group;
}

/** The hilltop of Galata, 35 m above the Horn, as three terraces with the keep's barbican and houses. */
function addHill(tower) {
  for (const [radius, y] of [[30, -5], [46, -10], [64, -15]]) {
    tower.add(cylinder(radius, radius + 4, 5, M.grass, 0, y, 0, 40));
  }
  tower.add(cylinder(16, 16, 0.3, M.paving, 0, -0.1, 0, 32));
  // The barbican: a low wall closing the forecourt before the door, with its own gate.
  const barbican = new THREE.Group();
  barbican.add(mesh(new THREE.ShapeGeometry(forecourtShape()).rotateX(-Math.PI / 2), M.paving, 0, 0.05, 0));
  for (const [x, z, length, rotation, gate] of [[-10, 18, 20, 0, true], [10, 18, 20, 0, false], [-20, 9, 18, Math.PI / 2, false], [20, 9, 18, Math.PI / 2, false]]) {
    const piece = new THREE.Group();
    piece.add(box(length, 5.5, 1.8, M.stone, 0, 0, 0));
    piece.add(mesh(crenellationGeometry(length, { merlon: 0.8, gap: 0.6, height: 1, thickness: 0.5 }), M.stone, 0, 5.5, 0.65));
    if (gate) piece.add(mesh(archGeometry(3, 4.2), M.opening, 2, 0, 0.95));
    piece.position.set(x, 0, z);
    piece.rotation.y = rotation;
    barbican.add(piece);
  }
  for (const [x, z] of [[-20, 18], [20, 18]]) barbican.add(box(4, 8, 4, M.stone, x, 0, z));
  tower.add(barbican);

  // Tall, narrow Ligurian houses crowd the terraces below the keep.
  const houses = [
    [-26, -20, 0.2, -5], [26, -24, -0.3, -5], [-30, 8, 1.5, -5], [32, 2, 1.7, -5], [2, -30, 0, -5], [-14, 32, 0.1, -5], [16, 33, -0.2, -5],
    [-50, -14, 0.4, -10], [50, -18, -0.5, -10], [-44, 32, 1.2, -10], [46, 30, 1.9, -10], [-14, -52, 0, -10], [22, -50, 0.2, -10], [0, 54, 0.1, -10],
  ];
  for (const [x, z, rotation, y] of houses) {
    const house = createHouse({ w: 9, d: 7, h: 12, color: 0xe9c79a, roof: 'gable' });
    house.position.set(x, y, z);
    house.rotation.y = rotation;
    tower.add(house);
  }
}

function forecourtShape() {
  const shape = new THREE.Shape();
  shape.moveTo(-20, -18);
  shape.lineTo(20, -18);
  shape.lineTo(20, 0);
  shape.lineTo(-20, 0);
  shape.closePath();
  return shape;
}

import * as THREE from 'three';
import { materials as M } from './lib/materials.js';
import {
  archGeometry, box, cone, crenelRingGeometry, crenellationGeometry, cylinder, flag, mesh, placeOnCircle,
} from './lib/primitives.js';
import { createHouse } from './lib/buildings.js';
import { finalizeModel } from './lib/merge.js';

/**
 * The Galata Tower — Turris Sancte Crucis, the "Tower of the Holy Cross",
 * later Christea Turris — raised by the Genoese in 1348 as the keep at the
 * apex of their walled colony, as it looked before the Ottoman rebuildings:
 * a round limestone keep 16.45 m across on walls 3.75 m thick, nine storeys
 * to the machicolated parapet, and the conical cap Buondelmonti drew in
 * 1422 topping out at 62.6 m. The colony walls step down the hill of Galata
 * from it to either side (the Golden Horn lies to the +z side).
 *
 * Measured values from the surviving tower (Wikipedia, Structurae); the
 * Genoese-period form from thebyzantinelegacy.com/galata-tower.
 */

const BASE_RADIUS = 8.25; // 16.45 m external diameter
const TOP_RADIUS = 7.75;
const SHAFT = 46; // to the machicolations
const PARAPET_TOP = 51.6; // the walkway at 51.65 m today
const TIP = 62.6;

export function createGalataTower({ lod = 'detail' } = {}) {
  const detail = lod === 'detail';
  const tower = new THREE.Group();
  const radiusAt = (y) => BASE_RADIUS + (TOP_RADIUS - BASE_RADIUS) * (y / SHAFT);
  const segments = detail ? 36 : 28;

  // Battered socle, the shaft and its string courses.
  tower.add(cylinder(BASE_RADIUS + 0.1, BASE_RADIUS + 1.4, 4, M.stoneDark, 0, 0, 0, segments));
  tower.add(cylinder(TOP_RADIUS, BASE_RADIUS, SHAFT, M.stone, 0, 0, 0, segments));
  for (const y of [11, 23, 35]) tower.add(cylinder(radiusAt(y) + 0.25, radiusAt(y) + 0.25, 0.5, M.stoneDark, 0, y, 0, segments));

  // Machicolation: corbels in two steps carrying the overhanging parapet, then the battlements.
  const corbels = detail ? 36 : 24;
  for (let i = 0; i < corbels; i++) {
    const angle = (i / corbels) * Math.PI * 2;
    tower.add(placeOnCircle(box(0.8, 1.2, 1.4, M.stoneDark), angle, TOP_RADIUS + 0.4, SHAFT - 1.2));
    tower.add(placeOnCircle(box(0.9, 1.1, 2, M.stoneDark), angle, TOP_RADIUS + 0.7, SHAFT));
  }
  tower.add(cylinder(TOP_RADIUS + 1.5, TOP_RADIUS + 1.5, PARAPET_TOP - SHAFT - 1.1, M.stone, 0, SHAFT + 1.1, 0, segments));
  tower.add(mesh(crenelRingGeometry(TOP_RADIUS + 1.15, { count: detail ? 24 : 18, merlon: 1.1, height: 1.5, thickness: 0.7 }), M.stone, 0, PARAPET_TOP, 0));

  // The conical cap, sitting inside the parapet, with a short drum under it.
  tower.add(cylinder(TOP_RADIUS + 0.2, TOP_RADIUS + 0.2, 1.8, M.stone, 0, PARAPET_TOP - 0.2, 0, segments));
  tower.add(cone(TOP_RADIUS + 0.9, TIP - PARAPET_TOP - 1.6, M.lead, 0, PARAPET_TOP + 1.6, 0, segments));
  tower.add(cylinder(0.3, 0.45, 1.2, M.lead, 0, TIP - 0.4, 0, 8));

  // The door with the cross of the Holy Cross above it, arrow slits on the lower
  // storeys and a ring of small windows lighting the guards' top floor.
  const front = Math.PI / 2;
  tower.add(placeOnCircle(mesh(archGeometry(2.2, 4), M.opening), front, BASE_RADIUS + 1.42, 0.2));
  tower.add(placeOnCircle(box(2.6, 2.4, 0.2, M.marble), front, BASE_RADIUS + 0.05, 5.2));
  tower.add(placeOnCircle(box(0.4, 1.7, 0.25, M.stoneDark), front, BASE_RADIUS + 0.12, 5.55));
  tower.add(placeOnCircle(box(1.2, 0.4, 0.25, M.stoneDark), front, BASE_RADIUS + 0.12, 6.3));
  const slit = archGeometry(0.55, 2.2);
  const window = archGeometry(1.3, 2.6);
  const rows = detail
    ? [[8, 4, slit, 0.5], [15, 5, slit, 0.2], [20, 4, slit, 0], [27, 6, slit, 0.5], [32, 5, slit, 0.1], [39, 6, slit, 0.3], [42.5, 12, window, 0.25]]
    : [[14, 4, slit, 0.5], [27, 5, slit, 0.2], [39, 6, slit, 0.3], [42.5, 12, window, 0.25]];
  for (const [y, count, geometry, offset] of rows) {
    for (let i = 0; i < count; i++) {
      tower.add(placeOnCircle(mesh(geometry, M.opening), ((i + offset) / count) * Math.PI * 2, radiusAt(y) + 0.06, y));
    }
  }

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

  finalizeModel(tower);
  const banner = flag('genoa', { width: 4, height: 2.6, pole: 7 });
  banner.position.y = TIP - 0.2;
  tower.add(banner);
  return tower;
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

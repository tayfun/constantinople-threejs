import * as THREE from 'three';
import { materials as M } from './lib/materials.js';
import {
  archGeometry, box, cone, crenelRingGeometry, crenellationGeometry, cylinder, flag, mesh, placeOnCircle,
} from './lib/primitives.js';
import { createHouse } from './lib/buildings.js';
import { finalizeModel } from './lib/merge.js';

/**
 * The Galata Tower — Christea Turris, the "Tower of Christ" — raised by the
 * Genoese in 1348 at the top of their walled colony, as it looked before the
 * Ottoman additions: a round stone keep with machicolations, battlements and
 * a conical roof. Stubs of the colony walls run downhill to either side.
 */

const BASE_RADIUS = 8.4;
const TOP_RADIUS = 7.8;
const SHAFT = 42;

export function createGalataTower({ lod = 'detail' } = {}) {
  const detail = lod === 'detail';
  const tower = new THREE.Group();
  const radiusAt = (y) => BASE_RADIUS + (TOP_RADIUS - BASE_RADIUS) * (y / SHAFT);

  tower.add(cylinder(TOP_RADIUS, BASE_RADIUS, SHAFT, M.stone, 0, 0, 0, 32));
  for (const y of [14, 28]) tower.add(cylinder(radiusAt(y) + 0.3, radiusAt(y) + 0.3, 0.6, M.stone, 0, y, 0, 32));

  // Machicolation corbels carrying the overhanging parapet, then battlements.
  for (let i = 0; i < 32; i++) tower.add(placeOnCircle(box(0.9, 1.6, 1.6, M.stone), (i / 32) * Math.PI * 2, TOP_RADIUS + 0.5, SHAFT));
  tower.add(cylinder(TOP_RADIUS + 1.2, TOP_RADIUS + 1.2, 3.6, M.stone, 0, SHAFT + 1.6, 0, 32));
  tower.add(mesh(crenelRingGeometry(TOP_RADIUS + 0.9, { count: 22, height: 1.4, thickness: 0.8 }), M.stone, 0, SHAFT + 5.2, 0));
  tower.add(cone(TOP_RADIUS + 0.6, 15, M.lead, 0, SHAFT + 5.2, 0, 32));

  // Door, arrow slits and the upper windows.
  const slit = archGeometry(0.7, 2.4);
  const window = archGeometry(1.5, 3.4);
  tower.add(placeOnCircle(mesh(archGeometry(2.4, 4.2), M.opening), Math.PI / 2, BASE_RADIUS + 0.06, 0.2));
  for (const [y, count, geometry, offset] of [[8, 6, slit, 0], [18, 6, slit, 0.5], [30, 8, slit, 0], [37, 10, window, 0.3]]) {
    for (let i = 0; i < count; i++) {
      tower.add(placeOnCircle(mesh(geometry, M.opening), ((i + offset) / count) * Math.PI * 2, radiusAt(y) + 0.06, y));
    }
  }

  // Walls of the colony running down to the Golden Horn and the Bosphorus.
  const reach = detail ? 46 : 22;
  for (const angle of [Math.PI * 0.78, Math.PI * 0.22]) {
    const dx = Math.cos(angle);
    const dz = Math.sin(angle);
    const wall = new THREE.Group();
    wall.add(box(reach, 12, 3.5, M.stone, reach / 2 + BASE_RADIUS - 1, 0, 0));
    wall.add(mesh(crenellationGeometry(reach), M.stone, reach / 2 + BASE_RADIUS - 1, 12, 1.4));
    if (detail) wall.add(box(8, 16, 8, M.stone, reach + BASE_RADIUS, 0, 0));
    wall.rotation.y = Math.atan2(-dz, dx);
    tower.add(wall);
  }

  if (detail) {
    tower.add(cylinder(50, 54, 4, M.grass, 0, -4, 0, 40));
    tower.add(cylinder(14, 14, 0.2, M.paving, 0, 0, 0, 32));
    for (const [x, z, rot] of [[-26, -16, 0.2], [24, -20, -0.3], [-30, 6, 1.5], [30, 4, 1.7], [0, -30, 0]]) {
      const house = createHouse({ w: 10, d: 8, h: 11, color: 0xe9c79a, roof: 'gable' });
      house.position.set(x, 0, z);
      house.rotation.y = rot;
      tower.add(house);
    }
  }

  finalizeModel(tower);
  const banner = flag('genoa', { width: 4, height: 2.6, pole: 7 });
  banner.position.y = SHAFT + 19.6;
  tower.add(banner);
  return tower;
}

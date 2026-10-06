import * as THREE from 'three';
import { materials as M } from './lib/materials.js';
import {
  archGeometry, box, colonnade, cylinder, cypress, dome, faceToward, mesh, placeOnCircle, windowRow,
} from './lib/primitives.js';
import { finalizeModel } from './lib/merge.js';

/**
 * Hagia Sophia (532–537) as Justinian left it: no minarets, a shallow lead
 * dome on a ring of 40 windows, half-domes east and west, the great
 * buttresses north and south, the narthexes and the colonnaded atrium.
 * Apse faces +x (east). Origin = centre of the nave at ground level.
 */
export function createHagiaSophia({ lod = 'detail' } = {}) {
  const detail = lod === 'detail';
  const church = new THREE.Group();

  // Nave block (aisles + galleries) and the central tower carrying the dome.
  church.add(box(62, 28, 72, M.plaster, 0, 0, 0));
  church.add(box(62.8, 0.7, 72.8, M.lead, 0, 28, 0));
  church.add(box(34, 12, 37, M.plaster, 0, 28, 0));

  // The four great buttress piers on the north and south flanks.
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      church.add(box(9, 38, 9, M.plaster, sx * 14, 0, sz * 38));
      church.add(box(9.6, 0.6, 9.6, M.lead, sx * 14, 38, sz * 38));
    }
  }

  // Drum with 40 windows separated by small buttresses, and the shallow dome.
  church.add(cylinder(16.6, 16.6, 4, M.plaster, 0, 40, 0, 40));
  church.add(dome(16.5, M.lead, 0, 44, 0, { heightScale: 0.52, segments: 40 }));
  const drumWindow = archGeometry(1.5, 2.8);
  for (let i = 0; i < 40; i++) {
    const angle = (i / 40) * Math.PI * 2;
    church.add(placeOnCircle(box(1.1, 4.4, 1.8, M.plaster), angle, 16.9, 40));
    if (detail) church.add(placeOnCircle(mesh(drumWindow, M.opening), angle + Math.PI / 40, 16.63, 40.6));
  }

  // Cross on the summit.
  church.add(box(0.5, 4.2, 0.5, M.gold, 0, 52.4, 0));
  church.add(box(2.4, 0.5, 0.5, M.gold, 0, 55, 0));

  // Great half-domes east and west, each flanked by two smaller exedrae.
  for (const sx of [-1, 1]) {
    church.add(faceToward(dome(15.5, M.lead, sx * 17, 28, 0, { heightScale: 0.86, phiLength: Math.PI, segments: 28 }), sx, 0));
    for (const sz of [-1, 1]) {
      church.add(faceToward(dome(7, M.lead, sx * 25, 26, sz * 10, { heightScale: 0.9, phiLength: Math.PI, segments: 16 }), sx, sz));
    }
  }

  // Eastern apse with its own semi-dome.
  church.add(faceToward(cylinder(7.5, 7.5, 22, M.plaster, 31, 0, 0, 20, { thetaStart: -Math.PI / 2, thetaLength: Math.PI }), 1, 0));
  church.add(faceToward(dome(7.5, M.lead, 31, 22, 0, { heightScale: 0.8, phiLength: Math.PI, segments: 16 }), 1, 0));

  // Inner and outer narthex on the west front.
  church.add(box(10, 22, 66, M.plaster, -36, 0, 0));
  church.add(box(10.8, 0.6, 66.8, M.lead, -36, 22, 0));
  church.add(box(7, 14, 66, M.plaster, -44.5, 0, 0));
  church.add(box(7.8, 0.6, 66.8, M.lead, -44.5, 14, 0));

  // Skeuophylakion: the round treasury north-east of the church.
  church.add(cylinder(6, 6, 9, M.plaster, 36, 0, -46, 20));
  church.add(dome(6, M.lead, 36, 9, -46, { heightScale: 0.55 }));

  if (detail) {
    addWindows(church);
    addAtrium(church);
    church.add(box(150, 1, 116, M.paving, -25, -1, 0));
    for (const [x, z] of [[40, 30], [44, 18], [42, -26], [-20, 50], [-6, 50], [8, -52], [20, -52], [-60, 44], [-74, -44]]) {
      church.add(cypress(13, x, 0, z));
    }
  } else {
    church.add(box(100, 0.4, 90, M.paving, -10, -0.4, 0));
  }

  return finalizeModel(church);
}

function addWindows(church) {
  // Tympanum walls under the dome arches (north and south faces).
  for (const side of [-1, 1]) {
    const upper = windowRow({ count: 7, spacing: 4, width: 2.2, height: 4.5, y: 30.5 });
    const lower = windowRow({ count: 5, spacing: 5, width: 1.6, height: 2.8, y: 36.2 });
    for (const row of [upper, lower]) {
      row.position.z = side * 18.55;
      row.rotation.y = side > 0 ? 0 : Math.PI;
      church.add(row);
    }
    // Gallery and aisle windows along the long flanks, between the buttresses.
    for (const y of [5, 16]) {
      const row = windowRow({ count: 15, spacing: 3.8, width: 1.9, height: 3.8, y, skip: (x) => Math.abs(Math.abs(x) - 14) < 5.5 });
      row.position.z = side * 36.05;
      row.rotation.y = side > 0 ? 0 : Math.PI;
      church.add(row);
    }
  }
  // West doors of the outer narthex and windows above.
  const doors = windowRow({ count: 5, spacing: 9, width: 3, height: 6.5, y: 0 });
  const west = windowRow({ count: 9, spacing: 6.5, width: 2, height: 3.6, y: 16 });
  for (const [row, x] of [[doors, -48.05], [west, -41.05]]) {
    row.position.x = x;
    row.rotation.y = -Math.PI / 2;
    church.add(row);
  }
  // Apse windows.
  for (const angle of [-0.5, 0, 0.5]) {
    const window = mesh(archGeometry(1.8, 4.5), M.opening);
    placeOnCircle(window, angle, 7.55, 9, 31, 0);
    church.add(window);
  }
}

/** Justinian's colonnaded forecourt with its phiale (ablution fountain). */
function addAtrium(church) {
  const west = -96;
  const east = -48;
  const depth = east - west;
  for (const side of [-1, 1]) {
    church.add(box(depth, 9, 1.5, M.plaster, (west + east) / 2, 0, side * 33));
    church.add(box(depth, 0.5, 8.5, M.lead, (west + east) / 2, 8.5, side * 29.5));
    const columns = colonnade({ length: depth - 4, count: 11, height: 8.5, radius: 0.45 });
    columns.position.set((west + east) / 2, 0, side * 25.8);
    church.add(columns);
  }
  church.add(box(1.5, 9, 67.5, M.plaster, west, 0, 0));
  church.add(box(8.5, 0.5, 58, M.lead, west + 3.5, 8.5, 0));
  const westColumns = colonnade({ length: 50, count: 12, height: 8.5, radius: 0.45 });
  westColumns.rotation.y = Math.PI / 2;
  westColumns.position.x = west + 7.5;
  church.add(westColumns);
  // Phiale fountain.
  church.add(cylinder(3.2, 3.4, 1, M.marble, -72, 0, 0, 20));
  const basin = cylinder(2.7, 2.7, 0.2, M.water, -72, 0.85, 0, 20);
  church.add(basin);
  church.add(cylinder(0.3, 0.3, 3, M.marble, -72, 1, 0, 8));
  church.add(cylinder(0.9, 0.2, 0.6, M.marble, -72, 3.6, 0, 10));
}

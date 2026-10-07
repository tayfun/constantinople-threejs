import * as THREE from 'three';
import { materials as M } from './lib/materials.js';
import {
  archGeometry, box, colonnade, cylinder, cypress, dome, faceToward, mesh, placeOnCircle, windowRow,
} from './lib/primitives.js';
import { finalizeModel } from './lib/merge.js';

/**
 * Hagia Sophia (532–537) as Justinian left it: no minarets, a shallow lead
 * dome on a ring of 40 windows, half-domes east and west flanked by their
 * exedrae, the great north and south arches with their tympana of windows,
 * the four buttress arms that carry the piers' thrust out to the aisle
 * walls, the three-sided apse, the double narthex with its ramp towers and
 * the colonnaded atrium. Brick walls with rosy mortar on a stone plinth,
 * marble cornices, lead roofs. The nave square is 31 m; the dome crown
 * stands 55 m up. Apse faces +x (east). Origin = centre of the nave at
 * ground level.
 */
export function createHagiaSophia({ lod = 'detail' } = {}) {
  const detail = lod === 'detail';
  const church = new THREE.Group();

  // Nave block (aisles + galleries): brick on a stone plinth, a marble cornice under the lead roof,
  // and the tympanum block that fills the great arches up to the dome base.
  church.add(box(62, 28, 72, M.brick, 0, 0, 0));
  church.add(box(63, 2.6, 73, M.stone, 0, 0, 0));
  church.add(box(63, 1, 73, M.marble, 0, 27.6, 0));
  church.add(box(62.8, 0.7, 72.8, M.lead, 0, 28.6, 0));
  church.add(box(34, 12, 37, M.brick, 0, 28, 0));

  // The great north and south arches: brick bands springing from the main piers, their crowns at the dome base.
  for (const sz of [-1, 1]) church.add(archBand(15.6, 17.4, 3, M.brick, 0, 24, sz * 18.5));

  // The four buttress arms: from each main pier of the nave square, a massive wall runs out over the
  // galleries to the aisle wall, stepping down as it goes, and carries the thrust of the arches.
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      church.add(box(8, 37, 11, M.brick, sx * 15.5, 0, sz * 21.5));
      church.add(box(8.6, 0.6, 11.6, M.lead, sx * 15.5, 37, sz * 21.5));
      church.add(box(8, 33, 11, M.brick, sx * 15.5, 0, sz * 32));
      church.add(box(8.6, 0.6, 11.6, M.lead, sx * 15.5, 33, sz * 32));
      church.add(box(8.6, 1, 11.6, M.marble, sx * 15.5, 32.2, sz * 32));
    }
  }

  // Drum with 40 windows separated by small buttresses, and the shallow dome.
  church.add(cylinder(16.6, 16.6, 4, M.brick, 0, 40, 0, 40));
  church.add(dome(16.5, M.lead, 0, 44, 0, { heightScale: 0.52, segments: 40 }));
  const drumWindow = archGeometry(1.5, 2.8);
  for (let i = 0; i < 40; i++) {
    const angle = (i / 40) * Math.PI * 2;
    church.add(placeOnCircle(box(1.1, 4.4, 1.8, M.brick), angle, 16.9, 40));
    church.add(placeOnCircle(mesh(drumWindow, M.opening), angle + Math.PI / 40, 16.63, 40.6));
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

  // Eastern apse: three-sided outside, as it still is, under its own semi-dome.
  church.add(faceToward(cylinder(7.5, 7.5, 22, M.brick, 31, 0, 0, 3, { thetaStart: -Math.PI / 2, thetaLength: Math.PI }), 1, 0));
  church.add(faceToward(cylinder(7.6, 7.6, 1, M.marble, 31, 21.3, 0, 3, { thetaStart: -Math.PI / 2, thetaLength: Math.PI }), 1, 0));
  church.add(faceToward(dome(7.5, M.lead, 31, 22.3, 0, { heightScale: 0.8, phiLength: Math.PI, segments: 16 }), 1, 0));

  // Inner and outer narthex on the west front, and the ramp towers at their northern and southern ends.
  church.add(box(10, 22, 66, M.brick, -36, 0, 0));
  church.add(box(11, 1, 67, M.marble, -36, 21.6, 0));
  church.add(box(10.8, 0.6, 66.8, M.lead, -36, 22.6, 0));
  church.add(box(7, 14, 66, M.brick, -44.5, 0, 0));
  church.add(box(8, 1, 67, M.marble, -44.5, 13.6, 0));
  church.add(box(7.8, 0.6, 66.8, M.lead, -44.5, 14.6, 0));
  church.add(box(50, 2.6, 67, M.stone, -37, 0, 0));
  for (const sz of [-1, 1]) {
    church.add(box(9, 24, 8, M.brick, -36, 0, sz * 37));
    church.add(box(9.4, 0.6, 8.4, M.lead, -36, 24, sz * 37));
  }

  // Skeuophylakion: the round treasury north-east of the church.
  church.add(cylinder(6, 6, 9, M.brick, 36, 0, -46, 20));
  church.add(dome(6, M.lead, 36, 9, -46, { heightScale: 0.55 }));

  // Windows and the atrium belong to both builds: the map draws the church seven times life size,
  // so they read there too. Only the paving sheet and the trees are diorama dressing.
  addWindows(church);
  addAtrium(church);
  if (detail) {
    church.add(box(150, 1, 116, M.paving, -25, -1, 0));
    for (const [x, z] of [[40, 30], [44, 18], [42, -26], [-20, 50], [-6, 50], [8, -52], [20, -52], [-60, 44], [-74, -44]]) {
      church.add(cypress(13, x, 0, z));
    }
  } else {
    church.add(box(100, 0.4, 90, M.paving, -10, -0.4, 0));
  }

  return finalizeModel(church);
}

/** A semicircular band of masonry: an arch seen on a façade, standing in the plane z = constant. */
function archBand(inner, outer, depth, material, x, y, z) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outer, 0, Math.PI, false);
  shape.lineTo(-inner, 0);
  shape.absarc(0, 0, inner, Math.PI, 0, true);
  shape.lineTo(outer, 0);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 24 });
  geometry.translate(0, 0, -depth / 2);
  return mesh(geometry, material, x, y, z);
}

function addWindows(church) {
  // Tympanum walls under the dome arches (north and south faces).
  for (const side of [-1, 1]) {
    const upper = windowRow({ count: 7, spacing: 3.6, width: 2.1, height: 4.5, y: 30.5 });
    const lower = windowRow({ count: 3, spacing: 4.6, width: 1.6, height: 2.8, y: 36 });
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
  // Apse windows, one in each of the three faces (the faces of a 3-sided half-cylinder lie 6.5 m out).
  for (const angle of [-Math.PI / 3, 0, Math.PI / 3]) {
    const window = mesh(archGeometry(1.8, 4.5), M.opening);
    placeOnCircle(window, angle, 6.55, 9, 31, 0);
    church.add(window);
  }
}

/** Justinian's colonnaded forecourt with its phiale (ablution fountain). */
function addAtrium(church) {
  const west = -96;
  const east = -48;
  const depth = east - west;
  for (const side of [-1, 1]) {
    church.add(box(depth, 9, 1.5, M.brick, (west + east) / 2, 0, side * 33));
    church.add(box(depth, 0.5, 8.5, M.lead, (west + east) / 2, 8.5, side * 29.5));
    const columns = colonnade({ length: depth - 4, count: 11, height: 8.5, radius: 0.45 });
    columns.position.set((west + east) / 2, 0, side * 25.8);
    church.add(columns);
  }
  church.add(box(1.5, 9, 67.5, M.brick, west, 0, 0));
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

import * as THREE from 'three';
import { materials as M, tinted } from './lib/materials.js';
import {
  archedWallGeometry, box, boxGeometry, colonnade, cylinderGeometry, gableRoof, groundPlane, mesh,
} from './lib/primitives.js';
import { finalizeModel } from './lib/merge.js';
import { createRandom } from '../util/random.js';

/**
 * The Basilica Cistern (532), shown as a cut-away: 336 columns in 12 rows of
 * 28 holding up brick arches, the water below, and part of the Stoa
 * Basilica that stood above it. The roof is removed over the eastern half so
 * the forest of columns is visible. Ground level is y = 2.6.
 */

const LENGTH = 138;
const WIDTH = 65;
const FLOOR = -10;
const COLUMN_HEIGHT = 9;
const GROUND = 2.6;
const CUT_X = -12; // the roof survives west of this line

export function createBasilicaCistern({ lod = 'detail' } = {}) {
  const detail = lod === 'detail';
  const cistern = new THREE.Group();
  const columnsAlong = detail ? 28 : 14;
  const columnsAcross = detail ? 12 : 6;
  const stepX = LENGTH / columnsAlong;
  const stepZ = WIDTH / columnsAcross;
  const columnX = (i) => -LENGTH / 2 + stepX * (i + 0.5);
  const columnZ = (j) => -WIDTH / 2 + stepZ * (j + 0.5);

  // Floor, water and the thick brick enclosure.
  cistern.add(box(LENGTH, 0.5, WIDTH, M.stone, 0, FLOOR - 0.5, 0));
  cistern.add(groundPlane(LENGTH, WIDTH, M.water, 0, FLOOR + 0.9, 0));
  const wallHeight = GROUND - FLOOR;
  for (const side of [-1, 1]) {
    cistern.add(box(LENGTH + 8, wallHeight, 4, M.brick, 0, FLOOR, side * (WIDTH / 2 + 2)));
    cistern.add(box(4, wallHeight, WIDTH, M.brick, side * (LENGTH / 2 + 2), FLOOR, 0));
  }

  // Earth around the cistern, cut to show the section.
  if (detail) {
    const frame = 16;
    for (const side of [-1, 1]) {
      cistern.add(box(LENGTH + 8 + frame * 2, wallHeight, frame, M.dirt, 0, FLOOR, side * (WIDTH / 2 + 4 + frame / 2)));
      cistern.add(box(frame, wallHeight, WIDTH + 8, M.dirt, side * (LENGTH / 2 + 4 + frame / 2), FLOOR, 0));
      cistern.add(groundPlane(LENGTH + 8 + frame * 2, frame, M.paving, 0, GROUND + 0.02, side * (WIDTH / 2 + 4 + frame / 2)));
      cistern.add(groundPlane(frame, WIDTH + 8, M.paving, side * (LENGTH / 2 + 4 + frame / 2), GROUND + 0.02, 0));
    }
  }

  // Brick arches springing from the capitals. They run on a little past the
  // roof's edge and then stop raggedly, as if broken away, to show the columns.
  const rnd = createRandom(532);
  const pier = 1.1;
  const archHeight = GROUND - 0.6 - (FLOOR + COLUMN_HEIGHT);
  const bay = (span) => archedWallGeometry({
    length: span,
    height: archHeight,
    thickness: 0.9,
    openings: [{ x: 0, width: span - pier, bottom: 0, spring: 0.2 }],
  });
  const alongBay = bay(stepX);
  const acrossBay = bay(stepZ);
  const archesReach = (x) => x < CUT_X + 10 + rnd.range(-8, 8);
  for (let j = 0; j < columnsAcross; j++) {
    for (let i = 0; i < columnsAlong - 1; i++) {
      const x = columnX(i) + stepX / 2;
      if (archesReach(x)) cistern.add(mesh(alongBay, M.brick, x, FLOOR + COLUMN_HEIGHT, columnZ(j)));
    }
  }
  for (let i = 0; i < columnsAlong; i++) {
    for (let j = 0; j < columnsAcross - 1; j++) {
      if (!archesReach(columnX(i))) continue;
      const arch = mesh(acrossBay, M.brick, columnX(i), FLOOR + COLUMN_HEIGHT, columnZ(j) + stepZ / 2);
      arch.rotation.y = Math.PI / 2;
      cistern.add(arch);
    }
  }

  // The surviving roof over the western part, and the Stoa Basilica above it.
  const roofLength = CUT_X + LENGTH / 2 + 4;
  cistern.add(box(roofLength, 0.6, WIDTH + 8, M.brick, -LENGTH / 2 - 4 + roofLength / 2, GROUND - 0.6, 0));
  cistern.add(groundPlane(roofLength, WIDTH + 8, M.paving, -LENGTH / 2 - 4 + roofLength / 2, GROUND + 0.02, 0));
  addStoa(cistern, detail);

  finalizeModel(cistern);
  addColumns(cistern, { columnsAlong, columnsAcross, columnX, columnZ, detail });
  if (detail) addLamps(cistern, columnX, columnZ);
  return cistern;
}

/** 336 recycled marble columns as instanced meshes (base, shaft, capital). */
function addColumns(cistern, { columnsAlong, columnsAcross, columnX, columnZ, detail }) {
  const parts = [
    { geometry: boxGeometry(1.2, 0.5, 1.2), y: 0 },
    { geometry: cylinderGeometry(0.4, 0.46, COLUMN_HEIGHT - 1.3, 10), y: 0.5 },
    { geometry: cylinderGeometry(0.75, 0.42, 0.8, 10), y: COLUMN_HEIGHT - 0.8 },
  ];
  const henEye = detail ? { i: 20, j: 7 } : null; // the "Hen's Eye" column with its teardrop carving
  const count = columnsAlong * columnsAcross;
  const matrix = new THREE.Matrix4();
  for (const { geometry, y } of parts) {
    const columns = new THREE.InstancedMesh(geometry, M.marble, count);
    let n = 0;
    for (let i = 0; i < columnsAlong; i++) {
      for (let j = 0; j < columnsAcross; j++) {
        const hidden = henEye && i === henEye.i && j === henEye.j;
        matrix.makeTranslation(columnX(i), FLOOR + y, columnZ(j));
        if (hidden) matrix.scale(new THREE.Vector3(0, 0, 0));
        columns.setMatrixAt(n++, matrix);
      }
    }
    columns.castShadow = columns.receiveShadow = true;
    cistern.add(columns);
    if (henEye) cistern.add(mesh(geometry, tinted('marble', 0x9fb2a0), columnX(henEye.i), FLOOR + y, columnZ(henEye.j)));
  }

  // The two Medusa heads reused as column bases in the north-west corner.
  if (detail) {
    [[0, 0, Math.PI / 2], [1, 0, Math.PI]].forEach(([i, j, roll]) => {
      const head = createMedusaHead();
      head.position.set(columnX(i) + 1.2, FLOOR + 0.9, columnZ(j));
      head.rotation.x = roll;
      cistern.add(head);
    });
  }
}

function createMedusaHead() {
  const head = new THREE.Group();
  head.add(box(1.8, 1.8, 1.8, M.stoneDark, 0, -0.9, 0));
  const face = mesh(new THREE.SphereGeometry(0.8, 16, 12), M.marble, 0.75, 0, 0);
  face.scale.set(0.6, 1, 0.9);
  head.add(face);
  const snake = new THREE.TorusGeometry(0.16, 0.06, 6, 10);
  for (let k = 0; k < 9; k++) {
    const angle = (k / 9) * Math.PI * 2;
    const curl = mesh(snake, M.marble, 0.95, Math.cos(angle) * 0.75, Math.sin(angle) * 0.68);
    curl.rotation.y = Math.PI / 2;
    head.add(curl);
  }
  return head;
}

/** Part of the Stoa Basilica, the colonnaded law-court square above the cistern. */
function addStoa(cistern, detail) {
  const west = -LENGTH / 2 - 4;
  cistern.add(box(14, 13, 56, M.stone, west + 10, GROUND, 0));
  const roof = gableRoof(56, 14, 4.5, M.roof, west + 10, GROUND + 13, 0);
  roof.rotation.y = Math.PI / 2;
  cistern.add(roof);
  if (!detail) return;
  for (const side of [-1, 1]) {
    const length = CUT_X - west - 22;
    const columns = colonnade({ length, count: 9, height: 7, radius: 0.4 });
    columns.position.set(west + 18 + length / 2, GROUND, side * 26);
    cistern.add(columns);
    cistern.add(box(length + 2, 0.5, 6, M.roof, west + 18 + length / 2, GROUND + 7, side * 28.5));
    cistern.add(box(length + 2, 7, 1, M.stone, west + 18 + length / 2, GROUND, side * 31.5));
  }
}

/** A few oil lamps hanging among the columns. */
function addLamps(cistern, columnX, columnZ) {
  const glow = new THREE.SphereGeometry(0.3, 8, 6);
  for (const [i, j] of [[14, 3], [17, 8], [21, 5], [24, 2], [26, 9]]) {
    cistern.add(mesh(glow, M.fire, columnX(i) + stepOffset(i), FLOOR + 5, columnZ(j)));
  }
}

const stepOffset = (i) => (i % 2 ? 1.6 : -1.6);

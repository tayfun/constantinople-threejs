import * as THREE from 'three';
import { materials as M, tinted } from './lib/materials.js';
import {
  archedWallGeometry, archGeometry, box, boxGeometry, cylinder, cylinderGeometry, cypress, dome, gableRoof,
  groundPlane, hipRoof, mesh, placeOnCircle,
} from './lib/primitives.js';
import { finalizeModel } from './lib/merge.js';
import { labelAt } from './lib/parts.js';
import { createRandom } from '../util/random.js';

/**
 * The Basilica Cistern (Yerebatan, 532–542): 138 × 65 m, 336 reused marble
 * and granite columns 9 m tall in 12 rows of 28, carrying brick cross-vaults
 * under 4 m thick firebrick walls. The two Medusa heads lie under the
 * columns of the north-west corner (-x, -z); the "Hen's Eye" column with
 * its teardrop carvings stands near the middle. Above it lay the Stoa
 * Basilica, the colonnaded law-court square with its library and the
 * Octagon law school, beside the Milion and Hagia Sophia at +x.
 *
 * Shown as a cut-away: the vaults and the square survive east of x = 0, the
 * western half is opened to show the forest of columns standing in the
 * water. Ground level is y = 2.6; the cistern floor is y = -10.
 *
 * The map build is the same model simplified: the full grid of columns and
 * the Medusa blocks, the arches and vault caps at the cut, the stoas,
 * library and Octagon above, in the same materials; but six-sided shafts,
 * coarser arches, no arches hidden under the surviving roof, and none of
 * the small carving, windows, lamps, trees or the earth round about.
 */

const LENGTH = 138;
const WIDTH = 65;
const FLOOR = -10;
const COLUMN_HEIGHT = 9;
const GROUND = 2.6;
const CUT_X = 0; // the roof and the square above survive east of this line
const FRAME = 16; // earth shown around the cistern
/** Height of a pavement or lawn above the slab under it: centimetres in the diorama, more on the map, whose far camera cannot tell them apart. */
const lift = (dy, detail) => (detail ? dy : dy * 12);

export function createBasilicaCistern({ lod = 'detail' } = {}) {
  const detail = lod === 'detail';
  const cistern = new THREE.Group();
  const columnsAlong = 28;
  const columnsAcross = 12;
  const stepX = LENGTH / columnsAlong;
  const stepZ = WIDTH / columnsAcross;
  const columnX = (i) => -LENGTH / 2 + stepX * (i + 0.5);
  const columnZ = (j) => -WIDTH / 2 + stepZ * (j + 0.5);

  // Floor, water and the thick brick enclosure, its inside rendered with pink hydraulic mortar.
  cistern.add(box(LENGTH, 0.5, WIDTH, M.stone, 0, FLOOR - 0.5, 0));
  cistern.add(groundPlane(LENGTH, WIDTH, M.water, 0, FLOOR + 0.7, 0));
  const wallHeight = GROUND - FLOOR;
  const mortar = tinted('plaster', 0xd9a98f);
  for (const side of [-1, 1]) {
    cistern.add(box(LENGTH + 8, wallHeight, 4, M.brick, 0, FLOOR, side * (WIDTH / 2 + 2)));
    cistern.add(box(4, wallHeight, WIDTH, M.brick, side * (LENGTH / 2 + 2), FLOOR, 0));
    cistern.add(box(LENGTH, wallHeight - 0.6, 0.15, mortar, 0, FLOOR, side * (WIDTH / 2 - 0.05)));
    cistern.add(box(0.15, wallHeight - 0.6, WIDTH, mortar, side * (LENGTH / 2 - 0.05), FLOOR, 0));
  }

  // Earth around the cistern, cut to show the section; the streets above are paved.
  if (detail) {
    for (const side of [-1, 1]) {
      cistern.add(box(LENGTH + 8 + FRAME * 2, wallHeight, FRAME, M.dirt, 0, FLOOR, side * (WIDTH / 2 + 4 + FRAME / 2)));
      cistern.add(box(FRAME, wallHeight, WIDTH + 8, M.dirt, side * (LENGTH / 2 + 4 + FRAME / 2), FLOOR, 0));
      cistern.add(groundPlane(LENGTH + 8 + FRAME * 2, FRAME, M.paving, 0, GROUND + 0.02, side * (WIDTH / 2 + 4 + FRAME / 2)));
      cistern.add(groundPlane(FRAME, WIDTH + 8, M.paving, side * (LENGTH / 2 + 4 + FRAME / 2), GROUND + 0.02, 0));
    }
  }

  addVaults(cistern, { columnsAlong, columnsAcross, stepX, stepZ, columnX, columnZ, detail });

  // The surviving roof over the eastern part, and the Basilica square above it.
  const roofLength = LENGTH / 2 + 4 - CUT_X;
  cistern.add(box(roofLength, 0.6, WIDTH + 8, M.brick, CUT_X + roofLength / 2, GROUND - 0.6, 0));
  cistern.add(groundPlane(roofLength, WIDTH + 8, M.paving, CUT_X + roofLength / 2, GROUND + lift(0.02, detail), 0));
  addStoa(cistern, detail);
  addColumns(cistern, { columnsAlong, columnsAcross, columnX, columnZ, detail });
  if (detail) addLamps(cistern, columnX, columnZ);
  labelAt(cistern, 'medusaHeads', (columnX(0) + columnX(1)) / 2, FLOOR + MEDUSA_SIZE + 0.5, columnZ(0));
  labelAt(cistern, 'hensEye', columnX(10), FLOOR + COLUMN_HEIGHT - 2, columnZ(5));

  finalizeModel(cistern); // merges everything but the instanced columns
  return cistern;
}

/**
 * Brick arches springing from the imposts in both directions, with the
 * shallow brick caps of the cross-vaults between them. They run on a little
 * past the roof's edge and then stop raggedly, as if broken away.
 */
function addVaults(cistern, { columnsAlong, columnsAcross, stepX, stepZ, columnX, columnZ, detail }) {
  const rnd = createRandom(532);
  const pier = 1.3;
  const springing = FLOOR + COLUMN_HEIGHT;
  const archHeight = GROUND - 0.6 - springing;
  const bay = (span) => archedWallGeometry({
    length: span,
    height: archHeight,
    thickness: 1,
    openings: [{ x: 0, width: span - pier, bottom: 0, spring: 0.3 }],
    curveSegments: detail ? 10 : 5,
  });
  const alongBay = bay(stepX);
  const acrossBay = bay(stepZ);
  const reach = Array.from({ length: columnsAcross }, () => CUT_X - 2 - rnd.range(0, 9));
  const archesReach = (x, j) => x > reach[j];
  // Arches under the surviving roof are hidden inside the walls; the map builds only those at the cut.
  const shown = (x) => detail || x < CUT_X + stepX;
  for (let j = 0; j < columnsAcross; j++) {
    for (let i = 0; i < columnsAlong - 1; i++) {
      const x = columnX(i) + stepX / 2;
      if (archesReach(x, j) && shown(x)) cistern.add(mesh(alongBay, M.brick, x, springing, columnZ(j)));
    }
  }
  for (let i = 0; i < columnsAlong; i++) {
    if (!shown(columnX(i))) continue;
    for (let j = 0; j < columnsAcross - 1; j++) {
      if (!archesReach(columnX(i), j) || !archesReach(columnX(i), j + 1)) continue;
      const arch = mesh(acrossBay, M.brick, columnX(i), springing, columnZ(j) + stepZ / 2);
      arch.rotation.y = Math.PI / 2;
      cistern.add(arch);
    }
  }
  // Vault caps over the bays just outside the roof, where the section cuts through them.
  const cap = dome(1, M.brick, 0, 0, 0, { heightScale: 1, segments: detail ? 8 : 6 }).geometry.clone().scale(stepX / 2 - 0.3, 1.1, stepZ / 2 - 0.3);
  for (let i = 0; i < columnsAlong - 1; i++) {
    const x = columnX(i) + stepX / 2;
    if (x > CUT_X + 4) break;
    for (let j = 0; j < columnsAcross - 1; j++) {
      if (!archesReach(x, j) || !archesReach(x, j + 1) || !archesReach(columnX(i), j) || !archesReach(columnX(i + 1), j)) continue;
      cistern.add(mesh(cap, M.brick, x, springing + 0.6, columnZ(j) + stepZ / 2));
    }
  }
  // Outside the vaults, the two outer rows of arches die into the walls.
  const wallArch = bay(stepZ);
  for (let i = 0; i < columnsAlong; i++) {
    if (!archesReach(columnX(i), 0) || !shown(columnX(i))) continue;
    for (const side of [-1, 1]) {
      const arch = mesh(wallArch, M.brick, columnX(i), springing, side * (WIDTH / 2 - stepZ / 4));
      arch.rotation.y = Math.PI / 2;
      arch.scale.z = 0.5;
      cistern.add(arch);
    }
  }
}

/** 336 reused columns as instanced meshes: plinth, shaft, capital and impost block, in assorted marbles. */
function addColumns(cistern, { columnsAlong, columnsAcross, columnX, columnZ, detail }) {
  const sides = detail ? 12 : 6;
  const parts = [
    { geometry: cylinderGeometry(0.42, 0.48, COLUMN_HEIGHT - 1.9, sides), y: 0.5 },
    { geometry: cylinderGeometry(0.72, 0.44, 0.9, sides), y: COLUMN_HEIGHT - 1.4 },
    { geometry: boxGeometry(1.3, 0.5, 1.3), y: COLUMN_HEIGHT - 0.5 }, // impost block
  ];
  // The plinths stand under the water; the map leaves them out.
  if (detail) parts.unshift({ geometry: boxGeometry(1.3, 0.5, 1.3), y: 0 });
  const plinth = detail ? 0 : -1;
  const henEye = detail ? { i: 10, j: 5 } : null; // the "Hen's Eye" column with its teardrop carving
  const medusa = [[0, 0], [1, 0]]; // columns standing on the Medusa heads
  const count = columnsAlong * columnsAcross;
  const matrix = new THREE.Matrix4();
  const rnd = createRandom(336);
  const shades = [0xffffff, 0xf2efe8, 0xdcd8d0, 0xcfc7bd, 0xe8d7cc, 0xb9b3ad, 0xd8c9b8, 0xc9b9b0];
  const colours = Array.from({ length: count }, () => new THREE.Color(rnd.pick(shades)));
  for (const [index, { geometry, y }] of parts.entries()) {
    const columns = new THREE.InstancedMesh(geometry, M.marble, count);
    let n = 0;
    for (let i = 0; i < columnsAlong; i++) {
      for (let j = 0; j < columnsAcross; j++) {
        const isHenEye = henEye && i === henEye.i && j === henEye.j;
        const onMedusa = medusa.some(([mi, mj]) => mi === i && mj === j);
        matrix.makeTranslation(columnX(i), FLOOR + y + (onMedusa && index > plinth ? MEDUSA_SIZE : 0), columnZ(j));
        if (isHenEye || (onMedusa && index === plinth)) matrix.scale(new THREE.Vector3(0, 0, 0));
        columns.setMatrixAt(n, matrix);
        columns.setColorAt(n, index === plinth + 1 ? colours[n] : colours[n].clone().lerp(new THREE.Color(0xffffff), 0.6));
        n++;
      }
    }
    columns.castShadow = columns.receiveShadow = true;
    cistern.add(columns);
    if (henEye) cistern.add(mesh(geometry, tinted('marble', 0xa8b7a6), columnX(henEye.i), FLOOR + y, columnZ(henEye.j)));
  }

  if (detail) {
    // The teardrops and hen's eyes carved on that one shaft.
    const tear = new THREE.SphereGeometry(0.11, 6, 5).scale(1, 1.8, 0.6);
    for (let k = 0; k < 30; k++) {
      const angle = (k / 30) * Math.PI * 2 * 3.7;
      const y = FLOOR + 1.2 + (k / 30) * (COLUMN_HEIGHT - 3.5);
      cistern.add(placeOnCircle(mesh(tear, tinted('marble', 0xa8b7a6)), angle, 0.45, y, columnX(henEye.i), columnZ(henEye.j)));
    }
  }

  // The two Medusa heads reused as column bases in the north-west corner: one on its side, one upside
  // down, their faces turned east into the open hall, as the visitor sees them from the walkway today.
  [[0, 0, Math.PI / 2], [1, 0, Math.PI]].forEach(([i, j, roll]) => {
    const head = createMedusaHead(detail);
    head.position.set(columnX(i), FLOOR + MEDUSA_SIZE / 2, columnZ(j));
    head.rotation.x = roll;
    cistern.add(head);
  });
}

/** Size of each Medusa block: the originals are about 1.5 m, drawn larger so they read from across the cistern. */
const MEDUSA_SIZE = 3.2;

/** A Medusa block, centred on its own middle, with the face carved on the +x side (coarser on the map). */
function createMedusaHead(detail = true) {
  const head = new THREE.Group();
  const half = MEDUSA_SIZE / 2;
  const stone = tinted('marble', 0xd9d2c4);
  const carved = tinted('marble', 0xb9b0a0);
  head.add(box(MEDUSA_SIZE, MEDUSA_SIZE, MEDUSA_SIZE, stone, 0, -half, 0));
  // The face in relief: cheeks, brow and the open mouth.
  const face = mesh(new THREE.SphereGeometry(half * 0.78, detail ? 16 : 8, detail ? 12 : 6), carved, half - 0.1, 0, 0);
  face.scale.set(0.45, 1, 0.9);
  head.add(face);
  if (detail) {
    head.add(mesh(new THREE.SphereGeometry(0.18, 8, 6), M.opening, half + 0.45, -0.35, 0));
    for (const side of [-1, 1]) {
      head.add(mesh(new THREE.SphereGeometry(0.17, 8, 6), M.opening, half + 0.5, 0.3, side * 0.42));
      head.add(box(0.2, 0.12, 0.6, carved, half + 0.5, 0.55, side * 0.42)); // brows
    }
  }
  // Snakes for hair: a ring of coils round the face, knotted under the chin.
  const coils = detail ? 13 : 7;
  const snake = new THREE.TorusGeometry(0.22, 0.08, detail ? 6 : 4, detail ? 12 : 8);
  for (let k = 0; k < coils; k++) {
    const angle = (k / coils) * Math.PI * 2;
    const curl = mesh(snake, carved, half + 0.15, Math.sin(angle) * (half * 0.82), Math.cos(angle) * (half * 0.82));
    curl.rotation.y = Math.PI / 2;
    curl.rotation.x = angle;
    head.add(curl);
  }
  return head;
}

/**
 * The Stoa Basilica above: a vast colonnaded square (138 × 65 m like the
 * cistern) with a garden, a double stoa down each long side, the Library of
 * Constantinople closing the east end and the Octagon law school beside it,
 * with Justinian's column of Solomon in the court.
 */
function addStoa(cistern, detail) {
  const east = LENGTH / 2 + 4; // edge of the cistern's roof
  const west = CUT_X + 2;
  const stoaLength = east - west;
  const stoaX = west + stoaLength / 2;

  // The garden court inside the colonnades.
  cistern.add(groundPlane(stoaLength - 14, 44, M.grass, stoaX, GROUND + lift(0.05, detail), 0));
  cistern.add(groundPlane(stoaLength - 14, 4, M.paving, stoaX, GROUND + lift(0.08, detail), 0));
  cistern.add(groundPlane(4, 44, M.paving, stoaX, GROUND + lift(0.08, detail), 0));

  labelAt(cistern, 'stoaBasilica', stoaX, GROUND + 10, -31);
  labelAt(cistern, 'library', east + 8, GROUND + 19, 0);
  labelAt(cistern, 'octagon', east + 8, GROUND + 18, -42);
  // The Library of Constantinople: a two-storeyed hall closing the square on the east, towards the Milion.
  cistern.add(box(16, 14, 60, M.stone, east + 8, GROUND, 0));
  cistern.add(box(17, 0.8, 61, M.marble, east + 8, GROUND + 7, 0));
  const roof = gableRoof(60, 16, 5, M.roof, east + 8, GROUND + 14, 0);
  roof.rotation.y = Math.PI / 2;
  cistern.add(roof);
  // The Octagon beside it.
  cistern.add(cylinder(8, 8, 10, M.brick, east + 8, GROUND, -42, 8));
  cistern.add(cylinder(6.5, 6.5, 2.5, M.brick, east + 8, GROUND + 10, -42, 16));
  cistern.add(dome(6.5, M.lead, east + 8, GROUND + 12.5, -42, { heightScale: 0.8, segments: 16 }));

  // Double stoas down the long sides: columns facing the garden, columns facing the street, a tiled roof between.
  for (const side of [-1, 1]) {
    cistern.add(gableRoof(stoaLength, 10, 3, M.roof, stoaX, GROUND + 7, side * 31));
    cistern.add(box(stoaLength, 7, 0.8, M.stone, stoaX, GROUND, side * 31)); // spine wall carrying the ridge
    for (const offset of [-5, 5]) {
      const columns = columnRow({ length: stoaLength - 4, count: 14, height: 7, radius: 0.4, detail });
      columns.position.set(stoaX, GROUND, side * 31 + offset);
      cistern.add(columns);
    }
    if (!detail) continue;
    const doors = Array.from({ length: 4 }, (_, k) => mesh(archGeometry(2, 4), M.opening, west + 10 + k * 16, GROUND, side * 31 + 0.42 * -side));
    for (const door of doors) door.rotation.y = side > 0 ? Math.PI : 0;
    cistern.add(...doors);
  }

  // The Library's windows, the column of Solomon in the court, and a pair of cypresses.
  if (detail) {
    for (const storey of [2.5, 9]) {
      for (let k = -4; k <= 4; k++) {
        const window = mesh(archGeometry(1.6, 3), M.opening, east - 0.05, GROUND + storey, k * 6);
        window.rotation.y = -Math.PI / 2;
        cistern.add(window);
      }
    }
    for (const [x, z] of [[west + 12, -14], [west + 12, 14], [east - 14, -14], [east - 14, 14]]) cistern.add(cypress(9, x, GROUND, z));
  }
  const sx = stoaX + 6;
  const round = detail ? 12 : 6;
  cistern.add(box(3, 1, 3, M.marble, sx, GROUND, 0));
  cistern.add(cylinder(0.5, 0.6, 9, M.porphyry, sx, GROUND + 1, 0, round));
  cistern.add(box(1.4, 0.5, 1.4, M.marble, sx, GROUND + 10, 0));
  cistern.add(box(0.7, 2.4, 0.5, M.bronze, sx, GROUND + 10.5, 0));
  cistern.add(mesh(new THREE.SphereGeometry(0.3, detail ? 8 : 6, detail ? 6 : 4), M.bronze, sx, GROUND + 13.1, 0));
  // Round basin in the middle of the court.
  cistern.add(cylinder(3.5, 3.7, 0.9, M.marble, stoaX - 10, GROUND, 0, round + 4));
  cistern.add(cylinder(3.1, 3.1, 0.3, M.water, stoaX - 10, GROUND + 0.7, 0, round + 4));

  // The stair-house down into the cistern, in the corner nearest the Milion.
  cistern.add(box(6, 4, 8, M.brick, east - 10, GROUND, -24));
  cistern.add(hipRoof(6, 8, 1.8, M.roof, east - 10, GROUND + 4, -24));
  cistern.add(mesh(archGeometry(1.8, 3), M.opening, east - 10, GROUND, -19.95));
}

/**
 * Row of classical columns along x (base, shaft, capital), like the shared
 * colonnade() but ten-sided in the diorama and six-sided on the map.
 */
function columnRow({ length, count, height, radius = 0.4, detail = true, material = M.marble }) {
  const sides = detail ? 10 : 6;
  const group = new THREE.Group();
  const shaft = cylinderGeometry(radius * 0.85, radius, height - radius * 1.6, sides);
  const base = boxGeometry(radius * 2.4, radius * 0.6, radius * 2.4);
  const capital = cylinderGeometry(radius * 1.6, radius * 0.9, radius, sides);
  const step = count > 1 ? length / (count - 1) : 0;
  for (let i = 0; i < count; i++) {
    const x = -length / 2 + step * i;
    group.add(mesh(base, material, x, 0, 0));
    group.add(mesh(shaft, material, x, radius * 0.6, 0));
    group.add(mesh(capital, material, x, height - radius, 0));
  }
  return group;
}

/** A few oil lamps hanging among the columns. */
function addLamps(cistern, columnX, columnZ) {
  const glow = new THREE.SphereGeometry(0.3, 8, 6);
  for (const [i, j] of [[2, 3], [5, 8], [8, 5], [11, 2], [13, 9], [4, 10], [9, 1]]) {
    cistern.add(mesh(glow, M.fire, columnX(i) + stepOffset(i), FLOOR + 5, columnZ(j)));
  }
}

const stepOffset = (i) => (i % 2 ? 1.6 : -1.6);

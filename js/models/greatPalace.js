import * as THREE from 'three';
import { materials as M, cloth } from './lib/materials.js';
import {
  archedWallGeometry, archGeometry, box, boxGeometry, cylinderGeometry, crenellationGeometry, cylinder, cypress, dome, faceToward, gableRoof,
  groundPlane, hipRoof, mesh, placeOnCircle, roundTree, stairs, windowRow, flag,
} from './lib/primitives.js';
import { createHull } from './lib/hull.js';
import { finalizeModel } from './lib/merge.js';
import { labelAt, labelled } from './lib/parts.js';

/**
 * The Great Palace: not one building but a walled agglomeration of halls,
 * churches, courts and gardens on terraces stepping down some 30 m from the
 * Augustaion and the Hippodrome to the Sea of Marmara. The Augustaion lies
 * at -z (the Chalke gate faces it), the Hippodrome at -x (the Daphne's
 * gallery runs out to the Kathisma there), the sea and the Boukoleon
 * harbour at +z, the Nea Ekklesia and the polo ground at +x.
 *
 * Upper terrace: Chalke, Scholae barracks, Hall of the Nineteen Couches,
 * Daphne with its Octagon, Magnaura, Chrysotriklinos in its garden,
 * Triconch and Sigma. Middle terrace: the mosaic peristyle and apsed hall,
 * the Pharos church, the Nea. Lower terrace: Boukoleon above its harbour,
 * the Tzykanisterion, the Pharos lighthouse on the sea wall.
 */

const UPPER = 20; // terrace levels above the sea
const MIDDLE = 11;
const LOWER = 5;
const SEA_WALL_Z = 88;

const IMPERIAL = 0x5c1f63; // Tyrian purple, worn and flown only by the emperor
const HALF = { thetaStart: -Math.PI / 2, thetaLength: Math.PI };

/**
 * The map build is the diorama simplified, not a different model: the same
 * massing, roofs, domes and colonnades in the same materials, but with
 * fewer curve segments, six-sided columns, and without the window rows,
 * small ornaments, trees, figures and the harbour water (the map supplies
 * its own ground). These two helpers carry the per-level choices.
 */
const curve = (detail, fine, coarse) => (detail ? fine : coarse);
/** Height of a pavement or lawn above the slab under it: centimetres in the diorama, more on the map, whose far camera cannot tell them apart. */
const lift = (dy, detail) => (detail ? dy : dy * 12);

export function createGreatPalace({ lod = 'detail' } = {}) {
  const detail = lod === 'detail';
  const palace = new THREE.Group();

  terrace(palace, 260, 92, UPPER, -56, detail);
  terrace(palace, 260, 60, MIDDLE, 20, detail);
  terrace(palace, 260, 38, LOWER, 69, detail);
  // Marble stairs climbing from each terrace to the one behind it (towards -z).
  for (const [x, edge, lower, upper] of [[-110, -10, MIDDLE, UPPER], [40, 50, LOWER, MIDDLE], [-20, 50, LOWER, MIDDLE]]) {
    const flight = stairs(10, 10, (upper - lower) / 10, 1.2, M.marble);
    flight.position.set(x, lower, edge + 12);
    flight.rotation.y = Math.PI;
    palace.add(flight);
  }

  addGardens(palace, detail);
  labelled(palace, 'chalke', () => addChalke(palace, detail));
  addScholae(palace, detail);
  labelled(palace, 'nineteenCouches', () => addNineteenCouches(palace, detail));
  addDaphne(palace, detail);
  labelled(palace, 'magnaura', () => addMagnaura(palace, detail));
  labelled(palace, 'chrysotriklinos', () => addChrysotriklinos(palace, detail));
  labelled(palace, 'triconch', () => addTriconch(palace, detail));
  labelled(palace, 'peristyle', () => addPeristyle(palace, detail));
  labelled(palace, 'pharosChurch', () => addPharosChurch(palace, detail));
  labelled(palace, 'nea', () => addNea(palace, detail));
  labelled(palace, 'pharosLighthouse', () => addLighthouse(palace));
  addBoukoleon(palace, detail);
  labelAt(palace, 'tzykanisterion', 92, LOWER + 1, 66);

  const trees = detail
    ? [[-118, UPPER, -26], [-108, UPPER, -18], [-98, UPPER, -28], [118, UPPER, -60], [110, UPPER, -86], [122, UPPER, -70],
      [46, UPPER, -14], [60, UPPER, -42], [8, UPPER, -14], [4, UPPER, -46], [40, UPPER, -46], [120, UPPER, -20],
      [-120, MIDDLE, 40], [-118, MIDDLE, 14], [66, MIDDLE, 38], [80, MIDDLE, 44], [122, MIDDLE, 40], [124, MIDDLE, 4],
      [-118, LOWER, 60], [-126, LOWER, 76], [20, LOWER, 58], [34, LOWER, 56]]
    : []; // the map plants its own trees
  for (const [x, y, z] of trees) palace.add(Math.abs(x) > 100 || y === LOWER ? roundTree(9, x, y, z) : cypress(12, x, y, z));

  finalizeModel(palace);
  if (detail) addImperialBarge(palace);
  return palace;
}

/** A terrace: banded retaining wall (its face relieved by blind arches) with a paved top. */
function terrace(palace, width, depth, top, z, detail) {
  palace.add(box(width, top + 2, depth, M.banded, 0, -2, z));
  palace.add(groundPlane(width, depth, M.paving, 0, top + lift(0.03, detail), z));
  if (!detail) return;
  const face = z + depth / 2;
  const below = top === UPPER ? MIDDLE : top === MIDDLE ? LOWER : 0;
  const arcade = windowRow({ count: Math.floor(width / 9), spacing: 9, width: 3.2, height: Math.min(6, top - below - 1.5), y: 0.6 });
  arcade.position.set(0, below, face + 0.02);
  palace.add(arcade);
}

/** Lawns and groves between the buildings: the palace was as much gardens as halls. */
function addGardens(palace, detail) {
  palace.add(groundPlane(50, 40, M.grass, 24, UPPER + lift(0.05, detail), -30)); // the Mesokepion around the Chrysotriklinos
  palace.add(groundPlane(36, 20, M.grass, -112, UPPER + lift(0.05, detail), -22));
  palace.add(groundPlane(24, 40, M.grass, 118, UPPER + lift(0.05, detail), -74));
  palace.add(groundPlane(66, 24, M.grass, 92, LOWER + lift(0.05, detail), 66)); // the Tzykanisterion, Basil I's polo ground
  palace.add(groundPlane(20, 40, M.grass, -120, MIDDLE + lift(0.05, detail), 26));
  if (!detail) return;
  // Goal posts of the polo ground.
  for (const x of [62, 122]) for (const dz of [-5, 5]) palace.add(cylinder(0.2, 0.25, 3, M.wood, x, LOWER, 66 + dz, 6));
}

/** A half-round apse with its half-dome, bulging in the direction (dx, dz). */
function apse(parent, r, h, wall, roof, x, y, z, dx, dz, segments = 12) {
  parent.add(faceToward(cylinder(r, r, h, wall, x, y, z, segments, HALF), dx, dz));
  parent.add(faceToward(dome(r, roof, x, y + h, z, { phiLength: Math.PI, heightScale: 0.8, segments }), dx, dz));
}

/** A half-cylindrical vault roof lying along x (or z), its springing at y. */
function barrelVault(r, length, material, x, y, z, alongX, segments = 16) {
  const geometry = cylinderGeometry(r, r, length, segments, HALF).translate(0, -length / 2, 0).rotateX(-Math.PI / 2);
  if (alongX) geometry.rotateY(Math.PI / 2);
  return mesh(geometry, material, x, y, z);
}

/**
 * Row of classical columns along x (base, shaft, capital), like the shared
 * colonnade() but with the shaft's facet count chosen per level of detail:
 * ten-sided in the diorama, six-sided on the map.
 */
function columnRow({ length, count, height, radius = 0.4, detail = true, material = M.marble }) {
  const sides = curve(detail, 10, 6);
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

/** A drum pierced by windows carrying a dome, base at y. */
function drumAndDome(parent, r, drumHeight, roof, x, y, z, { windows = 0, segments = 20, heightScale = 0.8, wall = M.brick } = {}) {
  parent.add(cylinder(r, r, drumHeight, wall, x, y, z, segments));
  parent.add(dome(r, roof, x, y + drumHeight, z, { heightScale, segments }));
  if (windows) {
    const window = archGeometry(Math.min(1.2, r * 0.35), drumHeight * 0.7);
    for (let i = 0; i < windows; i++) parent.add(placeOnCircle(mesh(window, M.opening), (i / windows) * Math.PI * 2, r + 0.03, y + drumHeight * 0.15, x, z));
  }
}

/**
 * The Chalke, Justinian's bronze-roofed vestibule facing the Augustaion: a
 * marble-clad block with a dome on four barrel vaults, lower vaulted chambers
 * either side, all roofed in gilded bronze tiles; the great bronze doors with
 * the icon of Christ Chalkites above them.
 */
function addChalke(palace, detail) {
  const [x, z] = [-70, -84];
  palace.add(box(20, 16, 20, M.marble, x, UPPER, z));
  palace.add(box(21, 1, 21, M.marble, x, UPPER + 15.6, z)); // cornice
  for (const side of [-1, 1]) {
    palace.add(box(8, 11, 18, M.marble, x + side * 14, UPPER, z));
    palace.add(barrelVault(4, 18, M.gildedBronze, x + side * 14, UPPER + 11, z, false));
  }
  // The four barrel vaults of the cross, meeting under the dome.
  palace.add(barrelVault(5, 20.5, M.gildedBronze, x, UPPER + 16.6, z, true));
  palace.add(barrelVault(5, 20.5, M.gildedBronze, x, UPPER + 16.6, z, false));
  drumAndDome(palace, 6, 2.5, M.gildedBronze, x, UPPER + 20.5, z, { windows: detail ? 8 : 0, wall: M.marble, heightScale: 0.7 });
  palace.add(box(0.5, 2.6, 0.5, M.gold, x, UPPER + 27.3, z));
  palace.add(box(1.6, 0.4, 0.5, M.gold, x, UPPER + 29.1, z));

  // Bronze doors and the Christ Chalkites icon on gold ground above them, facing the Augustaion.
  const front = z - 10.05;
  palace.add(mesh(archGeometry(5.5, 8.5), M.opening, x, UPPER, front - 0.02));
  palace.add(box(5, 7.5, 0.5, M.bronze, x, UPPER, front - 0.1));
  palace.add(box(4, 4.6, 0.5, M.gold, x, UPPER + 9.5, front - 0.1));
  palace.add(box(1.6, 3.4, 0.2, cloth(0x3a4f7a), x, UPPER + 10.1, front - 0.4)); // the figure's blue mantle
  palace.add(box(1.1, 1.1, 0.2, cloth(0xe8d2b0), x, UPPER + 12.6, front - 0.4));
  // The imperial standards flanking the gate.
  for (const side of [-1, 1]) {
    const standard = flag('imperial', detail ? { width: 4, height: 2.6, pole: 14 } : { width: 7, height: 4.5, pole: 18 });
    standard.position.set(x + side * 24, UPPER, z - 13);
    palace.add(standard);
  }
  // Chapel of Christ Chalkites (10th century) beside the gate.
  palace.add(box(9, 8, 9, M.brick, x + 26, UPPER, z - 4));
  drumAndDome(palace, 2.6, 2, M.lead, x + 26, UPPER + 8, z - 4, { windows: detail ? 8 : 0, segments: 12 });
  apse(palace, 2.2, 5.5, M.brick, M.lead, x + 30.5, UPPER, z - 4, 1, 0, 8);
  if (detail) {
    for (const side of [-1, 1]) {
      const windows = windowRow({ count: 3, spacing: 4, width: 1.4, height: 3.6, y: 8 });
      windows.position.set(x + side * 14, UPPER, front);
      palace.add(windows);
    }
  }
}

/** Barracks of the Scholae and Excubitors, the guard halls behind the Chalke. */
function addScholae(palace, detail) {
  labelAt(palace, 'scholae', -6, UPPER + 11.5, -92);
  for (const [x, z, w] of [[-6, -92, 46], [36, -62, 16]]) {
    palace.add(box(w, 8, 12, M.stone, x, UPPER, z));
    palace.add(hipRoof(w, 12, 3.5, M.roof, x, UPPER + 8, z));
    if (detail) {
      const windows = windowRow({ count: Math.floor(w / 5), spacing: 5, width: 1.2, height: 2.4, y: 4 });
      windows.position.set(x, UPPER, z + 6.05);
      palace.add(windows);
    }
  }
}

/** The Hall of the Nineteen Couches, the banqueting hall with nine apses down each side and one at the end. */
function addNineteenCouches(palace, detail) {
  const [x, z, length, width] = [-99, -43, 52, 14];
  palace.add(box(length, 12, width, M.stone, x, UPPER, z));
  palace.add(gableRoof(length, width, 4.5, M.roof, x, UPPER + 12, z));
  apse(palace, 5, 9, M.stone, M.lead, x - length / 2, UPPER, z, -1, 0);
  for (let i = 0; i < 9; i++) {
    const ax = x - length / 2 + 4 + i * 5.5;
    for (const side of [-1, 1]) apse(palace, 2.2, 7, M.stone, M.lead, ax, UPPER, z + side * width / 2, 0, side, curve(detail, 8, 6));
  }
}

/**
 * The Daphne, the Constantinian residence: a long two-storeyed wing with a
 * southern portico, the domed Octagon (the emperor's robing room) at its
 * western end and the covered gallery running out to the Kathisma, the
 * imperial box in the Hippodrome.
 */
function addDaphne(palace, detail) {
  const [x, z] = [-10, -62];
  palace.add(box(70, 14, 18, M.stone, x, UPPER, z));
  palace.add(box(71, 0.8, 19, M.marble, x, UPPER + 7, z)); // string course between the storeys
  palace.add(hipRoof(70, 18, 5, M.roof, x, UPPER + 14, z));
  labelAt(palace, 'daphne', x, UPPER + 19, z);
  // The Octagon with its dome, and the gallery to the Kathisma.
  const ox = x - 45;
  palace.add(cylinder(8, 8, 12, M.stone, ox, UPPER, z, 8));
  drumAndDome(palace, 6.5, 2.5, M.lead, ox, UPPER + 12, z, { windows: detail ? 8 : 0, wall: M.stone, segments: 16 });
  palace.add(box(58, 6, 6, M.stone, -101, UPPER, z));
  palace.add(gableRoof(58, 6, 2.2, M.roof, -101, UPPER + 6, z));
  // A purple awning shades the emperor's loggia in the middle of the portico.
  palace.add(box(16, 0.4, 6, cloth(IMPERIAL), x, UPPER + 8.2, z + 12));
  for (const side of [-1, 1]) palace.add(cylinder(0.12, 0.12, 8.2, M.wood, x + side * 7.8, UPPER, z + 14.8, 6));
  const portico = columnRow({ length: 66, count: 14, height: 7, radius: 0.4, detail });
  portico.position.set(x, UPPER, z + 13);
  palace.add(portico);
  palace.add(box(68, 0.6, 5.5, M.roof, x, UPPER + 7, z + 12.5));
  if (detail) {
    for (const y of [2.4, 9.6]) {
      const windows = windowRow({ count: 14, spacing: 4.8, width: 1.6, height: 3, y });
      windows.position.set(x, UPPER, z + 9.05);
      palace.add(windows);
    }
    const back = windowRow({ count: 14, spacing: 4.8, width: 1.6, height: 3, y: 9.6 });
    back.position.set(x, UPPER, z - 9.05);
    back.rotation.y = Math.PI;
    palace.add(back);
  }
}

/** The Magnaura, the three-aisled basilica with galleries where foreign envoys were received. */
function addMagnaura(palace, detail) {
  const [x, z] = [70, -72];
  palace.add(box(46, 11, 28, M.stone, x, UPPER, z));
  palace.add(box(46, 18, 14, M.stone, x, UPPER, z));
  palace.add(gableRoof(46, 14, 4, M.roof, x, UPPER + 18, z));
  for (const side of [-1, 1]) {
    const aisleRoof = box(46.6, 0.5, 7.6, M.roof, x, UPPER + 11, z + side * 10.5);
    aisleRoof.rotation.x = side * 0.18;
    palace.add(aisleRoof);
  }
  apse(palace, 6.5, 15, M.stone, M.lead, x + 23, UPPER, z, 1, 0, 16);
  // Narthex and the broad flight of steps on the Augustaion side.
  palace.add(box(46, 9, 6, M.stone, x, UPPER, z - 17));
  palace.add(box(46.6, 0.5, 6.6, M.lead, x, UPPER + 9, z - 17));
  if (detail) {
    for (const side of [-1, 1]) {
      const clerestory = windowRow({ count: 8, spacing: 5, width: 1.8, height: 3.2, y: 13 });
      clerestory.position.set(x, UPPER, z + side * 7.05);
      clerestory.rotation.y = side > 0 ? 0 : Math.PI;
      palace.add(clerestory);
      const aisle = windowRow({ count: 8, spacing: 5, width: 1.6, height: 3, y: 5 });
      aisle.position.set(x, UPPER, z + side * 14.05);
      aisle.rotation.y = side > 0 ? 0 : Math.PI;
      palace.add(aisle);
    }
    const doors = windowRow({ count: 3, spacing: 9, width: 2.6, height: 5.5, y: 0 });
    doors.position.set(x, UPPER, z - 20.05);
    doors.rotation.y = Math.PI;
    palace.add(doors);
  }
  const front = columnRow({ length: 40, count: 9, height: 8.5, radius: 0.45, detail });
  front.position.set(x, UPPER, z - 22);
  palace.add(front);
  palace.add(box(44, 0.6, 5, M.lead, x, UPPER + 8.5, z - 22));
}

/** The Chrysotriklinos, the octagonal throne hall of Justin II: eight niches, a dome on sixteen windows. */
function addChrysotriklinos(palace, detail) {
  const [x, z] = [22, -28];
  palace.add(cylinder(14, 14, 15, M.brick, x, UPPER, z, 8));
  palace.add(cylinder(14.3, 14.3, 0.8, M.marble, x, UPPER + 14.2, z, 8)); // cornice
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const niche = cylinder(5, 5, 10, M.brick, 0, 0, 0, 12, HALF);
    palace.add(placeOnCircle(niche, angle, 12.6, UPPER, x, z));
    const cap = dome(5, M.lead, 0, 0, 0, { phiLength: Math.PI, heightScale: 0.7, segments: 12 });
    palace.add(placeOnCircle(cap, angle, 12.6, UPPER + 10, x, z));
  }
  drumAndDome(palace, 12.5, 4, M.lead, x, UPPER + 15, z, { windows: detail ? 16 : 0, segments: curve(detail, 32, 20), heightScale: 0.55 });
  palace.add(box(0.5, 3, 0.5, M.gold, x, UPPER + 25.8, z));
  palace.add(box(1.8, 0.5, 0.5, M.gold, x, UPPER + 27.8, z));
  // The Lausiakos and the hall of Justinian II, the vaulted halls leading in from the west.
  palace.add(box(36, 9, 12, M.stone, -10, UPPER, z));
  palace.add(gableRoof(36, 12, 3.5, M.roof, -10, UPPER + 9, z));
  if (detail) {
    const windows = windowRow({ count: 7, spacing: 5, width: 1.4, height: 2.8, y: 4.5 });
    windows.position.set(-10, UPPER, z + 6.05);
    palace.add(windows);
  }
}

/** The Triconch of Theophilos, a trefoil hall, with the semicircular colonnaded court (the Sigma) before it. */
function addTriconch(palace, detail) {
  const [x, z] = [96, -46];
  palace.add(box(16, 11, 16, M.brick, x, UPPER, z));
  palace.add(box(16.5, 0.5, 16.5, M.lead, x, UPPER + 11, z));
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, -1]]) apse(palace, 5, 9, M.brick, M.lead, x + dx * 8, UPPER, z + dz * 8, dx, dz);
  palace.add(groundPlane(28, 14, M.mosaic, x, UPPER + lift(0.08, detail), z + 15));
  const columns = 11;
  for (let i = 0; i <= columns; i++) {
    const angle = (i / columns) * Math.PI;
    const column = columnRow({ length: 0, count: 1, height: 6, radius: 0.35, detail });
    palace.add(placeOnCircle(column, angle, 13, UPPER, x, z + 12));
  }
  const ring = new THREE.RingGeometry(11, 15, curve(detail, 24, 12), 1, Math.PI, Math.PI).rotateX(-Math.PI / 2);
  palace.add(mesh(ring, M.roof, x, UPPER + 6.2, z + 12));
}

/**
 * The mosaic peristyle: a court of about 66 × 55 m whose colonnaded walks
 * were paved with the great hunting and pastoral mosaic (now the Mosaic
 * Museum); an apsed audience hall opens off it.
 */
function addPeristyle(palace, detail) {
  const [x, z] = [-62, 18];
  const [w, d, walk] = [60, 46, 9];
  // Mosaic pavement under the walks, a garden with a fountain in the open middle.
  palace.add(groundPlane(w, d, M.mosaic, x, MIDDLE + lift(0.06, detail), z));
  palace.add(groundPlane(w - walk * 2, d - walk * 2, M.grass, x, MIDDLE + lift(0.1, detail), z));
  palace.add(cylinder(3.2, 3.4, 1, M.marble, x, MIDDLE, z, 16));
  palace.add(cylinder(2.8, 2.8, 0.3, M.water, x, MIDDLE + 0.8, z, 16));
  for (const side of [-1, 1]) {
    palace.add(box(w + 2, 7, 1.2, M.stone, x, MIDDLE, z + side * (d / 2 + 0.6)));
    palace.add(box(1.2, 7, d, M.stone, x + side * (w / 2 + 0.6), MIDDLE, z));
    const roofZ = box(w + 2, 0.5, walk + 1, M.roof, x, MIDDLE + 7, z + side * (d / 2 - walk / 2 + 0.6));
    roofZ.rotation.x = -side * 0.14;
    palace.add(roofZ);
    const roofX = box(walk + 1, 0.5, d - walk * 2, M.roof, x + side * (w / 2 - walk / 2 + 0.6), MIDDLE + 7, z);
    roofX.rotation.z = side * 0.14;
    palace.add(roofX);
    const front = columnRow({ length: w - walk * 2, count: 11, height: 6.5, radius: 0.35, detail });
    front.position.set(x, MIDDLE, z + side * (d / 2 - walk));
    palace.add(front);
    const flank = columnRow({ length: d - walk * 2 - 5, count: 6, height: 6.5, radius: 0.35, detail });
    flank.rotation.y = Math.PI / 2;
    flank.position.set(x + side * (w / 2 - walk), MIDDLE, z);
    palace.add(flank);
  }
  // The apsed hall opening off the north-east corner of the court.
  const [hx, hz] = [-14, 14];
  palace.add(box(16, 11, 30, M.brick, hx, MIDDLE, hz));
  palace.add(gableRoof(30, 16, 4.5, M.roof, hx, MIDDLE + 11, hz).rotateY(Math.PI / 2));
  apse(palace, 6, 9, M.brick, M.lead, hx, MIDDLE, hz + 15, 0, 1, 14);
  if (detail) {
    const windows = windowRow({ count: 4, spacing: 6, width: 1.6, height: 3.4, y: 6 });
    windows.position.set(hx + 8.05, MIDDLE, hz);
    windows.rotation.y = Math.PI / 2;
    palace.add(windows);
  }
}

/** The church of the Virgin of the Pharos, the domed palace chapel that kept the Passion relics. */
function addPharosChurch(palace, detail) {
  const [cx, cz] = [36, 16];
  palace.add(box(16, 9, 16, M.brick, cx, MIDDLE, cz));
  palace.add(box(20, 12, 6.5, M.brick, cx, MIDDLE, cz));
  palace.add(box(6.5, 12, 20, M.brick, cx, MIDDLE, cz));
  drumAndDome(palace, 3.2, 3.5, M.lead, cx, MIDDLE + 12, cz, { windows: detail ? 8 : 0, segments: 16 });
  for (const [dx, dz] of [[-5.5, -5.5], [5.5, -5.5], [-5.5, 5.5], [5.5, 5.5]]) {
    drumAndDome(palace, 1.8, 1.8, M.lead, cx + dx, MIDDLE + 9, cz + dz, { segments: 12 });
  }
  apse(palace, 3, 8, M.brick, M.lead, cx + 10, MIDDLE, cz, 1, 0);
  palace.add(box(0.3, 2, 0.3, M.gold, cx, MIDDLE + 18, cz));
  if (detail) {
    const windows = windowRow({ count: 3, spacing: 2.2, width: 1, height: 2.4, y: 8 });
    windows.position.set(cx, MIDDLE, cz + 10.05);
    palace.add(windows);
  }
}

/**
 * The Nea Ekklesia of Basil I (880): a cross-in-square church on a tall
 * vaulted substructure, its five domes roofed with gilded bronze, with a
 * colonnaded atrium and two fountains on the west.
 */
function addNea(palace, detail) {
  const [x, z] = [96, 14];
  palace.add(box(34, 7, 30, M.banded, x, MIDDLE, z));
  const base = MIDDLE + 7;
  palace.add(box(26, 12, 24, M.brick, x, base, z));
  palace.add(box(27, 0.8, 25, M.marble, x, base + 6, z)); // string course
  palace.add(box(26.5, 0.5, 24.5, M.lead, x, base + 12, z));
  palace.add(box(10, 16, 24.5, M.brick, x, base, z));
  palace.add(box(26.5, 16, 10, M.brick, x, base, z));
  drumAndDome(palace, 5, 4.5, M.gildedBronze, x, base + 16, z, { windows: detail ? 12 : 0, segments: 20 });
  for (const [dx, dz] of [[-9, -8], [9, -8], [-9, 8], [9, 8]]) drumAndDome(palace, 2.6, 3, M.gildedBronze, x + dx, base + 12, z + dz, { windows: detail ? 8 : 0, segments: 14 });
  for (const dz of [-7, 0, 7]) apse(palace, dz ? 2.2 : 4, dz ? 8 : 11, M.brick, M.lead, x + 13, base, z + dz, 1, 0, 10);
  palace.add(box(0.4, 3, 0.4, M.gold, x, base + 25, z));
  palace.add(box(1.6, 0.4, 0.4, M.gold, x, base + 27, z));
  // Atrium with its two fountains, and the stair up from the terrace.
  const ax = x - 25;
  palace.add(groundPlane(22, 30, M.paving, ax, base + lift(0.04, detail), z));
  palace.add(box(22, 1, 30, M.banded, ax, MIDDLE + 6, z));
  palace.add(box(22, 6, 30, M.banded, ax, MIDDLE, z));
  const flight = stairs(8, 7, 1, 1.4, M.marble);
  flight.position.set(ax - 11 - 9.8, MIDDLE, z);
  flight.rotation.y = Math.PI / 2;
  palace.add(flight);
  for (const dz of [-7, 7]) {
    palace.add(cylinder(2.2, 2.4, 0.9, M.marble, ax, base, z + dz, curve(detail, 12, 8)));
    palace.add(cylinder(1.9, 1.9, 0.3, M.water, ax, base + 0.7, z + dz, curve(detail, 12, 8)));
  }
  for (const side of [-1, 1]) {
    const walk = columnRow({ length: 20, count: 6, height: 5.5, radius: 0.3, detail });
    walk.position.set(ax, base, z + side * 13.5);
    palace.add(walk);
    palace.add(box(22, 0.4, 3, M.roof, ax, base + 5.5, z + side * 13.5));
  }
  const west = columnRow({ length: 24, count: 7, height: 5.5, radius: 0.3, detail });
  west.rotation.y = Math.PI / 2;
  west.position.set(ax - 9.5, base, z);
  palace.add(west);
  palace.add(box(3, 0.4, 30, M.roof, ax - 9.5, base + 5.5, z));
}

/** The Pharos, the signal tower on the sea wall whose fire answered the beacon chain from the frontier. */
function addLighthouse(palace) {
  const [lx, lz] = [112, SEA_WALL_Z - 2];
  palace.add(box(11, 30, 11, M.banded, lx, 0, lz));
  palace.add(box(12.5, 1, 12.5, M.stone, lx, 30, lz));
  palace.add(box(8, 6, 8, M.stone, lx, 31, lz));
  palace.add(mesh(crenellationGeometry(12), M.stone, lx, 31, lz + 5.9));
  palace.add(mesh(crenellationGeometry(12), M.stone, lx, 31, lz - 5.9));
  palace.add(mesh(crenellationGeometry(12), M.stone, lx + 5.9, 31, lz).rotateY(Math.PI / 2));
  palace.add(mesh(crenellationGeometry(12), M.stone, lx - 5.9, 31, lz).rotateY(Math.PI / 2));
  for (const [dx, dz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) palace.add(cylinder(0.35, 0.35, 4, M.stone, lx + dx, 37, lz + dz, 6));
  palace.add(box(8, 0.5, 8, M.lead, lx, 41, lz));
  palace.add(dome(3.2, M.lead, lx, 41.5, lz, { heightScale: 1.1, segments: 12 }));
  palace.add(cylinder(2, 2.4, 2.5, M.fire, lx, 37, lz, 12));
}

/**
 * The Boukoleon: the sea palace built into the Marmara wall above its own
 * harbour. The surviving façade shows a storey of great marble-framed
 * windows above the wall, a balcony on marble consoles, the water gate and
 * the marble stair down to the marble quay, flanked by stone lions. The
 * lions are drawn larger than life, or they would vanish on the stage.
 */
function addBoukoleon(palace, detail) {
  const [x, length] = [-40, 70];
  const wallTop = LOWER + 6;
  const upperTop = wallTop + 10;

  // Palace rooms behind the façade, and the tower-like "House of Justinian" at the east end.
  palace.add(box(length, upperTop - LOWER, 22, M.stone, x, LOWER, 75));
  palace.add(box(length + 1, 0.8, 23, M.marble, x, upperTop - 0.8, 75));
  palace.add(hipRoof(length, 22, 5, M.roof, x, upperTop, 75));
  labelAt(palace, 'boukoleon', x, upperTop + 5, 75);
  palace.add(box(16, upperTop + 4 - LOWER, 18, M.stone, x + length / 2 - 2, LOWER, 76));
  palace.add(box(17, 0.6, 19, M.lead, x + length / 2 - 2, upperTop + 4, 76));

  // Sea-wall storey with the water gate.
  const curveSegments = curve(detail, 10, 5);
  const lower = mesh(archedWallGeometry({ length, height: wallTop, thickness: 4, openings: [{ x: 12, width: 5, bottom: 0, spring: 4.5 }], curveSegments }), M.banded);
  lower.position.set(x, 0, SEA_WALL_Z);
  palace.add(lower);
  // Upper storey: three great windows at the centre, lesser ones either side.
  const great = [-12, 0, 12].map((dx) => ({ x: dx, width: 5.5, bottom: wallTop + 1.5, spring: wallTop + 6.5 }));
  const lesser = [-30, -22, 22, 30].map((dx) => ({ x: dx, width: 3, bottom: wallTop + 2.5, spring: wallTop + 5.5 }));
  const openings = [...great, ...lesser].map((o) => ({ ...o, bottom: o.bottom - wallTop, spring: o.spring - wallTop }));
  const upper = mesh(archedWallGeometry({ length, height: 10, thickness: 4, openings, curveSegments }), M.banded);
  upper.position.set(x, wallTop, SEA_WALL_Z);
  palace.add(upper);
  palace.add(box(length, 0.6, 4.4, M.marble, x, upperTop, SEA_WALL_Z)); // marble cornice

  // White marble frames round the great windows, and the balcony on its consoles.
  for (const { x: dx, width, bottom, spring } of great) {
    palace.add(box(width + 2.2, spring - bottom + width / 2 + 1.2, 0.5, M.marble, x + dx, bottom - 0.6, SEA_WALL_Z + 2.1));
    palace.add(mesh(archGeometry(width, spring - bottom + width / 2), M.opening, x + dx, bottom, SEA_WALL_Z + 2.4));
  }
  for (const { x: dx, width, bottom, spring } of lesser) {
    palace.add(box(width + 1.2, spring - bottom + width / 2 + 0.8, 0.4, M.marble, x + dx, bottom - 0.4, SEA_WALL_Z + 2.05));
    palace.add(mesh(archGeometry(width, spring - bottom + width / 2), M.opening, x + dx, bottom, SEA_WALL_Z + 2.3));
  }
  palace.add(box(44, 0.7, 2.6, M.marble, x, wallTop, SEA_WALL_Z + 3.3));
  for (let i = -5; i <= 5; i++) palace.add(box(1, 1.6, 2.2, M.marble, x + i * 4.2, wallTop - 1.6, SEA_WALL_Z + 3));
  // The balustrade: every baluster in the diorama, every other one on the map.
  const balusterStep = curve(detail, 1, 2);
  for (let i = -10; i <= 10; i += balusterStep) palace.add(box(0.35, 1.1, 0.35, M.marble, x + i * 2.2, wallTop + 0.7, SEA_WALL_Z + 4.4));
  palace.add(box(44, 0.3, 0.4, M.marble, x, wallTop + 1.8, SEA_WALL_Z + 4.4));

  // The rest of the sea wall with towers.
  for (const [start, end] of [[-130, x - length / 2], [x + length / 2, 130]]) {
    const span = end - start;
    palace.add(box(span, LOWER + 6, 4, M.banded, start + span / 2, 0, SEA_WALL_Z));
    palace.add(mesh(crenellationGeometry(span), M.banded, start + span / 2, LOWER + 6, SEA_WALL_Z + 1.6));
  }
  for (const towerX of [-120, -80, 10, 50, 90]) palace.add(box(9, LOWER + 11, 9, M.banded, towerX, 0, SEA_WALL_Z + 1));

  if (detail) {
    // Harbour: the marble quay, moles, water, the marble stair down from the water gate between its two lions,
    // and the lion-and-bull statue that named the place.
    palace.add(groundPlane(320, 90, M.water, 0, 0, SEA_WALL_Z + 47));
    palace.add(box(100, 1.3, 11, M.marble, x, -0.3, SEA_WALL_Z + 7.5));
    for (const moleX of [x - 52, x + 52]) palace.add(box(5, 1.5, 40, M.stone, moleX, -0.3, SEA_WALL_Z + 21));
    palace.add(box(5, 1.5, 7, M.stone, x - 52, 1.2, SEA_WALL_Z + 38)); // the mole's beacon base
    const flight = stairs(6, 8, 0.5, 0.8, M.marble);
    flight.position.set(x + 12, 1, SEA_WALL_Z + 8.6);
    flight.rotation.y = Math.PI;
    palace.add(flight);
    for (const side of [-1, 1]) palace.add(lion(x + 12 + side * 6, 1, SEA_WALL_Z + 8, side));
    labelAt(palace, 'boukoleonLions', x + 12, 6, SEA_WALL_Z + 9);
    palace.add(box(4, 3, 4, M.marble, x - 18, 1, SEA_WALL_Z + 7));
    const beasts = [box(3, 1.4, 1, M.marble, x - 18.8, 4, SEA_WALL_Z + 7), box(2.4, 1.8, 1.1, M.marble, x - 17, 4, SEA_WALL_Z + 7)];
    beasts[1].rotation.z = 0.5;
    palace.add(...beasts);
    labelAt(palace, 'lionAndBull', x - 18, 6.5, SEA_WALL_Z + 7);
  }
}

/**
 * A stylised marble lion on its plinth, couchant with its head raised,
 * facing the sea (+z): body and haunches, a maned chest, head and muzzle,
 * forelegs stretched out before it and the tail along the flank away from
 * the stair (`side`).
 */
function lion(x, y, z, side) {
  const group = new THREE.Group();
  group.add(box(3.4, 1, 7, M.marble, 0, 0, 0)); // plinth
  group.add(box(2.2, 1.8, 4, M.marble, 0, 1, -1)); // body
  group.add(mesh(new THREE.SphereGeometry(1.2, 12, 8).scale(1, 0.85, 1.1), M.marble, 0, 2.1, -2.6)); // haunches
  group.add(mesh(new THREE.SphereGeometry(1.45, 14, 10).scale(1, 1.1, 0.9), M.marble, 0, 3.1, 1.2)); // mane
  group.add(box(1.5, 1.5, 1.5, M.marble, 0, 2.7, 2.1)); // head
  group.add(box(0.95, 0.8, 0.9, M.marble, 0, 2.7, 3.1)); // muzzle
  for (const dx of [-0.6, 0.6]) {
    group.add(box(0.6, 1.5, 0.7, M.marble, dx, 1, 1.9)); // foreleg
    group.add(box(0.75, 0.35, 1.5, M.marble, dx, 1, 2.6)); // paw
  }
  group.add(box(0.3, 0.3, 3.2, M.marble, -side * 1.25, 1.1, -1.2)); // tail along the flank
  group.add(mesh(new THREE.SphereGeometry(0.35, 8, 6), M.marble, -side * 1.25, 1.3, 0.5)); // its tuft
  group.position.set(x, y, z);
  return group;
}

/** A small gilded barge moored in the Boukoleon harbour. */
function addImperialBarge(palace) {
  const barge = new THREE.Group();
  const { geometry, deck } = createHull({ length: 16, beam: 4, depth: 1.4, bowRise: 1.2, sternRise: 1.6, segments: 24, ribs: 8 });
  barge.add(mesh(geometry, M.hull, 0, 0.9, 0));
  barge.add(mesh(deck, M.wood, 0, 0.7, 0));
  barge.add(box(5, 2, 3, cloth(IMPERIAL), -3, 0.7, 0));
  barge.add(gableRoof(5, 3, 1, M.gold, -3, 2.7, 0, 0.2));
  barge.position.set(-40, 0, SEA_WALL_Z + 24);
  barge.rotation.y = 0.2;
  barge.userData.animate = (time) => {
    barge.position.y = Math.sin(time * 1.1) * 0.12;
    barge.rotation.z = Math.sin(time * 0.8) * 0.02;
  };
  palace.add(barge);
}

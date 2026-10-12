import * as THREE from 'three';
import { materials as M, cloth, tinted } from './lib/materials.js';
import {
  archGeometry, archedWallGeometry, box, cone, cylinder, cylinderGeometry, faceToward, gableRoof, groundPlane, hipRoof, mesh,
  roundTree, stairs,
} from './lib/primitives.js';
import { finalizeModel } from './lib/merge.js';
import { labelAt, labelled } from './lib/parts.js';
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
 * The colonnade is drawn as the sources describe it: a lower order on a
 * stepped stylobate with shops opening behind it, a full entablature, an
 * upper gallery behind a balustrade under a tiled lean-to roof against the
 * back wall, and statues along the cornice. The Mese leaves the forum
 * between colonnaded porticoes with shops behind them (the embolos), and
 * the square is busy with stalls and people. Outside the ring, the houses
 * of the Second Hill crowd in: brick ground floors under plastered upper
 * storeys, tiled roofs and walled courtyards.
 *
 * Sources: Bauer, "The Forum of Constantine in Constantinople" (brewminate);
 * Wikipedia, Column of Constantine (37–40 m shaft and base, 7-point radiate
 * crown, laurel-wreath joints); Byzantium 1200 reconstruction. The chapel
 * of St Constantine at the column's foot is first recorded in the tenth
 * century (Book of Ceremonies); it is shown small, as a later addition.
 */

const OUTER = [62, 50]; // semi-axes of the outer wall
const PORTICO = 6.5; // depth of the colonnaded walk
const GATE_HALF_WIDTH = 9;
const SENATE_HALF_WIDTH = 15;
const LOWER_STOREY = 7.2;
const UPPER_STOREY = 5.4;
const FLOOR = 0.8;
const STYLOBATE = 0.6; // the portico floor stands this high above the plaza
const WALL_HEIGHT = LOWER_STOREY + FLOOR + UPPER_STOREY + 0.6;
const SLAB = { x: 96, zNorth: -96, zSouth: 80 }; // the slice of the Second Hill shown in detail

export function createForumOfConstantine({ lod = 'detail' } = {}) {
  const detail = lod === 'detail';
  const forum = new THREE.Group();
  const [a, b] = OUTER;
  const inner = [a - PORTICO, b - PORTICO];

  // Paving: the oval plaza in Proconnesian marble, the Mese running straight through it.
  const slabW = SLAB.x * 2;
  const slabD = SLAB.zSouth - SLAB.zNorth;
  const slabZ = (SLAB.zSouth + SLAB.zNorth) / 2;
  if (detail) forum.add(box(slabW, 1, slabD, M.paving, 0, -1, slabZ));
  // Each pavement lies at least 6 cm above the one under it, or the two flicker on the stage.
  forum.add(mesh(ellipseGeometry(a, b, detail ? 48 : 32), M.marble, 0, 0.06, 0));
  forum.add(groundPlane(detail ? slabW : 2 * a + 20, 10, tinted('paving', 0xc9b48e), 0, 0.12, 0));

  // The ring of porticoes, broken by the two gates and the Senate's entrance.
  const gate = GATE_HALF_WIDTH / b; // half-angle of the gaps (approximate, near the axes)
  const senate = SENATE_HALF_WIDTH / a;
  const sectors = [
    [gate, Math.PI / 2 - senate],
    [Math.PI / 2 + senate, Math.PI - gate],
    [Math.PI + gate, Math.PI * 2 - gate],
  ];
  for (const [start, end] of sectors) addPortico(forum, detail, a, b, inner, start, end);

  addGates(forum, detail, a);
  addSenate(forum, detail, b);
  addNymphaeum(forum, detail, b);
  addColumn(forum, detail);

  if (detail) {
    addStatues(forum, inner);
    addMese(forum, a);
    addCrowd(forum, inner);
    addHouses(forum, a, b);
  }

  return finalizeModel(forum);
}

/**
 * One sector of the two-storey colonnade: a stepped stylobate, the lower
 * order with shop doors in the back wall behind it, entablature and
 * cornice, the upper gallery behind its balustrade under a lean-to roof of
 * tiles, the back wall rising as a parapet above it, and statues along the
 * cornice edge. The map keeps every band and both rows of columns with
 * fewer curve segments and leaves out the openings and statues.
 */
function addPortico(forum, detail, a, b, inner, start, end) {
  const segments = detail ? 40 : 24;
  const [ia, ib] = inner;
  const upperBase = LOWER_STOREY + FLOOR + STYLOBATE;
  const upperTop = upperBase + UPPER_STOREY;
  const roofInner = upperTop + 1.7;
  const roofOuter = roofInner + 2.4;
  const band = (innerInset, outerInset, y, height, material) =>
    forum.add(ring(ia - innerInset, ib - innerInset, a - outerInset, b - outerInset, start, end, y, height, material, segments));

  // Stylobate of two steps, the walk's floor on it.
  band(2.2, 0.9, 0, 0.3, M.marble); // both steps end inside the back wall
  band(1.6, 1.05, 0, STYLOBATE, M.marble);
  // The back wall, of ashlar, carrying the roof and rising above it as a parapet.
  forum.add(ring(a - 1.6, b - 1.6, a, b, start, end, 0, roofOuter + 0.9, M.stone, segments));
  // Lower entablature (architrave and frieze), its cornice, and the upper floor.
  band(1.1, -0.1, LOWER_STOREY + STYLOBATE, FLOOR, M.marble);
  band(1.5, 0.9, LOWER_STOREY + STYLOBATE + FLOOR - 0.35, 0.3, M.marble); // its top a step below the floor's
  // Balustrade of the gallery.
  band(1.1, PORTICO + 0.5, upperBase, 1.0, M.marble);
  band(1.3, PORTICO + 0.3, upperBase + 1.0, 0.2, M.marble);
  // Upper entablature and cornice.
  band(1.1, -0.1, upperTop, 1.2, M.marble);
  band(1.6, 0.9, upperTop + 1.2, 0.45, M.marble); // its top a step below the eaves board's
  // The lean-to roof of tiles, climbing from the gallery's edge to the back wall.
  forum.add(mesh(slopedRingGeometry(ia - 1.8, ib - 1.8, a - 1.6, b - 1.6, start, end, roofInner, roofOuter, segments), M.roof));
  band(1.8, PORTICO + 1.4, roofInner - 0.4, 0.4, M.marble); // the eaves board

  // Both storeys of columns; on the map they are plain shafts and capitals of few sides.
  const points = ellipsePoints(ia, ib, 4.2, start, end);
  for (const [i, [x, z, angle]] of points.entries()) {
    forum.add(column(x, STYLOBATE, z, LOWER_STOREY, 0.42, M.marble, detail));
    forum.add(column(x, upperBase, z, UPPER_STOREY, 0.32, M.marble, detail));
    if (!detail) continue;
    // Statues of the gods and emperors stand on the cornice over every fourth column.
    if (i % 4 === 2) {
      const [sx, sz] = [(ia - 1.0) * Math.cos(angle), -(ib - 1.0) * Math.sin(angle)];
      forum.add(box(1.2, 0.5, 1.2, M.marble, sx, upperTop + 1.7, sz));
      forum.add(figure(sx, upperTop + 2.2, sz, 2.6, (i % 8 === 2) ? M.bronze : M.marble));
    }
    // Shop doors in the back wall between every second pair of columns, and windows over them.
    if (i % 2 === 1 && i < points.length - 1) {
      const mid = (angle + points[i + 1][2]) / 2;
      // The wall's inner face is a ring of flat facets that sag a few centimetres inside the ellipse, so stand well clear of it.
      forum.add(onEllipse(mesh(archGeometry(2.2, 3.6), M.opening), a - 1.72, b - 1.72, mid, STYLOBATE, true));
      forum.add(onEllipse(mesh(archGeometry(1.2, 1.8), M.opening), a - 1.72, b - 1.72, mid, upperBase + 1.6, true));
    }
  }
}

/** Triumphal arches of Proconnesian marble where the Mese enters and leaves: a triple bay, columns on each face, an attic with its bronze figures. */
function addGates(forum, detail, a) {
  const length = 30;
  for (const side of [-1, 1]) {
    const x = side * (a - 2);
    const arch = mesh(archedWallGeometry({
      length, height: 16, thickness: 8, curveSegments: detail ? 10 : 6,
      openings: [{ x: 0, width: 8, bottom: 0, spring: 9.5 }, { x: -9.75, width: 4, bottom: 0, spring: 5.5 }, { x: 9.75, width: 4, bottom: 0, spring: 5.5 }],
    }), M.marble);
    arch.rotation.y = Math.PI / 2;
    arch.position.x = x;
    forum.add(arch);
    forum.add(box(9.5, 1.3, length + 1.6, M.marble, x, 16, 0)); // cornice
    forum.add(box(8, 3.4, length - 1, M.marble, x, 17.3, 0)); // attic
    forum.add(box(9, 0.6, length + 0.6, M.marble, x, 20.7, 0));
    // Engaged columns on each face flank the bays, on a common pedestal course.
    for (const dx of [-4.6, 4.6]) {
      forum.add(box(1.6, 1.2, length, M.marble, x + dx, 0, 0));
      for (const dz of [-14.2, -6.2, 6.2, 14.2]) forum.add(column(x + dx, 1.2, dz, 14.2, 0.55, M.marble, detail));
    }
    if (!detail) continue;
    // The dedication in bronze letters on the attic, and the bronze women of the arches above it.
    for (const dx of [-4.05, 4.05]) forum.add(box(0.15, 1.8, 11, M.bronze, x + dx, 18.1, 0));
    for (const dz of [-11, 11]) forum.add(figure(x, 21.3, dz, 3.4, M.bronze));
    forum.add(box(2.2, 0.6, 2.2, M.marble, x, 21.3, 0));
    forum.add(figure(x, 21.9, 0, 3.8, M.bronze));
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
    // The pedestal's reliefs: sunk panels, each with a row of figures in relief, under a gilded frieze.
    for (const side of [-1, 1]) {
      for (const along of [true, false]) {
        const panel = along ? box(5.4, 3.0, 0.3, M.stoneDark, 0, y + 1.2, side * 3.55) : box(0.3, 3.0, 5.4, M.stoneDark, side * 3.55, y + 1.2, 0);
        forum.add(panel);
        for (const d of [-1.6, 0, 1.6]) {
          const relief = figure(along ? d : side * 3.65, y + 1.3, along ? side * 3.65 : d, 2.4, M.marble);
          relief.scale.set(along ? 1 : 0.35, 1, along ? 0.35 : 1);
          forum.add(relief);
        }
      }
      forum.add(box(7.4, 1.0, 0.25, M.gildedBronze, 0, y + 5.0, side * 3.62));
      forum.add(box(0.25, 1.0, 7.4, M.gildedBronze, side * 3.62, y + 5.0, 0));
    }
  }
  forum.add(box(8.4, 0.8, 8.4, M.marble, 0, y + 6.4, 0)); // cornice
  y += 7.2;
  const sides = detail ? 24 : 12;
  forum.add(cylinder(2.1, 2.5, 0.8, M.marble, 0, y, 0, sides)); // torus base
  y += 0.8;

  const drums = 9;
  const drumHeight = 29.7 / drums;
  const drum = cylinderGeometry(1.3, 1.45, drumHeight, sides, { open: true });
  const wreath = new THREE.TorusGeometry(1.5, 0.24, 8, 32).rotateX(Math.PI / 2);
  for (let i = 0; i < drums; i++) {
    forum.add(mesh(drum, porphyry, 0, y, 0));
    if (i > 0 && detail) forum.add(mesh(wreath, M.gildedBronze, 0, y, 0));
    y += drumHeight;
  }
  forum.add(cylinder(1.9, 1.3, 1.6, M.marble, 0, y, 0, sides)); // capital
  forum.add(box(3.8, 0.6, 3.8, M.marble, 0, y + 1.6, 0)); // abacus
  labelAt(forum, 'constantineColumn', 0, 10, 0);
  labelled(forum, 'heliosStatue', () => forum.add(createStatue(detail, y + 2.2)));

  if (!detail) return;
  // The little chapel of St Constantine against the platform's north side: a brick box under a dome on a drum, with an apse.
  const cz = -12.5;
  forum.add(box(7, 4.6, 7, M.brick, 0, 0, cz));
  forum.add(cylinder(2.2, 2.2, 1.6, M.brick, 0, 4.6, cz, 12));
  forum.add(mesh(new THREE.SphereGeometry(2.3, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.lead, 0, 6.2, cz));
  forum.add(faceToward(cylinder(1.8, 1.8, 3.6, M.brick, 0, 0, cz - 3.5, 8, { thetaStart: -Math.PI / 2, thetaLength: Math.PI }), 0, -1));
  forum.add(mesh(archGeometry(1.4, 2.6), M.opening, 0, 0, cz + 3.56));
  forum.add(mesh(new THREE.SphereGeometry(0.2, 8, 6), M.gold, 0, 8.5, cz));
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
  const sides = detail ? 12 : 8;
  statue.add(cylinder(0.75, 1.0, 4.4, M.gold, 0, base, 0, sides));
  statue.add(cylinder(1.3, 0.9, 1.3, M.gold, 0, base + 3.6, 0, sides)); // shoulders
  statue.add(mesh(detail ? new THREE.SphereGeometry(0.6, 14, 10) : new THREE.SphereGeometry(0.6, 8, 6), M.gold, 0, base + 5.4, 0));
  const spear = cylinder(0.08, 0.08, 7.5, M.gold, 1.25, base + 0.3, 0, detail ? 6 : 4);
  spear.rotation.z = -0.06;
  statue.add(spear);
  statue.add(cylinder(0.2, 0.25, 2.6, M.gold, -1.3, base + 2.6, 0.3, detail ? 8 : 6)); // arm holding the orb
  statue.add(mesh(detail ? new THREE.SphereGeometry(0.45, 12, 8) : new THREE.SphereGeometry(0.45, 8, 6), M.gold, -1.3, base + 5.1, 0.3));
  if (detail) {
    // The radiate crown: a band round the brow and seven rays fanning up from it.
    statue.add(cylinder(0.62, 0.62, 0.2, M.gold, 0, base + 5.5, 0, 12, { open: true }));
    for (let i = 0; i < 7; i++) {
      const angle = Math.PI * (0.05 + (0.9 * i) / 6); // a fan of rays over the brow
      const ray = cone(0.1, 1.5, M.gold, Math.cos(angle) * 0.55, base + 5.5 + Math.sin(angle) * 0.45, 0, 5);
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
  forum.add(faceToward(cylinder(6, 6, 14, M.stone, 0, 0, z - 12, detail ? 12 : 8, { thetaStart: -Math.PI / 2, thetaLength: Math.PI }), 0, -1));
  forum.add(faceToward(mesh(new THREE.SphereGeometry(6.2, detail ? 12 : 8, detail ? 6 : 4, 0, Math.PI, 0, Math.PI / 2).scale(1, 0.6, 1), M.lead, 0, 14, z - 12), 0, -1));

  // The porch, opening south onto the square, up a flight of steps.
  const porchZ = -(b - 1);
  forum.add(box(26, 0.8, 10, M.marble, 0, 0, porchZ));
  forum.add(box(26, 1.2, 10, M.marble, 0, 12.8, porchZ)); // entablature
  const pediment = gableRoof(10, 26, 3.4, M.roof, 0, 14, porchZ, 0.3);
  pediment.rotation.y = Math.PI / 2;
  forum.add(pediment);
  forum.add(box(25, 2.6, 0.4, M.marble, 0, 14, porchZ + 5)); // tympanum face
  forum.add(box(6, 9, 0.5, M.bronze, 0, 0.8, -(b + 1.1))); // the bronze doors from Ephesos
  for (const x of [-9.75, -3.25, 3.25, 9.75]) forum.add(column(x, 0.8, porchZ + 3.6, 12, 0.6, M.porphyry, detail));
  if (!detail) return;
  const steps = stairs(22, 4, 0.2, 0.6, M.marble);
  steps.position.set(0, 0, porchZ + 7.4);
  steps.rotation.y = Math.PI;
  forum.add(steps);
  forum.add(box(6, 1.6, 0.2, M.gildedBronze, 0, 14.4, porchZ + 5.32)); // the relief in the tympanum
  for (const x of [-12.5, 0, 12.5]) forum.add(cone(0.5, 1.6, M.marble, x, x === 0 ? 17.5 : 14.1, porchZ + 5, 6)); // acroteria
  forum.add(windowed(-(b + 1.25)));
  // Pilasters along the hall's flanks, and clerestory windows between them.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      forum.add(box(0.5, 15, 1.4, M.marble, side * 18.2, 0.5, z - 10 + i * 5));
      if (i < 4) forum.add(box(0.3, 3, 2, M.opening, side * 18.05, 10, z - 7.5 + i * 5));
    }
  }
  // The colossal Athena from Lindos beside the entrance.
  forum.add(box(3, 3, 3, M.marble, -17, 0, -(b - 6)));
  forum.add(figure(-17, 3, -(b - 6), 6.5, M.bronze));
}

/** A row of high clerestory windows on the Senate's south face. */
function windowed(z) {
  const group = new THREE.Group();
  for (let i = 0; i < 5; i++) group.add(box(2, 3, 0.3, M.opening, -10 + i * 5, 9, z));
  return group;
}

/** The nymphaeum opposite the Senate: a two-storey screen of columned niches with statues, over a semicircular basin. */
function addNymphaeum(forum, detail, b) {
  const z = b - PORTICO - 2;
  const face = z + 0.5;
  forum.add(box(24, 11.6, 1.72, M.marble, 0, 0, z + 1.44)); // its back a step clear of the portico's lower cornice
  forum.add(box(25, 0.7, 2.4, M.marble, 0, 5.4, z + 1.4)); // string course between the storeys
  forum.add(box(25.5, 0.8, 2.6, M.marble, 0, 11.6, z + 1.4)); // crowning cornice
  forum.add(faceToward(cylinder(7, 7, 1.2, M.marble, 0, 0, z - 0.2, detail ? 20 : 10, { thetaStart: -Math.PI / 2, thetaLength: Math.PI }), 0, 1));
  if (!detail) return;
  for (let i = 0; i < 3; i++) {
    const x = -7.5 + i * 7.5;
    forum.add(box(2.6, 4.6, 0.6, M.opening, x, 0.6, face));
    forum.add(figure(x, 0.8, face, 3.2, M.marble));
    forum.add(box(2.2, 3.6, 0.6, M.opening, x, 6.4, face));
    forum.add(figure(x, 6.6, face, 2.6, M.marble));
  }
  for (const x of [-11, -3.75, 3.75, 11]) {
    forum.add(column(x, 0, face + 0.5, 5.4, 0.4, M.porphyry, true));
    forum.add(column(x, 6.1, face + 0.5, 5.2, 0.32, M.marble, true));
  }
  forum.add(box(25, 0.5, 2.8, M.marble, 0, 12.4, z + 1.4)); // pediment base
  for (const x of [-11, 0, 11]) forum.add(figure(x, 12.9, z + 1.4, 2.2, M.marble)); // figures on the skyline
  // The basin: a marble rim round the water, and a bowl on a stem in the middle.
  const basin = mesh(new THREE.CircleGeometry(6.2, 20, Math.PI, Math.PI).rotateX(-Math.PI / 2), M.water, 0, 0.9, z - 0.2);
  forum.add(basin);
  forum.add(faceToward(cylinder(7.2, 7.2, 0.4, M.marble, 0, 1.2, z - 0.2, 20, { thetaStart: -Math.PI / 2, thetaLength: Math.PI, open: true }), 0, 1));
  forum.add(cylinder(0.3, 0.4, 1.8, M.marble, 0, 0.9, z - 3.2, 8));
  forum.add(cylinder(1.4, 0.4, 0.5, M.marble, 0, 2.7, z - 3.2, 12));
  forum.add(mesh(new THREE.CircleGeometry(1.25, 12).rotateX(-Math.PI / 2), M.water, 0, 3.15, z - 3.2));
}

/** The antique bronzes gathered in the square. */
function addStatues(forum, inner) {
  const pedestal = (x, z, size = 2.6, height = 2.4) => forum.add(box(size, height, size, M.marble, x, 0, z));

  // The Judgement of Paris: three goddesses before the shepherd prince.
  for (const [i, dx] of [-2.4, 0, 2.4].entries()) {
    pedestal(-30 + dx, 24, 1.8);
    forum.add(figure(-30 + dx, 2.4, 24, 2.4 + (i === 1 ? 0.4 : 0), M.bronze));
  }
  pedestal(-30, 29, 1.8);
  forum.add(figure(-30, 2.4, 29, 2.4, M.bronze));

  // Hippocamps on two porphyry columns: a horse's forequarters in bronze, the tail of a fish behind.
  for (const x of [28, 36]) {
    forum.add(box(2.2, 1.15, 2.2, M.marble, x, 0, 22));
    forum.add(cylinder(0.5, 0.6, 7, M.porphyry, x, 1.15, 22, 12));
    forum.add(cylinder(0.8, 0.5, 0.6, M.marble, x, 8.15, 22, 12));
    forum.add(box(2.2, 1.1, 1.2, M.bronze, x, 8.75, 22));
    const neck = cylinder(0.3, 0.4, 1.4, M.bronze, x + 0.9, 9.55, 22, 6);
    neck.rotation.z = -0.4;
    forum.add(neck);
    forum.add(box(0.8, 0.35, 0.4, M.bronze, x + 1.6, 10.75, 22));
    const tail = cylinder(0.08, 0.35, 1.6, M.bronze, x - 1.2, 8.95, 22, 6);
    tail.rotation.z = 1.1;
    forum.add(tail);
  }

  // The bronze elephant.
  pedestal(30, -24, 4);
  const elephant = new THREE.Group();
  elephant.add(box(4.2, 2.4, 2.2, M.bronze, 0, 1.8, 0));
  for (const dx of [-1.4, 1.4]) for (const dz of [-0.7, 0.7]) elephant.add(cylinder(0.32, 0.38, 1.8, M.bronze, dx, 0, dz, 8));
  elephant.add(mesh(new THREE.SphereGeometry(1.1, 10, 8), M.bronze, 2.6, 3.2, 0));
  for (const side of [-1, 1]) elephant.add(box(0.3, 1.1, 0.9, M.bronze, 2.5, 2.7, side * 1.2)); // ears
  const trunk = cylinder(0.14, 0.3, 2.4, M.bronze, 3.4, 1.4, 0, 6);
  trunk.rotation.z = 0.2;
  elephant.add(trunk);
  for (const side of [-1, 1]) {
    const tusk = cylinder(0.04, 0.12, 1.2, M.marble, 3.3, 2.0, side * 0.45, 5);
    tusk.rotation.z = -1.2;
    elephant.add(tusk);
  }
  elephant.position.set(30, 2.4, -24);
  forum.add(elephant);

  // Thetis with her crown of crabs, and other gods along the walks.
  for (const [angle, height] of [[0.35, 3.2], [2.85, 3.0], [3.9, 3.4], [5.6, 3.1]]) {
    const x = Math.cos(angle) * (inner[0] - 10);
    const z = -Math.sin(angle) * (inner[1] - 10);
    const top = angle === 3.9 ? 2.5 : 2.4; // this pedestal meets the Judgement of Paris group's, a step lower
    pedestal(x, z, 2.6, top);
    forum.add(figure(x, top, z, height, M.bronze));
  }
}

/**
 * The Mese leaving the forum to east and west: an embolos of colonnaded
 * porticoes on both sides of the street, with a row of shops behind each
 * under a lean-to roof.
 */
function addMese(forum, a) {
  const from = a + 9;
  const length = SLAB.x - from;
  const shops = 6.5;
  for (const side of [-1, 1]) {
    const x = side * (from + length / 2);
    for (const flank of [-1, 1]) {
      const z = flank * 8;
      forum.add(box(length, 0.4, 5, M.marble, x, 0, z + flank * 2)); // the portico's stylobate
      for (let i = 0; i <= Math.floor(length / 4.5); i++) {
        forum.add(column(side * from + side * i * 4.5 + side * 1.2, 0.4, z, 6, 0.4, M.marble, true));
      }
      forum.add(box(length, 0.7, 1.2, M.marble, x, 6.4, z)); // architrave
      forum.add(box(length, shops, 6, M.brick, x, 0, z + flank * 7.5)); // the shops
      const roof = box(length + 1, 0.35, 7.8, M.roof, x, 0, 0);
      roof.rotation.x = -flank * Math.atan2(1.6, 7); // climbing from the architrave to the shops' back wall
      roof.position.set(x, 8.0, z + flank * 3.4);
      forum.add(roof);
      forum.add(box(length, 3.2, 3, M.brick, x, shops, z + flank * 9)); // the back wall rises behind the roof
      for (let i = 0; i < Math.floor(length / 4.5); i++) {
        const door = mesh(archGeometry(2.2, 3.4), M.opening, side * from + side * i * 4.5 + side * 3.45, 0, z + flank * 4.44);
        if (flank > 0) door.rotation.y = Math.PI;
        forum.add(door);
      }
    }
  }
}

/** Stalls and a few townspeople in the square (simple cylinders and spheres). */
function addCrowd(forum, inner) {
  const rnd = createRandom(328);
  const robes = [0xa8402f, 0x3d5a8a, 0xd9c8a0, 0x6b4a7a, 0x5a7a4a, 0xe8d6b8, 0x8a6a3a].map((c) => cloth(c));
  const person = (x, z, heading) => {
    const h = rnd.range(1.6, 1.85);
    const robe = rnd.pick(robes);
    const group = new THREE.Group();
    group.add(cylinder(h * 0.13, h * 0.17, h * 0.78, robe, 0, 0, 0, 8));
    group.add(mesh(new THREE.SphereGeometry(h * 0.1, 8, 6), cloth(0xcf9d78), 0, h * 0.88, 0));
    group.position.set(x, 0.03, z);
    group.rotation.y = heading;
    forum.add(group);
  };
  // Market stalls: a trestle under a cloth awning on two poles, with wares.
  const awnings = [0xc8b48a, 0x9a3f3a, 0x6a7f9a, 0xd6c6a0];
  for (const [x, z, heading] of [[-14, 30, 0.2], [-22, 34, 0.1], [18, 32, -0.2], [-40, 2, 1.5], [44, -18, 1.4], [-22, -30, 0.3], [20, -34, -0.1]]) {
    const stall = new THREE.Group();
    stall.add(box(3.2, 0.9, 1.4, M.wood, 0, 0, 0));
    for (const dx of [-1.5, 1.5]) stall.add(cylinder(0.06, 0.06, 2.6, M.wood, dx, 0, -1, 5));
    const awning = box(3.6, 0.08, 2.8, cloth(rnd.pick(awnings)), 0, 2.5, -0.2);
    awning.rotation.x = -0.15;
    stall.add(awning);
    for (let i = 0; i < 3; i++) stall.add(rnd.chance(0.5) ? cylinder(0.25, 0.25, 0.5, M.wood, -1 + i, 0.9, 0.2, 7) : box(0.5, 0.35, 0.5, M.sail, -1 + i, 0.9, -0.2));
    stall.position.set(x, 0.03, z);
    stall.rotation.y = heading;
    forum.add(stall);
    person(x + Math.sin(heading) * 1.6, z + Math.cos(heading) * 1.6, heading + Math.PI);
  }
  // Townspeople strolling, in twos and threes, keeping clear of the column's platform.
  for (let i = 0; i < 34; i++) {
    const angle = rnd.range(0, Math.PI * 2);
    const r = rnd.range(0.25, 0.92);
    const x = Math.cos(angle) * inner[0] * r;
    const z = Math.sin(angle) * inner[1] * r;
    if (Math.hypot(x, z) < 12) continue;
    person(x, z, rnd.range(0, Math.PI * 2));
    if (rnd.chance(0.5)) person(x + rnd.range(-1.2, 1.2), z + rnd.range(0.8, 1.4), rnd.range(0, Math.PI * 2));
  }
  // Along the Mese.
  for (const x of [-80, -72, -62, 66, 74, 86]) person(x, rnd.range(-3.5, 3.5), rnd.chance(0.5) ? Math.PI / 2 : -Math.PI / 2);
}

/**
 * The houses of the Second Hill, on a loose grid of lanes round the forum:
 * brick ground floors under plastered upper storeys that jut out a little,
 * tiled roofs, and walled courtyards with a tree. Larger ones have an
 * arcaded loggia on the upper floor.
 */
function addHouses(forum, a, b) {
  const rnd = createRandom(330);
  const plasters = [0xf2e3c6, 0xe8cfa6, 0xf5eee0, 0xdcb98e, 0xe9d2b8, 0xd6a982].map((c) => tinted('plaster', c));
  const cellW = 17;
  const cellD = 15;
  const outsideOval = (x, z, margin) => (x / (a + margin)) ** 2 + (z / (b + margin)) ** 2 > 1;
  for (let cx = -SLAB.x + cellW / 2; cx < SLAB.x; cx += cellW) {
    for (let cz = SLAB.zNorth + cellD / 2; cz < SLAB.zSouth; cz += cellD) {
      const x = cx + rnd.range(-1.5, 1.5);
      const z = cz + rnd.range(-1.5, 1.5);
      if (Math.abs(z) < 20 && Math.abs(x) > a - 8) continue; // the Mese and its porticoes
      if (!outsideOval(x, z, 9)) continue;
      if (Math.abs(x) < 26 && z < -b + 4 && z > -b - 30) continue; // the Senate house
      if (Math.abs(x) < 20 && z > b - 2 && z < b + 12) continue; // the nymphaeum's back
      if (x + 7 > SLAB.x || x - 7 < -SLAB.x || z + 6 > SLAB.zSouth || z - 6 < SLAB.zNorth) continue;
      if (rnd.chance(0.12)) continue; // an open yard or lane
      const house = byzantineHouse(rnd, plasters);
      house.position.set(x, 0, z);
      house.rotation.y = rnd.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]) + rnd.range(-0.06, 0.06);
      house.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(house);
      if (bounds.min.x < -SLAB.x || bounds.max.x > SLAB.x || bounds.min.z < SLAB.zNorth || bounds.max.z > SLAB.zSouth) continue; // over the slab's edge
      forum.add(house);
    }
  }
}

function byzantineHouse(rnd, plasters) {
  const house = new THREE.Group();
  const w = rnd.range(8, 11.5);
  const d = rnd.range(6, 8);
  const ground = rnd.range(3.2, 3.8);
  const upper = rnd.range(2.8, 3.4);
  const storeys = rnd.chance(0.35) ? 2 : 1; // upper storeys
  const plaster = rnd.pick(plasters);
  const jetty = 0.5;
  house.add(box(w, ground, d, M.brick, 0, 0, 0));
  let y = ground;
  for (let s = 0; s < storeys; s++) {
    house.add(box(w + jetty * 2, upper, d + jetty * 2, plaster, 0, y, 0));
    y += upper;
  }
  const loggia = storeys === 2 && rnd.chance(0.5);
  if (loggia) {
    // An open arcaded loggia on the top floor's street side.
    const yl = y - upper;
    house.add(box(w + jetty * 2 - 0.1, upper - 0.8, 2.2, M.opening, 0, yl + 0.4, d / 2 + jetty - 1.05)); // a step proud of the wall, inside its corners
    for (let i = 0; i <= 3; i++) house.add(cylinder(0.18, 0.2, upper - 0.5, M.marble, -w / 2 - jetty + 0.5 + (i * (w + jetty * 2 - 1)) / 3, yl, d / 2 + jetty - 0.3, 6));
  }
  house.add(rnd.chance(0.5)
    ? hipRoof(w + jetty * 2, d + jetty * 2, Math.min(w, d) * 0.3, M.roof, 0, y, 0, 0.5)
    : gableRoof(w + jetty * 2, d + jetty * 2, d * 0.32, M.roof, 0, y, 0, 0.5));
  // A door and a few small arched windows on the street side (+z), windows upstairs on the flank too.
  house.add(mesh(archGeometry(1.2, 2.3), M.opening, -w / 4, 0, d / 2 + 0.06));
  const window = archGeometry(0.8, 1.3);
  house.add(mesh(window, M.opening, w / 4, 1.6, d / 2 + 0.06));
  for (let s = 0; s < storeys; s++) {
    // The loggia takes the place of the top storey's street windows.
    if (!(loggia && s === storeys - 1)) for (const dx of [-w / 3, 0, w / 3]) house.add(mesh(window, M.opening, dx, ground + s * upper + 1.1, d / 2 + jetty + 0.06));
    const flank = mesh(window, M.opening, w / 2 + jetty + 0.06, ground + s * upper + 1.1, 0);
    flank.rotation.y = Math.PI / 2;
    house.add(flank);
  }
  // A walled courtyard beside the house, a tree in it.
  if (rnd.chance(0.6)) {
    const side = rnd.chance(0.5) ? -1 : 1;
    const yardW = rnd.range(4, 6);
    const cx = side * (w / 2 + yardW / 2);
    house.add(box(0.5, 2.4, d - 0.1, M.brick, side * (w / 2 + yardW), 0, 0)); // ends inside the end walls
    house.add(box(yardW, 2.4, 0.5, M.brick, cx, 0, d / 2 - 0.25));
    house.add(box(yardW, 2.4, 0.5, M.brick, cx, 0, -d / 2 + 0.25));
    house.add(mesh(archGeometry(1.2, 2.0), M.opening, cx, 0, d / 2 + 0.06));
    if (rnd.chance(0.7)) house.add(roundTree(rnd.range(5, 7), cx, 0, 0));
  }
  return house;
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

/** Base, shaft and capital; the map keeps the same proportions with six-sided, open-ended shafts. */
function column(x, y, z, height, radius, material = M.marble, detail = true) {
  const group = new THREE.Group();
  const sides = detail ? 10 : 6;
  const open = !detail;
  group.add(box(radius * 2.6, radius * 0.6, radius * 2.6, M.marble, 0, 0, 0));
  group.add(cylinder(radius * 0.85, radius, height - radius * 1.6, material, 0, radius * 0.6, 0, sides, { open }));
  group.add(cylinder(radius * 1.6, radius * 0.9, radius, M.marble, 0, height - radius, 0, sides, { open }));
  group.position.set(x, y, z);
  return group;
}

// ---------- ellipse helpers (shape angle 0 = east, PI/2 = north) ----------

function ellipseGeometry(a, b, segments = 48) {
  const shape = new THREE.Shape();
  shape.absellipse(0, 0, a, b, 0, Math.PI * 2, false);
  return new THREE.ShapeGeometry(shape, segments).rotateX(-Math.PI / 2);
}

/** A slab in the band between two ellipses, between two angles, `height` thick from `y`. */
function ring(innerA, innerB, outerA, outerB, start, end, y, height, material, curveSegments = 40) {
  const shape = new THREE.Shape();
  shape.absellipse(0, 0, outerA, outerB, start, end, false);
  shape.lineTo(innerA * Math.cos(end), innerB * Math.sin(end));
  shape.absellipse(0, 0, innerA, innerB, end, start, true);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, curveSegments });
  return mesh(geometry.rotateX(-Math.PI / 2), material, 0, y, 0);
}

/** A sloping band between two ellipses (a lean-to roof): the inner edge at yInner, the outer at yOuter. */
function slopedRingGeometry(innerA, innerB, outerA, outerB, start, end, yInner, yOuter, segments = 40) {
  const positions = [];
  const uvs = [];
  const indices = [];
  let travelled = 0;
  let previous = null;
  for (let i = 0; i <= segments; i++) {
    const angle = start + ((end - start) * i) / segments;
    const inner = [innerA * Math.cos(angle), -innerB * Math.sin(angle)];
    const outer = [outerA * Math.cos(angle), -outerB * Math.sin(angle)];
    if (previous) travelled += Math.hypot(inner[0] - previous[0], inner[1] - previous[1]);
    previous = inner;
    positions.push(inner[0], yInner, inner[1], outer[0], yOuter, outer[1]);
    const run = Math.hypot(outer[0] - inner[0], outer[1] - inner[1], yOuter - yInner);
    uvs.push(travelled, 0, travelled, run);
    if (i > 0) {
      const k = i * 2;
      indices.push(k - 2, k, k - 1, k - 1, k, k + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** Points roughly `spacing` apart along an ellipse between two angles, as world [x, z, angle]. */
function ellipsePoints(a, b, spacing, start, end) {
  const points = [];
  let travelled = spacing / 2;
  let previous = [a * Math.cos(start), b * Math.sin(start)];
  for (let i = 1; i <= 400; i++) {
    const angle = start + ((end - start) * i) / 400;
    const current = [a * Math.cos(angle), b * Math.sin(angle)];
    travelled += Math.hypot(current[0] - previous[0], current[1] - previous[1]);
    if (travelled >= spacing) {
      points.push([current[0], -current[1], angle]);
      travelled = 0;
    }
    previous = current;
  }
  return points;
}

/** Places an object on the ellipse at a shape angle, facing outward (or inward), its local +z along the normal. */
function onEllipse(object, a, b, angle, y, inward = false) {
  const nx = b * Math.cos(angle);
  const nz = -a * Math.sin(angle);
  object.position.set(a * Math.cos(angle), y, -b * Math.sin(angle));
  object.rotation.y = inward ? Math.atan2(-nx, -nz) : Math.atan2(nx, nz);
  return object;
}

import * as THREE from 'three';
import { materials as M, cloth } from './lib/materials.js';
import {
  archedWallGeometry, archGeometry, archShape, box, boxGeometry, cone, crenellationGeometry, cylinder, cylinderGeometry,
  flag, hipRoof, mesh, placeOnCircle, regularOpenings, stairs, windowRow,
} from './lib/primitives.js';
import { createChariot, createHorse } from './lib/figures.js';
import { finalizeModel } from './lib/merge.js';
import { createRandom } from '../util/random.js';
import { createObeliskOfTheodosius } from './obeliskOfTheodosius.js';
import { createSerpentColumn } from './serpentColumn.js';
import { createWalledObelisk } from './walledObelisk.js';

/**
 * The Hippodrome: a chariot-racing stadium about 450 m long and 130 m
 * wide, seating perhaps 100,000 on thirty-odd rows of marble benches under
 * a colonnade. Local x runs along the track: the curved sphendone, carried
 * on its twenty-five great vaults, at -x (south-west), the twelve starting
 * gates (carceres) with the gilded quadriga at +x (north-east). The
 * imperial box (kathisma) is on the +z side, facing the Great Palace.
 *
 * Sources: Bardill's reconstruction for Byzantium 1200 / the Pera Museum
 * (2010); Robert de Clari's thirty or forty rows; Clavijo's columns on the
 * sphendone; the sphendone's 25 surviving vaults; the Book of Ceremonies
 * for the demes' seats flanking the kathisma (Blues on the emperor's
 * right, Greens on his left); Niketas Choniates for the bronzes the
 * Crusaders melted down in 1204 (the Herakles of Lysippos, the she-wolf
 * with Romulus and Remus, the Calydonian boar).
 *
 * The map build is the same stadium with fewer rows, coarser curves and
 * six-sided columns, without the window galleries, the crowd, the throne,
 * the racing chariots and the small ornaments: everything that reads from
 * the air.
 */

const SPHENDONE_X = -160; // centre of the curved end
const GATES_X = 215; // line of the starting gates
const ARENA = 38; // half-width of the track
const OUTER = 62; // half-width to the outer façade
const META_X = [-114, 134]; // turning posts at each end of the spina

const PODIUM = 2.6; // the wall between the track and the first row of seats
const SEATS_TOP = 59.5; // half-width where the rows give way to the upper walkway
const CAVEA_HEIGHT = 16.6; // top of the last row above the arena
const FACADE_HEIGHT = 17; // the arcaded outer wall, capped by the walkway
const PORTICO_HEIGHT = 6.5; // the colonnade crowning the stands
const KATHISMA_X = 40;
const STAIR_WIDTH = 6; // the ceremonial stair up to the kathisma's door

/** Height of the spina's top above the arena, where the monuments stand. */
export const SPINA_TOP = 1.6;

/**
 * Where each monument stands along the spina (local x, metres). On the map
 * they are landmarks in their own right, placed here by js/data/landmarks.js;
 * the detail model builds them in.
 */
export const SPINA_MONUMENTS = {
  'obelisk-of-theodosius': { x: 72, create: createObeliskOfTheodosius },
  'serpent-column': { x: 22, create: createSerpentColumn },
  'walled-obelisk': { x: -62, create: createWalledObelisk },
};

// ---------- local materials ----------

const chalk = new THREE.MeshStandardMaterial({ color: 0xf6f2e8, roughness: 1 });
const crowdMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 });
let trackMaterial = null;

/**
 * The arena's sand, painted once over the whole track (not tiled): raked
 * pale sand along the podium and the spina, and between them the lanes
 * worn darker by the chariots, deepest on the inside where the racing is,
 * bunching round the turning posts. The texture is mapped so that canvas
 * x is local x and canvas y is local z.
 */
function createTrackMaterial() {
  const width = 1024;
  const height = 192;
  const left = SPHENDONE_X - ARENA;
  const span = GATES_X - left;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const rnd = createRandom(203);
  const sx = width / span;
  const sy = height / (ARENA * 2);
  ctx.setTransform(sx, 0, 0, sy, -left * sx, ARENA * sy);
  ctx.fillStyle = 'rgb(216, 192, 145)';
  ctx.fillRect(left, -ARENA, span, ARENA * 2);
  for (let i = 0; i < 70; i++) {
    const x = left + rnd.next() * span;
    const z = (rnd.next() - 0.5) * ARENA * 2;
    const r = 8 + rnd.next() * 18;
    const gradient = ctx.createRadialGradient(x, z, 0, x, z, r);
    gradient.addColorStop(0, rnd.chance(0.5) ? 'rgba(200, 176, 128, 0.35)' : 'rgba(228, 206, 160, 0.3)');
    gradient.addColorStop(1, 'rgba(216, 192, 145, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(x - r, z - r, r * 2, r * 2);
  }
  // The worn lanes: a lap at each radius, the inner ones most trodden.
  ctx.lineCap = 'round';
  for (let i = 0; i < 110; i++) {
    const r = 11 + 21 * rnd.next() ** 1.4 + rnd.range(-0.6, 0.6);
    ctx.lineWidth = 0.3 + rnd.next() * 1.1;
    ctx.strokeStyle = `rgba(176, 150, 108, ${0.03 + rnd.next() * 0.09})`;
    ctx.beginPath();
    ctx.moveTo(META_X[0] + rnd.range(-6, 6), r);
    ctx.lineTo(META_X[1] + rnd.range(-6, 6), r);
    ctx.arc(META_X[1] + rnd.range(-3, 3), rnd.range(-1, 1), r, Math.PI / 2, -Math.PI / 2, true);
    ctx.lineTo(META_X[0] + rnd.range(-6, 6), -r);
    ctx.arc(META_X[0] + rnd.range(-3, 3), rnd.range(-1, 1), r, -Math.PI / 2, Math.PI / 2, true);
    ctx.stroke();
  }
  // Freshly raked sand along the podium wall, and the straight run from the gates to the break line.
  for (const z of [-ARENA + 3, ARENA - 3]) {
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(230, 210, 166, 0.3)';
    ctx.beginPath();
    ctx.moveTo(SPHENDONE_X, z);
    ctx.lineTo(GATES_X, z);
    ctx.stroke();
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  for (let i = 0; i < 6000; i++) {
    ctx.fillStyle = `rgba(160, 136, 98, ${0.1 + rnd.next() * 0.25})`;
    ctx.fillRect(rnd.next() * width, rnd.next() * height, 1.2, 1.2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  // ShapeGeometry's uvs are the shape's own (x, y) in metres; y runs to -z after the rotation.
  texture.repeat.set(1 / span, 1 / (ARENA * 2));
  texture.offset.set(-left / span, 0.5);
  return new THREE.MeshStandardMaterial({ map: texture, roughness: 0.95 });
}

export function createHippodrome({ lod = 'detail' } = {}) {
  const detail = lod === 'detail';
  const stadium = new THREE.Group();

  stadium.add(box(520, 1, 190, M.paving, 30, -1, 0));
  if (detail && !trackMaterial) trackMaterial = createTrackMaterial();
  stadium.add(mesh(new THREE.ShapeGeometry(arenaShape(), detail ? 24 : 16).rotateX(-Math.PI / 2), detail ? trackMaterial : M.sand, 0, 0.05, 0));

  const cavea = addCavea(stadium, detail);
  addFacade(stadium, detail);
  addPortico(stadium, detail);
  addSpina(stadium, lod);
  addKathisma(stadium, detail);
  addCarceres(stadium, detail);

  finalizeModel(stadium);
  if (detail) {
    addCrowd(stadium, cavea);
    addChariots(stadium);
  }
  return stadium;
}

function arenaShape() {
  const shape = new THREE.Shape();
  shape.moveTo(GATES_X, ARENA);
  shape.lineTo(SPHENDONE_X, ARENA);
  shape.absarc(SPHENDONE_X, 0, ARENA, Math.PI / 2, Math.PI * 1.5, false);
  shape.lineTo(GATES_X, -ARENA);
  return shape;
}

/** U-shaped band between two half-widths, open at the starting gates, where it ends at x = end. */
function standsShape(inner, outer, end = GATES_X) {
  const shape = new THREE.Shape();
  shape.moveTo(end, outer);
  shape.lineTo(SPHENDONE_X, outer);
  shape.absarc(SPHENDONE_X, 0, outer, Math.PI / 2, Math.PI * 1.5, false);
  shape.lineTo(end, -outer);
  shape.lineTo(end, -inner);
  shape.lineTo(SPHENDONE_X, -inner);
  shape.absarc(SPHENDONE_X, 0, inner, Math.PI * 1.5, Math.PI / 2, true);
  shape.lineTo(end, inner);
  shape.lineTo(end, outer);
  return shape;
}

/** A U-shaped slab between two half-widths, its base at y. */
function band(inner, outer, y, height, material, segments = 24, end = GATES_X) {
  const geometry = new THREE.ExtrudeGeometry(standsShape(inner, outer, end), { depth: height, bevelEnabled: false, curveSegments: segments });
  return mesh(geometry.rotateX(-Math.PI / 2), material, 0, y, 0);
}

// The radial stairways (klimakes) that divide the seating into wedges: along the straights and round the curve.
const STAIR_XS = Array.from({ length: 9 }, (_, i) => SPHENDONE_X + 37.5 * (i + 1));
const STAIR_ANGLES = Array.from({ length: 5 }, (_, j) => Math.PI / 2 + ((j + 1) / 6) * Math.PI);

/** Whether a seat at (x, z) lies on one of the radial stairways or on the kathisma's ceremonial stair. */
function onStairway(x, z) {
  if (z > 0 && Math.abs(x - KATHISMA_X) < STAIR_WIDTH / 2 + 0.8) return true;
  if (x >= SPHENDONE_X) return STAIR_XS.some((sx) => Math.abs(x - sx) < 1.1);
  const angle = Math.atan2(z, x - SPHENDONE_X);
  const radius = Math.hypot(z, x - SPHENDONE_X);
  const wrapped = angle < 0 ? angle + Math.PI * 2 : angle;
  return STAIR_ANGLES.some((a) => Math.abs(wrapped - a) * radius < 1.1);
}

/**
 * The seating: a marble podium wall, then rows of benches climbing to the
 * walkway under the portico. Each modelled row stands for two or three of
 * the real ones; a landing halfway up divides the lower and upper tiers.
 * Returns the row layout for the crowd.
 */
function addCavea(stadium, detail) {
  const rows = detail ? 14 : 10;
  const segments = detail ? 28 : 20;
  const run = (SEATS_TOP - ARENA) / rows;
  const rise = (CAVEA_HEIGHT - PODIUM) / rows;
  const landing = rows / 2;
  // The rows run on a little into the carceres block, each a shade less far than the one below (and the
  // walkway runs into the towers), so their open ends do not lie in one plane with each other or with the
  // gate pilasters; the lower ends are hidden inside the block, the upper ones stop short of the gallery.
  for (let k = 0; k < rows; k++) {
    const inner = ARENA + k * run;
    const end = GATES_X + 0.16 + 0.06 * (rows - 1 - k);
    stadium.add(band(inner, inner + run, 0, PODIUM + (k + 1) * rise - (k === landing ? rise * 0.5 : 0), k === landing ? M.stone : M.marble, segments, end));
  }
  // The upper walkway, which also caps the façade wall, overhanging its face (and the sphendone's) by a
  // hand's breadth even where its coarser polygon cuts inside its circle.
  stadium.add(band(SEATS_TOP, OUTER + 2.2, CAVEA_HEIGHT, FACADE_HEIGHT + 0.5 - CAVEA_HEIGHT, M.stone, segments, GATES_X + 1.2));

  if (detail) {
    // Each stairway climbs the rows in half-steps: a block on the back half of every bench.
    const step = boxGeometry(1.4, rise / 2, run / 2);
    const place = (k, x, z, angle) => {
      const block = mesh(step, M.stone, x, PODIUM + (k + 1) * rise - (k === landing ? rise * 0.5 : 0), z);
      block.rotation.y = angle;
      stadium.add(block);
    };
    for (let k = 0; k < rows; k++) {
      if (k === landing - 1) continue; // the landing, half a rise lower, is itself this row's half-step
      const radius = ARENA + k * run + run * 0.75;
      for (const x of STAIR_XS) for (const side of [-1, 1]) place(k, x, side * radius, 0);
      for (const angle of STAIR_ANGLES) place(k, SPHENDONE_X + Math.cos(angle) * radius, Math.sin(angle) * radius, Math.PI / 2 - angle);
    }
  }
  return { rows, run, rise, landing };
}

/** Arcaded outer walls, and the great vaulted sphendone at the curved end. */
function addFacade(stadium, detail) {
  const length = GATES_X - SPHENDONE_X;
  const centre = (GATES_X + SPHENDONE_X) / 2;
  for (const side of [-1, 1]) {
    // Two tiers of arches: the arcade at street level and the gallery above it, a marble string course between them.
    const wall = mesh(archedWallGeometry({
      length,
      height: FACADE_HEIGHT,
      thickness: 2,
      openings: [
        ...regularOpenings(length, 46, { width: 4.4, bottom: 0, spring: 5.5 }),
        ...regularOpenings(length, 46, { width: 3.2, bottom: 9, spring: 13 }),
      ],
      curveSegments: detail ? 10 : 4,
    }), M.banded);
    wall.position.set(centre, 0, side * (OUTER + 1));
    stadium.add(wall);
    stadium.add(box(length + 0.4, 0.6, 2.6, M.marble, centre, 8.3, side * (OUTER + 1))); // its ends buried in the sphendone and the towers
  }

  const ring = new THREE.Shape();
  ring.moveTo(SPHENDONE_X, OUTER + 2);
  ring.absarc(SPHENDONE_X, 0, OUTER + 2, Math.PI / 2, Math.PI * 1.5, false);
  ring.lineTo(SPHENDONE_X, -OUTER + 1);
  ring.absarc(SPHENDONE_X, 0, OUTER - 1, Math.PI * 1.5, Math.PI / 2, true);
  ring.lineTo(SPHENDONE_X, OUTER + 2);
  const sphendone = new THREE.ExtrudeGeometry(ring, { depth: FACADE_HEIGHT, bevelEnabled: false, curveSegments: detail ? 32 : 20 });
  stadium.add(mesh(sphendone.rotateX(-Math.PI / 2), M.banded));

  // The twenty-five vaults of the sphendone between their great piers, with a gallery of windows above.
  const vaults = 25;
  const lower = detail ? archGeometry(4.4, 7.5) : new THREE.ShapeGeometry(archShape(4.4, 7.5), 3);
  const upper = detail ? archGeometry(3, 5) : new THREE.ShapeGeometry(archShape(3, 5), 3);
  const pier = boxGeometry(2.4, FACADE_HEIGHT + 0.4, 1.6); // stopping short inside the walkway's slab
  for (let i = 0; i <= vaults; i++) {
    const angle = Math.PI / 2 + ((i + 0.5) / (vaults + 1)) * Math.PI;
    stadium.add(placeOnCircle(mesh(pier, M.stone), angle, OUTER + 1.5, 0, SPHENDONE_X, 0));
  }
  for (let i = 1; i <= vaults; i++) {
    const angle = Math.PI / 2 + (i / (vaults + 1)) * Math.PI;
    stadium.add(placeOnCircle(mesh(lower, M.opening), angle, OUTER + 2.05, 0, SPHENDONE_X, 0));
    stadium.add(placeOnCircle(mesh(upper, M.opening), angle, OUTER + 2.05, 10, SPHENDONE_X, 0));
    if (detail) {
      // Marble voussoirs and jambs framing each vault's mouth.
      const frame = new THREE.Group();
      frame.add(archBand(2.2, 2.9, 0.6, M.marble, 0, 5.3, 0));
      for (const side of [-1, 1]) frame.add(box(0.7, 5.3, 0.6, M.marble, side * 2.55, 0, 0));
      stadium.add(placeOnCircle(frame, angle, OUTER + 2.1, 0, SPHENDONE_X, 0));
    }
  }
}

/** A semicircular band of masonry: an arch seen on a façade, standing in the plane z = constant, its centre at (x, y, z). */
function archBand(inner, outer, depth, material, x, y, z) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outer, 0, Math.PI, false);
  shape.lineTo(-inner, 0);
  shape.absarc(0, 0, inner, Math.PI, 0, true);
  shape.lineTo(outer, 0);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 16 });
  geometry.translate(0, 0, -depth / 2);
  return mesh(geometry, material, x, y, z);
}

/**
 * The parts of a classical column of the given radius and height: base, shaft
 * and capital, with the proportions of primitives' colonnade(). `sides` sets
 * how round the shaft is (ten on the diorama, six on the map).
 */
function columnParts(radius, height, sides) {
  return {
    radius,
    height,
    base: boxGeometry(radius * 2.4, radius * 0.6, radius * 2.4),
    shaft: cylinderGeometry(radius * 0.85, radius, height - radius * 1.6, sides),
    capital: cylinderGeometry(radius * 1.6, radius * 0.9, radius, sides),
  };
}

/** Stands a column of the given parts with its foot at (x, y, z). */
function addColumn(stadium, parts, x, y, z, capitalMaterial = M.marble) {
  stadium.add(mesh(parts.base, M.marble, x, y, z));
  stadium.add(mesh(parts.shaft, M.marble, x, y + parts.radius * 0.6, z));
  stadium.add(mesh(parts.capital, capitalMaterial, x, y + parts.height - parts.radius, z));
}

/** The colonnade that crowned the stands, roofed with tiles, open towards the track. */
function addPortico(stadium, detail) {
  const y = FACADE_HEIGHT + 0.5;
  const radius = OUTER + 0.5;
  const spacing = 7.5;
  const length = GATES_X - SPHENDONE_X;
  const count = Math.round(length / spacing) + 1;
  const parts = columnParts(0.5, PORTICO_HEIGHT, detail ? 10 : 6);
  for (const side of [-1, 1]) {
    const step = length / (count - 1);
    for (let i = 0; i < count; i++) addColumn(stadium, parts, SPHENDONE_X + step * i, y, side * radius);
  }
  const arcCount = Math.round((Math.PI * radius) / spacing);
  for (let i = 1; i < arcCount; i++) {
    const angle = Math.PI / 2 + (i / arcCount) * Math.PI;
    addColumn(stadium, parts, SPHENDONE_X + Math.cos(angle) * radius, y, Math.sin(angle) * radius);
  }
  const top = y + PORTICO_HEIGHT;
  const segments = detail ? 32 : 20;
  stadium.add(band(radius - 1.6, radius + 1.6, top, 1.0, M.marble, segments));
  stadium.add(band(radius - 4.2, radius + 2.4, top + 1.0, 0.9, M.roof, segments));
}

/** The central barrier: a marble platform with the turning posts, water basins and monuments. */
function addSpina(stadium, lod) {
  const detail = lod === 'detail';
  const [start, end] = META_X;
  const length = end - start - 8;
  const centre = (start + end) / 2;
  stadium.add(box(length, SPINA_TOP - 0.1, 7, M.marble, centre, 0, 0)); // stops short under the overhanging top slab
  stadium.add(box(length + 0.2, 0.35, 7.6, M.marble, centre, SPINA_TOP - 0.35, 0));
  // The metae: three gilded cones on a stepped marble drum at each end, with balls on their tips.
  const ball = new THREE.SphereGeometry(0.38, detail ? 10 : 6, detail ? 6 : 4);
  for (const x of META_X) {
    stadium.add(cylinder(4.5, 4.7, 0.6, M.stone, x, 0, 0, detail ? 20 : 10));
    stadium.add(cylinder(3.8, 3.8, SPINA_TOP, M.marble, x, 0.6, 0, detail ? 20 : 10));
    for (const z of [-2, 0, 2]) {
      stadium.add(cone(0.8, 7, M.gold, x, SPINA_TOP + 0.6, z, detail ? 10 : 6));
      stadium.add(mesh(ball, M.gold, x, SPINA_TOP + 7.7, z));
    }
  }

  // The euripus: long basins of water between the monuments.
  for (const [a, b] of [[-50, -30], [-16, 16], [52, 64], [80, 102]]) {
    const mid = (a + b) / 2;
    for (const z of [-2.1, 2.1]) stadium.add(box(b - a, 0.3, 0.4, M.marble, mid, SPINA_TOP, z));
    for (const x of [a + 0.2, b - 0.2]) stadium.add(box(0.4, 0.3, 4.6, M.marble, x, SPINA_TOP, 0));
    stadium.add(box(b - a - 0.8, 0.22, 3.8, M.waterSide, mid, SPINA_TOP, 0));
  }

  // On the map the monuments are separate, clickable landmarks standing on this spina. In the
  // diorama they are built in, but kept as separate, tagged objects so they can be picked and
  // opened from here too (finalizeModel leaves `dynamic` objects unmerged).
  if (detail) {
    for (const [id, { x, create }] of Object.entries(SPINA_MONUMENTS)) {
      const monument = create({ lod });
      monument.position.set(x, SPINA_TOP, 0);
      monument.userData.landmarkId = id;
      monument.userData.dynamic = true;
      stadium.add(monument);
    }
  }

  // Columns crowned with bronze statues of charioteers and emperors.
  const sides = detail ? 10 : 6;
  for (const x of [-96, -24, 46, 110]) {
    stadium.add(box(1.8, 0.5, 1.8, M.marble, x, SPINA_TOP, 0));
    stadium.add(cylinder(0.6, 0.72, 8.5, M.marble, x, SPINA_TOP + 0.5, 0, sides));
    stadium.add(cylinder(0.9, 0.6, 0.5, M.marble, x, SPINA_TOP + 9, 0, sides));
    stadium.add(cylinder(0.35, 0.5, 2.2, M.bronze, x, SPINA_TOP + 9.5, 0, detail ? 8 : 6));
    stadium.add(cylinder(0.3, 0.3, 0.6, M.bronze, x, SPINA_TOP + 11.7, 0, detail ? 8 : 6));
  }
  // Bronze horses among the trophies, like the pair from the temple of Artemis at Ephesus.
  for (const x of [-82, 122]) {
    stadium.add(box(3.2, 1.2, 2, M.marble, x, SPINA_TOP, 0));
    const horse = detail ? createHorse(M.bronze) : coarseHorse(M.bronze);
    horse.scale.setScalar(1.2);
    horse.position.set(x, SPINA_TOP + 1.2, 0);
    stadium.add(horse);
  }

  if (!detail) return;

  // The chalk lines: the break line beyond the near meta, where the lanes from the gates merged, and
  // the finish before the kathisma. Both are white lines drawn across the sand.
  stadium.add(box(0.7, 0.06, ARENA * 2, chalk, META_X[1] + 10, 0.07, 0));
  stadium.add(box(0.7, 0.06, ARENA - 3.8, chalk, KATHISMA_X, 0.07, (ARENA + 3.8) / 2));

  // Famous bronzes of the spina, as simple stand-ins on marble pedestals (their poses are guesses):
  // the seated Herakles of Lysippos, the Calydonian boar, and the she-wolf suckling Romulus and Remus.
  addHerakles(stadium, 36);
  addBoar(stadium, -40);
  addWolf(stadium, -104);
}

const coarseSphere = new THREE.SphereGeometry(1, 6, 4);
const sphere = new THREE.SphereGeometry(1, 12, 8);

/** The colossal seated Herakles of Lysippos: resting on his lion skin over a rock, chin on his hand, club at his side. Faces +z. */
function addHerakles(stadium, x) {
  stadium.add(box(5, 2.1, 4, M.marble, x, SPINA_TOP, 0)); // sunk into its cap
  stadium.add(box(5.4, 0.4, 4.4, M.marble, x, SPINA_TOP + 2, 0));
  const statue = new THREE.Group();
  const bronze = M.bronze;
  statue.add(box(2.0, 1.2, 1.8, bronze, 0, 0, -0.3)); // the rock, draped with the lion skin
  statue.add(box(1.4, 1.7, 0.9, bronze, 0, 1.2, -0.1)); // torso
  const head = mesh(sphere, bronze, 0.35, 3.2, 0.35);
  head.scale.setScalar(0.4);
  statue.add(head);
  for (const side of [-1, 1]) {
    statue.add(box(0.5, 0.55, 1.5, bronze, side * 0.45, 1.2, 0.65)); // thighs, forward
    statue.add(box(0.42, 1.2, 0.42, bronze, side * 0.45, 0, 1.25)); // shins
  }
  const forearm = box(0.34, 1.3, 0.34, bronze, 0.95, 1.75, 1.0); // right arm, propping the head
  forearm.rotation.x = -0.35;
  statue.add(forearm);
  const upperArm = box(0.36, 0.36, 1.0, bronze, -0.95, 1.9, 0.5); // left arm resting on the knee
  statue.add(upperArm);
  const club = cylinder(0.14, 0.26, 2.2, bronze, -1.25, 0, -0.2, 8);
  club.rotation.z = 0.25;
  statue.add(club);
  statue.scale.setScalar(1.4);
  statue.position.set(x, SPINA_TOP + 2.4, 0);
  stadium.add(statue);
}

/** The bronze Calydonian boar, bristling, head down as if charging. Faces +x. */
function addBoar(stadium, x) {
  stadium.add(box(3.4, 1.4, 2, M.marble, x, SPINA_TOP, 0));
  const boar = new THREE.Group();
  const body = mesh(sphere, M.bronze, 0, 0.95, 0);
  body.scale.set(1.15, 0.6, 0.5);
  boar.add(body);
  const head = box(0.8, 0.6, 0.5, M.bronze, 1.15, 0.7, 0);
  head.rotation.z = 0.35;
  boar.add(head);
  boar.add(box(0.5, 0.3, 0.3, M.bronze, 1.6, 0.45, 0));
  boar.add(box(1.7, 0.18, 0.14, M.bronze, -0.1, 1.45, 0)); // the ridge of bristles
  for (const [lx, lz] of [[0.6, 0.2], [0.6, -0.2], [-0.6, 0.2], [-0.6, -0.2]]) boar.add(cylinder(0.08, 0.1, 0.75, M.bronze, lx, 0, lz, 6));
  for (const side of [-1, 1]) boar.add(cone(0.05, 0.35, M.gold, 1.55, 0.45, side * 0.2, 5)); // tusks
  boar.scale.setScalar(1.3);
  boar.position.set(x, SPINA_TOP + 1.4, 0);
  stadium.add(boar);
}

/** The she-wolf of Rome with the twins beneath her. Faces +x. */
function addWolf(stadium, x) {
  stadium.add(box(2.8, 1.2, 1.6, M.marble, x, SPINA_TOP, 0));
  const wolf = new THREE.Group();
  const body = mesh(sphere, M.bronze, 0, 1.0, 0);
  body.scale.set(0.9, 0.36, 0.3);
  wolf.add(body);
  const neck = cylinder(0.14, 0.2, 0.6, M.bronze, 0.7, 1.0, 0, 6);
  neck.rotation.z = -1.1;
  wolf.add(neck);
  const head = box(0.6, 0.28, 0.26, M.bronze, 1.25, 1.1, 0);
  head.rotation.z = -0.2;
  wolf.add(head);
  for (const [lx, lz] of [[0.55, 0.15], [0.55, -0.15], [-0.55, 0.15], [-0.55, -0.15]]) wolf.add(cylinder(0.05, 0.07, 0.95, M.bronze, lx, 0, lz, 6));
  const tail = cylinder(0.03, 0.07, 0.7, M.bronze, -0.85, 0.6, 0, 5);
  tail.rotation.z = 0.5;
  wolf.add(tail);
  for (const side of [-1, 1]) {
    const twin = mesh(sphere, M.bronze, 0.1, 0.3, side * 0.22);
    twin.scale.set(0.26, 0.2, 0.14);
    wolf.add(twin);
  }
  wolf.scale.setScalar(1.3);
  wolf.position.set(x, SPINA_TOP + 1.2, 0);
  stadium.add(wolf);
}

/** A horse with the stance and proportions of figures' createHorse(), in a few dozen triangles for the map. Faces +x, hooves at y = 0. */
function coarseHorse(material) {
  const horse = new THREE.Group();
  const body = mesh(coarseSphere, material, 0, 1.3, 0);
  body.scale.set(0.85, 0.36, 0.3);
  const neck = cylinder(0.17, 0.26, 0.95, material, 0.62, 1.38, 0, 4);
  neck.rotation.z = -0.62;
  const head = box(0.6, 0.24, 0.22, material, 1.1, 1.85, 0);
  head.rotation.z = -0.5;
  horse.add(body, neck, head);
  for (const [x, z] of [[0.55, 0.16], [0.55, -0.16], [-0.55, 0.16], [-0.55, -0.16]]) horse.add(cylinder(0.06, 0.08, 1.1, material, x, 0, z, 3));
  return horse;
}

/** The quadriga for the map: four coarse horses and the car, without the charioteer. Faces +x like createChariot(). */
function coarseQuadriga({ horseMaterial, carMaterial }) {
  const chariot = new THREE.Group();
  for (const z of [-0.9, -0.3, 0.3, 0.9]) {
    const horse = coarseHorse(horseMaterial);
    horse.position.set(1.6, 0, z);
    horse.scale.setScalar(0.9);
    chariot.add(horse);
  }
  chariot.add(cylinder(0.75, 0.75, 1.0, carMaterial, -0.4, 0.35, 0, 6, { thetaStart: 0, thetaLength: Math.PI }));
  for (const z of [-0.75, 0.65]) {
    const wheel = cylinder(0.55, 0.55, 0.1, carMaterial, -0.4, 0.55, z, 8);
    wheel.rotation.x = Math.PI / 2;
    chariot.add(wheel);
  }
  return chariot;
}

/**
 * The imperial box: a tall block rising through the stands, the emperor's
 * loggia on its top floor behind a colonnade hung with purple, a railed
 * terrace before it, and behind it the spiral stair (kochlias) and covered
 * passage to the Great Palace. A broad stair climbs from the podium to a
 * door in its front, for the emperor's appearances on the track (its
 * arrangement is a guess).
 */
function addKathisma(stadium, detail) {
  const x = KATHISMA_X;
  const floor = FACADE_HEIGHT;
  const purple = cloth(0x5c1f63);
  // The block stops short under its marble band, and is a shade wider than the box so that its flanks do
  // not lie level with the jambs of the façade's arches.
  stadium.add(box(30.2, floor - 0.1, 30, M.banded, x, 0, 65));
  stadium.add(box(31, 0.8, 31, M.marble, x, floor - 0.2, 65));
  stadium.add(box(30, 7.5, 20, M.banded, x, floor + 0.6, 70));
  stadium.add(box(31, 1.2, 31, M.marble, x, floor + 8.1, 65));
  stadium.add(hipRoof(31, 31, 6, M.lead, x, floor + 9.3, 65));
  // The roof's gilded orb and cross, and acroteria at the corners of its entablature.
  const orb = mesh(sphere, M.gold, x, floor + 15.9, 65);
  orb.scale.setScalar(0.7);
  stadium.add(orb);
  stadium.add(box(0.3, 2.4, 0.3, M.gold, x, floor + 16.4, 65));
  stadium.add(box(1.4, 0.3, 0.3, M.gold, x, floor + 17.9, 65));
  for (const dx of [-15, 15]) for (const dz of [-15, 15]) stadium.add(cone(0.6, 1.4, M.gold, x + dx, floor + 9.3, 65 + dz, detail ? 8 : 5));

  // The ceremonial stair from the podium up through the seats to an arched door in the box's front,
  // between two marble parapets.
  // The stair climbs through the benches; its foot stands a little above the podium and a little back
  // from its face, and its rise is such that no tread lies level with a bench in either build.
  const rise = (10.6 - PODIUM) / 10;
  const foot = PODIUM + 0.1;
  const stair = stairs(STAIR_WIDTH, 10, rise, 1.2, M.marble);
  stair.position.set(x, foot, ARENA + 0.1);
  stadium.add(stair);
  const door = mesh(archGeometry(3.6, 5.4), M.opening, x, 10.6, 49.95);
  door.rotation.y = Math.PI;
  stadium.add(door);
  const slope = Math.atan2(rise * 10, 12);
  for (const side of [-1, 1]) {
    const parapet = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.1, 14.6), M.marble);
    parapet.position.set(x + side * (STAIR_WIDTH / 2 + 0.25), foot + rise * 5 + 0.7, ARENA + 6);
    parapet.rotation.x = -slope;
    parapet.castShadow = parapet.receiveShadow = true;
    stadium.add(parapet);
  }
  // Blind arches either side of the door, in the lowest storey that shows above the seats.
  for (const dx of [-9, 9]) {
    const niche = mesh(archGeometry(2.4, 4.2), M.opening, x + dx, 12, 49.95);
    niche.rotation.y = Math.PI;
    stadium.add(niche);
  }

  // The private way to the palace: a round stair tower and a covered passage.
  stadium.add(cylinder(4, 4, floor + 9, M.banded, x + 18, 0, 77, detail ? 12 : 8));
  stadium.add(cylinder(4.4, 4.4, 0.5, M.marble, x + 18, floor + 8.6, 77, detail ? 12 : 8));
  stadium.add(cone(4.6, 3.2, M.lead, x + 18, floor + 9.1, 77, detail ? 12 : 8));
  stadium.add(box(8, 5, 12, M.banded, x, floor - 5, 86));
  stadium.add(box(9, 0.6, 13, M.lead, x, floor - 0.1, 86)); // its top a little below the box's marble band

  // Purple hangings mark the emperor's box from across the arena.
  stadium.add(box(28, 7.6, 0.3, purple, x, floor + 0.6, 60.3)); // tucked up into the entablature
  stadium.add(box(28, 2.2, 0.3, purple, x, floor + 5.9, 51.2));

  // The loggia's colonnade: seven columns across the front and two down each flank, with a marble
  // balustrade between them along the terrace's edge.
  const parts = columnParts(0.4, 7.5, detail ? 10 : 6);
  for (let i = 0; i < 7; i++) addColumn(stadium, parts, x - 13 + (26 / 6) * i, floor + 0.6, 51.5, M.gold);
  for (const side of [-1, 1]) {
    for (const z of [53, 59]) addColumn(stadium, parts, x + side * 13, floor + 0.6, z, M.gold);
    stadium.add(box(0.35, 1.0, 9, M.marble, x + side * 13, floor + 0.6, 56));
  }
  stadium.add(box(26, 1.0, 0.35, M.marble, x, floor + 0.6, 51.5));
  stadium.add(box(26.4, 0.2, 0.6, M.marble, x, floor + 1.6, 51.5));

  if (!detail) return;

  // The throne, gilded, at the centre of the loggia.
  stadium.add(box(2.4, 0.5, 2.4, M.marble, x, floor + 0.6, 57));
  stadium.add(box(1.4, 1.6, 1.2, M.gold, x, floor + 1.1, 57.4));

  // The imperial standards at the terrace corners, and a few spiral windows lighting the kochlias.
  for (const side of [-1, 1]) {
    const standard = flag('imperial', { width: 3.2, height: 2.1, pole: 9 });
    standard.position.set(x + side * 14.6, floor + 0.6, 50.6);
    stadium.add(standard);
  }
  for (let i = 0; i < 5; i++) {
    const angle = 0.6 + i * 1.25;
    stadium.add(placeOnCircle(mesh(archGeometry(0.8, 1.6), M.opening), angle, 4.05, 3 + i * 4, x + 18, 77));
  }
}

/**
 * The twelve starting gates under their gallery, the flanking towers, and
 * the gilded quadriga over the central gateway. Marble pilasters divide the
 * gates; an open loggia under a tiled roof runs along the top, where the
 * presiding officials sat; the chariots entered the stalls from the street
 * behind through a matching row of arches.
 */
function addCarceres(stadium, detail) {
  const x = GATES_X + 6;
  stadium.add(box(12, 13, 124, M.banded, x, 0, 0));
  stadium.add(box(13, 0.9, 125, M.marble, x, 13, 0)); // its top clear of the seat rows that run into it
  stadium.add(box(14, 20, 16, M.banded, x, 0, 0));
  stadium.add(box(16, 0.8, 18, M.marble, x, 20, 0));
  stadium.add(box(15, 0.7, 17, M.marble, x, 12.6, 0));
  for (const side of [-1, 1]) {
    const tower = side * 66;
    stadium.add(box(15, 22, 15, M.banded, x, 0, tower));
    stadium.add(box(15.6, 0.6, 15.6, M.marble, x, 11, tower));
    stadium.add(box(15.6, 0.6, 15.6, M.marble, x, 20.4, tower));
    // Battlements along all four edges of each tower's top.
    for (const dz of [-7, 7]) stadium.add(mesh(crenellationGeometry(15), M.banded, x, 22, tower + dz));
    for (const dx of [-7, 7]) stadium.add(mesh(crenellationGeometry(15).rotateY(Math.PI / 2), M.banded, x + dx, 22, tower));
    // Pilasters between the gates, and the entablature they carry.
    for (let i = 1; i <= 6; i++) stadium.add(box(1.0, 10.6, 1.0, M.marble, GATES_X - 0.4, 0, side * (i * 9.5)));
  }
  stadium.add(box(0.8, 0.9, 124, M.marble, GATES_X - 0.3, 10.6, 0));

  // The gallery over the gates: small columns along the front, a wall behind, tiles above.
  const parts = columnParts(0.35, 4.6, detail ? 10 : 6);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 11; i++) addColumn(stadium, parts, GATES_X + 0.9, 13.9, side * (9.5 + 4.75 * i));
    stadium.add(box(1.6, 4.6, 50, M.banded, x + 5, 13.9, side * 33.5));
    stadium.add(box(12, 0.6, 51, M.marble, x, 18.5, side * 33.5));
    stadium.add(box(12.8, 0.6, 51.6, M.roof, x, 19.1, side * 33.5));
  }

  // The quadriga: four gilded horses and their chariot, looking down the track.
  const quadriga = detail
    ? createChariot({ horseMaterial: M.gildedBronze, carMaterial: M.gold, colorMaterial: M.gildedBronze })
    : coarseQuadriga({ horseMaterial: M.gildedBronze, carMaterial: M.gold });
  quadriga.scale.setScalar(1.8);
  quadriga.rotation.y = Math.PI;
  quadriga.position.set(x + 1, 20.8, 0);
  stadium.add(quadriga);

  // The gates themselves, the ceremonial gateway through the middle of the carceres with its marble
  // voussoirs and flanking pilasters, and the arches at the back through which the teams came in.
  const gates = windowRow({ count: 12, spacing: 9.5, width: 5, height: 8, y: 0.5, skip: (z) => Math.abs(z) < 8 });
  gates.position.x = GATES_X - 0.05;
  gates.rotation.y = -Math.PI / 2;
  stadium.add(gates);
  const rear = windowRow({ count: 12, spacing: 9.5, width: 3.6, height: 6.5, y: 0.5, skip: (z) => Math.abs(z) < 8 });
  rear.position.x = x + 6.05;
  rear.rotation.y = Math.PI / 2;
  stadium.add(rear);
  for (const [dx, facing] of [[-7.05, -Math.PI / 2], [7.05, Math.PI / 2]]) {
    const arch = mesh(archGeometry(6, 11), M.opening, x + dx, 0.5, 0);
    arch.rotation.y = facing;
    stadium.add(arch);
    const voussoirs = archBand(3.1, 4.0, 0.7, M.marble, x + dx, 8.5, 0);
    voussoirs.rotation.y = facing;
    stadium.add(voussoirs);
    for (const dz of [-4.6, 4.6]) stadium.add(box(0.7, 12.7, 1.2, M.marble, x + dx, 0, dz)); // sunk into the string course above
  }

  if (!detail) return;

  // The gallery of windows over the gates, the pair over the gateway and the towers' windows.
  const gallery = windowRow({ count: 11, spacing: 9.5, width: 2.4, height: 3.2, y: 9, skip: (z) => Math.abs(z) < 8 });
  gallery.position.x = GATES_X - 0.05;
  gallery.rotation.y = -Math.PI / 2;
  stadium.add(gallery);
  for (const [dx, facing] of [[-7.05, -Math.PI / 2], [7.05, Math.PI / 2]]) {
    const windows = windowRow({ count: 2, spacing: 8, width: 2, height: 4, y: 13.5 });
    windows.position.set(x + dx, 0, 0);
    windows.rotation.y = facing;
    stadium.add(windows);
  }
  for (const side of [-1, 1]) {
    for (const [dx, facing] of [[-7.55, -Math.PI / 2], [7.55, Math.PI / 2]]) {
      const windows = windowRow({ count: 2, spacing: 5, width: 1.6, height: 3, y: 14.5 });
      windows.position.set(x + dx, 0, side * 66);
      windows.rotation.y = facing;
      stadium.add(windows);
    }
    const windows = windowRow({ count: 2, spacing: 5, width: 1.6, height: 3, y: 14.5 });
    windows.position.set(x, 0, side * 73.55);
    windows.rotation.y = side > 0 ? 0 : Math.PI;
    stadium.add(windows);
  }
}

/**
 * The spectators: one coloured figure (a four-sided pyramid, seen from the
 * air a speck) on each seat, in one merged geometry with vertex colours.
 * The stands fill most near the kathisma and the finish; the Blues sit in
 * the section to the emperor's right (+x), the Greens to his left, among
 * the plain white, ochre and brown tunics of everyone else.
 */
function addCrowd(stadium, { rows, run, rise, landing }) {
  const rnd = createRandom(532);
  const plain = [
    [0.93, 0.9, 0.82], [0.9, 0.86, 0.74], [0.84, 0.76, 0.58], [0.78, 0.62, 0.42], [0.56, 0.42, 0.3], [0.64, 0.6, 0.54], [0.82, 0.72, 0.55],
    [0.7, 0.3, 0.24], [0.88, 0.84, 0.8],
  ];
  const blues = [[0.16, 0.3, 0.64], [0.24, 0.42, 0.78], [0.1, 0.2, 0.5]];
  const greens = [[0.2, 0.5, 0.24], [0.3, 0.6, 0.3], [0.14, 0.38, 0.18]];
  const density = (x, z, k) => {
    let d = 0.6;
    d += 0.35 * Math.exp(-(((x - 45) / 75) ** 2)) * (z > 0 ? 1 : 0.65);
    if (x < SPHENDONE_X) d -= 0.12;
    if (k === landing) d *= 0.2;
    return Math.min(d, 0.95);
  };
  const pick = (x, z) => {
    const faction = z > 0 && x > 58 && x < 118 ? blues : z > 0 && x > -38 && x < 22 ? greens : null;
    if (faction && rnd.chance(0.6)) return rnd.pick(faction);
    const r = rnd.next();
    if (r < 0.05) return rnd.pick(blues);
    if (r < 0.1) return rnd.pick(greens);
    return rnd.pick(plain);
  };

  const figures = [];
  const consider = (x, z, y, k, standing = false) => {
    if (onStairway(x, z)) return;
    if (z > 49 && x > 24 && x < 56) return; // inside the kathisma
    if (!rnd.chance(density(x, z, k))) return;
    figures.push({ x, y, z, color: pick(x, z), scale: rnd.range(0.85, 1.15) * (standing ? 1.25 : 1), angle: rnd.range(-0.5, 0.5) });
  };
  const spacing = 1.1;
  const seatRow = (radius, y, k, standing) => {
    for (const side of [-1, 1]) {
      for (let x = SPHENDONE_X + rnd.next() * spacing; x < GATES_X - 2; x += spacing) {
        consider(x + rnd.range(-0.3, 0.3), side * radius + rnd.range(-0.2, 0.2), y, k, standing);
      }
    }
    const count = Math.round((Math.PI * radius) / spacing);
    for (let i = 0; i < count; i++) {
      const angle = Math.PI / 2 + ((i + rnd.range(0.2, 0.8)) / count) * Math.PI;
      consider(SPHENDONE_X + Math.cos(angle) * radius, Math.sin(angle) * radius, y, k, standing);
    }
  };
  for (let k = 0; k < rows; k++) {
    seatRow(ARENA + k * run + run * 0.62, PODIUM + (k + 1) * rise - (k === landing ? rise * 0.5 : 0), k, false);
  }
  // A thinner line of people standing on the upper walkway, under the portico.
  seatRow(SEATS_TOP + 1.2, FACADE_HEIGHT + 0.5, landing, true);

  // One pyramid per figure: a square base 1 m across and an apex 1.5 m up, leaning nowhere.
  const half = 0.5;
  const height = 1.5;
  const corners = [[-half, half], [half, half], [half, -half], [-half, -half]];
  const positions = new Float32Array(figures.length * 12 * 3);
  const colors = new Float32Array(figures.length * 12 * 3);
  let p = 0;
  for (const { x, y, z, color, scale, angle } of figures) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const put = (lx, ly, lz) => {
      positions[p] = x + (lx * cos + lz * sin) * scale;
      positions[p + 1] = y + ly * scale;
      positions[p + 2] = z + (-lx * sin + lz * cos) * scale;
      colors[p] = color[0];
      colors[p + 1] = color[1];
      colors[p + 2] = color[2];
      p += 3;
    };
    for (let i = 0; i < 4; i++) {
      const [ax, az] = corners[i];
      const [bx, bz] = corners[(i + 1) % 4];
      put(ax, 0, az);
      put(bx, 0, bz);
      put(0, height, 0);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const crowd = new THREE.Mesh(geometry, crowdMaterial);
  crowd.castShadow = true;
  crowd.receiveShadow = true;
  stadium.add(crowd);

  // Faction banners over the demes' sections on the walkway.
  for (const [x, color] of [[88, 0x2f5da8], [-8, 0x3a8a3c]]) {
    stadium.add(cylinder(0.08, 0.1, 7, M.wood, x, FACADE_HEIGHT + 0.5, SEATS_TOP + 0.8, 6));
    stadium.add(box(0.1, 3.2, 2.0, cloth(color), x, FACADE_HEIGHT + 4.2, SEATS_TOP + 1.8));
  }
}

/** Four teams — Blues, Greens, Reds and Whites — racing round the spina. */
function addChariots(stadium) {
  const teams = [
    { color: 0x2f5da8, lane: 15, speed: 17, offset: 0 },
    { color: 0x3a8a3c, lane: 19, speed: 16.4, offset: 30 },
    { color: 0xb3302c, lane: 23, speed: 16.8, offset: 70 },
    { color: 0xf2efe6, lane: 27, speed: 16, offset: 110 },
  ];
  for (const { color, lane, speed, offset } of teams) {
    const chariot = createChariot({ horseMaterial: M.trunk, carMaterial: M.gold, colorMaterial: cloth(color) });
    chariot.scale.setScalar(1.6);
    chariot.position.y = 0.05;
    const perimeter = 2 * (META_X[1] - META_X[0]) + 2 * Math.PI * lane;
    chariot.userData.animate = (time) => {
      const { x, z, heading } = trackPoint((time * speed + offset) % perimeter, lane);
      chariot.position.x = x;
      chariot.position.z = z;
      chariot.rotation.y = heading;
    };
    chariot.userData.animate(0); // on its lane from the start, not stacked with the others at the origin
    stadium.add(chariot);
  }
}

/** Position and heading at distance s along a lap of the given radius. */
function trackPoint(s, radius) {
  const [x0, x1] = META_X;
  const straight = x1 - x0;
  const turn = Math.PI * radius;
  if (s < straight) return { x: x0 + s, z: radius, heading: 0 };
  s -= straight;
  if (s < turn) {
    const a = s / radius;
    return { x: x1 + radius * Math.sin(a), z: radius * Math.cos(a), heading: a };
  }
  s -= turn;
  if (s < straight) return { x: x1 - s, z: -radius, heading: Math.PI };
  const a = (s - straight) / radius;
  return { x: x0 - radius * Math.sin(a), z: -radius * Math.cos(a), heading: Math.PI + a };
}

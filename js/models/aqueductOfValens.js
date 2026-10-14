import * as THREE from 'three';
import { materials as M, tinted } from './lib/materials.js';
import { archShape, box, cylinder, cypress, dome, faceToward, gableRoof, groundPlane, judasTree, mesh, roundTree } from './lib/primitives.js';
import { createHouse, pickHouseVariant } from './lib/buildings.js';
import { createRandom } from '../util/random.js';
import { finalizeModel } from './lib/merge.js';

/**
 * The Aqueduct of Valens (Bozdoğan Kemeri), completed in 368: a bridge of
 * limestone ashlar, 971 m long and up to 29 m high, carrying the city's
 * water across the valley between the Third and Fourth Hills. Where the
 * valley is deepest it has two tiers of arches: a tall lower order of 4 m
 * spans between 3.7 m piers, and a shorter upper order under the water
 * channel. Towards either hill the ground rises past the lower arches and
 * the bridge runs on as a single arcade until it meets the slope. Shown as
 * a 300 m stretch running along x; the specus with its parapets runs along
 * the top, and a street passes through the tall central arches, as the
 * valley road always has.
 *
 * The valley sides carry what such a quarter would have had: lanes
 * climbing each hill, walled gardens, houses and a small church on either
 * slope. None of it records a known building.
 *
 * Sources: Wikipedia, Aqueduct of Valens (971 m, 7.75–8.24 m wide, c. 29 m
 * high, piers 3.70 m, lower spans c. 4 m, arches 18–73 double); Byzantium
 * 1200; archnet.
 */

const HALF = 152; // 39 bays of 7.7 m
const SPAN = 7.7; // bay pitch: a 4 m arch plus a 3.7 m pier
const RADIUS = 2; // lower arches
const UPPER_RADIUS = 1.75;
const WIDTH = 8; // thickness of the bridge
const TOP = 12.2; // top of the upper arcade (the cornice and parapets rise above it)
const STRING = 2.0; // string course between the tiers
const LOWER_SPRING = -1.2; // lower arches close just under the string course
const UPPER_BOTTOM = STRING + 0.7; // the upper arches' sills, a little above the string course's top
const UPPER_SPRING = 8.6;
const DEEP = LOWER_SPRING - 2; // ground lower than this gets a lower arch
const MARGIN = 14; // ground beyond the ends of the stretch
const DEPTH = 66; // ground either side of the arcade
const ROAD_X = -HALF + 19.5 * SPAN; // the street passes under the bay nearest the middle

/** Valley profile along the arcade: the floor 17 m down in the middle, the hills rising 1.5 m above datum at the ends and on beyond them. */
function valley(x) {
  const a = Math.min(Math.abs(x), HALF);
  const beyond = Math.max(0, Math.abs(x) - HALF);
  const hill = x > 0 ? 1.0 : 0.85; // the Third Hill, east, a little steeper than the Fourth
  return 1.5 - 18.5 * Math.pow(Math.cos((a / HALF) * (Math.PI / 2)), 1.5) + beyond * 0.09 * hill;
}

/** The ground: the valley profile, falling gently northwards (-z) as the valley drains to the Horn, with a little undulation in the diorama. */
function groundAt(x, z, detail = true) {
  const bump = detail ? 0.25 * Math.sin(x * 0.17 + 0.8) * Math.sin(z * 0.13 - 0.3) + 0.15 * Math.sin(x * 0.05 + z * 0.09) : 0;
  return valley(x) - 0.035 * z + bump * Math.min(1, Math.max(0, (Math.abs(z) - 6) / 10));
}

export function createAqueductOfValens({ lod = 'detail' } = {}) {
  const detail = lod === 'detail';
  // On the flat map both tiers stand on level ground, as the aqueduct is usually pictured.
  const ground = detail ? valley : () => -13;
  const ashlar = valensAshlar();
  const aqueduct = new THREE.Group();
  const structure = new THREE.Group();
  aqueduct.add(structure);

  const bays = Math.round((HALF * 2) / SPAN);
  const wall = new THREE.ExtrudeGeometry(arcadeShape(ground, bays), { depth: WIDTH, bevelEnabled: false, curveSegments: detail ? 8 : 6 });
  structure.add(mesh(wall.translate(0, 0, -WIDTH / 2), ashlar));

  // String course between the orders, the corbelled cornice, and the channel with its parapets on top.
  structure.add(box(HALF * 2 + 1, 0.6, WIDTH + 0.8, ashlar, 0, STRING, 0));
  structure.add(box(HALF * 2 + 1, 0.5, WIDTH + 0.6, ashlar, 0, TOP, 0));
  structure.add(box(HALF * 2 + 1.4, 0.4, WIDTH + 1.3, ashlar, 0, TOP + 0.5, 0));
  for (const side of [-1, 1]) structure.add(box(HALF * 2, 2.0, 1.6, ashlar, 0, TOP + 0.9, side * (WIDTH / 2 - 0.8)));
  structure.add(box(HALF * 2, 0.4, WIDTH - 3.2, ashlar, 0, TOP + 0.9, 0)); // channel bed
  structure.add(groundPlane(HALF * 2, 2.2, M.water, 0, TOP + 2.3, 0)); // the water in the specus

  addDetails(structure, bays, ground, detail, ashlar);
  if (detail) {
    addValley(structure);
  } else {
    structure.position.y = 13;
  }
  return finalizeModel(aqueduct);
}

/**
 * Brick arch rings, imposts and pier footings that give the ashlar its
 * rhythm. The map keeps all of them (they are what makes the bridge read as
 * an aqueduct from above), drawn with fewer curve segments.
 */
function addDetails(structure, bays, ground, detail, ashlar) {
  const segments = detail ? 8 : 4;
  const upperRing = archRingGeometry(UPPER_RADIUS, UPPER_SPRING - UPPER_BOTTOM, 0.42, segments);
  const lowerRings = new Map(); // by jamb height, shared between bays on level ground
  for (let i = 0; i < bays; i++) {
    const centre = -HALF + (i + 0.5) * SPAN;
    const deep = ground(centre) < DEEP;
    for (const side of [-1, 1]) {
      const ring = mesh(upperRing, M.brick, centre, UPPER_BOTTOM, side * (WIDTH / 2 + 0.06));
      if (side < 0) ring.rotation.y = Math.PI;
      structure.add(ring);
      if (!deep) continue;
      const foot = ground(centre) - 0.8; // the ring runs on a little below the ground, which is never quite level
      const jamb = +(LOWER_SPRING - foot).toFixed(2);
      if (!lowerRings.has(jamb)) lowerRings.set(jamb, archRingGeometry(RADIUS, jamb, 0.5, segments));
      const lower = mesh(lowerRings.get(jamb), M.brick, centre, foot, side * (WIDTH / 2 + 0.06));
      if (side < 0) lower.rotation.y = Math.PI;
      structure.add(lower);
    }
    // Imposts at the springing of both orders, and stepped footings where the piers stand deep in the valley
    // (the map, on level ground, keeps the imposts; its footings would lie buried in the terrain).
    const pierX = -HALF + i * SPAN;
    if (Math.abs(pierX) >= HALF - 1) continue;
    structure.add(box(SPAN - UPPER_RADIUS * 2 + 0.3, 0.35, WIDTH + 0.5, ashlar, pierX, UPPER_SPRING - 0.35, 0));
    const foot = ground(pierX);
    if (foot < LOWER_SPRING - 3) {
      if (detail) {
        structure.add(box(SPAN - RADIUS * 2 + 1.6, 1.0, WIDTH + 2.0, ashlar, pierX, foot - 1.2, 0));
        structure.add(box(SPAN - RADIUS * 2 + 0.9, 0.9, WIDTH + 1.1, ashlar, pierX, foot - 0.3, 0));
      }
      structure.add(box(SPAN - RADIUS * 2 + 0.6, 0.5, WIDTH + 0.6, ashlar, pierX, LOWER_SPRING - 0.5, 0));
    }
  }
}

/**
 * A brick ring around an arch of the given radius whose jambs rise from
 * y = 0 to `spring` (the arch crown is then at spring + radius), as a thin
 * plate facing +z.
 */
function archRingGeometry(radius, spring, thickness, segments = 8) {
  const outer = archShape((radius + thickness) * 2, spring + radius + thickness, 0, 0);
  outer.holes.push(archShape(radius * 2, spring + radius, 0, 0));
  return new THREE.ShapeGeometry(outer, segments);
}

/** Elevation of the arcade: a foot sunk a little into the ground, lower arches where the valley is deep, upper arches as holes. */
function arcadeShape(ground, bays) {
  const foot = (x) => ground(x) - 1.2;
  const shape = new THREE.Shape();
  shape.moveTo(-HALF, foot(-HALF));
  for (let i = 0; i < bays; i++) {
    const centre = -HALF + (i + 0.5) * SPAN;
    const left = centre - RADIUS;
    const right = centre + RADIUS;
    shape.lineTo(left, foot(left));
    if (ground(centre) < DEEP) {
      shape.lineTo(left, LOWER_SPRING);
      shape.absarc(centre, LOWER_SPRING, RADIUS, Math.PI, 0, true);
    }
    shape.lineTo(right, foot(right));
    shape.holes.push(archShape(UPPER_RADIUS * 2, UPPER_SPRING - UPPER_BOTTOM + UPPER_RADIUS, centre, UPPER_BOTTOM));
  }
  shape.lineTo(HALF, foot(HALF));
  shape.lineTo(HALF, TOP);
  shape.lineTo(-HALF, TOP);
  shape.lineTo(-HALF, foot(-HALF));
  return shape;
}

// ---------- the valley ----------

// Tints for the pale cover texture, given in sRGB and multiplied in linear light: grass, dust, garden plots, dry scrub, and the earth of the cut sides.
const TINTS = [0x7c9c58, 0xeedec0, 0x6a9452, 0xa8b47c].map((hex) => new THREE.Color(hex).toArray());
const EARTH = new THREE.Color(0x8f7155).toArray();
const GARDENS = [[-146, -60, -104, -38], [-140, 40, -100, 60], [104, -62, 146, -40], [100, 36, 142, 60], [-62, 36, -22, 58], [20, -58, 60, -36]];

/** The valley sides: the ground, the street and the lanes, gardens, houses, a church on each hill, and trees. */
function addValley(structure) {
  structure.add(createValleyGround());
  const rnd = createRandom(368);
  const ground = (x, z) => groundAt(x, z, true);
  const lane = tinted('dirt', 0xb59c7a);

  // The street through the central arch, and the lanes that climb the hills from it.
  structure.add(ribbon([[ROAD_X, -DEPTH], [ROAD_X, -12, 3.4], [ROAD_X, 12, 3.4], [ROAD_X, DEPTH]], 5.5, lane, ground));
  const lanes = [
    [[ROAD_X - 2, -22], [-40, -28], [-80, -21], [-118, -32], [-HALF - 10, -40]],
    [[ROAD_X - 2, 20], [-50, 30], [-96, 25], [-140, 36]],
    [[ROAD_X + 2, -20], [36, -30], [80, -24], [122, -36], [HALF + 10, -44]],
    [[ROAD_X + 2, 26], [40, 22], [90, 34], [136, 28]],
  ];
  for (const points of lanes) structure.add(ribbon(points, 3, lane, ground));

  // Walled gardens on the slopes.
  const gardenWall = tinted('rubble', 0xcbbda4);
  for (const [x0, z0, x1, z1] of GARDENS.slice(0, 4)) {
    for (const [cx, cz, w, d] of [[(x0 + x1) / 2, z0, x1 - x0, 0.6], [(x0 + x1) / 2, z1, x1 - x0, 0.6], [x0, (z0 + z1) / 2, 0.6, z1 - z0], [x1, (z0 + z1) / 2, 0.6, z1 - z0]]) {
      structure.add(lowWall(cx, cz, w, d, 1.4, gardenWall, ground));
    }
  }
  // Fruit trees in the gardens.
  for (const [x0, z0, x1, z1] of GARDENS) {
    for (const [u, v] of [[0.3, 0.35], [0.7, 0.65]]) {
      const [x, z] = [x0 + (x1 - x0) * u, z0 + (z1 - z0) * v];
      structure.add(roundTree(rnd.range(5, 7), x, ground(x, z), z));
    }
  }

  // Houses along the lanes, and a church on either hill.
  const avoid = [[0, 0, 0]];
  const avoidRects = [[-HALF - 2, -9, HALF + 2, 9], [ROAD_X - 4, -DEPTH, ROAD_X + 4, DEPTH], ...GARDENS];
  const clear = (x, z, r) =>
    Math.abs(x) < HALF + MARGIN - r - 1 && Math.abs(z) < DEPTH - r - 1 &&
    !avoid.some(([ax, az, ar]) => Math.hypot(x - ax, z - az) < ar + r) &&
    !avoidRects.some(([x0, z0, x1, z1]) => x > x0 - r && x < x1 + r && z > z0 - r && z < z1 + r);
  for (const [x, z, heading] of [[-124, 30, 0.1], [118, -30, -0.15]]) {
    addChapel(structure, x, z, heading, ground);
    avoid.push([x, z, 14]);
  }
  for (const points of lanes) {
    for (let i = 0; i < points.length - 1; i++) {
      const [x0, z0] = points[i];
      const [x1, z1] = points[i + 1];
      const length = Math.hypot(x1 - x0, z1 - z0);
      const [tx, tz] = [(x1 - x0) / length, (z1 - z0) / length];
      const theta = Math.atan2(tz, tx);
      for (const side of [-1, 1]) {
        let along = rnd.range(3, 10);
        while (along < length - 5) {
          const w = rnd.range(7, 11);
          const d = rnd.range(6, 9);
          const h = rnd.range(5, 9);
          const offset = 2.5 + d / 2;
          const x = x0 + tx * along - tz * side * offset;
          const z = z0 + tz * along + tx * side * offset;
          along += w + rnd.range(3, 9);
          if (!clear(x, z, Math.max(w, d) / 2 + 0.5)) continue;
          const rotation = side < 0 ? -theta : Math.PI - theta; // the house's windows look onto the lane
          structure.add(houseOnSlope(rnd, { w, d, h, x, z, rotation, ground }));
          avoid.push([x, z, Math.max(w, d) / 2 + 1.5]);
        }
      }
    }
  }

  // Trees: cypresses by the chapels and on the ridges, plane trees along the street, erguvans in flower on the slopes.
  for (const [x, z] of [[-134, 40], [-114, 40], [108, -40], [128, -40], [-146, -12], [146, 14], [-100, 50], [96, 52]]) {
    structure.add(cypress(rnd.range(10, 14), x, ground(x, z), z));
  }
  for (const [x, z] of [[ROAD_X - 6, -44], [ROAD_X + 7, -30], [ROAD_X + 6, 40], [ROAD_X - 7, 56]]) structure.add(roundTree(9, x, ground(x, z), z));
  for (const [x, z, seed] of [[-70, -40, 1], [48, 44, 2], [-30, 48, 3]]) structure.add(judasTree(7, x, ground(x, z), z, { seed }));
  let planted = 0;
  for (let attempt = 0; attempt < 300 && planted < 16; attempt++) {
    const x = rnd.range(-HALF - 8, HALF + 8);
    const z = rnd.pick([-1, 1]) * rnd.range(14, DEPTH - 6);
    if (!clear(x, z, 4)) continue;
    const kind = rnd.next();
    if (kind < 0.35) structure.add(cypress(rnd.range(9, 13), x, ground(x, z), z));
    else if (kind < 0.75) structure.add(roundTree(rnd.range(6, 9), x, ground(x, z), z));
    else structure.add(judasTree(rnd.range(5, 7), x, ground(x, z), z, { seed: planted + 4, detail: false }));
    avoid.push([x, z, 3]);
    planted++;
  }
}

/**
 * The valley floor and sides as one height field, its vertex colours
 * tinting a pale cover: dust under the arcade and along the street, grass
 * on the slopes, darker green in the gardens; closed by earth-brown skirts.
 */
function createValleyGround() {
  const grid = (from, to) => Array.from({ length: Math.round((to - from) / 2.5) + 1 }, (_, i) => from + i * 2.5);
  const xs = grid(-HALF - MARGIN, HALF + MARGIN);
  const zs = grid(-DEPTH, DEPTH);
  return mesh(heightfieldGeometry(xs, zs, (x, z) => groundAt(x, z, true) - 0.05, coverAt, -22), coverMaterial());
}

/**
 * A height field over the grid xs × zs, coloured per vertex, closed by
 * earth-coloured skirts down to `base` so the ground reads as a solid block
 * from every side.
 */
function heightfieldGeometry(xs, zs, heightAt, colourAt, base, earth = EARTH) {
  const positions = [];
  const colours = [];
  const uvs = [];
  const indices = [];
  const columns = xs.length;
  for (const z of zs) {
    for (const x of xs) {
      positions.push(x, heightAt(x, z), z);
      colours.push(...colourAt(x, z));
      uvs.push(x, z);
    }
  }
  for (let j = 0; j < zs.length - 1; j++) {
    for (let i = 0; i < columns - 1; i++) {
      const a = j * columns + i;
      const b = a + columns;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const edges = [
    { points: xs.map((x) => [x, zs[0]]), outward: [0, -1] },
    { points: xs.map((x) => [x, zs[zs.length - 1]]), outward: [0, 1] },
    { points: zs.map((z) => [xs[0], z]), outward: [-1, 0] },
    { points: zs.map((z) => [xs[xs.length - 1], z]), outward: [1, 0] },
  ];
  for (const { points, outward: [ox, oz] } of edges) {
    const start = positions.length / 3;
    for (const [x, z] of points) {
      const top = heightAt(x, z);
      positions.push(x, top, z, x, base, z);
      colours.push(...earth, ...earth);
      uvs.push(ox ? z : x, top, ox ? z : x, base);
    }
    for (let i = 0; i < points.length - 1; i++) {
      const [top, bottom, nextTop, nextBottom] = [start + i * 2, start + i * 2 + 1, start + i * 2 + 2, start + i * 2 + 3];
      const dx = points[i + 1][0] - points[i][0];
      const dz = points[i + 1][1] - points[i][1];
      if (-dz * ox + dx * oz >= 0) indices.push(top, bottom, nextBottom, top, nextBottom, nextTop);
      else indices.push(top, nextBottom, bottom, top, nextTop, nextBottom);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function coverAt(x, z) {
  const [grass, dust, garden, scrub] = TINTS;
  if (Math.abs(z) < 7 || Math.abs(x - ROAD_X) < 5) return dust;
  if (GARDENS.some(([x0, z0, x1, z1]) => x >= x0 && x <= x1 && z >= z0 && z <= z1)) return garden;
  const n = 0.5 + 0.5 * Math.sin(x * 0.08 + 1.1) * Math.sin(z * 0.11 + 0.4);
  const fade = Math.min(1, (Math.abs(z) - 7) / 10); // the dust of the arcade's foot gives way to grass
  const tone = n > 0.42 ? grass : n > 0.28 ? scrub : dust;
  return tone.map((c, k) => dust[k] + (c - dust[k]) * fade);
}

/** A strip of ground following the terrain (streets and lanes), lifted just above it; points are [x, z, width?]. */
function ribbon(points, width, material, heightAt, lift = 0.2) {
  const path = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, z0, w0 = width] = points[i];
    const [x1, z1, w1 = width] = points[i + 1];
    const pieces = Math.max(1, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 3));
    for (let k = 0; k < pieces; k++) {
      const t = k / pieces;
      path.push([x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, w0 + (w1 - w0) * t]);
    }
  }
  const last = points[points.length - 1];
  path.push([last[0], last[1], last[2] ?? width]);
  const positions = [];
  const uvs = [];
  let along = 0;
  for (let i = 0; i < path.length; i++) {
    const [x, z, w] = path[i];
    const [px, pz] = path[Math.max(0, i - 1)];
    const [nx, nz] = path[Math.min(path.length - 1, i + 1)];
    const length = Math.hypot(nx - px, nz - pz) || 1;
    const [tx, tz] = [(nx - px) / length, (nz - pz) / length];
    if (i > 0) along += Math.hypot(x - px, z - pz);
    for (const side of [-1, 1]) {
      const sx = x - tz * side * (w / 2);
      const sz = z + tx * side * (w / 2);
      positions.push(sx, heightAt(sx, sz) + lift, sz);
      uvs.push(along, side > 0 ? w : 0);
    }
  }
  const indices = [];
  for (let i = 0; i < path.length - 1; i++) {
    const a = i * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const strip = mesh(geometry, material);
  strip.castShadow = false;
  return strip;
}

/** A low wall of w × d footprint whose foot is sunk below the lowest corner of the slope and whose top is level. */
function lowWall(x, z, w, d, height, material, ground) {
  const corners = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([cx, cz]) => ground(x + cx, z + cz));
  const foot = Math.min(...corners) - 0.5;
  return box(w, Math.max(...corners) + height - foot, d, material, x, foot, z);
}

/** A plastered house set on a rubble plinth that takes up the slope, its windows on the +z face. */
function houseOnSlope(rnd, { w, d, h, x, z, rotation, ground }) {
  const holder = new THREE.Group();
  const corners = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([cx, cz]) =>
    ground(x + cx * Math.cos(rotation) + cz * Math.sin(rotation), z - cx * Math.sin(rotation) + cz * Math.cos(rotation)));
  const floor = Math.max(...corners) + 0.05;
  const foot = Math.min(...corners) - 0.6;
  holder.add(box(w + 0.4, floor - foot, d + 0.4, M.rubble, 0, foot - floor, 0));
  holder.add(createHouse({ w, d, h, color: rnd.pick([0xf2e3c6, 0xe8cfa6, 0xf5eee0, 0xdcb98e, 0xe9d2b8, 0xd6a982]), variant: pickHouseVariant(rnd, w) }));
  holder.position.set(x, floor, z);
  holder.rotation.y = rotation;
  return holder;
}

/** A small domed chapel on a plinth, its apse to the east (+x), with a cypress or two beside it. */
function addChapel(structure, x, z, heading, ground) {
  const chapel = new THREE.Group();
  const corners = [[-9, -7], [9, -7], [9, 7], [-9, 7]].map(([cx, cz]) =>
    ground(x + cx * Math.cos(heading) + cz * Math.sin(heading), z - cx * Math.sin(heading) + cz * Math.cos(heading)));
  const floor = Math.max(...corners) + 0.3;
  const foot = Math.min(...corners) - 0.6;
  chapel.add(box(18, floor - foot, 14, M.rubble, 0, foot - floor, 0)); // the plinth
  chapel.add(box(14, 7, 10, M.brick, 0, 0, 0));
  chapel.add(box(14.4, 0.4, 10.4, M.lead, 0, 7, 0));
  chapel.add(gableRoof(14, 10, 2.6, M.roof, 0, 7.4, 0, 0.3));
  chapel.add(cylinder(2.6, 2.6, 2.6, M.brick, 0, 7.4, 0, 12));
  chapel.add(dome(2.6, M.lead, 0, 10, 0, { heightScale: 0.8, segments: 16 }));
  chapel.add(faceToward(cylinder(2.4, 2.4, 5.5, M.brick, 7, 0, 0, 10, { thetaStart: -Math.PI / 2, thetaLength: Math.PI }), 1, 0));
  chapel.add(faceToward(dome(2.4, M.lead, 7, 5.5, 0, { phiLength: Math.PI, heightScale: 0.7, segments: 16 }), 1, 0));
  chapel.add(box(4, 5, 10.4, M.brick, -9, 0, 0)); // the narthex
  chapel.add(box(4.4, 0.4, 10.8, M.lead, -9, 5, 0));
  chapel.position.set(x, floor, z);
  chapel.rotation.y = heading;
  structure.add(chapel);
}

// ---------- local textures ----------

const textureCache = new Map();

function canvasMaterial(name, tile, paint, params = {}) {
  if (textureCache.has(name)) return textureCache.get(name);
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  paint(ctx, size, createRandom(name.length * 368));
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1 / tile, 1 / tile);
  texture.anisotropy = 8;
  const material = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.9, metalness: 0, ...params });
  textureCache.set(name, material);
  return material;
}

/**
 * The aqueduct's limestone: large blocks in running bond, each a slightly
 * different tone, from pale cream to grey and a rusty ochre, as the
 * weathered stone of the bridge is today. Tiles every 4 m.
 */
function valensAshlar() {
  return canvasMaterial('valens-ashlar', 4, (ctx, size, rnd) => {
    ctx.fillStyle = 'rgb(150, 142, 126)';
    ctx.fillRect(0, 0, size, size);
    const tones = [[206, 198, 178], [196, 192, 180], [214, 202, 176], [190, 178, 154], [204, 190, 160], [182, 176, 166]];
    const courseHeight = 32; // half-metre blocks
    for (let y = 0; y < size; y += courseHeight) {
      let x = -rnd.next() * 60;
      while (x < size) {
        const length = 44 + rnd.next() * 56;
        const tone = rnd.pick(tones);
        const k = 1 + (rnd.next() - 0.5) * 0.12;
        ctx.fillStyle = `rgb(${(tone[0] * k) | 0}, ${(tone[1] * k) | 0}, ${(tone[2] * k) | 0})`;
        for (const ox of [0, -size, size]) ctx.fillRect(x + ox + 1.5, y + 1.5, length - 3, courseHeight - 3);
        x += length;
      }
    }
    for (let i = 0; i < 2600; i++) {
      ctx.fillStyle = `rgba(95, 85, 70, ${0.08 + rnd.next() * 0.14})`;
      const s = 0.6 + rnd.next() * 1.6;
      ctx.fillRect(rnd.next() * size, rnd.next() * size, s, s);
    }
    // Streaks of weathering down the face.
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `rgba(120, 100, 70, ${0.04 + rnd.next() * 0.06})`;
      ctx.fillRect(rnd.next() * size, rnd.next() * size, 2 + rnd.next() * 3, 20 + rnd.next() * 60);
    }
  });
}

/** A pale, lightly mottled ground that the valley's vertex colours tint to grass, dust or garden. */
function coverMaterial() {
  return canvasMaterial('valens-cover', 6, (ctx, size, rnd) => {
    ctx.fillStyle = 'rgb(214, 206, 186)';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 60; i++) {
      const x = rnd.next() * size;
      const y = rnd.next() * size;
      const r = 12 + rnd.next() * 26;
      const dark = rnd.next() < 0.5;
      for (const [ox, oy] of [[0, 0], [-size, 0], [size, 0], [0, -size], [0, size]]) {
        const gradient = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
        gradient.addColorStop(0, dark ? 'rgba(170, 164, 140, 0.45)' : 'rgba(236, 230, 210, 0.4)');
        gradient.addColorStop(1, 'rgba(200, 194, 176, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
      }
    }
    for (let i = 0; i < 4000; i++) {
      ctx.fillStyle = `rgba(140, 134, 110, ${0.1 + rnd.next() * 0.2})`;
      const s = 0.6 + rnd.next() * 1.4;
      ctx.fillRect(rnd.next() * size, rnd.next() * size, s, s);
    }
  }, { vertexColors: true });
}

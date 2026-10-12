import * as THREE from 'three';
import { materials as M, tinted } from './lib/materials.js';
import {
  archGeometry, archedWallGeometry, box, colonnade, crenelRingGeometry, crenellationGeometry, cylinder, cylinderGeometry, cypress, dome,
  faceToward, flag, gableRoof, groundPlane, hipRoof, mesh, regularOpenings, judasTree, roundTree, scaleUV, stairs, windowRow,
} from './lib/primitives.js';
import { createHull } from './lib/hull.js';
import { finalizeModel } from './lib/merge.js';
import { labelAt, labelled } from './lib/parts.js';
import { createRandom } from '../util/random.js';

/**
 * Blachernae, the north-west corner of the city where the Komnenian and
 * Palaiologan emperors lived from the late 11th century. The Golden Horn
 * lies to the north (-z), the land walls to the west (-x), and the quarter
 * climbs the flank of the Sixth Hill towards the south.
 *  - the palace stands on three brick-faced terraces cut into the hill (the
 *    surviving substructures are huge arcaded vaults): a lower garden walk
 *    above the shore, the main terrace with the Komnenian halls, and the
 *    upper terrace with Tekfur Sarayı, the kitchens and the guard's hall;
 *  - the halls: Manuel I's hall with its two-tiered marble loggia looking
 *    down over the Horn, the hall of Alexios I with its apse, the palace
 *    chapel, a keep, and a garden court with a fountain and cypresses. The
 *    halls' names are known from the sources; their plans and positions are
 *    invented, since nothing of them stands above ground;
 *  - Manuel I's wall of great ashlar blocks, with round and octagonal towers,
 *    closes the quarter to the west; at its north end rise the twin towers
 *    of Isaac Angelos (a residential tower with a balcony) and Anemas (the
 *    imperial prison), fronted by a massive buttress;
 *  - the Palace of the Porphyrogenitus (Tekfur Sarayı, late 13th c.): three
 *    storeys, its courtyard façade a diaper of red brick and white stone
 *    over a four-arched arcade, with five windows above and seven on the
 *    top floor, which looks out on every side;
 *  - the walls of Heraclius and Leo along the Horn, with Theophilos' three
 *    hexagonal towers, sheltering the church of St Mary of Blachernae: the
 *    basilica, the round chapel of the Holy Soros which held the Virgin's
 *    robe, and the holy spring (hagiasma) with its bathing pool;
 *  - the quarter itself: tall narrow houses along lanes climbing the hill,
 *    a landing stage and boats outside the water gate. All of it is a
 *    plausible invention for a district whose fabric is lost.
 *
 * Sources: Wikipedia, Blachernae Palace, Palace of the Porphyrogenitus,
 * Prison of Anemas, Church of St. Mary of Blachernae, Walls of
 * Constantinople (Blachernae section); thebyzantinelegacy.com, Blachernai
 * Palace; Byzantium 1200.
 */

const WALL_X = -122; // Manuel's wall
const HORN_Z = -88; // the sea wall along the Horn
const PALACE_EAST = 30; // east edge of the palace terraces; the town climbs the open hillside beyond
const SLAB = { x0: -120, x1: 130, z0: -90, z1: 100 }; // the ground slab (its footprint levels the map terrace)
// The palace terraces, from the shore up: each is level at `y` for z below `until`.
const TERRACES = [
  { until: -36, y: 0 }, // the shore plain
  { until: -18, y: 7 }, // the garden walk
  { until: 48, y: 14 }, // the Komnenian halls
  { until: Infinity, y: 22 }, // Tekfur Sarayı, the kitchens and the guard's hall
];
const GARDEN = TERRACES[1].y;
const HALLS = TERRACES[2].y;
const UPPER = TERRACES[3].y;
// Tints for the pale cover texture, given in sRGB and multiplied in linear light: grass, dust, garden plots, dry scrub, and the earth of the cut sides.
const TINTS = [0x7c9c58, 0xeedec0, 0x6a9452, 0xa8b47c].map((hex) => new THREE.Color(hex).toArray());
const EARTH = new THREE.Color(0x8f7155).toArray();
const SAND = new THREE.Color(0xd9c7a2).toArray(); // the cut sides on the map, where they meet the map's dusty ground
const PLASTER = [0xf2e3c6, 0xe8cfa6, 0xf5eee0, 0xdcb98e, 0xe9d2b8, 0xd6a982];

const terraceLevel = (z) => TERRACES.find((t) => z < t.until).y;

/** The open hillside east of the palace: a ramp from the shore plain up to the hill crest, matching the terrace levels. */
function hillAt(z) {
  const profile = [[-30, 0], [-10, 6], [48, 14], [100, 22]];
  if (z <= profile[0][0]) return 0;
  for (let i = 1; i < profile.length; i++) {
    const [z0, y0] = profile[i - 1];
    const [z1, y1] = profile[i];
    if (z <= z1) return y0 + ((z - z0) / (z1 - z0)) * (y1 - y0);
  }
  return profile[profile.length - 1][1];
}

/** Gentle undulation of the open ground, fading out on the flat plain and absent on the map's coarser grid. */
function bumpAt(x, z, detail) {
  if (!detail || z < -28) return 0;
  const fade = Math.min(1, (z + 28) / 12);
  return fade * (0.3 * Math.sin(x * 0.21 + 1.3) * Math.sin(z * 0.17 + 0.4) + 0.2 * Math.sin(x * 0.07 - z * 0.11));
}

/**
 * On the map the quarter stands on a levelled terrace in the map's own hills, so the open hillside eases down
 * towards the slab's east and south edges rather than ending in a 22 m cliff beside the map's houses.
 */
function mapEasing(x, z) {
  const east = Math.min(1, Math.max(0, (x - 60) / 70));
  const south = Math.min(1, Math.max(0, (z - 70) / 30));
  return 1 - 0.55 * Math.max(east, south);
}

const groundAt = (x, z, detail = true) => (x < PALACE_EAST ? terraceLevel(z) : hillAt(z) * (detail ? 1 : mapEasing(x, z)) + bumpAt(x, z, detail));

export function createBlachernae({ lod = 'detail' } = {}) {
  const detail = lod === 'detail';
  const quarter = new THREE.Group();
  const masonry = wallMasonry();
  const rnd = createRandom(1081);
  const ground = (x, z) => groundAt(x, z, detail);

  // The slab sits wholly inside the terrain (0.2 m in from its skirts and top), so no face of it shares a plane with the terrain's.
  quarter.add(box(SLAB.x1 - SLAB.x0 - 0.4, 2.8, SLAB.z1 - SLAB.z0 - 0.4, tinted('dirt', 0x8a7256), (SLAB.x0 + SLAB.x1) / 2, -3, (SLAB.z0 + SLAB.z1) / 2));
  quarter.add(createTerrain(detail));
  addTerraceWalls(quarter, detail);
  addWalls(quarter, detail, masonry);
  addPalace(quarter, detail, masonry);
  labelAt(quarter, 'blachernaePalace', -45, HALLS + 22, 22);
  labelled(quarter, 'tekfurSaray', () => addTekfurSaray(quarter, detail, masonry));
  labelled(quarter, 'stMaryBlachernae', () => addChurch(quarter, detail));

  const avoid = [[-45, -44, 7], [-120, -63, 14]]; // the stair to the shore, the Anemas towers
  const avoidRects = [[36, -86, 96, -28], [SLAB.x0, -94, SLAB.x1, -82]]; // the church precinct, the sea wall
  addLanes(quarter, detail, ground, rnd, avoid, avoidRects);
  addWaterfront(quarter, detail);
  addPlanting(quarter, detail, ground, avoid, avoidRects);
  return finalizeModel(quarter);
}

// ---------- ground ----------

/**
 * The ground as one height field: flat terraces in the palace zone, the
 * open hillside east of it, and a seam of vertices on either side of every
 * terrace edge so the steps are vertical. Vertex colours tint a pale cover
 * texture: grass on the terraces, dust on the plain and the lanes' sides,
 * darker garden plots on the hill; earth-brown skirts close it down to the
 * slab.
 */
function createTerrain(detail) {
  const step = detail ? 2.5 : 10;
  const seams = (from, to, at) => {
    const values = [];
    for (let v = from; v < to - 1e-6; v += step) values.push(v);
    values.push(to);
    for (const edge of at) values.push(edge - 0.01, edge + 0.01);
    return [...new Set(values)].sort((a, b) => a - b);
  };
  const xs = seams(SLAB.x0, SLAB.x1, [PALACE_EAST]);
  const zs = seams(SLAB.z0, SLAB.z1, TERRACES.slice(0, -1).map((t) => t.until));
  const gardens = [[46, 4, 70, 26], [92, 10, 124, 36], [56, 64, 90, 86], [100, 58, 126, 80], [104, -24, 126, -4]]; // orchard plots on the hill
  const colourAt = (x, z) => {
    const [grass, dust, garden, scrub] = TINTS;
    if (x < PALACE_EAST) return z < -36 ? dust : grass;
    if (z < -28) return dust;
    if (gardens.some(([x0, z0, x1, z1]) => x >= x0 && x <= x1 && z >= z0 && z <= z1)) return garden;
    const n = 0.5 + 0.5 * Math.sin(x * 0.09 + 2.1) * Math.sin(z * 0.075 - 0.7);
    return n > 0.55 ? grass : n > 0.4 ? scrub : dust;
  };

  return mesh(heightfieldGeometry(xs, zs, (x, z) => groundAt(x, z, detail), colourAt, -3, detail ? EARTH : SAND), coverMaterial());
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

/** A strip of ground following the terrain (lanes and paths), `width` wide, lifted just above it. */
function ribbon(points, width, material, heightAt, lift = 0.12) {
  const path = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, z0] = points[i];
    const [x1, z1] = points[i + 1];
    const pieces = Math.max(1, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 3));
    for (let k = 0; k < pieces; k++) path.push([x0 + ((x1 - x0) * k) / pieces, z0 + ((z1 - z0) * k) / pieces]);
  }
  path.push(points[points.length - 1]);
  const positions = [];
  const uvs = [];
  let along = 0;
  for (let i = 0; i < path.length; i++) {
    const [x, z] = path[i];
    const [px, pz] = path[Math.max(0, i - 1)];
    const [nx, nz] = path[Math.min(path.length - 1, i + 1)];
    const length = Math.hypot(nx - px, nz - pz) || 1;
    const [tx, tz] = [(nx - px) / length, (nz - pz) / length];
    if (i > 0) along += Math.hypot(x - px, z - pz);
    for (const side of [-1, 1]) {
      const sx = x - tz * side * (width / 2);
      const sz = z + tx * side * (width / 2);
      positions.push(sx, heightAt(sx, sz) + lift, sz);
      uvs.push(along, side > 0 ? width : 0);
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

// ---------- terrace substructures ----------

/** The brick-faced retaining walls of the terraces: arcaded fronts facing the Horn, plain walls where they meet the hillside. */
function addTerraceWalls(quarter, detail) {
  const brick = terraceBrick();
  const fronts = [
    { z: -36, bottom: 0, top: GARDEN, gap: [-49.5, -40.5] }, // the gaps let the stairs through the parapet
    { z: -18, bottom: GARDEN, top: HALLS, gap: [-48.5, -41.5] },
    { z: 48, bottom: HALLS, top: UPPER, gap: [-79.5, -72.5] },
  ];
  for (const { z, bottom, top, gap } of fronts) {
    const face = z - 0.3; // stands just proud of the terrain's step
    const length = PALACE_EAST - SLAB.x0 - 0.2; // ends 0.1 m inside Manuel's wall and the east wall, clear of the terrain's seams
    const centre = (SLAB.x0 + PALACE_EAST) / 2;
    const height = top - bottom;
    // The brick stops short under the string course, whose top lies 0.05 m under the terrace's surface, so no two faces share a plane.
    quarter.add(box(length, height + 0.2, 1.6, brick, centre, bottom - 0.5, face + 0.8));
    quarter.add(box(length + 1.4, 0.5, 2.4, M.stone, centre, top - 0.55, face + 0.9)); // string course under the parapet
    for (const [x0, x1] of [[SLAB.x0 - 0.6, gap[0]], [gap[1], PALACE_EAST + 0.6]]) {
      quarter.add(box(x1 - x0, 1.1, 0.8, M.stone, (x0 + x1) / 2, top - 0.05, face + 0.6)); // the terrace parapet, on the string course, its front 0.1 m proud of the terrain's step
    }
    if (!detail) continue;
    // Arcading: projecting piers every six metres with a blind arch between each pair.
    const bays = Math.floor(length / 6);
    const used = bays * 6;
    for (let i = 0; i <= bays; i++) {
      const x = centre - used / 2 + i * 6;
      quarter.add(box(1.4, height - 0.4, 2.2, brick, x, bottom - 0.5, face + 0.2));
      if (i === bays) continue;
      const arch = mesh(archGeometry(3.6, height - 1.4), tinted('brick', 0x7a4a36), x + 3, bottom, face - 0.05);
      arch.rotation.y = Math.PI;
      quarter.add(arch);
    }
  }
  // The east faces, where the terraces are cut into the hillside: their foot follows the slope.
  // Each starts 0.1 m inside the terrace front below it and ends 0.1 m inside the slab, clear of the terrain's seams; the brick stops
  // under the terrace's surface, and the coping stands 0.05 m proud of the brick and 0.05 m under the parapets it meets.
  const eastFaces = [[-35.9, -18, GARDEN], [-17.9, 48, HALLS], [48.1, 99.9, UPPER]];
  for (const [z0, z1, top] of eastFaces) {
    const samples = [];
    for (let z = z0; z < z1 - 1e-6; z += 2) samples.push([z, hillAt(z) - 1.2, top - 0.35]);
    samples.push([z1, hillAt(z1) - 1.2, top - 0.35]);
    quarter.add(profileWall(samples, 1.6, brick, PALACE_EAST - 1.3));
    quarter.add(profileWall(samples.map(([z, , t]) => [z, t - 0.05, t + 1.35]), 0.8, M.stone, PALACE_EAST - 0.45));
  }
}

/** A wall running along z at x, whose bottom and top follow the profile [[z, yBottom, yTop], ...]; `thickness` towards +x. */
function profileWall(profile, thickness, material, x) {
  const shape = new THREE.Shape();
  shape.moveTo(profile[0][0], profile[0][1]);
  for (const [z, bottom] of profile) shape.lineTo(z, bottom);
  for (let i = profile.length - 1; i >= 0; i--) shape.lineTo(profile[i][0], profile[i][2]);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
  // The shape's x runs along world z and the extrusion along world +x.
  geometry.rotateY(-Math.PI / 2);
  return mesh(geometry, material, x + thickness, 0, 0);
}

// ---------- walls and towers ----------

/** Manuel I's wall with its round and octagonal towers, the Anemas towers, and the walls along the Golden Horn. */
function addWalls(quarter, detail, masonry) {
  // The wall climbs the hill in steps, each stretch some 12–15 m above the terrace behind it.
  const stretches = [[SLAB.z0 - 2, -36, 20], [-36, -18, 22], [-18, 48, 28], [48, 96, 34]]; // the last runs into the square tower
  const wallTop = (z) => stretches.find(([, z1]) => z < z1)?.[2] ?? 34;
  for (const [i, [z0, z1, top]] of stretches.entries()) {
    // Each stretch reaches 0.15 m into the one before it, so its end shares no plane with that one's, with the terrain's seams
    // or with the terrace parapets' fronts, and every other stretch is 0.05 m thicker, so their faces do not share a plane where
    // they overlap; the masonry stops short under the string course, which runs 0.05 m past the masonry's ends.
    const start = i ? z0 - 0.15 : z0;
    const length = z1 - start;
    const centre = (start + z1) / 2;
    quarter.add(box(5 + 0.1 * (i % 2), top - 0.3, length, masonry, WALL_X, 0, centre));
    quarter.add(box(5.6, 0.5, length + 0.1, M.stone, WALL_X, top - 0.5, centre));
    if (!detail) continue;
    for (const side of [-1, 1]) {
      const merlons = mesh(crenellationGeometry(length, { merlon: 1.4, gap: 0.8, height: 1.9, thickness: 0.9 }), masonry, WALL_X + side * 2, top, centre);
      merlons.rotation.y = Math.PI / 2;
      quarter.add(merlons);
    }
  }
  for (const [i, z] of [-30, 6, 42, 78].entries()) {
    const sides = i % 2 ? 8 : detail ? 20 : 12;
    const height = wallTop(z) + 5.95; // 0.05 m under the top of any higher stretch the tower runs into
    quarter.add(cylinder(6.2, 6.5, height - 0.3, masonry, WALL_X - 3, 0, z, sides)); // stops short under the cap
    quarter.add(cylinder(6.8, 6.8, 0.5, M.stone, WALL_X - 3, height - 0.5, z, sides));
    quarter.add(mesh(crenelRingGeometry(6.2, { count: 16, merlon: 1.3, height: 1.9, thickness: 0.9 }), masonry, WALL_X - 3, height, z));
    if (detail) {
      for (const angle of [-0.8, 0, 0.8]) {
        const slit = mesh(archGeometry(1.0, 2.2), M.opening, WALL_X - 3 - Math.cos(angle) * 6.43, height - 6, z + Math.sin(angle) * 6.43);
        slit.rotation.y = -Math.PI / 2 + angle;
        quarter.add(slit);
      }
    }
  }
  labelAt(quarter, 'manuelWall', WALL_X, wallTop(24) + 2, 24);
  // The square tower at the wall's southern end.
  quarter.add(box(12, 40, 12, masonry, WALL_X, 0, 96));
  quarter.add(squareBattlements(12, WALL_X, 40, 96, masonry));

  // The twin towers of Isaac Angelos (south) and Anemas (north), fronted by a great buttress.
  // Anemas's label sits halfway up its tower, so the two neighbours' labels stack rather than collide.
  labelAt(quarter, 'isaacTower', WALL_X + 2, 35, -56);
  labelAt(quarter, 'anemasTower', WALL_X + 2, 16, -70);
  for (const [z, height, residential] of [[-56, 34, true], [-70, 30, false]]) {
    quarter.add(box(14, height - 0.3, 14, masonry, WALL_X + 2, 0, z)); // stops short under the string course
    quarter.add(box(14.6, 0.5, 14.6, M.stone, WALL_X + 2, height - 0.5, z));
    quarter.add(squareBattlements(14, WALL_X + 2, height, z, masonry));
    if (residential) {
      quarter.add(box(2, 0.5, 9, M.marble, WALL_X - 6, height - 9, z)); // the balcony looking west
      quarter.add(box(0.4, 1.2, 9, M.marble, WALL_X - 6.8, height - 8.5, z));
      for (const dz of [-4.3, 4.3]) quarter.add(box(2, 1.2, 0.4, M.marble, WALL_X - 6, height - 8.5, z + dz));
    }
    if (!detail) continue;
    if (residential) {
      for (const dz of [-4, 0, 4]) {
        const window = mesh(archGeometry(2.2, 4.2), M.opening, WALL_X - 5.05, height - 8.5, z + dz);
        window.rotation.y = -Math.PI / 2;
        quarter.add(window);
      }
      quarter.add(standard(WALL_X + 2, height, z)); // the emperor's standard over his tower
    } else {
      for (const dz of [-3.5, 3.5]) {
        const slit = mesh(archGeometry(0.9, 1.8), M.opening, WALL_X - 5.05, height - 8, z + dz);
        slit.rotation.y = -Math.PI / 2;
        quarter.add(slit);
      }
    }
  }
  quarter.add(box(7, 9, 30, masonry, WALL_X - 8.5, 0, -63)); // the buttress
  quarter.add(box(3.5, 4, 30, masonry, WALL_X - 6.75, 9, -63)); // its stepped top

  // Along the Golden Horn: the walls of Heraclius and Leo, with Theophilos' hexagonal towers.
  quarter.add(box(249.8, 9.7, 4, masonry, 5, 0, HORN_Z)); // ends 0.1 m inside the slab's sides and stops short under the string course
  quarter.add(box(250.6, 0.4, 4.6, M.stone, 5, 9.6, HORN_Z));
  quarter.add(mesh(crenellationGeometry(250, { merlon: 1.2, gap: 0.8, height: 1.6, thickness: 0.8 }), masonry, 5, 10, HORN_Z - 1.6));
  for (const x of [-85, -35, 15]) {
    quarter.add(cylinder(5.5, 5.5, 16, masonry, x, 0, HORN_Z - 1, 6));
    quarter.add(mesh(crenelRingGeometry(5.2, { count: 12, merlon: 1.2, height: 1.6, thickness: 0.8 }), masonry, x, 16, HORN_Z - 1));
  }
  for (const x of [65, 115]) {
    quarter.add(box(9, 15, 9, masonry, x, 0, HORN_Z));
    quarter.add(squareBattlements(9, x, 15, HORN_Z, masonry));
  }
  // A water gate opening on the Horn below the church.
  for (const side of [-1, 1]) {
    const gate = mesh(archGeometry(4, 6), M.opening, 40, 0, HORN_Z + side * 2.05);
    if (side < 0) gate.rotation.y = Math.PI;
    quarter.add(gate);
  }
}

/** The emperor's standard: a gold cross on purple, on a pole (the Palaiologan device is later than the Komnenian palace). */
function standard(x, y, z) {
  const banner = flag('imperial', { width: 3, height: 2, pole: 7 });
  banner.position.set(x, y, z);
  return banner;
}

// ---------- the palace ----------

/**
 * The Komnenian palace on the main terrace: Manuel's hall with its loggia
 * over the Horn, the keep, the domed chapel, the hall of Alexios, the garden
 * court; on the upper terrace the kitchens and the guard's hall.
 */
function addPalace(quarter, detail, masonry) {
  const y = HALLS;
  const walls = tinted('plaster', 0xe6d6bc); // plastered brick halls, marble-banded
  const segments = detail ? 24 : 12;
  const curveSegments = detail ? 10 : 4;

  // The paved promenade along the terrace front, and the court before the great hall.
  quarter.add(groundPlane(148, 18, M.paving, -45, y + 0.05, -8));
  quarter.add(groundPlane(50, 7, M.paving, -45, y + 0.05, 4.5)); // from the promenade's edge

  // Manuel's hall: two storeys under a tiled hip roof, its north front a two-tiered marble loggia.
  quarter.add(box(50, 17.5, 30, walls, -45, y, 22)); // the halls stop short under their cornices
  quarter.add(box(50.8, 0.6, 30.8, M.marble, -45, y + 8.5, 22)); // string course between the storeys
  quarter.add(box(50.8, 0.6, 30.8, M.marble, -45, y + 17.4, 22)); // cornice
  quarter.add(hipRoof(50, 30, 7, M.roof, -45, y + 18, 22));
  const lowerLoggia = mesh(archedWallGeometry({
    length: 50, height: 7, thickness: 1.2, openings: regularOpenings(50, 7, { width: 4.4, bottom: 0, spring: 4.2 }), curveSegments,
  }), M.marble);
  lowerLoggia.position.set(-45, y, 2.5);
  quarter.add(lowerLoggia);
  const upperLoggia = mesh(archedWallGeometry({
    length: 50, height: 6, thickness: 1.2, openings: regularOpenings(50, 9, { width: 3.2, bottom: 0, spring: 3.4, margin: 1 }), curveSegments,
  }), M.marble);
  upperLoggia.position.set(-45, y + 7, 2.5);
  quarter.add(upperLoggia);
  quarter.add(box(50, 0.6, 6, M.lead, -45, y + 13, 4.5)); // lead roof of the loggia
  quarter.add(box(50, 1, 0.5, M.marble, -45, y + 13.6, 2.5)); // its parapet
  quarter.add(box(49.8, 0.5, 5, M.marble, -45, y + 7, 4.5)); // the gallery floor, ending inside the loggia's ends
  quarter.add(box(50.4, 0.8, 1.6, M.marble, -45, y + 7, 2.5)); // sill of the gallery
  // The keep at the hall's north-west corner.
  quarter.add(box(13, 32, 13, masonry, -78, y, 4));
  quarter.add(squareBattlements(13, -78, y + 32, 4, masonry));

  // The palace chapel: a domed cross-in-square between the two halls.
  quarter.add(box(16, 12, 16, M.brick, -8, y, 20));
  quarter.add(box(16.6, 0.5, 16.6, M.lead, -8, y + 12, 20));
  quarter.add(cylinder(4, 4, 4, M.brick, -8, y + 12, 20, 12));
  quarter.add(dome(4, M.lead, -8, y + 16, 20, { heightScale: 0.8, segments }));
  quarter.add(faceToward(cylinder(3, 3, 9, M.brick, -8, y, 10, 10, { thetaStart: -Math.PI / 2, thetaLength: Math.PI }), 0, -1));
  quarter.add(faceToward(dome(3, M.lead, -8, y + 9, 10, { phiLength: Math.PI, heightScale: 0.7, segments }), 0, -1));

  // The hall of Alexios I (the "Polytimos oikos"; its plan is invented): a tall basilical hall along z, apsed towards the Horn.
  quarter.add(box(20, 14.5, 40, walls, 18, y, 12));
  quarter.add(box(20.8, 0.6, 40.8, M.marble, 18, y + 7.5, 12));
  quarter.add(box(20.8, 0.6, 40.8, M.marble, 18, y + 14.4, 12));
  quarter.add(hipRoof(20, 40, 6, M.roof, 18, y + 15, 12));
  quarter.add(faceToward(cylinder(5, 5, 11, M.brick, 18, y, -8, 12, { thetaStart: -Math.PI / 2, thetaLength: Math.PI }), 0, -1));
  quarter.add(faceToward(dome(5, M.lead, 18, y + 11, -8, { phiLength: Math.PI, heightScale: 0.7, segments }), 0, -1));
  // Its porch towards the chapel.
  const porch = mesh(archedWallGeometry({
    length: 10, height: 5.5, thickness: 4, openings: regularOpenings(10, 3, { width: 2.4, bottom: 0, spring: 3.4 }), curveSegments,
  }), M.marble);
  porch.rotation.y = Math.PI / 2;
  porch.position.set(6, y, 18);
  quarter.add(porch);
  quarter.add(box(4.6, 0.4, 10.6, M.lead, 6, y + 5.5, 18));

  // The garden court: a cloister of marble columns round lawns, cypresses and a fountain.
  addGardenCourt(quarter, detail, -99, y, 30);

  // The stairs between the terraces: up to the upper terrace beside the hall, and down to the garden walk and the shore.
  quarter.add(positioned(stairs(6, 16, 0.5, 1), -76, y, 32));
  quarter.add(positioned(stairs(6, 14, 0.5, 0.86), -45, GARDEN, -30.04));
  quarter.add(positioned(stairs(8, 14, 0.5, 1), -45, 0, -50));
  for (const side of [-1, 1]) quarter.add(box(1, 7, 14, masonry, -45 + side * 4.5, 0, -43)); // cheek walls of the shore stair

  // The garden walk on the lower terrace: a marble colonnade along the balustrade.
  const walk = detail ? colonnade({ length: 100, count: 18, height: 6, radius: 0.4 }) : plainColonnade(100, 18, 6, 0.4);
  walk.position.set(-45, GARDEN, -33);
  quarter.add(walk);
  quarter.add(box(102, 0.5, 4, M.lead, -45, GARDEN + 6, -34));
  quarter.add(groundPlane(148, 4, M.paving, -45, GARDEN + 0.05, -33));

  // The upper terrace: the kitchens with their vents and the guard's hall (the Varangians' quarters; invented).
  quarter.add(box(36, 7, 14, M.brick, -40, UPPER, 62));
  quarter.add(gableRoof(36, 14, 4, M.roof, -40, UPPER + 7, 62));
  for (const x of [-52, -44, -36, -28]) {
    quarter.add(cylinder(1, 1, 2.6, M.brick, x, UPPER + 10, 62, 8));
    quarter.add(mesh(cylinderGeometry(0.2, 1.4, 1.4, 8), M.lead, x, UPPER + 12.6, 62));
  }
  quarter.add(box(40, 8.5, 18, walls, 2, UPPER, 64));
  quarter.add(box(40.8, 0.6, 18.8, M.marble, 2, UPPER + 8.4, 64));
  quarter.add(hipRoof(40, 18, 5, M.roof, 2, UPPER + 9, 64));
  quarter.add(groundPlane(82, 22, M.paving, -19, UPPER + 0.05, 86)); // the service court
  quarter.add(cylinder(1.4, 1.4, 1, M.marble, -30, UPPER, 86, 8)); // the well
  quarter.add(cylinder(0.9, 0.9, 1.2, M.opening, -30, UPPER + 0.2, 86, 8));
  if (!detail) return;

  // Purple hangings between the arches of the gallery, and the standard over the keep.
  for (const x of [-57, -45, -33]) {
    const hanging = mesh(scaleUV(new THREE.PlaneGeometry(2.6, 4.2), 2.6, 4.2), M.imperialPurple, x, y + 5.2, 1.85);
    hanging.rotation.x = 0.06;
    quarter.add(hanging);
  }
  quarter.add(standard(-78, y + 32, 4));
  // Windows.
  const upper = windowRow({ count: 9, spacing: 5.2, width: 2.2, height: 4, y: 12 });
  upper.position.set(-45, y, 37.05);
  quarter.add(upper);
  const lower = windowRow({ count: 8, spacing: 5.5, width: 2, height: 3.4, y: 2.6 });
  lower.position.set(-45, y, 37.05);
  quarter.add(lower);
  for (const side of [-1, 1]) {
    const row = windowRow({ count: 7, spacing: 5, width: 2, height: 4.2, y: 9 });
    row.position.set(18 + side * 10.05, y, 12);
    row.rotation.y = side * Math.PI / 2;
    quarter.add(row);
    const ground = windowRow({ count: 7, spacing: 5, width: 1.6, height: 3, y: 2.4 });
    ground.position.set(18 + side * 10.05, y, 12);
    ground.rotation.y = side * Math.PI / 2;
    quarter.add(ground);
  }
  const guard = windowRow({ count: 8, spacing: 4.6, width: 1.6, height: 3, y: 4.5 });
  guard.position.set(2, UPPER, 73.05);
  quarter.add(guard);
  const kitchen = windowRow({ count: 5, spacing: 6.5, width: 1.4, height: 2.2, y: 3.6 });
  kitchen.position.set(-40, UPPER, 69.05);
  quarter.add(kitchen);
}

/** A cloistered garden court of w × d metres centred at (x, z): lawns quartered by paved paths, a fountain in the middle. */
function addGardenCourt(quarter, detail, x, y, z, w = 38, d = 32) {
  const columnHeight = 4.5;
  const sides = [
    [x, z - d / 2 + 1.5, w - 3, 0],
    [x, z + d / 2 - 1.5, w - 3, 0],
    [x - w / 2 + 1.5, z, d - 3, Math.PI / 2],
    [x + w / 2 - 1.5, z, d - 3, Math.PI / 2],
  ];
  for (const [cx, cz, length, rotation] of sides) {
    const count = Math.round(length / 4) + 1;
    // The short sides leave out their end columns, which the long sides already provide, and their roofs fit between the long sides' roofs.
    const step = length / (count - 1);
    const [span, columns, roofLength] = rotation ? [length - 2 * step, count - 2, length - 3] : [length, count, length + 3];
    const row = detail ? colonnade({ length: span, count: columns, height: columnHeight, radius: 0.35 }) : plainColonnade(span, columns, columnHeight, 0.35);
    row.position.set(cx, y, cz);
    row.rotation.y = rotation;
    quarter.add(row);
    const roof = box(roofLength, 0.4, 3, M.lead, cx, y + columnHeight, cz);
    roof.rotation.y = rotation;
    quarter.add(roof);
  }
  quarter.add(groundPlane(3, d, M.paving, x, y + 0.05, z));
  for (const side of [-1, 1]) quarter.add(groundPlane((w - 3) / 2, 3, M.paving, x + side * (w + 3) / 4, y + 0.05, z)); // the cross path, either side of the first
  // The fountain: an octagonal marble basin with a bowl on a stem.
  quarter.add(cylinder(3.2, 3.2, 0.9, M.marble, x, y, z, 8));
  quarter.add(mesh(new THREE.CircleGeometry(2.9, 16).rotateX(-Math.PI / 2), M.water, x, y + 0.75, z));
  quarter.add(cylinder(0.3, 0.45, 2, M.marble, x, y, z, 8));
  quarter.add(cylinder(1.1, 0.6, 0.5, M.marble, x, y + 2, z, 8));
  if (!detail) return;
  for (const [dx, dz] of [[-12, -8], [12, -8], [-12, 8], [12, 8]]) quarter.add(cypress(11, x + dx, y, z + dz));
  quarter.add(judasTree(6.5, x - 6, y, z + 10, { seed: 2 })); // an erguvan in flower
  quarter.add(roundTree(7, x + 7, y, z - 10));
}

function positioned(object, x, y, z) {
  object.position.set(x, y, z);
  return object;
}

/** Shafts only, for a colonnade seen from the map. */
function plainColonnade(length, count, height, radius) {
  const group = new THREE.Group();
  const shaft = cylinderGeometry(radius * 0.85, radius, height, 6, { open: true });
  const step = length / (count - 1);
  for (let i = 0; i < count; i++) group.add(mesh(shaft, M.marble, -length / 2 + step * i, 0, 0));
  return group;
}

function squareBattlements(size, x, y, z, material) {
  const cap = new THREE.Group();
  const options = { merlon: 1.2, gap: 0.8, height: 1.9, thickness: 0.9 };
  for (const side of [-1, 1]) {
    cap.add(mesh(crenellationGeometry(size, options), material, x, y, z + side * (size / 2 - 0.45)));
    const flank = mesh(crenellationGeometry(size - 1.8, options), material, x + side * (size / 2 - 0.45), y, z);
    flank.rotation.y = Math.PI / 2;
    cap.add(flank);
  }
  return cap;
}

/** Tekfur Sarayı: three storeys of patterned brick and stone over a four-arched arcade, late 13th century. */
function addTekfurSaray(quarter, detail, masonry) {
  const [x, z] = [-98, 70];
  const y = UPPER;
  const [length, depth, height] = [30, 13, 20];
  const front = z + depth / 2;
  // The mass stops short under the cornice and 0.1 m behind the façade, which is 0.1 m longer than it, so their faces share no plane.
  quarter.add(box(length, height - 0.4, depth - 0.1, masonry, x, y, z - 0.05));
  quarter.add(box(length + 0.8, 0.5, depth + 0.8, M.marble, x, y + 19.5, z)); // cornice
  quarter.add(gableRoof(length, depth, 3.6, M.roof, x, y + height, z, 0.4));
  // The courtyard façade: diaper brickwork pierced by the arcade and its two rows of windows.
  const facade = mesh(archedWallGeometry({
    length: length + 0.1,
    height: height - 0.5,
    thickness: 1,
    openings: [
      ...regularOpenings(length, 4, { width: 6, bottom: 0, spring: 4.6, margin: 1.5 }),
      ...regularOpenings(length, 5, { width: 2.4, bottom: 8.2, spring: 10.8, margin: 1.5 }),
      ...regularOpenings(length, 7, { width: 1.9, bottom: 14.2, spring: 16.6, margin: 1.2 }),
    ],
    curveSegments: detail ? 10 : 4,
  }), diaperMaterial());
  facade.position.set(x, y, front - 0.5);
  quarter.add(facade);
  // Marble columns carrying the arcade, and marble sills under the windows.
  for (let i = 1; i < 4; i++) quarter.add(cylinder(0.5, 0.55, 4.6, M.marble, x - 13.5 + i * 6.75, y, front - 0.4, detail ? 10 : 6));
  quarter.add(box(length, 0.4, 1.4, M.marble, x, y + 7.75, front - 0.5)); // 0.05 m under the openings' sills
  quarter.add(box(length, 0.4, 1.4, M.marble, x, y + 13.75, front - 0.5));
  // The courtyard walls to the south (paved in the diorama).
  quarter.add(box(length + 2, 5, 1.2, masonry, x, y, front + 22));
  for (const side of [-1, 1]) quarter.add(box(1.2, 5, 21.4, masonry, x + side * (length / 2 + 0.4), y, front + 10.7)); // up to the south wall
  if (detail) {
    // The top floor has windows on every side; a balcony looks east over the city.
    const north = windowRow({ count: 7, spacing: 4, width: 1.9, height: 4.3, y: 14.2 });
    north.position.set(x, y, z - depth / 2 - 0.05);
    north.rotation.y = Math.PI;
    quarter.add(north);
    for (const side of [-1, 1]) {
      const end = windowRow({ count: 3, spacing: 3.6, width: 1.9, height: 4.3, y: 14.2 });
      end.position.set(x + side * (length / 2 + 0.05), y, z);
      end.rotation.y = side * Math.PI / 2;
      quarter.add(end);
    }
    quarter.add(box(2.4, 0.5, 8, M.marble, x + length / 2 + 1.2, y + 13.7, z));
    quarter.add(box(0.4, 1.1, 8, M.marble, x + length / 2 + 2.2, y + 14.2, z));
    quarter.add(groundPlane(length, 22, M.paving, x, y + 0.05, front + 11));
    for (const dx of [-11, 11]) quarter.add(cypress(9, x + dx, y, front + 18));
  }
}

// ---------- the church ----------

/**
 * St Mary of Blachernae, guardian of the Virgin's robe: the basilica with
 * its arcaded narthex, the round chapel of the Holy Soros where the robe
 * was kept, and the holy spring (hagiasma) under a round shrine beside its
 * bathing pool, in a walled precinct inside the water gate. The arrangement
 * of the three buildings is invented.
 */
function addChurch(quarter, detail) {
  const [x, z] = [64, -54];
  const segments = detail ? 24 : 12;
  const curveSegments = detail ? 10 : 4;
  quarter.add(box(40, 10, 26, M.brick, x, 0, z));
  quarter.add(box(39.8, 16, 13, M.brick, x, 0, z)); // the nave, ending 0.1 m inside the aisles' ends
  quarter.add(gableRoof(40, 13, 4, M.roof, x, 16, z));
  quarter.add(box(40.6, 0.5, 26.6, M.lead, x, 10, z));
  quarter.add(cylinder(4.5, 4.5, 3.5, M.brick, x, 18.5, z, 16));
  quarter.add(dome(4.5, M.lead, x, 22, z, { heightScale: 0.7, segments }));
  quarter.add(faceToward(cylinder(6, 6, 13, M.brick, x + 20, 0, z, 14, { thetaStart: -Math.PI / 2, thetaLength: Math.PI }), 1, 0));
  quarter.add(faceToward(dome(6, M.lead, x + 20, 13, z, { phiLength: Math.PI, heightScale: 0.8, segments }), 1, 0));
  // The narthex, arcaded, at the west end.
  const narthex = mesh(archedWallGeometry({
    length: 26, height: 8, thickness: 6, openings: regularOpenings(26, 5, { width: 3, bottom: 0, spring: 4.5 }), curveSegments,
  }), M.brick);
  narthex.rotation.y = Math.PI / 2;
  narthex.position.set(x - 23, 0, z);
  quarter.add(narthex);
  quarter.add(box(6.6, 0.5, 26.6, M.lead, x - 23, 8, z));

  // The round chapel of the Holy Soros, between the church and the sea wall.
  quarter.add(cylinder(6.5, 6.5, 11, M.brick, 50, 0, -76.5, 16));
  quarter.add(dome(6.5, M.lead, 50, 11, -76.5, { heightScale: 0.65, segments }));

  // The holy spring: a round marble shrine open on four sides, and the pool fed by it, in the court south of the church.
  quarter.add(groundPlane(40, 10, M.paving, x, 0.05, -35.5));
  quarter.add(cylinder(3.6, 3.6, 4.5, M.marble, 78, 0, -36, 12));
  quarter.add(dome(3.6, M.lead, 78, 4.5, -36, { heightScale: 0.8, segments }));
  quarter.add(box(12, 1, 6, M.marble, 62, 0, -36));
  quarter.add(groundPlane(11, 5, M.water, 62, 0.8, -36));
  // The precinct wall, with its gate towards the lane.
  const precinct = tinted('rubble', 0xcbbda4);
  for (const px of [36, 96]) quarter.add(box(0.8, 2.4, 56, precinct, px, 0, -58));
  quarter.add(box(24, 2.4, 0.8, precinct, 48, 0, -30));
  quarter.add(box(32, 2.4, 0.8, precinct, 80, 0, -30));
  quarter.add(box(1.2, 3.6, 1.2, precinct, 60, 0, -30));
  quarter.add(box(1.2, 3.6, 1.2, precinct, 64, 0, -30));
  if (!detail) return;
  for (const side of [-1, 1]) {
    const windows = windowRow({ count: 7, spacing: 5, width: 1.5, height: 2.8, y: 11.5 });
    windows.position.set(x, 0, z + side * 6.55);
    windows.rotation.y = side > 0 ? 0 : Math.PI;
    quarter.add(windows);
  }
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2;
    const opening = mesh(archGeometry(1.8, 3.4), M.opening, 78 + Math.sin(angle) * 3.65, 0, -36 + Math.cos(angle) * 3.65);
    opening.rotation.y = angle;
    quarter.add(opening);
  }
  for (const [px, pz] of [[42, -76], [90, -74], [92, -42]]) quarter.add(roundTree(10, px, 0, pz)); // plane trees in the precinct
  for (const [px, pz] of [[40, -40], [86, -66]]) quarter.add(cypress(12, px, 0, pz));
}

// ---------- the quarter ----------

/**
 * The lanes of the quarter and the houses along them: tall narrow houses,
 * their upper floors oversailing the lane, each on a rubble plinth that
 * takes up the slope. The lower town fills the plain under the palace
 * terraces; the rest climbs the hill east of the palace.
 */
function addLanes(quarter, detail, ground, rnd, avoid, avoidRects) {
  const lane = tinted('dirt', 0xb59c7a);
  // Lanes that branch off another are lifted a little higher, so the two do not share a surface where they meet.
  const lanes = [
    // The lower town on the plain.
    { points: [[-112, -52], [26, -52]], sides: [-1] },
    { points: [[-45, -52], [-45, -84]], sides: [-1, 1], lift: 0.2 },
    { points: [[-85, -52], [-85, -84]], sides: [-1, 1], lift: 0.2 },
    { points: [[-10, -52], [-10, -84]], sides: [-1, 1], lift: 0.2 },
    // The street from the water gate past the church and up the hill.
    { points: [[40, -85], [33, -72], [33, -30], [46, -4], [62, 22], [82, 60], [100, 96]], sides: [-1, 1] },
    { points: [[33, 0], [126, -6]], sides: [-1, 1], lift: 0.2 },
    { points: [[72, 44], [126, 50]], sides: [-1, 1], lift: 0.2 },
    { points: [[36, -27], [126, -27]], sides: [-1, 1], lift: 0.2 },
    { points: [[66, 30], [126, 24]], sides: [1], lift: 0.2 },
  ];
  const inSlab = (x, z) => x > SLAB.x0 + 4 && x < SLAB.x1 - 4 && z > SLAB.z0 + 6 && z < SLAB.z1 - 4;
  const clear = (x, z, r) =>
    !avoid.some(([ax, az, ar]) => Math.hypot(x - ax, z - az) < ar + r) &&
    !avoidRects.some(([x0, z0, x1, z1]) => x > x0 - r && x < x1 + r && z > z0 - r && z < z1 + r) &&
    (x < PALACE_EAST ? z < -40 : true);
  for (const { points, sides, lift } of lanes) {
    if (detail) quarter.add(ribbon(points, 3, lane, ground, lift));
    for (let i = 0; i < points.length - 1; i++) {
      const [x0, z0] = points[i];
      const [x1, z1] = points[i + 1];
      const length = Math.hypot(x1 - x0, z1 - z0);
      const [tx, tz] = [(x1 - x0) / length, (z1 - z0) / length];
      const theta = Math.atan2(tz, tx);
      for (const side of sides) {
        let along = rnd.range(2, 6);
        while (along < length - 4) {
          const w = rnd.range(5, 8);
          const d = rnd.range(5.5, 8);
          const h = rnd.range(8, 13);
          const gap = detail ? rnd.range(0.6, 3) : rnd.range(3, 7);
          const offset = 2.2 + d / 2;
          const x = x0 + tx * along - tz * side * offset;
          const z = z0 + tz * along + tx * side * offset;
          along += w + gap;
          if (!inSlab(x, z) || !clear(x, z, Math.max(w, d) / 2 + 0.5)) continue;
          // The house's +z face (its windows) looks onto the lane.
          const rotation = side < 0 ? -theta : Math.PI - theta;
          quarter.add(townHouse(rnd, { w, d, h, x, z, rotation, ground, detail }));
          avoid.push([x, z, Math.max(w, d) / 2 + 1]);
        }
      }
    }
  }
}

/** A tall narrow house on a plinth cut to the slope, its windows on the +z face. */
function townHouse(rnd, { w, d, h, x, z, rotation, ground, detail }) {
  const house = new THREE.Group();
  const colour = tinted('plaster', rnd.pick(PLASTER));
  const corners = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([cx, cz]) =>
    ground(x + cx * Math.cos(rotation) + cz * Math.sin(rotation), z - cx * Math.sin(rotation) + cz * Math.cos(rotation)));
  const floor = Math.max(...corners) + 0.05;
  const foot = Math.min(...corners) - 0.6;
  house.add(box(w + 0.4, floor - foot, d + 0.4, M.rubble, 0, foot - floor, 0));
  const jetty = h > 9.5 && rnd.chance(0.6);
  house.add(box(w, jetty ? h - 0.1 : h, d, colour, 0, 0, 0));
  // The upper floors oversail the lane, and stand 0.05 m proud of the lower walls on the other sides, so their faces share no plane.
  if (jetty) house.add(box(w + 0.1, h - 5.6, d + 1.25, colour, 0, 5.6, 0.575));
  const depth = jetty ? d + 1.2 : d;
  const gable = rnd.chance(0.6);
  house.add(gable ? gableRoof(w, depth, depth * 0.32, M.roof, 0, h, jetty ? 0.6 : 0, 0.4) : hipRoof(w, depth, Math.min(w, depth) * 0.32, M.roof, 0, h, jetty ? 0.6 : 0, 0.4));
  if (detail) {
    const storeys = Math.max(2, Math.floor(h / 3.3));
    const count = Math.max(1, Math.floor(w / 2.6));
    for (let s = 0; s < storeys; s++) {
      const row = windowRow({ count, spacing: w / count, width: 0.9, height: 1.5, y: 1.3 + s * 3.2 });
      row.position.z = (s > 0 && jetty ? depth - d / 2 : d / 2) + 0.05;
      house.add(row);
    }
  }
  house.position.set(x, floor, z);
  house.rotation.y = rotation;
  return house;
}

/** The waterfront outside the water gate: a timber landing stage on piles, with boats tied up. */
function addWaterfront(quarter, detail) {
  if (!detail) return;
  // The water, kept to a strip beyond the sea wall so the quarter frames large.
  quarter.add(box(250, 2.5, 28, M.waterSide, 5, -3, -104)); // its top 0.1 m under the water's surface
  quarter.add(groundPlane(250, 28, M.water, 5, -0.4, -104));
  quarter.add(box(4, 0.4, 16, M.wood, 40, 0.6, -98));
  for (const dz of [-6, -2, 2, 6]) {
    for (const dx of [-1.6, 1.6]) quarter.add(cylinder(0.22, 0.26, 2.2, M.wood, 40 + dx, -1.2, -98 + dz, 6));
  }
  quarter.add(cylinder(0.2, 0.2, 1.4, M.wood, 42.2, 1, -105, 6)); // mooring posts
  quarter.add(cylinder(0.2, 0.2, 1.4, M.wood, 37.8, 1, -92, 6));
  quarter.add(skiff(44.5, -100, Math.PI / 2 + 0.1));
  quarter.add(skiff(35, -95, Math.PI / 2 - 0.2));
  quarter.add(skiff(60, -94, 0.3));
}

/** A small rowing boat riding on the water, bow along its local +x. */
function skiff(x, z, heading) {
  const boat = new THREE.Group();
  const { geometry } = createHull({ length: 7, beam: 2.2, depth: 0.8, bowRise: 0.5, sternRise: 0.3, segments: 16, ribs: 8 });
  boat.add(mesh(geometry, M.hull));
  for (const dx of [-1.6, 0.2, 1.8]) boat.add(box(0.3, 0.1, 1.9, M.wood, dx, -0.35, 0));
  boat.add(box(6.6, 0.12, 0.2, M.wood, 0, -0.05, 1)); // gunwales
  boat.add(box(6.6, 0.12, 0.2, M.wood, 0, -0.05, -1));
  boat.position.set(x, 0, z);
  boat.rotation.y = heading;
  return boat;
}

/** Trees over the quarter: cypresses by the palace, plane trees on the plain, erguvans on the hillside. */
function addPlanting(quarter, detail, ground, avoid, avoidRects) {
  if (!detail) return;
  const clear = (x, z, r) =>
    !avoid.some(([ax, az, ar]) => Math.hypot(x - ax, z - az) < ar + r) &&
    !avoidRects.some(([x0, z0, x1, z1]) => x > x0 - r && x < x1 + r && z > z0 - r && z < z1 + r);
  for (const [x, z] of [[-110, -14], [-100, -14], [10, -14], [-66, 44], [-24, 44], [-116, 54], [-60, 52], [-10, 52], [24, 56]]) {
    quarter.add(cypress(12, x, ground(x, z), z));
  }
  const rnd = createRandom(626);
  let planted = 0;
  for (let attempt = 0; attempt < 400 && planted < 22; attempt++) {
    const x = rnd.range(34, 126);
    const z = rnd.range(-24, 96);
    if (!clear(x, z, 4)) continue;
    const y = ground(x, z);
    const kind = rnd.next();
    if (kind < 0.4) quarter.add(cypress(rnd.range(9, 13), x, y, z));
    else if (kind < 0.8) quarter.add(roundTree(rnd.range(7, 10), x, y, z));
    else quarter.add(judasTree(rnd.range(5.5, 7), x, y, z, { seed: planted, detail: false }));
    avoid.push([x, z, 3]);
    planted++;
  }
  // Two erguvans in full flower where they are seen close: by the church lane and beside the shore stair.
  quarter.add(judasTree(7, 30, ground(30, -24) + 0.01, -24, { seed: 1 }));
  quarter.add(judasTree(6.5, -60, 0, -46, { seed: 3 }));
  for (const [x, z] of [[-100, -70], [-30, -66], [12, -70]]) if (clear(x, z, 3)) quarter.add(roundTree(9, x, 0, z));
}

// ---------- local textures ----------

const textureCache = new Map();

function canvasMaterial(name, tile, paint, params = {}) {
  if (textureCache.has(name)) return textureCache.get(name);
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  paint(ctx, size, createRandom(name.length * 1081));
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1 / tile, 1 / tile);
  texture.anisotropy = 8;
  const material = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.9, metalness: 0, ...params });
  textureCache.set(name, material);
  return material;
}

const vary = (rnd, c, amount) => {
  const k = 1 + (rnd.next() - 0.5) * amount;
  return `rgb(${(c[0] * k) | 0}, ${(c[1] * k) | 0}, ${(c[2] * k) | 0})`;
};

function courses(ctx, size, rnd, top, bottom, courseHeight, minLength, maxLength, mortar, colour, amount) {
  for (let y = top; y < bottom; y += courseHeight) {
    const h = Math.min(courseHeight, bottom - y) - mortar;
    let x = -rnd.next() * maxLength;
    while (x < size) {
      const length = minLength + rnd.next() * (maxLength - minLength);
      ctx.fillStyle = vary(rnd, colour, amount);
      ctx.fillRect(x + mortar / 2, y + mortar / 2, length - mortar, h);
      if (x < 0) ctx.fillRect(x + size + mortar / 2, y + mortar / 2, length - mortar, h);
      if (x + length > size) ctx.fillRect(x - size + mortar / 2, y + mortar / 2, length - mortar, h);
      x += length;
    }
  }
}

/** Limestone ashlar with bands of five brick courses every 1.5 m, as on the land walls. */
function wallMasonry() {
  return canvasMaterial('blachernae-masonry', 3, (ctx, size, rnd) => {
    ctx.fillStyle = 'rgb(168, 160, 142)';
    ctx.fillRect(0, 0, size, size);
    const half = size / 2;
    for (const top of [0, half]) {
      courses(ctx, size, rnd, top, top + 94, 31.3, 36, 70, 3, [208, 200, 182], 0.14);
      courses(ctx, size, rnd, top + 94, top + half, 6.8, 20, 30, 2.4, [158, 68, 46], 0.3);
    }
    for (let i = 0; i < 1800; i++) {
      ctx.fillStyle = `rgba(100, 85, 65, ${0.1 + rnd.next() * 0.12})`;
      const s = 0.6 + rnd.next() * 1.4;
      ctx.fillRect(rnd.next() * size, rnd.next() * size, s, s);
    }
  });
}

/** The terrace substructures: all brick, with a thin band of stone every two metres, weathered and lichened. */
function terraceBrick() {
  return canvasMaterial('blachernae-substructure', 2, (ctx, size, rnd) => {
    ctx.fillStyle = 'rgb(150, 112, 92)';
    ctx.fillRect(0, 0, size, size);
    courses(ctx, size, rnd, 0, size - 22, 8.5, 22, 34, 2.4, [168, 78, 54], 0.32);
    courses(ctx, size, rnd, size - 22, size, 22, 40, 70, 3, [200, 190, 170], 0.12);
    for (let i = 0; i < 1400; i++) {
      ctx.fillStyle = `rgba(90, 80, 70, ${0.1 + rnd.next() * 0.15})`;
      const s = 0.6 + rnd.next() * 1.8;
      ctx.fillRect(rnd.next() * size, rnd.next() * size, s, s);
    }
  });
}

/** A pale, lightly mottled ground that the terrain's vertex colours tint to grass, dust or garden. */
function coverMaterial() {
  return canvasMaterial('blachernae-cover', 6, (ctx, size, rnd) => {
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

/**
 * The façade of Tekfur Sarayı: white stone and red brick laid in bands of
 * geometric diaper — lozenges, chevrons and stripes — the showpiece of
 * Palaiologan decorative brickwork. Tiles every 2 m.
 */
function diaperMaterial() {
  return canvasMaterial('tekfur-diaper', 2, (ctx, size, rnd) => {
    const brick = [160, 66, 44];
    const stone = [228, 220, 202];
    ctx.fillStyle = vary(rnd, stone, 0);
    ctx.fillRect(0, 0, size, size);
    // Stripes of brick courses top and bottom of the tile.
    for (const top of [0, size - 28]) {
      for (let y = top; y < top + 28; y += 7) {
        for (let x = -8; x < size; x += 24) {
          ctx.fillStyle = vary(rnd, brick, 0.25);
          ctx.fillRect(x + 1 + (y % 14 ? 12 : 0), y + 1, 22, 5);
        }
      }
    }
    // A row of brick lozenges with stone centres.
    const cell = 64;
    ctx.lineWidth = 6;
    for (let x = 0; x <= size; x += cell) {
      ctx.strokeStyle = vary(rnd, brick, 0.2);
      ctx.beginPath();
      ctx.moveTo(x, 96);
      ctx.lineTo(x + cell / 2, 46);
      ctx.lineTo(x + cell, 96);
      ctx.lineTo(x + cell / 2, 146);
      ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = vary(rnd, brick, 0.2);
      ctx.fillRect(x + cell / 2 - 5, 91, 10, 10);
    }
    // A chevron band below.
    ctx.lineWidth = 7;
    for (let x = 0; x <= size; x += 32) {
      ctx.strokeStyle = vary(rnd, brick, 0.2);
      ctx.beginPath();
      ctx.moveTo(x, 190);
      ctx.lineTo(x + 16, 162);
      ctx.lineTo(x + 32, 190);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, 212);
      ctx.lineTo(x + 16, 184);
      ctx.lineTo(x + 32, 212);
      ctx.stroke();
    }
    // Mortar joints over the stone.
    ctx.fillStyle = 'rgba(150, 140, 125, 0.35)';
    for (let y = 0; y < size; y += 24) ctx.fillRect(0, y, size, 1.5);
    for (let i = 0; i < 1200; i++) {
      ctx.fillStyle = `rgba(110, 95, 80, ${0.08 + rnd.next() * 0.1})`;
      ctx.fillRect(rnd.next() * size, rnd.next() * size, 1.5, 1.5);
    }
  }, { roughness: 0.85 });
}

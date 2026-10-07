import * as THREE from 'three';
import { materials as M } from './lib/materials.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  archGeometry, archedWallGeometry, box, boxGeometry, crenelRingGeometry, crenellationGeometry, cylinder, cylinderGeometry, flag,
  groundPlane, mesh, stairs,
} from './lib/primitives.js';
import { mapStone, wallAlongGeometry } from './lib/mapWalls.js';
import { createWaterMaterial } from './lib/water.js';
import { scatterHouses } from './lib/buildings.js';
import { finalizeModel } from './lib/merge.js';
import { createRandom } from '../util/random.js';
import { offsetPolyline, samplePolyline } from '../util/geo.js';
import { GOLDEN_GATE, LAND_HEIGHT, LAND_WALLS } from '../data/geography.js';

/**
 * The Theodosian Land Walls (408–413, doubled after 447): inner wall, outer
 * wall and moat — a triple barrier 5.7 km long from the Sea of Marmara to
 * the Golden Horn.
 *
 * Detail: a 240 m section with a public gate, city at -z, enemy at +z.
 *  - inner wall 12 m high, 5 m thick, limestone ashlar with bands of five
 *    brick courses, 96 towers 10–12 m wide and 18–20 m high (mostly square,
 *    some octagonal), about 55 m apart, each of two chambers;
 *  - the peribolos terrace, 15–20 m wide;
 *  - outer wall 8.5 m high, 2 m thick, with smaller square and crescent
 *    towers set between the inner ones;
 *  - the parateichion terrace, then the moat, 20 m wide and 7–10 m deep,
 *    crossed by dams, its scarp crowned by a crenellated breastwork.
 * Map: the whole circuit traced along LAND_WALLS in map units (absolute),
 * with the same three lines — crenellated inner wall with square and
 * octagonal towers, lower outer wall with its smaller towers set between
 * them, and the stone-lined moat behind its breastwork — in the same banded
 * masonry, everything about six times taller than true scale like the other
 * landmarks on the map.
 *
 * Sources: Wikipedia, Walls of Constantinople; Turkish Archaeological News,
 * Theodosian Land Walls.
 */
export function createTheodosianWalls({ lod = 'detail' } = {}) {
  return lod === 'detail' ? createSection() : createMapCircuit();
}

// ---------- detail section ----------

const LENGTH = 240;
const INNER_HEIGHT = 12;
const INNER_THICKNESS = 5;
const OUTER_Z = 17;
const OUTER_HEIGHT = 8.5;
const MOAT = [33.5, 53.5];
const MOAT_DEPTH = 8;
const MERLONS = { merlon: 1.4, gap: 0.8, height: 1.9, thickness: 0.9 };

function createSection() {
  const walls = new THREE.Group();
  const masonry = wallMasonry();

  // Ground: city and terraces, the moat, and the open country beyond.
  walls.add(box(LENGTH + 20, 4, 113.5, M.grass, 0, -4, -23.25));
  walls.add(groundPlane(LENGTH, 31, M.dirt, 0, 0.02, 18));
  walls.add(box(LENGTH + 20, 4, 20, M.dirt, 0, -4 - MOAT_DEPTH, 43.5));
  walls.add(box(LENGTH + 20, 4, 36.5, M.grass, 0, -4, 71.75));
  for (const z of [MOAT[0] + 0.5, MOAT[1] - 0.5]) walls.add(box(LENGTH + 20, MOAT_DEPTH, 1, M.stone, 0, -MOAT_DEPTH, z));
  walls.add(groundPlane(LENGTH + 20, 19, M.water, 0, -MOAT_DEPTH + 2.5, 43.5));
  for (const x of [-80, 80]) walls.add(box(2.4, MOAT_DEPTH + 0.3, 20, M.stone, x, -MOAT_DEPTH, 43.5)); // dams dividing the moat

  // Inner wall: 12 m high, 5 m thick, pierced by the gate; a parapet walk along the top.
  const gate = { x: 0, width: 6, bottom: 0, spring: 7.5 };
  walls.add(mesh(archedWallGeometry({ length: LENGTH, height: INNER_HEIGHT, thickness: INNER_THICKNESS, openings: [gate] }), masonry));
  walls.add(box(LENGTH, 0.5, INNER_THICKNESS + 0.6, M.stone, 0, INNER_HEIGHT - 0.5, 0)); // string course
  walls.add(mesh(crenellationGeometry(LENGTH, MERLONS), masonry, 0, INNER_HEIGHT, INNER_THICKNESS / 2 - 0.45));
  walls.add(box(LENGTH, 1, 0.5, masonry, 0, INNER_HEIGHT, -INNER_THICKNESS / 2 + 0.25)); // low parapet on the city side
  for (const x of [-85, 85]) {
    const stair = stairs(2.4, 10, 1.2, 1.5, M.stone);
    stair.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2;
    stair.position.set(x + (x < 0 ? 7.5 : -7.5), 0, -INNER_THICKNESS / 2 - 1.2);
    walls.add(stair);
  }

  // Inner towers: 55 m apart, the gate between two great towers; each of two chambers.
  const innerTowers = [[-110, 'octagon'], [-55, 'square'], [-12, 'gate'], [12, 'gate'], [55, 'square'], [110, 'octagon']];
  for (const [x, kind] of innerTowers) {
    if (kind === 'octagon') {
      walls.add(cylinder(6.4, 6.6, 19, masonry, x, 0, 3.5, 8));
      walls.add(cylinder(6.8, 6.8, 0.5, M.stone, x, 18.5, 3.5, 8));
      walls.add(mesh(crenelRingGeometry(6.4, { count: 16, merlon: 1.3, height: 1.9, thickness: 0.9 }), masonry, x, 19, 3.5));
      for (let i = 0; i < 3; i++) {
        const angle = -Math.PI / 4 + (i * Math.PI) / 4;
        const slit = mesh(archGeometry(1.0, 2.2), M.opening, x + Math.sin(angle) * 6.62, 14.2, 3.5 + Math.cos(angle) * 6.62);
        slit.rotation.y = angle;
        walls.add(slit);
      }
    } else {
      const width = kind === 'gate' ? 12 : 11;
      const depth = 13;
      const height = kind === 'gate' ? 21 : 19;
      const z = 3.5;
      walls.add(box(width, height, depth, masonry, x, 0, z));
      walls.add(box(width + 0.6, 0.5, depth + 0.6, M.stone, x, INNER_HEIGHT - 0.5, z)); // string course at wall-walk level
      walls.add(box(width + 0.6, 0.5, depth + 0.6, M.stone, x, height - 0.5, z));
      walls.add(battlements(width, depth, x, height, z, masonry));
      // Upper chamber windows on the field side and flanks, a door from the city side below.
      for (const dx of [-3, 0, 3]) walls.add(mesh(archGeometry(1.1, 2.4), M.opening, x + dx, 14.5, z + depth / 2 + 0.03));
      for (const side of [-1, 1]) {
        const flank = mesh(archGeometry(1.1, 2.4), M.opening, x + side * (width / 2 + 0.03), 14.5, z + 2);
        flank.rotation.y = side * Math.PI / 2;
        walls.add(flank);
      }
      const door = mesh(archGeometry(1.8, 3.2), M.opening, x, 0.2, z - depth / 2 - 0.03);
      door.rotation.y = Math.PI;
      walls.add(door);
    }
  }
  // The gate itself: a marble frame with bronze doors standing open.
  walls.add(box(9, 1, 0.8, M.marble, 0, 10.6, -INNER_THICKNESS / 2 - 0.3));
  for (const side of [-1, 1]) walls.add(box(1.2, 10.6, 0.8, M.marble, side * 3.6, 0, -INNER_THICKNESS / 2 - 0.3));

  // Outer wall: 8.5 m high and 2 m thick, with smaller towers set between the inner ones.
  walls.add(mesh(archedWallGeometry({ length: LENGTH, height: OUTER_HEIGHT, thickness: 2, openings: [{ x: 0, width: 5, bottom: 0, spring: 5.5 }] }), masonry, 0, 0, OUTER_Z));
  walls.add(mesh(crenellationGeometry(LENGTH, { ...MERLONS, height: 1.6 }), masonry, 0, OUTER_HEIGHT, OUTER_Z + 0.55));
  for (const [x, round] of [[-82, true], [-33, false], [33, false], [82, true]]) {
    if (round) {
      walls.add(cylinder(4.2, 4.4, 12.5, masonry, x, 0, OUTER_Z + 1, 14, { thetaStart: -Math.PI / 2, thetaLength: Math.PI }));
      walls.add(box(8.4, 12.5, 2, masonry, x, 0, OUTER_Z));
      const ring = mesh(crenelRingGeometry(4.0, { count: 16, merlon: 1.1, height: 1.6, thickness: 0.8 }), masonry, x, 12.5, OUTER_Z + 1);
      walls.add(ring);
      for (const angle of [-0.9, 0, 0.9]) {
        const slit = mesh(archGeometry(0.9, 1.9), M.opening, x + Math.sin(angle) * 4.33, 9.5, OUTER_Z + 1 + Math.cos(angle) * 4.33);
        slit.rotation.y = angle;
        walls.add(slit);
      }
    } else {
      walls.add(box(7, 13, 7, masonry, x, 0, OUTER_Z + 2.5));
      walls.add(battlements(7, 7, x, 13, OUTER_Z + 2.5, masonry));
      for (const dx of [-2, 2]) walls.add(mesh(archGeometry(0.9, 1.9), M.opening, x + dx, 9.5, OUTER_Z + 6.03));
    }
  }

  // Breastwork along the scarp of the moat, broken by the bridge.
  for (const side of [-1, 1]) {
    const length = LENGTH / 2 - 4;
    const x = side * (4 + length / 2);
    walls.add(box(length, 1.6, 1.5, M.stone, x, 0, MOAT[0] - 0.75));
    walls.add(mesh(crenellationGeometry(length, { merlon: 0.8, gap: 0.8, height: 0.8, thickness: 1.3 }), M.stone, x, 1.6, MOAT[0] - 0.75));
  }
  // A stone bridge on two arches carries the road over the moat.
  const bridge = mesh(archedWallGeometry({ length: 24, height: MOAT_DEPTH + 1, thickness: 7, openings: [
    { x: -5.5, width: 7, bottom: 0, spring: 4.5 }, { x: 5.5, width: 7, bottom: 0, spring: 4.5 },
  ] }), M.stone, 0, -MOAT_DEPTH, 43.5);
  bridge.rotation.y = Math.PI / 2;
  walls.add(bridge);
  for (const side of [-1, 1]) walls.add(box(1.2, 0.8, 24, M.stone, side * 2.9, 1, 43.5));

  // Roads through the gate, and the city behind.
  walls.add(groundPlane(6, 36, M.dirt, 0, 0.03, 72));
  walls.add(groundPlane(6, 66, M.dirt, 0, 0.03, -46));
  scatterHouses(walls, createRandom(413), { count: 22, area: [-120, -76, 120, -18], avoid: [[0, -40, 10], [0, -20, 10], [0, -60, 10], [-78, -10, 8], [78, -10, 8]] });

  finalizeModel(walls);
  for (const x of [-12, 12]) {
    const banner = flag('byzantine', { width: 3.2, height: 2.2, pole: 6 });
    banner.position.set(x, 21, 3.5);
    walls.add(banner);
  }
  return walls;
}

/** Merlons around the four edges of a flat tower roof. */
function battlements(width, depth, x, y, z, material) {
  const group = new THREE.Group();
  const options = { ...MERLONS, merlon: 1.2 };
  for (const side of [-1, 1]) {
    group.add(mesh(crenellationGeometry(width, options), material, x, y, z + side * (depth / 2 - 0.45)));
    const flank = mesh(crenellationGeometry(depth - 1.8, options), material, x + side * (width / 2 - 0.45), y, z);
    flank.rotation.y = Math.PI / 2;
    group.add(flank);
  }
  return group;
}

/**
 * The walls' own masonry: courses of pale küfeki limestone ashlar divided
 * by bands of five brick courses, seven to eleven bands in the 12 m of the
 * inner wall. Painted locally so the bands keep their real 1.5 m rhythm.
 */
const masonryCache = new Map();
let masonryCanvas = null;
function wallMasonry(tile = 3) { // two bands per tile; 3 m in the diorama
  if (masonryCache.has(tile)) return masonryCache.get(tile);
  if (!masonryCanvas) masonryCanvas = paintMasonry();
  const texture = new THREE.CanvasTexture(masonryCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1 / tile, 1 / tile);
  texture.anisotropy = 8;
  const material = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.9, metalness: 0 });
  masonryCache.set(tile, material);
  return material;
}

function paintMasonry() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const rnd = createRandom(413);
  const vary = (c, amount) => {
    const k = 1 + (rnd.next() - 0.5) * amount;
    return `rgb(${(c[0] * k) | 0}, ${(c[1] * k) | 0}, ${(c[2] * k) | 0})`;
  };
  ctx.fillStyle = 'rgb(168, 160, 142)';
  ctx.fillRect(0, 0, size, size);
  const courses = (top, bottom, courseHeight, minLength, maxLength, mortar, colour, amount) => {
    for (let y = top; y < bottom; y += courseHeight) {
      const h = Math.min(courseHeight, bottom - y) - mortar;
      let x = -rnd.next() * maxLength;
      while (x < size) {
        const length = minLength + rnd.next() * (maxLength - minLength);
        ctx.fillStyle = vary(colour, amount);
        ctx.fillRect(x + mortar / 2, y + mortar / 2, length - mortar, h);
        if (x < 0) ctx.fillRect(x + size + mortar / 2, y + mortar / 2, length - mortar, h);
        if (x + length > size) ctx.fillRect(x - size + mortar / 2, y + mortar / 2, length - mortar, h);
        x += length;
      }
    }
  };
  const half = size / 2; // 1.5 m: 1.1 m of stone over 0.4 m of brick
  for (const top of [0, half]) {
    courses(top, top + 94, 31.3, 36, 70, 3, [208, 200, 182], 0.14);
    courses(top + 94, top + half, 6.8, 20, 30, 2.4, [158, 68, 46], 0.3);
  }
  for (let i = 0; i < 1800; i++) {
    ctx.fillStyle = `rgba(100, 85, 65, ${0.1 + rnd.next() * 0.12})`;
    const s = 0.6 + rnd.next() * 1.4;
    ctx.fillRect(rnd.next() * size, rnd.next() * size, s, s);
  }
  return canvas;
}

// ---------- map circuit ----------

/**
 * Map proportions, derived from the diorama at about six times true scale:
 * the 12 m inner wall becomes 0.75 units, its towers (11 m wide, 20 m high,
 * 55 m apart) 0.56 wide and 1.25 high; the outer wall, 17 m out, stands at
 * 0.9; the moat, 20 m wide at 33–54 m, becomes 1.1 wide at 2.1. Offsets are
 * to the west (left of travel, since the line runs south → north), which is
 * the field side.
 */
const MAP = {
  inner: { height: 0.75, thickness: 0.3, towerSpacing: 2.75, towerWidth: 0.56, towerDepth: 0.78, towerHeight: 1.25 },
  outer: { height: 0.5, thickness: 0.16, offset: 0.9, towerWidth: 0.4, towerHeight: 0.8 },
  moat: { offset: 2.1, width: 1.1 },
  merlon: { pitch: 0.2, width: 0.1, height: 0.1, thickness: 0.08 },
  bandTile: 0.1875, // two masonry bands: eight bands up the inner wall, as in the diorama
};

const moatMaterial = createWaterMaterial({ scale: 5 });

function createMapCircuit() {
  const walls = new THREE.Group();
  const y = LAND_HEIGHT;
  const masonry = wallMasonry(MAP.bandTile);
  const { inner, outer, moat, merlon } = MAP;

  // Inner wall: the curtain with its battlements along the field side, and the great towers.
  walls.add(mesh(wallAlongGeometry(LAND_WALLS, { height: inner.height, thickness: inner.thickness, y }), masonry));
  walls.add(mesh(merlonsAlong(LAND_WALLS, { ...merlon, offset: inner.thickness / 2 - merlon.thickness / 2, y: y + inner.height }), masonry));
  const towers = [];
  const caps = [];
  samplePolyline(LAND_WALLS, inner.towerSpacing / 2).forEach(({ point, dir }, i) => {
    const angle = Math.atan2(dir[1], dir[0]);
    const place = (geometry, out) => geometry.rotateY(angle).translate(point[0] - dir[1] * out, y, -point[1] - dir[0] * out);
    if (i % 2 === 0) {
      // Square and octagonal towers in turn, projecting towards the field like the diorama's.
      const octagon = i % 4 === 2;
      const out = octagon ? inner.thickness * 0.7 : inner.towerDepth / 2 - inner.thickness / 2 + 0.03;
      const radius = inner.towerWidth * 0.58;
      towers.push(place(octagon
        ? cylinderGeometry(radius, radius * 1.03, inner.towerHeight, 8).rotateY(Math.PI / 8)
        : boxGeometry(inner.towerWidth, inner.towerHeight, inner.towerDepth), out));
      caps.push(place((octagon
        ? cylinderGeometry(radius + 0.03, radius + 0.03, 0.03, 8).rotateY(Math.PI / 8)
        : boxGeometry(inner.towerWidth + 0.06, 0.03, inner.towerDepth + 0.06)).translate(0, inner.towerHeight - 0.03, 0), out));
    } else {
      // The outer wall's smaller towers, square and round in turn, set between the inner ones.
      const round = i % 4 === 3;
      const out = outer.offset + (round ? 0.08 : outer.towerWidth / 2 - outer.thickness / 2 + 0.02);
      towers.push(place(round
        ? cylinderGeometry(outer.towerWidth * 0.55, outer.towerWidth * 0.55, outer.towerHeight, 10)
        : boxGeometry(outer.towerWidth, outer.towerHeight, outer.towerWidth), out));
    }
  });
  walls.add(mesh(mergeGeometries(towers), masonry));
  walls.add(mesh(mergeGeometries(caps), mapStone));

  // Outer wall, lower and thinner, across the peribolos terrace.
  walls.add(mesh(wallAlongGeometry(LAND_WALLS, { height: outer.height, thickness: outer.thickness, y, offset: outer.offset }), masonry));

  // The moat: water between stone-lined scarps, the inner one crowned by its breastwork.
  walls.add(mesh(wallAlongGeometry(LAND_WALLS, { height: 0.04, thickness: moat.width, y: y - 0.02, offset: moat.offset }), moatMaterial));
  for (const edge of [-1, 1]) {
    walls.add(mesh(wallAlongGeometry(LAND_WALLS, { height: 0.05, thickness: 0.06, y, offset: moat.offset + edge * (moat.width / 2 + 0.02) }), mapStone));
  }
  walls.add(mesh(wallAlongGeometry(LAND_WALLS, { height: 0.12, thickness: 0.07, y, offset: moat.offset - moat.width / 2 - 0.1 }), mapStone));

  // The Golden Gate: a triumphal marble gateway between two great towers.
  const golden = new THREE.Group();
  golden.add(box(1.0, 1.7, 1.0, M.marble, 0, 0, -1.1));
  golden.add(box(1.0, 1.7, 1.0, M.marble, 0, 0, 1.1));
  golden.add(box(0.8, 1.2, 1.4, M.marble, 0, 0, 0));
  golden.add(box(0.82, 0.12, 1.42, M.gold, 0, 1.2, 0));
  // Set in the wall beside Yedikule, turned to run along it.
  const [east, north] = GOLDEN_GATE;
  const [[e0, n0], [e1, n1]] = LAND_WALLS.slice(2, 4);
  golden.position.set(east, y, -north);
  golden.rotation.y = Math.atan2(e0 - e1, n1 - n0);
  walls.add(golden);
  return finalizeModel(walls);
}

/** Merlons at a regular pitch along a polyline of [east, north] points, offset to its left, as one geometry. */
function merlonsAlong(points, { pitch, width, height, thickness, offset = 0, y = 0 }) {
  const line = offset ? offsetPolyline(points, offset) : points;
  const parts = [];
  for (const { point, dir } of samplePolyline(line, pitch)) {
    parts.push(boxGeometry(width, height, thickness).rotateY(Math.atan2(dir[1], dir[0])).translate(point[0], y, -point[1]));
  }
  return mergeGeometries(parts);
}

import * as THREE from 'three';
import { materials as M } from './lib/materials.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  archGeometry, archedWallGeometry, archShape, box, boxGeometry, crenelRingGeometry, crenellationGeometry, cylinder, cylinderGeometry, flag,
  groundPlane, mesh, stairs,
} from './lib/primitives.js';
import { bandAlongGeometry, mapStone, wallAlongGeometry } from './lib/mapWalls.js';
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
  walls.add(groundPlane(LENGTH, 31, M.dirt, 0, 0.08, 18));
  walls.add(box(LENGTH + 20, 4, 20, M.dirt, 0, -4 - MOAT_DEPTH, 43.5));
  walls.add(box(LENGTH + 20, 4, 36.5, M.grass, 0, -4, 71.75));
  for (const z of [MOAT[0] + 0.5, MOAT[1] - 0.5]) walls.add(box(LENGTH + 20, MOAT_DEPTH, 1, M.stone, 0, -MOAT_DEPTH, z));
  walls.add(groundPlane(LENGTH + 20, 19, M.water, 0, -MOAT_DEPTH + 2.5, 43.5));
  for (const x of [-80, 80]) walls.add(box(2.4, MOAT_DEPTH + 0.3, 19.9, M.stone, x, -MOAT_DEPTH, 43.5)); // dams dividing the moat, ending inside its scarps

  // Inner wall: 12 m high, 5 m thick, pierced by the gate; a parapet walk along the top.
  const gate = { x: 0, width: 6, bottom: 0, spring: 7.5 };
  // The masonry stops short under the string course, which runs 0.05 m past its ends, so their faces share no plane.
  walls.add(mesh(archedWallGeometry({ length: LENGTH, height: INNER_HEIGHT - 0.3, thickness: INNER_THICKNESS, openings: [gate] }), masonry));
  walls.add(box(LENGTH + 0.1, 0.5, INNER_THICKNESS + 0.6, M.stone, 0, INNER_HEIGHT - 0.5, 0)); // string course
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
      walls.add(cylinder(6.4, 6.6, 18.7, masonry, x, 0, 3.5, 8)); // stops short under the cap
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
      walls.add(box(width, height - 0.3, depth, masonry, x, 0, z)); // stops short under the cap
      walls.add(box(width + 0.6, 0.5, depth + 0.6, M.stone, x, INNER_HEIGHT - 0.45, z)); // string course at wall-walk level, 0.05 m over the wall's
      walls.add(box(width + 0.6, 0.5, depth + 0.6, M.stone, x, height - 0.5, z));
      walls.add(battlements(width, depth, x, height, z, masonry));
      // Upper chamber windows on the field side and flanks, a door from the city side below.
      for (const dx of [-3, 0, 3]) walls.add(mesh(archGeometry(1.1, 2.4), M.opening, x + dx, 14.5, z + depth / 2 + 0.05));
      for (const side of [-1, 1]) {
        const flank = mesh(archGeometry(1.1, 2.4), M.opening, x + side * (width / 2 + 0.05), 14.5, z + 2);
        flank.rotation.y = side * Math.PI / 2;
        walls.add(flank);
      }
      const door = mesh(archGeometry(1.8, 3.2), M.opening, x, 0.2, z - depth / 2 - 0.05);
      door.rotation.y = Math.PI;
      walls.add(door);
    }
  }
  // The gate itself: a marble frame with bronze doors standing open.
  walls.add(box(9, 1, 0.8, M.marble, 0, 10.6, -INNER_THICKNESS / 2 - 0.3));
  for (const side of [-1, 1]) walls.add(box(1.2, 10.6, 0.8, M.marble, side * 3.65, 0, -INNER_THICKNESS / 2 - 0.3)); // beside the jambs

  // Outer wall: 8.5 m high and 2 m thick, with smaller towers set between the inner ones.
  walls.add(mesh(archedWallGeometry({ length: LENGTH, height: OUTER_HEIGHT, thickness: 2, openings: [{ x: 0, width: 5, bottom: 0, spring: 5.5 }] }), masonry, 0, 0, OUTER_Z));
  walls.add(mesh(crenellationGeometry(LENGTH, { ...MERLONS, height: 1.6 }), masonry, 0, OUTER_HEIGHT, OUTER_Z + 0.55));
  for (const [x, round] of [[-82, true], [-33, false], [33, false], [82, true]]) {
    if (round) {
      walls.add(cylinder(4.2, 4.4, 12.5, masonry, x, 0, OUTER_Z + 1, 14, { thetaStart: -Math.PI / 2, thetaLength: Math.PI }));
      walls.add(box(8.4, 12.5, 2.1, masonry, x, 0, OUTER_Z)); // 0.05 m proud of the wall's faces
      const ring = mesh(crenelRingGeometry(4.0, { count: 16, merlon: 1.1, height: 1.6, thickness: 0.8 }), masonry, x, 12.5, OUTER_Z + 1);
      walls.add(ring);
      for (const angle of [-0.9, 0, 0.9]) {
        const slit = mesh(archGeometry(0.9, 1.9), M.opening, x + Math.sin(angle) * 4.33, 9.5, OUTER_Z + 1 + Math.cos(angle) * 4.33);
        slit.rotation.y = angle;
        walls.add(slit);
      }
    } else {
      walls.add(box(7, 13, 7.1, masonry, x, 0, OUTER_Z + 2.5)); // 0.05 m proud of the wall's back
      walls.add(battlements(7, 7, x, 13, OUTER_Z + 2.5, masonry));
      for (const dx of [-2, 2]) walls.add(mesh(archGeometry(0.9, 1.9), M.opening, x + dx, 9.5, OUTER_Z + 6.1));
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
    { x: -5.5, width: 6.9, bottom: 0, spring: 4.5 }, { x: 5.5, width: 6.9, bottom: 0, spring: 4.5 }, // the jambs 0.05 m inside the scarps
  ] }), M.stone, 0, -MOAT_DEPTH, 43.5);
  bridge.rotation.y = Math.PI / 2;
  walls.add(bridge);
  for (const side of [-1, 1]) walls.add(box(1.2, 0.8, 24, M.stone, side * 2.9, 1, 43.5));

  // Roads through the gate, and the city behind.
  walls.add(groundPlane(6, 36, M.dirt, 0, 0.08, 72));
  walls.add(groundPlane(6, 66, M.dirt, 0, 0.08, -46));
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
function battlements(width, depth, x, y, z, material, options = { ...MERLONS, merlon: 1.2 }) {
  const group = new THREE.Group();
  const inset = options.thickness / 2;
  for (const side of [-1, 1]) {
    group.add(mesh(crenellationGeometry(width, options), material, x, y, z + side * (depth / 2 - inset)));
    const flank = mesh(crenellationGeometry(depth - 4 * inset, options), material, x + side * (width / 2 - inset), y, z);
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
    // The Golden Gate's pylons and its outer gate take the place of the ordinary towers there.
    if (Math.hypot(point[0] - GOLDEN_GATE[0], point[1] - GOLDEN_GATE[1]) < (i % 2 === 0 ? 1.85 : 1.1)) return;
    const angle = Math.atan2(dir[1], dir[0]);
    const place = (geometry, out) => geometry.rotateY(angle).translate(point[0] - dir[1] * out, y, -point[1] - dir[0] * out);
    if (i % 2 === 0) {
      // Square and octagonal towers in turn, projecting towards the field like the diorama's.
      const octagon = i % 4 === 2;
      const out = octagon ? inner.thickness * 0.7 : inner.towerDepth / 2 - inner.thickness / 2 + 0.03;
      const radius = inner.towerWidth * 0.58;
      towers.push(place(octagon // each stops short under its cap
        ? cylinderGeometry(radius, radius * 1.03, inner.towerHeight - 0.02, 8).rotateY(Math.PI / 8)
        : boxGeometry(inner.towerWidth, inner.towerHeight - 0.02, inner.towerDepth), out));
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
  walls.add(mesh(bandAlongGeometry(LAND_WALLS, { height: 0.04, width: moat.width, y: y - 0.02, offset: moat.offset }), moatMaterial));
  for (const edge of [-1, 1]) {
    walls.add(mesh(bandAlongGeometry(LAND_WALLS, { height: 0.05, width: 0.06, y, offset: moat.offset + edge * (moat.width / 2 + 0.02) }), mapStone));
  }
  walls.add(mesh(bandAlongGeometry(LAND_WALLS, { height: 0.12, width: 0.07, y, offset: moat.offset - moat.width / 2 - 0.1 }), mapStone));

  walls.add(createGoldenGate(y));
  finalizeModel(walls);
  walls.userData.keepOut = [[...GOLDEN_GATE, 1.9]]; // no houses against the pylons
  return walls;
}

// ---------- the Golden Gate ----------

/**
 * The Golden Gate in map units, at the same exaggeration as the walls:
 * Theodosius' triumphal arch of polished marble, its three arches between
 * two great square pylons that stand out towards the field; the gilded doors
 * in the middle arch, the dedication in gilded letters above it, and on the
 * attic the emperor's chariot drawn by four elephants. In front of it, the
 * smaller outer gate between its own towers, faced with marble reliefs, and
 * a bridge over the moat.
 *
 * Each part is set square to the line it belongs to (the inner wall, the
 * outer wall, the moat). Local x points to the city and z along the wall.
 *
 * Sources: Wikipedia, Golden Gate (Constantinople); Bardill, "The Golden
 * Gate in Constantinople: a triumphal arch of Theodosius I" (AJA 103, 1999).
 */
function createGoldenGate(y) {
  const gate = new THREE.Group();
  const marble = goldenGateMarble();
  // Where the gate's axis crosses a line, and the direction (local +x) towards the city there.
  const frame = (offset) => {
    const line = offset ? offsetPolyline(LAND_WALLS, offset) : LAND_WALLS;
    const [[e0, n0], [e1, n1]] = line.slice(2, 4);
    const [de, dn] = [e1 - e0, n1 - n0];
    const t = ((GOLDEN_GATE[0] - e0) * de + (GOLDEN_GATE[1] - n0) * dn) / (de * de + dn * dn);
    return { at: [e0 + de * t, n0 + dn * t], city: [dn / Math.hypot(de, dn), -de / Math.hypot(de, dn)] };
  };
  const along = (offset, part) => {
    const { at, city } = frame(offset);
    part.position.set(at[0], y, -at[1]);
    part.rotation.y = Math.atan2(city[1], city[0]);
    gate.add(part);
  };
  along(0, innerGoldenGate(marble));
  along(MAP.outer.offset, outerGoldenGate(marble));
  // The gate stands just past a bend, where the moat's field bank still runs at the angle of the stretch
  // before it, so the bridge is measured out to each bank along its own line rather than across the moat.
  const { at, city } = frame(MAP.moat.offset);
  const bank = (side) => {
    const line = offsetPolyline(LAND_WALLS, MAP.moat.offset - side * (MAP.moat.width / 2 + 0.02));
    return rayToPolyline(at, [city[0] * side, city[1] * side], line) ?? MAP.moat.width / 2;
  };
  along(MAP.moat.offset, moatBridge(-bank(-1), bank(1)));
  // A part of its own on the map: clicked or hovered, it stands for the Golden Gate's region, not the
  // walls. Merged here and kept out of the walls' merge (dynamic) so it can be picked and glow alone.
  finalizeModel(gate);
  gate.userData.regionId = 'golden-gate';
  gate.userData.dynamic = true;
  return gate;
}

/** An arched panel (a door, a window) facing local -x (the field) or +x (the city). */
function archPanel(width, height, material, x, y, z, facing) {
  const panel = mesh(archGeometry(width, height), material, x, y, z);
  panel.rotation.y = facing * Math.PI / 2;
  return panel;
}

/** A wall along z pierced by arches: archedWallGeometry turned to run along the gate. */
function arcadeAlongZ(options, material, x, y, z) {
  return mesh(archedWallGeometry({ ...options, curveSegments: 8 }).rotateY(Math.PI / 2), material, x, y, z);
}

const GATE_MERLONS = { merlon: 0.07, gap: 0.05, height: 0.07, thickness: 0.05 };

function innerGoldenGate(marble) {
  const group = new THREE.Group();
  // Square pylons projecting to the field, each on a plinth, belted at the wall-walk and crowned by a cornice and battlements.
  const pylon = { size: 0.9, height: 1.5, x: -0.1, z: 1.0 };
  for (const side of [-1, 1]) {
    const z = side * pylon.z;
    group.add(box(pylon.size + 0.08, 0.08, pylon.size + 0.08, marble, pylon.x, 0, z));
    group.add(box(pylon.size, pylon.height + 0.02, pylon.size, marble, pylon.x, 0, z)); // runs into the cornice
    group.add(box(pylon.size + 0.05, 0.04, pylon.size + 0.05, marble, pylon.x, MAP.inner.height, z));
    group.add(box(pylon.size + 0.08, 0.06, pylon.size + 0.08, marble, pylon.x, pylon.height, z));
    group.add(battlements(pylon.size + 0.04, pylon.size + 0.04, pylon.x, pylon.height + 0.06, z, marble, GATE_MERLONS));
    // Two windows to the field and to the city, one to the outer flank, high in the upper chamber.
    const face = pylon.size / 2 + 0.012;
    for (const facing of [-1, 1]) {
      for (const dz of [-0.2, 0.2]) group.add(archPanel(0.1, 0.18, M.opening, pylon.x + facing * face, 1.12, z + dz, facing));
    }
    const flank = mesh(archGeometry(0.1, 0.18), M.opening, pylon.x, 1.12, z + side * face);
    flank.rotation.y = side > 0 ? 0 : Math.PI;
    group.add(flank);
  }

  // The triumphal arch between them: a great middle arch and two lesser ones, cut through to the doors.
  const arch = { x: -0.05, thickness: 0.6, length: 1.2, height: 0.92 };
  const middle = { width: 0.36, spring: 0.5 };
  const lesser = { width: 0.16, spring: 0.28, z: 0.35 };
  const field = arch.x - arch.thickness / 2;
  group.add(arcadeAlongZ({
    length: arch.length, height: arch.height, thickness: arch.thickness, openings: [
      { x: -lesser.z, width: lesser.width, bottom: 0, spring: lesser.spring },
      { x: 0, width: middle.width, bottom: 0, spring: middle.spring },
      { x: lesser.z, width: lesser.width, bottom: 0, spring: lesser.spring },
    ],
  }, marble, arch.x, 0, 0));
  // The curtain wall runs on through the gate: the doors close the passages in front of it on both sides.
  const curtain = MAP.inner.thickness / 2 + 0.05;
  for (const facing of [-1, 1]) {
    const doors = facing < 0 ? M.gold : M.bronze;
    group.add(archPanel(middle.width, middle.spring + middle.width / 2, doors, facing * curtain, 0, 0, facing));
    for (const side of [-1, 1]) group.add(archPanel(lesser.width, lesser.spring + lesser.width / 2, M.bronze, facing * curtain, 0, side * lesser.z, facing));
  }
  // On the field face: pilasters between the arches, a gilded archivolt round the middle one, the dedication above.
  for (const z of [-0.485, -0.235, 0.235, 0.485]) {
    group.add(box(0.03, 0.7, 0.04, marble, field - 0.015, 0, z));
    group.add(box(0.045, 0.03, 0.06, marble, field - 0.0225, 0.7, z));
  }
  const archivolt = new THREE.Shape(archShape(middle.width + 0.04, middle.spring + middle.width / 2 + 0.02).getPoints(12));
  archivolt.holes.push(new THREE.Path(archShape(middle.width, middle.spring + middle.width / 2).getPoints(12).reverse()));
  group.add(mesh(new THREE.ExtrudeGeometry(archivolt, { depth: 0.02, bevelEnabled: false }).rotateY(-Math.PI / 2), M.gold, field, 0, 0));
  const inscription = mesh(new THREE.PlaneGeometry(0.82, 0.1), goldenGateInscription(), field - 0.012, 0.79, 0);
  inscription.rotation.y = -Math.PI / 2;
  group.add(inscription);
  // Cornice and attic, running into the pylons.
  group.add(box(arch.thickness + 0.08, 0.05, arch.length - 0.06, marble, arch.x, arch.height - 0.02, 0));
  group.add(box(arch.thickness - 0.1, 0.15, arch.length - 0.06, marble, arch.x, arch.height + 0.02, 0));

  // On the attic, the emperor in a chariot drawn by four elephants, all gilded, facing the field.
  const top = arch.height + 0.17;
  group.add(box(0.22, 0.05, 0.32, marble, arch.x, top - 0.01, 0));
  const quadriga = new THREE.Group();
  for (const z of [-0.105, -0.035, 0.035, 0.105]) {
    quadriga.add(box(0.07, 0.035, 0.04, M.gold, -0.02, 0, z)); // legs
    quadriga.add(box(0.1, 0.05, 0.05, M.gold, -0.02, 0.03, z)); // body
    quadriga.add(box(0.035, 0.045, 0.042, M.gold, -0.08, 0.05, z)); // head
    quadriga.add(box(0.014, 0.05, 0.014, M.gold, -0.1, 0.01, z)); // trunk
  }
  quadriga.add(box(0.05, 0.05, 0.16, M.gold, 0.07, 0, 0)); // chariot
  quadriga.add(cylinder(0.02, 0.024, 0.08, M.gold, 0.07, 0.04, 0, 8)); // the emperor
  quadriga.add(box(0.03, 0.03, 0.03, M.gold, 0.07, 0.12, 0));
  quadriga.position.set(arch.x - 0.01, top + 0.04, 0);
  group.add(quadriga);
  return group;
}

function outerGoldenGate(marble) {
  const group = new THREE.Group();
  const { height, thickness } = MAP.outer;
  // The gatehouse straddles the outer wall, its arch closed by bronze doors on either face of the curtain.
  const house = { length: 0.64, height: 0.58, thickness: 0.26 };
  const opening = { width: 0.2, spring: 0.24 };
  group.add(arcadeAlongZ({ length: house.length, height: house.height, thickness: house.thickness, openings: [{ x: 0, width: opening.width, bottom: 0, spring: opening.spring }] }, marble, 0, 0, 0));
  for (const facing of [-1, 1]) group.add(archPanel(opening.width, opening.spring + opening.width / 2, M.bronze, facing * (thickness / 2 + 0.03), 0, 0, facing));
  group.add(box(house.thickness + 0.04, 0.03, house.length + 0.04, marble, 0, house.height - 0.01, 0));
  group.add(mesh(crenellationGeometry(house.length - 0.04, GATE_MERLONS).rotateY(Math.PI / 2), marble, -house.thickness / 2 + 0.025, house.height + 0.02, 0));
  // A frieze of marble reliefs over the arch, on the field face.
  const reliefs = goldenGateReliefs();
  for (const z of [-0.21, -0.07, 0.07, 0.21]) group.add(box(0.015, 0.09, 0.12, reliefs, -house.thickness / 2 - 0.0075, 0.4, z));
  // Square towers flanking it, a little taller, standing out to the field.
  const tower = { size: 0.28, height: 0.7, x: -0.04, z: 0.45 };
  for (const side of [-1, 1]) {
    const z = side * tower.z;
    group.add(box(tower.size, tower.height + 0.01, tower.size, marble, tower.x, 0, z));
    group.add(box(tower.size + 0.04, 0.03, tower.size + 0.04, marble, tower.x, tower.height, z));
    group.add(battlements(tower.size, tower.size, tower.x, tower.height + 0.03, z, marble, GATE_MERLONS));
    group.add(archPanel(0.06, 0.11, M.opening, tower.x - tower.size / 2 - 0.012, 0.42, z, -1));
  }
  return group;
}

/**
 * A stone bridge on two arches over the moat, with low parapets; the water runs under it. `field`
 * and `city` are where the banks lie along local x (the moat's middle at 0); it rests on both, its arches
 * centred over the water between them.
 */
function moatBridge(field, city) {
  const group = new THREE.Group();
  const [from, to] = [field - 0.18, city + 0.18];
  const [length, middle] = [to - from, (from + to) / 2];
  const deck = { width: 0.22, height: 0.18 };
  group.add(mesh(archedWallGeometry({ length, height: deck.height, thickness: deck.width, curveSegments: 8, openings: [
    { x: -0.24, width: 0.3, bottom: 0, spring: 0 }, { x: 0.24, width: 0.3, bottom: 0, spring: 0 },
  ] }), mapStone, middle, -0.04, 0));
  for (const side of [-1, 1]) group.add(box(length, 0.04, 0.025, mapStone, middle, deck.height - 0.04, side * (deck.width / 2 - 0.0125)));
  return group;
}

/** How far a ray from `from` along `direction` ([east, north]) runs before it meets a polyline, or null if it never does. */
function rayToPolyline(from, direction, line) {
  let nearest = null;
  for (let i = 1; i < line.length; i++) {
    const [[ax, an], [bx, bn]] = [line[i - 1], line[i]];
    const [ex, en] = [bx - ax, bn - an];
    const denominator = direction[0] * en - direction[1] * ex;
    if (Math.abs(denominator) < 1e-9) continue;
    const [px, pn] = [ax - from[0], an - from[1]];
    const distance = (px * en - pn * ex) / denominator;
    const along = (px * direction[1] - pn * direction[0]) / denominator;
    if (distance >= 0 && along >= 0 && along <= 1 && (nearest === null || distance < nearest)) nearest = distance;
  }
  return nearest;
}

/**
 * The gate's own marble: large, close-jointed blocks of white Proconnesian
 * marble, eight courses to the tile, faintly veined.
 */
let goldenMarble = null;
function goldenGateMarble() {
  if (goldenMarble) return goldenMarble;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const rnd = createRandom(388);
  ctx.fillStyle = 'rgb(214, 207, 194)';
  ctx.fillRect(0, 0, size, size);
  const course = size / 8;
  for (let row = 0; row < 8; row++) {
    let x = -rnd.next() * 90;
    while (x < size) {
      const length = 52 + rnd.next() * 52;
      const k = 1 + (rnd.next() - 0.5) * 0.06;
      ctx.fillStyle = `rgb(${(240 * k) | 0}, ${(236 * k) | 0}, ${(226 * k) | 0})`;
      for (const shift of [0, size]) ctx.fillRect(x + 1 - shift, row * course + 1, length - 2, course - 2);
      x += length;
    }
  }
  ctx.lineWidth = 1;
  for (let i = 0; i < 14; i++) {
    ctx.strokeStyle = `rgba(130, 122, 112, ${0.08 + rnd.next() * 0.1})`;
    ctx.beginPath();
    const y = rnd.next() * size;
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(size * 0.3, y + (rnd.next() - 0.5) * 60, size * 0.6, y + (rnd.next() - 0.5) * 60, size, y);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1 / 0.32, 1 / 0.32);
  texture.anisotropy = 8;
  goldenMarble = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.45, metalness: 0 });
  return goldenMarble;
}

/** The dedication in gilded bronze letters, in two lines over the middle arch. */
function goldenGateInscription() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgb(236, 231, 220)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '600 40px "Times New Roman", serif';
  ctx.fillStyle = 'rgb(176, 128, 32)';
  ctx.fillText('HAEC LOCA THEVDOSIVS DECORAT POST FATA TYRANNI', 512, 38, 1000);
  ctx.fillText('AVREA SAECLA GERIT QVI PORTAM CONSTRVIT AVRO', 512, 92, 1000);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return new THREE.MeshStandardMaterial({ map: texture, roughness: 0.4, metalness: 0.15 });
}

/** A marble relief panel: figures in a moulded frame, lit from above. */
function goldenGateReliefs() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  const rnd = createRandom(447);
  ctx.fillStyle = 'rgb(196, 188, 172)';
  ctx.fillRect(0, 0, 128, 96);
  ctx.fillStyle = 'rgb(226, 220, 206)';
  ctx.fillRect(10, 10, 108, 76);
  for (let i = 0; i < 4; i++) {
    const x = 26 + i * 25 + (rnd.next() - 0.5) * 6;
    ctx.fillStyle = 'rgb(160, 150, 134)';
    ctx.beginPath();
    ctx.ellipse(x + 2, 34, 6, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(x - 5, 42, 14, 34);
    ctx.fillStyle = 'rgb(246, 241, 230)';
    ctx.beginPath();
    ctx.ellipse(x, 32, 6, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(x - 7, 40, 14, 34);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  // A box's faces carry UVs in their own size; this panel's face is 0.12 × 0.09.
  texture.repeat.set(1 / 0.12, 1 / 0.09);
  return new THREE.MeshStandardMaterial({ map: texture, roughness: 0.5 });
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

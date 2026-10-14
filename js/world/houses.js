import * as THREE from 'three';
import { HOUSE_ATLAS, HOUSE_FOOT, HOUSE_STOREY } from '../models/lib/textures.js';
import { atlasUV, block, gable, roofSlope, surface, townMaterials, wall, well } from './atlasGeometry.js';

/**
 * The map's houses, after a two-storey Byzantine town house: a rubble ground
 * floor, an upper floor of banded stone and brick patched with plaster, a
 * roof of Roman tiles, and — on the fullest of them — a lower wing under a
 * catslide roof with a wooden balcony reached by an outside stone stair.
 *
 * Each variant is built once in a unit frame, then instanced: x runs along
 * the street (-0.5…0.5, scaled by the house's width), z across it with the
 * street at +z (scaled by its depth), and y up, with the eaves of the main
 * block at 1 (scaled by its height) and the walls running HOUSE_FOOT below
 * ground so that a house on a slope never floats. Windows, doors, timbers and
 * masonry are painted on one atlas (textures.js) rather than modelled.
 *
 * houses: [{ point: [east, north], y, angle, w, d, h, farm }] — `angle` turns
 * the house's +x along the street, so that its front (+z) faces the street;
 * farmhouses stand in a walled yard.
 */
export function createHouses(rnd, houses) {
  const { walls, roofs: roofing } = townMaterials();
  const groups = VARIANTS.map(() => []);
  for (const house of houses) groups[pickVariant(rnd, house)].push(house);

  const group = new THREE.Group();
  const matrix = new THREE.Matrix4();
  const rotation = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  VARIANTS.forEach((variant, k) => {
    const members = groups[k];
    if (members.length === 0) return;
    const { body, roof } = variant.geometry();
    const meshes = [new THREE.InstancedMesh(body, walls, members.length), new THREE.InstancedMesh(roof, roofing, members.length)];
    members.forEach(({ point: [east, north], y, angle, w, d, h }, i) => {
      matrix.compose(new THREE.Vector3(east, y, -north), rotation.setFromAxisAngle(up, angle), new THREE.Vector3(w, h, d));
      meshes[0].setMatrixAt(i, matrix);
      meshes[1].setMatrixAt(i, matrix);
      meshes[0].setColorAt(i, tone(rnd, WALL_TINTS));
      meshes[1].setColorAt(i, tone(rnd, ROOF_TINTS, 0.12));
    });
    for (const mesh of meshes) mesh.castShadow = mesh.receiveShadow = true;
    group.add(...meshes);
  });
  return group;
}

// The atlas is painted in the reference's own colours; these tints only nudge a house warmer or cooler.
const palette = (...hexes) => hexes.map((hex) => new THREE.Color(hex));
const WALL_TINTS = palette(0xffffff, 0xfff4e6, 0xf2eee8, 0xffeedd, 0xeae6e0);
const ROOF_TINTS = palette(0xffffff, 0xfaeee8, 0xfff4ea, 0xf0e6e0);

function tone(rnd, colours, jitter = 0.06) {
  return rnd.pick(colours).clone().multiplyScalar(1 - jitter + rnd.next() * jitter);
}

/** Narrow houses turn their gable to the street; wider ones are mostly the full house with its wing, stair and balcony. */
function pickVariant(rnd, { w, farm }) {
  const index = (name) => VARIANTS.findIndex((variant) => variant.name === name);
  if (farm) return index(rnd.chance(0.5) ? 'farmstead' : 'farmsteadMirrored');
  if (w < 0.3) return index('gabled');
  const roll = rnd.next();
  if (roll < 0.25) return index('loggia');
  if (roll < 0.5) return index('loggiaMirrored');
  if (roll < 0.78) return index('balconied');
  return index('gabledWide');
}

const VARIANTS = [
  { name: 'loggia', geometry: () => loggiaHouse() },
  { name: 'loggiaMirrored', geometry: () => mirrored(loggiaHouse()) },
  { name: 'farmstead', geometry: () => loggiaHouse({ front: 0.12, yard: true }) },
  { name: 'farmsteadMirrored', geometry: () => mirrored(loggiaHouse({ front: 0.12, yard: true })) },
  { name: 'gabled', geometry: () => gabledHouse(HOUSE_ATLAS.gableFront1) },
  { name: 'gabledWide', geometry: () => gabledHouse(HOUSE_ATLAS.gableFront2) },
  { name: 'balconied', geometry: () => balconiedHouse() },
];

// ---------- variants ----------

const FOOT = -HOUSE_FOOT;
const FLOOR = HOUSE_STOREY; // top of the upper floor's boards
const EAVES = 0.07; // overhang of the eaves, in units of width or depth
const VERGE = 0.04; // overhang at the gable ends

/**
 * The reference house: a tall main block with its gable to the street, and a
 * lower wing beside it under the main roof's long catslide. The wing stands
 * back from the street, and in front of it a wooden balcony on posts is
 * reached by a stone stair rising along the main block. A farmstead stands
 * back from a walled yard with a well.
 */
function loggiaHouse({ front = 0.5, yard = false } = {}) {
  const body = surface();
  const roof = surface();
  const back = -0.5;
  const [left, join, right] = [-0.5, 0.06, 0.5];
  const ridge = (left + join) / 2;
  const rise = 0.34;
  const low = 0.72; // eaves of the catslide over the wing
  const wingFront = front - 0.36 * (front - back);
  const stairRight = join + 0.15;
  const atlas = HOUSE_ATLAS;

  // The main block, its gables, and the stretch of its side left open beside the stair.
  wall(body, atlas.gableFront2, [left, front], [join, front]);
  wall(body, atlas.sideWall, [join, back], [left, back]);
  wall(body, atlas.sideWall, [left, back], [left, front]);
  wall(body, atlas.sideWall, [join, front], [join, wingFront]);
  for (const [a, b] of [[[left, front], [join, front]], [[join, back], [left, back]]]) gable(body, atlas.gable, a, b, rise);

  // The wing: its top follows the catslide down from the main eaves.
  wall(body, atlas.wingFront, [join, wingFront], [right, wingFront], [[0, FOOT], [1, FOOT], [1, low], [0, 1]]);
  wall(body, atlas.wingSide, [right, wingFront], [right, back], [[0, FOOT], [1, FOOT], [1, low], [0, low]]);
  wall(body, atlas.wingSide, [right, back], [join, back], [[0, FOOT], [1, FOOT], [1, 1], [0, low]]);

  // Roof: the main gable, its right slope running on over the wing at a gentler pitch.
  const leftEaves = left - EAVES;
  const slope = rise / (ridge - left);
  const catslide = (1 - low) / (right - join);
  const z = [back - VERGE, front + VERGE];
  roofSlope(roof, [ridge, 1 + rise], [leftEaves, 1 - EAVES * slope], z);
  roofSlope(roof, [ridge, 1 + rise], [join, 1], z, { eaves: false });
  roofSlope(roof, [join, 1], [right + EAVES, low - EAVES * catslide], z);
  const underRoof = (x) => 1 - (x - join) * catslide;

  // The balcony: boards, a railing along its front and open end, and posts up to the roof.
  const rail = front - 0.04;
  block(body, atlas.wood, [stairRight, right], [FLOOR - 0.04, FLOOR], [wingFront, front - 0.02], { faces: ['top', 'front', 'right'] });
  screen(body, [stairRight, right], [FLOOR, FLOOR + 0.15], rail, 'z');
  screen(body, [wingFront, rail], [FLOOR, FLOOR + 0.15], right - 0.012, 'x');
  for (const x of [stairRight + 0.016, right - 0.016]) {
    block(body, atlas.wood, [x - 0.014, x + 0.014], [FOOT, underRoof(x) - 0.01], [rail - 0.016, rail + 0.012], { faces: ['front', 'back', 'left', 'right'] });
  }

  // The stair: steps up from the street to a landing at the balcony's level.
  stair(body, [join, stairRight], front, wingFront, 4);

  if (yard) {
    // A walled yard before the house: a front wall broken by a gateway in line with the stair, and a well.
    const height = 0.24;
    const thick = 0.035;
    const gate = [join - 0.04, stairRight + 0.06];
    const yardWall = (x, zRange) => block(body, atlas.rubble, x, [FOOT, height], zRange, { faces: ['top', 'front', 'back', 'left', 'right'] });
    yardWall([-0.5, gate[0]], [0.5 - thick, 0.5]);
    yardWall([gate[1], 0.5], [0.5 - thick, 0.5]);
    yardWall([-0.5, -0.5 + thick], [front, 0.5 - thick]);
    yardWall([0.5 - thick, 0.5], [front, 0.5 - thick]);
    well(body, [0.33, (front + 0.5) / 2 - 0.02], 0.06, 0.16);
  }
  return { body: body.geometry(), roof: roof.geometry() };
}

/** A plain two-storey block with its gable to the street. */
function gabledHouse(frontRegion) {
  const body = surface();
  const roof = surface();
  const rise = 0.42;
  wall(body, frontRegion, [-0.5, 0.5], [0.5, 0.5]);
  wall(body, HOUSE_ATLAS.sideWall, [0.5, -0.5], [-0.5, -0.5]);
  wall(body, HOUSE_ATLAS.sideWall, [-0.5, -0.5], [-0.5, 0.5]);
  wall(body, HOUSE_ATLAS.sideWall, [0.5, 0.5], [0.5, -0.5]);
  gable(body, HOUSE_ATLAS.gable, [-0.5, 0.5], [0.5, 0.5], rise);
  gable(body, HOUSE_ATLAS.gable, [0.5, -0.5], [-0.5, -0.5], rise);
  const z = [-0.5 - VERGE, 0.5 + VERGE];
  const eavesDrop = EAVES * rise / 0.5;
  roofSlope(roof, [0, 1 + rise], [-0.5 - EAVES, 1 - eavesDrop], z);
  roofSlope(roof, [0, 1 + rise], [0.5 + EAVES, 1 - eavesDrop], z);
  return { body: body.geometry(), roof: roof.geometry() };
}

/** A long front under the eaves, with a wooden balcony on beam ends before the upper floor's door. */
function balconiedHouse() {
  const body = surface();
  const roof = surface();
  const rise = 0.4;
  const atlas = HOUSE_ATLAS;
  wall(body, atlas.eavesFront, [-0.5, 0.5], [0.5, 0.5]);
  wall(body, atlas.sideWall, [0.5, -0.5], [-0.5, -0.5]);
  wall(body, atlas.sideWall, [-0.5, -0.5], [-0.5, 0.5]);
  wall(body, atlas.sideWall, [0.5, 0.5], [0.5, -0.5]);
  gable(body, atlas.gable, [-0.5, -0.5], [-0.5, 0.5], rise);
  gable(body, atlas.gable, [0.5, 0.5], [0.5, -0.5], rise);
  // The roof slopes to front and back; built along x, then turned so its ridge runs along the street.
  const slopes = surface();
  const eaves = 0.1; // deep enough to shelter the balcony
  roofSlope(slopes, [0, 1 + rise], [-0.5 - eaves, 1 - (eaves * rise) / 0.5], [-0.5 - VERGE, 0.5 + VERGE]);
  roofSlope(slopes, [0, 1 + rise], [0.5 + eaves, 1 - (eaves * rise) / 0.5], [-0.5 - VERGE, 0.5 + VERGE]);
  roof.add(slopes, (p) => [-p[2], p[1], p[0]]);

  const [x0, x1] = [-0.2, 0.2];
  const out = 0.62;
  block(body, atlas.wood, [x0, x1], [FLOOR - 0.04, FLOOR], [0.5, out], { faces: ['top', 'front', 'left', 'right'] });
  screen(body, [x0, x1], [FLOOR, FLOOR + 0.15], out - 0.01, 'z');
  for (const x of [x0 + 0.01, x1 - 0.01]) screen(body, [0.5, out - 0.01], [FLOOR, FLOOR + 0.15], x, 'x');
  for (const x of [x0 + 0.04, x1 - 0.04]) {
    block(body, atlas.wood, [x - 0.012, x + 0.012], [FLOOR - 0.07, FLOOR - 0.04], [0.5, out - 0.02], { faces: ['front', 'left', 'right', 'bottom'] });
  }
  return { body: body.geometry(), roof: roof.geometry() };
}

// ---------- house parts ----------

/** A railing of slats: two faces back to back and a capping rail, standing in the plane x = at or z = at. */
function screen(target, [a0, a1], [y0, y1], at, axis) {
  const thin = 0.008;
  const point = (along, y, offset) => (axis === 'z' ? [along, y, at + offset] : [at + offset, y, along]);
  const facing = (sign) => (axis === 'z' ? [0, 0, sign] : [sign, 0, 0]);
  for (const sign of [1, -1]) {
    const points = [point(a0, y0, sign * thin), point(a1, y0, sign * thin), point(a1, y1, sign * thin), point(a0, y1, sign * thin)];
    target.polygon(points, [[0, 0], [1, 0], [1, 1], [0, 1]].map(([s, t]) => atlasUV(HOUSE_ATLAS.railing, s, t)), facing(sign));
  }
  const cap = [point(a0, y1, -thin), point(a1, y1, -thin), point(a1, y1, thin), point(a0, y1, thin)];
  target.polygon(cap, [[0, 0.9], [1, 0.9], [1, 1], [0, 1]].map(([s, t]) => atlasUV(HOUSE_ATLAS.railing, s, t)), [0, 1, 0]);
}

/**
 * Stone steps climbing from the street (z = from) back to a landing at the
 * balcony's floor, set against the main block, so only their treads, risers
 * and open side show.
 */
function stair(target, [x0, x1], from, to, count) {
  const landing = 0.08;
  const run = (from - to - landing) / count;
  const levels = Array.from({ length: count + 1 }, (_, i) => (FLOOR * (i + 1)) / (count + 1));
  levels[count] = FLOOR;
  let previous = FOOT;
  for (let i = 0; i <= count; i++) {
    const near = from - i * run;
    const far = i === count ? to : near - run;
    const y = levels[i];
    block(target, HOUSE_ATLAS.steps, [x0, x1], [previous, y], [far, near], { faces: ['front'] });
    block(target, HOUSE_ATLAS.steps, [x0, x1], [y, y], [far, near], { faces: ['top'] });
    const side = [[x1, FOOT, near], [x1, FOOT, far], [x1, y, far], [x1, y, near]];
    target.polygon(side, side.map(([, yy, z]) => atlasUV(HOUSE_ATLAS.rubble, (from - z) / (from - to), (yy - FOOT) / (FLOOR - FOOT))), [1, 0, 0]);
    previous = y;
  }
}

/** The same house with its plan reflected, the wing on the other hand. */
function mirrored({ body, roof }) {
  for (const geometry of [body, roof]) {
    for (const name of ['position', 'normal']) {
      const attribute = geometry.attributes[name];
      for (let i = 0; i < attribute.count; i++) attribute.setX(i, -attribute.getX(i));
    }
    // Reflection turns every triangle inside out; swap two corners of each to turn it back.
    for (const attribute of Object.values(geometry.attributes)) {
      for (let tri = 0; tri < attribute.count; tri += 3) {
        for (let k = 0; k < attribute.itemSize; k++) {
          const a = attribute.array[(tri + 1) * attribute.itemSize + k];
          attribute.array[(tri + 1) * attribute.itemSize + k] = attribute.array[(tri + 2) * attribute.itemSize + k];
          attribute.array[(tri + 2) * attribute.itemSize + k] = a;
        }
      }
    }
  }
  return { body, roof };
}

import * as THREE from 'three';
import { HOUSE_ATLAS, HOUSE_FOOT, HOUSE_STOREY, townHouseAtlas } from '../models/lib/textures.js';

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
  const atlas = townHouseAtlas();
  const walls = new THREE.MeshStandardMaterial({ map: atlas, vertexColors: true, roughness: 0.92 });
  const roofing = new THREE.MeshStandardMaterial({ map: atlas, vertexColors: true, roughness: 0.8 });
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
const ROOF = 0.05; // thickness of the roof slabs
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

// ---------- building blocks ----------

/**
 * Accumulates flat-shaded triangles with atlas UVs and a vertex shade: walls
 * darken towards their foot, a cheap stand-in for ambient occlusion.
 */
function surface() {
  const position = [];
  const normal = [];
  const uv = [];
  const color = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const n = new THREE.Vector3();
  const footShade = (y) => 0.68 + 0.32 * THREE.MathUtils.clamp((y + 0.05) / 0.55, 0, 1);

  return {
    /** A convex polygon, wound to face `outward`, fanned into triangles. */
    polygon(points, uvs, outward, shade = footShade) {
      a.fromArray(points[0]);
      b.fromArray(points[1]);
      c.fromArray(points[2]);
      n.subVectors(b, a).cross(c.sub(a)).normalize();
      const order = points.map((_, i) => i);
      if (n.dot(new THREE.Vector3(...outward)) < 0) {
        order.reverse();
        n.negate();
      }
      for (let i = 1; i < order.length - 1; i++) {
        for (const k of [order[0], order[i], order[i + 1]]) {
          position.push(...points[k]);
          normal.push(n.x, n.y, n.z);
          uv.push(...uvs[k]);
          const s = typeof shade === 'number' ? shade : shade(points[k][1]);
          color.push(s, s, s);
        }
      }
    },
    /** Appends another surface's triangles, moved by `transform([x, y, z])`. */
    add(other, transform) {
      const data = other.data();
      for (let i = 0; i < data.position.length; i += 3) {
        position.push(...transform(data.position.slice(i, i + 3)));
        normal.push(...transform(data.normal.slice(i, i + 3)));
      }
      uv.push(...data.uv);
      color.push(...data.color);
    },
    data: () => ({ position, normal, uv, color }),
    geometry() {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normal, 3));
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(color, 3));
      return geometry;
    },
  };
}

/** Texture coordinates of a point (s, t) in 0…1 within an atlas region, kept a pixel and a half inside it. */
function atlasUV([x, y, w, h], s, t) {
  const size = HOUSE_ATLAS.size;
  const inset = 1.5;
  return [(x + inset + s * (w - 2 * inset)) / size, 1 - (y + inset + (1 - t) * (h - 2 * inset)) / size];
}

/**
 * A wall seen from outside, running from `from` to `to` ([x, z]) left to
 * right. `outline` is its shape as [s, y] points, s going 0…1 along it; the
 * region covers the full height from the foundation to the eaves, so
 * openings and storey lines line up from wall to wall.
 */
function wall(target, region, from, to, outline = [[0, FOOT], [1, FOOT], [1, 1], [0, 1]], [y0, y1] = [FOOT, 1]) {
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const points = outline.map(([s, y]) => [from[0] + s * dx, y, from[1] + s * dz]);
  const uvs = outline.map(([s, y]) => atlasUV(region, s, (y - y0) / (y1 - y0)));
  target.polygon(points, uvs, [-dz, 0, dx]);
}

/** The triangle of wall under a gable roof, above the eaves line at y = 1. */
function gable(target, region, from, to, rise) {
  wall(target, region, from, to, [[0, 1], [1, 1], [0.5, 1 + rise]], [1, 1 + rise]);
}

/**
 * One slope of a roof as a slab: tiles on top, boarded soffit beneath, and
 * tile ends along the eaves and verges (`eaves: false` where the slope runs
 * on into a gentler one). The slope runs from the ridge line
 * [x, y] down to the eaves line [x, y] across the full z range; the given
 * heights are those of the slab's underside.
 */
function roofSlope(target, [rx, ry], [ex, ey], [z0, z1], { eaves = true } = {}) {
  const tiles = HOUSE_ATLAS.roof;
  const outward = Math.sign(ex - rx);
  const up = (y) => y + ROOF;
  const top = [[ex, up(ey), z0], [ex, up(ey), z1], [rx, up(ry), z1], [rx, up(ry), z0]];
  const bottom = [[ex, ey, z0], [ex, ey, z1], [rx, ry, z1], [rx, ry, z0]];
  const across = outward > 0 ? (z) => (z1 - z) / (z1 - z0) : (z) => (z - z0) / (z1 - z0);
  const normal = [(ry - ey) * outward, Math.abs(rx - ex), 0];
  target.polygon(top, top.map(([x, , z], i) => atlasUV(tiles, across(z), i < 2 ? 0 : 1)), normal, 1);
  target.polygon(bottom, bottom.map(([, , z], i) => atlasUV(HOUSE_ATLAS.soffit, across(z), i < 2 ? 0 : 1)), normal.map((v) => -v), 0.55);
  if (eaves) target.polygon([bottom[0], bottom[1], top[1], top[0]], [[0, 0], [1, 0], [1, 1], [0, 1]].map(([s, t]) => atlasUV(tiles, s, t * 0.04)), [outward, 0, 0], 0.7);
  for (const [z, sign] of [[z0, -1], [z1, 1]]) {
    const end = [[ex, ey, z], [ex, up(ey), z], [rx, up(ry), z], [rx, ry, z]];
    target.polygon(end, end.map(([x, y]) => atlasUV(tiles, Math.abs(x - ex) / Math.abs(rx - ex), (y - ey) * 0.2)), [0, 0, sign], 0.7);
  }
}

/** A box from its x, y and z ranges, with only the listed faces; textured with one region per face, stretched. */
function block(target, region, [x0, x1], [y0, y1], [z0, z1], { faces }) {
  const sides = {
    front: [[x0, z1], [x1, z1]],
    back: [[x1, z0], [x0, z0]],
    left: [[x0, z0], [x0, z1]],
    right: [[x1, z1], [x1, z0]],
  };
  for (const face of faces) {
    if (sides[face]) wall(target, region, ...sides[face], [[0, y0], [1, y0], [1, y1], [0, y1]], [y0, y1]);
  }
  for (const [face, y, sign] of [['top', y1, 1], ['bottom', y0, -1]]) {
    if (!faces.includes(face)) continue;
    const points = [[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]];
    target.polygon(points, points.map(([x, , z]) => atlasUV(region, (x - x0) / (x1 - x0), (z - z0) / (z1 - z0))), [0, sign, 0]);
  }
}

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

/** A round stone well-head: six faces of rubble around dark water. */
function well(target, [cx, cz], radius, height) {
  const sides = 6;
  const corner = (k) => [cx + Math.cos((k / sides) * Math.PI * 2) * radius, cz + Math.sin((k / sides) * Math.PI * 2) * radius];
  for (let k = 0; k < sides; k++) {
    const a = corner(k);
    const b = corner(k + 1);
    // Wound so the wall faces away from the centre.
    wall(target, HOUSE_ATLAS.rubble, b, a, [[0, FOOT], [1, FOOT], [1, height], [0, height]], [FOOT, 1]);
  }
  const rim = Array.from({ length: sides }, (_, k) => corner(k)).map(([x, z]) => [x, height, z]);
  target.polygon(rim, rim.map(() => atlasUV(HOUSE_ATLAS.dark, 0.5, 0.5)), [0, 1, 0], 0.8);
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

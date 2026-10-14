import * as THREE from 'three';
import { HOUSE_ATLAS, HOUSE_FOOT, townHouseAtlas } from '../models/lib/textures.js';

/**
 * Builders for the map's instanced buildings (houses.js, churches.js): flat
 * faces with texture coordinates into the town atlas painted in textures.js.
 * Each building is built once in a unit frame and instanced, so these work
 * in that frame. By default a wall runs from a house's buried foot (y =
 * -HOUSE_FOOT) up to its eaves (y = 1); other buildings pass their own
 * heights.
 */

const FOOT = -HOUSE_FOOT;
const ROOF = 0.05; // default thickness of a roof slab

let materials = null;

/** The two materials every instanced building shares, both painted from the one atlas: walls, and roofs. */
export function townMaterials() {
  if (!materials) {
    const map = townHouseAtlas();
    materials = {
      walls: new THREE.MeshStandardMaterial({ map, vertexColors: true, roughness: 0.92 }),
      roofs: new THREE.MeshStandardMaterial({ map, vertexColors: true, roughness: 0.8 }),
    };
  }
  return materials;
}

/**
 * Accumulates flat-shaded triangles with atlas UVs and a vertex shade: walls
 * darken towards their foot, a cheap stand-in for ambient occlusion.
 */
export function surface() {
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
    /** Appends another surface's triangles, turned by `rotate([x, y, z])` and then moved by `offset`. */
    add(other, rotate, offset = [0, 0, 0]) {
      const data = other.data();
      for (let i = 0; i < data.position.length; i += 3) {
        position.push(...rotate(data.position.slice(i, i + 3)).map((v, k) => v + offset[k]));
        normal.push(...rotate(data.normal.slice(i, i + 3)));
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
export function atlasUV([x, y, w, h], s, t) {
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
export function wall(target, region, from, to, outline = [[0, FOOT], [1, FOOT], [1, 1], [0, 1]], [y0, y1] = [FOOT, 1]) {
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const points = outline.map(([s, y]) => [from[0] + s * dx, y, from[1] + s * dz]);
  const uvs = outline.map(([s, y]) => atlasUV(region, s, (y - y0) / (y1 - y0)));
  target.polygon(points, uvs, [-dz, 0, dx]);
}

/** The triangle of wall under a gable roof, above the eaves line at y = 1. */
export function gable(target, region, from, to, rise) {
  wall(target, region, from, to, [[0, 1], [1, 1], [0.5, 1 + rise]], [1, 1 + rise]);
}

/**
 * One slope of a roof as a slab: tiles on top, boarded soffit beneath, and
 * tile ends along the eaves and verges (`eaves: false` where the slope runs
 * on into a gentler one). The slope runs from the ridge line
 * [x, y] down to the eaves line [x, y] across the full z range; the given
 * heights are those of the slab's underside, and `thickness` its depth,
 * measured vertically.
 */
export function roofSlope(target, [rx, ry], [ex, ey], [z0, z1], { eaves = true, thickness = ROOF } = {}) {
  const tiles = HOUSE_ATLAS.roof;
  const outward = Math.sign(ex - rx);
  const up = (y) => y + thickness;
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
export function block(target, region, [x0, x1], [y0, y1], [z0, z1], { faces }) {
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

/** A round stone well-head: six faces of rubble around dark water. */
export function well(target, [cx, cz], radius, height) {
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

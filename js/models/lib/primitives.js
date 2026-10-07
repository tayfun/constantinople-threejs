import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { materials as M, banner } from './materials.js';
import { crownGeometry, cypressGeometry, judasTreeGeometry } from './trees.js';
import { createRandom } from '../../util/random.js';

/**
 * Architectural building blocks shared by all models.
 *
 * Conventions:
 *  - units are metres; +y is up;
 *  - solids are "base-anchored": their bottom sits at the given y;
 *  - UVs are in metres, so tiling textures keep a real-world scale.
 */

// ---------- geometry ----------

export function scaleUV(geometry, su, sv) {
  const uv = geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  return geometry;
}

export function boxGeometry(w, h, d) {
  const geometry = new THREE.BoxGeometry(w, h, d);
  const faceSizes = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]]; // +x -x +y -y +z -z
  const uv = geometry.attributes.uv;
  for (let face = 0; face < 6; face++) {
    for (let k = 0; k < 4; k++) {
      const i = face * 4 + k;
      uv.setXY(i, uv.getX(i) * faceSizes[face][0], uv.getY(i) * faceSizes[face][1]);
    }
  }
  return geometry.translate(0, h / 2, 0);
}

export function cylinderGeometry(rTop, rBottom, h, segments = 16, { open = false, thetaStart = 0, thetaLength = Math.PI * 2 } = {}) {
  const geometry = new THREE.CylinderGeometry(rTop, rBottom, h, segments, 1, open, thetaStart, thetaLength);
  const r = Math.max(rTop, rBottom);
  const sideVertices = (segments + 1) * 2;
  const uv = geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    if (i < sideVertices) uv.setXY(i, uv.getX(i) * r * thetaLength, uv.getY(i) * h);
    else uv.setXY(i, uv.getX(i) * 2 * r, uv.getY(i) * 2 * r);
  }
  return geometry.translate(0, h / 2, 0);
}

export function coneGeometry(r, h, segments = 16) {
  const geometry = new THREE.ConeGeometry(r, h, segments);
  scaleUV(geometry, Math.PI * 2 * r, Math.hypot(r, h));
  return geometry.translate(0, h / 2, 0);
}

/** Hemisphere (or half of one with phiLength = PI, bulging towards +z). */
export function domeGeometry(radius, { heightScale = 1, segments = 24, phiLength = Math.PI * 2 } = {}) {
  const geometry = new THREE.SphereGeometry(radius, segments, Math.max(4, Math.round(segments / 3)), 0, phiLength, 0, Math.PI / 2);
  scaleUV(geometry, radius * phiLength, (radius * Math.PI) / 2);
  return geometry.scale(1, heightScale, 1);
}

export function pyramidGeometry(w, d, h) {
  const geometry = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4).rotateY(Math.PI / 4).scale(w, h, d);
  scaleUV(geometry, (w + d) * 2, Math.hypot(h, Math.max(w, d) / 2));
  return geometry.translate(0, h / 2, 0);
}

/** Pitched roof with the ridge along x. */
export function gableRoofGeometry(w, d, h, overhang = 0.5) {
  const halfD = d / 2 + overhang;
  const shape = new THREE.Shape([new THREE.Vector2(-halfD, 0), new THREE.Vector2(halfD, 0), new THREE.Vector2(0, h)]);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: w + overhang * 2, bevelEnabled: false });
  return geometry.rotateY(Math.PI / 2).translate(-(w / 2 + overhang), 0, 0);
}

/** Hipped roof: four slopes, the ridge running along the longer side. */
export function hipRoofGeometry(w, d, h, overhang = 0.5) {
  if (w < d) return hipRoofGeometry(d, w, h, overhang).rotateY(Math.PI / 2);
  const W = w / 2 + overhang;
  const D = d / 2 + overhang;
  const r = Math.max(W - D, 0);
  const A = [-W, 0, -D], B = [W, 0, -D], C = [W, 0, D], E = [-W, 0, D];
  const R1 = [-r, h, 0], R2 = [r, h, 0];
  const triangles = [
    [E, C, R2], [E, R2, R1], // front
    [B, A, R1], [B, R1, R2], // back
    [A, E, R1], // left
    [C, B, R2], // right
    [A, B, C], [A, C, E], // underside
  ];
  const positions = [];
  const uvs = [];
  for (const [i, tri] of triangles.entries()) {
    const alongZ = i === 4 || i === 5;
    for (const [x, y, z] of tri) {
      positions.push(x, y, z);
      uvs.push(alongZ ? z : x, y * 1.6);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  return geometry;
}

/** Rectangle topped by a semicircle, standing on y = 0. */
export function archShape(w, h, x = 0, y = 0) {
  const r = w / 2;
  const shape = new THREE.Shape();
  shape.moveTo(x - r, y);
  shape.lineTo(x + r, y);
  shape.lineTo(x + r, y + h - r);
  shape.absarc(x, y + h - r, r, 0, Math.PI, false);
  shape.lineTo(x - r, y);
  return shape;
}

/** Flat arched opening (window/door), facing +z. */
export function archGeometry(w, h) {
  return new THREE.ShapeGeometry(archShape(w, h), 6);
}

/**
 * A wall along x pierced by arches. Each opening is { x, width, bottom, spring }:
 * the arch springs at `spring` (top of the straight jambs). Openings with
 * bottom <= 0 are cut from the foot of the wall (an arcade); the rest are holes.
 */
export function archedWallGeometry({ length, height, thickness, openings = [], curveSegments = 10 }) {
  const half = length / 2;
  const sorted = [...openings].sort((a, b) => a.x - b.x);
  const shape = new THREE.Shape();
  shape.moveTo(-half, 0);
  for (const { x, width, bottom, spring } of sorted) {
    if (bottom > 0) continue;
    const r = width / 2;
    shape.lineTo(x - r, 0);
    shape.lineTo(x - r, spring);
    shape.absarc(x, spring, r, Math.PI, 0, true);
    shape.lineTo(x + r, 0);
  }
  shape.lineTo(half, 0);
  shape.lineTo(half, height);
  shape.lineTo(-half, height);
  shape.lineTo(-half, 0);
  for (const { x, width, bottom, spring } of sorted) {
    if (bottom <= 0) continue;
    shape.holes.push(archShape(width, spring - bottom + width / 2, x, bottom));
  }
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments });
  return geometry.translate(0, 0, -thickness / 2);
}

/** Evenly spaced openings helper for archedWallGeometry. */
export function regularOpenings(length, count, { width, bottom = 0, spring, margin = 0 }) {
  const span = length - margin * 2;
  const step = span / count;
  return Array.from({ length: count }, (_, i) => ({ x: -length / 2 + margin + step * (i + 0.5), width, bottom, spring }));
}

/** A slab of land from an outline of [x, z] points, top at y = height. */
export function landGeometry(pointsXZ, height, depth = height + 2) {
  const shape = new THREE.Shape(pointsXZ.map(([x, z]) => new THREE.Vector2(x, -z)));
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  return geometry.rotateX(-Math.PI / 2).translate(0, height - depth, 0);
}

/** Merlons along x: a crenellated parapet top, base at y = 0. */
export function crenellationGeometry(length, { merlon = 0.9, gap = 0.7, height = 1.1, thickness = 0.7 } = {}) {
  const count = Math.max(1, Math.floor((length + gap) / (merlon + gap)));
  const used = count * merlon + (count - 1) * gap;
  const parts = [];
  for (let i = 0; i < count; i++) {
    parts.push(boxGeometry(merlon, height, thickness).translate(-used / 2 + merlon / 2 + i * (merlon + gap), 0, 0));
  }
  return mergeGeometries(parts);
}

/** Merlons around a circle (round or polygonal towers). */
export function crenelRingGeometry(radius, { count = 16, merlon = 0.9, height = 1.1, thickness = 0.7 } = {}) {
  const parts = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const part = boxGeometry(merlon, height, thickness);
    part.rotateY(Math.PI / 2 - angle);
    part.translate(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
    parts.push(part);
  }
  return mergeGeometries(parts);
}

/** A subdivided triangular sail between three points, bellied along +z. */
export function triangleSailGeometry(a, b, c, belly = 0.6, divisions = 8) {
  const positions = [];
  const uvs = [];
  const indexOf = [];
  let index = 0;
  for (let i = 0; i <= divisions; i++) {
    indexOf[i] = [];
    for (let j = 0; j <= divisions - i; j++) {
      const u = i / divisions;
      const v = j / divisions;
      const w = 1 - u - v;
      const bulge = belly * 27 * u * v * w;
      positions.push(a.x * w + b.x * u + c.x * v, a.y * w + b.y * u + c.y * v, a.z * w + b.z * u + c.z * v + bulge);
      uvs.push(u * 4, v * 4);
      indexOf[i][j] = index++;
    }
  }
  const indices = [];
  for (let i = 0; i < divisions; i++) {
    for (let j = 0; j < divisions - i; j++) {
      indices.push(indexOf[i][j], indexOf[i + 1][j], indexOf[i][j + 1]);
      if (j < divisions - i - 1) indices.push(indexOf[i + 1][j], indexOf[i + 1][j + 1], indexOf[i][j + 1]);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** A rectangular sail in the x/y plane (bottom edge at y = 0), bellied along +z. */
export function squareSailGeometry(w, h, belly = 0.8) {
  const geometry = new THREE.PlaneGeometry(w, h, 8, 8).translate(0, h / 2, 0);
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const u = position.getX(i) / w + 0.5;
    const v = position.getY(i) / h;
    position.setZ(i, belly * Math.sin(Math.PI * u) * Math.sin(Math.PI * Math.min(1, v * 1.1)));
  }
  scaleUV(geometry, w, h);
  geometry.computeVertexNormals();
  return geometry;
}

// ---------- meshes ----------

export function mesh(geometry, material, x = 0, y = 0, z = 0) {
  const result = new THREE.Mesh(geometry, material);
  result.position.set(x, y, z);
  result.castShadow = true;
  result.receiveShadow = true;
  return result;
}

export const box = (w, h, d, material, x, y, z) => mesh(boxGeometry(w, h, d), material, x, y, z);

export const cylinder = (rTop, rBottom, h, material, x, y, z, segments = 16, options) =>
  mesh(cylinderGeometry(rTop, rBottom, h, segments, options), material, x, y, z);

export const cone = (r, h, material, x, y, z, segments = 16) => mesh(coneGeometry(r, h, segments), material, x, y, z);

export const dome = (radius, material, x, y, z, options) => mesh(domeGeometry(radius, options), material, x, y, z);

export const pyramid = (w, d, h, material, x, y, z) => mesh(pyramidGeometry(w, d, h), material, x, y, z);

export const gableRoof = (w, d, h, material, x, y, z, overhang) => mesh(gableRoofGeometry(w, d, h, overhang), material, x, y, z);

export const hipRoof = (w, d, h, material, x, y, z, overhang) => mesh(hipRoofGeometry(w, d, h, overhang), material, x, y, z);

/** Flat horizontal ground plane of w × d metres, top face at y. */
export function groundPlane(w, d, material, x = 0, y = 0, z = 0) {
  const geometry = scaleUV(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), w, d);
  return mesh(geometry, material, x, y, z);
}

/** A round patch of sea, surface at y = 0, with a visible depth below it. */
export function waterDisc(radius, depth = 3) {
  const group = new THREE.Group();
  group.add(mesh(new THREE.CircleGeometry(radius, 64).rotateX(-Math.PI / 2), M.water));
  group.add(mesh(new THREE.CylinderGeometry(radius, radius, depth, 64, 1, true).translate(0, -depth / 2, 0), M.waterSide));
  return group;
}

/** Turns an object (whose local +z is its "front") to face the direction (dx, dz). */
export function faceToward(object, dx, dz) {
  object.rotation.y = Math.atan2(dx, dz);
  return object;
}

/** Places an object on a circle, its local +z facing outward. */
export function placeOnCircle(object, angle, radius, y = 0, cx = 0, cz = 0) {
  object.position.set(cx + Math.cos(angle) * radius, y, cz + Math.sin(angle) * radius);
  object.rotation.y = Math.PI / 2 - angle;
  return object;
}

/** Row of arched windows along x on a wall face, facing +z (rotate the group for other faces). */
export function windowRow({ count, spacing, width, height, y = 0, skip = () => false, material = M.opening }) {
  const group = new THREE.Group();
  const geometry = archGeometry(width, height);
  for (let i = 0; i < count; i++) {
    const x = (i - (count - 1) / 2) * spacing;
    if (skip(x)) continue;
    group.add(mesh(geometry, material, x, y, 0));
  }
  return group;
}

/** Row of classical columns along x: base, shaft and capital. */
export function colonnade({ length, count, height, radius = 0.4, material = M.marble, capitalMaterial = material }) {
  const group = new THREE.Group();
  const shaft = cylinderGeometry(radius * 0.85, radius, height - radius * 1.6, 10);
  const base = boxGeometry(radius * 2.4, radius * 0.6, radius * 2.4);
  const capital = cylinderGeometry(radius * 1.6, radius * 0.9, radius, 10);
  const step = count > 1 ? length / (count - 1) : 0;
  for (let i = 0; i < count; i++) {
    const x = -length / 2 + step * i;
    group.add(mesh(base, material, x, 0, 0));
    group.add(mesh(shaft, material, x, radius * 0.6, 0));
    group.add(mesh(capital, capitalMaterial, x, height - radius, 0));
  }
  return group;
}

/** Steps rising along +z: `count` steps of the given rise/run, `width` wide. */
export function stairs(width, count, rise, run, material = M.stone) {
  const group = new THREE.Group();
  for (let i = 0; i < count; i++) group.add(box(width, rise * (i + 1), run, material, 0, 0, i * run + run / 2));
  return group;
}

// ---------- planting ----------

const cypressCrowns = [1, 2, 3].map((seed) => cypressGeometry({ segments: 10, seed }));
const leafyCrowns = [1, 2, 3].map((seed) => crownGeometry({ blobs: 5, detail: 1, seed }));
const trunkGeometry = cylinderGeometry(0.15, 0.2, 1, 6);
// Varied by where the tree stands, so the same model always plants the same trees.
const variant = (crowns, x, z) => crowns[Math.abs(Math.round(x * 7 + z * 13)) % crowns.length];

export function cypress(height = 12, x = 0, y = 0, z = 0) {
  const group = new THREE.Group();
  const trunk = mesh(trunkGeometry, M.trunk);
  trunk.scale.set(height / 12, height * 0.12, height / 12);
  const crown = mesh(variant(cypressCrowns, x, z), M.foliage, 0, height * 0.1, 0);
  crown.scale.set(height * 0.13, height * 0.9, height * 0.13);
  group.add(trunk, crown);
  group.position.set(x, y, z);
  return group;
}

export function roundTree(height = 8, x = 0, y = 0, z = 0) {
  const group = new THREE.Group();
  const trunk = mesh(trunkGeometry, M.trunk);
  trunk.scale.set(height / 8, height * 0.5, height / 8);
  const crown = mesh(variant(leafyCrowns, x, z), M.foliageLight, 0, height * 0.62, 0);
  crown.rotation.y = x * 3.1 + z * 1.7;
  crown.scale.set(height * 0.36, height * 0.32, height * 0.36);
  group.add(trunk, crown);
  group.position.set(x, y, z);
  return group;
}

// A few Judas trees grown once and shared, as their bark, blossom and leaf geometries; lighter ones for the map.
const erguvans = {
  fine: [1, 2, 3].map((seed) => judasTreeGeometry({ seed })),
  coarse: [1, 2].map((seed) => judasTreeGeometry({ seed, coarse: true })),
};

/**
 * The Judas tree, erguvan, as it stands in late April: a vase of slender
 * stems strung with magenta flowers, the round, heart-based leaves
 * unfolding on its twigs, and in the dioramas fallen petals scattered
 * under it. See judasTreeGeometry() for how it is grown; `detail: false`
 * draws the lighter tree grown for the map.
 */
export function judasTree(height = 7, x = 0, y = 0, z = 0, { detail = true, seed = 1 } = {}) {
  const rnd = createRandom(seed);
  const variants = detail ? erguvans.fine : erguvans.coarse;
  const { wood, flowers, leaves } = variants[Math.abs(seed - 1) % variants.length];
  const group = new THREE.Group();
  for (const [geometry, material] of [[wood, M.erguvanBark], [flowers, M.blossom], [leaves, M.erguvanLeaves]]) {
    group.add(mesh(geometry, material));
  }
  group.scale.setScalar(height);
  group.rotation.y = rnd.range(0, Math.PI * 2);

  if (detail) {
    // Fallen petals: pink specks scattered under the crown.
    const drifts = [];
    for (let i = 0; i < 40; i++) {
      const angle = rnd.range(0, Math.PI * 2);
      const out = 0.45 * Math.sqrt(rnd.next());
      drifts.push(new THREE.CircleGeometry(rnd.range(0.008, 0.02), 5).rotateX(-Math.PI / 2).translate(Math.cos(angle) * out, 0, Math.sin(angle) * out));
    }
    group.add(mesh(mergeGeometries(drifts), M.petals, 0, 0.06 / height, 0));
  }
  const holder = new THREE.Group();
  holder.add(group);
  holder.position.set(x, y, z);
  return holder;
}

// ---------- obelisks ----------

/**
 * A four-sided tapering shaft with a pyramidal tip, for obelisks whose faces
 * carry their own textures. Each face is cut into horizontal strips so its
 * texture is not skewed by the taper. Material groups: 0 +x, 1 +z, 2 -x,
 * 3 -z, 4 the tip. Every face's texture runs left to right as seen from
 * outside, bottom to top. The shaft stands on the origin.
 */
export function obeliskGeometry({ base, top, height, tip, strips = 24 }) {
  const faces = [
    { normal: [1, 0, 0], right: [0, 0, -1] },
    { normal: [0, 0, 1], right: [1, 0, 0] },
    { normal: [-1, 0, 0], right: [0, 0, 1] },
    { normal: [0, 0, -1], right: [-1, 0, 0] },
  ];
  const positions = [];
  const uvs = [];
  const geometry = new THREE.BufferGeometry();
  const corner = ({ normal, right }, halfWidth, side, y) => [
    normal[0] * halfWidth + right[0] * halfWidth * side,
    y,
    normal[2] * halfWidth + right[2] * halfWidth * side,
  ];
  const halfWidthAt = (v) => (base + (top - base) * v) / 2;

  faces.forEach((face, index) => {
    const start = positions.length / 3;
    for (let j = 0; j < strips; j++) {
      const v0 = j / strips;
      const v1 = (j + 1) / strips;
      const bl = corner(face, halfWidthAt(v0), -1, height * v0);
      const br = corner(face, halfWidthAt(v0), 1, height * v0);
      const tr = corner(face, halfWidthAt(v1), 1, height * v1);
      const tl = corner(face, halfWidthAt(v1), -1, height * v1);
      positions.push(...bl, ...br, ...tr, ...bl, ...tr, ...tl);
      uvs.push(0, v0, 1, v0, 1, v1, 0, v0, 1, v1, 0, v1);
    }
    geometry.addGroup(start, strips * 6, index);
  });

  const start = positions.length / 3;
  for (const face of faces) {
    positions.push(...corner(face, top / 2, -1, height), ...corner(face, top / 2, 1, height), 0, height + tip, 0);
    uvs.push(0, 0, 1, 0, 0.5, 1);
  }
  geometry.addGroup(start, faces.length * 3, faces.length);

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  return geometry;
}

// ---------- flags ----------

/** A waving banner on a pole; the pole foot sits at the origin. */
export function flag(kind, { width = 3, height = 2, pole = 6 } = {}) {
  const group = new THREE.Group();
  group.add(cylinder(0.08, 0.1, pole, M.wood, 0, 0, 0, 6));

  const geometry = new THREE.PlaneGeometry(width, height, 10, 4).translate(width / 2, 0, 0);
  const cloth = new THREE.Mesh(geometry, banner(kind));
  cloth.position.y = pole - height / 2 - 0.1;
  cloth.castShadow = true;
  group.add(cloth);

  const base = geometry.attributes.position.array.slice();
  const position = geometry.attributes.position;
  const phase = Math.random() * 10;
  group.userData.animate = (time) => {
    for (let i = 0; i < position.count; i++) {
      const x = base[i * 3];
      position.setZ(i, Math.sin(x * 1.6 - time * 4 + phase) * 0.12 * x);
    }
    position.needsUpdate = true;
  };
  return group;
}

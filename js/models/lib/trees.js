import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createRandom } from '../../util/random.js';

/**
 * Tree crowns built once and shared by every tree, so they cost geometry
 * rather than draw calls. All carry vertex colours that darken the
 * underside and the inner parts of the foliage (a baked stand-in for
 * ambient occlusion), to be multiplied by a material or instance colour.
 */

const smoothstep = THREE.MathUtils.smoothstep;

/** Deterministic lumpiness for a direction, so coincident vertices of a blob move together. */
function lump(x, y, z, seed) {
  return Math.sin(x * 5.1 + seed) * Math.sin(y * 4.3 + seed * 1.7) * Math.sin(z * 4.7 + seed * 2.3);
}

/**
 * A broadleaf crown: a cluster of lumpy blobs filling roughly the unit
 * sphere. Normals lean towards the crown's centre so that the light wraps
 * the whole canopy softly instead of catching every blob on its own.
 *
 * blobs   number of blobs (the first is the large central one)
 * detail  icosahedron detail of each blob: 0 is 20 triangles, 1 is 80
 */
export function crownGeometry({ blobs = 4, detail = 1, seed = 1 } = {}) {
  const rnd = createRandom(seed);
  const spheres = [];
  for (let b = 0; b < blobs; b++) {
    const angle = (b / (blobs - 1)) * Math.PI * 2 + rnd.range(-0.4, 0.4);
    const out = b === 0 ? 0 : rnd.range(0.38, 0.48);
    const centre = new THREE.Vector3(Math.cos(angle) * out, b === 0 ? 0.08 : rnd.range(-0.22, 0.12), Math.sin(angle) * out);
    spheres.push({ centre, radius: b === 0 ? 0.72 : rnd.range(0.46, 0.56) });
  }
  const amplitude = detail > 0 ? 0.12 : 0;
  const parts = spheres.map(({ centre, radius }, b) => {
    const blob = new THREE.IcosahedronGeometry(1, detail);
    blob.rotateY(rnd.range(0, Math.PI));
    const position = blob.attributes.position;
    const normal = blob.attributes.normal;
    const colors = [];
    const p = new THREE.Vector3();
    const n = new THREE.Vector3();
    const outward = new THREE.Vector3();
    for (let i = 0; i < position.count; i++) {
      p.fromBufferAttribute(position, i);
      p.multiplyScalar(radius * (1 + amplitude * lump(p.x, p.y, p.z, seed + b))).add(centre);
      position.setXYZ(i, p.x, p.y, p.z);
      n.fromBufferAttribute(position, i).sub(centre).normalize();
      outward.copy(p).setY(p.y + 0.15).normalize();
      n.lerp(outward, 0.65).normalize();
      normal.setXYZ(i, n.x, n.y, n.z);
      // Darker below and towards the middle of the crown.
      const height = smoothstep(p.y, -0.8, 0.75);
      const depth = smoothstep(p.length(), 0.35, 0.95);
      const shade = (0.5 + 0.5 * height) * (0.72 + 0.28 * depth);
      colors.push(shade * 0.97, shade, shade * 0.9 + 0.06 * height);
    }
    blob.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    // Triangles buried inside a neighbouring blob are never seen.
    const buried = (i) => spheres.some((other, o) => o !== b
      && p.fromBufferAttribute(position, i).distanceTo(other.centre) < other.radius * (1 - amplitude) * Math.cos(Math.PI / 5));
    return withoutTriangles(blob, (t) => buried(t) && buried(t + 1) && buried(t + 2));
  });
  const geometry = mergeGeometries(parts);
  // Fit the unit sphere, standing on its centre like the icosahedron it replaces.
  geometry.computeBoundingBox();
  const { min, max } = geometry.boundingBox;
  const span = Math.max(max.x - min.x, max.y - min.y, max.z - min.z) / 2;
  geometry.translate(-(min.x + max.x) / 2, -(min.y + max.y) / 2, -(min.z + max.z) / 2).scale(1 / span, 1 / span, 1 / span);
  return geometry;
}

/**
 * Outline of a Judas-tree leaf as [across, along]: nearly round, with a
 * heart-shaped notch where the stalk joins at the origin and a blunt tip
 * at along = 1. A heart curve, rounded off towards a circle.
 */
function leafOutline(points) {
  const outline = [];
  for (let i = 0; i < points; i++) {
    const t = (i / points) * Math.PI * 2;
    const x = 16 * Math.sin(t) ** 3;
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    const [u, v] = [x / 22, (5 - y) / 22];
    const [cu, cv] = [Math.sin(t) * 0.62, 0.42 - Math.cos(t) * 0.58]; // the circle it is rounded towards
    outline.push([THREE.MathUtils.lerp(u, cu, 0.35), THREE.MathUtils.lerp(v, cv, 0.35)]);
  }
  return outline;
}

/**
 * A Judas tree, erguvan, one unit tall, as three geometries to be drawn in
 * bark, blossom and leaf: a vase of slender stems rising from the ground and
 * forking into ever finer twigs; clusters of magenta flowers strung all
 * along the wood, the old stems included; and round, heart-based leaves
 * unfolding on the outer twigs, the youngest still bronze. Flowers and
 * leaves are drawn larger than life so they can be told apart at the
 * dioramas' scale. Leaves are seen from both sides, so they want a
 * double-sided material.
 *
 * coarse  for the map: two orders of branches instead of four, with fewer,
 *         larger flowers and leaves (some 3,000 triangles instead of 26,000)
 */
export function judasTreeGeometry({ seed = 1, coarse = false } = {}) {
  const rnd = createRandom(seed);
  const up = new THREE.Vector3(0, 1, 0);
  const wood = { position: [], normal: [] };
  const flowers = { position: [], normal: [], color: [] };
  const leaves = { position: [], normal: [], color: [] };

  /** Two unit vectors at right angles to `direction`. */
  const frame = (direction) => {
    const side = Math.abs(direction.y) < 0.95 ? new THREE.Vector3().crossVectors(direction, up).normalize() : new THREE.Vector3(1, 0, 0);
    return [side, new THREE.Vector3().crossVectors(side, direction).normalize()];
  };
  const randomAcross = (direction) => {
    const [a, b] = frame(direction);
    const angle = rnd.range(0, Math.PI * 2);
    return a.multiplyScalar(Math.cos(angle)).addScaledVector(b, Math.sin(angle));
  };

  /** A tapered length of wood from `a` (radius ra) to `b` (radius rb), five-sided, or three for a twig. */
  const limb = (a, b, ra, rb, sides) => {
    const direction = b.clone().sub(a).normalize();
    const [side, other] = frame(direction);
    const ring = (centre, radius, k) => {
      const angle = (k / sides) * Math.PI * 2;
      const n = side.clone().multiplyScalar(Math.cos(angle)).addScaledVector(other, Math.sin(angle));
      return [centre.clone().addScaledVector(n, radius), n];
    };
    for (let k = 0; k < sides; k++) {
      const [p0, n0] = ring(a, ra, k);
      const [p1, n1] = ring(a, ra, k + 1);
      const [p2, n2] = ring(b, rb, k + 1);
      const [p3, n3] = ring(b, rb, k);
      for (const [p, n] of [[p0, n0], [p2, n2], [p1, n1], [p0, n0], [p3, n3], [p2, n2]]) {
        wood.position.push(p.x, p.y, p.z);
        wood.normal.push(n.x, n.y, n.z);
      }
    }
  };

  // A cluster of pea flowers: a small tetrahedron in one of a few magentas, its normals
  // turned up towards the sky so the clusters read as soft dabs of colour, not facets.
  const tetrahedron = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]].map((v) => new THREE.Vector3(...v).normalize());
  const tetraFaces = [[0, 1, 2], [0, 3, 1], [0, 2, 3], [1, 3, 2]];
  const flower = (at, size, shade) => {
    const stretch = new THREE.Vector3(rnd.range(0.8, 1.3), rnd.range(0.8, 1.2), rnd.range(0.8, 1.3));
    const turn = new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd.range(0, 3), rnd.range(0, 3), rnd.range(0, 3)));
    const tone = rnd.range(0.82, 1.08) * shade;
    const pinker = rnd.range(0, 0.12);
    for (const face of tetraFaces) {
      for (const index of face) {
        const corner = tetrahedron[index].clone().multiply(stretch).applyQuaternion(turn);
        const p = corner.clone().multiplyScalar(size).add(at);
        flowers.position.push(p.x, p.y, p.z);
        const n = corner.normalize().addScaledVector(up, 0.9).normalize();
        flowers.normal.push(n.x, n.y, n.z);
        flowers.color.push(tone, tone * (1 + pinker), tone * (1 - pinker * 0.5));
      }
    }
  };

  // A leaf: the outline as a fan, folded a little along its midrib, mostly facing the sky.
  const outline = leafOutline(12);
  const leaf = (stalk, outward, size, shade) => {
    const facing = up.clone().multiplyScalar(rnd.range(0.6, 1)).addScaledVector(outward, rnd.range(0.2, 0.7)).add(randomAcross(up).multiplyScalar(0.3)).normalize();
    const along = outward.clone().addScaledVector(facing, -outward.dot(facing));
    if (along.lengthSq() < 1e-4) along.copy(frame(facing)[0]);
    along.normalize().applyAxisAngle(facing, rnd.range(-0.8, 0.8));
    const across = new THREE.Vector3().crossVectors(along, facing);
    // Young leaves are bronze, grown ones a soft bluish green.
    const young = rnd.chance(0.25);
    const tone = rnd.range(0.85, 1.1) * shade;
    const color = young ? [tone * 1.25, tone * 0.82, tone * 0.5] : [tone * 0.92, tone, tone * (0.9 + rnd.range(0, 0.15))];
    const vertex = ([u, v]) => {
      const p = stalk.clone().addScaledVector(across, u * size).addScaledVector(along, v * size).addScaledVector(facing, 0.18 * Math.abs(u) * size);
      leaves.position.push(p.x, p.y, p.z);
      leaves.normal.push(facing.x, facing.y, facing.z);
      leaves.color.push(...color);
    };
    for (let i = 0; i < outline.length; i++) {
      vertex([0, 0.45]);
      vertex(outline[i]);
      vertex(outline[(i + 1) % outline.length]);
    }
  };

  /** Shade for foliage and flowers: darker low down and deep inside the crown. */
  const shadeAt = (p) => (0.62 + 0.38 * smoothstep(p.y, 0.2, 0.9)) * (0.8 + 0.2 * smoothstep(Math.hypot(p.x, p.z), 0, 0.35));

  const MAX_DEPTH = coarse ? 2 : 4;
  const SPACING = coarse ? [0.08, 0.032, 0.024] : [0.05, 0.022, 0.015, 0.014, 0.016]; // between flower clusters along the wood, by order of branch
  const FLOWER = coarse ? [0.04, 0.038, 0.035] : [0.017, 0.016, 0.015, 0.014, 0.013]; // cluster size, by order of branch
  const LEAF = coarse ? 0.065 : 0.045;
  const REACH = coarse ? [0.72, 0.88] : [0.58, 0.72]; // a branch's length relative to its parent's
  /** A branch from `start`, bending a little along its length, then forking. */
  const grow = (start, direction, length, radius, depth) => {
    const segments = depth === 0 ? 3 : 2;
    const sides = depth < 2 ? 5 : 3;
    let point = start.clone();
    let heading = direction.clone();
    for (let s = 0; s < segments; s++) {
      const next = point.clone().addScaledVector(heading, length / segments);
      const r0 = radius * (1 - (s / segments) * 0.4);
      const r1 = radius * (1 - ((s + 1) / segments) * 0.4);
      limb(point, next, r0, r1, sides);
      // Flowers burst all along the wood, thickest on the twigs.
      const count = Math.round(length / segments / SPACING[depth]);
      for (let f = 0; f < count; f++) {
        const at = point.clone().lerp(next, rnd.next()).addScaledVector(randomAcross(heading), r0 + FLOWER[depth] * 0.5);
        flower(at, FLOWER[depth] * rnd.range(0.8, 1.25), shadeAt(at));
      }
      point = next;
      heading = heading.add(randomAcross(heading).multiplyScalar(0.18)).add(up.clone().multiplyScalar(0.04)).normalize();
    }
    const outward = new THREE.Vector3(point.x, 0, point.z).normalize();
    if (depth >= MAX_DEPTH - 1) {
      // Leaves along the last two orders of twigs.
      for (let k = 0; k < (depth === MAX_DEPTH ? rnd.int(1, 2) : rnd.int(0, 1)); k++) {
        const at = start.clone().lerp(point, rnd.range(0.35, 1));
        leaf(at, outward.lengthSq() ? outward : randomAcross(up), LEAF * rnd.range(0.8, 1.2), shadeAt(at));
      }
    }
    if (depth === MAX_DEPTH) return;
    const children = depth === 0 ? 3 : rnd.int(2, 3);
    for (let c = 0; c < children; c++) {
      const child = heading.clone().addScaledVector(randomAcross(heading), rnd.range(0.45, 0.8))
        .addScaledVector(outward, 0.25).addScaledVector(up, 0.15).normalize();
      grow(point, child, length * rnd.range(...REACH), radius * 0.6, depth + 1);
    }
  };

  // A vase of stems from the ground, leaning out at different angles.
  const stems = rnd.int(5, 7);
  const turn = rnd.range(0, Math.PI * 2);
  for (let i = 0; i < stems; i++) {
    const azimuth = turn + (i / stems) * Math.PI * 2 + rnd.range(-0.35, 0.35);
    const tilt = rnd.range(0.1, 0.42);
    const direction = new THREE.Vector3(Math.sin(tilt) * Math.cos(azimuth), Math.cos(tilt), Math.sin(tilt) * Math.sin(azimuth));
    const foot = new THREE.Vector3(Math.cos(azimuth), 0, Math.sin(azimuth)).multiplyScalar(rnd.range(0, 0.02));
    grow(foot, direction, rnd.range(0.42, 0.55), rnd.range(0.011, 0.015), 0);
  }

  const build = (arrays) => {
    const geometry = new THREE.BufferGeometry();
    for (const [name, values] of Object.entries(arrays)) geometry.setAttribute(name, new THREE.Float32BufferAttribute(values, 3));
    return geometry;
  };
  const parts = { wood: build(wood), flowers: build(flowers), leaves: build(leaves) };
  // One unit tall, standing on the origin.
  let top = 0;
  for (const geometry of Object.values(parts)) {
    geometry.computeBoundingBox();
    top = Math.max(top, geometry.boundingBox.max.y);
  }
  for (const geometry of Object.values(parts)) geometry.scale(1 / top, 1 / top, 1 / top);
  return parts;
}

/** A copy of a non-indexed geometry without the triangles whose first vertex index passes the test. */
function withoutTriangles(geometry, test) {
  const keep = [];
  for (let t = 0; t < geometry.attributes.position.count; t += 3) if (!test(t)) keep.push(t);
  const result = new THREE.BufferGeometry();
  for (const [name, { array, itemSize }] of Object.entries(geometry.attributes)) {
    const values = new Float32Array(keep.length * 3 * itemSize);
    keep.forEach((t, k) => values.set(array.subarray(t * itemSize, (t + 3) * itemSize), k * 3 * itemSize));
    result.setAttribute(name, new THREE.BufferAttribute(values, itemSize));
  }
  return result;
}

/**
 * A Mediterranean cypress: a slender flame, widest a third of the way up and
 * drawn to a point, its rings slightly twisted so the facets do not line up.
 * Radius 1 at its widest, height 1, standing on the origin. The coarse
 * profile, for trees seen from afar, has half the rings.
 */
export function cypressGeometry({ segments = 7, coarse = false, seed = 1 } = {}) {
  const rnd = createRandom(seed);
  const profile = coarse
    ? [[0, 0], [0.85, 0.06], [1, 0.3], [0.62, 0.64], [0, 1]]
    : [[0, 0], [0.62, 0.02], [0.92, 0.12], [1, 0.3], [0.9, 0.5], [0.68, 0.68], [0.42, 0.84], [0.16, 0.96], [0, 1]];
  const rings = profile.map(([r, y], i) => ({ r: r * (i > 1 && i < profile.length - 1 ? rnd.range(0.92, 1.06) : 1), y, twist: rnd.range(0, 0.5) }));
  const positions = [];
  const colors = [];
  const ring = (k, s) => {
    const { r, y, twist } = rings[k];
    const angle = ((s + twist) / segments) * Math.PI * 2;
    return [Math.cos(angle) * r, y, Math.sin(angle) * r];
  };
  const shadeAt = (y) => 0.55 + 0.45 * smoothstep(y, 0, 0.85);
  for (let k = 0; k < rings.length - 1; k++) {
    for (let s = 0; s < segments; s++) {
      const a = ring(k, s);
      const b = ring(k, s + 1);
      const c = ring(k + 1, s + 1);
      const d = ring(k + 1, s);
      const quad = rings[k].r === 0 ? [a, d, c] : rings[k + 1].r === 0 ? [a, c, b] : [a, c, b, a, d, c];
      for (const vertex of quad) {
        positions.push(...vertex);
        const shade = shadeAt(vertex[1]);
        colors.push(shade, shade, shade * 0.95);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals(); // flat facets, which suit the tight, scaly foliage
  return geometry;
}

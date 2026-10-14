import * as THREE from 'three';
import { materials as M, tinted } from './materials.js';
import { archGeometry, cylinderGeometry, domeGeometry, mesh, placeOnCircle, scaleUV, windowRow } from './primitives.js';
import { createRandom } from '../../util/random.js';

/**
 * Parts shared by the city's great churches (St Irene, the Holy Apostles,
 * Sts Sergius and Bacchus, the Pantokrator, the Chora): their brick and
 * lead, windowed drums under ribbed lead domes, polygonal apses under
 * half-domes, the lead barrel vaults that make the rounded gables of a
 * Middle Byzantine roofline, rows of windows and blind arcades.
 *
 * Conventions as in primitives.js: metres, +y up, solids standing on the y
 * they are given. A church faces east along +x, so its apses bulge towards
 * +x. Windows and arcades are flat shapes held a few centimetres off their
 * wall, so they never share its plane.
 */

// ---------- surfaces ----------

function paint(seed, size, tile, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  draw(canvas.getContext('2d'), size, createRandom(seed));
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1 / tile, 1 / tile);
  return texture;
}

const rgb = ([r, g, b], alpha = 1) => `rgba(${r | 0}, ${g | 0}, ${b | 0}, ${alpha})`;
const vary = (rnd, color, amount) => rgb(color.map((c) => Math.min(255, c * (1 + (rnd.next() - 0.5) * amount))));

/** Courses of `color` blocks between two rows of a square canvas, in running bond, drawn again across the seam. */
function courses(ctx, size, rnd, { top, bottom, course, length: [min, max], mortar, color, amount }) {
  for (let y = top; y < bottom - 0.5; y += course) {
    let x = -rnd.next() * max;
    while (x < size) {
      const length = min + rnd.next() * (max - min);
      ctx.fillStyle = vary(rnd, color, amount);
      const h = Math.min(course, bottom - y) - mortar;
      ctx.fillRect(x + mortar / 2, y + mortar / 2, length - mortar, h);
      if (x + length > size) ctx.fillRect(x + mortar / 2 - size, y + mortar / 2, length - mortar, h);
      x += length;
    }
  }
}

/**
 * Justinian's walling: thin bricks in beds of rosy mortar as thick as
 * themselves, with a band of limestone every few metres (a 4 m tile: about
 * three and a half metres of brick, then three courses of stone).
 */
const brickMap = paint(531, 512, 4, (ctx, size, rnd) => {
  ctx.fillStyle = rgb([204, 170, 150]);
  ctx.fillRect(0, 0, size, size);
  const stone = size * 0.14;
  courses(ctx, size, rnd, { top: 0, bottom: size - stone, course: 12.8, length: [36, 50], mortar: 5, color: [168, 88, 64], amount: 0.28 });
  courses(ctx, size, rnd, { top: size - stone, bottom: size, course: stone / 3, length: [40, 90], mortar: 3, color: [192, 178, 156], amount: 0.12 });
  for (let i = 0; i < 4000; i++) {
    ctx.fillStyle = rgb([110, 80, 62], 0.12);
    ctx.fillRect(rnd.next() * size, rnd.next() * size, 1.6, 1.6);
  }
});

/**
 * The Middle and Late Byzantine wall, as on the Chora: courses of dressed
 * stone with a band of three or four bricks every metre or so (a 2 m tile:
 * two such bands). The mortar beds between the bricks are thick.
 */
const bandedMap = paint(1120, 512, 2, (ctx, size, rnd) => {
  ctx.fillStyle = rgb([206, 180, 156]);
  ctx.fillRect(0, 0, size, size);
  for (const top of [0, size / 2]) {
    const stone = size * 0.34;
    courses(ctx, size, rnd, { top, bottom: top + stone, course: stone / 3, length: [50, 110], mortar: 4, color: [208, 196, 172], amount: 0.12 });
    courses(ctx, size, rnd, { top: top + stone, bottom: top + size / 2, course: (size / 2 - stone) / 3, length: [40, 56], mortar: 6, color: [178, 108, 82], amount: 0.24 });
  }
  for (let i = 0; i < 4000; i++) {
    ctx.fillStyle = rgb([110, 90, 70], 0.12);
    ctx.fillRect(rnd.next() * size, rnd.next() * size, 1.6, 1.6);
  }
});

/** Lead sheet with its seams, pale blue-grey, as the domes of the city's churches still are. */
const leadMap = paint(1261, 256, 4, (ctx, size, rnd) => {
  ctx.fillStyle = rgb([158, 167, 175]);
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 24; i++) {
    const x = rnd.next() * size;
    const y = rnd.next() * size;
    const r = 24 + rnd.next() * 30;
    for (const [ox, oy] of [[0, 0], [-size, 0], [size, 0], [0, -size], [0, size]]) {
      const gradient = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
      gradient.addColorStop(0, rgb(rnd.chance(0.5) ? [138, 150, 160] : [178, 186, 192], 0.4));
      gradient.addColorStop(1, rgb([158, 167, 175], 0));
      ctx.fillStyle = gradient;
      ctx.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
    }
  }
  for (let x = 0; x < size; x += 32) {
    ctx.fillStyle = 'rgba(74, 84, 92, 0.5)';
    ctx.fillRect(x, 0, 2, size);
    ctx.fillStyle = 'rgba(226, 232, 236, 0.35)';
    ctx.fillRect(x + 2, 0, 1, size);
    for (let y = (x / 32) % 2 ? 32 : 0; y < size; y += 64) {
      ctx.fillStyle = 'rgba(80, 90, 98, 0.4)';
      ctx.fillRect(x, y, 32, 1.5);
    }
  }
});

export const materials = {
  brick: new THREE.MeshStandardMaterial({ map: brickMap, roughness: 0.9 }),
  banded: new THREE.MeshStandardMaterial({ map: bandedMap, roughness: 0.9 }),
  lead: new THREE.MeshStandardMaterial({ map: leadMap, roughness: 0.55, metalness: 0.2 }),
  // Drums were often rendered and whitened, as St Irene's and the Chora's are today.
  plaster: tinted('plaster', 0xf6ecd8),
  // The shaded brick of a blind arch's recess: darker than the wall, but plainly not a window.
  recess: new THREE.MeshStandardMaterial({ map: brickMap, color: 0xc4a090, roughness: 0.95 }),
};

// ---------- openings ----------

const FACES = {
  '+x': { rotation: Math.PI / 2, normal: [1, 0] },
  '-x': { rotation: -Math.PI / 2, normal: [-1, 0] },
  '+z': { rotation: 0, normal: [0, 1] },
  '-z': { rotation: Math.PI, normal: [0, -1] },
};

/**
 * A row of arched windows on a straight wall face: `face` says which way it
 * looks ('+x', '-x', '+z' or '-z'), `at` is the face's coordinate on that
 * axis, `along` the row's centre on the other one. Options as windowRow.
 */
export function windowsOn(group, face, at, along, options) {
  const { rotation, normal } = FACES[face];
  const row = windowRow(options);
  const off = at + 0.06 * (normal[0] || normal[1]);
  row.position.set(normal[0] ? off : along, 0, normal[0] ? along : off);
  row.rotation.y = rotation;
  group.add(row);
  return row;
}

/** A round-headed door or arch on a straight face, like windowsOn. */
export function doorOn(group, face, at, along, { width, height, y = 0, material = M.opening }) {
  return windowsOn(group, face, at, along, { count: 1, spacing: 0, width, height, y, material });
}

/**
 * A row of blind arches — the recessed arcades that pattern Middle Byzantine
 * apses and walls — on a straight face, held just off it.
 */
export function blindArcade(group, face, at, along, { count, spacing, width, height, y }) {
  return windowsOn(group, face, at - 0.03 * (FACES[face].normal[0] || FACES[face].normal[1]), along, { count, spacing, width, height, y, material: materials.recess });
}

// ---------- drums and domes ----------

/**
 * A drum of `sides` flat faces standing at (x, y, z), `radius` to its
 * corners, with one arched window in each face (or in every `every`th) and,
 * if asked, a pilaster at each corner and a cornice ring on top. Returns the
 * height of its top.
 */
export function drum(group, { x = 0, y, z = 0, radius, height, sides, material = materials.plaster, window: [width, tall] = [radius * 0.28, height * 0.6], every = 1, pilasters = null, cornice = M.stone }) {
  group.add(mesh(cylinderGeometry(radius, radius, height, sides, { thetaStart: Math.PI / sides }), material, x, y, z));
  const apothem = radius * Math.cos(Math.PI / sides);
  const opening = archGeometry(width, tall);
  for (let k = 0; k < sides; k += every) {
    // The geometry's faces centre on the axes, at angles k·2π/sides from +z towards +x.
    const angle = Math.PI / 2 - (k / sides) * Math.PI * 2;
    group.add(placeOnCircle(mesh(opening, M.opening), angle, apothem + 0.06, y + (height - tall) * 0.45, x, z));
  }
  if (pilasters) {
    const pilaster = new THREE.BoxGeometry(pilasters.width, height - 0.2, pilasters.depth).translate(0, (height - 0.2) / 2, 0);
    for (let k = 0; k < sides; k++) {
      const angle = Math.PI / 2 - ((k + 0.5) / sides) * Math.PI * 2;
      group.add(placeOnCircle(mesh(pilaster, pilasters.material ?? material), angle, radius - pilasters.depth * 0.2, y, x, z));
    }
  }
  if (cornice) group.add(mesh(cylinderGeometry(radius + 0.35, radius + 0.35, 0.5, sides, { thetaStart: Math.PI / sides }), cornice, x, y + height - 0.3, z));
  return y + height + (cornice ? 0.2 : 0);
}

/**
 * A lead dome on (x, y, z): a cap of `radius`, squashed to heightScale,
 * with ribs running down from near the crown (none for a smooth dome), and a
 * finial or cross. Returns the height of its crown.
 */
export function leadDome(group, { x = 0, y, z = 0, radius, heightScale = 0.6, segments = 24, ribs = 0, ribSegments = 8, finial = 'cross' }) {
  const lead = materials.lead;
  group.add(mesh(domeGeometry(radius, { heightScale, segments }), lead, x, y, z));
  if (ribs) group.add(mesh(ribsGeometry(radius, { heightScale, count: ribs, segments: ribSegments, width: radius * 0.06, depth: radius * 0.04 }), lead, x, y, z));
  const crown = y + radius * heightScale;
  if (finial) {
    group.add(mesh(cylinderGeometry(radius * 0.08, radius * 0.1, radius * 0.06, 8), lead, x, crown - radius * 0.02, z));
    const stem = Math.max(0.8, radius * 0.25);
    group.add(mesh(new THREE.BoxGeometry(0.22, stem, 0.22).translate(0, stem / 2, 0), M.gold, x, crown, z));
    if (finial === 'cross') group.add(mesh(new THREE.BoxGeometry(0.22, 0.2, stem * 0.55), M.gold, x, crown + stem * 0.68, z));
  }
  return crown;
}

/**
 * Lead ridges along the meridians of a dome (see Hagia Sophia's): a
 * triangular ridge `width` across and `depth` proud, from near the crown to
 * the base, `count` of them evenly round.
 */
function ribsGeometry(radius, { heightScale, count, segments, width, depth, crown = 0.1 }) {
  const positions = [];
  const uvs = [];
  for (let i = 0; i < count; i++) {
    const phi = (i / count) * Math.PI * 2;
    const tangent = [Math.sin(phi), 0, Math.cos(phi)];
    const section = (t) => {
      const theta = (Math.PI / 2) * (crown + (1 - crown) * t);
      const s = Math.sin(theta);
      const c = Math.cos(theta);
      const point = [-radius * Math.cos(phi) * s, radius * heightScale * c, radius * Math.sin(phi) * s];
      const normal = new THREE.Vector3(-Math.cos(phi) * s, c / heightScale, Math.sin(phi) * s).normalize();
      return {
        left: [point[0] - (tangent[0] * width) / 2, point[1], point[2] - (tangent[2] * width) / 2],
        right: [point[0] + (tangent[0] * width) / 2, point[1], point[2] + (tangent[2] * width) / 2],
        apex: [point[0] + normal.x * depth, point[1] + normal.y * depth, point[2] + normal.z * depth],
      };
    };
    let previous = section(0);
    for (let j = 1; j <= segments; j++) {
      const next = section(j / segments);
      positions.push(...previous.left, ...next.apex, ...previous.apex, ...previous.left, ...next.left, ...next.apex);
      positions.push(...previous.right, ...previous.apex, ...next.apex, ...previous.right, ...next.apex, ...next.right);
      const [v0, v1] = [((j - 1) / segments) * radius * 1.5, (j / segments) * radius * 1.5];
      const u = phi * radius;
      uvs.push(u, v0, u + width, v1, u + width, v0, u, v0, u, v1, u + width, v1);
      uvs.push(u + width, v0, u, v0, u, v1, u + width, v0, u, v1, u + width, v1);
      previous = next;
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  return geometry;
}

// ---------- apses ----------

/**
 * Half of a regular polygon's prism, bulging towards +x from the wall at
 * (x, z): `sides` faces, `radius` to the corners, from y0 up to y1, with
 * texture coordinates in metres. Its flat side, against the wall, is left
 * open, and so is its foot.
 */
function halfPrismGeometry(radius, sides, y0, y1) {
  const positions = [];
  const uvs = [];
  const corner = (k) => {
    const angle = -Math.PI / 2 + (k / sides) * Math.PI;
    return [Math.cos(angle) * radius, Math.sin(angle) * radius];
  };
  const side = 2 * radius * Math.sin(Math.PI / (2 * sides));
  for (let k = 0; k < sides; k++) {
    const [ax, az] = corner(k);
    const [bx, bz] = corner(k + 1);
    const [u0, u1] = [k * side, (k + 1) * side];
    // Wound to face outwards: from k to k + 1 runs anticlockwise seen from above (towards +z).
    positions.push(ax, y0, az, bx, y1, bz, bx, y0, bz, ax, y0, az, ax, y1, az, bx, y1, bz);
    uvs.push(u0, y0, u1, y1, u1, y0, u0, y0, u0, y1, u1, y1);
    // The flat top, as a fan from the middle of the wall.
    positions.push(0, y1, 0, bx, y1, bz, ax, y1, az);
    uvs.push(0, 0, bx, bz, ax, az);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * A polygonal apse on the wall at (x, z), bulging east: `sides` faces from
 * the ground to `height`, under a lead half-dome, with an arched window in
 * each face (`windows`: [width, height, sill]) and, if asked, two tiers of
 * blind arches on each face (`arcades`). Returns the apse's group.
 */
export function apse(group, { x, z = 0, radius, height, sides = 3, material = materials.brick, windows = null, arcades = false, roof = 0.5 }) {
  const holder = new THREE.Group();
  holder.position.set(x, 0, z);
  holder.add(mesh(halfPrismGeometry(radius, sides, 0, height), material));
  // The half-dome overhangs the faces a little, like eaves.
  const cap = mesh(domeGeometry(radius * 1.04, { heightScale: roof, segments: sides * 4, phiLength: Math.PI }), materials.lead, 0, height, 0);
  cap.rotation.y = Math.PI / 2;
  holder.add(cap);
  const apothem = radius * Math.cos(Math.PI / (2 * sides));
  const side = 2 * radius * Math.sin(Math.PI / (2 * sides));
  for (let k = 0; k < sides; k++) {
    const angle = -Math.PI / 2 + ((k + 0.5) / sides) * Math.PI;
    if (windows) {
      const [w, h, sill] = windows;
      holder.add(placeOnCircle(mesh(archGeometry(w, h), M.opening), angle, apothem + 0.1, sill));
    }
    if (arcades) {
      for (const [bottom, tall] of [[height * 0.08, height * 0.36], [height * 0.52, height * 0.36]]) {
        const niche = placeOnCircle(mesh(archGeometry(side * 0.62, tall), materials.recess), angle, apothem + 0.04, bottom);
        holder.add(niche);
      }
    }
  }
  group.add(holder);
  return holder;
}

// ---------- roofs ----------

/**
 * A lead barrel vault lying along `axis` ('x' or 'z'): a half-cylinder of
 * `radius` springing at height y, `length` long, centred on (x, z), with its
 * two ends closed by half-discs of the wall's material — the rounded gables
 * of a Middle Byzantine church.
 */
export function barrel(group, { x = 0, y, z = 0, radius, length, axis, wall = materials.banded, segments = 12 }) {
  const along = axis === 'x';
  const vault = cylinderGeometry(radius, radius, length, segments, { open: true, thetaStart: along ? 0 : Math.PI / 2, thetaLength: Math.PI }).translate(0, -length / 2, 0);
  if (along) vault.rotateZ(Math.PI / 2);
  else vault.rotateX(Math.PI / 2);
  group.add(mesh(vault, materials.lead, x, y, z));
  // The tympana stand a hand's breadth inside the vault's ends, under its lip.
  const end = scaleUV(new THREE.CircleGeometry(radius - 0.05, segments, 0, Math.PI), 2 * radius, 2 * radius); // texture in metres
  for (const sign of [-1, 1]) {
    const face = mesh(end, wall);
    face.rotation.y = along ? (sign * Math.PI) / 2 : sign > 0 ? 0 : Math.PI;
    const inset = length / 2 - 0.1;
    face.position.set(x + (along ? sign * inset : 0), y, z + (along ? 0 : sign * inset));
    group.add(face);
  }
}

import * as THREE from 'three';
import { materials as M } from './lib/materials.js';
import {
  archGeometry, archedWallGeometry, box, colonnade, cylinder, cypress, dome, faceToward, hipRoof, judasTree, mesh, placeOnCircle,
  windowRow,
} from './lib/primitives.js';
import { finalizeModel } from './lib/merge.js';
import { createRandom } from '../util/random.js';

/**
 * Hagia Sophia (532–537) as Justinian left it: no minarets, a shallow lead
 * dome ribbed between its ring of 40 windows, half-domes east and west
 * flanked by their exedrae, the great north and south arches with their
 * tympana of windows, the four buttress arms that carry the piers' thrust
 * out through the aisle walls (with arched passages through their feet),
 * the three-sided apse, the double narthex with its ramp towers, the
 * colonnaded atrium, the round skeuophylakion to the north-east and the
 * domed baptistery at the south-west corner. Brick walls with rosy mortar
 * on a stone plinth, marble string courses, lead roofs. The nave square is
 * 31 m; the dome crown stands 55 m up. Apse faces +x (east), south is +z.
 * Origin = centre of the nave at ground level.
 */

// ---------- local surfaces: Byzantine brick with thick rosy mortar beds, and the pale blue-grey of weathered lead ----------

function paintTexture(name, width, height, tile, paint) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  paint(ctx, width, height, createRandom(name));
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1 / tile, 1 / tile);
  return texture;
}

const rgb = ([r, g, b], alpha = 1) => `rgba(${r | 0}, ${g | 0}, ${b | 0}, ${alpha})`;
const vary = (rnd, color, amount) => rgb(color.map((c) => Math.min(255, c * (1 + (rnd.next() - 0.5) * amount))));

/** Thin bricks (about 4 cm) in beds of mortar as thick as themselves, pink with crushed brick: a 2 m tile. */
const brickMap = paintTexture(11, 256, 256, 2, (ctx, w, h, rnd) => {
  ctx.fillStyle = rgb([200, 166, 146]);
  ctx.fillRect(0, 0, w, h);
  const course = 12.8; // 10 cm: a brick and its bed
  for (let y = 0; y < h; y += course) {
    let x = -rnd.next() * 50;
    while (x < w) {
      const length = 36 + rnd.next() * 14;
      ctx.fillStyle = vary(rnd, [164, 86, 64], 0.28);
      ctx.fillRect(x + 1.5, y + 3, length - 3, course - 6);
      if (x + length > w) ctx.fillRect(x + 1.5 - w, y + 3, length - 3, course - 6);
      x += length;
    }
  }
  for (let i = 0; i < 1500; i++) {
    ctx.fillStyle = rgb([120, 80, 62], 0.12);
    ctx.fillRect(rnd.next() * w, rnd.next() * h, 1.5, 1.5);
  }
});

/** Lead sheet with its seams, lighter and bluer than the shared palette's so the roofs read as lead rather than tar. */
const leadMap = paintTexture(12, 256, 256, 4, (ctx, w, h, rnd) => {
  ctx.fillStyle = rgb([154, 164, 173]);
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 26; i++) {
    const x = rnd.next() * w;
    const y = rnd.next() * h;
    const r = 24 + rnd.next() * 30;
    for (const [ox, oy] of [[0, 0], [-w, 0], [w, 0], [0, -h], [0, h]]) {
      const gradient = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
      gradient.addColorStop(0, rgb(rnd.chance(0.5) ? [136, 148, 158] : [174, 182, 190], 0.4));
      gradient.addColorStop(1, rgb([154, 164, 173], 0));
      ctx.fillStyle = gradient;
      ctx.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
    }
  }
  for (let x = 0; x < w; x += 32) {
    ctx.fillStyle = 'rgba(74, 84, 92, 0.5)';
    ctx.fillRect(x, 0, 2, h);
    ctx.fillStyle = 'rgba(226, 232, 236, 0.35)';
    ctx.fillRect(x + 2, 0, 1, h);
    const offset = (x / 32) % 2 ? 32 : 0;
    for (let y = offset; y < h; y += 64) {
      ctx.fillStyle = 'rgba(80, 90, 98, 0.4)';
      ctx.fillRect(x, y, 32, 1.5);
    }
  }
});

const brick = new THREE.MeshStandardMaterial({ map: brickMap, roughness: 0.9 });
const lead = new THREE.MeshStandardMaterial({ map: leadMap, roughness: 0.55, metalness: 0.2 });

export function createHagiaSophia({ lod = 'detail' } = {}) {
  const detail = lod === 'detail';
  const church = new THREE.Group();
  const ribSegments = detail ? 12 : 5;
  const curveSegments = detail ? 10 : 4;

  // Nave block (aisles + galleries): brick on a stone plinth, a marble string course at gallery level,
  // the cornice under the lead roof, and the tympanum block that fills the great arches up to the dome base.
  church.add(box(62, 24, 72, brick, 0, 0, 0));
  church.add(box(63, 2.6, 73, M.stone, 0, 0, 0));
  church.add(box(63.4, 0.7, 73.4, M.marble, 0, 12.6, 0));
  church.add(box(63, 1, 73, M.marble, 0, 23.6, 0));
  church.add(box(62.8, 0.7, 72.8, lead, 0, 24.6, 0));
  // The tympanum block stops short under its cornice, and the drum and its buttresses sink a little into
  // the cornice, so no two faces share the plane at the dome's foot (coplanar faces flicker on a real GPU).
  church.add(box(34, 15.4, 37, brick, 0, 24, 0));
  church.add(box(34.8, 0.8, 37.8, M.marble, 0, 39.2, 0));

  // The great north and south arches: brick bands springing from the main piers, their crowns at the dome base.
  for (const sz of [-1, 1]) church.add(archBand(15.6, 17.4, 3, brick, 0, 24, sz * 18.5));

  // The four buttress arms: from each main pier of the nave square a massive wall runs out over the
  // galleries to the aisle wall and beyond it, stepping down as it goes under its own lead roofs. Its
  // foot stands clear of the aisle wall, and an arched passage through it lets one walk along the church.
  // Each step of the arm stops short under its cornice; the lower step is a shade narrower than the upper
  // and stands a hand's breadth proud of the aisle wall, and the passage's jamb sits just outside the
  // plinth's face, so no two faces share a plane.
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const x = sx * 15.5;
      church.add(box(8, 36.5, 11, brick, x, 0, sz * 21.5));
      church.add(box(8.6, 0.7, 11.6, M.marble, x, 36.3, sz * 21.5));
      church.add(hipRoof(8, 11, 1.5, lead, x, 37, sz * 21.5, 0.4));
      church.add(box(7.8, 30.5, 10.1, brick, x, 0, sz * 31.05));
      church.add(box(8.6, 0.7, 10.6, M.marble, x, 30.3, sz * 31));
      church.add(hipRoof(8, 10, 1.4, lead, x, 31, sz * 31, 0.4));
      const foot = archedWallGeometry({
        length: 4, height: 19, thickness: 8, curveSegments,
        openings: [{ x: -sz * 0.1, width: 3, bottom: 0, spring: 3.8 }],
      }).rotateY(Math.PI / 2);
      church.add(mesh(foot, brick, x, 0, sz * 38));
      church.add(box(8.6, 0.6, 4.6, M.marble, x, 18.6, sz * 38));
      church.add(hipRoof(8, 4, 1.2, lead, x, 19.2, sz * 38, 0.4));
    }
  }

  // Drum with 40 windows separated by small buttresses, and the shallow dome: forty lead ribs run
  // down from the boss at the crown to the buttresses between the windows.
  church.add(cylinder(16.6, 16.6, 4.1, brick, 0, 39.9, 0, 40));
  church.add(ribbedDome(16.5, 0, 44, 0, { heightScale: 0.52, segments: 40, ribs: 40, ribSegments, ribWidth: 0.6, ribDepth: 0.35 }));
  const drumWindow = archGeometry(1.5, 2.8);
  for (let i = 0; i < 40; i++) {
    const angle = (i / 40) * Math.PI * 2;
    church.add(placeOnCircle(box(1.1, 4.5, 1.8, brick), angle, 16.9, 39.9));
    church.add(placeOnCircle(mesh(drumWindow, M.opening), angle + Math.PI / 40, 16.63, 40.6));
  }

  // The boss at the crown and the cross on it.
  const crown = 44 + 16.5 * 0.52;
  church.add(cylinder(1.3, 1.6, 0.9, lead, 0, crown - 0.3, 0, 12));
  church.add(box(0.5, 4.2, 0.5, M.gold, 0, crown + 0.5, 0));
  church.add(box(2.4, 0.5, 0.5, M.gold, 0, crown + 3.1, 0));

  // Great half-domes east and west on a short drum, each lit by five windows at its foot and flanked
  // by two smaller exedrae with three windows each; all ribbed in lead like the dome.
  for (const sx of [-1, 1]) {
    const facing = sx > 0 ? 0 : Math.PI;
    church.add(faceToward(cylinder(15.5, 15.5, 2, brick, sx * 17, 24, 0, 28, { thetaStart: -Math.PI / 2, thetaLength: Math.PI }), sx, 0));
    church.add(faceToward(ribbedDome(15.5, sx * 17, 26, 0, { heightScale: 0.86, phiLength: Math.PI, segments: 28, ribs: 11, ribSegments }), sx, 0));
    addDomeWindows(church, {
      radius: 15.5, heightScale: 0.86, cx: sx * 17, cy: 26, cz: 0, width: 1.7, height: 3.2, lift: -1.2,
      angles: [-2, -1, 0, 1, 2].map((k) => facing + (k * Math.PI) / 15),
    });
    for (const sz of [-1, 1]) {
      const diagonal = Math.atan2(sz, sx);
      church.add(faceToward(ribbedDome(6.3, sx * 24.5, 24, sz * 11, { heightScale: 0.9, phiLength: Math.PI, segments: 16, ribs: 5, ribSegments, ribWidth: 0.4, ribDepth: 0.22 }), sx, sz));
      addDomeWindows(church, {
        radius: 6.3, heightScale: 0.9, cx: sx * 24.5, cy: 24, cz: sz * 11, width: 1.2, height: 2.2, lift: 0.5,
        angles: [-1, 0, 1].map((k) => diagonal + (k * Math.PI) / 6),
      });
    }
  }

  // Eastern apse: three-sided outside, as it still is, under its own ribbed semi-dome with three
  // small windows at its foot.
  church.add(faceToward(cylinder(7.5, 7.5, 19, brick, 31, 0, 0, 3, { thetaStart: -Math.PI / 2, thetaLength: Math.PI }), 1, 0));
  church.add(faceToward(cylinder(7.7, 7.7, 0.8, M.marble, 31, 18.5, 0, 3, { thetaStart: -Math.PI / 2, thetaLength: Math.PI }), 1, 0));
  church.add(faceToward(ribbedDome(7.5, 31, 19.3, 0, { heightScale: 0.7, phiLength: Math.PI, segments: 16, ribs: 5, ribSegments, ribWidth: 0.4, ribDepth: 0.22 }), 1, 0));
  addDomeWindows(church, {
    radius: 7.5, heightScale: 0.7, cx: 31, cy: 19.3, cz: 0, width: 1.1, height: 2.0, lift: 0.4,
    angles: [-0.65, 0, 0.65],
  });

  // Inner and outer narthex on the west front, and the ramp towers at their northern and southern ends.
  // The narthex cornice and plinth stop a little below the nave's, where they run into it, and the towers
  // stop short under their cornices.
  church.add(box(10, 24, 66, brick, -36, 0, 0));
  church.add(box(11, 0.9, 67, M.marble, -36, 23.6, 0));
  church.add(box(10.8, 0.7, 66.8, lead, -36, 24.5, 0));
  church.add(box(7, 14, 66, brick, -44.5, 0, 0));
  church.add(box(8, 1, 67, M.marble, -44.5, 13.6, 0));
  church.add(box(7.8, 0.6, 66.8, lead, -44.5, 14.6, 0));
  church.add(box(50, 2.5, 67, M.stone, -37, 0, 0));
  for (const sz of [-1, 1]) {
    church.add(box(9, 26.5, 8, brick, -36, 0, sz * 37));
    church.add(box(9.6, 0.7, 8.6, M.marble, -36, 26.3, sz * 37));
    church.add(hipRoof(9, 8, 1.6, lead, -36, 27, sz * 37, 0.4));
    // Slit windows lighting the ramps inside.
    for (const y of [6, 13, 20]) {
      const slit = windowRow({ count: 2, spacing: 4, width: 0.9, height: 2.4, y });
      slit.position.set(-36, 0, sz * 41.05);
      slit.rotation.y = sz > 0 ? 0 : Math.PI;
      church.add(slit);
    }
  }

  // Skeuophylakion: the round treasury north-east of the church, lit by a ring of windows.
  church.add(cylinder(6, 6, 9, brick, 36, 0, -46, 20));
  church.add(cylinder(6.3, 6.3, 0.6, M.marble, 36, 8.6, -46, 20));
  church.add(ribbedDome(6, 36, 9.2, -46, { heightScale: 0.55, segments: 20, ribs: 8, ribSegments, ribWidth: 0.4, ribDepth: 0.22 }));
  const treasuryWindow = archGeometry(1.0, 2.2);
  for (let i = 0; i < 8; i++) church.add(placeOnCircle(mesh(treasuryWindow, M.opening), (i / 8) * Math.PI * 2, 6.05, 4.5, 36, -46));

  addBaptistery(church, ribSegments);

  // Windows and the atrium belong to both builds: the map draws the church seven times life size,
  // so they read there too. Only the paving sheet and the trees are diorama dressing.
  addWindows(church);
  addAtrium(church);
  if (detail) {
    church.add(box(150, 1, 116, M.paving, -25, -1, 0));
    for (const [x, z] of [[40, 30], [44, 18], [42, -26], [-6, 50], [20, -52], [-60, 44], [-102, 46], [-102, -46], [48, 6], [-28, -54], [12, 50]]) {
      church.add(cypress(13, x, 0, z));
    }
    // Erguvans in flower among the cypresses.
    [[-20, 50], [8, -52], [-74, -44]].forEach(([x, z], i) => church.add(judasTree(9, x, 0, z, { seed: i + 1 })));
  } else {
    church.add(box(100, 0.4, 90, M.paving, -10, -0.4, 0));
  }

  return finalizeModel(church);
}

/**
 * The baptistery at the south-west corner, beside the atrium's south wall:
 * it survives, as an octagonal domed hall. Invented here: the exact
 * proportions, the ring of small windows in its drum and the lead ribs.
 */
function addBaptistery(church, ribSegments) {
  const x = -47;
  const z = 39.5;
  church.add(cylinder(5.5, 5.5, 8, brick, x, 0, z, 8));
  church.add(cylinder(5.7, 5.7, 1.2, M.stone, x, 0, z, 8));
  church.add(cylinder(5.8, 5.8, 0.7, M.marble, x, 8, z, 8));
  church.add(cylinder(4.2, 4.2, 1.6, brick, x, 8.7, z, 8));
  church.add(cylinder(4.4, 4.4, 0.4, M.marble, x, 10.3, z, 8));
  church.add(ribbedDome(4.1, x, 10.7, z, { heightScale: 0.6, segments: 16, ribs: 8, ribSegments, ribWidth: 0.35, ribDepth: 0.2 }));
  // One window in each face of the hall and of the drum (an octagon's faces lie at half-steps).
  const lower = archGeometry(1.2, 2.6);
  const upper = archGeometry(0.8, 1.3);
  for (let i = 0; i < 8; i++) {
    const angle = ((i + 0.5) / 8) * Math.PI * 2;
    church.add(placeOnCircle(mesh(lower, M.opening), angle, 5.5 * Math.cos(Math.PI / 8) + 0.05, 4, x, z));
    church.add(placeOnCircle(mesh(upper, M.opening), angle, 4.2 * Math.cos(Math.PI / 8) + 0.05, 8.85, x, z));
  }
}

/** A lead dome (or half-dome bulging towards +z) with ribs radiating from its crown, as a group at (x, y, z). */
function ribbedDome(radius, x, y, z, { heightScale = 1, phiLength = Math.PI * 2, segments = 24, ribs, ribSegments = 12, ribWidth = 0.5, ribDepth = 0.3 }) {
  const group = new THREE.Group();
  group.add(dome(radius, lead, 0, 0, 0, { heightScale, phiLength, segments }));
  group.add(mesh(ribsGeometry(radius, { heightScale, phiLength, count: ribs, segments: ribSegments, width: ribWidth, depth: ribDepth }), lead));
  group.position.set(x, y, z);
  return group;
}

/**
 * Ridges of lead along the meridians of a dome of the given radius, squashed
 * by heightScale like domeGeometry(). Each rib is a triangular ridge `width`
 * across at its foot and `depth` proud of the surface, from near the crown
 * to the base. A full dome gets ribs at count equal steps from phi = 0; a
 * half-dome (phiLength = PI) gets them spaced inside its two edges.
 */
function ribsGeometry(radius, { heightScale = 1, phiLength = Math.PI * 2, count, segments = 12, width = 0.5, depth = 0.3, crown = 0.1 }) {
  const full = phiLength >= Math.PI * 2 - 1e-6;
  const positions = [];
  const uvs = [];
  const push = (...points) => {
    for (const [x, y, z] of points) positions.push(x, y, z);
  };
  for (let i = 0; i < count; i++) {
    const phi = full ? (i / count) * phiLength : ((i + 1) / (count + 1)) * phiLength;
    const tangent = [Math.sin(phi), 0, Math.cos(phi)];
    const section = (t) => {
      const theta = (Math.PI / 2) * (crown + (1 - crown) * t);
      const s = Math.sin(theta);
      const c = Math.cos(theta);
      const point = [-radius * Math.cos(phi) * s, radius * heightScale * c, radius * Math.sin(phi) * s];
      const normal = new THREE.Vector3(-Math.cos(phi) * s, c / heightScale, Math.sin(phi) * s).normalize();
      const w = width / 2;
      return {
        left: [point[0] - tangent[0] * w, point[1], point[2] - tangent[2] * w],
        right: [point[0] + tangent[0] * w, point[1], point[2] + tangent[2] * w],
        apex: [point[0] + normal.x * depth, point[1] + normal.y * depth, point[2] + normal.z * depth],
      };
    };
    let previous = section(0);
    for (let j = 1; j <= segments; j++) {
      const next = section(j / segments);
      push(previous.left, next.apex, previous.apex, previous.left, next.left, next.apex);
      push(previous.right, previous.apex, next.apex, previous.right, next.apex, next.right);
      const v0 = ((j - 1) / segments) * radius * 1.5;
      const v1 = (j / segments) * radius * 1.5;
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

/**
 * Arched windows pierced through the foot of a dome: each stands on the
 * dome's surface at `lift` above its base (negative lift puts it on a drum
 * below) and leans inward with the curve. `angles` are world directions in
 * the x/z plane (cos → x, sin → z) from the dome's centre (cx, cz).
 */
function addDomeWindows(church, { radius, heightScale, cx, cy, cz, angles, width, height, lift }) {
  const surface = (h) => (h <= 0 ? radius : radius * Math.sqrt(Math.max(0, 1 - (h / (radius * heightScale)) ** 2)));
  const r0 = surface(lift);
  const r1 = surface(lift + height);
  const tilt = Math.atan2(r0 - r1, height);
  // The flat window is a chord of the curved meridian; stand it proud by the sagitta so it is not swallowed.
  const curvature = radius * heightScale * heightScale;
  const offset = 0.1 + (height * height) / (8 * curvature);
  const geometry = archGeometry(width, height);
  for (const angle of angles) {
    const window = mesh(geometry, M.opening);
    placeOnCircle(window, angle, r0 + offset, cy + lift, cx, cz);
    window.rotation.order = 'YXZ';
    window.rotation.x = -tilt;
    church.add(window);
  }
}

/** A semicircular band of masonry: an arch seen on a façade, standing in the plane z = constant. */
function archBand(inner, outer, depth, material, x, y, z) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outer, 0, Math.PI, false);
  shape.lineTo(-inner, 0);
  shape.absarc(0, 0, inner, Math.PI, 0, true);
  shape.lineTo(outer, 0);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 24 });
  geometry.translate(0, 0, -depth / 2);
  return mesh(geometry, material, x, y, z);
}

function addWindows(church) {
  // Tympanum walls under the dome arches (north and south faces): three tiers of windows.
  for (const side of [-1, 1]) {
    const lowest = windowRow({ count: 5, spacing: 4.5, width: 2.2, height: 3.6, y: 25 });
    const upper = windowRow({ count: 7, spacing: 3.6, width: 2.1, height: 4.5, y: 30.5 });
    const lower = windowRow({ count: 3, spacing: 4.6, width: 1.6, height: 2.8, y: 36 });
    for (const row of [lowest, upper, lower]) {
      row.position.z = side * 18.55;
      row.rotation.y = side > 0 ? 0 : Math.PI;
      church.add(row);
    }
    // Gallery and aisle windows along the long flanks, between the buttresses.
    for (const y of [5, 16]) {
      const row = windowRow({ count: 15, spacing: 3.8, width: 1.9, height: 3.8, y, skip: (x) => Math.abs(Math.abs(x) - 14) < 5.5 });
      row.position.z = side * 36.05;
      row.rotation.y = side > 0 ? 0 : Math.PI;
      church.add(row);
    }
  }
  // West doors of the outer narthex and windows above.
  const doors = windowRow({ count: 5, spacing: 9, width: 3, height: 6.5, y: 0 });
  const west = windowRow({ count: 9, spacing: 6.5, width: 2, height: 3.6, y: 16 });
  for (const [row, x] of [[doors, -48.05], [west, -41.05]]) {
    row.position.x = x;
    row.rotation.y = -Math.PI / 2;
    church.add(row);
  }
  // Apse windows, one in each of the three faces (the faces of a 3-sided half-cylinder lie 6.5 m out).
  for (const angle of [-Math.PI / 3, 0, Math.PI / 3]) {
    const window = mesh(archGeometry(1.8, 4.5), M.opening);
    placeOnCircle(window, angle, 6.55, 9, 31, 0);
    church.add(window);
  }
}

/**
 * Justinian's colonnaded forecourt with its phiale (ablution fountain). The
 * walls stop short under the lead roofs, which overhang them a little; the
 * west roof lies a shade lower than the side roofs it runs under, and the
 * west wall is set in a little from the ends of the side walls.
 */
function addAtrium(church) {
  const west = -96;
  const east = -48;
  const depth = east - west;
  for (const side of [-1, 1]) {
    church.add(box(depth, 8.8, 1.5, brick, (west + east) / 2, 0, side * 33));
    church.add(box(depth + 0.2, 0.5, 8.6, lead, (west + east) / 2, 8.5, side * 29.55));
    const columns = colonnade({ length: depth - 4, count: 11, height: 8.5, radius: 0.45 });
    columns.position.set((west + east) / 2, 0, side * 25.8);
    church.add(columns);
  }
  church.add(box(1.5, 8.75, 67.3, brick, west + 0.1, 0, 0));
  church.add(box(8.5, 0.5, 58, lead, west + 3.5, 8.4, 0));
  const westColumns = colonnade({ length: 50, count: 12, height: 8.5, radius: 0.45 });
  westColumns.rotation.y = Math.PI / 2;
  westColumns.position.x = west + 7.5;
  church.add(westColumns);
  // Phiale fountain.
  church.add(cylinder(3.2, 3.4, 1, M.marble, -72, 0, 0, 20));
  const basin = cylinder(2.7, 2.7, 0.2, M.water, -72, 0.85, 0, 20);
  church.add(basin);
  church.add(cylinder(0.3, 0.3, 3, M.marble, -72, 1, 0, 8));
  church.add(cylinder(0.9, 0.2, 0.6, M.marble, -72, 3.6, 0, 10));
}

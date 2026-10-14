import * as THREE from 'three';
import { CHURCH, HOUSE_ATLAS } from '../models/lib/textures.js';
import { atlasUV, block, roofSlope, surface, townMaterials, wall, well } from './atlasGeometry.js';

/**
 * The neighbourhood churches, after a small middle-Byzantine cross-in-square
 * church: four gabled arms rising over low corner bays, a tiled dome on an
 * octagonal drum over the crossing, three apses to the east under half-cones
 * of tiles, a brick bell-cote, and a walled forecourt with a well before the
 * west door. Masonry, windows and doors are painted on the town atlas
 * (textures.js, with the heights in CHURCH).
 *
 * The model is built once with its length as the unit: x runs east (the
 * apses) to west (the door), z across, y up. Instances are scaled by each
 * church's size.
 *
 * churches: [{ point: [east, north], y, angle, size }]
 */
export function createChurches(rnd, churches) {
  const { walls, roofs } = townMaterials();
  const { body, roof } = church();
  const meshes = [new THREE.InstancedMesh(body, walls, Math.max(1, churches.length)), new THREE.InstancedMesh(roof, roofs, Math.max(1, churches.length))];
  const matrix = new THREE.Matrix4();
  const rotation = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  churches.forEach(({ point: [east, north], y, angle, size }, i) => {
    matrix.compose(new THREE.Vector3(east, y, -north), rotation.setFromAxisAngle(up, angle), new THREE.Vector3(size, size, size));
    meshes[0].setMatrixAt(i, matrix);
    meshes[1].setMatrixAt(i, matrix);
    meshes[0].setColorAt(i, new THREE.Color(0xffffff).multiplyScalar(0.94 + rnd.next() * 0.06));
    meshes[1].setColorAt(i, new THREE.Color(0xffffff).multiplyScalar(0.92 + rnd.next() * 0.08));
  });
  const group = new THREE.Group();
  group.name = 'churches';
  for (const mesh of meshes) {
    mesh.count = churches.length;
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
  }
  return group;
}

const A = HOUSE_ATLAS;
const C = CHURCH;
const BAYS = { x: [-0.42, 0.26], z: [-0.34, 0.34] };
const NAVE = { x: [-0.45, 0.29], half: 0.13 }; // the east–west arm, centred on z = 0
const TRANSEPT = { z: [-0.37, 0.37], x: [-0.21, 0.05] }; // the north–south arm
const CROSSING = (TRANSEPT.x[0] + TRANSEPT.x[1]) / 2;

function church() {
  const body = surface();
  const roof = surface();
  const rect = (region, from, to, y1, y0 = C.foot) => wall(body, region, from, to, [[0, y0], [1, y0], [1, y1], [0, y1]], [y0, y1]);
  const gableEnd = (region, from, to) => wall(body, region, from, to,
    [[0, C.foot], [1, C.foot], [1, C.arms], [0.5, C.arms + C.rise], [0, C.arms]], [C.foot, C.arms + C.rise]);

  // The low corner bays, their walls broken where the arms of the cross stand forward.
  const [bx0, bx1] = BAYS.x;
  const [bz0, bz1] = BAYS.z;
  for (const [x0, x1] of [[bx0, TRANSEPT.x[0]], [TRANSEPT.x[1], bx1]]) {
    rect(A.churchBay, [x1, bz0], [x0, bz0], C.bays);
    rect(A.churchBay, [x0, bz1], [x1, bz1], C.bays);
  }
  for (const [z0, z1] of [[bz0, -NAVE.half], [NAVE.half, bz1]]) {
    rect(A.churchBay, [bx0, z0], [bx0, z1], C.bays);
    rect(A.churchBay, [bx1, z1], [bx1, z0], C.bays);
  }
  hipRoof(roof, BAYS.x, BAYS.z, C.bays, 0.1, 0.025);

  // The arms of the cross: gable ends (the portal to the west), long sides, and pitched roofs.
  const [nx0, nx1] = NAVE.x;
  const h = NAVE.half;
  gableEnd(A.churchWest, [nx0, -h], [nx0, h]);
  gableEnd(A.churchArm, [nx1, h], [nx1, -h]);
  rect(A.churchSide, [nx1, -h], [nx0, -h], C.arms);
  rect(A.churchSide, [nx0, h], [nx1, h], C.arms);
  const [tx0, tx1] = TRANSEPT.x;
  const [tz0, tz1] = TRANSEPT.z;
  gableEnd(A.churchArm, [tx1, tz0], [tx0, tz0]);
  gableEnd(A.churchArm, [tx0, tz1], [tx1, tz1]);
  rect(A.churchSide, [tx0, tz0], [tx0, tz1], C.arms);
  rect(A.churchSide, [tx1, tz1], [tx1, tz0], C.arms);
  gableRoof(roof, { along: 'x', from: nx0, to: nx1, centre: 0, half: h });
  gableRoof(roof, { along: 'z', from: tz0, to: tz1, centre: CROSSING, half: (tx1 - tx0) / 2 });

  // The drum and its dome over the crossing, with an iron cross on top.
  const centre = [CROSSING, 0];
  const top = drumAndDome(body, roof, centre);
  const iron = (x, y, z) => block(body, A.dark, x, y, z, { faces: ['front', 'back', 'left', 'right', 'top'] });
  iron([CROSSING - 0.006, CROSSING + 0.006], [top - 0.01, top + 0.09], [-0.006, 0.006]);
  iron([CROSSING - 0.005, CROSSING + 0.005], [top + 0.055, top + 0.066], [-0.03, 0.03]);

  // Three apses to the east: the sanctuary's off the end of the nave, smaller ones off the corner bays.
  apse(body, roof, [nx1, 0], 0.1, 5, C.apse, 0.08);
  for (const side of [-1, 1]) apse(body, roof, [bx1, side * 0.235], 0.065, 3, C.sideApse, 0.06);

  // A bell-cote of brick on the north-west corner, open on its long sides.
  const [b0, b1] = C.bell;
  const bell = { x: [-0.4, -0.32], z: [-0.32, -0.24] };
  block(body, A.churchBell, bell.x, [b0, b1], bell.z, { faces: ['front', 'back', 'left', 'right'] });
  for (const [from, to] of [[[bell.x[0], bell.z[0]], [bell.x[0], bell.z[1]]], [[bell.x[1], bell.z[1]], [bell.x[1], bell.z[0]]]]) {
    wall(body, A.churchSide, from, to, [[0, b1], [1, b1], [0.5, b1 + 0.04]], [b1, b1 + 0.04]);
  }
  gableRoof(roof, { along: 'x', from: bell.x[0], to: bell.x[1], centre: (bell.z[0] + bell.z[1]) / 2, half: 0.04, eaves: b1, rise: 0.04, overhang: 0.012, verge: 0.01, thickness: 0.01 });

  // The forecourt before the west door: a low wall with a gateway on the church's axis, and a well.
  const height = 0.07;
  const thick = 0.02;
  const west = -0.66;
  const yardWall = (x, z) => block(body, A.rubble, x, [C.foot, height], z, { faces: ['top', 'front', 'back', 'left', 'right'] });
  yardWall([west - thick, west], [-0.38, -0.07]);
  yardWall([west - thick, west], [0.07, 0.38]);
  yardWall([west, bx0 + 0.02], [-0.38, -0.36]);
  yardWall([west, bx0 + 0.02], [0.36, 0.38]);
  well(body, [-0.58, 0.25], 0.028, 0.05);

  return { body: body.geometry(), roof: roof.geometry() };
}

/**
 * A pitched roof over one arm, its ridge along x or z at `centre` on the
 * other axis, running from `from` to `to` with the verges overhanging.
 */
function gableRoof(target, { along, from, to, centre, half, eaves = C.arms, rise = C.rise, overhang = 0.03, verge = 0.025, thickness = 0.02 }) {
  const slopes = surface();
  const drop = (overhang * rise) / half;
  for (const side of [-1, 1]) roofSlope(slopes, [0, eaves + rise], [side * (half + overhang), eaves - drop], [from - verge, to + verge], { thickness });
  // Built with its ridge along z through x = 0; an arm along x is turned a quarter about y.
  if (along === 'z') target.add(slopes, (p) => p, [centre, 0, 0]);
  else target.add(slopes, ([x, y, z]) => [z, y, -x], [0, 0, centre]);
}

/** A low hipped roof over the corner bays, its tiles running up from the eaves on all four sides. */
function hipRoof(target, [x0, x1], [z0, z1], eaves, rise, overhang) {
  const [a0, a1, b0, b1] = [x0 - overhang, x1 + overhang, z0 - overhang, z1 + overhang];
  const half = Math.min(a1 - a0, b1 - b0) / 2;
  const y = eaves - (overhang * rise) / (half - overhang);
  const peak = y + rise * (half / (half - overhang));
  const [mx, mz] = [(a0 + a1) / 2, (b0 + b1) / 2];
  const ridge = [[Math.min(mx, a0 + half), peak, mz], [Math.max(mx, a1 - half), peak, mz]];
  const thick = 0.015;
  const corners = [[a0, b0], [a1, b0], [a1, b1], [a0, b1]];
  const sides = [
    { edge: [corners[3], corners[2]], top: [ridge[1], ridge[0]], out: [0, 0, 1] },
    { edge: [corners[1], corners[0]], top: [ridge[0], ridge[1]], out: [0, 0, -1] },
    { edge: [corners[2], corners[1]], top: [ridge[1]], out: [1, 0, 0] },
    { edge: [corners[0], corners[3]], top: [ridge[0]], out: [-1, 0, 0] },
  ];
  for (const { edge, top, out } of sides) {
    const points = [[edge[0][0], y, edge[0][1]], [edge[1][0], y, edge[1][1]], ...top];
    const length = Math.hypot(edge[1][0] - edge[0][0], edge[1][1] - edge[0][1]);
    const along = ([px, , pz]) => ((px - edge[0][0]) * (edge[1][0] - edge[0][0]) + (pz - edge[0][1]) * (edge[1][1] - edge[0][1])) / (length * length);
    target.polygon(points, points.map((p) => atlasUV(A.roof, along(p), (p[1] - y) / (peak - y))), [out[0], 1, out[2]], 1);
    const fascia = [[edge[0][0], y - thick, edge[0][1]], [edge[1][0], y - thick, edge[1][1]], [edge[1][0], y, edge[1][1]], [edge[0][0], y, edge[0][1]]];
    target.polygon(fascia, [[0, 0], [1, 0], [1, 1], [0, 1]].map(([s, t]) => atlasUV(A.roof, s, t * 0.04)), out, 0.7);
  }
}

/** The octagonal drum and a dome of tiles on it, returning the height of the dome's crown. */
function drumAndDome(body, roof, [cx, cz]) {
  const [y0, y1] = C.drum;
  const radius = 0.105;
  const corner = (k, r) => {
    const angle = ((k + 0.5) / 8) * Math.PI * 2;
    return [cx + Math.cos(angle) * r, cz + Math.sin(angle) * r];
  };
  for (let k = 0; k < 8; k++) {
    wall(body, A.churchDrum, corner(k + 1, radius), corner(k, radius), [[0, y0], [1, y0], [1, y1], [0, y1]], [y0, y1]);
  }

  // The dome: a low, eaved cap of tiles in rings, its rim standing out over the drum.
  const rim = 0.125;
  const height = 0.09;
  const segments = 16;
  const rings = 5;
  const at = (k, i) => {
    const phi = (i / rings) * (Math.PI / 2);
    const angle = (k / segments) * Math.PI * 2;
    const r = rim * Math.cos(phi);
    return [cx + Math.cos(angle) * r, y1 + height * Math.sin(phi), cz + Math.sin(angle) * r];
  };
  for (let k = 0; k < segments; k++) {
    for (let i = 0; i < rings; i++) {
      const points = i === rings - 1 ? [at(k, i), at(k + 1, i), at(k, i + 1)] : [at(k, i), at(k + 1, i), at(k + 1, i + 1), at(k, i + 1)];
      const uvs = points.map((p, n) => atlasUV(A.roof, (k + (n === 1 || n === 2 ? 1 : 0)) / segments, (i + (n >= 2 ? 1 : 0)) / rings * 0.9));
      const mid = points.reduce((sum, p) => sum.map((v, m) => v + p[m] / points.length), [0, 0, 0]);
      roof.polygon(points, uvs, [mid[0] - cx, mid[1] - y1 + 0.02, mid[2] - cz], 1);
    }
    // The underside of the rim, where it overhangs the drum.
    const angle = (step) => ((k + step) / segments) * Math.PI * 2;
    const ring = [[rim, 0], [rim, 1], [radius, 1], [radius, 0]].map(([r, step]) => [cx + Math.cos(angle(step)) * r, y1, cz + Math.sin(angle(step)) * r]);
    roof.polygon(ring, ring.map(() => atlasUV(A.soffit, 0.5, 0.5)), [0, -1, 0], 0.55);
  }
  return y1 + height;
}

/**
 * A polygonal apse of `sides` faces bulging east from the wall at x = cx,
 * under a half-cone of tiles leaning against that wall.
 */
function apse(body, roof, [cx, cz], radius, sides, height, rise) {
  const corner = (k, r) => {
    const angle = -Math.PI / 2 + (k / sides) * Math.PI;
    return [cx + Math.cos(angle) * r, cz + Math.sin(angle) * r];
  };
  for (let k = 0; k < sides; k++) {
    wall(body, A.churchApse, corner(k + 1, radius), corner(k, radius), [[0, C.foot], [1, C.foot], [1, height], [0, height]], [C.foot, C.apse]);
  }
  const eaves = radius + 0.015;
  const drop = 0.012;
  const apex = [cx, height + rise, cz];
  for (let k = 0; k < sides; k++) {
    const [a, b] = [corner(k, eaves), corner(k + 1, eaves)];
    const tile = [[a[0], height - drop, a[1]], [b[0], height - drop, b[1]], apex];
    roof.polygon(tile, [atlasUV(A.roof, k / sides, 0), atlasUV(A.roof, (k + 1) / sides, 0), atlasUV(A.roof, (k + 0.5) / sides, 1)],
      [(a[0] + b[0]) / 2 - cx, 0.5, (a[1] + b[1]) / 2 - cz], 1);
    const fascia = [[a[0], height - drop - 0.012, a[1]], [b[0], height - drop - 0.012, b[1]], tile[1], tile[0]];
    roof.polygon(fascia, [[0, 0], [1, 0], [1, 1], [0, 1]].map(([s, t]) => atlasUV(A.roof, s, t * 0.04)), [(a[0] + b[0]) / 2 - cx, 0, (a[1] + b[1]) / 2 - cz], 0.7);
  }
}

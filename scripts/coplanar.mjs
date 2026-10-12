// Finds faces that would z-fight: pairs of axis-aligned faces of different parts, facing the same
// way, lying in the same plane (or within a few centimetres of it) and overlapping in extent. On
// a real GPU such pairs flicker like static as the diorama turns. Models are built in Node with a
// stubbed document; see scripts/coplanar-hooks.mjs.
//
//   node --import ./scripts/coplanar-register.mjs scripts/coplanar.mjs [--lod=detail|map] [--gap=0.06] [--top=20] [--all] [landmark ids…]
//
// For each model it prints the worst pairs: the plane (axis and coordinate), the gap between the
// two faces, the overlapping area, and the two parts (geometry type, material, and where they sit).
import * as THREE from 'three';

const args = process.argv.slice(2);
const opts = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')));
const wanted = args.filter((a) => !a.startsWith('--'));
const lod = opts.lod ?? 'detail';
const maxGap = +(opts.gap ?? 0.03); // metres: faces closer than this fight on a real GPU once the stage scales the model down
const top = +(opts.top ?? 20);
const minArea = +(opts.area ?? 0.5); // m² of overlap worth reporting

// Stub enough of the DOM for the painted textures.
const ctx = new Proxy({}, {
  get: (_, key) => (key === 'createRadialGradient' || key === 'createLinearGradient') ? () => ({ addColorStop() {} }) : key === 'measureText' ? () => ({ width: 10 }) : () => {},
  set: () => true,
});
globalThis.document = {
  createElement: () => ({ width: 0, height: 0, getContext: () => ctx, style: {} }),
  createElementNS: () => ({ style: {} }),
  fonts: { check: () => true, load: () => Promise.resolve() },
};
globalThis.window = { devicePixelRatio: 1, matchMedia: () => ({ matches: false }), innerWidth: 1000, innerHeight: 800, addEventListener() {} };

const { LANDMARKS } = await import('../js/data/landmarks.js');
const { materials } = await import('../js/models/lib/materials.js');
for (const [name, material] of Object.entries(materials)) material.name ||= name;
// Faces looking down are never seen (the camera stays above the ground), so their fights are harmless unless --all is given.
const hidden = (face) => !opts.all && face.axis === 'y' && face.sign === '-';
const AXES = ['x', 'y', 'z'];

function describe(material) {
  if (material.name) return material.name;
  if (material.map) return `textured#${material.map.uuid.slice(0, 4)}`;
  return material.color ? `#${material.color.getHexString()}` : 'material';
}

/** Axis-aligned faces of one mesh, grouped by (axis, direction, coordinate): each group's extent in the other two axes. */
function facesOf(mesh, id) {
  const geometry = mesh.geometry;
  const position = geometry.attributes.position;
  const index = geometry.index;
  const count = index ? index.count : position.count;
  const a = new THREE.Vector3(); const b = new THREE.Vector3(); const c = new THREE.Vector3();
  const ab = new THREE.Vector3(); const ac = new THREE.Vector3(); const n = new THREE.Vector3();
  const groups = new Map();
  for (let i = 0; i < count; i += 3) {
    const [ia, ib, ic] = index ? [index.getX(i), index.getX(i + 1), index.getX(i + 2)] : [i, i + 1, i + 2];
    a.fromBufferAttribute(position, ia).applyMatrix4(mesh.matrixWorld);
    b.fromBufferAttribute(position, ib).applyMatrix4(mesh.matrixWorld);
    c.fromBufferAttribute(position, ic).applyMatrix4(mesh.matrixWorld);
    n.crossVectors(ab.subVectors(b, a), ac.subVectors(c, a));
    const area = n.length() / 2;
    if (area < 1e-6) continue;
    n.divideScalar(area * 2);
    for (const [k, axis] of AXES.entries()) {
      if (Math.abs(n[axis]) < 0.999999) continue; // only truly axis-aligned faces: a face turned by a jitter is not in anyone else's plane
      const sign = n[axis] > 0 ? '+' : '-';
      const coord = Math.round(a[axis] * 1000) / 1000;
      const key = `${sign}${axis}:${coord}`;
      const [u, v] = AXES.filter((_, j) => j !== k);
      const group = groups.get(key) ?? { axis, sign, coord, u, v, min: [Infinity, Infinity], max: [-Infinity, -Infinity], area: 0, id, material: describe(mesh.material), type: geometry.type.replace('Geometry', '') };
      for (const p of [a, b, c]) {
        group.min[0] = Math.min(group.min[0], p[u]); group.max[0] = Math.max(group.max[0], p[u]);
        group.min[1] = Math.min(group.min[1], p[v]); group.max[1] = Math.max(group.max[1], p[v]);
      }
      group.area += area;
      groups.set(key, group);
    }
  }
  return [...groups.values()];
}

function overlap(g, h) {
  const w = Math.min(g.max[0], h.max[0]) - Math.max(g.min[0], h.min[0]);
  const d = Math.min(g.max[1], h.max[1]) - Math.max(g.min[1], h.min[1]);
  return w > 0.01 && d > 0.01 ? w * d : 0;
}

const place = (g) => `${g.u}=${((g.min[0] + g.max[0]) / 2).toFixed(1)} ${g.v}=${((g.min[1] + g.max[1]) / 2).toFixed(1)} (${(g.max[0] - g.min[0]).toFixed(1)}×${(g.max[1] - g.min[1]).toFixed(1)})`;

for (const landmark of LANDMARKS) {
  if (wanted.length && !wanted.includes(landmark.id)) continue;
  const model = landmark.create({ lod });
  model.updateMatrixWorld(true);
  const faces = [];
  let id = 0;
  model.traverse((object) => {
    if (!object.isMesh || object.isInstancedMesh || Array.isArray(object.material)) return;
    faces.push(...facesOf(object, id++));
  });
  // Sweep each facing's faces by coordinate; faces of different parts within maxGap that overlap are suspects.
  const findings = [];
  const byFacing = new Map();
  for (const face of faces) {
    if (hidden(face)) continue;
    const key = face.sign + face.axis;
    (byFacing.get(key) ?? byFacing.set(key, []).get(key)).push(face);
  }
  for (const list of byFacing.values()) {
    list.sort((p, q) => p.coord - q.coord);
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length && list[j].coord - list[i].coord <= maxGap; j++) {
        const [g, h] = [list[i], list[j]];
        if (g.id === h.id) continue;
        const area = overlap(g, h);
        if (area >= minArea) findings.push({ g, h, area, gap: h.coord - g.coord });
      }
    }
  }
  findings.sort((p, q) => q.area - p.area);
  console.log(`\n== ${landmark.id} (${lod}): ${findings.length} coplanar overlaps, ${faces.length} face groups in ${id} parts`);
  for (const { g, h, area, gap } of findings.slice(0, top)) {
    console.log(`  ${g.sign}${g.axis}=${g.coord.toFixed(2)} gap ${gap.toFixed(3)} m  overlap ${area.toFixed(1)} m²  |  ${g.type} ${g.material} at ${place(g)}  vs  ${h.type} ${h.material} at ${place(h)}`);
  }
}

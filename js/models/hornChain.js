import * as THREE from 'three';
import { materials as M } from './lib/materials.js';
import { box, crenellationGeometry, cylinder, cylinderGeometry, flag, groundPlane, mesh } from './lib/primitives.js';
import { finalizeModel } from './lib/merge.js';
import { mapStone } from './lib/mapWalls.js';
import { CHAIN_NORTH, CHAIN_SOUTH, LAND_HEIGHT } from '../data/geography.js';

/**
 * The great chain of the Golden Horn: iron links floated on timber baulks,
 * stretched in wartime from the Kastellion of Galata to the Tower of
 * Eugenius below the Acropolis.
 *
 * Detail: a compressed span between the two towers, the floats bobbing on
 * the swell. Map: the chain across the mouth of the Horn (absolute).
 */
export function createHornChain({ lod = 'detail' } = {}) {
  return lod === 'detail' ? createSpan() : createMapChain();
}

// ---------- detail ----------

const LEFT_ANCHOR = new THREE.Vector3(-72, 3.2, 0);
const RIGHT_ANCHOR = new THREE.Vector3(74, 3.2, 0);
const LINK_SPACING = 0.72;

function createSpan() {
  const scene = new THREE.Group();
  scene.add(groundPlane(280, 150, M.water, 0, 0, 0));

  // Kastellion of Galata (left) and the Tower of Eugenius (right).
  for (const [x, size, height, baseX] of [[-84, 18, 26, -92], [84, 14, 22, 92]]) {
    scene.add(box(46, 5, 70, M.stoneDark, baseX, -3, 0));
    scene.add(box(size, height, size, M.banded, x, 2, 0));
    for (const side of [-1, 1]) {
      scene.add(mesh(crenellationGeometry(size), M.banded, x, height + 2, side * (size / 2 - 0.35)));
      const flank = mesh(crenellationGeometry(size - 1.4), M.banded, x + side * (size / 2 - 0.35), height + 2, 0);
      flank.rotation.y = Math.PI / 2;
      scene.add(flank);
    }
  }
  // Windlass for hauling the chain taut.
  scene.add(box(9, 4, 10, M.wood, -68, 2, -10));
  const drum = cylinder(1.2, 1.2, 6, M.wood, -68, 7.2, -13, 12);
  drum.rotation.x = Math.PI / 2;
  scene.add(drum);
  finalizeModel(scene);

  const flags = [[-84, 28], [84, 24]].map(([x, y]) => {
    const banner = flag('byzantine', { width: 3, height: 2, pole: 5 });
    banner.position.set(x, y, 0);
    return banner;
  });
  scene.add(...flags);

  scene.add(createFloatingChain());
  return scene;
}

function createFloatingChain() {
  const group = new THREE.Group();
  group.userData.dynamic = true;

  const floatGeometry = cylinderGeometry(0.75, 0.75, 6, 12).rotateX(Math.PI / 2).translate(0, 0, -3);
  const floats = [];
  for (let x = -60; x <= 64; x += 9.4) {
    const float = new THREE.Mesh(floatGeometry, M.wood);
    float.castShadow = true;
    float.position.set(x, 0.2, 0);
    group.add(float);
    floats.push(float);
  }

  const supportCount = floats.length + 2;
  const linksPerSpan = Math.ceil(12 / LINK_SPACING);
  const linkGeometry = new THREE.TorusGeometry(0.32, 0.085, 6, 12).scale(1.45, 1, 1);
  const capacity = (supportCount - 1) * linksPerSpan + 1;
  const links = new THREE.InstancedMesh(linkGeometry, M.iron, capacity);
  links.castShadow = true;
  links.frustumCulled = false;
  group.add(links);

  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const roll = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
  const scale = new THREE.Vector3(1, 1, 1);
  const xAxis = new THREE.Vector3(1, 0, 0);
  const point = new THREE.Vector3();
  const next = new THREE.Vector3();
  const direction = new THREE.Vector3();

  group.userData.animate = (time) => {
    for (const [i, float] of floats.entries()) {
      float.position.y = 0.2 + Math.sin(time * 1.4 + i * 0.7) * 0.18;
      float.rotation.x = Math.sin(time * 1.1 + i) * 0.05;
    }
    const supports = [LEFT_ANCHOR, ...floats.map((f) => new THREE.Vector3(f.position.x, f.position.y + 0.85, 0)), RIGHT_ANCHOR];
    let n = 0;
    for (let s = 0; s < supports.length - 1; s++) {
      const a = supports[s];
      const b = supports[s + 1];
      const count = Math.max(1, Math.round(a.distanceTo(b) / LINK_SPACING));
      const sag = Math.min(0.9, a.distanceTo(b) * 0.06);
      const at = (t, target) => target.lerpVectors(a, b, t).setY(a.y + (b.y - a.y) * t - sag * 4 * t * (1 - t));
      for (let k = 0; k < count && n < capacity; k++) {
        at(k / count, point);
        at((k + 1) / count, next);
        direction.subVectors(next, point).normalize();
        quaternion.setFromUnitVectors(xAxis, direction);
        if (n % 2) quaternion.multiply(roll);
        matrix.compose(point, quaternion, scale);
        links.setMatrixAt(n++, matrix);
      }
    }
    links.count = n;
    links.instanceMatrix.needsUpdate = true;
  };
  group.userData.animate(0);
  return group;
}

// ---------- map ----------

function createMapChain() {
  const chain = new THREE.Group();
  const south = new THREE.Vector3(CHAIN_SOUTH[0], 0.05, -CHAIN_SOUTH[1]);
  const north = new THREE.Vector3(CHAIN_NORTH[0], 0.05, -CHAIN_NORTH[1]);

  const points = [];
  for (let i = 0; i <= 16; i++) points.push(new THREE.Vector3().lerpVectors(south, north, i / 16));
  chain.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 64, 0.045, 5), M.iron));
  const direction = Math.atan2(north.z - south.z, north.x - south.x);
  for (let i = 1; i < 12; i++) {
    const float = box(0.12, 0.08, 0.36, M.wood);
    float.position.lerpVectors(south, north, i / 12).setY(0);
    float.rotation.y = -direction;
    chain.add(float);
  }

  // Tower of Eugenius (south) and the Kastellion of Galata (north).
  chain.add(box(0.6, 1.0, 0.6, mapStone, CHAIN_SOUTH[0] + 0.3, LAND_HEIGHT, -(CHAIN_SOUTH[1] - 0.6)));
  chain.add(box(0.85, 1.3, 0.85, mapStone, CHAIN_NORTH[0] - 0.1, LAND_HEIGHT, -(CHAIN_NORTH[1] + 0.6)));
  return finalizeModel(chain);
}

import * as THREE from 'three';
import { materials as M } from './lib/materials.js';
import { archGeometry, box, crenellationGeometry, cylinder, cylinderGeometry, flag, groundPlane, mesh } from './lib/primitives.js';
import { finalizeModel } from './lib/merge.js';
import { mapStone } from './lib/mapWalls.js';
import { CHAIN_NORTH, CHAIN_SOUTH, LAND_HEIGHT } from '../data/geography.js';

/**
 * The great chain of the Golden Horn, first stretched by Leo III in 717:
 * wrought-iron links some two feet long, joined every seven links by hooks
 * to the heavy logs that floated it, and in wartime drawn across the mouth
 * of the Horn from the Kastellion of Galata — a Byzantine fort of 50 × 40 m
 * on the north shore, whose tower held the windlass — to the Tower of
 * Eugenios (the Kentenarion) at the foot of the Acropolis, where the sea
 * wall turns. Surviving links are shown in Istanbul's museums.
 *
 * Detail: a compressed span between the two ends, the logs riding the
 * swell. Map: the chain across the mouth of the Horn (absolute).
 */
export function createHornChain({ lod = 'detail' } = {}) {
  return lod === 'detail' ? createSpan() : createMapChain();
}

// ---------- detail ----------

const LEFT_ANCHOR = new THREE.Vector3(-67.5, 2.6, 0);
const RIGHT_ANCHOR = new THREE.Vector3(84.5, 2.6, 0);
const LINK_LENGTH = 0.62; // "approximately two foot long"
const LINKS_PER_SECTION = 7;
const LOG_LENGTH = 9;

function createSpan() {
  const scene = new THREE.Group();
  scene.add(groundPlane(280, 150, M.water, 0, 0, 0));
  addKastellion(scene, -96);
  addEugeniosTower(scene, 92);
  finalizeModel(scene);

  for (const [x, y, z] of [[-86, 29, 0], [92, 26, 0]]) {
    const banner = flag('byzantine', { width: 3, height: 2, pole: 5 });
    banner.position.set(x, y, z);
    scene.add(banner);
  }
  scene.add(createFloatingChain());
  return scene;
}

/** The Kastellion of Galata: a rectangular fort with corner turrets and the chain tower on its seaward face. */
function addKastellion(scene, cx) {
  scene.add(box(66, 5, 80, M.stoneDark, cx - 3, -3, 0));
  scene.add(box(58, 0.3, 72, M.grass, cx - 5, 2, 0));
  const [w, d, h] = [40, 32, 12];
  scene.add(box(w, h, d, M.banded, cx, 2, 0));
  scene.add(box(w - 4, 1.2, d - 4, M.paving, cx, 2 + h - 0.6, 0)); // the wall-walk's court
  for (const side of [-1, 1]) {
    scene.add(mesh(crenellationGeometry(w), M.banded, cx, 2 + h, side * (d / 2 - 0.35)));
    const flank = mesh(crenellationGeometry(d), M.banded, cx + side * (w / 2 - 0.35), 2 + h, 0);
    flank.rotation.y = Math.PI / 2;
    scene.add(flank);
  }
  for (const [dx, dz] of [[-1, -1], [-1, 1], [1, 1], [1, -1]]) {
    const [tx, tz] = [cx + dx * (w / 2 - 1), dz * (d / 2 - 1)];
    scene.add(cylinder(4, 4, h + 5, M.banded, tx, 2, tz, 12));
    scene.add(cylinder(4.6, 4.6, 1.4, M.banded, tx, 2 + h + 4, tz, 12));
  }
  // The chain tower at the seaward corner: taller, with the windlass drum on its open top.
  const [tx, tz] = [cx + w / 2 + 1, -2];
  scene.add(box(14, 24, 14, M.banded, tx, 2, tz));
  for (const side of [-1, 1]) {
    scene.add(mesh(crenellationGeometry(14), M.banded, tx, 26, tz + side * 6.65));
    const flank = mesh(crenellationGeometry(14), M.banded, tx + side * 6.65, 26, tz);
    flank.rotation.y = Math.PI / 2;
    scene.add(flank);
  }
  scene.add(mesh(archGeometry(2.4, 3.6), M.opening, tx + 7.02, 2, 0));
  for (const y of [10, 17]) {
    const slit = mesh(archGeometry(0.7, 2.2), M.opening, tx + 7.02, y, tz);
    slit.rotation.y = Math.PI / 2;
    scene.add(slit);
  }
  // The chain's iron ring on the face of the tower, and the windlass with its bars.
  scene.add(mesh(new THREE.TorusGeometry(1, 0.22, 6, 14), M.iron, tx + 7.1, 2.6, 0));
  const drum = cylinder(1.4, 1.4, 8, M.wood, tx, 29, tz, 12);
  drum.rotation.x = Math.PI / 2;
  scene.add(drum);
  for (const z of [-4.5, 0.5]) scene.add(box(1.2, 3.2, 1.2, M.wood, tx, 26, tz + z));
  for (const angle of [0, Math.PI / 3, (2 * Math.PI) / 3]) {
    const bar = box(7, 0.3, 0.3, M.wood, tx, 29, tz + 4.2);
    bar.rotation.z = angle;
    scene.add(bar);
  }
  // A stretch of the shore wall running on from the fort.
  scene.add(box(3, 8, 30, M.banded, cx - w / 2 - 1.5, 2, -31));
}

/** The Tower of Eugenios, where the sea wall of the Acropolis turns the point. */
function addEugeniosTower(scene, cx) {
  scene.add(box(36, 5, 80, M.stoneDark, cx + 11, -3, 0));
  scene.add(box(28, 0.3, 72, M.grass, cx + 15, 2, 0));
  scene.add(box(14, 22, 14, M.banded, cx, 2, 0));
  for (const side of [-1, 1]) {
    scene.add(mesh(crenellationGeometry(14), M.banded, cx, 24, side * 6.65));
    const flank = mesh(crenellationGeometry(14), M.banded, cx + side * 6.65, 24, 0);
    flank.rotation.y = Math.PI / 2;
    scene.add(flank);
  }
  const ring = mesh(new THREE.TorusGeometry(1, 0.22, 6, 14), M.iron, cx - 7.1, 2.6, 0);
  ring.rotation.y = Math.PI / 2;
  scene.add(ring);
  for (const y of [9, 16]) {
    const slit = mesh(archGeometry(0.7, 2.2), M.opening, cx - 7.02, y, 0);
    slit.rotation.y = -Math.PI / 2;
    scene.add(slit);
  }
  // The sea wall runs away from the tower in both directions, with a smaller tower beyond.
  for (const side of [-1, 1]) {
    scene.add(box(3.2, 11, 30, M.banded, cx + 3, 2, side * 22));
    const parapet = mesh(crenellationGeometry(30), M.banded, cx + 1.9, 13, side * 22);
    parapet.rotation.y = Math.PI / 2;
    scene.add(parapet);
    scene.add(box(9, 16, 9, M.banded, cx + 3, 2, side * 38));
  }
}

function createFloatingChain() {
  const group = new THREE.Group();
  group.userData.dynamic = true;

  // The logs: squared timber baulks lying along the chain, with an iron hook at each end.
  const logGeometry = cylinderGeometry(0.7, 0.7, LOG_LENGTH, 8).rotateZ(Math.PI / 2);
  const hookGeometry = new THREE.TorusGeometry(0.4, 0.1, 5, 10);
  const section = LINKS_PER_SECTION * LINK_LENGTH;
  const logs = [];
  const span = RIGHT_ANCHOR.x - LEFT_ANCHOR.x;
  const count = Math.floor((span - section) / (LOG_LENGTH + section));
  const start = LEFT_ANCHOR.x + (span - count * (LOG_LENGTH + section) + section) / 2 + LOG_LENGTH / 2;
  for (let i = 0; i < count; i++) {
    const log = new THREE.Mesh(logGeometry, M.wood);
    log.castShadow = true;
    log.position.set(start + i * (LOG_LENGTH + section), 0.1, 0);
    for (const side of [-1, 1]) log.add(mesh(hookGeometry, M.iron, side * (LOG_LENGTH / 2 + 0.3), 0.3, 0));
    group.add(log);
    logs.push(log);
  }

  const linkGeometry = new THREE.TorusGeometry(0.2, 0.08, 6, 12).scale(LINK_LENGTH / 0.4, 1, 1);
  const capacity = (count + 1) * (LINKS_PER_SECTION + 6) + 8;
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
  const hookAt = (log, side, target) => target.set(log.position.x + side * (LOG_LENGTH / 2 + 0.6), log.position.y + 0.3 - side * Math.sin(log.rotation.z) * 4.5, 0);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();

  group.userData.animate = (time) => {
    for (const [i, log] of logs.entries()) {
      log.position.y = 0.1 + Math.sin(time * 1.3 + i * 0.9) * 0.14;
      log.rotation.z = Math.sin(time * 0.8 + i * 1.7) * 0.03;
      log.rotation.x = Math.sin(time * 1.1 + i) * 0.06;
    }
    let n = 0;
    for (let s = 0; s <= logs.length; s++) {
      if (s === 0) a.copy(LEFT_ANCHOR); else hookAt(logs[s - 1], 1, a);
      if (s === logs.length) b.copy(RIGHT_ANCHOR); else hookAt(logs[s], -1, b);
      const steps = Math.max(1, Math.round(a.distanceTo(b) / (LINK_LENGTH * 0.85)));
      const sag = Math.min(1.2, a.distanceTo(b) * 0.05);
      const at = (t, target) => target.lerpVectors(a, b, t).setY(a.y + (b.y - a.y) * t - sag * 4 * t * (1 - t));
      for (let k = 0; k < steps && n < capacity; k++) {
        at((k + 0.5) / steps, point);
        at((k + 1.5) / steps, next);
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

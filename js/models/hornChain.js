import * as THREE from 'three';
import { materials as M } from './lib/materials.js';
import { archGeometry, box, crenellationGeometry, cylinder, cylinderGeometry, flag, groundPlane, mesh } from './lib/primitives.js';
import { finalizeModel } from './lib/merge.js';
import { labelAt } from './lib/parts.js';
import { CHAIN_NORTH, CHAIN_SOUTH, LAND_HEIGHT, METERS_TO_MAP } from '../data/geography.js';

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
 * swell. Map: the chain across the mouth of the Horn (absolute), its logs
 * and the two forts at its ends in brief.
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
  addKastellion(scene, -96, true);
  addEugeniosTower(scene, 92, true);
  // The fort's label sits low on its walls, clear of the chain tower's label above.
  labelAt(scene, 'kastellion', -108, 10, 8);
  labelAt(scene, 'windlassTower', -75, 31.5, -2);
  labelAt(scene, 'eugeniosTower', 92, 25, 0);
  labelAt(scene, 'chain', 8, 3, 0);
  finalizeModel(scene);

  for (const [x, y, z] of [[-86, 29, 0], [92, 26, 0]]) {
    const banner = flag('byzantine', { width: 3, height: 2, pole: 5 });
    banner.position.set(x, y, z);
    scene.add(banner);
  }
  scene.add(createFloatingChain());
  return scene;
}

/**
 * The Kastellion of Galata: a rectangular fort with corner turrets and the
 * chain tower on its seaward face (+x), standing 2 m up on its platform.
 * The map leaves out the platform, the shore wall and the small ironwork.
 */
function addKastellion(scene, cx, detail) {
  const segments = detail ? 12 : 8;
  if (detail) {
    scene.add(box(66, 5, 80, M.stoneDark, cx - 3, -3, 0));
    scene.add(box(58, 0.3, 72, M.grass, cx - 5, 2, 0));
  }
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
    scene.add(cylinder(4, 4, h + 5, M.banded, tx, 2, tz, segments));
    scene.add(cylinder(4.6, 4.6, 1.4, M.banded, tx, 2 + h + 4, tz, segments));
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
  // The windlass drum on the tower's open top.
  const drum = cylinder(1.4, 1.4, 8, M.wood, tx, 29, tz, segments);
  drum.rotation.x = Math.PI / 2;
  scene.add(drum);
  for (const z of [-4.5, 0.5]) scene.add(box(1.2, 3.2, 1.2, M.wood, tx, 26, tz + z));
  if (!detail) return;
  const door = mesh(archGeometry(2.4, 3.6), M.opening, tx + 7.02, 2, 0);
  door.rotation.y = Math.PI / 2;
  scene.add(door);
  for (const y of [10, 17]) {
    const slit = mesh(archGeometry(0.7, 2.2), M.opening, tx + 7.02, y, tz);
    slit.rotation.y = Math.PI / 2;
    scene.add(slit);
  }
  // The chain's iron ring on the face of the tower, and the windlass bars.
  scene.add(mesh(new THREE.TorusGeometry(1, 0.22, 6, 14), M.iron, tx + 7.1, 2.6, 0));
  for (const angle of [0, Math.PI / 3, (2 * Math.PI) / 3]) {
    const bar = box(7, 0.3, 0.3, M.wood, tx, 29, tz + 4.2);
    bar.rotation.z = angle;
    scene.add(bar);
  }
  // A stretch of the shore wall running on from the fort.
  scene.add(box(3, 8, 30, M.banded, cx - w / 2 - 1.5, 2, -31));
}

/**
 * The Tower of Eugenios, where the sea wall of the Acropolis turns the point;
 * the chain hangs from its -x face. The map (whose own sea wall runs past it)
 * keeps the tower alone.
 */
function addEugeniosTower(scene, cx, detail) {
  if (detail) {
    scene.add(box(36, 5, 80, M.stoneDark, cx + 11, -3, 0));
    scene.add(box(28, 0.3, 72, M.grass, cx + 15, 2, 0));
  }
  scene.add(box(14, 22, 14, M.banded, cx, 2, 0));
  for (const side of [-1, 1]) {
    scene.add(mesh(crenellationGeometry(14), M.banded, cx, 24, side * 6.65));
    const flank = mesh(crenellationGeometry(14), M.banded, cx + side * 6.65, 24, 0);
    flank.rotation.y = Math.PI / 2;
    scene.add(flank);
  }
  if (!detail) return;
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

const MAP_LOGS = 14;
const KASTELLION_SCALE = 5.5 * METERS_TO_MAP;
const EUGENIOS_SCALE = 5 * METERS_TO_MAP;

function createMapChain() {
  const chain = new THREE.Group();
  const south = new THREE.Vector3(CHAIN_SOUTH[0], 0.06, -CHAIN_SOUTH[1]);
  const north = new THREE.Vector3(CHAIN_NORTH[0], 0.06, -CHAIN_NORTH[1]);

  // The forts at either end stand where the map has always had them: the Kastellion of
  // Galata with its chain tower facing the Horn's mouth, and the Tower of Eugenios across it.
  const kastellion = new THREE.Vector3(CHAIN_NORTH[0] - 0.1, LAND_HEIGHT, -(CHAIN_NORTH[1] + 0.6));
  const eugenios = new THREE.Vector3(CHAIN_SOUTH[0] + 0.3, LAND_HEIGHT, -(CHAIN_SOUTH[1] - 0.6));
  const headingFrom = (from, to) => Math.atan2(-(to.z - from.z), to.x - from.x); // turns local +x from → to
  const stand = (build, scale, at, heading) => {
    const fort = new THREE.Group();
    build(fort, 0, false);
    fort.scale.setScalar(scale);
    fort.position.copy(at).setY(LAND_HEIGHT - 2 * scale); // the forts are built standing 2 m up on their platforms
    fort.rotation.y = heading;
    chain.add(fort);
  };
  // Both face each other across the water: the Kastellion's chain tower on its +x side, the ring of Eugenios on its -x face.
  const heading = headingFrom(kastellion, eugenios);
  stand((fort, cx, detail) => addKastellion(fort, cx - 21, detail), KASTELLION_SCALE, kastellion, heading);
  stand(addEugeniosTower, EUGENIOS_SCALE, eugenios, heading);
  // The fort's body reaches inland behind its chain tower; keep the map's houses out of it.
  const inland = new THREE.Vector3().subVectors(kastellion, eugenios).setY(0).normalize().multiplyScalar(21 * KASTELLION_SCALE);
  chain.userData.keepOut = [[kastellion.x + inland.x, -(kastellion.z + inland.z), 1.45], [eugenios.x, -eugenios.z, 0.55]];

  // The chain climbs from each tower's ring down to the water at the shore, then rides
  // across on its logs, dipping between them.
  const ringOn = (fort, scale, other) => fort.clone().lerp(other, (7 * scale) / fort.distanceTo(other)).setY(LAND_HEIGHT + 0.6 * scale);
  const points = [ringOn(eugenios, EUGENIOS_SCALE, kastellion)];
  for (let i = 0; i <= MAP_LOGS * 2; i++) {
    const point = new THREE.Vector3().lerpVectors(south, north, i / (MAP_LOGS * 2));
    if (i % 2 === 0 && i > 0 && i < MAP_LOGS * 2) point.y = 0.015;
    points.push(point);
  }
  points.push(ringOn(kastellion, KASTELLION_SCALE, eugenios));
  chain.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), MAP_LOGS * 8 + 16, 0.03, 5), M.iron));
  const direction = Math.atan2(north.z - south.z, north.x - south.x);
  const log = cylinderGeometry(0.035, 0.035, 0.42, 6).rotateZ(Math.PI / 2);
  for (let i = 0; i < MAP_LOGS; i++) {
    const float = mesh(log, M.wood);
    float.position.lerpVectors(south, north, (i + 0.5) / MAP_LOGS).setY(0.02);
    float.rotation.y = -direction;
    chain.add(float);
  }
  return finalizeModel(chain);
}

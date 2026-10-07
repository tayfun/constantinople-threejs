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
 * The links follow the sections in the Naval and Military Museums: long,
 * hand-forged loops of thick bar with a pinched waist, each turned a
 * quarter-turn to the next. Following Kastenellos ("The Golden Horn Chain",
 * 2017), the chain is drawn as a chain-linked boom: sections of seven links
 * hooked nose to tail to long, heavy logs.
 *
 * Detail: a compressed span between the two ends, the logs riding the
 * swell; the links are drawn six times life size, or they would vanish on
 * the stage. Map: the chain across the mouth of the Horn (absolute), its
 * links much enlarged, its logs and the two forts at its ends in brief.
 */
export function createHornChain({ lod = 'detail' } = {}) {
  return lod === 'detail' ? createSpan() : createMapChain();
}

// ---------- detail ----------

// The forts stand much closer than the real 750 m, so the chain fills the stage.
const KASTELLION_X = -66;
const EUGENIOS_X = 56;
const STAGE = [210, 120]; // the water, and the shores that run off its two ends: a slice of the Horn's mouth
const LEFT_ANCHOR = new THREE.Vector3(KASTELLION_X + 28.5, 2.6, 0);
const RIGHT_ANCHOR = new THREE.Vector3(EUGENIOS_X - 7.5, 2.6, 0);
const LINK_LENGTH = 0.62 * 6; // "approximately two foot long", drawn six times life size
const LINK_WIDTH = 1.5;
const LINK_BAR = 0.26;
const LINK_PITCH = LINK_LENGTH - 3.2 * LINK_BAR; // each link reaches into the next
const LINKS_PER_SECTION = 7;
const LOG_LENGTH = 10;
const LOG_RADIUS = 0.9;
const HOOK_RISE = 1.0; // the hooks stand this far above a log's axis, so the chain rides at the waterline

/**
 * One hand-forged link, lying along x: a long loop of round bar with
 * straightish sides drawn in at a waist, as on the surviving sections.
 */
function linkGeometry(length, width, bar) {
  const points = [];
  const count = 24;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const c = Math.cos(angle);
    const sn = Math.sin(angle);
    const x = (length / 2 - bar) * Math.sign(c) * Math.abs(c) ** 0.6;
    const waist = 0.62 + 0.38 * Math.abs(c) ** 0.5;
    points.push(new THREE.Vector3(x, 0, (width / 2 - bar) * sn * waist));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, true), 40, bar, 6, true);
}

function createSpan() {
  const scene = new THREE.Group();
  scene.add(groundPlane(...STAGE, M.water, 0, 0, 0));
  addKastellion(scene, KASTELLION_X, true);
  addEugeniosTower(scene, EUGENIOS_X, true);
  // The fort's label sits low on its walls, clear of the chain tower's label above.
  labelAt(scene, 'kastellion', KASTELLION_X - 12, 10, 8);
  labelAt(scene, 'windlassTower', KASTELLION_X + 21, 31.5, -2);
  labelAt(scene, 'eugeniosTower', EUGENIOS_X, 25, 0);
  labelAt(scene, 'chain', (LEFT_ANCHOR.x + RIGHT_ANCHOR.x) / 2, 4, 0);
  finalizeModel(scene);

  // Banners on the cap of the Kastellion's landward corner turret and on the roof of the Tower of Eugenios.
  for (const [x, y, z] of [[KASTELLION_X - 19, 19.4, -15], [EUGENIOS_X, 24, 0]]) {
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
    // The Galata shore, from its quay wall to the stage's far end.
    const [edge, shore] = [-STAGE[0] / 2, cx + 30];
    scene.add(box(shore - edge, 5, STAGE[1], M.stoneDark, (edge + shore) / 2, -3, 0));
    scene.add(box(shore - 4 - edge, 0.3, STAGE[1], M.grass, (edge + shore - 4) / 2, 2, 0));
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
    // The Acropolis point, from the tower's foot to the stage's far end.
    const [shore, edge] = [cx - 7, STAGE[0] / 2];
    scene.add(box(edge - shore, 5, STAGE[1], M.stoneDark, (shore + edge) / 2, -3, 0));
    scene.add(box(edge - shore - 8, 0.3, STAGE[1], M.grass, (shore + 8 + edge) / 2, 2, 0));
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

  // The logs: heavy round trunks bound with iron straps, an iron eye at each end for the chain's hook.
  const logGeometry = cylinderGeometry(LOG_RADIUS, LOG_RADIUS, LOG_LENGTH, 10).translate(0, -LOG_LENGTH / 2, 0).rotateZ(Math.PI / 2); // centred on the log's middle
  const strapGeometry = new THREE.TorusGeometry(LOG_RADIUS + 0.04, 0.07, 4, 16).rotateY(Math.PI / 2);
  const eyeGeometry = new THREE.TorusGeometry(0.6, 0.17, 6, 12);
  const section = (LINKS_PER_SECTION - 1) * LINK_PITCH + LINK_LENGTH;
  const logs = [];
  const span = RIGHT_ANCHOR.x - LEFT_ANCHOR.x;
  const count = Math.floor((span - section) / (LOG_LENGTH + section));
  const start = LEFT_ANCHOR.x + (span - count * (LOG_LENGTH + section) + section) / 2 + LOG_LENGTH / 2;
  for (let i = 0; i < count; i++) {
    const log = new THREE.Mesh(logGeometry, M.wood);
    log.castShadow = true;
    log.position.set(start + i * (LOG_LENGTH + section), 0, 0);
    for (const side of [-1, 1]) {
      log.add(mesh(strapGeometry, M.iron, side * (LOG_LENGTH / 2 - 0.8), 0, 0));
      log.add(box(1.1, HOOK_RISE, 0.4, M.iron, side * (LOG_LENGTH / 2 - 0.2), 0.1, 0)); // the strap carrying the eye
      log.add(mesh(eyeGeometry, M.iron, side * (LOG_LENGTH / 2 + 0.25), HOOK_RISE + 0.1, 0));
    }
    group.add(log);
    logs.push(log);
  }

  const capacity = Math.ceil(span / LINK_PITCH) + 40;
  const links = new THREE.InstancedMesh(linkGeometry(LINK_LENGTH, LINK_WIDTH, LINK_BAR), M.iron, capacity);
  links.castShadow = true;
  links.frustumCulled = false;
  group.add(links);

  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const roll = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
  const scale = new THREE.Vector3(1, 1, 1);
  const xAxis = new THREE.Vector3(1, 0, 0);
  const point = new THREE.Vector3();
  const previous = new THREE.Vector3();
  const next = new THREE.Vector3();
  const direction = new THREE.Vector3();
  const hookAt = (log, side, target) => target.set(
    log.position.x + side * (LOG_LENGTH / 2 + 0.7),
    log.position.y + HOOK_RISE + 0.1 + side * Math.sin(log.rotation.z) * (LOG_LENGTH / 2),
    0,
  );
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();

  group.userData.animate = (time) => {
    for (const [i, log] of logs.entries()) {
      log.position.y = Math.sin(time * 1.3 + i * 0.9) * 0.14;
      log.rotation.z = Math.sin(time * 0.8 + i * 1.7) * 0.03;
      log.rotation.x = Math.sin(time * 1.1 + i) * 0.06;
    }
    // Each stretch of chain hangs in a shallow curve between its two hooks, link after link,
    // every other one turned a quarter-turn about the chain.
    let n = 0;
    for (let s = 0; s <= logs.length; s++) {
      if (s === 0) a.copy(LEFT_ANCHOR); else hookAt(logs[s - 1], 1, a);
      if (s === logs.length) b.copy(RIGHT_ANCHOR); else hookAt(logs[s], -1, b);
      const steps = Math.max(1, Math.round((a.distanceTo(b) - LINK_LENGTH) / LINK_PITCH) + 1);
      const sag = Math.min(0.35, a.distanceTo(b) * 0.02);
      const at = (t, target) => target.lerpVectors(a, b, t).setY(a.y + (b.y - a.y) * t - sag * 4 * t * (1 - t));
      const inset = LINK_LENGTH / 2 / a.distanceTo(b);
      for (let k = 0; k < steps && n < capacity; k++) {
        const t = steps === 1 ? 0.5 : inset + (k / (steps - 1)) * (1 - 2 * inset);
        at(t, point);
        at(Math.max(0, t - 0.005), previous);
        at(Math.min(1, t + 0.005), next);
        direction.subVectors(next, previous).normalize();
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

const MAP_LOGS = 4;
const MAP_LOG_LENGTH = 0.3;
const MAP_LINK = { length: 0.28, width: 0.12, bar: 0.026 }; // some fifty times life size, to read on the map
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

  // The chain climbs from each tower's ring down to the water at the shore, then crosses as a
  // boom: stretches of links between logs set at even intervals, hooked to them end to end.
  const ringOn = (fort, scale, other) => fort.clone().lerp(other, (7 * scale) / fort.distanceTo(other)).setY(LAND_HEIGHT + 0.6 * scale);
  const water = (point) => point.clone().setY(0.03);
  const route = new THREE.CurvePath();
  const stops = [ringOn(eugenios, EUGENIOS_SCALE, kastellion), water(south), water(north), ringOn(kastellion, KASTELLION_SCALE, eugenios)];
  for (let i = 1; i < stops.length; i++) route.add(new THREE.LineCurve3(stops[i - 1], stops[i]));
  const total = route.getLength();
  const [toShore, across] = [stops[0].distanceTo(stops[1]), stops[1].distanceTo(stops[2])];
  const gap = (across - MAP_LOGS * MAP_LOG_LENGTH) / (MAP_LOGS + 1);
  const logs = Array.from({ length: MAP_LOGS }, (_, i) => toShore + gap * (i + 1) + MAP_LOG_LENGTH * i); // where each log starts, along the route
  const onLog = (d) => logs.some((start) => d > start - MAP_LINK.length / 2 && d < start + MAP_LOG_LENGTH + MAP_LINK.length / 2);

  const linkShape = linkGeometry(MAP_LINK.length, MAP_LINK.width, MAP_LINK.bar);
  const pitch = MAP_LINK.length - 3.2 * MAP_LINK.bar;
  const xAxis = new THREE.Vector3(1, 0, 0);
  for (let d = MAP_LINK.length / 2, n = 0; d < total - MAP_LINK.length / 2; d += pitch) {
    if (onLog(d)) continue;
    const link = mesh(linkShape, M.iron);
    link.position.copy(route.getPointAt(d / total));
    link.quaternion.setFromUnitVectors(xAxis, route.getTangentAt(d / total));
    if (n++ % 2) link.rotateX(Math.PI / 2);
    chain.add(link);
  }
  const along = Math.atan2(north.z - south.z, north.x - south.x);
  const log = cylinderGeometry(0.05, 0.05, MAP_LOG_LENGTH, 8).translate(0, -MAP_LOG_LENGTH / 2, 0).rotateZ(Math.PI / 2);
  for (const start of logs) {
    const float = mesh(log, M.wood);
    float.position.copy(route.getPointAt((start + MAP_LOG_LENGTH / 2) / total)).setY(0.025);
    float.rotation.y = -along;
    chain.add(float);
  }
  return finalizeModel(chain);
}

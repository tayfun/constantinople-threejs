import * as THREE from 'three';
import { box, cylinder, mesh } from './primitives.js';

/** Small figurative pieces: horses, chariots and eagles. All face +x. */

const sphere = new THREE.SphereGeometry(1, 14, 10);

/** A stylised horse about 2.2 m long, hooves at y = 0. */
export function createHorse(material, { rearing = false } = {}) {
  const horse = new THREE.Group();
  const body = mesh(sphere, material, 0, 1.3, 0);
  body.scale.set(0.85, 0.36, 0.3);
  const neck = cylinder(0.17, 0.26, 0.95, material, 0.62, 1.38, 0, 8);
  neck.rotation.z = -0.62;
  const head = box(0.6, 0.24, 0.22, material, 1.1, 1.85, 0);
  head.rotation.z = -0.5;
  const tail = cylinder(0.04, 0.09, 0.8, material, -0.82, 0.62, 0, 6);
  tail.rotation.z = 0.35;
  horse.add(body, neck, head, tail);
  for (const [x, z] of [[0.55, 0.16], [0.55, -0.16], [-0.55, 0.16], [-0.55, -0.16]]) {
    const leg = cylinder(0.06, 0.08, 1.1, material, x, 0, z, 6);
    if (rearing && x > 0) {
      leg.position.y = 0.45;
      leg.rotation.z = 1.0;
    }
    horse.add(leg);
  }
  return horse;
}

/** A racing chariot with its team of four and a driver in faction colours. */
export function createChariot({ horseMaterial, carMaterial, colorMaterial }) {
  const chariot = new THREE.Group();
  for (const z of [-0.9, -0.3, 0.3, 0.9]) {
    const horse = createHorse(horseMaterial);
    horse.position.set(1.6, 0, z);
    horse.scale.setScalar(0.9);
    chariot.add(horse);
  }
  // Open-backed car, curved towards the horses.
  chariot.add(cylinder(0.75, 0.75, 1.0, carMaterial, -0.4, 0.35, 0, 12, { thetaStart: 0, thetaLength: Math.PI }));
  for (const z of [-0.75, 0.65]) {
    const wheel = cylinder(0.55, 0.55, 0.1, carMaterial, -0.4, 0.55, z, 12);
    wheel.rotation.x = Math.PI / 2;
    chariot.add(wheel);
  }
  // The charioteer, in his faction's colour.
  chariot.add(cylinder(0.22, 0.25, 0.9, colorMaterial, -0.5, 0.75, 0, 8));
  const head = mesh(sphere, colorMaterial, -0.5, 1.8, 0);
  head.scale.setScalar(0.17);
  chariot.add(head);
  return chariot;
}

/** An eagle with flapping wings, wingspan about 2.2 m. */
export function createEagle(featherMaterial, beakMaterial, headMaterial) {
  const eagle = new THREE.Group();
  const body = mesh(sphere, featherMaterial);
  body.scale.set(0.55, 0.17, 0.2);
  const head = mesh(sphere, headMaterial, 0.55, 0.08, 0);
  head.scale.setScalar(0.13);
  const beak = cylinder(0.0, 0.06, 0.16, beakMaterial, 0.7, 0.06, 0, 6);
  beak.rotation.z = -Math.PI / 2;
  const tail = box(0.4, 0.04, 0.32, featherMaterial, -0.6, 0, 0);
  eagle.add(body, head, beak, tail);

  const wings = [-1, 1].map((side) => {
    const pivot = new THREE.Group();
    pivot.position.set(0.05, 0.05, 0.12 * side);
    const wing = box(0.5, 0.03, 1.05, featherMaterial, 0, 0, 0.52 * side);
    const tip = box(0.32, 0.03, 0.4, featherMaterial, -0.08, 0, 1.2 * side);
    pivot.add(wing, tip);
    eagle.add(pivot);
    return { pivot, side };
  });

  const phase = Math.random() * 10;
  eagle.userData.animate = (time) => {
    const flap = Math.sin(time * 5 + phase);
    const glide = Math.max(0, Math.sin(time * 0.6 + phase));
    for (const { pivot, side } of wings) pivot.rotation.x = side * (0.15 + flap * 0.55 * (1 - glide));
  };
  return eagle;
}

// ---------- marble beasts ----------

const UP = new THREE.Vector3(0, 1, 0);

/** A rounded mass (haunch, chest, mane): the unit sphere scaled to radii (rx, ry, rz). */
function blob(material, x, y, z, rx, ry, rz) {
  const result = mesh(sphere, material, x, y, z);
  result.scale.set(rx, ry, rz);
  return result;
}

/** A tapered limb from point a to point b, radius ra at a and rb at b, with rounded ends. */
function limb(material, a, b, ra, rb, segments = 10) {
  const from = new THREE.Vector3(...a);
  const to = new THREE.Vector3(...b);
  const length = from.distanceTo(to);
  const shaft = mesh(new THREE.CylinderGeometry(rb, ra, length, segments), material);
  shaft.position.copy(from).lerp(to, 0.5);
  shaft.quaternion.setFromUnitVectors(UP, to.clone().sub(from).normalize());
  const group = new THREE.Group();
  group.add(shaft, blob(material, ...a, ra, ra, ra), blob(material, ...b, rb, rb, rb));
  return group;
}

/**
 * The seated marble lion of the Boukoleon harbour, after the one van
 * Millingen photographed (Byzantine Constantinople: The Walls, 1899), now in
 * the Istanbul Archaeological Museums: upright on its haunches on a rough
 * slab, forelegs straight, chest high, a heavy mane falling over the chest
 * and the head raised. About 2.4 m tall; faces +x. `turn` turns the head
 * (radians, towards +z).
 */
export function createSeatedLion(material, { turn = 0 } = {}) {
  const lion = new THREE.Group();
  lion.add(box(2.1, 0.3, 1.4, material, 0.05, 0, 0)); // the slab
  // Haunches, rump and the hind paws laid forward on the slab.
  for (const side of [-1, 1]) {
    lion.add(blob(material, -0.42, 0.72, side * 0.3, 0.5, 0.45, 0.28));
    lion.add(blob(material, 0.02, 0.38, side * 0.42, 0.32, 0.1, 0.13));
  }
  lion.add(blob(material, -0.62, 0.68, 0, 0.42, 0.42, 0.4));
  // The body rising steeply from the haunches to the chest.
  lion.add(limb(material, [-0.45, 0.75, 0], [0.22, 1.5, 0], 0.4, 0.42, 14));
  lion.add(blob(material, 0.34, 1.28, 0, 0.32, 0.5, 0.4));
  // Straight forelegs and broad paws.
  for (const side of [-1, 1]) {
    lion.add(limb(material, [0.38, 1.15, side * 0.2], [0.52, 0.42, side * 0.21], 0.14, 0.11));
    lion.add(blob(material, 0.6, 0.38, side * 0.21, 0.19, 0.09, 0.13));
  }
  // The tail curled forward along the slab beside the right haunch.
  lion.add(limb(material, [-0.95, 0.42, 0.22], [-0.55, 0.36, 0.52], 0.06, 0.05, 6));
  lion.add(limb(material, [-0.55, 0.36, 0.52], [0.05, 0.36, 0.6], 0.05, 0.07, 6));

  // Mane and head, turned as one: a heavy mane in long locks over the chest, the ears lost in it,
  // and the broad, flat face of the photographs.
  const head = new THREE.Group();
  head.position.set(0.35, 1.65, 0);
  head.rotation.y = -turn;
  head.add(blob(material, 0, 0.12, 0, 0.42, 0.55, 0.5)); // mane round the neck
  head.add(blob(material, 0.2, -0.2, 0, 0.24, 0.45, 0.36)); // locks falling over the chest
  for (const [y, z] of [[-0.28, 0.28], [-0.05, 0.4], [0.2, 0.42]]) {
    for (const side of [-1, 1]) {
      const lock = blob(material, 0.1, y, side * z, 0.12, 0.28, 0.1);
      lock.rotation.x = -side * 0.12; // hanging down against the neck, the tips flaring a little
      head.add(lock);
    }
  }
  head.add(blob(material, 0.3, 0.4, 0, 0.26, 0.27, 0.28)); // skull
  head.add(blob(material, 0.46, 0.5, 0, 0.09, 0.07, 0.24)); // brow
  head.add(blob(material, 0.53, 0.36, 0, 0.15, 0.15, 0.2)); // broad muzzle, raised
  head.add(blob(material, 0.66, 0.4, 0, 0.06, 0.06, 0.09)); // nose
  head.add(blob(material, 0.5, 0.22, 0, 0.12, 0.07, 0.14)); // jaw
  lion.add(head);
  return lion;
}

/**
 * The colossal group that named the Boukoleon, as Anna Komnene saw it
 * (Alexiad 3.1): "a lion seizing a bull — for he is clinging to the bull's
 * horn, pulling his head back, and has fixed his teeth in the bull's
 * throat". The bull, facing +x, sinks onto one foreleg with its head wrenched
 * up and back; the lion lies along its back on the +z side, one forepaw on
 * the horn, the other clawing the shoulder, its jaws at the throat. About
 * 2.8 m long and 2.3 m high, standing at y = 0.
 */
export function createLionAndBull(material) {
  const group = new THREE.Group();
  // The bull: a deep barrel, heavy shoulders and dewlap, its front sinking.
  const barrel = blob(material, 0, 1.05, 0, 1.0, 0.52, 0.42);
  barrel.rotation.z = -0.1;
  group.add(barrel);
  group.add(blob(material, 0.7, 1.1, 0, 0.48, 0.6, 0.45));
  group.add(blob(material, 0.95, 0.78, 0, 0.25, 0.3, 0.15)); // dewlap
  group.add(blob(material, -0.85, 1.15, 0, 0.4, 0.48, 0.4));
  // Hind legs braced back; one foreleg folded under at the knee, the other thrust forward.
  for (const side of [-1, 1]) {
    group.add(blob(material, -0.8, 0.88, side * 0.25, 0.3, 0.4, 0.17)); // thigh
    group.add(limb(material, [-0.9, 0.62, side * 0.25], [-1.05, 0.08, side * 0.26], 0.16, 0.11, 8));
  }
  group.add(limb(material, [0.8, 0.72, 0.24], [1.0, 0.18, 0.26], 0.18, 0.13, 8));
  group.add(limb(material, [1.0, 0.16, 0.26], [1.45, 0.11, 0.26], 0.13, 0.11, 8));
  group.add(limb(material, [0.8, 0.72, -0.24], [1.2, 0.1, -0.26], 0.18, 0.12, 8));
  group.add(limb(material, [-1.2, 1.35, 0], [-1.35, 0.55, 0.06], 0.05, 0.04, 6)); // tail
  // The thick neck, and the head wrenched up and back with its muzzle to the sky; the horns at the poll.
  group.add(limb(material, [1.0, 1.25, 0], [1.45, 1.85, 0.05], 0.38, 0.27, 12));
  const head = blob(material, 1.55, 2.2, 0.08, 0.18, 0.32, 0.2);
  head.rotation.z = 0.3;
  group.add(head);
  group.add(blob(material, 1.46, 2.5, 0.1, 0.17, 0.12, 0.18)); // muzzle
  for (const [z, out] of [[0.2, 1], [-0.04, -1]]) {
    group.add(limb(material, [1.66, 2.05, z], [1.78, 2.14, z + out * 0.25], 0.08, 0.05, 6));
    group.add(limb(material, [1.78, 2.14, z + out * 0.25], [1.96, 2.3, z + out * 0.3], 0.05, 0.025, 6));
  }

  // The lion on the bull's back: haunches over the rump, a deep chest and a great mane at the bull's neck.
  group.add(blob(material, -0.55, 1.72, 0.22, 0.34, 0.34, 0.28));
  group.add(limb(material, [-0.4, 1.8, 0.22], [0.3, 1.95, 0.24], 0.2, 0.25, 12));
  group.add(blob(material, 0.65, 1.98, 0.26, 0.36, 0.38, 0.33));
  group.add(blob(material, 1.05, 1.98, 0.3, 0.4, 0.5, 0.44)); // mane
  // One hind leg clasping the bull's flank, the other braced on the ground behind it.
  group.add(limb(material, [-0.45, 1.6, 0.42], [-0.3, 1.05, 0.5], 0.15, 0.1, 8));
  group.add(limb(material, [-0.7, 1.6, 0.35], [-1.0, 0.8, 0.6], 0.15, 0.11, 8));
  group.add(limb(material, [-1.0, 0.8, 0.6], [-0.85, 0.08, 0.65], 0.11, 0.1, 8));
  // A forepaw hooked over the horn, the other foreleg clawing down the bull's shoulder.
  group.add(limb(material, [0.85, 2.1, 0.42], [1.35, 2.45, 0.48], 0.15, 0.11, 8));
  group.add(limb(material, [1.35, 2.45, 0.48], [1.76, 2.17, 0.45], 0.11, 0.11, 8));
  group.add(limb(material, [0.7, 1.85, 0.5], [0.88, 1.2, 0.5], 0.15, 0.11, 8));
  // The head driven in under the bull's jaw, its teeth in the throat.
  group.add(blob(material, 1.33, 1.72, 0.32, 0.25, 0.25, 0.25));
  group.add(blob(material, 1.53, 1.62, 0.22, 0.15, 0.13, 0.17));
  group.add(limb(material, [-0.85, 1.75, 0.22], [-1.3, 1.3, 0.4], 0.05, 0.045, 6)); // tail
  group.add(limb(material, [-1.3, 1.3, 0.4], [-1.42, 0.8, 0.46], 0.045, 0.06, 6));
  return group;
}

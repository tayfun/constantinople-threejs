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

import * as THREE from 'three';
import { materials as M, cloth } from './lib/materials.js';
import {
  box, cone, cylinder, cylinderGeometry, boxGeometry, flag, mesh, triangleSailGeometry, waterDisc,
} from './lib/primitives.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createHull } from './lib/hull.js';
import { finalizeModel } from './lib/merge.js';

/**
 * A Byzantine dromon of the 10th century, after Pryor & Jeffreys, "The Age
 * of the Dromon": a fully decked bireme galley about 31.5 m long and 4.5 m
 * in the beam, pulling 100 oars — 25 a side on each of two banks, the lower
 * through oarports in the hull, the upper over the gunwale. Two lateen
 * sails; the raised forecastle (pseudopation) in the bow with the bronze
 * siphon for Greek fire beneath it; the spur (peronion) above the
 * waterline, to ride over an enemy's oars; wooden castles (xylokastra) for
 * archers on either side between the masts; a pavesade of shields along
 * the deck; two quarter rudders and the captain's tent (skene) in the
 * upswept stern, under the imperial standard. Bow at +x; the oars row in time.
 */

const LENGTH = 31.5;
const BEAM = 4.6;
const GUNWALE = 1.5; // height of the gunwale above the waterline
const DECK = GUNWALE - 0.3;

export function createDromon({ lod = 'detail' } = {}) {
  const detail = lod === 'detail';
  const root = new THREE.Group();
  root.add(createShip(detail));
  if (detail) root.add(waterDisc(23, 3));
  return root;
}

function createShip(detail) {
  const ship = new THREE.Group();
  const { geometry, deck, halfBeamAtX } = createHull({
    length: LENGTH, beam: BEAM, depth: 2.2, bowRise: 1, sternRise: 3,
    segments: detail ? 44 : 20, ribs: detail ? 12 : 8,
  });
  ship.add(mesh(geometry, M.hull, 0, GUNWALE, 0));
  ship.add(mesh(deck, M.wood, 0, DECK, 0));

  // A wale along each side, and the oarports of the lower bank.
  if (detail) {
    const port = cylinderGeometry(0.17, 0.17, 0.1, 8).rotateX(Math.PI / 2);
    for (const side of [-1, 1]) {
      for (let x = -13; x < 13; x += 2) {
        ship.add(box(2.1, 0.16, 0.14, M.wood, x + 1, GUNWALE - 0.2, side * (halfBeamAtX(x + 1) + 0.02)));
      }
      for (let i = 0; i < 25; i++) {
        const x = -10.5 + (21 / 24) * i;
        ship.add(mesh(port, M.opening, x, 0.6, side * (halfBeamAtX(x) + 0.03)));
      }
    }
  }

  // The spur: a long timber beam above the waterline, sheathed in iron at the tip.
  const spur = cylinder(0.14, 0.3, 4.6, M.wood, LENGTH / 2 - 0.8, 1.0, 0, 8);
  spur.rotation.z = -Math.PI / 2 + 0.06;
  ship.add(spur);
  const tip = cone(0.16, 0.9, M.iron, LENGTH / 2 + 3.75, 1.27, 0, 8);
  tip.rotation.z = -Math.PI / 2 + 0.06;
  ship.add(tip);

  // The forecastle (pseudopation) with its palisade, and the siphon under it at the stem.
  ship.add(box(3.6, 1.1, 2.6, M.wood, LENGTH / 2 - 3.6, DECK, 0));
  ship.add(box(3.9, 0.25, 2.9, M.wood, LENGTH / 2 - 3.6, DECK + 1.1, 0));
  for (const [dx, dz] of [[-1.8, -1.3], [-1.8, 1.3], [1.8, -1.3], [1.8, 1.3], [0, -1.3], [0, 1.3]]) {
    ship.add(box(0.18, 1, 0.18, M.wood, LENGTH / 2 - 3.6 + dx, DECK + 1.35, dz));
  }
  for (const side of [-1, 1]) ship.add(box(3.9, 0.12, 0.12, M.wood, LENGTH / 2 - 3.6, DECK + 2.25, side * 1.3));
  ship.add(box(1.2, 0.9, 1.1, M.bronze, LENGTH / 2 - 2.4, DECK, 0)); // the cauldron and pump
  const siphon = cylinder(0.14, 0.24, 2.6, M.bronze, LENGTH / 2 - 0.6, DECK + 0.65, 0, 10);
  siphon.rotation.z = -Math.PI / 2 + 0.12;
  ship.add(siphon);
  ship.add(mesh(cylinderGeometry(0.3, 0.2, 0.4, 10).rotateZ(-Math.PI / 2), M.gold, LENGTH / 2 + 1.9, DECK + 0.95, 0)); // lion's-head nozzle

  // Wooden castles for archers, one each side between the masts.
  if (detail) {
    for (const side of [-1, 1]) {
      const z = side * (halfBeamAtX(2) - 1);
      ship.add(box(2.4, 2.2, 1.6, M.wood, 2, DECK, z));
      ship.add(box(2.7, 0.2, 1.9, M.wood, 2, DECK + 2.2, z));
      for (let i = 0; i < 3; i++) ship.add(box(0.5, 0.5, 0.15, M.wood, 2 - 1 + i, DECK + 2.4, z + side * 0.9));
    }
  } else {
    ship.add(box(2.4, 2.2, 3.4, M.wood, 2, DECK, 0));
  }

  // The stern: the captain's tent, the standard, and the quarter rudders.
  for (const [dx, dz] of [[-1.5, -1.3], [-1.5, 1.3], [1.5, -1.3], [1.5, 1.3]]) ship.add(cylinder(0.07, 0.07, 1.9, M.wood, -11.5 + dx, DECK + 0.4, dz, 6));
  ship.add(box(3.4, 0.1, 2.9, M.imperialPurple, -11.5, DECK + 2.3, 0));
  const canopy = mesh(new THREE.BoxGeometry(3.4, 1.1, 0.12).rotateX(0.6).translate(0, 0, -1.3), M.imperialPurple, -11.5, DECK + 2.3, 0);
  ship.add(canopy);
  const canopy2 = mesh(new THREE.BoxGeometry(3.4, 1.1, 0.12).rotateX(-0.6).translate(0, 0, 1.3), M.imperialPurple, -11.5, DECK + 2.3, 0);
  ship.add(canopy2);
  for (const side of [-1, 1]) {
    const rudder = box(0.3, 4.4, 0.9, M.wood, -13.2, -1.6, side * (halfBeamAtX(-13.2) + 0.3));
    rudder.rotation.z = -0.5;
    ship.add(rudder);
    const tiller = box(1.8, 0.1, 0.1, M.wood, -12.6, DECK + 1.1, side * (halfBeamAtX(-13.2) - 0.4));
    ship.add(tiller);
  }

  // The pavesade: shields hung along the deck between the oarsmen.
  const shield = cylinderGeometry(0.42, 0.42, 0.08, 12).rotateX(Math.PI / 2);
  const boss = cylinderGeometry(0.1, 0.1, 0.14, 8).rotateX(Math.PI / 2);
  const shieldColours = [cloth(0xa3202a), cloth(0xd8a933), cloth(0x2a4d8f), cloth(0xe6dcc6)];
  const shields = detail ? 16 : 8;
  for (let i = 0; i < shields; i++) {
    const x = -9.5 + i * (19.5 / (shields - 1));
    for (const side of [-1, 1]) {
      const z = side * (halfBeamAtX(x) + 0.05);
      ship.add(mesh(shield, shieldColours[(i + (side > 0 ? 1 : 0)) % 4], x, GUNWALE + 0.2, z));
      if (detail) ship.add(mesh(boss, M.iron, x, GUNWALE + 0.2, z + side * 0.05));
    }
  }

  // Two masts with lateen yards and sails.
  for (const { x, height, yardLength, tilt } of [{ x: 7, height: 15, yardLength: 20, tilt: 0.45 }, { x: -3.5, height: 12.5, yardLength: 15, tilt: 0.48 }]) {
    ship.add(cylinder(0.16, 0.24, height, M.wood, x, DECK, 0, 8));
    ship.add(box(0.7, 0.6, 0.7, M.wood, x, DECK + height - 1.6, 0));
    const yard = cylinder(0.1, 0.1, yardLength, M.wood, 0, 0, 0, 6);
    yard.geometry.translate(0, -yardLength / 2, 0);
    yard.rotation.z = Math.PI / 2 - tilt; // fore end low, aft end high
    yard.position.set(x, GUNWALE + height - 1.5, 0.4);
    ship.add(yard);
    const half = yardLength / 2;
    const fore = new THREE.Vector3(x + Math.cos(tilt) * half, GUNWALE + height - 1.5 - Math.sin(tilt) * half, 0.5);
    const peak = new THREE.Vector3(x - Math.cos(tilt) * half, GUNWALE + height - 1.5 + Math.sin(tilt) * half, 0.5);
    const clew = new THREE.Vector3(x - half * 0.55, GUNWALE + 1.4, 0.5);
    ship.add(mesh(triangleSailGeometry(fore, peak, clew, 0.9, detail ? 10 : 5), M.sail));
  }

  finalizeModel(ship);

  // The imperial standard at the stern and a pennant at the mainmast head.
  for (const [x, y, size] of [[-13.4, DECK + 1.8, 1.1], [7, DECK + 14.6, 0.8]]) {
    const banner = flag('byzantine', { width: 2.4 * size, height: 1.5 * size, pole: 2.8 });
    banner.position.set(x, y, 0);
    ship.add(banner);
  }

  const oars = createOars(detail, halfBeamAtX);
  ship.add(oars.group);

  ship.userData.animate = (time) => {
    oars.row(time);
    ship.position.y = Math.sin(time * 1.3) * 0.08;
    ship.rotation.x = Math.sin(time * 0.9) * 0.015;
  };
  return ship;
}

/** Two banks of 25 oars a side (one bank on the map), pivoting at their oarports. */
function createOars(detail, halfBeamAtX) {
  const group = new THREE.Group();
  group.userData.dynamic = true;
  const banks = detail
    ? [{ y: 0.6, count: 25, length: 7, phase: 0 }, { y: GUNWALE + 0.15, count: 25, length: 9.5, phase: 0.35 }]
    : [{ y: 0.9, count: 14, length: 8, phase: 0 }];

  const pivots = [];
  for (const [b, bank] of banks.entries()) {
    const geometry = mergeGeometries([
      cylinderGeometry(0.05, 0.06, bank.length, 5).rotateX(Math.PI / 2).translate(0, 0, -1),
      boxGeometry(0.08, 0.3, 1.3).translate(0, -0.15, bank.length - 1.6),
    ]);
    for (let i = 0; i < bank.count; i++) {
      const x = -10.5 + (21 / (bank.count - 1)) * i + (b === 0 ? 0 : 0.4);
      for (const side of [-1, 1]) {
        const pivot = new THREE.Group();
        pivot.position.set(x, bank.y, side * halfBeamAtX(x));
        pivot.rotation.order = 'YXZ';
        const oar = new THREE.Mesh(geometry, M.wood);
        oar.castShadow = true;
        pivot.add(oar);
        group.add(pivot);
        pivots.push({ pivot, side, phase: bank.phase });
      }
    }
  }

  const row = (time) => {
    for (const { pivot, side, phase } of pivots) {
      const stroke = time * 2.4 + phase;
      const sweep = Math.sin(stroke) * 0.38;
      const dip = 0.32 + Math.cos(stroke) * 0.12;
      pivot.rotation.set(dip, side > 0 ? sweep : Math.PI - sweep, 0);
    }
  };
  return { group, row };
}

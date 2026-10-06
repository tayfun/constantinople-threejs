import * as THREE from 'three';
import { materials as M, cloth } from './lib/materials.js';
import {
  box, cone, cylinder, cylinderGeometry, boxGeometry, flag, gableRoof, mesh, triangleSailGeometry, waterDisc,
} from './lib/primitives.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createHull } from './lib/hull.js';
import { finalizeModel } from './lib/merge.js';

/**
 * A Byzantine dromon: a fast two-banked war galley of about 100 oars, with
 * two lateen sails, a wooden fighting castle amidships and a bronze siphon
 * at the bow for projecting Greek fire. Bow at +x; the oars row in time.
 */

const LENGTH = 32;
const BEAM = 4.6;
const GUNWALE = 1.4; // height of the gunwale above the waterline

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
    length: LENGTH, beam: BEAM, depth: 2.3, bowRise: 1.2, sternRise: 2.8,
    segments: detail ? 44 : 20, ribs: detail ? 12 : 8,
  });
  ship.add(mesh(geometry, M.hull, 0, GUNWALE, 0));
  ship.add(mesh(deck, M.wood, 0, GUNWALE - 0.3, 0));

  // Ram (spur) above the waterline, and the Greek-fire siphon.
  const spur = cone(0.35, 4, M.bronze, LENGTH / 2 - 0.6, 0.9, 0, 8);
  spur.rotation.z = -Math.PI / 2;
  ship.add(spur);
  const siphon = cylinder(0.18, 0.28, 2.2, M.bronze, LENGTH / 2 - 3.2, GUNWALE + 0.9, 0, 10);
  siphon.rotation.z = -Math.PI / 2 + 0.15;
  ship.add(siphon);
  ship.add(box(1.4, 0.9, 1.2, M.bronze, LENGTH / 2 - 3.8, GUNWALE - 0.3, 0));

  // Fighting castle, stern pavilion and quarter rudders.
  ship.add(box(3.4, 2.4, 3.6, M.wood, 4, GUNWALE - 0.3, 0));
  ship.add(box(3.8, 0.9, 4, M.wood, 4, GUNWALE + 2.1, 0));
  ship.add(box(3.6, 1.9, 3.2, M.imperialPurple, -11.5, GUNWALE - 0.3, 0));
  ship.add(gableRoof(3.6, 3.2, 1, M.gold, -11.5, GUNWALE + 1.6, 0, 0.25));
  for (const side of [-1, 1]) {
    const rudder = box(0.3, 4.2, 0.9, M.wood, -13.6, -1.6, side * (halfBeamAtX(-13.6) + 0.3));
    rudder.rotation.z = -0.5;
    ship.add(rudder);
  }

  // Shields hung along the gunwale.
  const shield = cylinderGeometry(0.42, 0.42, 0.08, 12).rotateX(Math.PI / 2);
  const shieldColours = [cloth(0xa3202a), cloth(0xd8a933), cloth(0x2a4d8f)];
  for (let i = 0; i < (detail ? 15 : 8); i++) {
    const x = -9 + i * (18 / ((detail ? 15 : 8) - 1));
    for (const side of [-1, 1]) {
      ship.add(mesh(shield, shieldColours[i % 3], x, GUNWALE + 0.15, side * (halfBeamAtX(x) + 0.05)));
    }
  }

  // Two masts with lateen yards and sails.
  for (const { x, height, yardLength, tilt } of [{ x: 7.5, height: 15, yardLength: 19, tilt: 0.42 }, { x: -3, height: 12.5, yardLength: 15, tilt: 0.45 }]) {
    ship.add(cylinder(0.16, 0.22, height, M.wood, x, GUNWALE - 0.3, 0, 8));
    const yard = cylinder(0.1, 0.1, yardLength, M.wood, 0, 0, 0, 6);
    yard.geometry.translate(0, -yardLength / 2, 0);
    yard.rotation.z = Math.PI / 2 - tilt; // fore end low, aft end high
    yard.position.set(x, GUNWALE + height - 1.5, 0.4);
    ship.add(yard);
    const half = yardLength / 2;
    const fore = new THREE.Vector3(x + Math.cos(tilt) * half, GUNWALE + height - 1.5 - Math.sin(tilt) * half, 0.5);
    const peak = new THREE.Vector3(x - Math.cos(tilt) * half, GUNWALE + height - 1.5 + Math.sin(tilt) * half, 0.5);
    const clew = new THREE.Vector3(x - half * 0.55, GUNWALE + 1.2, 0.5);
    ship.add(mesh(triangleSailGeometry(fore, peak, clew, 0.9, detail ? 10 : 5), M.sail));
  }

  finalizeModel(ship);

  // Banners at the stern and masthead.
  for (const [x, y, size] of [[-12.5, GUNWALE + 2.6, 1], [7.5, GUNWALE + 15, 0.8]]) {
    const banner = flag('byzantine', { width: 2.4 * size, height: 1.5 * size, pole: 2.6 });
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

/** Two banks of oars per side (one on the map), pivoting at their oarports. */
function createOars(detail, halfBeamAtX) {
  const group = new THREE.Group();
  group.userData.dynamic = true;
  const banks = detail
    ? [{ y: 0.55, count: 25, length: 7.5, phase: 0 }, { y: GUNWALE + 0.1, count: 25, length: 10, phase: 0.35 }]
    : [{ y: 0.9, count: 14, length: 8, phase: 0 }];

  const pivots = [];
  for (const bank of banks) {
    const geometry = mergeGeometries([
      cylinderGeometry(0.05, 0.06, bank.length, 5).rotateX(Math.PI / 2).translate(0, 0, -1),
      boxGeometry(0.08, 0.3, 1.3).translate(0, -0.15, bank.length - 1.6),
    ]);
    for (let i = 0; i < bank.count; i++) {
      const x = -10.5 + (21 / (bank.count - 1)) * i;
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

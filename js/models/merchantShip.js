import * as THREE from 'three';
import { materials as M } from './lib/materials.js';
import { box, cylinder, flag, mesh, squareSailGeometry, triangleSailGeometry } from './lib/primitives.js';
import { createHull } from './lib/hull.js';
import { finalizeModel } from './lib/merge.js';

/**
 * An Italian merchantman of the Golden Horn, flying the colours of its port.
 * Bow at +x.
 *
 *  - rig 'lateen' (default): a Mediterranean "nave" of the 12th–14th
 *    centuries, as Venice and Genoa sailed it — a deep round hull about
 *    three times as long as it is broad, two masts with lateen sails, two
 *    quarter rudders, a tall stern castle and a lower forecastle
 *    (cf. the Venetian Roccaforte of 1268, 34 m long, castles 12 m high).
 *  - rig 'square': the northern-style "cocha" (cog) the Genoese took up
 *    around 1300 — one mast, a single square sail and a stern-post rudder.
 */
export function createMerchantShip({ lod = 'detail', banner = 'genoa', sail = true, rig = 'lateen' } = {}) {
  const detail = lod === 'detail';
  const ship = new THREE.Group();
  const cog = rig === 'square';
  const length = cog ? 24 : 27;
  const beam = cog ? 7.5 : 8.4;
  const gunwale = 2.4;
  const { geometry, deck, halfBeamAtX } = createHull({
    length, beam, depth: 3.6, bowRise: cog ? 1.8 : 1.4, sternRise: cog ? 2.4 : 2.8, fullness: 0.42,
    segments: detail ? 32 : 16, ribs: detail ? 12 : 8,
  });
  ship.add(mesh(geometry, M.hull, 0, gunwale, 0));
  ship.add(mesh(deck, M.wood, 0, gunwale - 0.3, 0));

  // Wales: two heavy strakes running the length of the hull.
  if (detail) {
    for (const side of [-1, 1]) {
      for (const y of [gunwale - 0.35, gunwale - 1.5]) {
        for (let x = -length * 0.42; x < length * 0.42; x += 2.4) {
          const half = halfBeamAtX(x + 1.2) * (y > gunwale - 1 ? 1 : 0.93);
          ship.add(box(2.6, 0.22, 0.2, M.wood, x + 1.2, y, side * (half + 0.02)));
        }
      }
    }
  }

  if (cog) {
    // Square castles on posts and the hinged stern rudder.
    ship.add(box(5.5, 2.2, 6.4, M.wood, -7.5, gunwale - 0.3, 0));
    ship.add(box(6, 0.35, 7, M.wood, -7.5, gunwale + 1.9, 0));
    ship.add(railing(ship, 6, 7, -7.5, gunwale + 2.25));
    ship.add(box(3.6, 1.6, 4.2, M.wood, 8.6, gunwale + 0.4, 0));
    ship.add(box(4, 0.3, 4.6, M.wood, 8.6, gunwale + 2, 0));
    const rudder = box(0.3, 4.6, 1.1, M.wood, -length / 2 + 0.2, gunwale - 4.2, 0);
    rudder.rotation.z = -0.12;
    ship.add(rudder);
    ship.add(cylinder(0.08, 0.08, 3.2, M.wood, -length / 2 - 0.3, gunwale + 0.2, 0.9, 6));
  } else {
    // A two-storey stern castle with a hipped awning, a lower forecastle, and the quarter rudders.
    ship.add(box(6.5, 2.6, 7, M.wood, -8.5, gunwale - 0.3, 0));
    ship.add(box(7, 0.35, 7.6, M.wood, -8.5, gunwale + 2.3, 0));
    ship.add(railing(ship, 7, 7.6, -8.5, gunwale + 2.65));
    ship.add(box(4.6, 2.2, 5.4, M.wood, -9.5, gunwale + 2.65, 0));
    ship.add(box(5, 0.3, 5.8, M.wood, -9.5, gunwale + 4.85, 0));
    ship.add(railing(ship, 5, 5.8, -9.5, gunwale + 5.15));
    ship.add(box(3.2, 1.4, 4, M.wood, 9.6, gunwale + 0.7, 0));
    ship.add(box(3.6, 0.3, 4.4, M.wood, 9.6, gunwale + 2.1, 0));
    for (const side of [-1, 1]) {
      const rudder = box(0.28, 4.6, 1.1, M.wood, -11, gunwale - 3.9, side * (halfBeamAtX(-11) + 0.25));
      rudder.rotation.z = -0.45;
      ship.add(rudder);
    }
  }

  // Cargo on deck: bales and casks.
  if (detail) {
    for (const [x, z, cask] of [[1, 1.6, true], [-2, -1.8, false], [3.5, -1.4, true], [-3.5, 1.9, false]]) {
      ship.add(cask ? cylinder(0.5, 0.5, 1.1, M.wood, x, gunwale - 0.3, z, 8) : box(1.4, 0.9, 1.1, M.sail, x, gunwale - 0.3, z));
    }
  }

  // Rig.
  const masts = cog
    ? [{ x: 0.5, height: 17, rake: 0 }]
    : [{ x: 3.5, height: 19, rake: 0.08, yard: 24, tilt: 0.5 }, { x: -6.5, height: 13, rake: 0.04, yard: 15, tilt: 0.5 }];
  for (const { x, height, rake } of masts) {
    const mast = cylinder(0.18, 0.3, height, M.wood, x, gunwale - 0.3, 0, 8);
    mast.rotation.z = -rake;
    ship.add(mast);
    ship.add(box(1, 1, 1, M.wood, x + Math.sin(rake) * (height - 1.2), gunwale - 0.3 + height - 1.6, 0)); // top
  }
  if (sail && cog) {
    const yard = cylinder(0.12, 0.12, 13, M.wood, 0, 0, 0, 6);
    yard.rotation.x = Math.PI / 2;
    yard.position.set(0.5, gunwale + 13.7, -6.5);
    ship.add(yard);
    const canvas = mesh(squareSailGeometry(12, 10.5, 1.4), M.sail, 0.5, gunwale + 3, 0);
    canvas.rotation.y = Math.PI / 2; // belly towards the bow
    ship.add(canvas);
  } else if (sail) {
    for (const { x, height, rake, yard: yardLength, tilt } of masts) {
      const top = new THREE.Vector3(x + Math.sin(rake) * (height - 2), gunwale + height - 2.3, 0.45);
      const yard = cylinder(0.1, 0.1, yardLength, M.wood, 0, 0, 0, 6);
      yard.geometry.translate(0, -yardLength / 2, 0);
      yard.rotation.z = Math.PI / 2 - tilt;
      yard.position.copy(top);
      ship.add(yard);
      const half = yardLength / 2;
      const fore = new THREE.Vector3(top.x + Math.cos(tilt) * half, top.y - Math.sin(tilt) * half, 0.55);
      const peak = new THREE.Vector3(top.x - Math.cos(tilt) * half, top.y + Math.sin(tilt) * half, 0.55);
      const clew = new THREE.Vector3(top.x - half * 0.5, gunwale + 2.2, 0.55);
      ship.add(mesh(triangleSailGeometry(fore, peak, clew, 1.1, detail ? 10 : 5), M.sail));
    }
  }

  finalizeModel(ship);
  const main = masts[0];
  const colours = flag(banner, { width: 2.6, height: 1.6, pole: 3 });
  colours.position.set(main.x + Math.sin(main.rake) * main.height, gunwale + main.height - 0.6, 0);
  ship.add(colours);

  const phase = Math.random() * 10;
  ship.userData.animate = (time) => {
    ship.position.y = Math.sin(time * 1.2 + phase) * 0.15;
    ship.rotation.x = Math.sin(time * 0.9 + phase) * 0.02;
  };
  return ship;
}

/** A low rail of posts round a castle deck. */
function railing(ship, w, d, x, y) {
  const group = new THREE.Group();
  const post = (px, pz) => group.add(cylinder(0.07, 0.07, 1, M.wood, px, y, pz, 5));
  for (let i = 0; i <= 3; i++) {
    post(x - w / 2 + (w / 3) * i, -d / 2);
    post(x - w / 2 + (w / 3) * i, d / 2);
  }
  post(x - w / 2, 0);
  post(x + w / 2, 0);
  for (const side of [-1, 1]) group.add(box(w, 0.1, 0.1, M.wood, x, y + 0.95, side * d / 2));
  return group;
}

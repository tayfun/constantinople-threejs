import * as THREE from 'three';
import { materials as M } from './lib/materials.js';
import { box, cylinder, flag, mesh, squareSailGeometry } from './lib/primitives.js';
import { createHull } from './lib/hull.js';
import { finalizeModel } from './lib/merge.js';

/**
 * A round-bellied Italian merchant cog with fore- and aftcastles and one
 * square sail, flying the colours of its home port. Bow at +x.
 */
export function createMerchantShip({ lod = 'detail', banner = 'genoa', sail = true } = {}) {
  const ship = new THREE.Group();
  const { geometry, deck } = createHull({
    length: 24, beam: 7.5, depth: 3.4, bowRise: 1.8, sternRise: 2.4, fullness: 0.4,
    segments: lod === 'detail' ? 32 : 16, ribs: lod === 'detail' ? 12 : 8,
  });
  ship.add(mesh(geometry, M.hull, 0, 2.2, 0));
  ship.add(mesh(deck, M.wood, 0, 1.9, 0));

  // Castles at stern and bow.
  ship.add(box(6, 2.4, 6.4, M.wood, -8, 1.9, 0));
  ship.add(box(6.6, 0.4, 7, M.wood, -8, 4.3, 0));
  ship.add(box(4, 2, 4.4, M.wood, 9.2, 2.6, 0));

  // Mast, yard and square sail.
  ship.add(cylinder(0.2, 0.28, 17, M.wood, 0.5, 1.9, 0, 8));
  if (sail) {
    const yard = cylinder(0.12, 0.12, 13, M.wood, 0, 0, 0, 6);
    yard.rotation.x = Math.PI / 2;
    yard.position.set(0.5, 16, -6.5);
    ship.add(yard);
    const canvas = mesh(squareSailGeometry(12, 10, 1.4), M.sail, 0.5, 6, 0);
    canvas.rotation.y = Math.PI / 2; // belly towards the bow
    ship.add(canvas);
  }

  finalizeModel(ship);
  const colours = flag(banner, { width: 2.6, height: 1.6, pole: 3 });
  colours.position.set(0.5, 18.4, 0);
  ship.add(colours);

  const phase = Math.random() * 10;
  ship.userData.animate = (time) => {
    ship.position.y = Math.sin(time * 1.2 + phase) * 0.15;
    ship.rotation.x = Math.sin(time * 0.9 + phase) * 0.02;
  };
  return ship;
}

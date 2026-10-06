import * as THREE from 'three';
import { createMerchantShip } from '../models/merchantShip.js';
import { createRouteFollower } from './motion.js';
import { toWorld } from '../util/geo.js';
import { BOSPHORUS_ROUTE, MARMARA_ROUTE, METERS_TO_MAP, magnify } from '../data/geography.js';

/** Merchant traffic on the Marmara and the Bosphorus, and ships moored off Galata. */

const SHIP_SCALE = 4 * METERS_TO_MAP;

const SAILING = [
  { route: MARMARA_ROUTE, banner: 'genoa', speed: 0.55, offset: 0 },
  { route: MARMARA_ROUTE, banner: 'venice', speed: 0.55, offset: 0.45 },
  { route: BOSPHORUS_ROUTE, banner: 'byzantine', speed: 0.5, offset: 0.2 },
  { route: BOSPHORUS_ROUTE, banner: 'genoa', speed: 0.5, offset: 0.7 },
];

const MOORED = [
  { at: magnify([-5, 13.5]), heading: 0.1, banner: 'genoa' },
  { at: magnify([0.5, 15.2]), heading: 0.6, banner: 'genoa' },
  { at: magnify([-11, 15.2]), heading: 0.6, banner: 'venice' },
];

export function createShipping() {
  const shipping = new THREE.Group();

  for (const { route, banner, speed, offset } of SAILING) {
    const holder = new THREE.Group();
    holder.add(createMerchantShip({ lod: 'map', banner }));
    holder.scale.setScalar(SHIP_SCALE);
    holder.userData.animate = createRouteFollower(holder, route, { speed, offset });
    shipping.add(holder);
  }

  for (const { at, heading, banner } of MOORED) {
    const holder = new THREE.Group();
    holder.add(createMerchantShip({ lod: 'map', banner, sail: false }));
    holder.scale.setScalar(SHIP_SCALE);
    holder.position.copy(toWorld(at));
    holder.rotation.y = heading;
    shipping.add(holder);
  }
  return shipping;
}

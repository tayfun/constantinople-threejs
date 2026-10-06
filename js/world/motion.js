import * as THREE from 'three';
import { toWorld } from '../util/geo.js';

/**
 * Returns an animate(time) function that moves `object` round a closed
 * route of [east, north] points at `speed` map units per second, turning it
 * to face its direction of travel (models face +x).
 */
export function createRouteFollower(object, route, { speed = 1, offset = 0, y = 0 } = {}) {
  const curve = new THREE.CatmullRomCurve3(route.map((point) => toWorld(point, y)), true, 'centripetal');
  const length = curve.getLength();
  const tangent = new THREE.Vector3();
  return (time) => {
    const u = (((time * speed) / length + offset) % 1 + 1) % 1;
    curve.getPointAt(u, object.position);
    curve.getTangentAt(u, tangent);
    object.rotation.y = Math.atan2(-tangent.z, tangent.x);
  };
}

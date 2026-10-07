import * as THREE from 'three';

/**
 * Named parts of a model — the Chalke in the Great Palace, the Medusa heads
 * in the cistern — which the detail view labels. A part is an empty anchor
 * object whose userData.part is the key of its name under `parts` in the
 * language files. finalizeModel merges meshes but leaves anchors alone.
 */

/** Pins the label `key` at (x, y, z) in `group`. */
export function labelAt(group, key, x, y, z) {
  const anchor = new THREE.Object3D();
  anchor.userData.part = key;
  anchor.position.set(x, y, z);
  group.add(anchor);
  return anchor;
}

/**
 * Runs build(), which adds one part's objects to `group`, and pins the label
 * `key` above the middle of what it added. For a scatter of like objects (a
 * quarter's houses), `near: [x, z]` labels only the one closest to that spot.
 */
export function labelled(group, key, build, { near } = {}) {
  const before = new Set(group.children);
  build();
  group.updateMatrixWorld(true);
  const toGroup = group.matrixWorld.clone().invert();
  const boundsOf = (object) => new THREE.Box3().setFromObject(object).applyMatrix4(toGroup);
  let added = group.children.filter((child) => !before.has(child));
  if (near) {
    const distance = (object) => {
      const centre = boundsOf(object).getCenter(new THREE.Vector3());
      return Math.hypot(centre.x - near[0], centre.z - near[1]);
    };
    added = [added.reduce((best, object) => (distance(object) < distance(best) ? object : best))];
  }
  const box = new THREE.Box3();
  for (const object of added) box.union(boundsOf(object));
  const centre = box.getCenter(new THREE.Vector3());
  return labelAt(group, key, centre.x, box.max.y, centre.z);
}

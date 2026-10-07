import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Collapses the static meshes of a model into one mesh per material, which
 * keeps draw calls low even for models built from hundreds of parts.
 * Anything under an object with `userData.animate` or `userData.dynamic`
 * (oars, flags, chariots…) is left untouched so it can still move.
 */

const KEEP_ATTRIBUTES = ['position', 'normal', 'uv'];

function isDynamic(object, root) {
  for (let node = object; node && node !== root; node = node.parent) {
    if (node.userData.animate || node.userData.dynamic) return true;
  }
  return false;
}

function flipWinding(geometry) {
  for (const attribute of Object.values(geometry.attributes)) {
    const { array, itemSize } = attribute;
    for (let tri = 0; tri < attribute.count; tri += 3) {
      for (let k = 0; k < itemSize; k++) {
        const a = (tri + 1) * itemSize + k;
        const b = (tri + 2) * itemSize + k;
        [array[a], array[b]] = [array[b], array[a]];
      }
    }
  }
}

function bakeGeometry(meshObject, toRoot) {
  const geometry = meshObject.geometry.index ? meshObject.geometry.toNonIndexed() : meshObject.geometry.clone();
  const keep = meshObject.material.vertexColors ? [...KEEP_ATTRIBUTES, 'color'] : KEEP_ATTRIBUTES;
  for (const name of Object.keys(geometry.attributes)) {
    if (!keep.includes(name)) geometry.deleteAttribute(name);
  }
  if (!geometry.attributes.normal) geometry.computeVertexNormals();
  if (!geometry.attributes.uv) {
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count * 2), 2));
  }
  geometry.clearGroups();
  geometry.applyMatrix4(toRoot);
  if (toRoot.determinant() < 0) flipWinding(geometry);
  return geometry;
}

export function finalizeModel(root) {
  root.updateMatrixWorld(true);
  const rootInverse = root.matrixWorld.clone().invert();
  const buckets = new Map();
  const merged = [];

  root.traverse((object) => {
    if (!object.isMesh || object.isInstancedMesh || Array.isArray(object.material) || isDynamic(object, root)) return;
    const toRoot = new THREE.Matrix4().multiplyMatrices(rootInverse, object.matrixWorld);
    if (!buckets.has(object.material)) buckets.set(object.material, []);
    buckets.get(object.material).push(bakeGeometry(object, toRoot));
    merged.push(object);
  });

  for (const object of merged) object.removeFromParent();
  pruneEmptyGroups(root);

  for (const [material, geometries] of buckets) {
    const combined = new THREE.Mesh(mergeGeometries(geometries, false), material);
    combined.castShadow = !material.isShaderMaterial && !material.isMeshBasicMaterial;
    combined.receiveShadow = !material.isShaderMaterial;
    root.add(combined);
  }

  root.traverse((object) => {
    if (object.isMesh && !merged.includes(object)) {
      object.castShadow = !object.material.isShaderMaterial;
      object.receiveShadow = true;
    }
  });
  return root;
}

function pruneEmptyGroups(node) {
  for (const child of [...node.children]) {
    pruneEmptyGroups(child);
    if (child.type === 'Group' && child.children.length === 0 && !child.userData.animate && !child.userData.dynamic) {
      child.removeFromParent();
    }
  }
}

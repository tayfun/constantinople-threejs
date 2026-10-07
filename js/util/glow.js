import * as THREE from 'three';

/** Hover highlight for pickable objects: a warm emissive glow on every mesh, swapped back when the pointer leaves. */

const glowing = new Map();

function glowingVersion(material) {
  if (!glowing.has(material)) {
    const copy = material.clone();
    if (copy.emissive) {
      copy.emissive = new THREE.Color(0xffb84a);
      copy.emissiveIntensity = 0.42;
    }
    glowing.set(material, copy);
  }
  return glowing.get(material);
}

export function setGlow(root, on) {
  root.traverse((object) => {
    if (!object.isMesh) return;
    const { material } = object;
    const materials = Array.isArray(material) ? material : [material];
    if (materials.some((m) => m.isShaderMaterial)) return;
    if (on) {
      object.userData.restMaterial = material;
      object.material = Array.isArray(material) ? material.map(glowingVersion) : glowingVersion(material);
    } else if (object.userData.restMaterial) {
      object.material = object.userData.restMaterial;
      delete object.userData.restMaterial;
    }
  });
}

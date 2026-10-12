import * as THREE from 'three';

/**
 * Hover highlight for pickable objects, swapped onto every mesh and back when the pointer leaves.
 * A flat emissive wash would add the same light everywhere and drown the shading that carries a
 * model's detail, so the glow is a warm rim instead: faces turned towards the camera only take a
 * slight warm lift (a multiply, which keeps light and shadow in proportion), while silhouettes and
 * steeply viewed faces glow amber.
 */

const uniforms = {
  glowColor: { value: new THREE.Color(0xffb84a).multiplyScalar(0.5) },
  glowLift: { value: new THREE.Color(1.1, 1.03, 0.86) },
};

function addRim(shader) {
  Object.assign(shader.uniforms, uniforms);
  shader.fragmentShader = shader.fragmentShader
    .replace('void main() {', 'uniform vec3 glowColor;\nuniform vec3 glowLift;\nvoid main() {')
    .replace('#include <opaque_fragment>', `
      vec3 towardsCamera = isOrthographic ? vec3(0.0, 0.0, 1.0) : normalize(vViewPosition);
      float rim = pow(1.0 - abs(dot(normal, towardsCamera)), 2.0);
      outgoingLight = outgoingLight * glowLift + glowColor * rim;
      #include <opaque_fragment>`);
}

const glowing = new Map();

function glowingVersion(material) {
  if (!glowing.has(material)) {
    const copy = material.clone();
    if (copy.isMeshStandardMaterial) copy.onBeforeCompile = addRim;
    glowing.set(material, copy);
  }
  return glowing.get(material);
}

/** Parts below the root that are picked on their own (the Golden Gate in the walls) glow only when hovered themselves. */
const pickedAlone = (object) => Boolean(object.userData.landmarkId || object.userData.regionId);

export function setGlow(root, on) {
  const visit = (object) => {
    if (object !== root && pickedAlone(object)) return;
    for (const child of object.children) visit(child);
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
  };
  visit(root);
}

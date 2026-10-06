import * as THREE from 'three';

/**
 * Procedural ship hull. The hull runs along x (stern at -x, bow at +x), the
 * gunwale sits at y = 0 amidships and the keel hangs `depth` below it.
 */
export function createHull({ length, beam, depth, bowRise = 1, sternRise = 1, fullness = 0.55, segments = 40, ribs = 12 }) {
  const halfBeamAt = (u) => (beam / 2) * Math.pow(Math.sin(Math.PI * (0.02 + 0.96 * u)), fullness);
  const sheerAt = (u) => bowRise * Math.pow(Math.max(0, (u - 0.72) / 0.28), 2) + sternRise * Math.pow(Math.max(0, (0.28 - u) / 0.28), 2);
  const keelAt = (u) => -depth * Math.pow(Math.sin(Math.PI * (0.03 + 0.94 * u)), 0.35);

  const positions = [];
  const uvs = [];
  const indices = [];
  for (let i = 0; i <= segments; i++) {
    const u = i / segments;
    const x = (u - 0.5) * length;
    const halfBeam = halfBeamAt(u);
    const top = sheerAt(u);
    const keel = keelAt(u);
    for (let j = 0; j <= ribs; j++) {
      const s = j / ribs;
      const theta = (s - 0.5) * Math.PI;
      positions.push(x, top + (keel - top) * Math.pow(Math.cos(theta), 0.7), halfBeam * Math.sin(theta));
      uvs.push(x, s * (beam + depth * 2));
    }
  }
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < ribs; j++) {
      const a = i * (ribs + 1) + j;
      const b = a + ribs + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  /** Half-beam at a given x along the hull. */
  const halfBeamAtX = (x) => halfBeamAt(Math.min(1, Math.max(0, x / length + 0.5)));
  return { geometry, halfBeamAtX, deck: createDeckGeometry(length, halfBeamAt) };
}

function createDeckGeometry(length, halfBeamAt, inset = 0.94, steps = 24) {
  const outline = [];
  for (let i = 0; i <= steps; i++) outline.push(new THREE.Vector2((i / steps - 0.5) * length, halfBeamAt(i / steps) * inset));
  for (let i = steps; i >= 0; i--) outline.push(new THREE.Vector2((i / steps - 0.5) * length, -halfBeamAt(i / steps) * inset));
  return new THREE.ShapeGeometry(new THREE.Shape(outline)).rotateX(-Math.PI / 2);
}

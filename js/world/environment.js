import * as THREE from 'three';

/** Sky dome and lighting shared by the map and the detail stage. */

export const SUN_DIRECTION = new THREE.Vector3(-0.55, 0.55, 0.62).normalize();

const skyVertex = /* glsl */ `
  varying vec3 vDirection;
  void main() {
    vDirection = normalize(position);
    vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = clip.xyww;
  }
`;

const skyFragment = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uHorizon;
  uniform vec3 uSun;
  uniform vec3 uSunDirection;
  varying vec3 vDirection;
  void main() {
    float height = vDirection.y;
    vec3 color = mix(uHorizon, uTop, smoothstep(-0.02, 0.55, height));
    float sun = max(dot(normalize(vDirection), uSunDirection), 0.0);
    color += uSun * (pow(sun, 18.0) * 0.35 + pow(sun, 600.0) * 1.5);
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;

/** A gradient sky sphere that follows the camera. */
export function createSky({ top = 0x5f8fbf, horizon = 0xf0dcb8, sun = 0xffd9a0 } = {}) {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTop: { value: new THREE.Color(top) },
      uHorizon: { value: new THREE.Color(horizon) },
      uSun: { value: new THREE.Color(sun) },
      uSunDirection: { value: SUN_DIRECTION },
    },
    vertexShader: skyVertex,
    fragmentShader: skyFragment,
    side: THREE.BackSide,
    depthWrite: false,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1000, 32, 16), material);
  sky.frustumCulled = false;
  sky.renderOrder = -1;
  return sky;
}

/** Warm late-afternoon sun with soft sky fill; the sun casts shadows over ±extent. */
export function createLights({ extent, mapSize = 2048, distance = 200, intensity = 2.6 }) {
  const group = new THREE.Group();
  group.add(new THREE.HemisphereLight(0xd3e2f0, 0x8a7656, 1.15));

  const sun = new THREE.DirectionalLight(0xffe0b5, intensity);
  sun.position.copy(SUN_DIRECTION).multiplyScalar(distance);
  sun.castShadow = true;
  sun.shadow.mapSize.set(mapSize, mapSize);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  group.add(sun, sun.target);
  fitShadow(sun, extent, distance);
  return { group, sun };
}

export function fitShadow(sun, extent, distance) {
  const camera = sun.shadow.camera;
  camera.left = camera.bottom = -extent;
  camera.right = camera.top = extent;
  camera.near = distance * 0.2;
  camera.far = distance * 2;
  camera.updateProjectionMatrix();
}

import * as THREE from 'three';

/**
 * Animated water: a cheap analytic wave field shaded with fresnel sky
 * reflection and a sun glint. Patterns are computed from object-space
 * coordinates, so `scale` (waves per unit) keeps ripples sensible whether a
 * unit is 100 m (map) or 1 m (models).
 */

const vertexShader = /* glsl */ `
  #include <fog_pars_vertex>
  varying vec2 vLocal;
  varying vec3 vWorld;
  void main() {
    vLocal = position.xz;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vec4 mvPosition = viewMatrix * world;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uScale;
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform vec3 uSky;
  uniform vec3 uSunDir;
  varying vec2 vLocal;
  varying vec3 vWorld;
  #include <fog_pars_fragment>

  float waves(vec2 p) {
    return sin(p.x * 1.7 + uTime * 0.9) * 0.35
         + sin(p.y * 2.3 - uTime * 0.7) * 0.3
         + sin((p.x * 0.8 + p.y * 1.4) * 2.9 + uTime * 1.6) * 0.18
         + sin((p.y * 0.6 - p.x * 1.9) * 4.1 - uTime * 2.1) * 0.1;
  }

  void main() {
    vec2 p = vLocal * uScale;
    float e = 0.05;
    float h = waves(p);
    vec3 normal = normalize(vec3(
      -(waves(p + vec2(e, 0.0)) - h) / e * 0.1,
      1.0,
      -(waves(p + vec2(0.0, e)) - h) / e * 0.1
    ));
    vec3 view = normalize(cameraPosition - vWorld);
    float fresnel = pow(1.0 - max(dot(normal, view), 0.0), 4.0);
    vec3 color = mix(uDeep, uShallow, 0.4 + 0.25 * h);
    color = mix(color, uSky, fresnel * 0.75);
    float glint = pow(max(dot(reflect(-uSunDir, normal), view), 0.0), 140.0);
    color += vec3(1.0, 0.9, 0.7) * glint * 0.9;
    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

const instances = new Set();

export function createWaterMaterial({ scale = 1, deep = 0x1f5068, shallow = 0x3c8c98, sky = 0xc6dbe2 } = {}) {
  const material = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uTime: { value: 0 },
        uScale: { value: scale },
        uDeep: { value: new THREE.Color(deep) },
        uShallow: { value: new THREE.Color(shallow) },
        uSky: { value: new THREE.Color(sky) },
        uSunDir: { value: new THREE.Vector3(-0.55, 0.55, 0.62).normalize() },
      },
    ]),
    vertexShader,
    fragmentShader,
    fog: true,
  });
  instances.add(material);
  return material;
}

/** Advances every water surface; call once per frame. */
export function updateWater(time) {
  for (const material of instances) material.uniforms.uTime.value = time;
}

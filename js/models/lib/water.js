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

  // Cheap value noise, for the broad, slow-moving patches that wind lays on open water.
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }

  // Five trains of waves, each running its own way across the others, so no
  // stripes ever line up into the bands a few parallel sines would make.
  float waves(vec2 p) {
    return sin(dot(p, vec2(0.84, 0.54)) * 1.3 + uTime * 0.8) * 0.30
         + sin(dot(p, vec2(-0.37, 0.93)) * 2.1 - uTime * 0.7) * 0.22
         + sin(dot(p, vec2(0.98, -0.2)) * 3.7 + uTime * 1.4) * 0.14
         + sin(dot(p, vec2(0.2, 0.98)) * 5.9 - uTime * 1.9) * 0.09
         + sin(dot(p, vec2(-0.7, -0.7)) * 9.1 + uTime * 2.6) * 0.05;
  }

  void main() {
    vec2 p = vLocal * uScale;
    // Gusts: slow drifting patches that roughen the surface here and smooth it there.
    float gust = noise(p * 0.07 + vec2(uTime * 0.012, -uTime * 0.008));
    gust = 0.6 + 0.6 * (gust - 0.5);
    float e = 0.05;
    float h = waves(p);
    float slope = 0.11 * gust;
    vec3 normal = normalize(vec3(
      -(waves(p + vec2(e, 0.0)) - h) / e * slope,
      1.0,
      -(waves(p + vec2(0.0, e)) - h) / e * slope
    ));
    vec3 view = normalize(cameraPosition - vWorld);
    float fresnel = pow(1.0 - max(dot(normal, view), 0.0), 4.0);
    // The gusts also shift the tone a little: ruffled water looks darker, calm water paler.
    vec3 color = mix(uDeep, uShallow, 0.42 + 0.2 * h - 0.2 * (gust - 0.6));
    color = mix(color, uSky, fresnel * 0.7);
    float glint = pow(max(dot(reflect(-uSunDir, normal), view), 0.0), 160.0);
    color += vec3(1.0, 0.92, 0.75) * glint * 0.8 * gust;
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

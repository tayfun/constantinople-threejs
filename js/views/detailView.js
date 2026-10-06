import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createLights, createSky, fitShadow } from '../world/environment.js';
import { materials as M } from '../models/lib/materials.js';
import { ease, tween } from '../util/tween.js';
import { applyViewInsets } from '../util/viewport.js';
import { QUALITY } from '../util/quality.js';

const BACKDROP = 0xe6d3ae;
const STAGE_SIZE = 26; // every model is scaled so its footprint spans this many units
const LIGHT_DISTANCE = 80;

/**
 * The close-up stage: one landmark at a time, built at full detail, set on
 * a round plinth and slowly turning. Models are built on first visit and
 * cached afterwards.
 */
export class DetailView {
  constructor({ renderer }) {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(BACKDROP, 90, 260);
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 3000);

    this.controls = new OrbitControls(this.camera, renderer.domElement);
    Object.assign(this.controls, {
      enabled: false,
      enableDamping: true,
      dampingFactor: 0.08,
      autoRotate: !QUALITY.reducedMotion,
      autoRotateSpeed: 0.5,
      maxPolarAngle: 1.48,
    });
    this.controls.addEventListener('start', () => { this.controls.autoRotate = false; });
    this.dirty = true; // something to redraw (only consulted with reduced motion)
    this.shadowDirty = true; // the sun's shadow map must be redrawn

    this.sky = createSky({ top: 0x6b8fb4, horizon: BACKDROP });
    const { group, sun } = createLights({ extent: 20, mapSize: QUALITY.detailShadowSize, distance: LIGHT_DISTANCE, intensity: 2.8 });
    this.sun = sun;
    this.scene.add(this.sky, group);

    const floor = new THREE.Mesh(new THREE.CircleGeometry(600, 64).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xe2cfa6, roughness: 1 }));
    floor.position.y = -2.4;
    floor.receiveShadow = true;
    this.plinth = createPlinth();
    this.scene.add(floor, this.plinth);

    this.stage = new THREE.Group();
    this.scene.add(this.stage);
    this.cache = new Map();
    this.current = null;
  }

  show(landmark) {
    this.stage.clear();
    this.current = this.cache.get(landmark.id) ?? this.build(landmark);
    this.cache.set(landmark.id, this.current);
    const { wrapper, radius, height } = this.current;
    this.stage.add(wrapper);

    this.plinth.scale.set(radius * 1.04, 1, radius * 1.04);
    // The sun stands back far enough, and its shadow frustum opens wide enough, to take in a tall obelisk as well as a wide diorama.
    const lightDistance = Math.max(LIGHT_DISTANCE, height * 1.2);
    this.sun.position.setLength(lightDistance);
    fitShadow(this.sun, Math.max(radius * 1.15, height * 0.6), lightDistance);

    // Seen from above, the footprint is foreshortened, so the camera can sit a little inside the bounding sphere.
    // Slender models (an obelisk, a column) are instead looked at from their middle, so their tops stay in frame.
    const slender = THREE.MathUtils.clamp(height / (radius * 2) - 1, 0, 1); // 0 when squat, 1 when twice as tall as wide
    const lerp = (squat, tall) => THREE.MathUtils.lerp(squat, tall, slender);
    const distance = (Math.hypot(radius, height / 2) / Math.sin(this.visibleHalfFov())) * lerp(0.88, 1.04);
    const azimuth = 0.75;
    const elevation = 0.5;
    const targetY = height * lerp(0.3, 0.5);
    this.camera.position.set(
      Math.sin(azimuth) * Math.cos(elevation) * distance,
      targetY + Math.sin(elevation) * distance + height * lerp(-0.1, 0),
      Math.cos(azimuth) * Math.cos(elevation) * distance,
    );
    this.controls.target.set(0, targetY, 0);
    // The fog that fades the floor into the backdrop must start beyond the model, however far the camera stands.
    this.scene.fog.near = Math.max(90, distance * 1.3);
    this.scene.fog.far = this.scene.fog.near + 170;
    this.controls.minDistance = radius * 0.25;
    this.controls.maxDistance = Math.max(radius * 4, distance * 1.6);
    this.controls.autoRotate = !QUALITY.reducedMotion;
    this.controls.update();
    this.invalidate();

    if (QUALITY.reducedMotion) {
      wrapper.scale.setScalar(1);
      return;
    }
    wrapper.scale.setScalar(0.8);
    tween({ duration: 900, easing: ease.outBack, onUpdate: (t) => {
      wrapper.scale.setScalar(0.8 + 0.2 * t);
      this.invalidate();
    } });
  }

  /** The diorama's shapes changed: redraw it, shadows included. */
  invalidate() {
    this.dirty = true;
    this.shadowDirty = true;
  }

  build(landmark) {
    const model = landmark.create({ lod: 'detail' });
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const centre = box.getCenter(new THREE.Vector3());
    const scale = STAGE_SIZE / Math.max(size.x, size.z);

    const container = new THREE.Group();
    container.add(model);
    container.scale.setScalar(scale);
    container.position.set(-centre.x * scale, -box.min.y * scale, -centre.z * scale);
    const wrapper = new THREE.Group();
    wrapper.add(container);

    const animated = [];
    wrapper.traverse((object) => {
      if (object.userData.animate) animated.push(object.userData.animate);
    });
    // With reduced motion the parts never move; pose each once at its starting position.
    if (QUALITY.reducedMotion) for (const animate of animated) animate(0, 0);
    return {
      wrapper,
      animated,
      radius: horizontalRadius(model, centre) * scale,
      height: size.y * scale,
    };
  }

  /** Half-angle of the narrower direction of the screen area left free by the panels. */
  visibleHalfFov() {
    const { width, height } = this.size ?? { width: 1, height: 1 };
    const { left = 0, right = 0, top = 0, bottom = 0 } = this.insets ?? {};
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const freeWidth = Math.max(1, width - left - right);
    const freeHeight = Math.max(1, height - top - bottom);
    return Math.atan((tanHalf * Math.min(freeHeight, freeWidth)) / height);
  }

  setActive(active) {
    this.controls.enabled = active;
    this.dirty = true;
  }

  resize(width, height) {
    this.size = { width, height };
    applyViewInsets(this.camera, width, height, this.insets);
    this.dirty = true;
  }

  /** Keeps the model centred in the screen area left free by the info panel. */
  setInsets(insets) {
    this.insets = insets;
    if (this.size) applyViewInsets(this.camera, this.size.width, this.size.height, insets);
    this.dirty = true;
  }

  /** Advances the diorama; returns whether anything on screen changed. */
  update(time, delta) {
    const moved = this.controls.update(delta);
    this.sky.position.copy(this.camera.position);
    // Moving parts (oars, flags, chariots) cast moving shadows, so a diorama that has any keeps its shadows live.
    if (this.current?.animated.length && !QUALITY.reducedMotion) {
      for (const animate of this.current.animated) animate(time, delta);
      this.invalidate();
    }
    const changed = moved || this.dirty;
    this.dirty = false;
    return changed;
  }

  render(renderer) {
    if (this.shadowDirty) {
      renderer.shadowMap.needsUpdate = true;
      this.shadowDirty = false;
    }
    renderer.render(this.scene, this.camera);
  }
}

/** Largest horizontal distance of any vertex from the centre, so round dioramas get a snug plinth. */
function horizontalRadius(model, centre) {
  const vertex = new THREE.Vector3();
  let radius = 0;
  model.traverse((object) => {
    if (!object.isMesh || object.isInstancedMesh) return;
    const position = object.geometry.attributes.position;
    for (let i = 0; i < position.count; i++) {
      vertex.fromBufferAttribute(position, i).applyMatrix4(object.matrixWorld);
      radius = Math.max(radius, Math.hypot(vertex.x - centre.x, vertex.z - centre.z));
    }
  });
  return radius;
}

/** A dark stone drum with a gilded rim; scaled in x/z to fit each model. */
function createPlinth() {
  const plinth = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: 0x3d2a35, roughness: 0.55 });
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.03, 2.2, 96, 1).translate(0, -1.1, 0), stone);
  drum.receiveShadow = true;
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(1.012, 1.012, 0.25, 96, 1, true).translate(0, -0.15, 0), M.gold);
  plinth.add(drum, rim);
  return plinth;
}

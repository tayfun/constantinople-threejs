import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createLights, createSky, fitShadow } from '../world/environment.js';
import { materials as M } from '../models/lib/materials.js';
import { ease, tween } from '../util/tween.js';
import { applyViewInsets } from '../util/viewport.js';
import { QUALITY } from '../util/quality.js';
import { setGlow } from '../util/glow.js';
import { landmarkText, partText } from '../i18n/index.js';

const BACKDROP = 0xe6d3ae;
const STAGE_SIZE = 26; // every model is scaled so its footprint spans this many units
const LIGHT_DISTANCE = 80;
const LABEL_GAP = 4; // px kept clear between part labels; a label that would crowd a nearer one is hidden

/**
 * The close-up stage: one landmark at a time, built at full detail, set on
 * a round plinth and slowly turning. Models are built on first visit and
 * cached afterwards. Parts of a model tagged with userData.landmarkId (the
 * monuments on the Hippodrome's spina) can be hovered and clicked to open
 * their own diorama. Named parts (anchors with userData.part) carry plain
 * labels that follow them as the model turns.
 *
 * container: the element the canvas sits in, for the hover tooltip.
 */
export class DetailView {
  constructor({ renderer, container, onSelectLandmark = () => {} }) {
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

    this.renderer = renderer;
    this.onSelectLandmark = onSelectLandmark;
    this.pointer = new THREE.Vector2();
    this.pointerDirty = false;
    this.hovered = null;
    this.tooltip = document.createElement('div');
    this.tooltip.className = 'detail-tooltip';
    this.tooltip.hidden = true;
    container.appendChild(this.tooltip);
    this.labelLayer = document.createElement('div');
    this.labelLayer.className = 'part-labels';
    this.labelLayer.hidden = true;
    container.appendChild(this.labelLayer);
    this.listen(renderer.domElement);
  }

  // ---------- picking parts of the diorama ----------

  listen(element) {
    let downAt = null;
    element.addEventListener('pointermove', (event) => {
      if (!this.active) return;
      const rect = element.getBoundingClientRect();
      this.pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      this.pointerDirty = true;
    });
    element.addEventListener('pointerleave', () => this.setHovered(null));
    element.addEventListener('pointerdown', (event) => { downAt = [event.clientX, event.clientY]; });
    element.addEventListener('pointerup', (event) => {
      if (!this.active || !downAt) return;
      const moved = Math.hypot(event.clientX - downAt[0], event.clientY - downAt[1]);
      downAt = null;
      if (moved > 6) return;
      const target = this.pick();
      if (target) this.onSelectLandmark(target.userData.landmarkId);
    });
  }

  /**
   * The tagged part under the pointer, if any. The monuments are slender and small on the
   * stage, so instead of a ray test each part's screen rectangle, padded by a few pixels,
   * is tested, and the nearest containing one wins.
   */
  pick() {
    const pickables = this.current?.pickables ?? [];
    if (!pickables.length || !this.size) return null;
    const { width, height } = this.size;
    const px = ((this.pointer.x + 1) / 2) * width;
    const py = ((1 - this.pointer.y) / 2) * height;
    const margin = 18;
    const corner = new THREE.Vector3();
    let best = null;
    for (const object of pickables) {
      const box = new THREE.Box3().setFromObject(object);
      let [minX, maxX, minY, maxY] = [Infinity, -Infinity, Infinity, -Infinity];
      for (let k = 0; k < 8; k++) {
        corner.set(k & 1 ? box.max.x : box.min.x, k & 2 ? box.max.y : box.min.y, k & 4 ? box.max.z : box.min.z).project(this.camera);
        if (corner.z > 1) continue; // behind the camera
        const sx = ((corner.x + 1) / 2) * width;
        const sy = ((1 - corner.y) / 2) * height;
        [minX, maxX, minY, maxY] = [Math.min(minX, sx), Math.max(maxX, sx), Math.min(minY, sy), Math.max(maxY, sy)];
      }
      if (px < minX - margin || px > maxX + margin || py < minY - margin || py > maxY + margin) continue;
      const distance = Math.hypot(px - (minX + maxX) / 2, py - (minY + maxY) / 2);
      if (!best || distance < best.distance) best = { object, distance };
    }
    return best?.object ?? null;
  }

  setHovered(target) {
    if (target === this.hovered) return;
    if (this.hovered) setGlow(this.hovered, false);
    this.hovered = target;
    if (target) {
      setGlow(target, true);
      this.tooltip.textContent = landmarkText(target.userData.landmarkId).name;
    }
    this.tooltip.hidden = !target;
    this.renderer.domElement.style.cursor = target ? 'pointer' : '';
    this.invalidate();
  }

  /** Keeps the tooltip pinned above the hovered part as the diorama turns. */
  placeTooltip() {
    if (!this.hovered || !this.size) return;
    const box = new THREE.Box3().setFromObject(this.hovered);
    const top = box.getCenter(new THREE.Vector3()).setY(box.max.y).project(this.camera);
    this.tooltip.style.left = `${((top.x + 1) / 2) * this.size.width}px`;
    this.tooltip.style.top = `${((1 - top.y) / 2) * this.size.height}px`;
  }

  show(landmark) {
    this.setHovered(null);
    this.stage.clear();
    this.current = this.cache.get(landmark.id) ?? this.build(landmark);
    this.cache.set(landmark.id, this.current);
    const { wrapper, radius, height } = this.current;
    this.stage.add(wrapper);
    this.labelLayer.replaceChildren(...this.current.labels.map(({ element }) => element));
    this.refreshLabels();

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
    const pickables = [];
    const labels = [];
    wrapper.traverse((object) => {
      if (object.userData.animate) animated.push(object.userData.animate);
      if (object.userData.landmarkId) pickables.push(object);
      if (object.userData.part) {
        const element = document.createElement('div');
        element.className = 'part-label';
        labels.push({ anchor: object, element, key: object.userData.part });
      }
    });
    // With reduced motion the parts never move; pose each once at its starting position.
    if (QUALITY.reducedMotion) for (const animate of animated) animate(0, 0);
    return {
      wrapper,
      animated,
      pickables,
      labels,
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

  /** Writes the part labels in the current language; their sizes are measured again when next placed. */
  refreshLabels() {
    for (const label of this.current?.labels ?? []) {
      label.element.textContent = partText(label.key);
      label.width = 0;
    }
    this.dirty = true;
  }

  /**
   * Pins each part label above its anchor. Nearer labels are placed first,
   * and one that would overlap a label already placed is hidden, so a
   * cluster of parts never turns into a heap of text.
   */
  placeLabels() {
    const labels = this.current?.labels ?? [];
    if (!labels.length || !this.size) return;
    const { width, height } = this.size;
    const point = new THREE.Vector3();
    for (const label of labels) {
      label.anchor.getWorldPosition(point).project(this.camera);
      label.depth = point.z;
      label.x = ((point.x + 1) / 2) * width;
      label.y = ((1 - point.y) / 2) * height;
    }
    const placed = [];
    for (const label of [...labels].sort((a, b) => a.depth - b.depth)) {
      const { element } = label;
      if (label.depth > 1 || label.x < 0 || label.x > width || label.y < 0 || label.y > height) {
        element.hidden = true;
        continue;
      }
      element.hidden = false;
      if (!label.width) [label.width, label.height] = [element.offsetWidth, element.offsetHeight];
      const rect = { left: label.x - label.width / 2, right: label.x + label.width / 2, top: label.y - label.height, bottom: label.y };
      const crowded = placed.some((other) => rect.left < other.right + LABEL_GAP && rect.right > other.left - LABEL_GAP
        && rect.top < other.bottom + LABEL_GAP && rect.bottom > other.top - LABEL_GAP);
      element.hidden = crowded;
      if (crowded) continue;
      placed.push(rect);
      element.style.transform = `translate(${label.x}px, ${label.y}px) translate(-50%, -100%)`;
    }
  }

  setActive(active) {
    this.active = active;
    this.labelLayer.hidden = !active;
    this.controls.enabled = active;
    if (!active) this.setHovered(null);
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
    if (this.active && this.pointerDirty) {
      this.pointerDirty = false;
      this.setHovered(this.pick());
    }
    if (this.hovered) this.placeTooltip();
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
    if (this.active) this.placeLabels();
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

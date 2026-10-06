import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createLights, createSky } from '../world/environment.js';
import { createTerrain } from '../world/terrain.js';
import { createCityFabric } from '../world/cityFabric.js';
import { createShipping } from '../world/shipping.js';
import { createRouteFollower } from '../world/motion.js';
import { createLabel, createLabelRenderer, setLabelText } from '../world/labels.js';
import { labelText, landmarkText, regionText } from '../i18n/index.js';
import { ease, tween } from '../util/tween.js';
import { standsIn } from '../data/timeline.js';
import { toWorld } from '../util/geo.js';
import { applyViewInsets } from '../util/viewport.js';
import { LAND_HEIGHT, METERS_TO_MAP, PLACE_LABELS, WATER_LABELS } from '../data/geography.js';

const HORIZON = 0xe9d7b6;
const HOME = { position: new THREE.Vector3(-4, 112, 98), target: new THREE.Vector3(-4, 0, -1) };

/**
 * The overview map: terrain, landmarks at exaggerated scale, the city
 * fabric, labels, hover highlighting, clicking and camera flights.
 */
export class MapView {
  constructor({ renderer, container, landmarks, regions, onSelectLandmark, onSelectRegion }) {
    this.renderer = renderer;
    this.onSelectLandmark = onSelectLandmark;
    this.active = true;
    this.hovered = null;
    this.returnView = null;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(HORIZON, 140, 460);
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 3000);
    this.camera.position.copy(HOME.position);

    this.controls = new OrbitControls(this.camera, renderer.domElement);
    Object.assign(this.controls, {
      enableDamping: true,
      dampingFactor: 0.08,
      screenSpacePanning: false,
      minDistance: 2.5,
      maxDistance: 240,
      maxPolarAngle: 1.36,
    });
    this.controls.target.copy(HOME.target);

    this.sky = createSky({ horizon: HORIZON });
    this.scene.add(this.sky, createLights({ extent: 95, mapSize: 4096, distance: 220 }).group);
    this.scene.add(createTerrain());

    this.entries = landmarks.map((landmark) => this.placeLandmark(landmark));
    this.scene.add(createCityFabric({ keepOut: this.entries.flatMap((entry) => entry.keepOut) }));
    this.scene.add(createShipping());

    this.labelRenderer = createLabelRenderer(container);
    this.addLabels(regions, onSelectRegion);

    this.animated = [];
    this.scene.traverse((object) => {
      if (object.userData.animate) this.animated.push(object.userData.animate);
    });

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.pointerDirty = false;
    this.listen(renderer.domElement);
  }

  // ---------- building ----------

  placeLandmark(landmark) {
    const { map } = landmark;
    const model = landmark.create({ lod: 'map' });
    const holder = new THREE.Group();
    holder.userData.landmarkId = landmark.id;
    holder.add(model);

    if (!map.absolute) {
      holder.scale.setScalar(map.scale * METERS_TO_MAP);
      if (map.route) {
        holder.userData.animate = createRouteFollower(holder, map.route, { speed: map.speed });
        holder.userData.animate(0);
      } else {
        holder.position.copy(toWorld(map.at, LAND_HEIGHT));
        holder.rotation.y = THREE.MathUtils.degToRad(map.rotation ?? 0);
      }
    }
    this.scene.add(holder);
    holder.updateMatrixWorld(true);
    holder.userData.baseScaleY = holder.scale.y;

    const box = new THREE.Box3().setFromObject(holder);
    const centre = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const keepOut = map.absolute || map.route
      ? model.userData.keepOut ?? []
      : [[centre.x, -centre.z, Math.max(size.x, size.z) * 0.55]];
    return { landmark, holder, keepOut, label: null };
  }

  addLabels(regions, onSelectRegion) {
    // Each label remembers how to read its text, so it can follow language changes.
    this.labels = [];
    const add = (parent, position, read, options) => {
      const label = createLabel({ ...read(), ...options });
      label.position.copy(position);
      parent.add(label);
      this.labels.push({ label, read });
      return label;
    };

    for (const entry of this.entries) {
      const { landmark, holder } = entry;
      const box = new THREE.Box3().setFromObject(holder);
      const top = box.getCenter(new THREE.Vector3()).setY(box.max.y + 0.15);
      entry.label = add(holder, holder.worldToLocal(top), () => ({ text: landmarkText(landmark.id).name }), {
        kind: 'landmark',
        anchorBottom: true,
        onClick: () => this.onSelectLandmark(landmark.id),
        onHover: (on) => this.setHovered(on ? entry : null),
      });
    }

    for (const region of regions.filter((r) => r.labelAt)) {
      const read = () => ({ text: regionText(region.id).name, sub: regionText(region.id).subtitle });
      add(this.scene, toWorld(region.labelAt, 3), read, { kind: 'region', onClick: () => onSelectRegion(region.id) });
    }
    for (const [list, kind, height] of [[WATER_LABELS, 'water', 0.3], [PLACE_LABELS, 'place', 1.8]]) {
      for (const { id, at } of list) {
        add(this.scene, toWorld(at, height), () => ({ text: labelText(id).name, sub: labelText(id).sub }), { kind });
      }
    }
  }

  /** Re-reads every label's text in the current language. */
  refreshLabels() {
    for (const { label, read } of this.labels) {
      const { text, sub } = read();
      setLabelText(label, text, sub);
    }
  }

  // ---------- interaction ----------

  listen(element) {
    let downAt = null;
    element.addEventListener('pointermove', (event) => {
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
      const entry = this.pick();
      if (entry) this.onSelectLandmark(entry.landmark.id);
    });
  }

  pick() {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const shown = this.entries.filter((entry) => entry.holder.visible).map((entry) => entry.holder);
    const [hit] = this.raycaster.intersectObjects(shown, true);
    if (!hit) return null;
    for (let node = hit.object; node; node = node.parent) {
      if (node.userData.landmarkId) return this.entries.find((entry) => entry.holder === node);
    }
    return null;
  }

  setHovered(entry) {
    if (entry === this.hovered) return;
    if (this.hovered) highlight(this.hovered, false);
    this.hovered = entry;
    if (entry) highlight(entry, true);
    this.renderer.domElement.style.cursor = entry ? 'pointer' : '';
  }

  /** Shows only the landmarks that existed in `year` (null shows them all); newcomers rise from the ground. */
  setYear(year) {
    for (const entry of this.entries) {
      const { holder, label } = entry;
      const visible = standsIn(entry.landmark, year);
      if (visible === holder.visible) continue;
      const base = holder.userData.baseScaleY;
      const rise = (entry.rise ?? 0) + 1; // a newer change cancels a running rise
      entry.rise = rise;
      holder.visible = label.visible = visible;
      holder.scale.y = base;
      if (visible) {
        tween({ duration: 600, easing: ease.outBack, onUpdate: (t) => {
          if (entry.rise === rise) holder.scale.y = base * Math.max(0.02, t);
        } });
      }
    }
    if (this.hovered && !this.hovered.holder.visible) this.setHovered(null);
  }

  // ---------- camera ----------

  flyTo(position, target, duration = 1300) {
    const fromPosition = this.camera.position.clone();
    const fromTarget = this.controls.target.clone();
    this.controls.enabled = false;
    return tween({
      duration,
      onUpdate: (t) => {
        this.camera.position.lerpVectors(fromPosition, position, t);
        this.controls.target.lerpVectors(fromTarget, target, t);
      },
    }).then(() => {
      this.controls.enabled = this.active;
    });
  }

  /** Flies to frame a target from the current compass direction. */
  frame(target, distance, elevation) {
    const direction = this.camera.position.clone().sub(this.controls.target).setY(0);
    if (direction.lengthSq() < 1e-6) direction.set(0, 0, 1);
    direction.normalize().multiplyScalar(Math.cos(elevation) * distance);
    const position = target.clone().add(direction).setY(target.y + Math.sin(elevation) * distance);
    return this.flyTo(position, target);
  }

  focusLandmark(id) {
    const entry = this.entries.find((candidate) => candidate.landmark.id === id);
    const box = new THREE.Box3().setFromObject(entry.holder);
    const size = box.getSize(new THREE.Vector3());
    const radius = Math.max(size.x, size.z, size.y * 1.5) / 2;
    if (!this.returnView) this.returnView = { position: this.camera.position.clone(), target: this.controls.target.clone() };
    this.setHovered(null);
    return this.frame(box.getCenter(new THREE.Vector3()), THREE.MathUtils.clamp(radius * 3.2, 5, 70), 0.72);
  }

  focusRegion(region) {
    this.returnView = null;
    return this.frame(toWorld(region.view.target, 0), region.view.distance, 0.95);
  }

  restoreView() {
    const view = this.returnView;
    this.returnView = null;
    return view ? this.flyTo(view.position, view.target, 1100) : Promise.resolve();
  }

  /** The opening view, pulled back on narrow screens so the whole city fits. */
  homeView() {
    const { width, height } = this.size ?? { width: 16, height: 10 };
    const { left = 0, right = 0 } = this.insets ?? {};
    const pullBack = THREE.MathUtils.clamp(1.27 / ((width - left - right) / height), 1, 2.6);
    const offset = HOME.position.clone().sub(HOME.target).multiplyScalar(pullBack);
    return { position: HOME.target.clone().add(offset), target: HOME.target.clone() };
  }

  jumpHome() {
    const { position, target } = this.homeView();
    this.camera.position.copy(position);
    this.controls.target.copy(target);
    this.controls.update();
  }

  resetView() {
    this.returnView = null;
    const { position, target } = this.homeView();
    return this.flyTo(position, target);
  }

  // ---------- frame loop ----------

  setActive(active) {
    this.active = active;
    this.controls.enabled = active;
    if (!active) this.setHovered(null);
  }

  resize(width, height) {
    this.size = { width, height };
    applyViewInsets(this.camera, width, height, this.insets);
    this.labelRenderer.setSize(width, height);
  }

  /** Keeps the view centred in the screen area left free by the UI panels. */
  setInsets(insets) {
    this.insets = insets;
    if (this.size) applyViewInsets(this.camera, this.size.width, this.size.height, insets);
  }

  update(time, delta) {
    this.controls.update();
    this.sky.position.copy(this.camera.position);
    for (const animate of this.animated) animate(time, delta);
    if (this.active && this.pointerDirty && this.controls.enabled) {
      this.pointerDirty = false;
      this.setHovered(this.pick());
    }
  }

  render() {
    this.renderer.render(this.scene, this.camera);
    this.labelRenderer.render(this.scene, this.camera);
  }
}

// ---------- hover highlight ----------

const glowing = new Map();

/** A warm emissive copy of a material, created once and shared. */
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

function highlight(entry, on) {
  entry.label.element.classList.toggle('is-hover', on);
  entry.holder.traverse((object) => {
    if (!object.isMesh || object.material.isShaderMaterial) return;
    if (on) {
      object.userData.restMaterial = object.material;
      object.material = glowingVersion(object.material);
    } else if (object.userData.restMaterial) {
      object.material = object.userData.restMaterial;
      delete object.userData.restMaterial;
    }
  });
}

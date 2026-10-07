import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createLights, createSky } from '../world/environment.js';
import { createTerrain } from '../world/terrain.js';
import { createGround } from '../world/ground.js';
import { createCityFabric } from '../world/cityFabric.js';
import { createShipping } from '../world/shipping.js';
import { createRouteFollower } from '../world/motion.js';
import { createLabel, createLabelRenderer, setLabelText } from '../world/labels.js';
import { landmarkText, regionText } from '../i18n/index.js';
import { ease, tween } from '../util/tween.js';
import { setGlow } from '../util/glow.js';
import { standsIn } from '../data/timeline.js';
import { toWorld } from '../util/geo.js';
import { applyViewInsets } from '../util/viewport.js';
import { QUALITY } from '../util/quality.js';
import { LAND_HEIGHT, METERS_TO_MAP } from '../data/geography.js';

const HORIZON = 0xe9d7b6;
const HOME = { position: new THREE.Vector3(0, 14.50, 18.75), target: new THREE.Vector3(3, 0, 2) };

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
    this.dirty = true; // something to redraw (only consulted with reduced motion)
    this.shadowDirty = true; // the sun's shadow map must be redrawn

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(HORIZON, 100, 340);
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
    this.scene.add(this.sky, createLights({ extent: 70, mapSize: QUALITY.mapShadowSize, distance: 180 }).group);
    // Landmarks first: their footprints become level terraces in the hilly ground.
    this.entries = landmarks.map((landmark) => this.placeLandmark(landmark));
    const grounded = this.entries.filter((entry) => entry.footprint);
    // Landmarks standing on another (map.on) ride on their host's terrace rather than levelling one of their own.
    const terraced = grounded.filter((entry) => !entry.landmark.map.on);
    this.ground = createGround({ footprints: terraced.map((entry) => entry.footprint) });
    for (const { landmark, holder, footprint } of grounded) {
      holder.position.y = LAND_HEIGHT + this.ground.heightAt(footprint.centre) + (landmark.map.lift ?? 0);
      holder.updateMatrixWorld(true);
    }
    // Models built in map coordinates that climb the ground (userData.onGround) finish themselves now that it is known.
    const climbing = [];
    for (const { holder } of this.entries) holder.traverse((object) => { if (object.userData.onGround) climbing.push(object); });
    for (const object of climbing) object.userData.onGround(this.ground);

    this.scene.add(createTerrain(this.ground));
    // Judas trees ring the great landmarks, just outside their clearings.
    const erguvanSites = grounded.filter(({ landmark }) => landmark.map.erguvans).map(({ landmark, footprint }) => ({
      ...footprint, clearance: landmark.map.clearance ?? 0.25, count: landmark.map.erguvans,
    }));
    this.scene.add(createCityFabric({ ground: this.ground, keepOut: this.entries.flatMap((entry) => entry.keepOut), erguvanSites }));
    this.scene.add(createShipping());

    this.labelRenderer = createLabelRenderer(container, { canvas: renderer.domElement });
    this.addLabels(regions, onSelectRegion);

    this.animated = [];
    this.scene.traverse((object) => {
      if (object.userData.animate) this.animated.push(object.userData.animate);
    });
    // With reduced motion the ships never sail; put each at its starting place once.
    if (QUALITY.reducedMotion) for (const animate of this.animated) animate(0, 0);

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
    const footprint = new THREE.Box3().setFromObject(model); // in the holder's own frame, before placing it

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

    if (map.absolute || map.route) {
      const keepOut = (model.userData.keepOut ?? []).map(([e, n, r]) => ([pe, pn]) => Math.hypot(pe - e, pn - n) < r);
      return { landmark, holder, keepOut, footprint: null, label: null };
    }
    // The landmark's rotated footprint: levelled into a terrace, and kept free of houses and trees.
    // One standing on another landmark lies inside its host's footprint, which already does both.
    const distance = distanceOutside(holder, footprint);
    const clearance = map.clearance ?? 0.25;
    const keepOut = map.on ? [] : [(point) => distance(point) < clearance];
    return { landmark, holder, keepOut, footprint: { centre: map.at, distance }, label: null };
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
        minor: Boolean(landmark.map.on),
        anchorBottom: true,
        onClick: () => this.onSelectLandmark(landmark.id),
        onHover: (on) => this.setHovered(on ? entry : null),
      });
    }
    this.updateLabelVisibility();

    // Districts float high over their area; waters lie on the surface and the Mese sits just above its hills.
    const lift = { water: 0.3, place: 1.8 };
    for (const region of regions.filter((r) => r.labelAt)) {
      const kind = region.labelKind ?? 'region';
      const read = () => ({ text: regionText(region.id).name, sub: regionText(region.id).subtitle });
      const height = kind === 'region' ? 3 : lift[kind] + this.ground.heightAt(region.labelAt);
      add(this.scene, toWorld(region.labelAt, height), read, { kind, onClick: () => onSelectRegion(region.id) });
    }
  }

  /** Re-reads every label's text in the current language. */
  refreshLabels() {
    for (const { label, read } of this.labels) {
      const { text, sub } = read();
      setLabelText(label, text, sub);
    }
    this.dirty = true;
  }

  /** Labels of small landmarks (map.labelWithin) appear only once the camera is close enough to tell them apart. */
  updateLabelVisibility() {
    const position = new THREE.Vector3();
    for (const { landmark, holder, label } of this.entries) {
      const within = landmark.map.labelWithin;
      if (!within || !holder.visible) continue;
      label.getWorldPosition(position);
      const visible = position.distanceTo(this.camera.position) < within;
      if (visible !== label.visible) this.dirty = true;
      label.visible = visible;
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
    this.dirty = true;
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
      this.invalidate();
      if (visible && !QUALITY.reducedMotion) {
        tween({ duration: 600, easing: ease.outBack, onUpdate: (t) => {
          if (entry.rise !== rise) return;
          holder.scale.y = base * Math.max(0.02, t);
          this.invalidate();
        } });
      }
    }
    if (this.hovered && !this.hovered.holder.visible) this.setHovered(null);
  }

  /** The scene's shapes changed: redraw it, shadows included. */
  invalidate() {
    this.dirty = true;
    this.shadowDirty = true;
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
        this.dirty = true;
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
    this.dirty = true;
    if (!active) this.setHovered(null);
  }

  resize(width, height) {
    this.size = { width, height };
    applyViewInsets(this.camera, width, height, this.insets);
    this.labelRenderer.setSize(width, height);
    this.dirty = true;
  }

  /** Keeps the view centred in the screen area left free by the UI panels. */
  setInsets(insets) {
    this.insets = insets;
    if (this.size) applyViewInsets(this.camera, this.size.width, this.size.height, insets);
    this.dirty = true;
  }

  /** Advances the scene; returns whether anything on screen changed. */
  update(time, delta) {
    const moved = this.controls.update();
    this.sky.position.copy(this.camera.position);
    if (!QUALITY.reducedMotion) for (const animate of this.animated) animate(time, delta);
    this.updateLabelVisibility();
    if (this.active && this.pointerDirty && this.controls.enabled) {
      this.pointerDirty = false;
      this.setHovered(this.pick());
    }
    const changed = moved || this.dirty;
    this.dirty = false;
    return changed;
  }

  render(renderer = this.renderer) {
    if (this.shadowDirty) {
      renderer.shadowMap.needsUpdate = true;
      this.shadowDirty = false;
    }
    renderer.render(this.scene, this.camera);
    this.labelRenderer.render(this.scene, this.camera);
  }
}

/** Distance in map units from a point to a placed model's rotated footprint (0 inside it). */
function distanceOutside(holder, footprint) {
  const toLocal = holder.matrixWorld.clone().invert();
  const local = new THREE.Vector3();
  return ([east, north]) => {
    local.set(east, holder.position.y, -north).applyMatrix4(toLocal);
    const dx = Math.max(footprint.min.x - local.x, 0, local.x - footprint.max.x);
    const dz = Math.max(footprint.min.z - local.z, 0, local.z - footprint.max.z);
    return Math.hypot(dx, dz) * holder.scale.x;
  };
}

// ---------- hover highlight ----------

/** A warm emissive copy of a material, created once and shared. */
function highlight(entry, on) {
  entry.label.element.classList.toggle('is-hover', on);
  setGlow(entry.holder, on);
}

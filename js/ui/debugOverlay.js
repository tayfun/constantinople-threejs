import * as THREE from 'three';
import { h } from './dom.js';
import { QUALITY } from '../util/quality.js';

const STORAGE_KEY = 'constantinople.debug';
const REFRESH_MS = 250; // the readout is rewritten a few times a second, not every frame

const deg = (radians) => `${THREE.MathUtils.radToDeg(radians).toFixed(1)}°`;
const vec = (v) => `${v.x.toFixed(2)}, ${v.y.toFixed(2)}, ${v.z.toFixed(2)}`;
const count = (n) => n.toLocaleString('en');

/**
 * A corner readout for developers, switched on from the settings menu:
 * frame rate, the camera's position and orientation, and what the
 * renderer drew. The choice is remembered between visits.
 */
export class DebugOverlay {
  constructor(parent) {
    this.element = h('pre', { class: 'debug-overlay', 'aria-hidden': 'true', hidden: true });
    parent.append(this.element);
    this.frames = 0;
    this.ticks = 0;
    this.since = performance.now();
    this.setEnabled(readSaved());
  }

  get enabled() {
    return !this.element.hidden;
  }

  setEnabled(enabled) {
    this.element.hidden = !enabled;
    this.frames = this.ticks = 0;
    this.since = performance.now();
    try {
      localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
    } catch {
      // Storage may be unavailable (private mode); the choice then lasts for this visit.
    }
  }

  /** Called once per pass of the frame loop; `drawn` tells whether the scene was rendered this time. */
  frame({ mode, view, renderer, drawn }) {
    if (!this.enabled) return;
    this.ticks += 1;
    if (drawn) this.frames += 1;
    const now = performance.now();
    const elapsed = now - this.since;
    if (elapsed < REFRESH_MS) return;
    const fps = (this.frames * 1000) / elapsed;
    const ms = elapsed / Math.max(this.ticks, 1);
    this.frames = this.ticks = 0;
    this.since = now;

    const { camera, controls } = view;
    const { render, memory } = renderer.info;
    const direction = camera.getWorldDirection(new THREE.Vector3());
    const size = renderer.getSize(new THREE.Vector2());
    this.element.textContent = [
      `FPS        ${fps.toFixed(0)}  (${ms.toFixed(1)} ms/tick)`,
      `View       ${mode}`,
      `Camera     ${vec(camera.position)}`,
      `Target     ${vec(controls.target)}`,
      `Direction  ${vec(direction)}`,
      `Distance   ${camera.position.distanceTo(controls.target).toFixed(2)}`,
      `Azimuth    ${deg(controls.getAzimuthalAngle())}`,
      `Polar      ${deg(controls.getPolarAngle())}`,
      `FOV        ${camera.fov.toFixed(1)}°`,
      `Draw calls ${count(render.calls)}`,
      `Triangles  ${count(render.triangles)}`,
      `Geometries ${count(memory.geometries)}  Textures ${count(memory.textures)}`,
      `Canvas     ${size.x}×${size.y} @${renderer.getPixelRatio()}x`,
      `Quality    ${QUALITY.tier}${QUALITY.reducedMotion ? ', reduced motion' : ''}`,
    ].join('\n');
  }
}

function readSaved() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

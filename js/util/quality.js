import * as THREE from 'three';

/**
 * Rendering quality chosen once from what the device tells us. Phones,
 * tablets and small machines get a lighter setting: a lower pixel ratio,
 * smaller shadow maps, half-size painted textures,
 * dioramas that give back their GPU memory once left, and a map with half
 * as many leafy trees, each of fewer blobs: the trees are most of the map's
 * triangles, and a phone's tiled GPU can fault binning too many of them. A phone that runs
 * out of GPU memory loses its WebGL context, and Chrome then blocks WebGL
 * for the whole site until the browser is restarted. Visitors who asked
 * their system for reduced motion get a still scene that only redraws
 * when something changes.
 *
 * Both tiers filter shadows with PCFSoftShadowMap. Plain PCFShadowMap (17
 * taps) resets the GPU of the Pixel 10's PowerVR DXT within ~35 frames, in
 * three.js's own shadow example too; soft PCF, basic and VSM run fine.
 */

function isModestDevice() {
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const memory = navigator.deviceMemory; // GB, Chromium only; undefined elsewhere
  const cores = navigator.hardwareConcurrency;
  return coarse || (memory !== undefined && memory <= 4) || (cores !== undefined && cores <= 4);
}

const TIERS = {
  high: {
    tier: 'high',
    maxPixelRatio: 1.5,
    shadowType: THREE.PCFSoftShadowMap,
    mapShadowSize: 4096,
    detailShadowSize: 2048,
    textureScale: 1,
    releaseDioramas: false,
    treeDensity: 1,
    crownBlobs: 3,
  },
  low: {
    tier: 'low',
    maxPixelRatio: 1,
    shadowType: THREE.PCFSoftShadowMap,
    mapShadowSize: 2048,
    detailShadowSize: 1024,
    textureScale: 0.5,
    releaseDioramas: true,
    treeDensity: 0.5,
    crownBlobs: 2,
  },
};

export const QUALITY = Object.freeze({
  ...TIERS[isModestDevice() ? 'low' : 'high'],
  reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
});

export const pixelRatio = () => Math.min(window.devicePixelRatio || 1, QUALITY.maxPixelRatio);

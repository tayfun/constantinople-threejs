import * as THREE from 'three';

/**
 * Rendering quality chosen once from what the device tells us. Phones,
 * tablets and small machines get a lighter setting: a lower pixel ratio,
 * smaller shadow maps and cheaper shadow filtering. Visitors who asked
 * their system for reduced motion get a still scene that only redraws
 * when something changes.
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
  },
  low: {
    tier: 'low',
    maxPixelRatio: 1,
    shadowType: THREE.PCFShadowMap,
    mapShadowSize: 2048,
    detailShadowSize: 1024,
  },
};

export const QUALITY = Object.freeze({
  ...TIERS[isModestDevice() ? 'low' : 'high'],
  reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
});

export const pixelRatio = () => Math.min(window.devicePixelRatio || 1, QUALITY.maxPixelRatio);

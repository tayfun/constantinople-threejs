import * as THREE from 'three';
import * as textures from './textures.js';
import { createWaterMaterial } from './water.js';

/** Shared material palette for every model. Created once, reused everywhere. */

const standard = (params) => new THREE.MeshStandardMaterial({ roughness: 0.88, metalness: 0, ...params });

export const materials = {
  // masonry
  banded: standard({ map: textures.bandedMasonry() }),
  stone: standard({ map: textures.ashlar() }),
  stoneDark: standard({ map: textures.ashlar(), color: 0x9b9182 }),
  rubble: standard({ map: textures.rubble() }),
  marble: standard({ map: textures.marble(), roughness: 0.45 }),
  brick: standard({ map: textures.brick() }),
  plaster: standard({ map: textures.plaster() }),
  plasterOchre: standard({ map: textures.plaster(), color: 0xf0c49a }),
  granite: standard({ map: textures.granite(), roughness: 0.5 }),
  hieroglyphs: standard({ map: textures.hieroglyphs(), roughness: 0.5 }),
  porphyry: standard({ color: 0x7a2a44, roughness: 0.45 }),

  // roofs and metal
  roof: standard({ map: textures.roofTiles(), roughness: 0.75 }),
  lead: standard({ map: textures.lead(), roughness: 0.5, metalness: 0.4 }),
  // The scenes have no environment map, and a fully metallic surface with nothing to reflect
  // renders near-black; the metals keep enough dielectric response to shade in the sunlight.
  gold: standard({ color: 0xf0c552, metalness: 0.6, roughness: 0.3 }),
  bronze: standard({ color: 0x8a5c30, metalness: 0.55, roughness: 0.45 }),
  gildedBronze: standard({ map: textures.bronzePlates(), metalness: 0.5, roughness: 0.38 }),
  iron: standard({ color: 0x38373b, metalness: 0.85, roughness: 0.5 }),

  // timber, cloth, ships
  wood: standard({ map: textures.wood() }),
  hull: standard({ map: textures.wood(), color: 0xd0a682, side: THREE.DoubleSide }),
  sail: standard({ map: textures.sailcloth(), side: THREE.DoubleSide, roughness: 1 }),
  imperialPurple: standard({ color: 0x5c1f63, side: THREE.DoubleSide }),
  rope: standard({ color: 0x8a7552 }),

  // details
  opening: standard({ color: 0x1b1612, roughness: 1 }),
  fire: new THREE.MeshBasicMaterial({ color: 0xffb347 }),

  // ground and planting
  grass: standard({ map: textures.grass() }),
  sand: standard({ map: textures.sand() }),
  dirt: standard({ map: textures.dirt() }),
  paving: standard({ map: textures.paving() }),
  mosaic: standard({ map: textures.mosaic(), roughness: 0.6 }),
  foliage: standard({ color: 0x527f48, vertexColors: true, roughness: 0.95 }),
  foliageLight: standard({ color: 0x7a9c4e, vertexColors: true, roughness: 0.95 }),
  trunk: standard({ color: 0x5b4331 }),
  blossom: standard({ color: 0xe57cc0, vertexColors: true, roughness: 0.9 }), // the erguvan's magenta
  erguvanBark: standard({ color: 0x4d4440, roughness: 0.95 }), // the Judas tree's dark grey-brown bark
  erguvanLeaves: standard({ color: 0x8ab44e, vertexColors: true, side: THREE.DoubleSide, roughness: 0.8 }), // fresh spring green
  petals: standard({ color: 0xe3a6cf, roughness: 1 }),

  water: createWaterMaterial({ scale: 0.12 }),
  waterSide: standard({ color: 0x1f4f63, roughness: 0.3 }),
};

const variants = new Map();

/** A colour-tinted variant of a palette material, shared per (name, colour). */
export function tinted(name, color) {
  const key = `${name}:${color}`;
  if (!variants.has(key)) {
    const material = materials[name].clone();
    material.color = new THREE.Color(color);
    variants.set(key, material);
  }
  return variants.get(key);
}

/** Plain double-sided cloth of a given colour (awnings, banners, team colours). */
export function cloth(color) {
  const key = `cloth:${color}`;
  if (!variants.has(key)) variants.set(key, standard({ color, side: THREE.DoubleSide, roughness: 0.95 }));
  return variants.get(key);
}

/** A double-sided banner material painted with a heraldic design. */
export function banner(kind) {
  const key = `banner:${kind}`;
  if (!variants.has(key)) variants.set(key, standard({ map: textures.flag(kind), side: THREE.DoubleSide, roughness: 0.95 }));
  return variants.get(key);
}

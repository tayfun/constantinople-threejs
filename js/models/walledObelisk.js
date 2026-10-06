import * as THREE from 'three';
import { materials as M } from './lib/materials.js';
import { box, mesh, obeliskGeometry } from './lib/primitives.js';
import { finalizeModel } from './lib/merge.js';
import { walledObeliskArt } from './lib/obeliskArt.js';

/**
 * The Walled Obelisk, as it stands today: a 32 m shaft of roughly dressed
 * limestone blocks at the sphendone end of the spina, its faces pocked with
 * the holes that once pinned the gilded bronze plates Constantine VII gave
 * it (stripped by the Crusaders in 1204), under a shallow pyramidal cap. It
 * rises from a marble pedestal block carrying the emperor's inscription, on
 * a cracked slab and two marble steps. Proportions in metres, from
 * photographs. North is +x (along the spina), east is +z.
 */
export const WALLED_OBELISK = {
  steps: [{ width: 5.4, height: 0.4 }, { width: 4.6, height: 0.4 }],
  slab: { width: 4.0, height: 0.3 },
  pedestal: { width: 3.6, height: 1.5 },
  shaft: { base: 3.4, top: 1.9, height: 28.7 },
  cap: 0.6,
};

export function createWalledObelisk({ lod = 'detail' } = {}) {
  const detail = lod === 'detail';
  const monument = new THREE.Group();
  const { steps, slab, pedestal, shaft, cap } = WALLED_OBELISK;
  const stone = detail ? detailMaterials() : null;
  let y = 0;

  for (const step of steps) {
    monument.add(box(step.width, step.height, step.width, M.marble, 0, y, 0));
    y += step.height;
  }
  monument.add(box(slab.width, slab.height, slab.width, M.marble, 0, y, 0));
  y += slab.height;

  // The pedestal block: the inscription faces north, up the spina towards the Obelisk of Theodosius.
  if (detail) {
    const block = new THREE.Mesh(new THREE.BoxGeometry(pedestal.width, pedestal.height, pedestal.width), stone.pedestal);
    block.position.y = y + pedestal.height / 2;
    block.castShadow = block.receiveShadow = true;
    monument.add(block);
  } else {
    monument.add(box(pedestal.width, pedestal.height, pedestal.width, M.marble, 0, y, 0));
  }
  y += pedestal.height;

  if (detail) {
    const masonry = new THREE.Mesh(obeliskGeometry({ ...shaft, tip: cap }), [...stone.faces, stone.cap]);
    masonry.position.y = y;
    masonry.castShadow = masonry.receiveShadow = true;
    monument.add(masonry);
  } else {
    const toRadius = (side) => side / Math.SQRT2;
    const plain = new THREE.CylinderGeometry(toRadius(shaft.top), toRadius(shaft.base), shaft.height, 4, 1).rotateY(Math.PI / 4).translate(0, shaft.height / 2, 0);
    // Metre-based UVs around the four faces so the ashlar keeps its size.
    const uv = plain.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 12, uv.getY(i) * shaft.height);
    monument.add(mesh(plain, M.stone, 0, y, 0));
    const tip = new THREE.ConeGeometry(toRadius(shaft.top), cap, 4).rotateY(Math.PI / 4).translate(0, cap / 2, 0);
    monument.add(mesh(tip, M.stone, 0, y + shaft.height, 0));
  }

  return finalizeModel(monument);
}

let materials = null;

/** Materials for the detailed obelisk, built once from the painted textures; each painting doubles as a bump map so joints and holes sink in. */
function detailMaterials() {
  if (materials) return materials;
  const art = walledObeliskArt(WALLED_OBELISK.shaft);
  const carved = (map, bumpScale) => new THREE.MeshStandardMaterial({ map, bumpMap: map, bumpScale, roughness: 0.9 });
  const plain = carved(art.pedestal, 0.015);
  materials = {
    faces: art.faces.map((map) => carved(map, 0.03)),
    cap: new THREE.MeshStandardMaterial({ map: art.cap, roughness: 0.9 }),
    pedestal: [carved(art.inscribed, 0.012), plain, M.marble, M.marble, plain, plain],
  };
  return materials;
}

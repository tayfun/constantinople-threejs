import * as THREE from 'three';
import { materials as M } from './lib/materials.js';
import { box, mesh, obeliskGeometry } from './lib/primitives.js';
import { finalizeModel } from './lib/merge.js';
import { obeliskArt } from './lib/obeliskArt.js';

/**
 * The Obelisk of Theodosius: a granite obelisk of Thutmose III (c. 1450 BC)
 * from Karnak, re-erected in 390 AD by Theodosius I on a marble pedestal
 * carved with the emperor at the races, raised on four bronze blocks.
 *
 * Proportions in metres, measured from photographs. Bottom to top: the
 * two-step limestone substructure (c. 7 m square in reality, kept narrower
 * here so the monument fits the spina) and a plain socle; the lower block
 * with the chariot race (south), the raising of the obelisk (north) and the
 * Latin (east) and Greek (west) inscriptions; the arcaded
 * block with porphyry stones at its corners; the upper block with the
 * imperial scenes under its cornice; the bronze cubes; the shaft, 18.5 m
 * with its pyramidion, carved with one column of hieroglyphs on each face.
 * North is +x (along the spina towards the starting gates), east is +z.
 */
export const OBELISK = {
  steps: [{ width: 5.6, height: 0.3 }, { width: 4.8, height: 0.3 }],
  socle: 0.25,
  lower: { width: 3.5, height: 1.15 },
  arcade: { width: 2.5, height: 0.62 },
  porphyry: 0.62,
  upper: { width: 3.0, height: 2.15 },
  cornice: 0.14,
  cube: { width: 0.55, height: 0.5, inset: 0.95 },
  shaft: { base: 2.5, top: 1.76, height: 17.2 },
  pyramidion: 1.35,
};

const CORNERS = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

// The bronze cubes under the shaft, green with sixteen centuries of weather.
const weatheredBronze = new THREE.MeshStandardMaterial({ color: 0x5c7566, metalness: 0.55, roughness: 0.55 });

export function createObeliskOfTheodosius({ lod = 'detail' } = {}) {
  const detail = lod === 'detail';
  const monument = new THREE.Group();
  const { steps, socle, lower, arcade, porphyry, upper, cornice, cube, shaft, pyramidion } = OBELISK;
  const stone = detail ? detailMaterials() : null;
  let y = 0;

  // The two-step substructure of grey limestone and the plain marble socle under the carved pedestal.
  for (const step of steps) {
    monument.add(box(step.width, step.height, step.width, M.stone, 0, y, 0));
    y += step.height;
  }
  monument.add(box(lower.width + 0.3, socle, lower.width + 0.3, M.marble, 0, y, 0));
  y += socle;

  // The lower block, with its reliefs and inscriptions.
  monument.add(detail ? sidedBox(lower.width, lower.height, y, stone.lower) : box(lower.width, lower.height, lower.width, M.marble, 0, y, 0));
  y += lower.height;

  // The arcaded block, with a porphyry stone at each corner of the pedestal above.
  monument.add(detail ? sidedBox(arcade.width, arcade.height, y, stone.arcade) : box(arcade.width, arcade.height, arcade.width, M.marble, 0, y, 0));
  const inset = upper.width / 2 - porphyry / 2;
  for (const [sx, sz] of CORNERS) monument.add(box(porphyry, arcade.height, porphyry, detail ? stone.porphyry : M.porphyry, sx * inset, y, sz * inset));
  y += arcade.height;

  // The upper block with the imperial scenes, and its projecting cornice.
  const blockHeight = upper.height - cornice;
  monument.add(detail ? sidedBox(upper.width, blockHeight, y, stone.upper) : box(upper.width, blockHeight, upper.width, M.marble, 0, y, 0));
  y += blockHeight;
  monument.add(box(upper.width + 0.16, cornice, upper.width + 0.16, M.marble, 0, y, 0));
  y += cornice;

  // The four bronze cubes on which the shaft rests.
  for (const [sx, sz] of CORNERS) monument.add(box(cube.width, cube.height, cube.width, weatheredBronze, sx * cube.inset, y, sz * cube.inset));
  y += cube.height;

  // The tapering shaft and its pyramidion.
  if (detail) {
    const carved = new THREE.Mesh(obeliskGeometry({ ...shaft, tip: pyramidion }), [...stone.faces, stone.pyramidion]);
    carved.position.y = y;
    carved.castShadow = carved.receiveShadow = true;
    monument.add(carved);
  } else {
    const toRadius = (side) => side / Math.SQRT2;
    const plain = new THREE.CylinderGeometry(toRadius(shaft.top), toRadius(shaft.base), shaft.height, 4, 1).rotateY(Math.PI / 4).translate(0, shaft.height / 2, 0);
    monument.add(mesh(plain, M.hieroglyphs, 0, y, 0));
    const tip = new THREE.ConeGeometry(toRadius(shaft.top), pyramidion, 4).rotateY(Math.PI / 4).translate(0, pyramidion / 2, 0);
    monument.add(mesh(tip, M.granite, 0, y + shaft.height, 0));
  }

  return finalizeModel(monument);
}

// ---------- materials ----------

let materials = null;

/** Materials for the detailed obelisk, built once from the painted textures. Each painting doubles as a bump map, so the carving catches the light. */
function detailMaterials() {
  if (materials) return materials;
  const art = obeliskArt();
  const carvedMarble = (map) => new THREE.MeshStandardMaterial({ map, bumpMap: map, bumpScale: 0.012, roughness: 0.6 });
  const carvedGranite = (map) => new THREE.MeshStandardMaterial({ map, bumpMap: map, bumpScale: 0.02, roughness: 0.52 });
  const sided = (textures) => [carvedMarble(textures.north), carvedMarble(textures.south), M.marble, M.marble, carvedMarble(textures.east), carvedMarble(textures.west)];
  const arcade = carvedMarble(art.arcade);
  materials = {
    lower: sided(art.lower),
    upper: sided(art.upper),
    arcade: [arcade, arcade, M.marble, M.marble, arcade, arcade],
    porphyry: new THREE.MeshStandardMaterial({ map: art.porphyry, roughness: 0.82 }),
    faces: art.faces.map(carvedGranite),
    pyramidion: new THREE.MeshStandardMaterial({ map: art.pyramidion, roughness: 0.52 }),
  };
  return materials;
}

// ---------- geometry ----------

/** A block whose four sides carry their own textures (materials in box order: +x north, -x south, top, bottom, +z east, -z west). */
function sidedBox(width, height, y, sideMaterials) {
  const block = new THREE.Mesh(new THREE.BoxGeometry(width, height, width), sideMaterials);
  block.position.y = y + height / 2;
  block.castShadow = block.receiveShadow = true;
  return block;
}

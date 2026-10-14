import * as THREE from 'three';
import { materials as M } from './lib/materials.js';
import { box, cypress, judasTree, roundTree } from './lib/primitives.js';
import { apse, barrel, doorOn, drum, leadDome, materials as K, windowsOn } from './lib/churchKit.js';
import { finalizeModel } from './lib/merge.js';
import { labelled } from './lib/parts.js';

/**
 * The Church of St Saviour in the Chora, by the land walls near the
 * Charisian Gate, as Theodore Metochites left it about 1321: the naos of
 * Maria Doukaina's rebuilding (1077–1081, raised again about 1120) under a
 * tall drum and lead dome, its cross of vaults showing as rounded gables;
 * the inner and outer narthexes Metochites added along the west, the inner
 * one with two small domes, the outer with one at its south end; the
 * parekklesion, the funerary chapel along the south side, with its own dome
 * and apse; and a two-storey annex along the north. Walls of stone laced
 * with brick. Apse to the east (+x), south is +z; origin = middle of the
 * naos at ground level. The Ottoman minaret is left out.
 */
export function createChora({ lod = 'detail' } = {}) {
  const detail = lod === 'detail';
  const church = new THREE.Group();
  const { banded, lead, plaster } = K;
  const segments = detail ? 24 : 14;

  // The naos: a square box crossed by two lead barrel vaults, a tall square base, the drum and the dome.
  church.add(box(14, 14, 14, banded, 0, 0, 0));
  church.add(box(14.8, 0.8, 14.8, M.stone, 0, 13.6, 0));
  barrel(church, { y: 14.2, radius: 3.6, length: 14.4, axis: 'x', wall: banded, segments: segments / 2 });
  barrel(church, { y: 14.2, radius: 3.54, length: 14.4, axis: 'z', wall: banded, segments: segments / 2 }); // a shade narrower, so the crowns never share a plane
  church.add(box(9.6, 4.4, 9.6, banded, 0, 14.2, 0));
  const top = drum(church, { y: 18.5, radius: 4.5, height: 4.6, sides: 12, material: plaster, window: [1.1, 2.6] });
  leadDome(church, { y: top, radius: 4.8, heightScale: 0.5, segments });
  apse(church, { x: 7, radius: 3.6, height: 11, sides: 3, material: banded, windows: [1, 2.6, 4.2] });
  for (const side of [-1, 1]) windowsOn(church, '+x', 7, side * 5.2, { count: 1, spacing: 0, width: 0.9, height: 2.2, y: 9 });

  // The inner narthex, with two small domes.
  church.add(box(4.3, 11, 17, banded, -9.1, 0, 0));
  church.add(box(5.1, 0.6, 17.8, M.stone, -9.1, 10.7, 0));
  church.add(box(4.9, 0.5, 17.6, lead, -9.1, 11.3, 0));
  for (const z of [-4.2, 4.2]) {
    const small = drum(church, { x: -9.1, y: 11.6, z, radius: 1.8, height: 1.8, sides: 8, material: plaster, window: [0.5, 1], cornice: null });
    leadDome(church, { x: -9.1, y: small, z, radius: 1.95, heightScale: 0.55, segments: segments / 2, finial: null });
  }

  // The outer narthex across the whole west front, its south end opening into the parekklesion, with one dome there.
  labelled(church, 'choraNarthex', () => {
    church.add(box(4.35, 9.5, 25, banded, -13.325, 0, 1.5));
    church.add(box(5.1, 0.6, 25.8, M.stone, -13.325, 9.2, 1.5));
    church.add(box(4.9, 0.5, 25.6, lead, -13.325, 9.8, 1.5));
  });
  const outer = drum(church, { x: -13.3, y: 10.1, z: 11.2, radius: 1.7, height: 1.6, sides: 8, material: plaster, window: [0.5, 0.9], cornice: null });
  leadDome(church, { x: -13.3, y: outer, z: 11.2, radius: 1.85, heightScale: 0.55, segments: segments / 2, finial: null });
  doorOn(church, '-x', -15.5, 1.5, { width: 1.8, height: 3.6 });
  windowsOn(church, '-x', -15.5, 1.5, { count: 6, spacing: 3.8, width: 1.3, height: 2.6, y: 5, skip: (z) => Math.abs(z) < 2 });

  // The parekklesion along the south side: a barrel-vaulted chapel, a dome over its western bay, and its own apse.
  labelled(church, 'parekklesion', () => {
    // Its west end runs into the outer narthex, a hand's breadth past the inner narthex's west face.
    church.add(box(20.35, 11.5, 6, banded, -1.175, 0, 9.9));
    church.add(box(21.15, 0.6, 6.8, M.stone, -1.175, 11.15, 9.9)); // just under the inner narthex's roof, which it runs into
    barrel(church, { x: -1, y: 11.6, z: 9.9, radius: 2.9, length: 20.4, axis: 'x', wall: banded, segments: segments / 2 });
    church.add(box(5.4, 3.4, 5.4, banded, -5.5, 11.6, 9.9));
    const chapel = drum(church, { x: -5.5, y: 14.9, z: 9.9, radius: 2.4, height: 2.6, sides: 8, material: plaster, window: [0.7, 1.5] });
    leadDome(church, { x: -5.5, y: chapel, z: 9.9, radius: 2.6, heightScale: 0.55, segments: segments / 2 });
  });
  apse(church, { x: 9, z: 9.9, radius: 2.6, height: 9.5, sides: 3, material: banded, windows: [0.8, 2, 3.6] });
  windowsOn(church, '+z', 12.9, -1, { count: 4, spacing: 4.4, width: 1.2, height: 2.6, y: 5.5 });

  // The annex along the north: two storeys under a lead roof.
  church.add(box(16.35, 8, 3.6, banded, -3.175, 0, -8.7));
  church.add(box(16.95, 0.5, 4.2, lead, -3.175, 8, -8.7));
  windowsOn(church, '-z', -10.5, -3.05, { count: 4, spacing: 3.6, width: 0.9, height: 1.9, y: 4.6 });

  if (detail) {
    church.add(box(46, 1, 42, M.paving, -3, -1, 1));
    for (const [x, z] of [[14, 17], [-20, 16], [16, -14], [-20, -14], [4, -16]]) church.add(cypress(11, x, 0, z));
    church.add(roundTree(7, 16, 0, 2));
    church.add(judasTree(7, -20, 0, 2, { seed: 6 }));
  } else {
    church.add(box(36, 0.4, 32, M.paving, -3, -0.4, 1));
  }
  return finalizeModel(church);
}

import * as THREE from 'three';
import { materials as M } from './lib/materials.js';
import { box, cypress, judasTree, roundTree } from './lib/primitives.js';
import { apse, barrel, blindArcade, doorOn, drum, leadDome, materials as K, windowsOn } from './lib/churchKit.js';
import { finalizeModel } from './lib/merge.js';
import { labelled } from './lib/parts.js';

/**
 * The Monastery of Christ Pantokrator (1118–1136), founded by John II
 * Komnenos and the Empress Irene on the hill above the Golden Horn: three
 * churches side by side. To the south the monastery's church of Christ
 * Pantokrator, a cross-in-square under a domed drum, with a narthex; to the
 * north the church of the Virgin Eleousa; between them the funerary chapel
 * of St Michael, its two domes over the tombs of the Komnenian emperors.
 * Brick laced with stone; the apses polygonal and patterned with two tiers
 * of blind arches; lead over the vaults' rounded gables and the domes,
 * whose drums are rendered pale. Apses to the east (+x), south is +z;
 * origin = the middle of the chapel at ground level. The narthexes' upper
 * storeys and the monastery's other buildings are left out.
 */
export function createPantokrator({ lod = 'detail' } = {}) {
  const detail = lod === 'detail';
  const church = new THREE.Group();
  const segments = detail ? 28 : 16;

  labelled(church, 'pantokratorSouth', () => crossInSquare(church, {
    x: [-12, 14], z: [6, 26], height: 15, vault: 4.6, dome: { x: 1, z: 16, radius: 4.8, height: 5 }, segments,
    apses: [{ z: 16, radius: 5.2, height: 13, sides: 5 }, { z: 8.5, radius: 2.4, height: 10, sides: 3 }, { z: 23.5, radius: 2.4, height: 10, sides: 3 }],
    narthex: { x: [-20, -11.95], height: 13 },
    flank: { face: '+z', at: 26 },
  }));

  // The chapel between: lower, a single nave under a barrel vault, with a dome over each of its two bays.
  labelled(church, 'pantokratorHeroon', () => {
    const [x0, x1, z0, z1, height] = [-11.5, 13.5, -5, 6.05, 13];
    church.add(box(x1 - x0, height, z1 - z0, K.brick, (x0 + x1) / 2, 0, (z0 + z1) / 2));
    church.add(box(x1 - x0 + 0.8, 0.8, z1 - z0 + 0.8, M.stone, (x0 + x1) / 2, height - 0.4, (z0 + z1) / 2));
    barrel(church, { x: (x0 + x1) / 2, y: height + 0.3, z: (z0 + z1) / 2, radius: 4.6, length: x1 - x0 + 0.4, axis: 'x', wall: K.brick, segments: segments / 2 });
    for (const x of [-4, 7]) {
      church.add(box(8, 5.2, 8, K.brick, x, height, (z0 + z1) / 2));
      const top = drum(church, { x, y: height + 5.1, z: (z0 + z1) / 2, radius: 3.4, height: 3.6, sides: 8, material: K.plaster, window: [0.9, 2.2] });
      leadDome(church, { x, y: top, z: (z0 + z1) / 2, radius: 3.7, heightScale: 0.6, segments });
    }
    apse(church, { x: x1, z: (z0 + z1) / 2, radius: 3.6, height: 11, sides: 3, material: K.brick, windows: [0.9, 2.4, 5.4], arcades: true });
  });

  labelled(church, 'pantokratorNorth', () => crossInSquare(church, {
    x: [-10, 13], z: [-23, -4.95], height: 14.5, vault: 4.2, dome: { x: 1.5, z: -14, radius: 4.3, height: 4.6 }, segments,
    apses: [{ z: -14, radius: 4.6, height: 12, sides: 5 }, { z: -20.8, radius: 2.1, height: 9.5, sides: 3 }, { z: -7.2, radius: 2.1, height: 9.5, sides: 3 }],
    narthex: { x: [-17, -9.95], height: 12 },
    flank: { face: '-z', at: -23 },
  }));

  if (detail) {
    church.add(box(70, 1, 74, M.paving, -2, -1, 1));
    for (const [x, z] of [[24, 30], [24, -28], [-26, 30], [-28, -27], [30, 2], [-30, 4]]) church.add(cypress(12, x, 0, z));
    church.add(roundTree(8, -28, 0, 16));
    church.add(judasTree(8, 26, 0, 20, { seed: 4 }));
  } else {
    church.add(box(58, 0.4, 60, M.paving, -2, -0.4, 1.5));
  }
  return finalizeModel(church);
}

/**
 * A cross-in-square church: the square naos, its cross of lead barrel vaults
 * showing as rounded gables, a drum and dome over the crossing, the apses
 * (patterned with blind arches) and a narthex to the west.
 */
function crossInSquare(church, { x: [x0, x1], z: [z0, z1], height, vault, dome, apses, narthex, flank, segments }) {
  const [cx, cz] = [(x0 + x1) / 2, (z0 + z1) / 2];
  const [w, d] = [x1 - x0, z1 - z0];
  church.add(box(w, height, d, K.brick, cx, 0, cz));
  church.add(box(w + 0.8, 0.8, d + 0.8, M.stone, cx, height - 0.4, cz));
  barrel(church, { x: cx, y: height + 0.3, z: dome.z, radius: vault, length: w + 0.4, axis: 'x', wall: K.brick, segments: segments / 2 });
  // The cross vault a shade narrower, so the two barrels' crowns never share a plane.
  barrel(church, { x: dome.x, y: height + 0.3, z: cz, radius: vault - 0.06, length: d + 0.4, axis: 'z', wall: K.brick, segments: segments / 2 });
  const base = vault + 1.2;
  church.add(box(dome.radius * 2 + 1.2, base, dome.radius * 2 + 1.2, K.brick, dome.x, height, dome.z));
  const top = drum(church, { x: dome.x, y: height + base - 0.1, z: dome.z, radius: dome.radius, height: dome.height, sides: 12, material: K.plaster, window: [0.95, dome.height * 0.55] });
  leadDome(church, { x: dome.x, y: top, z: dome.z, radius: dome.radius + 0.3, heightScale: 0.6, segments });
  for (const { z, radius, height: tall, sides } of apses) {
    apse(church, { x: x1, z, radius, height: tall, sides, material: K.brick, windows: [radius * 0.24, tall * 0.22, tall * 0.45], arcades: true });
  }
  // A window to each side of the vault's gable on the long flank, and a tier of blind arches below them.
  windowsOn(church, flank.face, flank.at, cx, { count: 3, spacing: w / 3.2, width: 1.4, height: 3.2, y: height - 5.5 });
  blindArcade(church, flank.face, flank.at, cx, { count: 6, spacing: w / 6.4, width: 2.4, height: 4.6, y: 1.6 });

  // The narthex: lower, across the west front, entered by a door on the axis.
  const [n0, n1] = narthex.x;
  // A little narrower than the naos, so their flanks never share a plane where they meet.
  church.add(box(n1 - n0, narthex.height, d - 0.2, K.brick, (n0 + n1) / 2, 0, cz));
  church.add(box(n1 - n0 + 0.8, 0.7, d + 0.6, M.stone, (n0 + n1) / 2, narthex.height - 0.35, cz));
  church.add(box(n1 - n0 + 0.6, 0.5, d + 0.4, K.lead, (n0 + n1) / 2, narthex.height + 0.35, cz));
  doorOn(church, '-x', n0, cz, { width: 2.2, height: 4.2 });
  windowsOn(church, '-x', n0, cz, { count: 3, spacing: d / 3.4, width: 1.3, height: 2.8, y: narthex.height - 5 });
}

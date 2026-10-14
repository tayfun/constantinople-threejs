import * as THREE from 'three';
import { materials as M } from './lib/materials.js';
import { box, cylinder, cypress, judasTree, mesh, placeOnCircle, archGeometry } from './lib/primitives.js';
import { apse, doorOn, drum, leadDome, materials as K, windowsOn } from './lib/churchKit.js';
import { finalizeModel } from './lib/merge.js';
import { labelAt } from './lib/parts.js';

/**
 * The Church of the Holy Apostles as Justinian rebuilt it (536–550) and as
 * it stood until 1461: a cross of five domed bays of brick, each dome raised
 * on a drum of windows (the drums were added in the 10th century) and
 * ribbed in lead, as the Menologion of Basil II paints it and as St Mark's
 * in Venice, built on its model, repeats it. A narthex runs across the west
 * end and an apse closes the east. Beyond the apse stands the round
 * Mausoleum of Constantine, burial place of emperors for seven centuries,
 * and north of the east arm the cross-shaped mausoleum Justinian built for
 * himself.
 *
 * Nothing survives — the Fatih Mosque stands on the site — so this follows
 * the descriptions of Procopius and Nikolaos Mesarites and the copies: the
 * proportions, the windows and where the two mausolea stood are
 * reconstruction. Apse to the east (+x), south is +z; origin = the
 * crossing at ground level.
 */
const BAY = 22; // each arm is one square bay, as wide as the crossing
const HEIGHT = 20;

export function createHolyApostles({ lod = 'detail' } = {}) {
  const detail = lod === 'detail';
  const church = new THREE.Group();
  const { brick, lead } = K;
  const span = BAY * 3;

  // The cross: an east–west and a north–south range through the crossing. The second range stands a
  // few centimetres lower, so their tops, cornices and roofs never share a plane where they meet.
  for (const [w, d, drop] of [[span, BAY, 0], [BAY, span, 0.05]]) {
    church.add(box(w, HEIGHT - drop, d, brick, 0, 0, 0));
    church.add(box(w + 0.8, 1.6 - drop, d + 0.8, M.stone, 0, 0, 0));
    church.add(box(w + 0.8, 0.8, d + 0.8, M.stone, 0, HEIGHT - 0.4 - drop, 0));
    church.add(box(w + 0.6, 0.5, d + 0.6, lead, 0, HEIGHT + 0.4 - drop, 0));
  }

  // Five domes: over the crossing the tallest, one over each arm — each on a square base, a drum of windows,
  // and a ribbed dome with a cross.
  const ribSegments = detail ? 8 : 4;
  for (const [x, z, centre] of [[0, 0, true], [BAY, 0], [-BAY, 0], [0, BAY], [0, -BAY]]) {
    const radius = centre ? 7.4 : 6.2;
    church.add(box(radius * 2 + 2, 3, radius * 2 + 2, brick, x, HEIGHT + 0.4, z));
    const top = drum(church, {
      x, y: HEIGHT + 3.3, z, radius, height: centre ? 6 : 5, sides: centre ? 16 : 12, material: brick,
      window: [1.3, centre ? 3.4 : 2.8], cornice: M.stone,
    });
    leadDome(church, { x, y: top, z, radius: radius + 0.3, heightScale: 0.68, segments: detail ? 32 : 16, ribs: centre ? 16 : 12, ribSegments });
  }

  // Windows in the arms' ends and flanks, a gallery row over a lower one.
  const half = BAY / 2;
  const end = span / 2;
  for (const sign of [-1, 1]) {
    windowsOn(church, sign > 0 ? '+z' : '-z', sign * end, 0, { count: 3, spacing: 5.5, width: 2.2, height: 5, y: 11 });
    windowsOn(church, sign > 0 ? '+z' : '-z', sign * end, 0, { count: 3, spacing: 5.5, width: 1.8, height: 3.6, y: 3.5 });
    for (const arm of [-BAY, BAY]) {
      windowsOn(church, sign > 0 ? '+z' : '-z', sign * half, arm, { count: 3, spacing: 6, width: 2, height: 4.6, y: 11 });
      windowsOn(church, sign > 0 ? '+x' : '-x', sign * half, arm, { count: 3, spacing: 6, width: 2, height: 4.6, y: 11 });
    }
  }

  // The narthex across the west end, with three doors, and the apse at the east.
  church.add(box(8.05, 15, 40, brick, -end - 3.975, 0, 0));
  church.add(box(8.8, 0.7, 40.8, M.stone, -end - 4, 14.6, 0));
  church.add(box(8.6, 0.5, 40.6, lead, -end - 4, 15.3, 0));
  for (const z of [-8, 0, 8]) doorOn(church, '-x', -end - 8, z, { width: 2.8, height: 5.4 });
  windowsOn(church, '-x', -end - 8, 0, { count: 5, spacing: 7, width: 1.8, height: 3.2, y: 9 });
  apse(church, { x: end, radius: 8, height: 15, sides: 5, material: brick, windows: [1.6, 4, 5], roof: 0.55 });

  // The Mausoleum of Constantine: a domed rotunda beyond the apse, joined to the church by a passage.
  const rotunda = end + 30;
  church.add(box(14, 9, 8, brick, end + 12, 0, 0));
  church.add(box(14.6, 0.5, 8.6, lead, end + 12, 9, 0));
  church.add(cylinder(11, 11, 15, brick, rotunda, 0, 0, detail ? 32 : 20));
  church.add(cylinder(11.4, 11.4, 0.8, M.stone, rotunda, 14.6, 0, detail ? 32 : 20));
  const opening = archGeometry(1.6, 3.6);
  for (let i = 0; i < 10; i++) church.add(placeOnCircle(mesh(opening, M.opening), ((i + 0.5) / 10) * Math.PI * 2, 11.06, 8, rotunda, 0));
  leadDome(church, { x: rotunda, y: 15.4, radius: 11.2, heightScale: 0.55, segments: detail ? 32 : 18 });
  labelAt(church, 'mausoleumConstantine', rotunda, 23, 0);

  // Justinian's own mausoleum: a small domed cross north of the east arm.
  const [jx, jz] = [BAY, -end + 2 - 20];
  church.add(box(22, 11, 8, brick, jx, 0, jz));
  church.add(box(8, 10.95, 22, brick, jx, 0, jz));
  church.add(box(22.6, 0.4, 8.6, lead, jx, 11, jz));
  church.add(box(8.6, 0.4, 22.6, lead, jx, 10.95, jz));
  const jtop = drum(church, { x: jx, y: 11.2, z: jz, radius: 3.6, height: 2.6, sides: 8, material: brick, window: [0.9, 1.6], cornice: M.stone });
  leadDome(church, { x: jx, y: jtop, z: jz, radius: 3.9, heightScale: 0.6, segments: detail ? 20 : 12 });
  doorOn(church, '+z', jz + 11, jx, { width: 2.2, height: 4 });
  labelAt(church, 'mausoleumJustinian', jx, 18, jz);

  if (detail) {
    church.add(box(170, 1, 128, M.paving, 12, -1, -10));
    for (const [x, z] of [[-60, 40], [-60, -40], [10, 46], [40, 44], [70, 30], [86, -10], [60, -40], [-30, 48], [-40, -46], [-10, -60]]) church.add(cypress(14, x, 0, z));
    church.add(judasTree(9, 30, 0, 30, { seed: 3 })); // one erguvan in flower: each costs some 25,000 triangles
  } else {
    church.add(box(130, 0.4, 96, M.paving, 10, -0.4, -8));
  }
  return finalizeModel(church);
}

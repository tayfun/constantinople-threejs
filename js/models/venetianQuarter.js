import * as THREE from 'three';
import { materials as M, cloth } from './lib/materials.js';
import {
  archedWallGeometry, box, colonnade, crenellationGeometry, cylinder, dome, flag, groundPlane, hipRoof, mesh,
  pyramid, regularOpenings, windowRow,
} from './lib/primitives.js';
import { scatterHouses } from './lib/buildings.js';
import { finalizeModel } from './lib/merge.js';
import { createRandom } from '../util/random.js';
import { createMerchantShip } from './merchantShip.js';

/**
 * The Venetian quarter on the city's own shore of the Golden Horn, granted
 * by Alexios I Komnenos in 1082: warehouses (fondaco) along the sea wall,
 * the colonnaded market street (embolo), a Byzantine-built church with a
 * Venetian bell tower, and wooden landing stages (scalae) outside the walls.
 * The Golden Horn lies to the north (-z).
 */
export function createVenetianQuarter({ lod = 'detail' } = {}) {
  const detail = lod === 'detail';
  const quarter = new THREE.Group();
  quarter.add(box(200, 3, detail ? 110 : 80, M.paving, 0, -3, detail ? 15 : 0));

  // Byzantine sea wall with two gates, and the quay outside it.
  quarter.add(mesh(archedWallGeometry({
    length: 200,
    height: 10,
    thickness: 3,
    openings: [{ x: -40, width: 5, bottom: 0, spring: 5 }, { x: 30, width: 5, bottom: 0, spring: 5 }],
  }), M.banded, 0, 0, -30));
  quarter.add(mesh(crenellationGeometry(200), M.banded, 0, 10, -31.2));
  for (const x of [-80, -5, 60, 95]) quarter.add(box(8, 14, 8, M.banded, x, 0, -30));
  quarter.add(box(200, 1.8, 14, M.stone, 0, -1.2, -38.5));

  // The landing stages (scalae) on timber piles.
  for (const x of [-70, -10, 50]) {
    quarter.add(box(5, 0.5, 24, M.wood, x, 0.1, -57));
    if (detail) for (let k = 0; k < 5; k++) for (const side of [-1, 1]) quarter.add(cylinder(0.25, 0.25, 3, M.wood, x + side * 2.2, -2.5, -47 - k * 5, 6));
  }

  addFondaco(quarter, detail);
  addChurch(quarter, detail);
  if (detail) addEmbolo(quarter);

  if (detail) {
    quarter.add(groundPlane(280, 70, M.water, 0, 0, -80));
    scatterHouses(quarter, createRandom(1082), {
      count: 26,
      area: [-95, 22, 95, 66],
      avoid: [[-55, 22, 20], [-42, 28, 8]],
    });
  }

  finalizeModel(quarter);
  const banner = flag('venice', { width: 3.4, height: 2.2, pole: 6 });
  banner.position.set(0, 13, -10);
  quarter.add(banner);
  if (detail) {
    const arriving = createMerchantShip({ banner: 'venice' });
    arriving.position.set(-40, 0, -78);
    quarter.add(arriving);
    const moored = createMerchantShip({ banner: 'venice', sail: false });
    moored.position.set(25, 0, -62);
    moored.rotation.y = Math.PI / 2 + 0.05;
    quarter.add(moored);
  }
  return quarter;
}

/** Arcaded warehouse with lodgings above, facing the quay gates. */
function addFondaco(quarter, detail) {
  quarter.add(box(70, 12, 14, M.plasterOchre, 0, 0, -10));
  quarter.add(hipRoof(70, 14, 4, M.roof, 0, 12, -10));
  const arcade = detail
    ? mesh(archedWallGeometry({ length: 70, height: 6.5, thickness: 1, openings: regularOpenings(70, 10, { width: 4.4, bottom: 0, spring: 3.6 }) }), M.stone)
    : box(70, 6.5, 1, M.stone);
  arcade.position.set(0, 0, -19.5);
  quarter.add(arcade);
  quarter.add(box(70, 0.4, 3, M.roof, 0, 6.5, -18.5));
  if (detail) {
    const windows = windowRow({ count: 12, spacing: 5.5, width: 1.4, height: 2.6, y: 8 });
    windows.position.set(0, 0, -17.05);
    windows.rotation.y = Math.PI;
    quarter.add(windows);
  }
}

/** A domed Byzantine church used by the Venetians, with a campanile in their own style. */
function addChurch(quarter, detail) {
  const [x, z] = [-55, 22];
  quarter.add(box(16, 9, 16, M.brick, x, 0, z));
  quarter.add(box(20, 11, 6.5, M.brick, x, 0, z));
  quarter.add(box(6.5, 11, 20, M.brick, x, 0, z));
  quarter.add(cylinder(3.4, 3.4, 3.4, M.brick, x, 11, z, 16));
  quarter.add(dome(3.4, M.lead, x, 14.4, z));
  const [tx, tz] = [x + 13, z + 6];
  quarter.add(box(5, 26, 5, M.brick, tx, 0, tz));
  quarter.add(box(5.6, 0.6, 5.6, M.marble, tx, 20, tz));
  quarter.add(pyramid(5.6, 5.6, 6.5, M.roof, tx, 26, tz));
  if (detail) {
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2;
      const belfry = windowRow({ count: 2, spacing: 1.8, width: 1, height: 2.6, y: 21.5 });
      belfry.rotation.y = angle;
      belfry.position.set(tx + Math.sin(angle) * 2.53, 0, tz + Math.cos(angle) * 2.53);
      quarter.add(belfry);
    }
  }
}

/** The embolo: a colonnaded market street lined with traders' stalls. */
function addEmbolo(quarter) {
  for (const z of [5, 15]) {
    const columns = colonnade({ length: 120, count: 21, height: 6, radius: 0.35 });
    columns.position.set(10, 0, z);
    quarter.add(columns);
    quarter.add(box(122, 0.4, 3.4, M.roof, 10, 6, z + (z === 5 ? -1.2 : 1.2)));
  }
  const awnings = [0xa3202a, 0xd8a933, 0x2a4d8f, 0x3a7a3c, 0xe8e0cc];
  for (let i = 0; i < 10; i++) {
    const x = -45 + i * 12;
    quarter.add(box(4, 1, 2, M.wood, x, 0, 10));
    quarter.add(box(4.6, 0.15, 2.6, cloth(awnings[i % awnings.length]), x, 2.6, 10));
  }
}

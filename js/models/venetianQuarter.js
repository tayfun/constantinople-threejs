import * as THREE from 'three';
import { materials as M, cloth } from './lib/materials.js';
import {
  archedWallGeometry, box, crenellationGeometry, cylinder, dome, flag, groundPlane, hipRoof, mesh,
  pyramid, regularOpenings, windowRow, gableRoof,
} from './lib/primitives.js';
import { scatterHouses } from './lib/buildings.js';
import { finalizeModel } from './lib/merge.js';
import { createRandom } from '../util/random.js';
import { createMerchantShip } from './merchantShip.js';

/**
 * The Venetian quarter at Perama, on the city's own shore of the Golden
 * Horn, granted by Alexios I Komnenos in 1082: a strip some 540 m long
 * between the Gate of the Drungarios and the Porta Peramatis, with three
 * landing stages (scalae) outside the Byzantine sea wall, the great
 * warehouse and market inside the Porta Peramatis, the embolos — the
 * arcaded market street with houses on both sides — the Byzantine church
 * of St Akindynos rededicated to San Marco, its bakery ovens, and a
 * campanile in the Venetian manner. The Golden Horn lies to the north (-z).
 * (Jacoby, "The Venetian quarter of Constantinople from 1082 to 1261";
 * Brown, JHS 1920.)
 */
export function createVenetianQuarter({ lod = 'detail' } = {}) {
  const detail = lod === 'detail';
  const quarter = new THREE.Group();
  quarter.add(box(200, 3, detail ? 110 : 80, M.paving, 0, -3, detail ? 15 : 0));

  // Byzantine sea wall: the Gate of the Drungarios (west) and the Porta Peramatis (east), flanked by towers.
  quarter.add(mesh(archedWallGeometry({
    length: 200,
    height: 10,
    thickness: 3,
    openings: [{ x: -40, width: 5, bottom: 0, spring: 5 }, { x: 30, width: 5, bottom: 0, spring: 5 }],
  }), M.banded, 0, 0, -30));
  quarter.add(mesh(crenellationGeometry(200), M.banded, 0, 10, -31.2));
  for (const x of [-85, -47, -33, 23, 37, 95]) {
    quarter.add(box(8, 14, 8, M.banded, x, 0, -30));
    for (const side of [-1, 1]) quarter.add(mesh(crenellationGeometry(8, { merlon: 0.8, gap: 0.6, height: 1 }), M.banded, x, 14, -30 + side * 3.65));
  }
  quarter.add(box(200, 1.8, 14, M.stone, 0, -1.2, -38.5));

  // The three landing stages (scalae) on timber piles, with cargo waiting on them.
  for (const x of [-70, -10, 50]) {
    quarter.add(box(6, 0.5, 26, M.wood, x, 0.1, -58));
    if (detail) {
      for (let k = 0; k < 5; k++) for (const side of [-1, 1]) quarter.add(cylinder(0.25, 0.25, 3.2, M.wood, x + side * 2.7, -2.5, -47 - k * 5.5, 6));
      for (const side of [-1, 1]) quarter.add(cylinder(0.25, 0.25, 1.6, M.wood, x + side * 2.7, 0.3, -70.5, 6));
      quarter.add(box(1.3, 1, 1.1, M.sail, x - 1.5, 0.6, -50));
      quarter.add(cylinder(0.5, 0.5, 1.1, M.wood, x + 1.6, 0.6, -56, 8));
    }
  }

  addFondaco(quarter, detail);
  addChurch(quarter, detail);
  if (detail) {
    addEmbolos(quarter);
    addMarket(quarter);
  }

  if (detail) {
    quarter.add(groundPlane(280, 70, M.water, 0, 0, -80));
    scatterHouses(quarter, createRandom(1082), {
      count: 26,
      area: [-95, 26, 95, 66],
      avoid: [[-55, 36, 22], [-40, 44, 9], [-36, 28, 7]],
    });
  }

  finalizeModel(quarter);
  const banner = flag('venice', { width: 3.4, height: 2.2, pole: 6 });
  banner.position.set(0, 13, -10);
  quarter.add(banner);
  const gateBanner = flag('byzantine', { width: 2.6, height: 1.8, pole: 5 });
  gateBanner.position.set(30, 14, -30);
  quarter.add(gateBanner);
  if (detail) {
    const arriving = createMerchantShip({ banner: 'venice' });
    arriving.position.set(-40, 0, -80);
    arriving.rotation.y = 0.1;
    quarter.add(arriving);
    const moored = createMerchantShip({ banner: 'venice', sail: false });
    moored.position.set(38, 0, -62);
    moored.rotation.y = Math.PI / 2 + 0.05;
    quarter.add(moored);
  }
  return quarter;
}

/** The great warehouse inside the Porta Peramatis: a two-storey arcaded range round a yard, lodgings above. */
function addFondaco(quarter, detail) {
  quarter.add(box(70, 12, 14, M.plaster, 0, 0, -10));
  quarter.add(hipRoof(70, 14, 4, M.roof, 0, 12, -10));
  const arcade = detail
    ? mesh(archedWallGeometry({ length: 70, height: 6.5, thickness: 1.2, openings: regularOpenings(70, 10, { width: 4.4, bottom: 0, spring: 3.6 }) }), M.banded)
    : box(70, 6.5, 1.2, M.banded);
  arcade.position.set(0, 0, -19.5);
  quarter.add(arcade);
  quarter.add(box(70, 0.5, 3.4, M.stone, 0, 6.5, -18.4));
  quarter.add(box(70, 0.5, 14.6, M.stone, 0, 11.8, -10)); // cornice
  if (detail) {
    const windows = windowRow({ count: 12, spacing: 5.5, width: 1.4, height: 2.6, y: 8 });
    windows.position.set(0, 0, -17.05);
    windows.rotation.y = Math.PI;
    quarter.add(windows);
    const back = windowRow({ count: 12, spacing: 5.5, width: 1.4, height: 2.6, y: 8 });
    back.position.set(0, 0, -2.95);
    quarter.add(back);
    for (const x of [-25, 0, 25]) quarter.add(mesh(new THREE.ShapeGeometry(doorShape(3, 4)), M.opening, x, 0, -2.95)); // doors to the yard
    // Two wings enclosing the yard behind, with a well.
    for (const x of [-32, 32]) {
      quarter.add(box(6, 7, 20, M.plaster, x, 0, 7));
      quarter.add(gableRoof(6, 20, 2.4, M.roof, x, 7, 7, 0.3));
    }
    quarter.add(cylinder(1.2, 1.2, 1, M.marble, 0, 0, 8, 12));
  }
}

function doorShape(w, h) {
  return new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(w / 2, h), new THREE.Vector2(-w / 2, h)]);
}

/**
 * San Marco: the Byzantine cross-in-square church of St Akindynos in brick,
 * with its lead dome, the ovens the Venetians were granted beside it, and a
 * brick campanile in their own style with a belfry and pyramid spire.
 */
function addChurch(quarter, detail) {
  const [x, z] = [-55, 36];
  quarter.add(box(16, 9, 16, M.brick, x, 0, z));
  quarter.add(box(20, 11, 6.5, M.brick, x, 0, z));
  quarter.add(box(6.5, 11, 20, M.brick, x, 0, z));
  quarter.add(gableRoof(20, 6.5, 1.6, M.roof, x, 11, z, 0.2));
  const arm = gableRoof(20, 6.5, 1.6, M.roof, x, 11, z, 0.2);
  arm.rotation.y = Math.PI / 2;
  quarter.add(arm);
  quarter.add(hipRoof(16.4, 16.4, 1.2, M.roof, x, 9, z, 0));
  quarter.add(cylinder(3.6, 3.6, 3.4, M.brick, x, 11, z, 16));
  quarter.add(dome(3.6, M.lead, x, 14.4, z));
  // Three apses on the east (+x) side.
  for (const [dz, r] of [[0, 2.6], [-5.5, 1.5], [5.5, 1.5]]) {
    quarter.add(cylinder(r, r, r > 2 ? 8 : 6, M.brick, x + 10, 0, z + dz, 10, { thetaStart: -Math.PI / 2, thetaLength: Math.PI }));
    quarter.add(dome(r, M.lead, x + 10, r > 2 ? 8 : 6, z + dz, { phiLength: Math.PI, segments: 10 }));
  }
  if (detail) {
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2;
      const row = windowRow({ count: 3, spacing: 1.4, width: 0.7, height: 1.6, y: 12 });
      row.rotation.y = angle;
      row.position.set(x + Math.sin(angle) * 3.62, 0, z + Math.cos(angle) * 3.62);
      quarter.add(row);
      const nave = windowRow({ count: 2, spacing: 2.4, width: 1, height: 2.6, y: 6.5 });
      nave.rotation.y = angle;
      nave.position.set(x + Math.sin(angle) * 10.03, 0, z + Math.cos(angle) * 10.03);
      quarter.add(nave);
    }
    // The bakery ovens: domed brick kilns in the yard west of the church.
    for (const [ox, oz] of [[-13, -4], [-13, 3]]) {
      quarter.add(box(4, 1.6, 4, M.brick, x + ox, 0, z + oz));
      quarter.add(dome(1.9, M.brick, x + ox, 1.6, z + oz, { segments: 12 }));
      quarter.add(box(0.7, 2.2, 0.7, M.brick, x + ox - 1.4, 1.8, z + oz));
    }
  }
  // The campanile: a brick shaft with pilaster strips, a belfry of arched lights, and a pyramid spire.
  const [tx, tz] = [x + 15, z + 8];
  quarter.add(box(5.4, 28, 5.4, M.brick, tx, 0, tz));
  for (const side of [-1, 1]) {
    quarter.add(box(0.5, 24, 5.6, M.brick, tx + side * 2.6, 0, tz));
    quarter.add(box(5.6, 24, 0.5, M.brick, tx, 0, tz + side * 2.6));
  }
  quarter.add(box(6, 0.6, 6, M.marble, tx, 24, tz));
  quarter.add(box(6, 0.6, 6, M.marble, tx, 28, tz));
  quarter.add(pyramid(5.6, 5.6, 7, M.roof, tx, 28.6, tz));
  quarter.add(cylinder(0.08, 0.08, 1.6, M.gold, tx, 35.4, tz, 6));
  quarter.add(dome(0.45, M.gold, tx, 36.5, tz, { segments: 8 }));
  if (detail) {
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2;
      const belfry = windowRow({ count: 2, spacing: 2, width: 1.2, height: 3, y: 24.7 });
      belfry.rotation.y = angle;
      belfry.position.set(tx + Math.sin(angle) * 2.73, 0, tz + Math.cos(angle) * 2.73);
      quarter.add(belfry);
      const slits = windowRow({ count: 1, spacing: 0, width: 0.5, height: 1.4, y: 14 });
      slits.rotation.y = angle;
      slits.position.set(tx + Math.sin(angle) * 2.73, 0, tz + Math.cos(angle) * 2.73);
      quarter.add(slits);
    }
  }
}

/**
 * The embolos: the market street running the length of the quarter, with
 * arcaded houses on both sides — shops under the arches, lodgings above —
 * and the traders' stalls under their awnings in the roadway.
 */
function addEmbolos(quarter) {
  const street = 12;
  const awnings = [0xa3202a, 0xd8a933, 0x2a4d8f, 0x3a7a3c, 0xe8e0cc];
  for (const side of [-1, 1]) {
    const z = 12 + side * (street / 2 + 4.5);
    const length = side < 0 ? 56 : 120; // the fondaco's wings stand on the north side
    const x = side < 0 ? 54 : 22;
    const arcade = mesh(archedWallGeometry({ length, height: 4.6, thickness: 1, openings: regularOpenings(length, Math.round(length / 5), { width: 3.4, bottom: 0, spring: 2.6 }) }), M.stone);
    arcade.position.set(x, 0, z - side * 4);
    quarter.add(arcade);
    quarter.add(box(length, 8.4, 9, M.plasterOchre, x, 0, z));
    quarter.add(box(length + 0.4, 0.4, 9.4, M.stone, x, 4.6, z));
    quarter.add(gableRoof(length, 9, 2.8, M.roof, x, 8.4, z, 0.4));
    const windows = windowRow({ count: Math.round(length / 4), spacing: 4, width: 0.9, height: 1.6, y: 5.8 });
    windows.position.set(x, 0, z - side * 4.53);
    windows.rotation.y = side < 0 ? 0 : Math.PI;
    quarter.add(windows);
  }
  for (let i = 0; i < 9; i++) {
    const x = -32 + i * 12;
    const z = 12 + (i % 2 ? 2.5 : -2.5);
    quarter.add(box(3.6, 1, 1.8, M.wood, x, 0, z));
    for (const dx of [-1.6, 1.6]) quarter.add(cylinder(0.06, 0.06, 2.6, M.wood, x + dx, 0, z - 1, 5));
    const awning = box(4.2, 0.12, 2.8, cloth(awnings[i % awnings.length]), x, 2.6, z - 0.4);
    awning.rotation.x = 0.25;
    quarter.add(awning);
  }
}

/** The market before the fondaco, inside the Porta Peramatis. */
function addMarket(quarter) {
  const rnd = createRandom(1204);
  for (let i = 0; i < 8; i++) {
    const x = 50 + (i % 4) * 8;
    const z = -20 + Math.floor(i / 4) * 9;
    quarter.add(rnd.chance(0.5) ? box(1.4, 1.1, 1.2, M.sail, x, 0, z) : cylinder(0.5, 0.5, 1.1, M.wood, x, 0, z, 8));
    quarter.add(box(1.2, 1, 1.2, M.sail, x + 1.5, 0, z + 1.2));
  }
}

import * as THREE from 'three';
import { materials as M, tinted } from './lib/materials.js';
import {
  archGeometry, box, colonnade, crenellationGeometry, cylinder, cypress, dome, faceToward, gableRoof, groundPlane,
  hipRoof, landGeometry, mesh, roundTree, windowRow,
} from './lib/primitives.js';
import { createHouse } from './lib/buildings.js';
import { createHull } from './lib/hull.js';
import { createEagle } from './lib/figures.js';
import { createMerchantShip } from './merchantShip.js';
import { finalizeModel } from './lib/merge.js';
import { createRandom } from '../util/random.js';
import { pointInPolygon, distanceToPolyline } from '../util/geo.js';

/**
 * Chalcedon (Kadıköy), the Megarian colony of 685 BC on the Asian shore —
 * the "city of the blind", whose founders overlooked the better site across
 * the water. Shown in Byzantine times, as a walled suburb and bishopric of
 * the capital: the circuit of walls on the low peninsula (one stretch still
 * the stumps Valens left when he pulled them down in 366), the agora with
 * its stoas, the theatre set against the acropolis, the harbour on the
 * Marmara shore with its mole and warehouses, the ruined temple of Apollo on
 * the point, and outside the north wall, on its rise facing Constantinople
 * "two stadia from the Bosphorus", the shrine of St Euphemia where the
 * Council of 451 met: as Evagrius describes it, a great colonnaded court,
 * a roofed basilica of the same size, and on its north side the domed
 * rotunda holding the martyr's silver coffin. A pair of eagles wheel above
 * the town, the birds that, legend says, carried Constantine's builders'
 * cords across to Byzantium. The sea lies to the west (-x) and south (+z).
 */

const GROUND = 3;
const HILL = GROUND + 4;
const COAST = [
  [-40, -110], [130, -110], [130, 110], [40, 110], [10, 80], [-30, 62], [-70, 56],
  [-96, 30], [-92, 0], [-72, -22], [-62, -60], [-52, -92],
];

// The wall circuit round the town, clockwise from the north-west corner, and its gates.
const CIRCUIT = [[-38, -66], [50, -66], [118, -48], [118, 40], [50, 52], [-38, 52]];
const GATES = [[10, -66], [118, 30], [10, 52], [-38, 30]];
const RUINED_EDGE = 1; // the north-east stretch, never rebuilt after Valens
const WALL = { height: 7, thickness: 2.4 };

// The acropolis: a low oval rise inside the eastern walls.
const ACROPOLIS = { x: 82, z: -12, rx: 30, rz: 36 };
const acropolisRadius = (x, z) => Math.hypot((x - ACROPOLIS.x) / ACROPOLIS.rx, (z - ACROPOLIS.z) / ACROPOLIS.rz);
const hillHeight = (x, z) => (acropolisRadius(x, z) < 1 ? HILL : GROUND);

const AGORA = [-12, 6];
const THEATRE = [36, -30];
const EUPHEMIA = [14, -83];
const TEMPLE = [-62, 28];
const PLASTER = [0xf4e9d4, 0xf7f1e3, 0xe9d3ae, 0xf1dcbf, 0xdcb98e, 0xf5eee0, 0xe6c8a0];

export function createChalcedon({ lod = 'detail' } = {}) {
  const detail = lod === 'detail';
  const city = new THREE.Group();
  const rnd = createRandom(685);
  const elevation = detail ? hillHeight : () => GROUND;

  if (detail) {
    city.add(mesh(landGeometry(COAST, GROUND, 6), M.grass));
    // Sea only beyond the shore: the plane's landward edges meet the land's bounds (x 130, z ±110).
    city.add(groundPlane(300, 220, M.water, -20, 0.6, 0));
    const outline = [];
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      const wobble = 1 + 0.06 * Math.sin(a * 3 + 1) + 0.04 * Math.sin(a * 5);
      outline.push([ACROPOLIS.x + Math.cos(a) * ACROPOLIS.rx * wobble, ACROPOLIS.z + Math.sin(a) * ACROPOLIS.rz * wobble]);
    }
    city.add(mesh(landGeometry(outline, HILL, HILL - GROUND + 0.5), tinted('grass', 0xd8cf9c)));
  } else {
    city.position.y = -GROUND; // stand directly on the map's land
  }

  addWalls(city, detail, rnd);
  addStreets(city);
  addAgora(city, detail);
  addTheatre(city, detail);
  addEuphemia(city, detail);
  addTownChurch(city, detail);
  addTemple(city, rnd);
  addHarbour(city, detail);

  scatterTown(city, rnd, { detail, elevation });
  addPlanting(city, rnd, detail, elevation);

  finalizeModel(city);
  if (detail) {
    addShipping(city);
    addEagles(city);
  }
  return city;
}

// ---------- the walls ----------

/** The circuit of walls with its towers and gates; the north-east stretch is still the stumps Valens left. */
function addWalls(city, detail, rnd) {
  const { height, thickness } = WALL;
  const n = CIRCUIT.length;
  const tower = (x, z, size, h, angle) => {
    const block = box(size, h, size, M.stone, x, GROUND, z);
    block.rotation.y = angle;
    city.add(block);
    if (detail) {
      for (let k = 0; k < 4; k++) {
        const parapet = mesh(crenellationGeometry(size - 0.8, { height: 0.9, merlon: 0.8, gap: 0.6 }), M.stone, 0, h, 0);
        parapet.rotation.y = (k * Math.PI) / 2;
        parapet.position.x = Math.sin(parapet.rotation.y) * (size / 2 - 0.35);
        parapet.position.z = Math.cos(parapet.rotation.y) * (size / 2 - 0.35);
        block.add(parapet);
      }
    }
  };

  for (let i = 0; i < n; i++) {
    const [x0, z0] = CIRCUIT[i];
    const [x1, z1] = CIRCUIT[(i + 1) % n];
    const length = Math.hypot(x1 - x0, z1 - z0);
    const [ux, uz] = [(x1 - x0) / length, (z1 - z0) / length];
    const angle = Math.atan2(-uz, ux);
    const at = (t) => [x0 + ux * t, z0 + uz * t];
    const gates = GATES.map(([gx, gz]) => ({ t: (gx - x0) * ux + (gz - z0) * uz, off: Math.abs((gx - x0) * uz - (gz - z0) * ux) }))
      .filter(({ t, off }) => off < 0.5 && t > 0 && t < length).map(({ t }) => t);

    // Curtain spans between the gates.
    const cuts = [0, ...gates.flatMap((t) => [t - 6, t + 6]), length];
    for (let k = 0; k < cuts.length; k += 2) {
      const [a, b] = [cuts[k], cuts[k + 1]];
      if (i === RUINED_EDGE) {
        for (let t = a + 4; t < b - 2; t += 8) {
          if (rnd.chance(0.25)) continue;
          const [x, z] = at(t);
          const stump = box(7.6, rnd.range(1, 4.5), thickness + 0.6, M.stoneDark, x, GROUND, z);
          stump.rotation.y = angle;
          city.add(stump);
        }
        continue;
      }
      const [x, z] = at((a + b) / 2);
      const curtain = box(b - a, height, thickness, M.stone, x, GROUND, z);
      curtain.rotation.y = angle;
      city.add(curtain);
      if (detail) {
        const parapet = mesh(crenellationGeometry(b - a), M.stone, x, GROUND + height, z);
        parapet.rotation.y = angle;
        city.add(parapet);
      }
      // Interval towers along the longer spans.
      for (let t = a + 30; t < b - 12; t += 30) tower(...at(t), 6, height + 3, angle);
    }
    // Gatehouses: a taller block pierced by the archway, flanked by two towers.
    for (const t of gates) {
      const [x, z] = at(t);
      const house = box(12, height + 3, thickness + 2, M.stone, x, GROUND, z);
      house.rotation.y = angle;
      city.add(house);
      const way = box(4.4, 5.5, thickness + 2.4, M.opening, x, GROUND, z);
      way.rotation.y = angle;
      city.add(way);
      for (const side of [-1, 1]) tower(...at(t + side * 9), 6, height + 4.5, angle);
      if (detail) {
        const parapet = mesh(crenellationGeometry(12), M.stone, x, GROUND + height + 3, z);
        parapet.rotation.y = angle;
        city.add(parapet);
      }
    }
    // A corner tower at each angle of the circuit.
    tower(x0, z0, 7.5, height + 4.5, angle);
  }
}

/** The two paved streets that cross the town between its gates. */
function addStreets(city) {
  city.add(groundPlane(6, 140, M.paving, 10, GROUND + 0.03, 4)); // north gate to the quay
  city.add(groundPlane(180, 6, M.paving, 40, GROUND + 0.03, 30)); // west gate to east gate and on along the Nicomedia road
  // Outside the north gate, the way to the shrine's court.
  const [x0, z0, x1, z1] = [10, -70, -34, -83];
  const way = groundPlane(Math.hypot(x1 - x0, z1 - z0) + 4, 5, M.paving, (x0 + x1) / 2, GROUND + 0.03, (z0 + z1) / 2);
  way.rotation.y = Math.atan2(-(z1 - z0), x1 - x0);
  city.add(way);
}

// ---------- the agora ----------

/** The agora: a paved square closed by two stoas, with an honorific column in the middle. */
function addAgora(city, detail) {
  const [x, z] = AGORA;
  city.add(groundPlane(36, 28, M.paving, x, GROUND + 0.04, z));
  const stoa = (length, cx, cz, rotation) => {
    const group = new THREE.Group();
    group.add(colonnade({ length: length - 4, count: Math.round(length / 3.6), height: 6, radius: 0.36 }));
    group.add(box(length, 6, 1, M.stone, 0, 0, -4));
    group.add(gableRoof(length + 1, 6, 1.6, M.roof, 0, 6, -2, 0.4));
    group.position.set(cx, GROUND, cz);
    group.rotation.y = rotation;
    city.add(group);
  };
  stoa(34, x, z - 10, 0);
  stoa(24, x - 14, z + 3, Math.PI / 2);
  city.add(box(2.6, 1, 2.6, M.marble, x + 4, GROUND, z + 2));
  city.add(cylinder(0.55, 0.65, 7, M.marble, x + 4, GROUND + 1, z + 2, 10));
  city.add(cylinder(0.9, 0.6, 0.6, M.marble, x + 4, GROUND + 8, z + 2, 10));
  if (detail) {
    city.add(box(0.7, 2.2, 0.7, M.bronze, x + 4, GROUND + 8.6, z + 2));
    city.add(cylinder(2.2, 2.4, 0.8, M.marble, x - 6, GROUND, z + 8, 12));
    city.add(mesh(new THREE.CircleGeometry(2, 12).rotateX(-Math.PI / 2), M.water, x - 6, GROUND + 0.7, z + 8));
  }
}

// ---------- the theatre ----------

/** A half disc standing on y = 0, its flat side along x at z = 0 and its curve towards -z. */
function halfDiscGeometry(radius, height, segments = 16) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, radius, 0, Math.PI, false);
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, curveSegments: segments }).rotateX(-Math.PI / 2);
}

/** The theatre, its cavea stepping up against the acropolis and looking west over the town to the strait. */
function addTheatre(city, detail) {
  const [x, z] = THEATRE;
  const rings = detail ? 6 : 4;
  for (let k = 0; k < rings; k++) {
    const r = 9 + (k + 1) * (12 / rings);
    const tier = mesh(halfDiscGeometry(r, 1.1 * (k + 1), detail ? 18 : 10), k === rings - 1 ? M.stoneDark : M.stone, x, GROUND, z);
    tier.rotation.y = -Math.PI / 2; // curve towards +x, the open side west
    city.add(tier);
  }
  const orchestra = mesh(halfDiscGeometry(8.6, 0.15, 16), M.paving, x, GROUND, z);
  orchestra.rotation.y = -Math.PI / 2;
  city.add(orchestra);
  // The stage building (skene) across the open side, with its columned front.
  city.add(box(4, 1.3, 22, M.stone, x - 10.5, GROUND, z));
  city.add(box(5, 8, 28, M.stone, x - 15, GROUND, z));
  city.add(gableRoof(28, 5, 1.6, M.roof, x - 15, GROUND + 8, z, 0.4).rotateY(Math.PI / 2));
  if (detail) {
    const front = colonnade({ length: 20, count: 6, height: 4.5, radius: 0.3 });
    front.rotation.y = Math.PI / 2;
    front.position.set(x - 12, GROUND + 1.3, z);
    city.add(front);
    for (let i = 0; i < 2; i++) city.add(box(2, 4.5, 3, M.stone, x - 11.5, GROUND + 1.3, z + (i ? 12.5 : -12.5)));
  }
}

// ---------- St Euphemia ----------

/** The shrine of St Euphemia outside the north wall: colonnaded court, basilica, and the domed rotunda of the martyr on its north side. */
function addEuphemia(city, detail) {
  const [x, z] = EUPHEMIA;
  // The basilica: aisles under a hipped roof, a tall clerestoried nave, the apse to the east.
  city.add(box(38, 8, 20, M.brick, x, GROUND, z));
  city.add(hipRoof(38, 20, 2.4, M.roof, x, GROUND + 8, z, 0.5));
  city.add(box(38, 15, 10, M.brick, x, GROUND, z));
  city.add(gableRoof(38, 10, 3, M.roof, x, GROUND + 15, z, 0.5));
  city.add(faceToward(cylinder(5, 5, 10, M.brick, x + 19, GROUND, z, 14, { thetaStart: -Math.PI / 2, thetaLength: Math.PI }), 1, 0));
  city.add(faceToward(dome(5, M.roof, x + 19, GROUND + 10, z, { phiLength: Math.PI, heightScale: 0.6 }), 1, 0));
  city.add(box(0.2, 2.4, 0.2, M.gold, x, GROUND + 18.2, z));
  city.add(box(1.4, 0.2, 0.2, M.gold, x, GROUND + 19.6, z));
  if (detail) {
    for (const side of [-1, 1]) {
      const clerestory = windowRow({ count: 7, spacing: 5, width: 1.3, height: 2.6, y: GROUND + 10.5 });
      clerestory.position.set(x, 0, z + side * 5.03);
      clerestory.rotation.y = side > 0 ? 0 : Math.PI;
      city.add(clerestory);
      const aisle = windowRow({ count: 7, spacing: 5, width: 1, height: 2.2, y: GROUND + 3.2 });
      aisle.position.set(x, 0, z + side * 10.03);
      aisle.rotation.y = side > 0 ? 0 : Math.PI;
      city.add(aisle);
    }
    const doors = windowRow({ count: 3, spacing: 5.5, width: 2.2, height: 4.6, y: GROUND });
    doors.rotation.y = -Math.PI / 2;
    doors.position.set(x - 19.03, 0, z);
    city.add(doors);
  }

  // The court before it: "open to the sky, of great extent, embellished on all sides with columns".
  const [ax, az, aw, ad] = [x - 19 - 14, z, 28, 20];
  city.add(groundPlane(aw, ad, M.paving, ax, GROUND + 0.04, az));
  const side = (length, cx, cz, rotation) => {
    const walk = new THREE.Group();
    walk.add(colonnade({ length: length - 3, count: Math.round(length / 3.3), height: 4.6, radius: 0.32 }));
    walk.add(box(length, 0.45, 3.4, M.roof, 0, 4.6, -1.4));
    walk.position.set(cx, GROUND, cz);
    walk.rotation.y = rotation;
    city.add(walk);
  };
  side(aw, ax, az + ad / 2 - 1.2, Math.PI);
  side(aw, ax, az - ad / 2 + 1.2, 0);
  side(ad, ax - aw / 2 + 1.2, az, Math.PI / 2);
  city.add(box(aw, 1, 0.6, M.stone, ax, GROUND, az + ad / 2));
  city.add(box(aw, 1, 0.6, M.stone, ax, GROUND, az - ad / 2));
  city.add(box(0.6, 1, ad, M.stone, ax - aw / 2, GROUND, az));
  if (detail) {
    city.add(cylinder(1.8, 2, 0.8, M.marble, ax, GROUND, az, 12));
    city.add(mesh(new THREE.CircleGeometry(1.6, 12).rotateX(-Math.PI / 2), M.water, ax, GROUND + 0.7, az));
  }

  // The rotunda on the north side, "skilfully terminated in a dome", where the silver coffin lay towards the east.
  const [rx, rz, rr] = [x + 6, z - 10 - 6.5, 7.5];
  city.add(cylinder(rr, rr, 11, M.brick, rx, GROUND, rz, 20));
  city.add(cylinder(rr + 0.4, rr + 0.4, 0.6, M.marble, rx, GROUND + 11, rz, 20));
  city.add(cylinder(6, 6, 3.2, M.brick, rx, GROUND + 11.6, rz, 16));
  city.add(dome(6, M.lead, rx, GROUND + 14.8, rz, { heightScale: 0.8 }));
  city.add(box(0.2, 2.4, 0.2, M.gold, rx, GROUND + 19.4, rz));
  city.add(box(1.4, 0.2, 0.2, M.gold, rx, GROUND + 20.8, rz));
  city.add(faceToward(cylinder(2.6, 2.6, 6, M.brick, rx + rr - 0.3, GROUND, rz, 10, { thetaStart: -Math.PI / 2, thetaLength: Math.PI }), 1, 0));
  city.add(faceToward(dome(2.6, M.roof, rx + rr - 0.3, GROUND + 6, rz, { phiLength: Math.PI, heightScale: 0.6, segments: 12 }), 1, 0));
  if (detail) {
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
      const window = mesh(archGeometry(0.9, 2.2), M.opening, rx + Math.sin(a) * 6.03, GROUND + 12, rz + Math.cos(a) * 6.03);
      window.rotation.y = a;
      city.add(window);
    }
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + Math.PI / 6 + Math.PI;
      const window = mesh(archGeometry(1.1, 3.2), M.opening, rx + Math.sin(a) * (rr + 0.03), GROUND + 5.5, rz + Math.cos(a) * (rr + 0.03));
      window.rotation.y = a;
      city.add(window);
    }
  }
  for (const [dx, dz] of [[-38, -16], [-38, 8], [26, 8], [30, -18]]) city.add(cypress(11, x + dx, GROUND, z + dz));
}

/** A smaller domed church of the town itself, near the agora. */
function addTownChurch(city, detail) {
  const [x, z] = [-16, -40];
  city.add(box(14, 7, 14, M.brick, x, GROUND, z));
  city.add(hipRoof(14, 14, 1.4, M.roof, x, GROUND + 7, z, 0.4));
  city.add(box(15, 9.5, 5.5, M.brick, x, GROUND, z));
  city.add(box(5.5, 9.5, 15, M.brick, x, GROUND, z));
  city.add(gableRoof(15, 5.5, 1.9, M.roof, x, GROUND + 9.5, z, 0.4));
  city.add(gableRoof(15, 5.5, 1.9, M.roof, x, GROUND + 9.5, z, 0.4).rotateY(Math.PI / 2));
  city.add(faceToward(cylinder(2.6, 2.6, 6, M.brick, x + 7, GROUND, z, 10, { thetaStart: -Math.PI / 2, thetaLength: Math.PI }), 1, 0));
  city.add(faceToward(dome(2.6, M.roof, x + 7, GROUND + 6, z, { phiLength: Math.PI, heightScale: 0.6, segments: 12 }), 1, 0));
  city.add(cylinder(2.7, 2.7, 3.6, M.brick, x, GROUND + 11.4, z, 12));
  city.add(dome(2.7, M.lead, x, GROUND + 15, z, { heightScale: 0.72 }));
  city.add(box(0.16, 1.8, 0.16, M.gold, x, GROUND + 16.9, z));
  city.add(box(1.1, 0.16, 0.16, M.gold, x, GROUND + 18, z));
  if (detail) {
    const windows = windowRow({ count: 4, spacing: 1.4, width: 0.5, height: 1.8, y: GROUND + 12.2 });
    windows.position.set(x, 0, z + 2.73);
    city.add(windows);
  }
}

/** The temple of Apollo on the headland, roofless and half-fallen by Byzantine times. */
function addTemple(city, rnd) {
  const [x, z] = TEMPLE;
  for (let step = 0; step < 3; step++) city.add(box(22 - step * 1.2, 0.6, 38 - step * 1.2, M.marble, x, GROUND + step * 0.6, z));
  const floor = GROUND + 1.8;
  city.add(box(9, 4.5, 20, M.marble, x, floor, z));
  const marble = tinted('marble', 0xe8dfcf);
  const columns = [];
  for (let i = 0; i < 6; i++) columns.push([x - 8.5 + i * 3.4, z - 16.2], [x - 8.5 + i * 3.4, z + 16.2]);
  for (let j = 1; j < 11; j++) columns.push([x - 8.5, z - 16.2 + j * 2.95], [x + 8.5, z - 16.2 + j * 2.95]);
  for (const [cx, cz] of columns) {
    if (rnd.chance(0.18)) continue;
    const standing = rnd.chance(0.7);
    city.add(cylinder(0.7, 0.8, standing ? 8.5 : rnd.range(1.5, 4.5), marble, cx, floor, cz, 12));
  }
  // A surviving stretch of entablature over the north front, and fallen drums.
  city.add(box(17.5, 1.4, 1.8, marble, x, floor + 8.5, z - 16.2));
  for (let i = 0; i < 6; i++) {
    const drum = cylinder(0.75, 0.75, 1.6, marble, x + rnd.range(-16, 16), GROUND + 0.75, z + rnd.range(-24, 24), 12);
    drum.rotation.set(Math.PI / 2, rnd.range(0, Math.PI), 0);
    city.add(drum);
  }
}

// ---------- the harbour ----------

/** The harbour on the Marmara shore below the south gate: quays along the bay, a mole with a beacon, and warehouses. */
function addHarbour(city, detail) {
  const quay = ([ax, az], [bx, bz], width) => {
    const length = Math.hypot(bx - ax, bz - az);
    const block = box(length, GROUND + 1, width, M.stone, (ax + bx) / 2, -1, (az + bz) / 2);
    block.rotation.y = Math.atan2(-(bz - az), bx - ax);
    city.add(block);
    const coping = box(length + 0.4, 0.4, width + 0.4, M.stoneDark, (ax + bx) / 2, GROUND - 0.05, (az + bz) / 2);
    coping.rotation.y = block.rotation.y;
    city.add(coping);
    return block.rotation.y;
  };
  quay([-70, 56], [-30, 62], 8);
  quay([-30, 62], [12, 81], 8);
  quay([16, 86], [-24, 104], 6); // the mole
  const beacon = [-24, 104];
  city.add(cylinder(2.4, 2.8, 6.5, M.stone, beacon[0], GROUND - 0.4, beacon[1], 10));
  city.add(cylinder(2.9, 2.9, 0.6, M.stoneDark, beacon[0], GROUND + 6.1, beacon[1], 10));
  if (detail) {
    city.add(cylinder(1.3, 1.3, 0.9, M.iron, beacon[0], GROUND + 6.7, beacon[1], 8));
    city.add(mesh(new THREE.IcosahedronGeometry(1, 0), M.fire, beacon[0], GROUND + 8, beacon[1]));
    for (const [bx, bz] of [[-62, 60], [-48, 62.3], [-36, 64], [-21, 69.2], [-7, 75.6], [5, 81]]) city.add(cylinder(0.45, 0.5, 1.1, M.stoneDark, bx, GROUND + 0.35, bz, 8));
  }
  // Warehouses between the south wall and the quay, doors to the water.
  for (const [x, z, w] of [[-22, 59, 12], [-6, 61, 13], [26, 72, 11]]) {
    city.add(box(w, 5.5, 7, M.brick, x, GROUND, z));
    city.add(gableRoof(w, 7, 2.4, M.roof, x, GROUND + 5.5, z, 0.5));
    if (detail) city.add(mesh(archGeometry(2.2, 3.4), M.opening, x, GROUND, z + 3.53));
  }
}

// ---------- the town ----------

/** Houses within the walls (and on the acropolis), with a straggle outside by the shrine and the harbour. */
function scatterTown(city, rnd, { detail, elevation }) {
  const avoid = [
    [AGORA[0], AGORA[1], 27], [THEATRE[0] - 4, THEATRE[1], 28], [EUPHEMIA[0], EUPHEMIA[1], 24], [EUPHEMIA[0] - 33, EUPHEMIA[1], 17],
    [EUPHEMIA[0] + 6, EUPHEMIA[1] - 16.5, 11], [TEMPLE[0], TEMPLE[1], 26], [-16, -40, 12], [-24, 104, 6],
  ];
  const place = (count, [x0, z0, x1, z1], inside) => {
    for (let attempt = 0, placed = 0; attempt < count * 40 && placed < count; attempt++) {
      const x = rnd.range(x0, x1);
      const z = rnd.range(z0, z1);
      const w = rnd.range(7, 13);
      const d = rnd.range(6, 10);
      const r = Math.max(w, d) / 2;
      if (pointInPolygon([x, z], CIRCUIT) !== inside || distanceToPolyline([x, z], CIRCUIT, true) < r + 4) continue;
      if (!pointInPolygon([x, z], COAST) || distanceToPolyline([x, z], COAST, true) < r + 3) continue;
      if (inside && (Math.abs(x - 10) < r + 4 || Math.abs(z - 30) < r + 4)) continue; // the streets
      if (detail && Math.abs(acropolisRadius(x, z) - 1) * Math.min(ACROPOLIS.rx, ACROPOLIS.rz) < r + 3) continue;
      if (avoid.some(([ax, az, ar]) => Math.hypot(x - ax, z - az) < ar)) continue;
      const tall = rnd.chance(0.3);
      const house = createHouse({
        w, d, h: tall ? rnd.range(7.5, 10) : rnd.range(4.5, 6.5), color: rnd.pick(PLASTER),
        roof: rnd.chance(0.55) ? 'hip' : 'gable', windows: detail,
      });
      house.position.set(x, elevation(x, z), z);
      house.rotation.y = rnd.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]) + rnd.range(-0.12, 0.12);
      city.add(house);
      avoid.push([x, z, r + 5]);
      placed++;
    }
  };
  place(detail ? 48 : 22, [-34, -62, 114, 48], true);
  if (detail) {
    place(7, [40, -104, 104, -74], false);
    place(4, [-70, 36, -44, 54], false);
  }
}

/** Cypresses about the town, and olives on the acropolis and the headland. */
function addPlanting(city, rnd, detail, elevation) {
  for (let i = 0; i < (detail ? 26 : 8); i++) {
    const x = rnd.range(-88, 126);
    const z = rnd.range(-104, 104);
    if (!pointInPolygon([x, z], COAST) || distanceToPolyline([x, z], COAST, true) < 4 || distanceToPolyline([x, z], CIRCUIT, true) < 5) continue;
    if (Math.hypot(x - AGORA[0], z - AGORA[1]) < 24 || Math.hypot(x - THEATRE[0], z - THEATRE[1]) < 26) continue;
    if (Math.hypot(x - EUPHEMIA[0], z - EUPHEMIA[1]) < 26 || Math.hypot(x - TEMPLE[0], z - TEMPLE[1]) < 24) continue;
    if (Math.abs(x - 10) < 6 || Math.abs(z - 30) < 6 || (detail && Math.abs(acropolisRadius(x, z) - 1) * 30 < 3)) continue;
    if (z > 52 && x > -40 && x < 20) continue; // the harbour strip
    const y = elevation(x, z);
    city.add(rnd.chance(0.5) ? cypress(rnd.range(9, 13), x, y, z) : roundTree(rnd.range(5, 8), x, y, z));
  }
  if (!detail) return;
  // Olive groves in rows on the open ground south-east of the walls.
  for (let row = 0; row < 5; row++) {
    for (let k = 0; k < 5; k++) city.add(roundTree(4.5, 72 + row * 9 + (k % 2) * 3, GROUND, 64 + k * 8 + row * 1.5));
  }
}

// ---------- the living parts ----------

/** Fishing boats and a merchant ship in the harbour. */
function addShipping(city) {
  const { geometry, deck } = createHull({ length: 9, beam: 2.6, depth: 1, bowRise: 0.6, sternRise: 0.6, segments: 16, ribs: 8 });
  for (const [x, z, rotation] of [[-44, 70, 0.3], [-56, 66, -0.2], [-4, 89, 2.4]]) {
    const boat = new THREE.Group();
    boat.add(mesh(geometry, M.hull, 0, 0.6, 0), mesh(deck, M.wood, 0, 0.4, 0));
    boat.add(cylinder(0.08, 0.1, 6, M.wood, 0.8, 0.4, 0, 6));
    boat.position.set(x, 0, z);
    boat.rotation.y = rotation;
    const phase = x;
    boat.userData.animate = (time) => { boat.position.y = 0.4 + Math.sin(time * 1.3 + phase) * 0.12; };
    city.add(boat);
  }
  const ship = createMerchantShip({ banner: 'byzantine', sail: false });
  ship.scale.setScalar(0.75);
  ship.position.set(-14, 0, 84);
  ship.rotation.y = -0.42;
  city.add(ship);
}

/** Two eagles wheeling above the town. */
function addEagles(city) {
  const feathers = tinted('wood', 0x7a5636);
  for (const [radius, height, speed, phase] of [[42, 38, 0.32, 0], [30, 48, 0.4, 2.4]]) {
    const eagle = createEagle(feathers, M.gold, tinted('marble', 0xffffff));
    eagle.scale.setScalar(4.5);
    const flap = eagle.userData.animate;
    eagle.userData.animate = (time) => {
      flap(time);
      const angle = time * speed + phase;
      eagle.position.set(20 + Math.cos(angle) * radius, height + Math.sin(time * 0.7 + phase) * 3, -10 + Math.sin(angle) * radius);
      eagle.rotation.set(0.25, -angle - Math.PI / 2, 0, 'YXZ');
    };
    city.add(eagle);
  }
}

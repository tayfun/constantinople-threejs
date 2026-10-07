import * as THREE from 'three';
import { materials as M } from './lib/materials.js';
import {
  box, boxGeometry, colonnade, crenellationGeometry, cylinder, flag, gableRoof, groundPlane,
  hipRoof, mesh, pyramid, stairs,
} from './lib/primitives.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mapStone, wallAlongGeometry } from './lib/mapWalls.js';
import { scatterHouses } from './lib/buildings.js';
import { finalizeModel } from './lib/merge.js';
import { addGalataKeep } from './galataTower.js';
import { labelAt, labelled } from './lib/parts.js';
import { createRandom } from '../util/random.js';
import { createMerchantShip } from './merchantShip.js';
import { GALATA_SHORE, GALATA_WALLS, LAND_HEIGHT, METERS_TO_MAP, magnify } from '../data/geography.js';

/**
 * Galata (Pera), the walled Genoese colony across the Golden Horn (1267–1453):
 * the Palazzo del Comune of the Podestà (1316, a copy of the 13th-century
 * wing of Genoa's Palazzo San Giorgio), the Dominican church of San Paolo
 * e Domenico (1323–37, today the Arap Camii) with its square Gothic bell
 * tower, the merchants' loggia, tall Ligurian houses on the hillside, the
 * keep of the Holy Cross (the Galata Tower, 1348) at the apex of the land
 * wall and a quay with a cocha and a nave. The Golden Horn lies to the
 * south (+z); the hill climbs to the north.
 *
 * Masonry follows the surviving buildings: courses of brick alternating
 * with ashlar, Gothic pointed arches, swallowtail battlements on the palace.
 *
 * Detail: a slice of the colony. Map: the wall circuit in map units with
 * the main buildings at their places (absolute), climbing the hill of Galata.
 */
export function createGenoeseQuarter({ lod = 'detail' } = {}) {
  return lod === 'detail' ? createColony() : createMapColony();
}

const TERRACE = 4; // the upper town stands this much higher than the shore

function createColony() {
  const colony = new THREE.Group();
  colony.add(box(210, 3, 125, M.paving, 0, -3, -12));
  colony.add(box(210, TERRACE, 46, M.paving, 0, 0, -52)); // the upper terrace
  colony.add(box(210, TERRACE, 1.2, M.stoneDark, 0, 0, -28.6)); // its retaining wall
  const steps = stairs(10, 8, 0.5, 0.8, M.stone);
  steps.position.set(-10, 0, -21.6);
  steps.rotation.y = Math.PI;
  colony.add(steps);

  // Sea wall with the harbour gate; the land wall on the hill with the keep at its apex.
  colony.add(mesh(pointedWallGeometry({ length: 200, height: 9, thickness: 3, openings: [{ x: 10, width: 5.5, bottom: 0, height: 7 }] }), M.stone, 0, 0, 40));
  colony.add(mesh(crenellationGeometry(200), M.stone, 0, 9, 41.2));
  for (const x of [-85, -35, 55, 92]) {
    colony.add(box(8, 13, 8, M.stone, x, 0, 40));
    colony.add(mesh(crenellationGeometry(8, { merlon: 0.8, gap: 0.6, height: 1 }), M.stone, x, 13, 3.65 + 40));
  }
  colony.add(box(200, 12, 3.5, M.stone, 0, TERRACE, -68));
  colony.add(mesh(crenellationGeometry(200), M.stone, 0, TERRACE + 12, -69.4));
  for (const x of [-60, 60]) {
    colony.add(box(9, 17, 9, M.stone, x, TERRACE, -68));
    colony.add(mesh(crenellationGeometry(9, { merlon: 0.8, gap: 0.6, height: 1 }), M.stone, x, TERRACE + 17, -68 - 4.15));
  }
  addKeep(colony, 0, TERRACE, -65);
  labelAt(colony, 'galataTower', 0, TERRACE + 68, -65);

  // Quay, harbour water and cargo.
  colony.add(box(210, 1.8, 13, M.stone, 0, -1.2, 47.5));
  colony.add(groundPlane(280, 70, M.water, 0, 0, 89));
  const rnd = createRandom(1267);
  for (let i = 0; i < 18; i++) {
    const x = rnd.range(-90, 90);
    const z = rnd.range(43, 52);
    colony.add(rnd.chance(0.5) ? cylinder(0.6, 0.6, 1.3, M.wood, x, 0.6, z, 10) : box(1.4, 1.2, 1.4, M.sail, x, 0.6, z));
  }
  for (const x of [-20, 40]) colony.add(cylinder(0.3, 0.3, 2, M.wood, x, 0.6, 52, 6)); // mooring posts

  labelled(colony, 'palazzoDelComune', () => addPodestaPalace(colony, { x: -35, z: 6, detail: true }));
  addDominicanChurch(colony, { x: 46, z: 2, detail: true });
  labelAt(colony, 'sanDomenico', 46, 21, 10);
  labelAt(colony, 'sanDomenicoBelfry', 57, 38, -17);

  // The merchants' loggia inside the harbour gate.
  for (const z of [17, 29]) {
    const columns = colonnade({ length: 24, count: 6, height: 7, radius: 0.45 });
    columns.position.set(10, 0, z);
    colony.add(columns);
  }
  colony.add(hipRoof(27, 15, 3.5, M.roof, 10, 7, 23));
  labelAt(colony, 'loggia', 10, 11, 23);

  // Tall, narrow Ligurian houses: three or four storeys under tiled gables.
  const avoid = [[-35, 6, 26], [46, 2, 30], [10, 23, 18], [10, 36, 8], [0, -65, 16], [-10, -25, 8]];
  labelled(colony, 'ligurianHouses', () => {
    scatterHouses(colony, rnd, { count: 14, area: [-95, -26, 95, 32], avoid, style: { roof: 'gable', w: 8, d: 7, h: 13 } });
  }, { near: [85, 20] });
  scatterHouses(colony, rnd, { count: 10, area: [-95, -26, 95, 32], avoid, style: { roof: 'gable', w: 10, d: 7, h: 10 } });
  scatterHouses(colony, rnd, { count: 12, area: [-95, -62, 95, -36], avoid, groundAt: () => TERRACE, style: { roof: 'gable', w: 8, d: 7, h: 12 } });
  scatterHouses(colony, rnd, { count: 8, area: [-95, -62, 95, -36], avoid, groundAt: () => TERRACE, style: { roof: 'gable', w: 9, d: 7, h: 9 } });

  finalizeModel(colony);
  colony.add(placed(flag('genoa', { width: 4, height: 2.6, pole: 7 }), -35, 17.5, -2));
  colony.add(placed(flag('genoa', { width: 3, height: 2, pole: 6 }), 10, 9, 40));
  colony.add(placed(createMerchantShip({ banner: 'genoa', rig: 'square' }), 30, 0, 70, -0.15));
  colony.add(placed(createMerchantShip({ banner: 'genoa', sail: false }), -55, 0, 72, Math.PI + 0.1));
  return colony;
}

function placed(object, x, y, z, rotation = 0) {
  object.position.set(x, y, z);
  object.rotation.y = rotation;
  return object;
}

/** The keep of the Holy Cross at the top of the hill: the Galata Tower, built as in its own diorama. */
function addKeep(group, x, y, z) {
  const keep = addGalataKeep(new THREE.Group());
  keep.position.set(x, y, z);
  group.add(keep);
}

/**
 * Palazzo del Comune (1316), seat of the Podestà, modelled on the 13th-century
 * wing of Palazzo San Giorgio: a Gothic arcade at street level, two storeys
 * of two-light pointed windows, and swallowtail (Ghibelline) battlements.
 * Faces the harbour (+z). The map keeps the loggia, the merlons and the roof
 * and leaves out the window rows.
 */
function addPodestaPalace(group, { x, z, detail }) {
  const [w, d, h] = [36, 20, 16];
  const curveSegments = detail ? 8 : 4;
  const merlons = detail ? {} : { merlon: 1.8, gap: 1.2, height: 1.8 };
  // The arcaded front, the solid body behind it, cornice and battlements.
  const openings = Array.from({ length: 7 }, (_, i) => ({ x: -15 + i * 5, width: 3.4, bottom: 0, height: 5.4 }));
  group.add(mesh(pointedWallGeometry({ length: w, height: h, thickness: 1.2, openings, curveSegments }), M.banded, x, 0, z + d / 2 - 0.6));
  group.add(box(w, h, d - 1.2, M.banded, x, 0, z - 0.6));
  group.add(box(w + 0.8, 0.5, d + 0.8, M.stone, x, h, z));
  for (const side of [-1, 1]) {
    group.add(mesh(swallowtailGeometry(w + 0.8, merlons), M.stone, x, h + 0.5, z + side * (d / 2 + 0.05)));
    const flank = mesh(swallowtailGeometry(d - 1, merlons), M.stone, x + side * (w / 2 + 0.05), h + 0.5, z);
    flank.rotation.y = Math.PI / 2;
    group.add(flank);
  }
  group.add(hipRoof(w - 3, d - 3, 3, M.roof, x, h + 0.5, z, 0));
  group.add(box(w, 0.6, 5, M.stone, x, 5.6, z + d / 2 - 2.5)); // the loggia floor
  if (!detail) return;
  // The two-light windows of the piano nobile and the storey above.
  const light = pointedArchGeometry(0.9, 2.8);
  for (const [y, count] of [[7.6, 7], [12.2, 7]]) {
    for (let i = 0; i < count; i++) {
      const wx = x - 15 + i * 5;
      group.add(mesh(pointedArchGeometry(2.8, 3.6), M.stoneDark, wx, y - 0.3, z + d / 2 + 0.02));
      for (const side of [-0.6, 0.6]) group.add(mesh(light, M.opening, wx + side, y, z + d / 2 + 0.04));
      group.add(cylinder(0.12, 0.12, 2.3, M.marble, wx, y, z + d / 2 + 0.05, 6));
    }
  }
  // Windows on the ends.
  for (const side of [-1, 1]) {
    for (const y of [7.6, 12.2]) {
      for (const wz of [-5, 0, 5]) {
        const window = mesh(pointedArchGeometry(1.4, 3), M.opening, x + side * (w / 2 + 0.03), y, z + wz);
        window.rotation.y = side * Math.PI / 2;
        group.add(window);
      }
    }
  }
}

/**
 * San Paolo e Domenico (1323–37): a three-aisled mendicant basilica in the
 * Ligurian Gothic manner — a tall nave under a timber roof, lower lean-to
 * aisles with buttresses, a square groin-vaulted sanctuary, lancet windows,
 * a rose window in the west front, and the square bell tower at the
 * south-east corner. The west front faces the harbour (+z). The map keeps
 * the aisles with their buttresses, the portal and rose and the belfry, and
 * leaves out the rows of lancets.
 */
function addDominicanChurch(group, { x, z, detail }) {
  const length = 40;
  const nave = 10;
  const aisle = 5;
  const segments = detail ? 6 : 3; // of the pointed arches
  const lift = detail ? 0.02 : 0.1; // flat openings stand off the wall more on the map, which is seen from far away
  group.add(box(nave, 16, length, M.banded, x, 0, z));
  const roof = gableRoof(length, nave, 4.2, M.roof, x, 16, z, 0.4);
  roof.rotation.y = Math.PI / 2;
  group.add(roof);
  for (const side of [-1, 1]) {
    group.add(box(aisle, 9, length, M.banded, x + side * (nave + aisle) / 2, 0, z));
    group.add(mesh(leanToRoofGeometry(length + 0.8, aisle + 0.6, 2.6, side), M.roof, x + side * (nave / 2 + aisle / 2 + 0.3), 9, z));
    for (let i = 0; i < 6; i++) group.add(box(1, 7.5, 1.4, M.stone, x + side * (nave / 2 + aisle + 0.4), 0, z - length / 2 + 7.2 + i * 6.4)); // buttresses
  }
  // Square sanctuary at the east end.
  group.add(box(nave, 13, 10, M.banded, x, 0, z - length / 2 - 5));
  const chancelRoof = gableRoof(10, nave, 3.6, M.roof, x, 13, z - length / 2 - 5, 0.4);
  chancelRoof.rotation.y = Math.PI / 2;
  group.add(chancelRoof);
  // The bell tower: four storeys, a belfry of twin lancets, pyramid roof.
  const [tx, tz] = [x + 11, z - 19];
  group.add(box(6.5, 30, 6.5, M.banded, tx, 0, tz));
  group.add(box(7.1, 0.5, 7.1, M.stone, tx, 30, tz));
  group.add(pyramid(7.4, 7.4, 7, M.roof, tx, 30.5, tz));
  // West front: portal and rose window.
  const front = z + length / 2 + lift;
  group.add(mesh(pointedArchGeometry(3, 5.5, segments), M.stoneDark, x, 0, front));
  group.add(mesh(pointedArchGeometry(2.2, 4.6, segments), M.opening, x, 0, front + lift));
  group.add(mesh(new THREE.RingGeometry(2.6, 3.1, detail ? 24 : 12), M.stone, x, 11.5, front));
  group.add(mesh(new THREE.CircleGeometry(2.6, detail ? 24 : 12), M.opening, x, 11.5, front + lift / 2));
  // Belfry openings on all four faces, and in the diorama a lancet per storey below.
  const lancet = pointedArchGeometry(0.9, 3.6, segments);
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2;
    const face = new THREE.Group();
    for (const dx of [-1.3, 1.3]) face.add(mesh(pointedArchGeometry(1.4, 4.2, segments), M.opening, dx, 23.5, 0));
    if (detail) {
      face.add(mesh(lancet, M.opening, 0, 16, 0));
      face.add(mesh(lancet, M.opening, 0, 9, 0));
    }
    face.rotation.y = angle;
    face.position.set(tx + Math.sin(angle) * (3.25 + lift), 0, tz + Math.cos(angle) * (3.25 + lift));
    group.add(face);
  }
  if (!detail) return;

  const tall = pointedArchGeometry(1.1, 4.6);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 6; i++) {
      const wz = z - length / 2 + 4 + i * 6.4;
      const clerestory = mesh(lancet, M.opening, x + side * (nave / 2 + 0.03), 11, wz);
      clerestory.rotation.y = side * Math.PI / 2;
      group.add(clerestory);
      const low = mesh(tall, M.opening, x + side * (nave / 2 + aisle + 0.03), 3.2, wz);
      low.rotation.y = side * Math.PI / 2;
      group.add(low);
    }
  }
  // The gable's small lancets; east lancets in the sanctuary.
  for (const side of [-1, 1]) group.add(mesh(lancet, M.opening, x + side * (nave + aisle) / 2, 2.5, front));
  for (const side of [-1, 1]) {
    const east = mesh(tall, M.opening, x + side * 2.6, 5, z - length / 2 - 10 - 0.03);
    east.rotation.y = Math.PI;
    group.add(east);
  }
}

// ---------- Gothic helpers ----------

/** An equilateral pointed arch standing on y = 0, apex at height h. */
function pointedArchShape(w, h, x = 0, y = 0) {
  const r = w / 2;
  const spring = Math.max(0.1, h - w * Math.sin(Math.PI / 3));
  const shape = new THREE.Shape();
  shape.moveTo(x - r, y);
  shape.lineTo(x + r, y);
  shape.lineTo(x + r, y + spring);
  shape.absarc(x - r, y + spring, w, 0, Math.PI / 3, false);
  shape.absarc(x + r, y + spring, w, (Math.PI * 2) / 3, Math.PI, false);
  shape.lineTo(x - r, y);
  return shape;
}

function pointedArchGeometry(w, h, curveSegments = 6) {
  return new THREE.ShapeGeometry(pointedArchShape(w, h), curveSegments);
}

/** A wall along x pierced by pointed arches { x, width, bottom, height }; those with bottom 0 are cut from the foot. */
function pointedWallGeometry({ length, height, thickness, openings = [], curveSegments = 8 }) {
  const half = length / 2;
  const sorted = [...openings].sort((a, b) => a.x - b.x);
  const shape = new THREE.Shape();
  shape.moveTo(-half, 0);
  for (const opening of sorted) {
    if (opening.bottom > 0) continue;
    const r = opening.width / 2;
    const spring = Math.max(0.1, opening.height - opening.width * Math.sin(Math.PI / 3));
    shape.lineTo(opening.x - r, 0);
    shape.lineTo(opening.x - r, spring);
    shape.absarc(opening.x + r, spring, opening.width, Math.PI, (Math.PI * 2) / 3, true);
    shape.absarc(opening.x - r, spring, opening.width, Math.PI / 3, 0, true);
    shape.lineTo(opening.x + r, 0);
  }
  shape.lineTo(half, 0);
  shape.lineTo(half, height);
  shape.lineTo(-half, height);
  shape.lineTo(-half, 0);
  for (const opening of sorted) {
    if (opening.bottom <= 0) continue;
    shape.holes.push(pointedArchShape(opening.width, opening.height, opening.x, opening.bottom));
  }
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments });
  return geometry.translate(0, 0, -thickness / 2);
}

/** Swallowtail (Ghibelline) merlons along x, base at y = 0. */
function swallowtailGeometry(length, { merlon = 1.4, gap = 0.9, height = 1.6, thickness = 0.6 } = {}) {
  const count = Math.max(1, Math.floor((length + gap) / (merlon + gap)));
  const used = count * merlon + (count - 1) * gap;
  const parts = [];
  for (let i = 0; i < count; i++) {
    const cx = -used / 2 + merlon / 2 + i * (merlon + gap);
    parts.push(boxGeometry(merlon, height * 0.55, thickness).translate(cx, 0, 0));
    for (const side of [-1, 1]) parts.push(boxGeometry(merlon * 0.3, height * 0.45, thickness).translate(cx + side * merlon * 0.35, height * 0.55, 0));
  }
  return mergeGeometries(parts);
}

/** A lean-to roof over an aisle: ridge against the nave, sloping outwards on `side`. */
function leanToRoofGeometry(length, width, rise, side) {
  const shape = new THREE.Shape([new THREE.Vector2(-width / 2 * side, rise), new THREE.Vector2(width / 2 * side, 0), new THREE.Vector2(width / 2 * side, -0.3), new THREE.Vector2(-width / 2 * side, -0.3)]);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: length, bevelEnabled: false });
  return geometry.translate(0, 0, -length / 2);
}

// ---------- map version ----------

function createMapColony() {
  const colony = new THREE.Group();
  const [east, north] = magnify([-2.2, 16.6]);
  const palace = [east, north];
  const church = [east - 4.75, north + 2];
  // Keep the map's scattered houses clear of the palace and the church.
  colony.userData.keepOut = [[...palace, 1.4], [...church, 1.5]];

  // Galata climbs its hill, so the colony is built once the ground is known (mapView.js calls this).
  colony.userData.onGround = (ground) => {
    colony.add(mesh(wallAlongGeometry(GALATA_WALLS, { height: 0.55, thickness: 0.2, y: LAND_HEIGHT, towerSpacing: 1.7, towerWidth: 0.42, towerHeight: 0.85, ground }), mapStone));
    colony.add(mesh(wallAlongGeometry(GALATA_SHORE, { height: 0.35, thickness: 0.14, y: LAND_HEIGHT, offset: -0.35, ground }), mapStone));
    const stand = (build, [e, n]) => {
      const building = new THREE.Group();
      build(building, { x: 0, z: 0, detail: false });
      building.scale.setScalar(5 * METERS_TO_MAP);
      building.position.set(e, LAND_HEIGHT + ground.heightAt([e, n]), -n);
      colony.add(building);
    };
    stand(addPodestaPalace, palace);
    stand(addDominicanChurch, church);
    finalizeModel(colony);
  };
  return colony;
}

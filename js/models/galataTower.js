import * as THREE from 'three';
import { materials as M } from './lib/materials.js';
import {
  archGeometry, archedWallGeometry, box, cone, crenellationGeometry, cylinder, cypress, faceToward, gableRoof, mesh, placeOnCircle, pyramid,
  roundTree,
} from './lib/primitives.js';
import { finalizeModel } from './lib/merge.js';
import { createRandom } from '../util/random.js';

/**
 * The Galata Tower — Turris Sancte Crucis, the "Tower of the Holy Cross",
 * later Christea Turris — raised by the Genoese in 1348 as the keep at the
 * apex of their walled colony, shown as it stands today, the form everyone
 * knows: a round shaft of rough-cut rubble 16.45 m across, lit by a few small
 * arched windows, under a moulded cornice; above it the arcaded storey of
 * tall round-arched bays in pale ashlar, the corbelled viewing balcony with
 * its iron railing, a short set-back top storey, and the steep lead cone
 * with its dormers and gilded finial, 62.59 m high without the finial and
 * about 67 m with it. The arcaded top is Ottoman work, and the cone was
 * rebuilt in 1965–67 after a century without one (Buondelmonti drew the
 * Genoese tower in the 1420s with battlements and a plain cone).
 * The colony walls step down the hill of Galata from it to either side (the
 * Golden Horn lies to the +z side). The detail shows the hill itself, the
 * old Sykai, "the figs": a level summit with the keep's forecourt, the
 * slope falling steeply to the Horn and gently inland, terraced with tall
 * Ligurian houses and lanes inside the walls, a church with a belfry, and
 * cypresses and fig orchards outside.
 *
 * Measured values from the surviving tower (Wikipedia, Structurae);
 * proportions of the upper storeys from Sébah's photograph (1880s) and
 * recent photographs.
 */

const BASE_RADIUS = 8.22; // 16.45 m external diameter
const SHAFT_TOP = 32; // the moulded cornice
const SHAFT_TOP_RADIUS = 7.7;
const ARCADE_TOP = 39.4;
const BALCONY = 40.5; // the viewing deck
const EAVES = 44.4;
const APEX = 62.59;
const FINIAL_TIP = 66.9;

export function createGalataTower({ lod = 'detail' } = {}) {
  const detail = lod === 'detail';
  const tower = new THREE.Group();
  addGalataKeep(tower, { detail });

  if (detail) {
    addHill(tower);
    for (const angle of WALL_RUNS) addSlopeWall(tower, angle, angle === Math.PI * 0.2); // the gate on the +x run
  } else {
    // The map has no hill under the keep, so there the colony walls run level in two steps to either side.
    const steps = [[0, 9, 13], [0, 10, 12]];
    for (const angle of WALL_RUNS) {
      const wall = new THREE.Group();
      let x = BASE_RADIUS - 1;
      for (const [i, [y, length, height]] of steps.entries()) {
        wall.add(box(length + 1, height - y, 3.2, M.stone, x + length / 2, y - 1, 0));
        wall.add(mesh(crenellationGeometry(length, { merlon: 1.1, gap: 0.8, height: 1.3, thickness: 0.7 }), M.stone, x + length / 2, height, 1.25));
        x += length;
        const last = i === steps.length - 1;
        const towerHeight = last ? height + 6 : height + 3.5;
        const size = last ? 7 : 6;
        wall.add(box(size, towerHeight - y + 1, size, M.stone, x, y - 1, 0));
        wall.add(mesh(crenellationGeometry(size, { merlon: 0.9, gap: 0.7, height: 1.2 }), M.stone, x, towerHeight, size / 2 - 0.35));
        wall.add(mesh(crenellationGeometry(size, { merlon: 0.9, gap: 0.7, height: 1.2 }), M.stone, x, towerHeight, -(size / 2 - 0.35)));
        x += size / 2;
      }
      wall.rotation.y = -angle;
      tower.add(wall);
    }
  }

  return finalizeModel(tower);
}

// The colony walls leave the keep at these bearings (0 = +x, PI/2 = +z, towards the Horn) and run down the hill to the shore.
const WALL_RUNS = [Math.PI * 0.8, Math.PI * 0.2];
const HILL_RADIUS = 66;
const SUMMIT = 28; // the level top of the hill, which carries the keep and its forecourt

/**
 * The tower itself, standing at the origin of `group`; shared with the
 * Genoese colony's diorama. `detail: false` keeps the silhouette and leaves
 * out the small windows, dormers and the railing's posts.
 */
export function addGalataKeep(group, { detail = true } = {}) {
  const segments = detail ? 40 : 24;
  const radiusAt = (y) => BASE_RADIUS + (SHAFT_TOP_RADIUS - BASE_RADIUS) * (y / SHAFT_TOP);

  // The rubble shaft, tapering a little, and the moulded cornice that crowns it.
  group.add(cylinder(SHAFT_TOP_RADIUS, BASE_RADIUS, SHAFT_TOP, M.rubble, 0, 0, 0, segments));
  for (const [y, h, out] of [[SHAFT_TOP - 0.6, 0.5, 0.25], [SHAFT_TOP - 0.1, 0.45, 0.55], [SHAFT_TOP + 0.35, 0.55, 0.85]]) {
    group.add(cylinder(SHAFT_TOP_RADIUS + out, SHAFT_TOP_RADIUS + out, h, M.stone, 0, y, 0, segments));
  }

  // The door, and the shaft's few small arched windows: a ring of little lights under the
  // cornice, larger windows below them, and a handful scattered down the shaft.
  const front = Math.PI / 2;
  group.add(placeOnCircle(mesh(archGeometry(2.2, 3.6), M.opening), front, BASE_RADIUS + 0.08, 0.2));
  group.add(placeOnCircle(mesh(archGeometry(3.2, 4.4), M.stone), front, BASE_RADIUS + 0.02, 0));
  const rows = detail
    ? [[28.6, 8, 0.7, 1.3, 0.1], [24.2, 4, 1.2, 2, 0.25], [18.5, 3, 0.8, 1.6, 0.6], [11, 3, 0.7, 1.4, 0.1]]
    : [[28.6, 8, 0.9, 1.5, 0.1], [24.2, 4, 1.4, 2.2, 0.25]];
  for (const [y, count, width, height, offset] of rows) {
    const window = archGeometry(width, height);
    for (let i = 0; i < count; i++) {
      group.add(placeOnCircle(mesh(window, M.opening), ((i + offset) / count) * Math.PI * 2, radiusAt(y) + 0.04, y));
    }
  }

  // The arcaded storey: piers carrying round arches, a tall arched window in each bay.
  const arcadeBase = SHAFT_TOP + 0.9;
  const bays = 12;
  // The drum stops inside the band over the arches, and the piers run on up into the corbel course, so no two tops share a plane.
  group.add(cylinder(7.3, 7.3, ARCADE_TOP - 0.1 - arcadeBase, M.stone, 0, arcadeBase, 0, segments));
  for (let i = 0; i < bays; i++) {
    const pier = (i / bays) * Math.PI * 2;
    group.add(placeOnCircle(box(1.3, ARCADE_TOP + 0.15 - arcadeBase, 1.1, M.stone), pier, 7.6, arcadeBase));
    const bay = pier + Math.PI / bays;
    group.add(placeOnCircle(mesh(archGeometry(3.0, 5.4), M.stoneDark), bay, 7.35, arcadeBase + 0.3)); // the deep arch
    group.add(placeOnCircle(mesh(archGeometry(1.6, 3.4), M.opening), bay, 7.42, arcadeBase + 0.9)); // the window in it
  }
  group.add(cylinder(8.0, 8.0, 0.7, M.stone, 0, ARCADE_TOP - 0.7, 0, segments)); // band over the arches

  // The balcony: a flaring corbel course, the deck, and an iron railing.
  group.add(cylinder(9.2, 8.0, BALCONY - 0.3 - ARCADE_TOP, M.stone, 0, ARCADE_TOP, 0, segments));
  group.add(cylinder(9.2, 9.2, 0.3, M.stone, 0, BALCONY - 0.3, 0, segments));
  const rail = mesh(new THREE.TorusGeometry(9.05, 0.07, 4, segments * 2).rotateX(Math.PI / 2), M.iron, 0, BALCONY + 1.1, 0);
  group.add(rail);
  const posts = detail ? 64 : 0;
  for (let i = 0; i < posts; i++) group.add(placeOnCircle(box(0.07, 1.1, 0.07, M.iron), (i / posts) * Math.PI * 2, 9.05, BALCONY));
  if (!detail) group.add(cylinder(9.05, 9.05, 1.1, M.iron, 0, BALCONY, 0, segments, { open: true }));

  // The set-back top storey with its doors onto the balcony, and the eaves.
  group.add(cylinder(6.6, 6.6, EAVES - BALCONY, M.stone, 0, BALCONY, 0, segments));
  const doors = detail ? 16 : 8;
  for (let i = 0; i < doors; i++) group.add(placeOnCircle(mesh(archGeometry(1.1, 2.5), M.opening), ((i + 0.5) / doors) * Math.PI * 2, 6.66, BALCONY + 0.3));
  group.add(cylinder(7.2, 7.2, 0.4, M.stoneDark, 0, EAVES, 0, segments));

  // The steep lead cone, narrower than the balcony, with its little dormers, and the gilded finial.
  const coneBase = EAVES + 0.4;
  const coneHeight = APEX - coneBase;
  const coneRadius = 7.1;
  group.add(cone(coneRadius, coneHeight, M.lead, 0, coneBase, 0, segments));
  if (detail) {
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const rise = 5;
      const dormer = new THREE.Group();
      dormer.add(box(0.9, 1.1, 1.4, M.lead, 0, 0, -0.5));
      dormer.add(gableRoof(1.4, 0.9, 0.45, M.lead, 0, 1.1, -0.5, 0.06).rotateY(Math.PI / 2));
      dormer.add(mesh(archGeometry(0.5, 0.9), M.opening, 0, 0.1, 0.26));
      group.add(placeOnCircle(dormer, angle, coneRadius * (1 - rise / coneHeight), coneBase + rise));
    }
  }
  group.add(cylinder(0.14, 0.24, 1.3, M.gold, 0, APEX - 0.4, 0, 8));
  group.add(mesh(new THREE.SphereGeometry(0.5, 12, 8), M.gold, 0, APEX + 1.3, 0));
  group.add(cylinder(0.09, 0.13, 1.0, M.gold, 0, APEX + 1.7, 0, 8));
  group.add(mesh(new THREE.SphereGeometry(0.3, 10, 8), M.gold, 0, APEX + 2.9, 0));
  group.add(cone(0.12, FINIAL_TIP - APEX - 3.1, M.gold, 0, APEX + 3.1, 0, 8));
  return group;
}

// ---------- the hill ----------

/**
 * Height of the hill of Galata at (x, z): a level summit, then a slope
 * falling to the rim, steeply towards the Golden Horn (+z) and gently
 * inland, broken by two narrow terraces where the houses stand, with a
 * little noise so it reads as ground rather than a lathe.
 */
function hillHeight(x, z) {
  const r = Math.hypot(x, z);
  if (r <= SUMMIT) return 0;
  // How far down the slope has fallen, 0 at the summit's edge to 1 at the rim, with terraces as near-flat steps.
  const knots = [[SUMMIT, 0], [34, 0.3], [41, 0.35], [49, 0.68], [55, 0.73], [HILL_RADIUS, 1]];
  let f = 1;
  for (let i = 1; i < knots.length; i++) {
    const [r0, f0] = knots[i - 1];
    const [r1, f1] = knots[i];
    if (r <= r1) {
      const t = (r - r0) / (r1 - r0);
      f = f0 + (f1 - f0) * t * t * (3 - 2 * t);
      break;
    }
  }
  const seaward = THREE.MathUtils.smoothstep((z / r + 1) / 2, 0.15, 0.85);
  const depth = 16 + 14 * seaward;
  const noise = (Math.sin(x * 0.21) * Math.cos(z * 0.17) * 0.6 + Math.sin((x + z) * 0.33) * 0.4) * Math.min(1, (r - SUMMIT) / 6);
  return -depth * f + noise;
}

/** A polar sheet between two radii following hillHeight(), lifted by `lift`; UVs in metres. */
function hillSheetGeometry(rInner, rOuter, rings, segments, lift = 0) {
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let i = 0; i <= rings; i++) {
    const r = rInner + ((rOuter - rInner) * i) / rings;
    for (let j = 0; j <= segments; j++) {
      const angle = (j / segments) * Math.PI * 2;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      positions.push(x, hillHeight(x, z) + lift, z);
      uvs.push(x, z);
      if (i > 0 && j > 0) {
        const k = i * (segments + 1) + j;
        const p = k - (segments + 1);
        indices.push(p - 1, k, k - 1, p - 1, p, k);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** The cut face of the diorama: a skirt of earth from the hill's rim down to a common floor. */
function skirtGeometry(radius, floor, segments) {
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let j = 0; j <= segments; j++) {
    const angle = (j / segments) * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const top = hillHeight(x, z);
    positions.push(x, top, z, x, floor, z);
    const u = (j / segments) * Math.PI * 2 * radius;
    uvs.push(u, top, u, floor);
    if (j > 0) {
      const k = j * 2;
      indices.push(k - 2, k, k - 1, k - 1, k, k + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * The hill of Galata, the old Sykai ("the figs"), under the keep: the
 * summit with the forecourt and barbican, the slope terraced with tall
 * Ligurian houses and lanes, a church with its belfry, cypresses and the
 * fig trees of the orchards outside the walls.
 */
function addHill(tower) {
  const floor = -34;
  tower.add(mesh(hillSheetGeometry(0, HILL_RADIUS, 44, 96), M.grass));
  tower.add(mesh(skirtGeometry(HILL_RADIUS, floor, 96), M.dirt));
  tower.add(mesh(new THREE.CircleGeometry(HILL_RADIUS, 96).rotateX(-Math.PI / 2), M.dirt, 0, floor, 0));
  tower.add(cylinder(16, 16, 0.3, M.paving, 0, -0.1, 0, 32));
  // The barbican: a low wall closing the forecourt before the door, with its own gate.
  const barbican = new THREE.Group();
  barbican.add(mesh(new THREE.ShapeGeometry(forecourtShape()).rotateX(-Math.PI / 2), M.paving, 0, 0.08, 0));
  for (const [x, z, length, rotation, gate] of [[-10, 18, 20, 0, true], [10, 18, 20, 0, false], [-20, 9, 18, Math.PI / 2, false], [20, 9, 18, Math.PI / 2, false]]) {
    const piece = new THREE.Group();
    const height = rotation ? 5.56 : 5.5; // the side walls a shade taller, so no two tops share a plane under the corner towers
    piece.add(box(length, height, 1.8, M.stone, 0, 0, 0));
    piece.add(mesh(crenellationGeometry(length, { merlon: 0.8, gap: 0.6, height: 1, thickness: 0.5 }), M.stone, 0, height, 0.65));
    if (gate) piece.add(mesh(archGeometry(3, 4.2), M.opening, 2, 0, 0.95));
    piece.position.set(x, 0, z);
    piece.rotation.y = rotation;
    barbican.add(piece);
  }
  for (const [x, z] of [[-20, 18], [20, 18]]) barbican.add(box(4, 8, 4, M.stone, x, 0, z));
  tower.add(barbican);

  // Paved lanes: two ring lanes along the terraces, and the lane from the forecourt gate down to the shore.
  for (const [r0, r1] of [[41, 43.2], [55, 57.2]]) tower.add(mesh(hillSheetGeometry(r0, r1, 1, 96, 0.12), M.paving));
  const lane = new THREE.Vector2(-8, 19).normalize();
  for (let s = 20; s < HILL_RADIUS - 4; s += 5) {
    const [x0, z0, x1, z1] = [lane.x * s, lane.y * s, lane.x * (s + 5), lane.y * (s + 5)];
    const [h0, h1] = [hillHeight(x0, z0), hillHeight(x1, z1)];
    const piece = box(3.2, 0.25, 5.6, M.paving, 0, 0, 0);
    faceToward(piece, lane.x, lane.y);
    piece.rotateX(Math.atan2(h0 - h1, 5));
    piece.position.set((x0 + x1) / 2, (h0 + h1) / 2 + 0.05, (z0 + z1) / 2);
    tower.add(piece);
  }

  // Tall, narrow Ligurian houses packed on the terraces inside the walls, facing down the hill; a few outside among the orchards.
  const rnd = createRandom(1348);
  const [from, to] = [...WALL_RUNS].sort((a, b) => a - b);
  const inside = (angle) => angle > from + 0.09 * Math.PI && angle < to - 0.09 * Math.PI;
  const nearLane = (angle) => Math.abs(angle - Math.atan2(lane.y, lane.x)) < 0.06;
  // Each building stands on a plinth cut into the slope. Neighbours' plinths can overlap at the corners, so where
  // they do, a plinth's top is raised in 6 cm steps until it shares no plane with any it touches.
  const plinths = [];
  const stand = (object, x, z, w, d) => {
    const y = hillHeight(x, z);
    const reach = Math.hypot(w + 0.6, d + 0.6) / 2;
    let top = y + 0.2;
    const touching = plinths.filter((p) => Math.hypot(p.x - x, p.z - z) < p.reach + reach);
    while (touching.some((p) => Math.abs(p.top - top) < 0.06)) top += 0.06;
    plinths.push({ x, z, reach, top });
    tower.add(box(w + 0.6, top - (y - 3.0), d + 0.6, M.rubble, x, y - 3.0, z).rotateY(object.rotation.y)); // the plinth
    object.position.set(x, y, z);
    tower.add(object);
  };
  for (const [r, count, extra] of [[37.5, 30, 0], [46, 36, 0], [52, 40, 0], [60.5, 46, 1]]) {
    for (let i = 0; i < count; i++) {
      const angle = ((i + 0.5) / count) * Math.PI * 2;
      const within = inside(angle);
      if (nearLane(angle)) continue;
      if (within ? i % 7 === 3 : !rnd.chance(0.22)) continue; // alleys between the blocks; orchards outside
      const ra = r + rnd.range(-1, 1);
      const [x, z] = [Math.cos(angle) * ra, Math.sin(angle) * ra];
      const house = ligurianHouse(rnd, within ? 3 + extra : 2);
      faceToward(house, x, z);
      house.rotation.y += rnd.range(-0.1, 0.1);
      stand(house, x, z, house.userData.w, house.userData.d);
    }
  }
  // The church of the colony with its belfry, on the lower terrace below the lane.
  const church = createChurch();
  faceToward(church, 1, 1);
  stand(church, 13, 46, 14, 9);

  // Cypresses along the lanes and by the church; figs in the orchards outside the walls and in the yards.
  for (let i = 0; i < 28; i++) {
    const angle = rnd.range(0, Math.PI * 2);
    const r = rnd.range(32, HILL_RADIUS - 3);
    if (inside(angle) && rnd.chance(0.6)) continue;
    const [x, z] = [Math.cos(angle) * r, Math.sin(angle) * r];
    const y = hillHeight(x, z);
    tower.add(rnd.chance(0.45) ? cypress(rnd.range(9, 14), x, y - 0.3, z) : roundTree(rnd.range(5, 7), x, y - 0.3, z));
  }
  for (const [x, z] of [[20, 42], [6, 52], [24, 54], [-24, 40], [-30, 50]]) tower.add(cypress(12, x, hillHeight(x, z) - 0.3, z));
}

/**
 * A Ligurian town house as Galata built them: a narrow front of plastered
 * brick three or four storeys high under a tiled gable, with a door and
 * small arched windows, and often an open loggia under the roof.
 */
function ligurianHouse(rnd, storeys) {
  const house = new THREE.Group();
  const w = rnd.range(6, 8);
  const d = rnd.range(5.5, 7);
  const storey = 3.3;
  const h = storeys * storey;
  const plaster = rnd.pick([M.plasterOchre, M.plaster, M.plasterOchre, M.brick]);
  house.add(box(w, h, d, plaster, 0, 0, 0));
  house.add(gableRoof(w, d, d * 0.34, M.roof, 0, h, 0, 0.45));
  house.add(mesh(archGeometry(1.2, 2.3), M.opening, -w / 4, 0, d / 2 + 0.06));
  const window = archGeometry(0.8, 1.4);
  const loggia = storeys >= 3 && rnd.chance(0.45);
  for (let s = 0; s < storeys; s++) {
    const y = s * storey + 1.3;
    if (loggia && s === storeys - 1) {
      // The loggia: the top floor open to the front behind three little arches on slender columns. The dark recess
      // and the parapet stand a few centimetres proud of the wall so neither shares its plane, the columns before them.
      house.add(box(w - 1.2, storey - 0.9, 1.6, M.opening, 0, s * storey + 0.4, d / 2 - 0.74));
      for (let i = 0; i <= 3; i++) house.add(cylinder(0.14, 0.16, storey - 0.9, M.marble, -w / 2 + 0.6 + ((w - 1.2) * i) / 3, s * storey + 0.4, d / 2 + 0.12, 6));
      house.add(box(w - 1.2, 0.4, 0.3, M.stone, 0, s * storey, d / 2 - 0.03)); // its parapet
      continue;
    }
    for (const dx of s === 0 ? [w / 4] : [-w / 3.2, 0, w / 3.2]) house.add(mesh(window, M.opening, dx, y, d / 2 + 0.06));
    const side = mesh(window, M.opening, w / 2 + 0.06, y, 0);
    side.rotation.y = Math.PI / 2;
    house.add(side);
  }
  house.userData.w = w;
  house.userData.d = d;
  return house;
}

/** The colony's church: a plain gabled nave with an apse, and a square belfry of arched openings under a pyramid roof. */
function createChurch() {
  const church = new THREE.Group();
  church.add(box(14, 8, 9, M.stone, 0, 0, 0));
  church.add(gableRoof(14, 9, 3, M.roof, 0, 8, 0, 0.4));
  church.add(faceToward(cylinder(2.6, 2.6, 6, M.stone, -7, 0, 0, 10, { thetaStart: -Math.PI / 2, thetaLength: Math.PI }), -1, 0));
  church.add(faceToward(mesh(new THREE.SphereGeometry(2.7, 10, 5, 0, Math.PI, 0, Math.PI / 2).scale(1, 0.5, 1), M.roof, -7, 6, 0), -1, 0));
  church.add(mesh(archGeometry(1.8, 3.4), M.opening, 2, 0, 4.56)); // the door in the long side, towards the lane
  for (const dx of [-4, 5]) church.add(mesh(archGeometry(1, 2.4), M.opening, dx, 3.6, 4.56));
  church.add(mesh(new THREE.CircleGeometry(1, 12), M.opening, 7.06, 5.2, 0).rotateY(Math.PI / 2)); // the oculus in the west front
  // The belfry at the east end's corner.
  church.add(box(3.4, 17, 3.4, M.stone, 6.3, 0, -4.6));
  for (const [dx, dz, rot] of [[0, 1.76, 0], [0, -1.76, Math.PI], [1.76, 0, Math.PI / 2], [-1.76, 0, -Math.PI / 2]]) {
    for (const y of [11.5, 14.2]) church.add(mesh(archGeometry(0.9, 1.9), M.opening, 6.3 + dx, y, -4.6 + dz).rotateY(rot));
  }
  church.add(pyramid(4, 4, 3.2, M.roof, 6.3, 17, -4.6));
  church.add(cylinder(0.06, 0.06, 1.2, M.gold, 6.3, 20.2, -4.6, 5));
  church.add(box(0.6, 0.07, 0.07, M.gold, 6.3, 21, -4.6));
  return church;
}

/**
 * One run of the colony wall, leaving the keep at `angle` and stepping
 * down the slope in level lengths to the shore, a tower at each step and,
 * on the +x run, a gate where a lane passes through the wall.
 */
function addSlopeWall(tower, angle, withGate) {
  const dir = new THREE.Vector2(Math.cos(angle), Math.sin(angle));
  const heightAt = (s) => hillHeight(dir.x * s, dir.y * s);
  const place = (object, s, y) => {
    object.position.set(dir.x * s, y, dir.y * s);
    object.rotation.y = -angle;
    tower.add(object);
  };
  const walk = 9; // the wall-walk stands this high over the ground at the top of each length
  const towerSize = 6;
  let s = BASE_RADIUS - 1;
  let top = walk;
  const lengths = [11, 11, 11, 11, 10];
  for (const [i, length] of lengths.entries()) {
    const [s0, s1] = [s, s + length];
    const ground = Math.min(heightAt(s0), heightAt(s1), heightAt((s0 + s1) / 2));
    top = Math.max(heightAt(s0), heightAt(s1)) + walk;
    const gate = withGate && i === 2;
    if (gate) {
      const wall = mesh(archedWallGeometry({
        length: length + 0.4, height: top - (ground - 2), thickness: 3.2, openings: [{ x: 0, width: 3.6, bottom: 0, spring: 3.8 }], curveSegments: 8,
      }), M.stone);
      place(wall, (s0 + s1) / 2, ground - 2);
      // The gate's floor: the opening is cut from the wall's foot, which is sunk into the hill, so a sill brings it up to the lane.
      place(box(4.5, heightAt((s0 + s1) / 2) - (ground - 2) + 0.2, 4, M.paving), (s0 + s1) / 2, ground - 2);
    } else {
      place(box(length + 0.4, top - (ground - 2), 3.2, M.stone), (s0 + s1) / 2, ground - 2);
    }
    // The battlements: the inner row 6 cm taller than the outer, and on the towers the crosswise rows 6 cm taller than the
    // lengthwise, so no two rows' tops lie in one plane where they meet at a corner.
    for (const side of [-1, 1]) place(mesh(crenellationGeometry(length, { merlon: 1.1, gap: 0.8, height: side > 0 ? 1.3 : 1.36, thickness: 0.7 }).translate(0, 0, side * 1.25), M.stone), (s0 + s1) / 2, top);
    s = s1;
    // The tower at the step: taller where the gate passes, and the last one, at the shore, the strongest.
    const last = i === lengths.length - 1;
    const size = last ? 7.5 : gate ? 7 : towerSize;
    const foot = Math.min(heightAt(s - size / 2), heightAt(s + size / 2), ground) - 2;
    const towerTop = Math.max(top, heightAt(s + size / 2) + walk) + (last ? 6 : 3.5);
    place(box(size, towerTop - foot, size, M.stone), s, foot);
    for (const side of [-1, 1]) place(mesh(crenellationGeometry(size, { merlon: 0.9, gap: 0.7, height: 1.2 }).translate(0, 0, side * (size / 2 - 0.35)), M.stone), s, towerTop);
    for (const side of [-1, 1]) place(mesh(crenellationGeometry(size, { merlon: 0.9, gap: 0.7, height: 1.26 }).rotateY(Math.PI / 2).translate(side * (size / 2 - 0.35), 0, 0), M.stone), s, towerTop);
    place(mesh(archGeometry(0.6, 1.6).rotateY(Math.PI / 2).translate(size / 2 + 0.06, 0, 0), M.opening), s, towerTop - 4);
    s += size / 2;
  }
}

function forecourtShape() {
  const shape = new THREE.Shape();
  shape.moveTo(-20, -18);
  shape.lineTo(20, -18);
  shape.lineTo(20, 0);
  shape.lineTo(-20, 0);
  shape.closePath();
  return shape;
}

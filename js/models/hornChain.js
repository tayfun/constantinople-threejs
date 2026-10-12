import * as THREE from 'three';
import { materials as M } from './lib/materials.js';
import {
  archGeometry, box, crenellationGeometry, cylinder, cylinderGeometry, cypress, faceToward, flag, gableRoof, groundPlane, mesh, roundTree,
} from './lib/primitives.js';
import { finalizeModel } from './lib/merge.js';
import { labelAt } from './lib/parts.js';
import { createMerchantShip } from './merchantShip.js';
import { createRandom } from '../util/random.js';
import { CHAIN_NORTH, CHAIN_SOUTH, LAND_HEIGHT, METERS_TO_MAP } from '../data/geography.js';

/**
 * The great chain of the Golden Horn, first stretched by Leo III in 717:
 * wrought-iron links some two feet long, joined every seven links by hooks
 * to the heavy logs that floated it, and in wartime drawn across the mouth
 * of the Horn from the Kastellion of Galata — a Byzantine fort of 50 × 40 m
 * on the north shore, whose tower held the windlass — to the Tower of
 * Eugenios (the Kentenarion) at the foot of the Acropolis, where the sea
 * wall turns. Surviving links are shown in Istanbul's museums.
 *
 * The links follow the sections in the Naval and Military Museums: long,
 * hand-forged loops of thick bar with a pinched waist, each turned a
 * quarter-turn to the next. Following Kastenellos ("The Golden Horn Chain",
 * 2017), the chain is drawn as a chain-linked boom: sections of seven links
 * hooked nose to tail to long, heavy logs.
 *
 * Detail: a compressed span between the two ends, the logs riding the
 * swell; the links are drawn six times life size, or they would vanish on
 * the stage. Behind the Kastellion lies the Galata shore: a quay with
 * steps to the water, the houses and a church of the old settlement of
 * Sykai, and its fig and plane trees. Behind the Tower of Eugenios the sea
 * wall runs on along the shore of the Acropolis with towers at intervals,
 * and the hill climbs behind it under cypresses, with the churches of
 * St Demetrios and St Barbara that stood near the point. A merchantman
 * lies checked at the boom and a guard boat rows along it. Map: the chain
 * across the mouth of the Horn (absolute), its links much enlarged, its
 * logs and the two forts at its ends in brief.
 */
export function createHornChain({ lod = 'detail' } = {}) {
  return lod === 'detail' ? createSpan() : createMapChain();
}

// ---------- detail ----------

// The forts stand much closer than the real 750 m, so the chain fills the stage.
const KASTELLION_X = -66;
const EUGENIOS_X = 56;
const STAGE = [210, 120]; // the water, and the shores that run off its two ends: a slice of the Horn's mouth
const LEFT_ANCHOR = new THREE.Vector3(KASTELLION_X + 28.5, 2.6, 0);
const RIGHT_ANCHOR = new THREE.Vector3(EUGENIOS_X - 7.5, 2.6, 0);
const LINK_LENGTH = 0.62 * 6; // "approximately two foot long", drawn six times life size
const LINK_WIDTH = 1.5;
const LINK_BAR = 0.26;
const LINK_PITCH = LINK_LENGTH - 3.2 * LINK_BAR; // each link reaches into the next
const LINKS_PER_SECTION = 7;
const LOG_LENGTH = 10;
const LOG_RADIUS = 0.9;
const HOOK_RISE = 1.0; // the hooks stand this far above a log's axis, so the chain rides at the waterline

/**
 * One hand-forged link, lying along x: a long loop of round bar with
 * straightish sides drawn in at a waist, as on the surviving sections.
 */
function linkGeometry(length, width, bar) {
  const points = [];
  const count = 24;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const c = Math.cos(angle);
    const sn = Math.sin(angle);
    const x = (length / 2 - bar) * Math.sign(c) * Math.abs(c) ** 0.6;
    const waist = 0.62 + 0.38 * Math.abs(c) ** 0.5;
    points.push(new THREE.Vector3(x, 0, (width / 2 - bar) * sn * waist));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, true), 40, bar, 6, true);
}

function createSpan() {
  const scene = new THREE.Group();
  scene.add(groundPlane(...STAGE, M.water, 0, 0, 0));
  addGalataShore(scene, KASTELLION_X);
  addAcropolisShore(scene, EUGENIOS_X);
  addKastellion(scene, KASTELLION_X, true);
  addEugeniosTower(scene, EUGENIOS_X, true);
  // The fort's label sits low on its walls, clear of the chain tower's label above.
  labelAt(scene, 'kastellion', KASTELLION_X - 12, 10, 8);
  labelAt(scene, 'windlassTower', KASTELLION_X + 21, 31.5, -2);
  labelAt(scene, 'eugeniosTower', EUGENIOS_X, 25, 0);
  labelAt(scene, 'chain', (LEFT_ANCHOR.x + RIGHT_ANCHOR.x) / 2, 4, 0);
  finalizeModel(scene);

  // Banners on the cap of the Kastellion's landward corner turret and on the roof of the Tower of Eugenios.
  for (const [x, y, z] of [[KASTELLION_X - 19, 19.4, -15], [EUGENIOS_X, 24, 0]]) {
    const banner = flag('byzantine', { width: 3, height: 2, pole: 5 });
    banner.position.set(x, y, z);
    scene.add(banner);
  }
  scene.add(createFloatingChain());
  // A nave of Venice, sails furled, checked at the boom on the open side of the chain, and the guard boat that rows along it.
  const ship = createMerchantShip({ banner: 'venice', sail: false });
  ship.position.set(-6, 0, 20);
  ship.rotation.y = Math.PI / 2 + 0.12; // bow to the chain
  scene.add(ship);
  scene.add(createGuardBoat(26, -9, 0.35));
  return scene;
}

// ---------- the shores ----------

/**
 * The Galata shore behind the Kastellion: a stone quay with steps down to
 * the water and mooring posts, the houses of Sykai rising on a low terrace
 * behind the fort, a domed church among them, and the fig and plane trees
 * the suburb was named for.
 */
function addGalataShore(scene, cx) {
  const [edge, shore] = [-STAGE[0] / 2, cx + 30];
  const depth = STAGE[1];
  const terrace = cx - 24;
  // The base reaches 0.05 m past the stage's cut on its three outer sides, so the cut faces of what stands on it share no plane with its own.
  scene.add(box(shore - edge + 0.05, 5, depth + 0.1, M.stoneDark, (edge + shore) / 2 - 0.025, -3, 0));
  scene.add(box(shore - 5 - terrace - 0.5, 0.3, depth, M.grass, (terrace + 0.5 + shore - 5) / 2, 2, 0)); // from the terrace wall to the quay
  scene.add(box(5, 0.35, depth, M.paving, shore - 2.5, 2, 0)); // the quay
  for (const z of [-34, 30]) addWaterSteps(scene, shore, z, 1);
  for (const z of [-50, -24, 24, 42, 54]) scene.add(cylinder(0.25, 0.3, 1.4, M.wood, shore - 1, 2.3, z, 6));
  // The ground rises inland in a terrace, with a retaining wall.
  scene.add(box(terrace - 0.5 - edge, 4, depth, M.grass, (edge + terrace - 0.5) / 2, 2, 0)); // up to the retaining wall
  scene.add(box(1, 4.2, depth, M.rubble, terrace, 2, 0));
  const groundAt = (x) => (x < terrace ? 6 : 2);

  const rnd = createRandom(717);
  const fortClear = (x, z) => x > cx - 25 && x < cx + 30 && z > -22 && z < 22;
  const spots = [
    [-100, -52], [-98, -44], [-100, -30], [-99, -14], [-100, 4], [-99, 22], [-100, 40], [-99, 52],
    [-78, -50], [-66, -44], [-54, -36], [-44, -46], [-78, 46], [-66, 36], [-54, 44], [-44, 52], [-60, -56], [-58, 56],
  ];
  for (const [x, z] of spots) {
    if (fortClear(x, z)) continue;
    const house = townHouse(rnd, { w: rnd.range(7, 10), d: rnd.range(5.5, 7.5), h: rnd.range(5, 8.5) });
    house.position.set(x, groundAt(x), z);
    house.rotation.y = rnd.pick([0, Math.PI / 2]) + rnd.range(-0.2, 0.2);
    scene.add(house);
  }
  addChurch(scene, -80, 2, 30, Math.PI / 2, 0.8); // the church of Sykai
  // Planes and figs along the quay and between the houses, cypresses on the terrace.
  for (const [x, z] of [[-48, -28], [-42, 36], [-70, -32], [-72, 34], [-84, 58], [-86, -58], [-62, 50], [-50, 58]]) scene.add(roundTree(rnd.range(6, 8), x, groundAt(x), z));
  for (const [x, z] of [[-98, -40], [-102, -8], [-96, 12], [-102, 30], [-98, 48], [-101, 56], [-90, -4]]) scene.add(cypress(rnd.range(9, 13), x, groundAt(x), z));
}

/**
 * The point of the Acropolis behind the Tower of Eugenios: a quay before
 * the sea wall, which runs on along the shore with towers at intervals,
 * and the hill rising steeply behind it, terraced with houses, two
 * churches and cypresses.
 */
function addAcropolisShore(scene, cx) {
  const [shore, edge] = [cx - 7, STAGE[0] / 2];
  const depth = STAGE[1];
  scene.add(box(edge - shore + 0.05, 5, depth + 0.1, M.stoneDark, (shore + edge) / 2 + 0.025, -3, 0)); // past the stage's cut, as on the Galata side
  scene.add(box(7.9, 0.35, depth, M.paving, shore + 4.05, 2, 0)); // the quay outside the wall, 0.1 m back from the tower's face
  for (const z of [-28, 34]) addWaterSteps(scene, shore, z, -1);
  for (const z of [-46, -18, 16, 48]) scene.add(cylinder(0.25, 0.3, 1.4, M.wood, shore + 1, 2.3, z, 6));

  // The hill: a smooth profile from the foot of the wall to the stage's edge, extruded along the shore.
  const foot = cx + 5;
  const heightAt = (x) => {
    const t = THREE.MathUtils.clamp((x - foot) / (edge - foot), 0, 1);
    return 2 + 24 * t * t * (3 - 2 * t);
  };
  const profile = new THREE.Shape();
  profile.moveTo(foot, 1.9);
  for (let i = 0; i <= 16; i++) {
    const x = foot + ((edge - foot) * i) / 16;
    profile.lineTo(x, heightAt(x));
  }
  profile.lineTo(edge, 1.9);
  profile.closePath();
  const hill = new THREE.ExtrudeGeometry(profile, { depth, bevelEnabled: false }).translate(0, 0, -depth / 2);
  scene.add(mesh(hill, M.grass));

  // Terraces cut into the slope carry the houses; each stands on a plinth sunk into the hill.
  const rnd = createRandom(1203);
  const stand = (object, x, z) => {
    const y = heightAt(x);
    object.position.set(x, y, z);
    scene.add(object);
    return y;
  };
  const plinth = (x, z, w, d) => scene.add(box(w, 3, d, M.rubble, x, heightAt(x) - 3 + 0.2, z));
  const houses = [
    [70, -50, 8, 6.5, 6], [74, -36, 9, 7, 7], [70, 28, 8, 6.5, 6.5], [72, 44, 9, 7, 7], [84, -54, 10, 7, 8], [84, 50, 10, 7, 8],
    [88, -40, 9, 7, 7], [90, -10, 10, 8, 9], [88, 20, 9, 7, 7], [98, 2, 11, 8, 8], [98, -30, 10, 7, 7], [98, 38, 10, 7, 8], [78, 6, 8, 6, 6],
  ];
  for (const [x, z, w, d, h] of houses) {
    const house = townHouse(rnd, { w, d, h });
    house.rotation.y = rnd.range(-0.15, 0.15);
    plinth(x, z, w + 1, d + 1);
    stand(house, x, z);
  }
  plinth(80, -20, 16, 15);
  stand(addChurch(new THREE.Group(), 0, 0, 0, Math.PI / 2, 1), 80, -20); // St Demetrios, near the point
  plinth(92, 50, 10, 9);
  stand(addChurch(new THREE.Group(), 0, 0, 0, Math.PI / 2, 0.6), 92, 50); // St Barbara
  for (const [x, z] of [[66, -20], [66, 12], [78, -6], [78, 56], [86, 36], [94, -46], [102, -18], [102, 24], [94, 14], [70, -58]]) {
    scene.add(cypress(rnd.range(10, 14), x, heightAt(x), z));
  }
  for (const [x, z] of [[76, 20], [94, -56], [84, 2], [100, 58]]) scene.add(roundTree(rnd.range(6, 8), x, heightAt(x), z));
}

/** Steps cut down from the quay (top at y = 2) to the water, the water lying on the `toward` side (+1: +x). */
function addWaterSteps(scene, shoreX, z, toward) {
  for (let i = 0; i < 4; i++) {
    scene.add(box(0.8, 2.6 - i * 0.5, 4.5, M.stone, shoreX + toward * (0.4 + i * 0.8), -0.6, z));
  }
}

/** A plastered house under a tiled gable, with a door and a few arched windows on its long side. */
function townHouse(rnd, { w, d, h }) {
  const house = new THREE.Group();
  const plaster = rnd.pick([M.plaster, M.plasterOchre, M.brick]);
  house.add(box(w, h, d, plaster, 0, 0, 0));
  house.add(gableRoof(w, d, d * 0.32, M.roof, 0, h, 0, 0.4));
  house.add(mesh(archGeometry(1.1, 2.1), M.opening, -w / 4, 0, d / 2 + 0.06)); // the openings stand off the wall as the lib's houses' do
  const window = archGeometry(0.8, 1.3);
  const storeys = Math.max(1, Math.floor(h / 3.2));
  for (let s = 0; s < storeys; s++) {
    for (const dx of s === 0 ? [w / 4] : [-w / 3, 0, w / 3]) house.add(mesh(window, M.opening, dx, 1.4 + s * 3.0, d / 2 + 0.06));
  }
  return house;
}

/** A small cross-domed church: a brick box with a drum and dome, an apse to the east (local +x) and a porch. Scaled by `size`. */
function addChurch(group, x, y, z, rotation, size) {
  const church = new THREE.Group();
  church.add(box(14, 7, 11, M.brick, 0, 0, 0));
  church.add(gableRoof(14, 11, 2.4, M.roof, 0, 7, 0, 0.3));
  church.add(cylinder(3, 3, 2.4, M.brick, 0, 8.4, 0, 12));
  church.add(mesh(new THREE.SphereGeometry(3.2, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.lead, 0, 10.8, 0));
  church.add(cylinder(0.08, 0.08, 1.4, M.gold, 0, 14, 0, 6));
  church.add(box(0.6, 0.08, 0.08, M.gold, 0, 14.9, 0));
  church.add(faceToward(cylinder(2.8, 2.8, 5.5, M.brick, 7, 0, 0, 10, { thetaStart: -Math.PI / 2, thetaLength: Math.PI }), 1, 0));
  church.add(faceToward(mesh(new THREE.SphereGeometry(2.9, 10, 5, 0, Math.PI, 0, Math.PI / 2).scale(1, 0.5, 1), M.lead, 7, 5.5, 0), 1, 0));
  church.add(box(3, 5, 8, M.brick, -8, 0, 0)); // the narthex porch
  church.add(gableRoof(3, 8, 1.2, M.roof, -8, 5, 0, 0.3));
  const door = mesh(archGeometry(1.6, 3), M.opening, -9.6, 0, 0); // openings stand 0.1 m proud, so they clear the walls at the smallest scale too
  door.rotation.y = -Math.PI / 2;
  church.add(door);
  for (const side of [-1, 1]) for (const dx of [-3, 0, 3]) church.add(mesh(archGeometry(0.9, 2), M.opening, dx, 3.4, side * 5.6).rotateY(side > 0 ? 0 : Math.PI));
  church.scale.setScalar(size);
  church.position.set(x, y, z);
  church.rotation.y = rotation;
  group.add(church);
  return group;
}

/** A guard boat: a small rowing boat with a steersman and two oarsmen, a lantern pole at its stern, riding the swell. */
function createGuardBoat(x, z, heading) {
  const boat = new THREE.Group();
  boat.userData.dynamic = true;
  const hull = mesh(new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M.hull, 0, 0.9, 0);
  hull.scale.set(4.2, 1.1, 1.3);
  boat.add(hull);
  const rim = mesh(new THREE.TorusGeometry(1, 0.08, 5, 14).rotateX(Math.PI / 2), M.wood, 0, 0.9, 0);
  rim.scale.set(4.2, 1, 1.3);
  boat.add(rim);
  for (const dx of [-1.6, 0, 1.6]) boat.add(box(0.5, 0.12, 2.2, M.wood, dx, 0.5, 0));
  for (const dx of [-1.6, 0.2]) {
    boat.add(cylinder(0.26, 0.3, 0.9, M.imperialPurple, dx, 0.6, 0, 7));
    boat.add(mesh(new THREE.SphereGeometry(0.2, 7, 5), M.rope, dx, 1.6, 0));
    for (const side of [-1, 1]) {
      const oar = cylinder(0.04, 0.04, 3.4, M.wood, dx + 0.3, 1.0, side * 1.1, 4);
      oar.rotation.z = side * 0.0;
      oar.rotation.x = side * 1.2;
      boat.add(oar);
    }
  }
  boat.add(cylinder(0.26, 0.3, 0.9, M.imperialPurple, 1.8, 0.6, 0, 7)); // the steersman
  boat.add(mesh(new THREE.SphereGeometry(0.2, 7, 5), M.rope, 1.8, 1.6, 0));
  boat.add(cylinder(0.05, 0.05, 2.4, M.wood, -3.2, 0.7, 0, 4));
  boat.add(mesh(new THREE.SphereGeometry(0.18, 6, 4), M.fire, -3.2, 3.1, 0));
  boat.position.set(x, 0, z);
  boat.rotation.y = heading;
  const phase = 3;
  boat.userData.animate = (time) => {
    boat.position.y = Math.sin(time * 1.4 + phase) * 0.12;
    boat.rotation.z = Math.sin(time * 1.1 + phase) * 0.04;
  };
  return boat;
}

/**
 * The Kastellion of Galata: a rectangular fort with corner turrets and the
 * chain tower on its seaward face (+x), standing 2 m up on its platform.
 * The map leaves out the platform, the shore wall and the small ironwork.
 */
function addKastellion(scene, cx, detail) {
  const segments = detail ? 12 : 8;
  const [w, d, h] = [40, 32, 12];
  scene.add(box(w, h, d, M.banded, cx, 2, 0));
  scene.add(box(w - 4, 1.2, d - 4, M.paving, cx, 2 + h - 0.6, 0)); // the wall-walk's court
  for (const side of [-1, 1]) {
    scene.add(mesh(crenellationGeometry(w), M.banded, cx, 2 + h, side * (d / 2 - 0.35)));
    const flank = mesh(crenellationGeometry(d), M.banded, cx + side * (w / 2 - 0.35), 2 + h, 0);
    flank.rotation.y = Math.PI / 2;
    scene.add(flank);
  }
  for (const [dx, dz] of [[-1, -1], [-1, 1], [1, 1], [1, -1]]) {
    const [tx, tz] = [cx + dx * (w / 2 - 1), dz * (d / 2 - 1)];
    scene.add(cylinder(4, 4, h + 5, M.banded, tx, 2, tz, segments));
    scene.add(cylinder(4.6, 4.6, 1.4, M.banded, tx, 2 + h + 4, tz, segments));
  }
  // The chain tower at the seaward corner: taller, with the windlass drum on its open top.
  const [tx, tz] = [cx + w / 2 + 1, -2];
  scene.add(box(14, 24, 14, M.banded, tx, 2, tz));
  for (const side of [-1, 1]) {
    scene.add(mesh(crenellationGeometry(14), M.banded, tx, 26, tz + side * 6.65));
    const flank = mesh(crenellationGeometry(14), M.banded, tx + side * 6.65, 26, tz);
    flank.rotation.y = Math.PI / 2;
    scene.add(flank);
  }
  // The windlass drum on the tower's open top.
  const drum = cylinder(1.4, 1.4, 8, M.wood, tx, 29, tz, segments);
  drum.rotation.x = Math.PI / 2;
  scene.add(drum);
  for (const z of [-4.5, 0.5]) scene.add(box(1.2, 3.2, 1.2, M.wood, tx, 26, tz + z));
  if (!detail) return;
  const door = mesh(archGeometry(2.4, 3.6), M.opening, tx + 7.05, 2, 0);
  door.rotation.y = Math.PI / 2;
  scene.add(door);
  for (const y of [10, 17]) {
    const slit = mesh(archGeometry(0.7, 2.2), M.opening, tx + 7.05, y, tz);
    slit.rotation.y = Math.PI / 2;
    scene.add(slit);
  }
  // The chain's iron ring on the face of the tower, and the windlass bars.
  scene.add(mesh(new THREE.TorusGeometry(1, 0.22, 6, 14), M.iron, tx + 7.1, 2.6, 0));
  for (const [i, angle] of [0, Math.PI / 3, (2 * Math.PI) / 3].entries()) {
    const bar = box(7, 0.3, 0.3, M.wood, tx, 29, tz + 4.2 + i * 0.06); // each a little further out, so their faces share no plane
    bar.rotation.z = angle;
    scene.add(bar);
  }
  // A stretch of the shore wall running on from the fort.
  scene.add(box(3, 8, 30, M.banded, cx - w / 2 - 1.5, 2, -31));
}

/**
 * The Tower of Eugenios, where the sea wall of the Acropolis turns the point;
 * the chain hangs from its -x face. The map (whose own sea wall runs past it)
 * keeps the tower alone.
 */
function addEugeniosTower(scene, cx, detail) {
  scene.add(box(14, 22, 14, M.banded, cx, 2, 0));
  for (const side of [-1, 1]) {
    scene.add(mesh(crenellationGeometry(14), M.banded, cx, 24, side * 6.65));
    const flank = mesh(crenellationGeometry(14), M.banded, cx + side * 6.65, 24, 0);
    flank.rotation.y = Math.PI / 2;
    scene.add(flank);
  }
  if (!detail) return;
  const ring = mesh(new THREE.TorusGeometry(1, 0.22, 6, 14), M.iron, cx - 7.1, 2.6, 0);
  ring.rotation.y = Math.PI / 2;
  scene.add(ring);
  for (const y of [9, 16]) {
    const slit = mesh(archGeometry(0.7, 2.2), M.opening, cx - 7.05, y, 0);
    slit.rotation.y = -Math.PI / 2;
    scene.add(slit);
  }
  // The sea wall runs away from the tower in both directions along the shore of the Acropolis, with towers at intervals.
  for (const side of [-1, 1]) {
    for (const [z, length] of [[22, 30], [48, 12]]) {
      scene.add(box(3.2, 11, length, M.banded, cx + 3, 2, side * z));
      const parapet = mesh(crenellationGeometry(length), M.banded, cx + 1.9, 13, side * z);
      parapet.rotation.y = Math.PI / 2;
      scene.add(parapet);
    }
    for (const z of [38, 55.5]) {
      scene.add(box(9, 16, 8.9, M.banded, cx + 3, 2, side * z)); // the outer one ends 0.05 m short of the stage's cut
      scene.add(mesh(crenellationGeometry(9, { merlon: 0.8, gap: 0.6, height: 1 }), M.banded, cx + 3, 18, side * z - 4.1));
      scene.add(mesh(crenellationGeometry(9, { merlon: 0.8, gap: 0.6, height: 1 }), M.banded, cx + 3, 18, side * z + 4.1));
      const slit = mesh(archGeometry(0.6, 1.8), M.opening, cx - 1.55, 10, side * z);
      slit.rotation.y = -Math.PI / 2;
      scene.add(slit);
    }
  }
}

function createFloatingChain() {
  const group = new THREE.Group();
  group.userData.dynamic = true;

  // The logs: heavy round trunks bound with iron straps, an iron eye at each end for the chain's hook.
  const logGeometry = cylinderGeometry(LOG_RADIUS, LOG_RADIUS, LOG_LENGTH, 10).translate(0, -LOG_LENGTH / 2, 0).rotateZ(Math.PI / 2); // centred on the log's middle
  const strapGeometry = new THREE.TorusGeometry(LOG_RADIUS + 0.04, 0.07, 4, 16).rotateY(Math.PI / 2);
  const eyeGeometry = new THREE.TorusGeometry(0.6, 0.17, 6, 12);
  const section = (LINKS_PER_SECTION - 1) * LINK_PITCH + LINK_LENGTH;
  const logs = [];
  const span = RIGHT_ANCHOR.x - LEFT_ANCHOR.x;
  const count = Math.floor((span - section) / (LOG_LENGTH + section));
  const start = LEFT_ANCHOR.x + (span - count * (LOG_LENGTH + section) + section) / 2 + LOG_LENGTH / 2;
  for (let i = 0; i < count; i++) {
    const log = new THREE.Mesh(logGeometry, M.wood);
    log.castShadow = true;
    log.position.set(start + i * (LOG_LENGTH + section), 0, 0);
    for (const side of [-1, 1]) {
      log.add(mesh(strapGeometry, M.iron, side * (LOG_LENGTH / 2 - 0.8), 0, 0));
      log.add(box(1.1, HOOK_RISE, 0.4, M.iron, side * (LOG_LENGTH / 2 - 0.2), 0.1, 0)); // the strap carrying the eye
      log.add(mesh(eyeGeometry, M.iron, side * (LOG_LENGTH / 2 + 0.25), HOOK_RISE + 0.1, 0));
    }
    group.add(log);
    logs.push(log);
  }

  const capacity = Math.ceil(span / LINK_PITCH) + 40;
  const links = new THREE.InstancedMesh(linkGeometry(LINK_LENGTH, LINK_WIDTH, LINK_BAR), M.iron, capacity);
  links.castShadow = true;
  links.frustumCulled = false;
  group.add(links);

  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const roll = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
  const scale = new THREE.Vector3(1, 1, 1);
  const xAxis = new THREE.Vector3(1, 0, 0);
  const point = new THREE.Vector3();
  const previous = new THREE.Vector3();
  const next = new THREE.Vector3();
  const direction = new THREE.Vector3();
  const hookAt = (log, side, target) => target.set(
    log.position.x + side * (LOG_LENGTH / 2 + 0.7),
    log.position.y + HOOK_RISE + 0.1 + side * Math.sin(log.rotation.z) * (LOG_LENGTH / 2),
    0,
  );
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();

  group.userData.animate = (time) => {
    for (const [i, log] of logs.entries()) {
      log.position.y = Math.sin(time * 1.3 + i * 0.9) * 0.14;
      log.rotation.z = Math.sin(time * 0.8 + i * 1.7) * 0.03;
      log.rotation.x = Math.sin(time * 1.1 + i) * 0.06;
    }
    // Each stretch of chain hangs in a shallow curve between its two hooks, link after link,
    // every other one turned a quarter-turn about the chain.
    let n = 0;
    for (let s = 0; s <= logs.length; s++) {
      if (s === 0) a.copy(LEFT_ANCHOR); else hookAt(logs[s - 1], 1, a);
      if (s === logs.length) b.copy(RIGHT_ANCHOR); else hookAt(logs[s], -1, b);
      const steps = Math.max(1, Math.round((a.distanceTo(b) - LINK_LENGTH) / LINK_PITCH) + 1);
      const sag = Math.min(0.35, a.distanceTo(b) * 0.02);
      const at = (t, target) => target.lerpVectors(a, b, t).setY(a.y + (b.y - a.y) * t - sag * 4 * t * (1 - t));
      const inset = LINK_LENGTH / 2 / a.distanceTo(b);
      for (let k = 0; k < steps && n < capacity; k++) {
        const t = steps === 1 ? 0.5 : inset + (k / (steps - 1)) * (1 - 2 * inset);
        at(t, point);
        at(Math.max(0, t - 0.005), previous);
        at(Math.min(1, t + 0.005), next);
        direction.subVectors(next, previous).normalize();
        quaternion.setFromUnitVectors(xAxis, direction);
        if (n % 2) quaternion.multiply(roll);
        matrix.compose(point, quaternion, scale);
        links.setMatrixAt(n++, matrix);
      }
    }
    links.count = n;
    links.instanceMatrix.needsUpdate = true;
  };
  group.userData.animate(0);
  return group;
}

// ---------- map ----------

const MAP_LOGS = 4;
const MAP_LOG_LENGTH = 0.3;
const MAP_LINK = { length: 0.28, width: 0.12, bar: 0.026 }; // some fifty times life size, to read on the map
const KASTELLION_SCALE = 5.5 * METERS_TO_MAP;
const EUGENIOS_SCALE = 5 * METERS_TO_MAP;

function createMapChain() {
  const chain = new THREE.Group();
  const south = new THREE.Vector3(CHAIN_SOUTH[0], 0.06, -CHAIN_SOUTH[1]);
  const north = new THREE.Vector3(CHAIN_NORTH[0], 0.06, -CHAIN_NORTH[1]);

  // The forts at either end stand where the map has always had them: the Kastellion of
  // Galata with its chain tower facing the Horn's mouth, and the Tower of Eugenios across it.
  const kastellion = new THREE.Vector3(CHAIN_NORTH[0] - 0.1, LAND_HEIGHT, -(CHAIN_NORTH[1] + 0.6));
  const eugenios = new THREE.Vector3(CHAIN_SOUTH[0] + 0.3, LAND_HEIGHT, -(CHAIN_SOUTH[1] - 0.6));
  const headingFrom = (from, to) => Math.atan2(-(to.z - from.z), to.x - from.x); // turns local +x from → to
  const stand = (build, scale, at, heading) => {
    const fort = new THREE.Group();
    build(fort, 0, false);
    fort.scale.setScalar(scale);
    fort.position.copy(at).setY(LAND_HEIGHT - 2 * scale); // the forts are built standing 2 m up on their platforms
    fort.rotation.y = heading;
    chain.add(fort);
  };
  // Both face each other across the water: the Kastellion's chain tower on its +x side, the ring of Eugenios on its -x face.
  const heading = headingFrom(kastellion, eugenios);
  stand((fort, cx, detail) => addKastellion(fort, cx - 21, detail), KASTELLION_SCALE, kastellion, heading);
  stand(addEugeniosTower, EUGENIOS_SCALE, eugenios, heading);
  // The fort's body reaches inland behind its chain tower; keep the map's houses out of it.
  const inland = new THREE.Vector3().subVectors(kastellion, eugenios).setY(0).normalize().multiplyScalar(21 * KASTELLION_SCALE);
  chain.userData.keepOut = [[kastellion.x + inland.x, -(kastellion.z + inland.z), 1.45], [eugenios.x, -eugenios.z, 0.55]];

  // The chain climbs from each tower's ring down to the water at the shore, then crosses as a
  // boom: stretches of links between logs set at even intervals, hooked to them end to end.
  const ringOn = (fort, scale, other) => fort.clone().lerp(other, (7 * scale) / fort.distanceTo(other)).setY(LAND_HEIGHT + 0.6 * scale);
  const water = (point) => point.clone().setY(0.03);
  const route = new THREE.CurvePath();
  const stops = [ringOn(eugenios, EUGENIOS_SCALE, kastellion), water(south), water(north), ringOn(kastellion, KASTELLION_SCALE, eugenios)];
  for (let i = 1; i < stops.length; i++) route.add(new THREE.LineCurve3(stops[i - 1], stops[i]));
  const total = route.getLength();
  const [toShore, across] = [stops[0].distanceTo(stops[1]), stops[1].distanceTo(stops[2])];
  const gap = (across - MAP_LOGS * MAP_LOG_LENGTH) / (MAP_LOGS + 1);
  const logs = Array.from({ length: MAP_LOGS }, (_, i) => toShore + gap * (i + 1) + MAP_LOG_LENGTH * i); // where each log starts, along the route
  const onLog = (d) => logs.some((start) => d > start - MAP_LINK.length / 2 && d < start + MAP_LOG_LENGTH + MAP_LINK.length / 2);

  const linkShape = linkGeometry(MAP_LINK.length, MAP_LINK.width, MAP_LINK.bar);
  const pitch = MAP_LINK.length - 3.2 * MAP_LINK.bar;
  const xAxis = new THREE.Vector3(1, 0, 0);
  for (let d = MAP_LINK.length / 2, n = 0; d < total - MAP_LINK.length / 2; d += pitch) {
    if (onLog(d)) continue;
    const link = mesh(linkShape, M.iron);
    link.position.copy(route.getPointAt(d / total));
    link.quaternion.setFromUnitVectors(xAxis, route.getTangentAt(d / total));
    if (n++ % 2) link.rotateX(Math.PI / 2);
    chain.add(link);
  }
  const along = Math.atan2(north.z - south.z, north.x - south.x);
  const log = cylinderGeometry(0.05, 0.05, MAP_LOG_LENGTH, 8).translate(0, -MAP_LOG_LENGTH / 2, 0).rotateZ(Math.PI / 2);
  for (const start of logs) {
    const float = mesh(log, M.wood);
    float.position.copy(route.getPointAt((start + MAP_LOG_LENGTH / 2) / total)).setY(0.025);
    float.rotation.y = -along;
    chain.add(float);
  }
  return finalizeModel(chain);
}

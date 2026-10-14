import * as THREE from 'three';
import { GATE_WALL, HOUSE_ATLAS, HOUSE_FOOT, HOUSE_STOREY } from '../models/lib/textures.js';
import { atlasUV, block, gable, roofSlope, surface, townMaterials, wall, well } from './atlasGeometry.js';

/**
 * The map's houses, after a two-storey Byzantine town house: a rubble ground
 * floor, an upper floor of banded stone and brick patched with plaster, a
 * roof of Roman tiles, and — on the fullest of them — a lower wing under a
 * catslide roof with a wooden balcony reached by an outside stone stair.
 *
 * Each variant is built once in a unit frame, then instanced: x runs along
 * the street (-0.5…0.5, scaled by the house's width), z across it with the
 * street at +z (scaled by its depth), and y up, with the eaves of the main
 * block at 1 (scaled by its height) and the walls running HOUSE_FOOT below
 * ground so that a house on a slope never floats. Windows, doors, timbers and
 * masonry are painted on one atlas (textures.js) rather than modelled.
 *
 * houses: [{ point: [east, north], y, angle, w, d, h, farm, style }] — `angle`
 * turns the house's +x along the street, so that its front (+z) faces the
 * street; farmhouses stand in a walled yard; `style` picks Galata's Genoese
 * houses or one of the town's special buildings (see pickVariant), and the
 * same frame serves them all: a great house spans its whole block, a
 * portico a stretch of the Mese, a stall its pitch in a market.
 */
export function createHouses(rnd, houses) {
  const { walls, roofs: roofing } = townMaterials();
  const groups = VARIANTS.map(() => []);
  for (const house of houses) groups[pickVariant(rnd, house)].push(house);

  const group = new THREE.Group();
  const matrix = new THREE.Matrix4();
  const rotation = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  VARIANTS.forEach((variant, k) => {
    const members = groups[k];
    if (members.length === 0) return;
    const { body, roof } = variant.geometry();
    const meshes = [new THREE.InstancedMesh(body, walls, members.length), new THREE.InstancedMesh(roof, roofing, members.length)];
    const tints = variant.tints ?? {};
    members.forEach(({ point: [east, north], y, angle, w, d, h }, i) => {
      matrix.compose(new THREE.Vector3(east, y, -north), rotation.setFromAxisAngle(up, angle), new THREE.Vector3(w, h, d));
      meshes[0].setMatrixAt(i, matrix);
      meshes[1].setMatrixAt(i, matrix);
      meshes[0].setColorAt(i, tone(rnd, tints.walls ?? WALL_TINTS));
      meshes[1].setColorAt(i, tone(rnd, tints.roofs ?? ROOF_TINTS, 0.12));
    });
    for (const mesh of meshes) mesh.castShadow = mesh.receiveShadow = true;
    group.add(...meshes);
  });
  return group;
}

// The atlas is painted in the reference's own colours; these tints only nudge a house warmer or cooler.
const palette = (...hexes) => hexes.map((hex) => new THREE.Color(hex));
const WALL_TINTS = palette(0xffffff, 0xfff4e6, 0xf2eee8, 0xffeedd, 0xeae6e0);
const ROOF_TINTS = palette(0xffffff, 0xfaeee8, 0xfff4ea, 0xf0e6e0);
// Genoese plaster: ochre, cream, rose and pale yellow washes over the white of the atlas.
const GENOESE_TINTS = palette(0xf0c890, 0xfff0d8, 0xf2c4a8, 0xf8e2a8, 0xe8d4b8);
// Awnings: madder, weld yellow, woad blue, undyed linen and a sage green.
const AWNING_TINTS = palette(0xd8705a, 0xe6b858, 0x7f98c0, 0xf6eee0, 0x98b07c);

function tone(rnd, colours, jitter = 0.06) {
  return rnd.pick(colours).clone().multiplyScalar(1 - jitter + rnd.next() * jitter);
}

/**
 * The variant for a planned house. Its `style` comes from the planner: none
 * for an ordinary Byzantine house, 'genoese' in Galata, or one of the
 * special buildings ('mansion', 'portico', 'stall'). Ordinary narrow houses
 * turn their gable to the street; wider ones are mostly the full house with
 * its wing, stair and balcony; and some in each town have a flat roof.
 */
function pickVariant(rnd, { w, farm, style }) {
  const index = (name) => VARIANTS.findIndex((variant) => variant.name === name);
  if (farm) return index(rnd.chance(0.5) ? 'farmstead' : 'farmsteadMirrored');
  if (style === 'genoese') return index(w < 0.4 ? 'genoese' : 'genoeseWide');
  if (style) return index(style);
  if (rnd.chance(FLAT_ROOFS)) return index('terraced');
  if (w < 0.3) return index('gabled');
  const roll = rnd.next();
  if (roll < 0.25) return index('loggia');
  if (roll < 0.5) return index('loggiaMirrored');
  if (roll < 0.78) return index('balconied');
  return index('gabledWide');
}

const FLAT_ROOFS = 0.16; // share of ordinary Byzantine houses with a flat roof terrace

/**
 * Every kind of house, by name, with the style it belongs to:
 *   byzantine  loggia, loggiaMirrored (the full house: wing, stair, balcony),
 *              gabled, gabledWide (gable to the street), balconied (eaves to
 *              the street), terraced (a flat roof behind a parapet)
 *   farm       farmstead, farmsteadMirrored (the full house behind a walled yard)
 *   genoese    genoese, genoeseWide (tall Ligurian houses, two or three windows wide)
 *   mansion    mansion (three wings round a court; spans a whole block)
 *   portico    portico (a stretch of shops under the Mese's colonnade)
 *   stall      stall (a market stall)
 * Each is built in the unit frame described at the top of this file.
 */
const VARIANTS = [
  { name: 'loggia', style: 'byzantine', geometry: () => loggiaHouse() },
  { name: 'loggiaMirrored', style: 'byzantine', geometry: () => mirrored(loggiaHouse()) },
  { name: 'farmstead', style: 'farm', geometry: () => loggiaHouse({ front: 0.12, yard: true }) },
  { name: 'farmsteadMirrored', style: 'farm', geometry: () => mirrored(loggiaHouse({ front: 0.12, yard: true })) },
  { name: 'gabled', style: 'byzantine', geometry: () => gabledHouse(HOUSE_ATLAS.gableFront1) },
  { name: 'gabledWide', style: 'byzantine', geometry: () => gabledHouse(HOUSE_ATLAS.gableFront2) },
  { name: 'balconied', style: 'byzantine', geometry: () => balconiedHouse() },
  { name: 'terraced', style: 'byzantine', geometry: () => terracedHouse() },
  { name: 'genoese', style: 'genoese', geometry: () => genoeseHouse(HOUSE_ATLAS.genoeseFront2), tints: { walls: GENOESE_TINTS } },
  { name: 'genoeseWide', style: 'genoese', geometry: () => genoeseHouse(HOUSE_ATLAS.genoeseFront3), tints: { walls: GENOESE_TINTS } },
  { name: 'mansion', style: 'mansion', geometry: () => mansion() },
  { name: 'portico', style: 'portico', geometry: () => porticoShops() },
  { name: 'stall', style: 'stall', geometry: () => marketStall(), tints: { walls: palette(0xffffff), roofs: AWNING_TINTS } },
];

/** The kinds of house, for placing them elsewhere (the dioramas): [{ name, style }]. */
export const HOUSE_VARIANTS = VARIANTS.map(({ name, style }) => ({ name, style }));

/** A house's geometry in the unit frame, as { body, roof } to be drawn with townMaterials()'s walls and roofs. */
export function houseGeometry(name) {
  const variant = VARIANTS.find((candidate) => candidate.name === name);
  if (!variant) throw new Error(`No house variant called ${name}`);
  return variant.geometry();
}

// ---------- variants ----------

const FOOT = -HOUSE_FOOT;
const FLOOR = HOUSE_STOREY; // top of the upper floor's boards
const EAVES = 0.07; // overhang of the eaves, in units of width or depth
const VERGE = 0.04; // overhang at the gable ends

/**
 * The reference house: a tall main block with its gable to the street, and a
 * lower wing beside it under the main roof's long catslide. The wing stands
 * back from the street, and in front of it a wooden balcony on posts is
 * reached by a stone stair rising along the main block. A farmstead stands
 * back from a walled yard with a well.
 */
function loggiaHouse({ front = 0.5, yard = false } = {}) {
  const body = surface();
  const roof = surface();
  const back = -0.5;
  const [left, join, right] = [-0.5, 0.06, 0.5];
  const ridge = (left + join) / 2;
  const rise = 0.34;
  const low = 0.72; // eaves of the catslide over the wing
  const wingFront = front - 0.36 * (front - back);
  const stairRight = join + 0.15;
  const atlas = HOUSE_ATLAS;

  // The main block, its gables, and the stretch of its side left open beside the stair.
  wall(body, atlas.gableFront2, [left, front], [join, front]);
  wall(body, atlas.sideWall, [join, back], [left, back]);
  wall(body, atlas.sideWall, [left, back], [left, front]);
  wall(body, atlas.sideWall, [join, front], [join, wingFront]);
  for (const [a, b] of [[[left, front], [join, front]], [[join, back], [left, back]]]) gable(body, atlas.gable, a, b, rise);

  // The wing: its top follows the catslide down from the main eaves.
  wall(body, atlas.wingFront, [join, wingFront], [right, wingFront], [[0, FOOT], [1, FOOT], [1, low], [0, 1]]);
  wall(body, atlas.wingSide, [right, wingFront], [right, back], [[0, FOOT], [1, FOOT], [1, low], [0, low]]);
  wall(body, atlas.wingSide, [right, back], [join, back], [[0, FOOT], [1, FOOT], [1, 1], [0, low]]);

  // Roof: the main gable, its right slope running on over the wing at a gentler pitch.
  const leftEaves = left - EAVES;
  const slope = rise / (ridge - left);
  const catslide = (1 - low) / (right - join);
  const z = [back - VERGE, front + VERGE];
  roofSlope(roof, [ridge, 1 + rise], [leftEaves, 1 - EAVES * slope], z);
  roofSlope(roof, [ridge, 1 + rise], [join, 1], z, { eaves: false });
  roofSlope(roof, [join, 1], [right + EAVES, low - EAVES * catslide], z);
  const underRoof = (x) => 1 - (x - join) * catslide;

  // The balcony: boards, a railing along its front and open end, and posts up to the roof.
  const rail = front - 0.04;
  block(body, atlas.wood, [stairRight, right], [FLOOR - 0.04, FLOOR], [wingFront, front - 0.02], { faces: ['top', 'front', 'right'] });
  screen(body, [stairRight, right], [FLOOR, FLOOR + 0.15], rail, 'z');
  screen(body, [wingFront, rail], [FLOOR, FLOOR + 0.15], right - 0.012, 'x');
  for (const x of [stairRight + 0.016, right - 0.016]) {
    block(body, atlas.wood, [x - 0.014, x + 0.014], [FOOT, underRoof(x) - 0.01], [rail - 0.016, rail + 0.012], { faces: ['front', 'back', 'left', 'right'] });
  }

  // The stair: steps up from the street to a landing at the balcony's level.
  stair(body, [join, stairRight], front, wingFront, 4);

  if (yard) {
    // A walled yard before the house: a front wall broken by a gateway in line with the stair, and a well.
    const height = 0.24;
    const thick = 0.035;
    const gate = [join - 0.04, stairRight + 0.06];
    const yardWall = (x, zRange) => block(body, atlas.rubble, x, [FOOT, height], zRange, { faces: ['top', 'front', 'back', 'left', 'right'] });
    yardWall([-0.5, gate[0]], [0.5 - thick, 0.5]);
    yardWall([gate[1], 0.5], [0.5 - thick, 0.5]);
    yardWall([-0.5, -0.5 + thick], [front, 0.5 - thick]);
    yardWall([0.5 - thick, 0.5], [front, 0.5 - thick]);
    well(body, [0.33, (front + 0.5) / 2 - 0.02], 0.06, 0.16);
  }
  return { body: body.geometry(), roof: roof.geometry() };
}

/** A plain two-storey block with its gable to the street. */
function gabledHouse(frontRegion) {
  const body = surface();
  const roof = surface();
  const rise = 0.42;
  wall(body, frontRegion, [-0.5, 0.5], [0.5, 0.5]);
  wall(body, HOUSE_ATLAS.sideWall, [0.5, -0.5], [-0.5, -0.5]);
  wall(body, HOUSE_ATLAS.sideWall, [-0.5, -0.5], [-0.5, 0.5]);
  wall(body, HOUSE_ATLAS.sideWall, [0.5, 0.5], [0.5, -0.5]);
  gable(body, HOUSE_ATLAS.gable, [-0.5, 0.5], [0.5, 0.5], rise);
  gable(body, HOUSE_ATLAS.gable, [0.5, -0.5], [-0.5, -0.5], rise);
  const z = [-0.5 - VERGE, 0.5 + VERGE];
  const eavesDrop = EAVES * rise / 0.5;
  roofSlope(roof, [0, 1 + rise], [-0.5 - EAVES, 1 - eavesDrop], z);
  roofSlope(roof, [0, 1 + rise], [0.5 + EAVES, 1 - eavesDrop], z);
  return { body: body.geometry(), roof: roof.geometry() };
}

/** A long front under the eaves, with a wooden balcony on beam ends before the upper floor's door. */
function balconiedHouse() {
  const body = surface();
  const roof = surface();
  const rise = 0.4;
  const atlas = HOUSE_ATLAS;
  wall(body, atlas.eavesFront, [-0.5, 0.5], [0.5, 0.5]);
  wall(body, atlas.sideWall, [0.5, -0.5], [-0.5, -0.5]);
  wall(body, atlas.sideWall, [-0.5, -0.5], [-0.5, 0.5]);
  wall(body, atlas.sideWall, [0.5, 0.5], [0.5, -0.5]);
  gable(body, atlas.gable, [-0.5, -0.5], [-0.5, 0.5], rise);
  gable(body, atlas.gable, [0.5, 0.5], [0.5, -0.5], rise);
  // The roof slopes to front and back; built along x, then turned so its ridge runs along the street.
  const slopes = surface();
  const eaves = 0.1; // deep enough to shelter the balcony
  roofSlope(slopes, [0, 1 + rise], [-0.5 - eaves, 1 - (eaves * rise) / 0.5], [-0.5 - VERGE, 0.5 + VERGE]);
  roofSlope(slopes, [0, 1 + rise], [0.5 + eaves, 1 - (eaves * rise) / 0.5], [-0.5 - VERGE, 0.5 + VERGE]);
  roof.add(slopes, (p) => [-p[2], p[1], p[0]]);

  const [x0, x1] = [-0.2, 0.2];
  const out = 0.62;
  block(body, atlas.wood, [x0, x1], [FLOOR - 0.04, FLOOR], [0.5, out], { faces: ['top', 'front', 'left', 'right'] });
  screen(body, [x0, x1], [FLOOR, FLOOR + 0.15], out - 0.01, 'z');
  for (const x of [x0 + 0.01, x1 - 0.01]) screen(body, [0.5, out - 0.01], [FLOOR, FLOOR + 0.15], x, 'x');
  for (const x of [x0 + 0.04, x1 - 0.04]) {
    block(body, atlas.wood, [x - 0.012, x + 0.012], [FLOOR - 0.07, FLOOR - 0.04], [0.5, out - 0.02], { faces: ['front', 'left', 'right', 'bottom'] });
  }
  return { body: body.geometry(), roof: roof.geometry() };
}

/**
 * A flat-roofed house: the long front of the balconied house without its
 * balcony, and on top a terrace of beaten lime behind a low parapet, with a
 * small room over one back corner where the stair comes up.
 */
function terracedHouse() {
  const body = surface();
  const roof = surface();
  const atlas = HOUSE_ATLAS;
  const corners = [[-0.5, 0.5], [0.5, 0.5], [0.5, -0.5], [-0.5, -0.5]]; // anticlockwise from above, front first
  const regions = [atlas.eavesFront, atlas.sideWall, atlas.sideWall, atlas.sideWall];
  const top = 1 + PARAPET;
  const inner = 0.5 - PARAPET_THICK;
  const innerCorners = corners.map(([x, z]) => [Math.sign(x) * inner, Math.sign(z) * inner]);
  corners.forEach((from, k) => {
    const to = corners[(k + 1) % 4];
    wall(body, regions[k], from, to);
    wall(body, atlas.parapet, from, to, [[0, 1], [1, 1], [1, top], [0, top]], [1, top]);
    // The parapet's inner face, looking back across the terrace, and its coping.
    wall(body, atlas.parapet, innerCorners[(k + 1) % 4], innerCorners[k], [[0, 1], [1, 1], [1, top], [0, top]], [1, top]);
    const [a, b, c, d] = [from, to, innerCorners[(k + 1) % 4], innerCorners[k]].map(([x, z]) => [x, top, z]);
    body.polygon([a, b, c, d], [[0, 0.8], [1, 0.8], [1, 1], [0, 1]].map(([s, t]) => atlasUV(atlas.parapet, s, t)), [0, 1, 0]);
  });
  const floor = innerCorners.map(([x, z]) => [x, 1, z]);
  roof.polygon(floor, floor.map(([x, , z]) => atlasUV(atlas.terrace, x + 0.5, z + 0.5)), [0, 1, 0]);
  // The stair-head room in the back corner, with its own flat top.
  const room = { x: [0.14, inner - 0.01], z: [-inner + 0.01, -0.16], top: 1.36 };
  block(body, atlas.wingSide, room.x, [1, room.top], room.z, { faces: ['front', 'back', 'left', 'right'] });
  const lid = [[room.x[0], room.top, room.z[1]], [room.x[1], room.top, room.z[1]], [room.x[1], room.top, room.z[0]], [room.x[0], room.top, room.z[0]]];
  roof.polygon(lid, lid.map(([x, , z]) => atlasUV(atlas.terrace, (x - room.x[0]) * 2, (z - room.z[0]) * 2)), [0, 1, 0]);
  return { body: body.geometry(), roof: roof.geometry() };
}

const PARAPET = 0.1; // height of a flat roof's parapet above the eaves line
const PARAPET_THICK = 0.04;

/**
 * A Genoese house of Galata: tall and narrow, its eaves to the street under a
 * low-pitched roof of tiles, a ground floor of shops and three storeys above.
 */
function genoeseHouse(frontRegion) {
  const body = surface();
  const roof = surface();
  const atlas = HOUSE_ATLAS;
  const rise = 0.16;
  wall(body, frontRegion, [-0.5, 0.5], [0.5, 0.5]);
  wall(body, atlas.genoeseSide, [0.5, -0.5], [-0.5, -0.5]);
  wall(body, atlas.genoeseSide, [-0.5, -0.5], [-0.5, 0.5]);
  wall(body, atlas.genoeseSide, [0.5, 0.5], [0.5, -0.5]);
  gable(body, atlas.genoeseGable, [-0.5, -0.5], [-0.5, 0.5], rise);
  gable(body, atlas.genoeseGable, [0.5, 0.5], [0.5, -0.5], rise);
  const slopes = surface();
  const eaves = 0.08;
  for (const side of [-1, 1]) {
    roofSlope(slopes, [0, 1 + rise], [side * (0.5 + eaves), 1 - (eaves * rise) / 0.5], [-0.5 - VERGE, 0.5 + VERGE], { thickness: 0.03 });
  }
  roof.add(slopes, (p) => [-p[2], p[1], p[0]]);
  return { body: body.geometry(), roof: roof.geometry() };
}

/**
 * A great house filling a block: a two-storey hall across the back with an
 * arcade onto the court, two lower wings coming forward to the street with
 * their gables to it, and between them the street wall with its gate. A
 * fountain stands in the court.
 */
function mansion() {
  const body = surface();
  const roof = surface();
  const atlas = HOUSE_ATLAS;
  const hall = { z: [-0.5, -0.24], rise: 0.3 };
  const wing = { width: 0.17, eaves: 0.82, rise: 0.2 };
  const court = 0.5 - wing.width; // the court spans x from -court to court
  const gate = 0.47; // the street wall's inner face

  // Long walls are built of several panels, so that their windows keep a house's spacing.
  const panels = (region, from, to, count, outline, range) => {
    for (let k = 0; k < count; k++) {
      const at = (t) => [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t];
      wall(body, region, at(k / count), at((k + 1) / count), outline, range);
    }
  };

  // The hall. Its court front runs the full width: above the wings' lower roofs it shows at the ends too.
  const [hz0, hz1] = hall.z;
  panels(atlas.mansionHall, [-0.5, hz1], [0.5, hz1], 6);
  panels(atlas.sideWall, [0.5, hz0], [-0.5, hz0], 6);
  wall(body, atlas.sideWall, [-0.5, hz0], [-0.5, hz1]);
  wall(body, atlas.sideWall, [0.5, hz1], [0.5, hz0]);
  gable(body, atlas.gable, [-0.5, hz0], [-0.5, hz1], hall.rise);
  gable(body, atlas.gable, [0.5, hz1], [0.5, hz0], hall.rise);
  ridgedRoof(roof, { along: 'x', from: -0.5, to: 0.5, centre: (hz0 + hz1) / 2, half: (hz1 - hz0) / 2, eaves: 1, rise: hall.rise });

  // The wings, their tops at a lower eaves line.
  const low = [[0, FOOT], [1, FOOT], [1, wing.eaves], [0, wing.eaves]];
  const range = [FOOT, wing.eaves];
  for (const side of [-1, 1]) {
    const outer = side * 0.5;
    const inner = side * court;
    const [x0, x1] = side < 0 ? [outer, inner] : [inner, outer];
    if (side < 0) {
      panels(atlas.sideWall, [outer, hz1], [outer, 0.5], 3, low, range);
      panels(atlas.eavesFront, [inner, gate], [inner, hz1], 3, low, range);
    } else {
      panels(atlas.sideWall, [outer, 0.5], [outer, hz1], 3, low, range);
      panels(atlas.eavesFront, [inner, hz1], [inner, gate], 3, low, range);
    }
    wall(body, atlas.gableFront1, [x0, 0.5], [x1, 0.5], low, range);
    wall(body, atlas.gable, [x0, 0.5], [x1, 0.5], [[0, wing.eaves], [1, wing.eaves], [0.5, wing.eaves + wing.rise]], [wing.eaves, wing.eaves + wing.rise]);
    ridgedRoof(roof, { along: 'z', from: hz1, to: 0.5, centre: (x0 + x1) / 2, half: wing.width / 2, eaves: wing.eaves, rise: wing.rise, back: 0 });
  }

  // The street wall, the gate in its middle, and the fountain.
  const height = GATE_WALL;
  const third = court / 3;
  for (const [a, b] of [[-court, -third], [third, court]]) {
    block(body, atlas.rubble, [a, b], [FOOT, height], [gate, 0.5], { faces: ['front', 'back'] });
  }
  block(body, atlas.gateWall, [-third, third], [FOOT, height], [gate, 0.5], { faces: ['front'] });
  block(body, atlas.rubble, [-third, third], [FOOT, height], [gate, 0.5], { faces: ['back'] });
  block(body, atlas.parapet, [-court, court], [height, height], [gate, 0.5], { faces: ['top'] });
  well(body, [0, 0.12], 0.035, 0.1);
  return { body: body.geometry(), roof: roof.geometry() };
}

/**
 * A pitched roof with its ridge along x or z at `centre` on the other axis,
 * from `from` to `to`, its verges overhanging (`back` sets the overhang at
 * the start, where a wing runs into a taller block).
 */
function ridgedRoof(target, { along, from, to, centre, half, eaves, rise, overhang = 0.03, back = VERGE }) {
  const slopes = surface();
  const drop = (overhang * rise) / half;
  for (const side of [-1, 1]) roofSlope(slopes, [0, eaves + rise], [side * (half + overhang), eaves - drop], [from - back, to + VERGE], { thickness: 0.03 });
  // Built with its ridge along z through x = 0; along x it is turned a quarter about y.
  if (along === 'z') target.add(slopes, (p) => p, [centre, 0, 0]);
  else target.add(slopes, ([x, y, z]) => [z, y, -x], [0, 0, centre]);
}

/**
 * One stretch of the Mese's porticoes: a row of shops behind a colonnade,
 * all under one roof sloping down to the street. Stretches stand end to end
 * along the street, so each has its two columns and its share of the beam.
 */
function porticoShops() {
  const body = surface();
  const roof = surface();
  const atlas = HOUSE_ATLAS;
  const [back, shop, front] = [-0.5, 0, 0.5];
  const [high, low] = [1.25, 0.72];
  const eaves = front + 0.06;
  const roofAt = (z) => high - ((z - back) * (high - low)) / (eaves - back);

  wall(body, atlas.shopFront, [-0.5, shop], [0.5, shop], [[0, FOOT], [1, FOOT], [1, roofAt(shop)], [0, roofAt(shop)]]);
  wall(body, atlas.sideWall, [0.5, back], [-0.5, back], [[0, FOOT], [1, FOOT], [1, high], [0, high]], [FOOT, high]);
  wall(body, atlas.sideWall, [-0.5, back], [-0.5, shop], [[0, FOOT], [1, FOOT], [1, roofAt(shop)], [0, high]], [FOOT, high]);
  wall(body, atlas.sideWall, [0.5, shop], [0.5, back], [[0, FOOT], [1, FOOT], [1, high], [0, roofAt(shop)]], [FOOT, high]);
  block(body, atlas.steps, [-0.5, 0.5], [FOOT, 0.03], [shop, front], { faces: ['top', 'front'] });

  const beam = { z: [0.4, 0.49] };
  const beamTop = roofAt(beam.z[1]) - 0.005;
  const beamBottom = beamTop - 0.07;
  block(body, atlas.parapet, [-0.5, 0.5], [beamBottom, beamTop], beam.z, { faces: ['front', 'back', 'bottom'] });
  for (const x of [-0.25, 0.25]) {
    block(body, atlas.column, [x - 0.035, x + 0.035], [FOOT, beamBottom], [0.41, 0.48], { faces: ['front', 'back', 'left', 'right'] });
  }

  // The roof, built sloping along x and turned so that it falls towards the street.
  const slope = surface();
  roofSlope(slope, [back, high], [eaves, low], [-0.5, 0.5], { thickness: 0.04 });
  roof.add(slope, ([x, y, z]) => [-z, y, x]);
  return { body: body.geometry(), roof: roof.geometry() };
}

/** A market stall: a counter of wares under a striped awning on four posts, open to the front (+z). */
function marketStall() {
  const body = surface();
  const roof = surface();
  const atlas = HOUSE_ATLAS;
  block(body, atlas.stall, [-0.42, 0.42], [FOOT, 0.42], [-0.05, 0.3], { faces: ['front'] });
  block(body, atlas.wood, [-0.42, 0.42], [FOOT, 0.42], [-0.05, 0.3], { faces: ['top', 'back', 'left', 'right'] });
  const awning = { back: [-0.5, 1], front: [0.56, 0.76] };
  const under = (z) => awning.back[1] + ((z - awning.back[0]) * (awning.front[1] - awning.back[1])) / (awning.front[0] - awning.back[0]);
  for (const x of [-0.46, 0.46]) {
    for (const z of [-0.44, 0.44]) {
      block(body, atlas.wood, [x - 0.025, x + 0.025], [FOOT, under(z)], [z - 0.025, z + 0.025], { faces: ['front', 'back', 'left', 'right'] });
    }
  }
  const [z0, y0] = awning.back;
  const [z1, y1] = awning.front;
  const cloth = [[-0.52, y1, z1], [0.52, y1, z1], [0.52, y0, z0], [-0.52, y0, z0]];
  const uvs = [[0, 0], [1, 0], [1, 1], [0, 1]].map(([s, t]) => atlasUV(atlas.awning, s, t));
  roof.polygon(cloth, uvs, [0, 1, 0.3], 1);
  roof.polygon(cloth, uvs, [0, -1, -0.3], 0.7);
  return { body: body.geometry(), roof: roof.geometry() };
}

// ---------- house parts ----------

/** A railing of slats: two faces back to back and a capping rail, standing in the plane x = at or z = at. */
function screen(target, [a0, a1], [y0, y1], at, axis) {
  const thin = 0.008;
  const point = (along, y, offset) => (axis === 'z' ? [along, y, at + offset] : [at + offset, y, along]);
  const facing = (sign) => (axis === 'z' ? [0, 0, sign] : [sign, 0, 0]);
  for (const sign of [1, -1]) {
    const points = [point(a0, y0, sign * thin), point(a1, y0, sign * thin), point(a1, y1, sign * thin), point(a0, y1, sign * thin)];
    target.polygon(points, [[0, 0], [1, 0], [1, 1], [0, 1]].map(([s, t]) => atlasUV(HOUSE_ATLAS.railing, s, t)), facing(sign));
  }
  const cap = [point(a0, y1, -thin), point(a1, y1, -thin), point(a1, y1, thin), point(a0, y1, thin)];
  target.polygon(cap, [[0, 0.9], [1, 0.9], [1, 1], [0, 1]].map(([s, t]) => atlasUV(HOUSE_ATLAS.railing, s, t)), [0, 1, 0]);
}

/**
 * Stone steps climbing from the street (z = from) back to a landing at the
 * balcony's floor, set against the main block, so only their treads, risers
 * and open side show.
 */
function stair(target, [x0, x1], from, to, count) {
  const landing = 0.08;
  const run = (from - to - landing) / count;
  const levels = Array.from({ length: count + 1 }, (_, i) => (FLOOR * (i + 1)) / (count + 1));
  levels[count] = FLOOR;
  let previous = FOOT;
  for (let i = 0; i <= count; i++) {
    const near = from - i * run;
    const far = i === count ? to : near - run;
    const y = levels[i];
    block(target, HOUSE_ATLAS.steps, [x0, x1], [previous, y], [far, near], { faces: ['front'] });
    block(target, HOUSE_ATLAS.steps, [x0, x1], [y, y], [far, near], { faces: ['top'] });
    const side = [[x1, FOOT, near], [x1, FOOT, far], [x1, y, far], [x1, y, near]];
    target.polygon(side, side.map(([, yy, z]) => atlasUV(HOUSE_ATLAS.rubble, (from - z) / (from - to), (yy - FOOT) / (FLOOR - FOOT))), [1, 0, 0]);
    previous = y;
  }
}

/** The same house with its plan reflected, the wing on the other hand. */
function mirrored({ body, roof }) {
  for (const geometry of [body, roof]) {
    for (const name of ['position', 'normal']) {
      const attribute = geometry.attributes[name];
      for (let i = 0; i < attribute.count; i++) attribute.setX(i, -attribute.getX(i));
    }
    // Reflection turns every triangle inside out; swap two corners of each to turn it back.
    for (const attribute of Object.values(geometry.attributes)) {
      for (let tri = 0; tri < attribute.count; tri += 3) {
        for (let k = 0; k < attribute.itemSize; k++) {
          const a = attribute.array[(tri + 1) * attribute.itemSize + k];
          attribute.array[(tri + 1) * attribute.itemSize + k] = attribute.array[(tri + 2) * attribute.itemSize + k];
          attribute.array[(tri + 2) * attribute.itemSize + k] = a;
        }
      }
    }
  }
  return { body, roof };
}

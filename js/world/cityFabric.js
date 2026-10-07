import * as THREE from 'three';
import { materials as M } from '../models/lib/materials.js';
import {
  box, boxGeometry, cylinder, cylinderGeometry, domeGeometry, hipRoofGeometry, mesh, crenelRingGeometry, pyramid,
} from '../models/lib/primitives.js';
import { mapStone, wallAlongGeometry } from '../models/lib/mapWalls.js';
import { crownGeometry, cypressGeometry, judasTreeGeometry } from '../models/lib/trees.js';
import { createRandom } from '../util/random.js';
import { QUALITY } from '../util/quality.js';
import { distanceToPolyline, pointInPolygon } from '../util/geo.js';
import { planTown } from './townPlanner.js';
import { planCountryside } from './countryside.js';
import {
  ARKLA_ISLET, ASIA, CHALCEDON_TOWN, CHRYSOPOLIS, CITY, GALATA, GALATA_SHORE, GALATA_WALLS, LAND_HEIGHT, METERS_TO_MAP,
  EUROPE, LAND_WALLS, MESE, MESE_NORTH, PERA_HILLS, SEA_WALLS, magnify,
} from '../data/geography.js';

/**
 * Everything that is not a landmark: the towns' blocks of houses, churches,
 * gardens and orchards, the woods, farms and hamlets of the countryside, and
 * the sea walls. Layout comes from townPlanner.js and countryside.js; here it
 * is drawn with a handful of instanced meshes in a restrained palette, each
 * piece standing on the hilly ground from ground.js.
 *
 * ground: { heightAt, slopeAt } from ground.js.
 * keepOut: [(point) => boolean, …] tests for areas reserved for landmarks.
 * erguvanSites: [{ centre, distance, clearance, count }, …] landmarks to ring
 *   with Judas trees: `distance(point)` is how far a point lies outside the
 *   landmark's footprint, and the trees stand a little beyond `clearance`.
 */
export function createCityFabric({ ground, keepOut = [], erguvanSites = [] }) {
  const rnd = createRandom(330);
  const erguvans = []; // planted first, so houses and other trees keep clear of them
  const clear = (point) => !keepOut.some((occupies) => occupies(point))
    && !erguvans.some(([east, north]) => Math.hypot(point[0] - east, point[1] - north) < ERGUVAN_ROOM);
  const away = (point, line, distance) => distanceToPolyline(point, line) > distance;

  erguvans.push(...planErguvans(createRandom(1453), erguvanSites, (p) => onLand(p, 0.4) && clear(p)
    && away(p, SEA_WALLS, 0.5) && away(p, LAND_WALLS, 0.8) && away(p, MESE, 0.25) && away(p, MESE_NORTH, 0.25) && away(p, GALATA_WALLS, 0.3)));

  const towns = [
    {
      polygon: CITY,
      accept: (p) => pointInPolygon(p, CITY) && away(p, SEA_WALLS, 0.6) && away(p, LAND_WALLS, 1)
        && away(p, MESE, 0.3) && away(p, MESE_NORTH, 0.3) && clear(p),
      orientation: alignedTo([MESE, MESE_NORTH, SEA_WALLS, LAND_WALLS]),
      // Densely built in the east; gardens and orchards fill much of the land inside the western walls.
      builtChance: ([east]) => 0.35 + 0.58 * THREE.MathUtils.smoothstep(east, -44, -22),
    },
    {
      polygon: GALATA,
      accept: (p) => pointInPolygon(p, GALATA) && away(p, GALATA_WALLS, 0.4) && away(p, GALATA_SHORE, 0.35) && clear(p),
      orientation: alignedTo([GALATA_SHORE, GALATA_WALLS]),
      districtSpacing: 4,
      block: [1.7, 1.25],
    },
    ...[CHRYSOPOLIS, CHALCEDON_TOWN].map((polygon) => ({
      polygon,
      accept: (p) => pointInPolygon(p, polygon) && pointInPolygon(p, ASIA) && away(p, ASIA, 0.6) && clear(p),
      orientation: alignedTo([ASIA]),
      builtChance: () => 0.75,
      districtSpacing: 4,
      block: [1.7, 1.25],
    })),
  ];

  const layers = { houses: [], trees: [], plots: [], churches: [] };
  const merge = (plan) => {
    for (const key of Object.keys(layers)) layers[key].push(...plan[key]);
  };
  for (const town of towns) merge(planTown(rnd, town));

  const outsideTowns = (p) => [CITY, GALATA, CHRYSOPOLIS, CHALCEDON_TOWN].every((town) => !pointInPolygon(p, town) && away(p, town.concat([town[0]]), 0.3));
  const countryside = planCountryside(rnd, {
    bounds: [-95, -45, 85, 90],
    open: (p, margin) => onLand(p, margin) && outsideTowns(p) && away(p, LAND_WALLS, 3.2) && clear(p),
    cemeteries: [[-53.5, -6], [-53, 6], [-50.5, 15], [-4, 24]].map(magnify),
  });
  // The countryside of both shores is left mostly open, its woods cut to a scattering; only the ridge of
  // Galata and Pera and the cemeteries' cypress groves keep theirs. Trees are most of the map's triangles,
  // and these woods most of its trees.
  const thinning = createRandom(1204);
  const onPeraRidge = (point) => PERA_HILLS.some(({ at, radius }) => Math.hypot(point[0] - at[0], point[1] - at[1]) < radius);
  countryside.trees = countryside.trees.filter(({ point, grove }) => grove || onPeraRidge(point)
    || !(pointInPolygon(point, EUROPE) || pointInPolygon(point, ASIA)) || thinning.chance(COUNTRY_WOODS_KEPT));
  merge(countryside);

  for (const item of Object.values(layers).flat()) item.y = LAND_HEIGHT + ground.heightAt(item.point);

  const fabric = new THREE.Group();
  fabric.add(
    createPlots(rnd, layers.plots, ground),
    createHouses(rnd, layers.houses),
    createChurches(rnd, layers.churches),
    createTrees(rnd, layers.trees),
    createErguvans(createRandom(1454), erguvans, ground),
  );
  fabric.add(createSeaWalls(), createArkla());
  return fabric;
}

/** Street direction near a point: the direction of the nearest segment of the given lines. */
function alignedTo(lines) {
  return ([x, y]) => {
    let best = Infinity;
    let angle = 0;
    for (const line of lines) {
      for (let i = 1; i < line.length; i++) {
        const [ax, ay] = line[i - 1];
        const [bx, by] = line[i];
        const distance = distanceToPolyline([x, y], [line[i - 1], line[i]]);
        if (distance < best) {
          best = distance;
          angle = Math.atan2(by - ay, bx - ax);
        }
      }
    }
    return angle;
  };
}

const COUNTRY_WOODS_KEPT = 1 / 8; // share of the countryside's trees left standing beyond the Pera ridge
const ERGUVAN_ROOM = 0.3; // map units kept clear around each Judas tree

/** Spots for the Judas trees: for each site, a few points at random bearings just beyond the landmark's clearing. */
function planErguvans(rnd, sites, open) {
  const spots = [];
  for (const { centre, distance, clearance, count } of sites) {
    let placed = 0;
    for (let attempt = 0; attempt < count * 15 && placed < count; attempt++) {
      const angle = rnd.range(0, Math.PI * 2);
      const at = (r) => [centre[0] + Math.cos(angle) * r, centre[1] + Math.sin(angle) * r];
      let r = 0;
      while (distance(at(r)) < clearance && r < 20) r += 0.05; // out to the edge of the clearing
      const spot = at(r + rnd.range(0.12, 0.4));
      if (!open(spot) || spots.some(([e, n]) => Math.hypot(spot[0] - e, spot[1] - n) < ERGUVAN_ROOM * 1.4)) continue;
      spots.push(spot);
      placed++;
    }
  }
  return spots;
}

function onLand(point, margin) {
  for (const land of [EUROPE, ASIA]) {
    if (pointInPolygon(point, land)) return distanceToPolyline(point, land, true) > margin;
  }
  return false;
}

// ---------- drawing ----------

const palette = (...hexes) => hexes.map((hex) => new THREE.Color(hex));
const FOUNDATION = 0.06; // how far buildings reach below their ground point
const WALL_TONES = palette(0xfaf2e2, 0xf5e8cf, 0xfdf8ee, 0xf0dfc0, 0xf6e4c8);
const TILE_TONES = palette(0xc4633f, 0xb9583a, 0xd0744c, 0xaf5238);
const PLOT_TONES = {
  built: palette(0xdcc59a),
  churchyard: palette(0xe8dcc0),
  garden: palette(0x8fb25a, 0x86aa55),
  orchard: palette(0x9cba5e),
  field: palette(0xc9c06a, 0xd4c374, 0xb8bd62),
  meadow: palette(0x98bc5c, 0x8cb456),
  fallow: palette(0xc4ad78, 0xbba270),
};
const TREE_TONES = {
  round: palette(0x6ea845, 0x7db650, 0x5f9a3e, 0x8bbd55),
  orchard: palette(0x96c25a, 0xa3c862),
  cypress: palette(0x3f7a42, 0x47844a, 0x376e3c),
};

/** A colour from a palette with a slight brightness jitter. */
function tone(rnd, palette, jitter = 0.05) {
  return palette[Math.floor(rnd.next() * palette.length)].clone().multiplyScalar(1 - jitter / 2 + rnd.next() * jitter);
}

/** Box with a darker foot, a cheap stand-in for ambient occlusion where walls meet the ground. */
function shadedBoxGeometry() {
  const geometry = boxGeometry(1, 1, 1);
  const position = geometry.attributes.position;
  const colors = [];
  for (let i = 0; i < position.count; i++) {
    const shade = 0.7 + 0.3 * position.getY(i);
    colors.push(shade, shade, shade);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return geometry;
}

function instanced(geometry, material, count) {
  const result = new THREE.InstancedMesh(geometry, material, Math.max(1, count));
  result.count = count;
  result.castShadow = result.receiveShadow = true;
  return result;
}

function compose(matrix, east, y, north, angle, sx, sy, sz) {
  const rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle);
  return matrix.compose(new THREE.Vector3(east, y, -north), rotation, new THREE.Vector3(sx, sy, sz));
}

function createHouses(rnd, houses) {
  const tiled = houses.filter((house) => !house.flat);
  const flat = houses.filter((house) => house.flat);
  const walls = instanced(shadedBoxGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), houses.length);
  // A unit hipped roof whose ridge runs along x for half its length.
  const roofs = instanced(hipRoofGeometry(2, 1, 1, 0).scale(0.5, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.75 }), tiled.length);
  const terraces = instanced(boxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.9 }), flat.length);
  const matrix = new THREE.Matrix4();

  houses.forEach(({ point: [east, north], y, angle, w, d, h }, i) => {
    // A little foundation below ground, so houses on a slope never float.
    walls.setMatrixAt(i, compose(matrix, east, y - FOUNDATION, north, angle, w, h + FOUNDATION, d));
    walls.setColorAt(i, tone(rnd, WALL_TONES));
  });
  tiled.forEach(({ point: [east, north], y, angle, w, d, h }, i) => {
    // Keep the ridge along the longer side.
    const [length, width, turn] = w >= d ? [w, d, 0] : [d, w, Math.PI / 2];
    roofs.setMatrixAt(i, compose(matrix, east, y + h, north, angle + turn, length * 1.08, width * 0.42, width * 1.12));
    roofs.setColorAt(i, tone(rnd, TILE_TONES));
  });
  flat.forEach(({ point: [east, north], y, angle, w, d, h }, i) => {
    terraces.setMatrixAt(i, compose(matrix, east, y + h, north, angle, w * 1.02, 0.012, d * 1.02));
    terraces.setColorAt(i, tone(rnd, WALL_TONES).multiplyScalar(0.94));
  });

  const group = new THREE.Group();
  group.add(walls, roofs, terraces);
  return group;
}

function createTrees(rnd, trees) {
  // A modest device plants only some of the leafy trees, an even spread of them.
  const leafy = trees.filter((tree) => tree.kind !== 'cypress').filter((tree, i) => (i * QUALITY.treeDensity) % 1 < QUALITY.treeDensity);
  const cypresses = trees.filter((tree) => tree.kind === 'cypress');
  // The crowns carry their own shading as vertex colours, which the instance colours tint.
  const foliage = new THREE.MeshStandardMaterial({ roughness: 0.95, vertexColors: true });
  const crowns = instanced(crownGeometry({ blobs: QUALITY.crownBlobs, detail: 0, seed: 7 }), foliage, leafy.length);
  const spires = instanced(cypressGeometry({ segments: 6, coarse: true, seed: 7 }), foliage, cypresses.length);
  const trunks = instanced(cylinderGeometry(0.5, 0.6, 1, 4, { open: true }), new THREE.MeshStandardMaterial({ color: 0x6b5038, roughness: 1 }), leafy.length);
  const matrix = new THREE.Matrix4();

  leafy.forEach(({ point: [east, north], y, kind, size }, i) => {
    const trunk = size * 0.35;
    const spread = size * rnd.range(0.46, 0.56);
    trunks.setMatrixAt(i, compose(matrix, east, y - 0.02, north, rnd.range(0, Math.PI), size * 0.09, trunk + 0.02, size * 0.09));
    crowns.setMatrixAt(i, compose(matrix, east, y + trunk + size * 0.3, north, rnd.range(0, Math.PI * 2), spread, size * rnd.range(0.4, 0.48), spread));
    crowns.setColorAt(i, tone(rnd, TREE_TONES[kind], 0.16));
  });
  cypresses.forEach(({ point: [east, north], y, size }, i) => {
    spires.setMatrixAt(i, compose(matrix, east, y - 0.02, north, rnd.range(0, Math.PI * 2), size * 0.15, size * rnd.range(1.2, 1.4), size * 0.15));
    spires.setColorAt(i, tone(rnd, TREE_TONES.cypress, 0.14));
  });

  const group = new THREE.Group();
  group.add(trunks, crowns, spires);
  return group;
}

/** The Judas trees: the light map erguvan, instanced as bark, blossom and leaves. */
function createErguvans(rnd, spots, ground) {
  const { wood, flowers, leaves } = judasTreeGeometry({ seed: 2, coarse: true });
  const parts = [[wood, M.erguvanBark], [flowers, M.blossom], [leaves, M.erguvanLeaves]].map(([geometry, material]) => instanced(geometry, material, spots.length));
  const matrix = new THREE.Matrix4();
  spots.forEach(([east, north], i) => {
    const size = rnd.range(0.32, 0.4);
    compose(matrix, east, LAND_HEIGHT + ground.heightAt([east, north]) - 0.01, north, rnd.range(0, Math.PI * 2), size, size, size);
    for (const part of parts) part.setMatrixAt(i, matrix);
  });
  const group = new THREE.Group();
  group.add(...parts);
  return group;
}

/** Courtyards, gardens and fields as thin coloured plates, tilted to lie along the slope. */
function createPlots(rnd, plots, ground) {
  const plates = instanced(boxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 1 }), plots.length);
  plates.castShadow = false;
  const matrix = new THREE.Matrix4();
  const up = new THREE.Vector3(0, 1, 0);
  const normal = new THREE.Vector3();
  const tilt = new THREE.Quaternion();
  const turn = new THREE.Quaternion();
  plots.forEach(({ point, y, angle, length, width, kind }, i) => {
    // World x is east and z is south, so the surface normal is (-dh/de, 1, dh/dn).
    const [slopeEast, slopeNorth] = ground.slopeAt(point);
    tilt.setFromUnitVectors(up, normal.set(-slopeEast, 1, slopeNorth).normalize());
    turn.setFromAxisAngle(up, angle);
    matrix.compose(new THREE.Vector3(point[0], y - 0.02, -point[1]), tilt.multiply(turn), new THREE.Vector3(length, 0.05, width));
    plates.setMatrixAt(i, matrix);
    plates.setColorAt(i, tone(rnd, PLOT_TONES[kind], 0.06));
  });
  return plates;
}

/**
 * Small cross-in-square churches: a low body, the raised arms of the cross,
 * an apse to the east and a dome on a drum — each part one instanced mesh.
 * Proportions are in units of the church's length.
 */
const CHURCH_PARTS = [
  { name: 'body', geometry: boxGeometry(1, 1, 1), offset: [0, 0, 0], scale: [1, 0.42, 0.78] },
  { name: 'nave', geometry: boxGeometry(1, 1, 1), offset: [0, 0, 0], scale: [1.02, 0.6, 0.34] },
  { name: 'transept', geometry: boxGeometry(1, 1, 1), offset: [0, 0, 0], scale: [0.34, 0.6, 0.82] },
  { name: 'apse', geometry: cylinderGeometry(1, 1, 1, 10), offset: [0.5, 0, 0], scale: [0.17, 0.38, 0.17] },
  { name: 'drum', geometry: cylinderGeometry(1, 1, 1, 12), offset: [0, 0.6, 0], scale: [0.16, 0.13, 0.16] },
  { name: 'dome', geometry: domeGeometry(1, { segments: 12 }), offset: [0, 0.73, 0], scale: [0.165, 0.16, 0.165] },
];
const CHURCH_TONES = palette(0xd98f66, 0xe6b98a, 0xf2e2c2, 0xcf8560);
const DOME_TONES = palette(0x8fa3ad, 0x9fb0b8, 0xc4633f);

function createChurches(rnd, churches) {
  const masonry = new THREE.MeshStandardMaterial({ roughness: 0.85 });
  const roofing = new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.2 });
  const meshes = CHURCH_PARTS.map(({ name, geometry }) => instanced(geometry, name === 'dome' ? roofing : masonry, churches.length));
  const base = new THREE.Matrix4();
  const part = new THREE.Matrix4();
  const identity = new THREE.Quaternion();

  churches.forEach(({ point: [east, north], y, angle, size }, i) => {
    base.makeRotationY(angle).setPosition(east, y - FOUNDATION, -north);
    const stone = tone(rnd, CHURCH_TONES);
    const roof = tone(rnd, DOME_TONES);
    CHURCH_PARTS.forEach(({ name, offset, scale }, k) => {
      const lift = name === 'drum' || name === 'dome' ? FOUNDATION : 0;
      const height = name === 'drum' || name === 'dome' ? scale[1] * size : scale[1] * size + FOUNDATION;
      part.compose(
        new THREE.Vector3(offset[0] * size, offset[1] * size + lift, offset[2] * size),
        identity,
        new THREE.Vector3(scale[0] * size, height, scale[2] * size),
      );
      meshes[k].setMatrixAt(i, part.premultiply(base));
      meshes[k].setColorAt(i, name === 'dome' ? roof : stone);
    });
  });

  const group = new THREE.Group();
  group.add(...meshes);
  return group;
}

/** Sea walls following both shores of the city, set just inside the coast. */
function createSeaWalls() {
  // The shoreline runs clockwise round the city, so the inside lies to the right.
  const geometry = wallAlongGeometry(SEA_WALLS, {
    height: 0.38, thickness: 0.14, y: LAND_HEIGHT, offset: -0.4, towerSpacing: 2.4, towerWidth: 0.3, towerHeight: 0.6,
  });
  return mesh(geometry, mapStone);
}

/**
 * The islet of Damalis (Arkla) off Chrysopolis: the rock ringed by the Komnenian
 * curtain wall and crowned by the tower that became the Maiden's Tower. Built
 * in metres to the same design as the Chrysopolis diorama (addDamalis there),
 * then scaled like the landmarks so the two views match.
 */
function createArkla() {
  const [east, north] = ARKLA_ISLET;
  const islet = new THREE.Group();
  islet.add(cylinder(12, 15, 3.4, M.stoneDark, 0, -1, 0, 14));
  islet.add(cylinder(11.5, 11.5, 1.4, M.stone, 0, 2.4, 0, 14));
  islet.add(cylinder(10.6, 10.6, 3.2, M.stone, 0, 3.8, 0, 14, { open: true }));
  islet.add(cylinder(9.6, 9.6, 3.2, M.stone, 0, 3.8, 0, 14, { open: true }));
  islet.add(mesh(new THREE.RingGeometry(9.6, 10.6, 14).rotateX(-Math.PI / 2), M.stone, 0, 7, 0));
  islet.add(mesh(crenelRingGeometry(10.1, { count: 16, merlon: 1.2, height: 0.9, thickness: 0.7 }), M.stone, 0, 7, 0));
  islet.add(box(6, 4.2, 4, M.stone, 10, 0, 2)); // landing stage towards the shore
  islet.add(cylinder(4.2, 4.6, 9, M.stone, 0, 3.8, 0, 10));
  islet.add(cylinder(4.6, 4.6, 0.8, M.stoneDark, 0, 12.8, 0, 10));
  islet.add(cylinder(3.9, 3.9, 5.5, M.wood, 0, 13.6, 0, 10));
  islet.add(cylinder(4.5, 4.5, 0.8, M.wood, 0, 19.1, 0, 10));
  islet.add(pyramid(6.6, 6.6, 4.8, M.lead, 0, 19.9, 0));
  islet.scale.setScalar(6 * METERS_TO_MAP);
  islet.position.set(east, 0, -north);
  islet.rotation.y = Math.PI; // the landing stage faces the Chrysopolis shore to the east
  return islet;
}

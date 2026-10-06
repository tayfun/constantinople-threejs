import * as THREE from 'three';
import { materials as M } from '../models/lib/materials.js';
import {
  boxGeometry, coneGeometry, cylinder, cylinderGeometry, domeGeometry, hipRoofGeometry, mesh,
} from '../models/lib/primitives.js';
import { mapStone, wallAlongGeometry } from '../models/lib/mapWalls.js';
import { createRandom } from '../util/random.js';
import { distanceToPolyline, pointInPolygon } from '../util/geo.js';
import { planTown } from './townPlanner.js';
import { planCountryside } from './countryside.js';
import {
  ARKLA_ISLET, ASIA, CHALCEDON_TOWN, CHRYSOPOLIS, CITY, GALATA, GALATA_SHORE, GALATA_WALLS, LAND_HEIGHT,
  LAND_WALLS, MESE, MESE_NORTH, PENINSULA, PERA, SEA_WALLS,
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
 */
export function createCityFabric({ ground, keepOut = [] }) {
  const rnd = createRandom(330);
  const clear = (point) => !keepOut.some((occupies) => occupies(point));
  const away = (point, line, distance) => distanceToPolyline(point, line) > distance;

  const towns = [
    {
      polygon: CITY,
      accept: (p) => pointInPolygon(p, CITY) && away(p, SEA_WALLS, 0.6) && away(p, LAND_WALLS, 1)
        && away(p, MESE, 0.3) && away(p, MESE_NORTH, 0.3) && clear(p),
      orientation: alignedTo([MESE, MESE_NORTH, SEA_WALLS, LAND_WALLS]),
      // Densely built in the east; gardens and orchards fill much of the land inside the western walls.
      builtChance: ([east]) => 0.35 + 0.58 * THREE.MathUtils.smoothstep(east, -52, -28),
    },
    {
      polygon: GALATA,
      accept: (p) => pointInPolygon(p, GALATA) && away(p, GALATA_WALLS, 0.4) && away(p, GALATA_SHORE, 0.35) && clear(p),
      orientation: alignedTo([GALATA_SHORE, GALATA_WALLS]),
      districtSpacing: 4,
      block: [1.3, 0.95],
    },
    ...[CHRYSOPOLIS, CHALCEDON_TOWN].map((polygon) => ({
      polygon,
      accept: (p) => pointInPolygon(p, polygon) && pointInPolygon(p, ASIA) && away(p, ASIA, 0.6) && clear(p),
      orientation: alignedTo([ASIA]),
      builtChance: () => 0.75,
      districtSpacing: 4,
      block: [1.3, 0.95],
    })),
  ];

  const layers = { houses: [], trees: [], plots: [], churches: [] };
  const merge = (plan) => {
    for (const key of Object.keys(layers)) layers[key].push(...plan[key]);
  };
  for (const town of towns) merge(planTown(rnd, town));

  const outsideTowns = (p) => [CITY, GALATA, CHRYSOPOLIS, CHALCEDON_TOWN].every((town) => !pointInPolygon(p, town) && away(p, town.concat([town[0]]), 0.3));
  merge(planCountryside(rnd, {
    bounds: [-95, -32, 80, 75],
    open: (p, margin) => onLand(p, margin) && outsideTowns(p) && away(p, LAND_WALLS, 3.2) && clear(p),
    cemeteries: [[-62.6, -6], [-62.2, 6], [-60.6, 14.5], [-1.5, 27]],
  }));

  for (const item of Object.values(layers).flat()) item.y = LAND_HEIGHT + ground.heightAt(item.point);

  const fabric = new THREE.Group();
  fabric.add(
    createPlots(rnd, layers.plots, ground),
    createHouses(rnd, layers.houses),
    createChurches(rnd, layers.churches),
    createTrees(rnd, layers.trees),
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

function onLand(point, margin) {
  for (const land of [PENINSULA, PERA, ASIA]) {
    if (pointInPolygon(point, land)) return distanceToPolyline(point, land, true) > margin;
  }
  return false;
}

// ---------- drawing ----------

const palette = (...hexes) => hexes.map((hex) => new THREE.Color(hex));
const FOUNDATION = 0.06; // how far buildings reach below their ground point
const WALL_TONES = palette(0xf1e8d6, 0xebdfc6, 0xf4eee2, 0xe4d4b6, 0xeadbc0);
const TILE_TONES = palette(0xa96b52, 0x9f654e, 0xb1785d, 0x986352);
const PLOT_TONES = {
  built: palette(0xc9b48e),
  churchyard: palette(0xd8ccb0),
  garden: palette(0x8c9a5a, 0x869657),
  orchard: palette(0x96a262),
  field: palette(0xa9a868, 0xb0aa6d, 0x9fa363),
  meadow: palette(0x8fa25c, 0x889c58),
  fallow: palette(0xa99d70, 0xa29669),
};
const TREE_TONES = {
  round: palette(0x5d7a42, 0x678448, 0x53703a, 0x6f8a4d),
  orchard: palette(0x7e9a55, 0x88a25b),
  cypress: palette(0x2f4b31, 0x365637, 0x2b4530),
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
  const leafy = trees.filter((tree) => tree.kind !== 'cypress');
  const cypresses = trees.filter((tree) => tree.kind === 'cypress');
  const foliage = new THREE.MeshStandardMaterial({ roughness: 0.95, flatShading: true });
  const crowns = instanced(new THREE.IcosahedronGeometry(1, 0), foliage, leafy.length);
  const spires = instanced(coneGeometry(1, 1, 7), foliage, cypresses.length);
  const trunks = instanced(cylinderGeometry(0.5, 0.6, 1, 5), new THREE.MeshStandardMaterial({ color: 0x6b5038, roughness: 1 }), leafy.length);
  const matrix = new THREE.Matrix4();

  leafy.forEach(({ point: [east, north], y, kind, size }, i) => {
    const trunk = size * 0.35;
    trunks.setMatrixAt(i, compose(matrix, east, y - 0.02, north, 0, size * 0.09, trunk + 0.02, size * 0.09));
    crowns.setMatrixAt(i, compose(matrix, east, y + trunk + size * 0.3, north, rnd.range(0, Math.PI), size * 0.5, size * 0.42, size * 0.5));
    crowns.setColorAt(i, tone(rnd, TREE_TONES[kind], 0.1));
  });
  cypresses.forEach(({ point: [east, north], y, size }, i) => {
    spires.setMatrixAt(i, compose(matrix, east, y - 0.02, north, rnd.range(0, Math.PI), size * 0.16, size * 1.3, size * 0.16));
    spires.setColorAt(i, tone(rnd, TREE_TONES.cypress, 0.1));
  });

  const group = new THREE.Group();
  group.add(trunks, crowns, spires);
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
const CHURCH_TONES = palette(0xc98f6c, 0xd8b48c, 0xe7d8bc, 0xbf8564);
const DOME_TONES = palette(0x8f989e, 0x99a1a6, 0xa96b52);

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

/** The islet of Arkla off Chrysopolis, with its small tower. */
function createArkla() {
  const [east, north] = ARKLA_ISLET;
  const group = new THREE.Group();
  group.add(cylinder(0.75, 0.9, 0.5, M.stoneDark, east, -0.1, -north, 14));
  group.add(cylinder(0.22, 0.22, 0.9, M.stone, east, 0.4, -north, 10));
  return group;
}

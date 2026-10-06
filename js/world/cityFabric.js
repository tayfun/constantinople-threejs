import * as THREE from 'three';
import { materials as M } from '../models/lib/materials.js';
import { boxGeometry, coneGeometry, cylinder, mesh, pyramidGeometry } from '../models/lib/primitives.js';
import { mapStone, wallAlongGeometry } from '../models/lib/mapWalls.js';
import { createRandom } from '../util/random.js';
import { distanceToPolyline, pointInPolygon } from '../util/geo.js';
import {
  ARKLA_ISLET, ASIA, CHALCEDON_TOWN, CHRYSOPOLIS, CITY, GALATA, GALATA_WALLS, LAND_HEIGHT,
  LAND_WALLS, MESE, MESE_NORTH, PENINSULA, PERA, SEA_WALLS,
} from '../data/geography.js';

/**
 * Everything that is not a landmark: thousands of houses, cypress groves,
 * fields outside the walls and the sea walls of the city. Houses, trees and
 * fields are instanced so the whole fabric costs a handful of draw calls.
 *
 * keepOut: [[east, north, radius], …] areas reserved for landmarks.
 */
export function createCityFabric({ keepOut = [] } = {}) {
  const fabric = new THREE.Group();
  const rnd = createRandom(330);
  const clear = (point) => !keepOut.some(([e, n, r]) => Math.hypot(point[0] - e, point[1] - n) < r);

  const houses = [];
  const inCity = (p) => pointInPolygon(p, CITY)
    && distanceToPolyline(p, SEA_WALLS) > 0.7
    && distanceToPolyline(p, LAND_WALLS) > 0.9
    && distanceToPolyline(p, MESE) > 0.45
    && distanceToPolyline(p, MESE_NORTH) > 0.45;
  scatter(rnd, houses, 3000, [-60, -18, 12, 30], (p) => inCity(p) && clear(p));
  scatter(rnd, houses, 420, [-11, 16, 5, 24], (p) => pointInPolygon(p, GALATA) && distanceToPolyline(p, GALATA_WALLS) > 0.5 && clear(p));
  scatter(rnd, houses, 170, [28, 13, 35, 25], (p) => pointInPolygon(p, CHRYSOPOLIS) && clear(p));
  scatter(rnd, houses, 160, [34, -30, 44, -14], (p) => pointInPolygon(p, CHALCEDON_TOWN) && clear(p));
  scatter(rnd, houses, 260, [-90, -30, 70, 70], (p) => onLand(p, 1.2) && !pointInPolygon(p, CITY) && !pointInPolygon(p, GALATA) && rnd.chance(0.25) && clear(p));
  fabric.add(createHouses(rnd, houses));

  const fields = [];
  scatter(rnd, fields, 260, [-95, -30, 80, 70], (p) => onLand(p, 2.5) && outsideTowns(p) && clear(p));
  fabric.add(createFields(rnd, fields));

  const trees = [];
  scatter(rnd, trees, 1700, [-95, -30, 80, 70], (p) => onLand(p, 0.8) && outsideTowns(p) && clear(p));
  scatter(rnd, trees, 160, [-60, -18, 12, 30], (p) => inCity(p) && clear(p) && rnd.chance(0.5));
  fabric.add(createTrees(rnd, trees));

  fabric.add(createSeaWalls());
  fabric.add(createArkla());
  return fabric;
}

function scatter(rnd, out, count, [e0, n0, e1, n1], accept) {
  for (let attempt = 0, placed = 0; attempt < count * 12 && placed < count; attempt++) {
    const point = [rnd.range(e0, e1), rnd.range(n0, n1)];
    if (!accept(point)) continue;
    out.push(point);
    placed++;
  }
}

function onLand(point, margin) {
  for (const land of [PENINSULA, PERA, ASIA]) {
    if (pointInPolygon(point, land)) return distanceToPolyline(point, land, true) > margin;
  }
  return false;
}

function outsideTowns(point) {
  return !pointInPolygon(point, CITY) && !pointInPolygon(point, GALATA)
    && !pointInPolygon(point, CHRYSOPOLIS) && !pointInPolygon(point, CHALCEDON_TOWN)
    && distanceToPolyline(point, LAND_WALLS) > 3;
}

/** Plastered houses with tiled pyramid roofs, two instanced meshes. */
function createHouses(rnd, points) {
  const walls = new THREE.InstancedMesh(boxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.9 }), points.length);
  const roofs = new THREE.InstancedMesh(pyramidGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.8 }), points.length);
  const plaster = [0xf2e6cc, 0xe9d4ae, 0xf7f1e4, 0xdcbf96, 0xe6cdb4, 0xcfae8c].map((c) => new THREE.Color(c));
  const tiles = [0xa8664c, 0x9a5a42, 0xb47a5c, 0x8c5a48].map((c) => new THREE.Color(c));
  const matrix = new THREE.Matrix4();
  const rotation = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);

  points.forEach(([east, north], i) => {
    const w = rnd.range(0.16, 0.34);
    const d = rnd.range(0.14, 0.26);
    const h = rnd.range(0.1, 0.26);
    const angle = 0.35 * Math.sin(east * 0.05 + north * 0.08) + rnd.pick([0, Math.PI / 2]) + rnd.range(-0.08, 0.08);
    rotation.setFromAxisAngle(up, angle);
    matrix.compose(new THREE.Vector3(east, LAND_HEIGHT, -north), rotation, new THREE.Vector3(w, h, d));
    walls.setMatrixAt(i, matrix);
    walls.setColorAt(i, rnd.pick(plaster));
    // Many Byzantine houses had flat terrace roofs; the rest are tiled.
    const flat = rnd.chance(0.4);
    const roofHeight = flat ? 0.015 : Math.min(w, d) * 0.4;
    matrix.compose(new THREE.Vector3(east, LAND_HEIGHT + h, -north), rotation, new THREE.Vector3(w * (flat ? 1 : 1.1), roofHeight, d * (flat ? 1 : 1.1)));
    roofs.setMatrixAt(i, matrix);
    roofs.setColorAt(i, flat ? rnd.pick(plaster) : rnd.pick(tiles));
  });
  for (const instanced of [walls, roofs]) instanced.castShadow = instanced.receiveShadow = true;
  const group = new THREE.Group();
  group.add(walls, roofs);
  return group;
}

/** Cypresses and rounder fruit trees. */
function createTrees(rnd, points) {
  const crowns = new THREE.InstancedMesh(coneGeometry(1, 1, 7), new THREE.MeshStandardMaterial({ roughness: 0.95 }), points.length);
  const greens = [0x2e4a2c, 0x3b5a32, 0x4a6a3a, 0x354f30].map((c) => new THREE.Color(c));
  const matrix = new THREE.Matrix4();
  points.forEach(([east, north], i) => {
    const tall = rnd.chance(0.65);
    const height = tall ? rnd.range(0.35, 0.65) : rnd.range(0.2, 0.32);
    const radius = tall ? height * 0.16 : height * 0.55;
    matrix.makeScale(radius, height, radius).setPosition(east, LAND_HEIGHT, -north);
    crowns.setMatrixAt(i, matrix);
    crowns.setColorAt(i, rnd.pick(greens));
  });
  crowns.castShadow = crowns.receiveShadow = true;
  return crowns;
}

/** Patchwork of fields and vineyards in the countryside. */
function createFields(rnd, points) {
  const fields = new THREE.InstancedMesh(boxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({
    roughness: 1,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  }), points.length);
  const colours = [0x9aa65a, 0xb8b06a, 0x7f9450, 0xc2a965, 0x8c8a4e].map((c) => new THREE.Color(c));
  const matrix = new THREE.Matrix4();
  const rotation = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  points.forEach(([east, north], i) => {
    rotation.setFromAxisAngle(up, rnd.range(-0.4, 0.4));
    matrix.compose(new THREE.Vector3(east, LAND_HEIGHT, -north), rotation, new THREE.Vector3(rnd.range(1, 3), 0.02, rnd.range(0.8, 2.2)));
    fields.setMatrixAt(i, matrix);
    fields.setColorAt(i, rnd.pick(colours));
  });
  fields.receiveShadow = true;
  return fields;
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

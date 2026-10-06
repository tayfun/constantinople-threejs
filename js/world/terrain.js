import * as THREE from 'three';
import { materials as M } from '../models/lib/materials.js';
import { cityGround } from '../models/lib/textures.js';
import { createWaterMaterial } from '../models/lib/water.js';
import { wallAlongGeometry } from '../models/lib/mapWalls.js';
import { mesh } from '../models/lib/primitives.js';
import {
  ASIA, CITY, GALATA, LAND_HEIGHT, MESE, MESE_NORTH, PENINSULA, PERA,
} from '../data/geography.js';

/**
 * The map's ground: the three land masses with sandy shores, open water,
 * the built-up area of each town and the Mese, Constantinople's main street.
 */
export function createTerrain() {
  const terrain = new THREE.Group();

  const water = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000).rotateX(-Math.PI / 2), createWaterMaterial({ scale: 1.4 }));
  terrain.add(water);

  for (const polygon of [PENINSULA, PERA, ASIA]) terrain.add(landMesh(polygon));

  const urban = new THREE.MeshStandardMaterial({
    map: cityGround(),
    roughness: 0.95,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  for (const area of [CITY, GALATA]) terrain.add(overlay(area, urban, 0.01));

  const street = new THREE.MeshStandardMaterial({ color: 0xd9ccb0, roughness: 0.9 });
  for (const line of [MESE, MESE_NORTH]) {
    terrain.add(mesh(wallAlongGeometry(line, { height: 0.03, thickness: 0.4, y: LAND_HEIGHT }), street));
  }

  return terrain;
}

/** Extruded land with a bevelled, sandy shoreline sloping under the water. */
function landMesh(polygon) {
  const shape = new THREE.Shape(polygon.map(([east, north]) => new THREE.Vector2(east, north)));
  const depth = 2;
  const bevel = 0.5;
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: 0.9,
    bevelSegments: 2,
    curveSegments: 1,
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, LAND_HEIGHT - depth - bevel, 0);
  const land = new THREE.Mesh(geometry, [M.grass, M.sand]);
  land.receiveShadow = true;
  return land;
}

function overlay(polygon, material, lift) {
  const shape = new THREE.Shape(polygon.map(([east, north]) => new THREE.Vector2(east, north)));
  const geometry = new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2);
  const result = new THREE.Mesh(geometry, material);
  result.position.y = LAND_HEIGHT + lift;
  result.receiveShadow = true;
  return result;
}

import * as THREE from 'three';
import { materials as M } from '../models/lib/materials.js';
import { cityGround, mapMeadow, mapPines, mapScrub } from '../models/lib/textures.js';
import { createWaterMaterial } from '../models/lib/water.js';
import { mesh } from '../models/lib/primitives.js';
import { pointInPolygon, samplePolyline } from '../util/geo.js';
import {
  ASIA, CITY, EUROPE, GALATA, ISLANDS, LAND_HEIGHT, MESE, MESE_NORTH, PERA,
} from '../data/geography.js';

/**
 * The map's ground: the two shores, Europe and Asia, with sandy beaches, open water,
 * the built-up area of each town, the city's seven hills and the ridge of
 * Galata and Pera, the Princes' Islands out in the Marmara, and the Mese,
 * Constantinople's main street, running over them.
 *
 * ground: heights from ground.js.
 */
export function createTerrain(ground) {
  const terrain = new THREE.Group();

  const water = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000).rotateX(-Math.PI / 2), createWaterMaterial({ scale: 0.45, deep: 0x1b6283, shallow: 0x3a97a9, sky: 0xa9d3de }));
  terrain.add(water);

  for (const polygon of [EUROPE, ASIA]) terrain.add(landMesh(polygon));
  for (const { shore, bare } of ISLANDS) {
    const cover = bare ? scrub : pines;
    terrain.add(landMesh(shore, cover), hillsMesh(ground, cover, { within: shore }));
  }

  const urban = new THREE.MeshStandardMaterial({
    map: cityGround(),
    roughness: 0.95,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  for (const area of [CITY, GALATA]) terrain.add(overlay(area, urban, 0.01));
  terrain.add(hillsMesh(ground, urban, { within: CITY }), hillsMesh(ground, urban, { within: GALATA }));
  terrain.add(hillsMesh(ground, meadow, { within: PERA, except: GALATA }));

  const street = new THREE.MeshStandardMaterial({ color: 0xf2e6c8, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 });
  for (const line of [MESE, MESE_NORTH]) terrain.add(mesh(ribbonGeometry(line, 0.4, ground), street));

  return terrain;
}

/**
 * The hills as a fine grid over an area, keeping only the triangles that
 * rise above the flat ground; where they fade to nothing they meet the flat
 * land seamlessly. The grid is anchored to multiples of its spacing, so the
 * meshes of neighbouring areas share their vertices along the boundary.
 *
 * within: polygon to cover; except: polygon left out (covered by another mesh)
 */
function hillsMesh(ground, material, { within, except = null }) {
  const spacing = 0.35;
  const snap = (value, up) => (up ? Math.ceil(value / spacing) : Math.floor(value / spacing)) * spacing;
  const xs = within.map(([e]) => e);
  const ys = within.map(([, n]) => n);
  const [e0, e1, n0, n1] = [snap(Math.min(...xs)), snap(Math.max(...xs), true), snap(Math.min(...ys)), snap(Math.max(...ys), true)];
  const columns = Math.round((e1 - e0) / spacing) + 1;
  const rows = Math.round((n1 - n0) / spacing) + 1;

  const positions = [];
  const uvs = [];
  const heights = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < columns; i++) {
      const e = e0 + i * spacing;
      const n = n0 + j * spacing;
      const height = ground.heightAt([e, n]);
      heights.push(height);
      positions.push(e, LAND_HEIGHT + 0.01 + height, -n);
      uvs.push(e, n);
    }
  }

  const indices = [];
  const index = (i, j) => j * columns + i;
  const keep = (a, b, c) => {
    if (Math.max(heights[a], heights[b], heights[c]) < 0.004) return false;
    const centre = [(positions[a * 3] + positions[b * 3] + positions[c * 3]) / 3, -(positions[a * 3 + 2] + positions[b * 3 + 2] + positions[c * 3 + 2]) / 3];
    return pointInPolygon(centre, within) && !(except && pointInPolygon(centre, except));
  };
  for (let j = 0; j < rows - 1; j++) {
    for (let i = 0; i < columns - 1; i++) {
      const [a, b, c, d] = [index(i, j), index(i + 1, j), index(i + 1, j + 1), index(i, j + 1)];
      // Counter-clockwise seen from above (north is -z), so the faces point up.
      if (keep(a, b, c)) indices.push(a, b, c);
      if (keep(a, c, d)) indices.push(a, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const hills = new THREE.Mesh(geometry, material.clone());
  Object.assign(hills.material, { polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  hills.receiveShadow = true;
  return hills;
}

/** A flat strip of the given width along a polyline, draped over the ground. */
function ribbonGeometry(line, width, ground) {
  const positions = [];
  const indices = [];
  for (const [k, { point: [e, n], dir: [de, dn] }] of samplePolyline(line, 0.3).entries()) {
    const y = LAND_HEIGHT + 0.025 + ground.heightAt([e, n]);
    const [pe, pn] = [-dn * (width / 2), de * (width / 2)];
    positions.push(e + pe, y, -(n + pn), e - pe, y, -(n - pn));
    if (k > 0) {
      const a = (k - 1) * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

const meadow = new THREE.MeshStandardMaterial({ map: mapMeadow(), roughness: 0.95 });
const pines = new THREE.MeshStandardMaterial({ map: mapPines(), roughness: 0.95 });
const scrub = new THREE.MeshStandardMaterial({ map: mapScrub(), roughness: 0.95 });

/** Extruded land with a bevelled, sandy shoreline sloping under the water. */
function landMesh(polygon, cover = meadow) {
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
  const land = new THREE.Mesh(geometry, [cover, M.sand]);
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

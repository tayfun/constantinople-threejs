import * as THREE from 'three';
import { houseGeometry } from '../../world/houses.js';
import { townMaterials } from '../../world/atlasGeometry.js';

/**
 * Ordinary town houses that give the landmarks a lived-in setting: the same
 * houses as the map's town fabric (world/houses.js), painted from the same
 * atlas, so a diorama's streets look like the map's.
 */

const PLASTER_COLORS = [0xf2e3c6, 0xe8cfa6, 0xf5eee0, 0xdcb98e, 0xe9d2b8, 0xd6a982];
const BYZANTINE = ['loggia', 'loggiaMirrored', 'balconied', 'gabledWide', 'terraced'];

const geometries = new Map();
const materials = new Map();

/** A variant's unit geometry, built once and shared: finalizeModel bakes a copy of it into each model. */
function unitHouse(name) {
  if (!geometries.has(name)) geometries.set(name, houseGeometry(name));
  return geometries.get(name);
}

/** The town walls material washed with a colour: fully for Genoese plaster, faintly over Byzantine stone. */
function walls(color, strength) {
  const key = `${color}:${strength}`;
  if (!materials.has(key)) {
    const material = townMaterials().walls.clone();
    material.color = new THREE.Color(0xffffff).lerp(new THREE.Color(color), strength);
    materials.set(key, material);
  }
  return materials.get(key);
}

/**
 * A house, base at y = 0, `w` along x, `d` along z with its front to +z,
 * and its walls `h` to the eaves. `style` is 'byzantine' (a stone house of
 * two storeys; its height is kept to what two storeys allow) or 'genoese'
 * (a tall plastered Ligurian house, washed in `color`). `variant` picks a
 * particular house from world/houses.js; without one, the house is chosen
 * from its size, so a model is the same on every load.
 */
export function createHouse({ w = 10, d = 8, h = 7, color = PLASTER_COLORS[0], style = 'byzantine', variant } = {}) {
  const genoese = style === 'genoese';
  const name = variant ?? (genoese ? (w < 10 ? 'genoese' : 'genoeseWide') : w < 9 ? 'gabled' : BYZANTINE[Math.floor(Math.abs(Math.sin(w * 12.9898 + d * 78.233) * 43758.5453) % 1 * BYZANTINE.length)]);
  const height = genoese ? h : THREE.MathUtils.clamp(h, w * 0.45, w * 0.8);
  const { body, roof } = unitHouse(name);
  const house = new THREE.Group();
  for (const [geometry, material] of [[body, walls(color, genoese ? 1 : 0.25)], [roof, townMaterials().roofs]]) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.scale.set(w, height, d);
    house.add(mesh);
  }
  return house;
}

/** A Byzantine house to suit a width, drawing exactly one number from `rnd`. */
export function pickHouseVariant(rnd, w) {
  const pick = rnd.pick(BYZANTINE);
  return w < 9 ? 'gabled' : pick;
}

/** Scatters houses with a seeded random generator, avoiding a list of [x, z, radius] keep-out circles. */
export function scatterHouses(group, rnd, { count, area: [x0, z0, x1, z1], groundAt = () => 0, avoid = [], style = {} }) {
  let placed = 0;
  for (let attempt = 0; attempt < count * 20 && placed < count; attempt++) {
    const x = rnd.range(x0, x1);
    const z = rnd.range(z0, z1);
    if (avoid.some(([ax, az, r]) => Math.hypot(x - ax, z - az) < r)) continue;
    const w = rnd.range(7, 14);
    const d = rnd.range(6, 10);
    const h = rnd.range(5, 11);
    const color = rnd.pick(PLASTER_COLORS);
    const variant = pickHouseVariant(rnd, style.w ?? w);
    const house = createHouse({ w, d, h, color, variant: style.style === 'genoese' ? undefined : variant, ...style });
    house.position.set(x, groundAt(x, z), z);
    house.rotation.y = rnd.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]) + rnd.range(-0.1, 0.1);
    group.add(house);
    avoid.push([x, z, 9]);
    placed++;
  }
}

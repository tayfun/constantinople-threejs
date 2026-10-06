import * as THREE from 'three';
import { materials as M, tinted } from './materials.js';
import { box, gableRoof, hipRoof, windowRow } from './primitives.js';

/** Ordinary town houses that give the landmarks a lived-in setting. */

const PLASTER_COLORS = [0xf2e3c6, 0xe8cfa6, 0xf5eee0, 0xdcb98e, 0xe9d2b8, 0xd6a982];

/**
 * A plastered house with a tiled roof, base at y = 0, long side along x.
 * `windows` adds a row of small openings per storey on the +z face.
 */
export function createHouse({ w = 10, d = 8, h = 7, color = PLASTER_COLORS[0], roof = 'hip', windows = true } = {}) {
  const house = new THREE.Group();
  house.add(box(w, h, d, tinted('plaster', color), 0, 0, 0));
  house.add(roof === 'gable' ? gableRoof(w, d, d * 0.3, M.roof, 0, h, 0, 0.4) : hipRoof(w, d, Math.min(w, d) * 0.3, M.roof, 0, h, 0, 0.4));
  if (windows) {
    const storeys = Math.max(1, Math.floor(h / 3.4));
    const count = Math.max(1, Math.floor(w / 3));
    for (let s = 0; s < storeys; s++) {
      const row = windowRow({ count, spacing: w / count, width: 0.9, height: 1.5, y: 1.2 + s * 3.2 });
      row.position.z = d / 2 + 0.03;
      house.add(row);
    }
  }
  return house;
}

/** Scatters houses with a seeded random generator, avoiding a list of [x, z, radius] keep-out circles. */
export function scatterHouses(group, rnd, { count, area: [x0, z0, x1, z1], groundAt = () => 0, avoid = [], style = {} }) {
  let placed = 0;
  for (let attempt = 0; attempt < count * 20 && placed < count; attempt++) {
    const x = rnd.range(x0, x1);
    const z = rnd.range(z0, z1);
    if (avoid.some(([ax, az, r]) => Math.hypot(x - ax, z - az) < r)) continue;
    const house = createHouse({
      w: rnd.range(7, 14),
      d: rnd.range(6, 10),
      h: rnd.range(5, 11),
      color: rnd.pick(PLASTER_COLORS),
      roof: rnd.chance(0.5) ? 'hip' : 'gable',
      ...style,
    });
    house.position.set(x, groundAt(x, z), z);
    house.rotation.y = rnd.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]) + rnd.range(-0.1, 0.1);
    group.add(house);
    avoid.push([x, z, 9]);
    placed++;
  }
}

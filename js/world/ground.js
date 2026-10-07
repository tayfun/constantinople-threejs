import { distanceToPolyline, pointInPolygon } from '../util/geo.js';
import {
  BLACHERNAE_WALLS, CITY, LAND_WALLS, PERA, PERA_HILLS, PERA_SHORE, SEA_WALLS, SEVEN_HILLS,
} from '../data/geography.js';

const smoothstep = (edge0, edge1, x) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

/** How far from a terrace's edge the ground blends back into the natural slope. */
const TERRACE_BLEND = 1.2;

/**
 * Ground height above the flat land level, in map units, at any [east, north].
 *
 * The seven hills rise inside the city and fade out towards the sea walls and
 * land walls, so shores and fortifications stay level. Across the Horn the
 * hill of Galata and the Pera ridge rise from the water; Galata's walls climb
 * the slope (see mapWalls.js), so only the shore holds that ridge down. Each
 * landmark sits on a terrace: inside its footprint the ground is flattened to
 * the height at its centre, blending smoothly back into the hills around it —
 * much as the Byzantines terraced the slopes for their great buildings.
 *
 * footprints: [{ centre: [east, north], distance(point) → map units outside the footprint }]
 */
export function createGround({ footprints = [] } = {}) {
  const bumps = ([e, n], hills) => hills.reduce(
    (sum, { at: [he, hn], height, radius }) => sum + height * Math.exp(-((e - he) ** 2 + (n - hn) ** 2) / (radius * radius)),
    0,
  );
  const shoreward = (point, shore) => smoothstep(0.6, 3, distanceToPolyline(point, shore));

  const hills = (point) => {
    if (pointInPolygon(point, CITY)) {
      const walls = smoothstep(1.2, 4, Math.min(distanceToPolyline(point, LAND_WALLS), distanceToPolyline(point, BLACHERNAE_WALLS)));
      return bumps(point, SEVEN_HILLS) * shoreward(point, SEA_WALLS) * walls;
    }
    if (pointInPolygon(point, PERA)) return bumps(point, PERA_HILLS) * shoreward(point, PERA_SHORE);
    return 0;
  };

  const terraces = footprints.map(({ centre, distance }) => ({ distance, level: hills(centre) }));

  const heightAt = (point) => {
    let height = hills(point);
    for (const { distance, level } of terraces) {
      const d = distance(point);
      if (d < TERRACE_BLEND) height += (level - height) * (1 - smoothstep(0, TERRACE_BLEND, d));
    }
    return height;
  };

  /** Gradient [dh/deast, dh/dnorth], for tilting flat things to the slope. */
  const slopeAt = ([e, n]) => {
    const step = 0.1;
    return [
      (heightAt([e + step, n]) - heightAt([e - step, n])) / (2 * step),
      (heightAt([e, n + step]) - heightAt([e, n - step])) / (2 * step),
    ];
  };

  return { heightAt, slopeAt };
}

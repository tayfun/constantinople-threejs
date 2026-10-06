import { createNoise } from '../util/noise.js';

/**
 * The land outside the towns: woods and groves where a noise field says
 * "wild", farm patchworks with hedgerows, hamlets and the odd monastery
 * where it says "farmed", and cypress groves with a chapel at the
 * cemeteries outside the walls. Returns plain data
 * in map units ([east, north]); rendering happens in cityFabric.js.
 *
 * options:
 *   bounds         [east0, north0, east1, north1] area to fill
 *   open(point, margin)  whether open land is available at a point
 *   cemeteries     [[east, north], …] centres of cypress groves
 */
export function planCountryside(rnd, { bounds: [e0, n0, e1, n1], open, cemeteries = [] }) {
  const noise = createNoise(rnd);
  const wildness = (point) => noise(point[0], point[1], 0.045, 4);
  const plan = { houses: [], trees: [], plots: [], churches: [] };

  // Woods and scattered groves.
  const spacing = 0.55;
  for (let e = e0; e < e1; e += spacing) {
    for (let n = n0; n < n1; n += spacing) {
      const point = [e + rnd.range(-0.4, 0.4) * spacing, n + rnd.range(-0.4, 0.4) * spacing];
      const wild = wildness(point);
      const wooded = wild > 0.57 || (wild > 0.52 && rnd.chance(0.2));
      if (!wooded || !open(point, 0.8)) continue;
      plan.trees.push({ point, kind: rnd.chance(0.15) ? 'cypress' : 'round', size: rnd.range(0.32, 0.48) });
    }
  }

  // Farms: a small rotated patchwork of fields, hedgerows and sometimes a hamlet.
  const farmSpacing = 7;
  for (let e = e0; e < e1; e += farmSpacing) {
    for (let n = n0; n < n1; n += farmSpacing) {
      const centre = [e + rnd.range(-0.3, 0.3) * farmSpacing, n + rnd.range(-0.3, 0.3) * farmSpacing];
      if (wildness(centre) > 0.44 || !open(centre, 2)) continue;
      addFarm(rnd, plan, centre, open);
    }
  }

  for (const centre of cemeteries) {
    if (open(centre, 0.5)) plan.churches.push({ point: centre, angle: 0, size: 0.42 });
    for (let k = 0; k < 22; k++) {
      const point = [centre[0] + rnd.range(-0.9, 0.9), centre[1] + rnd.range(-0.9, 0.9)];
      if (Math.hypot(point[0] - centre[0], point[1] - centre[1]) < 0.45) continue;
      if (open(point, 0.6)) plan.trees.push({ point, kind: 'cypress', size: rnd.range(0.3, 0.45) });
    }
  }
  return plan;
}

function addFarm(rnd, plan, centre, open) {
  const angle = rnd.range(0, Math.PI);
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const at = (u, v) => [centre[0] + u * c - v * s, centre[1] + u * s + v * c];
  const columns = rnd.int(2, 4);
  const rows = rnd.int(2, 3);
  const length = rnd.range(1.1, 1.6);
  const width = rnd.range(0.8, 1.2);
  const gap = 0.08;

  for (let i = 0; i < columns; i++) {
    for (let j = 0; j < rows; j++) {
      const u = (i - (columns - 1) / 2) * (length + gap);
      const v = (j - (rows - 1) / 2) * (width + gap);
      const point = at(u, v);
      if (!open(point, 0.9)) continue;
      plan.plots.push({ point, angle, length, width, kind: rnd.pick(['field', 'field', 'meadow', 'fallow']) });
      // Hedgerow along one edge of some fields.
      if (rnd.chance(0.3)) {
        for (let t = -length / 2; t <= length / 2; t += 0.3) {
          const tree = at(u + t, v + width / 2 + gap / 2);
          if (open(tree, 0.6) && rnd.chance(0.75)) plan.trees.push({ point: tree, kind: 'round', size: rnd.range(0.22, 0.32) });
        }
      }
    }
  }

  if (rnd.chance(0.4)) {
    const hamlet = at(((columns + 1) / 2) * (length + gap), 0);
    const placed = [];
    if (rnd.chance(0.3) && open(hamlet, 0.8)) {
      plan.churches.push({ point: hamlet, angle: 0, size: rnd.range(0.45, 0.55) });
      placed.push(hamlet);
    }
    for (let k = rnd.int(4, 9); k > 0; k--) {
      const point = [hamlet[0] + rnd.range(-0.55, 0.55), hamlet[1] + rnd.range(-0.55, 0.55)];
      if (!open(point, 0.7) || placed.some((other) => Math.hypot(point[0] - other[0], point[1] - other[1]) < 0.45)) continue;
      placed.push(point);
      plan.houses.push({ point, angle: angle + rnd.pick([0, Math.PI / 2]), w: rnd.range(0.28, 0.4), d: rnd.range(0.22, 0.3), h: rnd.range(0.12, 0.18), flat: false });
    }
  }
}

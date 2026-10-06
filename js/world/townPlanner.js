import { pointInPolygon } from '../util/geo.js';

/**
 * Lays out a town the way it grew: districts, each with a grid of blocks
 * aligned to the nearest main street or shore; houses line the block edges
 * facing the streets around a courtyard, some blocks are churchyards with a
 * neighbourhood church, and some stay gardens, orchards or fields. Works in map units ([east, north]) and returns plain
 * data — rendering happens in cityFabric.js.
 *
 * options:
 *   polygon            outline of the town
 *   accept(point)      whether a house may stand at a point (walls, streets, landmarks…)
 *   orientation(point) street direction near a point, radians (0 = east)
 *   builtChance(point) chance that a block is built up rather than green
 *   districtSpacing    distance between district centres
 *   block              [length, width] of a block including half the street on each side
 *   street             street width
 *   height             [min, max] house height
 *   churchChance       chance that a built block is a churchyard instead
 */
export function planTown(rnd, {
  polygon,
  accept,
  orientation,
  builtChance = () => 0.9,
  districtSpacing = 8,
  block = [2.2, 1.5],
  street = 0.26,
  height = [0.17, 0.27],
  churchChance = 0.08,
}) {
  const plan = { houses: [], trees: [], plots: [], churches: [] };
  const districts = districtCentres(rnd, polygon, districtSpacing, orientation);
  const reach = Math.ceil((districtSpacing * 1.3) / Math.min(...block));

  for (const district of districts) {
    for (let i = -reach; i <= reach; i++) {
      for (let j = -reach; j <= reach; j++) {
        const centre = offset(district.point, i * block[0], j * block[1], district.angle);
        if (!pointInPolygon(centre, polygon) || nearest(districts, centre) !== district) continue;
        planBlock(rnd, plan, {
          centre,
          angle: district.angle,
          length: block[0] - street,
          width: block[1] - street,
          built: rnd.next() < builtChance(centre),
          accept,
          polygon,
          height,
          churchChance,
        });
      }
    }
  }
  return plan;
}

/** Jittered district centres inside the polygon, each with its street direction. */
function districtCentres(rnd, polygon, spacing, orientation) {
  const xs = polygon.map(([x]) => x);
  const ys = polygon.map(([, y]) => y);
  const centres = [];
  for (let x = Math.min(...xs) + spacing / 2; x < Math.max(...xs); x += spacing) {
    for (let y = Math.min(...ys) + spacing / 2; y < Math.max(...ys); y += spacing) {
      const point = [x + rnd.range(-0.35, 0.35) * spacing, y + rnd.range(-0.35, 0.35) * spacing];
      if (pointInPolygon(point, polygon)) centres.push({ point, angle: orientation(point) + rnd.range(-0.1, 0.1) });
    }
  }
  if (centres.length === 0) {
    const point = [xs.reduce((a, b) => a + b) / xs.length, ys.reduce((a, b) => a + b) / ys.length];
    centres.push({ point, angle: orientation(point) });
  }
  return centres;
}

function nearest(districts, point) {
  let best = null;
  let bestDistance = Infinity;
  for (const district of districts) {
    const distance = Math.hypot(point[0] - district.point[0], point[1] - district.point[1]);
    if (distance < bestDistance) {
      best = district;
      bestDistance = distance;
    }
  }
  return best;
}

/** Moves a point by (du, dv) in a frame rotated by `angle`. */
function offset([x, y], du, dv, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [x + du * c - dv * s, y + du * s + dv * c];
}

function planBlock(rnd, plan, { centre, angle, length, width, built, accept, polygon, height, churchChance }) {
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => offset(centre, (a * length) / 2, (b * width) / 2, angle));
  const onShore = corners.every((corner) => pointInPolygon(corner, polygon));
  if (!accept(centre) && !corners.some(accept)) return;

  let kind = built ? 'built' : rnd.pick(['garden', 'garden', 'orchard', 'field']);
  if (kind === 'built' && rnd.chance(churchChance) && accept(centre) && corners.every(accept)) kind = 'churchyard';
  if (onShore && accept(centre)) plan.plots.push({ point: centre, angle, length, width, kind });

  if (kind === 'churchyard') {
    // A neighbourhood church; Byzantine churches face east whatever the street grid does.
    plan.churches.push({ point: centre, angle: 0, size: Math.min(0.85, width * 0.75) });
    for (const side of [-1, 1]) {
      const point = offset(centre, side * length * 0.38, -width * 0.32, angle);
      plan.trees.push({ point, kind: 'cypress', size: rnd.range(0.4, 0.5) });
    }
  } else if (kind === 'built') {
    addPerimeterHouses(rnd, plan, { centre, angle, length, width, accept, height });
    for (let k = rnd.int(0, 2); k > 0; k--) {
      const point = offset(centre, rnd.range(-0.25, 0.25) * length, rnd.range(-0.15, 0.15) * width, angle);
      if (accept(point)) plan.trees.push({ point, kind: rnd.chance(0.3) ? 'cypress' : 'round', size: rnd.range(0.24, 0.34) });
    }
  } else if (kind === 'garden' && accept(centre)) {
    for (let k = rnd.int(3, 7); k > 0; k--) {
      const point = offset(centre, rnd.range(-0.42, 0.42) * length, rnd.range(-0.4, 0.4) * width, angle);
      if (accept(point)) plan.trees.push({ point, kind: rnd.chance(0.25) ? 'cypress' : 'round', size: rnd.range(0.26, 0.4) });
    }
  } else if (kind === 'orchard' && accept(centre)) {
    const spacing = 0.28;
    for (let u = -length / 2 + 0.2; u < length / 2 - 0.14; u += spacing) {
      for (let v = -width / 2 + 0.2; v < width / 2 - 0.14; v += spacing) {
        const point = offset(centre, u, v, angle);
        if (accept(point)) plan.trees.push({ point, kind: 'orchard', size: rnd.range(0.15, 0.19) });
      }
    }
  }
}

/** Houses side by side along all four edges of a block, facing outwards onto the streets. */
function addPerimeterHouses(rnd, plan, { centre, angle, length, width, accept, height }) {
  const depth = rnd.range(0.3, 0.38);
  const sides = [];
  for (const s of [-1, 1]) {
    // Long sides run the full length; short sides fit between them.
    sides.push({ start: offset(centre, -length / 2, (s * width) / 2, angle), along: 0, inward: [0, -s], span: length });
    sides.push({ start: offset(centre, (s * length) / 2, -width / 2 + depth, angle), along: Math.PI / 2, inward: [-s, 0], span: width - 2 * depth });
  }
  for (const { start, along, inward, span } of sides) {
    const direction = angle + along;
    let t = 0;
    while (t < span - 0.18) {
      const w = Math.min(rnd.range(0.32, 0.5), span - t);
      const centreAlong = offset(start, t + w / 2, 0, direction);
      const point = offset(centreAlong, (inward[0] * depth) / 2, (inward[1] * depth) / 2, angle);
      if (!rnd.chance(0.05) && accept(point)) {
        plan.houses.push({ point, angle: direction, w, d: depth, h: rnd.range(...height), flat: rnd.chance(0.3) });
      }
      t += w + 0.02;
    }
  }
}

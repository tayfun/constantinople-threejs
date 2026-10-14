import { pointInPolygon } from '../util/geo.js';
import { createRandom, hashString } from '../util/random.js';

/**
 * Lays out a town the way it grew: districts, each with a grid of blocks
 * aligned to the nearest main street or shore; houses line the block edges
 * facing the streets around a courtyard, some blocks are churchyards with a
 * neighbourhood church, a few are a great house round its court or a
 * market square, and some stay gardens, orchards or fields. Works in map units ([east, north]) and returns plain
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
 *   style              the houses' style (see houses.js); none for the ordinary Byzantine house
 *   mansionChance      chance that a built block is one great house round a court instead
 *   markets            points whose blocks become market squares
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
  style,
  mansionChance = 0,
  markets = [],
}) {
  const plan = { houses: [], trees: [], plots: [], churches: [] };
  // Great houses and markets draw on a stream of their own, leaving the layout's in its old order.
  const extras = createRandom(hashString(polygon[0].join()));
  const marketSites = [...markets]; // each is crossed off as its block is found
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
          style,
          extras,
          mansionChance,
          markets: marketSites,
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

function planBlock(rnd, plan, { centre, angle, length, width, built, accept, polygon, height, churchChance, style, extras, mansionChance, markets }) {
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => offset(centre, (a * length) / 2, (b * width) / 2, angle));
  const onShore = corners.every((corner) => pointInPolygon(corner, polygon));
  if (!accept(centre) && !corners.some(accept)) return;

  let kind = built ? 'built' : rnd.pick(['garden', 'garden', 'orchard', 'field']);
  if (kind === 'built' && rnd.chance(churchChance) && accept(centre) && corners.every(accept)) kind = 'churchyard';

  // A great house or a market takes over a whole built block. Its own random numbers decide it, and the
  // ordinary block is still planned into a scrap plan, so the town's random numbers keep their order.
  const whole = kind === 'built' && accept(centre) && corners.every(accept);
  // Each market site claims the first whole block found within reach of it.
  const site = whole ? markets.findIndex(([x, y]) => Math.hypot(x - centre[0], y - centre[1]) < MARKET_REACH) : -1;
  if (site >= 0) markets.splice(site, 1);
  const special = site >= 0 ? 'market' : whole && extras.chance(mansionChance) ? 'mansion' : null;
  if (onShore && accept(centre)) plan.plots.push({ point: centre, angle, length, width, kind: special ?? kind });
  if (special === 'mansion') addMansion(extras, plan, { centre, angle, length, width });
  if (special === 'market') addMarket(extras, plan, { centre, angle, length, width });
  if (special) plan = { houses: [], trees: [], plots: [], churches: [] };

  if (kind === 'churchyard') {
    // A neighbourhood church; Byzantine churches face east whatever the street grid does.
    plan.churches.push({ point: centre, angle: 0, size: Math.min(0.85, width * 0.75) });
    for (const side of [-1, 1]) {
      const point = offset(centre, side * length * 0.38, -width * 0.32, angle);
      plan.trees.push({ point, kind: 'cypress', size: rnd.range(0.4, 0.5) });
    }
  } else if (kind === 'built') {
    addPerimeterHouses(rnd, plan, { centre, angle, length, width, accept, height, style });
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
function addPerimeterHouses(rnd, plan, { centre, angle, length, width, accept, height, style }) {
  const depth = rnd.range(0.3, 0.38);
  const sides = [];
  for (const s of [-1, 1]) {
    // Long sides run the full length; short sides fit between them.
    sides.push({ start: offset(centre, -length / 2, (s * width) / 2, angle), along: 0, inward: [0, -s], span: length, turn: s > 0 });
    sides.push({ start: offset(centre, (s * length) / 2, -width / 2 + depth, angle), along: Math.PI / 2, inward: [-s, 0], span: width - 2 * depth, turn: s < 0 });
  }
  for (const { start, along, inward, span, turn } of sides) {
    const direction = angle + along;
    let t = 0;
    while (t < span - 0.18) {
      const w = Math.min(rnd.range(0.32, 0.5), span - t);
      const centreAlong = offset(start, t + w / 2, 0, direction);
      const point = offset(centreAlong, (inward[0] * depth) / 2, (inward[1] * depth) / 2, angle);
      if (!rnd.chance(0.05) && accept(point)) {
        // A house's front faces +z in its own frame; on two of the four sides that means turning it about.
        plan.houses.push({ point, angle: direction + (turn ? Math.PI : 0), w, d: depth, h: rnd.range(...height), style });
        rnd.next(); // once drew a flat roof for some houses; still drawn, so that the towns keep their layout
      }
      t += w + 0.02;
    }
  }
}

const MARKET_REACH = 1.2; // how far from its site a market's block may lie

/**
 * A great house filling the block (the 'mansion' house in houses.js): its
 * gate on one long side, a fountain, cypresses and a fruit tree in its court.
 * In the house's frame z runs across the block, its street front at +z,
 * which is -v in the block's frame.
 */
function addMansion(rnd, plan, { centre, angle, length, width }) {
  plan.houses.push({ point: centre, angle, w: length, d: width, h: rnd.range(0.27, 0.32), style: 'mansion' });
  const court = (x, z) => offset(centre, x * length, -z * width, angle);
  for (const side of [-1, 1]) plan.trees.push({ point: court(side * 0.2, -0.08), kind: 'cypress', size: rnd.range(0.36, 0.44) });
  plan.trees.push({ point: court(rnd.range(-0.15, 0.15), 0.3), kind: 'round', size: rnd.range(0.26, 0.32) });
}

/** A market: rows of stalls facing each other across the paved block, and a plane tree or two for shade. */
function addMarket(rnd, plan, { centre, angle, length, width }) {
  [-0.3, -0.02, 0.26].forEach((v, row) => {
    for (const u of [-0.36, -0.18, 0, 0.18, 0.36]) {
      if (rnd.chance(0.15)) continue;
      const point = offset(centre, (u + rnd.range(-0.02, 0.02)) * length, v * width, angle);
      // Alternate rows face each other across their aisle.
      plan.houses.push({ point, angle: angle + (row % 2 ? 0 : Math.PI), w: rnd.range(0.15, 0.19), d: 0.13, h: rnd.range(0.09, 0.11), style: 'stall' });
    }
  });
  for (const u of [-0.45, 0.45]) plan.trees.push({ point: offset(centre, u * length, 0.12 * width, angle), kind: 'round', size: rnd.range(0.34, 0.42) });
}

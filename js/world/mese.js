import { distanceToPolyline, samplePolyline } from '../util/geo.js';

/**
 * The porticoes of the Mese: shops behind a colonnade lining both sides of
 * the main street, as they did from the Milion to the fora of the west. Each
 * stretch is a 'portico' house (houses.js), set end to end along the street
 * with its colonnade facing it. Stretches are left out where they would
 * stand on a landmark, beyond the walls or across the street at a bend or a
 * junction. Returns the stretches as houses, and a test for whether a point
 * lies where they stand, so that the town's ordinary houses and trees can be
 * cleared from it.
 *
 * stretches: polylines of the street that have porticoes
 * streets: every street line, so that no stretch reaches across another
 * accept(point): whether a stretch may stand at a point
 */
export function planPorticoes({ stretches, streets, accept }) {
  const porticoes = [];
  for (const line of stretches) {
    for (const { point: [x, y], dir: [dx, dy] } of samplePolyline(line, LENGTH)) {
      for (const side of [-1, 1]) {
        const [nx, ny] = [-dy * side, dx * side];
        const point = [x + nx * OFFSET, y + ny * OFFSET];
        const ends = [-0.5, 0.5].map((t) => [point[0] + dx * LENGTH * t, point[1] + dy * LENGTH * t]);
        const clear = [point, ...ends].every(accept)
          && streets.every((street) => distanceToPolyline(point, street) > OFFSET - 0.02);
        if (!clear) continue;
        // The house's front (+z) faces the street: towards -n, so its +x runs along the street's direction times side.
        porticoes.push({ point, angle: Math.atan2(dy * side, dx * side), w: LENGTH, d: DEPTH, h: HEIGHT, style: 'portico' });
      }
    }
  }
  const occupied = (point, margin) => porticoes.some((portico) => Math.hypot(point[0] - portico.point[0], point[1] - portico.point[1]) < margin);
  return { porticoes, occupied };
}

const LENGTH = 0.32; // of one stretch along the street
const DEPTH = 0.3;
const HEIGHT = 0.2;
const OFFSET = 0.2 + DEPTH / 2; // from the street's middle to a stretch's: half the street, then half the stretch

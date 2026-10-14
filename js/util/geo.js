import * as THREE from 'three';

/**
 * 2D helpers for map coordinates given as [east, north] pairs.
 * World space: x = east, y = up, z = -north (three.js convention, north is -z).
 */

export function toWorld([east, north], y = 0) {
  return new THREE.Vector3(east, y, -north);
}

const boxes = new WeakMap();

/** [minX, minY, maxX, maxY] of a polygon, worked out once per polygon. */
function boundsOf(polygon) {
  let box = boxes.get(polygon);
  if (!box) {
    box = [Infinity, Infinity, -Infinity, -Infinity];
    for (const [x, y] of polygon) {
      box = [Math.min(box[0], x), Math.min(box[1], y), Math.max(box[2], x), Math.max(box[3], y)];
    }
    boxes.set(polygon, box);
  }
  return box;
}

export function pointInPolygon([x, y], polygon) {
  // The terrain asks this of a quarter of a million points, most of them far outside the polygon.
  const [minX, minY, maxX, maxY] = boundsOf(polygon);
  if (x < minX || x > maxX || y < minY || y > maxY) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Squared distance from (px, py) to the segment a–b. */
function distanceToSegmentSq(px, py, a, b) {
  const ax = a[0];
  const ay = a[1];
  const dx = b[0] - ax;
  const dy = b[1] - ay;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq));
  const ex = px - (ax + t * dx);
  const ey = py - (ay + t * dy);
  return ex * ex + ey * ey;
}

// Squared distances and plain indexing: the terrain measures a quarter of a million points against the coasts.
export function distanceToPolyline([px, py], line, closed = false) {
  let best = Infinity;
  const count = closed ? line.length : line.length - 1;
  for (let i = 0; i < count; i++) best = Math.min(best, distanceToSegmentSq(px, py, line[i], line[(i + 1) % line.length]));
  return Math.sqrt(best);
}

export function polylineLength(line) {
  let length = 0;
  for (let i = 1; i < line.length; i++) length += Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]);
  return length;
}

/** Points every `spacing` units along a polyline, with their unit direction. */
export function samplePolyline(line, spacing) {
  const samples = [];
  let travelled = 0;
  let nextAt = 0;
  for (let i = 1; i < line.length; i++) {
    const [ax, ay] = line[i - 1];
    const [bx, by] = line[i];
    const length = Math.hypot(bx - ax, by - ay);
    const dir = [(bx - ax) / length, (by - ay) / length];
    while (nextAt <= travelled + length) {
      const d = nextAt - travelled;
      samples.push({ point: [ax + dir[0] * d, ay + dir[1] * d], dir });
      nextAt += spacing;
    }
    travelled += length;
  }
  return samples;
}

/**
 * Shifts a polyline sideways; positive distance moves it to the left of travel. Each bend goes
 * to the mitre, where the two shifted segments meet, so every segment stays parallel to its
 * original at exactly `distance` (and things placed square to one offset line line up with
 * the others). The mitre is capped at twice the distance for hairpin turns.
 */
export function offsetPolyline(line, distance) {
  const normal = ([ax, ay], [bx, by]) => {
    const length = Math.hypot(bx - ax, by - ay) || 1;
    return [-(by - ay) / length, (bx - ax) / length];
  };
  return line.map((point, i) => {
    const before = i > 0 ? normal(line[i - 1], point) : null;
    const after = i < line.length - 1 ? normal(point, line[i + 1]) : null;
    const [a, b] = [before ?? after, after ?? before];
    if (!a) return [...point];
    const [mx, my] = [a[0] + b[0], a[1] + b[1]];
    const length = Math.hypot(mx, my);
    if (length < 1e-9) return [point[0] + a[0] * distance, point[1] + a[1] * distance];
    const reach = distance * Math.min(length / (mx * a[0] + my * a[1]), 2);
    return [point[0] + (mx / length) * reach, point[1] + (my / length) * reach];
  });
}

/** Area-weighted centre-ish point of a polygon (vertex average is fine for labels). */
export function polygonCentroid(polygon) {
  const sum = polygon.reduce((acc, [x, y]) => [acc[0] + x, acc[1] + y], [0, 0]);
  return [sum[0] / polygon.length, sum[1] / polygon.length];
}

/** Where segments p–q and a–b cross: [point, t along a–b], or null. */
function crossing([px, py], [qx, qy], [ax, ay], [bx, by]) {
  const [rx, ry, sx, sy] = [qx - px, qy - py, bx - ax, by - ay];
  const denominator = rx * sy - ry * sx;
  if (denominator === 0) return null;
  const u = ((ax - px) * ry - (ay - py) * rx) / denominator; // along a–b
  const v = ((ax - px) * sy - (ay - py) * sx) / denominator; // along p–q
  return u >= 0 && u <= 1 && v >= 0 && v <= 1 ? [[ax + u * sx, ay + u * sy], u] : null;
}

/**
 * A polygon with a notch cut into its outline: `notch` is a path [a, …, d]
 * whose first and last points lie outside the polygon, the rest inside, so
 * that its first and last legs each cross the outline once (a harbour cut
 * into the shore). The stretch of outline between the two crossings is
 * replaced by the notch; a notch that misses the polygon leaves it as it is.
 */
export function cutNotch(polygon, notch) {
  const n = polygon.length;
  const find = (p, q) => {
    for (let i = 0; i < n; i++) {
      const hit = crossing(p, q, polygon[i], polygon[(i + 1) % n]);
      if (hit) return { edge: i, point: hit[0], t: hit[1] };
    }
    return null;
  };
  const enter = find(notch[0], notch[1]);
  const leave = find(notch.at(-2), notch.at(-1));
  if (!enter || !leave) return polygon;
  // The outline from one crossing forward to the other, as points.
  const arc = (from, to) => {
    if (from.edge === to.edge && to.t >= from.t) return [from.point, to.point];
    const points = [from.point];
    for (let k = (from.edge + 1) % n; ; k = (k + 1) % n) {
      points.push(polygon[k]);
      if (k === to.edge) break;
    }
    return [...points, to.point];
  };
  const length = (points) => points.slice(1).reduce((sum, p, i) => sum + Math.hypot(p[0] - points[i][0], p[1] - points[i][1]), 0);
  const inside = notch.slice(1, -1);
  // Keep the longer way round; the shorter is the stretch of shore the notch replaces.
  const [forward, backward] = [arc(enter, leave), arc(leave, enter)];
  return length(backward) >= length(forward) ? [...backward, ...inside] : [...forward, ...inside.toReversed()];
}

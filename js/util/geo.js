import * as THREE from 'three';

/**
 * 2D helpers for map coordinates given as [east, north] pairs.
 * World space: x = east, y = up, z = -north (three.js convention, north is -z).
 */

export function toWorld([east, north], y = 0) {
  return new THREE.Vector3(east, y, -north);
}

export function pointInPolygon([x, y], polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function distanceToSegment([px, py], [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

export function distanceToPolyline(point, line, closed = false) {
  let best = Infinity;
  const count = closed ? line.length : line.length - 1;
  for (let i = 0; i < count; i++) best = Math.min(best, distanceToSegment(point, line[i], line[(i + 1) % line.length]));
  return best;
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

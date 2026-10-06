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

/** Shifts a polyline sideways; positive distance moves it to the left of travel. */
export function offsetPolyline(line, distance) {
  return line.map((point, i) => {
    const prev = line[Math.max(0, i - 1)];
    const next = line[Math.min(line.length - 1, i + 1)];
    const dx = next[0] - prev[0];
    const dy = next[1] - prev[1];
    const length = Math.hypot(dx, dy) || 1;
    return [point[0] - (dy / length) * distance, point[1] + (dx / length) * distance];
  });
}

/** Area-weighted centre-ish point of a polygon (vertex average is fine for labels). */
export function polygonCentroid(polygon) {
  const sum = polygon.reduce((acc, [x, y]) => [acc[0] + x, acc[1] + y], [0, 0]);
  return [sum[0] / polygon.length, sum[1] / polygon.length];
}

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { offsetPolyline, samplePolyline } from '../../util/geo.js';
import { boxGeometry, cylinderGeometry } from './primitives.js';

/**
 * Plain masonry for pieces built directly in map units (1 unit = 100 m),
 * where the metre-scaled textures would be magnified a hundredfold.
 */
export const mapStone = new THREE.MeshStandardMaterial({ color: 0xd8c7a2, roughness: 0.9 });

/**
 * A fortification line in map units along a polyline of [east, north]
 * points: curtain-wall segments plus towers at a regular spacing.
 * Returns a single merged geometry in world coordinates.
 *
 * ground: { heightAt } from ground.js; given, the wall climbs the slope in
 * short tilted pieces instead of running level at y.
 */
export function wallAlongGeometry(points, {
  height,
  thickness,
  y = 0,
  offset = 0,
  towerSpacing = 0,
  towerWidth = thickness * 2,
  towerHeight = height * 1.5,
  towerShape = 'square',
  ground = null,
}) {
  const line = offset ? offsetPolyline(points, offset) : points;
  const level = (point) => y + (ground ? ground.heightAt(point) : 0);
  const parts = [];

  for (let i = 1; i < line.length; i++) {
    const [ax, ay] = line[i - 1];
    const [bx, by] = line[i];
    const length = Math.hypot(bx - ax, by - ay);
    const pieces = ground ? Math.max(1, Math.ceil(length / 0.4)) : 1;
    for (let k = 0; k < pieces; k++) {
      const from = [ax + ((bx - ax) * k) / pieces, ay + ((by - ay) * k) / pieces];
      const to = [ax + ((bx - ax) * (k + 1)) / pieces, ay + ((by - ay) * (k + 1)) / pieces];
      const [ya, yb] = [level(from), level(to)];
      const segment = boxGeometry(length / pieces + thickness, height, thickness);
      segment.rotateZ(Math.atan2(yb - ya, length / pieces));
      segment.rotateY(Math.atan2(by - ay, bx - ax));
      segment.translate((from[0] + to[0]) / 2, (ya + yb) / 2, -(from[1] + to[1]) / 2);
      parts.push(segment);
    }
  }

  if (towerSpacing > 0) {
    for (const { point, dir } of samplePolyline(line, towerSpacing)) {
      const tower = towerShape === 'round'
        ? cylinderGeometry(towerWidth / 2, towerWidth / 2, towerHeight, 8)
        : boxGeometry(towerWidth, towerHeight, towerWidth);
      tower.rotateY(Math.atan2(dir[1], dir[0]));
      tower.translate(point[0], level(point), -point[1]);
      parts.push(tower);
    }
  }
  return mergeGeometries(parts);
}

/**
 * A level band of constant width along a polyline of [east, north] points (a moat, the stone
 * edging of its banks), mitred at the bends. The boxes of wallAlongGeometry overlap there, and
 * a wide band would show their corners poking out past its edges on the inside of each turn.
 * Returns a single geometry in world coordinates.
 */
export function bandAlongGeometry(points, { width, height, y = 0, offset = 0 }) {
  const left = offsetPolyline(points, offset + width / 2);
  const right = offsetPolyline(points, offset - width / 2);
  const corner = ([east, north], up) => [east, y + up, -north];
  const positions = [];
  // Each quad is wound counter-clockwise as seen from outside the band.
  const quad = (...corners) => positions.push(...[0, 1, 2, 0, 2, 3].flatMap((k) => corners[k]));
  for (let i = 1; i < points.length; i++) {
    const [l0, l1, r0, r1] = [left[i - 1], left[i], right[i - 1], right[i]];
    quad(corner(r0, height), corner(r1, height), corner(l1, height), corner(l0, height));
    quad(corner(l0, 0), corner(l1, 0), corner(r1, 0), corner(r0, 0));
    quad(corner(r0, 0), corner(r1, 0), corner(r1, height), corner(r0, height));
    quad(corner(l1, 0), corner(l0, 0), corner(l0, height), corner(l1, height));
  }
  const [l0, r0, l1, r1] = [left[0], right[0], left.at(-1), right.at(-1)];
  quad(corner(l0, 0), corner(r0, 0), corner(r0, height), corner(l0, height));
  quad(corner(r1, 0), corner(l1, 0), corner(l1, height), corner(r1, height));
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

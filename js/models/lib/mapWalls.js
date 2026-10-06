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
}) {
  const line = offset ? offsetPolyline(points, offset) : points;
  const parts = [];

  for (let i = 1; i < line.length; i++) {
    const [ax, ay] = line[i - 1];
    const [bx, by] = line[i];
    const segment = boxGeometry(Math.hypot(bx - ax, by - ay) + thickness, height, thickness);
    segment.rotateY(Math.atan2(by - ay, bx - ax));
    segment.translate((ax + bx) / 2, y, -(ay + by) / 2);
    parts.push(segment);
  }

  if (towerSpacing > 0) {
    for (const { point, dir } of samplePolyline(line, towerSpacing)) {
      const tower = towerShape === 'round'
        ? cylinderGeometry(towerWidth / 2, towerWidth / 2, towerHeight, 8)
        : boxGeometry(towerWidth, towerHeight, towerWidth);
      tower.rotateY(Math.atan2(dir[1], dir[0]));
      tower.translate(point[0], y, -point[1]);
      parts.push(tower);
    }
  }
  return mergeGeometries(parts);
}

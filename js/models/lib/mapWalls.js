import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { offsetPolyline, samplePolyline } from '../../util/geo.js';
import { createRandom } from '../../util/random.js';
import { boxGeometry, cylinderGeometry } from './primitives.js';

/**
 * Plain masonry for pieces built directly in map units (1 unit = 100 m),
 * where the metre-scaled textures would be magnified a hundredfold.
 */
export const mapStone = new THREE.MeshStandardMaterial({ color: 0xd8c7a2, roughness: 0.9 });

/**
 * Banded masonry for walls built in map units, matching the land walls on
 * the map: courses of pale limestone parted by bands of five brick courses,
 * two bands to every `tile` map units of height (the land walls' 0.1875 by
 * default). Map-unit geometry carries map-unit UVs (see primitives.js), so
 * the bands keep one rhythm on every wall and tower.
 */
export function mapMasonry(tile = 0.1875) {
  if (!masonry.has(tile)) {
    masonryCanvas ??= paintMasonry();
    const texture = new THREE.CanvasTexture(masonryCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1 / tile, 1 / tile);
    texture.anisotropy = 8;
    masonry.set(tile, new THREE.MeshStandardMaterial({ map: texture, roughness: 0.9 }));
  }
  return masonry.get(tile);
}
const masonry = new Map();
let masonryCanvas = null;

function paintMasonry() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const rnd = createRandom(1204);
  const vary = (c, amount) => {
    const k = 1 + (rnd.next() - 0.5) * amount;
    return `rgb(${(c[0] * k) | 0}, ${(c[1] * k) | 0}, ${(c[2] * k) | 0})`;
  };
  ctx.fillStyle = 'rgb(168, 160, 142)';
  ctx.fillRect(0, 0, size, size);
  const courses = (top, bottom, courseHeight, minLength, maxLength, mortar, colour, amount) => {
    for (let y = top; y < bottom; y += courseHeight) {
      const h = Math.min(courseHeight, bottom - y) - mortar;
      for (let x = -rnd.next() * maxLength; x < size;) {
        const length = minLength + rnd.next() * (maxLength - minLength);
        ctx.fillStyle = vary(colour, amount);
        // Drawn again across the seam, so the texture tiles.
        for (const shift of [0, size, -size]) ctx.fillRect(x + shift + mortar / 2, y + mortar / 2, length - mortar, h);
        x += length;
      }
    }
  };
  const half = size / 2;
  for (const top of [0, half]) {
    courses(top, top + 94, 31.3, 36, 70, 3, [208, 200, 182], 0.14);
    courses(top + 94, top + half, 6.8, 20, 30, 2.4, [158, 68, 46], 0.3);
  }
  for (let i = 0; i < 1800; i++) {
    ctx.fillStyle = `rgba(100, 85, 65, ${0.1 + rnd.next() * 0.12})`;
    const s = 0.6 + rnd.next() * 1.4;
    ctx.fillRect(rnd.next() * size, rnd.next() * size, s, s);
  }
  return canvas;
}

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
  const uvs = [];
  // Each quad is wound counter-clockwise as seen from outside the band. UVs are in map units:
  // along the line and up the sides, or along and across on the top and bottom.
  const quad = (corners, coords) => {
    for (const k of [0, 1, 2, 0, 2, 3]) {
      positions.push(...corners[k]);
      uvs.push(...coords[k]);
    }
  };
  let travelled = 0;
  for (let i = 1; i < points.length; i++) {
    const [l0, l1, r0, r1] = [left[i - 1], left[i], right[i - 1], right[i]];
    const [u0, u1] = [travelled, travelled + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1])];
    travelled = u1;
    quad([corner(r0, height), corner(r1, height), corner(l1, height), corner(l0, height)], [[u0, 0], [u1, 0], [u1, width], [u0, width]]);
    quad([corner(l0, 0), corner(l1, 0), corner(r1, 0), corner(r0, 0)], [[u0, width], [u1, width], [u1, 0], [u0, 0]]);
    quad([corner(r0, 0), corner(r1, 0), corner(r1, height), corner(r0, height)], [[u0, 0], [u1, 0], [u1, height], [u0, height]]);
    quad([corner(l1, 0), corner(l0, 0), corner(l0, height), corner(l1, height)], [[-u1, 0], [-u0, 0], [-u0, height], [-u1, height]]);
  }
  const [l0, r0, l1, r1] = [left[0], right[0], left.at(-1), right.at(-1)];
  const end = [[0, 0], [width, 0], [width, height], [0, height]];
  quad([corner(l0, 0), corner(r0, 0), corner(r0, height), corner(l0, height)], end);
  quad([corner(r1, 0), corner(l1, 0), corner(l1, height), corner(r1, height)], end);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * A sea wall in map units along a polyline of [east, north] points, set
 * `offset` to the left of travel (negative: to the right): a mitred curtain
 * with a crenellated parapet on its outer face (the left), and towers
 * projecting from it towards the water every `towerSpacing`, square and
 * octagonal in turn, each under a stone cap ringed with merlons. Where
 * `leaveOut([east, north])` is true (a landmark that brings its own walls to
 * the shore) the wall stops and starts again beyond it.
 *
 * Returns { masonry, caps }: two geometries in world coordinates, for the
 * banded masonry (mapMasonry) and the plain stone of the caps (mapStone).
 */
export function seaWallGeometry(points, {
  height,
  thickness,
  y = 0,
  offset = 0,
  towerSpacing,
  towerWidth,
  towerHeight,
  merlon = { pitch: 0.13, width: 0.065, height: 0.06, thickness: 0.04 },
  leaveOut = () => false,
}) {
  const line = offsetPolyline(points, offset);
  // The curtain runs in stretches, broken where it would cut through something with walls of its own.
  const masonryParts = runsOutside(line, leaveOut).map((run) => bandAlongGeometry(run, { width: thickness, height, y }));
  const capParts = [];
  const towers = samplePolyline(line, towerSpacing).filter(({ point }) => !leaveOut(point));
  const sink = 0.008; // merlons stand a little into what carries them, so no face lies flush on another
  const merlonBox = () => boxGeometry(merlon.width, merlon.height + sink, merlon.thickness);

  // The parapet: merlons along the outer edge of the wall-walk, left out where a tower stands.
  const parapet = offsetPolyline(points, offset + thickness / 2 - merlon.thickness / 2 - 0.004);
  for (const { point, dir } of samplePolyline(parapet, merlon.pitch)) {
    if (leaveOut(point)) continue;
    if (towers.some((tower) => Math.hypot(point[0] - tower.point[0], point[1] - tower.point[1]) < towerWidth * 0.75)) continue;
    masonryParts.push(merlonBox().rotateY(Math.atan2(dir[1], dir[0])).translate(point[0], y + height - sink, -point[1]));
  }

  towers.forEach(({ point, dir }, i) => {
    const angle = Math.atan2(dir[1], dir[0]);
    const octagon = i % 2 === 1;
    // Out towards the water: the left of travel.
    const out = octagon ? thickness * 0.55 : towerWidth / 2 - thickness / 2 + 0.03;
    const [cx, cz] = [point[0] - dir[1] * out, -(point[1] + dir[0] * out)];
    const place = (geometry, lift = 0) => geometry.rotateY(angle).translate(cx, y + lift, cz);
    const capHeight = 0.03;
    const top = towerHeight;
    if (octagon) {
      const radius = towerWidth * 0.62;
      // Each tower stops short under its cap.
      masonryParts.push(place(cylinderGeometry(radius, radius * 1.04, top - capHeight + 0.01, 8).rotateY(Math.PI / 8)));
      capParts.push(place(cylinderGeometry(radius + 0.025, radius + 0.025, capHeight, 8).rotateY(Math.PI / 8), top - capHeight));
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        const r = (radius + 0.025) * Math.cos(Math.PI / 8) - merlon.thickness / 2 - 0.004; // inside the cap's flat faces
        masonryParts.push(place(merlonBox().rotateY(Math.PI / 2 - a).translate(Math.cos(a) * r, 0, Math.sin(a) * r), top - sink));
      }
    } else {
      const half = towerWidth / 2;
      masonryParts.push(place(boxGeometry(towerWidth, top - capHeight + 0.01, towerWidth)));
      capParts.push(place(boxGeometry(towerWidth + 0.05, capHeight, towerWidth + 0.05), top - capHeight));
      // A merlon at each corner and one in the middle of each side.
      const edge = half + 0.025 - merlon.thickness / 2 - 0.004;
      for (let side = 0; side < 4; side++) {
        for (const t of [-1, 0]) {
          const along = t * (edge - merlon.width / 2);
          const turn = (side * Math.PI) / 2;
          const [x, z] = [Math.cos(turn) * edge - Math.sin(turn) * along, Math.sin(turn) * edge + Math.cos(turn) * along];
          masonryParts.push(place(merlonBox().rotateY(Math.PI / 2 - turn).translate(x, 0, z), top - sink));
        }
      }
    }
  });
  return { masonry: mergeGeometries(masonryParts.map((part) => (part.index ? part.toNonIndexed() : part))), caps: mergeGeometries(capParts) };
}

/** The stretches of a polyline outside the areas where `inside(point)` is true, cut to about a hundredth of a unit. */
function runsOutside(line, inside) {
  const runs = [];
  let run = [];
  let fixed = false; // whether the run's last point is an end or a bend, which must stay
  const close = () => {
    if (run.length > 1) runs.push(run);
    run = [];
  };
  for (let i = 1; i < line.length; i++) {
    const [ax, ay] = line[i - 1];
    const [bx, by] = line[i];
    const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 0.01));
    for (let k = i === 1 ? 0 : 1; k <= steps; k++) {
      const point = [ax + ((bx - ax) * k) / steps, ay + ((by - ay) * k) / steps];
      if (inside(point)) {
        close();
        continue;
      }
      // Points along a straight stretch only move its far end on; ends and bends are kept.
      const end = run.length === 0 || k === steps;
      if (end || fixed || run.length < 2) run.push(point);
      else run[run.length - 1] = point;
      fixed = end;
    }
  }
  close();
  return runs;
}

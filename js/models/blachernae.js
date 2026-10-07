import * as THREE from 'three';
import { materials as M, tinted } from './lib/materials.js';
import {
  archGeometry, archedWallGeometry, box, colonnade, crenelRingGeometry, crenellationGeometry, cylinder, cylinderGeometry, cypress, dome,
  faceToward, gableRoof, groundPlane, hipRoof, mesh, regularOpenings, judasTree, roundTree, windowRow,
} from './lib/primitives.js';
import { finalizeModel } from './lib/merge.js';
import { labelAt, labelled } from './lib/parts.js';
import { createRandom } from '../util/random.js';

/**
 * Blachernae, the north-west corner of the city where the Komnenian and
 * Palaiologan emperors lived from the late 11th century. The Golden Horn
 * lies to the north (-z), the land walls to the west (-x).
 *  - the palace halls stand on brick-faced terraces cut into the Sixth Hill,
 *    their loggias looking down over the Horn;
 *  - Manuel I's wall of great ashlar blocks, with round and octagonal towers,
 *    closes the quarter to the west; at its north end rise the twin towers
 *    of Isaac Angelos (a residential tower with a balcony) and Anemas (the
 *    imperial prison), fronted by a massive buttress;
 *  - the Palace of the Porphyrogenitus (Tekfur Sarayı, late 13th c.): three
 *    storeys, its courtyard façade a diaper of red brick and white stone
 *    over a four-arched arcade, with five windows above and seven on the
 *    top floor, which looks out on every side;
 *  - the walls of Heraclius and Leo along the Horn, with Theophilos' three
 *    hexagonal towers, sheltering the church of St Mary of Blachernae and
 *    the holy spring.
 *
 * Sources: Wikipedia, Blachernae Palace, Palace of the Porphyrogenitus,
 * Prison of Anemas, Walls of Constantinople (Blachernae section);
 * thebyzantinelegacy.com, Blachernai Palace; Byzantium 1200.
 */

const TERRACE = 14;
const LOWER_TERRACE = 7;
const WALL_X = -122;

export function createBlachernae({ lod = 'detail' } = {}) {
  const detail = lod === 'detail';
  const quarter = new THREE.Group();
  const masonry = wallMasonry();

  quarter.add(box(250, 3, 190, M.grass, 5, -3, 5));
  // Terraces: the upper one carries the palace, a lower garden terrace steps down towards the Horn.
  quarter.add(box(140, TERRACE, 110, masonry, -50, 0, 35));
  quarter.add(groundPlane(140, 110, M.grass, -50, TERRACE + 0.03, 35));
  quarter.add(groundPlane(70, 22, M.paving, -45, TERRACE + 0.05, -9)); // the court before the great hall
  quarter.add(box(130, LOWER_TERRACE, 16, masonry, -45, 0, -28));
  quarter.add(groundPlane(130, 16, M.paving, -45, LOWER_TERRACE + 0.03, -28));
  quarter.add(box(130, 0.5, 0.8, M.marble, -45, LOWER_TERRACE, -35.6)); // balustrade
  if (detail) {
    for (let i = 0; i < 20; i++) quarter.add(box(0.5, 1.2, 0.5, M.marble, -108 + i * 6.6, LOWER_TERRACE, -35.6));
    quarter.add(box(130, 0.3, 0.8, M.marble, -45, LOWER_TERRACE + 1.2, -35.6));
    // Stairs between the terraces, and from the garden down to the shore.
    quarter.add(box(10, TERRACE - LOWER_TERRACE, 6, M.stone, -45, LOWER_TERRACE, -23));
    quarter.add(box(8, LOWER_TERRACE, 6, M.stone, -45, 0, -39));
  }

  addWalls(quarter, detail, masonry);
  addPalace(quarter, detail, masonry);
  labelAt(quarter, 'blachernaePalace', -45, TERRACE + 22, 22);
  labelled(quarter, 'tekfurSaray', () => addTekfurSaray(quarter, detail, masonry));
  labelled(quarter, 'stMaryBlachernae', () => addChurch(quarter, detail));

  if (detail) {
    for (const [x, z] of [[-100, 86], [-20, 70], [2, 84], [-112, 30], [8, 10], [-60, 84]]) quarter.add(cypress(12, x, TERRACE, z));
    for (const [x, z] of [[-100, -28], [-80, -28], [-10, -28], [10, -28]]) quarter.add(cypress(9, x, LOWER_TERRACE, z));
    for (const [x, z] of [[60, 30], [100, 40]]) quarter.add(roundTree(9, x, 0, z));
    [[40, 20], [90, -10], [20, 50]].forEach(([x, z], i) => quarter.add(judasTree(8, x, 0, z, { seed: i + 1 }))); // erguvans in flower
    quarter.add(groundPlane(320, 70, M.water, 5, -0.4, -125));
  }
  return finalizeModel(quarter);
}

/** Manuel I's wall with its round and octagonal towers, the Anemas towers, and the walls along the Golden Horn. */
function addWalls(quarter, detail, masonry) {
  quarter.add(box(5, 22, 190, masonry, WALL_X, 0, 5));
  quarter.add(box(5.6, 0.5, 190, M.stone, WALL_X, 21.5, 5));
  if (detail) {
    for (const side of [-1, 1]) {
      const merlons = mesh(crenellationGeometry(190, { merlon: 1.4, gap: 0.8, height: 1.9, thickness: 0.9 }), masonry, WALL_X + side * 2, 22, 5);
      merlons.rotation.y = Math.PI / 2;
      quarter.add(merlons);
    }
  }
  for (const [i, z] of [-30, 6, 42, 78].entries()) {
    const sides = i % 2 ? 8 : detail ? 20 : 12;
    quarter.add(cylinder(6.2, 6.5, 28, masonry, WALL_X - 3, 0, z, sides));
    quarter.add(cylinder(6.8, 6.8, 0.5, M.stone, WALL_X - 3, 27.5, z, sides));
    quarter.add(mesh(crenelRingGeometry(6.2, { count: 16, merlon: 1.3, height: 1.9, thickness: 0.9 }), masonry, WALL_X - 3, 28, z));
    if (detail) {
      for (const angle of [-0.8, 0, 0.8]) {
        const slit = mesh(archGeometry(1.0, 2.2), M.opening, WALL_X - 3 - Math.cos(angle) * 6.43, 22, z + Math.sin(angle) * 6.43);
        slit.rotation.y = -Math.PI / 2 + angle;
        quarter.add(slit);
      }
    }
  }
  labelAt(quarter, 'manuelWall', WALL_X, 23, 24);
  // The square tower at the wall's southern end.
  quarter.add(box(12, 26, 12, masonry, WALL_X, 0, 96));
  quarter.add(squareBattlements(12, WALL_X, 26, 96, masonry));

  // The twin towers of Isaac Angelos (south) and Anemas (north), fronted by a great buttress.
  // Anemas's label sits halfway up its tower, so the two neighbours' labels stack rather than collide.
  labelAt(quarter, 'isaacTower', WALL_X + 2, 35, -56);
  labelAt(quarter, 'anemasTower', WALL_X + 2, 16, -70);
  for (const [z, height, residential] of [[-56, 34, true], [-70, 30, false]]) {
    quarter.add(box(14, height, 14, masonry, WALL_X + 2, 0, z));
    quarter.add(box(14.6, 0.5, 14.6, M.stone, WALL_X + 2, height - 0.5, z));
    quarter.add(squareBattlements(14, WALL_X + 2, height, z, masonry));
    if (residential) {
      quarter.add(box(2, 0.5, 9, M.marble, WALL_X - 6, height - 9, z)); // the balcony looking west
      quarter.add(box(0.4, 1.2, 9, M.marble, WALL_X - 6.8, height - 8.5, z));
      for (const dz of [-4.3, 4.3]) quarter.add(box(2, 1.2, 0.4, M.marble, WALL_X - 6, height - 8.5, z + dz));
    }
    if (!detail) continue;
    if (residential) {
      for (const dz of [-4, 0, 4]) {
        const window = mesh(archGeometry(2.2, 4.2), M.opening, WALL_X - 5.03, height - 8.5, z + dz);
        window.rotation.y = -Math.PI / 2;
        quarter.add(window);
      }
    } else {
      for (const dz of [-3.5, 3.5]) {
        const slit = mesh(archGeometry(0.9, 1.8), M.opening, WALL_X - 5.03, height - 8, z + dz);
        slit.rotation.y = -Math.PI / 2;
        quarter.add(slit);
      }
    }
  }
  const buttress = box(7, 9, 30, masonry, WALL_X - 8.5, 0, -63);
  quarter.add(buttress);
  quarter.add(box(3.5, 4, 30, masonry, WALL_X - 6.75, 9, -63)); // stepped top of the buttress

  // Along the Golden Horn: the walls of Heraclius and Leo, with Theophilos' hexagonal towers.
  quarter.add(box(250, 10, 4, masonry, 5, 0, -88));
  quarter.add(box(250.6, 0.4, 4.6, M.stone, 5, 9.6, -88));
  quarter.add(mesh(crenellationGeometry(250, { merlon: 1.2, gap: 0.8, height: 1.6, thickness: 0.8 }), masonry, 5, 10, -89.6));
  for (const x of [-85, -35, 15]) {
    quarter.add(cylinder(5.5, 5.5, 16, masonry, x, 0, -89, 6));
    quarter.add(mesh(crenelRingGeometry(5.2, { count: 12, merlon: 1.2, height: 1.6, thickness: 0.8 }), masonry, x, 16, -89));
  }
  for (const x of [65, 115]) {
    quarter.add(box(9, 15, 9, masonry, x, 0, -88));
    quarter.add(squareBattlements(9, x, 15, -88, masonry));
  }
  // A water gate opening on the Horn below the church.
  quarter.add(mesh(archGeometry(4, 6), M.opening, 40, 0, -85.97));
}

/** The Komnenian palace: Manuel's great hall with its loggia over the Horn, the keep, a domed chapel and a wing. */
function addPalace(quarter, detail, masonry) {
  const y = TERRACE;
  const walls = tinted('plaster', 0xe6d6bc); // plastered brick halls, marble-banded
  quarter.add(box(50, 18, 30, walls, -45, y, 22));
  quarter.add(box(50.8, 0.6, 30.8, M.marble, -45, y + 8.5, 22)); // string course between the storeys
  quarter.add(hipRoof(50, 30, 7, M.roof, -45, y + 18, 22));
  quarter.add(box(13, 32, 13, masonry, -78, y, 4));
  quarter.add(squareBattlements(13, -78, y + 32, 4, masonry));
  quarter.add(box(34, 13, 20, walls, -6, y, 54));
  quarter.add(box(34.8, 0.6, 20.8, M.marble, -6, y + 6, 54));
  quarter.add(hipRoof(34, 20, 5, M.roof, -6, y + 13, 54));

  // The palace chapel: a domed cross-in-square beside the hall.
  quarter.add(box(16, 12, 16, M.brick, -8, y, 20));
  quarter.add(box(16.6, 0.5, 16.6, M.lead, -8, y + 12, 20));
  const segments = detail ? 24 : 12;
  quarter.add(cylinder(4, 4, 4, M.brick, -8, y + 12, 20, 12));
  quarter.add(dome(4, M.lead, -8, y + 16, 20, { heightScale: 0.8, segments }));
  quarter.add(faceToward(cylinder(3, 3, 9, M.brick, -8, y, 10, 10, { thetaStart: -Math.PI / 2, thetaLength: Math.PI }), 0, -1));
  quarter.add(faceToward(dome(3, M.lead, -8, y + 9, 10, { phiLength: Math.PI, heightScale: 0.7, segments }), 0, -1));

  // Loggia facing the Horn.
  const loggia = mesh(archedWallGeometry({
    length: 50, height: 11, thickness: 1.2, openings: regularOpenings(50, 7, { width: 4.4, bottom: 0, spring: 6.5 }), curveSegments: detail ? 10 : 4,
  }), M.marble);
  loggia.position.set(-45, y, 2.5);
  quarter.add(loggia);
  quarter.add(box(50, 0.6, 6, M.lead, -45, y + 11, 4.5));
  quarter.add(box(50, 1, 0.5, M.marble, -45, y + 11.6, 2.5));
  // A marble colonnade along the garden terrace below: full columns in the diorama, six-sided shafts on the map.
  const walk = detail ? colonnade({ length: 100, count: 18, height: 6, radius: 0.4 }) : plainColonnade(100, 18, 6, 0.4);
  walk.position.set(-45, LOWER_TERRACE, -30);
  quarter.add(walk);
  quarter.add(box(102, 0.5, 4, M.lead, -45, LOWER_TERRACE + 6, -29));
  if (detail) {
    const upper = windowRow({ count: 9, spacing: 5.2, width: 2.2, height: 4, y: 12 });
    upper.position.set(-45, y, 7.05);
    quarter.add(upper);
    const windows = windowRow({ count: 8, spacing: 5.5, width: 2, height: 3.4, y: 12 });
    windows.position.set(-45, y, 37.05);
    quarter.add(windows);
    const wing = windowRow({ count: 6, spacing: 5, width: 1.8, height: 3, y: 7.5 });
    wing.position.set(-6, y, 64.05);
    quarter.add(wing);
  }
}

/** Shafts only, for a colonnade seen from the map. */
function plainColonnade(length, count, height, radius) {
  const group = new THREE.Group();
  const shaft = cylinderGeometry(radius * 0.85, radius, height, 6, { open: true });
  const step = length / (count - 1);
  for (let i = 0; i < count; i++) group.add(mesh(shaft, M.marble, -length / 2 + step * i, 0, 0));
  return group;
}

function squareBattlements(size, x, y, z, material) {
  const cap = new THREE.Group();
  const options = { merlon: 1.2, gap: 0.8, height: 1.9, thickness: 0.9 };
  for (const side of [-1, 1]) {
    cap.add(mesh(crenellationGeometry(size, options), material, x, y, z + side * (size / 2 - 0.45)));
    const flank = mesh(crenellationGeometry(size - 1.8, options), material, x + side * (size / 2 - 0.45), y, z);
    flank.rotation.y = Math.PI / 2;
    cap.add(flank);
  }
  return cap;
}

/** Tekfur Sarayı: three storeys of patterned brick and stone over a four-arched arcade, late 13th century. */
function addTekfurSaray(quarter, detail, masonry) {
  const [x, z] = [-98, 70];
  const y = TERRACE;
  const [length, depth, height] = [30, 13, 20];
  const front = z + depth / 2;
  quarter.add(box(length, height, depth, masonry, x, y, z));
  quarter.add(box(length + 0.8, 0.5, depth + 0.8, M.marble, x, y + 19.5, z)); // cornice
  quarter.add(gableRoof(length, depth, 3.6, M.roof, x, y + height, z, 0.4));
  // The courtyard façade: diaper brickwork pierced by the arcade and its two rows of windows.
  const facade = mesh(archedWallGeometry({
    length,
    height,
    thickness: 1,
    openings: [
      ...regularOpenings(length, 4, { width: 6, bottom: 0, spring: 4.6, margin: 1.5 }),
      ...regularOpenings(length, 5, { width: 2.4, bottom: 8.2, spring: 10.8, margin: 1.5 }),
      ...regularOpenings(length, 7, { width: 1.9, bottom: 14.2, spring: 16.6, margin: 1.2 }),
    ],
    curveSegments: detail ? 10 : 4,
  }), diaperMaterial());
  facade.position.set(x, y, front - 0.5);
  quarter.add(facade);
  // Marble columns carrying the arcade, and marble sills under the windows.
  for (let i = 1; i < 4; i++) quarter.add(cylinder(0.5, 0.55, 4.6, M.marble, x - 13.5 + i * 6.75, y, front - 0.4, detail ? 10 : 6));
  quarter.add(box(length, 0.4, 1.4, M.marble, x, y + 7.8, front - 0.5));
  quarter.add(box(length, 0.4, 1.4, M.marble, x, y + 13.8, front - 0.5));
  // The courtyard walls to the south (paved in the diorama).
  quarter.add(box(length + 2, 5, 1.2, masonry, x, y, front + 22));
  for (const side of [-1, 1]) quarter.add(box(1.2, 5, 22, masonry, x + side * (length / 2 + 0.4), y, front + 11));
  if (detail) {
    // The top floor has windows on every side; a balcony looks east over the city.
    const north = windowRow({ count: 7, spacing: 4, width: 1.9, height: 4.3, y: 14.2 });
    north.position.set(x, y, z - depth / 2 - 0.03);
    north.rotation.y = Math.PI;
    quarter.add(north);
    for (const side of [-1, 1]) {
      const end = windowRow({ count: 3, spacing: 3.6, width: 1.9, height: 4.3, y: 14.2 });
      end.position.set(x + side * (length / 2 + 0.03), y, z);
      end.rotation.y = side * Math.PI / 2;
      quarter.add(end);
    }
    quarter.add(box(2.4, 0.5, 8, M.marble, x + length / 2 + 1.2, y + 13.7, z));
    quarter.add(box(0.4, 1.1, 8, M.marble, x + length / 2 + 2.2, y + 14.2, z));
    quarter.add(groundPlane(length, 22, M.paving, x, y + 0.05, front + 11));
  }
}

/** St Mary of Blachernae, guardian of the Virgin's robe, with the round Holy Soros chapel and the holy spring. */
function addChurch(quarter, detail) {
  const [x, z] = [52, -46];
  quarter.add(box(40, 10, 26, M.brick, x, 0, z));
  quarter.add(box(40, 16, 13, M.brick, x, 0, z));
  quarter.add(gableRoof(40, 13, 4, M.roof, x, 16, z));
  quarter.add(box(40.6, 0.5, 26.6, M.lead, x, 10, z));
  const segments = detail ? 24 : 12;
  quarter.add(cylinder(4.5, 4.5, 3.5, M.brick, x, 18.5, z, 16));
  quarter.add(dome(4.5, M.lead, x, 22, z, { heightScale: 0.7, segments }));
  quarter.add(faceToward(cylinder(6, 6, 13, M.brick, x + 20, 0, z, 14, { thetaStart: -Math.PI / 2, thetaLength: Math.PI }), 1, 0));
  quarter.add(faceToward(dome(6, M.lead, x + 20, 13, z, { phiLength: Math.PI, heightScale: 0.8, segments }), 1, 0));
  // The narthex, arcaded, at the west end.
  const narthex = mesh(archedWallGeometry({
    length: 26, height: 8, thickness: 6, openings: regularOpenings(26, 5, { width: 3, bottom: 0, spring: 4.5 }), curveSegments: detail ? 10 : 4,
  }), M.brick);
  narthex.rotation.y = Math.PI / 2;
  narthex.position.set(x - 23, 0, z);
  quarter.add(narthex);
  quarter.add(box(6.6, 0.5, 26.6, M.lead, x - 23, 8, z));

  // The round chapel of the Holy Soros, which held the Virgin's robe.
  quarter.add(cylinder(7.5, 7.5, 11, M.brick, x - 36, 0, z + 14, 16));
  quarter.add(dome(7.5, M.lead, x - 36, 11, z + 14, { heightScale: 0.65, segments }));

  // The holy spring (hagiasma) under its own small dome.
  quarter.add(box(7, 4, 7, M.marble, x + 8, 0, z + 24));
  quarter.add(dome(3.4, M.lead, x + 8, 4, z + 24, { segments }));
  if (detail) {
    for (const side of [-1, 1]) {
      const windows = windowRow({ count: 7, spacing: 5, width: 1.5, height: 2.8, y: 11.5 });
      windows.position.set(x, 0, z + side * 6.55);
      windows.rotation.y = side > 0 ? 0 : Math.PI;
      quarter.add(windows);
    }
  }
}

// ---------- local textures ----------

const textureCache = new Map();

function canvasMaterial(name, tile, paint, params = {}) {
  if (textureCache.has(name)) return textureCache.get(name);
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  paint(ctx, size, createRandom(name.length * 1081));
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1 / tile, 1 / tile);
  texture.anisotropy = 8;
  const material = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.9, metalness: 0, ...params });
  textureCache.set(name, material);
  return material;
}

const vary = (rnd, c, amount) => {
  const k = 1 + (rnd.next() - 0.5) * amount;
  return `rgb(${(c[0] * k) | 0}, ${(c[1] * k) | 0}, ${(c[2] * k) | 0})`;
};

function courses(ctx, size, rnd, top, bottom, courseHeight, minLength, maxLength, mortar, colour, amount) {
  for (let y = top; y < bottom; y += courseHeight) {
    const h = Math.min(courseHeight, bottom - y) - mortar;
    let x = -rnd.next() * maxLength;
    while (x < size) {
      const length = minLength + rnd.next() * (maxLength - minLength);
      ctx.fillStyle = vary(rnd, colour, amount);
      ctx.fillRect(x + mortar / 2, y + mortar / 2, length - mortar, h);
      if (x < 0) ctx.fillRect(x + size + mortar / 2, y + mortar / 2, length - mortar, h);
      if (x + length > size) ctx.fillRect(x - size + mortar / 2, y + mortar / 2, length - mortar, h);
      x += length;
    }
  }
}

/** Limestone ashlar with bands of five brick courses every 1.5 m, as on the land walls. */
function wallMasonry() {
  return canvasMaterial('blachernae-masonry', 3, (ctx, size, rnd) => {
    ctx.fillStyle = 'rgb(168, 160, 142)';
    ctx.fillRect(0, 0, size, size);
    const half = size / 2;
    for (const top of [0, half]) {
      courses(ctx, size, rnd, top, top + 94, 31.3, 36, 70, 3, [208, 200, 182], 0.14);
      courses(ctx, size, rnd, top + 94, top + half, 6.8, 20, 30, 2.4, [158, 68, 46], 0.3);
    }
    for (let i = 0; i < 1800; i++) {
      ctx.fillStyle = `rgba(100, 85, 65, ${0.1 + rnd.next() * 0.12})`;
      const s = 0.6 + rnd.next() * 1.4;
      ctx.fillRect(rnd.next() * size, rnd.next() * size, s, s);
    }
  });
}

/**
 * The façade of Tekfur Sarayı: white stone and red brick laid in bands of
 * geometric diaper — lozenges, chevrons and stripes — the showpiece of
 * Palaiologan decorative brickwork. Tiles every 2 m.
 */
function diaperMaterial() {
  return canvasMaterial('tekfur-diaper', 2, (ctx, size, rnd) => {
    const brick = [160, 66, 44];
    const stone = [228, 220, 202];
    ctx.fillStyle = vary(rnd, stone, 0);
    ctx.fillRect(0, 0, size, size);
    // Stripes of brick courses top and bottom of the tile.
    for (const top of [0, size - 28]) {
      for (let y = top; y < top + 28; y += 7) {
        for (let x = -8; x < size; x += 24) {
          ctx.fillStyle = vary(rnd, brick, 0.25);
          ctx.fillRect(x + 1 + (y % 14 ? 12 : 0), y + 1, 22, 5);
        }
      }
    }
    // A row of brick lozenges with stone centres.
    const cell = 64;
    ctx.lineWidth = 6;
    for (let x = 0; x <= size; x += cell) {
      ctx.strokeStyle = vary(rnd, brick, 0.2);
      ctx.beginPath();
      ctx.moveTo(x, 96);
      ctx.lineTo(x + cell / 2, 46);
      ctx.lineTo(x + cell, 96);
      ctx.lineTo(x + cell / 2, 146);
      ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = vary(rnd, brick, 0.2);
      ctx.fillRect(x + cell / 2 - 5, 91, 10, 10);
    }
    // A chevron band below.
    ctx.lineWidth = 7;
    for (let x = 0; x <= size; x += 32) {
      ctx.strokeStyle = vary(rnd, brick, 0.2);
      ctx.beginPath();
      ctx.moveTo(x, 190);
      ctx.lineTo(x + 16, 162);
      ctx.lineTo(x + 32, 190);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, 212);
      ctx.lineTo(x + 16, 184);
      ctx.lineTo(x + 32, 212);
      ctx.stroke();
    }
    // Mortar joints over the stone.
    ctx.fillStyle = 'rgba(150, 140, 125, 0.35)';
    for (let y = 0; y < size; y += 24) ctx.fillRect(0, y, size, 1.5);
    for (let i = 0; i < 1200; i++) {
      ctx.fillStyle = `rgba(110, 95, 80, ${0.08 + rnd.next() * 0.1})`;
      ctx.fillRect(rnd.next() * size, rnd.next() * size, 1.5, 1.5);
    }
  }, { roughness: 0.85 });
}

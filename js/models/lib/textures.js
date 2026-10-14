import * as THREE from 'three';
import { createRandom, hashString } from '../../util/random.js';
import { QUALITY } from '../../util/quality.js';

/**
 * Procedurally painted canvas textures.
 *
 * Every tiling texture covers `tile` metres. All model geometry carries
 * metre-based UVs (see primitives.js), so `repeat = 1 / tile` gives each
 * surface a consistent real-world scale without per-mesh tweaking.
 */

function paintTexture(name, { width = 256, height = width, tile = null }, paint) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  paint(ctx, width, height, createRandom(hashString(name)));

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  if (tile) {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1 / tile, 1 / tile);
  }
  return texture;
}

// ---------- painting helpers ----------

const rgb = ([r, g, b], alpha = 1) => `rgba(${r | 0}, ${g | 0}, ${b | 0}, ${alpha})`;

function vary(rnd, color, amount, alpha = 1) {
  const k = 1 + (rnd.next() - 0.5) * amount;
  return rgb(color.map((c) => Math.min(255, c * k)), alpha);
}

function fill(ctx, w, h, color) {
  ctx.fillStyle = rgb(color);
  ctx.fillRect(0, 0, w, h);
}

function speckle(ctx, w, h, rnd, { count, color, amount = 0.3, size = 2, alpha = 1 }) {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = vary(rnd, color, amount, alpha);
    const s = 0.6 + rnd.next() * size;
    ctx.fillRect(rnd.next() * w, rnd.next() * h, s, s);
  }
}

function blotches(ctx, w, h, rnd, { count, color, radius, alpha }) {
  for (let i = 0; i < count; i++) {
    const x = rnd.next() * w;
    const y = rnd.next() * h;
    const r = radius * (0.5 + rnd.next());
    for (const [ox, oy] of [[0, 0], [-w, 0], [w, 0], [0, -h], [0, h]]) {
      const gradient = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
      gradient.addColorStop(0, vary(rnd, color, 0.2, alpha));
      gradient.addColorStop(1, rgb(color, 0));
      ctx.fillStyle = gradient;
      ctx.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
    }
  }
}

/** Draws a rectangle, repeating it across the horizontal seam so the texture tiles. */
function wrapRect(ctx, x, y, w, h, size) {
  ctx.fillRect(x, y, w, h);
  if (x < 0) ctx.fillRect(x + size, y, w, h);
  if (x + w > size) ctx.fillRect(x - size, y, w, h);
}

/** Running-bond courses of blocks (stone or brick) between two heights. */
function courses(ctx, size, rnd, { top, bottom, courseHeight, minLength, maxLength, mortar, color, amount }) {
  for (let y = top; y < bottom; y += courseHeight) {
    const h = Math.min(courseHeight, bottom - y) - mortar;
    let x = -rnd.next() * maxLength;
    while (x < size) {
      const length = minLength + rnd.next() * (maxLength - minLength);
      ctx.fillStyle = vary(rnd, color, amount);
      wrapRect(ctx, x + mortar / 2, y + mortar / 2, length - mortar, h, size);
      x += length;
    }
  }
}

// ---------- building surfaces ----------

/**
 * Byzantine banded masonry: pale limestone courses with a band of red brick.
 * Seen from the map the textures blur to their average colour, so the stone
 * is kept cooler and the brick deeper than the sandy ground and the cream
 * houses, and the landmarks read as masonry rather than melting into the town.
 */
export const bandedMasonry = () =>
  paintTexture('banded', { tile: 6 }, (ctx, w, h, rnd) => {
    fill(ctx, w, h, [176, 170, 152]);
    courses(ctx, w, rnd, { top: 0, bottom: 176, courseHeight: 22, minLength: 34, maxLength: 72, mortar: 3, color: [206, 200, 182], amount: 0.14 });
    courses(ctx, w, rnd, { top: 176, bottom: 256, courseHeight: 10, minLength: 22, maxLength: 30, mortar: 3.5, color: [158, 66, 44], amount: 0.3 });
    speckle(ctx, w, h, rnd, { count: 2500, color: [110, 90, 70], amount: 0.4, size: 1.4, alpha: 0.18 });
  });

export const ashlar = () =>
  paintTexture('ashlar', { tile: 4 }, (ctx, w, h, rnd) => {
    // Küfeki limestone: creamy grey, cooler than the earth of the streets.
    fill(ctx, w, h, [166, 162, 150]);
    courses(ctx, w, rnd, { top: 0, bottom: h, courseHeight: 32, minLength: 40, maxLength: 96, mortar: 3, color: [198, 194, 180], amount: 0.13 });
    speckle(ctx, w, h, rnd, { count: 3000, color: [120, 105, 85], amount: 0.4, size: 1.5, alpha: 0.2 });
  });

/**
 * Rough-cut rubble: irregular stones of warm grey and brown, set in rough
 * courses in pale mortar, like the shaft of the Galata Tower.
 */
export const rubble = () =>
  paintTexture('rubble', { tile: 3 }, (ctx, w, h, rnd) => {
    fill(ctx, w, h, [164, 152, 134]);
    for (let y = 8; y < h + 16; y += 15 + rnd.next() * 5) {
      let x = rnd.next() * 20;
      while (x < w + 20) {
        const rx = 8 + rnd.next() * 12;
        const ry = 5 + rnd.next() * 4;
        const sy = y + (rnd.next() - 0.5) * 3;
        const tilt = (rnd.next() - 0.5) * 0.4;
        ctx.fillStyle = vary(rnd, rnd.chance(0.5) ? [156, 132, 108] : [140, 128, 114], 0.35);
        // Each stone is drawn again across the seams, so the texture tiles.
        for (const [ox, oy] of [[0, 0], [-w, 0], [w, 0], [0, -h], [0, h]]) {
          ctx.beginPath();
          ctx.ellipse(x + ox, sy + oy, rx, ry, tilt, 0, Math.PI * 2);
          ctx.fill();
        }
        x += rx * 2 + 2 + rnd.next() * 3;
      }
    }
    speckle(ctx, w, h, rnd, { count: 3500, color: [96, 82, 66], amount: 0.4, size: 1.5, alpha: 0.22 });
  });

/** Byzantine brickwork: thin bricks in thick beds of rosy, brick-dust mortar. */
export const brick = () =>
  paintTexture('brick', { tile: 2 }, (ctx, w, h, rnd) => {
    fill(ctx, w, h, [196, 158, 132]);
    courses(ctx, w, rnd, { top: 0, bottom: h, courseHeight: 12.8, minLength: 38, maxLength: 48, mortar: 4, color: [160, 70, 46], amount: 0.3 });
  });

export const plaster = () =>
  paintTexture('plaster', { tile: 8 }, (ctx, w, h, rnd) => {
    fill(ctx, w, h, [232, 214, 182]);
    blotches(ctx, w, h, rnd, { count: 40, color: [205, 180, 140], radius: 40, alpha: 0.35 });
    blotches(ctx, w, h, rnd, { count: 30, color: [245, 232, 205], radius: 30, alpha: 0.4 });
    speckle(ctx, w, h, rnd, { count: 1500, color: [150, 125, 95], size: 1.2, alpha: 0.2 });
  });

export const marble = () =>
  paintTexture('marble', { tile: 3 }, (ctx, w, h, rnd) => {
    fill(ctx, w, h, [246, 243, 236]);
    blotches(ctx, w, h, rnd, { count: 20, color: [228, 224, 216], radius: 50, alpha: 0.5 });
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 16; i++) {
      ctx.strokeStyle = `rgba(120, 112, 104, ${0.08 + rnd.next() * 0.14})`;
      ctx.beginPath();
      const y = rnd.next() * h;
      ctx.moveTo(-10, y);
      ctx.bezierCurveTo(w * 0.3, y + rnd.range(-60, 60), w * 0.6, y + rnd.range(-60, 60), w + 10, y + rnd.range(-20, 20));
      ctx.stroke();
    }
  });

export const granite = () =>
  paintTexture('granite', { tile: 2 }, (ctx, w, h, rnd) => {
    fill(ctx, w, h, [178, 120, 106]);
    speckle(ctx, w, h, rnd, { count: 5000, color: [70, 45, 45], size: 2, alpha: 0.5 });
    speckle(ctx, w, h, rnd, { count: 4000, color: [235, 215, 205], size: 1.8, alpha: 0.5 });
  });

export const roofTiles = () =>
  paintTexture('roof', { tile: 2 }, (ctx, w, h, rnd) => {
    fill(ctx, w, h, [110, 50, 32]);
    const size = 16;
    for (let row = 0; row < h / size; row++) {
      const offset = row % 2 ? size / 2 : 0;
      for (let x = -size; x < w + size; x += size) {
        const base = [184 + rnd.range(-20, 20), 92 + rnd.range(-15, 15), 58 + rnd.range(-10, 10)];
        const gradient = ctx.createLinearGradient(x + offset, 0, x + offset + size, 0);
        gradient.addColorStop(0, rgb(base.map((c) => c * 0.62)));
        gradient.addColorStop(0.5, rgb(base));
        gradient.addColorStop(1, rgb(base.map((c) => c * 0.62)));
        ctx.fillStyle = gradient;
        ctx.fillRect(x + offset, row * size, size - 1, size - 2);
      }
    }
  });

export const lead = () =>
  paintTexture('lead', { tile: 4 }, (ctx, w, h, rnd) => {
    fill(ctx, w, h, [140, 148, 152]);
    blotches(ctx, w, h, rnd, { count: 30, color: [120, 130, 132], radius: 40, alpha: 0.4 });
    for (let x = 0; x < w; x += 32) {
      ctx.fillStyle = 'rgba(60, 66, 70, 0.55)';
      ctx.fillRect(x, 0, 2, h);
      ctx.fillStyle = 'rgba(210, 215, 218, 0.35)';
      ctx.fillRect(x + 2, 0, 1, h);
      const offset = (x / 32) % 2 ? 32 : 0;
      for (let y = offset; y < h; y += 64) {
        ctx.fillStyle = 'rgba(70, 76, 80, 0.4)';
        ctx.fillRect(x, y, 32, 1.5);
      }
    }
  });

export const bronzePlates = () =>
  paintTexture('bronzePlates', { tile: 3 }, (ctx, w, h, rnd) => {
    fill(ctx, w, h, [120, 84, 40]);
    const size = 64;
    for (let y = 0; y < h; y += size) {
      for (let x = 0; x < w; x += size) {
        ctx.fillStyle = vary(rnd, [214, 168, 80], 0.25);
        ctx.fillRect(x + 2, y + 2, size - 4, size - 4);
        ctx.fillStyle = 'rgba(255, 236, 170, 0.35)';
        ctx.fillRect(x + 6, y + 6, size - 20, 3);
        ctx.fillStyle = 'rgba(70, 45, 20, 0.8)';
        for (const [rx, ry] of [[8, 8], [size - 10, 8], [8, size - 10], [size - 10, size - 10]]) ctx.fillRect(x + rx, y + ry, 3, 3);
      }
    }
  });

export const wood = () =>
  paintTexture('wood', { tile: 2 }, (ctx, w, h, rnd) => {
    fill(ctx, w, h, [92, 62, 38]);
    for (let y = 0; y < h; y += 16) {
      ctx.fillStyle = vary(rnd, [132, 92, 58], 0.25);
      ctx.fillRect(0, y + 1, w, 14);
      ctx.strokeStyle = 'rgba(70, 45, 25, 0.35)';
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        const gy = y + 3 + rnd.next() * 10;
        ctx.moveTo(0, gy);
        ctx.bezierCurveTo(w * 0.3, gy + rnd.range(-2, 2), w * 0.7, gy + rnd.range(-2, 2), w, gy);
        ctx.stroke();
      }
    }
  });

export const sailcloth = () =>
  paintTexture('sail', { tile: 4 }, (ctx, w, h, rnd) => {
    fill(ctx, w, h, [238, 226, 198]);
    blotches(ctx, w, h, rnd, { count: 20, color: [220, 204, 170], radius: 40, alpha: 0.4 });
    for (let x = 0; x < w; x += 32) {
      ctx.fillStyle = 'rgba(160, 140, 110, 0.4)';
      ctx.fillRect(x, 0, 1.5, h);
    }
  });

// ---------- ground surfaces ----------

export const grass = () =>
  paintTexture('grass', { tile: 6 }, (ctx, w, h, rnd) => {
    fill(ctx, w, h, [112, 132, 72]);
    blotches(ctx, w, h, rnd, { count: 50, color: [88, 112, 58], radius: 30, alpha: 0.45 });
    blotches(ctx, w, h, rnd, { count: 40, color: [150, 160, 90], radius: 26, alpha: 0.35 });
    speckle(ctx, w, h, rnd, { count: 5000, color: [80, 100, 50], size: 1.6, alpha: 0.35 });
  });

export const sand = () =>
  paintTexture('sand', { tile: 4 }, (ctx, w, h, rnd) => {
    fill(ctx, w, h, [216, 192, 145]);
    blotches(ctx, w, h, rnd, { count: 30, color: [200, 172, 125], radius: 30, alpha: 0.4 });
    speckle(ctx, w, h, rnd, { count: 4000, color: [170, 145, 105], size: 1.3, alpha: 0.4 });
  });

export const dirt = () =>
  paintTexture('dirt', { tile: 4 }, (ctx, w, h, rnd) => {
    fill(ctx, w, h, [150, 122, 90]);
    blotches(ctx, w, h, rnd, { count: 40, color: [120, 98, 72], radius: 30, alpha: 0.4 });
    speckle(ctx, w, h, rnd, { count: 4000, color: [90, 75, 60], size: 2, alpha: 0.4 });
  });

export const paving = () =>
  paintTexture('paving', { tile: 3 }, (ctx, w, h, rnd) => {
    fill(ctx, w, h, [150, 140, 122]);
    courses(ctx, w, rnd, { top: 0, bottom: h, courseHeight: 42.67, minLength: 40, maxLength: 80, mortar: 3, color: [200, 190, 168], amount: 0.12 });
    speckle(ctx, w, h, rnd, { count: 2000, color: [120, 110, 95], size: 1.3, alpha: 0.25 });
  });

export const mosaic = () =>
  paintTexture('mosaic', { tile: 8, width: 512 }, (ctx, w, h, rnd) => {
    const palette = [[226, 214, 190], [176, 64, 46], [52, 84, 110], [196, 150, 60], [70, 110, 70], [40, 34, 30]];
    for (let y = 0; y < h; y += 4) {
      for (let x = 0; x < w; x += 4) {
        const border = x < 24 || y < 24 || x > w - 28 || y > h - 28;
        const motif = Math.hypot(x - w / 2, y - h / 2) < 70 && rnd.chance(0.7);
        const color = border ? palette[((x + y) >> 3) % 3 === 0 ? 1 : 3] : motif ? rnd.pick(palette.slice(1)) : palette[0];
        ctx.fillStyle = vary(rnd, color, 0.15);
        ctx.fillRect(x, y, 3.5, 3.5);
      }
    }
  });

// Map-scale ground (1 unit = 100 m): near-flat colour with faint, broad variation, like a painted map.

/** Streets and open ground of the towns: plain, dusty earth, a shade darker than the marble and limestone that stand on it. */
export const cityGround = () =>
  paintTexture('cityGround', { tile: 10 }, (ctx, w, h, rnd) => {
    fill(ctx, w, h, [212, 194, 156]);
    blotches(ctx, w, h, rnd, { count: 20, color: [198, 178, 138], radius: 60, alpha: 0.2 });
  });

/** Countryside meadow: fresh green with soft, broad patches. */
export const mapMeadow = () =>
  paintTexture('mapMeadow', { tile: 36 }, (ctx, w, h, rnd) => {
    // A sun-dried Mediterranean green, olive rather than lawn, with paler straw-coloured patches.
    fill(ctx, w, h, [136, 158, 88]);
    blotches(ctx, w, h, rnd, { count: 16, color: [116, 146, 76], radius: 80, alpha: 0.24 });
    blotches(ctx, w, h, rnd, { count: 12, color: [168, 170, 104], radius: 70, alpha: 0.22 });
  });

/** Pine woods on the islands: deep green, broken by sunlit clearings. */
export const mapPines = () =>
  paintTexture('mapPines', { tile: 36 }, (ctx, w, h, rnd) => {
    fill(ctx, w, h, [66, 104, 58]);
    blotches(ctx, w, h, rnd, { count: 18, color: [50, 84, 46], radius: 70, alpha: 0.3 });
    blotches(ctx, w, h, rnd, { count: 10, color: [104, 134, 70], radius: 50, alpha: 0.22 });
  });

/** Dry scrub over rusty ground, for the bare island of Kınalıada. */
export const mapScrub = () =>
  paintTexture('mapScrub', { tile: 36 }, (ctx, w, h, rnd) => {
    fill(ctx, w, h, [150, 126, 86]);
    blotches(ctx, w, h, rnd, { count: 14, color: [164, 106, 72], radius: 60, alpha: 0.3 });
    blotches(ctx, w, h, rnd, { count: 12, color: [118, 128, 72], radius: 45, alpha: 0.28 });
  });

// ---------- special-purpose (non-tiling) textures ----------

/** Pink granite face with a column of carved hieroglyphs, for the Egyptian obelisk. */
export const hieroglyphs = () => {
  const texture = paintTexture('hieroglyphs', { width: 128, height: 1024 }, (ctx, w, h, rnd) => {
    fill(ctx, w, h, [182, 122, 106]);
    speckle(ctx, w, h, rnd, { count: 7000, color: [80, 50, 48], size: 2, alpha: 0.45 });
    speckle(ctx, w, h, rnd, { count: 5000, color: [236, 214, 204], size: 1.6, alpha: 0.45 });
    ctx.strokeStyle = ctx.fillStyle = 'rgba(78, 44, 38, 0.75)';
    ctx.lineWidth = 3;
    ctx.strokeRect(38, 40, 52, h - 60);
    for (let y = 60; y < h - 50; y += 38) {
      const cx = 64;
      ctx.beginPath();
      switch (rnd.int(0, 5)) {
        case 0: ctx.arc(cx, y + 14, 9, 0, Math.PI * 2); ctx.stroke(); break;
        case 1: ctx.ellipse(cx, y + 16, 7, 14, 0, 0, Math.PI * 2); ctx.stroke(); ctx.fillRect(cx - 12, y + 30, 24, 3); break;
        case 2: ctx.arc(cx - 4, y + 8, 5, 0, Math.PI * 2); ctx.fill(); ctx.moveTo(cx - 4, y + 12); ctx.lineTo(cx + 12, y + 28); ctx.lineTo(cx - 12, y + 28); ctx.fill(); break;
        case 3: for (let i = 0; i < 3; i++) { ctx.moveTo(cx - 14, y + 8 + i * 8); for (let k = 0; k < 4; k++) ctx.lineTo(cx - 10 + k * 8, y + (k % 2 ? 4 : 12) + i * 8); } ctx.stroke(); break;
        case 4: ctx.arc(cx, y + 8, 6, 0, Math.PI * 2); ctx.moveTo(cx, y + 14); ctx.lineTo(cx, y + 32); ctx.moveTo(cx - 10, y + 19); ctx.lineTo(cx + 10, y + 19); ctx.stroke(); break;
        default: ctx.fillRect(cx - 14, y + 8, 28, 5); ctx.fillRect(cx - 3, y + 15, 6, 16); break;
      }
    }
  });
  texture.wrapS = THREE.RepeatWrapping;
  texture.repeat.set(4, 1);
  return texture;
};

/**
 * The town houses' atlas: every face of the map's houses (see world/houses.js)
 * samples one region of this canvas. Pixel rectangles [x, y, width, height]
 * on a 1024 × 1024 sheet; façades run from a buried foundation at the bottom
 * (HOUSE_FOOT of the eaves height) to the eaves at the top.
 */
export const HOUSE_ATLAS = {
  size: 1024,
  gableFront2: [8, 8, 272, 224], // the gable end of the main block, two arched windows over a door
  gableFront1: [288, 8, 208, 224], // the same, narrower, one window
  eavesFront: [504, 8, 400, 224], // a long front: a door onto the balcony between two windows
  steps: [912, 8, 104, 104],
  wood: [912, 120, 104, 112],
  sideWall: [8, 240, 272, 224],
  wingFront: [288, 240, 208, 224], // whitewashed below, a door and window onto the balcony above
  wingSide: [504, 240, 272, 224],
  rubble: [784, 240, 232, 224],
  gable: [8, 480, 272, 96],
  railing: [288, 480, 256, 48],
  soffit: [552, 480, 128, 48],
  dark: [688, 480, 48, 48],
  roof: [8, 584, 512, 432],
};
export const HOUSE_FOOT = 0.25;
export const HOUSE_STOREY = 0.45; // the floor of the upper storey, as a share of the eaves height

/**
 * Painted after the reference of a two-storey Byzantine house: a ground floor
 * of rubble stone, an upper floor of stone laced with bands of brick and patched
 * with whitewash between weathered timbers, arched windows in brick surrounds
 * with plank shutters, and a roof of Roman tiles.
 */
export const townHouseAtlas = () => {
  const { size } = HOUSE_ATLAS;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = Math.round(size * QUALITY.textureScale);
  // Painted at full size so every stroke keeps its proportions, then copied down on a modest device.
  const pad = QUALITY.textureScale < 1 ? Object.assign(document.createElement('canvas'), { width: size, height: size }) : canvas;
  paintHouseAtlas(pad.getContext('2d'), createRandom(hashString('townHouses')));
  if (pad !== canvas) canvas.getContext('2d').drawImage(pad, 0, 0, canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
};

const HOUSE = {
  mortar: [126, 116, 102],
  stones: [[184, 174, 156], [168, 158, 140], [196, 186, 166], [150, 140, 124], [178, 162, 138]],
  brick: [174, 88, 64],
  plaster: [220, 212, 194],
  timber: [112, 96, 78],
  shutter: [124, 110, 92],
  void: [34, 28, 24],
};

function paintHouseAtlas(ctx, rnd) {
  const A = HOUSE_ATLAS;
  fill(ctx, A.size, A.size, HOUSE.mortar);
  const lift = (rect) => {
    const [x, y, w, h] = rect;
    return { x, y, w, h, ground: y + h - h * (HOUSE_FOOT / (1 + HOUSE_FOOT)), storey: y + h - h * ((HOUSE_FOOT + HOUSE_STOREY) / (1 + HOUSE_FOOT)) };
  };

  facade(ctx, rnd, lift(A.gableFront2), { upper: [['arch', 0.3], ['arch', 0.7]], lower: [['door', 0.36], ['window', 0.76]] });
  facade(ctx, rnd, lift(A.gableFront1), { upper: [['arch', 0.5]], lower: [['door', 0.5]] });
  facade(ctx, rnd, lift(A.eavesFront), { upper: [['arch', 0.18], ['doorway', 0.5], ['arch', 0.82]], lower: [['door', 0.3], ['window', 0.62], ['window', 0.86]] });
  facade(ctx, rnd, lift(A.sideWall), { upper: [['arch', 0.5]], lower: [['window', 0.5]], quoins: false });
  facade(ctx, rnd, lift(A.wingSide), { upper: [['window', 0.55]], lower: [['window', 0.3]], quoins: false, beams: false });
  facade(ctx, rnd, lift(A.wingFront), { upper: [['doorway', 0.28], ['arch', 0.74]], lower: [['window', 0.6]], whitewash: true, quoins: false });

  const [rx, ry, rw, rh] = A.rubble;
  stoneCourses(ctx, rnd, rx, ry, rw, rh, { course: 12, plaster: 0.15 });
  const [gx, gy, gw, gh] = A.gable;
  upperWall(ctx, rnd, gx, gy, gw, gh, 0.25);
  ctx.fillStyle = rgb(HOUSE.void);
  ctx.fillRect(gx + gw / 2 - 7, gy + 26, 14, 18); // a vent under the ridge
  ctx.fillStyle = rgb(HOUSE.timber);
  ctx.fillRect(gx, gy + gh - 7, gw, 7);

  const [sx, sy, sw, sh] = A.steps;
  ctx.save();
  ctx.beginPath();
  ctx.rect(sx, sy, sw, sh);
  ctx.clip();
  for (let y = sy; y < sy + sh; y += 26) { // dressed blocks for the treads
    for (let x = sx - rnd.next() * 30; x < sx + sw; x += 42) {
      ctx.fillStyle = vary(rnd, [178, 162, 138], 0.1);
      ctx.fillRect(x + 1.5, y + 1.5, 39, 23);
    }
  }
  ctx.restore();

  planks(ctx, rnd, ...A.wood, 13);
  const [lx, ly, lw, lh] = A.railing;
  ctx.fillStyle = rgb([58, 50, 42]);
  ctx.fillRect(lx, ly, lw, lh);
  for (let x = lx + 2; x < lx + lw; x += 13) {
    ctx.fillStyle = vary(rnd, HOUSE.timber, 0.2);
    ctx.fillRect(x, ly, 6, lh);
  }
  ctx.fillStyle = rgb(HOUSE.timber.map((c) => c * 1.12));
  ctx.fillRect(lx, ly, lw, 8);
  ctx.fillRect(lx, ly + lh - 6, lw, 6);
  const [ox, oy, ow, oh] = A.soffit;
  ctx.fillStyle = rgb([70, 58, 46]);
  ctx.fillRect(ox, oy, ow, oh);
  ctx.fillStyle = rgb([96, 80, 64]);
  for (let x = ox + 4; x < ox + ow; x += 16) ctx.fillRect(x, oy, 6, oh);
  ctx.fillStyle = rgb([40, 46, 50]);
  ctx.fillRect(...A.dark);

  romanTiles(ctx, rnd, ...A.roof);
}

/** Irregular stones in rough courses over mortar, with a share of them whitewashed over. */
function stoneCourses(ctx, rnd, x, y, w, h, { course = 11, plaster = 0 } = {}) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = rgb(HOUSE.mortar);
  ctx.fillRect(x, y, w, h);
  for (let top = y + h; top > y - course; top -= course) {
    const height = course * (0.75 + rnd.next() * 0.25);
    for (let left = x - rnd.next() * 20; left < x + w; ) {
      const length = course * (1.1 + rnd.next() * 1.4);
      ctx.fillStyle = vary(rnd, rnd.pick(HOUSE.stones), 0.12);
      ctx.beginPath();
      ctx.roundRect(left + 1, top - height, length - 2, height - 1.5, 3);
      ctx.fill();
      left += length;
    }
  }
  ctx.translate(x, y);
  speckle(ctx, w, h, rnd, { count: (w * h) / 20, color: [90, 80, 68], size: 1.4, alpha: 0.18 });
  ctx.restore();
  if (plaster > 0) whitewash(ctx, rnd, x, y, w, h, plaster);
}

/** A ragged outline round (cx, cy): a ring of points at wandering distances, joined by curves through their midpoints. */
function raggedPath(ctx, rnd, cx, cy, r) {
  const ring = [];
  let reach = 1;
  for (let k = 0; k < 14; k++) {
    reach = THREE.MathUtils.clamp(reach + (rnd.next() - 0.5) * 0.5, 0.55, 1.3);
    const angle = (k / 14) * Math.PI * 2;
    ring.push([cx + Math.cos(angle) * r * reach * 1.5, cy + Math.sin(angle) * r * reach]);
  }
  const mid = (k) => [(ring[k % 14][0] + ring[(k + 1) % 14][0]) / 2, (ring[k % 14][1] + ring[(k + 1) % 14][1]) / 2];
  ctx.beginPath();
  ctx.moveTo(...mid(0));
  for (let k = 1; k <= 14; k++) ctx.quadraticCurveTo(...ring[k % 14], ...mid(k));
}

/** Patches of old lime plaster clinging to the stone, with soft, ragged edges. */
function whitewash(ctx, rnd, x, y, w, h, share) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  const count = Math.round((w * h * share) / 500);
  for (let i = 0; i < count; i++) {
    raggedPath(ctx, rnd, x + rnd.next() * w, y + rnd.next() * h, 8 + rnd.next() * 16);
    ctx.fillStyle = vary(rnd, HOUSE.plaster, 0.07);
    ctx.fill();
    ctx.strokeStyle = 'rgba(110, 96, 80, 0.3)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
  // Grime and stains over the plaster.
  ctx.translate(x, y);
  speckle(ctx, w, h, rnd, { count: (w * h) / 40, color: [120, 108, 92], size: 1.6, alpha: 0.16 });
  ctx.restore();
}

/** A rendered wall, its plaster fallen away here and there to show the stone beneath. */
function plastered(ctx, rnd, x, y, w, h) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = rgb(HOUSE.plaster);
  ctx.fillRect(x, y, w, h);
  ctx.translate(x, y);
  blotches(ctx, w, h, rnd, { count: 10, color: [196, 184, 160], radius: 24, alpha: 0.35 });
  speckle(ctx, w, h, rnd, { count: (w * h) / 40, color: [120, 108, 92], size: 1.6, alpha: 0.16 });
  ctx.translate(-x, -y);
  for (let i = 0; i < Math.round((w * h) / 4000); i++) {
    const cx = x + rnd.next() * w;
    const cy = y + rnd.next() * h;
    const r = 7 + rnd.next() * 10;
    ctx.save();
    raggedPath(ctx, rnd, cx, cy, r);
    ctx.clip();
    stoneCourses(ctx, rnd, cx - r * 2, cy - r * 1.4, r * 4, r * 2.8, { course: 9 });
    ctx.restore();
    raggedPath(ctx, rnd, cx, cy, r);
    ctx.strokeStyle = 'rgba(110, 96, 80, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  ctx.restore();
}

/** The upper storey: stone courses laced with bands of three brick courses, patched with plaster. */
function upperWall(ctx, rnd, x, y, w, h, plaster = 0.35) {
  stoneCourses(ctx, rnd, x, y, w, h, { course: 10 });
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  for (let band = y + h - 26; band > y - 14; band -= 40) {
    for (let k = 0; k < 3; k++) {
      const top = band + k * 5;
      ctx.fillStyle = rgb([196, 170, 148]);
      ctx.fillRect(x, top, w, 5);
      for (let left = x - rnd.next() * 18; left < x + w; left += 18) {
        ctx.fillStyle = vary(rnd, HOUSE.brick, 0.22);
        ctx.fillRect(left + 1, top + 1, 16, 3.4);
      }
    }
  }
  ctx.restore();
  whitewash(ctx, rnd, x, y, w, h, plaster);
}

/** Weathered boards, grain running across. */
function planks(ctx, rnd, x, y, w, h, board = 12, vertical = false) {
  ctx.fillStyle = rgb([70, 60, 50]);
  ctx.fillRect(x, y, w, h);
  const span = vertical ? w : h;
  for (let t = 0; t < span; t += board) {
    ctx.fillStyle = vary(rnd, HOUSE.timber, 0.22);
    if (vertical) ctx.fillRect(x + t + 0.8, y, board - 1.6, h);
    else ctx.fillRect(x, y + t + 0.8, w, board - 1.6);
  }
}

/**
 * A house front: rubble ground floor with corner quoins, a timber beam at the
 * upper floor, the banded upper wall framed in timber, and openings placed at
 * shares of the width.
 */
function facade(ctx, rnd, { x, y, w, h, ground, storey }, { upper = [], lower = [], quoins = true, beams = true, whitewash: washed = false }) {
  if (washed) plastered(ctx, rnd, x, storey, w, y + h - storey);
  else stoneCourses(ctx, rnd, x, storey, w, y + h - storey, { course: 12, plaster: 0.06 });
  upperWall(ctx, rnd, x, y, w, storey - y, 0.28);
  if (quoins) {
    for (let top = y + h, k = 0; top > y; top -= 15, k++) {
      for (const [left, length] of [[x, k % 2 ? 22 : 13], [x + w - (k % 2 ? 13 : 22), k % 2 ? 13 : 22]]) {
        ctx.fillStyle = vary(rnd, [204, 196, 180], 0.08);
        ctx.fillRect(left, top - 14, length, 13);
      }
    }
  }
  const unit = storey - y; // the upper storey's height in pixels
  for (const [kind, at] of upper) opening(ctx, rnd, kind, x + at * w, storey, unit);
  for (const [kind, at] of lower) opening(ctx, rnd, kind, x + at * w, ground, ground - storey);
  if (beams) {
    ctx.fillStyle = rgb(HOUSE.timber);
    ctx.fillRect(x, storey - 4, w, 8); // the floor beam
    ctx.fillRect(x, y, w, 7); // the wall plate under the eaves
    for (const post of [x + 4, x + w - 10]) ctx.fillRect(post, y, 6, unit);
    ctx.fillStyle = 'rgba(40, 32, 26, 0.35)';
    ctx.fillRect(x, storey + 4, w, 2);
  }
}

/** Openings standing on a floor line `base`, sized to the storey's height in pixels. */
function opening(ctx, rnd, kind, cx, base, storey) {
  const voidColour = rgb(HOUSE.void);
  if (kind === 'arch') {
    const w = storey * 0.3;
    const top = base - storey * 0.84;
    const bottom = base - storey * 0.3;
    // Plank shutters folded back on either side.
    for (const side of [-1, 1]) planks(ctx, rnd, cx + side * (w * 0.5 + 2) - (side < 0 ? w * 0.48 : 0), top + w * 0.25, w * 0.48, bottom - top - w * 0.25, 4, true);
    ctx.fillStyle = rgb(HOUSE.brick);
    ctx.beginPath();
    ctx.arc(cx, top + w / 2, w / 2 + 5, Math.PI, 0);
    ctx.lineTo(cx + w / 2 + 5, bottom);
    ctx.lineTo(cx - w / 2 - 5, bottom);
    ctx.fill();
    ctx.strokeStyle = 'rgba(220, 200, 180, 0.6)';
    ctx.lineWidth = 1;
    for (let k = 1; k < 8; k++) {
      const a = Math.PI + (k / 8) * Math.PI;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * w * 0.5, top + w / 2 + Math.sin(a) * w * 0.5);
      ctx.lineTo(cx + Math.cos(a) * (w * 0.5 + 5), top + w / 2 + Math.sin(a) * (w * 0.5 + 5));
      ctx.stroke();
    }
    ctx.fillStyle = voidColour;
    ctx.beginPath();
    ctx.arc(cx, top + w / 2, w / 2, Math.PI, 0);
    ctx.lineTo(cx + w / 2, bottom);
    ctx.lineTo(cx - w / 2, bottom);
    ctx.fill();
    ctx.strokeStyle = rgb([120, 100, 80]); // the window's lattice
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, top + 2);
    ctx.lineTo(cx, bottom);
    for (let t = top + w * 0.5; t < bottom; t += w * 0.45) {
      ctx.moveTo(cx - w / 2, t);
      ctx.lineTo(cx + w / 2, t);
    }
    ctx.stroke();
    ctx.fillStyle = rgb([200, 192, 176]);
    ctx.fillRect(cx - w / 2 - 6, bottom, w + 12, 4); // sill
  } else if (kind === 'doorway') {
    const w = storey * 0.34;
    const top = base - storey * 0.86;
    ctx.fillStyle = rgb(HOUSE.timber);
    ctx.fillRect(cx - w / 2 - 4, top - 4, w + 8, base - top + 4);
    ctx.fillStyle = voidColour;
    ctx.fillRect(cx - w / 2, top, w, base - top);
  } else if (kind === 'door') {
    const w = storey * 0.42;
    const top = base - storey * 0.8;
    ctx.fillStyle = rgb([196, 188, 172]);
    ctx.fillRect(cx - w / 2 - 6, top - 6, w + 12, base - top + 6); // stone jambs
    planks(ctx, rnd, cx - w / 2, top, w, base - top, 6, true);
    ctx.fillStyle = rgb([60, 52, 44]);
    for (const t of [0.25, 0.75]) ctx.fillRect(cx - w / 2, top + (base - top) * t, w, 2.5); // iron straps
    ctx.fillStyle = rgb(HOUSE.timber);
    ctx.fillRect(cx - w / 2 - 12, top - 12, w + 24, 8); // lintel beam
  } else if (kind === 'window') {
    const w = storey * 0.2;
    const top = base - storey * 0.72;
    ctx.fillStyle = rgb([200, 192, 176]);
    ctx.fillRect(cx - w / 2 - 4, top - 4, w + 8, w * 1.15 + 8);
    ctx.fillStyle = voidColour;
    ctx.fillRect(cx - w / 2, top, w, w * 1.15);
    ctx.fillStyle = rgb([100, 92, 84]);
    ctx.fillRect(cx - 1, top, 2, w * 1.15);
  }
}

/** Roman tiles in courses down the slope: flat pans under rounded covers, weathered unevenly. */
function romanTiles(ctx, rnd, x, y, w, h) {
  ctx.fillStyle = rgb([124, 68, 48]);
  ctx.fillRect(x, y, w, h);
  const column = 21;
  const course = 27;
  for (let left = x; left < x + w; left += column) {
    for (let top = y; top < y + h; top += course) {
      const k = 1 + rnd.range(-0.06, 0.06) - (rnd.chance(0.1) ? 0.12 : 0); // now and then an older, darker tile
      const base = [214 * k + rnd.range(-6, 6), 124 * k + rnd.range(-5, 5), 88 * k + rnd.range(-4, 4)];
      ctx.fillStyle = rgb(base.map((c) => c * 0.86)); // the pan
      ctx.fillRect(left, top, column, course - 1);
      const gradient = ctx.createLinearGradient(left + 9, 0, left + column - 1, 0); // the cover tile, lit across its curve
      gradient.addColorStop(0, rgb(base.map((c) => c * 0.58)));
      gradient.addColorStop(0.4, rgb(base.map((c) => Math.min(255, c * 1.08))));
      gradient.addColorStop(1, rgb(base.map((c) => c * 0.62)));
      ctx.fillStyle = gradient;
      ctx.fillRect(left + 9, top, column - 10, course - 2);
      ctx.fillStyle = 'rgba(60, 30, 20, 0.4)';
      ctx.fillRect(left + 9, top + course - 4, column - 10, 3); // the lap's shadow
    }
  }
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  for (let i = 0; i < 22; i++) { // lichen and soot
    const cx = x + rnd.next() * w;
    const cy = y + rnd.next() * h;
    const r = 24 + rnd.next() * 40;
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    const colour = rnd.chance(0.5) ? [150, 140, 108] : [96, 70, 56];
    gradient.addColorStop(0, rgb(colour, 0.22));
    gradient.addColorStop(1, rgb(colour, 0));
    ctx.fillStyle = gradient;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  ctx.restore();
}

/** Banner designs, painted once per kind. */
export const flag = (kind) =>
  paintTexture(`flag-${kind}`, { width: 128, height: 80 }, (ctx, w, h) => {
    switch (kind) {
      case 'genoa':
        fill(ctx, w, h, [244, 240, 232]);
        ctx.fillStyle = '#c0182a';
        ctx.fillRect(w * 0.42, 0, w * 0.16, h);
        ctx.fillRect(0, h * 0.38, w, h * 0.24);
        break;
      case 'venice':
        fill(ctx, w, h, [150, 22, 34]);
        ctx.fillStyle = '#e9b949';
        ctx.beginPath();
        ctx.arc(w * 0.38, h * 0.36, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(w * 0.3, h * 0.45, w * 0.3, h * 0.2);
        ctx.beginPath();
        ctx.moveTo(w * 0.45, h * 0.45);
        ctx.lineTo(w * 0.72, h * 0.18);
        ctx.lineTo(w * 0.62, h * 0.5);
        ctx.fill();
        ctx.fillRect(w * 0.32, h * 0.65, 4, 14);
        ctx.fillRect(w * 0.54, h * 0.65, 4, 14);
        break;
      case 'imperial': // the emperor's own: a gold cross on Tyrian purple
        fill(ctx, w, h, [92, 31, 99]);
        ctx.fillStyle = '#efc458';
        ctx.fillRect(w * 0.45, 0, w * 0.1, h);
        ctx.fillRect(0, h * 0.42, w, h * 0.16);
        break;
      default: // Byzantine imperial: gold cross with four firesteels on red
        fill(ctx, w, h, [150, 24, 36]);
        ctx.fillStyle = '#efc458';
        ctx.fillRect(w * 0.45, 0, w * 0.1, h);
        ctx.fillRect(0, h * 0.42, w, h * 0.16);
        ctx.font = 'bold 26px Georgia, serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (const [x, y] of [[0.22, 0.22], [0.78, 0.22], [0.22, 0.8], [0.78, 0.8]]) ctx.fillText('B', w * x, h * y);
    }
  });

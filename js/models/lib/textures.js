import * as THREE from 'three';
import { createRandom, hashString } from '../../util/random.js';

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

/** Byzantine banded masonry: limestone courses with a band of red brick. */
export const bandedMasonry = () =>
  paintTexture('banded', { tile: 6 }, (ctx, w, h, rnd) => {
    fill(ctx, w, h, [196, 182, 154]);
    courses(ctx, w, rnd, { top: 0, bottom: 176, courseHeight: 22, minLength: 34, maxLength: 72, mortar: 3, color: [216, 201, 170], amount: 0.14 });
    courses(ctx, w, rnd, { top: 176, bottom: 256, courseHeight: 10, minLength: 22, maxLength: 30, mortar: 3.5, color: [172, 88, 60], amount: 0.22 });
    speckle(ctx, w, h, rnd, { count: 2500, color: [110, 90, 70], amount: 0.4, size: 1.4, alpha: 0.18 });
  });

export const ashlar = () =>
  paintTexture('ashlar', { tile: 4 }, (ctx, w, h, rnd) => {
    fill(ctx, w, h, [178, 166, 142]);
    courses(ctx, w, rnd, { top: 0, bottom: h, courseHeight: 32, minLength: 40, maxLength: 96, mortar: 3, color: [208, 194, 164], amount: 0.13 });
    speckle(ctx, w, h, rnd, { count: 3000, color: [120, 105, 85], amount: 0.4, size: 1.5, alpha: 0.2 });
  });

export const brick = () =>
  paintTexture('brick', { tile: 2 }, (ctx, w, h, rnd) => {
    fill(ctx, w, h, [205, 191, 163]);
    courses(ctx, w, rnd, { top: 0, bottom: h, courseHeight: 12.8, minLength: 38, maxLength: 48, mortar: 4, color: [168, 84, 56], amount: 0.25 });
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
    fill(ctx, w, h, [238, 233, 224]);
    blotches(ctx, w, h, rnd, { count: 20, color: [220, 214, 204], radius: 50, alpha: 0.5 });
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

/** Streets and open ground of the towns: plain, dusty earth. */
export const cityGround = () =>
  paintTexture('cityGround', { tile: 10 }, (ctx, w, h, rnd) => {
    fill(ctx, w, h, [226, 210, 174]);
    blotches(ctx, w, h, rnd, { count: 20, color: [214, 194, 152], radius: 60, alpha: 0.18 });
  });

/** Countryside meadow: fresh green with soft, broad patches. */
export const mapMeadow = () =>
  paintTexture('mapMeadow', { tile: 36 }, (ctx, w, h, rnd) => {
    fill(ctx, w, h, [134, 168, 84]);
    blotches(ctx, w, h, rnd, { count: 16, color: [118, 154, 72], radius: 80, alpha: 0.22 });
    blotches(ctx, w, h, rnd, { count: 10, color: [160, 178, 96], radius: 70, alpha: 0.18 });
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

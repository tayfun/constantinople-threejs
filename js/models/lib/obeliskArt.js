import * as THREE from 'three';
import { createRandom, hashString } from '../../util/random.js';
import { GREEK_INSCRIPTION, LATIN_INSCRIPTION, OBELISK_FACES, OBELISK_SCENE } from '../../data/obeliskInscriptions.js';

/**
 * Painted textures for the Obelisk of Theodosius at full detail: the four
 * hieroglyph columns of the granite shaft, the relief panels and the Latin
 * and Greek inscriptions of the marble pedestal, the arcaded block beneath it
 * and the porphyry stones at its corners. Everything is drawn once and shared.
 *
 * The signs and letters are set in web fonts (Noto Sans Egyptian Hieroglyphs,
 * Cinzel and EB Garamond, loaded by index.html). Canvases that need them are
 * painted at once and painted again when the fonts arrive.
 *
 * Sides are named as on the monument in the Hippodrome: north and south face
 * along the spina, east and west face the stands.
 */

export const SIDES = ['north', 'south', 'east', 'west'];

const GLYPH_FONT = '"Noto Sans Egyptian Hieroglyphs"';
const LATIN_FONT = 'Cinzel';
const GREEK_FONT = '"EB Garamond"';

const GRANITE = [194, 132, 118];
const MARBLE = [230, 224, 212];
const INK = 'rgba(78, 66, 56, 0.72)'; // carved outlines in marble
const SHADOW = 'rgba(70, 58, 48, 0.3)'; // shadow a relief throws
const RAISED = 'rgb(242, 238, 228)'; // the lit surface of a relief
const RAISED_DARK = 'rgb(222, 215, 202)'; // hair, recesses
const INCISED = 'rgba(50, 26, 24, 0.92)'; // cut into granite
const INCISED_LIGHT = 'rgba(246, 206, 192, 0.5)'; // the lit edge of a cut
const LETTER = 'rgba(62, 54, 46, 0.88)'; // cut into marble
const LETTER_LIGHT = 'rgba(250, 247, 240, 0.9)';

// ---------- fonts ----------

let fontsReady = null;

function fontsLoaded() {
  fontsReady ??= Promise.allSettled([
    document.fonts.load(`100px ${GLYPH_FONT}`, '𓇳𓏠𓆣'),
    document.fonts.load(`40px ${LATIN_FONT}`, 'AVM'),
    document.fonts.load(`40px ${GREEK_FONT}`, 'ΑΒΓ'),
  ]).then(() => true);
  return fontsReady;
}

const fontsAvailable = () => [GLYPH_FONT, LATIN_FONT, GREEK_FONT].every((font) => document.fonts.check(`20px ${font}`));

// ---------- canvas plumbing ----------

/**
 * A canvas texture. `paint(ctx, width, height, fonts)` runs now; if it sets
 * text and the fonts are still loading it runs again once they are in.
 */
function paintedTexture(width, height, paint, { tile = false, text = false } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  if (tile) texture.wrapS = texture.wrapT = THREE.RepeatWrapping;

  const run = (fonts) => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    paint(ctx, width, height, fonts);
    texture.needsUpdate = true;
  };
  const ready = !text || fontsAvailable();
  run(ready);
  if (!ready) fontsLoaded().then(() => run(true));
  return texture;
}

const rgb = ([r, g, b], alpha = 1) => `rgba(${r | 0}, ${g | 0}, ${b | 0}, ${alpha})`;

function fill(ctx, w, h, color) {
  ctx.fillStyle = rgb(color);
  ctx.fillRect(0, 0, w, h);
}

function speckle(ctx, w, h, rnd, { count, color, size, alpha, amount = 0.3 }) {
  for (let i = 0; i < count; i++) {
    const k = 1 + (rnd.next() - 0.5) * amount;
    ctx.fillStyle = rgb(color.map((c) => Math.min(255, c * k)), alpha);
    const s = 0.6 + rnd.next() * size;
    ctx.fillRect(rnd.next() * w, rnd.next() * h, s, s);
  }
}

const line = (ctx, x0, y0, x1, y1) => {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
};

// ---------- stone ----------

/** Aswan red granite: pink feldspar with black mica and pale quartz. */
function granite(ctx, w, h, rnd) {
  fill(ctx, w, h, GRANITE);
  speckle(ctx, w, h, rnd, { count: (w * h) / 55, color: [74, 44, 44], size: 2.2, alpha: 0.5 });
  speckle(ctx, w, h, rnd, { count: (w * h) / 80, color: [236, 214, 202], size: 1.8, alpha: 0.5 });
  speckle(ctx, w, h, rnd, { count: (w * h) / 420, color: [38, 24, 24], size: 3, alpha: 0.6 });
}

/** Proconnesian marble: pale, with soft grey-blue banding. */
function marble(ctx, w, h, rnd) {
  fill(ctx, w, h, MARBLE);
  for (let i = 0; i < 10; i++) {
    const x = rnd.next() * w;
    const y = rnd.next() * h;
    const r = (0.2 + rnd.next() * 0.3) * Math.max(w, h);
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
    gradient.addColorStop(0, 'rgba(206, 200, 190, 0.45)');
    gradient.addColorStop(1, 'rgba(206, 200, 190, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  ctx.lineWidth = 1;
  for (let i = 0; i < 14; i++) {
    ctx.strokeStyle = `rgba(118, 124, 132, ${0.06 + rnd.next() * 0.1})`;
    const y = rnd.next() * h;
    ctx.beginPath();
    ctx.moveTo(-10, y);
    ctx.bezierCurveTo(w * 0.3, y + rnd.range(-h * 0.08, h * 0.08), w * 0.6, y + rnd.range(-h * 0.08, h * 0.08), w + 10, y + rnd.range(-h * 0.03, h * 0.03));
    ctx.stroke();
  }
  speckle(ctx, w, h, rnd, { count: (w * h) / 600, color: [200, 194, 184], size: 1.5, alpha: 0.35 });
}

/** Imperial porphyry: dark red with pale feldspar grains. */
function porphyry(ctx, w, h, rnd) {
  fill(ctx, w, h, [118, 58, 54]);
  speckle(ctx, w, h, rnd, { count: 2600, color: [206, 160, 152], size: 2.6, alpha: 0.7 });
  speckle(ctx, w, h, rnd, { count: 1400, color: [52, 20, 22], size: 2.2, alpha: 0.6 });
  speckle(ctx, w, h, rnd, { count: 300, color: [232, 206, 196], size: 3.6, alpha: 0.6 });
}

// ---------- the hieroglyph column ----------

/** Draws one sign scaled by its ink to fill a box, the way a carver fills a quadrat. */
function sign(ctx, glyph, cx, cy, boxW, boxH) {
  ctx.font = `100px ${GLYPH_FONT}`;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  const m = ctx.measureText(glyph);
  const inkW = Math.max(1, m.actualBoundingBoxLeft + m.actualBoundingBoxRight);
  const inkH = Math.max(1, m.actualBoundingBoxAscent + m.actualBoundingBoxDescent);
  const k = Math.min(boxW / inkW, boxH / inkH);
  ctx.font = `${(100 * k).toFixed(1)}px ${GLYPH_FONT}`;
  const x = cx - ((m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2) * k;
  const y = cy + ((m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2) * k;
  ctx.fillStyle = INCISED_LIGHT;
  ctx.fillText(glyph, x + 2, y + 2);
  ctx.fillStyle = INCISED;
  ctx.fillText(glyph, x, y);
}

/** Strokes or fills a path twice, lit edge first, so it reads as cut into the stone. */
function carve(ctx, draw) {
  ctx.save();
  ctx.translate(2, 2);
  ctx.strokeStyle = ctx.fillStyle = INCISED_LIGHT;
  draw(ctx);
  ctx.restore();
  ctx.strokeStyle = ctx.fillStyle = INCISED;
  draw(ctx);
}

/** Groups a segment's signs into quadrats: flat signs stack (up to three), two upright signs share a square. */
function quadrats(glyphs, kinds) {
  const signs = [...glyphs];
  const rows = [];
  for (let i = 0; i < signs.length; i++) {
    if (kinds[i] === 'f') {
      const stack = [signs[i]];
      while (stack.length < 3 && kinds[i + 1] === 'f') stack.push(signs[++i]);
      rows.push({ signs: stack, height: [0.58, 0.82, 1][stack.length - 1], stacked: true });
    } else if (i + 1 < signs.length && kinds[i + 1] !== 'f') {
      rows.push({ signs: [signs[i], signs[i + 1]], height: 1 });
      i++;
    } else {
      rows.push({ signs: [signs[i]], height: 1 });
    }
  }
  return rows;
}

function paintScene(ctx, w, top, bottom, columnW) {
  const cx = w / 2;
  const height = bottom - top;
  sign(ctx, OBELISK_SCENE.sky, cx, top + height * 0.08, columnW * 0.98, height * 0.1);
  sign(ctx, OBELISK_SCENE.king, cx - columnW * 0.3, top + height * 0.6, columnW * 0.34, height * 0.56);
  sign(ctx, OBELISK_SCENE.god, cx, top + height * 0.6, columnW * 0.16, height * 0.36);
  sign(ctx, OBELISK_SCENE.amun, cx + columnW * 0.3, top + height * 0.56, columnW * 0.36, height * 0.66);
  carve(ctx, (c) => c.fillRect(cx - columnW / 2, bottom - 8, columnW, 6));
}

function paintColumn(ctx, w, h, face, fonts) {
  const columnW = w * 0.56;
  const cx = w / 2;
  const sceneTop = h * 0.006;
  const sceneBottom = h * 0.082;
  const top = sceneBottom + h * 0.014;
  const bottom = h * 0.988;

  const segments = face.segments.map((segment) => ({ ...segment, rows: quadrats(segment.glyphs, segment.kinds) }));
  const GAP = 0.2;
  const extra = (segment) => (segment.frame === 'cartouche' ? 0.55 : segment.frame === 'serekh' ? 1.05 : 0);
  const units = segments.reduce((sum, segment) => sum + segment.rows.reduce((a, row) => a + row.height, 0) + GAP + extra(segment), 0);
  const unit = Math.min(w * 0.4, (bottom - top) / units);

  if (!fonts) {
    // Fonts not in yet: mark the quadrats so the column still reads as carved.
    let y = top;
    ctx.lineWidth = 3;
    for (const segment of segments) {
      for (const row of segment.rows) {
        const rh = row.height * unit;
        carve(ctx, (c) => c.strokeRect(cx - columnW * 0.35, y + 4, columnW * 0.7, rh - 8));
        y += rh;
      }
      y += GAP * unit;
    }
    return;
  }

  paintScene(ctx, w, sceneTop, sceneBottom, columnW);

  let y = top;
  for (const segment of segments) {
    const segmentTop = y;
    if (segment.frame) y += unit * 0.25;
    const frameW = segment.frame === 'cartouche' ? unit * 1.5 : segment.frame === 'serekh' ? unit * 1.3 : 0;
    const rowW = frameW ? frameW * 0.74 : columnW;
    for (const row of segment.rows) {
      const rh = row.height * unit;
      if (row.stacked) {
        const sh = rh / row.signs.length;
        row.signs.forEach((glyph, j) => sign(ctx, glyph, cx, y + sh * (j + 0.5), rowW * 0.95, sh * 0.86));
      } else if (row.signs.length === 2) {
        const halfW = rowW / 2 - unit * 0.04;
        sign(ctx, row.signs[0], cx - rowW / 4, y + rh / 2, halfW, rh * 0.94);
        sign(ctx, row.signs[1], cx + rowW / 4, y + rh / 2, halfW, rh * 0.94);
      } else {
        sign(ctx, row.signs[0], cx, y + rh / 2, rowW, rh * (row.height < 1 ? 0.86 : 0.96));
      }
      y += rh;
    }
    ctx.lineWidth = 6;
    if (segment.frame === 'cartouche') {
      y += unit * 0.15;
      const frameTop = segmentTop + 4;
      const frameH = y - frameTop;
      carve(ctx, (c) => { c.beginPath(); c.roundRect(cx - frameW / 2, frameTop, frameW, frameH, frameW / 2); c.stroke(); });
      carve(ctx, (c) => c.fillRect(cx - frameW * 0.62, y + 4, frameW * 1.24, 8));
      y += unit * 0.15;
    } else if (segment.frame === 'serekh') {
      const facade = unit * 0.7;
      const frameTop = segmentTop + 4;
      carve(ctx, (c) => c.strokeRect(cx - frameW / 2, frameTop, frameW, y - frameTop + facade));
      carve(ctx, (c) => c.fillRect(cx - frameW / 2, y, frameW, 6));
      for (let k = 0; k < 7; k++) {
        const x = cx - frameW / 2 + 10 + (k * (frameW - 20)) / 6.5;
        carve(ctx, (c) => c.fillRect(x, y + facade * 0.15, 6, facade * 0.75));
      }
      y += facade;
    }
    y += GAP * unit;
  }
}

// ---------- relief drawing ----------

/** Fills a path as a low relief: a soft shadow below and to the right, a lit surface, a carved outline. */
function relief(ctx, path, { fill: surface = RAISED, depth = 3, width = 1.4 } = {}) {
  ctx.save();
  ctx.translate(depth * 0.7, depth);
  ctx.fillStyle = SHADOW;
  ctx.beginPath();
  path(ctx);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = surface;
  ctx.strokeStyle = INK;
  ctx.lineWidth = width;
  ctx.beginPath();
  path(ctx);
  ctx.fill();
  ctx.stroke();
}

const ellipse = (x, y, rx, ry) => (c) => c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
const rect = (x, y, w, h) => (c) => c.rect(x, y, w, h);
const polygon = (points) => (c) => {
  c.moveTo(points[0][0], points[0][1]);
  for (const [x, y] of points.slice(1)) c.lineTo(x, y);
  c.closePath();
};

function head(ctx, cx, cy, r) {
  relief(ctx, ellipse(cx, cy - r * 0.18, r * 1.04, r * 0.98), { fill: RAISED_DARK, depth: 2 });
  relief(ctx, ellipse(cx, cy + r * 0.12, r * 0.78, r * 0.92), { depth: 2 });
  ctx.fillStyle = INK;
  ctx.fillRect(cx - r * 0.44, cy, r * 0.24, r * 0.1);
  ctx.fillRect(cx + r * 0.2, cy, r * 0.24, r * 0.1);
  ctx.fillRect(cx - r * 0.16, cy + r * 0.5, r * 0.32, r * 0.08);
}

/** Head and shoulders, for the rows of courtiers and spectators. */
function bust(ctx, cx, baseY, r) {
  relief(ctx, (c) => {
    c.moveTo(cx - r * 1.6, baseY);
    c.lineTo(cx - r * 1.5, baseY - r * 1.2);
    c.quadraticCurveTo(cx, baseY - r * 2.1, cx + r * 1.5, baseY - r * 1.2);
    c.lineTo(cx + r * 1.6, baseY);
    c.closePath();
  });
  head(ctx, cx, baseY - r * 2.3, r);
}

function folds(ctx, cx, y0, y1, halfW) {
  ctx.strokeStyle = 'rgba(78, 66, 56, 0.3)';
  ctx.lineWidth = 1;
  for (const k of [-0.5, -0.15, 0.2, 0.55]) line(ctx, cx + k * halfW * 0.9, y0, cx + k * halfW * 1.1, y1);
}

function standing(ctx, cx, baseY, height, { arms = 'down' } = {}) {
  const r = height * 0.085;
  const shoulderY = baseY - height + r * 2.5;
  const sw = r * 1.75;
  relief(ctx, (c) => {
    c.moveTo(cx - sw, shoulderY);
    c.quadraticCurveTo(cx, shoulderY - r * 0.9, cx + sw, shoulderY);
    c.lineTo(cx + sw * 1.15, baseY);
    c.lineTo(cx - sw * 1.15, baseY);
    c.closePath();
  });
  folds(ctx, cx, shoulderY + r, baseY - 4, sw);
  if (arms === 'raised') {
    for (const side of [-1, 1]) {
      relief(ctx, (c) => {
        c.moveTo(cx + side * sw * 0.7, shoulderY + r * 0.4);
        c.lineTo(cx + side * sw * 1.9, shoulderY - r * 1.6);
        c.lineTo(cx + side * sw * 2.2, shoulderY - r * 1.2);
        c.lineTo(cx + side * sw * 0.9, shoulderY + r * 1.1);
        c.closePath();
      }, { depth: 2 });
    }
  }
  head(ctx, cx, shoulderY - r * 1.15, r);
}

function seated(ctx, cx, baseY, height) {
  const r = height * 0.1;
  const shoulderY = baseY - height + r * 2.5;
  const lapY = baseY - height * 0.4;
  const sw = r * 1.9;
  relief(ctx, polygon([
    [cx - sw, shoulderY], [cx + sw, shoulderY], [cx + sw * 1.1, lapY], [cx + sw * 1.45, lapY],
    [cx + sw * 1.45, baseY], [cx - sw * 1.45, baseY], [cx - sw * 1.45, lapY], [cx - sw * 1.1, lapY],
  ]));
  folds(ctx, cx, shoulderY + r, lapY - 2, sw);
  folds(ctx, cx, lapY + 3, baseY - 3, sw * 1.3);
  head(ctx, cx, shoulderY - r * 1.15, r);
}

/** A kneeling figure holding out a bowl of tribute; `dir` is +1 facing right. */
function kneeling(ctx, cx, baseY, height, dir) {
  const r = height * 0.14;
  const shoulderY = baseY - height + r * 2.4;
  relief(ctx, polygon([
    [cx - dir * r * 1.6, baseY], [cx - dir * r * 1.9, baseY - height * 0.45], [cx - dir * r * 0.8, shoulderY],
    [cx + dir * r * 1.1, shoulderY + r * 0.3], [cx + dir * r * 1.4, baseY - height * 0.4], [cx + dir * r * 0.6, baseY],
  ]));
  relief(ctx, polygon([[cx + dir * r * 0.9, shoulderY + r], [cx + dir * r * 3.2, shoulderY + r * 1.4], [cx + dir * r * 3.1, shoulderY + r * 2], [cx + dir * r * 0.8, shoulderY + r * 1.7]]), { depth: 2 });
  relief(ctx, ellipse(cx + dir * r * 3.4, shoulderY + r * 1.3, r * 0.9, r * 0.45), { depth: 2 });
  head(ctx, cx + dir * r * 0.2, shoulderY - r * 1.1, r);
}

function crowd(ctx, x0, x1, baseY, rows, perRow, r) {
  const step = (x1 - x0) / perRow;
  for (let row = rows - 1; row >= 0; row--) {
    const y = baseY - row * r * 1.9;
    const offset = row % 2 ? step / 2 : 0;
    for (let i = 0; i < perRow - (row % 2); i++) bust(ctx, x0 + step * (i + 0.5) + offset, y, r);
  }
}

function lattice(ctx, x0, y0, x1, y1, cell = 24) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, x1 - x0, y1 - y0);
  ctx.clip();
  ctx.fillStyle = 'rgba(70, 58, 48, 0.08)';
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.6;
  const span = y1 - y0;
  for (let x = x0 - span; x < x1 + span; x += cell) {
    line(ctx, x, y0, x + span, y1);
    line(ctx, x + span, y0, x, y1);
  }
  ctx.restore();
  relief(ctx, rect(x0, y0 - 6, x1 - x0, 7), { depth: 2 });
  relief(ctx, rect(x0, y1 - 1, x1 - x0, 7), { depth: 2 });
}

function post(ctx, x, y0, y1, w) {
  relief(ctx, rect(x - w / 2, y0, w, y1 - y0), { depth: 2 });
}

function column(ctx, x, y0, y1, w) {
  relief(ctx, rect(x - w / 2, y0 + w * 0.7, w, y1 - y0 - w * 0.7));
  relief(ctx, rect(x - w * 0.95, y0, w * 1.9, w * 0.7));
  relief(ctx, rect(x - w * 0.8, y1 - w * 0.4, w * 1.6, w * 0.4), { depth: 2 });
}

/** A flattened arch spanning from `x0` to `x1`, springing at `baseY`. */
function arch(ctx, x0, x1, baseY, rise, thickness) {
  const cx = (x0 + x1) / 2;
  const rx = (x1 - x0) / 2;
  relief(ctx, (c) => {
    c.ellipse(cx, baseY, rx, rise, 0, Math.PI, 0);
    c.ellipse(cx, baseY, rx - thickness, rise - thickness, 0, 0, Math.PI, true);
    c.closePath();
  });
}

function shield(ctx, cx, cy, r) {
  relief(ctx, ellipse(cx, cy, r * 0.84, r));
  relief(ctx, ellipse(cx, cy, r * 0.22, r * 0.26), { depth: 2 });
}

function spear(ctx, x, y0, y1) {
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  line(ctx, x, y0 + 10, x, y1);
  relief(ctx, polygon([[x, y0], [x + 5, y0 + 14], [x - 5, y0 + 14]]), { depth: 1 });
}

function labarum(ctx, x, y0, y1) {
  spear(ctx, x, y0, y1);
  relief(ctx, rect(x + 3, y0 + 14, 30, 26), { depth: 2 });
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.6;
  line(ctx, x + 10, y0 + 36, x + 26, y0 + 18);
  line(ctx, x + 26, y0 + 36, x + 10, y0 + 18);
  line(ctx, x + 18, y0 + 16, x + 18, y0 + 38);
  ctx.beginPath();
  ctx.arc(x + 21, y0 + 21, 4, Math.PI, Math.PI * 2.6);
  ctx.stroke();
}

function steps(ctx, cx, y0, y1, w, count) {
  const h = (y1 - y0) / count;
  for (let i = 0; i < count; i++) relief(ctx, rect(cx - w / 2, y0 + i * h, w, h - 2), { depth: 2 });
}

function organ(ctx, x, baseY, w, h) {
  relief(ctx, rect(x, baseY - h * 0.38, w, h * 0.38));
  const pipes = 7;
  const pw = (w - 8) / pipes;
  for (let i = 0; i < pipes; i++) {
    const ph = h * 0.62 * (0.5 + (0.5 * i) / (pipes - 1));
    relief(ctx, rect(x + 4 + i * pw, baseY - h * 0.38 - ph, pw - 3, ph), { depth: 2 });
  }
}

function capstan(ctx, cx, cy, r) {
  relief(ctx, ellipse(cx, cy, r, r * 0.55));
  relief(ctx, rect(cx - r * 0.3, cy - r * 1.4, r * 0.6, r * 1.4), { depth: 2 });
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  for (const a of [0.3, 1.2, 2.1, 3]) line(ctx, cx - Math.cos(a) * r * 1.5, cy - r * 1.1 - Math.sin(a) * r * 0.3, cx + Math.cos(a) * r * 1.5, cy - r * 1.1 + Math.sin(a) * r * 0.3);
}

/** A horse in profile, facing right, for the chariot teams. */
function horse(ctx, x, baseY, h) {
  const bodyY = baseY - h * 0.55;
  relief(ctx, ellipse(x, bodyY, h * 0.5, h * 0.24), { depth: 2 });
  relief(ctx, polygon([[x + h * 0.35, bodyY - h * 0.1], [x + h * 0.62, bodyY - h * 0.5], [x + h * 0.85, bodyY - h * 0.42], [x + h * 0.72, bodyY - h * 0.2], [x + h * 0.5, bodyY + h * 0.05]]), { depth: 2 });
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  for (const [dx, lean] of [[-0.36, -0.12], [-0.22, 0.1], [0.2, -0.1], [0.36, 0.14]]) line(ctx, x + dx * h, bodyY + h * 0.18, x + (dx + lean) * h, baseY);
}

function quadriga(ctx, x, baseY, h) {
  for (let k = 3; k >= 0; k--) horse(ctx, x + h * 0.9 + k * h * 0.12, baseY - k * 3, h * 0.9);
  relief(ctx, polygon([[x - h * 0.1, baseY - h * 0.5], [x + h * 0.45, baseY - h * 0.5], [x + h * 0.5, baseY - h * 0.2], [x - h * 0.15, baseY - h * 0.2]]));
  relief(ctx, ellipse(x + h * 0.18, baseY - h * 0.2, h * 0.22, h * 0.22), { depth: 2 });
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  for (let a = 0; a < Math.PI; a += Math.PI / 4) line(ctx, x + h * 0.18 - Math.cos(a) * h * 0.2, baseY - h * 0.2 - Math.sin(a) * h * 0.2, x + h * 0.18 + Math.cos(a) * h * 0.2, baseY - h * 0.2 + Math.sin(a) * h * 0.2);
  bust(ctx, x + h * 0.18, baseY - h * 0.5, h * 0.11);
}

// ---------- the pedestal panels ----------

/**
 * Upper block, 3.0 × 2.0 m: the emperor in the kathisma under an arch between
 * columns, his court to either side; a lattice balustrade; a lower register of
 * spectators (south, north), dancers and musicians (east) or kneeling
 * barbarians bearing tribute (west); an ornamented moulding along the bottom.
 */
function paintUpperPanel(ctx, w, h, side, rnd) {
  marble(ctx, w, h, rnd);
  ctx.fillStyle = 'rgba(70, 58, 48, 0.07)';
  ctx.fillRect(0, 0, w, h * 0.06);
  relief(ctx, rect(0, h * 0.06, w, 5), { depth: 2 });

  const boxTop = h * 0.1;
  const boxBottom = h * 0.51;
  const latticeTop = h * 0.53;
  const latticeBottom = h * 0.63;
  const lowerBottom = h * 0.875;
  const left = w * 0.3;
  const right = w * 0.7;

  // The imperial box
  arch(ctx, left - 8, right + 8, boxTop + h * 0.1, h * 0.09, 12);
  column(ctx, left, boxTop + h * 0.02, boxBottom, 14);
  column(ctx, right, boxTop + h * 0.02, boxBottom, 14);
  const seats = [0.375, 0.46, 0.545, 0.63].map((k) => w * k);
  const emperor = side === 'south' ? 2 : 1;
  if (side === 'north') {
    seats.forEach((x, i) => standing(ctx, x, boxBottom - 6, h * (i === emperor ? 0.38 : 0.33)));
    labarum(ctx, seats[emperor] + 30, boxTop + h * 0.02, boxBottom - h * 0.06);
  } else {
    seats.forEach((x, i) => seated(ctx, x, boxBottom - 6, h * (i === emperor ? 0.36 : 0.3)));
    if (side === 'east') relief(ctx, ellipse(seats[emperor] + h * 0.07, boxBottom - h * 0.2, h * 0.025, h * 0.03), { depth: 2 });
  }
  // Courtiers and guards to either side, with shields and spears
  crowd(ctx, w * 0.04, w * 0.27, boxBottom - 4, 2, 3, h * 0.03);
  crowd(ctx, w * 0.73, w * 0.96, boxBottom - 4, 2, 3, h * 0.03);
  for (const x of [w * 0.05, w * 0.95]) {
    spear(ctx, x + (x < w / 2 ? 14 : -14), boxTop + h * 0.03, boxBottom - h * 0.16);
    if (side !== 'east') shield(ctx, x, boxBottom - h * 0.11, h * 0.065);
  }

  // The balustrade, with the stair down to the arena on the south side
  lattice(ctx, w * 0.02, latticeTop, w * 0.98, latticeBottom);
  for (const x of [w * 0.02 + 6, left, w / 2, right, w * 0.98 - 6]) post(ctx, x, latticeTop - 8, latticeBottom + 6, 10);
  if (side === 'south') {
    ctx.fillStyle = rgb(MARBLE);
    ctx.fillRect(w * 0.43, latticeTop - 8, w * 0.14, latticeBottom - latticeTop + 16);
    steps(ctx, w / 2, latticeTop - 4, lowerBottom - h * 0.1, w * 0.15, 7);
    standing(ctx, w * 0.405, lowerBottom, h * 0.3);
    standing(ctx, w * 0.595, lowerBottom, h * 0.3);
  }

  // The lower register
  if (side === 'south') {
    crowd(ctx, w * 0.04, w * 0.35, lowerBottom, 2, 4, h * 0.028);
    crowd(ctx, w * 0.65, w * 0.96, lowerBottom, 2, 4, h * 0.028);
    arch(ctx, w * 0.43, w * 0.57, lowerBottom, h * 0.08, 8);
  } else if (side === 'north') {
    crowd(ctx, w * 0.04, w * 0.96, lowerBottom, 2, 11, h * 0.028);
  } else if (side === 'east') {
    organ(ctx, w * 0.04, lowerBottom, w * 0.1, h * 0.2);
    organ(ctx, w * 0.86, lowerBottom, w * 0.1, h * 0.2);
    for (let i = 0; i < 7; i++) standing(ctx, w * (0.2 + i * 0.1), lowerBottom, h * 0.2, { arms: i % 2 ? 'raised' : 'down' });
  } else {
    for (let i = 0; i < 4; i++) kneeling(ctx, w * (0.1 + i * 0.09), lowerBottom, h * 0.18, 1);
    for (let i = 0; i < 5; i++) kneeling(ctx, w * (0.9 - i * 0.09), lowerBottom, h * 0.18, -1);
  }

  // The moulding along the bottom
  relief(ctx, rect(0, lowerBottom + 4, w, 5), { depth: 2 });
  for (let x = 20; x < w; x += 36) {
    relief(ctx, polygon([[x, h * 0.935], [x + 9, h * 0.905], [x + 18, h * 0.935], [x + 9, h * 0.965]]), { depth: 1, width: 1 });
  }
  relief(ctx, rect(0, h * 0.975, w, 5), { depth: 2 });
}

/** The race around the spina: its monuments above, four chariot teams below. */
function paintRaces(ctx, w, h) {
  const spinaY = h * 0.5;
  relief(ctx, rect(w * 0.08, spinaY - 6, w * 0.84, 12));
  for (const x of [w * 0.12, w * 0.88]) {
    for (const dx of [-14, 0, 14]) relief(ctx, polygon([[x + dx, spinaY - 6], [x + dx - 7, spinaY - 6], [x + dx - 3.5, spinaY - h * 0.22]]), { depth: 2 });
  }
  for (const x of [w * 0.22, w * 0.63, w * 0.8]) {
    column(ctx, x, h * 0.26, spinaY - 6, 9);
    standing(ctx, x, h * 0.26, h * 0.1);
  }
  for (const x of [w * 0.32, w * 0.72]) {
    relief(ctx, polygon([[x - 9, spinaY - 6], [x + 9, spinaY - 6], [x + 5, h * 0.2], [x, h * 0.15], [x - 5, h * 0.2]]));
  }
  column(ctx, w * 0.455, h * 0.3, spinaY - 6, 9);
  column(ctx, w * 0.545, h * 0.3, spinaY - 6, 9);
  relief(ctx, polygon([[w * 0.43, h * 0.3], [w * 0.5, h * 0.19], [w * 0.57, h * 0.3]]));
  for (let i = 0; i < 4; i++) quadriga(ctx, w * (0.06 + i * 0.235), h * 0.9, h * 0.3);
}

/** The obelisk hauled to the Hippodrome on its sledge and raised with capstans. */
function paintRaising(ctx, w, h) {
  relief(ctx, polygon([[w * 0.38, h * 0.4], [w * 0.42, h * 0.31], [w * 0.92, h * 0.25], [w * 0.92, h * 0.55], [w * 0.42, h * 0.49]]), { fill: 'rgb(226, 206, 196)' });
  relief(ctx, rect(w * 0.42, h * 0.55, w * 0.5, h * 0.035));
  relief(ctx, (c) => { c.ellipse(w * 0.93, h * 0.42, w * 0.03, h * 0.17, 0, -Math.PI / 2, Math.PI / 2); c.lineTo(w * 0.92, h * 0.59); c.lineTo(w * 0.92, h * 0.25); c.closePath(); });
  for (const x of [w * 0.5, w * 0.58, w * 0.66]) standing(ctx, x, h * 0.29, h * 0.17);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  for (const dy of [-6, 6]) line(ctx, w * 0.38, h * 0.4 + dy, w * 0.21, h * 0.42 + dy);
  capstan(ctx, w * 0.19, h * 0.44, h * 0.07);
  for (const x of [w * 0.1, w * 0.28]) standing(ctx, x, h * 0.5, h * 0.17);
  line(ctx, w * 0.04, h * 0.69, w * 0.78, h * 0.69);
  for (let i = 0; i < 11; i++) standing(ctx, w * (0.06 + i * 0.066), h * 0.92, h * 0.26, { arms: i % 3 === 1 ? 'raised' : 'down' });
  capstan(ctx, w * 0.86, h * 0.84, h * 0.08);
  standing(ctx, w * 0.95, h * 0.92, h * 0.24);
}

/** An inscription in a tabula ansata, letters cut into the marble. */
function paintInscription(ctx, w, h, lines, font, fonts) {
  const x0 = w * 0.165;
  const x1 = w * 0.835;
  const y0 = h * 0.08;
  const y1 = h * 0.78;
  const fieldH = y1 - y0;
  ctx.fillStyle = 'rgba(70, 58, 48, 0.05)';
  ctx.fillRect(x0, y0, x1 - x0, fieldH);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.4;
  ctx.strokeRect(x0, y0, x1 - x0, fieldH);
  ctx.lineWidth = 1.3;
  ctx.strokeRect(x0 + 8, y0 + 8, x1 - x0 - 16, fieldH - 16);
  for (const side of [-1, 1]) {
    const edge = side < 0 ? x0 : x1;
    const tip = edge + side * w * 0.055;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(edge, y0 + fieldH * 0.18);
    ctx.lineTo(tip, y0 + fieldH * 0.02);
    ctx.lineTo(tip, y1 - fieldH * 0.02);
    ctx.lineTo(edge, y1 - fieldH * 0.18);
    ctx.stroke();
  }
  if (!fonts) return;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0.07em';
  ctx.font = `100px ${font}`;
  const widest = Math.max(...lines.map((text) => ctx.measureText(text).width));
  const size = Math.min(((x1 - x0) * 0.9 * 100) / widest, (fieldH * 0.84) / (lines.length * 1.25));
  ctx.font = `${size.toFixed(1)}px ${font}`;
  const lineH = size * 1.25;
  const top = (y0 + y1) / 2 - (lineH * (lines.length - 1)) / 2;
  lines.forEach((text, i) => {
    const y = top + i * lineH;
    ctx.fillStyle = LETTER_LIGHT;
    ctx.fillText(text, w / 2 + 1.5, y + 1.5);
    ctx.fillStyle = LETTER;
    ctx.fillText(text, w / 2, y);
  });
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
}

/** Lower block, 3.5 × 1.15 m. The field runs the full height; the arcaded block above stands on its top. */
function paintLowerPanel(ctx, w, h, side, rnd, fonts) {
  marble(ctx, w, h, rnd);
  if (side === 'south') paintRaces(ctx, w, h);
  else if (side === 'north') paintRaising(ctx, w, h);
  else if (side === 'east') paintInscription(ctx, w, h, LATIN_INSCRIPTION, LATIN_FONT, fonts);
  else paintInscription(ctx, w, h, GREEK_INSCRIPTION, GREEK_FONT, fonts);
  ctx.fillStyle = 'rgba(70, 58, 48, 0.06)';
  ctx.fillRect(0, h * 0.94, w, h * 0.06);
  relief(ctx, rect(0, h * 0.935, w, 5), { depth: 2 });
}

/** The block between pedestal and base: a row of arched niches, the backdrop to the porphyry stones. */
function paintArcade(ctx, w, h, rnd) {
  marble(ctx, w, h, rnd);
  const count = 13;
  const step = w / count;
  for (let i = 0; i < count; i++) {
    const cx = step * (i + 0.5);
    const r = step * 0.34;
    const bottom = h * 0.9;
    const spring = h * 0.42;
    const gradient = ctx.createLinearGradient(0, spring - r, 0, bottom);
    gradient.addColorStop(0, 'rgba(60, 50, 42, 0.42)');
    gradient.addColorStop(1, 'rgba(60, 50, 42, 0.12)');
    ctx.fillStyle = gradient;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - r, bottom);
    ctx.lineTo(cx - r, spring);
    ctx.arc(cx, spring, r, Math.PI, 0);
    ctx.lineTo(cx + r, bottom);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  relief(ctx, rect(0, h * 0.06, w, 6), { depth: 2 });
  relief(ctx, rect(0, h * 0.9, w, 6), { depth: 2 });
}

// ---------- the set ----------

let art = null;

/** Every texture of the detailed obelisk, painted on first use and shared afterwards. */
export function obeliskArt() {
  if (art) return art;
  const seeded = (name, paint) => (ctx, w, h, fonts) => paint(ctx, w, h, createRandom(hashString(name)), fonts);
  art = {
    faces: OBELISK_FACES.map((face) => paintedTexture(512, 4096, seeded(`face-${face.name}`, (ctx, w, h, rnd, fonts) => {
      granite(ctx, w, h, rnd);
      paintColumn(ctx, w, h, face, fonts);
    }), { text: true })),
    upper: Object.fromEntries(SIDES.map((side) => [side, paintedTexture(1024, 700, seeded(`upper-${side}`, (ctx, w, h, rnd) => paintUpperPanel(ctx, w, h, side, rnd)))])),
    lower: Object.fromEntries(SIDES.map((side) => [side, paintedTexture(1400, 460, seeded(`lower-${side}`, (ctx, w, h, rnd, fonts) => paintLowerPanel(ctx, w, h, side, rnd, fonts)), { text: side === 'east' || side === 'west' })])),
    arcade: paintedTexture(1024, 256, seeded('arcade', paintArcade)),
    pyramidion: paintedTexture(256, 256, seeded('pyramidion', granite)),
    porphyry: paintedTexture(256, 256, seeded('porphyry', porphyry), { tile: true }),
  };
  return art;
}

// Tests the site on an Android phone on USB, driving its Chrome over the DevTools protocol: a fresh
// browser, the introduction with "Enter the City" pressed while the city is still building, the map
// left running, then a tour into and out of dioramas. Reports WebGL context loss (a GPU driver crash),
// frame rates, the longest main-thread stalls and anything the page logged as an error.
// See scripts/device.sh, which builds and serves the site and runs this.
//
//   node scripts/device.mjs <outDir> [options]
//
//   --trial=1                 a name for this run: writes <outDir>/t<trial>.json and t<trial>-*.png
//   --port=4500               the port the site is served on, reversed to the phone
//   --map-wait=30000          ms to watch the map before the tour
//   --tour=id,id              landmarks to open and close (default: a mix of large dioramas)
//
// Needs adb and a phone with USB debugging on. The phone's screen would turn off after its timeout,
// since these commands don't count as use, and Chrome throttles a page on a dark screen: so a key
// press keeps it awake every 10 s. LEARNINGS.md has the background ("How to diagnose a device GPU crash").
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const opts = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => { const [key, value = true] = a.slice(2).split('='); return [key, value]; }));
const outDir = resolve(args.find((a) => !a.startsWith('--')) ?? 'device');
const trial = opts.trial ?? '1';
const port = +(opts.port ?? 4500);
const url = `http://localhost:${port}/`;
const TOUR = ['theodosian-harbour', 'harbour-of-julian', 'neorion', 'holy-apostles', 'chora', 'st-irene', 'pantokrator', 'sergius-bacchus', 'genoese-quarter', 'theodosian-walls'];
const tour = opts.tour ? opts.tour.split(',') : TOUR;
const mapWait = +(opts['map-wait'] ?? 30000);
mkdirSync(outDir, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const adb = (cmd) => execSync(`adb ${cmd}`, { encoding: 'utf8' });

// A fresh browser every run: after a GPU crash Chrome blocks WebGL for the site until restarted.
// Keep the screen on: a page on a dark screen is throttled, and every wait would time out. A key press
// every 10 s counts as use, without touching the phone's settings.
adb('shell input keyevent KEYCODE_WAKEUP');
const awake = setInterval(() => { try { adb('shell input keyevent KEYCODE_WAKEUP'); } catch {} }, 10000);
adb('shell am force-stop com.android.chrome');
await sleep(1000);
adb('shell am start -n com.android.chrome/com.google.android.apps.chrome.Main -d about:blank');
await sleep(3000);
adb('forward tcp:9222 localabstract:chrome_devtools_remote');
adb(`reverse tcp:${port} tcp:${port}`);

let version;
for (let i = 0; i < 30 && !version; i++) {
  try { version = await (await fetch('http://localhost:9222/json/version')).json(); } catch { await sleep(500); }
}
const ws = new WebSocket(version.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let nextId = 1;
const pending = new Map();
const events = [];
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  else if (msg.method === 'Runtime.exceptionThrown') events.push(`[page error] ${msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text}`);
  else if (msg.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(msg.params.type)) events.push(`[console.${msg.params.type}] ${msg.params.args.map((a) => a.value ?? a.description).join(' ').slice(0, 300)}`);
  else if (msg.method === 'Inspector.targetCrashed') events.push('[target crashed]');
};
const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
  const id = nextId++;
  pending.set(id, (msg) => (msg.error ? reject(new Error(`${method}: ${JSON.stringify(msg.error)}`)) : resolve(msg.result)));
  ws.send(JSON.stringify({ id, method, params, sessionId }));
});
const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
const s = (method, params) => send(method, params, sessionId);
await s('Page.enable');
await s('Runtime.enable');
await s('Inspector.enable').catch(() => {});
await s('Page.addScriptToEvaluateOnNewDocument', { source: `
  localStorage.setItem('constantinople.skipIntro', '0');
  localStorage.setItem('constantinople.language', 'en');
  window.__probe = { t0: performance.now(), lost: [], restored: 0, longtasks: [], frames: 0 };
  addEventListener('webglcontextlost', () => window.__probe.lost.push(Math.round(performance.now() - window.__probe.t0)), true);
  addEventListener('webglcontextrestored', () => window.__probe.restored++, true);
  new PerformanceObserver((list) => { for (const e of list.getEntries()) window.__probe.longtasks.push([Math.round(e.startTime - window.__probe.t0), Math.round(e.duration)]); }).observe({ type: 'longtask', buffered: true });
  const tick = () => { window.__probe.frames++; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
` });
await s('Page.navigate', { url });

const evaluate = async (expression) => (await s('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result.value;
async function waitFor(expression, timeout = 180000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await evaluate(expression).catch(() => false)) return true;
    await sleep(300);
  }
  return false;
}
const shot = async (name) => {
  const { data } = await s('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(outDir, `t${trial}-${name}.png`), Buffer.from(data, 'base64'));
};
const lost = async () => (await evaluate('window.__probe.lost.length')) > 0;
const report = { trial };

// The intro: click "Enter the City" a second after it appears, while the city is still building.
await waitFor("Boolean(document.querySelector('.intro__enter'))", 60000);
await sleep(1000);
let started = Date.now();
await evaluate("document.querySelector('.intro__enter').click(); true");
report.introClickMs = Date.now() - started;
started = Date.now();
report.loaded = await waitFor("document.querySelector('#loading').classList.contains('is-done')");
report.loadAfterClickMs = Date.now() - started;
report.gpu = await evaluate("(() => { const gl = window.__app.renderer.getContext(); const i = gl.getExtension('WEBGL_debug_renderer_info'); return i ? gl.getParameter(i.UNMASKED_RENDERER_WEBGL) : '?'; })()");
report.triangles = await evaluate('window.__app.mapView.renderer.info.render.triangles');
report.visible = await evaluate('document.visibilityState');
await sleep(3000);
await shot('map');

// The map left running.
const f0 = await evaluate('window.__probe.frames');
await sleep(mapWait);
report.mapFps = ((await evaluate('window.__probe.frames')) - f0) / (mapWait / 1000);
report.lostOnMap = await lost();

// A tour of dioramas, back to the map after each: frees and re-uploads the shared textures on a phone.
report.tour = [];
for (const id of tour) {
  if (await lost()) break;
  await waitFor('!window.__app.busy', 30000);
  const t = Date.now();
  await evaluate(`window.__app.openLandmark('${id}').then(() => true)`);
  await waitFor(`window.__app.openId === '${id}' && !window.__app.busy`, 60000);
  const openMs = Date.now() - t;
  await sleep(2500);
  const f = await evaluate('window.__probe.frames');
  await sleep(4000);
  const fps = ((await evaluate('window.__probe.frames')) - f) / 4;
  if (tour.indexOf(id) % 3 === 0) await shot(id);
  const back = Date.now();
  await evaluate('window.__app.closeLandmark().then(() => true)');
  await waitFor("window.__app.mode === 'map' && !window.__app.busy", 60000);
  const backMs = Date.now() - back;
  await sleep(1500);
  report.tour.push({ id, openMs, fps: +fps.toFixed(1), backMs, lost: await lost() });
}

const probe = await evaluate('window.__probe');
report.contextLost = probe.lost;
report.longestTasks = probe.longtasks.sort((a, b) => b[1] - a[1]).slice(0, 6);
report.events = events.slice(0, 20);
console.log(JSON.stringify(report, null, 1));
writeFileSync(join(outDir, `t${trial}.json`), JSON.stringify(report, null, 1));
clearInterval(awake);
ws.close();
process.exit(0);

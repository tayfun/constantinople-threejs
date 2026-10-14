// Headless screenshots of the map and the dioramas, driven over the Chrome DevTools protocol.
// See scripts/screenshots.sh, which builds and serves the site and then runs this.
//
//   node scripts/screenshot.mjs <outDir> [map | all | landmark ids…] [options]
//
//   --url=http://localhost:4173/   the site to open
//   --port=9333                    Chrome's debugging port
//   --width=1440 --height=900      the window (use 390×844 for a phone)
//   --settle=6000                  ms to wait after each scene is ready, for the camera flight and the entrance tween
//   --skip=id,id                   landmarks left out of 'all'
//   --views=name:x,y,z,tx,ty,tz;…  extra map views: camera position and target in map units
//   --console=1                    echo the page's console output
//   --intro=1                      keep the introduction, click "Enter the City" as soon as it appears, and report
//                                  how long the click took to be handled (a stalled main thread makes it wait)
//
// Writes <outDir>/map.png, <outDir>/<landmark id>.png and <outDir>/<view name>.png, and prints
// '[page error] …' for anything the page throws. Chrome renders with SwiftShader, so a run takes
// a few seconds per picture.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const opts = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')));
const positional = args.filter((a) => !a.startsWith('--'));
const outDir = resolve(positional[0] ?? 'screenshots');
const targets = positional.slice(1);
const width = +(opts.width ?? 1440);
const height = +(opts.height ?? 900);
const url = opts.url ?? 'http://localhost:4173/';
const port = +(opts.port ?? 9333);
const settle = +(opts.settle ?? 6000);
mkdirSync(outDir, { recursive: true });

const ALL = ['hagia-sophia', 'hippodrome', 'obelisk-of-theodosius', 'serpent-column', 'walled-obelisk', 'great-palace', 'judas-tree',
  'basilica-cistern', 'forum-of-constantine', 'aqueduct-of-valens', 'blachernae', 'theodosian-walls', 'venetian-quarter', 'horn-chain',
  'dromon', 'galata-tower', 'genoese-quarter', 'chrysopolis', 'chalcedon', 'theodosian-harbour', 'harbour-of-julian', 'neorion',
  'st-irene', 'holy-apostles', 'pantokrator', 'chora', 'sergius-bacchus'];

// --enable-automation sets navigator.webdriver, which keeps Sentry from reporting these runs.
const chrome = spawn('google-chrome', [
  '--headless=new', '--enable-automation', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--disable-gpu-sandbox',
  `--remote-debugging-port=${port}`, `--window-size=${width},${height}`, '--hide-scrollbars', `--user-data-dir=${join(outDir, '.profile')}`,
  'about:blank',
], { stdio: 'ignore' });
process.on('exit', () => chrome.kill());
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getWsUrl() {
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(`http://localhost:${port}/json/version`);
      return (await res.json()).webSocketDebuggerUrl;
    } catch { await sleep(200); }
  }
  throw new Error('chrome did not start');
}

const ws = new WebSocket(await getWsUrl());
await new Promise((r) => (ws.onopen = r));
let nextId = 1;
const pending = new Map();
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  else if (msg.method === 'Runtime.consoleAPICalled' && opts.console) console.log('[page]', msg.params.args.map((a) => a.value ?? a.description).join(' '));
  else if (msg.method === 'Runtime.exceptionThrown') console.log('[page error]', msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text);
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
await s('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
// Skip the introduction and use English, so every run starts the same way.
await s('Page.addScriptToEvaluateOnNewDocument', { source: `localStorage.setItem('constantinople.skipIntro', '${opts.intro ? '0' : '1'}'); localStorage.setItem('constantinople.language', 'en');` });
await s('Page.navigate', { url });

const evaluate = async (expression) => (await s('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result.value;
async function waitFor(expression, timeout = 120000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await evaluate(expression)) return;
    await sleep(300);
  }
  throw new Error(`timeout waiting for ${expression}`);
}
async function shot(name) {
  const { data } = await s('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(outDir, `${name}.png`), Buffer.from(data, 'base64'));
  console.log('saved', name);
}

if (opts.intro) {
  // Click the introduction's button the moment it exists. A page whose build hogs the main thread
  // answers neither the click nor this call until the build is done, so the time measures responsiveness.
  await waitFor("Boolean(document.querySelector('.intro__enter'))", 60000);
  await sleep(300); // let the build start
  const started = Date.now();
  await evaluate("document.querySelector('.intro__enter').click(); true");
  console.log(`intro click handled after ${Date.now() - started} ms`);
}
await waitFor("document.querySelector('#loading').classList.contains('is-done')");
await sleep(settle);
if (!targets.length || targets.includes('map')) await shot('map');

const skipped = (opts.skip ?? '').split(',');
const ids = targets.includes('all') ? ALL.filter((id) => !skipped.includes(id)) : targets.filter((t) => t !== 'map');
for (const id of ids) {
  // The app ignores clicks while a camera flight is under way, so wait for it to be idle and insist.
  await waitFor('!window.__app.busy');
  for (let attempt = 0; attempt < 10; attempt++) {
    await evaluate(`document.querySelector('[data-landmark="${id}"]').click(); true`);
    await sleep(500);
    if (await evaluate(`window.__app.openId === '${id}' || window.__app.busy`)) break;
  }
  await waitFor(`window.__app.openId === '${id}' && !window.__app.busy && !document.querySelector('#fade').classList.contains('is-visible')`);
  await sleep(settle);
  await shot(id);
  await evaluate("document.querySelector('#back-button').click(); true");
  await waitFor("window.__app.mode === 'map' && !window.__app.busy");
  await sleep(500);
}
if (opts.views) {
  for (const spec of opts.views.split(';')) {
    const [name, nums] = spec.split(':');
    const [x, y, z, tx, ty, tz] = nums.split(',').map(Number);
    // A block of its own: a second top-level `const view` would throw, and the camera would stay put.
    await evaluate(`{ const view = window.__app.mapView; view.camera.position.set(${x}, ${y}, ${z}); view.controls.target.set(${tx}, ${ty}, ${tz}); view.controls.update(); view.dirty = true; } true`);
    await sleep(settle);
    await shot(name);
  }
}
ws.close();
chrome.kill();
process.exit(0);

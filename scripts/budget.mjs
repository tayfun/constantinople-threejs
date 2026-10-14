// Checks the city against its budgets: triangles per asset (each landmark's map and detail model, the
// terrain, the town fabric and its parts, the shipping), and how long each stage of the map's build
// holds the main thread. Built in Node with a stubbed document, the way scripts/coplanar.mjs does.
//
//   node scripts/budget.mjs [--tier=low] [--verbose] [--strict-time]
//
// Prints a table (each landmark's rows only with --verbose or when over) and exits with status 1 if
// any triangle count is over budget. Slow build stages are warned about (⚠): times are Node's, a
// little faster than a browser's on the same machine but at the mercy of whatever else it is doing,
// so they fail the check only with --strict-time. A stage over STAGE_MS can still freeze the loading
// screen's "Enter the City" button, since clicks wait until it is done.
//
// The town is laid out without the landmarks' keep-out areas, so its counts run a few per cent above
// what the browser builds.

const args = process.argv.slice(2);
const opts = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => { const [key, value = true] = a.slice(2).split('='); return [key, value]; }));
const lowTier = opts.tier === 'low';

// Limits, in triangles. Whole-map limits come first; a new landmark gets the per-landmark ones.
const BUDGET = {
  map: 1_250_000, // everything on the map at once: landmarks, terrain, town fabric, ships
  fabric: 700_000, // houses, churches, trees, plots, walls
  houses: 400_000,
  trees: 200_000,
  landmarkMap: 40_000, // each landmark's map model
  landmarkDetail: 250_000, // each diorama
};
const STAGE_MS = 400; // a build stage holding the main thread longer than this is flagged

// Stub enough of the DOM for the painted textures and the quality probe.
const ctx = new Proxy({}, {
  get: (_, key) => (key === 'createRadialGradient' || key === 'createLinearGradient') ? () => ({ addColorStop() {} })
    : key === 'measureText' ? () => ({ width: 10 }) : key === 'getImageData' ? () => ({ data: new Uint8ClampedArray(4) }) : () => {},
  set: () => true,
});
globalThis.document = {
  createElement: () => ({ width: 0, height: 0, getContext: () => ctx, style: {} }),
  createElementNS: () => ({ style: {} }),
  fonts: { check: () => true, load: () => Promise.resolve() },
};
globalThis.window = {
  devicePixelRatio: 1,
  matchMedia: (query) => ({ matches: lowTier && query.includes('coarse') }),
  innerWidth: 1000,
  innerHeight: 800,
  addEventListener() {},
};

const { LANDMARKS } = await import('../js/data/landmarks.js');
const { createGround } = await import('../js/world/ground.js');
const { createTerrain } = await import('../js/world/terrain.js');
const { createCityFabric } = await import('../js/world/cityFabric.js');
const { createShipping } = await import('../js/world/shipping.js');

/** Triangles drawn for an object and everything under it, instances counted. */
function triangles(root) {
  let total = 0;
  root.traverse((object) => {
    if (!object.isMesh) return;
    const geometry = object.geometry;
    const count = (geometry.index ? geometry.index.count : geometry.attributes.position.count) / 3;
    total += count * (object.isInstancedMesh ? object.count : 1);
  });
  return total;
}

function timed(build) {
  const start = performance.now();
  const result = build();
  return [result, performance.now() - start];
}

const rows = [];
const check = (name, value, limit, kind = 'triangles', detail = false) => rows.push({ name, value, limit, kind, detail, over: limit !== undefined && value > limit });

// The ground first: map models that climb it (userData.onGround) finish themselves on it, as in mapView.js.
const [ground, groundMs] = timed(() => createGround());
check('  build ground', groundMs, STAGE_MS, 'ms');

let mapTotal = 0;
for (const landmark of LANDMARKS) {
  const [model, ms] = timed(() => {
    const built = landmark.create({ lod: 'map' });
    const climbing = [];
    built.traverse((object) => { if (object.userData.onGround) climbing.push(object); });
    for (const object of climbing) object.userData.onGround(ground);
    return built;
  });
  const count = triangles(model);
  mapTotal += count;
  check(`${landmark.id} (map)`, count, BUDGET.landmarkMap, 'triangles', true);
  check(`  build ${landmark.id}`, ms, STAGE_MS, 'ms', true);
  check(`${landmark.id} (detail)`, triangles(landmark.create({ lod: 'detail' })), BUDGET.landmarkDetail, 'triangles', true);
}

const [terrain, terrainMs] = timed(() => createTerrain(ground));
check('terrain', triangles(terrain));
check('  build terrain', terrainMs, STAGE_MS, 'ms');
const [fabric, fabricMs] = timed(() => createCityFabric({ ground }));
check('town fabric', triangles(fabric), BUDGET.fabric);
check('  build town fabric', fabricMs, STAGE_MS, 'ms');
// The fabric's parts, told apart by what their meshes draw: the churches are a named group, the
// houses everything else painted from the town atlas, the trees the rest with vertex colours.
const parts = { houses: 0, churches: 0, trees: 0, other: 0 };
fabric.traverse((object) => {
  if (!object.isMesh) return;
  const count = triangles(object);
  if (object.parent?.name === 'churches') parts.churches += count;
  else if (object.material.vertexColors && object.material.map) parts.houses += count;
  else if (object.material.vertexColors) parts.trees += count;
  else parts.other += count;
});
check('  houses', parts.houses, BUDGET.houses);
check('  churches', parts.churches);
check('  trees', parts.trees, BUDGET.trees);
check('  plots, trunks, walls, the rest', parts.other);
const [shipping, shippingMs] = timed(() => createShipping());
check('shipping', triangles(shipping));
check('  build shipping', shippingMs, STAGE_MS, 'ms');
mapTotal += triangles(terrain) + triangles(fabric) + triangles(shipping);
check('MAP TOTAL', mapTotal, BUDGET.map);

const show = (value, kind) => (kind === 'ms' ? `${value.toFixed(0)} ms` : value.toLocaleString('en'));
// Each landmark's rows are shown only with --verbose, or when over budget.
const wanted = rows.filter((row) => opts.verbose || row.over || !row.detail);
console.log(`Budget check (${lowTier ? 'low' : 'high'} tier)\n`);
for (const { name, value, limit, kind, over } of wanted) {
  const mark = !over ? ' ' : kind === 'ms' && !opts['strict-time'] ? '⚠' : '✗';
  console.log(`${mark} ${name.padEnd(36)} ${show(value, kind).padStart(12)}${limit !== undefined ? `  / ${show(limit, kind)}` : ''}`);
}
const failures = rows.filter((row) => row.over && (row.kind !== 'ms' || opts['strict-time']));
const slow = rows.filter((row) => row.over && row.kind === 'ms' && !opts['strict-time']);
if (slow.length) console.log(`\n${slow.length} build stage(s) slow; rerun on a quiet machine before worrying.`);
console.log(failures.length ? `\n${failures.length} over budget.` : '\nAll within budget.');
process.exit(failures.length ? 1 : 0);

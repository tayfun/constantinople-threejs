# Learnings

What building Constantinople taught us, written for the next project
(Pepys-era London). Only lessons that cost real time or drew repeated
corrections are here.

## Mobile WebGL

The site crashed on a Pixel 10 Pro (PowerVR D-Series DXT, Chrome on
Android). Most of the time went into fixes that did nothing.

- **The symptom.** The city draws for a moment, then the page reports
  "Web page caused context loss and was blocked". After that, Chrome refuses
  WebGL for the **whole site** until the browser is fully restarted (swipe it
  away, or `adb shell am force-stop com.android.chrome`). Reloading doesn't
  help, and even a blank test canvas gets no context.
  - Always catch renderer creation failure. Show a "close the browser
    completely and reopen it" message instead of a generic error.
  - Force-stop Chrome before every test run on the device.
- **Root cause 1: `THREE.PCFShadowMap`.** It reset this GPU about 33–35
  frames after load, every time. The count was in frames, not seconds.
  three.js's own `webgl_shadowmap` example crashed in the same way.
  `PCFSoftShadowMap`, `BasicShadowMap` and `VSMShadowMap` all ran fine, so use
  `PCFSoftShadowMap` on every tier.
- **Root cause 2: bump maps sampled under live shadows.** A `bumpMap` on a
  material in a scene whose shadow map redraws every frame reset the GPU
  within seconds. Here that was the obelisks' carving next to the animated
  chariots. Leave out bump and normal maps on the low tier.
- **Disabling shadows is not the same as skipping the shadow pass.** Skipping
  only the depth-pass draws still crashed. `shadowMap.enabled = false` fixed
  it. The fault was in *sampling* the shadow map in the main shader.
- **Hypotheses that were wrong.** Each led to a commit that didn't fix the
  crash:
  - **GPU memory.** Measured in headless SwiftShader, it looked like the
    culprit. On the device it levelled off at about 200–236 MB.
  - **Too many triangles for the tiled GPU.** The crash happened at 148k
    triangles and not at 383k.

  Cutting texture size and tree count is still worth doing for frame rate. It
  just wasn't the fix. (The header comment in `js/util/quality.js` still
  gives the disproven triangle and memory reasons.)
- **Don't trust the first error in the log after a context loss.** ANGLE
  logged `generateMipmap … Unexpected driver error` and texture-upload
  failures. Those were side effects of the GPU reset, not the cause.
- **Put every risky GPU feature behind a quality flag in one place**
  (`quality.js`):
  - shadow filter type and map size
  - bump/normal maps
  - pixel ratio cap (1 on phones)
  - texture scale
  - vegetation density
  - freeing dioramas on leave

  Choose the tier with `(pointer: coarse)`. `deviceMemory` and
  `hardwareConcurrency` don't help: the Pixel reports 8 GB and 12 cores.
- **Handle context loss.** Report it to Sentry with the GPU name
  (`WEBGL_debug_renderer_info`) and what was on screen. three.js already calls
  `preventDefault`. On `webglcontextrestored`, mark shadows dirty, because
  with `shadowMap.autoUpdate = false` nothing redraws them otherwise.

### How to diagnose a device GPU crash

Emulation can't reproduce driver faults. Put a real phone on USB as soon as
a crash appears, before changing any scene content. Once that was set up,
the root cause took about 40 minutes, after hours of guessing.

- `adb reverse tcp:5173 tcp:5173` lets the phone load the Vite dev server.
- `adb forward tcp:9222 localabstract:chrome_devtools_remote` gives you CDP
  from a Node script: console output, exceptions and `webglcontextlost`.
- Attach before the page loads: open `about:blank`, call
  `Page.addScriptToEvaluateOnNewDocument`, then navigate. Otherwise the crash
  happens before the probe is there.
- Bisect with an injected probe that wraps `WebGL2RenderingContext.prototype`:
  - tag each linked program by its `#define`s (`USE_SHADOWMAP`,
    `USE_BUMPMAP`, …);
  - skip draws by program to find the shader that triggers the crash.
- Lock the renderer settings you're testing with `Object.defineProperty`, so
  the app can't overwrite them. Log the active configuration from inside the
  page; twice an experiment silently never applied.
- Run 3+ trials per configuration. Single runs gave contradictory results.
  The adb server also drops port forwards silently, so recreate them on
  every run.
- Run the three.js examples on the device as a control.
- `adb logcat` (filter for gpu/context) and `adb shell dumpsys gpu --gpumem`
  for GPU memory.

## Rendering and performance

- **The sun doesn't move, so don't redraw shadows every frame.** Set
  `shadowMap.autoUpdate = false` and set `needsUpdate` only when the scene
  changes (timeline, new diorama, moving parts on stage).
- **Render on demand where possible.** Use the return value of
  `OrbitControls.update()` plus a dirty flag. Honour `prefers-reduced-motion`.
- **Merge static meshes per material and instance repeated things.** Houses,
  trees and chain links are instanced. Two gotchas:
  - The merge helper must keep every attribute its materials use. It dropped
    vertex colours until fixed.
  - It must leave separate anything clickable or animated (`userData`).
    Otherwise sub-monuments dissolve into their host.
- **An InstancedMesh whose instances move needs `frustumCulled = false`.**
  Otherwise its bounding sphere is stale and it vanishes.
- **Vegetation blows the triangle budget quietly.** Prettier trees took the
  map from 735k to 1.2M triangles, and one photo-faithful tree costs 26–30k.
  Set a per-asset budget, and keep a coarse map LOD separate from the detail
  build.
- **Large canvas textures dominate GPU memory.** Paint at full size and
  upload a downscaled copy on phones, so the strokes keep their proportions.
  Free a diorama's geometries and textures when you leave it, but keep its
  materials, since recompiling shaders is slow.
- **`metalness: 1` with no environment map renders near-black.** Use about
  0.5 metalness or add a PMREM environment.
- **A tint that multiplies a texture can only darken it.**
- **Layered ground (land, hills, streets) needs `polygonOffset`.** Use
  deeper negative factors for higher layers (−2, −4, −6).

## Geography and scale

- **Start from real data, never coastlines from memory.**
  - Pull coast and walls from OSM Overpass and project them to local metres
    from a central origin.
  - Plot them against the reference before writing them into code.
  - Put back the historical shoreline. For London that means the Thames
    before the 1860s embankments, the Fleet still open, and no later docks.
- **Don't warp the whole map to bring landmarks closer.** A global squeeze
  bent the waterways and drew a complaint. What worked:
  - true-scale coasts;
  - landmarks drawn 2.5–6× true size;
  - a local `magnify()` around the dense core that fades back to true scale
    within about 2 km.
- **Exaggerated models collide with reality.** Script the checks and rerun
  them after any size change:
  - landmark footprints overlapping each other or hanging over the coast;
  - ship paths crossing land. An 8× dromon was wider than the Golden Horn.

  Place a waterfront model with its river wall *on* the shoreline, not by its
  centre point.
- **Small real features vanish at map scale.** Lions, chain links and Medusa
  heads all needed 2–8× exaggeration and pale, contrasting materials.
- **Use one `heightAt()` for everything that sits on the ground.** Level a
  terrace under each landmark and sink buildings slightly so none float.
  Rivers and hills (Ludgate, Tower Hill) need this from day one.
- **Detail dioramas must not turn into islands.** Put water only beyond the
  authored shore, with land running to the plinth edge on the landward side.
- **Two unit systems: models in metres, map at 1 unit = 100 m.** Textures and
  point lights sized in metres break when used directly in map units.

## Modelling and accuracy

- **Fetch reference photos before modelling anything real** (the Wikimedia
  Commons API works). The Judas tree took three attempts and Galata Tower
  two, ending only when they were built from photos. The user notices when a
  famous building "does not resemble" itself.
- **The map version and the detail version must look alike:** same massing,
  silhouette, signature features and colours. "Keep the map LOD light"
  produced map models at 4–50% of detail and drew a complaint. Share builder
  code between the two.
- **Design materials for how they read from map distance.** Tiled masonry
  averages to beige, and landmarks blended into the houses. Give each
  material a distinct average colour.
- **Filler town fabric needs a planner, not random scatter.** Use districts,
  block grids aligned to main streets or the shore, houses along block edges,
  a narrow palette, calm ground textures, and rotated-footprint keep-outs.
- **Flag invented or uncertain details, and facts written from memory, to the
  user.** Put `period {from, to, how it ended}` in the landmark data from the
  start. The timeline was added later. For London, 1665–1666 (plague, Fire)
  is the obvious pivot, with before and after states.

## Interaction and UI

- **Anything labelled must be clickable.** This came up as three separate
  requests. Nested monuments need to be their own pickable objects, and Back
  must go up one level (diorama → host), not straight to the map.
- **Slender objects need screen-space picking:** project the bounding box and
  add an 18 px margin. Raycasts miss them.
- **CSS2DRenderer gotchas:**
  - Labels sit above the UI panels unless the label layer is its own stacking
    context (`z-index: 0`).
  - Labels with pointer events swallow the wheel. Re-dispatch the
    `WheelEvent` to the canvas.
- **Test label colours over land, water and roofs early.** The colour took
  three rounds; it ended as deep blue with a light parchment halo.
- **Centre the scene beside side panels with `camera.setViewOffset`,** not by
  resizing the canvas.
- **Diorama framing:** compute the distance from the bounding sphere and the
  narrower FOV. Check that OrbitControls `maxDistance` doesn't clamp it, start
  fog beyond the model, and aim tall models at mid-height.
- **Plan the phone layout up front, with a corner for each group of
  controls.** Hide the corner buttons while an info panel is open. Animate
  `<details>` accordions; native ones snap open and shut.
- **Browsers block audio autoplay.** Retry playback on the first click or key
  press.

## Tooling and process

- **Use Vite from the start.** `vite build` *is* a static build. The buildless
  start meant about 70 requests and stale-module cache bugs under
  `python -m http.server`.
- **Add `?landmark=` and camera URL parameters from day one.** Headless tests
  had to click through the sidebar, which was fragile.
- **Headless screenshots:**
  - Run `google-chrome --headless=new --use-angle=swiftshader
    --enable-unsafe-swiftshader --remote-debugging-port=…`, driven over CDP,
    and wait for the loading overlay to clear. `--screenshot` with a virtual
    time budget only captured the loading screen.
  - SwiftShader manages about 1–2 fps, so wait out camera flights.
  - Check at 1440×900 and 390×844.
  - Good for layout. Useless for GPU faults or performance.
- **Verify by measuring** (distances between labels, `scrollHeight` against
  `clientHeight`), not by pixel diffs. The water and ships never hold still.
- **Import model modules in Node with a stubbed `document`/canvas** to
  script triangle counts, footprint overlaps and terrain checks.
- **Parallel agents work if each owns its files, build `outDir`, preview port
  and debug port.** Use `--strictPort`; leftover preview servers served the
  wrong page.
- **Sentry:**
  - Put `@sentry/vite-plugin` last, with `sourcemap: 'hidden'` and delete the
    maps after upload.
  - It uploads a release on *every* build. For throwaway builds, use
    `SENTRY_AUTH_TOKEN= npx vite build --outDir <scratch>`.
- **i18n:** keep all text in per-language files keyed by id. Script a
  key-parity check, since a missing key crashed the app. Set `<html lang>`
  so uppercase Turkish İ renders correctly.

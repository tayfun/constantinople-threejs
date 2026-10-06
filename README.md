# Constantinople — Queen of Cities

An interactive 3D map of Byzantine Constantinople, Pera/Galata and Chalcedon,
built with three.js. Every model is procedural (no asset files). Click a
landmark, on the map or in the sidebar, to fly in and open a detailed
diorama of it with its history.

## Run

The site is bundled with [Vite](https://vitejs.dev), which ships three.js,
the app and its styles as one minified file (about 190 KB compressed) and
splits each language's text into its own file, fetched only when it is used.

```sh
npm install
npm run dev       # development server with live reload, http://localhost:5173
npm run build     # production build in dist/, ready for any static host
npm run preview   # serves dist/ locally to check the build
```

The fonts load from Google Fonts, so you need to be online. The
Obelisk of Theodosius sets its hieroglyphs in Noto Sans Egyptian Hieroglyphs
and its pedestal inscriptions in Cinzel and EB Garamond; its texts
(`js/data/obeliskInscriptions.js`) follow the reading published at
[obelisk-390.vercel.app](https://obelisk-390.vercel.app), after Breasted and
Habachi for the hieroglyphs and Kiilerich for the Latin and Greek.

## Timeline

Each landmark records when it was built and, where it applies, when it was
demolished or ceased to exist (`period` in `js/data/landmarks.js`). The slider
at the bottom starts on "All eras"; moving it, or clicking one of the marked
events (`js/data/timeline.js`), shows only the landmarks standing in that year.

## Languages

English and Turkish. The page picks the first of the browser's preferred
languages that it supports (falling back to English). The gear button in
the bottom-right corner switches language, and the choice is remembered in
`localStorage`. All text lives in `js/i18n/en.js` and `js/i18n/tr.js`, keyed
by the ids used in `js/data/`. To add a language, copy one of those files,
translate it, and register it in `js/i18n/index.js`.

## Performance

Rendering quality is picked once per visit from the device
(`js/util/quality.js`). Touch devices, and machines reporting little memory
or few cores, render at a pixel ratio of 1 with 2048-pixel shadow maps and
plain PCF filtering; everything else gets a pixel ratio of up to 1.5 and
4096-pixel soft shadows on the map. The sun never moves, so the shadow map
is redrawn only when the scene changes: when the timeline shows or hides a
landmark, when a diorama appears, or while one with moving parts (oars,
flags, chariots) is on stage. Visitors whose system asks for reduced motion
see a still scene (no sailing ships, water or turning dioramas) that is only
redrawn when the camera or the scene changes.

## Layout

```
index.html, css/style.css, vite.config.js
js/
  main.js, app.js        entry point; switches between map and detail modes
  data/                  geography (coastlines, walls, routes), regions, landmark placement
  i18n/                  language detection/switching and the en/tr text
  models/                one file per landmark, each exporting create…({ lod: 'map' | 'detail' })
  models/lib/            shared textures, materials, primitives, hulls, figures, mesh merging
  world/                 map terrain, town and countryside planners, city fabric, shipping, labels, lighting
  views/                 MapView (overview) and DetailView (diorama stage)
  ui/                    sidebar, information panel and settings menu
  util/                  seeded random, 2D geometry, tweening, view insets
```

Model space is metres. The map uses 1 unit = 100 m. Its shores are
simplified from the OpenStreetMap coastline (© OpenStreetMap contributors,
ODbL), with modern landfill put back to the older shore. Landmarks are drawn
well above true scale (`map.scale` in `js/data/landmarks.js`) so they read
from the overview, and to make room for them the crowded heart of the city
around Hagia Sophia is gently magnified (`magnify()` in
`js/data/geography.js`), fading to true scale within a couple of kilometres.

# Constantinople — Queen of Cities

An interactive 3D map of Byzantine Constantinople, Pera/Galata and Chalcedon,
built with three.js. Every model is procedural (no asset files). Click a
landmark, on the map or in the sidebar, to fly in and open a detailed
diorama of it with its history.

## Run

There is no build step, but ES modules can't load from `file://`, so serve
the folder over HTTP:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

three.js 0.170 and the fonts load from CDNs, so you need to be online.

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

## Layout

```
index.html, css/style.css
js/
  main.js, app.js        entry point; switches between map and detail modes
  data/                  geography (coastlines, walls, routes), regions, landmark placement
  i18n/                  language detection/switching and the en/tr text
  models/                one file per landmark, each exporting create…({ lod: 'map' | 'detail' })
  models/lib/            shared textures, materials, primitives, hulls, figures, mesh merging
  world/                 map terrain, city fabric, shipping, labels, lighting
  views/                 MapView (overview) and DetailView (diorama stage)
  ui/                    sidebar, information panel and settings menu
  util/                  seeded random, 2D geometry, tweening, view insets
```

Model space is metres. The map uses 1 unit = 100 m, and landmarks are drawn
larger than true scale (`map.scale` in `js/data/landmarks.js`) so they can be
read from the overview.

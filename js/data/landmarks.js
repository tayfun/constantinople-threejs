import { createHagiaSophia } from '../models/hagiaSophia.js';
import { createHippodrome, SPINA_MONUMENTS, SPINA_TOP } from '../models/hippodrome.js';
import { createGreatPalace } from '../models/greatPalace.js';
import { createBasilicaCistern } from '../models/basilicaCistern.js';
import { createAqueductOfValens } from '../models/aqueductOfValens.js';
import { createBlachernae } from '../models/blachernae.js';
import { createTheodosianWalls } from '../models/theodosianWalls.js';
import { createVenetianQuarter } from '../models/venetianQuarter.js';
import { createHornChain } from '../models/hornChain.js';
import { createDromon } from '../models/dromon.js';
import { createGalataTower } from '../models/galataTower.js';
import { createGenoeseQuarter } from '../models/genoeseQuarter.js';
import { createChalcedon } from '../models/chalcedon.js';
import { createChrysopolis } from '../models/chrysopolis.js';
import { createForumOfConstantine } from '../models/forumOfConstantine.js';
import { FORUM_OF_CONSTANTINE, GALATA_TOWER, HORN_PATROL, METERS_TO_MAP } from './geography.js';

/**
 * Every clickable landmark: its model factory and where it sits on the map.
 * Names and descriptions live in the locale files (js/i18n/), keyed by id.
 *
 * map.at          [east, north] in map units, on the magnified map (see geography.js)
 * map.rotation    degrees, anticlockwise seen from above
 * map.scale       exaggeration over true size, so buildings read at map scale
 * map.absolute    the model's map version is already built in map coordinates
 * map.route       the model sails along this loop instead of standing still
 * map.on          id of the landmark this one stands on: it shares that landmark's
 *                 terrace and clearing instead of levelling the ground itself
 * map.lift        map units above the ground (e.g. onto the Hippodrome's spina)
 * map.clearance   map units kept free of houses and trees around the footprint (default 0.25)
 * map.labelWithin the label appears only when the camera is this close, in map
 *                 units, so small monuments don't crowd their host's label
 *
 * period.from     year it was built or founded (negative = BC)
 * period.to       year it was demolished or ceased to exist (absent if it still stands)
 * period.ending   'demolished' or 'ended' (a quarter, a ship type, the chain)
 * *Approx         marks a year as approximate
 */

const HIPPODROME = { at: [-6.6, -4], rotation: 60, scale: 2.5 };

/** Placement on the map for a monument standing on the Hippodrome's spina. */
function onSpina(id, scale) {
  const metre = HIPPODROME.scale * METERS_TO_MAP;
  const angle = (HIPPODROME.rotation * Math.PI) / 180;
  const along = SPINA_MONUMENTS[id].x * metre;
  return {
    at: [HIPPODROME.at[0] + along * Math.cos(angle), HIPPODROME.at[1] + along * Math.sin(angle)],
    rotation: HIPPODROME.rotation,
    scale,
    on: 'hippodrome',
    lift: SPINA_TOP * metre,
    labelWithin: 18,
  };
}

export const LANDMARKS = [
  {
    id: 'hagia-sophia',
    region: 'constantinople',
    period: { from: 537 },
    create: createHagiaSophia,
    map: { at: [3.5, 2.5], rotation: -32, scale: 7 },
  },
  {
    id: 'hippodrome',
    region: 'constantinople',
    period: { from: 203, fromApprox: true, to: 1600, toApprox: true, ending: 'demolished' },
    create: createHippodrome,
    map: HIPPODROME,
  },
  {
    id: 'obelisk-of-theodosius',
    region: 'constantinople',
    period: { from: 390 },
    create: SPINA_MONUMENTS['obelisk-of-theodosius'].create,
    map: onSpina('obelisk-of-theodosius', 3),
  },
  {
    id: 'serpent-column',
    region: 'constantinople',
    period: { from: 330, fromApprox: true },
    create: SPINA_MONUMENTS['serpent-column'].create,
    map: onSpina('serpent-column', 3),
  },
  {
    id: 'walled-obelisk',
    region: 'constantinople',
    period: { from: 400, fromApprox: true },
    create: SPINA_MONUMENTS['walled-obelisk'].create,
    map: onSpina('walled-obelisk', 3),
  },
  {
    id: 'great-palace',
    region: 'constantinople',
    period: { from: 330, to: 1453, toApprox: true, ending: 'demolished' },
    create: createGreatPalace,
    map: { at: [0.5, -4.6], rotation: 48, scale: 3 },
  },
  {
    id: 'basilica-cistern',
    region: 'constantinople',
    period: { from: 532 },
    create: createBasilicaCistern,
    map: { at: [-4.5, 5.4], rotation: 0, scale: 4.9 },
  },
  {
    id: 'forum-of-constantine',
    region: 'constantinople',
    period: { from: 330, fromApprox: true },
    create: createForumOfConstantine,
    map: { at: FORUM_OF_CONSTANTINE, rotation: -4, scale: 4.9 },
  },
  {
    id: 'aqueduct-of-valens',
    region: 'constantinople',
    period: { from: 368 },
    create: createAqueductOfValens,
    map: { at: [-21, 9.5], rotation: -25, scale: 4.2, clearance: 0.9 },
  },
  {
    id: 'blachernae',
    region: 'constantinople',
    period: { from: 500, fromApprox: true },
    create: createBlachernae,
    map: { at: [-30.8, 27.6], rotation: -10, scale: 2.9 },
  },
  {
    id: 'theodosian-walls',
    region: 'constantinople',
    period: { from: 413 },
    create: createTheodosianWalls,
    map: { absolute: true },
  },
  {
    id: 'venetian-quarter',
    region: 'constantinople',
    period: { from: 1082, to: 1453, ending: 'ended' },
    create: createVenetianQuarter,
    map: { at: [-7.46, 10.4], rotation: -16, scale: 4.2 },
  },
  {
    id: 'horn-chain',
    region: 'golden-horn',
    period: { from: 717, to: 1453, ending: 'ended' },
    create: createHornChain,
    map: { absolute: true },
  },
  {
    id: 'dromon',
    region: 'golden-horn',
    period: { from: 500, fromApprox: true, to: 1150, toApprox: true, ending: 'ended' },
    create: createDromon,
    map: { route: HORN_PATROL, speed: 0.9, scale: 8 },
  },
  {
    id: 'galata-tower',
    region: 'pera',
    period: { from: 1348 },
    create: createGalataTower,
    map: { at: GALATA_TOWER, rotation: 0, scale: 8.4 },
  },
  {
    id: 'genoese-quarter',
    region: 'pera',
    period: { from: 1267, to: 1453, ending: 'ended' },
    create: createGenoeseQuarter,
    map: { absolute: true },
  },
  {
    id: 'chrysopolis',
    region: 'chrysopolis',
    period: { from: -500, fromApprox: true },
    create: createChrysopolis,
    map: { at: [26.3, 15.6], rotation: -42, scale: 3.6 },
  },
  {
    id: 'chalcedon',
    region: 'chalcedon',
    period: { from: -685, fromApprox: true },
    create: createChalcedon,
    map: { at: [39.5, -21], rotation: 0, scale: 4.2 },
  },
];

export const landmarkById = (id) => LANDMARKS.find((landmark) => landmark.id === id);

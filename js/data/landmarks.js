import { createHagiaSophia } from '../models/hagiaSophia.js';
import { createHippodrome } from '../models/hippodrome.js';
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
import { createForumOfConstantine } from '../models/forumOfConstantine.js';
import { FORUM_OF_CONSTANTINE, GALATA_TOWER, HORN_PATROL } from './geography.js';

/**
 * Every clickable landmark: its model factory and where it sits on the map.
 * Names and descriptions live in the locale files (js/i18n/), keyed by id.
 *
 * map.at          [east, north] in map units, on the squeezed map (see geography.js)
 * map.rotation    degrees, anticlockwise seen from above
 * map.scale       exaggeration over true size, so buildings read at map scale
 * map.absolute    the model's map version is already built in map coordinates
 * map.route       the model sails along this loop instead of standing still
 *
 * period.from     year it was built or founded (negative = BC)
 * period.to       year it was demolished or ceased to exist (absent if it still stands)
 * period.ending   'demolished' or 'ended' (a quarter, a ship type, the chain)
 * *Approx         marks a year as approximate
 */
export const LANDMARKS = [
  {
    id: 'hagia-sophia',
    region: 'constantinople',
    period: { from: 537 },
    create: createHagiaSophia,
    map: { at: [4.5, 3.5], rotation: 0, scale: 7 },
  },
  {
    id: 'hippodrome',
    region: 'constantinople',
    period: { from: 203, fromApprox: true, to: 1600, toApprox: true, ending: 'demolished' },
    create: createHippodrome,
    map: { at: [-7.6, -5.6], rotation: 35, scale: 3 },
  },
  {
    id: 'great-palace',
    region: 'constantinople',
    period: { from: 330, to: 1453, toApprox: true, ending: 'demolished' },
    create: createGreatPalace,
    map: { at: [4.3, -7.1], rotation: 18, scale: 3.6 },
  },
  {
    id: 'basilica-cistern',
    region: 'constantinople',
    period: { from: 532 },
    create: createBasilicaCistern,
    map: { at: [-4, 4], rotation: 0, scale: 4.9 },
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
    map: { at: [-21.5, 5.5], rotation: 8, scale: 3.6 },
  },
  {
    id: 'blachernae',
    region: 'constantinople',
    period: { from: 500, fromApprox: true },
    create: createBlachernae,
    map: { at: [-29, 11.5], rotation: 0, scale: 4.2 },
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
    map: { at: [-11.1, 11.6], rotation: -20, scale: 4.9 },
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
    id: 'chalcedon',
    region: 'chalcedon',
    period: { from: -685, fromApprox: true },
    create: createChalcedon,
    map: { at: [26, -15], rotation: 0, scale: 4.2 },
  },
];

export const landmarkById = (id) => LANDMARKS.find((landmark) => landmark.id === id);

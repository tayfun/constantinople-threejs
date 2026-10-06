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
 * map.at          [east, north] in map units (100 m)
 * map.rotation    degrees, anticlockwise seen from above
 * map.scale       exaggeration over true size, so buildings read at map scale
 * map.absolute    the model's map version is already built in map coordinates
 * map.route       the model sails along this loop instead of standing still
 */
export const LANDMARKS = [
  {
    id: 'hagia-sophia',
    region: 'constantinople',
    create: createHagiaSophia,
    map: { at: [2.5, 2.8], rotation: 0, scale: 5 },
  },
  {
    id: 'hippodrome',
    region: 'constantinople',
    create: createHippodrome,
    map: { at: [-6.5, -5.5], rotation: 45, scale: 2.4 },
  },
  {
    id: 'great-palace',
    region: 'constantinople',
    create: createGreatPalace,
    map: { at: [1.8, -8.1], rotation: 18, scale: 2.6 },
  },
  {
    id: 'basilica-cistern',
    region: 'constantinople',
    create: createBasilicaCistern,
    map: { at: [-3.8, 1.8], rotation: 0, scale: 3.5 },
  },
  {
    id: 'forum-of-constantine',
    region: 'constantinople',
    create: createForumOfConstantine,
    map: { at: FORUM_OF_CONSTANTINE, rotation: -4, scale: 3.5 },
  },
  {
    id: 'aqueduct-of-valens',
    region: 'constantinople',
    create: createAqueductOfValens,
    map: { at: [-26, 7], rotation: 8, scale: 2.6 },
  },
  {
    id: 'blachernae',
    region: 'constantinople',
    create: createBlachernae,
    map: { at: [-50.5, 25.2], rotation: 0, scale: 3 },
  },
  {
    id: 'theodosian-walls',
    region: 'constantinople',
    create: createTheodosianWalls,
    map: { absolute: true },
  },
  {
    id: 'venetian-quarter',
    region: 'constantinople',
    create: createVenetianQuarter,
    map: { at: [-11, 11.5], rotation: -20, scale: 3.5 },
  },
  {
    id: 'horn-chain',
    region: 'golden-horn',
    create: createHornChain,
    map: { absolute: true },
  },
  {
    id: 'dromon',
    region: 'golden-horn',
    create: createDromon,
    map: { route: HORN_PATROL, speed: 0.9, scale: 6 },
  },
  {
    id: 'galata-tower',
    region: 'pera',
    create: createGalataTower,
    map: { at: GALATA_TOWER, rotation: 0, scale: 6 },
  },
  {
    id: 'genoese-quarter',
    region: 'pera',
    create: createGenoeseQuarter,
    map: { absolute: true },
  },
  {
    id: 'chalcedon',
    region: 'chalcedon',
    create: createChalcedon,
    map: { at: [38.5, -21.5], rotation: 0, scale: 3 },
  },
];

export const landmarkById = (id) => LANDMARKS.find((landmark) => landmark.id === id);

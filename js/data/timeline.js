/**
 * The year slider: its range and the events marked on it. Event captions
 * live in the locale files (js/i18n/), keyed by id.
 */
export const TIMELINE = { start: 300, end: 1453 };

export const EVENTS = [
  { year: 324, id: 'chrysopolis' },
  { year: 330, id: 'dedication' },
  { year: 368, id: 'aqueduct' },
  { year: 413, id: 'walls' },
  { year: 451, id: 'council' },
  { year: 532, id: 'nika' },
  { year: 537, id: 'hagia-sophia' },
  { year: 626, id: 'siege-626' },
  { year: 717, id: 'arab-siege' },
  { year: 1054, id: 'schism' },
  { year: 1082, id: 'venice' },
  { year: 1204, id: 'crusade' },
  { year: 1261, id: 'recovery' },
  { year: 1267, id: 'genoa' },
  { year: 1348, id: 'galata-tower' },
  { year: 1453, id: 'conquest' },
];

/** Whether a landmark existed in the given year (null = no year chosen: show everything). */
export function standsIn(landmark, year) {
  if (year === null) return true;
  const { from, to } = landmark.period;
  return year >= from && (to === undefined || year <= to);
}

/** The most recent marked event at or before a year, if any. */
export function latestEvent(year) {
  return EVENTS.filter((event) => event.year <= year).at(-1) ?? null;
}

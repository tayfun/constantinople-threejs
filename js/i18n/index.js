/**
 * Language selection and text lookup. The language is the one the visitor
 * chose in the settings menu, or else the first supported language in the
 * browser's preferences, or else English.
 *
 * Each language's text lives in its own module and is fetched only when it
 * is first needed, so a visitor downloads one language, not all of them.
 * Await `ready` before reading any text; `setLanguage` resolves once the new
 * language is in and its listeners have run.
 */

const LOADERS = {
  en: () => import('./en.js'),
  tr: () => import('./tr.js'),
};
const LOCALES = {}; // code → text, once loaded
const STORAGE_KEY = 'constantinople.language';

export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'tr', label: 'Türkçe' },
];

const listeners = new Set();
let current = initialLanguage();

/** Resolves once the initial language's text has loaded. */
export const ready = loadLanguage(current);

async function loadLanguage(code) {
  if (!LOCALES[code]) LOCALES[code] = (await LOADERS[code]()).default;
  return LOCALES[code];
}

function initialLanguage() {
  const saved = readSaved();
  if (saved && saved in LOADERS) return saved;
  const preferred = navigator.languages?.length ? navigator.languages : [navigator.language];
  // Tolerate header-style entries ("de-DE,tr;q=0.5") as well as plain tags.
  for (const tag of preferred.flatMap((entry) => (entry ?? '').split(','))) {
    const code = tag.split(';')[0].trim().toLowerCase().split('-')[0];
    if (code in LOADERS) return code;
  }
  return 'en';
}

function readSaved() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export const getLanguage = () => current;

let requested = current;

export async function setLanguage(code) {
  if (!(code in LOADERS) || code === requested) return;
  requested = code;
  await loadLanguage(code);
  if (requested !== code) return; // the visitor chose again while this one was loading
  current = code;
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {
    // Storage may be unavailable (private mode); the choice then lasts for this visit.
  }
  for (const listener of listeners) listener(code);
}

export function onLanguageChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** An interface string, with {placeholders} filled from `params`. */
export function ui(key, params = {}) {
  return LOCALES[current].ui[key].replace(/\{(\w+)\}/g, (_, name) => params[name] ?? '');
}

export const landmarkText = (id) => LOCALES[current].landmarks[id];
export const regionText = (id) => LOCALES[current].regions[id];
export const eventText = (id) => LOCALES[current].events[id];

/** A year for display: "537", "685 BC" / "MÖ 685", optionally marked approximate. */
export function formatYear(year, approximate = false) {
  const plain = year < 0 ? ui('yearBC', { year: -year }) : String(year);
  return approximate ? ui('approximately', { year: plain }) : plain;
}

/** A landmark's lifespan, e.g. "537 – today" or "c. 203 – c. 1600". */
export function formatPeriod({ from, fromApprox, to, toApprox }) {
  return `${formatYear(from, fromApprox)} – ${to === undefined ? ui('present') : formatYear(to, toApprox)}`;
}

/** Applies the current language to static markup: data-i18n (text) and data-i18n-label (aria-label, and tooltip if it has one). */
export function translateDocument(root = document) {
  document.documentElement.lang = current;
  document.title = ui('documentTitle');
  for (const element of root.querySelectorAll('[data-i18n]')) element.textContent = ui(element.dataset.i18n);
  for (const element of root.querySelectorAll('[data-i18n-label]')) {
    const label = ui(element.dataset.i18nLabel);
    element.setAttribute('aria-label', label);
    if (element.title) element.title = label;
  }
}

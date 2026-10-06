import en from './en.js';
import tr from './tr.js';

/**
 * Language selection and text lookup. The language is the one the visitor
 * chose in the settings menu, or else the first supported language in the
 * browser's preferences, or else English.
 */

const LOCALES = { en, tr };
const STORAGE_KEY = 'constantinople.language';

export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'tr', label: 'Türkçe' },
];

const listeners = new Set();
let current = initialLanguage();

function initialLanguage() {
  const saved = readSaved();
  if (saved && saved in LOCALES) return saved;
  const preferred = navigator.languages?.length ? navigator.languages : [navigator.language];
  // Tolerate header-style entries ("de-DE,tr;q=0.5") as well as plain tags.
  for (const tag of preferred.flatMap((entry) => (entry ?? '').split(','))) {
    const code = tag.split(';')[0].trim().toLowerCase().split('-')[0];
    if (code in LOCALES) return code;
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

export function setLanguage(code) {
  if (!(code in LOCALES) || code === current) return;
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
export const labelText = (id) => LOCALES[current].labels[id];

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

import { h } from './dom.js';
import { ui } from '../i18n/index.js';

export const CONTROL_KEYS = ['controlRotate', 'controlPan', 'controlZoom', 'controlSelect', 'controlTouch'];

const STORAGE_KEY = 'constantinople.skipIntro';

/** Whether the visitor asked not to see the introduction again. */
export function introSkipped() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setIntroSkipped(skip) {
  try {
    localStorage.setItem(STORAGE_KEY, skip ? '1' : '0');
  } catch {
    // Storage may be unavailable (private mode); the choice then lasts for this visit.
  }
}

/**
 * The loading screen, which doubles as an introduction: what the app is,
 * a few lines of the city's history and how to steer the map, read while
 * the city is built. "Enter the City" opens the map at once if it is ready,
 * or else falls back to the plain loading screen until it is. A visitor who
 * ticked "don't show this again" sees only the plain loading screen.
 */
export class LoadingScreen {
  constructor(element) {
    this.element = element;
    this.loaded = false;
    this.entered = introSkipped();
    if (!this.entered) this.showIntro();
  }

  showIntro() {
    const skip = h('input', { type: 'checkbox', class: 'intro__check' });
    const enter = h('button', {
      class: 'intro__enter',
      type: 'button',
      onClick: () => this.enter(skip.checked),
    }, ui('introEnter'));
    this.intro = h('div', { class: 'intro', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'intro-title' },
      h('div', { class: 'loading__mark', 'aria-hidden': 'true' }, '☩'),
      h('h1', { class: 'intro__title', id: 'intro-title' }, ui('title')),
      h('p', { class: 'intro__sub' }, ui('titleSub')),
      h('p', {}, ui('introAbout')),
      h('h2', { class: 'intro__heading' }, ui('introHistory')),
      h('p', {}, ui('introFounding')),
      h('p', {}, ui('introMonuments')),
      h('h2', { class: 'intro__heading' }, ui('controls')),
      h('ul', { class: 'settings__controls' }, CONTROL_KEYS.map((key) => h('li', {}, ui(key)))),
      h('div', { class: 'intro__actions' },
        h('label', { class: 'intro__skip' }, skip, ui('introSkip')),
        enter));
    this.element.classList.add('has-intro');
    this.element.append(this.intro);
    enter.focus({ preventScroll: true });
  }

  enter(skipNextTime) {
    if (skipNextTime) setIntroSkipped(true);
    this.entered = true;
    this.intro.remove();
    this.element.classList.remove('has-intro');
    if (this.loaded) this.hide();
  }

  /** The first frame of the city is drawn. */
  ready() {
    this.loaded = true;
    if (this.entered) this.hide();
  }

  hide() {
    this.element.classList.add('is-done');
  }

  showError(message) {
    this.element.classList.remove('has-intro', 'is-done');
    this.element.classList.add('is-error');
    this.element.textContent = message;
  }
}

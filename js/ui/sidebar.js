import { h } from './dom.js';
import { formatYear, landmarkText, regionText, ui } from '../i18n/index.js';
import { standsIn } from '../data/timeline.js';

/** The city's title, heading a collapsible list of regions and their landmarks. */
export class Sidebar {
  constructor(element, { regions, landmarks, onSelectRegion, onSelectLandmark, onHome, onToggle = () => {} }) {
    this.element = element;
    this.options = { regions, landmarks, onSelectRegion, onSelectLandmark, onHome, onToggle };
    this.activeId = null;
    this.year = null;
    element.classList.toggle('is-collapsed', window.matchMedia('(max-width: 760px)').matches);
    this.render();
  }

  /** Builds the list in the current language, keeping the collapsed state and selection. */
  render() {
    const { regions, landmarks, onSelectRegion, onSelectLandmark, onHome, onToggle } = this.options;
    const { element } = this;
    this.buttons = new Map();

    // The title doubles as the list's header: clicking anywhere on it folds the list away.
    // The chevron button carries the accessible name and state for keyboard and screen-reader users.
    const toggle = h('button', {
      class: 'sidebar__toggle',
      type: 'button',
      'aria-label': ui('landmarks'),
      title: ui('landmarks'),
      'aria-expanded': String(!element.classList.contains('is-collapsed')),
    }, h('span', { class: 'sidebar__chevron', 'aria-hidden': 'true' }, '▾'));
    const title = h('header', {
      class: 'sidebar__title',
      onClick: () => {
        const isCollapsed = element.classList.toggle('is-collapsed');
        toggle.setAttribute('aria-expanded', String(!isCollapsed));
        onToggle();
      },
    },
    h('p', { class: 'sidebar__greek', lang: 'grc' }, 'Κωνσταντινούπολις'),
    h('h1', { class: 'sidebar__name' }, ui('title')),
    h('p', { class: 'sidebar__sub' }, ui('titleSub')),
    toggle);

    const home = h('button', { class: 'sidebar__home', type: 'button', onClick: onHome }, ui('wholeCity'));
    const body = h('div', { class: 'sidebar__body' }, home, regions.map((region) => h('section', { class: 'sidebar__region' },
      h('button', { class: 'sidebar__region-button', type: 'button', onClick: () => onSelectRegion(region.id) },
        regionText(region.id).name, h('span', { class: 'sidebar__region-sub' }, regionText(region.id).subtitle)),
      h('ul', {}, landmarks.filter((landmark) => landmark.region === region.id).map((landmark) => {
        const button = h('button', { class: 'sidebar__landmark', type: 'button', onClick: () => onSelectLandmark(landmark.id) }, landmarkText(landmark.id).name);
        this.buttons.set(landmark.id, button);
        return h('li', {}, button);
      })))));

    element.replaceChildren(title, body);
    this.setActive(this.activeId);
    this.setYear(this.year);
  }

  /** Dims the landmarks that did not exist in the chosen year (null: none dimmed). */
  setYear(year) {
    this.year = year;
    for (const landmark of this.options.landmarks) {
      const button = this.buttons.get(landmark.id);
      const absent = !standsIn(landmark, year);
      button.classList.toggle('is-absent', absent);
      button.title = absent ? ui('notStanding', { year: formatYear(year) }) : '';
    }
  }

  setActive(id) {
    this.activeId = id;
    for (const [landmarkId, button] of this.buttons) button.classList.toggle('is-active', landmarkId === id);
  }
}

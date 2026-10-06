import { h } from './dom.js';
import { landmarkText, regionText, ui } from '../i18n/index.js';

/** Collapsible list of regions and their landmarks. */
export class Sidebar {
  constructor(element, { regions, landmarks, onSelectRegion, onSelectLandmark, onHome, onToggle = () => {} }) {
    this.element = element;
    this.options = { regions, landmarks, onSelectRegion, onSelectLandmark, onHome, onToggle };
    this.activeId = null;
    element.classList.toggle('is-collapsed', window.matchMedia('(max-width: 760px)').matches);
    this.render();
  }

  /** Builds the list in the current language, keeping the collapsed state and selection. */
  render() {
    const { regions, landmarks, onSelectRegion, onSelectLandmark, onHome, onToggle } = this.options;
    const { element } = this;
    this.buttons = new Map();

    const toggle = h('button', {
      class: 'sidebar__toggle',
      type: 'button',
      'aria-expanded': String(!element.classList.contains('is-collapsed')),
      onClick: () => {
        const isCollapsed = element.classList.toggle('is-collapsed');
        toggle.setAttribute('aria-expanded', String(!isCollapsed));
        onToggle();
      },
    }, ui('landmarks'), h('span', { class: 'sidebar__chevron', 'aria-hidden': 'true' }, '▾'));

    const home = h('button', { class: 'sidebar__home', type: 'button', onClick: onHome }, ui('wholeCity'));
    const body = h('div', { class: 'sidebar__body' }, home, regions.map((region) => h('section', { class: 'sidebar__region' },
      h('button', { class: 'sidebar__region-button', type: 'button', onClick: () => onSelectRegion(region.id) },
        regionText(region.id).name, h('span', { class: 'sidebar__region-sub' }, regionText(region.id).subtitle)),
      h('ul', {}, landmarks.filter((landmark) => landmark.region === region.id).map((landmark) => {
        const button = h('button', { class: 'sidebar__landmark', type: 'button', onClick: () => onSelectLandmark(landmark.id) }, landmarkText(landmark.id).name);
        this.buttons.set(landmark.id, button);
        return h('li', {}, button);
      })))));

    element.replaceChildren(toggle, body);
    this.setActive(this.activeId);
  }

  setActive(id) {
    this.activeId = id;
    for (const [landmarkId, button] of this.buttons) button.classList.toggle('is-active', landmarkId === id);
  }
}

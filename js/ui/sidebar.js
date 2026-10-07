import { h } from './dom.js';
import { formatYear, landmarkText, regionText, ui } from '../i18n/index.js';
import { standsIn } from '../data/timeline.js';
import { REGION_GROUPS } from '../data/regions.js';

/**
 * The city's title, heading the regions and their landmarks, filed under a
 * few folding groups (the city, the far shores, the waters) that start closed
 * so the list stays short. One group is open at a time; opening a landmark
 * unfolds its group.
 */
export class Sidebar {
  constructor(element, { regions, landmarks, onSelectRegion, onSelectLandmark, onToggle = () => {} }) {
    this.element = element;
    this.options = { regions, landmarks, onSelectRegion, onSelectLandmark, onToggle };
    this.activeId = null;
    this.year = null;
    this.openGroups = new Set();
    element.classList.toggle('is-collapsed', window.matchMedia('(max-width: 760px)').matches);
    this.render();
  }

  /** Builds the list in the current language, keeping the collapsed state and selection. */
  render() {
    const { regions, landmarks, onSelectRegion, onSelectLandmark, onToggle } = this.options;
    const { element } = this;
    this.buttons = new Map();

    // The title doubles as the list's header: clicking anywhere on it folds the list away.
    // The chevron button carries the accessible name and state for keyboard and screen-reader users.
    let body;
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
        const opening = element.classList.contains('is-collapsed');
        toggle.setAttribute('aria-expanded', String(opening));
        // The list slides open and shut; the collapsed class (which hides it) settles once the motion ends.
        if (opening) element.classList.remove('is-collapsed');
        this.slide(body, opening, () => { if (!opening) element.classList.add('is-collapsed'); });
        onToggle();
      },
    },
    h('p', { class: 'sidebar__greek', lang: 'grc' }, 'Κωνσταντινούπολις'),
    h('h1', { class: 'sidebar__name' }, ui('title')),
    h('p', { class: 'sidebar__sub' }, ui('titleSub')),
    toggle);

    const groupTitle = { city: 'groupCity', shores: 'groupShores', waters: 'groupWaters' };
    const regionSection = (region) => h('section', { class: 'sidebar__region' },
      h('button', { class: 'sidebar__region-button', type: 'button', onClick: () => onSelectRegion(region.id) },
        regionText(region.id).name, h('span', { class: 'sidebar__region-sub' }, regionText(region.id).subtitle)),
      h('ul', {}, landmarks.filter((landmark) => landmark.region === region.id).map((landmark) => {
        const button = h('button', { class: 'sidebar__landmark', type: 'button', onClick: () => onSelectLandmark(landmark.id) }, landmarkText(landmark.id).name);
        this.buttons.set(landmark.id, button);
        return h('li', {}, button);
      })));
    this.groups = new Map();
    body = h('div', { class: 'sidebar__body' }, REGION_GROUPS.map((group) => {
      const open = this.openGroups.has(group);
      const summary = h('summary', { class: 'sidebar__group-summary' }, ui(groupTitle[group]), h('span', { class: 'sidebar__group-chevron', 'aria-hidden': 'true' }, '▾'));
      const details = h('details', { class: `sidebar__group${open ? ' is-open' : ''}`, open },
        summary,
        h('div', { class: 'sidebar__group-body' }, regions.filter((region) => region.group === group).map(regionSection)));
      // The summary's own toggle snaps; we fold and unfold by hand so it can be animated.
      summary.addEventListener('click', (event) => {
        event.preventDefault();
        this.toggleGroup(group, !details.classList.contains('is-open'));
      });
      this.groups.set(group, details);
      return details;
    }));

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

  /** Highlights the chosen landmark and unfolds the group it is filed under. */
  setActive(id) {
    this.activeId = id;
    for (const [landmarkId, button] of this.buttons) button.classList.toggle('is-active', landmarkId === id);
    const landmark = this.options.landmarks.find((item) => item.id === id);
    const region = landmark && this.options.regions.find((item) => item.id === landmark.region);
    if (region) this.toggleGroup(region.group, true);
  }

  /** Unfolds or folds a group; only one is open at a time, so unfolding one folds the others. */
  toggleGroup(group, open) {
    const details = this.groups.get(group);
    if (details.classList.contains('is-open') === open) return;
    if (open) {
      for (const [other, element] of this.groups) if (other !== group && element.classList.contains('is-open')) this.slideGroup(element, false);
    }
    this.slideGroup(details, open);
    this.openGroups = open ? new Set([group]) : new Set();
  }

  /** Slides a group's body open or shut, settling the disclosure's open state when the motion ends. */
  slideGroup(details, open) {
    details.classList.toggle('is-open', open);
    if (open) details.open = true;
    this.slide(details.querySelector('.sidebar__group-body'), open, () => { if (!open) details.open = false; });
  }

  /**
   * Slides an element open (from nothing to its full height) or shut, then
   * calls settle(), which applies whatever hides it for good. With reduced
   * motion it settles at once.
   */
  slide(target, open, settle = () => {}) {
    target.animation?.cancel();
    const height = target.scrollHeight;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      settle();
      return;
    }
    target.style.overflow = 'hidden';
    target.animation = target.animate(
      { height: open ? ['0px', `${height}px`] : [`${height}px`, '0px'], opacity: open ? [0, 1] : [1, 0] },
      { duration: 280, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' },
    );
    target.animation.onfinish = () => {
      target.style.overflow = '';
      target.animation = null;
      settle();
    };
  }
}

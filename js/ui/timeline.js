import { h } from './dom.js';
import { EVENTS, TIMELINE, latestEvent } from '../data/timeline.js';
import { eventText, formatYear, ui } from '../i18n/index.js';

const THUMB = 18; // px; must match the range thumb size in style.css
const MIN_LABEL_GAP = 38; // px between year labels under the track

/**
 * The year slider with key events marked along it. It starts on "All eras"
 * (every landmark shown); moving the slider or picking an event selects a
 * single year, reported through onChange(year | null).
 */
export class Timeline {
  constructor(element, { onChange }) {
    this.element = element;
    this.onChange = onChange;
    this.year = null;
    new ResizeObserver(() => this.layoutLabels()).observe(element);
    this.render();
  }

  render() {
    const { start, end } = TIMELINE;
    this.allButton = h('button', { class: 'timeline__all', type: 'button', onClick: () => this.select(null) }, ui('allEras'));
    this.readout = h('p', { class: 'timeline__readout', 'aria-live': 'polite' });
    this.range = h('input', {
      class: 'timeline__range',
      type: 'range',
      min: start,
      max: end,
      step: 1,
      'aria-label': ui('year'),
      onInput: () => this.select(Number(this.range.value)),
    });
    this.marks = EVENTS.map((event) => {
      const position = (event.year - start) / (end - start);
      const label = `${formatYear(event.year)}: ${eventText(event.id)}`;
      const mark = h('button', {
        class: 'timeline__mark',
        type: 'button',
        title: label,
        'aria-label': label,
        onClick: () => this.select(event.year),
      }, h('span', { class: 'timeline__tick', 'aria-hidden': 'true' }), h('span', { class: 'timeline__label' }, formatYear(event.year)));
      mark.style.left = `calc(${THUMB / 2}px + (100% - ${THUMB}px) * ${position})`;
      return { button: mark, position, event };
    });

    this.element.replaceChildren(
      h('div', { class: 'timeline__head' }, this.allButton, this.readout),
      h('div', { class: 'timeline__track' }, this.range, h('div', { class: 'timeline__marks' }, this.marks.map(({ button }) => button))),
    );
    this.update();
    requestAnimationFrame(() => this.layoutLabels());
  }

  select(year) {
    if (year === this.year) return;
    this.year = year;
    this.update();
    this.onChange(year);
  }

  update() {
    const all = this.year === null;
    this.element.classList.toggle('is-all', all);
    this.allButton.setAttribute('aria-pressed', String(all));
    this.range.value = all ? TIMELINE.end : this.year;

    const event = all ? null : latestEvent(this.year);
    let caption = '';
    if (all) caption = ui('allErasHint');
    else if (event) caption = event.year === this.year ? eventText(event.id) : `${formatYear(event.year)} · ${eventText(event.id)}`;
    this.readout.replaceChildren(...(all ? [] : [h('strong', {}, formatYear(this.year)), ' ']), h('span', {}, caption));
    this.range.setAttribute('aria-valuetext', all ? ui('allEras') : `${formatYear(this.year)}${caption ? ` — ${caption}` : ''}`);
    for (const { button, event: marked } of this.marks) button.classList.toggle('is-current', marked === event);
  }

  /** Shows year labels under the ticks only where they have room. */
  layoutLabels() {
    const width = this.element.querySelector('.timeline__marks')?.clientWidth ?? 0;
    let lastShown = -Infinity;
    for (const { button, position } of this.marks) {
      const x = THUMB / 2 + (width - THUMB) * position;
      const show = x - lastShown >= MIN_LABEL_GAP;
      button.classList.toggle('has-label', show);
      if (show) lastShown = x;
    }
  }
}

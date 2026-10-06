import { h } from './dom.js';
import { EVENTS, TIMELINE, latestEvent } from '../data/timeline.js';
import { eventText, formatYear, ui } from '../i18n/index.js';

const THUMB = 18; // px; must match the range thumb size in style.css
const MIN_LABEL_GAP = 38; // px between year labels under the track
const YEARS_PER_SECOND = 40; // playback speed: the whole span passes in about half a minute

/**
 * The year slider with key events marked along it. It starts with every
 * landmark shown ("all eras"); moving the slider, picking an event or
 * pressing play selects a single year, reported through onChange(year | null).
 * Play runs the years forward from the current one to the end; reset
 * returns to all eras.
 */
export class Timeline {
  constructor(element, { onChange }) {
    this.element = element;
    this.onChange = onChange;
    this.year = null;
    this.playing = false;
    this.frame = 0;
    new ResizeObserver(() => this.layoutLabels()).observe(element);
    this.render();
  }

  render() {
    const { start, end } = TIMELINE;
    this.playButton = h('button', { class: 'timeline__button timeline__play', type: 'button', onClick: () => (this.playing ? this.stop() : this.play()) });
    this.resetButton = h('button', {
      class: 'timeline__button timeline__reset',
      type: 'button',
      'aria-label': ui('reset'),
      title: ui('reset'),
      onClick: () => {
        this.stop();
        this.select(null);
      },
    }, '⟲');
    this.readout = h('p', { class: 'timeline__readout', 'aria-live': 'polite' });
    this.range = h('input', {
      class: 'timeline__range',
      type: 'range',
      min: start,
      max: end,
      step: 1,
      'aria-label': ui('year'),
      onInput: () => {
        this.stop();
        this.select(Number(this.range.value));
      },
    });
    this.marks = EVENTS.map((event) => {
      const position = (event.year - start) / (end - start);
      const label = `${formatYear(event.year)}: ${eventText(event.id)}`;
      const mark = h('button', {
        class: 'timeline__mark',
        type: 'button',
        title: label,
        'aria-label': label,
        onClick: () => {
          this.stop();
          this.select(event.year);
        },
      }, h('span', { class: 'timeline__tick', 'aria-hidden': 'true' }), h('span', { class: 'timeline__label' }, formatYear(event.year)));
      mark.style.left = `calc(${THUMB / 2}px + (100% - ${THUMB}px) * ${position})`;
      return { button: mark, position, event };
    });

    this.element.replaceChildren(
      h('div', { class: 'timeline__head' }, this.playButton, this.resetButton, this.readout),
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

  // ---------- playback ----------

  /** Runs the years forward from the current year (or from the start when none, or the end, is chosen). */
  play() {
    if (this.playing) return;
    const { start, end } = TIMELINE;
    let year = this.year === null || this.year >= end ? start : this.year;
    let last = performance.now();
    this.playing = true;
    this.select(Math.floor(year));
    const step = (now) => {
      if (!this.playing) return;
      // A frame's timestamp can precede the moment play was pressed, so never step backwards.
      year = Math.min(end, year + (Math.max(0, now - last) / 1000) * YEARS_PER_SECOND);
      last = now;
      this.select(Math.floor(year));
      if (year >= end) {
        this.stop();
        return;
      }
      this.frame = requestAnimationFrame(step);
    };
    this.frame = requestAnimationFrame(step);
    this.updatePlayButton();
  }

  stop() {
    if (!this.playing) return;
    this.playing = false;
    cancelAnimationFrame(this.frame);
    this.updatePlayButton();
  }

  updatePlayButton() {
    const label = ui(this.playing ? 'pause' : 'play');
    this.playButton.textContent = this.playing ? '❚❚' : '▶';
    this.playButton.setAttribute('aria-label', label);
    this.playButton.title = label;
    this.playButton.setAttribute('aria-pressed', String(this.playing));
    this.playButton.classList.toggle('is-playing', this.playing);
  }

  // ---------- display ----------

  update() {
    const all = this.year === null;
    this.element.classList.toggle('is-all', all);
    this.range.value = all ? TIMELINE.end : this.year;

    const event = all ? null : latestEvent(this.year);
    let caption = '';
    if (all) caption = ui('allErasHint');
    else if (event) caption = event.year === this.year ? eventText(event.id) : `${formatYear(event.year)} · ${eventText(event.id)}`;
    this.readout.replaceChildren(...(all ? [] : [h('strong', {}, formatYear(this.year)), ' ']), h('span', {}, caption));
    this.range.setAttribute('aria-valuetext', all ? ui('allEras') : `${formatYear(this.year)}${caption ? ` — ${caption}` : ''}`);
    for (const { button, event: marked } of this.marks) button.classList.toggle('is-current', marked === event);
    this.updatePlayButton();
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

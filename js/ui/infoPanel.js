import { h } from './dom.js';
import { formatPeriod, formatYear, landmarkText, regionText, ui } from '../i18n/index.js';

/** The parchment side panel describing a landmark or a region. */
export class InfoPanel {
  constructor(element, { onSelectLandmark, onClose }) {
    this.element = element;
    this.onSelectLandmark = onSelectLandmark;
    this.onClose = onClose;
    this.showing = null;
  }

  showLandmark(landmark, { animate = true } = {}) {
    this.showing = () => this.showLandmark(landmark, { animate: false });
    const info = landmarkText(landmark.id);
    const { period } = landmark;
    this.render([
      h('p', { class: 'info-panel__region' }, regionText(landmark.region).name),
      h('h2', {}, info.name),
      h('p', { class: 'info-panel__years' }, formatPeriod(period)),
      h('p', { class: 'info-panel__subtitle' }, info.subtitle),
      h('dl', { class: 'info-panel__stats' },
        h('dt', {}, ui('built')), h('dd', {}, info.built),
        period.to === undefined
          ? [h('dt', {}, ui('status')), h('dd', {}, info.fate)]
          : [h('dt', {}, ui(period.ending)), h('dd', {}, `${formatYear(period.to, period.toApprox)} — ${info.fate}`)],
        h('dt', {}, ui('builder')), h('dd', {}, info.builder),
        h('dt', {}, ui('purpose')), h('dd', {}, info.purpose)),
      h('div', { class: 'info-panel__ornament' }),
      h('p', {}, info.summary),
      info.legend && legendBlock(info.legend),
      h('h3', {}, ui('didYouKnow')),
      h('ul', { class: 'info-panel__facts' }, info.facts.map((fact) => h('li', {}, fact))),
      h('p', { class: 'info-panel__today' }, h('strong', {}, `${ui('today')} `), info.today),
    ], animate);
  }

  showRegion(region, landmarks, { animate = true } = {}) {
    this.showing = () => this.showRegion(region, landmarks, { animate: false });
    const text = regionText(region.id);
    this.render([
      h('p', { class: 'info-panel__region' }, ui('areaOfMap')),
      h('h2', {}, text.name),
      h('p', { class: 'info-panel__subtitle' }, text.subtitle),
      h('div', { class: 'info-panel__ornament' }),
      text.paragraphs.map((paragraph) => h('p', {}, paragraph)),
      text.legend && legendBlock(text.legend),
      text.closing && h('p', {}, text.closing),
      landmarks.length > 0 && [
        h('h3', {}, ui('explore')),
        h('div', { class: 'info-panel__links' }, landmarks.map((landmark) =>
          h('button', { class: 'info-panel__link', type: 'button', onClick: () => this.onSelectLandmark(landmark.id) }, landmarkText(landmark.id).name))),
      ],
    ], animate);
  }

  /** Re-renders whatever is open in the current language, keeping the scroll position. */
  refresh() {
    if (this.element.hidden || !this.showing) return;
    const { scrollTop } = this.element;
    this.showing();
    this.element.scrollTop = scrollTop;
  }

  render(children, animate) {
    this.element.replaceChildren(
      h('button', { class: 'info-panel__close', type: 'button', 'aria-label': ui('close'), title: ui('close'), onClick: () => this.onClose() }, '×'),
      ...children.flat(2).filter(Boolean),
    );
    this.element.hidden = false;
    if (!animate) return;
    this.element.scrollTop = 0;
    // Restart the slide-in animation.
    this.element.style.animation = 'none';
    void this.element.offsetWidth;
    this.element.style.animation = '';
  }

  hide() {
    this.element.hidden = true;
  }
}

function legendBlock({ title, paragraphs }) {
  return h('section', { class: 'info-panel__legend' }, h('h3', {}, title), paragraphs.map((text) => h('p', {}, text)));
}

import { h } from './dom.js';
import { SourcesDialog } from './sources.js';
import { LANGUAGES, getLanguage, setLanguage, sourcesText, ui } from '../i18n/index.js';

const CONTROL_KEYS = ['controlRotate', 'controlPan', 'controlZoom', 'controlSelect', 'controlTouch'];

/**
 * The gear button and the settings dialog it opens: the language choice,
 * a reminder of how to steer the map, a link to the sources page and the
 * switch for the developers' debug readout.
 * A native <dialog> gives the modal its backdrop, focus trapping and
 * Escape handling.
 */
export class SettingsMenu {
  constructor(element, { debug }) {
    this.element = element;
    this.debug = debug;
    this.button = element.querySelector('.settings__button');
    this.dialog = h('dialog', { class: 'settings__dialog', 'aria-labelledby': 'settings-title' });
    element.append(this.dialog);
    this.sources = new SourcesDialog(element);

    this.button.addEventListener('click', () => this.setOpen(true));
    // Clicking the backdrop (outside the dialog's own box) closes it.
    this.dialog.addEventListener('click', (event) => {
      if (event.target === this.dialog) this.setOpen(false);
    });
    this.dialog.addEventListener('close', () => {
      this.button.setAttribute('aria-expanded', 'false');
      this.button.focus();
    });
    // Escape closes the dialog (its default) and must not also close the view behind it.
    this.dialog.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') event.stopPropagation();
    });
    this.render();
  }

  /** Builds the dialog in the current language; keeps keyboard focus on the chosen option. */
  render() {
    const hadFocus = this.dialog.contains(document.activeElement);
    const options = LANGUAGES.map(({ code, label }) => h('button', {
      class: 'settings__option',
      type: 'button',
      lang: code,
      'aria-pressed': String(code === getLanguage()),
      onClick: () => setLanguage(code),
    }, label));
    this.dialog.replaceChildren(
      h('div', { class: 'settings__head' },
        h('h2', { class: 'settings__title', id: 'settings-title' }, ui('settings')),
        h('button', { class: 'settings__close', type: 'button', 'aria-label': ui('close'), title: ui('close'), onClick: () => this.setOpen(false) }, '×')),
      h('section', { class: 'settings__section' },
        h('h3', { class: 'settings__heading', id: 'settings-language' }, ui('language')),
        h('div', { class: 'settings__options', role: 'group', 'aria-labelledby': 'settings-language' }, options)),
      h('section', { class: 'settings__section' },
        h('h3', { class: 'settings__heading' }, ui('controls')),
        h('ul', { class: 'settings__controls' }, CONTROL_KEYS.map((key) => h('li', {}, ui(key))))),
      h('section', { class: 'settings__section' },
        h('h3', { class: 'settings__heading' }, ui('sources')),
        h('button', { class: 'settings__option sources__open', type: 'button', onClick: (event) => this.sources.open(event.currentTarget) }, sourcesText().title)),
      h('section', { class: 'settings__section' },
        h('h3', { class: 'settings__heading' }, ui('debug')),
        h('button', {
          class: 'settings__option',
          type: 'button',
          'aria-pressed': String(this.debug.enabled),
          onClick: (event) => {
            this.debug.setEnabled(!this.debug.enabled);
            event.currentTarget.setAttribute('aria-pressed', String(this.debug.enabled));
          },
        }, ui('debugShow'))),
    );
    this.sources.render();
    if (hadFocus) options.find((option) => option.getAttribute('aria-pressed') === 'true')?.focus();
  }

  setOpen(open) {
    if (open === this.dialog.open) return;
    if (open) this.dialog.showModal();
    else this.dialog.close();
    this.button.setAttribute('aria-expanded', String(open));
  }
}

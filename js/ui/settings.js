import { h } from './dom.js';
import { LANGUAGES, getLanguage, setLanguage, ui } from '../i18n/index.js';

/** The gear button and its small pop-up menu, which holds the language choice. */
export class SettingsMenu {
  constructor(element) {
    this.element = element;
    this.button = element.querySelector('.settings__button');
    this.menu = element.querySelector('.settings__menu');
    this.button.addEventListener('click', () => this.setOpen(this.menu.hidden));
    document.addEventListener('pointerdown', (event) => {
      if (!element.contains(event.target)) this.setOpen(false);
    });
    element.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' || this.menu.hidden) return;
      event.stopPropagation();
      this.setOpen(false);
      this.button.focus();
    });
    this.render();
  }

  /** Builds the menu in the current language; keeps keyboard focus on the chosen option. */
  render() {
    const hadFocus = this.menu.contains(document.activeElement);
    const options = LANGUAGES.map(({ code, label }) => h('button', {
      class: 'settings__option',
      type: 'button',
      lang: code,
      'aria-pressed': String(code === getLanguage()),
      onClick: () => setLanguage(code),
    }, label));
    this.menu.replaceChildren(
      h('p', { class: 'settings__heading', id: 'settings-language' }, ui('language')),
      h('div', { class: 'settings__options', role: 'group', 'aria-labelledby': 'settings-language' }, options),
    );
    if (hadFocus) options.find((option) => option.getAttribute('aria-pressed') === 'true')?.focus();
  }

  setOpen(open) {
    this.menu.hidden = !open;
    this.button.setAttribute('aria-expanded', String(open));
  }
}

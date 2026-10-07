import { h } from './dom.js';
import { sourcesText, ui } from '../i18n/index.js';

/**
 * The references page, opened from the settings menu: the ancient writers and
 * the modern scholarship behind the descriptions. Like the settings dialog it
 * is a native <dialog>, so it gets a backdrop, focus trapping and Escape.
 */
export class SourcesDialog {
  constructor(parent) {
    this.dialog = h('dialog', { class: 'settings__dialog sources__dialog', 'aria-labelledby': 'sources-title' });
    parent.append(this.dialog);

    // Clicking the backdrop (outside the dialog's own box) closes it.
    this.dialog.addEventListener('click', (event) => {
      if (event.target === this.dialog) this.dialog.close();
    });
    this.dialog.addEventListener('close', () => this.opener?.focus());
    // Escape closes the dialog (its default) and must not also close the settings behind it.
    this.dialog.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') event.stopPropagation();
    });
  }

  open(opener) {
    this.opener = opener;
    this.render();
    this.dialog.showModal();
    this.dialog.scrollTop = 0;
  }

  /** Rebuilds the page in the current language. */
  render() {
    const text = sourcesText();
    const entry = ({ cite, covers }) =>
      h('li', { class: 'sources__entry' },
        h('span', { class: 'sources__cite' }, cite),
        h('span', { class: 'sources__covers' }, covers));
    this.dialog.replaceChildren(
      h('div', { class: 'settings__head' },
        h('h2', { class: 'settings__title', id: 'sources-title' }, text.title),
        h('button', { class: 'settings__close', type: 'button', 'aria-label': ui('close'), title: ui('close'), onClick: () => this.dialog.close() }, '×')),
      h('p', { class: 'sources__intro' }, text.intro),
      h('h3', { class: 'settings__heading sources__heading' }, text.ancientHeading),
      h('ul', { class: 'sources__list' }, text.ancient.map(entry)),
      h('h3', { class: 'settings__heading sources__heading' }, text.modernHeading),
      h('ul', { class: 'sources__list' }, text.modern.map(entry)),
    );
  }
}

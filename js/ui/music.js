import { h } from './dom.js';

// Can Atilla, "Sultanlar Aşkına".
const TRACK_URI = 'spotify:track:75EquVPqwT64X07WwfHi3b';
const API_URL = 'https://open.spotify.com/embed/iframe-api/v1';
const START_EVENTS = ['pointerdown', 'keydown'];

/**
 * The play button beside the gear and the small music window it opens,
 * holding a Spotify player that starts the music as soon as the page loads.
 * Browsers refuse sound before the visitor has touched the page, so when
 * that first attempt is blocked the music starts on the first click or
 * key press instead. Once it is playing, the player is left to the visitor.
 * Closing the window only hides it, so the music plays on.
 */
export class MusicPlayer {
  constructor(element) {
    this.button = element.querySelector('.music__button');
    this.window = element.querySelector('.music');
    this.closeButton = this.window.querySelector('.music__close');

    this.button.addEventListener('click', () => this.setOpen(this.window.hidden));
    this.closeButton.addEventListener('click', () => this.setOpen(false));
    // Escape closes the window and must not also close the view behind it.
    this.window.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      this.setOpen(false);
    });

    // Keeps trying on each interaction until the player reports that it is playing.
    this.startOnInteraction = () => this.controller?.play();
    const target = h('div');
    this.window.querySelector('.music__player').append(target);
    window.onSpotifyIframeApiReady = (api) => {
      api.createController(target, { uri: TRACK_URI, width: '100%', height: 152 }, (controller) => {
        this.controller = controller;
        controller.addListener('ready', () => controller.play());
        controller.addListener('playback_update', ({ data }) => {
          if (!data.isPaused) this.stopWaiting();
        });
      });
    };
    for (const type of START_EVENTS) document.addEventListener(type, this.startOnInteraction, { capture: true });
    document.head.append(h('script', { src: API_URL, async: true }));
  }

  setOpen(open) {
    if (open === !this.window.hidden) return;
    const hadFocus = this.window.contains(document.activeElement);
    this.window.hidden = !open;
    this.button.setAttribute('aria-expanded', String(open));
    if (open) this.closeButton.focus();
    else if (hadFocus) this.button.focus();
  }

  stopWaiting() {
    for (const type of START_EVENTS) document.removeEventListener(type, this.startOnInteraction, { capture: true });
  }
}

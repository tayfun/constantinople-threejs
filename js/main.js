import './sentry.js'; // first, so it is running before the app's modules load
import { App } from './app.js';
import { LoadingScreen } from './ui/intro.js';
import { ready, translateDocument, ui } from './i18n/index.js';

const root = document.getElementById('app');
const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));

// Show the loading screen (and the introduction) in the visitor's language before the heavy build starts.
await ready;
translateDocument();
const loading = new LoadingScreen(root.querySelector('#loading'));
await nextFrame();
await nextFrame();

try {
  new App(root).start(() => loading.ready());
} catch (error) {
  // three.js throws this when the browser refuses a WebGL context, which Chrome also does to a site whose page lost one before.
  const noWebgl = error.message.startsWith('Error creating WebGL context');
  loading.showError(noWebgl ? ui('noWebgl') : ui('error', { message: error.message }));
  throw error;
}

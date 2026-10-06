import { App } from './app.js';
import { translateDocument, ui } from './i18n/index.js';

const root = document.getElementById('app');
const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));

// Show the loading screen in the visitor's language before the heavy build starts.
translateDocument();
await nextFrame();
await nextFrame();

try {
  new App(root).start();
} catch (error) {
  const loading = root.querySelector('#loading');
  loading.classList.add('is-error');
  loading.textContent = ui('error', { message: error.message });
  throw error;
}

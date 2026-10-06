import * as THREE from 'three';
import { MapView } from './views/mapView.js';
import { DetailView } from './views/detailView.js';
import { InfoPanel } from './ui/infoPanel.js';
import { Sidebar } from './ui/sidebar.js';
import { SettingsMenu } from './ui/settings.js';
import { onLanguageChange, translateDocument } from './i18n/index.js';
import { updateWater } from './models/lib/water.js';
import { wait } from './util/tween.js';
import { LANDMARKS, landmarkById } from './data/landmarks.js';
import { REGIONS } from './data/regions.js';

const FADE_MS = 340;
const regionById = (id) => REGIONS.find((region) => region.id === id);

/**
 * Wires the map, the detail stage and the UI together and runs the frame loop.
 * Modes: 'map' (overview) and 'detail' (one landmark on its plinth).
 */
export class App {
  constructor(root) {
    this.root = root;
    this.mode = 'map';
    this.busy = false;

    const viewport = root.querySelector('#viewport');
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    viewport.appendChild(this.renderer.domElement);

    this.mapView = new MapView({
      renderer: this.renderer,
      container: viewport,
      landmarks: LANDMARKS,
      regions: REGIONS,
      onSelectLandmark: (id) => this.openLandmark(id),
      onSelectRegion: (id) => this.openRegion(id),
    });
    this.detailView = new DetailView({ renderer: this.renderer });

    this.panel = new InfoPanel(root.querySelector('#info-panel'), {
      onSelectLandmark: (id) => this.openLandmark(id),
      onClose: () => (this.mode === 'detail' ? this.closeLandmark() : this.hidePanel()),
    });
    this.sidebar = new Sidebar(root.querySelector('#sidebar'), {
      regions: REGIONS,
      landmarks: LANDMARKS,
      onSelectRegion: (id) => this.openRegion(id),
      onSelectLandmark: (id) => this.openLandmark(id),
      onHome: () => this.showWholeCity(),
      onToggle: () => this.updateInsets(),
    });

    this.settings = new SettingsMenu(root.querySelector('#settings'));
    onLanguageChange(() => this.applyLanguage());

    this.backButton = root.querySelector('#back-button');
    this.backButton.addEventListener('click', () => this.closeLandmark());
    this.fadeLayer = root.querySelector('#fade');

    window.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      if (this.mode === 'detail') this.closeLandmark();
      else this.hidePanel();
    });
    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.mapView.jumpHome();
  }

  start() {
    const clock = new THREE.Clock();
    let firstFrame = true;
    this.renderer.setAnimationLoop(() => {
      const delta = Math.min(clock.getDelta(), 0.1);
      const time = clock.elapsedTime;
      updateWater(time);
      if (this.mode === 'map') {
        this.mapView.update(time, delta);
        this.mapView.render();
      } else {
        this.detailView.update(time, delta);
        this.detailView.render(this.renderer);
      }
      if (firstFrame) {
        firstFrame = false;
        this.root.querySelector('#loading').classList.add('is-done');
      }
    });
  }

  // ---------- navigation ----------

  async openLandmark(id) {
    if (this.busy) return;
    this.busy = true;
    const landmark = landmarkById(id);
    this.sidebar.setActive(id);
    if (this.mode === 'map') {
      this.hidePanel();
      await this.mapView.focusLandmark(id);
    }
    await this.fade(true);
    this.panel.showLandmark(landmark);
    this.setMode('detail');
    this.detailView.show(landmark);
    await this.fade(false);
    this.busy = false;
  }

  async closeLandmark() {
    if (this.busy || this.mode !== 'detail') return;
    this.busy = true;
    this.sidebar.setActive(null);
    await this.fade(true);
    this.panel.hide();
    this.setMode('map');
    await this.fade(false);
    await this.mapView.restoreView();
    this.busy = false;
  }

  async openRegion(id) {
    if (this.busy) return;
    if (this.mode === 'detail') {
      this.busy = true;
      await this.fade(true);
      this.setMode('map');
      await this.fade(false);
      this.busy = false;
    }
    const region = regionById(id);
    this.sidebar.setActive(null);
    this.panel.showRegion(region, LANDMARKS.filter((landmark) => landmark.region === id));
    this.updateInsets();
    await this.mapView.focusRegion(region);
  }

  async showWholeCity() {
    if (this.busy) return;
    this.hidePanel();
    await this.mapView.resetView();
  }

  setMode(mode) {
    this.mode = mode;
    this.root.classList.toggle('is-detail', mode === 'detail');
    this.backButton.hidden = mode !== 'detail';
    this.mapView.setActive(mode === 'map');
    this.detailView.setActive(mode === 'detail');
    this.updateInsets();
  }

  /** Re-renders every piece of text after the visitor picks another language. */
  applyLanguage() {
    translateDocument();
    this.sidebar.render();
    this.panel.refresh();
    this.mapView.refreshLabels();
    this.settings.render();
    this.updateInsets();
  }

  hidePanel() {
    this.panel.hide();
    this.updateInsets();
  }

  /** Tells both views which parts of the screen the sidebar and info panel cover. */
  updateInsets() {
    const narrow = window.matchMedia('(max-width: 760px)').matches;
    const panel = this.panel.element;
    const sidebar = this.sidebar.element;
    const insets = {};
    if (!panel.hidden) {
      if (narrow) insets.bottom = panel.offsetHeight + 10;
      else insets.right = panel.offsetWidth + 18;
    }
    if (this.mode === 'map' && !narrow && !sidebar.classList.contains('is-collapsed')) {
      insets.left = sidebar.offsetWidth + 18;
    }
    this.root.classList.toggle('has-panel', !panel.hidden);
    this.mapView.setInsets(insets);
    this.detailView.setInsets(insets);
  }

  async fade(visible) {
    this.fadeLayer.classList.toggle('is-visible', visible);
    await wait(FADE_MS);
  }

  resize() {
    const { clientWidth: width, clientHeight: height } = this.root;
    this.renderer.setSize(width, height);
    this.mapView.resize(width, height);
    this.detailView.resize(width, height);
    this.updateInsets();
  }
}

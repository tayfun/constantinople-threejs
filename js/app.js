import * as THREE from 'three';
import { MapView } from './views/mapView.js';
import { DetailView } from './views/detailView.js';
import { InfoPanel } from './ui/infoPanel.js';
import { Sidebar } from './ui/sidebar.js';
import { SettingsMenu } from './ui/settings.js';
import { Timeline } from './ui/timeline.js';
import { landmarkText, onLanguageChange, translateDocument, ui } from './i18n/index.js';
import { updateWater } from './models/lib/water.js';
import { wait } from './util/tween.js';
import { QUALITY, pixelRatio } from './util/quality.js';
import { LANDMARKS, landmarkById } from './data/landmarks.js';
import { REGIONS } from './data/regions.js';

const FADE_MS = 340;
const IDLE_REDRAW_S = 0.25; // with reduced motion, a still scene is redrawn this often as a safety net
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
    this.renderer.setPixelRatio(pixelRatio());
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = QUALITY.shadowType;
    // The sun never moves, so the shadow map is redrawn only when a view asks for it
    // (a landmark appearing on the timeline, a diorama with moving parts), not every frame.
    this.renderer.shadowMap.autoUpdate = false;
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
    this.detailView = new DetailView({ renderer: this.renderer, container: viewport, onSelectLandmark: (id) => this.openLandmark(id) });

    this.panel = new InfoPanel(root.querySelector('#info-panel'), {
      onSelectLandmark: (id) => this.openLandmark(id),
      onClose: () => (this.mode === 'detail' ? this.closeLandmark() : this.hidePanel()),
    });
    this.sidebar = new Sidebar(root.querySelector('#sidebar'), {
      regions: REGIONS,
      landmarks: LANDMARKS,
      onSelectRegion: (id) => this.openRegion(id),
      onSelectLandmark: (id) => this.openLandmark(id),
      onToggle: () => this.updateInsets(),
    });

    this.settings = new SettingsMenu(root.querySelector('#settings'));
    this.timeline = new Timeline(root.querySelector('#timeline'), {
      onChange: (year) => {
        this.mapView.setYear(year);
        this.sidebar.setYear(year);
      },
    });
    onLanguageChange(() => this.applyLanguage());

    this.trail = []; // dioramas to step back through before returning to the map
    this.openId = null;
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

  /**
   * The frame loop. Normally every frame is drawn, since the water and the
   * ships are always moving. With reduced motion they stand still, so a
   * frame is drawn only when the camera or the scene changed, with an
   * occasional redraw in case something slipped by unflagged.
   */
  start() {
    const clock = new THREE.Clock();
    let firstFrame = true;
    let lastDrawn = -Infinity;
    this.renderer.setAnimationLoop(() => {
      const delta = Math.min(clock.getDelta(), 0.1);
      const time = clock.elapsedTime;
      const view = this.mode === 'map' ? this.mapView : this.detailView;
      if (!QUALITY.reducedMotion) updateWater(time);
      const changed = view.update(time, delta);
      if (!QUALITY.reducedMotion || changed || time - lastDrawn > IDLE_REDRAW_S) {
        view.render(this.renderer);
        lastDrawn = time;
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
    this.timeline.stop(); // the years stop passing while a diorama is open
    if (this.mode === 'map') {
      this.hidePanel();
      await this.mapView.focusLandmark(id);
    } else if (this.openId && this.openId !== id) {
      // Opened from inside another diorama (a monument on the Hippodrome's spina): the back button returns there first.
      this.trail.push(this.openId);
    }
    this.openId = id;
    await this.fade(true);
    this.panel.showLandmark(landmark);
    this.setMode('detail');
    this.detailView.show(landmark);
    this.updateBackButton();
    await this.fade(false);
    this.busy = false;
  }

  /** Steps back: to the diorama this one was opened from, or else to the map. */
  async closeLandmark() {
    if (this.busy || this.mode !== 'detail') return;
    if (this.trail.length) {
      this.busy = true;
      const id = this.trail.pop();
      const landmark = landmarkById(id);
      this.openId = id;
      this.sidebar.setActive(id);
      await this.fade(true);
      this.panel.showLandmark(landmark);
      this.detailView.show(landmark);
      this.updateBackButton();
      await this.fade(false);
      this.busy = false;
      return;
    }
    this.busy = true;
    this.openId = null;
    this.sidebar.setActive(null);
    await this.fade(true);
    this.panel.hide();
    this.setMode('map');
    await this.fade(false);
    await this.mapView.restoreView();
    this.busy = false;
  }

  /** The back button names where it leads: the previous diorama, or the map. */
  updateBackButton() {
    const previous = this.trail.at(-1);
    this.backButton.textContent = previous ? ui('backTo', { name: landmarkText(previous).name }) : ui('back');
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
    if (this.mode === 'detail') this.updateBackButton();
    this.sidebar.render();
    this.panel.refresh();
    this.mapView.refreshLabels();
    this.settings.render();
    this.timeline.render();
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
    const timeline = this.timeline?.element;
    if (this.mode === 'map' && timeline && getComputedStyle(timeline).display !== 'none') {
      insets.bottom = Math.max(insets.bottom ?? 0, timeline.offsetHeight + 24);
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

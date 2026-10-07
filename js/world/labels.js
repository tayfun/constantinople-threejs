import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';

/** HTML labels pinned to points in the 3D map. */

/**
 * canvas: the WebGL canvas under the labels. Labels take pointer events for
 * clicks and hover, which would otherwise swallow the wheel; scrolling over a
 * label is passed on to the canvas so the map still zooms.
 */
export function createLabelRenderer(container, { canvas = null } = {}) {
  const renderer = new CSS2DRenderer();
  renderer.domElement.className = 'label-layer';
  if (canvas) {
    renderer.domElement.addEventListener('wheel', (event) => {
      event.preventDefault();
      canvas.dispatchEvent(new WheelEvent('wheel', event));
    }, { passive: false });
  }
  container.appendChild(renderer.domElement);
  return renderer;
}

/**
 * kind: 'landmark' | 'region' | 'water' | 'place'. Interactive labels get
 * button semantics so they can be reached from the keyboard. `minor` draws a
 * smaller label, for monuments that stand within a larger landmark.
 */
export function createLabel({ text, sub, kind, onClick, onHover, anchorBottom = false, minor = false }) {
  const element = document.createElement('div');
  element.className = `map-label map-label--${kind}${minor ? ' map-label--minor' : ''}`;
  if (onClick) {
    element.setAttribute('role', 'button');
    element.tabIndex = 0;
    element.addEventListener('click', onClick);
    element.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onClick();
      }
    });
  }
  if (onHover) {
    element.addEventListener('pointerenter', () => onHover(true));
    element.addEventListener('pointerleave', () => onHover(false));
  }
  const label = new CSS2DObject(element);
  if (anchorBottom) label.center.set(0.5, 1);
  setLabelText(label, text, sub);
  return label;
}

/** Replaces a label's text (and optional second line), e.g. after a language change. */
export function setLabelText(label, text, sub) {
  const children = [document.createTextNode(text)];
  if (sub) {
    const small = document.createElement('small');
    small.textContent = sub;
    children.push(small);
  }
  label.element.replaceChildren(...children);
}

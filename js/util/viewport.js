/**
 * Shifts a perspective camera's projection so the scene centres in the part
 * of the screen not covered by panels (insets in CSS pixels), without
 * changing its scale.
 */
export function applyViewInsets(camera, width, height, { left = 0, right = 0, top = 0, bottom = 0 } = {}) {
  const shiftX = (left - right) / 2;
  const shiftY = (top - bottom) / 2;
  const fullWidth = width + 2 * Math.abs(shiftX);
  const fullHeight = height + 2 * Math.abs(shiftY);
  camera.aspect = fullWidth / fullHeight;
  if (shiftX || shiftY) {
    camera.setViewOffset(fullWidth, fullHeight, shiftX > 0 ? 0 : -2 * shiftX, shiftY > 0 ? 0 : -2 * shiftY, width, height);
  } else {
    camera.clearViewOffset();
  }
  camera.updateProjectionMatrix();
}

import * as THREE from 'three';
import { materials as M } from './lib/materials.js';
import { box, cylinder, mesh } from './lib/primitives.js';
import { finalizeModel } from './lib/merge.js';

/**
 * The Serpent Column: three intertwined bronze serpents cast in 479 BC from
 * the arms of the Persians defeated at Plataea, dedicated at Delphi and
 * brought to the Hippodrome by Constantine. Shown complete, as it stood
 * through Byzantine times: the heads were only broken off around 1700.
 *
 * Proportions in metres, from the surviving shaft and the 1574 Freshfield
 * drawing: the three bodies wind 29 coils up a shaft of about 5.4 m, each
 * body a hand's breadth thick and thickening towards the top; the necks
 * then rise and splay apart to three heads set in a triangle, jaws open,
 * about 8 m above the ground. The golden tripod the heads once carried was
 * already lost in the 4th century BC. The column stands on a reused marble
 * capital.
 */
export const SERPENT_COLUMN = {
  plinth: { width: 3.2, height: 0.3 },
  capital: { width: 1.5, height: 0.9 },
  shaft: { height: 5.4, coils: 29, radius: [0.26, 0.2], body: [0.085, 0.115] },
  neck: { rise: 1.5, reach: 1.1 },
  head: 1.5, // scale of the heads: broad, with wide-open jaws
};

// Weathered bronze, dark with the green of a thousand years in the open air.
const patina = new THREE.MeshStandardMaterial({ color: 0x63684c, metalness: 0.55, roughness: 0.5 });
const glassEye = new THREE.MeshStandardMaterial({ color: 0xe6dcb4, metalness: 0.1, roughness: 0.25 });

export function createSerpentColumn({ lod = 'detail' } = {}) {
  const detail = lod === 'detail';
  const monument = new THREE.Group();
  const { plinth, capital, shaft, neck, head } = SERPENT_COLUMN;

  monument.add(box(plinth.width, plinth.height, plinth.width, M.marble, 0, 0, 0));
  // The reused capital: a square block flaring out below a thin abacus.
  monument.add(cylinder(capital.width * 0.68, capital.width * 0.5, capital.height - 0.15, M.marble, 0, plinth.height, 0, 8));
  monument.add(box(capital.width, 0.15, capital.width, M.marble, 0, plinth.height + capital.height - 0.15, 0));
  const foot = plinth.height + capital.height;

  const turns = shaft.coils / 3; // each serpent makes a third of the coils
  const samples = detail ? 520 : 300;
  for (let s = 0; s < 3; s++) {
    const phase = (s / 3) * Math.PI * 2;
    const points = [];
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const angle = phase + t * turns * Math.PI * 2;
      const radius = THREE.MathUtils.lerp(shaft.radius[0], shaft.radius[1], t);
      points.push(new THREE.Vector3(Math.cos(angle) * radius, foot + t * shaft.height, Math.sin(angle) * radius));
    }
    // The neck keeps turning a little as it rises, then leans out towards the head.
    const topAngle = phase + turns * Math.PI * 2;
    const at = (turn, radius, rise) => new THREE.Vector3(Math.cos(topAngle + turn) * radius, foot + shaft.height + rise, Math.sin(topAngle + turn) * radius);
    const neckPoints = [at(0.35, 0.2, 0.45), at(0.6, 0.3, 0.85), at(0.72, 0.55, 1.15), at(0.78, neck.reach, neck.rise)];
    const curve = new THREE.CatmullRomCurve3([...points, ...neckPoints], false, 'catmullrom', 0.5);
    const tube = taperedTube(curve, detail ? 720 : 360, detail ? 10 : 8, (u) => {
      const body = THREE.MathUtils.lerp(shaft.body[0], shaft.body[1], Math.min(1, u * 1.08));
      return body;
    });
    monument.add(mesh(tube, patina));

    const outward = neckPoints.at(-1).clone().sub(neckPoints.at(-2));
    outward.y *= 0.25; // the heads look out almost level, jaws tilted slightly up to carry the tripod
    monument.add(serpentHead(neckPoints.at(-1), outward.normalize(), head, detail));
  }
  return finalizeModel(monument);
}

/** A tube whose radius varies along the curve, so the serpents thicken towards their heads. */
function taperedTube(curve, segments, radial, radiusAt) {
  const geometry = new THREE.TubeGeometry(curve, segments, 1, radial, false);
  const position = geometry.attributes.position;
  const point = new THREE.Vector3();
  const centre = new THREE.Vector3();
  for (let i = 0; i <= segments; i++) {
    curve.getPointAt(i / segments, centre);
    const r = radiusAt(i / segments);
    for (let j = 0; j <= radial; j++) {
      const index = i * (radial + 1) + j;
      point.fromBufferAttribute(position, index).sub(centre).multiplyScalar(r).add(centre);
      position.setXYZ(index, point.x, point.y, point.z);
    }
  }
  geometry.computeVertexNormals();
  return geometry;
}

/** A serpent's head at `at`, snout pointing along `direction`: open jaws and brow ridges, and at full detail the inlaid eyes and forked tongue. */
function serpentHead(at, direction, scale, detail) {
  const head = new THREE.Group();
  head.position.copy(at);
  head.lookAt(at.clone().add(direction)); // local +z is the snout
  head.scale.setScalar(scale);

  const sphere = new THREE.SphereGeometry(1, detail ? 12 : 8, detail ? 8 : 6);
  const skull = mesh(sphere, patina, 0, 0.02, 0.17);
  skull.scale.set(0.15, 0.085, 0.27);
  head.add(skull);

  // The lower jaw hangs open from a hinge at the back of the head.
  const hinge = new THREE.Group();
  hinge.position.set(0, -0.04, 0.0);
  hinge.rotation.x = 0.62;
  const jaw = mesh(sphere, patina, 0, 0, 0.17);
  jaw.scale.set(0.12, 0.05, 0.25);
  hinge.add(jaw);
  head.add(hinge);

  // Brow ridges, with the hollow eyes beneath, once set with glass.
  for (const side of [-1, 1]) {
    const brow = box(0.07, 0.022, 0.1, patina, side * 0.09, 0.072, 0.13);
    brow.rotation.z = -side * 0.45;
    head.add(brow);
    if (!detail) continue;
    const eye = mesh(sphere, glassEye, side * 0.1, 0.055, 0.14);
    eye.scale.setScalar(0.03);
    head.add(eye);
  }
  if (!detail) return head;

  // A bronze tongue flicks out between the jaws.
  const tongue = cylinder(0.008, 0.016, 0.3, M.bronze, 0, -0.02, 0.3, 5);
  tongue.rotation.x = Math.PI / 2;
  head.add(tongue);
  for (const side of [-1, 1]) {
    const fork = cylinder(0.004, 0.009, 0.1, M.bronze, side * 0.02, -0.02, 0.5, 4);
    fork.rotation.x = Math.PI / 2;
    fork.rotation.z = side * 0.25;
    head.add(fork);
  }
  return head;
}

/**
 * Seeded 2D value noise with fractal octaves, for natural-looking
 * clustering (woods, farmland) instead of uniform scatter.
 */
export function createNoise(rnd) {
  const size = 256;
  const values = Float32Array.from({ length: size }, () => rnd.next());
  const perm = Uint8Array.from({ length: size }, (_, i) => i);
  for (let i = size - 1; i > 0; i--) {
    const j = Math.floor(rnd.next() * (i + 1));
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  const lattice = (x, y) => values[perm[(perm[x & 255] + y) & 255]];
  const smooth = (t) => t * t * (3 - 2 * t);

  const value = (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const tx = smooth(x - xi);
    const ty = smooth(y - yi);
    const a = lattice(xi, yi) + (lattice(xi + 1, yi) - lattice(xi, yi)) * tx;
    const b = lattice(xi, yi + 1) + (lattice(xi + 1, yi + 1) - lattice(xi, yi + 1)) * tx;
    return a + (b - a) * ty;
  };

  /** Fractal noise in [0, 1], `frequency` cycles per unit. */
  return (x, y, frequency = 1, octaves = 3) => {
    let sum = 0;
    let weight = 1;
    let total = 0;
    for (let o = 0; o < octaves; o++) {
      sum += value(x * frequency + o * 17.3, y * frequency - o * 9.1) * weight;
      total += weight;
      weight *= 0.5;
      frequency *= 2;
    }
    return sum / total;
  };
}

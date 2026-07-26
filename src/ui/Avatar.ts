// Procedurally generated identicon avatars. Original art: a mirrored 5x5 cell
// grid over a two-stop gradient, seeded off the player name so a given name
// always draws the same face.

const CELLS = 5;
const HALF = Math.ceil(CELLS / 2);

function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic 32-bit PRNG so one seed yields one avatar, always. */
function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface AvatarOptions {
  /** Base hue in degrees. Omit to derive it from the seed. */
  hue?: number;
}

/**
 * Build an SVG identicon as a string. Uses HSL rather than tokens because the
 * whole point is per-player variety — the surrounding ring and panel carry the
 * themed colors.
 */
export function createAvatarSVG(seed: string, options: AvatarOptions = {}): string {
  const h = hash(seed || 'player');
  const rand = mulberry32(h);
  const hue = options.hue ?? h % 360;
  const hue2 = (hue + 40 + Math.floor(rand() * 60)) % 360;

  const bgA = `hsl(${hue} 46% 22%)`;
  const bgB = `hsl(${hue2} 52% 13%)`;
  const fg = `hsl(${hue} 72% 62%)`;
  const fgAlt = `hsl(${hue2} 70% 70%)`;

  const gradId = `av-${h.toString(36)}`;
  const cell = 100 / CELLS;
  const rects: string[] = [];

  for (let col = 0; col < HALF; col++) {
    for (let row = 0; row < CELLS; row++) {
      // Bias the center column solid-ish so faces stay legible at 42px.
      const threshold = col === HALF - 1 ? 0.42 : 0.52;
      if (rand() < threshold) continue;

      const fill = rand() < 0.25 ? fgAlt : fg;
      const mirror = CELLS - 1 - col;
      const y = (row * cell).toFixed(2);
      const w = cell.toFixed(2);

      rects.push(
        `<rect x="${(col * cell).toFixed(2)}" y="${y}" width="${w}" height="${w}" fill="${fill}"/>`
      );
      if (mirror !== col) {
        rects.push(
          `<rect x="${(mirror * cell).toFixed(2)}" y="${y}" width="${w}" height="${w}" fill="${fill}"/>`
        );
      }
    }
  }

  return [
    `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">`,
    `<defs><linearGradient id="${gradId}" x1="0" y1="0" x2="1" y2="1">`,
    `<stop offset="0" stop-color="${bgA}"/><stop offset="1" stop-color="${bgB}"/>`,
    `</linearGradient></defs>`,
    `<rect width="100" height="100" fill="url(#${gradId})"/>`,
    rects.join(''),
    `</svg>`,
  ].join('');
}

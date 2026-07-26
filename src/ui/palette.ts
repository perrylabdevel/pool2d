// Presentation palette. Mirrors the tokens in styles/theme.css so canvas and
// WebGL code can read the same values the DOM does. Nothing here is physics.

export const PALETTE = {
  bg900: '#0B0E14',
  bg800: '#131824',
  bg700: '#1C2333',
  line: '#2A3346',

  felt: '#146B4A',
  feltHi: '#1A8659',
  feltLo: '#0C4531',
  rail: '#4A2C17',
  railHi: '#6B4223',

  gold500: '#F0B429',
  gold600: '#D69A16',
  cyan400: '#38BDF8',
  red500: '#EF4444',
  green400: '#34D399',

  textHi: '#F1F5F9',
  textMid: '#94A3B8',
  textLo: '#64748B',
} as const;

/** Ball identity colors, indexed 1..15. Index 0 is the cue ball. */
export const BALL_PALETTE: readonly string[] = [
  '#F5F3EC', // 0 cue
  '#E8B923', // 1  yellow
  '#1E4FD8', // 2  blue
  '#D32F2F', // 3  red
  '#7B2D8E', // 4  purple
  '#EF6C1A', // 5  orange
  '#1A8659', // 6  green
  '#8C2F24', // 7  maroon
  '#14181F', // 8  black
  '#E8B923', // 9  yellow stripe
  '#1E4FD8', // 10 blue stripe
  '#D32F2F', // 11 red stripe
  '#7B2D8E', // 12 purple stripe
  '#EF6C1A', // 13 orange stripe
  '#1A8659', // 14 green stripe
  '#8C2F24', // 15 maroon stripe
];

export function ballColor(id: number): string {
  return BALL_PALETTE[id] ?? PALETTE.textHi;
}

export function isStripe(id: number): boolean {
  return id >= 9 && id <= 15;
}

/** Read a live token off :root, so runtime theme edits win over the constants. */
export function token(name: string, fallback: string): string {
  if (typeof getComputedStyle !== 'function') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/** Duration tokens resolve to 0ms under prefers-reduced-motion. */
export function prefersReducedMotion(): boolean {
  return (
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

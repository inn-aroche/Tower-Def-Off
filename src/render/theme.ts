// Canvas draw-time palette. Mirrors the CSS custom properties in src/style.css and
// docs/ART_BIBLE.md — keep all three in sync when tuning colors.
export const THEME = {
  skyTop: '#3a4d63',
  skyBottom: '#24313f',
  grassA: '#6fbf5e',
  grassB: '#63ad53',
  pathA: '#c9975a',
  pathB: '#bd8a4d',
  pathOutline: '#5b3a22',
  outlineDark: '#1f2733',
  keepGold: '#ffd166',
  keepGoldDark: '#c99a2e',
  spawnPurple: '#7c5cff',
  hpGreen: '#59c46a',
  hpYellow: '#f4c14e',
  hpRed: '#e15b5b',
  hpTrack: '#1a222c',
  goldColor: '#ffd166',
  critText: '#ff8a3d',
  buildHighlight: 'rgba(255, 209, 102, 0.35)',
  blockedHighlight: 'rgba(225, 91, 91, 0.35)',
} as const;

export function hpColor(fraction: number): string {
  if (fraction > 0.5) return THEME.hpGreen;
  if (fraction > 0.25) return THEME.hpYellow;
  return THEME.hpRed;
}

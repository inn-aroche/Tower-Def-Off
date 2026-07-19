/** Pixel rects for the combat HUD chrome (top bar, mana bar, card hand). Shared by the renderer
 * and the input controller so hit-testing and drawing never drift — same contract as BoardLayout. */

export const TOP_INSET = 84;
export const MANA_H = 24;
export const CARD_H = 88;
export const PAD = 12;
/** Board area is squeezed between TOP_INSET and this bottom band (mana bar + card hand). */
export const BOTTOM_INSET = PAD + MANA_H + PAD + CARD_H + PAD;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function manaBarRect(canvasW: number, canvasH: number): Rect {
  return { x: PAD, y: canvasH - BOTTOM_INSET + PAD, w: canvasW - 2 * PAD, h: MANA_H };
}

export function cardRects(canvasW: number, canvasH: number, count: number): Rect[] {
  if (count <= 0) return [];
  const y = canvasH - PAD - CARD_H;
  const cardW = (canvasW - PAD * (count + 1)) / count;
  return Array.from({ length: count }, (_, i) => ({ x: PAD + i * (cardW + PAD), y, w: cardW, h: CARD_H }));
}

export function hitCard(canvasW: number, canvasH: number, count: number, x: number, y: number): number | null {
  const rects = cardRects(canvasW, canvasH, count);
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
  }
  return null;
}

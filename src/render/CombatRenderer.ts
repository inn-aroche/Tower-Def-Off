import type { BoardLayout } from './BoardLayout';
import { cellToPixel } from './BoardLayout';
import type { CombatSnapshot, EnemyDef, UnitDef, UnitFamily } from '../sim/types';

/** Placeholder-art palette (M1: "feel first", not DA-conformant — see docs/design). */
const FAMILY_COLOR: Record<UnitFamily, string> = {
  melee: '#4a90c4',
  ranged: '#4caf50',
  gravity: '#178a8a',
};

const ENEMY_COLOR: Record<string, string> = {
  goblin: '#8b5a2b',
  runner: '#e0a83c',
  brute: '#7d3c3c',
  troll: '#4a2e57',
};

export const TOP_INSET = 76;
export const BOTTOM_INSET = 110;

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export interface RenderContext {
  unitDefs: Map<string, UnitDef>;
  enemyDefs: Map<string, EnemyDef>;
  levelName: string;
}

export function drawCombatFrame(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  layout: BoardLayout,
  snapshot: CombatSnapshot,
  selectedCell: { col: number; row: number } | null,
  render: RenderContext,
): void {
  // Background
  ctx.fillStyle = '#efe8d6';
  ctx.fillRect(0, 0, canvasW, canvasH);

  drawTopHud(ctx, canvasW, snapshot, render.levelName);
  drawBoard(ctx, layout, snapshot, selectedCell, render);
  drawBottomHud(ctx, canvasW, canvasH, snapshot);

  if (snapshot.outcome !== 'ongoing') {
    drawOutcomeOverlay(ctx, canvasW, canvasH, snapshot.outcome);
  }
}

function drawTopHud(ctx: CanvasRenderingContext2D, canvasW: number, snapshot: CombatSnapshot, levelName: string): void {
  ctx.fillStyle = '#3a2a1c';
  ctx.fillRect(0, 0, canvasW, TOP_INSET);

  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.font = "700 15px 'Nunito', sans-serif";
  ctx.textAlign = 'left';
  ctx.fillText(levelName, 16, 24);

  ctx.font = "800 13px 'Nunito', sans-serif";
  ctx.fillStyle = '#f0c26a';
  ctx.textAlign = 'left';
  ctx.fillText(`Vague ${Math.min(snapshot.currentWaveIndex + 1, snapshot.totalWaves)}/${snapshot.totalWaves}`, 16, 50);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#e74c3c';
  ctx.font = "800 16px 'Nunito', sans-serif";
  ctx.fillText(`❤ ${snapshot.life}`, canvasW - 16, 24);
  ctx.fillStyle = '#fff';
  ctx.font = "700 13px 'Nunito', sans-serif";
  ctx.fillText(`${snapshot.kills} éliminés`, canvasW - 16, 50);
}

function drawBoard(
  ctx: CanvasRenderingContext2D,
  layout: BoardLayout,
  snapshot: CombatSnapshot,
  selectedCell: { col: number; row: number } | null,
  render: RenderContext,
): void {
  // Grid tiles
  for (let row = 0; row < layout.rows; row++) {
    for (let col = 0; col < layout.cols; col++) {
      const { x, y } = cellToPixel(layout, col, row);
      const isEven = (row + col) % 2 === 0;
      ctx.fillStyle = isEven ? '#c9e0a8' : '#bcd898';
      ctx.fillRect(x, y, layout.cellSize, layout.cellSize);
    }
  }

  const isSelected = (col: number, row: number) => !!selectedCell && selectedCell.col === col && selectedCell.row === row;

  for (const unit of snapshot.units) {
    const def = render.unitDefs.get(unit.unitId);
    if (!def) continue;
    const { x, y } = cellToPixel(layout, unit.col, unit.row);
    const pad = layout.cellSize * 0.08;
    const size = layout.cellSize - pad * 2;

    roundRect(ctx, x + pad, y + pad, size, size, size * 0.22);
    ctx.fillStyle = FAMILY_COLOR[def.family];
    ctx.fill();
    if (isSelected(unit.col, unit.row)) {
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#fff6d9';
      ctx.stroke();
    }

    // Level badge
    const badgeR = size * 0.16;
    ctx.beginPath();
    ctx.arc(x + size + pad - badgeR * 0.6, y + pad + badgeR * 0.6, badgeR, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.fillStyle = FAMILY_COLOR[def.family];
    ctx.font = `800 ${Math.max(9, badgeR)}px 'Baloo 2', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(unit.level), x + size + pad - badgeR * 0.6, y + pad + badgeR * 0.6 + 0.5);

    // Family initial (placeholder pictogram)
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.font = `800 ${size * 0.32}px 'Nunito', sans-serif`;
    ctx.fillText(def.name[0]!, x + size / 2 + pad, y + size / 2 + pad);
  }

  for (const enemy of snapshot.enemies) {
    const def = render.enemyDefs.get(enemy.enemyId);
    if (!def) continue;
    const cx = layout.originX + (enemy.col + 0.5) * layout.cellSize;
    const cy = layout.originY + enemy.rowPos * layout.cellSize;
    const radius = layout.cellSize * 0.32;

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = ENEMY_COLOR[enemy.enemyId] ?? '#555';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#fff';
    ctx.stroke();

    const hpFrac = Math.max(0, Math.min(1, enemy.hp / def.hp));
    const barW = radius * 2;
    const barX = cx - radius;
    const barY = cy - radius - 6;
    ctx.fillStyle = '#1f1610';
    ctx.fillRect(barX, barY, barW, 3);
    ctx.fillStyle = '#4caf50';
    ctx.fillRect(barX, barY, barW * hpFrac, 3);
  }
}

function drawBottomHud(ctx: CanvasRenderingContext2D, canvasW: number, canvasH: number, snapshot: CombatSnapshot): void {
  const barY = canvasH - BOTTOM_INSET;
  ctx.fillStyle = '#25381f';
  ctx.fillRect(0, barY, canvasW, BOTTOM_INSET);

  const manaBarX = 16;
  const manaBarY = barY + 14;
  const manaBarW = canvasW - 32;
  const manaBarH = 22;
  ctx.fillStyle = '#1f1610';
  roundRect(ctx, manaBarX, manaBarY, manaBarW, manaBarH, 10);
  ctx.fill();
  const manaFrac = snapshot.mana / 10;
  ctx.fillStyle = '#9b59b6';
  roundRect(ctx, manaBarX, manaBarY, manaBarW * manaFrac, manaBarH, 10);
  ctx.fill();

  ctx.fillStyle = '#fff';
  ctx.font = "800 12px 'Baloo 2', sans-serif";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${snapshot.mana.toFixed(1)} / 10`, manaBarX + manaBarW / 2, manaBarY + manaBarH / 2 + 1);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#f0c26a';
  ctx.font = "700 12px 'Nunito', sans-serif";
  ctx.fillText(
    `Case vide = invoquer (coût ${snapshot.nextSummonCost.toFixed(1)}) · toucher 2 unités identiques = fusionner`,
    16,
    barY + 54,
  );
  ctx.font = "600 11px 'Nunito', sans-serif";
  ctx.fillStyle = '#cfe0c0';
  ctx.fillText(`Résumé : ${snapshot.units.length} unités sur la grille`, 16, barY + 78);
}

function drawOutcomeOverlay(ctx: CanvasRenderingContext2D, canvasW: number, canvasH: number, outcome: 'victory' | 'defeat'): void {
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, canvasW, canvasH);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = "800 30px 'Baloo 2', sans-serif";
  ctx.fillStyle = outcome === 'victory' ? '#8ee06a' : '#e74c3c';
  ctx.fillText(outcome === 'victory' ? 'VICTOIRE !' : 'DÉFAITE', canvasW / 2, canvasH / 2 - 10);
  ctx.font = "600 14px 'Nunito', sans-serif";
  ctx.fillStyle = '#fff';
  ctx.fillText('Touchez l’écran pour continuer', canvasW / 2, canvasH / 2 + 26);
}

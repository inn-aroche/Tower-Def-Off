import type { BoardLayout } from './BoardLayout';
import { cardRects, manaBarRect, MANA_H, TOP_INSET } from './HudLayout';
import type { Cell, CombatSnapshot, EnemyDef, HandCard, UnitDef, UnitFamily } from '../sim/types';

/** Family palette + pictograms follow docs/design/design-tokens.md: melee = circle, ranged =
 * triangle, gravity = ring (the WARDENS-specific shape, kept distinct from the maquette's
 * diamond/square). Still a placeholder pass — no sprites, but token-faithful colours and shapes. */
const FAMILY_COLOR: Record<UnitFamily, string> = {
  melee: '#4a90c4',
  ranged: '#4caf50',
  gravity: '#1aa39a',
};
const FAMILY_BORDER: Record<UnitFamily, string> = {
  melee: '#2f6690',
  ranged: '#2e7d32',
  gravity: '#0d6e66',
};

const ENEMY_COLOR: Record<string, string> = {
  goblin: '#8b5a2b',
  runner: '#e0a83c',
  brute: '#7d3c3c',
  troll: '#4a2e57',
  wraith: '#7f8fd0',
  saboteur: '#c0392b',
  juggernaut: '#5d6d7e',
  ogre: '#5a7d3c',
  warlord: '#a83232',
  necromancer: '#5b3a6e',
  stone_colossus: '#6b6b6b',
  high_priestess: '#c9a0dc',
};

export interface RenderContext {
  unitDefs: Map<string, UnitDef>;
  enemyDefs: Map<string, EnemyDef>;
  levelName: string;
  path: Cell[];
}

export interface CombatUiState {
  selectedCardIndex: number | null;
  selectedUnit: { col: number; row: number } | null;
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawPictogram(ctx: CanvasRenderingContext2D, family: UnitFamily, cx: number, cy: number, s: number): void {
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  if (family === 'ranged') {
    ctx.beginPath();
    ctx.moveTo(cx, cy - s * 0.5);
    ctx.lineTo(cx + s * 0.5, cy + s * 0.42);
    ctx.lineTo(cx - s * 0.5, cy + s * 0.42);
    ctx.closePath();
    ctx.fill();
  } else if (family === 'gravity') {
    ctx.lineWidth = Math.max(2, s * 0.16);
    ctx.beginPath();
    ctx.arc(cx, cy, s * 0.42, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, s * 0.16, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.arc(cx, cy, s * 0.42, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Optional juice hooks supplied by the Effects layer (see render/Effects.ts). */
export interface CombatFx {
  isFlashing?: (instanceId: number) => boolean;
  pulseSec?: number;
}

export function drawCombatFrame(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  layout: BoardLayout,
  snapshot: CombatSnapshot,
  ui: CombatUiState,
  render: RenderContext,
  fx: CombatFx = {},
): void {
  ctx.fillStyle = '#efe8d6';
  ctx.fillRect(0, 0, canvasW, canvasH);

  drawTopBar(ctx, canvasW, snapshot, render.levelName);
  drawBoard(ctx, layout, snapshot, ui, render, fx);
  drawManaBar(ctx, canvasW, canvasH, snapshot);
  drawHand(ctx, canvasW, canvasH, snapshot.hand, ui.selectedCardIndex);

  if (snapshot.outcome !== 'ongoing') drawOutcomeOverlay(ctx, canvasW, canvasH, snapshot.outcome);
}

function formatTime(sec: number): string {
  const s = Math.floor(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function drawTopBar(ctx: CanvasRenderingContext2D, canvasW: number, snapshot: CombatSnapshot, levelName: string): void {
  const grad = ctx.createLinearGradient(0, 0, 0, TOP_INSET);
  grad.addColorStop(0, '#3a2a1c');
  grad.addColorStop(1, '#2b1e14');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvasW, TOP_INSET);

  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#fff';
  ctx.font = "800 17px 'Baloo 2', 'Nunito', sans-serif";
  ctx.fillText(levelName, 16, 42);

  ctx.font = "800 12px 'Baloo 2', 'Nunito', sans-serif";
  ctx.fillStyle = '#f0c26a';
  const waveText = snapshot.endless
    ? `VAGUE ${snapshot.currentWaveIndex + 1} · ∞`
    : `VAGUE ${Math.min(snapshot.currentWaveIndex + 1, snapshot.totalWaves)}/${snapshot.totalWaves}`;
  ctx.fillText(waveText, 16, 64);

  // timer pill (right)
  ctx.textAlign = 'right';
  ctx.font = "800 15px 'Baloo 2', 'Nunito', sans-serif";
  const timeStr = formatTime(snapshot.elapsedSec);
  ctx.fillStyle = '#2b1e14';
  const tw = ctx.measureText(timeStr).width + 20;
  roundRectPath(ctx, canvasW - 16 - tw, 30, tw, 26, 13);
  ctx.fill();
  ctx.strokeStyle = '#f0c26a';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#f0c26a';
  ctx.fillText(timeStr, canvasW - 26, 44);

  // lives (right, above timer)
  ctx.fillStyle = '#e74c3c';
  ctx.font = "800 15px 'Nunito', sans-serif";
  ctx.fillText(`❤ ${snapshot.life}`, canvasW - 16, 16);
}

function drawBoard(
  ctx: CanvasRenderingContext2D,
  layout: BoardLayout,
  snapshot: CombatSnapshot,
  ui: CombatUiState,
  render: RenderContext,
  fx: CombatFx,
): void {
  const cs = layout.cellSize;
  const cx = (col: number) => layout.originX + (col + 0.5) * cs;
  const cy = (row: number) => layout.originY + (row + 0.5) * cs;
  const pathSet = new Set(render.path.map((c) => `${c.col},${c.row}`));

  // grass tiles
  for (let row = 0; row < layout.rows; row++) {
    for (let col = 0; col < layout.cols; col++) {
      const x = layout.originX + col * cs;
      const y = layout.originY + row * cs;
      if (pathSet.has(`${col},${row}`)) {
        ctx.fillStyle = '#e7cf95';
      } else {
        ctx.fillStyle = (row + col) % 2 === 0 ? '#c9e0a8' : '#bcd898';
      }
      ctx.fillRect(x, y, cs, cs);
    }
  }

  // path ribbon
  if (render.path.length >= 2) {
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx(render.path[0].col), cy(render.path[0].row));
    for (let i = 1; i < render.path.length; i++) ctx.lineTo(cx(render.path[i].col), cy(render.path[i].row));
    ctx.strokeStyle = '#c9a24e';
    ctx.lineWidth = cs * 0.66;
    ctx.stroke();
    ctx.strokeStyle = '#f2d98d';
    ctx.lineWidth = cs * 0.46;
    ctx.stroke();
  }

  // spawn + base markers
  const spawn = render.path[0];
  const base = render.path[render.path.length - 1];
  if (spawn) {
    ctx.fillStyle = 'rgba(140,60,40,0.85)';
    ctx.beginPath();
    ctx.arc(cx(spawn.col), cy(spawn.row), cs * 0.22, 0, Math.PI * 2);
    ctx.fill();
  }
  if (base) {
    ctx.fillStyle = '#2e7d32';
    roundRectPath(ctx, cx(base.col) - cs * 0.28, cy(base.row) - cs * 0.28, cs * 0.56, cs * 0.56, cs * 0.14);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = `800 ${cs * 0.3}px 'Nunito', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⌂', cx(base.col), cy(base.row) + 1);
  }

  // valid-placement hint when a card is selected
  if (ui.selectedCardIndex !== null) {
    const occupied = new Set(snapshot.units.map((u) => `${u.col},${u.row}`));
    for (let row = 0; row < layout.rows; row++) {
      for (let col = 0; col < layout.cols; col++) {
        const key = `${col},${row}`;
        if (pathSet.has(key) || occupied.has(key)) continue;
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1;
        ctx.strokeRect(layout.originX + col * cs + 1.5, layout.originY + row * cs + 1.5, cs - 3, cs - 3);
      }
    }
  }

  // gravity fields (under units) — makes the differentiator legible; gentle pulse
  const pulse = 0.5 + 0.5 * Math.sin((fx.pulseSec ?? 0) * 3);
  for (const unit of snapshot.units) {
    const def = render.unitDefs.get(unit.unitId);
    if (!def || def.family !== 'gravity') continue;
    const range = def.levels[unit.level - 1]?.range ?? 0;
    const ucx = cx(unit.col);
    const ucy = cy(unit.row);
    const rad = range * cs;
    const grad = ctx.createRadialGradient(ucx, ucy, rad * 0.2, ucx, ucy, rad);
    grad.addColorStop(0, `rgba(26,163,154,${0.12 + 0.06 * pulse})`);
    grad.addColorStop(1, 'rgba(26,163,154,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(ucx, ucy, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(26,163,154,${0.3 + 0.25 * pulse})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(ucx, ucy, rad, 0, Math.PI * 2);
    ctx.stroke();
  }

  // boost-aura fields (gold radius under the rallying unit) — drawn like gravity fields
  for (const unit of snapshot.units) {
    const ability = render.unitDefs.get(unit.unitId)?.ability;
    if (ability?.kind !== 'boost_aura') continue;
    const ucx = cx(unit.col);
    const ucy = cy(unit.row);
    const rad = ability.radius * cs;
    const grad = ctx.createRadialGradient(ucx, ucy, rad * 0.2, ucx, ucy, rad);
    grad.addColorStop(0, `rgba(240,194,106,${0.1 + 0.05 * pulse})`);
    grad.addColorStop(1, 'rgba(240,194,106,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(ucx, ucy, rad, 0, Math.PI * 2);
    ctx.fill();
  }

  // units
  for (const unit of snapshot.units) {
    const def = render.unitDefs.get(unit.unitId);
    if (!def) continue;
    const x = layout.originX + unit.col * cs;
    const y = layout.originY + unit.row * cs;
    const pad = cs * 0.1;
    const size = cs - pad * 2;
    roundRectPath(ctx, x + pad, y + pad, size, size, size * 0.24);
    ctx.fillStyle = FAMILY_COLOR[def.family];
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle =
      ui.selectedUnit && ui.selectedUnit.col === unit.col && ui.selectedUnit.row === unit.row
        ? '#fff6d9'
        : FAMILY_BORDER[def.family];
    ctx.stroke();

    drawPictogram(ctx, def.family, x + cs / 2, y + cs / 2, size * 0.6);

    // stunned overlay — greyed out with a spinning spark so the player reads "disabled"
    if ((unit.stunnedUntilSec ?? 0) > snapshot.elapsedSec) {
      roundRectPath(ctx, x + pad, y + pad, size, size, size * 0.24);
      ctx.fillStyle = 'rgba(40,44,52,0.55)';
      ctx.fill();
      ctx.font = `${size * 0.5}px 'Baloo 2', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⚡', x + cs / 2, y + cs / 2 + 1);
    }

    // level badge
    const br = size * 0.2;
    const bx = x + cs - pad - br * 0.4;
    const by = y + pad + br * 0.4;
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.fillStyle = FAMILY_BORDER[def.family];
    ctx.font = `800 ${Math.max(9, br * 1.1)}px 'Baloo 2', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(unit.level), bx, by + 0.5);
  }

  // enemies (drawn last, with a soft ground shadow so they read as above the field)
  for (const enemy of snapshot.enemies) {
    const def = render.enemyDefs.get(enemy.enemyId);
    if (!def) continue;
    const boss = def.boss === true;
    const radius = cs * (boss ? 0.42 : 0.3);
    const ex = layout.originX + enemy.x * cs;
    // Flyers hover above the field; a bob keeps them lively.
    const hover = def.flying ? radius * (1.05 + 0.12 * Math.sin(snapshot.elapsedSec * 4 + enemy.instanceId)) : 0;
    const ey = layout.originY + enemy.y * cs - hover;
    const groundY = layout.originY + enemy.y * cs;

    // ground shadow (stays on the field even when a flyer is lifted)
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(ex, groundY + radius * 0.7, radius * (def.flying ? 0.7 : 0.95), radius * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();

    // flyer wings behind the body
    if (def.flying) {
      const flap = 0.5 + 0.5 * Math.abs(Math.sin(snapshot.elapsedSec * 8 + enemy.instanceId));
      ctx.fillStyle = 'rgba(127,143,208,0.55)';
      for (const dir of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(ex + dir * radius * 0.85, ey - radius * 0.1, radius * 0.7, radius * (0.35 + 0.25 * flap), dir * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.beginPath();
    ctx.arc(ex, ey, radius, 0, Math.PI * 2);
    ctx.fillStyle = ENEMY_COLOR[enemy.enemyId] ?? '#555';
    ctx.fill();
    ctx.lineWidth = boss ? 3 : 2;
    ctx.strokeStyle = boss ? '#ffd76a' : '#fff';
    ctx.stroke();

    // armored: metallic bolt ring
    if (def.armor && def.armor > 0) {
      ctx.strokeStyle = 'rgba(220,225,235,0.9)';
      ctx.lineWidth = 2;
      ctx.setLineDash([radius * 0.5, radius * 0.35]);
      ctx.beginPath();
      ctx.arc(ex, ey, radius * 0.78, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // regenerator: soft green pulse
    if (def.regenPerSec && enemy.hp < enemy.maxHp) {
      ctx.strokeStyle = `rgba(120,220,120,${0.35 + 0.25 * pulse})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(ex, ey, radius * 1.15, 0, Math.PI * 2);
      ctx.stroke();
    }

    // hit flash
    if (fx.isFlashing?.(enemy.instanceId)) {
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.beginPath();
      ctx.arc(ex, ey, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // active shield bubble
    if (enemy.shieldedUntilSec > snapshot.elapsedSec) {
      ctx.strokeStyle = `rgba(120,190,255,${0.55 + 0.3 * pulse})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(ex, ey, radius * 1.35, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = `rgba(120,190,255,${0.12 + 0.06 * pulse})`;
      ctx.beginPath();
      ctx.arc(ex, ey, radius * 1.35, 0, Math.PI * 2);
      ctx.fill();
    }

    // chilled: frost tint over the body
    if (enemy.chilledUntilSec > snapshot.elapsedSec) {
      ctx.fillStyle = 'rgba(150,205,255,0.45)';
      ctx.beginPath();
      ctx.arc(ex, ey, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // HP bar (uses live maxHp so scaled/boss enemies read correctly)
    const hpFrac = Math.max(0, Math.min(1, enemy.hp / Math.max(1, enemy.maxHp)));
    const barW = radius * 2;
    const barX = ex - radius;
    const barY = ey - radius - (boss ? 9 : 6);
    ctx.fillStyle = '#1f1610';
    ctx.fillRect(barX, barY, barW, boss ? 5 : 3.5);
    ctx.fillStyle = boss ? '#ffb347' : hpFrac > 0.4 ? '#4caf50' : '#e74c3c';
    ctx.fillRect(barX, barY, barW * hpFrac, boss ? 5 : 3.5);

    // boss crown + name label
    if (boss) {
      ctx.font = `${radius * 0.9}px 'Baloo 2', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('👑', ex, ey - radius - 16);
      ctx.fillStyle = '#ffe9b0';
      ctx.font = "800 10px 'Baloo 2', sans-serif";
      ctx.fillText(def.name, ex, barY - 7);
    }
  }

  // hero (drawn on top of the field when deployed)
  const hero = snapshot.hero;
  if (hero.configured && hero.deployed) {
    const hx = layout.originX + (hero.col + 0.5) * cs;
    const hy = layout.originY + (hero.row + 0.5) * cs;
    const hr = cs * 0.44;
    // aura ring
    ctx.strokeStyle = `rgba(159,120,255,${0.5 + 0.3 * pulse})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(hx, hy, hr * 1.2, 0, Math.PI * 2);
    ctx.stroke();
    // body
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(hx, hy + hr * 0.7, hr * 0.9, hr * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(hx, hy, hr, 0, Math.PI * 2);
    ctx.fillStyle = '#6a4a8c';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#ffd76a';
    ctx.stroke();
    ctx.font = `${hr * 1.1}px 'Baloo 2', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🦸', hx, hy + 1);
    // HP bar
    const hpFrac = Math.max(0, Math.min(1, hero.hp / Math.max(1, hero.maxHp)));
    const bw = hr * 2;
    ctx.fillStyle = '#1f1610';
    ctx.fillRect(hx - hr, hy - hr - 8, bw, 5);
    ctx.fillStyle = hpFrac > 0.4 ? '#4caf50' : '#e74c3c';
    ctx.fillRect(hx - hr, hy - hr - 8, bw * hpFrac, 5);
  }
}

function drawManaBar(ctx: CanvasRenderingContext2D, canvasW: number, canvasH: number, snapshot: CombatSnapshot): void {
  const r = manaBarRect(canvasW, canvasH);
  roundRectPath(ctx, r.x, r.y, r.w, r.h, MANA_H / 2);
  ctx.fillStyle = '#1f1610';
  ctx.fill();
  const frac = Math.max(0, Math.min(1, snapshot.mana / 10));
  if (frac > 0) {
    ctx.save();
    roundRectPath(ctx, r.x, r.y, r.w, r.h, MANA_H / 2);
    ctx.clip();
    const grad = ctx.createLinearGradient(r.x, 0, r.x + r.w, 0);
    grad.addColorStop(0, '#9b59b6');
    grad.addColorStop(1, '#c39bd3');
    ctx.fillStyle = grad;
    ctx.fillRect(r.x, r.y, r.w * frac, r.h);
    ctx.restore();
  }
  ctx.fillStyle = '#fff';
  ctx.font = "800 12px 'Baloo 2', sans-serif";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${snapshot.mana.toFixed(1)} / 10`, r.x + r.w / 2, r.y + r.h / 2 + 0.5);
}

function drawHand(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  hand: HandCard[],
  selectedIndex: number | null,
): void {
  const rects = cardRects(canvasW, canvasH, hand.length);
  hand.forEach((card, i) => {
    const r = rects[i];
    const selected = selectedIndex === i;
    ctx.globalAlpha = card.affordable ? 1 : 0.45;

    roundRectPath(ctx, r.x, r.y, r.w, r.h, 10);
    ctx.fillStyle = '#f5ecd7';
    ctx.fill();
    ctx.lineWidth = selected ? 3.5 : 2;
    ctx.strokeStyle = selected ? '#f0c26a' : '#8b5a2b';
    ctx.stroke();

    const badgeR = Math.min(r.w, r.h) * 0.2;
    const bcx = r.x + r.w / 2;
    const bcy = r.y + r.h * 0.4;
    ctx.beginPath();
    ctx.arc(bcx, bcy, badgeR, 0, Math.PI * 2);
    ctx.fillStyle = FAMILY_COLOR[card.family];
    ctx.fill();
    drawPictogram(ctx, card.family, bcx, bcy, badgeR * 1.4);

    ctx.fillStyle = '#3b2a1a';
    ctx.font = "700 10px 'Nunito', sans-serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(card.name, r.x + r.w / 2, r.y + r.h - 14);

    // cost badge (top-left, mana violet)
    const cr = 11;
    ctx.beginPath();
    ctx.arc(r.x + cr, r.y + cr, cr, 0, Math.PI * 2);
    ctx.fillStyle = '#9b59b6';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = "800 11px 'Baloo 2', sans-serif";
    ctx.fillText(String(card.cost), r.x + cr, r.y + cr + 0.5);
  });
  ctx.globalAlpha = 1;
}

function drawOutcomeOverlay(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  outcome: 'victory' | 'defeat',
): void {
  ctx.fillStyle = 'rgba(20,12,6,0.62)';
  ctx.fillRect(0, 0, canvasW, canvasH);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = "800 32px 'Baloo 2', sans-serif";
  ctx.fillStyle = outcome === 'victory' ? '#8ee06a' : '#e74c3c';
  ctx.fillText(outcome === 'victory' ? 'VICTOIRE !' : 'DÉFAITE', canvasW / 2, canvasH / 2 - 12);
  ctx.font = "600 14px 'Nunito', sans-serif";
  ctx.fillStyle = '#fff';
  ctx.fillText("Touchez l'écran pour continuer", canvasW / 2, canvasH / 2 + 24);
}

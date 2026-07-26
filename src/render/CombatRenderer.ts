import type { BoardLayout } from './BoardLayout';
import { boardCorners, projectPoint, type ProjectedPoint } from './BoardProjection';
import { cardRects, manaBarRect, MANA_H, TOP_INSET } from './HudLayout';
import type { Cell, CombatSnapshot, EnemyDef, HandCard, UnitDef, UnitFamily } from '../sim/types';
import { abilityLabel } from '../data/units';

const FAMILY_LABEL: Record<UnitFamily, string> = { melee: 'Mêlée', ranged: 'Distance', gravity: 'Gravité' };

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
  drawSelectedInfo(ctx, canvasW, canvasH, snapshot, ui, render);
  drawManaBar(ctx, canvasW, canvasH, snapshot);
  drawHand(ctx, canvasW, canvasH, snapshot.hand, ui.selectedCardIndex);

  if (snapshot.outcome !== 'ongoing') drawOutcomeOverlay(ctx, canvasW, canvasH, snapshot.outcome);
}

/** Info banner (above the mana bar) explaining the selected card or placed unit — what it does. */
function drawSelectedInfo(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  snapshot: CombatSnapshot,
  ui: CombatUiState,
  render: RenderContext,
): void {
  let def: UnitDef | undefined;
  let level: number | undefined;
  if (ui.selectedCardIndex !== null && snapshot.hand[ui.selectedCardIndex]) {
    def = render.unitDefs.get(snapshot.hand[ui.selectedCardIndex].unitId);
  } else if (ui.selectedUnit) {
    const u = snapshot.units.find((u) => u.col === ui.selectedUnit!.col && u.row === ui.selectedUnit!.row);
    if (u) {
      def = render.unitDefs.get(u.unitId);
      level = u.level;
    }
  }
  if (!def) return;

  const ability = abilityLabel(def);
  const title = `${def.name} · ${FAMILY_LABEL[def.family]}${level ? ` · Niv ${level}` : ''}`;
  const desc = ability
    ? `${ability.title} — ${ability.text}`
    : def.family === 'gravity'
      ? 'Ralentit les ennemis dans sa zone (ne tire pas).'
      : 'Attaque les ennemis à portée.';

  const r = manaBarRect(canvasW, canvasH);
  const h = 42;
  const y = r.y - h - 6;
  roundRectPath(ctx, r.x, y, r.w, h, 10);
  ctx.fillStyle = 'rgba(43,30,20,0.92)';
  ctx.fill();
  ctx.strokeStyle = FAMILY_COLOR[def.family];
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f0c26a';
  ctx.font = "800 12px 'Baloo 2', sans-serif";
  ctx.fillText(title, r.x + 12, y + 13);
  ctx.fillStyle = '#efe4cf';
  ctx.font = "600 10px 'Nunito', sans-serif";
  ctx.fillText(fitText(ctx, desc, r.w - 24), r.x + 12, y + 29);
}

/** Truncates text with an ellipsis to fit a pixel width. */
function fitText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t + '…';
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

/**
 * Perspective (2.5D) board. The grid is tilted ~35° away from the camera: far rows recede toward a
 * hazy horizon, the road tapers, ground fields become ellipses and units/enemies stand up as
 * volumes. All geometry goes through the shared {@link projectPoint} so hit-testing never drifts.
 * Entities are painted back-to-front (painter's algorithm) so nearer volumes occlude farther ones.
 */
function drawBoard(
  ctx: CanvasRenderingContext2D,
  layout: BoardLayout,
  snapshot: CombatSnapshot,
  ui: CombatUiState,
  render: RenderContext,
  fx: CombatFx,
): void {
  const cs = layout.cellSize;
  const boardW = cs * layout.cols;
  const canvasW = layout.originX * 2 + boardW;
  const proj = (col: number, row: number): ProjectedPoint => projectPoint(layout, col, row);
  const pathSet = new Set(render.path.map((c) => `${c.col},${c.row}`));
  const pulse = 0.5 + 0.5 * Math.sin((fx.pulseSec ?? 0) * 3);
  const [TL, TR, BR, BL] = boardCorners(layout);

  // ---- sky / atmosphere behind the tilted plane (shows through the trapezoid's far corners) ----
  const sky = ctx.createLinearGradient(0, TOP_INSET, 0, BL.y);
  sky.addColorStop(0, '#b7d0e4');
  sky.addColorStop(0.5, '#d4e2dc');
  sky.addColorStop(1, '#e7e9d3');
  ctx.fillStyle = sky;
  ctx.fillRect(0, TOP_INSET, canvasW, BL.y - TOP_INSET);

  // ---- board slab thickness: earthy rim extruded down from the outer edges ----
  const wall = Math.max(8, cs * 0.34);
  const rim = (a: ProjectedPoint, b: ProjectedPoint, shade: string) => {
    ctx.fillStyle = shade;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(b.x, b.y + wall);
    ctx.lineTo(a.x, a.y + wall);
    ctx.closePath();
    ctx.fill();
  };
  // soft cast shadow under the near edge
  ctx.fillStyle = 'rgba(30,26,18,0.16)';
  ctx.beginPath();
  ctx.ellipse((BL.x + BR.x) / 2, BR.y + wall + 6, boardW * 0.52, wall * 0.7, 0, 0, Math.PI * 2);
  ctx.fill();
  rim(TL, BL, '#6d5334'); // left wall
  rim(TR, BR, '#6d5334'); // right wall
  rim(BL, BR, '#856741'); // front wall (lit)

  // ---- ground tiles, far → near (checkerboard + atmospheric haze on distant rows) ----
  for (let row = 0; row < layout.rows; row++) {
    const haze = (1 - row / layout.rows) * 0.24;
    for (let col = 0; col < layout.cols; col++) {
      const a = proj(col, row);
      const b = proj(col + 1, row);
      const c = proj(col + 1, row + 1);
      const d = proj(col, row + 1);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(c.x, c.y);
      ctx.lineTo(d.x, d.y);
      ctx.closePath();
      ctx.fillStyle = (row + col) % 2 === 0 ? '#c6dea3' : '#b6d38f';
      ctx.fill();
      if (haze > 0.003) {
        ctx.fillStyle = `rgba(228,237,227,${haze})`;
        ctx.fill();
      }
      ctx.strokeStyle = 'rgba(56,74,38,0.10)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  // ---- road ribbon on top of the grass, tapering with depth ----
  if (render.path.length >= 2) {
    const centers = render.path.map((c) => proj(c.col + 0.5, c.row + 0.5));
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const ribbon = (color: string, wf: number) => {
      for (let i = 1; i < centers.length; i++) {
        const p0 = centers[i - 1];
        const p1 = centers[i];
        ctx.strokeStyle = color;
        ctx.lineWidth = cs * wf * ((p0.scale + p1.scale) / 2);
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();
      }
    };
    ribbon('#b98f43', 0.6);
    ribbon('#ecd497', 0.4);
  }

  // ---- spawn portal + base keep ----
  const spawn = render.path[0];
  const base = render.path[render.path.length - 1];
  if (spawn) {
    const p = proj(spawn.col + 0.5, spawn.row + 0.5);
    ctx.fillStyle = 'rgba(150,60,44,0.9)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, cs * 0.26 * p.scale, cs * 0.17 * p.scale, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (base) {
    const p = proj(base.col + 0.5, base.row + 0.5);
    const w = cs * 0.52 * p.scale;
    const h = cs * 0.52 * p.scale;
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + h * 0.35, w * 0.6, h * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#276b2b';
    roundRectPath(ctx, p.x - w / 2, p.y - h, w, h, h * 0.2);
    ctx.fill();
    ctx.fillStyle = '#3a9440';
    roundRectPath(ctx, p.x - w / 2, p.y - h, w, h * 0.42, h * 0.2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = `800 ${h * 0.6}px 'Nunito', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⌂', p.x, p.y - h * 0.46);
  }

  // ---- valid-placement hints when a card is selected ----
  if (ui.selectedCardIndex !== null) {
    const occupied = new Set(snapshot.units.map((u) => `${u.col},${u.row}`));
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1;
    for (let row = 0; row < layout.rows; row++) {
      for (let col = 0; col < layout.cols; col++) {
        const key = `${col},${row}`;
        if (pathSet.has(key) || occupied.has(key)) continue;
        const a = proj(col + 0.08, row + 0.08);
        const b = proj(col + 0.92, row + 0.08);
        const c = proj(col + 0.92, row + 0.92);
        const d = proj(col + 0.08, row + 0.92);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.lineTo(c.x, c.y);
        ctx.lineTo(d.x, d.y);
        ctx.closePath();
        ctx.stroke();
      }
    }
  }

  // ---- ground fields (gravity + boost auras) drawn on the tilted plane as ellipses ----
  const groundDisc = (gx: number, gy: number, radCells: number, inner: string, outer: string, stroke?: string) => {
    const N = 30;
    const center = proj(gx, gy);
    const pts: ProjectedPoint[] = [];
    let maxR = 0;
    for (let i = 0; i <= N; i++) {
      const ang = (i / N) * Math.PI * 2;
      const p = proj(gx + radCells * Math.cos(ang), gy + radCells * Math.sin(ang));
      pts.push(p);
      maxR = Math.max(maxR, Math.hypot(p.x - center.x, p.y - center.y));
    }
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    const grad = ctx.createRadialGradient(center.x, center.y, maxR * 0.15, center.x, center.y, Math.max(1, maxR));
    grad.addColorStop(0, inner);
    grad.addColorStop(1, outer);
    ctx.fillStyle = grad;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  };
  for (const unit of snapshot.units) {
    const def = render.unitDefs.get(unit.unitId);
    if (!def || def.family !== 'gravity') continue;
    const range = def.levels[unit.level - 1]?.range ?? 0;
    groundDisc(
      unit.col + 0.5,
      unit.row + 0.5,
      range,
      `rgba(26,163,154,${0.12 + 0.06 * pulse})`,
      'rgba(26,163,154,0)',
      `rgba(26,163,154,${0.3 + 0.25 * pulse})`,
    );
  }
  for (const unit of snapshot.units) {
    const ability = render.unitDefs.get(unit.unitId)?.ability;
    if (ability?.kind !== 'boost_aura') continue;
    groundDisc(
      unit.col + 0.5,
      unit.row + 0.5,
      ability.radius,
      `rgba(240,194,106,${0.1 + 0.05 * pulse})`,
      'rgba(240,194,106,0)',
    );
  }

  // ---- volumes (units, enemies, hero), painted back-to-front ----
  interface Drawable {
    depth: number;
    draw: () => void;
  }
  const drawables: Drawable[] = [];

  for (const unit of snapshot.units) {
    const def = render.unitDefs.get(unit.unitId);
    if (!def) continue;
    const feet = proj(unit.col + 0.5, unit.row + 0.82);
    drawables.push({ depth: feet.y, draw: () => drawUnitToken(unit, def, feet) });
  }
  for (const enemy of snapshot.enemies) {
    const def = render.enemyDefs.get(enemy.enemyId);
    if (!def) continue;
    const at = proj(enemy.x, enemy.y);
    drawables.push({ depth: at.y, draw: () => drawEnemy(enemy, def, at) });
  }
  const hero = snapshot.hero;
  if (hero.configured && hero.deployed) {
    const at = proj(hero.x, hero.y);
    drawables.push({ depth: at.y, draw: () => drawHero(hero, at) });
  }

  drawables.sort((a, b) => a.depth - b.depth);
  for (const d of drawables) d.draw();

  // A unit stands up as a bright rounded cap on a darker stem, rooted at its shadow.
  function drawUnitToken(unit: CombatSnapshot['units'][number], def: UnitDef, feet: ProjectedPoint): void {
    const s = feet.scale;
    const cap = cs * 0.72 * s;
    const lift = cs * 0.3 * s;
    const capCx = feet.x;
    const capCy = feet.y - lift - cap * 0.5;
    const selected = !!ui.selectedUnit && ui.selectedUnit.col === unit.col && ui.selectedUnit.row === unit.row;

    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(feet.x, feet.y, cap * 0.55, cap * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();

    // stem (side face)
    ctx.fillStyle = FAMILY_BORDER[def.family];
    const stemTop = capCy + cap * 0.16;
    roundRectPath(ctx, capCx - cap * 0.42, stemTop, cap * 0.84, feet.y - stemTop, cap * 0.16);
    ctx.fill();

    // bright cap (top face)
    roundRectPath(ctx, capCx - cap / 2, capCy - cap / 2, cap, cap, cap * 0.24);
    ctx.fillStyle = FAMILY_COLOR[def.family];
    ctx.fill();
    ctx.lineWidth = Math.max(2, 3 * s);
    ctx.strokeStyle = selected ? '#fff6d9' : FAMILY_BORDER[def.family];
    ctx.stroke();

    drawPictogram(ctx, def.family, capCx, capCy, cap * 0.6);

    // stunned overlay
    if ((unit.stunnedUntilSec ?? 0) > snapshot.elapsedSec) {
      roundRectPath(ctx, capCx - cap / 2, capCy - cap / 2, cap, cap, cap * 0.24);
      ctx.fillStyle = 'rgba(40,44,52,0.55)';
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = `${cap * 0.5}px 'Baloo 2', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⚡', capCx, capCy + 1);
    }

    // level badge (top-right of the cap)
    const br = cap * 0.2;
    const bx = capCx + cap / 2 - br * 0.4;
    const by = capCy - cap / 2 + br * 0.4;
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

  function drawEnemy(enemy: CombatSnapshot['enemies'][number], def: EnemyDef, at: ProjectedPoint): void {
    const s = at.scale;
    const boss = def.boss === true;
    const radius = cs * (boss ? 0.42 : 0.3) * s;
    const ex = at.x;
    const groundY = at.y;
    const hover = def.flying ? radius * (1.05 + 0.12 * Math.sin(snapshot.elapsedSec * 4 + enemy.instanceId)) : 0;
    const ey = groundY - hover;

    // ground shadow (stays on the field even when a flyer is lifted)
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(ex, groundY + radius * 0.5, radius * (def.flying ? 0.7 : 0.95), radius * 0.32, 0, 0, Math.PI * 2);
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
      ctx.fillStyle = '#fff';
      ctx.font = `${radius * 0.9}px 'Baloo 2', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('👑', ex, ey - radius - 16);
      ctx.fillStyle = '#ffe9b0';
      ctx.font = "800 10px 'Baloo 2', sans-serif";
      ctx.fillText(def.name, ex, barY - 7);
    }
  }

  function drawHero(h: CombatSnapshot['hero'], at: ProjectedPoint): void {
    const s = at.scale;
    const hx = at.x;
    const hy = at.y;
    const hr = cs * 0.44 * s;
    // aura ring
    ctx.strokeStyle = `rgba(159,120,255,${0.5 + 0.3 * pulse})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(hx, hy, hr * 1.2, hr * 0.7, 0, 0, Math.PI * 2);
    ctx.stroke();
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(hx, hy, hr * 0.9, hr * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
    // body raised above the feet
    const bodyCy = hy - hr;
    ctx.beginPath();
    ctx.arc(hx, bodyCy, hr, 0, Math.PI * 2);
    ctx.fillStyle = '#6a4a8c';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#ffd76a';
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = `${hr * 1.1}px 'Baloo 2', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🦸', hx, bodyCy + 1);
    // HP bar
    const hpFrac = Math.max(0, Math.min(1, h.hp / Math.max(1, h.maxHp)));
    const bw = hr * 2;
    ctx.fillStyle = '#1f1610';
    ctx.fillRect(hx - hr, bodyCy - hr - 8, bw, 5);
    ctx.fillStyle = hpFrac > 0.4 ? '#4caf50' : '#e74c3c';
    ctx.fillRect(hx - hr, bodyCy - hr - 8, bw * hpFrac, 5);
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

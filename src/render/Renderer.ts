import { TOWERS } from '../data/towers';
import { ENEMIES } from '../data/enemies';
import type { GameState } from '../sim/GameState';
import type { FxEvent } from '../sim/Combat';
import { hpColor, THEME } from './theme';

interface ActiveFx extends FxEvent {
  age: number;
  duration: number;
}

export class Renderer {
  private activeFx: ActiveFx[] = [];

  constructor(private readonly ctx: CanvasRenderingContext2D) {}

  render(state: GameState, dt: number, hoverCell: { col: number; row: number } | null, placementValid: boolean | null): void {
    const { grid } = state;
    const ctx = this.ctx;
    const w = ctx.canvas.width / (window.devicePixelRatio || 1);
    const h = ctx.canvas.height / (window.devicePixelRatio || 1);

    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, THEME.skyTop);
    sky.addColorStop(1, THEME.skyBottom);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    for (let row = 0; row < grid.rows; row++) {
      for (let col = 0; col < grid.cols; col++) {
        const isPath = grid.isPath(col, row);
        const checker = (col + row) % 2 === 0;
        ctx.fillStyle = isPath ? (checker ? THEME.pathA : THEME.pathB) : checker ? THEME.grassA : THEME.grassB;
        const x = grid.originX + col * grid.tileSize;
        const y = grid.originY + row * grid.tileSize;
        ctx.fillRect(x, y, grid.tileSize, grid.tileSize);
        if (isPath) {
          ctx.strokeStyle = THEME.pathOutline;
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 0.5, y + 0.5, grid.tileSize - 1, grid.tileSize - 1);
        }
      }
    }

    if (hoverCell && placementValid !== null) {
      const { x, y } = grid.cellCenter(hoverCell.col, hoverCell.row);
      ctx.fillStyle = placementValid ? THEME.buildHighlight : THEME.blockedHighlight;
      ctx.fillRect(x - grid.tileSize / 2, y - grid.tileSize / 2, grid.tileSize, grid.tileSize);
    }

    this.drawSpawn(state);
    this.drawKeep(state);

    for (const tower of state.towers) this.drawTower(state, tower);
    for (const enemy of state.enemies) this.drawEnemy(state, enemy);

    this.activeFx.push(...state.fxQueue.map((fx) => ({ ...fx, age: 0, duration: fx.kind === 'splash' ? 0.35 : 0.18 })));
    state.fxQueue.length = 0;
    this.activeFx = this.activeFx.filter((fx) => {
      fx.age += dt;
      this.drawFx(fx);
      return fx.age < fx.duration;
    });
  }

  private drawSpawn(state: GameState): void {
    const { grid } = state;
    const { x, y } = grid.cellCenter(grid.spawnCell.col, grid.spawnCell.row);
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = THEME.spawnPurple;
    ctx.strokeStyle = THEME.outlineDark;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, grid.tileSize * 0.38, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  private drawKeep(state: GameState): void {
    const { grid } = state;
    const { x, y } = grid.cellCenter(grid.keepCell.col, grid.keepCell.row);
    const ctx = this.ctx;
    const size = grid.tileSize * 0.8;
    ctx.save();
    ctx.fillStyle = state.shieldTimer > 0 ? '#8fd6ff' : THEME.keepGold;
    ctx.strokeStyle = THEME.outlineDark;
    ctx.lineWidth = 3;
    roundRect(ctx, x - size / 2, y - size / 2, size, size, 8);
    ctx.fill();
    ctx.stroke();
    ctx.font = `${Math.round(size * 0.55)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('👑', x, y + 1);

    // HP bar above the keep
    const barW = grid.tileSize * 1.4;
    const barH = 6;
    const barX = x - barW / 2;
    const barY = y - size / 2 - 14;
    const frac = Math.max(0, state.keepHp / state.keepMaxHp);
    ctx.fillStyle = THEME.hpTrack;
    roundRect(ctx, barX, barY, barW, barH, 3);
    ctx.fill();
    ctx.fillStyle = hpColor(frac);
    roundRect(ctx, barX, barY, barW * frac, barH, 3);
    ctx.fill();
    ctx.restore();
  }

  private drawTower(state: GameState, tower: import('../sim/Tower').Tower): void {
    const { grid } = state;
    const { x, y } = grid.cellCenter(tower.col, tower.row);
    const def = TOWERS[tower.kind];
    const ctx = this.ctx;
    const size = grid.tileSize * 0.72;
    ctx.save();
    ctx.fillStyle = def.color;
    ctx.strokeStyle = THEME.outlineDark;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, size / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.font = `${Math.round(size * 0.55)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(def.icon, x, y + 1);

    // Tier pips
    for (let i = 0; i < tower.tier; i++) {
      ctx.fillStyle = THEME.keepGold;
      ctx.strokeStyle = THEME.outlineDark;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x - size * 0.35 + i * 7, y + size / 2 + 6, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawEnemy(state: GameState, enemy: import('../sim/Enemy').Enemy): void {
    const { grid } = state;
    const p = grid.pointAtDistance(enemy.distanceTiles);
    const def = ENEMIES[enemy.kind];
    const ctx = this.ctx;
    const isBoss = enemy.kind === 'boss';
    const size = grid.tileSize * (isBoss ? 0.85 : 0.55);
    ctx.save();
    ctx.fillStyle = def.color;
    ctx.strokeStyle = THEME.outlineDark;
    ctx.lineWidth = isBoss ? 3.5 : 2.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, size / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.font = `${Math.round(size * 0.6)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(def.icon, p.x, p.y + 1);

    const barW = size * 1.1;
    const barH = 4;
    const barX = p.x - barW / 2;
    const barY = p.y - size / 2 - 8;
    const frac = Math.max(0, enemy.hp / enemy.maxHp);
    ctx.fillStyle = THEME.hpTrack;
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = hpColor(frac);
    ctx.fillRect(barX, barY, barW * frac, barH);
    ctx.restore();
  }

  private drawFx(fx: ActiveFx): void {
    const ctx = this.ctx;
    const t = fx.age / fx.duration;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - t);
    if (fx.kind === 'splash') {
      ctx.strokeStyle = fx.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(fx.toX, fx.toY, 6 + t * 22, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.strokeStyle = fx.crit ? '#ff8a3d' : fx.color;
      ctx.lineWidth = fx.crit ? 3 : 2;
      ctx.beginPath();
      ctx.moveTo(fx.fromX, fx.fromY);
      ctx.lineTo(fx.toX, fx.toY);
      ctx.stroke();
      ctx.fillStyle = fx.crit ? '#ff8a3d' : fx.color;
      ctx.beginPath();
      ctx.arc(fx.toX, fx.toY, fx.crit ? 5 : 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

import type { BoardLayout } from './BoardLayout';
import type { CombatEvent, UnitFamily } from '../sim/types';

/**
 * Render-only feedback layer. Consumes the sim's pure CombatEvents and plays juice — floating
 * damage numbers, impact/kill particles, attack beams, merge pops, screen shake, base-hit flash —
 * plus a recently-hit set so the renderer can flash struck enemies. Positions live in cell-centre
 * units (like LiveEnemy.x/y) and convert to pixels through BoardLayout at draw time. Never touches
 * sim state, so determinism is preserved. Honors prefers-reduced-motion.
 */

interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; }
interface FloatNum { x: number; y: number; vy: number; life: number; max: number; text: string; color: string; }
interface Beam { x1: number; y1: number; x2: number; y2: number; life: number; max: number; color: string; width: number; }
interface Ring { x: number; y: number; life: number; max: number; color: string; maxR: number; }

const FAMILY_COLOR: Record<UnitFamily, string> = { melee: '#8ecae6', ranged: '#a3e0a3', gravity: '#8fe0da' };
const ENEMY_COLOR: Record<string, string> = {
  goblin: '#c79a6a', runner: '#f0c46a', brute: '#c98a8a', troll: '#a98acb',
  wraith: '#7f8fd0', saboteur: '#c0392b', juggernaut: '#5d6d7e', ogre: '#5a7d3c',
  warlord: '#a83232', necromancer: '#5b3a6e', stone_colossus: '#6b6b6b', high_priestess: '#c9a0dc',
};

export class Effects {
  private particles: Particle[] = [];
  private numbers: FloatNum[] = [];
  private beams: Beam[] = [];
  private rings: Ring[] = [];
  private flash = new Map<number, number>();
  private shakeT = 0;
  private shakeMag = 0;
  private baseFlashT = 0;
  private readonly reduced: boolean;
  private seed = 0x9e3779b9;

  constructor() {
    this.reduced =
      typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /** Cheap deterministic-ish jitter (render-side, no sim RNG). */
  private rand(): number {
    this.seed = (this.seed + 0x6d2b79f5) | 0;
    let t = Math.imul(this.seed ^ (this.seed >>> 15), 1 | this.seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  emit(e: CombatEvent): void {
    switch (e.type) {
      case 'attack': {
        this.beams.push({
          x1: e.fromCol + 0.5,
          y1: e.fromRow + 0.5,
          x2: e.toX,
          y2: e.toY,
          life: 0.12,
          max: 0.12,
          color: FAMILY_COLOR[e.family],
          width: e.family === 'gravity' ? 0 : 2,
        });
        break;
      }
      case 'damage': {
        this.flash.set(e.enemyInstanceId, 0.1);
        this.numbers.push({ x: e.x, y: e.y - 0.2, vy: -1.1, life: 0.7, max: 0.7, text: String(e.amount), color: '#fff' });
        this.spawnParticles(e.x, e.y, 3, '#ffe9a8', 1.4);
        break;
      }
      case 'kill': {
        this.spawnParticles(e.x, e.y, this.reduced ? 3 : 8, ENEMY_COLOR[e.enemyId] ?? '#ccc', 2.2);
        this.rings.push({ x: e.x, y: e.y, life: 0.35, max: 0.35, color: 'rgba(255,255,255,0.7)', maxR: 0.6 });
        break;
      }
      case 'merge': {
        const gold = '#ffe08a';
        this.rings.push({ x: e.col + 0.5, y: e.row + 0.5, life: 0.5, max: 0.5, color: gold, maxR: 1.1 });
        this.spawnParticles(e.col + 0.5, e.row + 0.5, this.reduced ? 5 : 14, gold, 3);
        this.numbers.push({ x: e.col + 0.5, y: e.row + 0.3, vy: -1.3, life: 0.9, max: 0.9, text: `Niv ${e.newLevel}!`, color: '#ffe08a' });
        this.addShake(0.28, 0.14);
        break;
      }
      case 'summon': {
        this.rings.push({ x: e.col + 0.5, y: e.row + 0.5, life: 0.3, max: 0.3, color: FAMILY_COLOR[e.family], maxR: 0.7 });
        break;
      }
      case 'baseHit': {
        this.addShake(0.35, 0.16 + Math.min(0.2, e.amount * 0.05));
        this.baseFlashT = 0.35;
        break;
      }
      case 'stun': {
        // electric burst on the disabled unit
        this.rings.push({ x: e.col + 0.5, y: e.row + 0.5, life: 0.4, max: 0.4, color: 'rgba(120,190,255,0.85)', maxR: 0.9 });
        this.numbers.push({ x: e.col + 0.5, y: e.row + 0.2, vy: -1.0, life: 0.7, max: 0.7, text: '⚡', color: '#8fc7ff' });
        this.spawnParticles(e.col + 0.5, e.row + 0.5, this.reduced ? 3 : 7, '#8fc7ff', 2.4);
        break;
      }
      case 'spawn': {
        // boss arrival — ominous ground ring + shake
        if (e.boss) {
          this.rings.push({ x: e.x, y: e.y, life: 0.6, max: 0.6, color: 'rgba(255,180,80,0.85)', maxR: 1.6 });
          this.spawnParticles(e.x, e.y, this.reduced ? 5 : 16, '#ffb347', 3.2);
          this.addShake(0.4, 0.18);
        }
        break;
      }
      case 'heroDeploy': {
        this.rings.push({ x: e.col + 0.5, y: e.row + 0.5, life: 0.5, max: 0.5, color: 'rgba(159,120,255,0.9)', maxR: 1.4 });
        this.spawnParticles(e.col + 0.5, e.row + 0.5, this.reduced ? 6 : 18, '#c9a0ff', 3);
        this.addShake(0.3, 0.14);
        break;
      }
      case 'heroPower': {
        this.rings.push({ x: e.col + 0.5, y: e.row + 0.5, life: 0.45, max: 0.45, color: 'rgba(255,120,80,0.9)', maxR: Math.max(1, e.radius) });
        this.spawnParticles(e.col + 0.5, e.row + 0.5, this.reduced ? 6 : 20, '#ff9a5a', 3.6);
        this.addShake(0.35, 0.16);
        break;
      }
      case 'heroDeath': {
        this.spawnParticles(e.col + 0.5, e.row + 0.5, this.reduced ? 4 : 12, '#9f78ff', 2.4);
        break;
      }
    }
  }

  private spawnParticles(x: number, y: number, n: number, color: string, speed: number): void {
    const count = this.reduced ? Math.ceil(n / 2) : n;
    for (let i = 0; i < count; i++) {
      const a = this.rand() * Math.PI * 2;
      const s = speed * (0.4 + this.rand() * 0.8);
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5, max: 0.5, size: 2 + this.rand() * 2, color });
    }
  }

  private addShake(dur: number, mag: number): void {
    if (this.reduced) return;
    this.shakeT = Math.max(this.shakeT, dur);
    this.shakeMag = Math.max(this.shakeMag, mag);
  }

  update(dt: number): void {
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 1.5 * dt;
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const n of this.numbers) {
      n.y += n.vy * dt;
      n.life -= dt;
    }
    this.numbers = this.numbers.filter((n) => n.life > 0);
    for (const b of this.beams) b.life -= dt;
    this.beams = this.beams.filter((b) => b.life > 0);
    for (const r of this.rings) r.life -= dt;
    this.rings = this.rings.filter((r) => r.life > 0);
    for (const [id, t] of this.flash) {
      const nt = t - dt;
      if (nt <= 0) this.flash.delete(id);
      else this.flash.set(id, nt);
    }
    if (this.shakeT > 0) this.shakeT -= dt;
    if (this.baseFlashT > 0) this.baseFlashT -= dt;
  }

  isFlashing(instanceId: number): boolean {
    return this.flash.has(instanceId);
  }

  shakeOffset(): { x: number; y: number } {
    if (this.shakeT <= 0) return { x: 0, y: 0 };
    const amp = this.shakeMag * (this.shakeT > 0 ? 1 : 0) * 30;
    return { x: (this.rand() * 2 - 1) * amp, y: (this.rand() * 2 - 1) * amp };
  }

  /** Draws particles/numbers/beams/rings. Call after the board, in the same (shaken) transform. */
  draw(ctx: CanvasRenderingContext2D, layout: BoardLayout): void {
    const px = (x: number) => layout.originX + x * layout.cellSize;
    const py = (y: number) => layout.originY + y * layout.cellSize;

    for (const b of this.beams) {
      if (b.width <= 0) continue;
      ctx.globalAlpha = Math.max(0, b.life / b.max);
      ctx.strokeStyle = b.color;
      ctx.lineWidth = b.width;
      ctx.beginPath();
      ctx.moveTo(px(b.x1), py(b.y1));
      ctx.lineTo(px(b.x2), py(b.y2));
      ctx.stroke();
    }
    for (const r of this.rings) {
      const t = 1 - r.life / r.max;
      ctx.globalAlpha = Math.max(0, r.life / r.max);
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(px(r.x), py(r.y), r.maxR * layout.cellSize * t, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(px(p.x), py(p.y), p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const n of this.numbers) {
      ctx.globalAlpha = Math.max(0, n.life / n.max);
      ctx.font = `800 ${n.text.startsWith('Niv') ? 15 : 13}px 'Baloo 2', sans-serif`;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillText(n.text, px(n.x) + 1, py(n.y) + 1);
      ctx.fillStyle = n.color;
      ctx.fillText(n.text, px(n.x), py(n.y));
    }
    ctx.globalAlpha = 1;
  }

  /** Red base-hit vignette, drawn in screen space (no shake). */
  drawOverlay(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    if (this.baseFlashT <= 0) return;
    const a = Math.min(0.4, this.baseFlashT) * 0.9;
    const grad = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.7);
    grad.addColorStop(0, 'rgba(231,76,60,0)');
    grad.addColorStop(1, `rgba(231,76,60,${a})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }
}

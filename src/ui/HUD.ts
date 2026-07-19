import { CLASSES } from '../data/classes';
import { TOWERS, TOWER_ORDER, type TowerKind } from '../data/towers';
import type { GameState } from '../sim/GameState';
import { towerCost, sellRefund } from '../sim/Economy';
import type { Tower } from '../sim/Tower';

export interface HudCallbacks {
  onSelectTower: (kind: TowerKind | null) => void;
  onStartWave: () => void;
  onUltimate: () => void;
  onPause: () => void;
  onUpgradeTower: (id: number) => void;
  onSellTower: (id: number) => void;
}

export class HUD {
  readonly root: HTMLDivElement;
  private goldEl: HTMLSpanElement;
  private waveEl: HTMLSpanElement;
  private hpBarEl: HTMLDivElement;
  private trayEl: HTMLDivElement;
  private ultimateBtn: HTMLButtonElement;
  private ultimateCdFill: HTMLDivElement;
  private startWaveBtn: HTMLButtonElement;
  private popupEl: HTMLDivElement;
  private toastEl: HTMLDivElement;
  private toastTimer: number | null = null;

  selectedTower: TowerKind | null = null;

  constructor(private readonly callbacks: HudCallbacks) {
    this.root = document.createElement('div');
    this.root.id = 'hud';

    const top = document.createElement('div');
    top.className = 'hud-top';
    this.goldEl = pill('💰', '0');
    this.waveEl = pill('🌊', '0');
    const hpPill = document.createElement('div');
    hpPill.className = 'hud-pill';
    hpPill.style.minWidth = '90px';
    const hpTrack = document.createElement('div');
    hpTrack.style.cssText = 'width:70px;height:8px;background:#1a222c;border-radius:4px;overflow:hidden;';
    this.hpBarEl = document.createElement('div');
    this.hpBarEl.style.cssText = 'height:100%;background:#59c46a;width:100%;';
    hpTrack.appendChild(this.hpBarEl);
    hpPill.append('🏰', hpTrack);
    const pauseBtn = document.createElement('button');
    pauseBtn.className = 'hud-pill';
    pauseBtn.style.pointerEvents = 'auto';
    pauseBtn.textContent = '⏸';
    pauseBtn.onclick = () => callbacks.onPause();
    top.append(this.goldEl.parentElement!, this.waveEl.parentElement!, hpPill, pauseBtn);
    this.root.appendChild(top);

    this.toastEl = document.createElement('div');
    this.toastEl.className = 'toast';
    this.root.appendChild(this.toastEl);

    this.popupEl = document.createElement('div');
    this.popupEl.className = 'tower-popup';
    this.popupEl.style.display = 'none';
    this.root.appendChild(this.popupEl);

    const bottom = document.createElement('div');
    bottom.className = 'hud-bottom';

    this.trayEl = document.createElement('div');
    this.trayEl.className = 'tower-tray';
    for (const kind of TOWER_ORDER) {
      const def = TOWERS[kind];
      const btn = document.createElement('button');
      btn.className = 'tower-btn';
      btn.dataset.kind = kind;
      btn.innerHTML = `<div>${def.icon}</div><div class="cost">${def.tiers[0].cost}</div>`;
      btn.onclick = () => {
        this.selectedTower = this.selectedTower === kind ? null : kind;
        this.refreshTraySelection();
        callbacks.onSelectTower(this.selectedTower);
      };
      this.trayEl.appendChild(btn);
    }
    bottom.appendChild(this.trayEl);

    const actionRow = document.createElement('div');
    actionRow.className = 'action-row';
    this.ultimateBtn = document.createElement('button');
    this.ultimateBtn.className = 'ultimate-btn';
    this.ultimateCdFill = document.createElement('div');
    this.ultimateCdFill.className = 'cd-fill';
    this.ultimateBtn.appendChild(this.ultimateCdFill);
    const ultimateIcon = document.createElement('span');
    ultimateIcon.style.position = 'relative';
    this.ultimateBtn.appendChild(ultimateIcon);
    this.ultimateBtn.onclick = () => callbacks.onUltimate();

    this.startWaveBtn = document.createElement('button');
    this.startWaveBtn.className = 'btn btn-block';
    this.startWaveBtn.textContent = 'Lancer la vague ▶';
    this.startWaveBtn.onclick = () => callbacks.onStartWave();

    actionRow.append(this.ultimateBtn, this.startWaveBtn);
    bottom.appendChild(actionRow);
    this.root.appendChild(bottom);
  }

  setClass(classId: import('../data/classes').ClassId): void {
    const def = CLASSES[classId];
    const iconSpan = this.ultimateBtn.querySelector('span') as HTMLSpanElement;
    iconSpan.textContent = def.ultimate.icon;
    this.ultimateBtn.title = `${def.ultimate.label} — ${def.ultimate.description}`;
  }

  private refreshTraySelection(): void {
    for (const btn of Array.from(this.trayEl.children) as HTMLButtonElement[]) {
      btn.classList.toggle('selected', btn.dataset.kind === this.selectedTower);
    }
  }

  clearSelection(): void {
    this.selectedTower = null;
    this.refreshTraySelection();
  }

  toast(message: string): void {
    this.toastEl.textContent = message;
    this.toastEl.classList.add('visible');
    if (this.toastTimer) window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastEl.classList.remove('visible'), 1600);
  }

  showTowerPopup(tower: Tower, screenX: number, screenY: number, effects: import('../data/classes').SkillEffects): void {
    this.popupEl.style.display = 'flex';
    this.popupEl.style.left = `${screenX}px`;
    this.popupEl.style.top = `${screenY}px`;
    this.popupEl.innerHTML = '';

    if (tower.canUpgrade()) {
      const nextCost = towerCost(TOWERS[tower.kind].tiers[tower.tier as 1 | 2].cost, effects);
      const upBtn = document.createElement('button');
      upBtn.className = 'btn';
      upBtn.textContent = `⬆ ${nextCost}`;
      upBtn.onclick = (e) => {
        e.stopPropagation();
        this.callbacks.onUpgradeTower(tower.id);
      };
      this.popupEl.appendChild(upBtn);
    }
    const sellBtn = document.createElement('button');
    sellBtn.className = 'btn btn-danger';
    sellBtn.textContent = `💰 ${sellRefund(tower.totalInvested)}`;
    sellBtn.onclick = (e) => {
      e.stopPropagation();
      this.callbacks.onSellTower(tower.id);
    };
    this.popupEl.appendChild(sellBtn);
  }

  hideTowerPopup(): void {
    this.popupEl.style.display = 'none';
  }

  update(state: GameState): void {
    this.goldEl.textContent = String(state.gold);
    this.waveEl.textContent = String(state.wave);
    const frac = Math.max(0, state.keepHp / state.keepMaxHp);
    this.hpBarEl.style.width = `${frac * 100}%`;
    this.hpBarEl.style.background = frac > 0.5 ? '#59c46a' : frac > 0.25 ? '#f4c14e' : '#e15b5b';

    for (const btn of Array.from(this.trayEl.children) as HTMLButtonElement[]) {
      const kind = btn.dataset.kind as TowerKind;
      const cost = towerCost(TOWERS[kind].tiers[0].cost, state.effects);
      btn.disabled = state.gold < cost;
      (btn.querySelector('.cost') as HTMLDivElement).textContent = String(cost);
    }

    const cdFrac = state.ultimateCooldown / (CLASSES[state.classId].ultimate.baseCooldown * (1 + (state.effects.ultimateCooldownPct ?? 0)));
    this.ultimateCdFill.style.height = `${Math.max(0, Math.min(1, cdFrac)) * 100}%`;
    this.ultimateBtn.disabled = !state.ultimateReady;

    this.startWaveBtn.style.display = state.status === 'ready' ? 'flex' : 'none';
  }
}

function pill(icon: string, initial: string): HTMLSpanElement {
  const wrap = document.createElement('div');
  wrap.className = 'hud-pill';
  const iconSpan = document.createElement('span');
  iconSpan.textContent = icon;
  const valueSpan = document.createElement('span');
  valueSpan.textContent = initial;
  wrap.append(iconSpan, valueSpan);
  return valueSpan;
}

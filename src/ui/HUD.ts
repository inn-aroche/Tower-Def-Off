import type { GameState } from '../sim/GameState';
import type { EventBus } from '../core/EventBus';
import { TOWERS, type TowerId } from '../data/towers';
import type { Tower } from '../sim/Tower';

export interface HUDCallbacks {
  onSelectTowerToPlace(towerId: TowerId | null): void;
  onUpgradeSelected(branch?: 'A' | 'B'): void;
  onSellSelected(): void;
  onCallWaveEarly(): void;
  onRestart(): void;
}

/** DOM overlay HUD — deliberately outside Three.js so it stays crisp and accessible on any device. */
export class HUD {
  private root: HTMLDivElement;
  private goldEl: HTMLSpanElement;
  private livesEl: HTMLSpanElement;
  private waveEl: HTMLSpanElement;
  private earlyCallBtn: HTMLButtonElement;
  private towerBar: HTMLDivElement;
  private towerButtons = new Map<TowerId, HTMLButtonElement>();
  private selectedPanel: HTMLDivElement;
  private endOverlay: HTMLDivElement;
  private selectedTowerId: TowerId | null = null;

  constructor(container: HTMLElement, private readonly gameState: GameState, private readonly bus: EventBus, private readonly callbacks: HUDCallbacks) {
    this.root = document.createElement('div');
    this.root.className = 'hud-root';
    container.appendChild(this.root);

    const top = document.createElement('div');
    top.className = 'hud-top';
    this.goldEl = document.createElement('span');
    this.livesEl = document.createElement('span');
    this.waveEl = document.createElement('span');
    this.earlyCallBtn = document.createElement('button');
    this.earlyCallBtn.textContent = 'Appel anticipé (+or)';
    this.earlyCallBtn.className = 'hud-early-call';
    this.earlyCallBtn.onclick = () => this.callbacks.onCallWaveEarly();
    top.append(this.goldEl, this.livesEl, this.waveEl, this.earlyCallBtn);
    this.root.appendChild(top);

    this.towerBar = document.createElement('div');
    this.towerBar.className = 'hud-tower-bar';
    this.root.appendChild(this.towerBar);

    this.selectedPanel = document.createElement('div');
    this.selectedPanel.className = 'hud-selected-panel';
    this.selectedPanel.style.display = 'none';
    this.root.appendChild(this.selectedPanel);

    this.endOverlay = document.createElement('div');
    this.endOverlay.className = 'hud-end-overlay';
    this.endOverlay.style.display = 'none';
    this.root.appendChild(this.endOverlay);

    this.injectStyles();
    this.bindEvents();
  }

  buildTowerBar(allowedTowers: TowerId[]): void {
    this.towerBar.innerHTML = '';
    this.towerButtons.clear();
    for (const towerId of allowedTowers) {
      const def = TOWERS[towerId];
      const btn = document.createElement('button');
      btn.className = 'hud-tower-btn';
      btn.innerHTML = `<strong>${def.name}</strong><br/>${def.tiers[0].cost} or`;
      btn.onclick = () => this.toggleTowerSelection(towerId);
      this.towerBar.appendChild(btn);
      this.towerButtons.set(towerId, btn);
    }
  }

  private toggleTowerSelection(towerId: TowerId): void {
    this.selectedTowerId = this.selectedTowerId === towerId ? null : towerId;
    this.callbacks.onSelectTowerToPlace(this.selectedTowerId);
    for (const [id, btn] of this.towerButtons) btn.classList.toggle('active', id === this.selectedTowerId);
  }

  clearPlacementSelection(): void {
    this.selectedTowerId = null;
    for (const btn of this.towerButtons.values()) btn.classList.remove('active');
  }

  showSelectedTower(tower: Tower): void {
    const stats = tower.effectiveStats;
    const upgradeCost = tower.costForNextTier();
    let html = `<strong>${tower.def.name}</strong> — palier ${tower.tier}<br/>`;
    html += `Dégâts ${stats.damage.toFixed(0)} · Cadence ${stats.fireRatePerSec.toFixed(1)}/s · Portée ${stats.range.toFixed(1)}<br/>`;
    if (tower.tier === 2 && upgradeCost !== null) {
      html += `<button data-action="upgrade-a">Améliorer (${upgradeCost} or, choisir branche T3)</button>`;
    } else if (upgradeCost !== null) {
      html += `<button data-action="upgrade">Améliorer (${upgradeCost} or)</button>`;
    }
    html += ` <button data-action="sell">Vendre (+${tower.refundValue()} or)</button>`;
    this.selectedPanel.innerHTML = html;
    this.selectedPanel.style.display = 'block';

    this.selectedPanel.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', () => {
        const action = btn.getAttribute('data-action');
        if (action === 'sell') this.callbacks.onSellSelected();
        else if (action === 'upgrade') this.callbacks.onUpgradeSelected();
        else if (action === 'upgrade-a') this.showBranchChoice(tower);
      });
    });
  }

  private showBranchChoice(tower: Tower): void {
    const [a, b] = tower.def.t3Branches;
    this.selectedPanel.innerHTML = `
      <strong>Choisir la spécialisation T3</strong><br/>
      <button data-branch="A">${a.name}: ${a.description}</button><br/>
      <button data-branch="B">${b.name}: ${b.description}</button>`;
    this.selectedPanel.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', () => {
        const branch = btn.getAttribute('data-branch') as 'A' | 'B';
        this.callbacks.onUpgradeSelected(branch);
      });
    });
  }

  hideSelectedTower(): void {
    this.selectedPanel.style.display = 'none';
    this.selectedPanel.innerHTML = '';
  }

  showEndOverlay(won: boolean, stars: number): void {
    this.endOverlay.style.display = 'flex';
    const starRow = '⭐'.repeat(stars) + '☆'.repeat(3 - stars);
    this.endOverlay.innerHTML = `
      <div class="hud-end-card">
        <h2>${won ? 'Niveau réussi !' : 'Défaite'}</h2>
        ${won ? `<div class="hud-stars">${starRow}</div>` : ''}
        <button data-action="restart">${won ? 'Continuer' : 'Réessayer'}</button>
      </div>`;
    this.endOverlay.querySelector('button')?.addEventListener('click', () => {
      this.endOverlay.style.display = 'none';
      this.callbacks.onRestart();
    });
  }

  private bindEvents(): void {
    this.bus.on('goldChanged', () => this.refresh());
    this.bus.on('livesChanged', () => this.refresh());
    this.bus.on('waveCompleted', () => this.refresh());
    this.bus.on('waveCalledEarly', () => this.refresh());
  }

  refresh(): void {
    const { economy, waveScheduler, level } = this.gameState;
    this.goldEl.textContent = `💰 ${economy.gold}`;
    this.livesEl.textContent = `❤️ ${economy.lives}`;
    this.waveEl.textContent = `Vague ${waveScheduler.waveIndex + 1}/${level.waves.length}`;
    this.earlyCallBtn.style.display = waveScheduler.phase === 'build' ? 'inline-block' : 'none';
    for (const [towerId, btn] of this.towerButtons) {
      btn.disabled = !economy.canAfford(TOWERS[towerId].tiers[0].cost);
    }
  }

  private injectStyles(): void {
    if (document.getElementById('hud-styles')) return;
    const style = document.createElement('style');
    style.id = 'hud-styles';
    style.textContent = `
      .hud-root { position: absolute; inset: 0; pointer-events: none; font-family: system-ui, sans-serif; color: #f1f2f6; }
      .hud-top { position: absolute; top: 0; left: 0; right: 0; display: flex; gap: 16px; align-items: center; padding: 10px 14px; background: rgba(18,21,28,0.6); pointer-events: auto; font-size: 15px; }
      .hud-early-call { margin-left: auto; padding: 8px 14px; min-height: 44px; border: none; border-radius: 8px; background: #ffa502; color: #12151c; font-weight: 600; cursor: pointer; }
      .hud-tower-bar { position: absolute; bottom: 0; left: 0; right: 0; display: flex; gap: 8px; padding: 10px; background: rgba(18,21,28,0.6); pointer-events: auto; overflow-x: auto; }
      .hud-tower-btn { min-width: 76px; min-height: 44px; padding: 6px 10px; border-radius: 8px; border: 2px solid transparent; background: #2f3542; color: #f1f2f6; cursor: pointer; font-size: 12px; }
      .hud-tower-btn.active { border-color: #ffa502; }
      .hud-tower-btn:disabled { opacity: 0.4; cursor: not-allowed; }
      .hud-selected-panel { position: absolute; bottom: 74px; left: 10px; right: 10px; background: rgba(18,21,28,0.85); padding: 10px; border-radius: 8px; pointer-events: auto; font-size: 13px; }
      .hud-selected-panel button { min-height: 44px; margin-top: 6px; padding: 6px 10px; border-radius: 6px; border: none; background: #70a1ff; cursor: pointer; }
      .hud-end-overlay { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.6); pointer-events: auto; }
      .hud-end-card { background: #1e2129; padding: 24px 32px; border-radius: 12px; text-align: center; }
      .hud-stars { font-size: 32px; margin: 10px 0; }
    `;
    document.head.appendChild(style);
  }
}

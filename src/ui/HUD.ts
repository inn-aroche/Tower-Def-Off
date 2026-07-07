import type { GameState } from '../sim/GameState';
import type { EventBus } from '../core/EventBus';
import { TOWERS, type TowerId } from '../data/towers';
import type { Tower } from '../sim/Tower';
import { iconHtml } from '../render/textures';

function icon(name: string, fallbackEmoji: string): string {
  return iconHtml(name, fallbackEmoji, 'hud-icon');
}

export interface HUDCallbacks {
  onSelectTowerToPlace(towerId: TowerId | null): void;
  onUpgradeSelected(branch?: 'A' | 'B'): void;
  onSellSelected(): void;
  onCallWaveEarly(): void;
  onRestart(): void;
  onOpenMenu(): void;
}

/** DOM overlay HUD — deliberately outside Three.js so it stays crisp and accessible on any device. */
export class HUD {
  private root: HTMLDivElement;
  private goldEl: HTMLSpanElement;
  private livesEl: HTMLSpanElement;
  private waveEl: HTMLSpanElement;
  private scoreEl: HTMLSpanElement;
  private earlyCallBtn: HTMLButtonElement;
  private towerBar: HTMLDivElement;
  private towerButtons = new Map<TowerId, HTMLButtonElement>();
  private selectedPanel: HTMLDivElement;
  private endOverlay: HTMLDivElement;
  private selectedTowerId: TowerId | null = null;
  private waveNumberOffset = 0;
  private waveEndless = false;

  constructor(container: HTMLElement, private readonly gameState: GameState, private readonly bus: EventBus, private readonly callbacks: HUDCallbacks) {
    this.root = document.createElement('div');
    this.root.className = 'hud-root';
    container.appendChild(this.root);

    const top = document.createElement('div');
    top.className = 'hud-top';
    const menuBtn = document.createElement('button');
    menuBtn.textContent = '☰';
    menuBtn.className = 'hud-menu-btn';
    menuBtn.onclick = () => this.callbacks.onOpenMenu();
    this.goldEl = document.createElement('span');
    this.livesEl = document.createElement('span');
    this.waveEl = document.createElement('span');
    this.scoreEl = document.createElement('span');
    this.scoreEl.className = 'hud-score';
    this.earlyCallBtn = document.createElement('button');
    this.earlyCallBtn.textContent = 'Appel anticipé (+or)';
    this.earlyCallBtn.className = 'hud-early-call';
    this.earlyCallBtn.onclick = () => this.callbacks.onCallWaveEarly();
    top.append(menuBtn, this.goldEl, this.livesEl, this.waveEl, this.scoreEl, this.earlyCallBtn);
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
    let html: string;
    if (tower.def.upgradable === false) {
      html = `<strong>${tower.def.name}</strong><br/>Bloc inerte — aucune attaque, sert juste à guider le chemin.<br/>`;
    } else {
      html = `<strong>${tower.def.name}</strong> — palier ${tower.tier}<br/>`;
      html += `Dégâts ${stats.damage.toFixed(0)} · Cadence ${stats.fireRatePerSec.toFixed(1)}/s · Portée ${stats.range.toFixed(1)}<br/>`;
    }
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

  show(): void {
    this.root.style.display = 'block';
  }

  hide(): void {
    this.root.style.display = 'none';
  }

  showEndOverlay(won: boolean, opts: { stars?: number; message?: string; primaryLabel?: string } = {}): void {
    this.endOverlay.style.display = 'flex';
    const starRow =
      opts.stars !== undefined ? icon('star', '⭐').repeat(opts.stars) + '☆'.repeat(3 - opts.stars) : '';
    const primaryLabel = opts.primaryLabel ?? (won ? 'Continuer' : 'Réessayer');
    this.endOverlay.innerHTML = `
      <div class="hud-end-card">
        <h2>${won ? 'Niveau réussi !' : 'Défaite'}</h2>
        ${starRow ? `<div class="hud-stars">${starRow}</div>` : ''}
        ${opts.message ? `<p>${opts.message}</p>` : ''}
        <button data-action="restart">${primaryLabel}</button>
        <button data-action="menu" class="hud-end-menu-btn">Menu</button>
      </div>`;
    this.endOverlay.querySelector('[data-action="restart"]')?.addEventListener('click', () => {
      this.endOverlay.style.display = 'none';
      this.callbacks.onRestart();
    });
    this.endOverlay.querySelector('[data-action="menu"]')?.addEventListener('click', () => {
      this.endOverlay.style.display = 'none';
      this.callbacks.onOpenMenu();
    });
  }

  private bindEvents(): void {
    this.bus.on('goldChanged', () => this.refresh());
    this.bus.on('livesChanged', () => this.refresh());
    this.bus.on('waveCompleted', () => this.refresh());
    this.bus.on('waveCalledEarly', () => this.refresh());
  }

  /** Survival slices a huge pre-generated wave array starting mid-way; display the absolute wave number instead. */
  setWaveDisplayMode(offset: number, endless: boolean): void {
    this.waveNumberOffset = offset;
    this.waveEndless = endless;
  }

  refresh(): void {
    const { economy, waveScheduler, level, scoreTracker } = this.gameState;
    this.goldEl.innerHTML = `${icon('gold', '💰')} ${economy.gold}`;
    this.livesEl.innerHTML = `${icon('life', '❤️')} ${economy.lives}`;
    const current = waveScheduler.waveIndex + 1 + this.waveNumberOffset;
    const waveText = this.waveEndless ? `Vague ${current}` : `Vague ${current}/${level.waves.length}`;
    this.waveEl.innerHTML = `${icon('wave', '')} ${waveText}`;
    this.scoreEl.innerHTML = `${icon('trophy', '🏆')} ${Math.floor(scoreTracker.score)} ×${scoreTracker.multiplier.toFixed(1)}`;
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
      .hud-root { position: absolute; inset: 0; pointer-events: none; font-family: system-ui, sans-serif; color: #f1f2f6;
        --hud-grey: #2f3542; --hud-grey-lt: #454d60; --hud-grey-dk: #1a1d26;
        --hud-gold: #ffa502; --hud-gold-lt: #ffc14d; --hud-gold-dk: #cc8400;
        --hud-blue: #70a1ff; --hud-blue-lt: #9ebfff; --hud-blue-dk: #4a78cc; }
      .hud-icon { width: 1.15em; height: 1.15em; vertical-align: -0.22em; object-fit: contain; }
      .hud-stars .hud-icon { width: 32px; height: 32px; vertical-align: middle; }
      .hud-top { position: absolute; top: 0; left: 0; right: 0; display: flex; flex-wrap: wrap; row-gap: 6px; gap: 16px; align-items: center; padding: 10px 14px; background: rgba(18,21,28,0.6); pointer-events: auto; font-size: 15px; }
      .hud-menu-btn { min-width: 44px; min-height: 44px; border: 2px solid rgba(255,255,255,0.15); border-radius: 12px;
        background: linear-gradient(180deg, var(--hud-grey-lt), var(--hud-grey)); box-shadow: 0 4px 0 var(--hud-grey-dk);
        color: #f1f2f6; font-size: 16px; font-weight: 700; cursor: pointer; flex-shrink: 0; transition: transform 0.08s, box-shadow 0.08s; }
      .hud-menu-btn:active { transform: translateY(3px); box-shadow: 0 1px 0 var(--hud-grey-dk); }
      .hud-score { color: #ffd166; font-variant-numeric: tabular-nums; font-weight: 700; }
      .hud-early-call { margin-left: auto; padding: 8px 16px; min-height: 44px; border: 2px solid rgba(255,255,255,0.25); border-radius: 12px;
        background: linear-gradient(180deg, var(--hud-gold-lt), var(--hud-gold)); box-shadow: 0 4px 0 var(--hud-gold-dk);
        color: #14161f; font-weight: 800; cursor: pointer; flex-shrink: 0; transition: transform 0.08s, box-shadow 0.08s; }
      .hud-early-call:active { transform: translateY(3px); box-shadow: 0 1px 0 var(--hud-gold-dk); }
      @media (max-width: 480px) {
        .hud-top { gap: 10px; padding: 8px 10px; font-size: 13px; }
        .hud-menu-btn { min-width: 38px; min-height: 38px; font-size: 14px; }
        .hud-early-call { padding: 6px 12px; min-height: 38px; font-size: 12px; }
      }
      .hud-tower-bar { position: absolute; bottom: 0; left: 0; right: 0; display: flex; gap: 8px; padding: 10px; background: rgba(18,21,28,0.6); pointer-events: auto; overflow-x: auto; }
      .hud-tower-btn { min-width: 76px; min-height: 44px; padding: 6px 10px; border-radius: 12px; border: 2px solid rgba(255,255,255,0.12);
        background: linear-gradient(180deg, var(--hud-grey-lt), var(--hud-grey)); box-shadow: 0 4px 0 var(--hud-grey-dk);
        color: #f1f2f6; font-weight: 600; cursor: pointer; font-size: 12px; transition: transform 0.08s, box-shadow 0.08s; }
      .hud-tower-btn:active:not(:disabled) { transform: translateY(3px); box-shadow: 0 1px 0 var(--hud-grey-dk); }
      .hud-tower-btn.active { border-color: var(--hud-gold); box-shadow: 0 4px 0 var(--hud-gold-dk), 0 0 0 2px var(--hud-gold) inset; }
      .hud-tower-btn:disabled { opacity: 0.4; cursor: not-allowed; }
      .hud-selected-panel { position: absolute; bottom: 74px; left: 10px; right: 10px; background: rgba(18,21,28,0.9); padding: 12px; border-radius: 14px; border: 2px solid rgba(255,255,255,0.08); pointer-events: auto; font-size: 13px; }
      .hud-selected-panel button { min-height: 44px; margin-top: 6px; padding: 6px 10px; border-radius: 10px; border: 2px solid rgba(255,255,255,0.25);
        background: linear-gradient(180deg, var(--hud-blue-lt), var(--hud-blue)); box-shadow: 0 4px 0 var(--hud-blue-dk);
        color: #14161f; font-weight: 700; cursor: pointer; transition: transform 0.08s, box-shadow 0.08s; }
      .hud-selected-panel button:active { transform: translateY(3px); box-shadow: 0 1px 0 var(--hud-blue-dk); }
      .hud-end-overlay { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.6); pointer-events: auto; }
      .hud-end-card { background: #1e2129; padding: 24px 32px; border-radius: 18px; border: 2px solid rgba(255,255,255,0.08); text-align: center; }
      .hud-stars { font-size: 32px; margin: 10px 0; }
      .hud-end-card button { min-height: 44px; min-width: 120px; margin: 12px 6px 0; padding: 8px 16px; border-radius: 12px; border: 2px solid rgba(255,255,255,0.25);
        background: linear-gradient(180deg, var(--hud-blue-lt), var(--hud-blue)); box-shadow: 0 4px 0 var(--hud-blue-dk);
        color: #14161f; font-weight: 800; cursor: pointer; transition: transform 0.08s, box-shadow 0.08s; }
      .hud-end-card button:active { transform: translateY(3px); box-shadow: 0 1px 0 var(--hud-blue-dk); }
      .hud-end-menu-btn { background: linear-gradient(180deg, var(--hud-grey-lt), var(--hud-grey)) !important; box-shadow: 0 4px 0 var(--hud-grey-dk) !important; color: #f1f2f6 !important; }
      .hud-end-menu-btn:active { box-shadow: 0 1px 0 var(--hud-grey-dk) !important; }
    `;
    document.head.appendChild(style);
  }
}

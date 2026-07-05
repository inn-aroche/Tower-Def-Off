import { Progression, TOTAL_LEVELS } from '../meta/Progression';
import type { SaveManager } from '../meta/SaveManager';
import { SKINS } from '../data/skins';
import { SURVIVAL_TIERS, type SurvivalTier } from '../data/survival';
import type { LevelConfig } from '../data/LevelConfig';

export interface MainMenuCallbacks {
  onSelectLevel(levelId: number): void;
  onSelectSurvival(tier: SurvivalTier): void;
  onSelectSkin(skinId: string): void;
  onToggleReduceEffects(value: boolean): void;
}

/** Full-screen DOM overlay: level select, Survie entry, skin picker, accessibility toggle. */
export class MainMenu {
  private root: HTMLDivElement;

  constructor(
    container: HTMLElement,
    private readonly levels: LevelConfig[],
    private readonly progression: Progression,
    private readonly save: SaveManager,
    private readonly callbacks: MainMenuCallbacks,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'menu-root';
    container.appendChild(this.root);
    this.injectStyles();
    this.render();
  }

  private render(): void {
    const totalStars = this.progression.totalStars();
    const maxStars = TOTAL_LEVELS * 3;

    let html = `
      <div class="menu-card">
        <h1>PolyMaze TD</h1>
        <p class="menu-subtitle">${totalStars} / ${maxStars} étoiles</p>
        <h2>Aventure</h2>
        <div class="menu-level-grid">`;

    for (const level of this.levels) {
      const unlocked = this.progression.isLevelUnlocked(level.id);
      const stars = this.save.getStars(level.id);
      const starRow = unlocked ? '⭐'.repeat(stars) + '☆'.repeat(3 - stars) : '🔒';
      html += `<button class="menu-level-btn" data-level="${level.id}" ${unlocked ? '' : 'disabled'}>
        <strong>${level.id}</strong><span>${level.name}</span><span class="menu-stars">${starRow}</span>
      </button>`;
    }

    html += `</div><h2>Survie</h2><div class="menu-survival-row">`;
    for (const tier of Object.values(SURVIVAL_TIERS)) {
      const unlocked = this.progression.isSurvivalUnlocked();
      html += `<button class="menu-survival-btn" data-tier="${tier.id}" ${unlocked ? '' : 'disabled'}>
        ${unlocked ? tier.label : '🔒 ' + tier.label}
      </button>`;
    }
    html += `</div>`;

    html += `<h2>Apparence des tours</h2><div class="menu-skin-row">`;
    for (const skin of SKINS) {
      const unlocked = this.save.isSkinUnlocked(skin.id);
      const selected = this.save.selectedSkin === skin.id;
      html += `<button class="menu-skin-btn${selected ? ' active' : ''}" data-skin="${skin.id}" ${unlocked ? '' : 'disabled'}>
        ${unlocked ? skin.name : `🔒 ${skin.name} (${skin.starsRequired}⭐)`}
      </button>`;
    }
    html += `</div>`;

    html += `<label class="menu-toggle"><input type="checkbox" id="menu-reduce-effects" ${this.save.reduceEffects ? 'checked' : ''}/> Réduire les effets</label>`;
    html += `</div>`;

    this.root.innerHTML = html;
    this.bindEvents();
  }

  private bindEvents(): void {
    this.root.querySelectorAll<HTMLButtonElement>('.menu-level-btn').forEach((btn) => {
      btn.addEventListener('click', () => this.callbacks.onSelectLevel(Number(btn.dataset.level)));
    });
    this.root.querySelectorAll<HTMLButtonElement>('.menu-survival-btn').forEach((btn) => {
      btn.addEventListener('click', () => this.callbacks.onSelectSurvival(btn.dataset.tier as SurvivalTier));
    });
    this.root.querySelectorAll<HTMLButtonElement>('.menu-skin-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.callbacks.onSelectSkin(btn.dataset.skin!);
        this.render();
      });
    });
    const reduceEffectsCheckbox = this.root.querySelector<HTMLInputElement>('#menu-reduce-effects');
    reduceEffectsCheckbox?.addEventListener('change', () => {
      this.callbacks.onToggleReduceEffects(reduceEffectsCheckbox.checked);
    });
  }

  refresh(): void {
    this.render();
  }

  show(): void {
    this.root.style.display = 'flex';
    this.render();
  }

  hide(): void {
    this.root.style.display = 'none';
  }

  private injectStyles(): void {
    if (document.getElementById('menu-styles')) return;
    const style = document.createElement('style');
    style.id = 'menu-styles';
    style.textContent = `
      .menu-root { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
        background: rgba(10,12,18,0.92); font-family: system-ui, sans-serif; color: #f1f2f6; z-index: 20; overflow-y: auto; }
      .menu-card { max-width: 720px; width: 92%; padding: 24px; background: #1e2129; border-radius: 14px; margin: 24px 0; }
      .menu-card h1 { margin: 0 0 4px; font-size: 28px; }
      .menu-subtitle { margin: 0 0 16px; opacity: 0.75; }
      .menu-card h2 { font-size: 15px; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.7; margin: 20px 0 10px; }
      .menu-level-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 8px; }
      .menu-level-btn { display: flex; flex-direction: column; align-items: center; gap: 2px; min-height: 64px; padding: 8px;
        border-radius: 8px; border: none; background: #2f3542; color: #f1f2f6; cursor: pointer; font-size: 12px; }
      .menu-level-btn:disabled { opacity: 0.35; cursor: not-allowed; }
      .menu-stars { font-size: 11px; }
      .menu-survival-row, .menu-skin-row { display: flex; gap: 8px; flex-wrap: wrap; }
      .menu-survival-btn, .menu-skin-btn { min-height: 44px; padding: 8px 14px; border-radius: 8px; border: 2px solid transparent;
        background: #2f3542; color: #f1f2f6; cursor: pointer; font-size: 13px; }
      .menu-survival-btn:disabled, .menu-skin-btn:disabled { opacity: 0.35; cursor: not-allowed; }
      .menu-skin-btn.active { border-color: #ffa502; }
      .menu-toggle { display: flex; align-items: center; gap: 8px; margin-top: 20px; font-size: 13px; cursor: pointer; }
    `;
    document.head.appendChild(style);
  }
}

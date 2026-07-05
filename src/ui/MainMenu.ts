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
  onToggleAudioMuted(value: boolean): void;
}

type ScreenName = 'title' | 'play' | 'adventure' | 'survival' | 'settings' | 'shop';

const ROW_HEIGHT = 132;
const TOP_PAD = 80;
const BOTTOM_PAD = 60;
const X_LEFT = 78;
const X_RIGHT = 242;
const MAP_WIDTH = 320;

function islandPos(indexFromBottom: number): { x: number; y: number } {
  return { x: indexFromBottom % 2 === 0 ? X_LEFT : X_RIGHT, y: TOP_PAD + indexFromBottom * ROW_HEIGHT };
}

/**
 * Full-screen arcade-style menu shell: a title screen with three central CTAs (Jouer /
 * Paramètres / Boutique), a mode picker (Aventure / Survie), a Candy-Crush-style winding island
 * map for the campaign, plus settings and shop screens. Owns its own navigation stack — callers
 * only hear about it when the player actually picks something to *play* or a setting to *change*.
 */
export class MainMenu {
  private root: HTMLDivElement;
  private screen: ScreenName = 'title';

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

  show(screen: ScreenName = 'title'): void {
    this.screen = screen;
    this.root.style.display = 'flex';
    this.render();
  }

  hide(): void {
    this.root.style.display = 'none';
  }

  refresh(): void {
    this.render();
  }

  private navigate(screen: ScreenName): void {
    this.screen = screen;
    this.render();
  }

  private render(): void {
    switch (this.screen) {
      case 'title':
        return this.renderTitle();
      case 'play':
        return this.renderPlay();
      case 'adventure':
        return this.renderAdventure();
      case 'survival':
        return this.renderSurvival();
      case 'settings':
        return this.renderSettings();
      case 'shop':
        return this.renderShop();
    }
  }

  // ---- Title ----------------------------------------------------------------

  private renderTitle(): void {
    const totalStars = this.progression.totalStars();
    const maxStars = TOTAL_LEVELS * 3;

    this.root.innerHTML = `
      <div class="menu-title-screen">
        <div class="menu-masthead">
          <div class="menu-masthead-towers">
            <span class="menu-mini-tower mt-laser"></span>
            <span class="menu-mini-tower mt-mortar"></span>
            <span class="menu-mini-tower mt-tesla"></span>
            <span class="menu-mini-tower mt-cryo"></span>
          </div>
          <h1 class="menu-logo">PolyMaze<span class="menu-logo-td">TD</span></h1>
          <p class="menu-tagline">Sculpte le labyrinthe. Arrête la horde.</p>
        </div>

        <div class="menu-stars-badge">⭐ ${totalStars} / ${maxStars}</div>

        <div class="menu-cta-stack">
          <button class="menu-cta menu-cta--play" data-nav="play">
            <span class="menu-cta-icon">▶</span>
            <span class="menu-cta-label">Jouer</span>
          </button>
          <div class="menu-cta-row">
            <button class="menu-cta menu-cta--settings" data-nav="settings">
              <span class="menu-cta-icon">⚙</span>
              <span class="menu-cta-label">Paramètres</span>
            </button>
            <button class="menu-cta menu-cta--shop" data-nav="shop">
              <span class="menu-cta-icon">🛒</span>
              <span class="menu-cta-label">Boutique</span>
            </button>
          </div>
        </div>
      </div>`;

    this.root.querySelectorAll<HTMLButtonElement>('[data-nav]').forEach((btn) => {
      btn.addEventListener('click', () => this.navigate(btn.dataset.nav as ScreenName));
    });
  }

  // ---- Play mode picker -------------------------------------------------------

  private renderPlay(): void {
    const survivalUnlocked = this.progression.isSurvivalUnlocked();

    this.root.innerHTML = `
      ${this.backHeader('Choisis ton mode', 'title')}
      <div class="menu-mode-grid">
        <button class="menu-mode-card menu-mode-card--adventure" data-nav="adventure">
          <span class="menu-mode-icon">🗺️</span>
          <span class="menu-mode-title">Aventure</span>
          <span class="menu-mode-sub">10 niveaux à explorer</span>
        </button>
        <button class="menu-mode-card menu-mode-card--survival" data-nav="survival" ${survivalUnlocked ? '' : 'disabled'}>
          <span class="menu-mode-icon">${survivalUnlocked ? '♾️' : '🔒'}</span>
          <span class="menu-mode-title">Survie</span>
          <span class="menu-mode-sub">${survivalUnlocked ? 'Tiens le plus de vagues possible' : 'Débloqué après le niveau 5'}</span>
        </button>
      </div>`;

    this.bindBackAndNav();
  }

  // ---- Adventure island map ---------------------------------------------------

  private renderAdventure(): void {
    const n = this.levels.length;
    const mapHeight = TOP_PAD + (n - 1) * ROW_HEIGHT + BOTTOM_PAD;

    // Level 1 at the bottom, climbing toward N10 at the top — order the player actually plays in
    // reads bottom-to-top like a mountain trail.
    const nodes = this.levels.map((level, i) => {
      const indexFromBottom = n - 1 - i;
      const pos = islandPos(indexFromBottom);
      const unlocked = this.progression.isLevelUnlocked(level.id);
      const stars = this.save.getStars(level.id);
      return { level, pos, unlocked, stars };
    });

    let pathSvg = '<line x1="0" y1="0" x2="0" y2="0" />'; // placeholder if only one node
    if (nodes.length > 1) {
      const segments = [];
      for (let i = 0; i < nodes.length - 1; i++) {
        const a = nodes[i].pos;
        const b = nodes[i + 1].pos;
        const segUnlocked = nodes[i].unlocked && nodes[i + 1].unlocked;
        segments.push(
          `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" class="menu-path-segment${segUnlocked ? ' unlocked' : ''}" />`,
        );
      }
      pathSvg = segments.join('');
    }

    const islandsHtml = nodes
      .map(({ level, pos, unlocked, stars }) => {
        const starRow = unlocked ? '⭐'.repeat(stars) + '☆'.repeat(3 - stars) : '';
        return `
        <button class="menu-island${unlocked ? '' : ' locked'}" data-level="${level.id}" ${unlocked ? '' : 'disabled'}
          style="left:${pos.x}px; top:${pos.y}px;">
          <span class="menu-island-number">${unlocked ? level.id : '🔒'}</span>
        </button>
        <div class="menu-island-label" style="left:${pos.x}px; top:${pos.y + 46}px;">
          <span class="menu-island-name">${level.name}</span>
          ${unlocked ? `<span class="menu-island-stars">${starRow}</span>` : ''}
        </div>`;
      })
      .join('');

    this.root.innerHTML = `
      ${this.backHeader('Aventure', 'play')}
      <div class="menu-map-scroll">
        <div class="menu-map-canvas" style="width:${MAP_WIDTH}px; height:${mapHeight}px;">
          <svg class="menu-map-svg" width="${MAP_WIDTH}" height="${mapHeight}">${pathSvg}</svg>
          ${islandsHtml}
        </div>
      </div>`;

    this.bindBackAndNav();
    this.root.querySelectorAll<HTMLButtonElement>('.menu-island').forEach((btn) => {
      btn.addEventListener('click', () => this.callbacks.onSelectLevel(Number(btn.dataset.level)));
    });

    // Auto-scroll so the furthest unlocked island (the one the player will pick next) is in view.
    const scrollHost = this.root.querySelector<HTMLDivElement>('.menu-map-scroll');
    const target = [...nodes].reverse().find((nd) => nd.unlocked) ?? nodes[nodes.length - 1];
    if (scrollHost && target) {
      scrollHost.scrollTop = Math.max(0, target.pos.y - scrollHost.clientHeight / 2);
    }
  }

  // ---- Survival tier picker ----------------------------------------------------

  private renderSurvival(): void {
    const unlocked = this.progression.isSurvivalUnlocked();
    const tierMeta: Record<SurvivalTier, { icon: string; blurb: string }> = {
      bronze: { icon: '🥉', blurb: 'Depuis le début — pour se faire la main.' },
      silver: { icon: '🥈', blurb: 'Un vrai test d’endurance.' },
      gold: { icon: '🥇', blurb: 'Réservé aux stratèges confirmés.' },
    };

    const cards = Object.values(SURVIVAL_TIERS)
      .map((tier) => {
        const meta = tierMeta[tier.id];
        return `
        <button class="menu-tier-card" data-tier="${tier.id}" ${unlocked ? '' : 'disabled'}>
          <span class="menu-tier-icon">${unlocked ? meta.icon : '🔒'}</span>
          <span class="menu-tier-title">${tier.label}</span>
          <span class="menu-tier-sub">${unlocked ? meta.blurb : 'Débloqué après le niveau 5'}</span>
        </button>`;
      })
      .join('');

    this.root.innerHTML = `
      ${this.backHeader('Survie', 'play')}
      <div class="menu-tier-grid">${cards}</div>`;

    this.bindBackAndNav();
    this.root.querySelectorAll<HTMLButtonElement>('.menu-tier-card').forEach((btn) => {
      btn.addEventListener('click', () => this.callbacks.onSelectSurvival(btn.dataset.tier as SurvivalTier));
    });
  }

  // ---- Settings ------------------------------------------------------------

  private renderSettings(): void {
    this.root.innerHTML = `
      ${this.backHeader('Paramètres', 'title')}
      <div class="menu-settings-list">
        <label class="menu-toggle-row">
          <span>Réduire les effets</span>
          <input type="checkbox" id="menu-reduce-effects" ${this.save.reduceEffects ? 'checked' : ''}/>
        </label>
        <label class="menu-toggle-row">
          <span>Couper le son</span>
          <input type="checkbox" id="menu-mute-audio" ${this.save.audioMuted ? 'checked' : ''}/>
        </label>
      </div>`;

    this.bindBackAndNav();
    this.root.querySelector<HTMLInputElement>('#menu-reduce-effects')?.addEventListener('change', (e) => {
      this.callbacks.onToggleReduceEffects((e.target as HTMLInputElement).checked);
    });
    this.root.querySelector<HTMLInputElement>('#menu-mute-audio')?.addEventListener('change', (e) => {
      this.callbacks.onToggleAudioMuted((e.target as HTMLInputElement).checked);
    });
  }

  // ---- Shop / skins ---------------------------------------------------------

  private renderShop(): void {
    const cards = SKINS.map((skin) => {
      const unlocked = this.save.isSkinUnlocked(skin.id);
      const selected = this.save.selectedSkin === skin.id;
      const swatches = Object.values(skin.towerColors)
        .map((c) => `<span class="menu-swatch" style="background:#${c.toString(16).padStart(6, '0')}"></span>`)
        .join('');
      return `
      <button class="menu-shop-card${selected ? ' active' : ''}" data-skin="${skin.id}" ${unlocked ? '' : 'disabled'}>
        <span class="menu-swatch-row">${swatches}</span>
        <span class="menu-shop-name">${skin.name}</span>
        <span class="menu-shop-status">${unlocked ? (selected ? 'Équipé' : 'Débloqué') : `🔒 ${skin.starsRequired}⭐ requises`}</span>
      </button>`;
    }).join('');

    this.root.innerHTML = `
      ${this.backHeader('Boutique', 'title')}
      <p class="menu-shop-sub">Apparences de tours — débloquées en cumulant des étoiles.</p>
      <div class="menu-shop-grid">${cards}</div>`;

    this.bindBackAndNav();
    this.root.querySelectorAll<HTMLButtonElement>('.menu-shop-card').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.callbacks.onSelectSkin(btn.dataset.skin!);
        this.render();
      });
    });
  }

  // ---- Shared bits ----------------------------------------------------------

  private backHeader(title: string, backTo: ScreenName): string {
    return `
      <div class="menu-header">
        <button class="menu-back-btn" data-nav="${backTo}">←</button>
        <h2 class="menu-header-title">${title}</h2>
        <span class="menu-header-spacer"></span>
      </div>`;
  }

  private bindBackAndNav(): void {
    this.root.querySelectorAll<HTMLButtonElement>('[data-nav]').forEach((btn) => {
      btn.addEventListener('click', () => this.navigate(btn.dataset.nav as ScreenName));
    });
  }

  private injectStyles(): void {
    if (document.getElementById('menu-styles')) return;
    const style = document.createElement('style');
    style.id = 'menu-styles';
    style.textContent = `
      .menu-root {
        --menu-bg: #10121c; --menu-panel: #1a1e2d; --menu-panel-alt: #232840;
        --menu-ink: #f5f3ff; --menu-ink-dim: #8b91ab;
        --menu-gold: #ffb100; --menu-gold-dark: #cc8b00;
        --menu-teal: #4cc9c0; --menu-teal-dark: #2f8f88;
        --menu-pink: #ef5da8; --menu-pink-dark: #b83d80;
        --menu-green: #52c97a; --menu-green-dark: #379457;
        --menu-red: #ff5964; --menu-red-dark: #c23540;
        position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;
        background: radial-gradient(circle at 50% 0%, #1b2036 0%, var(--menu-bg) 65%);
        font-family: system-ui, sans-serif; color: var(--menu-ink); z-index: 20; overflow-y: auto; padding: 24px 0;
      }

      /* --- Title --- */
      .menu-title-screen { display: flex; flex-direction: column; align-items: center; gap: 22px; width: 92%; max-width: 420px; margin: 0 auto; }
      .menu-masthead { display: flex; flex-direction: column; align-items: center; gap: 10px; }
      .menu-masthead-towers { display: flex; gap: 10px; height: 22px; align-items: flex-end; }
      .menu-mini-tower { display: inline-block; width: 0; height: 0; border-left: 9px solid transparent; border-right: 9px solid transparent; border-bottom: 20px solid; opacity: 0.9; }
      .mt-laser { border-bottom-color: #ff4757; }
      .mt-mortar { border-bottom-color: #ffa502; }
      .mt-tesla { border-bottom-color: #70a1ff; }
      .mt-cryo { border-bottom-color: #7bed9f; }
      .menu-logo { margin: 0; font-size: 40px; font-weight: 900; letter-spacing: -0.02em; text-wrap: balance; text-align: center; }
      .menu-logo-td { color: var(--menu-gold); margin-left: 6px; }
      .menu-tagline { margin: 0; color: var(--menu-ink-dim); font-size: 14px; text-align: center; }
      .menu-stars-badge { padding: 6px 16px; border-radius: 999px; background: var(--menu-panel); font-variant-numeric: tabular-nums; font-weight: 700; font-size: 14px; }

      .menu-cta-stack { display: flex; flex-direction: column; gap: 12px; width: 100%; }
      .menu-cta { display: flex; flex-direction: column; align-items: center; gap: 4px; border: none; cursor: pointer; border-radius: 18px; color: #14161f; font-weight: 800; }
      .menu-cta--play { padding: 22px; background: linear-gradient(180deg, #ffc94d, var(--menu-gold)); box-shadow: 0 6px 0 var(--menu-gold-dark), 0 10px 20px rgba(255,177,0,0.25); font-size: 22px; }
      .menu-cta--play:active { transform: translateY(4px); box-shadow: 0 2px 0 var(--menu-gold-dark); }
      .menu-cta-icon { font-size: 22px; }
      .menu-cta-row { display: flex; gap: 12px; }
      .menu-cta-row .menu-cta { flex: 1; padding: 14px 8px; font-size: 13px; }
      .menu-cta--settings { background: linear-gradient(180deg, #7adbd3, var(--menu-teal)); box-shadow: 0 5px 0 var(--menu-teal-dark); }
      .menu-cta--settings:active { transform: translateY(4px); box-shadow: 0 1px 0 var(--menu-teal-dark); }
      .menu-cta--shop { background: linear-gradient(180deg, #f588c1, var(--menu-pink)); box-shadow: 0 5px 0 var(--menu-pink-dark); }
      .menu-cta--shop:active { transform: translateY(4px); box-shadow: 0 1px 0 var(--menu-pink-dark); }

      /* --- Shared header --- */
      .menu-header { display: flex; align-items: center; width: 92%; max-width: 420px; margin: 0 auto 18px; gap: 10px; }
      .menu-back-btn { min-width: 44px; min-height: 44px; border-radius: 12px; border: none; background: var(--menu-panel); color: var(--menu-ink); font-size: 18px; cursor: pointer; }
      .menu-header-title { flex: 1; text-align: center; margin: 0; font-size: 20px; font-weight: 800; }
      .menu-header-spacer { min-width: 44px; }

      /* --- Play mode picker --- */
      .menu-mode-grid { display: flex; flex-direction: column; gap: 14px; width: 92%; max-width: 420px; margin: 0 auto; }
      .menu-mode-card { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 26px 16px; border-radius: 18px; border: none; cursor: pointer; color: #14161f; font-weight: 800; }
      .menu-mode-card--adventure { background: linear-gradient(180deg, #7de3a0, var(--menu-green)); box-shadow: 0 6px 0 var(--menu-green-dark); }
      .menu-mode-card--survival { background: linear-gradient(180deg, #ff8790, var(--menu-red)); box-shadow: 0 6px 0 var(--menu-red-dark); }
      .menu-mode-card:disabled { background: var(--menu-panel); color: var(--menu-ink-dim); box-shadow: none; cursor: not-allowed; }
      .menu-mode-icon { font-size: 30px; }
      .menu-mode-title { font-size: 19px; }
      .menu-mode-sub { font-size: 12px; font-weight: 500; opacity: 0.85; }

      /* --- Adventure island map --- */
      .menu-map-scroll { width: 92%; max-width: 420px; max-height: 62vh; overflow-y: auto; margin: 0 auto; border-radius: 16px; background: rgba(0,0,0,0.15); }
      .menu-map-canvas { position: relative; margin: 0 auto; }
      .menu-map-svg { position: absolute; top: 0; left: 0; }
      .menu-path-segment { stroke: #3a3f57; stroke-width: 5; stroke-linecap: round; stroke-dasharray: 2 14; }
      .menu-path-segment.unlocked { stroke: var(--menu-gold); }
      .menu-island { position: absolute; width: 62px; height: 62px; margin-left: -31px; margin-top: -31px; border-radius: 50%;
        border: none; cursor: pointer; background: radial-gradient(circle at 35% 30%, #7de3a0, var(--menu-green)); box-shadow: 0 5px 0 var(--menu-green-dark);
        display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 20px; color: #14161f; }
      .menu-island:active { transform: translateY(3px); box-shadow: 0 2px 0 var(--menu-green-dark); }
      .menu-island.locked { background: var(--menu-panel-alt); box-shadow: 0 5px 0 #12141f; cursor: not-allowed; }
      .menu-island-label { position: absolute; margin-left: -60px; width: 120px; text-align: center; font-size: 11px; color: var(--menu-ink-dim); }
      .menu-island-name { display: block; }
      .menu-island-stars { display: block; font-size: 11px; margin-top: 2px; }

      /* --- Survival tiers --- */
      .menu-tier-grid { display: flex; flex-direction: column; gap: 12px; width: 92%; max-width: 420px; margin: 0 auto; }
      .menu-tier-card { display: flex; align-items: center; gap: 14px; padding: 16px 18px; border-radius: 14px; border: none; cursor: pointer;
        background: var(--menu-panel); color: var(--menu-ink); text-align: left; }
      .menu-tier-card:disabled { opacity: 0.45; cursor: not-allowed; }
      .menu-tier-icon { font-size: 26px; }
      .menu-tier-title { font-weight: 800; font-size: 15px; display: block; }
      .menu-tier-sub { font-size: 12px; color: var(--menu-ink-dim); display: block; }
      .menu-tier-card { flex-direction: column; align-items: flex-start; }

      /* --- Settings --- */
      .menu-settings-list { display: flex; flex-direction: column; gap: 10px; width: 92%; max-width: 420px; margin: 0 auto; }
      .menu-toggle-row { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; border-radius: 12px; background: var(--menu-panel); font-size: 14px; cursor: pointer; }
      .menu-toggle-row input { width: 20px; height: 20px; }

      /* --- Shop --- */
      .menu-shop-sub { width: 92%; max-width: 420px; margin: 0 auto 14px; color: var(--menu-ink-dim); font-size: 13px; text-align: center; }
      .menu-shop-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; width: 92%; max-width: 420px; margin: 0 auto; }
      .menu-shop-card { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 14px; border-radius: 14px;
        border: 2px solid transparent; background: var(--menu-panel); color: var(--menu-ink); cursor: pointer; }
      .menu-shop-card.active { border-color: var(--menu-gold); }
      .menu-shop-card:disabled { opacity: 0.5; cursor: not-allowed; }
      .menu-swatch-row { display: flex; gap: 4px; }
      .menu-swatch { width: 14px; height: 14px; border-radius: 4px; }
      .menu-shop-name { font-weight: 700; font-size: 13px; }
      .menu-shop-status { font-size: 11px; color: var(--menu-ink-dim); }
    `;
    document.head.appendChild(style);
  }
}

/**
 * WARDENS design tokens + base component styles, injected once. Values come from
 * docs/design/design-tokens.md (the imported Claude Design maquettes). This is a game UI that
 * deliberately commits to a single warm visual world — not theme-aware by design.
 */
const CSS = `
:root {
  --cream: #efe8d6;
  --cream-2: #efe6cd;
  --panel: linear-gradient(160deg,#fdf6e3,#f0e2b8);
  --panel-border: #c9a15f;
  --ink: #3b2a1a;
  --ink-soft: #6b4a20;
  --brown-bar: linear-gradient(180deg,#3a2a1c,#2b1e14);
  --brown-2: #2b1e14;
  --gold-grad: linear-gradient(180deg,#f5d576,#e8b923);
  --gold-edge: #a9780f;
  --gold-ink: #5c3d0a;
  --gem-grad: linear-gradient(135deg,#e8c6fb,#9b59b6 60%,#6c3483);
  --gem-edge: #6c3483;
  --green-grad: linear-gradient(180deg,#8ee06a,#4caf50);
  --green-edge: #2e7d32;
  --purple-grad: linear-gradient(180deg,#d9b3f0,#9b59b6);
  --purple-edge: #6c3483;
  --rare-common: linear-gradient(160deg,#8ecae6,#4a90c4);
  --rare-common-edge: #2f6690;
  --rare-rare: linear-gradient(160deg,#82e07a,#4caf50);
  --rare-rare-edge: #2e7d32;
  --rare-epic: linear-gradient(160deg,#d9b3f0,#9b59b6);
  --rare-epic-edge: #6c3483;
  --fam-melee: #4a90c4;
  --fam-ranged: #4caf50;
  --fam-gravity: #1aa39a;
  --shadow-card: 0 6px 14px rgba(0,0,0,.18);
}
* { box-sizing: border-box; }
.screen {
  position: absolute; inset: 0; display: flex; flex-direction: column;
  background: var(--cream); color: var(--ink);
  font-family: 'Nunito', -apple-system, system-ui, sans-serif;
  overflow: hidden; user-select: none; -webkit-user-select: none;
}
.screen__scroll { flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; }
.topbar {
  display: flex; align-items: center; gap: 8px;
  padding: 52px 14px 12px; background: var(--brown-bar); color: #fff; flex: none;
}
.topbar__title { font: 800 18px 'Baloo 2', sans-serif; flex: 1; }
.topbar__back {
  width: 34px; height: 34px; border: none; border-radius: 10px; flex: none;
  background: rgba(255,255,255,.14); color: #f0c26a; font-size: 20px; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}
.pill {
  display: inline-flex; align-items: center; gap: 6px; white-space: nowrap;
  border-radius: 14px; padding: 5px 11px; font: 800 12px 'Baloo 2', sans-serif;
  box-shadow: inset 0 2px 0 rgba(255,255,255,.5);
}
.pill--gold { background: var(--gold-grad); border-bottom: 3px solid var(--gold-edge); color: var(--gold-ink); }
.pill--gem { background: var(--gem-grad); border-bottom: 3px solid var(--gem-edge); color: #fff; }
.coin { width: 14px; height: 14px; border-radius: 50%; flex: none;
  background: radial-gradient(circle at 32% 28%,#fbe08a,#e8b923 55%,#a9780f 100%); border: 1px solid var(--gold-edge); }
.gem { width: 10px; height: 10px; flex: none; transform: rotate(45deg);
  background: var(--gem-grad); border: 1px solid var(--gem-edge); }
.btn {
  border: none; cursor: pointer; font-family: 'Baloo 2', sans-serif; font-weight: 800;
  color: #fff; border-radius: 16px; padding: 13px 18px; box-shadow: inset 0 3px 0 rgba(255,255,255,.45);
  transition: transform .05s ease, box-shadow .05s ease; -webkit-tap-highlight-color: transparent;
}
.btn:active { transform: translateY(3px); box-shadow: inset 0 2px 0 rgba(255,255,255,.4); }
.btn--green { background: var(--green-grad); border-bottom: 6px solid var(--green-edge); }
.btn--purple { background: var(--purple-grad); border-bottom: 6px solid var(--purple-edge); }
.btn--gold { background: var(--gold-grad); border-bottom: 6px solid var(--gold-edge); color: var(--gold-ink); }
.btn:disabled { background: #cfc6b0; border-bottom-color: #a89c7f; color: #8a7e63; cursor: default; }
.btn:disabled:active { transform: none; }
.panel {
  background: var(--panel); border-radius: 16px; padding: 14px;
  box-shadow: inset 0 2px 0 rgba(255,255,255,.6), var(--shadow-card);
}
.navbottom {
  display: flex; align-items: stretch; justify-content: space-around;
  background: var(--brown-bar); flex: none; padding: 8px 6px calc(8px + env(safe-area-inset-bottom));
}
.navbtn {
  flex: 1; background: none; border: none; cursor: pointer; color: #c9b896;
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  font: 700 10px 'Nunito', sans-serif; padding: 4px 0;
}
.navbtn--active { color: #f0c26a; }
.navbtn__icon { width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 20px; }
.tile {
  position: relative; border-radius: 12px; box-shadow: inset 0 2px 0 rgba(255,255,255,.5);
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 5px; padding: 6px; cursor: pointer; aspect-ratio: 1; overflow: hidden;
}
.tile--locked { filter: grayscale(1) brightness(.7); opacity: .75; }
.tile__name { font: 800 9px 'Nunito', sans-serif; color: #fff; text-align: center; line-height: 1.05; }
.tile__lv {
  position: absolute; top: 5px; right: 5px; background: #fff; border-radius: 8px;
  padding: 1px 5px; font: 800 9px 'Baloo 2', sans-serif;
}
.tile__pico { width: 26px; height: 26px; }
.bar { height: 8px; background: #d9cba3; border-radius: 5px; overflow: hidden; }
.bar__fill { height: 100%; }
.section-label { font: 700 11px 'Nunito', sans-serif; color: var(--ink-soft); text-transform: uppercase; letter-spacing: .04em; }
.chip {
  border: none; cursor: pointer; border-radius: 14px; padding: 5px 12px;
  font: 700 10px 'Baloo 2', sans-serif; background: #e6d9bb; border-bottom: 3px solid #c9b896; color: var(--ink-soft);
}
.chip--on { background: var(--gold-grad); border-bottom-color: var(--gold-edge); color: var(--gold-ink); }
`;

let injected = false;
export function ensureTheme(): void {
  if (injected) return;
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  if (!document.querySelector('link[data-wardens-fonts]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.dataset.wardensFonts = '1';
    link.href = 'https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;700;800&family=Nunito:wght@400;600;700;800&display=swap';
    document.head.appendChild(link);
  }
  injected = true;
}

export const FAMILY_VAR: Record<string, string> = {
  melee: 'var(--fam-melee)',
  ranged: 'var(--fam-ranged)',
  gravity: 'var(--fam-gravity)',
};
export const RARITY_GRAD: Record<string, string> = {
  common: 'var(--rare-common)',
  rare: 'var(--rare-rare)',
  epic: 'var(--rare-epic)',
};
export const RARITY_EDGE: Record<string, string> = {
  common: 'var(--rare-common-edge)',
  rare: 'var(--rare-rare-edge)',
  epic: 'var(--rare-epic-edge)',
};

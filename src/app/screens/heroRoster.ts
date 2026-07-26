import type { AppState } from '../AppState';
import type { Route } from '../routes';
import { el } from '../../ui/dom';
import { RARITY_EDGE, RARITY_GRAD } from '../../ui/theme';

/**
 * Hero collection as a card grid (shared by the Héros screen and the Collection "Héros" tab).
 * Each card opens the hero's detail sheet.
 */
export function heroTiles(app: AppState, nav: (r: Route) => void): HTMLElement[] {
  return app.heroRoster().map(({ def, owned, level, active }) => {
    const tile = el('button', {
      class: `tile ${owned ? '' : 'tile--locked'}`,
      style: `background:${RARITY_GRAD[def.rarity]};border-bottom:5px solid ${RARITY_EDGE[def.rarity]}`,
      onclick: () => nav({ name: 'hero', heroId: def.id }),
    });
    tile.append(el('div', { style: 'font-size:30px;line-height:1', text: owned ? '🦸' : '🔒' }));
    tile.append(el('span', { class: 'tile__name', text: def.name }));
    if (owned) tile.append(el('span', { class: 'tile__lv', text: `Niv ${level}`, style: `color:${RARITY_EDGE[def.rarity]}` }));
    if (active) {
      tile.append(el('span', {
        text: '✓',
        style: 'position:absolute;top:4px;left:4px;background:var(--gold-grad);color:#5c3d0a;border-radius:8px;padding:0 5px;font:800 9px "Baloo 2",sans-serif',
      }));
    }
    if (owned && app.canPromoteHero(def.id)) {
      tile.append(el('span', { style: 'position:absolute;top:5px;right:5px;width:10px;height:10px;border-radius:50%;background:#4caf50;border:2px solid #fff' }));
    }
    return tile;
  });
}

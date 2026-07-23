import type { Screen, ScreenCtx } from '../Router';
import { clear, el } from '../../ui/dom';
import type { Rarity } from '../../sim/types';
import { UNITS } from '../../data/units';
import { bottomNav, currencyPills, unitTile } from './common';

type Filter = 'all' | Rarity;

export function CollectionScreen(ctx: ScreenCtx): Screen {
  const { app, nav } = ctx;
  const screen = el('div', { class: 'screen' });
  let filter: Filter = 'all';

  const top = el('div', { class: 'topbar' }, [
    el('button', { class: 'topbar__back', text: '‹', onclick: () => nav({ name: 'hub' }) }),
    el('div', { class: 'topbar__title', text: 'Collection' }),
    currencyPills(app),
  ]);

  const owned = app.ownedCount();
  const countLabel = el('div', {
    style: 'padding:8px 14px 0;font:800 12px "Baloo 2",sans-serif;color:var(--ink-soft)',
    text: `${owned} / ${UNITS.length} unités débloquées`,
  });

  const chips = el('div', { style: 'display:flex;gap:6px;padding:10px 14px;flex-wrap:wrap' });
  const grid = el('div', {
    class: 'screen__scroll',
    style: 'display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding:6px 14px 16px;align-content:start',
  });

  const renderGrid = () => {
    clear(grid);
    for (const def of UNITS) {
      if (filter !== 'all' && def.rarity !== filter) continue;
      const owned = app.owned(def.id);
      grid.append(
        unitTile(def, {
          level: owned?.level,
          locked: !owned,
          onClick: () => {
            if (owned) nav({ name: 'unit', unitId: def.id });
          },
        }),
      );
    }
  };

  const renderChips = () => {
    clear(chips);
    const opts: Array<{ id: Filter; label: string }> = [
      { id: 'all', label: 'Tous' },
      { id: 'common', label: 'Communes' },
      { id: 'rare', label: 'Rares' },
      { id: 'epic', label: 'Épiques' },
    ];
    for (const o of opts) {
      chips.append(
        el('button', {
          class: `chip ${filter === o.id ? 'chip--on' : ''}`,
          text: o.label,
          onclick: () => {
            filter = o.id;
            renderChips();
            renderGrid();
          },
        }),
      );
    }
  };

  renderChips();
  renderGrid();

  const nav_ = bottomNav('collection', {
    onCollection: () => nav({ name: 'collection' }),
    onPlay: () => nav({ name: 'hub' }),
    onShop: () => nav({ name: 'shop' }),
  });

  screen.append(top, countLabel, chips, grid, nav_);
  ctx.host.append(screen);
  return { unmount() {} };
}

import type { Screen, ScreenCtx } from '../Router';
import { el } from '../../ui/dom';
import { RARITY_EDGE, RARITY_GRAD } from '../../ui/theme';
import { UNITS_BY_ID } from '../../data/units';
import { unitPortrait } from './common';

export function ChestScreen(ctx: ScreenCtx): Screen {
  const { app, nav, route } = ctx;
  const kind = route.name === 'chest' ? route.kind : 'common';
  const reward = app.openChest(kind); // grants immediately (unlocks locked units via duplicates)

  const screen = el('div', {
    class: 'screen',
    style: 'background:radial-gradient(circle at 50% 32%,#f0c26a 0%,#c98f3e 40%,#5c3d0a 100%);align-items:center',
  });

  screen.append(
    el('div', {
      text: kind === 'epic' ? 'COFFRE ÉPIQUE' : 'COFFRE COMMUN',
      style: 'margin-top:90px;font:800 22px "Baloo 2";color:#fff;text-shadow:0 3px 0 #a9780f,0 6px 10px rgba(0,0,0,.35)',
    }),
  );

  const goldRow = el('div', { style: 'margin-top:18px;display:flex;align-items:center;gap:8px;background:var(--brown-bar);padding:8px 16px;border-radius:14px' }, [
    el('span', { class: 'coin' }),
    el('span', { style: 'font:800 15px "Baloo 2";color:#f0c26a', text: `+${reward.gold} Or` }),
  ]);
  screen.append(goldRow);

  const grid = el('div', { style: 'display:flex;flex-wrap:wrap;gap:12px;justify-content:center;padding:22px;max-width:340px' });
  for (const d of reward.duplicates) {
    const def = UNITS_BY_ID.get(d.unitId);
    if (!def) continue;
    const owned = app.owned(d.unitId);
    // "Nouveau" if this chest just created the unit (its total dup count equals what we granted).
    const isNew = !!owned && owned.level === 1 && owned.duplicates === d.count;
    grid.append(
      el('div', { style: 'display:flex;flex-direction:column;align-items:center;gap:5px' }, [
        el('div', {
          style: `position:relative;width:70px;height:70px;border-radius:14px;background:${RARITY_GRAD[def.rarity]};border-bottom:5px solid ${RARITY_EDGE[def.rarity]};display:flex;align-items:center;justify-content:center`,
        }, [
          unitPortrait(def, 54),
          el('span', {
            text: `×${d.count}`,
            style: 'position:absolute;bottom:3px;right:5px;font:800 11px "Baloo 2";color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.5)',
          }),
          ...(isNew
            ? [el('span', { text: 'NOUVEAU', style: 'position:absolute;top:-8px;left:50%;transform:translateX(-50%);background:#e74c3c;color:#fff;font:800 7px "Baloo 2";padding:2px 6px;border-radius:8px;white-space:nowrap' })]
            : []),
        ]),
        el('span', { style: 'font:700 9px "Nunito";color:#fff;text-align:center', text: def.name }),
      ]),
    );
  }
  screen.append(grid);

  screen.append(el('div', { style: 'flex:1' }));
  screen.append(
    el('button', {
      class: 'btn btn--green',
      style: 'width:calc(100% - 48px);margin:0 24px 40px',
      text: 'Récupérer',
      onclick: () => nav({ name: 'shop' }),
    }),
  );

  ctx.host.append(screen);
  return { unmount() {} };
}

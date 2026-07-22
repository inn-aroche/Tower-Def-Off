import type { Screen, ScreenCtx } from '../Router';
import { clear, el, pictogram } from '../../ui/dom';
import { RARITY_EDGE, RARITY_GRAD } from '../../ui/theme';
import { UNITS, UNITS_BY_ID } from '../../data/units';
import { DECK_MAX, DECK_MIN } from '../../data/meta';
import { currencyPills, toast, unitTile } from './common';

export function DeckScreen(ctx: ScreenCtx): Screen {
  const { app, host, nav } = ctx;
  const screen = el('div', { class: 'screen' });

  const top = el('div', { class: 'topbar' }, [
    el('button', { class: 'topbar__back', text: '‹', onclick: () => nav({ name: 'hub' }) }),
    el('div', { class: 'topbar__title', text: 'Deck' }),
    currencyPills(app),
  ]);

  const slots = el('div', { style: 'display:flex;gap:8px;padding:14px;justify-content:center' });
  const hint = el('div', {
    style: 'text-align:center;font:700 11px "Nunito";color:var(--ink-soft);padding:0 14px 6px',
  });
  const label = el('div', { class: 'section-label', style: 'padding:6px 14px', text: 'Tes unités' });
  const grid = el('div', {
    class: 'screen__scroll',
    style: 'display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding:6px 14px 16px;align-content:start',
  });

  const renderSlots = () => {
    clear(slots);
    const deck = app.deck;
    for (let i = 0; i < DECK_MAX; i++) {
      const unitId = deck[i];
      if (unitId) {
        const def = UNITS_BY_ID.get(unitId)!;
        slots.append(
          el('div', {
            style: `width:56px;height:66px;border-radius:12px;background:${RARITY_GRAD[def.rarity]};border-bottom:4px solid ${RARITY_EDGE[def.rarity]};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px`,
          }, [pictogram(def.family, 24), el('span', { style: 'font:800 8px "Nunito";color:#fff', text: def.name })]),
        );
      } else {
        slots.append(
          el('div', {
            style: 'width:56px;height:66px;border-radius:12px;background:#e2d6b6;border:2px dashed #c9b896;display:flex;align-items:center;justify-content:center;color:#b9a97e;font-size:22px',
            text: '+',
          }),
        );
      }
    }
    hint.textContent = `${app.deck.length} / ${DECK_MAX} unités (min ${DECK_MIN})`;
  };

  const renderGrid = () => {
    clear(grid);
    for (const def of UNITS) {
      if (!app.isOwned(def.id)) continue;
      const inDeck = app.isInDeck(def.id);
      grid.append(
        unitTile(def, {
          level: app.ownedLevel(def.id),
          badge: `${def.cost}◆`,
          onClick: () => {
            const res = app.toggleDeck(def.id);
            if (!res.ok) {
              toast(host, res.reason === 'too-many' ? 'Deck plein (max 5)' : 'Deck minimum 4 unités');
              return;
            }
            renderSlots();
            renderGrid();
          },
        }),
      );
      const tile = grid.lastElementChild as HTMLElement;
      if (inDeck) {
        tile.style.outline = '3px solid #f0c26a';
        tile.style.outlineOffset = '-3px';
      }
    }
  };

  renderSlots();
  renderGrid();

  const play = el('button', {
    class: 'btn btn--green',
    style: 'margin:0 14px 16px;',
    text: 'Jouer avec ce deck',
    onclick: () => nav({ name: 'combat', nodeIndex: app.unlockedNode }),
  });

  screen.append(top, slots, hint, play, label, grid);
  host.append(screen);
  return { unmount() {} };
}

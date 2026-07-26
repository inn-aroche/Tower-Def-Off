import type { Screen, ScreenCtx } from '../Router';
import { el, pictogram } from '../../ui/dom';
import type { Rarity } from '../../sim/types';
import { UNITS, UNITS_BY_ID } from '../../data/units';
import { HEROES_BY_ID } from '../../data/heroes';
import { BASE_MAX_LEVEL, DECK_MAX } from '../../data/meta';
import { RARITY_EDGE, RARITY_GRAD } from '../../ui/theme';
import { bottomNav, currencyPills, toast, unitTile } from './common';
import { heroRosterCards } from './heroRoster';

type Tab = 'units' | 'base' | 'heroes';
type Filter = 'all' | Rarity;

/**
 * Unified loadout + collection (Rush-Royale style): the combat deck (hero slot + 5 units) sits at
 * the top, and the browsable collection lives below in tabs — Unités / Base / Ressources.
 */
export function CollectionScreen(ctx: ScreenCtx): Screen {
  const { app, host, nav } = ctx;
  const screen = el('div', { class: 'screen' });
  let tab: Tab = 'units';
  let filter: Filter = 'all';

  const top = el('div', { class: 'topbar' }, [
    el('button', { class: 'topbar__back', text: '‹', onclick: () => nav({ name: 'hub' }) }),
    el('div', { class: 'topbar__title', text: 'Deck & Collection' }),
    currencyPills(app),
  ]);

  const loadout = el('div', { style: 'padding:12px 14px 6px' });
  const tabsBar = el('div', { style: 'display:flex;gap:8px;padding:2px 14px 8px' });
  const content = el('div', { class: 'screen__scroll', style: 'padding:4px 14px 16px' });

  // ── Loadout : hero slot + 5 deck slots ──────────────────────────────────
  function renderLoadout(): void {
    loadout.replaceChildren();
    const panel = el('div', { class: 'panel', style: 'display:flex;gap:10px;align-items:stretch' });

    // Hero slot — shows the active hero; opens the hero screen.
    const heroDef = HEROES_BY_ID.get(app.activeHeroId);
    const hero = el('button', {
      style:
        'flex:0 0 92px;border:none;cursor:pointer;border-radius:14px;background:radial-gradient(circle at 50% 30%,#6a4a8c,#2b2b38);' +
        'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;color:#fff;padding:8px',
      onclick: () => nav({ name: 'heroes' }),
    }, [
      el('div', { style: 'font-size:30px', text: '🦸' }),
      el('div', { style: 'font:800 11px "Baloo 2",sans-serif', text: heroDef?.name ?? 'Héros' }),
      el('div', { style: 'font:700 9px "Nunito",sans-serif;color:#f0c26a', text: `Niv ${app.heroLevel(app.activeHeroId)}` }),
    ]);

    const slots = el('div', { style: 'flex:1;display:grid;grid-template-columns:repeat(3,1fr);gap:6px' });
    const deck = app.deck;
    for (let i = 0; i < DECK_MAX; i++) {
      const unitId = deck[i];
      if (unitId) {
        const def = UNITS_BY_ID.get(unitId)!;
        slots.append(
          el('button', {
            style:
              `border:none;cursor:pointer;border-radius:11px;background:${RARITY_GRAD[def.rarity]};border-bottom:4px solid ${RARITY_EDGE[def.rarity]};` +
              'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:6px 2px;min-height:58px',
            onclick: () => {
              const r = app.toggleDeck(unitId);
              if (!r.ok) toast(host, r.reason === 'too-few' ? 'Deck minimum 4 unités' : 'Impossible');
              else renderLoadout();
            },
          }, [pictogram(def.family, 22), el('span', { style: 'font:800 8px "Nunito";color:#fff', text: def.name })]),
        );
      } else {
        slots.append(
          el('div', {
            style: 'border-radius:11px;background:#e2d6b6;border:2px dashed #c9b896;min-height:58px;display:flex;align-items:center;justify-content:center;color:#b9a97e;font-size:22px',
            text: '+',
          }),
        );
      }
    }
    panel.append(hero, slots);
    loadout.append(panel, el('div', { style: 'font:700 10px "Nunito";color:var(--ink-soft);text-align:center;padding:6px 0 0', text: `${deck.length}/${DECK_MAX} unités · touche une unité en bas pour l’équiper` }));
  }

  // ── Tabs ─────────────────────────────────────────────────────────────────
  function renderTabs(): void {
    tabsBar.replaceChildren();
    const items: Array<{ id: Tab; label: string }> = [
      { id: 'units', label: 'Unités' },
      { id: 'base', label: 'Base' },
      { id: 'heroes', label: 'Héros' },
    ];
    for (const it of items) {
      tabsBar.append(
        el('button', {
          style:
            `flex:1;border:none;cursor:pointer;border-radius:12px 12px 0 0;padding:10px;font:800 13px "Baloo 2",sans-serif;` +
            (tab === it.id ? 'background:var(--purple-grad);color:#fff' : 'background:#e6d9bb;color:var(--ink-soft)'),
          text: it.label,
          onclick: () => {
            tab = it.id;
            renderTabs();
            renderContent();
          },
        }),
      );
    }
  }

  // ── Content per tab ────────────────────────────────────────────────────────
  function renderContent(): void {
    content.replaceChildren();
    if (tab === 'units') renderUnits();
    else if (tab === 'base') renderBase();
    else renderHeroes();
  }

  function renderUnits(): void {
    const chips = el('div', { style: 'display:flex;gap:6px;padding:2px 0 10px;flex-wrap:wrap' });
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
            renderContent();
          },
        }),
      );
    }
    const grid = el('div', { style: 'display:grid;grid-template-columns:repeat(3,1fr);gap:10px' });
    for (const def of UNITS) {
      if (filter !== 'all' && def.rarity !== filter) continue;
      const owned = app.owned(def.id);
      const inDeck = app.isInDeck(def.id);
      const tile = unitTile(def, {
        level: owned?.level,
        locked: !owned,
        onClick: () => {
          if (owned) nav({ name: 'unit', unitId: def.id });
        },
      });
      if (inDeck) {
        tile.style.outline = '3px solid #f0c26a';
        tile.style.outlineOffset = '-3px';
      }
      grid.append(tile);
    }
    content.append(chips, el('div', { class: 'section-label', style: 'padding:2px 0 8px', text: `${app.ownedCount()} / ${UNITS.length} unités débloquées` }), grid);
  }

  function renderBase(): void {
    const level = app.baseLevel;
    const cost = app.baseUpgradeCostFor();
    const canUp = app.canUpgradeBase();
    const card = el('div', { class: 'panel', style: 'display:flex;flex-direction:column;gap:10px;align-items:center;text-align:center' }, [
      el('div', { style: 'font-size:52px', text: '🏰' }),
      el('div', { style: 'font:800 18px "Baloo 2";color:var(--ink)', text: `Base · Niveau ${level}` }),
      el('div', { style: 'font:700 12px "Nunito";color:var(--ink-soft)', text: `+${app.baseBonusLife()} PV de départ (campagne & survie)` }),
    ]);

    if (cost) {
      const costRow = el('div', { style: 'display:flex;gap:14px;justify-content:center;font:700 13px "Baloo 2"' }, [
        el('div', { style: 'display:flex;align-items:center;gap:5px;color:var(--gold-ink)' }, [
          el('span', { class: 'coin' }),
          el('span', { text: String(cost.gold), style: app.gold >= cost.gold ? '' : 'color:#c0392b' }),
        ]),
      ]);
      if (cost.shards > 0) {
        costRow.append(
          el('div', { style: 'display:flex;align-items:center;gap:5px;color:#12756e' }, [
            el('span', { style: 'width:11px;height:11px;transform:rotate(45deg);border-radius:2px;background:linear-gradient(135deg,#7fe3da,#1aa39a);border:1px solid #12756e' }),
            el('span', { text: String(cost.shards), style: app.shards >= cost.shards ? '' : 'color:#c0392b' }),
          ]),
        );
      }
      const missing: string[] = [];
      if (app.gold < cost.gold) missing.push('or');
      if (cost.shards > 0 && app.shards < cost.shards) missing.push('éclats');
      card.append(
        el('div', { style: 'font:700 11px "Nunito";color:var(--ink-soft)', text: `Améliorer vers niveau ${level + 1} (+2 PV)` }),
        costRow,
        el('button', {
          class: `btn ${canUp ? 'btn--green' : ''}`,
          style: 'width:100%',
          text: canUp ? 'Améliorer la base' : `Manque : ${missing.join(', ')}`,
          ...(canUp ? {} : { disabled: true }),
          onclick: () => {
            if (app.upgradeBase() !== null) {
              toast(host, 'Base améliorée !');
              renderContent();
            }
          },
        }),
      );
    } else {
      card.append(el('div', { style: 'font:800 13px "Baloo 2";color:var(--green-edge)', text: `Niveau maximum (${BASE_MAX_LEVEL}) atteint` }));
    }
    content.append(card);
  }

  function renderHeroes(): void {
    // Re-render the whole screen on change so the loadout hero slot + currencies stay in sync.
    content.append(
      el('div', { style: 'display:flex;flex-direction:column;gap:14px' }, heroRosterCards(app, host, () => {
        renderLoadout();
        renderContent();
      })),
    );
  }

  renderLoadout();
  renderTabs();
  renderContent();

  const nav_ = bottomNav('collection', {
    onCollection: () => nav({ name: 'collection' }),
    onPlay: () => nav({ name: 'hub' }),
    onShop: () => nav({ name: 'shop' }),
  });

  screen.append(top, loadout, tabsBar, content, nav_);
  host.append(screen);
  return { unmount() {} };
}

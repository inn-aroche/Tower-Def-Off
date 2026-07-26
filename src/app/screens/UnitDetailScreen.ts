import type { Screen, ScreenCtx } from '../Router';
import { clear, el } from '../../ui/dom';
import { RARITY_EDGE, RARITY_GRAD } from '../../ui/theme';
import { abilityLabel, UNITS_BY_ID } from '../../data/units';
import { META_MAX_LEVEL, metaScale, RARITY_LABEL } from '../../data/meta';
import { currencyPills, unitPortrait } from './common';

export function UnitDetailScreen(ctx: ScreenCtx): Screen {
  const { app, nav, route } = ctx;
  const unitId = route.name === 'unit' ? route.unitId : '';
  const def = UNITS_BY_ID.get(unitId);
  const screen = el('div', { class: 'screen' });

  if (!def) {
    screen.append(el('div', { class: 'topbar' }, [el('div', { class: 'topbar__title', text: 'Unité inconnue' })]));
    ctx.host.append(screen);
    return { unmount() {} };
  }

  const currencyHolder = el('div', { style: 'display:flex' });
  const top = el('div', { class: 'topbar' }, [
    el('button', { class: 'topbar__back', text: '‹', onclick: () => nav({ name: 'collection' }) }),
    el('div', { class: 'topbar__title', text: def.name }),
    currencyHolder,
  ]);
  const scroll = el('div', { class: 'screen__scroll', style: 'padding:14px' });
  screen.append(top, scroll);
  ctx.host.append(screen);

  const statRow = (label: string, cur: number, next: number, unit: string, max: number, color: string) => {
    const changed = Math.abs(next - cur) > 1e-6;
    return el('div', { style: 'margin-bottom:10px' }, [
      el('div', { style: 'display:flex;justify-content:space-between;font:700 11px "Nunito";color:var(--ink-soft);margin-bottom:3px' }, [
        el('span', { text: label }),
        el('span', {
          html: changed
            ? `${fmt(cur)}${unit} <span style="color:#2e7d32">→ ${fmt(next)}${unit}</span>`
            : `${fmt(cur)}${unit}`,
        }),
      ]),
      el('div', { class: 'bar' }, [
        el('div', { class: 'bar__fill', style: `width:${Math.min(100, (cur / max) * 100)}%;background:${color}` }),
      ]),
    ]);
  };

  const render = () => {
    clear(currencyHolder);
    currencyHolder.append(currencyPills(app));
    clear(scroll);
    const owned = app.owned(def.id)!;
    const level = owned.level;
    const cur = metaScale(level);
    const nxt = metaScale(Math.min(META_MAX_LEVEL, level + 1));
    const base = def.levels[0];

    // Hero tile + level pips
    const hero = el('div', { style: 'display:flex;flex-direction:column;align-items:center;gap:8px;margin-bottom:12px' }, [
      el('div', {
        style: `width:110px;height:110px;border-radius:20px;background:${RARITY_GRAD[def.rarity]};border-bottom:7px solid ${RARITY_EDGE[def.rarity]};box-shadow:inset 0 3px 0 rgba(255,255,255,.5);display:flex;align-items:center;justify-content:center`,
      }, [unitPortrait(def, 92)]),
      el('div', { style: 'display:flex;gap:5px' }, pipRow(level)),
      el('div', { style: 'font:800 14px "Baloo 2";color:var(--ink)', text: `Niveau ${level} · ${RARITY_LABEL[def.rarity]}` }),
      // Role is the first thing that changes how you play the card, so it sits right under the title.
      el('div', {
        style:
          `margin-top:6px;display:inline-block;padding:4px 10px;border-radius:10px;font:800 11px "Baloo 2";` +
          (def.role === 'offense'
            ? 'background:#c0392b;color:#fff'
            : 'background:rgba(0,0,0,.10);color:var(--ink-soft)'),
        text: def.role === 'offense' ? '⚔ Offensive — remonte le chemin' : '⛨ Défensive — se pose sur une case',
      }),
    ]);

    // Stats
    const statsPanel = el('div', { class: 'panel', style: 'margin-bottom:12px' });
    if (def.family === 'gravity') {
      statsPanel.append(
        statRow('Ralentissement', (1 - base.slowFactor) * 100, (1 - base.slowFactor) * 100, ' %', 100, 'linear-gradient(90deg,#1aa39a,#8fe0da)'),
        statRow('Portée', base.range * cur.rangeMult, base.range * nxt.rangeMult, ' cases', 6, 'linear-gradient(90deg,#4a90c4,#a3cdf0)'),
      );
    } else {
      statsPanel.append(
        statRow('Attaque', base.damage * cur.damageMult, base.damage * nxt.damageMult, '', 80, 'linear-gradient(90deg,#e74c3c,#f0a3a3)'),
        statRow('Cadence', 1 / base.attackIntervalSec, 1 / base.attackIntervalSec, ' /s', 2.5, 'linear-gradient(90deg,#4caf50,#a3e0a3)'),
        statRow('Portée', base.range * cur.rangeMult, base.range * nxt.rangeMult, ' cases', 6, 'linear-gradient(90deg,#4a90c4,#a3cdf0)'),
      );
    }

    // Upgrade panel
    const cost = app.upgradeCostFor(def.id);
    const upgradeBlock = el('div', {});
    if (cost) {
      const canUp = app.canUpgrade(def.id);
      const costRow = el('div', { style: 'display:flex;align-items:center;gap:14px;margin-top:8px;font:700 12px "Baloo 2"' }, [
        el('div', { style: 'display:flex;align-items:center;gap:5px;color:var(--gold-ink)' }, [
          el('span', { class: 'coin' }),
          el('span', { text: `${cost.gold}`, style: app.gold >= cost.gold ? '' : 'color:#c0392b' }),
        ]),
      ]);
      if (cost.shards > 0) {
        costRow.append(
          el('div', { style: 'display:flex;align-items:center;gap:5px;color:#12756e' }, [
            el('span', { style: 'width:11px;height:11px;transform:rotate(45deg);border-radius:2px;background:linear-gradient(135deg,#7fe3da,#1aa39a);border:1px solid #12756e' }),
            el('span', { text: `${cost.shards}`, style: app.shards >= cost.shards ? '' : 'color:#c0392b' }),
          ]),
        );
      }
      const missing: string[] = [];
      if (owned.duplicates < cost.duplicates) missing.push('cartes');
      if (app.gold < cost.gold) missing.push('or');
      if (cost.shards > 0 && app.shards < cost.shards) missing.push('éclats');
      upgradeBlock.append(
        el('div', { class: 'section-label', style: 'margin:4px 0 6px', text: `Améliorer vers niveau ${level + 1}` }),
        el('div', { class: 'panel', style: 'margin-bottom:12px' }, [
          progressLine('Cartes', owned.duplicates, cost.duplicates, 'linear-gradient(90deg,#9b59b6,#d9b3f0)'),
          costRow,
        ]),
        el('button', {
          class: `btn ${canUp ? 'btn--green' : ''}`,
          style: 'width:100%',
          text: canUp ? 'Améliorer' : `Manque : ${missing.join(', ')}`,
          onclick: () => {
            if (app.upgrade(def.id) !== null) render();
          },
          ...(canUp ? {} : { disabled: true }),
        }),
      );
    } else {
      upgradeBlock.append(
        el('div', { class: 'panel', style: 'margin-bottom:12px;text-align:center;font:800 13px "Baloo 2";color:var(--ink-soft)', text: 'Niveau maximum atteint' }),
      );
    }

    // Deck toggle
    const inDeck = app.isInDeck(def.id);
    const deckBtn = el('button', {
      class: `btn ${inDeck ? 'btn--gold' : 'btn--purple'}`,
      style: 'width:100%;margin-top:4px',
      text: inDeck ? 'Retirer du deck' : 'Ajouter au deck',
      onclick: () => {
        const res = app.toggleDeck(def.id);
        if (!res.ok) {
          const msg = res.reason === 'too-many' ? 'Deck plein (max 5)' : res.reason === 'too-few' ? 'Deck minimum 4' : 'Non possédée';
          const t = el('div', { text: msg, style: 'text-align:center;color:#c0392b;font:700 11px "Nunito";margin-top:6px' });
          deckBtn.after(t);
          setTimeout(() => t.remove(), 1400);
          return;
        }
        render();
      },
    });

    const ability = abilityLabel(def);
    const abilityPanel = ability
      ? el('div', { class: 'panel', style: 'margin-bottom:12px;border:1.5px solid var(--gold-edge)' }, [
          el('div', { style: 'font:800 13px "Baloo 2";color:var(--gold-ink);margin-bottom:2px', text: ability.title }),
          el('div', { style: 'font:600 12px "Nunito";color:var(--ink-soft)', text: ability.text }),
        ])
      : el('span', {});

    scroll.append(hero, statsPanel, abilityPanel, upgradeBlock, deckBtn);
  };

  render();
  return { unmount() {} };
}

function fmt(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

function pipRow(level: number): HTMLElement[] {
  return Array.from({ length: META_MAX_LEVEL }, (_, i) =>
    el('div', {
      style:
        `width:13px;height:13px;transform:rotate(45deg);border-radius:2px;` +
        (i < level
          ? 'background:linear-gradient(135deg,#fbe08a,#e8b923 60%,#a9780f);box-shadow:0 1px 1px rgba(0,0,0,.3)'
          : 'background:#cbbf9e'),
    }),
  );
}

function progressLine(label: string, have: number, need: number, color: string): HTMLElement {
  return el('div', {}, [
    el('div', { style: 'display:flex;justify-content:space-between;font:700 11px "Nunito";color:var(--ink-soft);margin-bottom:3px' }, [
      el('span', { text: label }),
      el('span', { text: `${have} / ${need}` }),
    ]),
    el('div', { class: 'bar' }, [el('div', { class: 'bar__fill', style: `width:${Math.min(100, (have / need) * 100)}%;background:${color}` })]),
  ]);
}

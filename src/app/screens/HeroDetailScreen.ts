import type { Screen, ScreenCtx } from '../Router';
import { el } from '../../ui/dom';
import { RARITY_EDGE, RARITY_GRAD } from '../../ui/theme';
import { RARITY_LABEL } from '../../data/meta';
import { HERO_MAX_LEVEL, HEROES_BY_ID, scaleHeroConfig } from '../../data/heroes';
import { currencyPills, toast } from './common';

/** Full hero sheet — every characteristic, plus activate + promote. */
export function HeroDetailScreen(ctx: ScreenCtx): Screen {
  const { app, host, nav, route } = ctx;
  const heroId = route.name === 'hero' ? route.heroId : '';
  const def = HEROES_BY_ID.get(heroId);
  const screen = el('div', { class: 'screen' });

  if (!def) {
    nav({ name: 'heroes' });
    return { unmount() {} };
  }

  const pills = el('div', {}, [currencyPills(app)]);
  const top = el('div', { class: 'topbar' }, [
    el('button', { class: 'topbar__back', text: '‹', onclick: () => nav({ name: 'heroes' }) }),
    el('div', { class: 'topbar__title', text: def.name }),
    pills,
  ]);
  const scroll = el('div', { class: 'screen__scroll', style: 'padding:14px' });
  screen.append(top, scroll);
  host.append(screen);

  const statRow = (label: string, value: string) =>
    el('div', { style: 'display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(0,0,0,.06)' }, [
      el('span', { style: 'font:700 12px "Nunito";color:var(--ink-soft)', text: label }),
      el('span', { style: 'font:800 13px "Baloo 2";color:var(--ink)', text: value }),
    ]);

  function render(): void {
    pills.replaceChildren(currencyPills(app));
    scroll.replaceChildren();
    const owned = app.isHeroOwned(def!.id);
    const level = owned ? app.heroLevel(def!.id) : 1;
    const cfg = scaleHeroConfig(def!, level);
    const active = app.activeHeroId === def!.id;

    // Header portrait.
    scroll.append(
      el('div', { style: 'display:flex;flex-direction:column;align-items:center;gap:8px;margin-bottom:14px' }, [
        el('div', { style: `width:110px;height:110px;border-radius:22px;background:${RARITY_GRAD[def!.rarity]};border-bottom:7px solid ${RARITY_EDGE[def!.rarity]};display:flex;align-items:center;justify-content:center;font-size:56px`, text: owned ? '🦸' : '🔒' }),
        el('div', { style: 'font:800 15px "Baloo 2";color:var(--ink)', text: `${RARITY_LABEL[def!.rarity]}${owned ? ` · Niveau ${level}` : ''}` }),
      ]),
    );

    // Power.
    scroll.append(
      el('div', { class: 'panel', style: 'margin-bottom:12px;border:1.5px solid var(--gold-edge)' }, [
        el('div', { style: 'font:800 13px "Baloo 2";color:var(--gold-ink);margin-bottom:2px', text: '⭐ Pouvoir signature' }),
        el('div', { style: 'font:600 12px "Nunito";color:var(--ink-soft)', text: def!.powerText }),
      ]),
    );

    // Full characteristics.
    scroll.append(
      el('div', { class: 'panel', style: 'margin-bottom:12px' }, [
        el('div', { class: 'section-label', style: 'margin-bottom:4px', text: 'Caractéristiques' }),
        statRow('Points de vie', `${cfg.maxHp}`),
        statRow('Dégâts', `${cfg.damage}`),
        statRow('Cadence', `${(1 / cfg.attackIntervalSec).toFixed(1)} /s`),
        statRow('Portée', `${cfg.range} cases`),
        statRow('Vitesse de marche', `${cfg.marchSpeed} c/s`),
        statRow('Durée sur le terrain', `${cfg.durationSec} s`),
        statRow('Recharge', `${cfg.rechargeSec} s`),
      ]),
    );

    if (!owned) {
      scroll.append(el('div', { class: 'panel', style: 'text-align:center;font:700 12px "Nunito";color:var(--ink-soft)', text: 'Trouve ses cartes dans les coffres pour le débloquer.' }));
      return;
    }

    // Activate.
    scroll.append(
      active
        ? el('div', { class: 'btn btn--gold', style: 'width:100%;text-align:center;cursor:default;margin-bottom:10px', text: '✓ Héros actif' })
        : el('button', { class: 'btn btn--purple', style: 'width:100%;margin-bottom:10px', text: 'Définir comme héros actif', onclick: () => { app.selectHero(def!.id); render(); } }),
    );

    // Promote.
    const cost = app.heroPromoteCostFor(def!.id);
    if (cost) {
      const canPromote = app.canPromoteHero(def!.id);
      const cards = app.heroCards(def!.id);
      const missing: string[] = [];
      if (cards < cost.cards) missing.push('cartes');
      if (app.gold < cost.gold) missing.push('or');
      scroll.append(
        el('div', { class: 'panel', style: 'margin-bottom:10px' }, [
          el('div', { class: 'section-label', style: 'margin-bottom:6px', text: `Promouvoir vers niveau ${level + 1}` }),
          el('div', { class: 'bar' }, [el('div', { class: 'bar__fill', style: `width:${Math.min(100, (cards / cost.cards) * 100)}%;background:linear-gradient(90deg,#9b59b6,#d9b3f0)` })]),
          el('div', { style: 'display:flex;justify-content:space-between;margin-top:4px;font:700 11px "Nunito"' }, [
            el('span', { style: 'color:var(--ink-soft)', text: `🃏 ${cards} / ${cost.cards} cartes` }),
            el('span', { style: `color:${app.gold >= cost.gold ? 'var(--gold-ink)' : '#c0392b'}`, text: `${cost.gold} or` }),
          ]),
        ]),
        el('button', {
          class: `btn ${canPromote ? 'btn--green' : ''}`,
          style: 'width:100%',
          text: canPromote ? 'Promouvoir' : `Manque : ${missing.join(', ')}`,
          ...(canPromote ? {} : { disabled: true }),
          onclick: () => {
            if (app.promoteHero(def!.id) !== null) {
              toast(host, `${def!.name} promu !`);
              render();
            }
          },
        }),
      );
    } else {
      scroll.append(el('div', { class: 'panel', style: 'text-align:center;font:800 13px "Baloo 2";color:var(--green-edge)', text: `Niveau maximum (${HERO_MAX_LEVEL}) atteint` }));
    }
  }

  render();
  return { unmount() {} };
}

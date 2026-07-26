import type { Screen, ScreenCtx } from '../Router';
import { el } from '../../ui/dom';
import { RARITY_LABEL } from '../../data/meta';
import { HERO_MAX_LEVEL, scaleHeroConfig } from '../../data/heroes';
import { currencyPills, toast } from './common';

/**
 * Heroes screen — pick the active deployable hero and promote it (cards + gold). A hero is unlocked
 * once you collect its first card; each is a distinct playstyle (nova / frost / rally).
 */
export function HeroScreen(ctx: ScreenCtx): Screen {
  const { app, host, nav } = ctx;
  const screen = el('div', { class: 'screen' });

  const pills = el('div', {}, [currencyPills(app)]);
  const top = el('div', { class: 'topbar' }, [
    el('button', { class: 'topbar__back', text: '‹', onclick: () => nav({ name: 'collection' }) }),
    el('div', { class: 'topbar__title', text: 'Héros' }),
    pills,
  ]);

  const scroll = el('div', { class: 'screen__scroll', style: 'padding:12px 14px 24px;display:flex;flex-direction:column;gap:14px' });
  screen.append(top, scroll);
  host.append(screen);

  function render(): void {
    scroll.replaceChildren();
    pills.replaceChildren(currencyPills(app));

    for (const { def, owned, level, cards, active } of app.heroRoster()) {
      const cfg = owned ? scaleHeroConfig(def, level) : scaleHeroConfig(def, 1);
      const cost = owned ? app.heroPromoteCostFor(def.id) : null;
      const canPromote = owned && app.canPromoteHero(def.id);

      const card = el('div', {
        class: 'panel',
        style: `display:flex;flex-direction:column;gap:8px;${active ? 'outline:3px solid #f0c26a;outline-offset:-3px' : ''}${owned ? '' : ';opacity:.75'}`,
      });

      card.append(
        el('div', { style: 'display:flex;align-items:center;gap:12px' }, [
          el('div', { style: 'width:56px;height:56px;border-radius:14px;background:radial-gradient(circle at 50% 30%,#6a4a8c,#2b2b38);display:flex;align-items:center;justify-content:center;font-size:30px', text: owned ? '🦸' : '🔒' }),
          el('div', { style: 'flex:1' }, [
            el('div', { style: 'font:800 15px "Baloo 2";color:var(--ink)', text: `${def.name}${owned ? ` · Niv ${level}` : ''}` }),
            el('div', { style: 'font:700 10px "Nunito";color:var(--ink-soft)', text: `${RARITY_LABEL[def.rarity]} · ${def.powerText}` }),
          ]),
        ]),
        el('div', { style: 'display:flex;gap:14px;font:700 11px "Nunito";color:var(--ink-soft)' }, [
          el('span', { text: `❤ ${cfg.maxHp} PV` }),
          el('span', { text: `⚔ ${cfg.damage}` }),
          el('span', { text: `⏱ ${cfg.rechargeSec}s` }),
        ]),
      );

      if (owned) {
        const actions = el('div', { style: 'display:flex;gap:8px' });
        actions.append(
          active
            ? el('div', { class: 'btn btn--gold', style: 'flex:1;text-align:center;cursor:default', text: '✓ Actif' })
            : el('button', { class: 'btn btn--purple', style: 'flex:1', text: 'Activer', onclick: () => { app.selectHero(def.id); render(); } }),
        );
        if (cost) {
          actions.append(
            el('button', {
              class: `btn ${canPromote ? 'btn--green' : ''}`,
              style: 'flex:1.3',
              ...(canPromote ? {} : { disabled: true }),
              onclick: () => {
                if (app.promoteHero(def.id) !== null) {
                  toast(host, `${def.name} promu !`);
                  render();
                }
              },
            }, [
              el('div', { style: 'font-size:12px', text: 'Promouvoir' }),
              el('div', { style: 'font:700 9px "Nunito";display:flex;gap:8px;justify-content:center;margin-top:1px' }, [
                el('span', { text: `🃏 ${cards}/${cost.cards}`, style: cards >= cost.cards ? '' : 'color:#ffdede' }),
                el('span', { text: `· ${cost.gold}💰`, style: app.gold >= cost.gold ? '' : 'color:#ffdede' }),
              ]),
            ]),
          );
        } else {
          actions.append(el('div', { class: 'btn', style: 'flex:1.3;text-align:center;cursor:default;background:#cfc6b0;color:#8a7e63', text: `Max (Niv ${HERO_MAX_LEVEL})` }));
        }
        card.append(actions);
      } else {
        card.append(el('div', { style: 'font:700 11px "Nunito";color:var(--ink-soft);text-align:center', text: 'Trouve ses cartes dans les coffres pour le débloquer.' }));
      }

      scroll.append(card);
    }
  }

  render();
  return { unmount() {} };
}

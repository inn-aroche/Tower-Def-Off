import type { Screen, ScreenCtx } from '../Router';
import { el } from '../../ui/dom';
import { LEAGUES } from '../../data/arena';
import { currencyPills, sectionNav } from './common';

export function ArenaScreen(ctx: ScreenCtx): Screen {
  const { app, nav } = ctx;
  const screen = el('div', { class: 'screen' });
  const league = app.currentLeague();
  const trophies = app.trophies;
  const idx = LEAGUES.findIndex((l) => l.id === league.id);
  const next = LEAGUES[idx + 1];

  const top = el('div', { class: 'topbar' }, [
    el('div', { class: 'topbar__title', text: 'PvP' }),
    currencyPills(app),
  ]);

  // The section's promise in one line: the mixed hand means each duel is a stance choice.
  const stance = el('div', {
    style: 'margin:12px 14px 0;display:flex;gap:8px',
  }, [
    el('div', {
      style:
        'flex:1;padding:8px 10px;border-radius:12px;background:rgba(192,57,43,.12);border:1.5px solid #c0392b;' +
        'font:700 10px "Nunito",sans-serif;color:var(--ink);line-height:1.4',
      html: '<b>⚔ Attaque</b><br>Lance tes unités offensives : elles remontent le chemin et frappent avant la base.',
    }),
    el('div', {
      style:
        'flex:1;padding:8px 10px;border-radius:12px;background:rgba(0,0,0,.07);border:1.5px solid var(--panel-border);' +
        'font:700 10px "Nunito",sans-serif;color:var(--ink);line-height:1.4',
      html: '<b>⛨ Défense</b><br>Pose et fusionne sur tes emplacements limités pour tenir plus longtemps que l’adversaire.',
    }),
  ]);

  // Current league banner
  const banner = el('div', { class: 'panel', style: 'margin:14px;text-align:center' }, [
    el('div', { class: 'section-label', text: 'Ligue actuelle' }),
    el('div', { style: 'font:800 24px "Baloo 2",sans-serif;color:var(--ink);margin:4px 0', text: league.name }),
    el('div', { style: 'display:inline-flex;align-items:center;gap:6px;font:800 16px "Baloo 2";color:var(--gold-ink)' }, [
      el('span', { text: '🏆', style: 'font-size:18px' }),
      el('span', { text: String(trophies) }),
    ]),
    next
      ? el('div', { style: 'font:700 11px "Nunito";color:var(--ink-soft);margin-top:6px', text: `${next.minTrophies - trophies} trophées avant ${next.name}` })
      : el('div', { style: 'font:700 11px "Nunito";color:var(--ink-soft);margin-top:6px', text: 'Ligue maximale atteinte' }),
  ]);

  const fight = el('div', { style: 'display:flex;gap:10px;margin:12px 14px 14px' }, [
    el('button', {
      class: 'btn btn--green',
      style: 'flex:1;font-size:16px',
      text: `Combattre — ${league.botName}`,
      onclick: () => nav({ name: 'pvp' }),
    }),
    el('button', {
      class: 'btn btn--purple',
      style: 'flex:0 0 116px;font-size:16px',
      onclick: () => nav({ name: 'pvp', blitz: true }),
    }, [el('div', { text: '⚡ Blitz' }), el('div', { style: 'font:700 9px "Nunito";opacity:.85', text: 'mana rapide · boss' })]),
  ]);

  // Ladder
  const ladderLabel = el('div', { class: 'section-label', style: 'padding:6px 14px', text: 'Ligues' });
  const ladder = el('div', { class: 'screen__scroll', style: 'padding:4px 14px 16px;display:flex;flex-direction:column;gap:8px' });
  for (let i = LEAGUES.length - 1; i >= 0; i--) {
    const l = LEAGUES[i];
    const isCurrent = l.id === league.id;
    ladder.append(
      el('div', {
        class: 'panel',
        style: `display:flex;align-items:center;gap:10px;padding:10px 12px;${isCurrent ? 'outline:3px solid #f0c26a;outline-offset:-3px' : ''}`,
      }, [
        el('div', { style: 'font:800 15px "Baloo 2";color:var(--ink);flex:1', text: l.name }),
        el('div', { style: 'font:700 11px "Nunito";color:var(--ink-soft)', text: `${l.minTrophies}+ 🏆` }),
        isCurrent ? el('div', { style: 'font:800 10px "Baloo 2";color:var(--green-edge)', text: 'ICI' }) : el('span', {}),
      ]),
    );
  }

  screen.append(top, banner, stance, fight, ladderLabel, ladder, sectionNav('pvp', nav));
  ctx.host.append(screen);
  return { unmount() {} };
}

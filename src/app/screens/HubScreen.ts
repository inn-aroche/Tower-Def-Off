import type { Screen, ScreenCtx } from '../Router';
import { el } from '../../ui/dom';
import { CAMPAIGN } from '../../data/campaign';
import { bottomNav, currencyPills, starRow, toast } from './common';

export function HubScreen(ctx: ScreenCtx): Screen {
  const { app, host, nav } = ctx;

  const screen = el('div', { class: 'screen' });

  // Top bar
  const top = el('div', { class: 'topbar' }, [
    el('div', { class: 'topbar__title', text: 'WARDENS' }),
    currencyPills(app),
    el('button', {
      class: 'topbar__back',
      text: '⚙',
      style: 'background:rgba(255,255,255,.14);color:#fff',
      onclick: () => nav({ name: 'settings' }),
    }),
  ]);

  // Event banner + deck / arena access
  const header = el('div', { style: 'padding:12px 14px 4px;display:flex;gap:10px;align-items:stretch' }, [
    el('div', { class: 'panel', style: 'flex:1;padding:10px 12px' }, [
      el('div', { class: 'section-label', text: 'Événement' }),
      el('div', { style: 'font:800 14px "Baloo 2",sans-serif;color:var(--ink)', text: 'Invasion des Trolls' }),
    ]),
    el('div', { style: 'display:flex;flex-direction:column;gap:6px' }, [
      el('button', { class: 'btn btn--purple', style: 'padding:8px 14px;font-size:12px', onclick: () => nav({ name: 'deck' }) }, [
        el('div', { text: '🃏 Deck' }),
      ]),
      el('button', { class: 'btn btn--gold', style: 'padding:8px 14px;font-size:12px', onclick: () => nav({ name: 'arena' }) }, [
        el('div', { text: `⚔ Arène · ${app.trophies}🏆` }),
      ]),
    ]),
  ]);

  // Node map (scrollable)
  const scroll = el('div', { class: 'screen__scroll', style: 'padding:10px 0 20px' });
  const map = el('div', { style: 'position:relative;display:flex;flex-direction:column-reverse;gap:22px;padding:16px 0;align-items:center' });

  CAMPAIGN.forEach((node) => {
    const unlocked = app.isNodeUnlocked(node.index);
    const stars = app.starsFor(node.index);
    const done = stars > 0;
    const offset = (node.index % 2 === 0 ? -1 : 1) * 64;

    const bg = done
      ? 'linear-gradient(180deg,#f5d576,#e8b923)'
      : unlocked
        ? 'linear-gradient(180deg,#82e07a,#4caf50)'
        : '#b9a688';
    const edge = done ? '#a9780f' : unlocked ? '#2e7d32' : '#7d6c50';

    const circle = el('button', {
      style:
        `width:58px;height:58px;border-radius:50%;border:none;cursor:${unlocked ? 'pointer' : 'default'};` +
        `background:${bg};border-bottom:5px solid ${edge};box-shadow:0 0 0 5px rgba(255,255,255,.45),inset 0 2px 0 rgba(255,255,255,.5);` +
        `color:#fff;font:800 20px "Baloo 2",sans-serif;display:flex;align-items:center;justify-content:center`,
      text: unlocked ? String(node.index + 1) : '🔒',
      onclick: () => {
        if (!unlocked) return toast(host, 'Nœud verrouillé — termine le précédent');
        nav({ name: 'combat', nodeIndex: node.index });
      },
    });

    const cell = el('div', { style: `display:flex;flex-direction:column;align-items:center;gap:4px;transform:translateX(${offset}px)` }, [
      circle,
    ]);
    if (unlocked) cell.append(starRow(stars, 3, 12));
    map.append(cell);
  });

  scroll.append(map);

  const nav_ = bottomNav('play', {
    onCollection: () => nav({ name: 'collection' }),
    onPlay: () => nav({ name: 'combat', nodeIndex: app.unlockedNode }),
    onShop: () => nav({ name: 'shop' }),
  });

  screen.append(top, header, scroll, nav_);
  host.append(screen);

  // Scroll so the current node is in view.
  requestAnimationFrame(() => {
    scroll.scrollTop = scroll.scrollHeight;
  });

  return { unmount() {} };
}

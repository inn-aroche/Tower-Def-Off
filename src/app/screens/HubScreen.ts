import type { Screen, ScreenCtx } from '../Router';
import { el } from '../../ui/dom';
import { CAMPAIGN } from '../../data/campaign';
import { todayStr } from '../../data/progression';
import { currencyPills, sectionNav, starRow, toast } from './common';

export function HubScreen(ctx: ScreenCtx): Screen {
  const { app, host, nav } = ctx;

  const screen = el('div', { class: 'screen' });

  // Défis button — shows a red dot when a chest/quest/achievement can be claimed.
  const challengesBtn = el('button', {
    class: 'topbar__back',
    text: '🎯',
    style: 'background:rgba(255,255,255,.14);color:#fff;position:relative',
    onclick: () => nav({ name: 'challenges' }),
  });
  if (app.hasClaimable(todayStr())) {
    challengesBtn.append(
      el('span', { style: 'position:absolute;top:-2px;right:-2px;width:11px;height:11px;border-radius:50%;background:#e74c3c;border:2px solid #2b1e14' }),
    );
  }

  // Top bar
  const top = el('div', { class: 'topbar' }, [
    el('div', { class: 'topbar__title', text: 'Aventure' }),
    currencyPills(app),
    challengesBtn,
    el('button', {
      class: 'topbar__back',
      text: '⚙',
      style: 'background:rgba(255,255,255,.14);color:#fff',
      onclick: () => nav({ name: 'settings' }),
    }),
  ]);

  // Progress strip — Survie and PvP moved to their own nav tabs, so this row keeps the saga's own state.
  const cleared = app.totalStars();
  const header = el('div', { style: 'padding:12px 14px 4px' }, [
    el('div', { class: 'panel', style: 'display:flex;align-items:center;gap:12px;padding:10px 14px' }, [
      el('div', { style: 'font-size:24px', text: '🗺' }),
      el('div', { style: 'flex:1' }, [
        el('div', { class: 'section-label', text: 'Saga' }),
        el('div', {
          style: 'font:800 14px "Baloo 2",sans-serif;color:var(--ink)',
          text: `Nœud ${Math.min(app.unlockedNode + 1, CAMPAIGN.length)} / ${CAMPAIGN.length}`,
        }),
      ]),
      el('div', { style: 'font:800 14px "Baloo 2",sans-serif;color:var(--gold-ink)', text: `${cleared} ★` }),
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

  screen.append(top, header, scroll, sectionNav('aventure', nav));
  host.append(screen);

  // Scroll so the current node is in view.
  requestAnimationFrame(() => {
    scroll.scrollTop = scroll.scrollHeight;
  });

  return { unmount() {} };
}

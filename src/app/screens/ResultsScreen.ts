import type { Screen, ScreenCtx } from '../Router';
import { el } from '../../ui/dom';
import { UNITS_BY_ID } from '../../data/units';
import { starRow, unitPortrait } from './common';
import type { UnitDef } from '../../sim/types';

export function ResultsScreen(ctx: ScreenCtx): Screen {
  const { nav, route } = ctx;
  const payload = route.name === 'results' ? route.payload : null;
  const screen = el('div', { class: 'screen' });

  if (!payload) {
    nav({ name: 'hub' });
    return { unmount() {} };
  }

  const win = payload.outcome === 'victory';
  screen.setAttribute(
    'style',
    win
      ? 'background:radial-gradient(circle at 50% 32%,#f0c26a 0%,#c98f3e 36%,#5c3d0a 100%)'
      : 'background:radial-gradient(circle at 50% 32%,#7d5a5a 0%,#4a2222 45%,#2b1414 100%)',
  );

  const title = el('div', {
    text: win ? 'VICTOIRE !' : 'DÉFAITE',
    style: `margin-top:110px;text-align:center;font:800 30px "Baloo 2";color:#fff;text-shadow:0 3px 0 ${win ? '#a9780f' : '#3a1a1a'},0 6px 10px rgba(0,0,0,.35)`,
  });

  const body = el('div', { style: 'flex:1;display:flex;flex-direction:column;align-items:center;gap:16px;padding:20px 24px' });

  if (win) {
    body.append(el('div', { style: 'margin-top:12px' }, [starRow(payload.stars, 3, 30)]));

    const rewardCards = el('div', { style: 'display:flex;gap:14px;justify-content:center;flex-wrap:wrap' });
    rewardCards.append(rewardCard('coin', `+${payload.rewards.gold}`, 'linear-gradient(160deg,#f5d576,#e8b923)', '#a9780f'));
    if (payload.rewards.gems > 0) rewardCards.append(rewardCard('gem', `+${payload.rewards.gems}`, 'linear-gradient(160deg,#d9b3f0,#9b59b6)', '#6c3483'));
    for (const d of payload.rewards.duplicates) {
      const def = UNITS_BY_ID.get(d.unitId);
      if (def) rewardCards.append(dupCard(def, d.count));
    }

    const panel = el('div', {
      class: 'panel',
      style: 'width:100%;max-width:300px;margin-top:8px',
    }, [
      el('div', { class: 'section-label', style: 'text-align:center;margin-bottom:12px', text: 'Récompenses' }),
      rewardCards,
    ]);
    body.append(panel);
  } else {
    body.append(el('div', { style: 'color:#f0d9c0;font:700 13px "Nunito";text-align:center;max-width:280px', text: 'Ta base est tombée. Améliore tes unités ou ajuste ton deck, puis retente.' }));
  }

  const actions = el('div', { style: 'width:100%;display:flex;flex-direction:column;gap:10px;padding:0 24px 40px' }, [
    el('button', {
      class: 'btn btn--green',
      style: 'width:100%',
      text: win ? 'Continuer' : 'Réessayer',
      onclick: () => (win ? nav({ name: 'hub' }) : nav({ name: 'combat', nodeIndex: payload.nodeIndex })),
    }),
    el('button', {
      style: 'background:none;border:none;color:#f0e0c0;font:700 12px "Nunito";cursor:pointer;padding:6px',
      text: win ? 'Rejouer le nœud' : 'Retour au hub',
      onclick: () => (win ? nav({ name: 'combat', nodeIndex: payload.nodeIndex }) : nav({ name: 'hub' })),
    }),
  ]);

  screen.append(title, body, actions);
  ctx.host.append(screen);
  return { unmount() {} };
}

function rewardCard(kind: 'coin' | 'gem', label: string, bg: string, edge: string): HTMLElement {
  const icon = kind === 'coin'
    ? el('div', { style: 'width:22px;height:22px;border-radius:50%;background:radial-gradient(circle at 32% 28%,#fff6d9,#fbe08a 60%,#e8b923)' })
    : el('div', { style: 'width:18px;height:18px;transform:rotate(45deg);border-radius:3px;background:rgba(255,255,255,.95)' });
  return el('div', { style: 'display:flex;flex-direction:column;align-items:center;gap:4px' }, [
    el('div', { style: `width:52px;height:52px;border-radius:12px;background:${bg};border-bottom:4px solid ${edge};display:flex;align-items:center;justify-content:center` }, [icon]),
    el('span', { style: 'font:800 11px "Baloo 2";color:var(--ink)', text: label }),
  ]);
}

function dupCard(def: UnitDef, count: number): HTMLElement {
  return el('div', { style: 'display:flex;flex-direction:column;align-items:center;gap:4px' }, [
    el('div', { style: 'width:52px;height:52px;border-radius:12px;background:linear-gradient(160deg,#8ecae6,#4a90c4);border-bottom:4px solid #2f6690;display:flex;align-items:center;justify-content:center' }, [unitPortrait(def, 44)]),
    el('span', { style: 'font:800 10px "Baloo 2";color:var(--ink);text-align:center', text: `+${count} ${def.name}` }),
  ]);
}

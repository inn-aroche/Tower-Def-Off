import type { Screen, ScreenCtx } from '../Router';
import { el } from '../../ui/dom';

export function PvpResultsScreen(ctx: ScreenCtx): Screen {
  const { nav, route } = ctx;
  const payload = route.name === 'pvpResults' ? route.payload : null;
  const screen = el('div', { class: 'screen' });
  if (!payload) {
    nav({ name: 'arena' });
    return { unmount() {} };
  }

  const win = payload.outcome === 'victory';
  const draw = payload.outcome === 'draw';
  const bg = win
    ? 'radial-gradient(circle at 50% 32%,#f0c26a 0%,#c98f3e 36%,#5c3d0a 100%)'
    : draw
      ? 'radial-gradient(circle at 50% 32%,#9c8f6a 0%,#6b5c3a 45%,#2b2414 100%)'
      : 'radial-gradient(circle at 50% 32%,#7d5a5a 0%,#4a2222 45%,#2b1414 100%)';
  screen.setAttribute('style', bg);

  const title = win ? 'VICTOIRE !' : draw ? 'ÉGALITÉ' : 'DÉFAITE';
  const titleColor = win ? '#fff' : draw ? '#f0e0c0' : '#fff';

  const head = el('div', {
    text: title,
    style: `margin-top:110px;text-align:center;font:800 30px "Baloo 2";color:${titleColor};text-shadow:0 3px 0 rgba(0,0,0,.35),0 6px 10px rgba(0,0,0,.35)`,
  });

  const body = el('div', { style: 'flex:1;display:flex;flex-direction:column;align-items:center;gap:18px;padding:24px' }, [
    // Life comparison
    el('div', { style: 'display:flex;align-items:center;gap:16px;margin-top:10px' }, [
      lifeCol('Toi', payload.playerLife, '#2ecc71'),
      el('div', { style: 'font:800 18px "Baloo 2";color:#fff', text: 'VS' }),
      lifeCol(payload.botName, payload.botLife, '#e74c3c'),
    ]),
    // Trophies
    el('div', { class: 'panel', style: 'text-align:center;min-width:200px' }, [
      el('div', { class: 'section-label', text: `Ligue ${payload.leagueName}` }),
      el('div', {
        style: `font:800 26px "Baloo 2";margin:4px 0;color:${payload.trophiesDelta >= 0 ? '#2e7d32' : '#c0392b'}`,
        text: `${payload.trophiesDelta >= 0 ? '+' : ''}${payload.trophiesDelta} 🏆`,
      }),
      el('div', { style: 'font:700 12px "Nunito";color:var(--ink-soft)', text: `Total : ${payload.totalTrophies}` }),
    ]),
  ]);

  const actions = el('div', { style: 'width:100%;display:flex;flex-direction:column;gap:10px;padding:0 24px 40px' }, [
    el('button', { class: 'btn btn--green', style: 'width:100%', text: 'Rejouer', onclick: () => nav({ name: 'pvp' }) }),
    el('button', { style: 'background:none;border:none;color:#f0e0c0;font:700 12px "Nunito";cursor:pointer;padding:6px', text: "Retour à l'arène", onclick: () => nav({ name: 'arena' }) }),
  ]);

  screen.append(head, body, actions);
  ctx.host.append(screen);
  return { unmount() {} };
}

function lifeCol(name: string, life: number, color: string): HTMLElement {
  return el('div', { style: 'display:flex;flex-direction:column;align-items:center;gap:6px;min-width:90px' }, [
    el('div', { style: 'font:700 11px "Nunito";color:#fff;text-align:center', text: name }),
    el('div', { style: `font:800 30px "Baloo 2";color:${color}`, text: `❤ ${Math.max(0, life)}` }),
  ]);
}

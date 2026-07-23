import type { Screen, ScreenCtx } from '../Router';
import { el } from '../../ui/dom';

export function SurvivalResultsScreen(ctx: ScreenCtx): Screen {
  const { nav, route, host } = ctx;
  const payload = route.name === 'survivalResults' ? route.payload : null;
  const screen = el('div', { class: 'screen' });

  if (!payload) {
    nav({ name: 'hub' });
    return { unmount() {} };
  }

  screen.setAttribute('style', 'background:radial-gradient(circle at 50% 30%,#3a6a8f 0%,#1f3d55 45%,#12212e 100%)');

  const title = el('div', {
    text: payload.isRecord ? 'NOUVEAU RECORD !' : 'SUBMERGÉ',
    style: `margin-top:96px;text-align:center;font:800 ${payload.isRecord ? 26 : 30}px "Baloo 2";color:#fff;text-shadow:0 3px 0 #0e2233,0 6px 10px rgba(0,0,0,.35)`,
  });

  const body = el('div', { style: 'flex:1;display:flex;flex-direction:column;align-items:center;gap:16px;padding:24px' });

  // Big wave number reached.
  body.append(
    el('div', { style: 'display:flex;flex-direction:column;align-items:center;gap:2px;margin-top:6px' }, [
      el('div', { style: 'font:800 13px "Nunito";color:#bfe0f5;letter-spacing:1px', text: 'VAGUE ATTEINTE' }),
      el('div', { style: 'font:800 64px "Baloo 2";color:#fff;line-height:1;text-shadow:0 3px 0 #0e2233', text: `🌊 ${payload.wavesReached}` }),
      el('div', {
        style: 'font:700 12px "Nunito";color:#9fc7e0',
        text: payload.isRecord ? 'Ton meilleur score !' : `Record : vague ${payload.bestWave}`,
      }),
    ]),
  );

  // Stat + reward panel.
  const stat = (label: string, value: string) =>
    el('div', { style: 'display:flex;flex-direction:column;align-items:center;gap:2px;flex:1' }, [
      el('div', { style: 'font:800 20px "Baloo 2";color:#fff', text: value }),
      el('div', { style: 'font:700 10px "Nunito";color:#9fc7e0;text-transform:uppercase;letter-spacing:.5px', text: label }),
    ]);

  const panel = el('div', { class: 'panel', style: 'width:100%;max-width:320px;display:flex;flex-direction:column;gap:14px' }, [
    el('div', { style: 'display:flex;gap:8px' }, [
      stat('Éliminations', String(payload.kills)),
      stat('Or', `+${payload.rewards.gold}`),
      stat('Gemmes', `+${payload.rewards.gems}`),
    ]),
  ]);
  body.append(panel);

  const actions = el('div', { style: 'width:100%;display:flex;flex-direction:column;gap:10px;padding:0 24px 40px' }, [
    el('button', { class: 'btn btn--green', style: 'width:100%', text: 'Rejouer', onclick: () => nav({ name: 'survival' }) }),
    el('button', {
      style: 'background:none;border:none;color:#cfe6f5;font:700 12px "Nunito";cursor:pointer;padding:6px',
      text: 'Retour au hub',
      onclick: () => nav({ name: 'hub' }),
    }),
  ]);

  screen.append(title, body, actions);
  host.append(screen);
  return { unmount() {} };
}

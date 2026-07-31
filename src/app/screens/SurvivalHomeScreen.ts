import type { Screen, ScreenCtx } from '../Router';
import { el } from '../../ui/dom';
import { currencyPills, sectionNav } from './common';

/**
 * The Survie section. A landing screen rather than a direct jump into a run: Survie is now a
 * bottom-nav tab, and a mistap must never drop the player into a combat they can't undo.
 */
export function SurvivalHomeScreen(ctx: ScreenCtx): Screen {
  const { app, nav } = ctx;
  const screen = el('div', { class: 'screen' });
  const best = app.survivalBest;

  const top = el('div', { class: 'topbar' }, [
    el('div', { class: 'topbar__title', text: 'Survie' }),
    currencyPills(app),
  ]);

  const hero = el('div', {
    class: 'panel',
    style: 'margin:14px;padding:22px 16px;text-align:center;background:linear-gradient(160deg,#3a6a8f,#1f3d55);border:none',
  }, [
    el('div', { style: 'font-size:52px;line-height:1', text: '🌊' }),
    el('div', { style: 'font:800 22px "Baloo 2",sans-serif;color:#fff;margin-top:8px', text: 'Vagues sans fin' }),
    el('div', {
      style: 'font:700 12px "Nunito",sans-serif;color:#bfe0f5;margin-top:6px;line-height:1.5',
      text: 'Résiste le plus longtemps possible. Les vagues montent sans s’arrêter — ici, aucun plafond d’emplacements : tout se joue sur la vitesse à laquelle tu remplis et fusionnes le plateau.',
    }),
  ]);

  const record = el('div', { class: 'panel', style: 'margin:0 14px 14px;display:flex;align-items:center;gap:12px;padding:12px 14px' }, [
    el('div', { style: 'font-size:26px', text: '🏅' }),
    el('div', { style: 'flex:1' }, [
      el('div', { class: 'section-label', text: 'Meilleur score' }),
      el('div', {
        style: 'font:800 17px "Baloo 2",sans-serif;color:var(--ink)',
        text: best > 0 ? `Vague ${best}` : 'Aucun record — à toi de jouer',
      }),
    ]),
  ]);

  const play = el('button', {
    class: 'btn btn--green',
    style: 'margin:0 14px;width:calc(100% - 28px);font-size:18px',
    text: 'Lancer une partie',
    onclick: () => nav({ name: 'survival' }),
  });

  screen.append(top, hero, record, play, el('div', { style: 'flex:1' }), sectionNav('survie', nav));
  ctx.host.append(screen);
  return { unmount() {} };
}

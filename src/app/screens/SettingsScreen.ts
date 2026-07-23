import type { Screen, ScreenCtx } from '../Router';
import { el } from '../../ui/dom';
import { SAVE_SCHEMA_VERSION } from '../../meta/SaveData';

export function SettingsScreen(ctx: ScreenCtx): Screen {
  const { app, host, nav } = ctx;
  const screen = el('div', { class: 'screen' });

  const top = el('div', { class: 'topbar' }, [
    el('button', { class: 'topbar__back', text: '‹', onclick: () => nav({ name: 'hub' }) }),
    el('div', { class: 'topbar__title', text: 'Paramètres' }),
  ]);

  const scroll = el('div', { class: 'screen__scroll', style: 'padding:14px;display:flex;flex-direction:column;gap:12px' });

  // Sound toggle
  const soundRow = () =>
    el('div', { class: 'panel', style: 'display:flex;align-items:center' }, [
      el('div', { style: 'flex:1;font:800 14px "Baloo 2";color:var(--ink)', text: 'Son' }),
      el('button', {
        class: `btn ${app.soundOn ? 'btn--green' : ''}`,
        style: 'padding:6px 16px;font-size:12px',
        text: app.soundOn ? 'Activé' : 'Coupé',
        onclick: () => {
          app.setSound(!app.soundOn);
          rerender();
        },
      }),
    ]);

  // Restore purchases (stub) + no-ads state
  const iapRow = el('div', { class: 'panel', style: 'display:flex;align-items:center' }, [
    el('div', { style: 'flex:1;font:800 14px "Baloo 2";color:var(--ink)', text: 'Restaurer les achats' }),
    el('button', {
      class: 'btn btn--purple',
      style: 'padding:6px 16px;font-size:12px',
      text: 'Restaurer',
      onclick: () => {
        void app.iap.restore();
        flash('Aucun achat à restaurer (démo)');
      },
    }),
  ]);

  const info = el('div', { class: 'panel', style: 'font:600 11px "Nunito";color:var(--ink-soft);line-height:1.6' }, [
    el('div', { text: `WARDENS — build de développement` }),
    el('div', { text: `Sauvegarde v${SAVE_SCHEMA_VERSION} · ${app.ownedCount()} unités · ${app.trophies} 🏆` }),
    el('div', { text: `Sans pub : ${app.noAds ? 'oui' : 'non'} · Passe : ${app.passActive ? 'actif' : 'non'}` }),
  ]);

  const reset = el('button', {
    class: 'btn',
    style: 'background:#c0392b;border-bottom:6px solid #7d2318;margin-top:8px',
    text: 'Réinitialiser la progression',
    onclick: () => {
      const confirmBtn = reset.nextElementSibling as HTMLElement | null;
      if (confirmBtn && confirmBtn.dataset.role === 'confirm') return;
      const c = el('button', {
        class: 'btn btn--gold',
        style: 'margin-top:8px',
        text: 'Confirmer la réinitialisation ?',
        onclick: () => {
          app.hardReset();
          nav({ name: 'hub' });
        },
      });
      c.dataset.role = 'confirm';
      reset.after(c);
      setTimeout(() => c.remove(), 4000);
    },
  });

  const flashHolder = el('div', {});
  function flash(msg: string): void {
    flashHolder.replaceChildren(el('div', { style: 'text-align:center;color:#2e7d32;font:700 12px "Nunito"', text: msg }));
    setTimeout(() => flashHolder.replaceChildren(), 1600);
  }

  const soundHolder = el('div', {});
  const rerender = () => soundHolder.replaceChildren(soundRow());
  rerender();

  scroll.append(soundHolder, iapRow, flashHolder, info, reset);
  screen.append(top, scroll);
  host.append(screen);
  return { unmount() {} };
}

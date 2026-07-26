import type { Screen, ScreenCtx } from '../Router';
import { el } from '../../ui/dom';
import { currencyPills } from './common';
import { heroRosterCards } from './heroRoster';

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
    pills.replaceChildren(currencyPills(app));
    scroll.replaceChildren(...heroRosterCards(app, host, render));
  }

  render();
  return { unmount() {} };
}

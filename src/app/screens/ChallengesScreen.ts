import type { Screen, ScreenCtx } from '../Router';
import { el } from '../../ui/dom';
import { todayStr } from '../../data/progression';
import { currencyPills, toast } from './common';

/**
 * "Défis" — the retention hub: a free daily chest, three rotating daily quests, and lifetime
 * achievements. Everything is claimable for free (no dark patterns). Re-renders in place on claim.
 */
export function ChallengesScreen(ctx: ScreenCtx): Screen {
  const { app, host, nav } = ctx;
  const today = todayStr();
  const screen = el('div', { class: 'screen' });

  const pills = el('div', {}, [currencyPills(app)]);
  const top = el('div', { class: 'topbar' }, [
    el('button', { class: 'topbar__back', text: '‹', onclick: () => nav({ name: 'hub' }) }),
    el('div', { class: 'topbar__title', text: 'Défis' }),
    pills,
  ]);

  const scroll = el('div', { class: 'screen__scroll', style: 'padding:12px 14px 24px;display:flex;flex-direction:column;gap:16px' });
  screen.append(top, scroll);
  host.append(screen);

  const reward = (r: { gold: number; gems: number }) =>
    el('div', { style: 'display:flex;gap:8px;align-items:center;white-space:nowrap' }, [
      el('div', { class: 'pill pill--gold', style: 'padding:3px 8px' }, [el('span', { class: 'coin' }), el('span', { text: String(r.gold) })]),
      ...(r.gems > 0 ? [el('div', { class: 'pill pill--gem', style: 'padding:3px 8px' }, [el('span', { class: 'gem' }), el('span', { text: String(r.gems) })])] : []),
    ]);

  const progressBar = (value: number, target: number, done: boolean) =>
    el('div', { class: 'bar', style: 'margin-top:6px' }, [
      el('div', { class: 'bar__fill', style: `width:${Math.min(100, (value / target) * 100)}%;background:${done ? 'var(--green-grad)' : 'linear-gradient(90deg,#e8b923,#f5d576)'}` }),
    ]);

  function render(): void {
    scroll.replaceChildren();
    pills.replaceChildren(currencyPills(app));

    // ── Daily chest ──────────────────────────────────────────────────────
    const chestReady = app.dailyChestAvailable(today);
    scroll.append(
      el('div', { class: 'panel', style: 'display:flex;align-items:center;gap:12px' }, [
        el('div', { style: 'font-size:34px', text: chestReady ? '🎁' : '📭' }),
        el('div', { style: 'flex:1' }, [
          el('div', { style: 'font:800 15px "Baloo 2";color:var(--ink)', text: 'Coffre quotidien' }),
          el('div', { style: 'font:600 11px "Nunito";color:var(--ink-soft)', text: chestReady ? 'Gratuit — reviens chaque jour' : 'Déjà récupéré aujourd’hui' }),
        ]),
        el('button', {
          class: `btn ${chestReady ? 'btn--green' : ''}`,
          style: 'padding:10px 16px;font-size:13px',
          text: chestReady ? 'Ouvrir' : '✓',
          ...(chestReady ? {} : { disabled: true }),
          onclick: () => {
            const r = app.claimDailyChest(today);
            if (r) toast(host, `+${r.gold} or, +${r.gems} gemmes !`);
            render();
          },
        }),
      ]),
    );

    // ── Daily quests ─────────────────────────────────────────────────────
    scroll.append(el('div', { class: 'section-label', text: 'Quêtes du jour' }));
    for (const { quest, value, done, claimed } of app.dailyQuests(today)) {
      scroll.append(
        el('div', { class: 'panel', style: 'display:flex;flex-direction:column;gap:2px' }, [
          el('div', { style: 'display:flex;align-items:center;gap:10px' }, [
            el('div', { style: 'flex:1' }, [
              el('div', { style: 'font:800 13px "Baloo 2";color:var(--ink)', text: quest.title }),
              el('div', { style: 'font:600 10px "Nunito";color:var(--ink-soft)', text: `${Math.min(value, quest.target)} / ${quest.target}` }),
            ]),
            claimed
              ? el('div', { style: 'font:800 12px "Baloo 2";color:var(--green-edge)', text: '✓ Réclamé' })
              : el('button', {
                  class: `btn ${done ? 'btn--gold' : ''}`,
                  style: 'padding:8px 12px;font-size:12px',
                  ...(done ? {} : { disabled: true }),
                  onclick: () => {
                    if (app.claimDailyQuest(quest.id, today)) toast(host, `Quête accomplie ! +${quest.reward.gold} or`);
                    render();
                  },
                }, [reward(quest.reward)]),
          ]),
          progressBar(value, quest.target, done),
        ]),
      );
    }

    // ── Achievements ─────────────────────────────────────────────────────
    scroll.append(el('div', { class: 'section-label', style: 'margin-top:4px', text: 'Succès' }));
    for (const { ach, value, done, claimed } of app.achievements()) {
      scroll.append(
        el('div', { class: 'panel', style: `display:flex;flex-direction:column;gap:2px;${claimed ? 'opacity:.6' : ''}` }, [
          el('div', { style: 'display:flex;align-items:center;gap:10px' }, [
            el('div', { style: 'flex:1' }, [
              el('div', { style: 'font:800 13px "Baloo 2";color:var(--ink)', text: ach.title }),
              el('div', { style: 'font:600 10px "Nunito";color:var(--ink-soft)', text: `${ach.desc} · ${Math.min(value, ach.target)}/${ach.target}` }),
            ]),
            claimed
              ? el('div', { style: 'font:800 12px "Baloo 2";color:var(--green-edge)', text: '✓' })
              : el('button', {
                  class: `btn ${done ? 'btn--green' : ''}`,
                  style: 'padding:8px 12px;font-size:12px',
                  ...(done ? {} : { disabled: true }),
                  onclick: () => {
                    if (app.claimAchievement(ach.id)) toast(host, `Succès débloqué ! +${ach.reward.gold} or`);
                    render();
                  },
                }, [reward(ach.reward)]),
          ]),
          progressBar(value, ach.target, done),
        ]),
      );
    }
  }

  render();
  return { unmount() {} };
}

import type { AppState } from '../AppState';
import { el, pictogram } from '../../ui/dom';
import { RARITY_EDGE, RARITY_GRAD } from '../../ui/theme';
import type { UnitDef } from '../../sim/types';

export function currencyPills(app: AppState): HTMLElement {
  return el('div', { style: 'display:flex;gap:6px;align-items:center' }, [
    el('div', { class: 'pill pill--gold' }, [el('span', { class: 'coin' }), el('span', { text: String(app.gold) })]),
    el('div', { class: 'pill pill--gem' }, [el('span', { class: 'gem' }), el('span', { text: String(app.gems) })]),
    shardPill(app.shards),
  ]);
}

/** Éclats ✦ pill — a teal faceted shard, the high-tier upgrade resource. */
export function shardPill(count: number): HTMLElement {
  return el('div', {
    class: 'pill',
    style: 'background:linear-gradient(135deg,#7fe3da,#1aa39a);border-bottom:3px solid #12756e;color:#08312e',
  }, [
    el('span', { style: 'width:11px;height:11px;flex:none;transform:rotate(45deg);border-radius:2px;background:#e8fffd;border:1px solid #12756e' }),
    el('span', { text: String(count) }),
  ]);
}

export function toast(host: HTMLElement, message: string): void {
  const t = el('div', {
    text: message,
    style:
      'position:absolute;left:50%;bottom:120px;transform:translateX(-50%);z-index:100;' +
      'background:rgba(43,30,20,.94);color:#f0c26a;font:800 12px "Baloo 2",sans-serif;' +
      'padding:10px 16px;border-radius:12px;box-shadow:0 6px 16px rgba(0,0,0,.3);pointer-events:none;opacity:0;transition:opacity .2s',
  });
  host.append(t);
  requestAnimationFrame(() => (t.style.opacity = '1'));
  setTimeout(() => {
    t.style.opacity = '0';
    setTimeout(() => t.remove(), 250);
  }, 1400);
}

export type Tab = 'collection' | 'play' | 'shop';

export function bottomNav(active: Tab, handlers: { onCollection: () => void; onPlay: () => void; onShop: () => void }): HTMLElement {
  const item = (tab: Tab, label: string, glyph: string, onClick: () => void, center = false) =>
    el('button', { class: `navbtn ${active === tab ? 'navbtn--active' : ''}`, onclick: onClick }, [
      el('div', {
        class: 'navbtn__icon',
        text: glyph,
        style: center
          ? 'width:44px;height:44px;border-radius:14px;background:var(--gold-grad);border-bottom:4px solid var(--gold-edge);margin-top:-18px;color:#5c3d0a;box-shadow:inset 0 2px 0 rgba(255,255,255,.5)'
          : '',
      }),
      el('div', { text: label }),
    ]);
  return el('div', { class: 'navbottom' }, [
    item('collection', 'Collection', '▦', handlers.onCollection),
    item('play', 'Jouer', '▶', handlers.onPlay, true),
    item('shop', 'Boutique', '◆', handlers.onShop),
  ]);
}

export function starRow(stars: number, max = 3, size = 14): HTMLElement {
  const row = el('div', { style: 'display:flex;gap:3px' });
  for (let i = 0; i < max; i++) {
    row.append(
      el('span', {
        text: '★',
        style: `font-size:${size}px;color:${i < stars ? '#f0c26a' : 'rgba(0,0,0,.18)'};line-height:1`,
      }),
    );
  }
  return row;
}

/** A collection/deck tile for a unit (rarity gradient, family pictogram, level badge). */
export function unitTile(def: UnitDef, opts: { level?: number; locked?: boolean; onClick?: () => void; badge?: string } = {}): HTMLElement {
  const tile = el('button', {
    class: `tile ${opts.locked ? 'tile--locked' : ''}`,
    style: `background:${RARITY_GRAD[def.rarity]};border-bottom:5px solid ${RARITY_EDGE[def.rarity]}`,
    onclick: opts.onClick,
  });
  const pic = pictogram(def.family, 28);
  tile.append(pic);
  tile.append(el('span', { class: 'tile__name', text: def.name }));
  if (opts.level !== undefined && !opts.locked) {
    tile.append(el('span', { class: 'tile__lv', text: `Niv ${opts.level}`, style: `color:${RARITY_EDGE[def.rarity]}` }));
  }
  if (opts.locked) {
    tile.append(el('span', { class: 'tile__lv', text: '🔒', style: 'background:rgba(0,0,0,.35)' }));
  }
  if (opts.badge) {
    tile.append(
      el('span', {
        text: opts.badge,
        style:
          'position:absolute;bottom:4px;right:4px;background:var(--gem-grad);color:#fff;border-radius:8px;padding:1px 5px;font:800 8px "Baloo 2",sans-serif',
      }),
    );
  }
  return tile;
}

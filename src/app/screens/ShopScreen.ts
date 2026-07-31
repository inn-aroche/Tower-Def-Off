import type { Screen, ScreenCtx } from '../Router';
import { clear, el } from '../../ui/dom';
import { GEM_ITEMS, REAL_OFFERS, type GemItem, type RealOffer } from '../../data/shop';
import { currencyPills, sectionNav, toast } from './common';

export function ShopScreen(ctx: ScreenCtx): Screen {
  const { app, host, nav } = ctx;
  const screen = el('div', { class: 'screen' });

  const currencyHolder = el('div', { style: 'display:flex' }, [currencyPills(app)]);
  const top = el('div', { class: 'topbar' }, [
    el('div', { class: 'topbar__title', text: 'Boutique' }),
    currencyHolder,
  ]);
  const refreshCurrency = () => {
    clear(currencyHolder);
    currencyHolder.append(currencyPills(app));
  };

  const scroll = el('div', { class: 'screen__scroll', style: 'padding:14px' });

  // Hero: Passe Héroïque
  const pass = REAL_OFFERS.find((o) => o.kind === 'pass')!;
  scroll.append(
    el('div', {
      style: 'background:linear-gradient(135deg,#8e44ad,#5e3370);border-radius:16px;padding:14px;box-shadow:0 6px 14px rgba(0,0,0,.25);margin-bottom:14px',
    }, [
      el('div', { style: 'font:800 16px "Baloo 2";color:#fff', text: pass.title + (app.passActive ? ' ✓' : '') }),
      el('div', { style: 'font:600 11px "Nunito";color:#e6d3ff;margin-top:2px', text: pass.subtitle }),
      el('button', {
        class: 'btn btn--gold',
        style: 'width:100%;margin-top:10px;padding:9px',
        text: app.passActive ? 'Actif' : pass.priceLabel,
        onclick: () => purchaseReal(pass),
        ...(app.passActive ? { disabled: true } : {}),
      }),
    ]),
  );

  // Gem exchange (functional)
  scroll.append(el('div', { class: 'section-label', style: 'margin:4px 0 8px', text: 'Échange (gemmes)' }));
  const gemGrid = el('div', { style: 'display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:16px' });
  for (const item of GEM_ITEMS) gemGrid.append(gemCard(item));
  scroll.append(gemGrid);

  // Rewarded (opt-in) hook
  scroll.append(
    el('button', {
      class: 'btn btn--purple',
      style: 'width:100%;margin-bottom:16px;padding:10px;font-size:13px',
      text: '🎁 Coffre bonus (pub optionnelle)',
      onclick: async () => {
        app.analytics.track('rewarded_requested', { placement: 'bonus_chest' });
        const res = await app.ads.showRewarded('bonus_chest');
        toast(host, res === 'completed' ? 'Coffre bonus !' : 'Pubs indisponibles (démo)');
      },
    }),
  );

  // Real-money packs (stubbed via NullProvider)
  scroll.append(el('div', { class: 'section-label', style: 'margin:4px 0 8px', text: 'Offres' }));
  const realGrid = el('div', { style: 'display:grid;grid-template-columns:repeat(2,1fr);gap:10px' });
  for (const offer of REAL_OFFERS.filter((o) => o.kind !== 'pass')) realGrid.append(realCard(offer));
  scroll.append(realGrid);

  screen.append(top, scroll, sectionNav('boutique', nav));
  host.append(screen);

  function purchaseReal(offer: RealOffer): void {
    app.analytics.track('purchase_attempt', { product: offer.product });
    void app.iap.purchase(offer.product).then((res) => {
      if (res === 'purchased') {
        if (offer.kind === 'noads' || offer.kind === 'pass') app.applyPurchase(offer.kind);
        refreshCurrency();
        toast(host, 'Achat effectué');
      } else {
        toast(host, 'Paiements désactivés (démo v1)');
      }
    });
  }

  function gemCard(item: GemItem): HTMLElement {
    const affordable = app.gems >= item.gemCost;
    return el('div', { class: 'panel', style: 'display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center;padding:12px' }, [
      el('div', { style: 'font:800 12px "Baloo 2";color:var(--ink)', text: item.title }),
      el('div', { style: 'font:600 9px "Nunito";color:var(--ink-soft);min-height:22px', text: item.subtitle }),
      el('button', {
        class: `btn ${affordable ? 'btn--purple' : ''}`,
        style: 'padding:6px 12px;font-size:11px;display:flex;align-items:center;gap:5px',
        html: `<span class="gem"></span> ${item.gemCost}`,
        onclick: () => buyGemItem(item),
        ...(affordable ? {} : { disabled: true }),
      }),
    ]);
  }

  function buyGemItem(item: GemItem): void {
    if (!app.spendGems(item.gemCost)) {
      toast(host, 'Pas assez de gemmes');
      return;
    }
    refreshCurrency();
    if (item.grantChest) {
      nav({ name: 'chest', kind: item.grantChest });
    } else if (item.grantGold) {
      app.addGold(item.grantGold);
      refreshCurrency();
      toast(host, `+${item.grantGold} or`);
    }
  }

  function realCard(offer: RealOffer): HTMLElement {
    const done = offer.kind === 'noads' && app.noAds;
    return el('div', { class: 'panel', style: 'display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center;padding:12px' }, [
      el('div', { style: 'font:800 12px "Baloo 2";color:var(--ink)', text: offer.title }),
      el('div', { style: 'font:600 9px "Nunito";color:var(--ink-soft);min-height:22px', text: offer.subtitle }),
      el('button', {
        class: `btn ${done ? '' : 'btn--gold'}`,
        style: 'padding:6px 14px;font-size:11px',
        text: done ? 'Acquis' : offer.priceLabel,
        onclick: () => purchaseReal(offer),
        ...(done ? { disabled: true } : {}),
      }),
    ]);
  }

  return { unmount() {} };
}

import type { Screen, ScreenCtx } from '../Router';
import { el } from '../../ui/dom';
import { confirmDialog, toast } from './common';
import { CombatSim } from '../../sim/CombatSim';
import type { CombatSnapshot, EnemyDef } from '../../sim/types';
import { ECONOMY } from '../../data/economy';
import { ENEMIES } from '../../data/enemies';
import { CAMPAIGN, scaleEnemyDef } from '../../data/campaign';
import { computeRewards, starsFor } from '../../data/meta';
import { computeBoardLayout, pixelToCell } from '../../render/BoardLayout';
import { drawCombatFrame, type CombatUiState, type RenderContext } from '../../render/CombatRenderer';
import { BOTTOM_INSET, hitCard, TOP_INSET } from '../../render/HudLayout';
import { Effects } from '../../render/Effects';
import { WebHapticsProvider } from '../../platform/Haptics';
import { WebAudioProvider } from '../../platform/Audio';
import { TutorialCoach } from '../../ui/Tutorial';
import { todayStr } from '../../data/progression';

const TICK_SEC = 1 / 30;
const MAX_TICKS_PER_FRAME = 5;

export function CombatScreen(ctx: ScreenCtx): Screen {
  const { app, host, nav, route } = ctx;
  const nodeIndex = route.name === 'combat' ? route.nodeIndex : 0;
  const node = CAMPAIGN[Math.max(0, Math.min(CAMPAIGN.length - 1, nodeIndex))];
  // The base upgrade grants extra starting life in PvE.
  const level = {
    ...node.level,
    playerStartLife: node.level.playerStartLife + app.baseBonusLife(),
    // The base upgrade also widens the emplacements budget (PvE only).
    maxSlots: (node.level.maxSlots ?? 0) + app.baseBonusSlots(),
  };

  const scaledUnitDefs = app.scaledDeckDefs();
  const scaledEnemies: EnemyDef[] = ENEMIES.map((e) => scaleEnemyDef(e, node.enemyHpMult));
  const deck = app.deck;

  const heroConfig = app.activeHeroConfig();
  const sim = new CombatSim({ economy: ECONOMY, level, deck, unitDefs: scaledUnitDefs, enemyDefs: scaledEnemies, hero: heroConfig ?? undefined });
  const renderContext: RenderContext = {
    unitDefs: new Map(scaledUnitDefs.map((u) => [u.id, u])),
    enemyDefs: new Map(scaledEnemies.map((e) => [e.id, e])),
    levelName: node.name,
    path: level.path,
  };
  const ui: CombatUiState = { selectedCardIndex: null, selectedUnit: null };

  app.analytics.track('combat_start', { nodeIndex, levelId: level.id });

  const screen = el('div', { class: 'screen', style: 'background:#efe8d6' });
  const canvas = el('canvas', { style: 'display:block;touch-action:none' });
  const back = el('button', {
    text: '✕ Quitter',
    style:
      'position:absolute;top:48px;left:12px;z-index:20;height:30px;padding:0 12px;border:1.5px solid #f0c26a;border-radius:15px;' +
      'background:rgba(0,0,0,.42);color:#f0c26a;font:800 12px "Baloo 2",sans-serif;cursor:pointer',
    onclick: () => {
      if (finished) {
        nav({ name: 'hub' });
        return;
      }
      confirmDialog(host, 'Quitter la partie ? La progression sera perdue.', () => {
        app.analytics.track('combat_quit', { nodeIndex });
        nav({ name: 'hub' });
      });
    },
  });
  screen.append(canvas, back);

  // Hero button — when ready, launches the hero (it enters at the base and marches up the path).
  const heroBtn = heroConfig
    ? el('button', {
        style:
          'position:absolute;left:12px;bottom:150px;z-index:20;width:62px;height:62px;border-radius:50%;border:3px solid #f0c26a;cursor:pointer;' +
          'background:radial-gradient(circle at 50% 35%,#5a3b6e,#2b1e14);color:#fff;font:800 10px "Baloo 2",sans-serif;' +
          'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;box-shadow:0 4px 10px rgba(0,0,0,.4)',
        onclick: () => {
          const res = sim.activateHero();
          if (res.ok) {
            audio.play('summon');
            haptics.impact('medium');
            toast(host, `${heroConfig.name} entre en jeu !`);
          } else if (res.reason === 'not-ready') {
            toast(host, 'Héros pas encore prêt');
          }
        },
      }, [el('div', { style: 'font-size:22px', text: '🦸' }), el('div', { text: 'HÉROS' })])
    : null;
  if (heroBtn) screen.append(heroBtn);
  host.append(screen);
  const c = canvas.getContext('2d')!;

  const resize = () => {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  window.addEventListener('resize', resize);
  resize();

  const layout = () => computeBoardLayout(window.innerWidth, window.innerHeight, ECONOMY.gridCols, ECONOMY.gridRows, TOP_INSET, BOTTOM_INSET);

  function handleTap(x: number, y: number): void {
    const snap = sim.snapshot();
    if (snap.outcome !== 'ongoing') return;

    const cardIndex = hitCard(window.innerWidth, window.innerHeight, snap.hand.length, x, y);
    if (cardIndex !== null) {
      ui.selectedUnit = null;
      const card = snap.hand[cardIndex];
      // Offensive cards need no cell: they charge up the path straight from the base.
      if (card.role === 'offense') {
        ui.selectedCardIndex = null;
        if (!card.affordable) return;
        const res = sim.launchOffense(card.unitId);
        if (res.ok) {
          audio.play('summon');
          haptics.impact('medium');
          app.analytics.track('offense_launched', { unitId: card.unitId });
          toast(host, `${card.name} charge !`);
        }
        return;
      }
      if (ui.selectedCardIndex === cardIndex) ui.selectedCardIndex = null;
      else if (card.affordable) ui.selectedCardIndex = cardIndex;
      return;
    }

    const cell = pixelToCell(layout(), x, y);
    if (!cell) return;
    const occupant = snap.units.find((u) => u.col === cell.col && u.row === cell.row);

    if (ui.selectedCardIndex !== null) {
      const card = snap.hand[ui.selectedCardIndex];
      const res = sim.summon(card.unitId, cell.col, cell.row);
      if (res.ok) {
        const def = renderContext.unitDefs.get(res.unitId);
        app.analytics.track('unit_summoned', { unitId: res.unitId, family: def?.family });
        if (def?.family === 'gravity') app.analytics.track('gravity_unit_played', { unitId: res.unitId });
        ui.selectedCardIndex = null;
      } else if (res.reason === 'no-slot') {
        toast(host, 'Emplacements pleins — fusionne deux unités pour libérer une place');
      }
      return;
    }

    if (!occupant) {
      ui.selectedUnit = null;
      return;
    }
    if (!ui.selectedUnit) {
      ui.selectedUnit = { col: cell.col, row: cell.row };
      return;
    }
    if (ui.selectedUnit.col === cell.col && ui.selectedUnit.row === cell.row) {
      ui.selectedUnit = null;
      return;
    }
    const res = sim.merge(ui.selectedUnit, { col: cell.col, row: cell.row });
    if (res.ok) {
      app.analytics.track('unit_merged', { unitId: occupant.unitId, newLevel: res.newLevel });
      ui.selectedUnit = null;
    } else if (res.reason === 'mismatch') {
      ui.selectedUnit = { col: cell.col, row: cell.row };
    } else {
      ui.selectedUnit = null;
    }
  }

  const onPointer = (e: PointerEvent) => {
    audio.resume();
    handleTap(e.clientX, e.clientY);
  };
  canvas.addEventListener('pointerdown', onPointer);

  const effects = new Effects();
  const haptics = new WebHapticsProvider();
  const audio = new WebAudioProvider();
  audio.setEnabled(app.soundOn);
  // FTUE: guide the very first campaign combat.
  let coach: TutorialCoach | null =
    !app.tutorialSeen && nodeIndex === 0
      ? new TutorialCoach(screen, () => {
          app.markTutorialSeen();
          coach = null;
        })
      : null;
  let raf = 0;
  let lastMs: number | null = null;
  let acc = 0;
  let finished = false;
  let mergeCount = 0;

  const finish = (snap: CombatSnapshot) => {
    finished = true;
    const outcome = snap.outcome === 'victory' ? 'victory' : 'defeat';
    const win = outcome === 'victory';
    const stars = win ? starsFor(snap.life, level.playerStartLife) : 0;
    const rewards = win ? computeRewards(nodeIndex, stars, deck) : { gold: 0, gems: 0, duplicates: [] };
    app.analytics.track('combat_end', { nodeIndex, outcome, stars, life: snap.life, kills: snap.kills });
    if (win) app.recordVictory(nodeIndex, stars, rewards);
    app.recordCombatEnd({ won: win, kills: snap.kills, merges: mergeCount, pvp: false, blitz: false }, todayStr());
    window.setTimeout(() => {
      nav({ name: 'results', payload: { nodeIndex, outcome, stars, lifeRemaining: snap.life, rewards } });
    }, 650);
  };

  function updateHeroBtn(snap: CombatSnapshot): void {
    if (!heroBtn) return;
    const h = snap.hero;
    const label = heroBtn.lastElementChild as HTMLElement;
    if (h.deployed) {
      heroBtn.style.opacity = '0.5';
      heroBtn.style.borderColor = '#8fe0da';
      heroBtn.style.boxShadow = '0 4px 10px rgba(0,0,0,.4)';
      label.textContent = 'ACTIF';
    } else if (h.ready) {
      heroBtn.style.opacity = '1';
      heroBtn.style.borderColor = '#8ee06a';
      heroBtn.style.boxShadow = '0 0 0 4px rgba(120,220,120,.45),0 4px 10px rgba(0,0,0,.4)';
      label.textContent = 'PRÊT';
    } else {
      heroBtn.style.opacity = '0.9';
      heroBtn.style.borderColor = '#f0c26a';
      heroBtn.style.boxShadow = '0 4px 10px rgba(0,0,0,.4)';
      label.textContent = `${Math.floor(h.energy * 100)}%`;
    }
  }

  const frame = (now: number) => {
    if (lastMs === null) lastMs = now;
    const frameDt = Math.min(0.25, (now - lastMs) / 1000);
    acc += frameDt;
    lastMs = now;
    let ticks = 0;
    while (acc >= TICK_SEC && ticks < MAX_TICKS_PER_FRAME) {
      sim.step(TICK_SEC);
      acc -= TICK_SEC;
      ticks++;
    }
    for (const ev of sim.consumeEvents()) {
      effects.emit(ev);
      if (ev.type === 'merge') {
        mergeCount += 1;
        haptics.impact('medium');
        audio.play('merge');
      } else if (ev.type === 'baseHit') {
        haptics.impact('heavy');
        audio.play('baseHit');
      } else if (ev.type === 'summon') audio.play('summon');
      else if (ev.type === 'kill') audio.play('kill');
      else if (ev.type === 'damage') audio.play('hit');
      else if (ev.type === 'heroPower') {
        haptics.impact('heavy');
        audio.play('kill');
      } else if (ev.type === 'heroDeath') audio.play('baseHit');
    }
    effects.update(frameDt);
    const snap = sim.snapshot();
    coach?.update(snap);
    updateHeroBtn(snap);

    const shake = effects.shakeOffset();
    c.save();
    c.translate(shake.x, shake.y);
    drawCombatFrame(c, window.innerWidth, window.innerHeight, layout(), snap, ui, renderContext, {
      isFlashing: (id) => effects.isFlashing(id),
      pulseSec: snap.elapsedSec,
    });
    effects.draw(c, layout());
    c.restore();
    effects.drawOverlay(c, window.innerWidth, window.innerHeight);

    if (snap.outcome !== 'ongoing' && !finished) finish(snap);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  return {
    unmount() {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('pointerdown', onPointer);
      coach?.destroy();
    },
  };
}

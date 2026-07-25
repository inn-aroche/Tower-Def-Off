import type { Screen, ScreenCtx } from '../Router';
import { el } from '../../ui/dom';
import { CombatSim } from '../../sim/CombatSim';
import type { CombatSnapshot, LevelDef } from '../../sim/types';
import { ECONOMY } from '../../data/economy';
import { ENEMIES } from '../../data/enemies';
import { CAMPAIGN_PATH } from '../../data/levels';
import {
  SURVIVAL_START_LIFE,
  SURVIVAL_WAVE_GAP_SEC,
  survivalHpMult,
  survivalRewards,
  survivalWave,
} from '../../data/survival';
import { todayStr } from '../../data/progression';
import { computeBoardLayout, pixelToCell } from '../../render/BoardLayout';
import { drawCombatFrame, type CombatUiState, type RenderContext } from '../../render/CombatRenderer';
import { BOTTOM_INSET, hitCard, TOP_INSET } from '../../render/HudLayout';
import { Effects } from '../../render/Effects';
import { WebHapticsProvider } from '../../platform/Haptics';
import { WebAudioProvider } from '../../platform/Audio';

const TICK_SEC = 1 / 30;
const MAX_TICKS_PER_FRAME = 5;

/**
 * Endless "Survie" combat — same board and controls as the campaign, but waves are generated
 * forever (see `data/survival.ts`) and the only end state is defeat. Score = wave reached.
 */
export function SurvivalScreen(ctx: ScreenCtx): Screen {
  const { app, host, nav } = ctx;

  const level: LevelDef = {
    id: 'survival',
    name: 'Survie',
    playerStartLife: SURVIVAL_START_LIFE,
    path: CAMPAIGN_PATH,
    waves: [],
  };

  const scaledUnitDefs = app.scaledDeckDefs();
  const deck = app.deck;

  const sim = new CombatSim({
    economy: ECONOMY,
    level,
    deck,
    unitDefs: scaledUnitDefs,
    enemyDefs: ENEMIES,
    survival: { makeWave: survivalWave, hpMultForWave: survivalHpMult, waveGapSec: SURVIVAL_WAVE_GAP_SEC },
  });
  const renderContext: RenderContext = {
    unitDefs: new Map(scaledUnitDefs.map((u) => [u.id, u])),
    enemyDefs: new Map(ENEMIES.map((e) => [e.id, e])),
    levelName: '🌊 Survie',
    path: level.path,
  };
  const ui: CombatUiState = { selectedCardIndex: null, selectedUnit: null };

  app.analytics.track('survival_start', {});

  const screen = el('div', { class: 'screen', style: 'background:#efe8d6' });
  const canvas = el('canvas', { style: 'display:block;touch-action:none' });
  const back = el('button', {
    text: '‹',
    style:
      'position:absolute;top:52px;left:12px;z-index:20;width:32px;height:32px;border:none;border-radius:9px;' +
      'background:rgba(0,0,0,.35);color:#f0c26a;font-size:20px;cursor:pointer',
    onclick: () => nav({ name: 'hub' }),
  });
  screen.append(canvas, back);
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

  const layout = () =>
    computeBoardLayout(window.innerWidth, window.innerHeight, ECONOMY.gridCols, ECONOMY.gridRows, TOP_INSET, BOTTOM_INSET);

  function handleTap(x: number, y: number): void {
    const snap = sim.snapshot();
    if (snap.outcome !== 'ongoing') return;

    const cardIndex = hitCard(window.innerWidth, window.innerHeight, snap.hand.length, x, y);
    if (cardIndex !== null) {
      ui.selectedUnit = null;
      if (ui.selectedCardIndex === cardIndex) ui.selectedCardIndex = null;
      else if (snap.hand[cardIndex].affordable) ui.selectedCardIndex = cardIndex;
      return;
    }

    const cell = pixelToCell(layout(), x, y);
    if (!cell) return;
    const occupant = snap.units.find((u) => u.col === cell.col && u.row === cell.row);

    if (ui.selectedCardIndex !== null) {
      const card = snap.hand[ui.selectedCardIndex];
      const res = sim.summon(card.unitId, cell.col, cell.row);
      if (res.ok) ui.selectedCardIndex = null;
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
    if (res.ok) ui.selectedUnit = null;
    else if (res.reason === 'mismatch') ui.selectedUnit = { col: cell.col, row: cell.row };
    else ui.selectedUnit = null;
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
  let raf = 0;
  let lastMs: number | null = null;
  let acc = 0;
  let finished = false;
  let mergeCount = 0;

  const finish = (snap: CombatSnapshot) => {
    finished = true;
    // The wave the player was on when the base fell (1-based).
    const wavesReached = snap.currentWaveIndex + 1;
    const rewards = survivalRewards(wavesReached);
    const isRecord = app.recordSurvival(wavesReached, rewards);
    app.recordCombatEnd({ won: false, kills: snap.kills, merges: mergeCount, pvp: false, blitz: false }, todayStr());
    window.setTimeout(() => {
      nav({
        name: 'survivalResults',
        payload: { wavesReached, bestWave: app.survivalBest, isRecord, kills: snap.kills, rewards },
      });
    }, 650);
  };

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
      else if (ev.type === 'spawn' && ev.boss) haptics.impact('heavy');
    }
    effects.update(frameDt);
    const snap = sim.snapshot();

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
    },
  };
}

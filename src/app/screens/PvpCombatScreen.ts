import type { Screen, ScreenCtx } from '../Router';
import { el } from '../../ui/dom';
import { CombatSim } from '../../sim/CombatSim';
import { BotDriver } from '../../sim/BotPolicy';
import { ECONOMY } from '../../data/economy';
import { ENEMIES } from '../../data/enemies';
import { ARENA_LEVEL, BLITZ_ARENA_LEVEL, BLITZ_ECONOMY, botUnitDefs, LOSS_TROPHIES, WIN_TROPHIES } from '../../data/arena';
import { computeBoardLayout, pixelToCell } from '../../render/BoardLayout';
import { drawCombatFrame, type CombatUiState, type RenderContext } from '../../render/CombatRenderer';
import { BOTTOM_INSET, hitCard, TOP_INSET } from '../../render/HudLayout';
import { Effects } from '../../render/Effects';
import { WebHapticsProvider } from '../../platform/Haptics';
import { WebAudioProvider } from '../../platform/Audio';
import { todayStr } from '../../data/progression';

const TICK_SEC = 1 / 30;
const MAX_TICKS_PER_FRAME = 5;

export function PvpCombatScreen(ctx: ScreenCtx): Screen {
  const { app, host, nav } = ctx;
  const league = app.currentLeague();
  const blitz = ctx.route.name === 'pvp' && ctx.route.blitz === true;
  const level = blitz ? BLITZ_ARENA_LEVEL : ARENA_LEVEL;
  const economy = blitz ? BLITZ_ECONOMY : ECONOMY;

  const playerDefs = app.scaledDeckDefs();
  const playerSim = new CombatSim({ economy, level, deck: app.deck, unitDefs: playerDefs, enemyDefs: ENEMIES });

  const botDefs = botUnitDefs(league);
  const botSim = new CombatSim({ economy, level, deck: league.botDeck, unitDefs: botDefs, enemyDefs: ENEMIES });
  const bot = new BotDriver(botSim, league.botDeck, botDefs, level.path, economy.gridCols, economy.gridRows, league.botActIntervalSec);

  const renderContext: RenderContext = {
    unitDefs: new Map(playerDefs.map((u) => [u.id, u])),
    enemyDefs: new Map(ENEMIES.map((e) => [e.id, e])),
    levelName: blitz ? `⚡ Blitz · ${league.name}` : `Arène · ${league.name}`,
    path: level.path,
  };
  const ui: CombatUiState = { selectedCardIndex: null, selectedUnit: null };

  app.analytics.track('pvp_start', { league: league.id, blitz });

  const screen = el('div', { class: 'screen', style: 'background:#efe8d6' });
  const canvas = el('canvas', { style: 'display:block;touch-action:none' });

  // Opponent header chip (DOM over the canvas top-centre — the canvas HUD keeps the player's life).
  const oppLifeBar = el('div', { style: 'height:100%;background:linear-gradient(90deg,#e74c3c,#f0a3a3);border-radius:5px;width:100%' });
  const oppChip = el('div', {
    style:
      'position:absolute;top:20px;left:50%;transform:translateX(-50%);z-index:20;min-width:150px;' +
      'background:rgba(43,30,20,.92);border:1.5px solid #c0392b;border-radius:12px;padding:5px 10px;text-align:center',
  }, [
    el('div', { style: 'font:800 11px "Baloo 2",sans-serif;color:#fff', text: `🛡 ${league.botName}` }),
    el('div', { style: 'height:6px;background:#1f1610;border-radius:5px;overflow:hidden;margin-top:3px' }, [oppLifeBar]),
  ]);
  const back = el('button', {
    text: '‹',
    style: 'position:absolute;top:52px;left:12px;z-index:20;width:32px;height:32px;border:none;border-radius:9px;background:rgba(0,0,0,.35);color:#f0c26a;font-size:20px;cursor:pointer',
    onclick: () => nav({ name: 'arena' }),
  });
  screen.append(canvas, oppChip, back);
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
    const snap = playerSim.snapshot();
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
      const res = playerSim.summon(card.unitId, cell.col, cell.row);
      if (res.ok) {
        const def = renderContext.unitDefs.get(res.unitId);
        if (def?.family === 'gravity') app.analytics.track('gravity_unit_played', { unitId: res.unitId });
        ui.selectedCardIndex = null;
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
    const res = playerSim.merge(ui.selectedUnit, { col: cell.col, row: cell.row });
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

  const finish = (playerLife: number, botLife: number) => {
    finished = true;
    let outcome: 'victory' | 'defeat' | 'draw';
    if (playerLife <= 0 && botLife <= 0) outcome = 'draw';
    else if (playerLife <= 0) outcome = 'defeat';
    else if (botLife <= 0) outcome = 'victory';
    else outcome = playerLife > botLife ? 'victory' : playerLife < botLife ? 'defeat' : 'draw';

    const delta = outcome === 'victory' ? WIN_TROPHIES : outcome === 'defeat' ? -LOSS_TROPHIES : 0;
    const total = app.addTrophies(delta);
    app.recordCombatEnd({ won: outcome === 'victory', kills: playerSim.snapshot().kills, merges: mergeCount, pvp: true, blitz }, todayStr());
    app.analytics.track('pvp_end', { league: league.id, outcome, delta, blitz });
    window.setTimeout(() => {
      nav({
        name: 'pvpResults',
        payload: { outcome, playerLife: Math.max(0, playerLife), botLife: Math.max(0, botLife), trophiesDelta: delta, totalTrophies: total, leagueName: league.name, botName: league.botName, blitz },
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
      playerSim.step(TICK_SEC);
      botSim.step(TICK_SEC);
      bot.update(botSim.snapshot().elapsedSec);
      acc -= TICK_SEC;
      ticks++;
    }
    botSim.consumeEvents(); // discard the headless opponent's events (only the player board is drawn)
    for (const ev of playerSim.consumeEvents()) {
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
    }
    effects.update(frameDt);

    const ps = playerSim.snapshot();
    const bs = botSim.snapshot();
    oppLifeBar.style.width = `${Math.max(0, (bs.life / level.playerStartLife) * 100)}%`;

    const shake = effects.shakeOffset();
    c.save();
    c.translate(shake.x, shake.y);
    drawCombatFrame(c, window.innerWidth, window.innerHeight, layout(), ps, ui, renderContext, {
      isFlashing: (id) => effects.isFlashing(id),
      pulseSec: ps.elapsedSec,
    });
    effects.draw(c, layout());
    c.restore();
    effects.drawOverlay(c, window.innerWidth, window.innerHeight);

    const ended = ps.outcome === 'defeat' || bs.outcome === 'defeat' || (ps.outcome !== 'ongoing' && bs.outcome !== 'ongoing');
    if (ended && !finished) finish(ps.life, bs.life);
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

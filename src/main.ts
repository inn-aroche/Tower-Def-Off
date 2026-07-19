import { CombatSim } from './sim/CombatSim';
import type { CombatSnapshot } from './sim/types';
import { ECONOMY } from './data/economy';
import { UNITS, DEFAULT_DECK } from './data/units';
import { ENEMIES } from './data/enemies';
import { LEVELS } from './data/levels';
import { computeBoardLayout, pixelToCell } from './render/BoardLayout';
import { drawCombatFrame, type CombatUiState, type RenderContext } from './render/CombatRenderer';
import { BOTTOM_INSET, hitCard, TOP_INSET } from './render/HudLayout';
import { LocalStorageSaveProvider } from './platform/LocalStorageSave';
import { NullAdProvider, NullAnalyticsProvider, NullIapProvider } from './platform/NullProviders';
import { createDefaultSaveData, migrateSaveData, SAVE_KEY, SAVE_SCHEMA_VERSION, type SaveData } from './meta/SaveData';

const TICK_SEC = 1 / 30;
const MAX_TICKS_PER_FRAME = 5;

const analytics = new NullAnalyticsProvider();
const ads = new NullAdProvider();
const iap = new NullIapProvider();
void ads;
void iap; // wired for M5 monetization hooks; unused until then

const saveProvider = new LocalStorageSaveProvider<SaveData>(SAVE_KEY, SAVE_SCHEMA_VERSION, migrateSaveData);
const save: SaveData = saveProvider.load() ?? createDefaultSaveData();

const unitDefs = new Map(UNITS.map((u) => [u.id, u]));
const enemyDefs = new Map(ENEMIES.map((e) => [e.id, e]));
const renderContext: RenderContext = { unitDefs, enemyDefs, levelName: '', path: [] };

const ui: CombatUiState = { selectedCardIndex: null, selectedUnit: null };

const app = document.getElementById('app')!;
const canvas = document.createElement('canvas');
app.appendChild(canvas);
const ctx = canvas.getContext('2d')!;

let sim: CombatSim;
let outcomeHandled = false;

function startLevel(index: number): void {
  const levelIndex = Math.max(0, Math.min(LEVELS.length - 1, index));
  const level = LEVELS[levelIndex];
  renderContext.levelName = level.name;
  renderContext.path = level.path;
  sim = new CombatSim({ economy: ECONOMY, level, deck: DEFAULT_DECK, unitDefs: UNITS, enemyDefs: ENEMIES });
  ui.selectedCardIndex = null;
  ui.selectedUnit = null;
  outcomeHandled = false;
  analytics.track('combat_start', { levelId: level.id, levelIndex });
}

startLevel(save.campaign.currentLevelIndex);

function resizeCanvas(): void {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function currentLayout() {
  return computeBoardLayout(window.innerWidth, window.innerHeight, ECONOMY.gridCols, ECONOMY.gridRows, TOP_INSET, BOTTOM_INSET);
}

function handleTap(clientX: number, clientY: number): void {
  const snapshot = sim.snapshot();
  const w = window.innerWidth;
  const h = window.innerHeight;

  if (snapshot.outcome !== 'ongoing') {
    if (!outcomeHandled) return;
    const nextIndex =
      snapshot.outcome === 'victory'
        ? Math.min(LEVELS.length - 1, save.campaign.currentLevelIndex + 1)
        : save.campaign.currentLevelIndex;
    startLevel(nextIndex);
    return;
  }

  // 1) card hand
  const cardIndex = hitCard(w, h, snapshot.hand.length, clientX, clientY);
  if (cardIndex !== null) {
    ui.selectedUnit = null;
    if (ui.selectedCardIndex === cardIndex) {
      ui.selectedCardIndex = null;
    } else if (snapshot.hand[cardIndex].affordable) {
      ui.selectedCardIndex = cardIndex;
      analytics.track('card_selected', { unitId: snapshot.hand[cardIndex].unitId });
    }
    return;
  }

  // 2) board
  const layout = currentLayout();
  const cell = pixelToCell(layout, clientX, clientY);
  if (!cell) return;

  const occupant = snapshot.units.find((u) => u.col === cell.col && u.row === cell.row);

  // 2a) placing a selected card
  if (ui.selectedCardIndex !== null) {
    const card = snapshot.hand[ui.selectedCardIndex];
    const result = sim.summon(card.unitId, cell.col, cell.row);
    if (result.ok) {
      const def = unitDefs.get(result.unitId);
      analytics.track('unit_summoned', { unitId: result.unitId, family: def?.family });
      if (def?.family === 'gravity') analytics.track('gravity_unit_played', { unitId: result.unitId });
      ui.selectedCardIndex = null;
    }
    return;
  }

  // 2b) selecting / merging placed units
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
  const result = sim.merge(ui.selectedUnit, { col: cell.col, row: cell.row });
  if (result.ok) {
    analytics.track('unit_merged', { unitId: occupant.unitId, newLevel: result.newLevel });
    ui.selectedUnit = null;
  } else if (result.reason === 'mismatch') {
    ui.selectedUnit = { col: cell.col, row: cell.row };
  } else {
    ui.selectedUnit = null;
  }
}

canvas.addEventListener('pointerdown', (e) => handleTap(e.clientX, e.clientY));

function trackOutcomeOnce(snapshot: CombatSnapshot): void {
  if (snapshot.outcome !== 'ongoing' && !outcomeHandled) {
    outcomeHandled = true;
    analytics.track('combat_end', {
      outcome: snapshot.outcome,
      elapsedSec: snapshot.elapsedSec,
      kills: snapshot.kills,
      life: snapshot.life,
    });
    if (snapshot.outcome === 'victory') {
      save.campaign.currentLevelIndex = Math.min(LEVELS.length - 1, save.campaign.currentLevelIndex + 1);
      saveProvider.save(save);
    }
  }
}

let lastFrameMs: number | null = null;
let accumulatorSec = 0;

function frame(nowMs: number): void {
  if (lastFrameMs === null) lastFrameMs = nowMs;
  const frameDtSec = Math.min(0.25, (nowMs - lastFrameMs) / 1000);
  lastFrameMs = nowMs;
  accumulatorSec += frameDtSec;

  let ticks = 0;
  while (accumulatorSec >= TICK_SEC && ticks < MAX_TICKS_PER_FRAME) {
    sim.step(TICK_SEC);
    accumulatorSec -= TICK_SEC;
    ticks++;
  }

  const snapshot = sim.snapshot();
  trackOutcomeOnce(snapshot);

  const layout = currentLayout();
  drawCombatFrame(ctx, window.innerWidth, window.innerHeight, layout, snapshot, ui, renderContext);

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

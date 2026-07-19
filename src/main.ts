import { CombatSim } from './sim/CombatSim';
import type { CombatSnapshot } from './sim/types';
import { ECONOMY } from './data/economy';
import { UNITS, DEFAULT_DECK } from './data/units';
import { ENEMIES } from './data/enemies';
import { LEVELS } from './data/levels';
import { computeBoardLayout, pixelToCell } from './render/BoardLayout';
import { drawCombatFrame, TOP_INSET, BOTTOM_INSET, type RenderContext } from './render/CombatRenderer';
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
let save: SaveData = saveProvider.load() ?? createDefaultSaveData();

const unitDefs = new Map(UNITS.map((u) => [u.id, u]));
const enemyDefs = new Map(ENEMIES.map((e) => [e.id, e]));
const renderContext: RenderContext = { unitDefs, enemyDefs, levelName: '' };

const app = document.getElementById('app')!;
const canvas = document.createElement('canvas');
app.appendChild(canvas);
const ctx = canvas.getContext('2d')!;

let sim: CombatSim;
let selectedCell: { col: number; row: number } | null = null;
let outcomeHandled = false;
let lastWaveIndexSeen = 0;

function startLevel(index: number): void {
  const levelIndex = Math.max(0, Math.min(LEVELS.length - 1, index));
  const level = LEVELS[levelIndex];
  renderContext.levelName = level.name;
  const seed = Date.now() ^ (levelIndex * 7919);
  sim = new CombatSim({ economy: ECONOMY, level, deck: DEFAULT_DECK, unitDefs: UNITS, enemyDefs: ENEMIES }, seed);
  selectedCell = null;
  outcomeHandled = false;
  lastWaveIndexSeen = 0;
  analytics.track('combat_start', { levelId: level.id, levelIndex, seed });
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

  if (snapshot.outcome !== 'ongoing') {
    if (!outcomeHandled) return; // outcome just happened this frame — ignore the triggering tap
    const nextIndex =
      snapshot.outcome === 'victory'
        ? Math.min(LEVELS.length - 1, save.campaign.currentLevelIndex + 1)
        : save.campaign.currentLevelIndex;
    startLevel(nextIndex);
    return;
  }

  const layout = currentLayout();
  const cell = pixelToCell(layout, clientX, clientY);
  if (!cell) return;

  const grid = new Map(snapshot.units.map((u) => [`${u.col},${u.row}`, u]));
  const occupant = grid.get(`${cell.col},${cell.row}`);

  if (!occupant) {
    selectedCell = null;
    const result = sim.summon(cell.col, cell.row);
    if (result.ok) {
      const def = unitDefs.get(result.unitId);
      analytics.track('unit_summoned', { unitId: result.unitId, family: def?.family });
      if (def?.family === 'gravity') analytics.track('gravity_unit_played', { unitId: result.unitId });
    }
    return;
  }

  if (!selectedCell) {
    selectedCell = { col: cell.col, row: cell.row };
    return;
  }
  if (selectedCell.col === cell.col && selectedCell.row === cell.row) {
    selectedCell = null;
    return;
  }

  const result = sim.merge(selectedCell, { col: cell.col, row: cell.row });
  if (result.ok) {
    analytics.track('unit_merged', { unitId: occupant.unitId, newLevel: result.newLevel });
    selectedCell = null;
  } else if (result.reason === 'mismatch') {
    selectedCell = { col: cell.col, row: cell.row };
  } else {
    selectedCell = null;
  }
}

canvas.addEventListener('pointerdown', (e) => handleTap(e.clientX, e.clientY));

function trackOutcomeOnce(snapshot: CombatSnapshot): void {
  if (snapshot.currentWaveIndex !== lastWaveIndexSeen) {
    lastWaveIndexSeen = snapshot.currentWaveIndex;
  }
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
  drawCombatFrame(ctx, window.innerWidth, window.innerHeight, layout, snapshot, selectedCell, renderContext);

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

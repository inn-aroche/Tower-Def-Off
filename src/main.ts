import './style.css';
import type { ClassId } from './data/classes';
import type { MapDef } from './data/maps';
import type { TowerKind } from './data/towers';
import { GameLoop } from './core/GameLoop';
import { GameState } from './sim/GameState';
import { computeEffects } from './meta/SkillTree';
import { SaveManager } from './meta/SaveManager';
import { Renderer } from './render/Renderer';
import { HUD } from './ui/HUD';
import { UIManager } from './ui/UIManager';
import { AudioManager } from './audio/AudioManager';
import { analytics } from './tracking/Analytics';
import { essenceEarned } from './data/balance';

const app = document.getElementById('app')!;
const save = new SaveManager();
const audio = new AudioManager();
audio.enabled = save.get().settings.sound;

const canvas = document.createElement('canvas');
canvas.id = 'game-canvas';
app.appendChild(canvas);
const ctx = canvas.getContext('2d')!;
const renderer = new Renderer(ctx);

let gameState: GameState | null = null;
let paused = false;
let currentScreen: 'menu' | 'run' = 'menu';

function resizeCanvas(): void {
  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  gameState?.grid.layout(w, h);
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

const pauseOverlay = document.createElement('div');
pauseOverlay.className = 'overlay';
pauseOverlay.innerHTML = `
  <div class="panel stack" style="min-width:220px;">
    <div class="card-title center" style="justify-content:center;">⏸ Pause</div>
    <button class="btn btn-block" id="pause-resume">▶ Reprendre</button>
    <button class="btn btn-secondary btn-block" id="pause-quit">🏠 Abandonner</button>
  </div>
`;
app.appendChild(pauseOverlay);
pauseOverlay.querySelector('#pause-resume')!.addEventListener('click', () => {
  paused = false;
  pauseOverlay.classList.remove('visible');
});
pauseOverlay.querySelector('#pause-quit')!.addEventListener('click', () => {
  pauseOverlay.classList.remove('visible');
  paused = false;
  if (gameState) endRun('quit');
});

const hud = new HUD({
  onSelectTower: () => hud.hideTowerPopup(),
  onStartWave: () => gameState?.startNextWave(),
  onUltimate: () => {
    if (gameState?.activateUltimate()) audio.play('ultimate');
  },
  onPause: () => {
    if (!gameState) return;
    paused = true;
    pauseOverlay.classList.add('visible');
  },
  onUpgradeTower: (id) => {
    if (gameState?.upgradeTower(id)) {
      audio.play('upgrade');
      hud.hideTowerPopup();
    }
  },
  onSellTower: (id) => {
    if (gameState?.sellTower(id)) {
      audio.play('sell');
      hud.hideTowerPopup();
    }
  },
});
app.appendChild(hud.root);

const ui = new UIManager(app, save, {
  onStartRun: (classId, map) => startRun(classId, map),
  onResetSave: () => save.resetAll(),
  onToggleSound: (enabled) => {
    audio.enabled = enabled;
  },
});

function startRun(classId: ClassId, map: MapDef): void {
  const effects = computeEffects(classId, save.unlockedNodesFor(classId));
  gameState = new GameState(map, classId, effects);
  gameState.grid.layout(window.innerWidth, window.innerHeight);
  hud.setClass(classId);
  hud.clearSelection();
  hud.hideTowerPopup();
  currentScreen = 'run';
  canvas.classList.add('visible');
  hud.root.classList.add('visible');
  document.querySelectorAll('.screen').forEach((el) => el.classList.remove('visible'));
  analytics.track({ name: 'run_start', props: { class_id: classId, map_id: map.id, starting_gold: gameState.gold } });
}

function endRun(reason: 'defeat' | 'quit'): void {
  if (!gameState) return;
  const state = gameState;
  const essence = essenceEarned(state.wavesCleared, state.bossKills);
  save.addEssence(essence);
  save.recordRun(state.wavesCleared);
  analytics.track({
    name: 'run_end',
    props: { reason, waves_survived: state.wavesCleared, kills: state.kills, essence_earned: essence, duration_s: Math.round(state.durationSeconds()) },
  });
  ui.setRunSummary({ wavesSurvived: state.wavesCleared, kills: state.kills, essence });
  gameState = null;
  currentScreen = 'menu';
  canvas.classList.remove('visible');
  hud.root.classList.remove('visible');
  if (reason === 'defeat') audio.play('defeat');
  ui.show('runSummary');
}

// ---- Canvas input: place towers / open tower popup ----
let hoverCell: { col: number; row: number } | null = null;

function cellFromEvent(e: PointerEvent): { col: number; row: number } | null {
  if (!gameState) return null;
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  return gameState.grid.pixelToCell(x, y);
}

function isPlacementValid(cell: { col: number; row: number } | null): boolean {
  if (!gameState || !cell || !hud.selectedTower) return false;
  if (!gameState.grid.isBuildable(cell.col, cell.row)) return false;
  if (gameState.towers.some((t) => t.col === cell.col && t.row === cell.row)) return false;
  return true;
}

canvas.addEventListener('pointermove', (e) => {
  if (!gameState || !hud.selectedTower) {
    hoverCell = null;
    return;
  }
  hoverCell = cellFromEvent(e);
});

canvas.addEventListener('pointerdown', (e) => {
  if (!gameState || paused) return;
  const cell = cellFromEvent(e);
  if (!cell) return;

  if (hud.selectedTower) {
    const kind: TowerKind = hud.selectedTower;
    const placed = gameState.placeTower(kind, cell.col, cell.row);
    if (placed) {
      audio.play('place');
    } else {
      audio.play('tap');
    }
    return;
  }

  const tower = gameState.towers.find((t) => t.col === cell.col && t.row === cell.row);
  if (tower) {
    const center = gameState.grid.cellCenter(tower.col, tower.row);
    const rect = canvas.getBoundingClientRect();
    hud.showTowerPopup(tower, rect.left + center.x, rect.top + center.y, gameState.effects);
  } else {
    hud.hideTowerPopup();
  }
});

// ---- Main loop ----
const loop = new GameLoop((dt) => {
  if (currentScreen !== 'run' || !gameState || paused) return;
  const prevStatus = gameState.status;
  const prevWave = gameState.wave;
  gameState.update(dt);
  if (prevStatus === 'wave-active' && gameState.status === 'ready' && gameState.wave === prevWave) {
    audio.play('waveClear');
  }
  renderer.render(gameState, dt, hoverCell, hud.selectedTower ? isPlacementValid(hoverCell) : null);
  hud.update(gameState);
  if (gameState.status === 'defeat') {
    endRun('defeat');
  }
});
loop.start();

ui.show('title');

import { EventBus } from './core/EventBus';
import { GameLoop, SIM_DT } from './core/GameLoop';
import { GameState } from './sim/GameState';
import { Renderer } from './render/Renderer';
import { HUD } from './ui/HUD';
import { AudioManager } from './audio/AudioManager';
import { SaveManager } from './meta/SaveManager';
import { Progression } from './meta/Progression';
import type { AdProvider } from './platform/AdProvider';
import { NullProvider } from './platform/NullProvider';
import { PokiProvider } from './platform/PokiProvider';
import { CrazyGamesProvider } from './platform/CrazyGamesProvider';
import type { LevelConfig } from './data/LevelConfig';
import { TOWERS, type TowerId } from './data/towers';
import level01 from './data/levels/level-01.json';
import level02 from './data/levels/level-02.json';

const LEVELS: LevelConfig[] = [level01 as LevelConfig, level02 as LevelConfig];

function detectProvider(): AdProvider {
  if (typeof window.PokiSDK !== 'undefined') return new PokiProvider();
  if (typeof window.CrazyGames !== 'undefined') return new CrazyGamesProvider();
  return new NullProvider();
}

async function main(): Promise<void> {
  const container = document.getElementById('app');
  if (!container) throw new Error('#app root missing');

  const bus = new EventBus();
  const gameState = new GameState(bus);
  const renderer = new Renderer(container, gameState, bus);
  const audio = new AudioManager();
  const save = new SaveManager();
  const progression = new Progression(save);
  const provider = detectProvider();
  await provider.init();

  let currentLevelIndex = 0;
  let placementTowerId: TowerId | null = null;
  let selectedTowerId: string | null = null;
  let hoveredCell: [number, number] | null = null;
  let gameplayStarted = false;

  const hud = new HUD(container, gameState, bus, {
    onSelectTowerToPlace: (towerId) => {
      placementTowerId = towerId;
      selectedTowerId = null;
      hud.hideSelectedTower();
    },
    onUpgradeSelected: (branch) => {
      if (!selectedTowerId) return;
      gameState.upgradeTower(selectedTowerId, branch ?? null);
      audio.play('towerUpgrade');
      const tower = gameState.towers.find((t) => t.id === selectedTowerId);
      if (tower) hud.showSelectedTower(tower);
    },
    onSellSelected: () => {
      if (!selectedTowerId) return;
      gameState.sellTower(selectedTowerId);
      selectedTowerId = null;
      hud.hideSelectedTower();
    },
    onCallWaveEarly: () => gameState.callWaveEarly(),
    onRestart: () => {
      void (async () => {
        provider.gameplayStop();
        await provider.interstitial();
        loadLevel(currentLevelIndex);
        provider.gameplayStart();
      })();
    },
  });

  function loadLevel(index: number): void {
    currentLevelIndex = index;
    gameState.loadLevel(LEVELS[index]);
    renderer.loadLevelVisuals();
    hud.buildTowerBar(LEVELS[index].allowedTowers);
    hud.refresh();
    placementTowerId = null;
    selectedTowerId = null;
    hud.hideSelectedTower();
  }

  bus.on('towerPlaced', () => audio.play('towerPlace'));
  bus.on('towerPlacementRefused', () => audio.play('refuse'));
  bus.on('enemyLeaked', () => audio.play('enemyLeak'));
  bus.on('waveCompleted', () => audio.play('waveComplete'));
  bus.on('levelWon', ({ starsEarned }) => {
    progression.recordLevelResult(LEVELS[currentLevelIndex].id, starsEarned);
    provider.happyTime();
    provider.gameplayStop();
    const isLastLevel = currentLevelIndex >= LEVELS.length - 1;
    hud.showEndOverlay(true, starsEarned);
    if (!isLastLevel) currentLevelIndex += 1; // "Continuer" advances to the next level
  });
  bus.on('levelLost', () => {
    provider.gameplayStop();
    hud.showEndOverlay(false, 0);
  });

  const canvas = renderer.renderer.domElement;

  function ensureGameplayStarted(): void {
    if (gameplayStarted) return;
    gameplayStarted = true;
    audio.init();
    provider.gameplayStart();
  }

  canvas.addEventListener('pointermove', (ev) => {
    hoveredCell = renderer.screenToGridCell(ev.clientX, ev.clientY);
    if (placementTowerId && hoveredCell) {
      const [col, row] = hoveredCell;
      const cost = TOWERS[placementTowerId].tiers[0].cost;
      const valid = gameState.grid.isBuildable(col, row) && gameState.economy.canAfford(cost) && gameState.isTowerAllowed(placementTowerId);
      renderer.showPlacementGhost(col, row, valid);
    } else {
      renderer.hidePlacementGhost();
    }
  });

  canvas.addEventListener('pointerdown', (ev) => {
    ensureGameplayStarted();
    const cell = renderer.screenToGridCell(ev.clientX, ev.clientY);
    if (!cell) return;
    const [col, row] = cell;

    if (placementTowerId) {
      gameState.tryPlaceTower(placementTowerId, col, row);
      placementTowerId = null;
      hud.clearPlacementSelection();
      renderer.hidePlacementGhost();
      return;
    }

    const tower = gameState.towers.find((t) => t.col === col && t.row === row);
    if (tower) {
      selectedTowerId = tower.id;
      hud.showSelectedTower(tower);
    } else {
      selectedTowerId = null;
      hud.hideSelectedTower();
    }
  });

  window.addEventListener('resize', () => renderer.resize());

  const loop = new GameLoop(
    (dt) => gameState.step(dt),
    (alpha) => {
      renderer.update(SIM_DT, alpha);
      renderer.render();
    },
  );

  loadLevel(0);
  provider.loadingFinished();
  loop.start();

  function frame(now: number): void {
    loop.tick(now);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

void main();

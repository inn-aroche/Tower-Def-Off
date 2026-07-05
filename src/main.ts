import { EventBus } from './core/EventBus';
import { GameLoop, SIM_DT } from './core/GameLoop';
import { GameState } from './sim/GameState';
import { Renderer } from './render/Renderer';
import { HUD } from './ui/HUD';
import { MainMenu } from './ui/MainMenu';
import { Tutorial } from './ui/Tutorial';
import { AudioManager } from './audio/AudioManager';
import { SaveManager } from './meta/SaveManager';
import { Progression } from './meta/Progression';
import type { AdProvider } from './platform/AdProvider';
import { NullProvider } from './platform/NullProvider';
import { PokiProvider } from './platform/PokiProvider';
import { CrazyGamesProvider } from './platform/CrazyGamesProvider';
import type { LevelConfig } from './data/LevelConfig';
import { TOWERS, type TowerId } from './data/towers';
import { buildSurvivalLevelConfig, survivalScore, SURVIVAL_TIERS, type SurvivalTier } from './data/survival';
import level01 from './data/levels/level-01.json';
import level02 from './data/levels/level-02.json';
import level03 from './data/levels/level-03.json';
import level04 from './data/levels/level-04.json';
import level05 from './data/levels/level-05.json';
import level06 from './data/levels/level-06.json';
import level07 from './data/levels/level-07.json';
import level08 from './data/levels/level-08.json';
import level09 from './data/levels/level-09.json';
import level10 from './data/levels/level-10.json';

const LEVELS: LevelConfig[] = [
  level01, level02, level03, level04, level05, level06, level07, level08, level09, level10,
] as unknown as LevelConfig[];

function detectProvider(): AdProvider {
  if (typeof window.PokiSDK !== 'undefined') return new PokiProvider();
  if (typeof window.CrazyGames !== 'undefined') return new CrazyGamesProvider();
  return new NullProvider();
}

type Mode = { kind: 'menu' } | { kind: 'level'; levelId: number } | { kind: 'survival'; tier: SurvivalTier };

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

  renderer.setTowerSkin(save.selectedSkin);
  renderer.setReducedEffects(save.reduceEffects);
  audio.setMuted(save.audioMuted);

  let mode: Mode = { kind: 'menu' };
  let placementTowerId: TowerId | null = null;
  let selectedTowerId: string | null = null;
  let gameplayStarted = false;

  const tutorial = new Tutorial(container, bus);

  const menu = new MainMenu(container, LEVELS, progression, save, {
    onSelectLevel: (levelId) => enterLevel(levelId),
    onSelectSurvival: (tier) => enterSurvival(tier),
    onSelectSkin: (skinId) => {
      save.selectSkin(skinId);
      renderer.setTowerSkin(skinId);
    },
    onToggleReduceEffects: (value) => {
      save.setReduceEffects(value);
      renderer.setReducedEffects(value);
    },
    onToggleAudioMuted: (value) => {
      save.setAudioMuted(value);
      audio.setMuted(value);
    },
  });

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
        audio.setMuted(true); // muted for the ad break per SDK requirements (§15)
        await provider.interstitial();
        audio.setMuted(false);
        if (mode.kind === 'level') {
          if (gameState.outcome === 'won') {
            const nextId = mode.levelId + 1;
            if (nextId <= LEVELS.length) enterLevel(nextId);
            else openMenu();
          } else {
            enterLevel(mode.levelId); // retry same level on defeat
          }
        } else if (mode.kind === 'survival') {
          enterSurvival(mode.tier); // fresh run at the same tier
        }
        provider.gameplayStart();
      })();
    },
    onOpenMenu: () => openMenu(),
  });

  function openMenu(): void {
    const returnScreen = mode.kind === 'survival' ? 'survival' : mode.kind === 'level' ? 'adventure' : 'title';
    mode = { kind: 'menu' };
    hud.hide();
    tutorial.stop();
    menu.show(returnScreen);
    provider.gameplayStop();
  }

  function enterLevel(levelId: number): void {
    const level = LEVELS.find((l) => l.id === levelId);
    if (!level || !progression.isLevelUnlocked(levelId)) return;
    mode = { kind: 'level', levelId };
    hud.setWaveDisplayMode(0, false);
    startRun(level);
  }

  function enterSurvival(tier: SurvivalTier): void {
    if (!progression.isSurvivalUnlocked()) return;
    mode = { kind: 'survival', tier };
    hud.setWaveDisplayMode(SURVIVAL_TIERS[tier].startWaveIndex, true);
    startRun(buildSurvivalLevelConfig(tier));
  }

  function startRun(level: LevelConfig): void {
    menu.hide();
    hud.show();
    gameState.loadLevel(level);
    renderer.loadLevelVisuals();
    hud.buildTowerBar(level.allowedTowers);
    hud.refresh();
    placementTowerId = null;
    selectedTowerId = null;
    hud.hideSelectedTower();
    if (level.tutorial) tutorial.start();
    else tutorial.stop();
  }

  bus.on('towerPlaced', () => audio.play('towerPlace'));
  bus.on('towerPlacementRefused', () => audio.play('refuse'));
  bus.on('enemyLeaked', () => audio.play('enemyLeak'));
  bus.on('waveCompleted', () => audio.play('waveComplete'));
  bus.on('levelWon', ({ starsEarned }) => {
    provider.happyTime();
    provider.gameplayStop();
    if (mode.kind === 'level') {
      const unlockedSkins = progression.recordLevelResult(mode.levelId, starsEarned);
      menu.refresh();
      hud.showEndOverlay(true, {
        stars: starsEarned,
        message: unlockedSkins.length ? `Nouveau skin débloqué : ${unlockedSkins.join(', ')} !` : undefined,
        primaryLabel: mode.levelId < LEVELS.length ? 'Niveau suivant' : 'Retour au menu',
      });
    } else if (mode.kind === 'survival') {
      const absoluteWave = survivalAbsoluteWaveIndex();
      const score = survivalScore(mode.tier, absoluteWave);
      save.reportSurvivalRun(mode.tier, score, absoluteWave);
      hud.showEndOverlay(true, { message: `Survie terminée — score ${score}`, primaryLabel: 'Rejouer' });
    }
  });
  bus.on('levelLost', () => {
    provider.gameplayStop();
    if (mode.kind === 'survival') {
      const absoluteWave = survivalAbsoluteWaveIndex();
      const score = survivalScore(mode.tier, absoluteWave);
      save.reportSurvivalRun(mode.tier, score, absoluteWave);
      hud.showEndOverlay(false, { message: `Score final : ${score} (vague ${absoluteWave + 1})`, primaryLabel: 'Rejouer' });
    } else {
      hud.showEndOverlay(false, {});
    }
  });

  function survivalAbsoluteWaveIndex(): number {
    if (mode.kind !== 'survival') return 0;
    const level = buildSurvivalLevelConfig(mode.tier);
    const startIndex = level.id - 1000; // survival ids are 1000 + startWaveIndex, see data/survival.ts
    return startIndex + gameState.waveScheduler.waveIndex;
  }

  const canvas = renderer.renderer.domElement;

  function ensureGameplayStarted(): void {
    if (gameplayStarted) return;
    gameplayStarted = true;
    audio.init();
    audio.startAmbient();
    provider.gameplayStart();
  }

  canvas.addEventListener('pointermove', (ev) => {
    if (mode.kind === 'menu') return;
    const hoveredCell = renderer.screenToGridCell(ev.clientX, ev.clientY);
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
    if (mode.kind === 'menu') return;
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
    (dt) => {
      if (mode.kind !== 'menu') gameState.step(dt);
    },
    (alpha) => {
      renderer.update(SIM_DT, alpha);
      renderer.render();
    },
  );

  hud.hide();
  menu.show();
  provider.loadingFinished();
  loop.start();

  function frame(now: number): void {
    loop.tick(now);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

void main();

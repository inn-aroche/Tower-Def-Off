import * as THREE from 'three';
import { CameraRig } from './CameraRig';
import { GridView } from './views/GridView';
import { TowerView } from './views/TowerView';
import { EnemyView } from './views/EnemyView';
import { ProjectileView } from './views/ProjectileView';
import { Particles } from './fx/Particles';
import { DamageNumbers } from './fx/DamageNumbers';
import type { GameState } from '../sim/GameState';
import type { EventBus } from '../core/EventBus';
import type { TowerId } from '../data/towers';

const TOWER_TRACER_COLORS: Record<TowerId, number> = {
  wall: 0x6b7280, // unused in practice — the Wall never targets anything, so 'projectileFired' never fires for it
  laser: 0xff4757,
  mortar: 0xffa502,
  tesla: 0x70a1ff,
  cryo: 0x7bed9f,
};

/** Reads GameState every frame and drives Three.js — never mutates simulation state. */
export class Renderer {
  readonly scene = new THREE.Scene();
  readonly renderer: THREE.WebGLRenderer;
  readonly cameraRig: CameraRig;
  private gridView = new GridView();
  private towerView = new TowerView();
  private enemyView = new EnemyView();
  private projectileView = new ProjectileView();
  private particles = new Particles();
  private damageNumbers = new DamageNumbers();
  private unsubscribers: Array<() => void> = [];
  private reducedEffects = false;

  constructor(private readonly container: HTMLElement, private readonly gameState: GameState, private readonly bus: EventBus) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(this.renderer.domElement);

    this.cameraRig = new CameraRig(container.clientWidth / container.clientHeight);
    this.scene.background = new THREE.Color(0x12151c);

    const hemi = new THREE.HemisphereLight(0xffffff, 0x3a4256, 1.3);
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(6, 10, 4);
    const ambient = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(hemi, sun, ambient);

    this.scene.add(this.gridView.group);
    this.scene.add(this.towerView.group);
    this.scene.add(this.enemyView.group);
    this.scene.add(this.projectileView.group);
    this.scene.add(this.particles.group);
    this.scene.add(this.damageNumbers.group);

    this.bindEvents();
    this.resize();
  }

  private bindEvents(): void {
    this.unsubscribers.push(
      this.bus.on('towerPlaced', ({ towerId }) => {
        const tower = this.gameState.towers.find((t) => t.id === towerId);
        if (tower) this.towerView.add(tower);
      }),
      this.bus.on('towerSold', ({ towerId }) => this.towerView.remove(towerId)),
      this.bus.on('towerUpgraded', ({ towerId }) => {
        const tower = this.gameState.towers.find((t) => t.id === towerId);
        if (tower) this.towerView.updateTier(tower);
      }),
      this.bus.on('flowFieldRecomputed', () => this.gridView.rebuild(this.gameState.grid)),
      this.bus.on('enemyKilled', ({ col, row }) => {
        this.particles.burst(col + 0.5, 0.3, row + 0.5, 0xffd700, this.reducedEffects ? 3 : 10);
      }),
      this.bus.on('enemyLeaked', () => {
        if (!this.reducedEffects) this.cameraRig.shake(0.06, 0.15);
      }),
      this.bus.on('damageDealt', ({ enemyId, amount, x, y }) => {
        const target = this.gameState.enemies.find((e) => e.id === enemyId);
        const height = target?.def.movement === 'flying' ? 1.7 : 0.6;
        this.damageNumbers.spawn(x, height, y, amount);
      }),
      this.bus.on('projectileFired', ({ towerId, targetId }) => {
        const tower = this.gameState.towers.find((t) => t.id === towerId);
        const target = this.gameState.enemies.find((e) => e.id === targetId);
        if (!tower || !target) return;
        const stats = tower.effectiveStats;
        if (!this.reducedEffects && stats.splashRadius > 0 && stats.fireRatePerSec < 1) {
          this.cameraRig.shake(0.1, 0.12); // punchy feedback for slow, heavy-hitting mortar shots
        }
        const from = new THREE.Vector3(tower.col + 0.5, 0.6, tower.row + 0.5);
        const height = target.def.movement === 'flying' ? 1.4 : 0.25;
        const to = new THREE.Vector3(target.x, height, target.y);
        this.projectileView.fire(from, to, TOWER_TRACER_COLORS[tower.towerId]);
      }),
    );
  }

  loadLevelVisuals(): void {
    this.towerView.clear();
    this.cameraRig.frameGrid(this.gameState.grid.cols, this.gameState.grid.rows);
    this.gridView.rebuild(this.gameState.grid);
  }

  setTowerSkin(skinId: string): void {
    this.towerView.setSkin(skinId);
  }

  setReducedEffects(value: boolean): void {
    this.reducedEffects = value;
    this.damageNumbers.enabled = !value;
  }

  showPlacementGhost(col: number, row: number, valid: boolean): void {
    this.gridView.showGhost(col, row, valid);
  }

  hidePlacementGhost(): void {
    this.gridView.hideGhost();
  }

  update(dt: number, alpha: number): void {
    this.enemyView.sync(this.gameState.enemies, alpha, this.cameraRig.billboardQuaternion);
    this.towerView.syncDisabled(this.gameState.towers, this.cameraRig.billboardQuaternion);
    this.projectileView.update(dt);
    this.particles.update(dt);
    this.damageNumbers.update(dt);
    this.cameraRig.update(dt);
  }

  render(): void {
    this.renderer.render(this.scene, this.cameraRig.camera);
  }

  resize(): void {
    const { clientWidth, clientHeight } = this.container;
    this.renderer.setSize(clientWidth, clientHeight);
    this.cameraRig.setAspect(clientWidth / clientHeight);
  }

  screenToGridCell(clientX: number, clientY: number): [number, number] | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.cameraRig.camera);
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(groundPlane, hit)) return null;
    return [Math.floor(hit.x), Math.floor(hit.z)];
  }

  dispose(): void {
    for (const unsub of this.unsubscribers) unsub();
    this.renderer.dispose();
  }
}

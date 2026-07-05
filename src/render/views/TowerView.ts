import * as THREE from 'three';
import type { Tower } from '../../sim/Tower';
import type { TowerId } from '../../data/towers';
import { SKINS, getSkin } from '../../data/skins';

interface TowerVisual {
  root: THREE.Group;
  body: THREE.Mesh;
  disabledOverlay: THREE.Mesh;
  towerId: TowerId;
}

/** Cone reads as "attack tower" for the 4 combat pieces; the Wall gets a squat block instead,
 * so its silhouette alone signals "this is a barrier, not a shooter" before you even select it. */
function geometryFor(towerId: TowerId): THREE.BufferGeometry {
  return towerId === 'wall' ? new THREE.BoxGeometry(0.62, 0.42, 0.62) : new THREE.ConeGeometry(0.32, 0.7, 6);
}

/** One low-poly mesh per placed tower (counts stay small — a few dozen max — so no instancing needed). */
export class TowerView {
  readonly group = new THREE.Group();
  private visuals = new Map<string, TowerVisual>();
  private colors: Record<TowerId, number> = SKINS[0].towerColors;

  setSkin(skinId: string): void {
    this.colors = getSkin(skinId).towerColors;
    for (const visual of this.visuals.values()) {
      (visual.body.material as THREE.MeshStandardMaterial).color.set(this.colors[visual.towerId]);
    }
  }

  add(tower: Tower): void {
    const geo = geometryFor(tower.towerId);
    const mat = new THREE.MeshStandardMaterial({ color: this.colors[tower.towerId] });
    const body = new THREE.Mesh(geo, mat);
    body.position.y = tower.towerId === 'wall' ? 0.21 : 0.35;

    const overlayGeo = new THREE.RingGeometry(0.4, 0.48, 16);
    const overlayMat = new THREE.MeshBasicMaterial({ color: 0x3742fa, transparent: true, opacity: 0, side: THREE.DoubleSide });
    const disabledOverlay = new THREE.Mesh(overlayGeo, overlayMat);
    disabledOverlay.rotation.x = -Math.PI / 2;
    disabledOverlay.position.y = 0.02;

    const root = new THREE.Group();
    root.position.set(tower.col + 0.5, 0, tower.row + 0.5);
    root.add(body);
    root.add(disabledOverlay);
    this.applyTierScale(body, tower.tier);
    this.group.add(root);
    this.visuals.set(tower.id, { root, body, disabledOverlay, towerId: tower.towerId });
  }

  private applyTierScale(body: THREE.Mesh, tier: number): void {
    const scale = 0.85 + tier * 0.18;
    body.scale.setScalar(scale);
  }

  updateTier(tower: Tower): void {
    const visual = this.visuals.get(tower.id);
    if (!visual) return;
    this.applyTierScale(visual.body, tower.tier);
  }

  syncDisabled(towers: Tower[]): void {
    for (const tower of towers) {
      const visual = this.visuals.get(tower.id);
      if (!visual) continue;
      const mat = visual.disabledOverlay.material as THREE.MeshBasicMaterial;
      mat.opacity = tower.isDisabled ? 0.6 : 0;
    }
  }

  remove(towerId: string): void {
    const visual = this.visuals.get(towerId);
    if (!visual) return;
    this.group.remove(visual.root);
    visual.body.geometry.dispose();
    (visual.body.material as THREE.Material).dispose();
    visual.disabledOverlay.geometry.dispose();
    (visual.disabledOverlay.material as THREE.Material).dispose();
    this.visuals.delete(towerId);
  }

  /** Removes every placed-tower mesh — must be called on level load, since GameState resets
   * gameState.towers without emitting per-tower 'towerSold' events for the previous level. */
  clear(): void {
    for (const towerId of [...this.visuals.keys()]) this.remove(towerId);
  }
}

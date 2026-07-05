import * as THREE from 'three';
import type { Tower } from '../../sim/Tower';
import type { TowerId } from '../../data/towers';
import { towerTexture } from '../textures';

interface TowerVisual {
  root: THREE.Group;
  body: THREE.Mesh;
  disabledOverlay: THREE.Mesh;
  towerId: TowerId;
  tier: 1 | 2 | 3;
}

/** Billboard art fills roughly 60-70% of its 640x640 canvas (padding around the object), so the
 * unit quad is scaled up beyond 1 grid cell to give the tower real visual presence. */
const BASE_BILLBOARD_SCALE = 1.4;

/** Shared by every tower billboard — a unit quad with its base pinned to local y=0 (instead of
 * PlaneGeometry's default centered [-0.5, 0.5]) so towers plant their feet on the ground. */
const billboardGeometry = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);

/** One billboarded, camera-facing sprite per placed tower (counts stay small — a few dozen max —
 * so no instancing needed). Materials are unlit (MeshBasicMaterial): the source art is already
 * cel-shaded/pre-lit, so running it through the scene's lights too would double up the shading. */
export class TowerView {
  readonly group = new THREE.Group();
  private visuals = new Map<string, TowerVisual>();
  private skinId = 'default';

  setSkin(skinId: string): void {
    this.skinId = skinId;
    for (const visual of this.visuals.values()) this.applyMaterial(visual);
  }

  add(tower: Tower): void {
    const body = new THREE.Mesh(billboardGeometry, new THREE.MeshBasicMaterial({ transparent: true, side: THREE.DoubleSide }));

    const overlayGeo = new THREE.RingGeometry(0.4, 0.48, 16);
    const overlayMat = new THREE.MeshBasicMaterial({ color: 0x3742fa, transparent: true, opacity: 0, side: THREE.DoubleSide });
    const disabledOverlay = new THREE.Mesh(overlayGeo, overlayMat);
    disabledOverlay.rotation.x = -Math.PI / 2;
    disabledOverlay.position.y = 0.02;

    const root = new THREE.Group();
    root.position.set(tower.col + 0.5, 0, tower.row + 0.5);
    root.add(body);
    root.add(disabledOverlay);
    this.group.add(root);

    const visual: TowerVisual = { root, body, disabledOverlay, towerId: tower.towerId, tier: tower.tier as 1 | 2 | 3 };
    this.visuals.set(tower.id, visual);
    this.applyMaterial(visual);
    this.applyTierScale(body, tower.tier);
  }

  private applyMaterial(visual: TowerVisual): void {
    const mat = visual.body.material as THREE.MeshBasicMaterial;
    mat.map = towerTexture(visual.towerId, visual.tier, this.skinId);
    mat.needsUpdate = true;
  }

  private applyTierScale(body: THREE.Mesh, tier: number): void {
    const scale = BASE_BILLBOARD_SCALE * (0.85 + tier * 0.18);
    body.scale.set(scale, scale, 1);
  }

  updateTier(tower: Tower): void {
    const visual = this.visuals.get(tower.id);
    if (!visual) return;
    visual.tier = tower.tier as 1 | 2 | 3;
    this.applyMaterial(visual);
    this.applyTierScale(visual.body, tower.tier);
  }

  /** Re-applies the camera-facing rotation to every placed tower — cheap (a quaternion copy per
   * tower) and piggybacks on the per-frame syncDisabled() call so towers reorient immediately if
   * the camera's fixed direction changes (portrait/landscape switch, see CameraRig.reframe()). */
  syncDisabled(towers: Tower[], billboardQuaternion: THREE.Quaternion): void {
    // Only the body billboard faces the camera — disabledOverlay is a sibling, not a child of
    // body, and must stay flat on the ground (its own fixed rotation.x = -PI/2), not billboarded.
    for (const visual of this.visuals.values()) visual.body.quaternion.copy(billboardQuaternion);
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

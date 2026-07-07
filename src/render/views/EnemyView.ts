import * as THREE from 'three';
import type { Enemy } from '../../sim/Enemy';
import type { EnemyType } from '../../data/enemies';
import { toonGradientMap } from '../textures';

const ENEMY_COLORS: Record<EnemyType, number> = {
  soldier: 0xdfe4ea,
  swarm: 0xfffa65,
  golem: 0x576574,
  drone: 0x48dbfb,
  kamikaze: 0xff6b6b,
  boss: 0x8e44ad,
};

const MAX_PER_TYPE = 220;
const MAX_BARS = 260;
const BAR_WIDTH = 0.62;
const BAR_HEIGHT = 0.11;
const BAR_Y_ABOVE_MODEL = 0.45;

/** How much larger the outline shell is than the body it wraps — the gap between the two is what
 * reads as the outline's stroke width. */
const OUTLINE_SCALE = 1.18;
const OUTLINE_COLOR = 0x181a24;

function healthBarColor(hpPct: number): THREE.Color {
  if (hpPct > 0.5) return new THREE.Color(0x2ecc71);
  if (hpPct > 0.25) return new THREE.Color(0xf1c40f);
  return new THREE.Color(0xe74c3c);
}

/**
 * Distinct low-poly silhouette per enemy type — not just color — so type is readable under any
 * color-vision deficiency (§14 accessibility requirement): capsule (soldier), sharp tetrahedron
 * (swarm, reads as "small threat"), blocky cube (golem, reads as "armored"), octahedron (drone,
 * airborne), spiked cone (kamikaze, reads as "danger"), large icosahedron (boss).
 */
function geometryFor(type: EnemyType): THREE.BufferGeometry {
  switch (type) {
    case 'soldier':
      return new THREE.CapsuleGeometry(0.22, 0.3, 3, 6);
    case 'swarm':
      return new THREE.TetrahedronGeometry(0.22);
    case 'golem':
      return new THREE.BoxGeometry(0.5, 0.6, 0.5);
    case 'drone':
      return new THREE.OctahedronGeometry(0.28);
    case 'kamikaze':
      return new THREE.ConeGeometry(0.24, 0.5, 5);
    case 'boss':
      return new THREE.IcosahedronGeometry(0.55);
  }
}

/** One InstancedMesh per enemy type — required to stay smooth at ~150 concurrent enemies (Nuée swarms). */
export class EnemyView {
  readonly group = new THREE.Group();
  private meshes = new Map<EnemyType, THREE.InstancedMesh>();
  /** Slightly-inflated, black, back-face-only copy of each body mesh rendered behind it — the
   * classic "inverted hull" trick for a bold cartoon outline (cheap: no post-processing pass). */
  private outlineMeshes = new Map<EnemyType, THREE.InstancedMesh>();
  private dummy = new THREE.Object3D();
  /** Separate from `dummy` — its quaternion is set to the fixed billboard rotation and must never
   * leak back into the (unrotated) enemy-body transforms computed from the shared `dummy`. */
  private barDummy = new THREE.Object3D();
  private barBg: THREE.InstancedMesh;
  private barFill: THREE.InstancedMesh;

  constructor() {
    for (const type of Object.keys(ENEMY_COLORS) as EnemyType[]) {
      const geometry = geometryFor(type);
      // MeshToonMaterial + a hard-edged gradient map gives flat, banded cel shading instead of
      // MeshStandardMaterial's smooth PBR falloff — reads as a cartoon mobile-game monster.
      const material = new THREE.MeshToonMaterial({ color: ENEMY_COLORS[type], gradientMap: toonGradientMap() });
      const mesh = new THREE.InstancedMesh(geometry, material, MAX_PER_TYPE);
      mesh.count = 0;
      // See GridView's identical setting — Three.js frustum-culls an InstancedMesh by its
      // GEOMETRY's local-origin bounding sphere, not by where its scattered instances actually
      // sit, which can wrongly cull the entire mesh under the tight-fit orthographic camera.
      mesh.frustumCulled = false;
      this.meshes.set(type, mesh);

      const outlineGeometry = geometry.clone().scale(OUTLINE_SCALE, OUTLINE_SCALE, OUTLINE_SCALE);
      const outlineMaterial = new THREE.MeshBasicMaterial({ color: OUTLINE_COLOR, side: THREE.BackSide });
      const outlineMesh = new THREE.InstancedMesh(outlineGeometry, outlineMaterial, MAX_PER_TYPE);
      outlineMesh.count = 0;
      outlineMesh.frustumCulled = false;
      this.outlineMeshes.set(type, outlineMesh);

      this.group.add(outlineMesh, mesh);
    }

    const bgGeometry = new THREE.PlaneGeometry(BAR_WIDTH, BAR_HEIGHT);
    const bgMaterial = new THREE.MeshBasicMaterial({ color: 0x1a1a1a, depthTest: false, transparent: true, opacity: 0.85 });
    this.barBg = new THREE.InstancedMesh(bgGeometry, bgMaterial, MAX_BARS);
    this.barBg.count = 0;
    this.barBg.renderOrder = 10;
    this.barBg.frustumCulled = false;

    // Left-anchored: geometry shifted so its local x spans [0, BAR_WIDTH] instead of the
    // PlaneGeometry default [-w/2, w/2] — scaling x by hpPct then shrinks from the left edge inward.
    const fillGeometry = new THREE.PlaneGeometry(BAR_WIDTH, BAR_HEIGHT);
    fillGeometry.translate(BAR_WIDTH / 2, 0, 0);
    const fillMaterial = new THREE.MeshBasicMaterial({ depthTest: false, transparent: true });
    this.barFill = new THREE.InstancedMesh(fillGeometry, fillMaterial, MAX_BARS);
    this.barFill.count = 0;
    this.barFill.renderOrder = 11;
    this.barFill.frustumCulled = false;

    this.group.add(this.barBg, this.barFill);
  }

  /** Rebuild instance transforms for every enemy type from current sim state, interpolated by alpha.
   * `billboardQuaternion` comes from CameraRig — the camera is fixed but has two distinct
   * orientations (landscape vs. portrait, see CameraRig.reframe()), so the health bars must face
   * whichever one is currently active rather than a hardcoded direction. */
  sync(enemies: Enemy[], alpha: number, billboardQuaternion: THREE.Quaternion): void {
    this.barDummy.quaternion.copy(billboardQuaternion);
    const counters = new Map<EnemyType, number>();
    for (const mesh of this.meshes.values()) mesh.count = 0;
    for (const mesh of this.outlineMeshes.values()) mesh.count = 0;
    let barIdx = 0;

    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      const mesh = this.meshes.get(enemy.type);
      const outlineMesh = this.outlineMeshes.get(enemy.type);
      if (!mesh || !outlineMesh) continue;
      const idx = counters.get(enemy.type) ?? 0;
      if (idx >= MAX_PER_TYPE) continue;

      const x = THREE.MathUtils.lerp(enemy.prevX, enemy.x, alpha);
      const y = THREE.MathUtils.lerp(enemy.prevY, enemy.y, alpha);
      const height = enemy.def.movement === 'flying' ? 1.4 : 0.25;
      this.dummy.position.set(x, height, y);
      const hpPct = enemy.hp / enemy.maxHp;
      const scale = 0.6 + hpPct * 0.4;
      this.dummy.scale.setScalar(scale);
      this.dummy.updateMatrix();
      mesh.setMatrixAt(idx, this.dummy.matrix);
      // Outline geometry is already pre-inflated (see OUTLINE_SCALE) — the same per-instance
      // matrix (position + HP scale) works for both, no extra scaling needed here.
      outlineMesh.setMatrixAt(idx, this.dummy.matrix);

      counters.set(enemy.type, idx + 1);

      if (barIdx < MAX_BARS) {
        const barY = height + BAR_Y_ABOVE_MODEL;

        this.barDummy.position.set(x, barY, y);
        this.barDummy.scale.set(1, 1, 1);
        this.barDummy.updateMatrix();
        this.barBg.setMatrixAt(barIdx, this.barDummy.matrix);

        this.barDummy.position.set(x - BAR_WIDTH / 2, barY, y);
        this.barDummy.scale.set(Math.max(hpPct, 0), 1, 1);
        this.barDummy.updateMatrix();
        this.barFill.setMatrixAt(barIdx, this.barDummy.matrix);
        this.barFill.setColorAt(barIdx, healthBarColor(hpPct));

        barIdx++;
      }
    }

    for (const [type, mesh] of this.meshes) {
      mesh.count = counters.get(type) ?? 0;
      mesh.instanceMatrix.needsUpdate = true;
    }
    for (const [type, mesh] of this.outlineMeshes) {
      mesh.count = counters.get(type) ?? 0;
      mesh.instanceMatrix.needsUpdate = true;
    }

    this.barBg.count = barIdx;
    this.barBg.instanceMatrix.needsUpdate = true;
    this.barFill.count = barIdx;
    this.barFill.instanceMatrix.needsUpdate = true;
    if (this.barFill.instanceColor) this.barFill.instanceColor.needsUpdate = true;
  }
}

import * as THREE from 'three';
import type { Enemy } from '../../sim/Enemy';
import type { EnemyType } from '../../data/enemies';

const ENEMY_COLORS: Record<EnemyType, number> = {
  soldier: 0xdfe4ea,
  swarm: 0xfffa65,
  golem: 0x576574,
  drone: 0x48dbfb,
  kamikaze: 0xff6b6b,
  boss: 0x8e44ad,
};

const MAX_PER_TYPE = 220;

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
  private dummy = new THREE.Object3D();

  constructor() {
    for (const type of Object.keys(ENEMY_COLORS) as EnemyType[]) {
      const geometry = geometryFor(type);
      const material = new THREE.MeshStandardMaterial({ color: ENEMY_COLORS[type] });
      const mesh = new THREE.InstancedMesh(geometry, material, MAX_PER_TYPE);
      mesh.count = 0;
      this.meshes.set(type, mesh);
      this.group.add(mesh);
    }
  }

  /** Rebuild instance transforms for every enemy type from current sim state, interpolated by alpha. */
  sync(enemies: Enemy[], alpha: number): void {
    const counters = new Map<EnemyType, number>();
    for (const mesh of this.meshes.values()) mesh.count = 0;

    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      const mesh = this.meshes.get(enemy.type);
      if (!mesh) continue;
      const idx = counters.get(enemy.type) ?? 0;
      if (idx >= MAX_PER_TYPE) continue;

      const x = THREE.MathUtils.lerp(enemy.prevX, enemy.x, alpha);
      const y = THREE.MathUtils.lerp(enemy.prevY, enemy.y, alpha);
      const height = enemy.def.movement === 'flying' ? 1.4 : 0.25;
      this.dummy.position.set(x, height, y);
      const scale = 0.6 + (enemy.hp / enemy.maxHp) * 0.4;
      this.dummy.scale.setScalar(scale);
      this.dummy.updateMatrix();
      mesh.setMatrixAt(idx, this.dummy.matrix);

      counters.set(enemy.type, idx + 1);
    }

    for (const [type, mesh] of this.meshes) {
      mesh.count = counters.get(type) ?? 0;
      mesh.instanceMatrix.needsUpdate = true;
    }
  }
}

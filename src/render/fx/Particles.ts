import * as THREE from 'three';

interface Particle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  active: boolean;
}

const POOL_SIZE = 150;

/** Pooled low-poly burst particles for enemy deaths — no per-death allocation. */
export class Particles {
  readonly group = new THREE.Group();
  private pool: Particle[] = [];
  private geometry = new THREE.BoxGeometry(0.08, 0.08, 0.08);

  constructor() {
    for (let i = 0; i < POOL_SIZE; i++) {
      const material = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true });
      const mesh = new THREE.Mesh(this.geometry, material);
      mesh.visible = false;
      this.group.add(mesh);
      this.pool.push({ mesh, velocity: new THREE.Vector3(), life: 0, maxLife: 0.5, active: false });
    }
  }

  burst(x: number, y: number, z: number, color: number, count = 8): void {
    let spawned = 0;
    for (const p of this.pool) {
      if (spawned >= count) break;
      if (p.active) continue;
      p.active = true;
      p.life = 0;
      p.maxLife = 0.4 + Math.random() * 0.2;
      p.mesh.visible = true;
      p.mesh.position.set(x, y, z);
      (p.mesh.material as THREE.MeshBasicMaterial).color.set(color);
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = 1;
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 1.5;
      p.velocity.set(Math.cos(angle) * speed, 2 + Math.random() * 2, Math.sin(angle) * speed);
      spawned++;
    }
  }

  update(dt: number): void {
    for (const p of this.pool) {
      if (!p.active) continue;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }
      p.velocity.y -= 9.8 * dt;
      p.mesh.position.addScaledVector(p.velocity, dt);
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = 1 - p.life / p.maxLife;
    }
  }
}

import * as THREE from 'three';

interface Tracer {
  line: THREE.Line;
  elapsed: number;
  duration: number;
  active: boolean;
}

const MAX_TRACERS = 64;
const TRACER_DURATION = 0.12;

/**
 * Purely cosmetic projectile tracers. Damage is resolved instantly (hitscan) in sim/Combat.ts;
 * this just animates a short-lived line from tower to target so hits feel readable.
 */
export class ProjectileView {
  readonly group = new THREE.Group();
  private pool: Tracer[] = [];

  constructor() {
    for (let i = 0; i < MAX_TRACERS; i++) {
      const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
      const material = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
      const line = new THREE.Line(geometry, material);
      line.visible = false;
      this.group.add(line);
      this.pool.push({ line, elapsed: 0, duration: TRACER_DURATION, active: false });
    }
  }

  fire(from: THREE.Vector3, to: THREE.Vector3, color: number): void {
    const tracer = this.pool.find((t) => !t.active);
    if (!tracer) return;
    tracer.active = true;
    tracer.elapsed = 0;
    tracer.line.visible = true;
    (tracer.line.material as THREE.LineBasicMaterial).color.set(color);
    const positions = tracer.line.geometry.attributes.position as THREE.BufferAttribute;
    positions.setXYZ(0, from.x, from.y, from.z);
    positions.setXYZ(1, to.x, to.y, to.z);
    positions.needsUpdate = true;
  }

  update(dt: number): void {
    for (const tracer of this.pool) {
      if (!tracer.active) continue;
      tracer.elapsed += dt;
      const mat = tracer.line.material as THREE.LineBasicMaterial;
      mat.opacity = Math.max(0, 1 - tracer.elapsed / tracer.duration);
      if (tracer.elapsed >= tracer.duration) {
        tracer.active = false;
        tracer.line.visible = false;
      }
    }
  }
}

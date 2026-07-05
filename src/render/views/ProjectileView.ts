import * as THREE from 'three';

interface Tracer {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  elapsed: number;
  duration: number;
  active: boolean;
}

const MAX_TRACERS = 64;
const TRACER_DURATION = 0.25;
/** Fraction of TRACER_DURATION spent at full brightness before fading — a punchy "flash then
 * fade" reads far more clearly than a linear fade from the very first frame. */
const HOLD_FRACTION = 0.4;
const BEAM_RADIUS = 0.07;

/**
 * Purely cosmetic projectile tracers. Damage is resolved instantly (hitscan) in sim/Combat.ts;
 * this animates a short-lived glowing beam from tower to target so hits read clearly during play.
 * A stretched cylinder mesh (not a THREE.Line) because line width is clamped to ~1px on most
 * WebGL backends regardless of the `linewidth` material property — far too thin to notice.
 */
export class ProjectileView {
  readonly group = new THREE.Group();
  private pool: Tracer[] = [];
  private geometry = new THREE.CylinderGeometry(BEAM_RADIUS, BEAM_RADIUS, 1, 6);

  constructor() {
    for (let i = 0; i < MAX_TRACERS; i++) {
      const material = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(this.geometry, material);
      mesh.visible = false;
      this.group.add(mesh);
      this.pool.push({ mesh, material, elapsed: 0, duration: TRACER_DURATION, active: false });
    }
  }

  fire(from: THREE.Vector3, to: THREE.Vector3, color: number): void {
    const tracer = this.pool.find((t) => !t.active);
    if (!tracer) return;
    tracer.active = true;
    tracer.elapsed = 0;
    tracer.mesh.visible = true;
    tracer.material.color.set(color);
    tracer.material.opacity = 1;

    const delta = new THREE.Vector3().subVectors(to, from);
    const length = Math.max(delta.length(), 0.001);
    tracer.mesh.position.addVectors(from, to).multiplyScalar(0.5);
    tracer.mesh.scale.set(1, length, 1);
    tracer.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
  }

  update(dt: number): void {
    for (const tracer of this.pool) {
      if (!tracer.active) continue;
      tracer.elapsed += dt;
      const t = tracer.elapsed / tracer.duration;
      tracer.material.opacity = t < HOLD_FRACTION ? 1 : Math.max(0, 1 - (t - HOLD_FRACTION) / (1 - HOLD_FRACTION));
      if (tracer.elapsed >= tracer.duration) {
        tracer.active = false;
        tracer.mesh.visible = false;
      }
    }
  }
}

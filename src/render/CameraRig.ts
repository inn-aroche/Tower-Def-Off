import * as THREE from 'three';

/** Fixed 3/4 perspective camera framing the whole grid — no orbit controls, matches the "read in 5s" pillar. */
export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  private shakeOffset = new THREE.Vector3();
  private shakeTime = 0;
  private shakeStrength = 0;
  private target = new THREE.Vector3();

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 200);
  }

  frameGrid(cols: number, rows: number): void {
    const cx = cols / 2;
    const cy = rows / 2;
    const span = Math.max(cols, rows);
    this.target.set(cx, 0, cy);
    const height = span * 1.1;
    const back = span * 0.85;
    this.camera.position.set(cx, height, cy + back);
    this.camera.lookAt(this.target);
  }

  setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  shake(strength: number, duration: number): void {
    this.shakeStrength = Math.max(this.shakeStrength, strength);
    this.shakeTime = Math.max(this.shakeTime, duration);
  }

  update(dt: number): void {
    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
      const s = this.shakeStrength * Math.max(0, this.shakeTime);
      this.shakeOffset.set((Math.random() - 0.5) * s, (Math.random() - 0.5) * s * 0.5, (Math.random() - 0.5) * s);
      this.camera.position.add(this.shakeOffset);
      this.camera.lookAt(this.target);
      this.camera.position.sub(this.shakeOffset);
    }
  }
}

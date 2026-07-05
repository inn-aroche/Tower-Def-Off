import * as THREE from 'three';

/** Camera was tuned by eye against a roughly landscape/square viewport — below this aspect
 * ratio the grid's width starts clipping out of frame, so distance gets compensated below. */
const DESIGN_ASPECT = 1.3;

/** Fixed 3/4 perspective camera framing the whole grid — no orbit controls, matches the "read in 5s" pillar. */
export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  private shakeOffset = new THREE.Vector3();
  private shakeTime = 0;
  private shakeStrength = 0;
  private target = new THREE.Vector3();
  private cols = 0;
  private rows = 0;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 200);
  }

  frameGrid(cols: number, rows: number): void {
    this.cols = cols;
    this.rows = rows;
    this.reframe();
  }

  setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    // Re-run the framing math too — on a narrow/portrait viewport the camera must pull back
    // further to keep the grid's full width in frame (see DESIGN_ASPECT above).
    if (this.cols > 0 && this.rows > 0) this.reframe();
  }

  private reframe(): void {
    const cx = this.cols / 2;
    const cy = this.rows / 2;
    const span = Math.max(this.cols, this.rows);
    const aspect = this.camera.aspect;
    const widthCompensation = aspect < DESIGN_ASPECT ? DESIGN_ASPECT / aspect : 1;
    this.target.set(cx, 0, cy);
    const height = span * 1.1 * widthCompensation;
    const back = span * 0.85 * widthCompensation;
    this.camera.position.set(cx, height, cy + back);
    this.camera.lookAt(this.target);
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

import * as THREE from 'three';

/** Extra world-space headroom above the flat grid footprint so tall content (tower spires, flying
 * enemies, health bars floating above them) doesn't clip against the frustum's top edge. */
const CONTENT_HEIGHT = 2.6;

/** Multiplies the tight-fit frustum so content doesn't touch the screen edges. */
const FRAME_MARGIN = 1.08;

/** Fixed 3/4 orthographic camera framing the whole grid — no orbit controls, matches the "read in
 * 5s" pillar. Orthographic (not perspective) so vertical objects (towers, enemies) stay upright on
 * screen everywhere in frame, not just dead-center — see billboardQuaternion below for why. */
export class CameraRig {
  readonly camera: THREE.OrthographicCamera;
  /** Rotation that makes a unit plane (default normal +Z) face this fixed camera — shared by every
   * billboarded sprite (enemy health bars, tower/tile textures) so they don't each hardcode their
   * own camera-direction assumption. Recomputed in reframe() since portrait vs landscape puts the
   * camera in a genuinely different position, not just a distance change. Because the camera is
   * orthographic, every view ray is parallel — this single shared direction is the exactly correct
   * "face the camera" rotation for a billboard at ANY position in the grid, not just one centered
   * in frame (the perspective camera this replaced only got that right dead-center, and visibly
   * skewed/leaned billboards and un-billboarded 3D shapes alike anywhere else in frame).
   */
  readonly billboardQuaternion = new THREE.Quaternion();
  private shakeOffset = new THREE.Vector3();
  private shakeTime = 0;
  private shakeStrength = 0;
  private target = new THREE.Vector3();
  private cols = 0;
  private rows = 0;
  private aspect: number;

  constructor(aspect: number) {
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
    this.aspect = aspect;
  }

  frameGrid(cols: number, rows: number): void {
    this.cols = cols;
    this.rows = rows;
    this.reframe();
  }

  setAspect(aspect: number): void {
    this.aspect = aspect;
    if (this.cols > 0 && this.rows > 0) this.reframe();
  }

  private reframe(): void {
    const cx = this.cols / 2;
    const cy = this.rows / 2;
    const span = Math.max(this.cols, this.rows);

    // Levels are landscape-shaped (cols > rows). Below aspect 1, rotate the rig 90°: the grid's
    // short axis (rows) becomes the screen-width axis and its long axis (cols) recedes into screen
    // depth — enemies still read as marching down the screen toward the player (see below), and the
    // portrait screen's tall dimension is what actually needs the room.
    const portrait = this.aspect < 1;

    this.target.set(cx, 0, cy);
    // Fixed elevation direction (same 3/4 angle either orientation) — an orthographic camera's
    // apparent zoom comes from the frustum size set below, not from this distance, so any distance
    // far enough to clear the whole grid plus near/far planes works.
    const distance = span * 4 + 10;
    // Portrait: camera sits at LARGER x than the grid, looking back toward -X — col 0 (spawn) ends
    // up farthest away (near the top of the screen), col (cols-1) (exit/base) ends up closest (near
    // the bottom, close to the tower shop) — enemies read as marching down the screen toward the
    // player, matching the requested direction.
    const dir = (portrait ? new THREE.Vector3(0.85, 1.1, 0) : new THREE.Vector3(0, 1.1, 0.85)).normalize();
    this.camera.position.copy(this.target).addScaledVector(dir, distance);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(this.target);
    this.camera.updateMatrixWorld(true);

    const facing = this.camera.position.clone().sub(this.target).normalize();
    this.billboardQuaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), facing);

    // Tight-fit the orthographic frustum to the grid's actual footprint (+ headroom for tall
    // content) for the CURRENT viewport aspect ratio, instead of guessing a fixed distance/FOV —
    // this is what makes the board fill the screen edge-to-edge instead of leaving black margins.
    const view = this.camera.matrixWorldInverse;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const corner = new THREE.Vector3();
    for (const x of [0, this.cols]) {
      for (const z of [0, this.rows]) {
        for (const y of [0, CONTENT_HEIGHT]) {
          corner.set(x, y, z).applyMatrix4(view);
          minX = Math.min(minX, corner.x);
          maxX = Math.max(maxX, corner.x);
          minY = Math.min(minY, corner.y);
          maxY = Math.max(maxY, corner.y);
        }
      }
    }

    let halfW = Math.max(Math.abs(minX), Math.abs(maxX)) * FRAME_MARGIN;
    let halfH = Math.max(Math.abs(minY), Math.abs(maxY)) * FRAME_MARGIN;
    // "Contain" fit: whichever axis is relatively tighter for this viewport gets expanded so
    // nothing is cropped, leaving any resulting slack on the other axis (unavoidable — the grid's
    // own aspect ratio rarely matches the viewport's exactly).
    if (halfW / halfH > this.aspect) halfH = halfW / this.aspect;
    else halfW = halfH * this.aspect;

    this.camera.left = -halfW;
    this.camera.right = halfW;
    this.camera.top = halfH;
    this.camera.bottom = -halfH;
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

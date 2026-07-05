import * as THREE from 'three';
import type { Grid, CellKind } from '../../sim/Grid';
import { tileTexture, type TileKind } from '../textures';

/** Maps sim cell kinds to their tile art. 'occupied' (buildable ground with a tower on it) reuses
 * the ground texture — the tower's own billboard on top is what actually signals occupancy.
 * There's no sim-level concept of "the path" (the flow field can route through any empty cell
 * depending on where towers land), so `tile_path.png` isn't wired up to anything yet. */
const TILE_FOR_KIND: Record<CellKind, TileKind> = {
  empty: 'ground',
  occupied: 'ground',
  blocked: 'blocked',
  spawn: 'spawn',
  exit: 'exit',
};

const MAX_CELLS_PER_KIND = 260;

/** Renders every grid cell as a camera-facing billboarded tile (Dice-Dreams-style floating
 * islands, per the art direction) — one InstancedMesh per tile kind so a full rebuild is still
 * just a handful of draw calls regardless of grid size (levels top out at 15x10). */
export class GridView {
  readonly group = new THREE.Group();
  private meshes = new Map<TileKind, THREE.InstancedMesh>();
  private highlightMesh: THREE.Mesh;
  private lastGrid: Grid | null = null;
  private billboardQuaternion = new THREE.Quaternion();

  constructor() {
    const geometry = new THREE.PlaneGeometry(0.94, 0.94);
    for (const kind of ['ground', 'path', 'blocked', 'spawn', 'exit'] as TileKind[]) {
      const material = new THREE.MeshBasicMaterial({ map: tileTexture(kind), transparent: true, side: THREE.DoubleSide });
      const mesh = new THREE.InstancedMesh(geometry, material, MAX_CELLS_PER_KIND);
      mesh.count = 0;
      this.meshes.set(kind, mesh);
      this.group.add(mesh);
    }

    const highlightGeo = new THREE.PlaneGeometry(1, 1);
    const highlightMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthTest: false });
    this.highlightMesh = new THREE.Mesh(highlightGeo, highlightMat);
    this.highlightMesh.visible = false;
    this.highlightMesh.renderOrder = 20;
    this.group.add(this.highlightMesh);
  }

  /** Tiles face the fixed camera the same way towers/health bars do. Unlike a single Mesh, an
   * InstancedMesh's own object-level rotation would swing every instance around the MESH's
   * origin rather than each tile's own position — the rotation has to be baked into each
   * per-instance matrix instead, so changing it means rebuilding all instances. */
  setBillboardQuaternion(quaternion: THREE.Quaternion): void {
    this.billboardQuaternion.copy(quaternion);
    this.highlightMesh.quaternion.copy(quaternion);
    if (this.lastGrid) this.rebuild(this.lastGrid);
  }

  rebuild(grid: Grid): void {
    this.lastGrid = grid;
    const dummy = new THREE.Object3D();
    dummy.quaternion.copy(this.billboardQuaternion);
    const counters = new Map<TileKind, number>();

    for (let row = 0; row < grid.rows; row++) {
      for (let col = 0; col < grid.cols; col++) {
        const tileKind = TILE_FOR_KIND[grid.kindAt(col, row)];
        const mesh = this.meshes.get(tileKind);
        if (!mesh) continue;
        const idx = counters.get(tileKind) ?? 0;
        if (idx >= MAX_CELLS_PER_KIND) continue;

        dummy.position.set(col + 0.5, 0, row + 0.5);
        dummy.updateMatrix();
        mesh.setMatrixAt(idx, dummy.matrix);
        counters.set(tileKind, idx + 1);
      }
    }

    for (const [kind, mesh] of this.meshes) {
      mesh.count = counters.get(kind) ?? 0;
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  showGhost(col: number, row: number, valid: boolean): void {
    this.highlightMesh.visible = true;
    this.highlightMesh.position.set(col + 0.5, 0.03, row + 0.5);
    (this.highlightMesh.material as THREE.MeshBasicMaterial).color.set(valid ? 0x2ed573 : 0xff4757);
  }

  hideGhost(): void {
    this.highlightMesh.visible = false;
  }
}

import * as THREE from 'three';
import type { Grid, CellKind } from '../../sim/Grid';
import { flatTileTexture, type TileKind } from '../textures';

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

/** Renders every grid cell as a flat tile lying on the ground plane — laid flat (not billboarded
 * toward the camera like towers/health bars) so adjacent cells tile together seamlessly into one
 * connected floor instead of reading as separate tilted cards. One InstancedMesh per tile kind so
 * a full rebuild is still just a handful of draw calls regardless of grid size. */
export class GridView {
  readonly group = new THREE.Group();
  private meshes = new Map<TileKind, THREE.InstancedMesh>();
  private highlightMesh: THREE.Mesh;

  constructor() {
    // Lying flat: rotate the default XY-plane geometry -90° about X so its normal points up (+Y)
    // instead of at the camera (+Z). Baked into the shared geometry, not per-instance, since every
    // tile always lies flat regardless of camera direction (unlike towers, which billboard). Sized
    // very slightly over 1x1 so adjacent tiles overlap a hair rather than leaving a seam.
    const geometry = new THREE.PlaneGeometry(1.01, 1.01).rotateX(-Math.PI / 2);
    for (const kind of ['ground', 'path', 'blocked', 'spawn', 'exit'] as TileKind[]) {
      const material = new THREE.MeshBasicMaterial({ map: flatTileTexture(kind) });
      const mesh = new THREE.InstancedMesh(geometry, material, MAX_CELLS_PER_KIND);
      mesh.count = 0;
      // Three.js frustum-culls an InstancedMesh by its GEOMETRY's local-origin bounding sphere,
      // not by where its instances actually sit — with the tight-fit orthographic camera (unlike
      // the old perspective camera's generous FOV) that origin can fall outside the frustum even
      // though most instances (scattered across the whole grid) are clearly visible, culling the
      // entire mesh to nothing. These instances are already bounded by the on-screen grid, so
      // per-object culling has no benefit here anyway.
      mesh.frustumCulled = false;
      this.meshes.set(kind, mesh);
      this.group.add(mesh);
    }

    const highlightGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const highlightMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthTest: false });
    this.highlightMesh = new THREE.Mesh(highlightGeo, highlightMat);
    this.highlightMesh.visible = false;
    this.highlightMesh.renderOrder = 20;
    this.group.add(this.highlightMesh);
  }

  rebuild(grid: Grid): void {
    const dummy = new THREE.Object3D();
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

import * as THREE from 'three';
import type { Grid } from '../../sim/Grid';

const COLORS: Record<string, number> = {
  empty: 0x5c6b8a,
  blocked: 0x2b2f3a,
  spawn: 0x2ed573,
  exit: 0xff6b6b,
  occupied: 0x8a92a8,
};

/** Renders every grid cell as one instanced flat box, recolored on topology change. Cheap to rebuild — grids top out around 22x14. */
export class GridView {
  readonly group = new THREE.Group();
  private mesh: THREE.InstancedMesh | null = null;
  private highlightMesh: THREE.Mesh;

  constructor() {
    const highlightGeo = new THREE.BoxGeometry(1, 0.08, 1);
    const highlightMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 });
    this.highlightMesh = new THREE.Mesh(highlightGeo, highlightMat);
    this.highlightMesh.visible = false;
    this.group.add(this.highlightMesh);
  }

  rebuild(grid: Grid): void {
    if (this.mesh) {
      this.group.remove(this.mesh);
      this.mesh.geometry.dispose();
      (this.mesh.material as THREE.Material).dispose();
    }
    const count = grid.cols * grid.rows;
    const geometry = new THREE.BoxGeometry(0.94, 0.15, 0.94);
    // Deliberately no `vertexColors: true` here: for InstancedMesh, per-instance color already
    // flows through via `instanceColor` once setColorAt() is called below. Setting the material's
    // vertexColors flag additionally makes the vertex shader multiply by a geometry `color`
    // attribute that doesn't exist on this BoxGeometry, zeroing every instance to black.
    const material = new THREE.MeshLambertMaterial();
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    let i = 0;
    for (let row = 0; row < grid.rows; row++) {
      for (let col = 0; col < grid.cols; col++) {
        dummy.position.set(col + 0.5, 0, row + 0.5);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        color.set(COLORS[grid.kindAt(col, row)] ?? COLORS.empty);
        mesh.setColorAt(i, color);
        i++;
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.mesh = mesh;
    this.group.add(mesh);
  }

  showGhost(col: number, row: number, valid: boolean): void {
    this.highlightMesh.visible = true;
    this.highlightMesh.position.set(col + 0.5, 0.05, row + 0.5);
    (this.highlightMesh.material as THREE.MeshBasicMaterial).color.set(valid ? 0x2ed573 : 0xff4757);
  }

  hideGhost(): void {
    this.highlightMesh.visible = false;
  }
}

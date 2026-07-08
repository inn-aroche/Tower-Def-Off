import * as THREE from 'three';
import type { Grid } from '../../sim/Grid';
import type { Economy } from '../../sim/Economy';
import { toonGradientMap } from '../textures';

const OUTLINE_SCALE = 1.12;
const OUTLINE_COLOR = 0x181a24;
const BAR_WIDTH = 0.9;
const BAR_HEIGHT = 0.14;
const BAR_Y = 1.55;

function healthBarColor(ratio: number): THREE.Color {
  if (ratio > 0.5) return new THREE.Color(0x2ecc71);
  if (ratio > 0.25) return new THREE.Color(0xf1c40f);
  return new THREE.Color(0xe74c3c);
}

/** The keep the player is actually defending — sits on the exit cell(s), toon-shaded and outlined
 * to match EnemyView's cartoon style, with a health bar mirroring its "base HP" pool. Its own weak
 * defensive fire (the 'base' Tower in GameState) is rendered through the normal ProjectileView
 * pipeline, same as any other tower — this view only owns the static keep model + HP bar. */
export class BaseView {
  readonly group = new THREE.Group();
  private bar: THREE.Mesh;
  private barBg: THREE.Mesh;

  constructor() {
    const bodyMat = new THREE.MeshToonMaterial({ color: 0xf1c40f, gradientMap: toonGradientMap() });
    const roofMat = new THREE.MeshToonMaterial({ color: 0x5c4a3a, gradientMap: toonGradientMap() });
    const outlineMat = new THREE.MeshBasicMaterial({ color: OUTLINE_COLOR, side: THREE.BackSide });

    const bodyGeo = new THREE.CylinderGeometry(0.38, 0.44, 0.55, 8);
    const roofGeo = new THREE.ConeGeometry(0.5, 0.4, 8);
    roofGeo.translate(0, 0.475, 0);

    const keep = new THREE.Group();
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.275;
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.y = 0.55;
    keep.add(body, roof);

    const bodyOutline = new THREE.Mesh(bodyGeo.clone().scale(OUTLINE_SCALE, OUTLINE_SCALE, OUTLINE_SCALE), outlineMat);
    bodyOutline.position.y = 0.275;
    const roofOutline = new THREE.Mesh(roofGeo.clone().scale(OUTLINE_SCALE, OUTLINE_SCALE, OUTLINE_SCALE), outlineMat);
    roofOutline.position.y = 0.55;
    keep.add(bodyOutline, roofOutline);

    this.group.add(keep);

    const bgGeo = new THREE.PlaneGeometry(BAR_WIDTH, BAR_HEIGHT);
    const bgMat = new THREE.MeshBasicMaterial({ color: 0x1a1a1a, depthTest: false, transparent: true, opacity: 0.85 });
    this.barBg = new THREE.Mesh(bgGeo, bgMat);
    this.barBg.renderOrder = 10;

    // Left-anchored, same trick as EnemyView's health bars: local x spans [0, BAR_WIDTH] instead
    // of PlaneGeometry's default centered range, so scaling x by hpRatio shrinks from the left edge.
    const fillGeo = new THREE.PlaneGeometry(BAR_WIDTH, BAR_HEIGHT);
    fillGeo.translate(BAR_WIDTH / 2, 0, 0);
    const fillMat = new THREE.MeshBasicMaterial({ depthTest: false, transparent: true });
    this.bar = new THREE.Mesh(fillGeo, fillMat);
    this.bar.renderOrder = 11;

    this.group.add(this.barBg, this.bar);
  }

  /** Positions the keep + bar at every exit cell (almost always exactly one) — called once per
   * level load, same lifecycle as GridView.rebuild(). */
  placeAt(grid: Grid): void {
    const [col, row] = grid.exits[0] ?? [0, 0];
    this.group.position.set(col + 0.5, 0, row + 0.5);
  }

  /** `billboardQuaternion` keeps the HP bar facing the camera, same as EnemyView's bars. */
  sync(economy: Economy, billboardQuaternion: THREE.Quaternion): void {
    this.barBg.quaternion.copy(billboardQuaternion);
    this.barBg.position.set(0, BAR_Y, 0);

    const ratio = Math.max(economy.livesRatio, 0);
    this.bar.quaternion.copy(billboardQuaternion);
    this.bar.position.set(-BAR_WIDTH / 2, BAR_Y, 0);
    this.bar.scale.set(ratio, 1, 1);
    (this.bar.material as THREE.MeshBasicMaterial).color.copy(healthBarColor(ratio));
  }
}

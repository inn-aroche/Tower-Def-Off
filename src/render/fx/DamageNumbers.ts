import * as THREE from 'three';

interface FloatingNumber {
  sprite: THREE.Sprite;
  life: number;
  maxLife: number;
  active: boolean;
}

const POOL_SIZE = 40;
const MAX_LIFE = 0.7;
const RISE_SPEED = 1.4;

function makeTexture(text: string): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 32;
  const ctx = canvas.getContext('2d')!;
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillStyle = '#ffe066';
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 3;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeText(text, 32, 16);
  ctx.fillText(text, 32, 16);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Pooled floating damage numbers (§12 "chiffres de dégâts flottants (option désactivable)").
 * Textures are cached per distinct rounded value since the same few numbers repeat constantly.
 */
export class DamageNumbers {
  readonly group = new THREE.Group();
  private pool: FloatingNumber[] = [];
  private textureCache = new Map<string, THREE.Texture>();
  enabled = true;

  constructor() {
    for (let i = 0; i < POOL_SIZE; i++) {
      const material = new THREE.SpriteMaterial({ transparent: true, depthTest: false });
      const sprite = new THREE.Sprite(material);
      sprite.scale.set(0.6, 0.3, 1);
      sprite.visible = false;
      this.group.add(sprite);
      this.pool.push({ sprite, life: 0, maxLife: MAX_LIFE, active: false });
    }
  }

  private textureFor(amount: number): THREE.Texture {
    const key = Math.round(amount).toString();
    let tex = this.textureCache.get(key);
    if (!tex) {
      tex = makeTexture(key);
      this.textureCache.set(key, tex);
    }
    return tex;
  }

  spawn(x: number, y: number, z: number, amount: number): void {
    if (!this.enabled) return;
    const slot = this.pool.find((n) => !n.active);
    if (!slot) return;
    slot.active = true;
    slot.life = 0;
    slot.sprite.visible = true;
    slot.sprite.position.set(x + (Math.random() - 0.5) * 0.2, y, z);
    slot.sprite.material.map = this.textureFor(amount);
    slot.sprite.material.opacity = 1;
    slot.sprite.material.needsUpdate = true;
  }

  update(dt: number): void {
    for (const slot of this.pool) {
      if (!slot.active) continue;
      slot.life += dt;
      if (slot.life >= slot.maxLife) {
        slot.active = false;
        slot.sprite.visible = false;
        continue;
      }
      slot.sprite.position.y += RISE_SPEED * dt;
      slot.sprite.material.opacity = 1 - slot.life / slot.maxLife;
    }
  }
}

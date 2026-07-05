import type { TowerId } from './towers';

export interface SkinDef {
  id: string;
  name: string;
  /** Total campaign stars (out of 30) required to unlock. 0 = unlocked from the start. */
  starsRequired: number;
  towerColors: Record<TowerId, number>;
}

export const SKINS: SkinDef[] = [
  {
    id: 'default',
    name: 'Standard',
    starsRequired: 0,
    towerColors: { laser: 0xff4757, mortar: 0xffa502, tesla: 0x70a1ff, cryo: 0x7bed9f },
  },
  {
    id: 'verdant',
    name: 'Vert Émeraude',
    starsRequired: 10,
    towerColors: { laser: 0x2ed573, mortar: 0x7bed9f, tesla: 0x1e90ff, cryo: 0x00d2d3 },
  },
  {
    id: 'inferno',
    name: 'Braise',
    starsRequired: 20,
    towerColors: { laser: 0xff6348, mortar: 0xffa502, tesla: 0xeccc68, cryo: 0xff4757 },
  },
];

export function getSkin(id: string): SkinDef {
  return SKINS.find((s) => s.id === id) ?? SKINS[0];
}

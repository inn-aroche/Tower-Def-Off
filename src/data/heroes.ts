import type { HeroConfig, HeroPower, Rarity } from '../sim/types';

/**
 * Heroes — deployable champions with HP + a signature power. All balance lives here. A hero is
 * summoned onto the board once its energy bar fills; it fights, casts its power on a period, takes
 * contact damage from nearby enemies, and leaves on timeout or death (then the bar recharges).
 */
export interface HeroDef {
  id: string;
  name: string;
  rarity: Rarity;
  /** One-line French description of the signature power. */
  powerText: string;
  base: {
    maxHp: number;
    damage: number;
    attackIntervalSec: number;
    range: number;
    rechargeSec: number;
    durationSec: number;
    marchSpeed: number;
  };
  power: HeroPower;
}

export const HEROES: HeroDef[] = [
  // ── Communs ────────────────────────────────────────────────────────────
  {
    id: 'ranger', name: 'Rôdeuse', rarity: 'common',
    powerText: 'Volée d’éclairs : rebondit sur 2 ennemis proches.',
    base: { maxHp: 95, damage: 14, attackIntervalSec: 0.55, range: 3.0, rechargeSec: 20, durationSec: 11, marchSpeed: 1.15 },
    power: { kind: 'chain', periodSec: 2.4, jumps: 2, range: 2.4, damage: 16 },
  },
  {
    id: 'squire', name: 'Écuyer', rarity: 'common',
    powerText: 'Cri d’espoir : soigne un peu la base.',
    base: { maxHp: 150, damage: 12, attackIntervalSec: 0.8, range: 1.8, rechargeSec: 22, durationSec: 12, marchSpeed: 0.9 },
    power: { kind: 'rally', periodSec: 5, radius: 0, healBase: 1 },
  },
  {
    id: 'brawler', name: 'Cogneur', rarity: 'common',
    powerText: 'Coup de bouclier : repousse les ennemis proches.',
    base: { maxHp: 170, damage: 15, attackIntervalSec: 0.75, range: 1.7, rechargeSec: 21, durationSec: 12, marchSpeed: 0.85 },
    power: { kind: 'knockback', periodSec: 3, radius: 1.6, distance: 1, damage: 6 },
  },
  {
    id: 'spark_mage', name: 'Étincelle', rarity: 'common',
    powerText: 'Petite nova arcanique.',
    base: { maxHp: 100, damage: 16, attackIntervalSec: 0.7, range: 2.4, rechargeSec: 20, durationSec: 11, marchSpeed: 1 },
    power: { kind: 'nova', periodSec: 2.6, radius: 1.6, damage: 18 },
  },

  // ── Rares ──────────────────────────────────────────────────────────────
  {
    id: 'pyromancer', name: 'Pyromancien', rarity: 'rare',
    powerText: 'Nova de feu : explosion de zone périodique.',
    base: { maxHp: 120, damage: 20, attackIntervalSec: 0.7, range: 2.6, rechargeSec: 22, durationSec: 12, marchSpeed: 1 },
    power: { kind: 'nova', periodSec: 2.5, radius: 1.8, damage: 30 },
  },
  {
    id: 'frost_witch', name: 'Sorcière de givre', rarity: 'rare',
    powerText: 'Nova de givre : ralentit les ennemis proches.',
    base: { maxHp: 125, damage: 13, attackIntervalSec: 0.75, range: 2.5, rechargeSec: 23, durationSec: 12, marchSpeed: 0.95 },
    power: { kind: 'frost_nova', periodSec: 3, radius: 2.0, slowFactor: 0.55, durationSec: 1.8 },
  },
  {
    id: 'druid', name: 'Druide', rarity: 'rare',
    powerText: 'Sève vitale : soigne régulièrement la base.',
    base: { maxHp: 175, damage: 13, attackIntervalSec: 0.8, range: 2.2, rechargeSec: 24, durationSec: 13, marchSpeed: 0.85 },
    power: { kind: 'rally', periodSec: 4, radius: 0, healBase: 1 },
  },
  {
    id: 'assassin', name: 'Assassin', rarity: 'rare',
    powerText: 'Lames en chaîne : frappe 3 ennemis proches.',
    base: { maxHp: 110, damage: 22, attackIntervalSec: 0.45, range: 2.0, rechargeSec: 21, durationSec: 10, marchSpeed: 1.3 },
    power: { kind: 'chain', periodSec: 2.2, jumps: 3, range: 2.2, damage: 18 },
  },
  {
    id: 'valkyrie', name: 'Valkyrie', rarity: 'rare',
    powerText: 'Bourrasque : repousse et blesse les ennemis.',
    base: { maxHp: 160, damage: 18, attackIntervalSec: 0.65, range: 2.1, rechargeSec: 23, durationSec: 12, marchSpeed: 1.05 },
    power: { kind: 'knockback', periodSec: 3, radius: 1.9, distance: 1.3, damage: 12 },
  },
  {
    id: 'flame_dancer', name: 'Danseuse de flammes', rarity: 'rare',
    powerText: 'Volutes ardentes : nova de feu rapide.',
    base: { maxHp: 115, damage: 18, attackIntervalSec: 0.55, range: 2.4, rechargeSec: 22, durationSec: 12, marchSpeed: 1.1 },
    power: { kind: 'nova', periodSec: 2.0, radius: 1.7, damage: 22 },
  },
  {
    id: 'templar', name: 'Templier', rarity: 'rare',
    powerText: 'Serment : très résistant, soigne la base.',
    base: { maxHp: 210, damage: 15, attackIntervalSec: 0.8, range: 1.9, rechargeSec: 25, durationSec: 14, marchSpeed: 0.75 },
    power: { kind: 'rally', periodSec: 4, radius: 0, healBase: 1 },
  },

  // ── Épiques ────────────────────────────────────────────────────────────
  {
    id: 'frost_king', name: 'Roi de givre', rarity: 'epic',
    powerText: 'Nova de givre majeure : gèle largement.',
    base: { maxHp: 150, damage: 12, attackIntervalSec: 0.8, range: 2.3, rechargeSec: 24, durationSec: 12, marchSpeed: 0.9 },
    power: { kind: 'frost_nova', periodSec: 3, radius: 2.6, slowFactor: 0.45, durationSec: 2.2 },
  },
  {
    id: 'paladin', name: 'Paladin', rarity: 'epic',
    powerText: 'Cri de ralliement : très tanky, soigne la base.',
    base: { maxHp: 230, damage: 14, attackIntervalSec: 0.8, range: 1.9, rechargeSec: 26, durationSec: 14, marchSpeed: 0.75 },
    power: { kind: 'rally', periodSec: 4, radius: 0, healBase: 2 },
  },
  {
    id: 'archmage', name: 'Archimage', rarity: 'epic',
    powerText: 'Cataclysme arcanique : grande nova de dégâts.',
    base: { maxHp: 140, damage: 24, attackIntervalSec: 0.65, range: 2.8, rechargeSec: 26, durationSec: 12, marchSpeed: 0.95 },
    power: { kind: 'nova', periodSec: 2.4, radius: 2.3, damage: 40 },
  },
  {
    id: 'stormcaller', name: 'Invocateur d’orage', rarity: 'epic',
    powerText: 'Foudre en chaîne : frappe 4 ennemis.',
    base: { maxHp: 145, damage: 18, attackIntervalSec: 0.55, range: 3.0, rechargeSec: 25, durationSec: 12, marchSpeed: 1 },
    power: { kind: 'chain', periodSec: 2.2, jumps: 4, range: 2.6, damage: 26 },
  },
  {
    id: 'earthshaker', name: 'Briseur de terre', rarity: 'epic',
    powerText: 'Séisme : repousse fort et blesse une large zone.',
    base: { maxHp: 220, damage: 20, attackIntervalSec: 0.8, range: 2.0, rechargeSec: 27, durationSec: 13, marchSpeed: 0.7 },
    power: { kind: 'knockback', periodSec: 3.2, radius: 2.4, distance: 1.8, damage: 20 },
  },
  {
    id: 'warlock', name: 'Occultiste', rarity: 'epic',
    powerText: 'Nova d’ombre : dégâts de zone soutenus.',
    base: { maxHp: 135, damage: 22, attackIntervalSec: 0.6, range: 2.7, rechargeSec: 26, durationSec: 12, marchSpeed: 0.95 },
    power: { kind: 'nova', periodSec: 2.2, radius: 2.0, damage: 34 },
  },
  {
    id: 'ice_lord', name: 'Seigneur des glaces', rarity: 'epic',
    powerText: 'Blizzard : gèle très fort une grande zone.',
    base: { maxHp: 165, damage: 14, attackIntervalSec: 0.75, range: 2.5, rechargeSec: 26, durationSec: 13, marchSpeed: 0.85 },
    power: { kind: 'frost_nova', periodSec: 2.8, radius: 2.8, slowFactor: 0.35, durationSec: 2.5 },
  },
  {
    id: 'guardian_angel', name: 'Ange gardien', rarity: 'epic',
    powerText: 'Bénédiction : soigne fortement la base et tient.',
    base: { maxHp: 250, damage: 16, attackIntervalSec: 0.8, range: 2.0, rechargeSec: 28, durationSec: 15, marchSpeed: 0.7 },
    power: { kind: 'rally', periodSec: 3.5, radius: 0, healBase: 2 },
  },
  {
    id: 'thunder_god', name: 'Dieu du tonnerre', rarity: 'epic',
    powerText: 'Orage divin : foudre en chaîne dévastatrice.',
    base: { maxHp: 175, damage: 24, attackIntervalSec: 0.5, range: 3.0, rechargeSec: 28, durationSec: 13, marchSpeed: 1.05 },
    power: { kind: 'chain', periodSec: 2.0, jumps: 5, range: 2.8, damage: 34 },
  },
];

export const HEROES_BY_ID = new Map(HEROES.map((h) => [h.id, h]));

/** The starter hero owned from first launch. */
export const STARTER_HERO = 'pyromancer';
export const HERO_MAX_LEVEL = 6;

/** Cards required to promote a hero from `level` to `level+1` (index by currentLevel), or null at max. */
const HERO_CARD_STEPS = [0, 2, 4, 8, 15, 25];
const HERO_GOLD_STEPS = [0, 300, 600, 1200, 2400, 4000];

export function heroPromoteCost(currentLevel: number): { cards: number; gold: number } | null {
  if (currentLevel >= HERO_MAX_LEVEL) return null;
  return { cards: HERO_CARD_STEPS[currentLevel] ?? 25, gold: HERO_GOLD_STEPS[currentLevel] ?? 4000 };
}

/** Builds the combat HeroConfig for a hero at a given meta-level (HP + damage scale ~12%/level). */
export function scaleHeroConfig(def: HeroDef, level: number): HeroConfig {
  const mult = Math.pow(1.12, level - 1);
  const p = def.power;
  // Damage-dealing powers scale their damage; frost/rally scale through HP/uptime.
  const power: HeroPower =
    p.kind === 'nova' || p.kind === 'chain' || p.kind === 'knockback'
      ? { ...p, damage: Math.round(p.damage * mult) }
      : p;
  return {
    name: def.name,
    maxHp: Math.round(def.base.maxHp * mult),
    damage: Math.round(def.base.damage * mult),
    attackIntervalSec: def.base.attackIntervalSec,
    range: def.base.range,
    rechargeSec: def.base.rechargeSec,
    durationSec: def.base.durationSec,
    marchSpeed: def.base.marchSpeed,
    power,
  };
}

import type { EnemyDef } from '../sim/types';

/**
 * speed = cells/sec along the path. Tuned against `npm run simulate`.
 *
 * Bestiary tiers:
 *  - basics: goblin, runner, brute, troll
 *  - elites: wraith (flying, ignores gravity), saboteur (explodes → stuns your units),
 *    juggernaut (armored), ogre (regenerates)
 *  - bosses (ability-carrying, big HP): warlord (stuns your units), necromancer (summons),
 *    stone_colossus (periodic shield), high_priestess (heals nearby enemies)
 */
export const ENEMIES: EnemyDef[] = [
  // ── Basics ──────────────────────────────────────────────────────────────
  { id: 'goblin', name: 'Gobelin', hp: 26, speed: 0.95, damageToBase: 1 },
  { id: 'runner', name: 'Coureur', hp: 16, speed: 1.7, damageToBase: 1 },
  { id: 'brute', name: 'Brute', hp: 85, speed: 0.7, damageToBase: 2 },
  { id: 'troll', name: 'Troll', hp: 320, speed: 0.5, damageToBase: 3 },

  // ── Elites ──────────────────────────────────────────────────────────────
  { id: 'wraith', name: 'Spectre volant', hp: 40, speed: 1.15, damageToBase: 2, flying: true },
  { id: 'saboteur', name: 'Saboteur', hp: 55, speed: 0.9, damageToBase: 2, stunOnDeath: { radius: 1.6, stunSec: 2.5 } },
  { id: 'juggernaut', name: 'Juggernaut', hp: 140, speed: 0.55, damageToBase: 3, armor: 6 },
  { id: 'ogre', name: 'Ogre régénérant', hp: 130, speed: 0.6, damageToBase: 2, regenPerSec: 10 },

  // ── Bosses ──────────────────────────────────────────────────────────────
  {
    id: 'warlord',
    name: 'Seigneur de guerre',
    hp: 820,
    speed: 0.42,
    damageToBase: 6,
    boss: true,
    ability: { kind: 'stun_units', periodSec: 6, radius: 2.2, stunSec: 1.8 },
  },
  {
    id: 'necromancer',
    name: 'Nécromancien',
    hp: 700,
    speed: 0.45,
    damageToBase: 5,
    boss: true,
    ability: { kind: 'summon', periodSec: 4, enemyId: 'goblin', count: 2 },
  },
  {
    id: 'stone_colossus',
    name: 'Colosse de pierre',
    hp: 1050,
    speed: 0.38,
    damageToBase: 8,
    armor: 4,
    boss: true,
    ability: { kind: 'shield', periodSec: 7, durationSec: 1.7 },
  },
  {
    id: 'high_priestess',
    name: 'Grande Prêtresse',
    hp: 650,
    speed: 0.5,
    damageToBase: 4,
    boss: true,
    ability: { kind: 'heal_aura', radius: 3, healPerSec: 22 },
  },
];

export const ENEMIES_BY_ID = new Map(ENEMIES.map((e) => [e.id, e]));

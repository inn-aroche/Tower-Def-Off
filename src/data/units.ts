import type { Rarity, UnitAbility, UnitDef, UnitFamily, UnitLevelStats } from '../sim/types';

/**
 * Full M3 roster: 12 units across melee / ranged / gravity families and common / rare / epic
 * rarities, including the 3 gravity units that carry the differentiator.
 *
 * `range` is a Euclidean radius in cells (spatial targeting on the path). `cost` is the fixed mana
 * cost of the card. `levels` are the in-combat board-merge tiers (Lv1→Lv3); a unit's persistent
 * meta-level (Amélioration screen) scales these at combat start — see data/meta.ts.
 *
 * The gravity family currently expresses itself as area *slow* fields (the fixed-path model rules
 * out true bend/regroup — a combat-design question flagged in decisions.md). The 3 gravity units
 * differ by field profile: wide-soft, focused-strong, and a heavy epic.
 */
/** The 12 hand-tuned core units (validated by the balance sims and used by the default deck). */
const CORE_UNITS: UnitDef[] = [
  // ── Common ────────────────────────────────────────────────────────────────
  {
    id: 'swordsman',
    name: 'Épéiste',
    family: 'melee',
    rarity: 'common',
    cost: 2,
    levels: [
      { damage: 9, attackIntervalSec: 0.6, range: 1.6, slowFactor: 1 },
      { damage: 16, attackIntervalSec: 0.55, range: 1.7, slowFactor: 1 },
      { damage: 28, attackIntervalSec: 0.5, range: 1.9, slowFactor: 1 },
    ],
  },
  {
    id: 'archer',
    name: 'Archère',
    family: 'ranged',
    rarity: 'common',
    cost: 3,
    levels: [
      { damage: 7, attackIntervalSec: 0.75, range: 3.2, slowFactor: 1 },
      { damage: 12, attackIntervalSec: 0.7, range: 3.4, slowFactor: 1 },
      { damage: 20, attackIntervalSec: 0.65, range: 3.7, slowFactor: 1 },
    ],
  },
  {
    id: 'lancer',
    name: 'Lancier',
    family: 'melee',
    rarity: 'common',
    cost: 3,
    levels: [
      { damage: 8, attackIntervalSec: 0.7, range: 2.3, slowFactor: 1 },
      { damage: 14, attackIntervalSec: 0.65, range: 2.4, slowFactor: 1 },
      { damage: 24, attackIntervalSec: 0.6, range: 2.6, slowFactor: 1 },
    ],
  },
  {
    id: 'scout',
    name: 'Éclaireuse',
    family: 'ranged',
    rarity: 'common',
    cost: 2,
    levels: [
      { damage: 4, attackIntervalSec: 0.45, range: 2.8, slowFactor: 1 },
      { damage: 7, attackIntervalSec: 0.42, range: 3.0, slowFactor: 1 },
      { damage: 12, attackIntervalSec: 0.4, range: 3.2, slowFactor: 1 },
    ],
  },
  // ── Rare ──────────────────────────────────────────────────────────────────
  {
    id: 'catapult',
    name: 'Catapulte',
    family: 'ranged',
    rarity: 'rare',
    cost: 5,
    // Siege splash — the boulder also damages enemies bunched near the impact.
    ability: { kind: 'splash', radius: 1.4, damageFactor: 0.6 },
    levels: [
      { damage: 18, attackIntervalSec: 1.5, range: 4.8, slowFactor: 1 },
      { damage: 30, attackIntervalSec: 1.4, range: 5.0, slowFactor: 1 },
      { damage: 48, attackIntervalSec: 1.3, range: 5.3, slowFactor: 1 },
    ],
  },
  {
    id: 'guardian',
    name: 'Gardien',
    family: 'melee',
    rarity: 'rare',
    cost: 4,
    // Rallying tank — nearby friendly damage-units hit harder.
    ability: { kind: 'boost_aura', radius: 1.6, damageBonus: 0.25 },
    levels: [
      { damage: 14, attackIntervalSec: 0.8, range: 1.6, slowFactor: 1 },
      { damage: 24, attackIntervalSec: 0.75, range: 1.7, slowFactor: 1 },
      { damage: 40, attackIntervalSec: 0.7, range: 1.9, slowFactor: 1 },
    ],
  },
  {
    id: 'frost_archer',
    name: 'Archère de givre',
    family: 'ranged',
    rarity: 'rare',
    cost: 4,
    // Chills the struck enemy, slowing it (stacks with gravity fields).
    ability: { kind: 'slow_on_hit', slowFactor: 0.6, durationSec: 1.2 },
    levels: [
      { damage: 9, attackIntervalSec: 0.7, range: 3.4, slowFactor: 1 },
      { damage: 15, attackIntervalSec: 0.65, range: 3.6, slowFactor: 1 },
      { damage: 25, attackIntervalSec: 0.6, range: 3.9, slowFactor: 1 },
    ],
  },
  {
    id: 'gravity_well',
    name: 'Puits de gravité',
    family: 'gravity',
    rarity: 'common',
    cost: 4,
    levels: [
      { damage: 0, attackIntervalSec: 0, range: 2.2, slowFactor: 0.6 },
      { damage: 0, attackIntervalSec: 0, range: 2.6, slowFactor: 0.5 },
      { damage: 0, attackIntervalSec: 0, range: 3.0, slowFactor: 0.35 },
    ],
  },
  {
    id: 'repulsor',
    name: 'Répulseur',
    family: 'gravity',
    rarity: 'rare',
    cost: 3,
    levels: [
      { damage: 0, attackIntervalSec: 0, range: 3.2, slowFactor: 0.75 },
      { damage: 0, attackIntervalSec: 0, range: 3.5, slowFactor: 0.68 },
      { damage: 0, attackIntervalSec: 0, range: 3.9, slowFactor: 0.6 },
    ],
  },
  // ── Epic ──────────────────────────────────────────────────────────────────
  {
    id: 'golem',
    name: 'Golem de pierre',
    family: 'melee',
    rarity: 'epic',
    cost: 6,
    levels: [
      { damage: 26, attackIntervalSec: 0.9, range: 1.8, slowFactor: 1 },
      { damage: 44, attackIntervalSec: 0.85, range: 1.9, slowFactor: 1 },
      { damage: 72, attackIntervalSec: 0.8, range: 2.1, slowFactor: 1 },
    ],
  },
  {
    id: 'storm_caller',
    name: 'Chaman des tempêtes',
    family: 'ranged',
    rarity: 'epic',
    cost: 6,
    // Lightning arcs to two more nearby enemies for reduced damage.
    ability: { kind: 'chain', jumps: 2, range: 2.2, damageFactor: 0.5 },
    levels: [
      { damage: 16, attackIntervalSec: 0.55, range: 4.2, slowFactor: 1 },
      { damage: 27, attackIntervalSec: 0.5, range: 4.4, slowFactor: 1 },
      { damage: 44, attackIntervalSec: 0.45, range: 4.7, slowFactor: 1 },
    ],
  },
  {
    id: 'singularity',
    name: 'Singularité',
    family: 'gravity',
    rarity: 'epic',
    cost: 5,
    levels: [
      { damage: 0, attackIntervalSec: 0, range: 2.8, slowFactor: 0.4 },
      { damage: 0, attackIntervalSec: 0, range: 3.2, slowFactor: 0.3 },
      { damage: 0, attackIntervalSec: 0, range: 3.6, slowFactor: 0.2 },
    ],
  },
];

/**
 * Offensive units — the other half of a deck. They are NOT placed: playing one launches it from
 * the base to march UP the path, fighting what it meets until it dies, expires, or reaches the
 * spawn. They cost mana but take **no emplacement slot**, so they are the pressure-release valve
 * when the board is full — the deliberate counterpart to the defense cap.
 *
 * `levels` is unused for them (they never merge) but kept as a single tier so every UnitDef stays
 * uniform for the collection/upgrade screens. All marching stats live in `march`.
 */
const OFFENSE_UNITS: UnitDef[] = [
  {
    id: 'raider',
    name: 'Pillard',
    family: 'melee',
    rarity: 'common',
    cost: 3,
    role: 'offense',
    march: { maxHp: 95, damage: 13, attackIntervalSec: 0.7, range: 1.5, marchSpeed: 1.15, durationSec: 13 },
    levels: [{ damage: 13, attackIntervalSec: 0.7, range: 1.5, slowFactor: 1 }],
  },
  {
    id: 'skirmisher',
    name: 'Tirailleuse',
    family: 'ranged',
    rarity: 'rare',
    cost: 4,
    role: 'offense',
    march: { maxHp: 70, damage: 15, attackIntervalSec: 0.6, range: 2.7, marchSpeed: 1.0, durationSec: 12 },
    levels: [{ damage: 15, attackIntervalSec: 0.6, range: 2.7, slowFactor: 1 }],
  },
  {
    id: 'champion',
    name: 'Champion',
    family: 'melee',
    rarity: 'epic',
    cost: 6,
    role: 'offense',
    march: { maxHp: 210, damage: 24, attackIntervalSec: 0.75, range: 1.7, marchSpeed: 0.85, durationSec: 16 },
    levels: [{ damage: 24, attackIntervalSec: 0.75, range: 1.7, slowFactor: 1 }],
  },
];

/**
 * The collection is expanded to 100 units. Beyond the 12 hand-tuned core units above, the rest are
 * generated deterministically (stat curves by family + rarity + tier, thematic names, sparse
 * signature abilities) for collection breadth. They're locked at start and none sit in the default
 * deck, so the balance sims (which use fixed decks) stay authoritative. Curated tuning + real art
 * come later — this is breadth, not final balance.
 */
const NAME_POOLS: Record<UnitFamily, { nouns: string[]; epithets: string[] }> = {
  melee: {
    nouns: ['Chevalier', 'Garde', 'Brute', 'Colosse', 'Lame', 'Gladiateur', 'Barbare', 'Cuirassier', 'Sentinelle', 'Champion'],
    epithets: ['de fer', 'd’acier', 'sombre', 'runique', 'du vide', 'stellaire', 'ardent', 'royal'],
  },
  ranged: {
    nouns: ['Archer', 'Arbalétrier', 'Mage', 'Sniper', 'Tireur', 'Frondeur', 'Baliste', 'Pyromage', 'Foudroyeur', 'Chasseur'],
    epithets: ['des bois', 'de givre', 'd’argent', 'céleste', 'vénéneux', 'du désert', 'fantôme', 'de foudre'],
  },
  gravity: {
    nouns: ['Puits', 'Vortex', 'Prisme', 'Orbe', 'Faille', 'Sceau', 'Rift', 'Nexus'],
    epithets: ['gravitique', 'du vide', 'arcanique', 'temporel', 'sombre', 'stellaire'],
  },
};

const RARITY_CYCLE: Rarity[] = ['common', 'common', 'rare', 'common', 'rare', 'epic'];
const RARITY_DMG: Record<Rarity, number> = { common: 1, rare: 1.4, epic: 1.9 };
const GRAV_SLOW: Record<Rarity, number> = { common: 0.65, rare: 0.55, epic: 0.42 };
const GRAV_RANGE: Record<Rarity, number> = { common: 2.2, rare: 2.6, epic: 3.0 };
const COST: Record<UnitFamily, Record<Rarity, number>> = {
  melee: { common: 2, rare: 4, epic: 6 },
  ranged: { common: 3, rare: 4, epic: 6 },
  gravity: { common: 4, rare: 3, epic: 5 },
};

function genLevels(family: UnitFamily, rarity: Rarity): UnitLevelStats[] {
  if (family === 'gravity') {
    const slow = GRAV_SLOW[rarity];
    const range = GRAV_RANGE[rarity];
    return [0, 1, 2].map((t) => ({
      damage: 0,
      attackIntervalSec: 0,
      range: +(range + 0.35 * t).toFixed(2),
      slowFactor: +Math.max(0.15, slow - 0.1 * t).toFixed(2),
    }));
  }
  const baseDmg = family === 'melee' ? 9 : 7;
  const baseRange = family === 'melee' ? 1.7 : 3.2;
  const baseInt = family === 'melee' ? 0.6 : 0.72;
  const rMult = RARITY_DMG[rarity];
  const tierDmg = [1, 1.7, 2.9];
  return [0, 1, 2].map((t) => ({
    damage: Math.round(baseDmg * rMult * tierDmg[t]),
    attackIntervalSec: +(baseInt * Math.pow(0.93, t)).toFixed(2),
    range: +(baseRange + 0.12 * t).toFixed(2),
    slowFactor: 1,
  }));
}

function genAbility(family: UnitFamily, i: number): UnitAbility | undefined {
  if (family === 'ranged') {
    if (i % 4 === 0) return { kind: 'splash', radius: 1.3, damageFactor: 0.5 };
    if (i % 4 === 1) return { kind: 'slow_on_hit', slowFactor: 0.6, durationSec: 1.2 };
    if (i % 4 === 2) return { kind: 'chain', jumps: 2, range: 2.2, damageFactor: 0.45 };
  } else if (family === 'melee' && i % 5 === 0) {
    return { kind: 'boost_aura', radius: 1.5, damageBonus: 0.2 };
  }
  return undefined;
}

function generatedUnits(): UnitDef[] {
  const plan: Array<{ family: UnitFamily; count: number }> = [
    // 85 generated + 12 core + 3 offensive = the 100-unit collection.
    { family: 'melee', count: 29 },
    { family: 'ranged', count: 29 },
    { family: 'gravity', count: 27 },
  ];
  const out: UnitDef[] = [];
  for (const { family, count } of plan) {
    const { nouns, epithets } = NAME_POOLS[family];
    for (let i = 0; i < count; i++) {
      const rarity = RARITY_CYCLE[i % RARITY_CYCLE.length];
      const name = `${nouns[i % nouns.length]} ${epithets[Math.floor(i / nouns.length) % epithets.length]}`;
      const ability = genAbility(family, i);
      out.push({
        id: `${family[0]}gen_${i}`,
        name,
        family,
        rarity,
        cost: COST[family][rarity],
        levels: genLevels(family, rarity),
        ...(ability ? { ability } : {}),
      });
    }
  }
  return out;
}

export const OFFENSE_UNIT_IDS = OFFENSE_UNITS.map((u) => u.id);

export const UNITS: UnitDef[] = [...CORE_UNITS, ...OFFENSE_UNITS, ...generatedUnits()];

export const UNITS_BY_ID = new Map(UNITS.map((u) => [u.id, u]));

/** Player-facing description of a unit's signature ability (null if it has none). */
export function abilityLabel(def: UnitDef): { title: string; text: string } | null {
  const a = def.ability;
  if (!a) return null;
  switch (a.kind) {
    case 'splash':
      return { title: '💥 Éclaboussure', text: `Touche aussi les ennemis à ${a.radius} cases (${Math.round(a.damageFactor * 100)} % des dégâts).` };
    case 'chain':
      return { title: '⚡ Chaîne', text: `L'attaque rebondit sur ${a.jumps} ennemi(s) proche(s) (${Math.round(a.damageFactor * 100)} % des dégâts).` };
    case 'slow_on_hit':
      return { title: '❄ Givre', text: `Ralentit l'ennemi touché pendant ${a.durationSec} s (cumulable avec la gravité).` };
    case 'boost_aura':
      return { title: '🚩 Ralliement', text: `+${Math.round(a.damageBonus * 100)} % de dégâts aux unités alliées proches.` };
  }
}

/** Starter deck (owned from the first launch) — a balanced, forgiving 5 the sim also validates. */
export const DEFAULT_DECK: string[] = ['swordsman', 'archer', 'lancer', 'catapult', 'gravity_well'];

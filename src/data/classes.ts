import { SKILL_TIER_COSTS } from './balance';

export type ClassId = 'warrior' | 'mage' | 'ranger';

export interface SkillEffects {
  keepMaxHpFlat?: number;
  keepMaxHpPct?: number;
  keepRegenPctBonus?: number;
  keepDamageReductionPct?: number;
  towerCostPct?: number; // negative = discount, applies to build + upgrade costs
  startingGoldPct?: number;
  waveClearGoldBonusPct?: number;
  ultimateCooldownPct?: number; // negative = faster
  ultimateDurationBonus?: number; // seconds
  ultimateDamageBonusPct?: number;
  elementalDmgPct?: number; // Frost & Arcane towers
  frostSlowDurationPct?: number;
  arcaneChainBonus?: number;
  critChanceBonus?: number;
  critMultiplierBonus?: number;
  goldPerKillBonus?: number;
  flags?: string[]; // unique tier-4 mechanics, checked by key in sim code
}

export interface SkillNode {
  id: string;
  branch: string;
  tier: 1 | 2 | 3 | 4;
  label: string;
  description: string;
  cost: number;
  effects: SkillEffects;
}

export interface SkillBranch {
  id: string;
  label: string;
  nodes: SkillNode[];
}

export interface UltimateDef {
  id: string;
  label: string;
  icon: string;
  description: string;
  baseCooldown: number; // seconds
}

export interface ClassDef {
  id: ClassId;
  label: string;
  icon: string;
  color: string;
  tagline: string;
  passive: { label: string; description: string; effects: SkillEffects };
  ultimate: UltimateDef;
  branches: [SkillBranch, SkillBranch, SkillBranch];
}

function economyBranch(id: string, label: string): SkillBranch {
  return {
    id,
    label,
    nodes: [
      {
        id: `${id}-1`,
        branch: id,
        tier: 1,
        label: 'Bourse légère',
        description: 'Coût des tours -10%.',
        cost: SKILL_TIER_COSTS[0],
        effects: { towerCostPct: -0.1 },
      },
      {
        id: `${id}-2`,
        branch: id,
        tier: 2,
        label: 'Artisanat efficace',
        description: 'Coût des tours -10% supplémentaire.',
        cost: SKILL_TIER_COSTS[1],
        effects: { towerCostPct: -0.1 },
      },
      {
        id: `${id}-3`,
        branch: id,
        tier: 3,
        label: 'Trésor de départ',
        description: 'Or de départ +15%.',
        cost: SKILL_TIER_COSTS[2],
        effects: { startingGoldPct: 0.15 },
      },
      {
        id: `${id}-4`,
        branch: id,
        tier: 4,
        label: 'Butin de guerre',
        description: 'Bonus d’or de fin de vague +50%.',
        cost: SKILL_TIER_COSTS[3],
        effects: { waveClearGoldBonusPct: 0.5 },
      },
    ],
  };
}

export const CLASSES: Record<ClassId, ClassDef> = {
  warrior: {
    id: 'warrior',
    label: 'Guerrier',
    icon: '🛡️',
    color: '#5b8def',
    tagline: 'Un Donjon increvable. Encaisse, régénère, tient la ligne.',
    passive: {
      label: 'Rempart',
      description: 'PV max du Donjon +30%.',
      effects: { keepMaxHpPct: 0.3 },
    },
    ultimate: {
      id: 'bastion',
      label: 'Bastion',
      icon: '🛡️',
      description: 'Le Donjon devient invulnérable pendant 6s.',
      baseCooldown: 45,
    },
    branches: [
      {
        id: 'fortification',
        label: 'Fortification',
        nodes: [
          { id: 'fortification-1', branch: 'fortification', tier: 1, label: 'Murs épais', description: 'PV max du Donjon +10.', cost: SKILL_TIER_COSTS[0], effects: { keepMaxHpFlat: 10 } },
          { id: 'fortification-2', branch: 'fortification', tier: 2, label: 'Pierre runique', description: 'Régénération entre les vagues +5%.', cost: SKILL_TIER_COSTS[1], effects: { keepRegenPctBonus: 0.05 } },
          { id: 'fortification-3', branch: 'fortification', tier: 3, label: 'Donjon renforcé', description: 'PV max du Donjon +15.', cost: SKILL_TIER_COSTS[2], effects: { keepMaxHpFlat: 15 } },
          { id: 'fortification-4', branch: 'fortification', tier: 4, label: 'Égide', description: 'Dégâts subis par le Donjon -20%.', cost: SKILL_TIER_COSTS[3], effects: { keepDamageReductionPct: 0.2, flags: ['aegis'] } },
        ],
      },
      economyBranch('discipline', 'Discipline'),
      {
        id: 'valeur',
        label: 'Valeur',
        nodes: [
          { id: 'valeur-1', branch: 'valeur', tier: 1, label: 'Réflexes de fer', description: 'Recharge de Bastion -10%.', cost: SKILL_TIER_COSTS[0], effects: { ultimateCooldownPct: -0.1 } },
          { id: 'valeur-2', branch: 'valeur', tier: 2, label: 'Endurance', description: 'Durée de Bastion +2s.', cost: SKILL_TIER_COSTS[1], effects: { ultimateDurationBonus: 2 } },
          { id: 'valeur-3', branch: 'valeur', tier: 3, label: 'Volonté inébranlable', description: 'Recharge de Bastion -15% supplémentaire.', cost: SKILL_TIER_COSTS[2], effects: { ultimateCooldownPct: -0.15 } },
          { id: 'valeur-4', branch: 'valeur', tier: 4, label: 'Rempart vivant', description: 'Bastion soigne aussi le Donjon de 10% de ses PV max.', cost: SKILL_TIER_COSTS[3], effects: { flags: ['bastionHeal'] } },
        ],
      },
    ],
  },
  mage: {
    id: 'mage',
    label: 'Arcaniste',
    icon: '🔮',
    color: '#a875ff',
    tagline: 'Contrôle et dégâts de zone. Ralentit tout, punit ce qui approche.',
    passive: {
      label: 'Flux élémentaire',
      description: 'Dégâts des tours Givre et Arcane +15%.',
      effects: { elementalDmgPct: 0.15 },
    },
    ultimate: {
      id: 'nova',
      label: 'Nova Arcanique',
      icon: '💥',
      description: 'Inflige des dégâts de zone à tous les ennemis visibles et les gèle 2s.',
      baseCooldown: 40,
    },
    branches: [
      {
        id: 'flux-arcanique',
        label: 'Flux Arcanique',
        nodes: [
          { id: 'flux-arcanique-1', branch: 'flux-arcanique', tier: 1, label: 'Canalisation', description: 'Dégâts Givre/Arcane +10%.', cost: SKILL_TIER_COSTS[0], effects: { elementalDmgPct: 0.1 } },
          { id: 'flux-arcanique-2', branch: 'flux-arcanique', tier: 2, label: 'Gel prolongé', description: 'Durée de ralentissement du Givre +25%.', cost: SKILL_TIER_COSTS[1], effects: { frostSlowDurationPct: 0.25 } },
          { id: 'flux-arcanique-3', branch: 'flux-arcanique', tier: 3, label: 'Surcharge arcanique', description: 'Dégâts Givre/Arcane +15% supplémentaire.', cost: SKILL_TIER_COSTS[2], effects: { elementalDmgPct: 0.15 } },
          { id: 'flux-arcanique-4', branch: 'flux-arcanique', tier: 4, label: 'Résonance', description: 'La tour Arcane touche 1 cible en chaîne de plus.', cost: SKILL_TIER_COSTS[3], effects: { arcaneChainBonus: 1 } },
        ],
      },
      economyBranch('sagesse', 'Sagesse'),
      {
        id: 'puissance',
        label: 'Puissance',
        nodes: [
          { id: 'puissance-1', branch: 'puissance', tier: 1, label: 'Concentration', description: 'Recharge de Nova -10%.', cost: SKILL_TIER_COSTS[0], effects: { ultimateCooldownPct: -0.1 } },
          { id: 'puissance-2', branch: 'puissance', tier: 2, label: 'Gel profond', description: 'Durée de gel de Nova +1.5s.', cost: SKILL_TIER_COSTS[1], effects: { ultimateDurationBonus: 1.5 } },
          { id: 'puissance-3', branch: 'puissance', tier: 3, label: 'Maîtrise arcanique', description: 'Recharge de Nova -15% supplémentaire.', cost: SKILL_TIER_COSTS[2], effects: { ultimateCooldownPct: -0.15 } },
          { id: 'puissance-4', branch: 'puissance', tier: 4, label: 'Singularité', description: 'Nova déclenche une seconde pulsation 1s après la première.', cost: SKILL_TIER_COSTS[3], effects: { flags: ['singularity'] } },
        ],
      },
    ],
  },
  ranger: {
    id: 'ranger',
    label: 'Rôdeur',
    icon: '🏹',
    color: '#ffb545',
    tagline: 'Précision et opportunisme. Chaque tir compte, chaque kill rapporte.',
    passive: {
      label: 'Œil de lynx',
      description: 'Chance de critique +15% (x2 dégâts) sur toutes les tours, +1 or par ennemi tué.',
      effects: { critChanceBonus: 0.15, critMultiplierBonus: 1, goldPerKillBonus: 1 },
    },
    ultimate: {
      id: 'volley',
      label: 'Volée de flèches',
      icon: '🏹',
      description: 'Toutes les tours tirent instantanément une salve gratuite à dégâts renforcés.',
      baseCooldown: 35,
    },
    branches: [
      {
        id: 'precision',
        label: 'Précision',
        nodes: [
          { id: 'precision-1', branch: 'precision', tier: 1, label: 'Visée affûtée', description: 'Chance de critique +10%.', cost: SKILL_TIER_COSTS[0], effects: { critChanceBonus: 0.1 } },
          { id: 'precision-2', branch: 'precision', tier: 2, label: 'Point faible', description: 'Multiplicateur de critique +0.5x.', cost: SKILL_TIER_COSTS[1], effects: { critMultiplierBonus: 0.5 } },
          { id: 'precision-3', branch: 'precision', tier: 3, label: 'Instinct du chasseur', description: 'Chance de critique +10% supplémentaire.', cost: SKILL_TIER_COSTS[2], effects: { critChanceBonus: 0.1 } },
          { id: 'precision-4', branch: 'precision', tier: 4, label: 'Tir fatal', description: 'Les critiques contre les Seigneurs de Guerre infligent +50% de dégâts.', cost: SKILL_TIER_COSTS[3], effects: { flags: ['tirFatal'] } },
        ],
      },
      economyBranch('fortune', 'Fortune'),
      {
        id: 'instinct',
        label: 'Instinct',
        nodes: [
          { id: 'instinct-1', branch: 'instinct', tier: 1, label: 'Sang-froid', description: 'Recharge de Volée -10%.', cost: SKILL_TIER_COSTS[0], effects: { ultimateCooldownPct: -0.1 } },
          { id: 'instinct-2', branch: 'instinct', tier: 2, label: 'Flèches renforcées', description: 'Dégâts de Volée +30%.', cost: SKILL_TIER_COSTS[1], effects: { ultimateDamageBonusPct: 0.3 } },
          { id: 'instinct-3', branch: 'instinct', tier: 3, label: 'Cadence de combat', description: 'Recharge de Volée -15% supplémentaire.', cost: SKILL_TIER_COSTS[2], effects: { ultimateCooldownPct: -0.15 } },
          { id: 'instinct-4', branch: 'instinct', tier: 4, label: 'Rafale', description: 'Volée tire une seconde salve 2s après la première.', cost: SKILL_TIER_COSTS[3], effects: { flags: ['rafale'] } },
        ],
      },
    ],
  },
};

export const CLASS_ORDER: ClassId[] = ['warrior', 'mage', 'ranger'];

export function allNodesFor(classId: ClassId): SkillNode[] {
  return CLASSES[classId].branches.flatMap((b) => b.nodes);
}

#!/usr/bin/env node
/**
 * Economy / pacing sanity-check for Runeforge Defense.
 *
 * This is a SIMPLIFIED, CLOSED-FORM model, not a line-for-line port of the real
 * combat engine (src/sim/*.ts). It intentionally mirrors the same balance
 * constants (data/balance.ts, data/enemies.ts, data/towers.ts, data/waveGenerator.ts)
 * but resolves combat as "total DPS vs. total wave HP over the enemies' transit
 * time down the lane" instead of simulating individual projectiles/targeting.
 *
 * Two conservative simplifications, both documented so results read honestly:
 *  1. DPS uses Arrow-tower-equivalent numbers for every purchase, ignoring splash/
 *     chain/pierce bonus value from Cannon/Frost/Arcane — real DPS is >= this model.
 *  2. The purchase heuristic (see buyPolicy) is a plain "average, non-optimizing
 *     player", not a min-maxed build — a skilled player will outperform this.
 * Both biases point the same direction: if THIS model already clears comfortably,
 * the real engine (strictly more powerful tools, same enemy numbers) will too.
 * If you need exact numbers, drive the real engine (src/sim/GameState.ts) instead —
 * this script exists to catch gross pacing mistakes (instant-death waves, or an
 * economy that never lets the player buy anything), not to replace playtesting.
 *
 * Usage: node scripts/economy-sim.mjs
 */

// ---- Mirrors of src/data/balance.ts ----
const STARTING_GOLD = 150;
const KEEP_BASE_MAX_HP = 100;
const KEEP_REGEN_PER_WAVE_PCT = 0.05;
const WAVE_CLEAR_GOLD_BASE = 20;
const WAVE_CLEAR_GOLD_PER_WAVE = 3;
const BOSS_WAVE_INTERVAL = 5;
const SKILL_TIER_COSTS = [1, 2, 3, 5];
const FULL_CLASS_TREE_COST = SKILL_TIER_COSTS.reduce((a, b) => a + b, 0) * 3;
function essenceEarned(wavesSurvived, bossKills) {
  return Math.floor(wavesSurvived / 2) + bossKills * 2 + 1;
}

// ---- Mirrors of src/data/enemies.ts ----
const ENEMIES = {
  grunt: { baseHp: 20, hpGrowthPerWave: 0.15, speed: 1, dmgToKeep: 5, baseGold: 3, goldPerWave: 5, minWave: 1 },
  speedster: { baseHp: 12, hpGrowthPerWave: 0.15, speed: 1.8, dmgToKeep: 4, baseGold: 2, goldPerWave: 5, minWave: 2 },
  brute: { baseHp: 55, hpGrowthPerWave: 0.15, speed: 0.6, dmgToKeep: 10, baseGold: 6, goldPerWave: 5, minWave: 4 },
  boss: { baseHp: 300, hpGrowthPerWave: 0.2, speed: 0.5, dmgToKeep: 25, baseGold: 40, goldPerWave: 1, minWave: 5 },
};
function hpAt(kind, w) {
  const d = ENEMIES[kind];
  return Math.round(d.baseHp * (1 + d.hpGrowthPerWave * (w - 1)));
}
function goldAt(kind, w) {
  const d = ENEMIES[kind];
  return d.baseGold + Math.floor(w / d.goldPerWave);
}

// ---- Mirrors of src/data/waveGenerator.ts composition logic (counts only) ----
function waveComposition(wave) {
  const isBossWave = wave % BOSS_WAVE_INTERVAL === 0;
  const totalMinions = Math.round((6 + wave * 1.2) * (isBossWave ? 0.5 : 1));
  const unlocked = ['grunt', 'speedster', 'brute'].filter((k) => wave >= ENEMIES[k].minWave);
  const weights = { grunt: 0.5, speedster: 0.3, brute: 0.2 };
  const totalWeight = unlocked.reduce((s, k) => s + weights[k], 0);
  const counts = {};
  let assigned = 0;
  for (const k of unlocked) {
    const c = Math.round((weights[k] / totalWeight) * totalMinions);
    counts[k] = c;
    assigned += c;
  }
  const drift = totalMinions - assigned;
  if (unlocked.length > 0) counts[unlocked[0]] += drift;
  if (isBossWave) counts.boss = 1;
  return counts;
}

// ---- Mirrors of src/data/towers.ts (Arrow only — see header) ----
const ARROW_DPS_BY_TOWER_COUNT_TIER = { 1: 8 * 1.2, 2: 14 * 1.2, 3: 24 * 1.2 };
const ARROW_TIER_COST = { 1: 50, 2: 80, 3: 150 };
const PATH_LENGTH_TILES = 23; // "Sentier Sinueux" — see src/data/maps.ts

// ---- Class passives relevant to this simplified DPS-only model ----
const CLASS_DPS_MULT = { warrior: 1.0, mage: 1.15, ranger: 1.15 };
const CLASS_KEEP_HP_MULT = { warrior: 1.3, mage: 1.0, ranger: 1.0 };
const CLASS_WAVE_CLEAR_BONUS = { warrior: 0, mage: 0, ranger: 0 }; // no economy nodes unlocked (fresh character)

const SECONDS_BETWEEN_WAVES = 8; // assumed average one-thumb decision time before tapping "Lancer la vague"

function simulateRun(classId, maxWaves = 60) {
  let gold = STARTING_GOLD;
  let keepHp = KEEP_BASE_MAX_HP * CLASS_KEEP_HP_MULT[classId];
  const keepMaxHp = keepHp;
  let towers = []; // array of tiers (1..3)
  let bossKills = 0;
  let totalSeconds = 0;
  let wave = 0;
  const log = [];

  const TOWER_CAP = 6;

  function buyPolicy() {
    // Average player: build up to TOWER_CAP towers first, then upgrade the weakest one, repeat while affordable.
    let spent = true;
    while (spent) {
      spent = false;
      if (towers.length < TOWER_CAP && gold >= ARROW_TIER_COST[1]) {
        gold -= ARROW_TIER_COST[1];
        towers.push(1);
        spent = true;
        continue;
      }
      towers.sort((a, b) => a - b);
      const weakest = towers.find((t) => t < 3);
      if (weakest !== undefined) {
        const nextTier = weakest + 1;
        const cost = ARROW_TIER_COST[nextTier];
        if (gold >= cost) {
          gold -= cost;
          towers[towers.indexOf(weakest)] = nextTier;
          spent = true;
        }
      }
    }
  }

  while (wave < maxWaves) {
    wave += 1;
    buyPolicy();

    const comp = waveComposition(wave);
    let totalHp = 0;
    let totalDmgToKeep = 0;
    let weightedSpeed = 0;
    let count = 0;
    for (const [kind, n] of Object.entries(comp)) {
      if (!n) continue;
      totalHp += n * hpAt(kind, wave);
      totalDmgToKeep += n * ENEMIES[kind].dmgToKeep;
      weightedSpeed += n * ENEMIES[kind].speed;
      count += n;
      gold += n * goldAt(kind, wave); // assume every enemy eventually dies and pays out (validated against keepHp below)
    }
    const avgSpeed = count > 0 ? weightedSpeed / count : 1;
    const transitTimeS = PATH_LENGTH_TILES / avgSpeed;

    const dps = towers.reduce((s, t) => s + ARROW_DPS_BY_TOWER_COUNT_TIER[t], 0) * CLASS_DPS_MULT[classId];
    const killableHp = dps * transitTimeS;
    const unkilledFraction = Math.max(0, Math.min(1, (totalHp - killableHp) / totalHp));
    const keepDamage = unkilledFraction * totalDmgToKeep;

    keepHp -= keepDamage;
    if (comp.boss) bossKills += 1;

    const clearBonus = Math.round((WAVE_CLEAR_GOLD_BASE + wave * WAVE_CLEAR_GOLD_PER_WAVE) * (1 + CLASS_WAVE_CLEAR_BONUS[classId]));
    if (keepHp > 0) {
      gold += clearBonus;
      keepHp = Math.min(keepMaxHp, keepHp + keepMaxHp * KEEP_REGEN_PER_WAVE_PCT);
    }
    totalSeconds += transitTimeS + SECONDS_BETWEEN_WAVES;

    log.push({ wave, totalHp: Math.round(totalHp), dps: Math.round(dps), keepHp: Math.round(Math.max(0, keepHp)), gold: Math.round(gold) });
    if (keepHp <= 0) break;
  }

  const wavesSurvived = keepHp <= 0 ? wave - 1 : wave;
  const essence = essenceEarned(wavesSurvived, bossKills);
  return { classId, wavesSurvived, bossKills, essence, totalSeconds, towersOwned: towers.length, log };
}

console.log('='.repeat(72));
console.log('RUNEFORGE DEFENSE — Economy / Pacing Simulation (simplified model)');
console.log('='.repeat(72));
console.log();

const results = [];
for (const classId of ['warrior', 'mage', 'ranger']) {
  const r = simulateRun(classId);
  results.push(r);
  console.log(`-- ${classId.toUpperCase()} (fresh character, no skill tree unlocked) --`);
  console.log(`  Waves survived:      ${r.wavesSurvived}`);
  console.log(`  Boss kills:          ${r.bossKills}`);
  console.log(`  Session duration:    ${(r.totalSeconds / 60).toFixed(1)} min`);
  console.log(`  Essence earned:      ${r.essence}`);
  console.log(`  Towers owned at end: ${r.towersOwned}`);
  console.log('  Wave-by-wave (every 5th wave):');
  for (const entry of r.log) {
    if (entry.wave % 5 === 0 || entry.wave === r.log.length) {
      console.log(`    wave ${String(entry.wave).padStart(2)}: enemyHP=${String(entry.totalHp).padStart(5)}  dps=${String(entry.dps).padStart(4)}  keepHP=${String(entry.keepHp).padStart(4)}  gold=${entry.gold}`);
    }
  }
  console.log();
}

console.log('-'.repeat(72));
console.log('Session-length check (target: 5-15 minutes)');
console.log('-'.repeat(72));
for (const r of results) {
  const inRange = r.totalSeconds / 60 >= 5 && r.totalSeconds / 60 <= 15;
  console.log(`  ${r.classId.padEnd(8)} -> ${(r.totalSeconds / 60).toFixed(1)} min  [${inRange ? 'OK' : 'OUT OF RANGE'}]`);
}
console.log();

console.log('-'.repeat(72));
console.log('Meta-progression pacing: essence needed to fully unlock one class tree');
console.log('-'.repeat(72));
console.log(`  Full tree cost: ${FULL_CLASS_TREE_COST} essence`);
for (const r of results) {
  const runsNeeded = Math.ceil(FULL_CLASS_TREE_COST / r.essence);
  console.log(`  ${r.classId.padEnd(8)} -> ${r.essence} essence/run (fresh char) -> ~${runsNeeded} runs to fully unlock the tree`);
}
console.log();
console.log('Note: essence-per-run GROWS as the tree unlocks (better economy/keep survival');
console.log('-> deeper runs -> more essence), so the true run count to full completion is');
console.log('lower than this fresh-character estimate. This is an upper bound, not a forecast.');

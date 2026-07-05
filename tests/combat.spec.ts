import { describe, it, expect } from 'vitest';
import { EventBus } from '../src/core/EventBus';
import { Grid } from '../src/sim/Grid';
import { FlowField } from '../src/sim/FlowField';
import { Tower } from '../src/sim/Tower';
import { Enemy } from '../src/sim/Enemy';
import { EnemySpatialIndex, stepCombat } from '../src/sim/Combat';
import { damageAfterArmor } from '../src/data/enemies';

function setup() {
  const grid = new Grid({ cols: 6, rows: 1, spawns: [[0, 0]], exits: [[5, 0]] });
  const flow = new FlowField(grid);
  const bus = new EventBus();
  const index = new EnemySpatialIndex();
  return { grid, flow, bus, index };
}

describe('Armor mitigation formula', () => {
  it('subtracts flat armor with a floor of 1 damage', () => {
    expect(damageAfterArmor(20, 3, 0)).toBe(17);
    expect(damageAfterArmor(2, 5, 0)).toBe(1); // floor, never zero/negative
    expect(damageAfterArmor(20, 3, 999)).toBe(20); // armor pierce negates armor
  });
});

describe('Combat RPS: Laser out-DPS vs Tesla/Mortar against armored Golem', () => {
  it('Laser deals more effective damage per shot than Tesla at tier 1 due to flat armor subtraction', () => {
    const { grid, flow, bus, index } = setup();
    const laser = new Tower('laser', 1, 0);
    const tesla = new Tower('tesla', 1, 0);
    const golem = new Enemy('golem', [3, 0]);

    stepCombat([laser], [golem], flow, index, 1, bus);
    const hpAfterLaser = golem.hp;

    const golem2 = new Enemy('golem', [3, 0]);
    stepCombat([tesla], [golem2], flow, index, 1, bus);
    const hpAfterTesla = golem2.hp;

    expect(golem.maxHp - hpAfterLaser).toBeGreaterThan(golem2.maxHp - hpAfterTesla);
    void grid;
  });

  it('kills a soldier and awards bounty via events', () => {
    const { grid, flow, bus, index } = setup();
    const laser = new Tower('laser', 1, 0);
    laser.tier = 3; // 22 damage, one-shots a 30hp soldier over a couple hits
    const soldier = new Enemy('soldier', [1, 0]);
    let killedBounty = 0;
    bus.on('enemyKilled', (e) => (killedBounty = e.bounty));

    stepCombat([laser], [soldier], flow, index, 1, bus);
    stepCombat([laser], [soldier], flow, index, 1, bus);

    expect(soldier.alive).toBe(false);
    expect(killedBounty).toBe(3);
    void grid;
  });

  it('kamikaze disables the nearest tower on death', () => {
    const { flow, bus, index } = setup();
    const tower = new Tower('laser', 2, 0);
    tower.tier = 3;
    const kamikaze = new Enemy('kamikaze', [2, 0]);
    kamikaze.hp = 1;

    stepCombat([tower], [kamikaze], flow, index, 1, bus);

    expect(kamikaze.alive).toBe(false);
    expect(tower.isDisabled).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { Effects } from '../src/render/Effects';

/** An attack from cell (2,5) toward a target one cell to the right. */
function attacking(): Effects {
  const fx = new Effects();
  fx.emit({ type: 'attack', fromCol: 2, fromRow: 5, toX: 3.5, toY: 5.5, family: 'melee' });
  return fx;
}

describe('attack lunge animation', () => {
  it('has no offset for an idle unit', () => {
    expect(new Effects().unitLunge(2, 5)).toBeNull();
  });

  it('pushes the attacking unit toward its target', () => {
    const fx = attacking();
    fx.update(0.11); // mid-swing
    const l = fx.unitLunge(2, 5)!;
    expect(l).not.toBeNull();
    expect(l.dx).toBeGreaterThan(0); // target is to the right
    expect(Math.abs(l.dy)).toBeLessThan(1e-9); // and level with it
    expect(l.scale).toBeGreaterThan(1); // scale punch accompanies the lunge
  });

  it('returns to rest, and only animates the cell that attacked', () => {
    const fx = attacking();
    expect(fx.unitLunge(0, 0)).toBeNull();
    fx.update(0.3);
    expect(fx.unitLunge(2, 5)).toBeNull();
  });

  it('travels out and back rather than snapping', () => {
    const early = attacking();
    early.update(0.02);
    const peak = attacking();
    peak.update(0.11);
    expect(peak.unitLunge(2, 5)!.dx).toBeGreaterThan(early.unitLunge(2, 5)!.dx);

    const late = attacking();
    late.update(0.2);
    expect(late.unitLunge(2, 5)!.dx).toBeLessThan(peak.unitLunge(2, 5)!.dx);
  });
});

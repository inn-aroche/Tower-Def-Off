import { describe, it, expect } from 'vitest';
import { TowerView } from '../src/render/views/TowerView';
import { Tower } from '../src/sim/Tower';

describe('TowerView.clear() — regression for towers ghosting across level loads', () => {
  it('removes every tower mesh from the scene graph', () => {
    const view = new TowerView();
    view.add(new Tower('laser', 1, 1));
    view.add(new Tower('mortar', 2, 2));
    view.add(new Tower('tesla', 3, 3));

    // 3 tower root groups, each holding a body + a disabled-state overlay.
    expect(view.group.children.length).toBe(3);

    view.clear();

    expect(view.group.children.length).toBe(0);
  });

  it('leaves the view usable afterward — a level reload can add fresh towers', () => {
    const view = new TowerView();
    view.add(new Tower('laser', 0, 0));
    view.clear();
    view.add(new Tower('cryo', 5, 5));

    expect(view.group.children.length).toBe(1);
  });
});

import { CLASSES, CLASS_ORDER, type ClassId } from '../data/classes';
import { MAPS, type MapDef } from '../data/maps';
import { isNodeUnlockable } from '../meta/SkillTree';
import type { SaveManager } from '../meta/SaveManager';
import { analytics } from '../tracking/Analytics';

export type ScreenId = 'title' | 'classSelect' | 'hub' | 'mapSelect' | 'skillTree' | 'runSummary' | 'settings';

export interface UICallbacks {
  onStartRun: (classId: ClassId, map: MapDef) => void;
  onResetSave: () => void;
  onToggleSound: (enabled: boolean) => void;
}

export class UIManager {
  private screens = new Map<ScreenId, HTMLDivElement>();
  private container: HTMLDivElement;
  private pendingClass: ClassId | null = null;
  private lastRunSummary: { wavesSurvived: number; kills: number; essence: number } | null = null;

  constructor(root: HTMLElement, private readonly save: SaveManager, private readonly callbacks: UICallbacks) {
    this.container = document.createElement('div');
    this.container.id = 'ui-root';
    root.appendChild(this.container);
    this.buildTitle();
    this.buildClassSelect();
    this.buildHub();
    this.buildMapSelect();
    this.buildSkillTree();
    this.buildRunSummary();
    this.buildSettings();
  }

  show(id: ScreenId): void {
    for (const [key, el] of this.screens) el.classList.toggle('visible', key === id);
    if (id === 'hub') this.refreshHub();
    if (id === 'skillTree') this.refreshSkillTree();
    if (id === 'runSummary') this.refreshRunSummary();
  }

  setRunSummary(summary: { wavesSurvived: number; kills: number; essence: number }): void {
    this.lastRunSummary = summary;
  }

  private addScreen(id: ScreenId): HTMLDivElement {
    const el = document.createElement('div');
    el.className = 'screen';
    el.id = `screen-${id}`;
    this.container.appendChild(el);
    this.screens.set(id, el);
    return el;
  }

  private buildTitle(): void {
    const el = this.addScreen('title');
    el.innerHTML = `
      <div class="title-block">
        <div class="logo">⚔️ RUNEFORGE DEFENSE</div>
        <div class="subtitle">Choisis ta classe. Bâtis ton arbre. Défends le Donjon.</div>
      </div>
      <div class="spacer"></div>
      <button class="btn btn-block" id="title-play">Jouer</button>
      <div class="spacer"></div>
    `;
    el.querySelector('#title-play')!.addEventListener('click', () => {
      analytics.track({ name: 'app_open', props: {} });
      const active = this.save.get().activeClass;
      this.show(active ? 'hub' : 'classSelect');
    });
  }

  private buildClassSelect(): void {
    const el = this.addScreen('classSelect');
    const header = document.createElement('div');
    header.className = 'title-block';
    header.innerHTML = `<div class="logo" style="font-size:1.6rem;">Choisis ta classe</div>`;
    el.appendChild(header);

    const list = document.createElement('div');
    list.className = 'stack';
    for (const id of CLASS_ORDER) {
      const def = CLASSES[id];
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <div class="card-title">${def.icon} ${def.label}</div>
        <div class="card-desc">${def.tagline}<br><b>Passif :</b> ${def.passive.description}<br><b>${def.ultimate.label} :</b> ${def.ultimate.description}</div>
      `;
      card.addEventListener('click', () => {
        this.pendingClass = id;
        for (const c of Array.from(list.children)) c.classList.remove('selected');
        card.classList.add('selected');
        confirmBtn.disabled = false;
      });
      list.appendChild(card);
    }
    el.appendChild(list);
    el.appendChild(document.createElement('div')).className = 'spacer';
    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'btn btn-block';
    confirmBtn.textContent = 'Confirmer';
    confirmBtn.disabled = true;
    confirmBtn.addEventListener('click', () => {
      if (!this.pendingClass) return;
      const isFirst = this.save.get().activeClass === null;
      this.save.setActiveClass(this.pendingClass);
      analytics.track({ name: 'class_selected', props: { class_id: this.pendingClass, is_first_pick: isFirst } });
      this.show('hub');
    });
    el.appendChild(confirmBtn);
  }

  private buildHub(): void {
    const el = this.addScreen('hub');
    el.innerHTML = `
      <div class="title-block"><div class="logo" style="font-size:1.6rem;">⚔️ RUNEFORGE DEFENSE</div></div>
      <div class="panel" id="hub-class-panel"></div>
      <div class="spacer" style="flex:0 0 16px;"></div>
      <div class="stack">
        <button class="btn btn-block" id="hub-play">Jouer</button>
        <button class="btn btn-secondary btn-block" id="hub-skilltree">🌳 Arbre de compétences</button>
        <button class="btn btn-secondary btn-block" id="hub-switch">🔁 Changer de classe</button>
        <button class="btn btn-secondary btn-block" id="hub-settings">⚙️ Réglages</button>
      </div>
    `;
    el.querySelector('#hub-play')!.addEventListener('click', () => this.show('mapSelect'));
    el.querySelector('#hub-skilltree')!.addEventListener('click', () => this.show('skillTree'));
    el.querySelector('#hub-switch')!.addEventListener('click', () => this.show('classSelect'));
    el.querySelector('#hub-settings')!.addEventListener('click', () => this.show('settings'));
  }

  private refreshHub(): void {
    const data = this.save.get();
    const classId = data.activeClass!;
    const def = CLASSES[classId];
    const panel = this.container.querySelector('#hub-class-panel')!;
    panel.innerHTML = `
      <div class="card-title">${def.icon} ${def.label}</div>
      <div class="card-desc">${def.tagline}</div>
      <div class="row between" style="margin-top:10px;">
        <span>✨ Essence</span><b>${data.essence}</b>
      </div>
      <div class="row between">
        <span>🏆 Meilleure vague</span><b>${data.stats.bestWave}</b>
      </div>
    `;
  }

  private buildMapSelect(): void {
    const el = this.addScreen('mapSelect');
    const header = document.createElement('div');
    header.className = 'title-block';
    header.innerHTML = `<div class="logo" style="font-size:1.6rem;">Choisis ta carte</div>`;
    el.appendChild(header);
    const list = document.createElement('div');
    list.className = 'stack';
    for (const map of MAPS) {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `<div class="card-title">🗺️ ${map.label}</div><div class="card-desc">${map.description}</div>`;
      card.addEventListener('click', () => this.callbacks.onStartRun(this.save.get().activeClass!, map));
      list.appendChild(card);
    }
    el.appendChild(list);
    const back = document.createElement('button');
    back.className = 'btn btn-secondary btn-block';
    back.textContent = '← Retour';
    back.addEventListener('click', () => this.show('hub'));
    el.appendChild(back);
  }

  private buildSkillTree(): void {
    const el = this.addScreen('skillTree');
    el.innerHTML = `
      <div class="title-block"><div class="logo" style="font-size:1.6rem;">Arbre de compétences</div>
        <div class="subtitle">✨ <span id="st-essence">0</span> essence disponible</div>
      </div>
      <div class="skilltree-branches" id="st-branches"></div>
      <div class="spacer"></div>
      <button class="btn btn-secondary btn-block" id="st-back">← Retour</button>
    `;
    el.querySelector('#st-back')!.addEventListener('click', () => this.show('hub'));
  }

  private refreshSkillTree(): void {
    const data = this.save.get();
    const classId = data.activeClass!;
    const def = CLASSES[classId];
    const unlocked = this.save.unlockedNodesFor(classId);
    (this.container.querySelector('#st-essence') as HTMLElement).textContent = String(data.essence);
    const branchesEl = this.container.querySelector('#st-branches')!;
    branchesEl.innerHTML = '';
    for (const branch of def.branches) {
      const col = document.createElement('div');
      col.className = 'skilltree-branch';
      const title = document.createElement('div');
      title.className = 'skilltree-branch-title';
      title.textContent = branch.label;
      col.appendChild(title);
      for (const node of branch.nodes) {
        const isUnlocked = unlocked.has(node.id);
        const canUnlock = isNodeUnlockable(classId, node.id, unlocked) && data.essence >= node.cost;
        const nodeEl = document.createElement('div');
        nodeEl.className = `skillnode ${isUnlocked ? 'unlocked' : canUnlock ? 'available' : ''}`;
        nodeEl.innerHTML = `<b>${node.label}</b><div>${node.description}</div>${isUnlocked ? '<span class="cost">✅</span>' : `<span class="cost">✨ ${node.cost}</span>`}`;
        if (canUnlock) {
          nodeEl.addEventListener('click', () => {
            if (this.save.unlockNode(classId, node.id, node.cost)) {
              analytics.track({ name: 'skill_node_unlocked', props: { class_id: classId, branch: node.branch, tier: node.tier, essence_spent: node.cost } });
              this.refreshSkillTree();
            }
          });
        }
        col.appendChild(nodeEl);
      }
      branchesEl.appendChild(col);
    }
  }

  private buildRunSummary(): void {
    const el = this.addScreen('runSummary');
    el.innerHTML = `
      <div class="title-block"><div class="logo" style="font-size:1.6rem;">Le Donjon est tombé</div></div>
      <div class="panel" id="summary-panel"></div>
      <div class="spacer"></div>
      <div class="stack">
        <button class="btn btn-block" id="summary-retry">↻ Rejouer</button>
        <button class="btn btn-secondary btn-block" id="summary-hub">🏠 Retour au menu</button>
      </div>
    `;
    el.querySelector('#summary-hub')!.addEventListener('click', () => this.show('hub'));
    el.querySelector('#summary-retry')!.addEventListener('click', () => this.show('mapSelect'));
  }

  private refreshRunSummary(): void {
    if (!this.lastRunSummary) return;
    const { wavesSurvived, kills, essence } = this.lastRunSummary;
    this.container.querySelector('#summary-panel')!.innerHTML = `
      <div class="row between"><span>🌊 Vagues survécues</span><b>${wavesSurvived}</b></div>
      <div class="row between"><span>💀 Ennemis vaincus</span><b>${kills}</b></div>
      <div class="row between"><span>✨ Essence gagnée</span><b>+${essence}</b></div>
    `;
  }

  private buildSettings(): void {
    const el = this.addScreen('settings');
    el.innerHTML = `
      <div class="title-block"><div class="logo" style="font-size:1.6rem;">Réglages</div></div>
      <div class="stack">
        <label class="row between panel"><span>🔊 Son</span><input type="checkbox" id="settings-sound" checked /></label>
        <button class="btn btn-danger btn-block" id="settings-reset">Réinitialiser la sauvegarde</button>
        <button class="btn btn-secondary btn-block" id="settings-back">← Retour</button>
      </div>
    `;
    const soundToggle = el.querySelector('#settings-sound') as HTMLInputElement;
    soundToggle.checked = this.save.get().settings.sound;
    soundToggle.addEventListener('change', () => {
      this.save.setSound(soundToggle.checked);
      analytics.track({ name: 'settings_changed', props: { key: 'sound', value: String(soundToggle.checked) } });
      this.callbacks.onToggleSound(soundToggle.checked);
    });
    el.querySelector('#settings-reset')!.addEventListener('click', () => {
      if (confirm('Réinitialiser toute la progression (classe, essence, arbre de compétences) ?')) {
        this.callbacks.onResetSave();
        this.show('title');
      }
    });
    el.querySelector('#settings-back')!.addEventListener('click', () => this.show('hub'));
  }
}

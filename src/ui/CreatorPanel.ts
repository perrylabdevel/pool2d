import { UIPanel } from './panels/UIPanel';

type CreatorTool = 'place' | 'move' | 'delete';

export class CreatorPanel {
  private panel: HTMLElement;
  private controller: UIPanel;
  private activeTool: CreatorTool = 'move';
  private toolLocked: boolean = false;
  private selectedBallId: number = 1;
  private layoutSelect: HTMLSelectElement | null = null;

  constructor() {
    this.panel = this.createPanel();
    const focusTarget = this.panel.querySelector<HTMLElement>('input, button, select');
    this.controller = new UIPanel({ id: 'creator-panel', element: this.panel, focusTarget });
    this.controller.addEventListener('panel:open', () => {
      this.requestLayouts();
      this.syncToolLock();
    });

    this.bindEvents();
  }

  getController(): UIPanel {
    return this.controller;
  }

  private createPanel(): HTMLElement {
    let panel = document.getElementById('creator-panel') as HTMLElement | null;
    if (panel) return panel;

    const hud = document.getElementById('hud');
    const hudHeader = document.querySelector('.hud-header');
    const hudRight = document.getElementById('player2-info');
    panel = document.createElement('div');
    panel.id = 'creator-panel';
    panel.className = 'creator-shelf hidden';
    panel.innerHTML = `
      <div class="creator-shelf-inner" role="group" aria-label="Creator Mode Controls">
        <div class="creator-shelf-group creator-shelf-tools">
          <span class="creator-group-label">Tools</span>
          <div class="creator-tool-grid">
            <button class="panel-btn creator-tool-btn" data-tool="move">Move</button>
            <button class="panel-btn creator-tool-btn" data-tool="place">Place</button>
            <button class="panel-btn creator-tool-btn" data-tool="delete">Delete</button>
            <span class="creator-tool-divider" aria-hidden="true"></span>
            <button class="panel-btn" id="creator-clear">Clear</button>
            <button class="panel-btn" id="creator-rack">Rack</button>
            <button class="panel-btn" id="creator-undo">Undo</button>
            <button class="panel-btn" id="creator-reset-cue">Reset Cue</button>
          </div>
          <label class="panel-toggle-row creator-tool-lock" title="Hold Shift to delete, Alt/Ctrl to place">
            <input type="checkbox" id="creator-lock-tool" />
            <span>Stay</span>
          </label>
        </div>
        <div class="creator-shelf-group creator-shelf-balls">
          <span class="creator-group-label">Ball</span>
          <div class="creator-ball-grid" role="listbox" aria-label="Ball Palette">
            <button class="panel-btn creator-ball-btn" data-ball-id="0">Cue</button>
            ${Array.from({ length: 15 }).map((_, i) => `<button class="panel-btn creator-ball-btn" data-ball-id="${i + 1}">${i + 1}</button>`).join('')}
          </div>
        </div>
        <div class="creator-shelf-group creator-shelf-layouts">
          <span class="creator-group-label">Layouts</span>
          <input id="creator-layout-name" type="text" placeholder="Layout name" />
          <button class="panel-btn" id="creator-save">Save</button>
          <select id="creator-layout-select"></select>
          <button class="panel-btn" id="creator-load">Load</button>
          <button class="panel-btn" id="creator-delete">Delete</button>
        </div>
      </div>
    `;

    if (hudHeader) {
      if (hudRight && hudRight.parentElement === hudHeader) {
        hudHeader.insertBefore(panel, hudRight);
      } else {
        hudHeader.append(panel);
      }
    } else if (hud) {
      hud.append(panel);
    } else {
      document.body.append(panel);
    }

    return panel;
  }

  private bindEvents(): void {
    this.panel.querySelectorAll<HTMLButtonElement>('.creator-tool-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tool = btn.dataset.tool as CreatorTool | undefined;
        if (!tool) return;
        this.setActiveTool(tool);
        window.dispatchEvent(new CustomEvent('creator:tool', { detail: { tool } }));
      });
    });

    this.panel.querySelectorAll<HTMLButtonElement>('.creator-ball-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.ballId);
        if (Number.isNaN(id)) return;
        this.setSelectedBall(id);
        window.dispatchEvent(new CustomEvent('creator:select-ball', { detail: { ballId: id } }));
      });
    });

    const clearBtn = this.panel.querySelector<HTMLButtonElement>('#creator-clear');
    clearBtn?.addEventListener('click', () => window.dispatchEvent(new CustomEvent('creator:clear')));

    const rackBtn = this.panel.querySelector<HTMLButtonElement>('#creator-rack');
    rackBtn?.addEventListener('click', () => window.dispatchEvent(new CustomEvent('creator:rack')));

    const undoBtn = this.panel.querySelector<HTMLButtonElement>('#creator-undo');
    undoBtn?.addEventListener('click', () => window.dispatchEvent(new CustomEvent('creator:undo')));

    const resetCueBtn = this.panel.querySelector<HTMLButtonElement>('#creator-reset-cue');
    resetCueBtn?.addEventListener('click', () => window.dispatchEvent(new CustomEvent('creator:reset-cue')));

    const saveBtn = this.panel.querySelector<HTMLButtonElement>('#creator-save');
    const nameInput = this.panel.querySelector<HTMLInputElement>('#creator-layout-name');
    saveBtn?.addEventListener('click', () => {
      const name = nameInput?.value ?? '';
      window.dispatchEvent(new CustomEvent('creator:save-layout', { detail: { name } }));
    });

    const lockToggle = this.panel.querySelector<HTMLInputElement>('#creator-lock-tool');
    lockToggle?.addEventListener('change', () => {
      const locked = !!lockToggle.checked;
      this.toolLocked = locked;
      (window as any).__creatorToolLock = locked;
      window.dispatchEvent(new CustomEvent('creator:lock-tool', { detail: { locked } }));
    });

    this.layoutSelect = this.panel.querySelector<HTMLSelectElement>('#creator-layout-select');
    const loadBtn = this.panel.querySelector<HTMLButtonElement>('#creator-load');
    loadBtn?.addEventListener('click', () => {
      const name = this.layoutSelect?.value ?? '';
      window.dispatchEvent(new CustomEvent('creator:load-layout', { detail: { name } }));
    });

    const deleteBtn = this.panel.querySelector<HTMLButtonElement>('#creator-delete');
    deleteBtn?.addEventListener('click', () => {
      const name = this.layoutSelect?.value ?? '';
      window.dispatchEvent(new CustomEvent('creator:delete-layout', { detail: { name } }));
    });

    window.addEventListener('creator:layouts-updated', (event) => {
      const detail = (event as CustomEvent<{ layouts: Array<{ name: string }> }>).detail;
      this.updateLayoutOptions(detail?.layouts ?? []);
    });
    window.addEventListener('creator:tool-updated', (event) => {
      const detail = (event as CustomEvent<{ tool: CreatorTool }>).detail;
      if (!detail?.tool) return;
      if (detail.tool !== this.activeTool) {
        this.setActiveTool(detail.tool);
      }
    });

    this.setActiveTool(this.activeTool);
    this.setSelectedBall(this.selectedBallId);
    this.syncToolLock();
  }

  private setActiveTool(tool: CreatorTool) {
    this.activeTool = tool;
    this.panel.querySelectorAll<HTMLButtonElement>('.creator-tool-btn').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.tool === tool);
    });
    (window as any).__creatorTool = tool;
  }

  private setSelectedBall(ballId: number) {
    this.selectedBallId = ballId;
    this.panel.querySelectorAll<HTMLButtonElement>('.creator-ball-btn').forEach((btn) => {
      btn.classList.toggle('is-active', Number(btn.dataset.ballId) === ballId);
    });
    (window as any).__creatorSelectedBallId = ballId;
  }

  private updateLayoutOptions(layouts: Array<{ name: string }>) {
    if (!this.layoutSelect) return;
    const previous = this.layoutSelect.value;
    this.layoutSelect.innerHTML = '';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = layouts.length ? 'Select layout' : 'No saved layouts';
    this.layoutSelect.appendChild(placeholder);

    layouts.forEach((layout) => {
      const option = document.createElement('option');
      option.value = layout.name;
      option.textContent = layout.name;
      this.layoutSelect?.appendChild(option);
    });

    if (previous) {
      this.layoutSelect.value = previous;
    }
  }

  private syncToolLock() {
    const lockToggle = this.panel.querySelector<HTMLInputElement>('#creator-lock-tool');
    const locked = (window as any).__creatorToolLock ?? this.toolLocked;
    if (lockToggle) {
      lockToggle.checked = !!locked;
    }
    this.toolLocked = !!locked;
  }

  private requestLayouts() {
    window.dispatchEvent(new CustomEvent('creator:request-layouts'));
  }
}

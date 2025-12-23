import { UIPanel } from './panels/UIPanel';

type CreatorTool = 'place' | 'move' | 'delete';

export class CreatorPanel {
  private panel: HTMLElement;
  private controller: UIPanel;
  private activeTool: CreatorTool = 'move';
  private toolLocked: boolean = false;
  private selectedBallId: number = 1;
  private layoutSelect: HTMLSelectElement | null = null;
  private isDragging = false;
  private dragOffsetX = 0;
  private dragOffsetY = 0;
  private dragPointerId: number | null = null;
  private dragReady = false;
  private readonly storageKey = 'creatorPanelPositionV1';

  constructor() {
    this.panel = this.createPanel();
    const focusTarget = this.panel.querySelector<HTMLElement>('input, button, select');
    this.controller = new UIPanel({ id: 'creator-panel', element: this.panel, focusTarget });
    this.controller.addEventListener('panel:open', () => {
      this.requestLayouts();
      this.syncToolLock();
      requestAnimationFrame(() => this.ensureDraggablePosition(true));
    });

    this.bindEvents();
    this.enableDrag();
    requestAnimationFrame(() => this.ensureDraggablePosition());
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

  private enableDrag() {
    this.panel.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      if (this.isInteractiveTarget(event.target as HTMLElement | null)) return;
      this.ensureDraggablePosition();

      const rect = this.panel.getBoundingClientRect();
      this.isDragging = true;
      this.dragPointerId = event.pointerId;
      this.dragOffsetX = event.clientX - rect.left;
      this.dragOffsetY = event.clientY - rect.top;
      this.panel.setPointerCapture(event.pointerId);
    });

    this.panel.addEventListener('pointermove', (event) => {
      if (!this.isDragging || this.dragPointerId !== event.pointerId) return;
      this.applyDragPosition(event.clientX - this.dragOffsetX, event.clientY - this.dragOffsetY);
    });

    const endDrag = (event: PointerEvent) => {
      if (!this.isDragging || (this.dragPointerId !== null && event.pointerId !== this.dragPointerId)) return;
      this.isDragging = false;
      this.dragPointerId = null;
      this.panel.releasePointerCapture(event.pointerId);
      const rect = this.panel.getBoundingClientRect();
      this.savePosition(rect.left, rect.top);
    };

    this.panel.addEventListener('pointerup', endDrag);
    this.panel.addEventListener('pointercancel', endDrag);

    window.addEventListener('resize', () => {
      if (!this.dragReady) return;
      const rect = this.panel.getBoundingClientRect();
      this.applyDragPosition(rect.left, rect.top, true);
    });
  }

  private ensureDraggablePosition(force: boolean = false) {
    if (this.dragReady && !force) return;
    const rect = this.panel.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;

    const saved = this.loadSavedPosition();
    if (this.dragReady && force && saved) {
      this.applyDragPosition(saved.left, saved.top, true);
      return;
    }

    this.panel.style.position = 'fixed';
    if (saved) {
      this.panel.style.left = `${saved.left}px`;
      this.panel.style.top = `${saved.top}px`;
    } else {
      this.panel.style.left = `${rect.left}px`;
      this.panel.style.top = `${rect.top}px`;
    }
    this.panel.style.margin = '0';
    this.panel.style.width = `${rect.width}px`;
    this.panel.style.maxWidth = 'calc(100vw - 24px)';
    this.panel.style.zIndex = '9999';
    this.panel.style.touchAction = 'none';
    this.dragReady = true;

    if (saved) {
      const current = this.panel.getBoundingClientRect();
      this.applyDragPosition(current.left, current.top, true);
    }
  }

  private applyDragPosition(left: number, top: number, skipSave: boolean = false) {
    const rect = this.panel.getBoundingClientRect();
    const maxLeft = Math.max(8, window.innerWidth - rect.width - 8);
    const maxTop = Math.max(8, window.innerHeight - rect.height - 8);
    const clampedLeft = Math.max(8, Math.min(maxLeft, left));
    const clampedTop = Math.max(8, Math.min(maxTop, top));
    this.panel.style.left = `${clampedLeft}px`;
    this.panel.style.top = `${clampedTop}px`;
    if (!skipSave) {
      this.savePosition(clampedLeft, clampedTop);
    }
  }

  private isInteractiveTarget(target: HTMLElement | null): boolean {
    if (!target) return false;
    return !!target.closest('button, input, select, option, textarea, label');
  }

  private savePosition(left: number, top: number) {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify({ left, top }));
    } catch {
      // Ignore storage errors (private mode, quota, etc.)
    }
  }

  private loadSavedPosition(): { left: number; top: number } | null {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { left?: number; top?: number };
      if (typeof parsed.left !== 'number' || typeof parsed.top !== 'number') return null;
      return { left: parsed.left, top: parsed.top };
    } catch {
      return null;
    }
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

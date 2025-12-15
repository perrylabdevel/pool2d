/**
 * TableEditorApp - Main application class for the Table Editor
 * - Multi-table library (IndexedDB)
 * - Visual geometry editing with symmetry (mirror-on by default)
 * - Optional skin image library (IndexedDB)
 * - Node-side save workflow (local save server)
 */

import { TablePreview } from './components/TablePreview';
import { SkinStore } from './stores/SkinStore';
import { TableLibraryStore, type TableDocument } from './stores/TableLibraryStore';
import { jsonLoader, type PhysicsJson } from './utils/JsonLoader';
import {
  applyGeometryEdit,
  ensureDerivedPlayAreaRails,
  getSemanticGeometryWarnings,
  isDerivedPlayAreaRailId,
  scalePhysicsJson,
  resymmetrizePhysicsJson,
  sanitizePhysicsJson,
  type GeometryEdit,
  type GeometrySelection,
  type RadiusScaleRule,
} from './utils/TableGeometryUtils';

export class TableEditorApp {
  private preview: TablePreview | null = null;
  private skinStore = new SkinStore();
  private tableLibrary = new TableLibraryStore();

  private activeRightTab: 'selection' | 'pockets' | 'rails' | 'resize' | 'save' = 'selection';
  private activeLeftTab: 'tables' | 'skins' = 'tables';

  private isConnected: boolean = false;
  private ws: WebSocket | null = null;

  private editMode: boolean = false;
  private mirrorEnabled: boolean = true;
  private selection: GeometrySelection | null = null;

  private activeTableId: string | null = null;
  private activeTable: TableDocument | null = null;

  private activeSkinId: string | null = null;

  private undoStack: PhysicsJson[] = [];
  private redoStack: PhysicsJson[] = [];
  private dirty: boolean = false;
  private persistTimer: number | null = null;

  private jsonTextarea: HTMLTextAreaElement | null = null;
  private jsonDirty: boolean = false;
  private jsonLastSynced: string = '';

  private playAreaUnits: 'in' | 'px' = this.loadPlayAreaUnits();

  private templatePhysicsJson: PhysicsJson | null = null;

  async init(): Promise<void> {
    await this.skinStore.init();
    await this.tableLibrary.init();

    const canvas = document.getElementById('preview-canvas') as HTMLCanvasElement | null;
    if (canvas) {
      this.preview = new TablePreview(canvas);
      this.preview.setCallbacks({
        onEdit: (edit) => this.handlePreviewEdit(edit),
        onSelect: (sel) => this.setSelection(sel),
      });
      await this.preview.init();
    }

    this.setupEventListeners();
    this.setupDragDrop();

    await this.ensureInitialTable();
    await this.loadActiveSkin();

    this.renderLeftSidebar();
    this.renderRightSidebar();
    this.renderSkinGrid();

    this.connectToGame();
    this.updateHeader();
    this.updateJsonEditorText();
  }

  private loadPlayAreaUnits(): 'in' | 'px' {
    try {
      const v = localStorage.getItem('table-editor-playarea-units');
      if (v === 'px' || v === 'in') return v;
    } catch {
      // ignore
    }
    return 'in';
  }

  private setPlayAreaUnits(units: 'in' | 'px'): void {
    this.playAreaUnits = units;
    try {
      localStorage.setItem('table-editor-playarea-units', units);
    } catch {
      // ignore
    }
    this.renderRightSidebar();
  }

  private getPixelsPerInch(json: PhysicsJson): number {
    const ppi = json.meta?.pixelsPerInch;
    if (typeof ppi === 'number' && Number.isFinite(ppi) && ppi > 0) return ppi;
    const pxW = (json.meta as any)?.pixelRects?.inner?.width;
    if (typeof pxW === 'number' && Number.isFinite(pxW) && pxW > 0 && json.playArea.width > 0) {
      return pxW / json.playArea.width;
    }
    return 7.68;
  }

  private async setPixelsPerInch(ppi: number): Promise<void> {
    if (!this.activeTable) return;
    if (!Number.isFinite(ppi) || ppi <= 0) return;
    const next = structuredClone(this.activeTable.physicsJson);
    next.meta = next.meta ?? {};
    next.meta.pixelsPerInch = ppi;
    await this.applyPhysicsUpdate(next, true);
  }

  private ensureJsonEditorUi(): void {
    const host = document.getElementById('json-editor');
    if (!host) return;
    if (this.jsonTextarea) return;

    host.innerHTML = `
      <div class="json-toolbar">
        <div class="json-toolbar-left">
          <button class="btn" id="btn-json-format">Format</button>
          <button class="btn btn-primary" id="btn-json-apply">Apply</button>
          <button class="btn" id="btn-json-revert">Revert</button>
        </div>
        <div class="json-status" id="json-status"></div>
      </div>
      <textarea class="json-textarea" id="json-textarea" spellcheck="false"></textarea>
    `;

    this.jsonTextarea = host.querySelector('#json-textarea') as HTMLTextAreaElement | null;

    this.jsonTextarea?.addEventListener('input', () => {
      this.jsonDirty = true;
      this.updateJsonStatus();
    });

    host.querySelector('#btn-json-format')?.addEventListener('click', () => this.formatJsonEditor());
    host.querySelector('#btn-json-revert')?.addEventListener('click', () => this.revertJsonEditor());
    host.querySelector('#btn-json-apply')?.addEventListener('click', () => void this.applyJsonEditor());

    this.updateJsonStatus();
  }

  private async ensureInitialTable(): Promise<void> {
    const existing = this.tableLibrary.getAll();
    if (existing.length === 0) {
      const baseRaw = await jsonLoader.load();
      const { json: base } = sanitizePhysicsJson(baseRaw);
      const created = await this.tableLibrary.create({
        name: 'Default Table',
        linkedSkinId: null,
        physicsJson: base,
      });
      this.tableLibrary.setActiveTableId(created.id);
    }

    const activeId = this.tableLibrary.getActiveTableId();
    const tables = this.tableLibrary.getAll();
    const chosen = activeId && this.tableLibrary.get(activeId) ? this.tableLibrary.get(activeId)! : tables[0];
    await this.selectTable(chosen.id);
  }

  private async getTemplatePhysicsJson(): Promise<PhysicsJson> {
    if (this.templatePhysicsJson) return this.templatePhysicsJson;
    const raw = await jsonLoader.load();
    const { json } = sanitizePhysicsJson(raw);
    this.templatePhysicsJson = json;
    return json;
  }

  private updateHeader(): void {
    const label = document.getElementById('active-table-name');
    if (!label) return;
    label.textContent = this.activeTable ? `— ${this.activeTable.name}${this.dirty ? ' *' : ''}` : '';
  }

  private setDirty(dirty: boolean): void {
    this.dirty = dirty;
    this.updateHeader();
  }

  private getActivePhysics(): PhysicsJson | null {
    return this.activeTable?.physicsJson ?? null;
  }

  private async selectTable(id: string): Promise<void> {
    const table = this.tableLibrary.get(id);
    if (!table) return;

    const { json: sanitized, repairs } = sanitizePhysicsJson(table.physicsJson);
    if (repairs > 0) {
      table.physicsJson = sanitized;
      void this.tableLibrary.save(table);
    }

    this.activeTableId = id;
    this.activeTable = table;
    this.tableLibrary.setActiveTableId(id);

    this.undoStack = [];
    this.redoStack = [];
    this.setDirty(false);
    this.selection = null;
    this.jsonDirty = false;
    if (this.persistTimer) {
      window.clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }

    this.preview?.setSelection(null);
    this.preview?.setPhysicsJson(table.physicsJson);

    this.renderTableList();
    this.renderRightSidebar();
    this.updateJsonEditorText();
  }

  private setSelection(selection: GeometrySelection | null): void {
    this.selection = selection;
    this.preview?.setSelection(selection);
    if (this.activeRightTab === 'selection') this.renderRightSidebar();
  }

  private pushUndoSnapshot(): void {
    const json = this.getActivePhysics();
    if (!json) return;
    this.undoStack.push(structuredClone(json));
    if (this.undoStack.length > 100) this.undoStack.shift();
    this.redoStack = [];
  }

  private async applyPhysicsUpdate(nextJson: PhysicsJson, markDirty = true): Promise<void> {
    if (!this.activeTable) return;
    const { json: sanitized, repairs } = sanitizePhysicsJson(nextJson);
    if (repairs > 0) {
      console.warn(`[TableEditor] Repaired invalid geometry (${repairs})`);
    }
    const withDerived = ensureDerivedPlayAreaRails(sanitized);
    this.activeTable.physicsJson = withDerived;
    this.preview?.setPhysicsJson(withDerived);
    if (markDirty) this.setDirty(true);
    this.updateJsonEditorText();
    this.renderRightSidebar();
    this.schedulePersistActiveTable();
  }

  private schedulePersistActiveTable(): void {
    if (!this.activeTable) return;
    if (this.persistTimer) window.clearTimeout(this.persistTimer);
    this.persistTimer = window.setTimeout(() => {
      this.persistTimer = null;
      if (!this.activeTable) return;
      void this.tableLibrary.save(this.activeTable);
    }, 250);
  }

  private handlePreviewEdit(edit: GeometryEdit): void {
    const current = this.getActivePhysics();
    if (!current) return;
    this.pushUndoSnapshot();
    const next = applyGeometryEdit({ json: current, edit, mirrorEnabled: this.mirrorEnabled });
    void this.applyPhysicsUpdate(next, true);
  }

  private setupEventListeners(): void {
    document.querySelectorAll('.tab[data-tab]').forEach((tab) => {
      tab.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const tabName = target.dataset.tab as any;
        if (!tabName) return;
        this.activeRightTab = tabName;
        document
          .querySelectorAll('.tab[data-tab]')
          .forEach((t) => t.classList.toggle('active', (t as HTMLElement).dataset.tab === tabName));
        this.renderRightSidebar();
      });
    });

    document.querySelectorAll('.tab[data-left-tab]').forEach((tab) => {
      tab.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const tabName = target.dataset.leftTab as any;
        if (!tabName) return;
        this.activeLeftTab = tabName;
        document
          .querySelectorAll('.tab[data-left-tab]')
          .forEach((t) => t.classList.toggle('active', (t as HTMLElement).dataset.leftTab === tabName));
        this.renderLeftSidebar();
      });
    });

    document.getElementById('btn-zoom-in')?.addEventListener('click', () => this.preview?.zoomIn());
    document.getElementById('btn-zoom-out')?.addEventListener('click', () => this.preview?.zoomOut());
    document.getElementById('btn-reset-view')?.addEventListener('click', () => this.preview?.resetView());

    document.getElementById('btn-edit-points')?.addEventListener('click', () => {
      this.editMode = !this.editMode;
      document.getElementById('btn-edit-points')?.classList.toggle('active', this.editMode);
      this.preview?.setEditingEnabled(this.editMode);
      if (!this.editMode) this.setSelection(null);
    });

    document.getElementById('btn-toggle-mirror')?.addEventListener('click', (e) => {
      this.mirrorEnabled = !this.mirrorEnabled;
      (e.currentTarget as HTMLElement).classList.toggle('active', this.mirrorEnabled);
      this.renderRightSidebar();
    });

    document.getElementById('btn-reset-symmetry')?.addEventListener('click', () => void this.resetSymmetry());

    document.getElementById('btn-toggle-balls')?.addEventListener('click', (e) => {
      const btn = e.currentTarget as HTMLElement;
      btn.classList.toggle('active');
      this.preview?.toggleBalls(btn.classList.contains('active'));
    });

    document.getElementById('btn-toggle-measure')?.addEventListener('click', (e) => {
      const btn = e.currentTarget as HTMLElement;
      btn.classList.toggle('active');
      this.preview?.toggleMeasurements(btn.classList.contains('active'));
    });

    document.getElementById('btn-rack')?.addEventListener('click', () => this.preview?.rackBalls());

    document.getElementById('btn-import')?.addEventListener('click', () => this.importFile());
    document.getElementById('btn-export')?.addEventListener('click', () => this.exportCurrent());
    document.getElementById('btn-create-prompt')?.addEventListener('click', () => void this.createPromptForVisionLlm());
    document.getElementById('btn-save-disk')?.addEventListener('click', () => void this.saveToDisk({ setActive: false }));
    document.getElementById('btn-push-live')?.addEventListener('click', () => this.pushToGame('live'));
    document.getElementById('btn-push-persist')?.addEventListener('click', () => this.pushToGame('persist'));

    document.getElementById('bottom-panel-toggle')?.addEventListener('click', () => {
      document.getElementById('bottom-panel')?.classList.toggle('collapsed');
    });

    document.getElementById('btn-new-table')?.addEventListener('click', () => void this.createTableFlow());
    document.getElementById('btn-dup-table')?.addEventListener('click', () => void this.duplicateActiveTable());
    document.getElementById('btn-delete-table')?.addEventListener('click', () => void this.deleteActiveTable());
    document.getElementById('btn-set-active-table')?.addEventListener('click', () => void this.saveToDisk({ setActive: true }));
    document.getElementById('btn-new-skin')?.addEventListener('click', () => void this.createNewSkin());

    const isTypingTarget = (el: EventTarget | null): boolean => {
      const node = el as HTMLElement | null;
      if (!node) return false;
      const tag = node.tagName?.toLowerCase?.() ?? '';
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
      if ((node as any).isContentEditable) return true;
      return false;
    };

    const tryNudgeSelection = (e: KeyboardEvent): boolean => {
      if (!this.activeTable) return false;
      if (!this.editMode) return false;
      if (!this.selection) return false;
      if (e.ctrlKey || e.metaKey) return false;
      if (isTypingTarget(e.target)) return false;

      const key = e.key;
      if (key !== 'ArrowUp' && key !== 'ArrowDown' && key !== 'ArrowLeft' && key !== 'ArrowRight') return false;

      const json = this.getActivePhysics();
      if (!json) return false;

      const ppi = this.getPixelsPerInch(json);
      const baseStep = this.playAreaUnits === 'px' ? 1 / ppi : 0.05; // 1px or 0.05in
      const mult = e.shiftKey ? 5 : e.altKey ? 0.2 : 1;
      const step = baseStep * mult;

      const dx = key === 'ArrowLeft' ? -step : key === 'ArrowRight' ? step : 0;
      const dy = key === 'ArrowDown' ? -step : key === 'ArrowUp' ? step : 0;

      const sel = this.selection;
      const getPocket = (idx: number) => json.pockets[idx];
      const getRail = (idx: number) => json.rails[idx];

      let edit: GeometryEdit | null = null;

      if (sel.kind === 'pocket') {
        const p = getPocket(sel.pocketIndex);
        if (!p) return false;
        edit = { type: 'move-pocket-center', pocketIndex: sel.pocketIndex, x: p.center.x + dx, y: p.center.y + dy };
      } else if (sel.kind === 'pocket-outline') {
        const p = getPocket(sel.pocketIndex);
        const pt = p?.outline?.[sel.pointIndex];
        if (!p || !pt) return false;
        edit = { type: 'move-pocket-outline', pocketIndex: sel.pocketIndex, pointIndex: sel.pointIndex, x: pt.x + dx, y: pt.y + dy };
      } else if (sel.kind === 'pocket-radius') {
        const p = getPocket(sel.pocketIndex);
        if (!p) return false;
        const delta = (key === 'ArrowLeft' || key === 'ArrowDown') ? -step : step;
        edit = { type: 'set-pocket-radius', pocketIndex: sel.pocketIndex, radius: Math.max(0.25, p.radius + delta), scaleOutline: true };
      } else if (sel.kind === 'rail') {
        edit = { type: 'move-rail', railIndex: sel.railIndex, dx, dy };
      } else if (sel.kind === 'rail-end') {
        const r = getRail(sel.railIndex);
        const pt = r?.[sel.endpoint];
        if (!r || !pt) return false;
        edit = { type: 'move-rail-end', railIndex: sel.railIndex, endpoint: sel.endpoint, x: pt.x + dx, y: pt.y + dy };
      } else if (sel.kind === 'rail-outline') {
        const r = getRail(sel.railIndex);
        const pt = r?.outline?.[sel.pointIndex];
        if (!r || !pt) return false;
        edit = { type: 'move-rail-outline', railIndex: sel.railIndex, pointIndex: sel.pointIndex, x: pt.x + dx, y: pt.y + dy };
      }

      if (!edit) return false;
      e.preventDefault();
      this.pushUndoSnapshot();
      const next = applyGeometryEdit({ json, edit, mirrorEnabled: this.mirrorEnabled });
      void this.applyPhysicsUpdate(next, true);
      return true;
    };

    window.addEventListener('keydown', (e) => {
      if (tryNudgeSelection(e)) return;
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        void this.undo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && (e.key === 'z' || e.key === 'Z')))) {
        e.preventDefault();
        void this.redo();
      }
    });
  }

  private renderLeftSidebar(): void {
    const tables = document.getElementById('left-tab-tables');
    const skins = document.getElementById('left-tab-skins');
    if (tables) tables.style.display = this.activeLeftTab === 'tables' ? 'flex' : 'none';
    if (skins) skins.style.display = this.activeLeftTab === 'skins' ? 'flex' : 'none';
    this.renderTableList();
  }

  private renderTableList(): void {
    const list = document.getElementById('table-list');
    if (!list) return;

    const tables = this.tableLibrary.getAll();
    list.innerHTML = tables
      .map((t) => {
        const play = t.physicsJson?.playArea ? `${t.physicsJson.playArea.width.toFixed(2)}×${t.physicsJson.playArea.height.toFixed(2)} in` : '';
        const active = t.id === this.activeTableId ? 'active' : '';
        return `
          <div class="table-item ${active}" data-table-id="${t.id}">
            <div class="table-item-name">${t.name}</div>
            <div class="table-item-meta">${play}</div>
          </div>
        `;
      })
      .join('');

    list.querySelectorAll('.table-item[data-table-id]').forEach((el) => {
      el.addEventListener('click', () => {
        const id = (el as HTMLElement).dataset.tableId;
        if (id) void this.selectTable(id);
      });
    });
  }

  private renderRightSidebar(): void {
    const container = document.getElementById('tab-content');
    if (!container) return;

    const json = this.getActivePhysics();
    if (!json) {
      container.innerHTML = `<div style="padding: 12px; color: var(--text-muted);">No table loaded.</div>`;
      return;
    }

    if (this.activeRightTab === 'selection') {
      const summary = this.selection ? JSON.stringify(this.selection) : 'None';
      const ppi = this.getPixelsPerInch(json);
      const widthValue = this.playAreaUnits === 'px' ? json.playArea.width * ppi : json.playArea.width;
      const heightValue = this.playAreaUnits === 'px' ? json.playArea.height * ppi : json.playArea.height;
      const unitLabel = this.playAreaUnits === 'px' ? 'px' : 'in';
      container.innerHTML = `
        <div class="property-group">
          <div class="property-group-title">Edit</div>
          <div class="property-row" style="justify-content: space-between;">
            <span class="property-label">Mirror</span>
            <span style="font-size:12px; color: var(--text-muted);">${this.mirrorEnabled ? 'On' : 'Off'}</span>
          </div>
          <div class="property-row" style="gap: 8px;">
            <button class="btn ${this.mirrorEnabled ? 'btn-primary' : ''}" id="btn-mirror-toggle-panel" style="flex:1;">
              Mirror ${this.mirrorEnabled ? 'On' : 'Off'}
            </button>
            <button class="btn" id="btn-resym-panel" style="flex:1;">Resym</button>
          </div>
          <div class="property-row" style="justify-content: space-between;">
            <span class="property-label">Selection</span>
            <span style="font-size:11px; color: var(--text-muted); overflow:hidden; text-overflow: ellipsis; max-width: 170px;">${summary}</span>
          </div>
        </div>
        <div class="property-group">
          <div class="property-group-title">Play Area</div>
          <div class="property-row">
            <span class="property-label">Units</span>
            <select class="property-input" id="play-units">
              <option value="in" ${this.playAreaUnits === 'in' ? 'selected' : ''}>Inches</option>
              <option value="px" ${this.playAreaUnits === 'px' ? 'selected' : ''}>Pixels</option>
            </select>
          </div>
          <div class="property-row">
            <span class="property-label">PPI</span>
            <input class="property-input" id="play-ppi" type="number" step="0.001" value="${ppi}">
          </div>
          <div class="property-row">
            <span class="property-label">Width (${unitLabel})</span>
            <input class="property-input" id="sel-play-w" type="number" step="0.01" value="${widthValue}">
          </div>
          <div class="property-row">
            <span class="property-label">Height (${unitLabel})</span>
            <input class="property-input" id="sel-play-h" type="number" step="0.01" value="${heightValue}">
          </div>
          <div class="property-row">
            <button class="btn" id="btn-apply-play-area" style="width:100%;">Scale To Size (min radius)</button>
          </div>
        </div>
      `;

      container.querySelector('#play-units')?.addEventListener('change', (e) => {
        const v = (e.currentTarget as HTMLSelectElement).value;
        if (v === 'px' || v === 'in') this.setPlayAreaUnits(v);
      });

      container.querySelector('#btn-mirror-toggle-panel')?.addEventListener('click', () => {
        this.mirrorEnabled = !this.mirrorEnabled;
        document.getElementById('btn-toggle-mirror')?.classList.toggle('active', this.mirrorEnabled);
        this.renderRightSidebar();
      });

      container.querySelector('#btn-resym-panel')?.addEventListener('click', () => void this.resetSymmetry());

      container.querySelector('#play-ppi')?.addEventListener('change', (e) => {
        const v = parseFloat((e.currentTarget as HTMLInputElement).value);
        void this.setPixelsPerInch(v);
      });

      container.querySelector('#btn-apply-play-area')?.addEventListener('click', () => {
        const ppiInput = parseFloat((container.querySelector('#play-ppi') as HTMLInputElement).value);
        const ppiNow = Number.isFinite(ppiInput) && ppiInput > 0 ? ppiInput : this.getPixelsPerInch(json);

        const wRaw = parseFloat((container.querySelector('#sel-play-w') as HTMLInputElement).value);
        const hRaw = parseFloat((container.querySelector('#sel-play-h') as HTMLInputElement).value);
        const w = this.playAreaUnits === 'px' ? wRaw / ppiNow : wRaw;
        const h = this.playAreaUnits === 'px' ? hRaw / ppiNow : hRaw;
        if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return;
        this.pushUndoSnapshot();
        let next = scalePhysicsJson({ json, newPlayWidth: w, newPlayHeight: h, radiusRule: 'min' });
        if (ppiNow !== this.getPixelsPerInch(next)) {
          next.meta = next.meta ?? {};
          next.meta.pixelsPerInch = ppiNow;
        }
        void this.applyPhysicsUpdate(next, true);
      });
      return;
    }

    if (this.activeRightTab === 'pockets') {
      container.innerHTML = `
        <div class="property-group">
          <div class="property-group-title">Pockets</div>
          <div style="padding: 8px 0; font-size: 12px; color: var(--text-muted);">
            Drag handles in Edit mode: center (sphere), outline points (small boxes), radius handle (box to the right).
          </div>
          <div style="max-height: 55vh; overflow:auto;">
            ${json.pockets
              .map(
                (p, idx) => `
                <div style="border: 1px solid var(--panel-border); border-radius: 8px; padding: 8px; margin-bottom: 8px;">
                  <div style="font-weight: 600; font-size: 12px;">${p.id || `Pocket ${idx + 1}`}</div>
                  <div style="font-size: 11px; color: var(--text-muted);">center=(${p.center.x.toFixed(2)}, ${p.center.y.toFixed(2)}) radius=${p.radius.toFixed(2)}</div>
                </div>
              `
              )
              .join('')}
          </div>
        </div>
      `;
      return;
    }

    if (this.activeRightTab === 'rails') {
      const editableRails = json.rails.filter((r) => !isDerivedPlayAreaRailId(r.id));
      container.innerHTML = `
        <div class="property-group">
          <div class="property-group-title">Rails</div>
          <div style="padding: 8px 0; font-size: 12px; color: var(--text-muted);">
            Drag endpoints and outline points in Edit mode.
          </div>
          <div style="max-height: 55vh; overflow:auto;">
            ${editableRails
              .map(
                (r, idx) => `
                <div style="border: 1px solid var(--panel-border); border-radius: 8px; padding: 8px; margin-bottom: 8px;">
                  <div style="font-weight: 600; font-size: 12px;">${r.id || `Rail ${idx + 1}`}</div>
                  <div style="font-size: 11px; color: var(--text-muted);">
                    from=(${r.from.x.toFixed(2)}, ${r.from.y.toFixed(2)}) to=(${r.to.x.toFixed(2)}, ${r.to.y.toFixed(2)})
                  </div>
                </div>
              `
              )
              .join('')}
          </div>
        </div>
      `;
      return;
    }

    if (this.activeRightTab === 'resize') {
      const ppi = this.getPixelsPerInch(json);
      const widthValue = this.playAreaUnits === 'px' ? json.playArea.width * ppi : json.playArea.width;
      const heightValue = this.playAreaUnits === 'px' ? json.playArea.height * ppi : json.playArea.height;
      const unitLabel = this.playAreaUnits === 'px' ? 'px' : 'in';
      container.innerHTML = `
        <div class="property-group">
          <div class="property-group-title">Resize (Scale)</div>
          <div class="property-row">
            <span class="property-label">Units</span>
            <select class="property-input" id="resize-units">
              <option value="in" ${this.playAreaUnits === 'in' ? 'selected' : ''}>Inches</option>
              <option value="px" ${this.playAreaUnits === 'px' ? 'selected' : ''}>Pixels</option>
            </select>
          </div>
          <div class="property-row">
            <span class="property-label">PPI</span>
            <input class="property-input" id="resize-ppi" type="number" step="0.001" value="${ppi}">
          </div>
          <div class="property-row">
            <span class="property-label">New Width (${unitLabel})</span>
            <input class="property-input" id="resize-w" type="number" step="0.01" value="${widthValue}">
          </div>
          <div class="property-row">
            <span class="property-label">New Height (${unitLabel})</span>
            <input class="property-input" id="resize-h" type="number" step="0.01" value="${heightValue}">
          </div>
          <div class="property-row">
            <span class="property-label">Radius Rule</span>
            <select class="property-input" id="resize-radius-rule">
              <option value="min" selected>min(scaleX, scaleY)</option>
              <option value="avg">avg(scaleX, scaleY)</option>
              <option value="constant">constant</option>
            </select>
          </div>
          <div class="property-row">
            <button class="btn btn-primary" id="btn-apply-resize" style="width:100%;">Apply Resize</button>
          </div>
        </div>

        <div class="property-group">
          <div class="property-group-title">New Table (From Template)</div>
          <div style="font-size: 12px; color: var(--text-muted); padding: 8px 0;">
            Uses the existing src/geometry/table.physics.json as the baseline so cushion segmentation stays intact.
          </div>
          <div class="property-row">
            <span class="property-label">Name</span>
            <input class="property-input" id="blank-name" type="text" placeholder="My Table">
          </div>
          <div class="property-row">
            <span class="property-label">Play Width (in)</span>
            <input class="property-input" id="blank-play-w" type="number" step="0.01" value="100">
          </div>
          <div class="property-row">
            <span class="property-label">PPI</span>
            <input class="property-input" id="blank-ppi" type="number" step="0.001" value="7.5">
          </div>
          <div class="property-row">
            <button class="btn btn-primary" id="btn-create-blank" style="width:100%;">Create Blank Table</button>
          </div>
        </div>
      `;

      container.querySelector('#resize-units')?.addEventListener('change', (e) => {
        const v = (e.currentTarget as HTMLSelectElement).value;
        if (v === 'px' || v === 'in') this.setPlayAreaUnits(v);
      });

      container.querySelector('#resize-ppi')?.addEventListener('change', (e) => {
        const v = parseFloat((e.currentTarget as HTMLInputElement).value);
        void this.setPixelsPerInch(v);
      });

      container.querySelector('#btn-apply-resize')?.addEventListener('click', () => {
        const ppiInput = parseFloat((container.querySelector('#resize-ppi') as HTMLInputElement).value);
        const ppiNow = Number.isFinite(ppiInput) && ppiInput > 0 ? ppiInput : this.getPixelsPerInch(json);

        const wRaw = parseFloat((container.querySelector('#resize-w') as HTMLInputElement).value);
        const hRaw = parseFloat((container.querySelector('#resize-h') as HTMLInputElement).value);
        const w = this.playAreaUnits === 'px' ? wRaw / ppiNow : wRaw;
        const h = this.playAreaUnits === 'px' ? hRaw / ppiNow : hRaw;
        const rule = (container.querySelector('#resize-radius-rule') as HTMLSelectElement).value as RadiusScaleRule;
        if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return;
        this.pushUndoSnapshot();
        let next = scalePhysicsJson({ json, newPlayWidth: w, newPlayHeight: h, radiusRule: rule });
        if (ppiNow !== this.getPixelsPerInch(next)) {
          next.meta = next.meta ?? {};
          next.meta.pixelsPerInch = ppiNow;
        }
        void this.applyPhysicsUpdate(next, true);
      });

      container.querySelector('#btn-create-blank')?.addEventListener('click', () => void this.createBlankTableFromPanel(container));
      return;
    }

    if (this.activeRightTab === 'save') {
      container.innerHTML = `
        <div class="property-group">
          <div class="property-group-title">Status</div>
          <div class="property-row" style="justify-content: space-between;">
            <span class="property-label">Dirty</span>
            <span style="font-size:12px; color: ${this.dirty ? 'var(--warning)' : 'var(--success)'}">${this.dirty ? 'Yes' : 'No'}</span>
          </div>
          <div class="property-row" style="justify-content: space-between;">
            <span class="property-label">Save Server</span>
            <span style="font-size:12px; color: var(--text-muted);">:${this.getSaveServerPort()}</span>
          </div>
        </div>
        <div class="property-group">
          <div class="property-group-title">Repair</div>
          <div style="font-size: 12px; color: var(--text-muted); padding: 8px 0;">
            If editing ever "breaks" (handles stop responding), run a repair to remove invalid points/NaNs.
          </div>
          <div class="property-row">
            <button class="btn" id="btn-repair-geometry" style="width:100%;">Repair Geometry</button>
          </div>
          <div style="font-size: 12px; color: var(--text-muted); padding: 8px 0 0;">
            If geometry looks wrong but is still numeric-valid, run a semantic check.
          </div>
          <div class="property-row">
            <button class="btn" id="btn-check-geometry" style="width:100%;">Check Geometry</button>
          </div>
          <div style="font-size: 12px; color: var(--text-muted); padding: 8px 0 0;">
            If geometry looks wrong but still "valid", reset from the built-in template.
          </div>
          <div class="property-row">
            <button class="btn" id="btn-reset-from-template" style="width:100%;">Reset From Template</button>
          </div>
        </div>
        <div class="property-group">
          <div class="property-group-title">Disk</div>
          <div class="property-row"><button class="btn" id="btn-save-disk-panel" style="width:100%;">Save to Disk</button></div>
          <div class="property-row"><button class="btn btn-primary" id="btn-set-active-panel" style="width:100%;">Set Active (overwrite src/geometry/table.physics.json)</button></div>
        </div>
        <div class="property-group">
          <div class="property-group-title">Reset</div>
          <div style="font-size: 12px; color: var(--text-muted); padding: 8px 0;">
            Clears the editor’s table/skin library (IndexedDB) and editor prefs. Does not change the running game.
          </div>
          <div class="property-row">
            <button class="btn" id="btn-factory-reset" style="width:100%;">Factory Reset Editor</button>
          </div>
          <div style="font-size: 12px; color: var(--text-muted); padding: 8px 0 0;">
            Reloads the active table geometry from <code>src/geometry/table.physics.json</code> (useful if the editor table got broken).
          </div>
          <div class="property-row">
            <button class="btn" id="btn-restore-factory" style="width:100%;">Restore Factory Table (Editor)</button>
          </div>
          <div style="font-size: 12px; color: var(--text-muted); padding: 8px 0 0;">
            Clears the game’s persisted override (<code>railrush.physicsJsonOverride</code>) and rebuilds the table.
          </div>
          <div class="property-row">
            <button class="btn" id="btn-clear-game-override" style="width:100%;">Clear Game Override (Persisted)</button>
          </div>
        </div>
      `;

      container.querySelector('#btn-save-disk-panel')?.addEventListener('click', () => void this.saveToDisk({ setActive: false }));
      container.querySelector('#btn-set-active-panel')?.addEventListener('click', () => void this.saveToDisk({ setActive: true }));
      container.querySelector('#btn-repair-geometry')?.addEventListener('click', () => void this.repairGeometry());
      container.querySelector('#btn-check-geometry')?.addEventListener('click', () => void this.checkGeometrySemantics());
      container.querySelector('#btn-reset-from-template')?.addEventListener('click', () => void this.resetFromTemplate());
      container.querySelector('#btn-factory-reset')?.addEventListener('click', () => void this.factoryResetEditor());
      container.querySelector('#btn-restore-factory')?.addEventListener('click', () => void this.restoreFactoryTableInEditor());
      container.querySelector('#btn-clear-game-override')?.addEventListener('click', () => void this.clearGameOverridePersisted());
    }
  }

  private async repairGeometry(): Promise<void> {
    const json = this.getActivePhysics();
    if (!json) return;
    const { json: repaired, repairs } = sanitizePhysicsJson(json);
    if (repairs === 0) {
      alert('No repairs needed.');
      return;
    }
    this.pushUndoSnapshot();
    await this.applyPhysicsUpdate(repaired, true);
    alert(`Repaired invalid geometry values (${repairs}).`);
  }

  private async checkGeometrySemantics(): Promise<void> {
    const json = this.getActivePhysics();
    if (!json) return;
    const warnings = getSemanticGeometryWarnings(json);
    if (warnings.length === 0) {
      alert('Geometry check: no obvious issues found.');
      return;
    }

    const msg = `Geometry check found potential issues:\n\n- ${warnings.join('\n- ')}\n\nReset from template?`;
    if (confirm(msg)) {
      await this.resetFromTemplate();
    }
  }

  private async factoryResetEditor(): Promise<void> {
    if (!confirm('Factory reset editor? This clears the editor table/skin library and editor prefs.')) return;

    try {
      // Remove all editor prefs in one shot.
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('table-editor-')) keys.push(k);
      }
      keys.forEach((k) => localStorage.removeItem(k));
    } catch {
      // ignore
    }

    await this.tableLibrary.clearAll();
    await this.skinStore.clearAll();

    // Reload defaults (Active Skin) and recreate Default Table.
    await this.skinStore.init();
    await this.tableLibrary.init();
    await this.ensureInitialTable();
    await this.loadActiveSkin();

    this.selection = null;
    this.preview?.setSelection(null);
    this.activeLeftTab = 'tables';
    this.activeRightTab = 'selection';
    document
      .querySelectorAll('.tab[data-tab]')
      .forEach((t) => t.classList.toggle('active', (t as HTMLElement).dataset.tab === this.activeRightTab));
    document
      .querySelectorAll('.tab[data-left-tab]')
      .forEach((t) => t.classList.toggle('active', (t as HTMLElement).dataset.leftTab === this.activeLeftTab));

    this.renderLeftSidebar();
    this.renderRightSidebar();
    this.renderSkinGrid();
    this.updateHeader();
    this.updateJsonEditorText();

    alert('Editor reset complete.');
  }

  private async restoreFactoryTableInEditor(): Promise<void> {
    if (!this.activeTable) return;
    if (!confirm('Restore active editor table from src/geometry/table.physics.json? (Undo is available)')) return;

    // Cache-bust so we actually re-fetch whatever is on disk.
    const path = `/src/geometry/table.physics.json?ts=${Date.now()}`;
    try {
      const raw = await jsonLoader.load(path);
      const { json } = sanitizePhysicsJson(raw);
      this.pushUndoSnapshot();
      await this.applyPhysicsUpdate(json, true);
      alert('Restored editor table from disk.');
    } catch (err) {
      console.error('Restore factory table failed:', err);
      alert(`Failed to load src/geometry/table.physics.json.\n\nError: ${String(err)}`);
    }
  }

  private clearGameOverridePersisted(): void {
    if (!confirm('Clear the game’s persisted override and rebuild the table?')) return;
    if (!this.ws || !this.isConnected) {
      alert('Not connected to game. Start `npm run dev` (relay on :8080).');
      return;
    }

    this.ws.send(
      JSON.stringify({
        type: 'table-editor:push-config',
        config: {
          mode: 'persist',
          physicsJson: null,
          skin: null,
        },
      })
    );
  }

  private getPromptUnitsLabel(): string {
    return this.playAreaUnits === 'px' ? 'pixels (px) where applicable; geometry in inches' : 'inches';
  }

  private buildVisionPromptText(): string {
    if (!this.activeTable) throw new Error('No active table');
    const json = this.activeTable.physicsJson;
    const ppi = this.getPixelsPerInch(json);
    const rects = (json.meta as any)?.pixelRects;

    const fmt = (n: number) => (Number.isFinite(n) ? n.toFixed(6).replace(/\.?0+$/, '') : String(n));
    const pt = (p: { x: number; y: number }) => `(${fmt(p.x)}, ${fmt(p.y)})`;

    const bbox = (points: { x: number; y: number }[]) => {
      let minX = Number.POSITIVE_INFINITY;
      let minY = Number.POSITIVE_INFINITY;
      let maxX = Number.NEGATIVE_INFINITY;
      let maxY = Number.NEGATIVE_INFINITY;
      for (const p of points) {
        if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      }
      if (!Number.isFinite(minX)) return null;
      return { minX, minY, maxX, maxY };
    };

    const pocketLines = json.pockets.map((p) => {
      const box = Array.isArray(p.outline) ? bbox(p.outline) : null;
      const boxText = box ? ` bbox=[${fmt(box.minX)}, ${fmt(box.minY)} .. ${fmt(box.maxX)}, ${fmt(box.maxY)}]` : '';
      return `- ${p.id}: center=${pt(p.center)} radius=${fmt(p.radius)} outlinePts=${p.outline?.length ?? 0}${boxText}`;
    });

    const railLines = json.rails.map((r) => {
      const outlinePts = Array.isArray(r.outline) ? r.outline : [];
      const box = outlinePts.length ? bbox(outlinePts) : null;
      const boxText = box ? ` bbox=[${fmt(box.minX)}, ${fmt(box.minY)} .. ${fmt(box.maxX)}, ${fmt(box.maxY)}]` : '';
      return `- ${r.id}: from=${pt(r.from)} to=${pt(r.to)} normal=${pt(r.normal)} outlinePts=${outlinePts.length}${boxText}`;
    });

    const pxInfo =
      rects?.inner?.width && rects?.inner?.height
        ? `pixelRects: inner=${rects.inner.width}x${rects.inner.height}px outer=${rects?.outer?.width ?? '?'}x${rects?.outer?.height ?? '?'}px full=${rects?.full?.width ?? '?'}x${rects?.full?.height ?? '?'}px`
        : 'pixelRects: (not set)';

    const offsetX = (json.meta as any)?.offset?.x;
    const offsetY = (json.meta as any)?.offset?.y;
    const hasOffset = Number.isFinite(offsetX) && Number.isFinite(offsetY);

    return `You are a vision-capable image generator. I am designing a pool/billiards TABLE SKIN (image), not doing code review.

I will provide:
1) A screenshot/reference image of the current table art, and
2) The table physics geometry JSON below (inches + rails/pockets).

Your task:
- Generate a clean, high-quality table skin image that aligns perfectly to the physics geometry.
- Keep pockets/cushions consistent with the provided rails/pocket outlines.

Coordinate systems / mapping:
- Physics geometry units: inches (origin at play-area center; +X right/East, +Y up/North)
- Pixels are derived via pixelsPerInch (PPI) for skin alignment.
- pixelsPerInch (PPI): ${fmt(ppi)}
- ${pxInfo}
- ${hasOffset ? `The play-area origin (0,0) maps to pixel (${fmt(offsetX)}, ${fmt(offsetY)}) in the FULL image.` : 'meta.offset is not provided; assume the play-area origin maps to the center of the inner rect.'}
- Convert inches -> pixels using:
  - px = originPxX + x_in * PPI
  - py = originPxY - y_in * PPI   (because +Y is up in physics, but down in image pixels)

Deliverables (as text output describing what you generated):
- A single PNG for the FULL table at fullPx size (or the closest available size without distortion).
- Optional: separate transparent PNG layers: felt / rails / frame / pockets (same pixel dimensions).
- Optional but helpful: an SVG overlay (in pixel coordinates) that draws:
  - play-area rectangle
  - pocket circles/outlines
  - rail outlines

Table summary:
- name: ${this.activeTable.name}
- playArea: width=${fmt(json.playArea.width)}in height=${fmt(json.playArea.height)}in
- editor display units: ${this.getPromptUnitsLabel()}

Pockets (${json.pockets.length}):
${pocketLines.join('\n')}

Rails (${json.rails.length}):
${railLines.join('\n')}

Full physics JSON:
\`\`\`json
${JSON.stringify(json, null, 2)}
\`\`\`
`;
  }

  private async createPromptForVisionLlm(): Promise<void> {
    if (!this.activeTable) return;
    const text = this.buildVisionPromptText();

    const tryClipboard = async (): Promise<boolean> => {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        return false;
      }
    };

    const copied = await tryClipboard();
    if (copied) {
      alert('Prompt copied to clipboard.');
      return;
    }

    // Fallback: download a text file.
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.activeTable.name.replace(/[^\w\-]+/g, '_')}.vision-prompt.txt`;
    a.click();
    URL.revokeObjectURL(url);
    alert('Could not access clipboard; downloaded prompt as a .txt file.');
  }

  private async resetFromTemplate(): Promise<void> {
    const current = this.getActivePhysics();
    if (!current) return;
    if (!confirm('Reset rails/pockets from template? This will overwrite the current geometry (undo is available).')) return;

    const ppi = this.getPixelsPerInch(current);
    const pixelRects = (current.meta as any)?.pixelRects;

    const template = structuredClone(await this.getTemplatePhysicsJson());
    let next = scalePhysicsJson({
      json: template,
      newPlayWidth: current.playArea.width,
      newPlayHeight: current.playArea.height,
      radiusRule: 'avg',
    });

    next.meta = next.meta ?? {};
    next.meta.pixelsPerInch = ppi;
    if (pixelRects) (next.meta as any).pixelRects = pixelRects;
    next.meta.source = 'table-editor:reset-from-template';
    next.meta.lastModified = Date.now();

    this.pushUndoSnapshot();
    await this.applyPhysicsUpdate(next, true);
  }

  private async resetSymmetry(): Promise<void> {
    const json = this.getActivePhysics();
    if (!json) return;
    this.mirrorEnabled = true;
    document.getElementById('btn-toggle-mirror')?.classList.toggle('active', true);
    this.pushUndoSnapshot();
    const before = JSON.stringify({ pockets: json.pockets, rails: json.rails });
    const next = resymmetrizePhysicsJson(json);
    const after = JSON.stringify({ pockets: next.pockets, rails: next.rails });
    await this.applyPhysicsUpdate(next, true);
    if (before === after) {
      alert('Resym: no changes (already symmetric or missing counterparts).');
    } else {
      alert('Resym applied.');
    }
  }

  private async createBlankTableFromPanel(container: HTMLElement): Promise<void> {
    const name = (container.querySelector('#blank-name') as HTMLInputElement).value.trim() || 'New Blank Table';
    const playWidth = parseFloat((container.querySelector('#blank-play-w') as HTMLInputElement).value);
    const ppi = parseFloat((container.querySelector('#blank-ppi') as HTMLInputElement).value);
    if (!Number.isFinite(playWidth) || playWidth <= 0) return;
    if (!Number.isFinite(ppi) || ppi <= 0) return;

    // Recommended flow: scale an existing “known good” table physics.json template so we keep the full
    // rail segmentation (6 cushion rails + 4 play_area rails).
    const innerPx = { width: 750, height: 376 };
    const outerPx = { width: 780, height: 406 };
    const fullPx = { width: 836, height: 464 };
    const playHeight = innerPx.height / ppi;

    const template = structuredClone(await this.getTemplatePhysicsJson());
    let physicsJson = scalePhysicsJson({
      json: template,
      newPlayWidth: playWidth,
      newPlayHeight: playHeight,
      radiusRule: 'avg',
    });

    physicsJson.meta = physicsJson.meta ?? {};
    physicsJson.meta.pixelsPerInch = ppi;
    physicsJson.meta.source = 'table-editor:blank-from-template';
    (physicsJson.meta as any).pixelRects = { inner: innerPx, outer: outerPx, full: fullPx };
    physicsJson.meta.lastModified = Date.now();

    const created = await this.tableLibrary.create({
      name,
      linkedSkinId: this.activeSkinId,
      physicsJson,
    });

    await this.selectTable(created.id);
    this.activeLeftTab = 'tables';
    this.renderLeftSidebar();
  }

  private async createTableFlow(): Promise<void> {
    if (!this.activeTable) return;
    const name = prompt('New table name:', `${this.activeTable.name} (Copy)`)?.trim();
    if (!name) return;
    const created = await this.tableLibrary.create({
      name,
      linkedSkinId: this.activeSkinId,
      physicsJson: structuredClone(this.activeTable.physicsJson),
    });
    await this.selectTable(created.id);
  }

  private async duplicateActiveTable(): Promise<void> {
    if (!this.activeTableId) return;
    const dup = await this.tableLibrary.duplicate(this.activeTableId);
    if (!dup) return;
    await this.selectTable(dup.id);
  }

  private async deleteActiveTable(): Promise<void> {
    if (!this.activeTableId) return;
    if (!confirm('Delete active table?')) return;
    await this.tableLibrary.delete(this.activeTableId);
    const remaining = this.tableLibrary.getAll();
    if (remaining.length > 0) await this.selectTable(remaining[0].id);
  }

  private async undo(): Promise<void> {
    if (!this.activeTable) return;
    const prev = this.undoStack.pop();
    if (!prev) return;
    this.redoStack.push(structuredClone(this.activeTable.physicsJson));
    await this.applyPhysicsUpdate(prev, true);
  }

  private async redo(): Promise<void> {
    if (!this.activeTable) return;
    const next = this.redoStack.pop();
    if (!next) return;
    this.undoStack.push(structuredClone(this.activeTable.physicsJson));
    await this.applyPhysicsUpdate(next, true);
  }

  private updateJsonEditorText(): void {
    const json = this.getActivePhysics();
    this.ensureJsonEditorUi();
    if (!this.jsonTextarea) return;

    const nextText = json ? JSON.stringify(json, null, 2) : '';
    this.jsonLastSynced = nextText;

    if (!this.jsonDirty) {
      this.jsonTextarea.value = nextText;
    }

    this.updateJsonStatus();
  }

  private updateJsonStatus(): void {
    const el = document.getElementById('json-status');
    if (!el) return;
    if (!this.jsonTextarea) {
      el.textContent = '';
      return;
    }
    const bytes = new Blob([this.jsonTextarea.value]).size;
    el.textContent = `${this.jsonDirty ? 'Modified' : 'Synced'} • ${bytes} bytes`;
  }

  private formatJsonEditor(): void {
    if (!this.jsonTextarea) return;
    try {
      const parsed = JSON.parse(this.jsonTextarea.value);
      this.jsonTextarea.value = JSON.stringify(parsed, null, 2);
      this.jsonDirty = true;
      this.updateJsonStatus();
    } catch (err) {
      alert(`JSON parse error: ${String(err)}`);
    }
  }

  private revertJsonEditor(): void {
    if (!this.jsonTextarea) return;
    this.jsonTextarea.value = this.jsonLastSynced;
    this.jsonDirty = false;
    this.updateJsonStatus();
  }

  private async applyJsonEditor(): Promise<void> {
    if (!this.jsonTextarea) return;
    try {
      const parsed = JSON.parse(this.jsonTextarea.value);
      const isPhysicsJson = parsed && parsed.playArea && parsed.pockets && parsed.rails;
      if (!isPhysicsJson) {
        alert('JSON must be a PhysicsJson with playArea/pockets/rails.');
        return;
      }
      const { json: sanitized, repairs } = sanitizePhysicsJson(parsed);
      if (repairs > 0) {
        alert(`Repaired invalid geometry values (${repairs}).`);
      }
      this.pushUndoSnapshot();
      await this.applyPhysicsUpdate(sanitized as PhysicsJson, true);
      this.jsonDirty = false;
      this.jsonLastSynced = JSON.stringify(sanitized, null, 2);
      this.jsonTextarea.value = this.jsonLastSynced;
      this.updateJsonStatus();
    } catch (err) {
      alert(`JSON parse error: ${String(err)}`);
    }
  }

  private async loadActiveSkin(): Promise<void> {
    const storedId = this.skinStore.getActiveSkinId();
    const skins = this.skinStore.getAll();
    if (skins.length === 0) return;
    const chosen = storedId && this.skinStore.get(storedId) ? this.skinStore.get(storedId)! : skins[0];
    this.activeSkinId = chosen.id;
    this.skinStore.setActiveSkinId(chosen.id);
    if (chosen.images.full) await this.preview?.loadSkinFromBase64(chosen.images.full);
  }

  private async createNewSkin(): Promise<void> {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const skin = await this.skinStore.createFromFile(file);
      this.activeSkinId = skin.id;
      this.skinStore.setActiveSkinId(skin.id);
      this.renderSkinGrid();
      if (skin.images.full) await this.preview?.loadSkinFromBase64(skin.images.full);
    };
    input.click();
  }

  private renderSkinGrid(): void {
    const grid = document.getElementById('skin-grid');
    if (!grid) return;
    const skins = this.skinStore.getAll();
    grid.innerHTML =
      skins
        .map(
          (skin) => `
          <div class="skin-card ${skin.id === this.activeSkinId ? 'active' : ''}" data-skin-id="${skin.id}">
            <div class="skin-card-preview" style="${
              skin.thumbnail ? `background-image: url(${skin.thumbnail}); background-size: cover; background-position: center;` : ''
            }"></div>
            <div class="skin-card-name">${skin.name}</div>
          </div>
        `
        )
        .join('') +
      `
        <div class="skin-card skin-card-add" id="skin-card-add">
          <span style="font-size: 24px;">+</span>
        </div>
      `;

    grid.querySelectorAll('.skin-card[data-skin-id]').forEach((card) => {
      card.addEventListener('click', () => {
        const id = (card as HTMLElement).dataset.skinId;
        if (id) void this.selectSkin(id);
      });
    });

    grid.querySelector('#skin-card-add')?.addEventListener('click', () => void this.createNewSkin());
  }

  private async selectSkin(id: string): Promise<void> {
    const skin = this.skinStore.get(id);
    if (!skin) return;
    this.activeSkinId = id;
    this.skinStore.setActiveSkinId(id);
    this.renderSkinGrid();
    if (skin.images.full) await this.preview?.loadSkinFromBase64(skin.images.full);
  }

  private setupDragDrop(): void {
    const dropZone = document.getElementById('drop-zone');
    const previewContainer = document.querySelector('.preview-container');
    if (!previewContainer || !dropZone) return;

    previewContainer.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('active');
    });

    previewContainer.addEventListener('dragleave', (e) => {
      e.preventDefault();
      dropZone.classList.remove('active');
    });

    previewContainer.addEventListener('drop', async (e) => {
      e.preventDefault();
      dropZone.classList.remove('active');
      const files = (e as DragEvent).dataTransfer?.files;
      if (!files || files.length === 0) return;
      for (const file of Array.from(files)) {
        if (file.type.startsWith('image/')) {
          const skin = await this.skinStore.createFromFile(file);
          this.activeSkinId = skin.id;
          this.skinStore.setActiveSkinId(skin.id);
          this.renderSkinGrid();
          if (skin.images.full) await this.preview?.loadSkinFromBase64(skin.images.full);
          continue;
        }
        if (file.name.endsWith('.json') || file.name.endsWith('.railrush-table') || file.name.endsWith('.physics.json')) {
          const text = await file.text();
          const parsed = JSON.parse(text);
          await this.importParsed(parsed, file.name);
        }
      }
    });
  }

  private importFile(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.railrush-table,.physics.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const text = await file.text();
      const parsed = JSON.parse(text);
      await this.importParsed(parsed, file.name);
    };
    input.click();
  }

  private async importParsed(parsed: any, filename: string): Promise<void> {
    const isPhysicsJson = parsed && parsed.playArea && parsed.pockets && parsed.rails;
    if (isPhysicsJson) {
      const created = await this.tableLibrary.create({
        name: filename.replace(/\.[^/.]+$/, ''),
        linkedSkinId: this.activeSkinId,
        physicsJson: parsed as PhysicsJson,
      });
      await this.selectTable(created.id);
      return;
    }

    if (parsed?.type === 'railrush-table' && parsed?.table?.physicsJson) {
      const created = await this.tableLibrary.create({
        name: parsed.table.name || filename.replace(/\.[^/.]+$/, ''),
        linkedSkinId: parsed.table.linkedSkinId ?? this.activeSkinId,
        physicsJson: parsed.table.physicsJson as PhysicsJson,
      });
      await this.selectTable(created.id);
      return;
    }

    alert('Unsupported file format.');
  }

  private exportCurrent(): void {
    if (!this.activeTable) return;
    const bundle = {
      version: '1.0',
      type: 'railrush-table',
      table: {
        id: this.activeTable.id,
        name: this.activeTable.name,
        linkedSkinId: this.activeSkinId,
        physicsJson: this.activeTable.physicsJson,
      },
    };

    const json = JSON.stringify(bundle, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.activeTable.name.replace(/[^\w\-]+/g, '_')}.railrush-table`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private connectToGame(): void {
    const wsUrl = `ws://${window.location.hostname}:8080`;
    try {
      this.ws = new WebSocket(wsUrl);
      this.ws.onopen = () => {
        this.isConnected = true;
        this.updateConnectionStatus(true);
      };
      this.ws.onclose = () => {
        this.isConnected = false;
        this.updateConnectionStatus(false);
        setTimeout(() => this.connectToGame(), 5000);
      };
    } catch {
      // ignore
    }
  }

  private updateConnectionStatus(connected: boolean): void {
    const dot = document.getElementById('status-dot');
    const text = document.getElementById('status-text');
    if (dot) dot.classList.toggle('connected', connected);
    if (text) text.textContent = connected ? 'Connected' : 'Disconnected';
  }

  private pushToGame(mode: 'live' | 'persist'): void {
    if (!this.ws || !this.isConnected) {
      alert('Not connected to game. Start `npm run dev` (relay on :8080).');
      return;
    }
    if (!this.activeTable) return;
    const skin = this.activeSkinId ? this.skinStore.get(this.activeSkinId) : null;

    this.ws.send(
      JSON.stringify({
        type: 'table-editor:push-config',
        config: {
          mode,
          physicsJson: this.activeTable.physicsJson,
          skin: skin?.images?.full ? { name: skin.name, image: skin.images.full } : null,
        },
      })
    );
  }

  private getSaveServerPort(): number {
    const stored = localStorage.getItem('table-editor-save-port');
    const port = stored ? parseInt(stored, 10) : NaN;
    return Number.isFinite(port) ? port : 8090;
  }

  private async saveToDisk(options: { setActive: boolean }): Promise<void> {
    if (!this.activeTable) return;
    const port = this.getSaveServerPort();
    const url = `http://${window.location.hostname}:${port}/api/table-editor/save`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: this.activeTable.name,
          tableId: this.activeTable.id,
          physicsJson: this.activeTable.physicsJson,
          setActive: options.setActive,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }

      this.setDirty(false);
      alert(options.setActive ? 'Saved and set active.' : 'Saved to disk.');
    } catch (err) {
      console.error('Save to disk failed:', err);
      alert(`Save server not reachable.\nStart dev server and save server.\n\nError: ${String(err)}`);
    }
  }
}

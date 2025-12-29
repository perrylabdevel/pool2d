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
  DEFAULT_EDITOR_ASSIST_SETTINGS,
  sanitizeEditorAssistSettings,
  type EditorAssistSettings,
} from './utils/EditorAssistSettings';
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
  type ValidationIssue,
} from './utils/TableGeometryUtils';
import {
  WebSocketBridge,
  saveTableToDisk,
  getSaveServerPort,
  parseImportedFile,
  pickAndReadFile,
  exportTableAsFile,
} from './io';

export class TableEditorApp {
  private preview: TablePreview | null = null;
  private skinStore = new SkinStore();
  private tableLibrary = new TableLibraryStore();

  private activeRightTab: 'selection' | 'pockets' | 'rails' | 'resize' | 'save' = 'selection';
  private activeLeftTab: 'tables' | 'skins' = 'tables';

  private wsBridge: WebSocketBridge;
  private pocketCaptureCornerIn: number = this.loadPocketCaptureRadius('corner', 2.8);
  private pocketCaptureSideIn: number = this.loadPocketCaptureRadius('side', 3.3);

  private editMode: boolean = false;
  private mirrorEnabled: boolean = true;
  private selection: GeometrySelection | null = null;
  private assistSettings: EditorAssistSettings = this.loadAssistSettings();

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

  constructor() {
    this.wsBridge = new WebSocketBridge({
      onPocketCaptureRadius: (kind, value) => {
        this.setPocketCaptureRadius(kind, value);
        if (this.activeRightTab === 'pockets') this.renderRightSidebar();
      },
    });
  }

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
      this.preview.setAssistSettings(this.assistSettings);
    }

    this.setupEventListeners();
    this.setupDragDrop();

    await this.ensureInitialTable();
    // Note: loadActiveSkin() is not called here because ensureInitialTable() 
    // already loads the table's linked skin via openTable()

    this.renderLeftSidebar();
    this.renderRightSidebar();
    this.renderSkinGrid();

    this.wsBridge.connect();
    this.updateHeader();
    this.updateJsonEditorText();

    this.syncToolbarTogglesFromSettings();
  }

  private loadAssistSettings(): EditorAssistSettings {
    try {
      const raw = localStorage.getItem('table-editor-assist');
      if (!raw) return structuredClone(DEFAULT_EDITOR_ASSIST_SETTINGS);
      return sanitizeEditorAssistSettings(JSON.parse(raw));
    } catch {
      return structuredClone(DEFAULT_EDITOR_ASSIST_SETTINGS);
    }
  }

  private persistAssistSettings(): void {
    try {
      localStorage.setItem('table-editor-assist', JSON.stringify(this.assistSettings));
    } catch {
      // ignore
    }
  }

  private setAssistSettings(patch: Partial<EditorAssistSettings>): void {
    this.assistSettings = sanitizeEditorAssistSettings({ ...this.assistSettings, ...patch });
    this.persistAssistSettings();
    this.preview?.setAssistSettings(this.assistSettings);
    if (this.activeRightTab === 'selection') this.renderRightSidebar();
  }

  private syncToolbarTogglesFromSettings(): void {
    document.getElementById('btn-toggle-snap')?.classList.toggle('active', this.assistSettings.snapEnabled);
    document.getElementById('btn-toggle-grid')?.classList.toggle('active', this.assistSettings.gridEnabled);

    const ballsBtn = document.getElementById('btn-toggle-balls');
    if (ballsBtn) this.preview?.toggleBalls(ballsBtn.classList.contains('active'));

    const measureBtn = document.getElementById('btn-toggle-measure');
    if (measureBtn) this.preview?.toggleMeasurements(measureBtn.classList.contains('active'));
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

  private loadPocketCaptureRadius(kind: 'corner' | 'side', fallback: number): number {
    try {
      const raw = localStorage.getItem(`table-editor-pocket-capture-${kind}`);
      const v = raw ? parseFloat(raw) : NaN;
      if (Number.isFinite(v) && v > 0) return v;
    } catch {
      // ignore
    }
    return fallback;
  }

  private setPocketCaptureRadius(kind: 'corner' | 'side', value: number): void {
    if (!Number.isFinite(value) || value <= 0) return;
    if (kind === 'corner') this.pocketCaptureCornerIn = value;
    else this.pocketCaptureSideIn = value;
    try {
      localStorage.setItem(`table-editor-pocket-capture-${kind}`, String(value));
    } catch {
      // ignore
    }
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

    // Restore linked skin for this table if available; otherwise keep current selection
    // IMPORTANT: Set physics JSON FIRST so skin dimensions use correct PPI
    this.preview?.setPhysicsJson(table.physicsJson);

    console.log('[TableEditor] Opening table, linkedSkinId:', table.linkedSkinId, 'current activeSkinId:', this.activeSkinId);
    if (table.linkedSkinId) {
      const linked = this.skinStore.get(table.linkedSkinId);
      if (linked) {
        console.log('[TableEditor] Found linked skin:', linked.id, linked.name);
        this.activeSkinId = linked.id;
        this.skinStore.setActiveSkinId(linked.id);
        if (linked.images.full) {
          await this.preview?.loadSkinFromBase64(linked.images.full);
        }
      } else {
        console.warn('[TableEditor] Linked skin not found in store:', table.linkedSkinId);
      }
    } else {
      console.log('[TableEditor] No linkedSkinId, keeping current active skin');
    }

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

    this.renderTableList();
    this.renderSkinGrid();
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

    document.getElementById('btn-toggle-collision')?.addEventListener('click', (e) => {
      const btn = e.currentTarget as HTMLElement;
      btn.classList.toggle('active');
      this.preview?.toggleCollisionOverlay(btn.classList.contains('active'));
    });

    document.getElementById('btn-toggle-snap')?.addEventListener('click', (e) => {
      const btn = e.currentTarget as HTMLElement;
      const next = !btn.classList.contains('active');
      btn.classList.toggle('active', next);
      this.setAssistSettings({ snapEnabled: next });
    });

    document.getElementById('btn-toggle-grid')?.addEventListener('click', (e) => {
      const btn = e.currentTarget as HTMLElement;
      const next = !btn.classList.contains('active');
      btn.classList.toggle('active', next);
      this.setAssistSettings({ gridEnabled: next });
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
          <div class="property-group-title">Assist</div>
          <div class="property-row" style="justify-content: space-between;">
            <span class="property-label">Snap</span>
            <input id="assist-snap" type="checkbox" ${this.assistSettings.snapEnabled ? 'checked' : ''} />
          </div>
          <div class="property-row">
            <span class="property-label">Tolerance (px)</span>
            <input class="property-input" id="assist-snap-tol" type="number" min="1" max="64" step="1" value="${this.assistSettings.snapTolerancePx}">
          </div>
          <div class="property-row" style="justify-content: space-between;">
            <span class="property-label">Grid</span>
            <input id="assist-grid" type="checkbox" ${this.assistSettings.gridEnabled ? 'checked' : ''} />
          </div>
          <div class="property-row">
            <span class="property-label">Grid Spacing (in)</span>
            <input class="property-input" id="assist-grid-spacing" type="number" min="0.01" step="0.01" value="${this.assistSettings.gridSpacingIn}">
          </div>
          <div class="property-row">
            <span class="property-label">Major Every</span>
            <input class="property-input" id="assist-grid-major" type="number" min="1" step="1" value="${this.assistSettings.gridMajorEvery}">
          </div>
          <div style="padding: 6px 0 0; font-size: 12px; color: var(--text-muted);">
            Tip: hold <code>Alt</code> to bypass snapping; hold <code>Shift</code> for axis-lock while dragging.
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
        ${this.renderValidationSection(json)}
      `;

      container.querySelector('#play-units')?.addEventListener('change', (e) => {
        const v = (e.currentTarget as HTMLSelectElement).value;
        if (v === 'px' || v === 'in') this.setPlayAreaUnits(v);
      });

      container.querySelector('#assist-snap')?.addEventListener('change', (e) => {
        const enabled = (e.currentTarget as HTMLInputElement).checked;
        document.getElementById('btn-toggle-snap')?.classList.toggle('active', enabled);
        this.setAssistSettings({ snapEnabled: enabled });
      });

      container.querySelector('#assist-snap-tol')?.addEventListener('change', (e) => {
        const v = parseFloat((e.currentTarget as HTMLInputElement).value);
        if (!Number.isFinite(v)) return;
        this.setAssistSettings({ snapTolerancePx: v });
      });

      container.querySelector('#assist-grid')?.addEventListener('change', (e) => {
        const enabled = (e.currentTarget as HTMLInputElement).checked;
        document.getElementById('btn-toggle-grid')?.classList.toggle('active', enabled);
        this.setAssistSettings({ gridEnabled: enabled });
      });

      container.querySelector('#assist-grid-spacing')?.addEventListener('change', (e) => {
        const v = parseFloat((e.currentTarget as HTMLInputElement).value);
        if (!Number.isFinite(v)) return;
        this.setAssistSettings({ gridSpacingIn: v });
      });

      container.querySelector('#assist-grid-major')?.addEventListener('change', (e) => {
        const v = parseFloat((e.currentTarget as HTMLInputElement).value);
        if (!Number.isFinite(v)) return;
        this.setAssistSettings({ gridMajorEvery: v });
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
          <div class="property-group-title">Capture Radius</div>
          <div style="padding: 8px 0; font-size: 12px; color: var(--text-muted);">
            Live physics setting (ball capture disk). Syncs with <code>devtools/index.html</code>.
          </div>
          <div class="property-row" style="gap: 10px;">
            <span class="property-label">Corner (in)</span>
            <input class="property-slider" id="pocket-capture-corner" type="range" min="1.5" max="4.0" step="0.05" value="${this.pocketCaptureCornerIn.toFixed(2)}" />
            <input class="property-input" id="pocket-capture-corner-num" type="number" min="0.5" step="0.01" value="${this.pocketCaptureCornerIn.toFixed(2)}" />
          </div>
          <div class="property-row" style="gap: 10px;">
            <span class="property-label">Side (in)</span>
            <input class="property-slider" id="pocket-capture-side" type="range" min="1.5" max="4.0" step="0.05" value="${this.pocketCaptureSideIn.toFixed(2)}" />
            <input class="property-input" id="pocket-capture-side-num" type="number" min="0.5" step="0.01" value="${this.pocketCaptureSideIn.toFixed(2)}" />
          </div>
        </div>

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

      const cornerRange = container.querySelector('#pocket-capture-corner') as HTMLInputElement | null;
      const cornerNum = container.querySelector('#pocket-capture-corner-num') as HTMLInputElement | null;
      const sideRange = container.querySelector('#pocket-capture-side') as HTMLInputElement | null;
      const sideNum = container.querySelector('#pocket-capture-side-num') as HTMLInputElement | null;

      const clamp = (v: number) => Math.min(4.0, Math.max(1.5, v));

      const previewCorner = (raw: string) => {
        const v = clamp(parseFloat(raw));
        if (!Number.isFinite(v)) return;
        this.setPocketCaptureRadius('corner', v);
        if (cornerRange) cornerRange.value = v.toFixed(2);
        if (cornerNum) cornerNum.value = v.toFixed(2);
      };

      const previewSide = (raw: string) => {
        const v = clamp(parseFloat(raw));
        if (!Number.isFinite(v)) return;
        this.setPocketCaptureRadius('side', v);
        if (sideRange) sideRange.value = v.toFixed(2);
        if (sideNum) sideNum.value = v.toFixed(2);
      };

      const commitCorner = () => this.sendGeometryPatch({ CORNER_POCKET_CAPTURE_RADIUS_IN: this.pocketCaptureCornerIn });
      const commitSide = () => this.sendGeometryPatch({ SIDE_POCKET_CAPTURE_RADIUS_IN: this.pocketCaptureSideIn });

      cornerRange?.addEventListener('input', (e) => previewCorner((e.currentTarget as HTMLInputElement).value));
      cornerRange?.addEventListener('change', commitCorner);
      cornerNum?.addEventListener('change', (e) => {
        previewCorner((e.currentTarget as HTMLInputElement).value);
        commitCorner();
      });

      sideRange?.addEventListener('input', (e) => previewSide((e.currentTarget as HTMLInputElement).value));
      sideRange?.addEventListener('change', commitSide);
      sideNum?.addEventListener('change', (e) => {
        previewSide((e.currentTarget as HTMLInputElement).value);
        commitSide();
      });
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
            <span style="font-size:12px; color: var(--text-muted);">:${getSaveServerPort()}</span>
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

  /**
   * Render the validation section showing any issues with the current geometry.
   * Uses sanitizePhysicsJson to get detailed validation results.
   */
  private renderValidationSection(json: PhysicsJson): string {
    const { issues } = sanitizePhysicsJson(json);
    const semanticWarnings = getSemanticGeometryWarnings(json);

    // Convert semantic warnings to validation issues
    const allIssues: ValidationIssue[] = [
      ...issues,
      ...semanticWarnings.map((msg) => ({
        severity: 'warning' as const,
        message: msg,
      })),
    ];

    if (allIssues.length === 0) {
      return `
        <div class="property-group">
          <div class="property-group-title">Validation</div>
          <div style="padding: 8px; background: rgba(166, 227, 161, 0.1); border-radius: 6px; color: var(--success); font-size: 12px;">
            No issues found
          </div>
        </div>
      `;
    }

    const errorCount = allIssues.filter((i) => i.severity === 'error').length;
    const warningCount = allIssues.filter((i) => i.severity === 'warning').length;
    const infoCount = allIssues.filter((i) => i.severity === 'info').length;

    const severityColor = (s: string) => {
      switch (s) {
        case 'error': return 'var(--error)';
        case 'warning': return 'var(--warning)';
        default: return 'var(--text-muted)';
      }
    };

    const severityIcon = (s: string) => {
      switch (s) {
        case 'error': return '✗';
        case 'warning': return '⚠';
        default: return 'ℹ';
      }
    };

    return `
      <div class="property-group">
        <div class="property-group-title">Validation</div>
        <div style="display: flex; gap: 12px; margin-bottom: 8px; font-size: 11px;">
          ${errorCount > 0 ? `<span style="color: var(--error);">${errorCount} errors</span>` : ''}
          ${warningCount > 0 ? `<span style="color: var(--warning);">${warningCount} warnings</span>` : ''}
          ${infoCount > 0 ? `<span style="color: var(--text-muted);">${infoCount} info</span>` : ''}
        </div>
        <div style="max-height: 200px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px;">
          ${allIssues
        .slice(0, 20) // Limit to 20 issues
        .map(
          (issue) => `
              <div style="
                padding: 6px 8px;
                background: rgba(255,255,255,0.03);
                border-left: 3px solid ${severityColor(issue.severity)};
                border-radius: 0 4px 4px 0;
                font-size: 11px;
              ">
                <span style="color: ${severityColor(issue.severity)}; margin-right: 4px;">${severityIcon(issue.severity)}</span>
                ${issue.message}
                ${issue.field ? `<span style="color: var(--text-muted); display: block; margin-top: 2px; font-family: monospace; font-size: 10px;">${issue.field}</span>` : ''}
                ${issue.repaired ? '<span style="color: var(--success); font-size: 10px;"> (auto-repaired)</span>' : ''}
              </div>
            `
        )
        .join('')}
          ${allIssues.length > 20 ? `<div style="padding: 6px; color: var(--text-muted); font-size: 11px;">...and ${allIssues.length - 20} more</div>` : ''}
        </div>
      </div>
    `;
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
    if (!confirm("Clear the game's persisted override and rebuild the table?")) return;
    this.wsBridge.pushToGame('persist', { physicsJson: null, skin: null });
  }

  private getPromptUnitsLabel(): string {
    return this.playAreaUnits === 'px' ? 'pixels (px) where applicable; geometry in inches' : 'inches';
  }

  private buildVisionPromptText(): string {
    if (!this.activeTable) throw new Error('No active table');
    const json = this.activeTable.physicsJson;
    const ppi = this.getPixelsPerInch(json);
    const rects = (json.meta as any)?.pixelRects;

    const fmt = (n: number) => (Number.isFinite(n) ? n.toFixed(2) : String(n));

    // Calculate image dimensions - prioritize loaded skin, then physics JSON metadata, then calculate
    let fullW: number | undefined;
    let fullH: number | undefined;

    // 1. Try to get dimensions from loaded skin image in preview
    const skinDims = this.preview?.getSkinPixelDimensions();
    if (skinDims) {
      fullW = skinDims.width;
      fullH = skinDims.height;
    }

    // 2. Fall back to physics JSON pixelRects
    if (!fullW || !fullH) {
      fullW = rects?.full?.width as number | undefined;
      fullH = rects?.full?.height as number | undefined;
    }

    // 3. Calculate from play area + margin if still not available
    if (!fullW || !fullH) {
      const marginIn = Math.max(json.playArea.width, json.playArea.height) * 0.15;
      fullW = Math.ceil((json.playArea.width + marginIn * 2) * ppi);
      fullH = Math.ceil((json.playArea.height + marginIn * 2) * ppi);
      if (fullW % 2 !== 0) fullW++;
      if (fullH % 2 !== 0) fullH++;
    }
    const cx = fullW / 2;
    const cy = fullH / 2;

    // Helper to convert physics coords to pixel coords for examples
    const toPixel = (x: number, y: number) => ({
      px: Math.round(cx + x * ppi),
      py: Math.round(cy - y * ppi)
    });

    // Calculate key reference points
    const playHalfW = json.playArea.width / 2;
    const playHalfH = json.playArea.height / 2;
    const topLeftPlay = toPixel(-playHalfW, playHalfH);
    const bottomRightPlay = toPixel(playHalfW, -playHalfH);

    // Get corner pocket for example
    const cornerPocket = json.pockets.find(p => p.id.includes('pocket_2_2') || Math.abs(p.center.x) > 40);
    const cornerPocketPx = cornerPocket ? toPixel(cornerPocket.center.x, cornerPocket.center.y) : null;

    // Format pocket data
    const pocketList = json.pockets.map(p => {
      const px = toPixel(p.center.x, p.center.y);
      return `• ${p.id}: physics=(${fmt(p.center.x)}, ${fmt(p.center.y)}) → pixel=(${px.px}, ${px.py}), radius=${fmt(p.radius)}in = ${fmt(p.radius * ppi)}px`;
    }).join('\n');

    // Format rail data (just the main cushions, not derived)
    const mainRails = json.rails.filter(r => r.id.startsWith('cushion_'));
    const railList = mainRails.map(r => {
      const fromPx = toPixel(r.from.x, r.from.y);
      const toPx = toPixel(r.to.x, r.to.y);
      return `• ${r.id}: from pixel (${fromPx.px}, ${fromPx.py}) to (${toPx.px}, ${toPx.py})`;
    }).join('\n');

    // Randomized style presets
    const frameMaterials = [
      { name: 'Dark Walnut Wood', desc: 'Rich dark brown walnut with visible grain, matte finish' },
      { name: 'Honey Oak Wood', desc: 'Light golden oak with prominent grain patterns, satin finish' },
      { name: 'Mahogany Wood', desc: 'Deep reddish-brown mahogany with elegant grain, glossy lacquer' },
      { name: 'Brushed Steel', desc: 'Industrial brushed stainless steel with subtle directional texture' },
      { name: 'Chrome Metal', desc: 'Highly reflective chrome with mirror-like finish and soft highlights' },
      { name: 'Matte Black Metal', desc: 'Sleek matte black powder-coated steel, modern look' },
      { name: 'Bronze Metal', desc: 'Warm antique bronze with subtle patina and aged highlights' },
      { name: 'Carbon Fiber', desc: 'Black carbon fiber weave pattern with glossy clear coat' },
      { name: 'Ebony Wood', desc: 'Nearly black ebony wood with subtle grain, high polish' },
      { name: 'Copper Metal', desc: 'Warm copper with oxidized patina accents, industrial aesthetic' },
    ];

    const feltColors = [
      { name: 'Championship Green', hex: '#0A6B3D', desc: 'Classic tournament green' },
      { name: 'Electric Blue', hex: '#1E40AF', desc: 'Vibrant royal blue' },
      { name: 'Wine Red', hex: '#7F1D1D', desc: 'Deep burgundy red' },
      { name: 'Midnight Purple', hex: '#4C1D95', desc: 'Rich purple' },
      { name: 'Slate Gray', hex: '#374151', desc: 'Modern charcoal gray' },
      { name: 'Ocean Teal', hex: '#0D9488', desc: 'Tropical teal' },
      { name: 'Burnt Orange', hex: '#C2410C', desc: 'Bold burnt orange' },
      { name: 'Forest Green', hex: '#065F46', desc: 'Deep forest green' },
      { name: 'Navy Blue', hex: '#1E3A5F', desc: 'Classic navy' },
      { name: 'Black', hex: '#18181B', desc: 'Elegant black' },
    ];

    const cushionStyles = [
      { name: 'Traditional Leather', desc: 'Brown leather-wrapped rail tops with visible stitching' },
      { name: 'Matching Felt', desc: 'Rail tops covered in same cloth as playing surface' },
      { name: 'Black Vinyl', desc: 'Sleek black synthetic leather rail covers' },
      { name: 'Natural Rubber', desc: 'Exposed rubber cushion noses in black' },
    ];

    // Format options for the AI to choose from
    const frameOptions = frameMaterials.map((f, i) => `${i + 1}. **${f.name}**: ${f.desc}`).join('\n');
    const feltOptions = feltColors.map((f, i) => `${i + 1}. **${f.name}** (${f.hex}): ${f.desc}`).join('\n');
    const cushionOptions = cushionStyles.map((c, i) => `${i + 1}. **${c.name}**: ${c.desc}`).join('\n');

    const styleSection = `
## STYLE SELECTION (RANDOMLY CHOOSE ONE FROM EACH CATEGORY)

**IMPORTANT**: Before generating, randomly select ONE option from each category below. Do NOT always pick the first option - use true randomness.

### Frame Materials (pick one):
${frameOptions}

### Felt Colors (pick one):
${feltOptions}

### Cushion Styles (pick one):
${cushionOptions}

---
`;

    return `
# POOL TABLE SKIN GENERATION

## YOUR TASK
Generate a **photorealistic top-down pool table image** (PNG, ${fullW}x${fullH} pixels) that matches the physics geometry below.

> **IMPORTANT**: If a reference image is attached, match its visual style. Otherwise, use the randomly selected style below.

${styleSection}

## VISUAL QUALITY REQUIREMENTS (CRITICAL)


This is for a **high-fidelity mobile game**. The table must look premium and realistic:

### Frame/Rim
- Apply your randomly selected frame material from above
- Subtle **glossy highlights** at edges (or matte for certain metals)
- **Beveled edges** with depth/shadow

### Cushions/Rails
- **Rubber cushion noses** with realistic rounded profile
- Apply your randomly selected cushion style from above
- Shadow gradient where cushion meets felt
- Diamond-shaped **rail sights** (markers) along the rails

### Felt (Use your randomly selected color)
- **Fine cloth texture** with subtle weave pattern
- Use the exact hex color from your selection above
- May have **subtle shadow vignette** around edges

### Pockets
- **Deep, dark holes** with gradient fading to black
- **Chamfered/beveled edge** around pocket opening
- Subtle **shadow/depth** around pocket rim
- Optional: leather pocket liners visible

### Overall
- **Soft ambient shadows** throughout
- **Consistent lighting** from above (no harsh directional shadows)
- **High resolution** with crisp details at 100% zoom

---

## POOL TABLE ANATOMY

A pool table consists of these NESTED layers from outside to inside:

1. **FRAME/RIM** - The wooden outer border
2. **RAILS/CUSHIONS** - Rubber-covered edges that balls bounce off
3. **PLAY AREA** (THE FELT) - The green cloth surface where balls roll (rectangle centered at 0,0)
4. **POCKETS** - Holes at the corners and sides (at the EDGE of the felt, NOT inside it)

---

## COORDINATE SYSTEM

- **Physics coordinates**: Origin (0,0) is the CENTER of the play area. +X=right, +Y=up.
- **Pixel coordinates**: Origin (0,0) is TOP-LEFT. +X=right, +Y=DOWN.

**Conversion**:
\`\`\`
Pixel_X = ${fmt(cx)} + (Physics_X * ${fmt(ppi)})
Pixel_Y = ${fmt(cy)} - (Physics_Y * ${fmt(ppi)})
\`\`\`

---

## WORKED EXAMPLES

**Play Area** (The green felt rectangle):
- Pixels: Top-left **(${topLeftPlay.px}, ${topLeftPlay.py})**, bottom-right **(${bottomRightPlay.px}, ${bottomRightPlay.py})**

${cornerPocket && cornerPocketPx ? `**Corner Pocket** (${cornerPocket.id}):
- Pixel center: **(${cornerPocketPx.px}, ${cornerPocketPx.py})**
- Radius: ${fmt(cornerPocket.radius * ppi)}px
` : ''}

---

## GEOMETRY DATA

**Play Area**: ${fmt(json.playArea.width)}" × ${fmt(json.playArea.height)}" (${fmt(json.playArea.width * ppi)}px × ${fmt(json.playArea.height * ppi)}px)

**Pockets** (HOLES at table edges):
${pocketList}

**Cushion Rails**:
${railList}

---

## DELIVERABLES

1. **Main Image**: ${fullW}×${fullH}px PNG with all visual quality features above
2. **(Optional) SVG Overlay**: Circles at pocket centers + lines along rail edges for verification

---

## MISTAKES TO AVOID

❌ Flat/cartoonish style without texture
❌ Simple solid colors without gradients or depth
❌ Pockets floating inside the felt (they must be at CORNERS and SIDES)
❌ Missing wood grain on frame (unless metal frame selected)
❌ Missing cloth texture on felt
❌ **ANY text, logos, labels, or branding on the felt surface** - the felt must be PLAIN with only cloth texture
❌ Numbers, letters, or markings of any kind on the playing surface
❌ Company logos or watermarks anywhere on the table
✅ The felt should be a plain, unmarked cloth surface
✅ Match the reference image quality if one is provided
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
            <button class="skin-card-delete" data-skin-id="${skin.id}" title="Delete skin">×</button>
            <div class="skin-card-preview" style="${skin.thumbnail ? `background-image: url(${skin.thumbnail}); background-size: cover; background-position: center;` : ''
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
      card.addEventListener('click', (e) => {
        // Don't select if clicking delete button
        if ((e.target as HTMLElement).classList.contains('skin-card-delete')) return;
        const id = (card as HTMLElement).dataset.skinId;
        if (id) void this.selectSkin(id);
      });
    });

    grid.querySelectorAll('.skin-card-delete').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = (btn as HTMLElement).dataset.skinId;
        if (id) await this.deleteSkin(id);
      });
    });

    grid.querySelector('#skin-card-add')?.addEventListener('click', () => void this.createNewSkin());
  }

  private async deleteSkin(id: string): Promise<void> {
    const skin = this.skinStore.get(id);
    if (!skin) return;

    if (!confirm(`Delete skin "${skin.name}"?`)) return;

    await this.skinStore.delete(id);

    // If we deleted the active skin, clear the active skin
    if (this.activeSkinId === id) {
      this.activeSkinId = null;
      this.skinStore.setActiveSkinId(null);
    }

    this.renderSkinGrid();
  }

  private async selectSkin(id: string): Promise<void> {
    const skin = this.skinStore.get(id);
    if (!skin) return;
    this.activeSkinId = id;
    this.skinStore.setActiveSkinId(id);
    if (this.activeTable) {
      this.activeTable.linkedSkinId = id;
      void this.tableLibrary.save(this.activeTable);
    }
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
        // Handle image files as skin imports
        if (file.type.startsWith('image/')) {
          const skin = await this.skinStore.createFromFile(file);
          this.activeSkinId = skin.id;
          this.skinStore.setActiveSkinId(skin.id);
          this.renderSkinGrid();
          if (skin.images.full) await this.preview?.loadSkinFromBase64(skin.images.full);
          continue;
        }

        // Handle JSON/table files using FileIO utilities
        if (file.name.endsWith('.json') || file.name.endsWith('.railrush-table') || file.name.endsWith('.physics.json')) {
          try {
            const text = await file.text();
            const result = parseImportedFile(text, file.name);
            if (result) {
              const created = await this.tableLibrary.create({
                name: result.name,
                linkedSkinId: result.linkedSkinId ?? this.activeSkinId,
                physicsJson: result.physicsJson as PhysicsJson,
              });
              await this.selectTable(created.id);
            }
          } catch {
            // Ignore parse errors
          }
        }
      }
    });
  }

  private async importFile(): Promise<void> {
    const file = await pickAndReadFile();
    if (!file) return;

    const result = parseImportedFile(file.content, file.filename);
    if (!result) {
      alert('Unsupported file format.');
      return;
    }

    const created = await this.tableLibrary.create({
      name: result.name,
      linkedSkinId: result.linkedSkinId ?? this.activeSkinId,
      physicsJson: result.physicsJson as PhysicsJson,
    });
    await this.selectTable(created.id);
  }

  private exportCurrent(): void {
    if (!this.activeTable) return;

    exportTableAsFile({
      id: this.activeTable.id,
      name: this.activeTable.name,
      linkedSkinId: this.activeSkinId,
      physicsJson: this.activeTable.physicsJson,
    });
  }

  private sendGeometryPatch(patch: Record<string, unknown>): void {
    this.wsBridge.sendGeometryPatch(patch);
  }

  private pushToGame(mode: 'live' | 'persist'): void {
    if (!this.activeTable) return;
    const skin = this.activeSkinId ? this.skinStore.get(this.activeSkinId) : null;

    this.wsBridge.pushToGame(mode, {
      physicsJson: this.activeTable.physicsJson,
      skin: skin?.images?.full ? { name: skin.name, image: skin.images.full } : null,
    });
  }

  private async saveToDisk(options: { setActive: boolean }): Promise<void> {
    if (!this.activeTable) return;

    const result = await saveTableToDisk({
      name: this.activeTable.name,
      tableId: this.activeTable.id,
      physicsJson: this.activeTable.physicsJson,
      setActive: options.setActive,
    });

    if (result.success) {
      this.setDirty(false);
      alert(options.setActive ? 'Saved and set active.' : 'Saved to disk.');
    } else {
      alert(`Save server not reachable.\nStart dev server and save server.\n\nError: ${result.error}`);
    }
  }
}

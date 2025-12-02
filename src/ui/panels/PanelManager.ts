import { UIPanel } from './UIPanel';

export interface PanelManagerOptions {
  /** Allow multiple panels to be opened simultaneously by default. */
  allowMultiple?: boolean;
  /** Close the most recently opened panel when Escape is pressed. */
  closeOnEscape?: boolean;
  /** Persist the last opened panel id to localStorage. */
  storageKey?: string;
  /** Re-open the last stored panel on initialization (if it still exists). */
  restoreLastOpen?: boolean;
  /** Optional window object (useful for testing). Defaults to global window. */
  win?: Window;
}

export interface PanelRegistrationOptions {
  /** Button element used to toggle this panel from the UI. */
  toggleButton?: HTMLElement | null;
  /** Overrides manager default to allow multiple panels open for this entry. */
  allowMultiple?: boolean;
  /** String that scopes mutual exclusivity. Panels with different groups won't close each other. */
  group?: string;
  /** Keyboard shortcuts that should toggle this panel (e.g. ['g', 'G']). */
  hotkeys?: string[];
  /** Persist this panel as last open even if manager persistence disabled. */
  persistState?: boolean;
}

interface RegisteredPanel {
  panel: UIPanel;
  allowMultiple: boolean;
  group: string | null;
  button?: HTMLElement;
  hotkeys: string[];
  persistState: boolean;
  cleanup: Array<() => void>;
}

const DEFAULT_STORAGE_KEY = 'pool2d:ui:last-panel';

const HOTKEY_BLOCKLIST = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

const isEditableElement = (target: EventTarget | null): boolean => {
  if (!target || !(target instanceof HTMLElement)) return false;
  if (HOTKEY_BLOCKLIST.has(target.tagName)) return true;
  if (target.isContentEditable) return true;
  return false;
};

export class PanelManager extends EventTarget {
  private panels = new Map<string, RegisteredPanel>();
  private openPanels = new Set<string>();
  private options: Required<PanelManagerOptions>;
  private keyHandler?: (event: KeyboardEvent) => void;

  constructor(options?: PanelManagerOptions) {
    super();
    this.options = {
      allowMultiple: options?.allowMultiple ?? false,
      closeOnEscape: options?.closeOnEscape ?? true,
      storageKey: options?.storageKey ?? DEFAULT_STORAGE_KEY,
      restoreLastOpen: options?.restoreLastOpen ?? true,
      win: options?.win ?? (typeof window !== 'undefined' ? window : undefined as unknown as Window)
    };

    if (this.options.closeOnEscape && this.options.win) {
      this.keyHandler = (event: KeyboardEvent) => this.handleKeyDown(event);
      this.options.win.addEventListener('keydown', this.keyHandler, true);
    }
  }

  registerPanel(panel: UIPanel, options?: PanelRegistrationOptions): void {
    const id = panel.id;
    if (this.panels.has(id)) {
      this.unregisterPanel(id);
    }

    const normalizedHotkeys = this.normalizeHotkeys(options?.hotkeys);

    const entry: RegisteredPanel = {
      panel,
      allowMultiple: options?.allowMultiple ?? this.options.allowMultiple,
      group: options?.group ?? 'default',
      button: options?.toggleButton ?? undefined,
      hotkeys: normalizedHotkeys,
      persistState: options?.persistState ?? this.options.restoreLastOpen,
      cleanup: []
    };

    this.panels.set(id, entry);

    this.bindPanelEvents(entry);
    if (entry.button) {
      this.bindToggleButton(entry, entry.button);
      this.syncButtonState(entry, panel.isOpen());
    }

    if (panel.isOpen()) {
      this.handlePanelOpened(entry);
    }
  }

  unregisterPanel(id: string): void {
    const entry = this.panels.get(id);
    if (!entry) return;

    entry.cleanup.forEach((dispose) => dispose());
    this.panels.delete(id);
    this.openPanels.delete(id);
  }

  hasPanel(id: string): boolean {
    return this.panels.has(id);
  }

  isPanelOpen(id: string): boolean {
    return this.openPanels.has(id);
  }

  openPanel(id: string): void {
    const entry = this.panels.get(id);
    if (!entry) return;

    if (!entry.allowMultiple) {
      this.closeOthers(id, entry.group);
    }

    entry.panel.open();
  }

  closePanel(id: string): void {
    const entry = this.panels.get(id);
    if (!entry) return;
    entry.panel.close();
  }

  togglePanel(id: string): boolean {
    const entry = this.panels.get(id);
    if (!entry) return false;

    if (entry.panel.isOpen()) {
      entry.panel.close();
    } else {
      this.openPanel(id);
    }
    return true;
  }

  closeAll(): void {
    this.panels.forEach(({ panel }) => panel.close({ silent: true }));
    this.openPanels.clear();
    this.syncAllButtonStates();
  }

  getOpenPanels(): string[] {
    return Array.from(this.openPanels);
  }

  dispose(): void {
    if (this.keyHandler && this.options.win) {
      this.options.win.removeEventListener('keydown', this.keyHandler, true);
    }
    this.panels.forEach((entry) => entry.cleanup.forEach((dispose) => dispose()));
    this.panels.clear();
    this.openPanels.clear();
  }

  restoreLastPanel(): void {
    if (!this.options.restoreLastOpen) return;
    const id = this.loadLastOpenId();
    if (!id || !this.panels.has(id)) return;
    this.openPanel(id);
  }

  private bindPanelEvents(entry: RegisteredPanel): void {
    const { panel } = entry;

    const handleOpened = () => {
      this.handlePanelOpened(entry);
    };

    const handleClosed = () => {
      this.handlePanelClosed(entry);
    };

    panel.addEventListener('panel:open', handleOpened as EventListener);
    panel.addEventListener('panel:close', handleClosed as EventListener);

    entry.cleanup.push(() => {
      panel.removeEventListener('panel:open', handleOpened as EventListener);
      panel.removeEventListener('panel:close', handleClosed as EventListener);
    });
  }

  private bindToggleButton(entry: RegisteredPanel, button: HTMLElement): void {
    button.setAttribute('type', 'button');
    button.setAttribute('aria-controls', entry.panel.getElement().id || entry.panel.id);
    button.setAttribute('aria-pressed', entry.panel.isOpen() ? 'true' : 'false');
    button.dataset.panelId = entry.panel.id;

    const clickHandler = (event: Event) => {
      event.preventDefault();
      this.togglePanel(entry.panel.id);
    };

    button.addEventListener('click', clickHandler);
    entry.cleanup.push(() => button.removeEventListener('click', clickHandler));
  }

  private handlePanelOpened(entry: RegisteredPanel): void {
    const id = entry.panel.id;

    if (!entry.allowMultiple) {
      this.closeOthers(id, entry.group);
    }

    this.openPanels.add(id);
    this.syncButtonState(entry, true);

    if (entry.persistState) {
      this.saveLastOpenId(id);
    }

    this.dispatchEvent(new CustomEvent('manager:panel-open', { detail: { id } }));
  }

  private handlePanelClosed(entry: RegisteredPanel): void {
    const id = entry.panel.id;
    this.openPanels.delete(id);
    this.syncButtonState(entry, false);
    this.dispatchEvent(new CustomEvent('manager:panel-close', { detail: { id } }));
  }

  private closeOthers(id: string, group: string | null): void {
    this.panels.forEach((entry, panelId) => {
      if (panelId === id) return;
      if (group && entry.group && entry.group !== group) return;
      if (entry.allowMultiple) return;
      if (!entry.panel.isOpen()) return;
      entry.panel.close({ silent: true });
      this.openPanels.delete(panelId);
      this.syncButtonState(entry, false);
    });
  }

  private syncAllButtonStates(): void {
    this.panels.forEach((entry) => this.syncButtonState(entry, entry.panel.isOpen()));
  }

  private syncButtonState(entry: RegisteredPanel, isOpen: boolean): void {
    if (!entry.button) return;
    entry.button.setAttribute('aria-pressed', isOpen ? 'true' : 'false');
    entry.button.dataset.active = isOpen ? 'true' : 'false';
    entry.button.classList.toggle('is-active', isOpen);
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (this.shouldIgnoreKey(event)) {
      return;
    }

    if (event.key === 'Escape') {
      const lastOpen = Array.from(this.openPanels).pop();
      if (lastOpen) {
        event.stopPropagation();
        event.preventDefault();
        this.closePanel(lastOpen);
      }
      return;
    }

    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    const match = this.findPanelByHotkey(key);
    if (match) {
      event.preventDefault();
      this.togglePanel(match);
    }
  }

  private shouldIgnoreKey(event: KeyboardEvent): boolean {
    if (event.defaultPrevented) return true;
    if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return true;
    if (isEditableElement(event.target)) return true;
    return false;
  }

  private findPanelByHotkey(key: string): string | null {
    for (const [id, entry] of this.panels.entries()) {
      if (entry.hotkeys.includes(key)) {
        return id;
      }
    }
    return null;
  }

  private normalizeHotkeys(hotkeys?: string[]): string[] {
    if (!hotkeys || hotkeys.length === 0) {
      return [];
    }
    const normalized = hotkeys
      .map((key) => key.length === 1 ? key.toLowerCase() : key)
      .filter((key, index, self) => key && self.indexOf(key) === index);
    return normalized;
  }

  private saveLastOpenId(id: string): void {
    if (!this.options.storageKey || !this.options.win?.localStorage) return;
    try {
      this.options.win.localStorage.setItem(this.options.storageKey, id);
    } catch (error) {
      console.warn('PanelManager: failed to persist panel id', error);
    }
  }

  private loadLastOpenId(): string | null {
    if (!this.options.storageKey || !this.options.win?.localStorage) return null;
    try {
      return this.options.win.localStorage.getItem(this.options.storageKey);
    } catch (error) {
      console.warn('PanelManager: failed to read persisted panel id', error);
      return null;
    }
  }
}

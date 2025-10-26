export interface UIPanelOptions {
  /** Unique identifier for this panel. */
  id: string;
  /** Root element that represents the panel in the DOM. */
  element: HTMLElement;
  /** Whether the panel should start opened. Defaults to the element's current visibility. */
  defaultOpen?: boolean;
  /** CSS class used to hide the panel. Defaults to `hidden`. */
  hiddenClass?: string;
  /** Optional CSS class toggled when the panel is open. */
  openClass?: string | null;
  /** Optional element that should receive focus when the panel opens. */
  focusTarget?: HTMLElement | null;
}

export interface UIPanelOpenOptions {
  focusTarget?: HTMLElement | null;
  silent?: boolean;
}

export interface UIPanelCloseOptions {
  silent?: boolean;
}

const DEFAULT_HIDDEN_CLASS = 'hidden';

/**
 * Lightweight controller around a floating UI panel.
 * Handles visibility, focus management, and dispatches open/close events.
 */
export class UIPanel extends EventTarget {
  readonly id: string;
  protected element: HTMLElement;
  protected hiddenClass: string;
  protected openClass: string | null;
  protected openState: boolean;
  protected focusTarget: HTMLElement | null;
  protected previouslyFocused: HTMLElement | null = null;

  constructor(options: UIPanelOptions) {
    super();

    this.id = options.id;
    this.element = options.element;
    this.hiddenClass = options.hiddenClass ?? DEFAULT_HIDDEN_CLASS;
    this.openClass = options.openClass ?? null;
    this.focusTarget = options.focusTarget ?? null;

    const elementIsVisible = !this.element.classList.contains(this.hiddenClass);
    this.openState = options.defaultOpen ?? elementIsVisible;

    this.applyAriaRole();
    this.syncInitialState();
  }

  isOpen(): boolean {
    return this.openState;
  }

  open(options?: UIPanelOpenOptions): void {
    if (this.openState) {
      return;
    }

    this.previouslyFocused = this.getActiveElement();
    this.openState = true;
    this.showElement();

    if (!(options?.silent ?? false)) {
      this.dispatchEvent(new CustomEvent('panel:open', { detail: { id: this.id } }));
    }

    const target = options?.focusTarget ?? this.focusTarget;
    if (target) {
      this.safeFocus(target);
    } else {
      this.focus();
    }
  }

  close(options?: UIPanelCloseOptions): void {
    if (!this.openState) {
      return;
    }

    this.openState = false;
    this.hideElement();

    if (!(options?.silent ?? false)) {
      this.dispatchEvent(new CustomEvent('panel:close', { detail: { id: this.id } }));
    }

    if (this.previouslyFocused && document.contains(this.previouslyFocused)) {
      this.safeFocus(this.previouslyFocused);
    }
    this.previouslyFocused = null;
  }

  toggle(options?: UIPanelOpenOptions & UIPanelCloseOptions): void {
    if (this.isOpen()) {
      this.close({ silent: options?.silent });
    } else {
      this.open(options);
    }
  }

  /**
   * Attempts to focus either the configured focus target or the panel element itself.
   */
  focus(): void {
    const focusable = this.focusTarget ?? this.findFocusableElement();
    if (focusable) {
      this.safeFocus(focusable);
      return;
    }

    if (!this.element.hasAttribute('tabindex')) {
      this.element.setAttribute('tabindex', '-1');
    }
    this.safeFocus(this.element);
  }

  setFocusTarget(target: HTMLElement | null): void {
    this.focusTarget = target;
  }

  getElement(): HTMLElement {
    return this.element;
  }

  protected showElement(): void {
    this.element.classList.remove(this.hiddenClass);
    if (this.openClass) {
      this.element.classList.add(this.openClass);
    }
    this.element.setAttribute('aria-hidden', 'false');
  }

  protected hideElement(): void {
    this.element.classList.add(this.hiddenClass);
    if (this.openClass) {
      this.element.classList.remove(this.openClass);
    }
    this.element.setAttribute('aria-hidden', 'true');
  }

  protected syncInitialState(): void {
    if (this.openState) {
      this.showElement();
    } else {
      this.hideElement();
    }
  }

  protected applyAriaRole(): void {
    if (!this.element.getAttribute('role')) {
      this.element.setAttribute('role', 'dialog');
    }
    this.element.setAttribute('aria-modal', 'false');
  }

  protected findFocusableElement(): HTMLElement | null {
    const selectors = [
      '[data-panel-focus="true"]',
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])'
    ];
    const candidate = this.element.querySelector<HTMLElement>(selectors.join(','));
    return candidate ?? null;
  }

  protected safeFocus(target: HTMLElement): void {
    if (typeof target.focus !== 'function') {
      return;
    }
    try {
      target.focus({ preventScroll: true });
    } catch {
      try {
        target.focus();
      } catch {
        // Swallow focus errors silently.
      }
    }
  }

  protected getActiveElement(): HTMLElement | null {
    const active = document.activeElement;
    if (!active || !(active instanceof HTMLElement)) {
      return null;
    }
    return active;
  }
}

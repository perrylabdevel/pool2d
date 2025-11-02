/**
 * Unified slider control component
 * Handles all slider patterns across settings panels:
 * - Simple sliders with value display
 * - Nullable sliders with "Auto" button
 * - Sliders with validation/clamping
 * - Sliders with custom formatting
 */

export interface SliderConfig<T = any> {
  /** Unique ID for the slider element */
  id: string;

  /** Display label text */
  label: string;

  /** Minimum value */
  min: number;

  /** Maximum value */
  max: number;

  /** Step size */
  step: number;

  /** Initial/current value (null for "Auto" state) */
  value: number | null;

  /** Callback when value changes */
  onChange: (value: number | null) => void;

  /** Number of decimal places to display (default: 2) */
  formatDigits?: number;

  /** Custom value formatter function */
  formatValue?: (value: number) => string;

  /** Value validation/clamping function */
  clampValue?: (value: number) => number;

  /** Allow null/"Auto" state (shows "Auto" button) */
  nullable?: boolean;

  /** Default value for "Auto" button */
  defaultValue?: number;

  /** Additional CSS classes for the container */
  className?: string;

  /** Key for settings storage */
  settingsKey?: keyof T;
}

/**
 * SliderControl manages a slider input with label and optional "Auto" button
 */
export class SliderControl<T = any> {
  private container: HTMLDivElement;
  private slider: HTMLInputElement;
  private valueLabel: HTMLSpanElement;
  private autoButton?: HTMLButtonElement;
  private config: Required<Omit<SliderConfig<T>, 'autoButton' | 'defaultValue' | 'settingsKey'>> &
    Pick<SliderConfig<T>, 'defaultValue' | 'settingsKey'>;

  constructor(config: SliderConfig<T>) {
    // Fill in defaults
    this.config = {
      formatDigits: 2,
      formatValue: (v) => this.defaultFormatter(v),
      clampValue: (v) => v,
      nullable: false,
      className: '',
      ...config,
    };

    this.container = this.createContainer();
    this.slider = this.container.querySelector(`#${this.config.id}`) as HTMLInputElement;
    this.valueLabel = this.container.querySelector(`#${this.config.id}-value`) as HTMLSpanElement;

    if (this.config.nullable) {
      this.autoButton = this.container.querySelector(`#${this.config.id}-auto`) as HTMLButtonElement;
    }

    this.setupEventListeners();
    this.updateDisplay();
  }

  private defaultFormatter(value: number): string {
    return value
      .toFixed(this.config.formatDigits)
      .replace(/\.0+$|\.([0-9]*[1-9])0+$/, '.$1')
      .replace(/\.$/, '');
  }

  private createContainer(): HTMLDivElement {
    const div = document.createElement('div');
    div.className = `slider-group ${this.config.className}`.trim();

    div.innerHTML = `
      <label class="slider-label" for="${this.config.id}">
        <span class="slider-title">${this.config.label}</span>
        <span class="slider-value" id="${this.config.id}-value"></span>
        ${this.config.nullable ? `<button class="auto-button" id="${this.config.id}-auto">Auto</button>` : ''}
      </label>
      <input
        type="range"
        id="${this.config.id}"
        min="${this.config.min}"
        max="${this.config.max}"
        step="${this.config.step}"
        value="${this.config.value ?? this.config.defaultValue ?? this.config.min}"
        ${this.config.defaultValue !== undefined ? `data-default="${this.config.defaultValue}"` : ''}
      />
    `;

    return div;
  }

  private setupEventListeners(): void {
    // Slider input event
    this.slider.addEventListener('input', () => {
      const rawValue = parseFloat(this.slider.value);
      const clampedValue = this.config.clampValue(rawValue);

      // Update slider if clamping changed the value
      if (clampedValue !== rawValue) {
        this.slider.value = clampedValue.toString();
      }

      this.config.onChange(clampedValue);
      this.updateDisplay(clampedValue);
    });

    // Auto button event
    if (this.autoButton) {
      this.autoButton.addEventListener('click', () => {
        const defaultVal = this.config.defaultValue ?? this.config.min;
        this.slider.value = defaultVal.toString();
        this.config.onChange(null); // Null means "Auto"
        this.updateDisplay(null);
      });
    }
  }

  private updateDisplay(value?: number | null): void {
    const displayValue = value !== undefined ? value : this.config.value;

    if (displayValue === null) {
      this.valueLabel.textContent = 'Auto';
    } else {
      this.valueLabel.textContent = this.config.formatValue(displayValue);
    }
  }

  /**
   * Get the DOM element for this control
   */
  getElement(): HTMLDivElement {
    return this.container;
  }

  /**
   * Update the slider's value programmatically
   */
  setValue(value: number | null): void {
    this.config.value = value;
    if (value !== null) {
      this.slider.value = value.toString();
    }
    this.updateDisplay();
  }

  /**
   * Get the current value
   */
  getValue(): number | null {
    return this.config.value;
  }

  /**
   * Enable or disable the slider
   */
  setEnabled(enabled: boolean): void {
    this.slider.disabled = !enabled;
    if (this.autoButton) {
      this.autoButton.disabled = !enabled;
    }
  }

  /**
   * Destroy the control and remove from DOM
   */
  destroy(): void {
    this.container.remove();
  }
}

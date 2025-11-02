/**
 * SliderBinder - Utility to bind event handlers to existing slider elements
 * Works with HTML sliders already in the DOM or generated via templates
 * Eliminates repetitive event binding code across panels
 */

export interface SliderBindConfig<T = any> {
  /** Slider input element ID */
  sliderId: string;

  /** Value label element ID (displays current value) */
  labelId: string;

  /** Optional "Auto" button element ID */
  autoButtonId?: string;

  /** Callback when value changes */
  onChange: (value: number | null) => void;

  /** Number of decimal places to display (default: 2) */
  formatDigits?: number;

  /** Custom value formatter function */
  formatValue?: (value: number) => string;

  /** Value validation/clamping function */
  clampValue?: (value: number) => number;

  /** Default value for "Auto" button */
  defaultValue?: number;

  /** Settings key for type safety */
  settingsKey?: keyof T;
}

/**
 * Format a number with specified digits, removing trailing zeros
 */
export function formatNumber(value: number, digits: number = 2): string {
  return value
    .toFixed(digits)
    .replace(/\.0+$|\.([0-9]*[1-9])0+$/, '.$1')
    .replace(/\.$/, '');
}

/**
 * SliderBinder attaches logic to existing slider HTML elements
 */
export class SliderBinder<T = any> {
  private slider: HTMLInputElement;
  private label: HTMLElement;
  private autoButton?: HTMLButtonElement;
  private config: Required<Omit<SliderBindConfig<T>, 'autoButtonId' | 'defaultValue' | 'settingsKey'>> &
    Pick<SliderBindConfig<T>, 'defaultValue' | 'settingsKey'>;

  constructor(config: SliderBindConfig<T>) {
    const slider = document.getElementById(config.sliderId) as HTMLInputElement | null;
    const label = document.getElementById(config.labelId) as HTMLElement | null;

    if (!slider) {
      throw new Error(`Slider element not found: ${config.sliderId}`);
    }
    if (!label) {
      throw new Error(`Label element not found: ${config.labelId}`);
    }

    this.slider = slider;
    this.label = label;

    if (config.autoButtonId) {
      const autoBtn = document.getElementById(config.autoButtonId) as HTMLButtonElement | null;
      if (autoBtn) {
        this.autoButton = autoBtn;
      }
    }

    // Fill in defaults
    this.config = {
      formatDigits: 2,
      formatValue: (v) => formatNumber(v, config.formatDigits ?? 2),
      clampValue: (v) => v,
      ...config,
    };

    this.bind();
  }

  private bind(): void {
    // Slider input event
    this.slider.addEventListener('input', () => {
      const rawValue = parseFloat(this.slider.value);
      const clampedValue = this.config.clampValue(rawValue);

      // Update slider if clamping changed the value
      if (clampedValue !== rawValue) {
        this.slider.value = clampedValue.toFixed(this.config.formatDigits);
      }

      this.updateLabel(clampedValue);
      this.config.onChange(clampedValue);
    });

    // Auto button event
    if (this.autoButton) {
      this.autoButton.addEventListener('click', () => {
        const defaultVal = this.config.defaultValue ?? parseFloat(this.slider.min);
        this.slider.value = defaultVal.toFixed(this.config.formatDigits);
        this.updateLabel(null);
        this.config.onChange(null);
      });
    }
  }

  /**
   * Update the label display
   */
  updateLabel(value: number | null): void {
    if (value === null) {
      this.label.textContent = 'Auto';
    } else {
      this.label.textContent = this.config.formatValue(value);
    }
  }

  /**
   * Set the slider value programmatically
   */
  setValue(value: number | null): void {
    if (value !== null) {
      this.slider.value = value.toString();
      this.updateLabel(value);
    } else {
      this.updateLabel(null);
    }
  }

  /**
   * Get the current slider value
   */
  getValue(): number {
    return parseFloat(this.slider.value);
  }
}

/**
 * Helper to bind multiple sliders at once
 * Returns a map of slider IDs to SliderBinder instances
 */
export function bindSliders<T = any>(
  configs: SliderBindConfig<T>[]
): Map<string, SliderBinder<T>> {
  const binders = new Map<string, SliderBinder<T>>();

  for (const config of configs) {
    try {
      const binder = new SliderBinder<T>(config);
      binders.set(config.sliderId, binder);
    } catch (error) {
      console.error(`Failed to bind slider ${config.sliderId}:`, error);
    }
  }

  return binders;
}

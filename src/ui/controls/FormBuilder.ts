/**
 * FormBuilder utility for creating and managing form controls in panels
 * Simplifies the creation of sliders, toggles, and other controls
 */

import { SliderControl, type SliderConfig } from './SliderControl';

/**
 * FormBuilder helps construct and manage form controls in settings panels
 */
export class FormBuilder<T = any> {
  private controls: Map<string, SliderControl<T>> = new Map();
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  /**
   * Add a slider control to the form
   */
  addSlider(config: SliderConfig<T>): SliderControl<T> {
    const control = new SliderControl<T>(config);
    this.controls.set(config.id, control);
    return control;
  }

  /**
   * Add multiple sliders at once
   * Returns a map of control IDs to SliderControl instances
   */
  addSliders(configs: SliderConfig<T>[]): Map<string, SliderControl<T>> {
    const result = new Map<string, SliderControl<T>>();

    for (const config of configs) {
      const control = this.addSlider(config);
      result.set(config.id, control);
    }

    return result;
  }

  /**
   * Get a specific control by ID
   */
  getControl(id: string): SliderControl<T> | undefined {
    return this.controls.get(id);
  }

  /**
   * Get all controls
   */
  getAllControls(): Map<string, SliderControl<T>> {
    return this.controls;
  }

  /**
   * Set values for multiple controls at once
   */
  setValues(values: Record<string, number | null>): void {
    for (const [id, value] of Object.entries(values)) {
      const control = this.controls.get(id);
      if (control) {
        control.setValue(value);
      }
    }
  }

  /**
   * Get values from all controls
   */
  getValues(): Record<string, number | null> {
    const values: Record<string, number | null> = {};

    for (const [id, control] of this.controls) {
      values[id] = control.getValue();
    }

    return values;
  }

  /**
   * Enable or disable all controls
   */
  setEnabled(enabled: boolean): void {
    for (const control of this.controls.values()) {
      control.setEnabled(enabled);
    }
  }

  /**
   * Clear all controls and remove from DOM
   */
  clear(): void {
    for (const control of this.controls.values()) {
      control.destroy();
    }
    this.controls.clear();
  }

  /**
   * Append all controls to a parent element
   * Useful for dynamically building forms
   */
  appendTo(parent: HTMLElement): void {
    for (const control of this.controls.values()) {
      parent.appendChild(control.getElement());
    }
  }
}

/**
 * Helper function to create a settings group section
 */
export function createSettingsGroup(title: string, controls: SliderControl<any>[]): HTMLDivElement {
  const group = document.createElement('div');
  group.className = 'settings-group';

  if (title) {
    const titleEl = document.createElement('h4');
    titleEl.className = 'settings-group-title';
    titleEl.textContent = title;
    group.appendChild(titleEl);
  }

  for (const control of controls) {
    group.appendChild(control.getElement());
  }

  return group;
}

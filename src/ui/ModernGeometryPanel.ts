/**
 * Modern Geometry Panel
 *
 * New angle-based UI for pocket geometry configuration.
 * Provides template selection and direct angle/opening controls.
 */

import { SettingsManager } from './SettingsManager';
import { makePanelDraggable } from './drag';
import { UIPanel } from './panels/UIPanel';
import { bindSliders, type SliderBindConfig } from './controls/SliderBinder';
import {
  ModernPocketGeometry,
  PocketTemplate,
  GEOMETRY_TEMPLATES,
  getTemplateName,
  getTemplateDescription,
  GEOMETRY_RANGES,
  validateModernGeometry,
} from '../geometry/ModernGeometry';
import { modernToLegacy, applyLegacyGeometry } from '../geometry/GeometryConversion';
import { calculateJawAngle } from '../geometry/ModernGeometryCalculator';

const formatNumber = (value: number, digits: number = 2): string =>
  value.toFixed(digits).replace(/\.0+$|\.([0-9]*[1-9])0+$/, '.$1').replace(/\.$/, '');

export class ModernGeometryPanel {
  private panel: HTMLElement;
  private panelController: UIPanel;
  private settingsManager: SettingsManager;
  private onGeometryChange: () => void;
  private currentGeometry: ModernPocketGeometry;

  constructor(settingsManager: SettingsManager, onGeometryChange: () => void) {
    this.settingsManager = settingsManager;
    this.onGeometryChange = onGeometryChange;

    // Start with default template (deep copy to avoid modifying the original)
    const defaultTemplate = GEOMETRY_TEMPLATES[PocketTemplate.BCA_TOURNAMENT_MEDIUM];
    this.currentGeometry = {
      template: defaultTemplate.template,
      side: { ...defaultTemplate.side },
      corner: { ...defaultTemplate.corner },
      global: defaultTemplate.global ? { ...defaultTemplate.global } : undefined,
    };

    this.panel = this.createPanel();
    const header = this.panel.querySelector('.panel-header') as HTMLElement | null;
    if (header) {
      makePanelDraggable(this.panel, header);
    }

    const focusTarget = this.panel.querySelector<HTMLElement>('input, button, select');
    this.panelController = new UIPanel({
      id: 'modern-geometry-panel',
      element: this.panel,
      focusTarget,
    });

    this.setupControls();
    this.syncToUI();
  }

  private createPanel(): HTMLElement {
    // Check if panel already exists
    let panel = document.getElementById('modern-geometry-panel');
    if (panel) {
      return panel as HTMLElement;
    }

    // Create new panel
    panel = document.createElement('div');
    panel.id = 'modern-geometry-panel';
    panel.className = 'panel-dock-card hidden';
    panel.innerHTML = `
      <div class="panel-header">
        <h3>📐 Pocket Geometry (Modern)</h3>
        <button id="modern-geometry-panel-close" class="panel-close-btn" data-no-drag="true">×</button>
      </div>
      <div class="panel-content">
        ${this.generateTemplateSelector()}
        ${this.generateSidePocketControls()}
        ${this.generateCornerPocketControls()}
        ${this.generateGlobalControls()}
        ${this.generateActions()}
      </div>
    `;

    // Add to panel dock
    const dock = document.getElementById('panel-dock');
    if (dock) {
      dock.prepend(panel);
    }

    return panel as HTMLElement;
  }

  private generateTemplateSelector(): string {
    return `
      <div class="settings-group">
        <h4 class="settings-group-title">🎯 Quick Start Templates</h4>
        <div class="input-group" style="margin-bottom: 0.5rem;">
          <select id="modern-geometry-template" style="width: 100%; padding: 0.4rem; font-size: 0.9rem;">
            ${Object.values(PocketTemplate).map(template => `
              <option value="${template}">${getTemplateName(template)}</option>
            `).join('')}
          </select>
        </div>
        <button id="modern-geometry-load-template" class="panel-mini-btn" data-no-drag="true" style="width: 100%;">
          Load Template
        </button>
        <p style="font-size: 0.75rem; color: #999; margin-top: 0.5rem; margin-bottom: 0;">
          Select a template for quick setup, then fine-tune below
        </p>
      </div>
    `;
  }

  private generateSidePocketControls(): string {
    const ranges = GEOMETRY_RANGES.side;
    return `
      <div class="settings-group">
        <h4 class="settings-group-title">📍 Side Pockets</h4>
        <div style="font-size: 0.8rem; color: #888; margin-bottom: 0.5rem;" id="modern-side-jaw-angle-display">
          Calculated jaw angle: --
        </div>
        ${this.sliderRow(
          'modern-side-mouth',
          'Mouth Width (in)',
          ranges.mouthWidth.min,
          ranges.mouthWidth.max,
          0.05,
          ranges.mouthWidth.typical
        )}
        ${this.sliderRow(
          'modern-side-throat',
          'Throat Width (in)',
          ranges.throatWidth.min,
          ranges.throatWidth.max,
          0.05,
          ranges.throatWidth.typical
        )}
        ${this.sliderRow(
          'modern-side-rail-depth',
          'Rail Depth (in)',
          ranges.railDepth.min,
          ranges.railDepth.max,
          0.05,
          ranges.railDepth.typical
        )}
        ${this.sliderRow(
          'modern-side-jaw-depth',
          'Jaw Depth (in)',
          ranges.jawDepth.min,
          ranges.jawDepth.max,
          0.05,
          ranges.jawDepth.typical
        )}
        ${this.sliderRow(
          'modern-side-rail-curve',
          'Rail Curvature',
          ranges.railCurve.min,
          ranges.railCurve.max,
          0.05,
          ranges.railCurve.typical
        )}
      </div>
    `;
  }

  private generateCornerPocketControls(): string {
    const ranges = GEOMETRY_RANGES.corner;
    return `
      <div class="settings-group">
        <h4 class="settings-group-title">📐 Corner Pockets</h4>
        <div style="font-size: 0.8rem; color: #888; margin-bottom: 0.5rem;" id="modern-corner-jaw-angle-display">
          Calculated jaw angle: --
        </div>
        ${this.sliderRow(
          'modern-corner-mouth',
          'Mouth Width (in)',
          ranges.mouthWidth.min,
          ranges.mouthWidth.max,
          0.05,
          ranges.mouthWidth.typical
        )}
        ${this.sliderRow(
          'modern-corner-throat',
          'Throat Width (in)',
          ranges.throatWidth.min,
          ranges.throatWidth.max,
          0.05,
          ranges.throatWidth.typical
        )}
        ${this.sliderRow(
          'modern-corner-rail-depth',
          'Rail Depth (in)',
          ranges.railDepth.min,
          ranges.railDepth.max,
          0.05,
          ranges.railDepth.typical
        )}
        ${this.sliderRow(
          'modern-corner-jaw-depth',
          'Jaw Depth (in)',
          ranges.jawDepth.min,
          ranges.jawDepth.max,
          0.05,
          ranges.jawDepth.typical
        )}
        ${this.sliderRow(
          'modern-corner-shelf-depth',
          'Shelf Depth (in)',
          ranges.shelfDepth.min,
          ranges.shelfDepth.max,
          0.05,
          ranges.shelfDepth.typical
        )}
      </div>
    `;
  }

  private generateGlobalControls(): string {
    const ranges = GEOMETRY_RANGES.global;
    return `
      <div class="settings-group">
        <h4 class="settings-group-title">🌐 Global Settings</h4>
        ${this.sliderRow(
          'modern-global-side-pocket-offset',
          'Side Pocket Offset (in)',
          ranges.sidePocketOffset.min,
          ranges.sidePocketOffset.max,
          0.05,
          ranges.sidePocketOffset.typical
        )}
      </div>
    `;
  }

  private generateActions(): string {
    return `
      <div class="settings-group">
        <button id="modern-geometry-apply" class="panel-mini-btn" data-no-drag="true" style="width: 100%; margin-bottom: 0.5rem;">
          Apply to Table
        </button>
        <div id="modern-geometry-validation" style="font-size: 0.75rem; margin-top: 0.5rem; color: #999;"></div>
      </div>
    `;
  }

  private sliderRow(id: string, label: string, min: number, max: number, step: number, value: number): string {
    return `
      <div class="slider-group">
        <label for="${id}">
          ${label}: <span id="${id}-val">${formatNumber(value, 2)}</span>
        </label>
        <input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${value}" />
      </div>
    `;
  }

  private setupControls() {
    // Close button
    const closeBtn = document.getElementById('modern-geometry-panel-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }

    // Template selector
    const templateSelect = document.getElementById('modern-geometry-template') as HTMLSelectElement;
    const loadTemplateBtn = document.getElementById('modern-geometry-load-template');
    if (loadTemplateBtn) {
      loadTemplateBtn.addEventListener('click', () => {
        if (templateSelect) {
          const template = templateSelect.value as PocketTemplate;
          this.loadTemplate(template);
        }
      });
    }

    // Apply button
    const applyBtn = document.getElementById('modern-geometry-apply');
    if (applyBtn) {
      applyBtn.addEventListener('click', () => this.applyGeometry());
    }

    // Bind sliders
    const sliderConfigs: SliderBindConfig<ModernPocketGeometry>[] = [
      // Side pocket sliders
      {
        sliderId: 'modern-side-mouth',
        labelId: 'modern-side-mouth-val',
        onChange: (v) => {
          console.log('[ModernGeometry] Side mouth width changed to:', v);
          this.currentGeometry.side.mouthWidth = v!;
          console.log('[ModernGeometry] currentGeometry.side.mouthWidth is now:', this.currentGeometry.side.mouthWidth);
          this.validateAndUpdateUI();
        },
        formatDigits: 2,
      },
      {
        sliderId: 'modern-side-throat',
        labelId: 'modern-side-throat-val',
        onChange: (v) => {
          console.log('[ModernGeometry] Side throat width changed to:', v);
          this.currentGeometry.side.throatWidth = v!;
          console.log('[ModernGeometry] currentGeometry.side.throatWidth is now:', this.currentGeometry.side.throatWidth);
          this.validateAndUpdateUI();
        },
        formatDigits: 2,
      },
      {
        sliderId: 'modern-side-rail-depth',
        labelId: 'modern-side-rail-depth-val',
        onChange: (v) => {
          this.currentGeometry.side.railDepth = v!;
          this.validateAndUpdateUI();
        },
        formatDigits: 2,
      },
      {
        sliderId: 'modern-side-jaw-depth',
        labelId: 'modern-side-jaw-depth-val',
        onChange: (v) => {
          this.currentGeometry.side.jawDepth = v!;
          this.validateAndUpdateUI();
        },
        formatDigits: 2,
      },
      {
        sliderId: 'modern-side-rail-curve',
        labelId: 'modern-side-rail-curve-val',
        onChange: (v) => {
          this.currentGeometry.side.railCurve = v!;
          this.validateAndUpdateUI();
        },
        formatDigits: 2,
      },

      // Corner pocket sliders
      {
        sliderId: 'modern-corner-mouth',
        labelId: 'modern-corner-mouth-val',
        onChange: (v) => {
          this.currentGeometry.corner.mouthWidth = v!;
          this.validateAndUpdateUI();
        },
        formatDigits: 2,
      },
      {
        sliderId: 'modern-corner-throat',
        labelId: 'modern-corner-throat-val',
        onChange: (v) => {
          this.currentGeometry.corner.throatWidth = v!;
          this.validateAndUpdateUI();
        },
        formatDigits: 2,
      },
      {
        sliderId: 'modern-corner-rail-depth',
        labelId: 'modern-corner-rail-depth-val',
        onChange: (v) => {
          this.currentGeometry.corner.railDepth = v!;
          this.validateAndUpdateUI();
        },
        formatDigits: 2,
      },
      {
        sliderId: 'modern-corner-jaw-depth',
        labelId: 'modern-corner-jaw-depth-val',
        onChange: (v) => {
          this.currentGeometry.corner.jawDepth = v!;
          this.validateAndUpdateUI();
        },
        formatDigits: 2,
      },
      {
        sliderId: 'modern-corner-shelf-depth',
        labelId: 'modern-corner-shelf-depth-val',
        onChange: (v) => {
          this.currentGeometry.corner.shelfDepth = v!;
          this.validateAndUpdateUI();
        },
        formatDigits: 2,
      },

      // Global sliders
      {
        sliderId: 'modern-global-side-pocket-offset',
        labelId: 'modern-global-side-pocket-offset-val',
        onChange: (v) => {
          if (!this.currentGeometry.global) {
            this.currentGeometry.global = {};
          }
          this.currentGeometry.global.sidePocketOffset = v!;
          this.validateAndUpdateUI();
        },
        formatDigits: 2,
      },
    ];

    console.log('[ModernGeometry] Attempting to bind', sliderConfigs.length, 'sliders');
    const binders = bindSliders(sliderConfigs);
    console.log('[ModernGeometry] Successfully bound', binders.size, 'sliders');

    // Check if specific sliders were bound
    if (!binders.has('modern-side-mouth')) {
      console.error('[ModernGeometry] Failed to bind modern-side-mouth slider');
    }
    if (!binders.has('modern-side-throat')) {
      console.error('[ModernGeometry] Failed to bind modern-side-throat slider');
    }
  }

  private loadTemplate(template: PocketTemplate) {
    // Deep copy the template to avoid modifying the original
    const templateData = GEOMETRY_TEMPLATES[template];
    this.currentGeometry = {
      template: templateData.template,
      side: { ...templateData.side },
      corner: { ...templateData.corner },
      global: templateData.global ? { ...templateData.global } : undefined,
    };
    this.syncToUI();
    this.validateAndUpdateUI();
  }

  private syncToUI() {
    // Update all slider values
    this.setSliderValue('modern-side-mouth', this.currentGeometry.side.mouthWidth);
    this.setSliderValue('modern-side-throat', this.currentGeometry.side.throatWidth);
    this.setSliderValue('modern-side-rail-depth', this.currentGeometry.side.railDepth);
    this.setSliderValue('modern-side-jaw-depth', this.currentGeometry.side.jawDepth);
    this.setSliderValue('modern-side-rail-curve', this.currentGeometry.side.railCurve ?? 0);

    this.setSliderValue('modern-corner-mouth', this.currentGeometry.corner.mouthWidth);
    this.setSliderValue('modern-corner-throat', this.currentGeometry.corner.throatWidth);
    this.setSliderValue('modern-corner-rail-depth', this.currentGeometry.corner.railDepth);
    this.setSliderValue('modern-corner-jaw-depth', this.currentGeometry.corner.jawDepth);
    this.setSliderValue('modern-corner-shelf-depth', this.currentGeometry.corner.shelfDepth);

    this.setSliderValue('modern-global-side-pocket-offset', this.currentGeometry.global?.sidePocketOffset ?? 0.25);

    this.validateAndUpdateUI();
  }

  private setSliderValue(id: string, value: number) {
    const slider = document.getElementById(id) as HTMLInputElement | null;
    const label = document.getElementById(`${id}-val`);

    if (slider) {
      slider.value = value.toString();
    }
    if (label) {
      const digits = id.includes('angle') ? 1 : 2;
      label.textContent = formatNumber(value, digits);
    }
  }

  private validateAndUpdateUI() {
    const validation = validateModernGeometry(this.currentGeometry);
    const validationDiv = document.getElementById('modern-geometry-validation');

    // Update jaw angle displays
    const sideJawAngle = calculateJawAngle(this.currentGeometry.side);
    const cornerJawAngle = calculateJawAngle(this.currentGeometry.corner);

    const sideAngleDisplay = document.getElementById('modern-side-jaw-angle-display');
    if (sideAngleDisplay) {
      sideAngleDisplay.textContent = `Calculated jaw angle: ${sideJawAngle.toFixed(1)}°`;
    }

    const cornerAngleDisplay = document.getElementById('modern-corner-jaw-angle-display');
    if (cornerAngleDisplay) {
      cornerAngleDisplay.textContent = `Calculated jaw angle: ${cornerJawAngle.toFixed(1)}°`;
    }

    if (!validationDiv) return;

    if (validation.valid && validation.warnings.length === 0) {
      validationDiv.innerHTML = '<span style="color: #4caf50;">✓ Geometry valid</span>';
    } else if (validation.valid && validation.warnings.length > 0) {
      validationDiv.innerHTML = `
        <span style="color: #ff9800;">⚠ Warnings:</span>
        <ul style="margin: 0.25rem 0; padding-left: 1.5rem; font-size: 0.7rem;">
          ${validation.warnings.map(w => `<li>${w}</li>`).join('')}
        </ul>
      `;
    } else {
      validationDiv.innerHTML = `
        <span style="color: #f44336;">✗ Errors:</span>
        <ul style="margin: 0.25rem 0; padding-left: 1.5rem; font-size: 0.7rem;">
          ${validation.errors.map(e => `<li>${e}</li>`).join('')}
        </ul>
      `;
    }
  }

  private applyGeometry() {
    const validation = validateModernGeometry(this.currentGeometry);

    if (!validation.valid) {
      alert('Cannot apply geometry: ' + validation.errors.join(', '));
      return;
    }

    console.log('[ModernGeometry] Applying geometry:', {
      side: {
        mouthWidth: this.currentGeometry.side.mouthWidth,
        throatWidth: this.currentGeometry.side.throatWidth,
        railDepth: this.currentGeometry.side.railDepth,
        jawDepth: this.currentGeometry.side.jawDepth,
      },
      corner: {
        mouthWidth: this.currentGeometry.corner.mouthWidth,
        throatWidth: this.currentGeometry.corner.throatWidth,
        railDepth: this.currentGeometry.corner.railDepth,
        jawDepth: this.currentGeometry.corner.jawDepth,
      },
    });

    // Convert modern geometry to legacy CONFIG parameters
    const legacy = modernToLegacy(this.currentGeometry);

    console.log('[ModernGeometry] Converted to legacy:', {
      SIDE_JAW_OUTER_OVERRIDE_IN: legacy.SIDE_JAW_OUTER_OVERRIDE_IN,
      SIDE_JAW_INNER_OVERRIDE_IN: legacy.SIDE_JAW_INNER_OVERRIDE_IN,
      SIDE_STRAIGHT_Y_IN: legacy.SIDE_STRAIGHT_Y_IN,
      SIDE_INNER_Y_IN: legacy.SIDE_INNER_Y_IN,
    });

    // Apply to CONFIG
    applyLegacyGeometry(legacy);

    // Notify of geometry change
    this.onGeometryChange();

    // Show success message
    const validationDiv = document.getElementById('modern-geometry-validation');
    if (validationDiv) {
      validationDiv.innerHTML = '<span style="color: #4caf50;">✓ Applied to table!</span>';
      setTimeout(() => {
        this.validateAndUpdateUI();
      }, 2000);
    }
  }

  public open() {
    this.panelController.open();
  }

  public close() {
    this.panelController.close();
  }

  public toggle() {
    this.panelController.toggle();
  }

  public isOpen(): boolean {
    return this.panelController.isOpen();
  }

  public getController(): UIPanel {
    return this.panelController;
  }
}

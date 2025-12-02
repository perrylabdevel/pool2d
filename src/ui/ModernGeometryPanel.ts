/**
 * Modern Geometry Panel
 *
 * New angle-based UI for pocket geometry configuration.
 * Provides template selection and direct angle/opening controls.
 */

import { SettingsManager, GeometrySettings } from './SettingsManager';
import { UIPanel } from './panels/UIPanel';
import { bindSliders, type SliderBindConfig } from './controls/SliderBinder';
import {
  ModernPocketGeometry,
  PocketTemplate,
  GEOMETRY_TEMPLATES,
  getTemplateName,
  GEOMETRY_RANGES,
  validateModernGeometry,
} from '../geometry/ModernGeometry';
import { modernToLegacy, legacyToModern, getCurrentLegacyGeometry } from '../geometry/GeometryConversion';
import { calculateJawAngle } from '../geometry/ModernGeometryCalculator';

const formatNumber = (value: number, digits: number = 2): string =>
  value.toFixed(digits).replace(/\.0+$|\.([0-9]*[1-9])0+$/, '.$1').replace(/\.$/, '');

export class ModernGeometryPanel {
  private panel: HTMLElement;
  private panelController: UIPanel;
  private settingsManager: SettingsManager;
  private onGeometryChange: () => void;
  private currentGeometry: ModernPocketGeometry;
  private livePreviewEnabled: boolean = true;
  private isSyncing: boolean = false;

  constructor(settingsManager: SettingsManager, onGeometryChange: () => void) {
    this.settingsManager = settingsManager;
    this.onGeometryChange = onGeometryChange;

    this.currentGeometry = this.loadGeometryFromConfig();

    this.panel = this.createPanel();
    // Draggable disabled for docked modern panel

    const focusTarget = this.panel.querySelector<HTMLElement>('input, button, select');
    this.panelController = new UIPanel({
      id: 'modern-geometry-panel',
      element: this.panel,
      focusTarget,
    });

    this.setupControls();
    this.syncToUI();

    // Listen for external updates (e.g. from remote devtools or other sources)
    window.addEventListener('settings:modern-geometry-changed', () => {
      this.loadFromSettingsManager();
    });

    // Also listen for state-updated if using RemoteSettingsManager
    if (this.settingsManager instanceof EventTarget) {
      this.settingsManager.addEventListener('state-updated', () => {
        this.loadFromSettingsManager();
      });
    }
  }

  /** Reload geometry from settings manager (for external sync) */
  private loadFromSettingsManager() {
    if (this.isSyncing) return; // Prevent recursive sync
    const savedModern = this.settingsManager.getModernGeometrySettings();
    if (savedModern) {
      this.isSyncing = true;
      this.currentGeometry = this.normalizeGeometry({
        template: savedModern.template ?? PocketTemplate.CUSTOM,
        side: { ...savedModern.side },
        corner: { ...savedModern.corner },
        global: savedModern.global ? { ...savedModern.global } : undefined,
      });
      this.syncToUI();
      this.isSyncing = false;
    }
  }

  private loadGeometryFromConfig(): ModernPocketGeometry {
    const savedModern = this.settingsManager.getModernGeometrySettings();
    if (savedModern) {
      return this.normalizeGeometry({
        template: savedModern.template ?? PocketTemplate.CUSTOM,
        side: { ...savedModern.side },
        corner: { ...savedModern.corner },
        global: savedModern.global ? { ...savedModern.global } : undefined,
      });
    }

    try {
      const legacy = getCurrentLegacyGeometry();
      const converted = legacyToModern(legacy);
      return this.normalizeGeometry({
        template: converted.template ?? PocketTemplate.CUSTOM,
        side: { ...converted.side },
        corner: { ...converted.corner },
        global: converted.global ? { ...converted.global } : undefined,
      });
    } catch (error) {
      console.warn('[ModernGeometry] Failed to load geometry from config, using default template', error);
      const fallback = GEOMETRY_TEMPLATES[PocketTemplate.BCA_TOURNAMENT_MEDIUM];
      return this.normalizeGeometry({
        template: fallback.template,
        side: { ...fallback.side },
        corner: { ...fallback.corner },
        global: fallback.global ? { ...fallback.global } : undefined,
      });
    }
  }

  private clampToRange(value: number | undefined, range: { min: number; max: number; typical: number }): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return Math.min(range.max, Math.max(range.min, value));
    }
    const fallback = Number.isFinite(range.typical) ? range.typical : range.min;
    return Math.min(range.max, Math.max(range.min, fallback));
  }

  private normalizeGeometry(geometry: ModernPocketGeometry): ModernPocketGeometry {
    const normalizedSide = {
      mouthWidth: this.clampToRange(geometry.side.mouthWidth, GEOMETRY_RANGES.side.mouthWidth),
      throatWidth: this.clampToRange(geometry.side.throatWidth, GEOMETRY_RANGES.side.throatWidth),
      railDepth: this.clampToRange(geometry.side.railDepth, GEOMETRY_RANGES.side.railDepth),
      jawDepth: this.clampToRange(geometry.side.jawDepth, GEOMETRY_RANGES.side.jawDepth),
      shelfDepth: this.clampToRange(geometry.side.shelfDepth, GEOMETRY_RANGES.side.shelfDepth),
      railCurve: this.clampToRange(geometry.side.railCurve ?? GEOMETRY_RANGES.side.railCurve.min, GEOMETRY_RANGES.side.railCurve),
    };

    const normalizedCorner = {
      mouthWidth: this.clampToRange(geometry.corner.mouthWidth, GEOMETRY_RANGES.corner.mouthWidth),
      throatWidth: this.clampToRange(geometry.corner.throatWidth, GEOMETRY_RANGES.corner.throatWidth),
      railDepth: this.clampToRange(geometry.corner.railDepth, GEOMETRY_RANGES.corner.railDepth),
      jawDepth: this.clampToRange(geometry.corner.jawDepth, GEOMETRY_RANGES.corner.jawDepth),
      shelfDepth: this.clampToRange(geometry.corner.shelfDepth, GEOMETRY_RANGES.corner.shelfDepth),
      railCurve: this.clampToRange(geometry.corner.railCurve ?? GEOMETRY_RANGES.corner.railCurve.min, GEOMETRY_RANGES.corner.railCurve),
    };

    const normalizedGlobal = geometry.global ? { ...geometry.global } : undefined;
    if (normalizedGlobal) {
      if (normalizedGlobal.cutAngleAdjust !== undefined) {
        normalizedGlobal.cutAngleAdjust = this.clampToRange(
          normalizedGlobal.cutAngleAdjust,
          GEOMETRY_RANGES.global.cutAngleAdjust
        );
      }
      if (normalizedGlobal.verticalAngle !== undefined) {
        normalizedGlobal.verticalAngle = this.clampToRange(
          normalizedGlobal.verticalAngle,
          GEOMETRY_RANGES.global.verticalAngle
        );
      }
      if (normalizedGlobal.sidePocketOffset !== undefined) {
        normalizedGlobal.sidePocketOffset = this.clampToRange(
          normalizedGlobal.sidePocketOffset,
          GEOMETRY_RANGES.global.sidePocketOffset
        );
      }
      if (normalizedGlobal.cornerPocketOffset !== undefined) {
        normalizedGlobal.cornerPocketOffset = this.clampToRange(
          normalizedGlobal.cornerPocketOffset,
          GEOMETRY_RANGES.global.cornerPocketOffset
        );
      }
    }

    const cleanedGlobal =
      normalizedGlobal && Object.keys(normalizedGlobal).length > 0 ? normalizedGlobal : undefined;

    return {
      template: geometry.template ?? PocketTemplate.CUSTOM,
      side: normalizedSide,
      corner: normalizedCorner,
      global: cleanedGlobal,
    };
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
        ${this.sliderRow(
          'modern-side-shelf-depth',
          'Shelf Depth (in)',
          ranges.shelfDepth.min,
          ranges.shelfDepth.max,
          0.05,
          ranges.shelfDepth.typical
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
        ${this.sliderRow(
          'modern-global-corner-pocket-offset',
          'Corner Pocket Offset (in)',
          ranges.cornerPocketOffset.min,
          ranges.cornerPocketOffset.max,
          0.05,
          ranges.cornerPocketOffset.typical
        )}
      </div>
    `;
  }

  private generateActions(): string {
    return `
      <div class="settings-group">
        <div class="input-group" style="margin-bottom: 0.5rem;">
          <label style="display: flex; align-items: center; cursor: pointer;">
            <input type="checkbox" id="modern-geometry-live-preview" checked style="margin-right: 0.5rem;">
            <span style="font-size: 0.85rem;">Live Preview (apply as you drag)</span>
          </label>
        </div>
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

    // Live preview checkbox
    const livePreviewCheckbox = document.getElementById('modern-geometry-live-preview') as HTMLInputElement;
    if (livePreviewCheckbox) {
      livePreviewCheckbox.addEventListener('change', () => {
        this.livePreviewEnabled = livePreviewCheckbox.checked;
        console.log('[ModernGeometry] Live preview:', this.livePreviewEnabled ? 'enabled' : 'disabled');
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
      {
        sliderId: 'modern-side-shelf-depth',
        labelId: 'modern-side-shelf-depth-val',
        onChange: (v) => {
          this.currentGeometry.side.shelfDepth = v!;
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
      {
        sliderId: 'modern-global-corner-pocket-offset',
        labelId: 'modern-global-corner-pocket-offset-val',
        onChange: (v) => {
          if (!this.currentGeometry.global) {
            this.currentGeometry.global = {} as any;
          }
          (this.currentGeometry.global as any).cornerPocketOffset = v!;
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
    this.currentGeometry = this.normalizeGeometry({
      template: templateData.template,
      side: { ...templateData.side },
      corner: { ...templateData.corner },
      global: templateData.global ? { ...templateData.global } : undefined,
    });
    this.syncToUI();
    this.validateAndUpdateUI();
  }

  private syncToUI() {
    const templateSelect = document.getElementById('modern-geometry-template') as HTMLSelectElement | null;
    if (templateSelect) {
      const templateValue = this.currentGeometry.template ?? PocketTemplate.CUSTOM;
      templateSelect.value = templateValue;
    }

    // Update all slider values
    this.setSliderValue('modern-side-mouth', this.currentGeometry.side.mouthWidth);
    this.setSliderValue('modern-side-throat', this.currentGeometry.side.throatWidth);
    this.setSliderValue('modern-side-rail-depth', this.currentGeometry.side.railDepth);
    this.setSliderValue('modern-side-jaw-depth', this.currentGeometry.side.jawDepth);
    this.setSliderValue('modern-side-rail-curve', this.currentGeometry.side.railCurve ?? 0);
    this.setSliderValue('modern-side-shelf-depth', this.currentGeometry.side.shelfDepth);

    this.setSliderValue('modern-corner-mouth', this.currentGeometry.corner.mouthWidth);
    this.setSliderValue('modern-corner-throat', this.currentGeometry.corner.throatWidth);
    this.setSliderValue('modern-corner-rail-depth', this.currentGeometry.corner.railDepth);
    this.setSliderValue('modern-corner-jaw-depth', this.currentGeometry.corner.jawDepth);
    this.setSliderValue('modern-corner-shelf-depth', this.currentGeometry.corner.shelfDepth);

    this.setSliderValue('modern-global-side-pocket-offset', this.currentGeometry.global?.sidePocketOffset ?? 0.25);
    this.setSliderValue('modern-global-corner-pocket-offset', (this.currentGeometry.global as any)?.cornerPocketOffset ?? 0.0);

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
    this.currentGeometry = this.normalizeGeometry(this.currentGeometry);
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

    // Apply geometry immediately if live preview is enabled (skip if syncing from external source)
    if (this.livePreviewEnabled && validation.valid && !this.isSyncing) {
      const legacy = modernToLegacy(this.currentGeometry);
      this.settingsManager.saveGeometrySettings(legacy as Partial<GeometrySettings>);
      this.settingsManager.saveModernGeometrySettings(this.currentGeometry);
      this.onGeometryChange();
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

    // Convert modern geometry to legacy parameters and persist via settings manager
    const legacy = modernToLegacy(this.currentGeometry);
    console.log('[ModernGeometry] Converted to legacy:', legacy);
    this.settingsManager.saveGeometrySettings(legacy as Partial<GeometrySettings>);
    this.settingsManager.saveModernGeometrySettings(this.currentGeometry);

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

import { UIPanel } from './panels/UIPanel';
import { bindSliders, formatNumber, type SliderBindConfig } from './controls/SliderBinder';
import type { ModernPocketGeometry } from '../geometry/ModernGeometry';
import { modernToLegacy, legacyToModern, type LegacyGeometry } from '../geometry/GeometryConversion';
import type { GeometrySettings } from './SettingsManager';
import { SettingsManager } from './SettingsManager';

export class PocketTuningPanel {
  private controller: UIPanel;
  private currentGeometry: ModernPocketGeometry;
  private livePreview = true;
  private settings: SettingsManager;
  private onGeometryChange: () => void;

  constructor(settingsManager: SettingsManager, onGeometryChange: () => void) {
    this.settings = settingsManager;
    this.onGeometryChange = onGeometryChange;
    this.currentGeometry = this.readModernGeometryFromSettings();
    const panel = this.ensurePanel();
    this.controller = new UIPanel({ id: 'pocket-tuning-panel', element: panel });
    this.bindControls();
    this.syncFromSettings();
  }

  getController(): UIPanel {
    return this.controller;
  }

  open() {
    this.controller.open();
  }

  toggle() {
    this.controller.toggle();
  }

  private ensurePanel(): HTMLElement {
    let panel = document.getElementById('pocket-tuning-panel') as HTMLElement | null;
    if (panel) return panel;
    const dock = document.getElementById('panel-dock');
    panel = document.createElement('div');
    panel.id = 'pocket-tuning-panel';
    panel.className = 'panel-dock-card hidden';
    panel.innerHTML = `
      <div class="panel-header">
        <h3>🕳 Pocket Tuner</h3>
      </div>
      <div class="panel-content">
        <div class="settings-group">
          <h4 class="settings-group-title">📍 Side Pockets</h4>
          ${this.sliderRow('pt-side-mouth', 'Mouth Width (in)', 3.0, 12.0, 0.05)}
          ${this.sliderRow('pt-side-throat', 'Throat Width (in)', 3.0, 11.0, 0.05)}
          ${this.sliderRow('pt-side-rail-depth', 'Rail Depth (in)', 0.5, 3.0, 0.05)}
          ${this.sliderRow('pt-side-jaw-depth', 'Jaw Depth (in)', 0.5, 4.0, 0.05)}
          ${this.sliderRow('pt-side-shelf-depth', 'Shelf Depth (in)', 0.0, 1.0, 0.05)}
          ${this.sliderRow('pt-side-rail-curve', 'Rail Curvature', 0.0, 1.0, 0.05)}
          ${this.sliderRow('pt-side-capture', 'Capture Radius (in)', 1.5, 4.0, 0.05)}
          ${this.sliderRow('pt-side-visual', 'Visual Radius (in)', 1.5, 4.0, 0.05)}
        </div>

        <div class="settings-group">
          <h4 class="settings-group-title">📐 Corner Pockets</h4>
          ${this.sliderRow('pt-corner-mouth', 'Mouth Width (in)', 4.0, 10.0, 0.05)}
          ${this.sliderRow('pt-corner-throat', 'Throat Width (in)', 3.0, 9.0, 0.05)}
          ${this.sliderRow('pt-corner-rail-depth', 'Rail Depth (in)', 1.0, 3.0, 0.05)}
          ${this.sliderRow('pt-corner-jaw-depth', 'Jaw Depth (in)', 0.5, 4.0, 0.05)}
          ${this.sliderRow('pt-corner-shelf-depth', 'Shelf Depth (in)', 1.0, 3.0, 0.05)}
          ${this.sliderRow('pt-corner-capture', 'Capture Radius (in)', 1.5, 4.0, 0.05)}
          ${this.sliderRow('pt-corner-visual', 'Visual Radius (in)', 1.5, 4.0, 0.05)}
        </div>

        <div class="settings-group">
          <h4 class="settings-group-title">🌐 Global Offsets</h4>
          ${this.sliderRow('pt-side-offset', 'Side Pocket Offset (in)', 0.0, 1.5, 0.05)}
          ${this.sliderRow('pt-corner-offset', 'Corner Pocket Offset (in)', -1.0, 1.5, 0.05)}
        </div>

        <div class="settings-group">
          <label style="display:flex; gap:8px; align-items:center; cursor:pointer;">
            <input type="checkbox" id="pt-live-preview" checked />
            <span>Live Preview (apply as you drag)</span>
          </label>
          <div class="panel-actions" style="margin-top: 0.5rem; display:flex; gap:8px;">
            <button id="pt-apply" class="panel-btn">Apply</button>
            <button id="pt-reset-visual" class="panel-mini-btn">Reset Visual Radii</button>
          </div>
        </div>
      </div>
    `;
    (dock ?? document.body).appendChild(panel);
    return panel;
  }

  private sliderRow(id: string, label: string, min: number, max: number, step: number): string {
    return `
      <div class="slider-group">
        <label for="${id}">
          ${label}: <span id="${id}-val">0</span>
        </label>
        <input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="0" />
      </div>
    `;
  }

  private bindControls() {
    const live = document.getElementById('pt-live-preview') as HTMLInputElement | null;
    if (live) {
      this.livePreview = live.checked;
      live.addEventListener('change', () => (this.livePreview = live.checked));
    }
    const applyBtn = document.getElementById('pt-apply');
    if (applyBtn) {
      applyBtn.addEventListener('click', () => this.applyNow());
    }
    const resetVisual = document.getElementById('pt-reset-visual');
    if (resetVisual) {
      resetVisual.addEventListener('click', () => this.resetVisualRadii());
    }

    const sliders: SliderBindConfig[] = [
      // Side
      { sliderId: 'pt-side-mouth', labelId: 'pt-side-mouth-val', onChange: (v) => this.update(({ side }) => (side.mouthWidth = v!)) },
      { sliderId: 'pt-side-throat', labelId: 'pt-side-throat-val', onChange: (v) => this.update(({ side }) => (side.throatWidth = v!)) },
      { sliderId: 'pt-side-rail-depth', labelId: 'pt-side-rail-depth-val', onChange: (v) => this.update(({ side }) => (side.railDepth = v!)) },
      { sliderId: 'pt-side-jaw-depth', labelId: 'pt-side-jaw-depth-val', onChange: (v) => this.update(({ side }) => (side.jawDepth = v!)) },
      { sliderId: 'pt-side-shelf-depth', labelId: 'pt-side-shelf-depth-val', onChange: (v) => this.update(({ side }) => (side.shelfDepth = v!)) },
      { sliderId: 'pt-side-rail-curve', labelId: 'pt-side-rail-curve-val', onChange: (v) => this.update(({ side }) => (side.railCurve = v!)) },

      // Corner
      { sliderId: 'pt-corner-mouth', labelId: 'pt-corner-mouth-val', onChange: (v) => this.update(({ corner }) => (corner.mouthWidth = v!)) },
      { sliderId: 'pt-corner-throat', labelId: 'pt-corner-throat-val', onChange: (v) => this.update(({ corner }) => (corner.throatWidth = v!)) },
      { sliderId: 'pt-corner-rail-depth', labelId: 'pt-corner-rail-depth-val', onChange: (v) => this.update(({ corner }) => (corner.railDepth = v!)) },
      { sliderId: 'pt-corner-jaw-depth', labelId: 'pt-corner-jaw-depth-val', onChange: (v) => this.update(({ corner }) => (corner.jawDepth = v!)) },
      { sliderId: 'pt-corner-shelf-depth', labelId: 'pt-corner-shelf-depth-val', onChange: (v) => this.update(({ corner }) => (corner.shelfDepth = v!)) },

      // Global offsets
      { sliderId: 'pt-side-offset', labelId: 'pt-side-offset-val', onChange: (v) => this.updateGlobal('sidePocketOffset', v!) },
      { sliderId: 'pt-corner-offset', labelId: 'pt-corner-offset-val', onChange: (v) => this.updateGlobal('cornerPocketOffset', v!) },
    ];

    // Bind non-modern visual/capture radii separately (they live in geometry settings)
    const visualAndCapture: SliderBindConfig[] = [
      { sliderId: 'pt-side-capture', labelId: 'pt-side-capture-val', onChange: (v) => this.updateRadii('SIDE_POCKET_CAPTURE_RADIUS_IN', v!) },
      { sliderId: 'pt-side-visual', labelId: 'pt-side-visual-val', onChange: (v) => this.updateRadii('SIDE_POCKET_VISUAL_RADIUS_IN', v!) },
      { sliderId: 'pt-corner-capture', labelId: 'pt-corner-capture-val', onChange: (v) => this.updateRadii('CORNER_POCKET_CAPTURE_RADIUS_IN', v!) },
      { sliderId: 'pt-corner-visual', labelId: 'pt-corner-visual-val', onChange: (v) => this.updateRadii('CORNER_POCKET_VISUAL_RADIUS_IN', v!) },
    ];

    bindSliders([...sliders, ...visualAndCapture]);
  }

  private readModernGeometryFromSettings(): ModernPocketGeometry {
    const g = this.settings.getGeometrySettings();
    // Cast to LegacyGeometry (it is superset)
    return legacyToModern(g as unknown as LegacyGeometry);
  }

  private syncFromSettings() {
    this.currentGeometry = this.readModernGeometryFromSettings();
    const gs = this.settings.getGeometrySettings();

    // Side
    this.setSlider('pt-side-mouth', this.currentGeometry.side.mouthWidth);
    this.setSlider('pt-side-throat', this.currentGeometry.side.throatWidth);
    this.setSlider('pt-side-rail-depth', this.currentGeometry.side.railDepth);
    this.setSlider('pt-side-jaw-depth', this.currentGeometry.side.jawDepth);
    this.setSlider('pt-side-shelf-depth', (this.currentGeometry.side.shelfDepth));
    this.setSlider('pt-side-rail-curve', this.currentGeometry.side.railCurve ?? 0);
    this.setSlider('pt-side-capture', gs.SIDE_POCKET_CAPTURE_RADIUS_IN);
    this.setSlider('pt-side-visual', gs.SIDE_POCKET_VISUAL_RADIUS_IN);

    // Corner
    this.setSlider('pt-corner-mouth', this.currentGeometry.corner.mouthWidth);
    this.setSlider('pt-corner-throat', this.currentGeometry.corner.throatWidth);
    this.setSlider('pt-corner-rail-depth', this.currentGeometry.corner.railDepth);
    this.setSlider('pt-corner-jaw-depth', this.currentGeometry.corner.jawDepth);
    this.setSlider('pt-corner-shelf-depth', this.currentGeometry.corner.shelfDepth);
    this.setSlider('pt-corner-capture', gs.CORNER_POCKET_CAPTURE_RADIUS_IN);
    this.setSlider('pt-corner-visual', gs.CORNER_POCKET_VISUAL_RADIUS_IN);

    // Global
    this.setSlider('pt-side-offset', (this.currentGeometry.global?.sidePocketOffset ?? 0.25));
    this.setSlider('pt-corner-offset', (this.currentGeometry.global as any)?.cornerPocketOffset ?? 0.0);
  }

  private setSlider(id: string, value: number) {
    const slider = document.getElementById(id) as HTMLInputElement | null;
    const label = document.getElementById(`${id}-val`);
    if (!slider || !label) return;
    slider.value = value.toString();
    const digits = id.includes('curve') ? 2 : 2;
    label.textContent = formatNumber(value, digits);
  }

  private update(mutator: (g: ModernPocketGeometry) => void) {
    mutator(this.currentGeometry);
    if (this.livePreview) this.applyNow();
  }

  private updateGlobal(key: 'sidePocketOffset' | 'cornerPocketOffset', value: number) {
    if (!this.currentGeometry.global) this.currentGeometry.global = {};
    (this.currentGeometry.global as any)[key] = value;
    if (this.livePreview) this.applyNow();
  }

  private updateRadii(key: keyof GeometrySettings, value: number) {
    // Do not recompute legacy mapping here to avoid clobbering unrelated geometry
    const patch: Partial<GeometrySettings> = { [key]: value } as any;
    this.settings.saveGeometrySettings(patch);
    if (this.livePreview) this.onGeometryChange();
  }

  private applyNow() {
    const legacy = modernToLegacy(this.currentGeometry);
    this.settings.saveGeometrySettings(legacy as Partial<GeometrySettings>);
    this.settings.saveModernGeometrySettings(this.currentGeometry);
    this.onGeometryChange();
  }

  private resetVisualRadii() {
    const gs = this.settings.getGeometrySettings();
    const patch: Partial<GeometrySettings> = {
      SIDE_POCKET_VISUAL_RADIUS_IN: 2.5,
      CORNER_POCKET_VISUAL_RADIUS_IN: 2.5,
      SIDE_POCKET_CAPTURE_RADIUS_IN: gs.SIDE_POCKET_CAPTURE_RADIUS_IN,
      CORNER_POCKET_CAPTURE_RADIUS_IN: gs.CORNER_POCKET_CAPTURE_RADIUS_IN,
    };
    const legacy = modernToLegacy(this.currentGeometry);
    this.settings.saveGeometrySettings({ ...legacy, ...patch });
    this.settings.saveModernGeometrySettings(this.currentGeometry);
    this.syncFromSettings();
    this.onGeometryChange();
  }
}

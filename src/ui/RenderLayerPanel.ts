import { Renderer3D } from '../render/Renderer3D';
import { makePanelDraggable } from './drag';
import { SettingsManager, RenderSettings } from './SettingsManager';
import { UIPanel } from './panels/UIPanel';
import {
  RenderLayerSettings,
  RenderLayerBooleanKey,
  RenderLayerOrderKey,
  defaultRenderLayerSettings,
} from '../render/RenderLayers';
import { bindSliders, type SliderBindConfig } from './controls/SliderBinder';

const LAYER_CHECKBOX_MAP: Record<string, RenderLayerBooleanKey> = {
  'layer-table': 'showTable',
  'layer-frame': 'showFrame',
  'layer-skin': 'showSkin',
  'layer-rails': 'showRails',
  'layer-pockets': 'showPockets',
  'layer-caps': 'showCaps',
  'layer-balls': 'showBalls',
  'layer-ui': 'showUIOverlay',
  'layer-measure': 'showMeasurementOverlay',
  'layer-reference': 'showReferenceOverlay',
  'layer-textures': 'showTextures',
};

export class RenderLayerPanel {
  private panel: HTMLElement;
  private panelController: UIPanel;
  private settings: RenderSettings;
  private lightingBinders = new Map<string, any>();
  private orderInputs: Partial<Record<RenderLayerOrderKey, HTMLInputElement>> = {};

  constructor(
    private settingsManager: SettingsManager,
    private renderer: Renderer3D
  ) {
    this.panel = this.ensurePanelElement();
    const header = this.panel.querySelector('.panel-header') as HTMLElement | null;
    if (header && !this.panel.closest('#panel-dock')) {
      makePanelDraggable(this.panel, header);
    }

    const focusTarget = this.panel.querySelector<HTMLElement>('input, button');
    this.panelController = new UIPanel({
      id: 'render-layer-panel',
      element: this.panel,
      focusTarget,
    });
    this.panelController.addEventListener('panel:open', () => this.syncUI());

    this.settings = this.settingsManager.getRenderSettings();
    this.applyToRenderer(this.settings);
    this.bindControls();
    this.syncUI();

    window.addEventListener('settings:render-changed', (event: Event) => {
      const detail = (event as CustomEvent<{ settings: RenderSettings }>).detail;
      if (!detail) return;
      this.settings = { ...detail.settings };
      this.applyToRenderer(this.settings);
      this.syncUI();
    });

    // Also listen for state-updated if using RemoteSettingsManager (for remote devtools sync)
    if (this.settingsManager instanceof EventTarget) {
      this.settingsManager.addEventListener('state-updated', () => {
        this.settings = this.settingsManager.getRenderSettings();
        this.applyToRenderer(this.settings);
        this.syncUI();
      });
    }
  }

  private ensurePanelElement(): HTMLElement {
    const existing = document.getElementById('render-layer-panel');
    if (existing) return existing as HTMLElement;

    const panel = document.createElement('div');
    panel.id = 'render-layer-panel';
    panel.className = 'panel-dock-card hidden';
    panel.innerHTML = `
      <div class="panel-header">
        <h3>Render Layers</h3>
      </div>
      <div class="panel-content">
        <div class="settings-group">
          <h4 class="settings-group-title">Visibility</h4>
          <div class="panel-toggle-list">
            <label class="panel-toggle-row" for="layer-table"><input id="layer-table" type="checkbox" checked /><span>Table</span></label>
            <label class="panel-toggle-row" for="layer-frame"><input id="layer-frame" type="checkbox" checked /><span>Frame</span></label>
            <label class="panel-toggle-row" for="layer-skin"><input id="layer-skin" type="checkbox" checked /><span>Skin</span></label>
            <label class="panel-toggle-row" for="layer-rails"><input id="layer-rails" type="checkbox" checked /><span>Rails</span></label>
            <label class="panel-toggle-row" for="layer-pockets"><input id="layer-pockets" type="checkbox" checked /><span>Pockets</span></label>
            <label class="panel-toggle-row" for="layer-caps"><input id="layer-caps" type="checkbox" checked /><span>Caps</span></label>
            <label class="panel-toggle-row" for="layer-balls"><input id="layer-balls" type="checkbox" checked /><span>Balls</span></label>
            <label class="panel-toggle-row" for="layer-ui"><input id="layer-ui" type="checkbox" checked /><span>UI Overlay</span></label>
            <label class="panel-toggle-row" for="layer-measure"><input id="layer-measure" type="checkbox" /><span>Measurement Overlay</span></label>
            <label class="panel-toggle-row" for="layer-reference"><input id="layer-reference" type="checkbox" /><span>Reference Overlay</span></label>
            <label class="panel-toggle-row" for="layer-textures"><input id="layer-textures" type="checkbox" checked /><span>Textures</span></label>
          </div>
        </div>

        <div class="settings-group">
          <h4 class="settings-group-title">Skin</h4>
          <div class="slider-group"><label class="slider-label" for="skin-opacity"><span class="slider-title">Opacity</span><span class="slider-value" id="skin-opacity-value">1.00</span></label><input type="range" id="skin-opacity" min="0" max="1" step="0.01" value="1.00" /></div>
        </div>

        <div class="settings-group">
          <h4 class="settings-group-title">Render Order</h4>
          <div class="panel-order-list">
            <label class="panel-order-row" for="order-table"><span>Table</span><input id="order-table" type="number" value="0" step="1" min="-1000" max="2000" /></label>
            <label class="panel-order-row" for="order-frame"><span>Frame</span><input id="order-frame" type="number" value="5" step="1" min="-1000" max="2000" /></label>
            <label class="panel-order-row" for="order-rails"><span>Rails</span><input id="order-rails" type="number" value="10" step="1" min="-1000" max="2000" /></label>
            <label class="panel-order-row" for="order-pockets"><span>Pockets</span><input id="order-pockets" type="number" value="20" step="1" min="-1000" max="2000" /></label>
            <label class="panel-order-row" for="order-caps"><span>Caps</span><input id="order-caps" type="number" value="25" step="1" min="-1000" max="2000" /></label>
            <label class="panel-order-row" for="order-balls"><span>Balls</span><input id="order-balls" type="number" value="30" step="1" min="-1000" max="2000" /></label>
            <label class="panel-order-row" for="order-ui"><span>UI Overlay</span><input id="order-ui" type="number" value="40" step="1" min="-1000" max="2000" /></label>
          </div>
        </div>

        <div class="settings-group">
          <h4 class="settings-group-title">Lighting</h4>
          <div class="slider-group"><label class="slider-label" for="lighting-ambient"><span class="slider-title">Ambient Light</span><span class="slider-value" id="lighting-ambient-value">1.10</span></label><input type="range" id="lighting-ambient" min="0" max="3" step="0.05" value="1.1" /></div>
          <div class="slider-group"><label class="slider-label" for="lighting-directional"><span class="slider-title">Key Light</span><span class="slider-value" id="lighting-directional-value">1.60</span></label><input type="range" id="lighting-directional" min="0" max="3" step="0.05" value="1.6" /></div>
          <div class="slider-group"><label class="slider-label" for="lighting-accent"><span class="slider-title">Accent Spot</span><span class="slider-value" id="lighting-accent-value">0.50</span></label><input type="range" id="lighting-accent" min="0" max="3" step="0.05" value="0.5" /></div>
          <div class="slider-group"><label class="slider-label" for="lighting-rail-highlight"><span class="slider-title">Rail Highlight</span><span class="slider-value" id="lighting-rail-highlight-value">0.60</span></label><input type="range" id="lighting-rail-highlight" min="0" max="1.5" step="0.05" value="0.6" /></div>
          <div class="slider-group"><label class="slider-label" for="lighting-rail-shadow"><span class="slider-title">Rail Shadow</span><span class="slider-value" id="lighting-rail-shadow-value">0.25</span></label><input type="range" id="lighting-rail-shadow" min="0" max="1.5" step="0.05" value="0.25" /></div>
          <div class="slider-group"><label class="slider-label" for="lighting-rail-shadow-base"><span class="slider-title">Rail Shadow Near-Edge</span><span class="slider-value" id="lighting-rail-shadow-base-value">170</span></label><input type="range" id="lighting-rail-shadow-base" min="100" max="240" step="1" value="170" /></div>
          <div class="slider-group"><label class="slider-label" for="lighting-rail-shadow-spread"><span class="slider-title">Rail Shadow Spread</span><span class="slider-value" id="lighting-rail-shadow-spread-value">1.00</span></label><input type="range" id="lighting-rail-shadow-spread" min="0.5" max="10" step="0.1" value="1.00" /></div>
          <div class="slider-group"><label class="slider-label" for="lighting-rail-shadow-softness"><span class="slider-title">Rail Shadow Softness</span><span class="slider-value" id="lighting-rail-shadow-softness-value">1.80</span></label><input type="range" id="lighting-rail-shadow-softness" min="0.5" max="3.0" step="0.05" value="1.80" /></div>
          <div class="slider-group"><label class="slider-label" for="lighting-rail-highlight-spread"><span class="slider-title">Rail Highlight Spread</span><span class="slider-value" id="lighting-rail-highlight-spread-value">1.00</span></label><input type="range" id="lighting-rail-highlight-spread" min="0.5" max="3.0" step="0.05" value="1.00" /></div>
          <div class="slider-group"><label class="slider-label" for="lighting-pocket-highlight"><span class="slider-title">Pocket Highlight</span><span class="slider-value" id="lighting-pocket-highlight-value">0.55</span></label><input type="range" id="lighting-pocket-highlight" min="0" max="1.5" step="0.05" value="0.55" /></div>
          <div class="slider-group"><label class="slider-label" for="lighting-pocket-shadow"><span class="slider-title">Pocket Shadow</span><span class="slider-value" id="lighting-pocket-shadow-value">0.45</span></label><input type="range" id="lighting-pocket-shadow" min="0" max="1.5" step="0.05" value="0.45" /></div>
        </div>

        <div class="settings-group">
          <h4 class="settings-group-title">Pocket Groove</h4>
          <div class="slider-group"><label class="slider-label" for="groove-inner-base"><span class="slider-title">Inner Radius Base</span><span class="slider-value" id="groove-inner-base-value">0.18</span></label><input type="range" id="groove-inner-base" min="0.05" max="0.5" step="0.01" value="0.18" /></div>
          <div class="slider-group"><label class="slider-label" for="groove-inner-depth"><span class="slider-title">Inner Radius Depth</span><span class="slider-value" id="groove-inner-depth-value">0.22</span></label><input type="range" id="groove-inner-depth" min="0.0" max="0.6" step="0.01" value="0.22" /></div>
          <div class="slider-group"><label class="slider-label" for="groove-thickness"><span class="slider-title">Groove Thickness</span><span class="slider-value" id="groove-thickness-value">0.08</span></label><input type="range" id="groove-thickness" min="0.01" max="0.2" step="0.005" value="0.08" /></div>
          <div class="slider-group"><label class="slider-label" for="groove-opacity-base"><span class="slider-title">Groove Opacity Base</span><span class="slider-value" id="groove-opacity-base-value">0.18</span></label><input type="range" id="groove-opacity-base" min="0.0" max="1.0" step="0.02" value="0.18" /></div>
          <div class="slider-group"><label class="slider-label" for="groove-opacity-depth"><span class="slider-title">Groove Opacity Depth</span><span class="slider-value" id="groove-opacity-depth-value">0.36</span></label><input type="range" id="groove-opacity-depth" min="0.0" max="1.0" step="0.02" value="0.36" /></div>
          <div class="slider-group"><label class="slider-label" for="groove-rim-thickness"><span class="slider-title">Rim Thickness</span><span class="slider-value" id="groove-rim-thickness-value">0.02</span></label><input type="range" id="groove-rim-thickness" min="0.005" max="0.08" step="0.005" value="0.02" /></div>
          <div class="slider-group"><label class="slider-label" for="groove-rim-outer-opacity"><span class="slider-title">Rim Outer Opacity</span><span class="slider-value" id="groove-rim-outer-opacity-value">0.10</span></label><input type="range" id="groove-rim-outer-opacity" min="0.0" max="0.5" step="0.02" value="0.10" /></div>
          <div class="slider-group"><label class="slider-label" for="groove-rim-inner-opacity"><span class="slider-title">Rim Inner Opacity</span><span class="slider-value" id="groove-rim-inner-opacity-value">0.08</span></label><input type="range" id="groove-rim-inner-opacity" min="0.0" max="0.5" step="0.02" value="0.08" /></div>
        </div>

        <div class="settings-group">
          <h4 class="settings-group-title">Pocket Shades</h4>
          <div class="slider-group"><label class="slider-label" for="groove-color"><span class="slider-title">Groove Color</span></label><input type="color" id="groove-color" value="#000000" style="height:28px; width:48px; padding:0; border:none; background:transparent;" /></div>
          <div class="slider-group"><label class="slider-label" for="groove-rim-color"><span class="slider-title">Rim Color</span></label><input type="color" id="groove-rim-color" value="#ffffff" style="height:28px; width:48px; padding:0; border:none; background:transparent;" /></div>
          <div class="slider-group"><label class="slider-label" for="pocket-bottom-color"><span class="slider-title">Bottom Fill</span></label><input type="color" id="pocket-bottom-color" value="#000000" style="height:28px; width:48px; padding:0; border:none; background:transparent;" /></div>
          <div class="slider-group"><label class="slider-label" for="pocket-gradient-center"><span class="slider-title">Gradient Center</span></label><input type="color" id="pocket-gradient-center" value="#000000" style="height:28px; width:48px; padding:0; border:none; background:transparent;" /></div>
          <div class="slider-group"><label class="slider-label" for="pocket-gradient-edge"><span class="slider-title">Gradient Edge</span></label><input type="color" id="pocket-gradient-edge" value="#141414" style="height:28px; width:48px; padding:0; border:none; background:transparent;" /></div>
          <div class="slider-group"><label class="slider-label" for="pocket-wall-color"><span class="slider-title">Wall Color</span></label><input type="color" id="pocket-wall-color" value="#0a0a0a" style="height:28px; width:48px; padding:0; border:none; background:transparent;" /></div>
          <div class="slider-group"><label class="slider-label" for="pocket-gradient-strength"><span class="slider-title">Gradient Strength</span><span class="slider-value" id="pocket-gradient-strength-value">1.00</span></label><input type="range" id="pocket-gradient-strength" min="0" max="1" step="0.01" value="1.00" /></div>
        </div>

        <div class="panel-actions">
          <button id="render-layer-reset" class="panel-btn">Reset Defaults</button>
          <button id="render-layer-regenerate-textures" class="panel-btn">Regenerate Textures</button>
          <button id="render-layer-sync" class="panel-btn">Sync From Scene</button>
        </div>
      </div>
    `;

    const dock = document.getElementById('panel-dock');
    (dock ?? document.body).appendChild(panel);
    return panel;
  }

  private bindControls() {
    const closeBtn = document.getElementById('render-layer-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }

    const syncBtn = document.getElementById('render-layer-sync');
    if (syncBtn) {
      syncBtn.addEventListener('click', () => {
        this.syncFromRenderer();
      });
    }

    const regenBtn = document.getElementById('render-layer-regenerate-textures');
    if (regenBtn) {
      regenBtn.addEventListener('click', () => {
        this.renderer.tableRenderer.regenerateTextures();
      });
    }

    Object.entries(LAYER_CHECKBOX_MAP).forEach(([id, key]) => {
      const checkbox = document.getElementById(id) as HTMLInputElement | null;
      if (!checkbox) return;
      checkbox.addEventListener('change', () => {
        this.updateSetting(key, checkbox.checked, { applyRenderer: true, save: true });
      });
    });

    const skinOpacitySlider = document.getElementById('skin-opacity') as HTMLInputElement | null;
    const skinOpacityLabel = document.getElementById('skin-opacity-value');
    const applySkinOpacity = () => {
      if (!skinOpacitySlider) return;
      const val = parseFloat(skinOpacitySlider.value);
      if (!Number.isFinite(val)) return;
      const clamped = Math.max(0, Math.min(1, val));
      this.settings.skinOpacity = clamped;
      this.settingsManager.saveRenderSettings({ skinOpacity: clamped } as Partial<RenderSettings>);
      this.renderer.setSkinOpacity(clamped);
      if (skinOpacityLabel) {
        skinOpacityLabel.textContent = clamped.toFixed(2);
      }
    };
    if (skinOpacitySlider) {
      skinOpacitySlider.addEventListener('input', applySkinOpacity);
      skinOpacitySlider.addEventListener('change', applySkinOpacity);
    }

    const resetBtn = document.getElementById('render-layer-reset');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.settingsManager.resetRenderSettings();
        this.settings = this.settingsManager.getRenderSettings();
        this.applyToRenderer(this.settings);
        this.syncUI();
      });
    }

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.panelController.isOpen()) {
        this.close();
      }
    });

    this.bindOrderControls();
    this.bindLightingControls();
  }

  private updateSetting(
    key: RenderLayerBooleanKey,
    value: boolean,
    options?: { applyRenderer?: boolean; save?: boolean }
  ) {
    const updated: RenderSettings = { ...this.settings, [key]: value } as RenderSettings;
    this.settings = updated;
    if (options?.save !== false) {
      this.settingsManager.saveRenderSettings({ [key]: value } as Partial<RenderSettings>);
    }
    if (options?.applyRenderer !== false) {
      this.applyToRenderer(updated);
    }
    this.syncCheckbox(key, value);
  }

  private applyToRenderer(settings: RenderSettings) {
    const {
      canvasScale,
      ballScale,
      skinOpacity,
      ambientIntensity,
      directionalIntensity,
      accentIntensity,
      railShadowSpread,
      railShadowSoftness,
      railShadowBaseGray,
      railHighlightSpread,
      railHighlightColor,
      ...layerSettings
    } = settings;
    void canvasScale;
    if (typeof ballScale === 'number') {
      this.renderer.setBallScale(ballScale);
    }
    if (typeof skinOpacity === 'number') {
      this.renderer.setSkinOpacity(skinOpacity);
    }
    this.renderer.applyRenderLayerSettings(layerSettings as RenderLayerSettings);
    this.renderer.setLightingIntensities({
      ambient: ambientIntensity,
      directional: directionalIntensity,
      accent: accentIntensity,
    });
    if (typeof railShadowSpread === 'number') this.renderer.setRailShadowSpread(railShadowSpread);
    if (typeof railShadowSoftness === 'number') this.renderer.setRailShadowSoftness(railShadowSoftness);
    if (typeof railShadowBaseGray === 'number') this.renderer.setRailShadowBaseGray(railShadowBaseGray);
    if (typeof railHighlightSpread === 'number') this.renderer.setRailHighlightSpread(railHighlightSpread);
    if (typeof railHighlightColor === 'string') this.renderer.setRailHighlightColor(railHighlightColor);
    this.renderer.setHighlightIntensities({
      rail: settings.railHighlightIntensity,
      railShadow: settings.railShadowIntensity,
      pocketHighlight: settings.pocketHighlightIntensity,
      pocketShadow: settings.pocketShadowIntensity,
    });

    // Apply groove geometry/opacity params
    this.renderer.setPocketGrooveSettings({
      innerBase: settings.grooveInnerBase,
      innerDepthScale: settings.grooveInnerDepthScale,
      thicknessFactor: settings.grooveThicknessFactor,
      opacityBase: settings.grooveOpacityBase,
      opacityDepthScale: settings.grooveOpacityDepthScale,
      rimThicknessFactor: settings.grooveRimThicknessFactor,
      rimOuterOpacity: settings.grooveRimOuterOpacity,
      rimInnerOpacity: settings.grooveRimInnerOpacity,
    });

    // Apply groove/pocket colors
    this.renderer.setPocketShadeColors({
      grooveColor: settings.grooveColor,
      rimColor: settings.rimColor,
      bottomColor: settings.pocketBottomColor,
      gradientCenter: settings.pocketGradientCenterColor,
      gradientEdge: settings.pocketGradientEdgeColor,
      wallColor: settings.pocketWallColor,
    });
    this.renderer.setPocketGradientStrength(settings.pocketGradientStrength ?? 1);
  }

  private syncCheckbox(key: RenderLayerBooleanKey, value: boolean) {
    if (!LAYER_CHECKBOX_MAP) return;
    const entry = Object.entries(LAYER_CHECKBOX_MAP).find(([, layerKey]) => layerKey === key);
    if (!entry) return;
    const checkbox = document.getElementById(entry[0]) as HTMLInputElement | null;
    if (checkbox) {
      checkbox.checked = value;
    }
  }

  private syncUI() {
    Object.entries(LAYER_CHECKBOX_MAP).forEach(([id, key]) => {
      const checkbox = document.getElementById(id) as HTMLInputElement | null;
      if (checkbox) {
        checkbox.checked = this.settings[key];
      }
    });

    const skinOpacitySlider = document.getElementById('skin-opacity') as HTMLInputElement | null;
    if (skinOpacitySlider && typeof this.settings.skinOpacity === 'number') {
      skinOpacitySlider.value = this.settings.skinOpacity.toString();
    }
    const skinOpacityLabel = document.getElementById('skin-opacity-value');
    if (skinOpacityLabel && typeof this.settings.skinOpacity === 'number') {
      skinOpacityLabel.textContent = this.settings.skinOpacity.toFixed(2);
    }

    this.syncOrders();
    this.syncLightingSliders();
  }

  toggle() {
    this.panelController.toggle();
    if (this.panelController.isOpen()) {
      this.syncUI();
    }
  }

  open() {
    this.panelController.open();
    this.syncUI();
  }

  close() {
    this.panelController.close();
  }

  syncFromRenderer() {
    const current = this.renderer.getRenderLayerSettings();
    const lights = this.renderer.getLightingIntensities();
    const highlights = this.renderer.getHighlightIntensities();
    this.settings = {
      ...this.settings,
      ...current,
      ...lights,
      ...highlights,
    };
    this.settingsManager.saveRenderSettings({
      ...(current as Partial<RenderSettings>),
      ambientIntensity: lights.ambientIntensity,
      directionalIntensity: lights.directionalIntensity,
      accentIntensity: lights.accentIntensity,
      railHighlightIntensity: highlights.railHighlightIntensity,
      railShadowIntensity: highlights.railShadowIntensity,
      pocketHighlightIntensity: highlights.pocketHighlightIntensity,
      pocketShadowIntensity: highlights.pocketShadowIntensity,
    });
    this.syncUI();
  }

  setMeasurementOverlayVisible(visible: boolean) {
    this.updateSetting('showMeasurementOverlay', visible, { applyRenderer: true, save: true });
  }

  setReferenceOverlayVisible(visible: boolean) {
    this.updateSetting('showReferenceOverlay', visible, { applyRenderer: true, save: true });
  }

  toggleReferenceOverlay() {
    const current = this.renderer.getReferenceOverlayVisible();
    this.setReferenceOverlayVisible(!current);
  }

  private bindLightingControls() {
    type LightingKey = 'ambientIntensity' | 'directionalIntensity' | 'accentIntensity' | 'railHighlightIntensity' | 'railShadowIntensity' | 'railShadowSpread' | 'railShadowSoftness' | 'railShadowBaseGray' | 'railHighlightSpread' | 'pocketHighlightIntensity' | 'pocketShadowIntensity'
      | 'grooveInnerBase' | 'grooveInnerDepthScale' | 'grooveThicknessFactor' | 'grooveOpacityBase' | 'grooveOpacityDepthScale' | 'grooveRimThicknessFactor' | 'grooveRimOuterOpacity' | 'grooveRimInnerOpacity';

    const updateLightingSetting = (key: LightingKey, value: number, apply: (v: number) => void) => {
      (this.settings as any)[key] = value;
      this.settingsManager.saveRenderSettings({ [key]: value } as Partial<RenderSettings>);
      apply(value);
    };

    const lightingSliderConfigs: SliderBindConfig<RenderSettings>[] = [
      {
        sliderId: 'lighting-ambient',
        labelId: 'lighting-ambient-value',
        onChange: (v) => updateLightingSetting('ambientIntensity', v!, (value) => this.renderer.setLightingIntensities({ ambient: value }))
      },
      {
        sliderId: 'lighting-directional',
        labelId: 'lighting-directional-value',
        onChange: (v) => updateLightingSetting('directionalIntensity', v!, (value) => this.renderer.setLightingIntensities({ directional: value }))
      },
      {
        sliderId: 'lighting-accent',
        labelId: 'lighting-accent-value',
        onChange: (v) => updateLightingSetting('accentIntensity', v!, (value) => this.renderer.setLightingIntensities({ accent: value }))
      },
      {
        sliderId: 'lighting-rail-highlight',
        labelId: 'lighting-rail-highlight-value',
        onChange: (v) => updateLightingSetting('railHighlightIntensity', v!, (value) => this.renderer.setHighlightIntensities({ rail: value }))
      },
      {
        sliderId: 'lighting-rail-shadow',
        labelId: 'lighting-rail-shadow-value',
        onChange: (v) => updateLightingSetting('railShadowIntensity', v!, (value) => this.renderer.setHighlightIntensities({ railShadow: value }))
      },
      {
        sliderId: 'lighting-rail-shadow-base',
        labelId: 'lighting-rail-shadow-base-value',
        onChange: (v) => updateLightingSetting('railShadowBaseGray', v!, (value) => this.renderer.setRailShadowBaseGray(value))
      },
      {
        sliderId: 'lighting-rail-shadow-spread',
        labelId: 'lighting-rail-shadow-spread-value',
        onChange: (v) => updateLightingSetting('railShadowSpread', v!, (value) => this.renderer.setRailShadowSpread(value))
      },
      {
        sliderId: 'lighting-rail-shadow-softness',
        labelId: 'lighting-rail-shadow-softness-value',
        onChange: (v) => updateLightingSetting('railShadowSoftness', v!, (value) => this.renderer.setRailShadowSoftness(value))
      },
      {
        sliderId: 'lighting-rail-highlight-spread',
        labelId: 'lighting-rail-highlight-spread-value',
        onChange: (v) => updateLightingSetting('railHighlightSpread', v!, (value) => this.renderer.setRailHighlightSpread(value))
      },
      {
        sliderId: 'lighting-pocket-highlight',
        labelId: 'lighting-pocket-highlight-value',
        onChange: (v) => updateLightingSetting('pocketHighlightIntensity', v!, (value) => this.renderer.setHighlightIntensities({ pocketHighlight: value }))
      },
      {
        sliderId: 'lighting-pocket-shadow',
        labelId: 'lighting-pocket-shadow-value',
        onChange: (v) => updateLightingSetting('pocketShadowIntensity', v!, (value) => this.renderer.setHighlightIntensities({ pocketShadow: value }))
      },
      // Groove appearance sliders
      {
        sliderId: 'groove-inner-base',
        labelId: 'groove-inner-base-value',
        onChange: (v) => this.updateGroove('grooveInnerBase', v!)
      },
      {
        sliderId: 'groove-inner-depth',
        labelId: 'groove-inner-depth-value',
        onChange: (v) => this.updateGroove('grooveInnerDepthScale', v!)
      },
      {
        sliderId: 'groove-thickness',
        labelId: 'groove-thickness-value',
        onChange: (v) => this.updateGroove('grooveThicknessFactor', v!)
      },
      {
        sliderId: 'groove-opacity-base',
        labelId: 'groove-opacity-base-value',
        onChange: (v) => this.updateGroove('grooveOpacityBase', v!)
      },
      {
        sliderId: 'groove-opacity-depth',
        labelId: 'groove-opacity-depth-value',
        onChange: (v) => this.updateGroove('grooveOpacityDepthScale', v!)
      },
      {
        sliderId: 'groove-rim-thickness',
        labelId: 'groove-rim-thickness-value',
        onChange: (v) => this.updateGroove('grooveRimThicknessFactor', v!)
      },
      {
        sliderId: 'groove-rim-outer-opacity',
        labelId: 'groove-rim-outer-opacity-value',
        onChange: (v) => this.updateGroove('grooveRimOuterOpacity', v!)
      },
      {
        sliderId: 'groove-rim-inner-opacity',
        labelId: 'groove-rim-inner-opacity-value',
        onChange: (v) => this.updateGroove('grooveRimInnerOpacity', v!)
      },
    ];

    this.lightingBinders = bindSliders(lightingSliderConfigs);

    // Bind color input for rail highlight
    const railHighlightColorInput = document.getElementById('lighting-rail-highlight-color') as HTMLInputElement | null;
    if (railHighlightColorInput) {
      const applyColor = (hex: string) => {
        this.settings.railHighlightColor = hex;
        this.settingsManager.saveRenderSettings({ railHighlightColor: hex } as Partial<RenderSettings>);
        this.renderer.setRailHighlightColor(hex);
      };
      railHighlightColorInput.addEventListener('input', () => applyColor(railHighlightColorInput.value));
      railHighlightColorInput.addEventListener('change', () => applyColor(railHighlightColorInput.value));
    }

    // Bind pocket groove/pocket color inputs
    const grooveColor = document.getElementById('groove-color') as HTMLInputElement | null;
    const grooveRimColor = document.getElementById('groove-rim-color') as HTMLInputElement | null;
    const pocketBottomColor = document.getElementById('pocket-bottom-color') as HTMLInputElement | null;
    const pocketGradCenter = document.getElementById('pocket-gradient-center') as HTMLInputElement | null;
    const pocketGradEdge = document.getElementById('pocket-gradient-edge') as HTMLInputElement | null;
    const wallColor = document.getElementById('pocket-wall-color') as HTMLInputElement | null;
    const pocketGradStrength = document.getElementById('pocket-gradient-strength') as HTMLInputElement | null;
    const applyPocketColors = () => {
      const payload = {
        grooveColor: grooveColor?.value ?? this.settings.grooveColor,
        rimColor: grooveRimColor?.value ?? this.settings.rimColor,
        bottomColor: pocketBottomColor?.value ?? this.settings.pocketBottomColor,
        gradientCenter: pocketGradCenter?.value ?? this.settings.pocketGradientCenterColor,
        gradientEdge: pocketGradEdge?.value ?? this.settings.pocketGradientEdgeColor,
        wallColor: wallColor?.value ?? this.settings.pocketWallColor,
      };
      console.log('[RenderLayerPanel] applyPocketColors', payload);
      this.settings.grooveColor = payload.grooveColor;
      this.settings.rimColor = payload.rimColor;
      this.settings.pocketBottomColor = payload.bottomColor;
      this.settings.pocketGradientCenterColor = payload.gradientCenter;
      this.settings.pocketGradientEdgeColor = payload.gradientEdge;
      this.settings.pocketWallColor = payload.wallColor;
      this.settingsManager.saveRenderSettings({
        grooveColor: this.settings.grooveColor,
        rimColor: this.settings.rimColor,
        pocketBottomColor: this.settings.pocketBottomColor,
        pocketGradientCenterColor: this.settings.pocketGradientCenterColor,
        pocketGradientEdgeColor: this.settings.pocketGradientEdgeColor,
        pocketWallColor: this.settings.pocketWallColor,
      });
      this.renderer.setPocketShadeColors(payload);
    };
    [grooveColor, grooveRimColor, pocketBottomColor, pocketGradCenter, pocketGradEdge, wallColor].forEach((el) => {
      if (!el) return;
      el.addEventListener('input', applyPocketColors);
      el.addEventListener('change', applyPocketColors);
    });

    const applyGradientStrength = () => {
      if (!pocketGradStrength) return;
      const val = parseFloat(pocketGradStrength.value);
      if (!Number.isFinite(val)) return;
      console.log('[RenderLayerPanel] gradient strength slider', val);
      this.settings.pocketGradientStrength = val;
      this.settingsManager.saveRenderSettings({ pocketGradientStrength: val } as Partial<RenderSettings>);
      this.renderer.setPocketGradientStrength(val);
      const label = document.getElementById('pocket-gradient-strength-value');
      if (label) label.textContent = val.toFixed(2);
    };
    if (pocketGradStrength) {
      pocketGradStrength.addEventListener('input', applyGradientStrength);
      pocketGradStrength.addEventListener('change', applyGradientStrength);
    }
  }

  private syncLightingSliders() {
    const map: Array<{ key: keyof Pick<RenderSettings, 'ambientIntensity' | 'directionalIntensity' | 'accentIntensity' | 'railHighlightIntensity' | 'railShadowIntensity' | 'railShadowSpread' | 'railShadowSoftness' | 'railShadowBaseGray' | 'railHighlightSpread' | 'pocketHighlightIntensity' | 'pocketShadowIntensity' | 'grooveInnerBase' | 'grooveInnerDepthScale' | 'grooveThicknessFactor' | 'grooveOpacityBase' | 'grooveOpacityDepthScale' | 'grooveRimThicknessFactor' | 'grooveRimOuterOpacity' | 'grooveRimInnerOpacity'>; id: string }> = [
      { key: 'ambientIntensity', id: 'lighting-ambient' },
      { key: 'directionalIntensity', id: 'lighting-directional' },
      { key: 'accentIntensity', id: 'lighting-accent' },
      { key: 'railHighlightIntensity', id: 'lighting-rail-highlight' },
      { key: 'railShadowIntensity', id: 'lighting-rail-shadow' },
      { key: 'railShadowBaseGray', id: 'lighting-rail-shadow-base' },
      { key: 'railShadowSpread', id: 'lighting-rail-shadow-spread' },
      { key: 'railShadowSoftness', id: 'lighting-rail-shadow-softness' },
      { key: 'railHighlightSpread', id: 'lighting-rail-highlight-spread' },
      { key: 'pocketHighlightIntensity', id: 'lighting-pocket-highlight' },
      { key: 'pocketShadowIntensity', id: 'lighting-pocket-shadow' },
      { key: 'grooveInnerBase', id: 'groove-inner-base' },
      { key: 'grooveInnerDepthScale', id: 'groove-inner-depth' },
      { key: 'grooveThicknessFactor', id: 'groove-thickness' },
      { key: 'grooveOpacityBase', id: 'groove-opacity-base' },
      { key: 'grooveOpacityDepthScale', id: 'groove-opacity-depth' },
      { key: 'grooveRimThicknessFactor', id: 'groove-rim-thickness' },
      { key: 'grooveRimOuterOpacity', id: 'groove-rim-outer-opacity' },
      { key: 'grooveRimInnerOpacity', id: 'groove-rim-inner-opacity' },
    ];

    map.forEach(({ key, id }) => {
      const binder = this.lightingBinders.get(id);
      if (binder && Number.isFinite(this.settings[key])) {
        binder.setValue(this.settings[key]);
      }
    });

    const railHighlightColorInput = document.getElementById('lighting-rail-highlight-color') as HTMLInputElement | null;
    if (railHighlightColorInput && typeof this.settings.railHighlightColor === 'string') {
      railHighlightColorInput.value = this.settings.railHighlightColor;
    }
    const grooveColor = document.getElementById('groove-color') as HTMLInputElement | null;
    if (grooveColor) grooveColor.value = this.settings.grooveColor;
    const grooveRimColor = document.getElementById('groove-rim-color') as HTMLInputElement | null;
    if (grooveRimColor) grooveRimColor.value = this.settings.rimColor;
    const bottomColor = document.getElementById('pocket-bottom-color') as HTMLInputElement | null;
    if (bottomColor) bottomColor.value = this.settings.pocketBottomColor;
    const gradCenter = document.getElementById('pocket-gradient-center') as HTMLInputElement | null;
    if (gradCenter) gradCenter.value = this.settings.pocketGradientCenterColor;
    const gradEdge = document.getElementById('pocket-gradient-edge') as HTMLInputElement | null;
    if (gradEdge) gradEdge.value = this.settings.pocketGradientEdgeColor;
    const wallColor = document.getElementById('pocket-wall-color') as HTMLInputElement | null;
    if (wallColor) wallColor.value = this.settings.pocketWallColor;
    const pocketGradStrength2 = document.getElementById('pocket-gradient-strength') as HTMLInputElement | null;
    if (pocketGradStrength2) pocketGradStrength2.value = (this.settings.pocketGradientStrength ?? 1).toString();
    const pocketGradStrengthLabel = document.getElementById('pocket-gradient-strength-value');
    if (pocketGradStrengthLabel && typeof this.settings.pocketGradientStrength === 'number') pocketGradStrengthLabel.textContent = this.settings.pocketGradientStrength.toFixed(2);
  }

  private updateGroove(key: keyof RenderSettings, value: number) {
    console.log('[RenderLayerPanel] groove slider update', key, value);
    (this.settings as any)[key] = value;
    this.settingsManager.saveRenderSettings({ [key]: value } as Partial<RenderSettings>);
    this.renderer.setPocketGrooveSettings({
      innerBase: this.settings.grooveInnerBase,
      innerDepthScale: this.settings.grooveInnerDepthScale,
      thicknessFactor: this.settings.grooveThicknessFactor,
      opacityBase: this.settings.grooveOpacityBase,
      opacityDepthScale: this.settings.grooveOpacityDepthScale,
      rimThicknessFactor: this.settings.grooveRimThicknessFactor,
      rimOuterOpacity: this.settings.grooveRimOuterOpacity,
      rimInnerOpacity: this.settings.grooveRimInnerOpacity,
    });
  }

  private bindOrderControls() {
    const orderMap: Record<string, RenderLayerOrderKey> = {
      'order-table': 'orderTable',
      'order-frame': 'orderFrame',
      'order-rails': 'orderRails',
      'order-pockets': 'orderPockets',
      'order-caps': 'orderCaps',
      'order-balls': 'orderBalls',
      'order-ui': 'orderUI',
    };

    Object.entries(orderMap).forEach(([id, key]) => {
      const input = document.getElementById(id) as HTMLInputElement | null;
      if (!input) return;
      this.orderInputs[key] = input;

      const handleChange = () => {
        let value = parseFloat(input.value);
        if (!Number.isFinite(value)) {
          value = defaultRenderLayerSettings[key];
        }
        const clamped = Math.max(-1000, Math.min(2000, value));
        input.value = clamped.toString();
        const updated: RenderSettings = { ...this.settings, [key]: clamped };
        this.settings = updated;
        this.applyToRenderer(updated);
        this.settingsManager.saveRenderSettings({ [key]: clamped } as Partial<RenderSettings>);
      };

      // Listen to both 'input' (live updates) and 'change' (final value)
      input.addEventListener('input', handleChange);
      input.addEventListener('change', handleChange);
    });
  }

  private syncOrders() {
    (Object.entries(this.orderInputs) as [RenderLayerOrderKey, HTMLInputElement | undefined][]).forEach(
      ([key, input]) => {
        if (!input) return;
        const value = this.settings[key];
        if (typeof value === 'number') {
          input.value = value.toString();
        }
      }
    );
  }

  getController(): UIPanel {
    return this.panelController;
  }
}

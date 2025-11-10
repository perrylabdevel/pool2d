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
  'layer-rails': 'showRails',
  'layer-pockets': 'showPockets',
  'layer-caps': 'showCaps',
  'layer-balls': 'showBalls',
  'layer-ui': 'showUIOverlay',
  'layer-measure': 'showMeasurementOverlay',
  'layer-reference': 'showReferenceOverlay',
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
    this.panel = document.getElementById('render-layer-panel')!;
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
  }

  private bindControls() {
    const closeBtn = document.getElementById('render-layer-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }

    const syncBtn = document.getElementById('render-layer-sync');
    if (syncBtn) {
      syncBtn.addEventListener('click', () => this.syncFromRenderer());
    }

    Object.entries(LAYER_CHECKBOX_MAP).forEach(([id, key]) => {
      const checkbox = document.getElementById(id) as HTMLInputElement | null;
      if (!checkbox) return;
      checkbox.addEventListener('change', () => {
        this.updateSetting(key, checkbox.checked, { applyRenderer: true, save: true });
      });
    });

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
    type LightingKey = 'ambientIntensity' | 'directionalIntensity' | 'accentIntensity' | 'railHighlightIntensity' | 'railShadowIntensity' | 'railShadowSpread' | 'railShadowSoftness' | 'railShadowBaseGray' | 'railHighlightSpread' | 'pocketHighlightIntensity' | 'pocketShadowIntensity';

    const updateLightingSetting = (key: LightingKey, value: number, apply: (v: number) => void) => {
      (this.settings as Record<string, number>)[key] = value;
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
  }

  private syncLightingSliders() {
    const map: Array<{ key: keyof Pick<RenderSettings, 'ambientIntensity' | 'directionalIntensity' | 'accentIntensity' | 'railHighlightIntensity' | 'railShadowIntensity' | 'railShadowSpread' | 'railShadowSoftness' | 'railShadowBaseGray' | 'railHighlightSpread' | 'pocketHighlightIntensity' | 'pocketShadowIntensity'>; id: string }> = [
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

      input.addEventListener('change', () => {
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
      });
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

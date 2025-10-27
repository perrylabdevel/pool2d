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
  private orderInputs: Partial<Record<RenderLayerOrderKey, HTMLInputElement>> = {};
  private lightingInputs: Record<
    'ambientIntensity' | 'directionalIntensity' | 'accentIntensity' | 'railHighlightIntensity' | 'pocketShadowIntensity' | 'pocketHighlightIntensity',
    HTMLInputElement | null
  > = {
    ambientIntensity: null,
    directionalIntensity: null,
    accentIntensity: null,
    railHighlightIntensity: null,
    pocketShadowIntensity: null,
    pocketHighlightIntensity: null,
  };

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
    this.renderer.setHighlightIntensities({
      rail: settings.railHighlightIntensity,
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
    const simpleSliders: Array<{
      id: string;
      key: 'ambientIntensity' | 'directionalIntensity' | 'accentIntensity' | 'pocketShadowIntensity';
      apply: (value: number) => void;
    }> = [
      {
        id: 'lighting-ambient',
        key: 'ambientIntensity',
        apply: (value) => this.renderer.setLightingIntensities({ ambient: value }),
      },
      {
        id: 'lighting-directional',
        key: 'directionalIntensity',
        apply: (value) => this.renderer.setLightingIntensities({ directional: value }),
      },
      {
        id: 'lighting-accent',
        key: 'accentIntensity',
        apply: (value) => this.renderer.setLightingIntensities({ accent: value }),
      },
      {
        id: 'lighting-pocket-shadow',
        key: 'pocketShadowIntensity',
        apply: (value) => this.renderer.setHighlightIntensities({ pocketShadow: value }),
      },
    ];

    simpleSliders.forEach(({ id, key, apply }) => {
      const input = document.getElementById(id) as HTMLInputElement | null;
      if (key in this.lightingInputs) {
        (this.lightingInputs as Record<string, HTMLInputElement | null>)[key] = input;
      }
      const valueLabel = document.getElementById(`${id}-value`);
      if (!input) return;

      input.addEventListener('input', () => {
        const value = parseFloat(input.value);
        if (!Number.isFinite(value)) {
          return;
        }
        (this.settings as Record<string, number>)[key] = value;
        if (valueLabel) {
          valueLabel.textContent = value.toFixed(2);
        }
        this.settingsManager.saveRenderSettings({ [key]: value } as Partial<RenderSettings>);
        apply(value);
      });
    });

    const railInput = document.getElementById('lighting-rail-highlight') as HTMLInputElement | null;
    const railValueLabel = document.getElementById('lighting-rail-highlight-value');
    if (railInput) {
      this.lightingInputs.railHighlightIntensity = railInput;
      this.lightingInputs.pocketHighlightIntensity = railInput;
      railInput.addEventListener('input', () => {
        const value = parseFloat(railInput.value);
        if (!Number.isFinite(value)) {
          return;
        }
        this.settings.railHighlightIntensity = value;
        this.settings.pocketHighlightIntensity = value;
        if (railValueLabel) {
          railValueLabel.textContent = value.toFixed(2);
        }
        this.settingsManager.saveRenderSettings({
          railHighlightIntensity: value,
          pocketHighlightIntensity: value,
        });
        this.renderer.setHighlightIntensities({ rail: value, pocketHighlight: value });
      });
    }
  }

  private syncLightingSliders() {
    const map: Array<{ key: keyof Pick<RenderSettings, 'ambientIntensity' | 'directionalIntensity' | 'accentIntensity' | 'pocketShadowIntensity'>; id: string }> = [
      { key: 'ambientIntensity', id: 'lighting-ambient' },
      { key: 'directionalIntensity', id: 'lighting-directional' },
      { key: 'accentIntensity', id: 'lighting-accent' },
      { key: 'pocketShadowIntensity', id: 'lighting-pocket-shadow' },
    ];

    map.forEach(({ key, id }) => {
      const input = document.getElementById(id) as HTMLInputElement | null;
      const valueLabel = document.getElementById(`${id}-value`);
      if (!input) return;
      const value = this.settings[key];
      if (Number.isFinite(value)) {
        input.value = value.toString();
        if (valueLabel) {
          valueLabel.textContent = value.toFixed(2);
        }
      }
    });

    const railInput = document.getElementById('lighting-rail-highlight') as HTMLInputElement | null;
    const railValueLabel = document.getElementById('lighting-rail-highlight-value');
    if (railInput) {
      const value = this.settings.railHighlightIntensity;
      railInput.value = value.toString();
      if (railValueLabel) {
        railValueLabel.textContent = value.toFixed(2);
      }
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

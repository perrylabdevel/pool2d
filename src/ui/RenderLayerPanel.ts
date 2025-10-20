import { Renderer3D } from '../render/Renderer3D';
import { makePanelDraggable } from './drag';
import { SettingsManager, RenderSettings } from './SettingsManager';
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
  private isOpen = false;
  private settings: RenderLayerSettings;
  private orderInputs: Partial<Record<RenderLayerOrderKey, HTMLInputElement>> = {};

  constructor(
    private settingsManager: SettingsManager,
    private renderer: Renderer3D
  ) {
    this.panel = document.getElementById('render-layer-panel')!;
    const header = this.panel.querySelector('.panel-header') as HTMLElement | null;
    if (header) {
      makePanelDraggable(this.panel, header);
    }

    this.settings = this.settingsManager.getRenderSettings();
    this.applyToRenderer(this.settings);
    this.bindControls();
    this.syncUI();

    window.addEventListener('settings:render-changed', (event: Event) => {
      const detail = (event as CustomEvent<{ settings: RenderLayerSettings }>).detail;
      if (!detail) return;
      this.settings = { ...detail.settings };
      this.applyToRenderer(this.settings);
      this.syncUI();
    });
  }

  private bindControls() {
    const toggleBtn = document.getElementById('render-layer-btn');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => this.toggle());
    }

    const closeBtn = document.getElementById('render-layer-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
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
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });

    this.bindOrderControls();
  }

  private updateSetting(
    key: RenderLayerBooleanKey,
    value: boolean,
    options?: { applyRenderer?: boolean; save?: boolean }
  ) {
    const updated: RenderLayerSettings = { ...this.settings, [key]: value } as RenderLayerSettings;
    this.settings = updated;
    if (options?.save !== false) {
      this.settingsManager.saveRenderSettings({ [key]: value } as Partial<RenderSettings>);
    }
    if (options?.applyRenderer !== false) {
      this.applyToRenderer(updated);
    }
    this.syncCheckbox(key, value);
  }

  private applyToRenderer(settings: RenderLayerSettings) {
    this.renderer.applyRenderLayerSettings(settings);
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
  }

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  open() {
    this.panel.classList.remove('hidden');
    this.isOpen = true;
    this.syncUI();
  }

  close() {
    this.panel.classList.add('hidden');
    this.isOpen = false;
  }

  syncFromRenderer() {
    const current = this.renderer.getRenderLayerSettings();
    this.settings = { ...current };
    this.settingsManager.saveRenderSettings(current);
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
        const updated = { ...this.settings, [key]: clamped } as RenderLayerSettings;
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
}

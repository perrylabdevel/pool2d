import { SettingsManager } from './SettingsManager';
import { makePanelDraggable } from './drag';

export class GeometryPanel {
  private panel: HTMLElement;
  private isOpen = false;
  private settingsManager: SettingsManager;
  private onGeometryChange: () => void;

  constructor(settingsManager: SettingsManager, onGeometryChange: () => void) {
    this.settingsManager = settingsManager;
    this.onGeometryChange = onGeometryChange;
    
    this.panel = document.getElementById('geometry-panel')!;
    const header = this.panel.querySelector('.panel-header') as HTMLElement | null;
    if (header) {
      makePanelDraggable(this.panel, header);
    }
    this.setupControls();
    this.loadCurrentValues();
  }

  private setupControls() {
    // Toggle button
    const toggleBtn = document.getElementById('geometry-panel-btn');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => this.toggle());
    }

    // Close button
    const closeBtn = document.getElementById('geometry-panel-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }

    // Side Jaw Radius
    const sideRadiusSlider = document.getElementById('live-side-radius') as HTMLInputElement;
    const sideRadiusVal = document.getElementById('live-side-radius-val');
    if (sideRadiusSlider && sideRadiusVal) {
      sideRadiusSlider.addEventListener('input', (e) => {
        const value = parseFloat((e.target as HTMLInputElement).value);
        sideRadiusVal.textContent = value.toFixed(1);
        this.settingsManager.saveGeometrySettings({ JAW_REF_RADIUS_IN: value });
        this.onGeometryChange();
      });
    }

    // Side Steepness
    const sideSteepnessSlider = document.getElementById('live-side-steepness') as HTMLInputElement;
    const sideSteepnessVal = document.getElementById('live-side-steepness-val');
    if (sideSteepnessSlider && sideSteepnessVal) {
      sideSteepnessSlider.addEventListener('input', (e) => {
        const value = parseFloat((e.target as HTMLInputElement).value);
        sideSteepnessVal.textContent = value.toFixed(1);
        this.settingsManager.saveGeometrySettings({ SIDE_FRAME_OFFSET_IN: value });
        this.onGeometryChange();
      });
    }

    // Corner Jaw Radius
    const cornerRadiusSlider = document.getElementById('live-corner-radius') as HTMLInputElement;
    const cornerRadiusVal = document.getElementById('live-corner-radius-val');
    if (cornerRadiusSlider && cornerRadiusVal) {
      cornerRadiusSlider.addEventListener('input', (e) => {
        const value = parseFloat((e.target as HTMLInputElement).value);
        cornerRadiusVal.textContent = value.toFixed(1);
        this.settingsManager.saveGeometrySettings({ CORNER_JAW_REF_RADIUS_IN: value });
        this.onGeometryChange();
      });
    }

    // Frame Width
    const frameWidthSlider = document.getElementById('live-frame-width') as HTMLInputElement;
    const frameWidthVal = document.getElementById('live-frame-width-val');
    if (frameWidthSlider && frameWidthVal) {
      frameWidthSlider.addEventListener('input', (e) => {
        const value = parseFloat((e.target as HTMLInputElement).value);
        frameWidthVal.textContent = value.toFixed(1);
        this.settingsManager.saveGeometrySettings({ FRAME_OFFSET_IN: value });
        this.onGeometryChange();
      });
    }

    // Reset button
    const resetBtn = document.getElementById('geometry-reset-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.settingsManager.resetGeometrySettings();
        this.loadCurrentValues();
        this.onGeometryChange();
      });
    }

    // Close on Escape key
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });
  }

  private loadCurrentValues() {
    const settings = this.settingsManager.getGeometrySettings();

    // Side Jaw Radius
    const sideRadiusSlider = document.getElementById('live-side-radius') as HTMLInputElement;
    const sideRadiusVal = document.getElementById('live-side-radius-val');
    if (sideRadiusSlider && sideRadiusVal) {
      sideRadiusSlider.value = String(settings.JAW_REF_RADIUS_IN);
      sideRadiusVal.textContent = settings.JAW_REF_RADIUS_IN.toFixed(1);
    }

    // Side Steepness
    const sideSteepnessSlider = document.getElementById('live-side-steepness') as HTMLInputElement;
    const sideSteepnessVal = document.getElementById('live-side-steepness-val');
    if (sideSteepnessSlider && sideSteepnessVal) {
      sideSteepnessSlider.value = String(settings.SIDE_FRAME_OFFSET_IN);
      sideSteepnessVal.textContent = settings.SIDE_FRAME_OFFSET_IN.toFixed(1);
    }

    // Corner Jaw Radius
    const cornerRadiusSlider = document.getElementById('live-corner-radius') as HTMLInputElement;
    const cornerRadiusVal = document.getElementById('live-corner-radius-val');
    if (cornerRadiusSlider && cornerRadiusVal) {
      cornerRadiusSlider.value = String(settings.CORNER_JAW_REF_RADIUS_IN);
      cornerRadiusVal.textContent = settings.CORNER_JAW_REF_RADIUS_IN.toFixed(1);
    }

    // Frame Width
    const frameWidthSlider = document.getElementById('live-frame-width') as HTMLInputElement;
    const frameWidthVal = document.getElementById('live-frame-width-val');
    if (frameWidthSlider && frameWidthVal) {
      frameWidthSlider.value = String(settings.FRAME_OFFSET_IN);
      frameWidthVal.textContent = settings.FRAME_OFFSET_IN.toFixed(1);
    }
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
    this.loadCurrentValues();
  }

  close() {
    this.panel.classList.add('hidden');
    this.isOpen = false;
  }
}

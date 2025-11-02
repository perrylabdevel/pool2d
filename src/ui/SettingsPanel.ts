// Settings panel for live physics tuning
import { CONFIG } from '../config';
import { SettingsManager, PhysicsSettings, RenderSettings } from './SettingsManager';
import { makePanelDraggable } from './drag';
import { UIPanel } from './panels/UIPanel';
import { bindSliders, type SliderBindConfig } from './controls/SliderBinder';

export class SettingsPanel {
  private panel: HTMLElement;
  private panelController: UIPanel;
  private settingsManager: SettingsManager;
  private physicsConfig: PhysicsSettings;

  constructor(settingsManager: SettingsManager) {
    this.settingsManager = settingsManager;
    this.panel = this.createPanel();
    const header = this.panel.querySelector('.panel-header') as HTMLElement | null;
    if (header && !this.panel.closest('#panel-dock')) {
      makePanelDraggable(this.panel, header);
    }

    this.physicsConfig = CONFIG as unknown as PhysicsSettings;

    const focusTarget = this.panel.querySelector<HTMLElement>('input[type="range"], button');
    this.panelController = new UIPanel({
      id: 'physics-settings',
      element: this.panel,
      focusTarget,
    });
    this.panelController.addEventListener('panel:open', () => this.loadSettings());

    this.setupEventListeners();
    this.loadSettings();
  }

  private sliderRow(key: string, label: string, min: number, max: number, step: number, value: number): string {
    return `
      <div class="slider-group">
        <label class="slider-label" for="${key}">
          <span class="slider-title">${label}</span>
          <span class="slider-value" id="${key}-value">${value}</span>
        </label>
        <input
          type="range"
          id="${key}"
          min="${min}"
          max="${max}"
          step="${step}"
          value="${value}"
        />
      </div>
    `;
  }

  private createPanel(): HTMLElement {
    let panel = document.getElementById('settings-panel') as HTMLElement | null;
    if (panel) {
      return panel;
    }

    const panelDock = document.getElementById('panel-dock');
    panel = document.createElement('div');
    panel.id = 'settings-panel';
    panel.className = 'panel-dock-card hidden';

    panel.innerHTML = `
      <div class="panel-header">
        <h3>⚗ Physics & Aim Assist</h3>
      </div>
      <div class="panel-content">
        <div class="settings-group">
          <h4 class="settings-group-title">🎱 Ball Physics</h4>
          ${this.sliderRow('BALL_RESTITUTION', 'Ball-Ball Restitution', 0.5, 1.0, 0.01, CONFIG.BALL_RESTITUTION)}
          ${this.sliderRow('BALL_BALL_FRICTION', 'Ball-Ball Friction', 0.0, 0.3, 0.01, CONFIG.BALL_BALL_FRICTION)}
          ${this.sliderRow('CUSHION_RESTITUTION', 'Cushion Restitution', 0.5, 1.0, 0.01, CONFIG.CUSHION_RESTITUTION)}
        </div>
        <div class="settings-group">
          <h4 class="settings-group-title">🎯 Shot Power</h4>
          ${this.sliderRow('CUE_POWER_MAX', 'Max Power', 10, 50, 1, CONFIG.CUE_POWER_MAX)}
          ${this.sliderRow('CUE_POWER_MULTIPLIER', 'Power Multiplier', 5, 20, 0.5, CONFIG.CUE_POWER_MULTIPLIER)}
        </div>
        <div class="settings-group">
          <h4 class="settings-group-title">🌪️ Friction</h4>
          ${this.sliderRow('ROLLING_FRICTION', 'Rolling Friction', 0.1, 2.0, 0.05, CONFIG.ROLLING_FRICTION)}
          ${this.sliderRow('SLIDING_FRICTION', 'Sliding Friction', 0.1, 2.0, 0.05, CONFIG.SLIDING_FRICTION)}
        </div>
        <div class="settings-group">
          <h4 class="settings-group-title">⚡ Physics Engine</h4>
          ${this.sliderRow('SOLVER_ITERATIONS', 'Solver Iterations', 1, 30, 1, CONFIG.SOLVER_ITERATIONS)}
          ${this.sliderRow('VELOCITY_EPSILON', 'Sleep Threshold', 0.05, 1.0, 0.05, CONFIG.VELOCITY_EPSILON)}
        </div>
        <div class="settings-group">
          <h4 class="settings-group-title">🎯 Aim Assist Visuals</h4>
          ${this.sliderRow('AIM_LINE_OFFSET', 'Aim Line Offset', 0.0, 2.0, 0.1, CONFIG.AIM_LINE_OFFSET)}
          ${this.sliderRow('GHOST_BALL_OFFSET', 'Ghost Ball Offset', -2.0, 2.0, 0.1, CONFIG.GHOST_BALL_OFFSET)}
          ${this.sliderRow('OBJECT_PATH_PERCENTAGE', 'Object Path Length %', 0.1, 2.0, 0.1, CONFIG.OBJECT_PATH_PERCENTAGE)}
        </div>
        <div class="settings-group">
          <h4 class="settings-group-title">🖥️ Display</h4>
          ${this.sliderRow('BALL_SCALE', 'Ball Scale', 0.8, 1.2, 0.01, CONFIG.BALL_SCALE ?? 1)}
          ${this.sliderRow('CANVAS_SCALE_MULTIPLIER', 'Table Scale', 0.6, 1.6, 0.05, CONFIG.CANVAS_SCALE_MULTIPLIER)}
        </div>
        <div class="panel-actions" style="margin-top: 16px; gap: 8px;">
          <button id="settings-reset" class="panel-btn">Reset Defaults</button>
          <button id="settings-export" class="panel-btn">Copy Config</button>
        </div>
      </div>
    `;

    if (panelDock) {
      panelDock.prepend(panel);
    } else {
      document.body.appendChild(panel);
    }

    return panel;
  }

  private setupEventListeners() {
    // Close button
    const closeBtn = this.panel.querySelector('#settings-close');
    closeBtn?.addEventListener('click', () => this.hide());

    // Reset button
    const resetBtn = this.panel.querySelector('#settings-reset');
    resetBtn?.addEventListener('click', () => this.resetDefaults());

    // Export button
    const exportBtn = this.panel.querySelector('#settings-export');
    exportBtn?.addEventListener('click', () => this.exportConfig());
    
    // Close on Escape key
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.panelController.isOpen()) {
        this.hide();
      }
    });

    // Bind all physics sliders
    const physicsSliderConfigs: SliderBindConfig<PhysicsSettings>[] = [
      { sliderId: 'BALL_RESTITUTION', labelId: 'BALL_RESTITUTION-value', onChange: (v) => this.updatePhysicsSetting('BALL_RESTITUTION', v!) },
      { sliderId: 'BALL_BALL_FRICTION', labelId: 'BALL_BALL_FRICTION-value', onChange: (v) => this.updatePhysicsSetting('BALL_BALL_FRICTION', v!) },
      { sliderId: 'CUSHION_RESTITUTION', labelId: 'CUSHION_RESTITUTION-value', onChange: (v) => this.updatePhysicsSetting('CUSHION_RESTITUTION', v!) },
      { sliderId: 'CUE_POWER_MAX', labelId: 'CUE_POWER_MAX-value', onChange: (v) => this.updatePhysicsSetting('CUE_POWER_MAX', v!), formatDigits: 0 },
      { sliderId: 'CUE_POWER_MULTIPLIER', labelId: 'CUE_POWER_MULTIPLIER-value', onChange: (v) => this.updatePhysicsSetting('CUE_POWER_MULTIPLIER', v!) },
      { sliderId: 'ROLLING_FRICTION', labelId: 'ROLLING_FRICTION-value', onChange: (v) => this.updatePhysicsSetting('ROLLING_FRICTION', v!) },
      { sliderId: 'SLIDING_FRICTION', labelId: 'SLIDING_FRICTION-value', onChange: (v) => this.updatePhysicsSetting('SLIDING_FRICTION', v!) },
      { sliderId: 'SOLVER_ITERATIONS', labelId: 'SOLVER_ITERATIONS-value', onChange: (v) => this.updatePhysicsSetting('SOLVER_ITERATIONS', v!), formatDigits: 0 },
      { sliderId: 'VELOCITY_EPSILON', labelId: 'VELOCITY_EPSILON-value', onChange: (v) => this.updatePhysicsSetting('VELOCITY_EPSILON', v!) },
      { sliderId: 'AIM_LINE_OFFSET', labelId: 'AIM_LINE_OFFSET-value', onChange: (v) => this.updatePhysicsSetting('AIM_LINE_OFFSET', v!) },
      { sliderId: 'GHOST_BALL_OFFSET', labelId: 'GHOST_BALL_OFFSET-value', onChange: (v) => this.updatePhysicsSetting('GHOST_BALL_OFFSET', v!) },
      { sliderId: 'OBJECT_PATH_PERCENTAGE', labelId: 'OBJECT_PATH_PERCENTAGE-value', onChange: (v) => this.updatePhysicsSetting('OBJECT_PATH_PERCENTAGE', v!) },
    ];

    // Bind render setting sliders
    const renderSliderConfigs: SliderBindConfig<RenderSettings>[] = [
      { sliderId: 'CANVAS_SCALE_MULTIPLIER', labelId: 'CANVAS_SCALE_MULTIPLIER-value', onChange: (v) => this.updateRenderSetting('CANVAS_SCALE_MULTIPLIER', v!) },
      { sliderId: 'BALL_SCALE', labelId: 'BALL_SCALE-value', onChange: (v) => this.updateRenderSetting('BALL_SCALE', v!) },
    ];

    bindSliders([...physicsSliderConfigs, ...renderSliderConfigs]);
  }

  private updateRenderSetting(key: 'CANVAS_SCALE_MULTIPLIER' | 'BALL_SCALE', value: number) {
    if (key === 'CANVAS_SCALE_MULTIPLIER') {
      CONFIG.CANVAS_SCALE_MULTIPLIER = value;
      const renderUpdate: Partial<RenderSettings> = { canvasScale: value };
      this.settingsManager.saveRenderSettings(renderUpdate);
      console.log(`🖥️ CANVAS_SCALE_MULTIPLIER = ${value}`);
      return;
    }

    const baseRadius = CONFIG.BALL_BASE_RADIUS ?? CONFIG.BALL_RADIUS;
    CONFIG.BALL_SCALE = value;
    CONFIG.BALL_RADIUS = baseRadius * value;
    const renderUpdate: Partial<RenderSettings> = { ballScale: value };
    this.settingsManager.saveRenderSettings(renderUpdate);
    console.log(`🎱 BALL_SCALE = ${value} (radius ${CONFIG.BALL_RADIUS.toFixed(3)}")`);
  }

  private updatePhysicsSetting(key: string, value: number) {
    if (!this.isPhysicsSettingKey(key)) {
      console.warn(`Ignoring unsupported physics setting key "${key}"`);
      return;
    }

    this.physicsConfig[key] = value;
    const physicsUpdate: Partial<PhysicsSettings> = { [key]: value } as Partial<PhysicsSettings>;
    this.settingsManager.savePhysicsSettings(physicsUpdate);
    console.log(`⚙️ ${key} = ${value}`);
  }

  private isPhysicsSettingKey(key: string): key is keyof PhysicsSettings {
    return key in this.settingsManager.getPhysicsSettings();
  }

  private loadSettings() {
    const physicsSettings = this.settingsManager.getPhysicsSettings();
    
    // Update all sliders and displays with saved values
    Object.entries(physicsSettings).forEach(([key, value]) => {
      const slider = this.panel.querySelector(`#${key}`) as HTMLInputElement;
      if (slider) slider.value = value.toString();
      
      const valueDisplay = this.panel.querySelector(`#${key}-value`);
      if (valueDisplay) valueDisplay.textContent = value.toString();
    });

    const renderSettings = this.settingsManager.getRenderSettings();
    const canvasSlider = this.panel.querySelector('#CANVAS_SCALE_MULTIPLIER') as HTMLInputElement;
    if (canvasSlider) {
      canvasSlider.value = renderSettings.canvasScale.toString();
    }
    const canvasDisplay = this.panel.querySelector('#CANVAS_SCALE_MULTIPLIER-value');
    if (canvasDisplay) {
      canvasDisplay.textContent = renderSettings.canvasScale.toFixed(2);
    }
    const ballScaleSlider = this.panel.querySelector('#BALL_SCALE') as HTMLInputElement;
    if (ballScaleSlider) {
      ballScaleSlider.value = renderSettings.ballScale.toString();
    }
    const ballScaleDisplay = this.panel.querySelector('#BALL_SCALE-value');
    if (ballScaleDisplay) {
      ballScaleDisplay.textContent = renderSettings.ballScale.toFixed(2);
    }
  }

  private resetDefaults() {
    // Reset via settings manager (saves to local storage)
    this.settingsManager.resetPhysicsSettings();
    this.settingsManager.saveRenderSettings({ canvasScale: 1, ballScale: 1 });
    
    // Reload UI to reflect reset values
    this.loadSettings();

    console.log('⚙️ Settings reset to defaults');
  }

  private exportConfig() {
    const config = {
      BALL_RESTITUTION: CONFIG.BALL_RESTITUTION,
      BALL_BALL_FRICTION: CONFIG.BALL_BALL_FRICTION,
      CUSHION_RESTITUTION: CONFIG.CUSHION_RESTITUTION,
      CUE_POWER_MAX: CONFIG.CUE_POWER_MAX,
      CUE_POWER_MULTIPLIER: CONFIG.CUE_POWER_MULTIPLIER,
      ROLLING_FRICTION: CONFIG.ROLLING_FRICTION,
      SLIDING_FRICTION: CONFIG.SLIDING_FRICTION,
      SOLVER_ITERATIONS: CONFIG.SOLVER_ITERATIONS,
      VELOCITY_EPSILON: CONFIG.VELOCITY_EPSILON,
      CANVAS_SCALE_MULTIPLIER: CONFIG.CANVAS_SCALE_MULTIPLIER,
      BALL_SCALE: CONFIG.BALL_SCALE,
      BALL_RADIUS: CONFIG.BALL_RADIUS,
    };

    const configText = JSON.stringify(config, null, 2);
    
    if (navigator.clipboard) {
      navigator.clipboard.writeText(configText).then(() => {
        console.log('✅ Config copied to clipboard!');
        console.log(configText);
      });
    } else {
      console.log('📋 Current Config:');
      console.log(configText);
    }
  }

  toggle() {
    this.panelController.toggle();
  }

  show() {
    this.panelController.open();
  }

  hide() {
    this.panelController.close();
  }

  getController(): UIPanel {
    return this.panelController;
  }
}

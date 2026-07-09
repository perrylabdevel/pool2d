// Settings panel for live physics and visual tuning
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
        <h3>⚙ Physics & Aim Assist</h3>
        <button id="settings-close" class="close-btn" aria-label="Close settings">×</button>
      </div>
      <div class="panel-content">
        <div class="settings-group">
          <h4 class="settings-group-title">🎱 Ball Physics</h4>
          ${this.sliderRow('BALL_RESTITUTION', 'Ball-Ball Restitution', 0.5, 1.0, 0.01, CONFIG.BALL_RESTITUTION)}
          ${this.sliderRow('BALL_BALL_FRICTION', 'Ball-Ball Friction', 0.0, 0.3, 0.01, CONFIG.BALL_BALL_FRICTION)}
          ${this.sliderRow('CUSHION_RESTITUTION', 'Cushion Restitution', 0.5, 1.0, 0.01, CONFIG.CUSHION_RESTITUTION)}
        </div>
        <div class="settings-group">
          <h4 class="settings-group-title">💥 Shot Power</h4>
          ${this.sliderRow('CUE_POWER_MAX', 'Max Power', 10, 50, 1, CONFIG.CUE_POWER_MAX)}
          ${this.sliderRow('CUE_POWER_MULTIPLIER', 'Power Multiplier', 5, 20, 0.5, CONFIG.CUE_POWER_MULTIPLIER)}
        </div>
        <div class="settings-group">
          <h4 class="settings-group-title">🧲 Friction</h4>
          ${this.sliderRow('ROLLING_FRICTION', 'Rolling Friction', 0.1, 2.0, 0.05, CONFIG.ROLLING_FRICTION)}
          ${this.sliderRow('SLIDING_FRICTION', 'Sliding Friction', 0.1, 2.0, 0.05, CONFIG.SLIDING_FRICTION)}
        </div>
        <div class="settings-group">
          <h4 class="settings-group-title">🧮 Physics Engine</h4>
          ${this.sliderRow('SOLVER_ITERATIONS', 'Solver Iterations', 1, 30, 1, CONFIG.SOLVER_ITERATIONS)}
          ${this.sliderRow('VELOCITY_EPSILON', 'Sleep Threshold', 0.05, 1.0, 0.05, CONFIG.VELOCITY_EPSILON)}
        </div>
        <div class="settings-group">
          <h4 class="settings-group-title">🎯 Aim Assist Visuals</h4>
          ${this.sliderRow('AIM_LINE_OFFSET', 'Aim Line Offset', 0.0, 2.0, 0.1, CONFIG.AIM_LINE_OFFSET)}
          ${this.sliderRow('GHOST_BALL_OFFSET', 'Ghost Ball Offset', -2.0, 2.0, 0.1, CONFIG.GHOST_BALL_OFFSET)}
          ${this.sliderRow('OBJECT_PATH_PERCENTAGE', 'Object Path Length %', 0.1, 2.0, 0.1, CONFIG.OBJECT_PATH_PERCENTAGE)}
          ${this.sliderRow('AIM_INFO_SCALE', 'Aim Info Scale', 0.9, 2.0, 0.1, CONFIG.AIM_INFO_SCALE)}
        </div>
        <div class="settings-group">
          <h4 class="settings-group-title">🎱 Pocket Animation</h4>
          ${this.sliderRow(
            'POCKET_ANIMATION_DROP_DURATION_MS',
            'Drop Duration (ms)',
            50,
            1000,
            10,
            CONFIG.POCKET_ANIMATION_DROP_DURATION_MS ?? 300
          )}
          ${this.sliderRow(
            'POCKET_ANIMATION_ROLL_DURATION_MS',
            'Roll Duration (ms)',
            50,
            2000,
            10,
            CONFIG.POCKET_ANIMATION_ROLL_DURATION_MS ?? 500
          )}
          ${this.sliderRow(
            'POCKET_ANIMATION_DROP_DEPTH',
            'Pocket Drop Depth (in)',
            0.1,
            3.0,
            0.05,
            CONFIG.POCKET_ANIMATION_DROP_DEPTH ?? 0.35
          )}
          ${this.sliderRow(
            'POCKET_ANIMATION_SHRINK_FACTOR',
            'Ball Shrink Factor',
            0.0,
            0.6,
            0.01,
            (CONFIG as any).POCKET_ANIMATION_SHRINK_FACTOR ?? 0.2
          )}
          ${this.sliderRow(
            'POCKET_ANIMATION_UNDERFELT_PX',
            'Under-Felt Roll Distance (px)',
            0,
            50,
            1,
            (CONFIG as any).POCKET_ANIMATION_UNDERFELT_PX ?? 10
          )}
          ${this.sliderRow(
            'POCKET_ANIMATION_FADE_START',
            'Fade Start (0-1)',
            0.7,
            1.0,
            0.01,
            CONFIG.POCKET_ANIMATION_FADE_START ?? 0.9
          )}
          ${this.sliderRow(
            'POCKET_ANIMATION_FADE_DURATION',
            'Fade Duration (0-1)',
            0.0,
            0.5,
            0.01,
            (CONFIG as any).POCKET_ANIMATION_FADE_DURATION ?? 0.12
          )}
          ${this.sliderRow(
            'POCKET_ANIMATION_CLIP_START',
            'Clip Start (0-1)',
            0.0,
            1.0,
            0.01,
            (CONFIG as any).POCKET_ANIMATION_CLIP_START ?? 0.45
          )}
          ${this.sliderRow(
            'POCKET_ANIMATION_CLIP_RADIUS_SCALE',
            'Clip Radius Scale',
            1.0,
            3.0,
            0.1,
            CONFIG.POCKET_ANIMATION_CLIP_RADIUS_SCALE ?? 1.4
          )}
        </div>
        <div class="settings-group">
          <h4 class="settings-group-title">🖥 Display</h4>
          ${this.sliderRow('BALL_SCALE', 'Ball Scale', 0.8, 1.30, 0.01, CONFIG.BALL_SCALE ?? 1)}
          ${this.sliderRow('CANVAS_SCALE_MULTIPLIER', 'Table Scale', 0.6, 1.6, 0.05, CONFIG.CANVAS_SCALE_MULTIPLIER)}
        </div>
        <div class="panel-actions">
          <button id="settings-reset" class="panel-btn">Reset Defaults</button>
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
    const closeBtn = this.panel.querySelector('#settings-close');
    closeBtn?.addEventListener('click', () => this.hide());

    const resetBtn = this.panel.querySelector('#settings-reset');
    resetBtn?.addEventListener('click', () => this.resetDefaults());

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.panelController.isOpen()) {
        this.hide();
      }
    });

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
      { sliderId: 'AIM_INFO_SCALE', labelId: 'AIM_INFO_SCALE-value', onChange: (v) => this.updatePhysicsSetting('AIM_INFO_SCALE', v!) },
      { sliderId: 'POCKET_ANIMATION_DROP_DURATION_MS', labelId: 'POCKET_ANIMATION_DROP_DURATION_MS-value', onChange: (v) => this.updatePhysicsSetting('POCKET_ANIMATION_DROP_DURATION_MS', v!), formatDigits: 0 },
      { sliderId: 'POCKET_ANIMATION_ROLL_DURATION_MS', labelId: 'POCKET_ANIMATION_ROLL_DURATION_MS-value', onChange: (v) => this.updatePhysicsSetting('POCKET_ANIMATION_ROLL_DURATION_MS', v!), formatDigits: 0 },
      { sliderId: 'POCKET_ANIMATION_DROP_DEPTH', labelId: 'POCKET_ANIMATION_DROP_DEPTH-value', onChange: (v) => this.updatePhysicsSetting('POCKET_ANIMATION_DROP_DEPTH', v!) },
      { sliderId: 'POCKET_ANIMATION_SHRINK_FACTOR', labelId: 'POCKET_ANIMATION_SHRINK_FACTOR-value', onChange: (v) => this.updatePhysicsSetting('POCKET_ANIMATION_SHRINK_FACTOR', v!) },
      { sliderId: 'POCKET_ANIMATION_UNDERFELT_PX', labelId: 'POCKET_ANIMATION_UNDERFELT_PX-value', onChange: (v) => this.updatePhysicsSetting('POCKET_ANIMATION_UNDERFELT_PX', v!), formatDigits: 0 },
      { sliderId: 'POCKET_ANIMATION_FADE_START', labelId: 'POCKET_ANIMATION_FADE_START-value', onChange: (v) => this.updatePhysicsSetting('POCKET_ANIMATION_FADE_START', v!) },
      { sliderId: 'POCKET_ANIMATION_FADE_DURATION', labelId: 'POCKET_ANIMATION_FADE_DURATION-value', onChange: (v) => this.updatePhysicsSetting('POCKET_ANIMATION_FADE_DURATION', v!) },
      { sliderId: 'POCKET_ANIMATION_CLIP_START', labelId: 'POCKET_ANIMATION_CLIP_START-value', onChange: (v) => this.updatePhysicsSetting('POCKET_ANIMATION_CLIP_START', v!) },
      { sliderId: 'POCKET_ANIMATION_CLIP_RADIUS_SCALE', labelId: 'POCKET_ANIMATION_CLIP_RADIUS_SCALE-value', onChange: (v) => this.updatePhysicsSetting('POCKET_ANIMATION_CLIP_RADIUS_SCALE', v!) },
    ];

    const renderSliderConfigs: SliderBindConfig<RenderSettings>[] = [
      { sliderId: 'CANVAS_SCALE_MULTIPLIER', labelId: 'CANVAS_SCALE_MULTIPLIER-value', onChange: (v) => this.updateRenderSetting('CANVAS_SCALE_MULTIPLIER', v!) },
      { sliderId: 'BALL_SCALE', labelId: 'BALL_SCALE-value', onChange: (v) => this.updateRenderSetting('BALL_SCALE', v!) },
    ];

    bindSliders(physicsSliderConfigs);
    bindSliders(renderSliderConfigs);
  }

  private updateRenderSetting(key: 'CANVAS_SCALE_MULTIPLIER' | 'BALL_SCALE', value: number) {
    if (key === 'CANVAS_SCALE_MULTIPLIER') {
      CONFIG.CANVAS_SCALE_MULTIPLIER = value;
      const renderUpdate: Partial<RenderSettings> = { canvasScale: value };
      this.settingsManager.saveRenderSettings(renderUpdate);
      console.log(`🎨 CANVAS_SCALE_MULTIPLIER = ${value}`);
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

    (this.physicsConfig as unknown as Record<string, number>)[key] = value;
    const physicsUpdate: Partial<PhysicsSettings> = { [key]: value } as Partial<PhysicsSettings>;
    this.settingsManager.savePhysicsSettings(physicsUpdate);
    console.log(`⚙ ${key} = ${value}`);
  }

  private isPhysicsSettingKey(key: string): key is keyof PhysicsSettings {
    return key in this.settingsManager.getPhysicsSettings();
  }

  private loadSettings() {
    const physicsSettings = this.settingsManager.getPhysicsSettings();
    const renderSettings = this.settingsManager.getRenderSettings();

    const setValue = (id: string, value: number) => {
      const slider = this.panel.querySelector<HTMLInputElement>(`#${id}`);
      const label = this.panel.querySelector<HTMLElement>(`#${id}-value`);
      if (slider) slider.value = value.toString();
      if (label) label.textContent = value.toString();
    };

    // Physics
    setValue('BALL_RESTITUTION', physicsSettings.BALL_RESTITUTION);
    setValue('BALL_BALL_FRICTION', physicsSettings.BALL_BALL_FRICTION);
    setValue('CUSHION_RESTITUTION', physicsSettings.CUSHION_RESTITUTION);
    setValue('CUE_POWER_MAX', physicsSettings.CUE_POWER_MAX);
    setValue('CUE_POWER_MULTIPLIER', physicsSettings.CUE_POWER_MULTIPLIER);
    setValue('ROLLING_FRICTION', physicsSettings.ROLLING_FRICTION);
    setValue('SLIDING_FRICTION', physicsSettings.SLIDING_FRICTION);
    setValue('SOLVER_ITERATIONS', physicsSettings.SOLVER_ITERATIONS);
    setValue('VELOCITY_EPSILON', physicsSettings.VELOCITY_EPSILON);
    setValue('AIM_LINE_OFFSET', physicsSettings.AIM_LINE_OFFSET);
    setValue('GHOST_BALL_OFFSET', physicsSettings.GHOST_BALL_OFFSET);
    setValue('OBJECT_PATH_PERCENTAGE', physicsSettings.OBJECT_PATH_PERCENTAGE);
    setValue('AIM_INFO_SCALE', physicsSettings.AIM_INFO_SCALE);
    setValue('POCKET_ANIMATION_DROP_DURATION_MS', physicsSettings.POCKET_ANIMATION_DROP_DURATION_MS);
    setValue('POCKET_ANIMATION_ROLL_DURATION_MS', physicsSettings.POCKET_ANIMATION_ROLL_DURATION_MS);
    setValue('POCKET_ANIMATION_DROP_DEPTH', physicsSettings.POCKET_ANIMATION_DROP_DEPTH);
    setValue('POCKET_ANIMATION_SHRINK_FACTOR', physicsSettings.POCKET_ANIMATION_SHRINK_FACTOR);
    setValue('POCKET_ANIMATION_UNDERFELT_PX', physicsSettings.POCKET_ANIMATION_UNDERFELT_PX);
    setValue('POCKET_ANIMATION_FADE_START', physicsSettings.POCKET_ANIMATION_FADE_START);
    setValue('POCKET_ANIMATION_FADE_DURATION', physicsSettings.POCKET_ANIMATION_FADE_DURATION);
    setValue('POCKET_ANIMATION_CLIP_START', physicsSettings.POCKET_ANIMATION_CLIP_START);
    setValue('POCKET_ANIMATION_CLIP_RADIUS_SCALE', physicsSettings.POCKET_ANIMATION_CLIP_RADIUS_SCALE);

    // Render
    setValue('BALL_SCALE', renderSettings.ballScale);
    setValue('CANVAS_SCALE_MULTIPLIER', renderSettings.canvasScale);
  }

  private resetDefaults() {
    this.settingsManager.resetPhysicsSettings();
    this.settingsManager.saveRenderSettings({ canvasScale: 1, ballScale: 1 });
    this.loadSettings();
    console.log('🔄 Settings reset to defaults');
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


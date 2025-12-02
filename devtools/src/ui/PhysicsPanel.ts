import { RemoteSettingsManager } from '../../RemoteSettingsManager';
import { PhysicsSettings, RenderSettings } from '../../../src/ui/SettingsManager';
import { UIPanel } from '../../../src/ui/panels/UIPanel';
import { bindSliders, type SliderBindConfig } from '../../../src/ui/controls/SliderBinder';
export class PhysicsPanel {
  private panel: HTMLElement;
  private panelController: UIPanel;
  private settingsManager: RemoteSettingsManager;
  private physicsConfig: PhysicsSettings;
  private renderConfig: RenderSettings;

  constructor(settingsManager: RemoteSettingsManager) {
    this.settingsManager = settingsManager;
    this.physicsConfig = settingsManager.getPhysicsSettings();
    this.renderConfig = settingsManager.getRenderSettings();

    this.panel = this.createPanel();

    const focusTarget = this.panel.querySelector<HTMLElement>('input[type="range"], button');
    this.panelController = new UIPanel({
      id: 'physics-settings',
      element: this.panel,
      focusTarget,
    });

    // Listen for external updates (state-updated from RemoteSettingsManager)
    this.settingsManager.addEventListener('state-updated', () => {
      this.physicsConfig = this.settingsManager.getPhysicsSettings();
      this.renderConfig = this.settingsManager.getRenderSettings();
      this.updateUI();
    });

    // Also listen to window events for bidirectional sync
    window.addEventListener('settings:physics-changed', () => {
      this.physicsConfig = this.settingsManager.getPhysicsSettings();
      this.updateUI();
    });

    window.addEventListener('settings:render-changed', () => {
      this.renderConfig = this.settingsManager.getRenderSettings();
      this.updateUI();
    });

    this.panelController.addEventListener('panel:open', () => this.updateUI());

    this.setupEventListeners();
    this.updateUI();
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
    let panel = document.getElementById('physics-panel') as HTMLElement | null;
    if (panel) {
      return panel;
    }

    const panelDock = document.getElementById('panel-dock');
    panel = document.createElement('div');
    panel.id = 'physics-panel';
    panel.className = 'panel-dock-card';

    // Use current config for initial render
    const config = this.physicsConfig;

    panel.innerHTML = `
      <div class="panel-header">
        <h3>⚙ Physics & Aim Assist</h3>
      </div>
      <div class="panel-content">
        <div class="settings-group">
          <h4 class="settings-group-title">🖥 Display</h4>
          ${this.sliderRow('BALL_SCALE', 'Ball Scale', 0.8, 1.2, 0.01, this.renderConfig.ballScale ?? 1)}
          ${this.sliderRow('CANVAS_SCALE_MULTIPLIER', 'Table Scale', 0.6, 1.6, 0.05, this.renderConfig.canvasScale ?? 1)}
        </div>
        <div class="settings-group">
          <h4 class="settings-group-title">🎱 Ball Physics</h4>
          ${this.sliderRow('BALL_RESTITUTION', 'Ball-Ball Restitution', 0.5, 1.0, 0.01, config.BALL_RESTITUTION)}
          ${this.sliderRow('BALL_BALL_FRICTION', 'Ball-Ball Friction', 0.0, 0.3, 0.01, config.BALL_BALL_FRICTION)}
          ${this.sliderRow('CUSHION_RESTITUTION', 'Cushion Restitution', 0.5, 1.0, 0.01, config.CUSHION_RESTITUTION)}
        </div>
        <div class="settings-group">
          <h4 class="settings-group-title">💥 Shot Power</h4>
          ${this.sliderRow('CUE_POWER_MAX', 'Max Power', 10, 50, 1, config.CUE_POWER_MAX)}
          ${this.sliderRow('CUE_POWER_MULTIPLIER', 'Power Multiplier', 5, 20, 0.5, config.CUE_POWER_MULTIPLIER)}
        </div>
        <div class="settings-group">
          <h4 class="settings-group-title">🧲 Friction</h4>
          ${this.sliderRow('ROLLING_FRICTION', 'Rolling Friction', 0.1, 2.0, 0.05, config.ROLLING_FRICTION)}
          ${this.sliderRow('SLIDING_FRICTION', 'Sliding Friction', 0.1, 2.0, 0.05, config.SLIDING_FRICTION)}
        </div>
        <div class="settings-group">
          <h4 class="settings-group-title">🧮 Physics Engine</h4>
          ${this.sliderRow('SOLVER_ITERATIONS', 'Solver Iterations', 1, 30, 1, config.SOLVER_ITERATIONS)}
          ${this.sliderRow('VELOCITY_EPSILON', 'Sleep Threshold', 0.05, 1.0, 0.05, config.VELOCITY_EPSILON)}
        </div>
        <div class="settings-group">
          <h4 class="settings-group-title">🎯 Aim Assist Visuals</h4>
          ${this.sliderRow('AIM_LINE_OFFSET', 'Aim Line Offset', 0.0, 2.0, 0.1, config.AIM_LINE_OFFSET)}
          ${this.sliderRow('GHOST_BALL_OFFSET', 'Ghost Ball Offset', -2.0, 2.0, 0.1, config.GHOST_BALL_OFFSET)}
          ${this.sliderRow('OBJECT_PATH_PERCENTAGE', 'Object Path Length %', 0.1, 2.0, 0.1, config.OBJECT_PATH_PERCENTAGE)}
          ${this.sliderRow('AIM_INFO_SCALE', 'Aim Info Scale', 0.9, 2.0, 0.1, config.AIM_INFO_SCALE)}
        </div>
        <div class="settings-group">
          <h4 class="settings-group-title">🎱 Pocket Animation</h4>
          ${this.sliderRow('POCKET_ANIMATION_DROP_DURATION_MS', 'Drop Duration (ms)', 50, 1000, 10, config.POCKET_ANIMATION_DROP_DURATION_MS ?? 300)}
          ${this.sliderRow('POCKET_ANIMATION_ROLL_DURATION_MS', 'Roll Duration (ms)', 50, 2000, 10, config.POCKET_ANIMATION_ROLL_DURATION_MS ?? 500)}
          ${this.sliderRow('POCKET_ANIMATION_DROP_DEPTH', 'Pocket Drop Depth (in)', 0.1, 3.0, 0.05, config.POCKET_ANIMATION_DROP_DEPTH ?? 0.35)}
          ${this.sliderRow('POCKET_ANIMATION_SHRINK_FACTOR', 'Ball Shrink Factor', 0.0, 0.6, 0.01, config.POCKET_ANIMATION_SHRINK_FACTOR ?? 0.2)}
          ${this.sliderRow('POCKET_ANIMATION_UNDERFELT_PX', 'Under-Felt Roll Distance (px)', 0, 50, 1, config.POCKET_ANIMATION_UNDERFELT_PX ?? 10)}
          ${this.sliderRow('POCKET_ANIMATION_FADE_START', 'Fade Start (0-1)', 0.7, 1.0, 0.01, config.POCKET_ANIMATION_FADE_START ?? 0.9)}
          ${this.sliderRow('POCKET_ANIMATION_CLIP_RADIUS_SCALE', 'Clip Radius Scale', 1.0, 3.0, 0.1, config.POCKET_ANIMATION_CLIP_RADIUS_SCALE ?? 1.4)}
        </div>
        <div class="panel-actions">
          <button id="physics-reset" class="panel-btn">Reset Defaults</button>
        </div>
      </div>
    `;

    if (panelDock) {
      panelDock.appendChild(panel);
    } else {
      document.body.appendChild(panel);
    }

    return panel;
  }

  private setupEventListeners() {
    const resetBtn = this.panel.querySelector('#physics-reset');
    resetBtn?.addEventListener('click', () => this.resetDefaults());

    // Render Settings
    const renderSliderConfigs: SliderBindConfig<RenderSettings>[] = [
      { sliderId: 'BALL_SCALE', labelId: 'BALL_SCALE-value', onChange: (v) => this.updateRenderSetting('ballScale', v!) },
      { sliderId: 'CANVAS_SCALE_MULTIPLIER', labelId: 'CANVAS_SCALE_MULTIPLIER-value', onChange: (v) => this.updateRenderSetting('canvasScale', v!) },
    ];
    bindSliders(renderSliderConfigs as any); // Type assertion needed because bindSliders expects one type

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
      { sliderId: 'POCKET_ANIMATION_CLIP_RADIUS_SCALE', labelId: 'POCKET_ANIMATION_CLIP_RADIUS_SCALE-value', onChange: (v) => this.updatePhysicsSetting('POCKET_ANIMATION_CLIP_RADIUS_SCALE', v!) },
    ];

    bindSliders(physicsSliderConfigs);
  }

  private updatePhysicsSetting(key: string, value: number) {
    const update: Partial<PhysicsSettings> = { [key]: value } as any;
    this.settingsManager.savePhysicsSettings(update);
  }

  private updateRenderSetting(key: keyof RenderSettings, value: number) {
    const update: Partial<RenderSettings> = { [key]: value };
    this.settingsManager.saveRenderSettings(update);
  }

  private updateUI() {
    const config = this.settingsManager.getPhysicsSettings();
    const renderConfig = this.settingsManager.getRenderSettings();

    const setValue = (id: string, value: number) => {
      const slider = this.panel.querySelector<HTMLInputElement>(`#${id}`);
      const label = this.panel.querySelector<HTMLElement>(`#${id}-value`);
      if (slider && document.activeElement !== slider) { // Don't update if user is dragging
        slider.value = value.toString();
      }
      if (label) label.textContent = value.toString();
    };

    setValue('BALL_SCALE', renderConfig.ballScale ?? 1);
    setValue('CANVAS_SCALE_MULTIPLIER', renderConfig.canvasScale ?? 1);

    setValue('BALL_RESTITUTION', config.BALL_RESTITUTION);
    setValue('BALL_BALL_FRICTION', config.BALL_BALL_FRICTION);
    setValue('CUSHION_RESTITUTION', config.CUSHION_RESTITUTION);
    setValue('CUE_POWER_MAX', config.CUE_POWER_MAX);
    setValue('CUE_POWER_MULTIPLIER', config.CUE_POWER_MULTIPLIER);
    setValue('ROLLING_FRICTION', config.ROLLING_FRICTION);
    setValue('SLIDING_FRICTION', config.SLIDING_FRICTION);
    setValue('SOLVER_ITERATIONS', config.SOLVER_ITERATIONS);
    setValue('VELOCITY_EPSILON', config.VELOCITY_EPSILON);
    setValue('AIM_LINE_OFFSET', config.AIM_LINE_OFFSET);
    setValue('GHOST_BALL_OFFSET', config.GHOST_BALL_OFFSET);
    setValue('OBJECT_PATH_PERCENTAGE', config.OBJECT_PATH_PERCENTAGE);
    setValue('AIM_INFO_SCALE', config.AIM_INFO_SCALE);
    setValue('POCKET_ANIMATION_DROP_DURATION_MS', config.POCKET_ANIMATION_DROP_DURATION_MS);
    setValue('POCKET_ANIMATION_ROLL_DURATION_MS', config.POCKET_ANIMATION_ROLL_DURATION_MS);
    setValue('POCKET_ANIMATION_DROP_DEPTH', config.POCKET_ANIMATION_DROP_DEPTH);
    setValue('POCKET_ANIMATION_SHRINK_FACTOR', config.POCKET_ANIMATION_SHRINK_FACTOR);
    setValue('POCKET_ANIMATION_UNDERFELT_PX', config.POCKET_ANIMATION_UNDERFELT_PX);
    setValue('POCKET_ANIMATION_FADE_START', config.POCKET_ANIMATION_FADE_START);
    setValue('POCKET_ANIMATION_CLIP_RADIUS_SCALE', config.POCKET_ANIMATION_CLIP_RADIUS_SCALE);
  }

  private resetDefaults() {
    this.settingsManager.resetPhysicsSettings();
  }

  getController(): UIPanel {
    return this.panelController;
  }
}

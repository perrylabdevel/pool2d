// Settings panel for live physics tuning
import { CONFIG } from '../config';
import { SettingsManager, PhysicsSettings } from './SettingsManager';

export class SettingsPanel {
  private panel: HTMLElement;
  private isVisible: boolean = false;
  private settingsManager: SettingsManager;

  constructor(settingsManager: SettingsManager) {
    this.settingsManager = settingsManager;
    this.panel = this.createPanel();
    document.body.appendChild(this.panel);
    this.setupEventListeners();
    this.loadSettings();
  }

  private createPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.id = 'physics-panel';
    panel.classList.add('hidden');

    panel.innerHTML = `
      <div class="modal-actions" style="justify-content: space-between; margin: 0 0 16px;">
        <h3>Physics</h3>
        <button id="physics-panel-close" class="btn btn-ghost display" style="padding: 0 14px;">Close</button>
      </div>

      <div class="physics-group">
        ${this.createSlider('BALL_RESTITUTION', 'Ball-ball restitution', 0.5, 1.0, 0.01, CONFIG.BALL_RESTITUTION)}
        ${this.createSlider('BALL_BALL_FRICTION', 'Ball-ball friction', 0.0, 0.3, 0.01, CONFIG.BALL_BALL_FRICTION)}
        ${this.createSlider('CUSHION_RESTITUTION', 'Cushion restitution', 0.5, 1.0, 0.01, CONFIG.CUSHION_RESTITUTION)}
        ${this.createSlider('BALL_ROTATION_MULTIPLIER_3D', 'Roll rate', 0.0, 2.0, 0.05, CONFIG.BALL_ROTATION_MULTIPLIER_3D)}
        ${this.createSlider('CUE_POWER_MAX', 'Max power', 10, 50, 1, CONFIG.CUE_POWER_MAX)}
        ${this.createSlider('CUE_POWER_MULTIPLIER', 'Power multiplier', 5, 20, 0.5, CONFIG.CUE_POWER_MULTIPLIER)}
        ${this.createSlider('ROLLING_FRICTION', 'Rolling friction', 0.1, 2.0, 0.05, CONFIG.ROLLING_FRICTION)}
        ${this.createSlider('SLIDING_FRICTION', 'Sliding friction', 0.1, 2.0, 0.05, CONFIG.SLIDING_FRICTION)}
        ${this.createSlider('SOLVER_ITERATIONS', 'Solver iterations', 1, 30, 1, CONFIG.SOLVER_ITERATIONS)}
        ${this.createSlider('VELOCITY_EPSILON', 'Sleep threshold', 0.05, 1.0, 0.05, CONFIG.VELOCITY_EPSILON)}
      </div>

      <div class="modal-actions">
        <button id="settings-reset" class="btn btn-ghost display">Reset</button>
        <button id="settings-export" class="btn btn-primary display">Copy</button>
      </div>
    `;

    return panel;
  }

  private createSlider(key: string, label: string, min: number, max: number, step: number, value: number): string {
    const displayValue = value < 0.01 ? value.toFixed(4) : value.toString();
    return `
      <div class="physics-row">
        <label for="${key}">
          <span>${label}</span>
          <span id="${key}-value" class="physics-value">${displayValue}</span>
        </label>
        <input type="range" id="${key}" min="${min}" max="${max}" step="${step}" value="${value}" />
      </div>
    `;
  }

  private setupEventListeners() {
    // Close button
    const closeBtn = this.panel.querySelector('#physics-panel-close');
    closeBtn?.addEventListener('click', () => this.hide());

    // Reset button
    const resetBtn = this.panel.querySelector('#settings-reset');
    resetBtn?.addEventListener('click', () => this.resetDefaults());

    // Export button
    const exportBtn = this.panel.querySelector('#settings-export');
    exportBtn?.addEventListener('click', () => this.exportConfig());

    // Slider inputs
    const sliders = this.panel.querySelectorAll('input[type="range"]');
    sliders.forEach((slider) => {
      slider.addEventListener('input', (e) => {
        const input = e.target as HTMLInputElement;
        const key = input.id as keyof typeof CONFIG;
        const value = parseFloat(input.value);
        
        // Update CONFIG
        (CONFIG as unknown as Record<string, number>)[key] = value;
        
        // Update display value with appropriate precision
        const valueDisplay = this.panel.querySelector(`#${key}-value`);
        if (valueDisplay) {
          // Use 4 decimals for very small values, otherwise use standard formatting
          const displayValue = value < 0.01 ? value.toFixed(4) : value.toString();
          valueDisplay.textContent = displayValue;
        }
        
        // Save to local storage
        this.settingsManager.savePhysicsSettings({ [key]: value } as Partial<PhysicsSettings>);
        
        console.log(`⚙️ ${key} = ${value}`);
      });
    });
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
  }

  private resetDefaults() {
    // Reset via settings manager (saves to local storage)
    this.settingsManager.resetPhysicsSettings();
    
    // Reload UI to reflect reset values
    this.loadSettings();

    console.log('⚙️ Settings reset to defaults');
  }

  private exportConfig() {
    const config = {
      BALL_RESTITUTION: CONFIG.BALL_RESTITUTION,
      BALL_BALL_FRICTION: CONFIG.BALL_BALL_FRICTION,
      BALL_ROTATION_MULTIPLIER_3D: CONFIG.BALL_ROTATION_MULTIPLIER_3D,
      CUSHION_RESTITUTION: CONFIG.CUSHION_RESTITUTION,
      CUE_POWER_MAX: CONFIG.CUE_POWER_MAX,
      CUE_POWER_MULTIPLIER: CONFIG.CUE_POWER_MULTIPLIER,
      ROLLING_FRICTION: CONFIG.ROLLING_FRICTION,
      SLIDING_FRICTION: CONFIG.SLIDING_FRICTION,
      SOLVER_ITERATIONS: CONFIG.SOLVER_ITERATIONS,
      VELOCITY_EPSILON: CONFIG.VELOCITY_EPSILON,
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
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  show() {
    this.panel.classList.remove('hidden');
    this.isVisible = true;
  }

  hide() {
    this.panel.classList.add('hidden');
    this.isVisible = false;
  }
}

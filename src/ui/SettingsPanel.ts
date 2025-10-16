// Settings panel for live physics tuning
import { CONFIG } from '../config';
import { SettingsManager } from './SettingsManager';

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
    panel.id = 'settings-panel';
    panel.className = 'floating-panel hidden';
    panel.style.cssText = `
      top: 60px;
      left: 16px;
      width: 360px;
      max-height: calc(100vh - 80px);
    `;

    panel.innerHTML = `
      <div class="panel-header">
        <h3>⚗ Physics Settings</h3>
        <button id="settings-close" class="close-btn">×</button>
      </div>
      
      <div class="panel-content" style="max-height: calc(100vh - 160px); overflow-y: auto;">
        <div class="settings-group">
          <h4 class="settings-group-title" style="color: #64B5F6;">🎱 Ball Physics</h4>
          ${this.createSlider('BALL_RESTITUTION', 'Ball-Ball Restitution', 0.5, 1.0, 0.01, CONFIG.BALL_RESTITUTION)}
          ${this.createSlider('BALL_BALL_FRICTION', 'Ball-Ball Friction', 0.0, 0.3, 0.01, CONFIG.BALL_BALL_FRICTION)}
          ${this.createSlider('CUSHION_RESTITUTION', 'Cushion Restitution', 0.5, 1.0, 0.01, CONFIG.CUSHION_RESTITUTION)}
        </div>

        <div class="settings-group">
          <h4 class="settings-group-title" style="color: #FFB74D;">🎯 Shot Power</h4>
          ${this.createSlider('CUE_POWER_MAX', 'Max Power', 10, 50, 1, CONFIG.CUE_POWER_MAX)}
          ${this.createSlider('CUE_POWER_MULTIPLIER', 'Power Multiplier', 5, 20, 0.5, CONFIG.CUE_POWER_MULTIPLIER)}
        </div>

        <div class="settings-group">
          <h4 class="settings-group-title" style="color: #81C784;">🌪️ Friction</h4>
          ${this.createSlider('ROLLING_FRICTION', 'Rolling Friction', 0.1, 2.0, 0.05, CONFIG.ROLLING_FRICTION)}
          ${this.createSlider('SLIDING_FRICTION', 'Sliding Friction', 0.1, 2.0, 0.05, CONFIG.SLIDING_FRICTION)}
        </div>

        <div class="settings-group">
          <h4 class="settings-group-title" style="color: #BA68C8;">⚡ Physics Engine</h4>
          ${this.createSlider('SOLVER_ITERATIONS', 'Solver Iterations', 1, 30, 1, CONFIG.SOLVER_ITERATIONS)}
          ${this.createSlider('VELOCITY_EPSILON', 'Sleep Threshold', 0.05, 1.0, 0.05, CONFIG.VELOCITY_EPSILON)}
        </div>

        <div class="panel-actions" style="gap: 8px; margin-top: 16px;">
          <button id="settings-reset" class="panel-btn" style="background: #FF9800;">Reset</button>
          <button id="settings-export" class="panel-btn" style="background: #2196F3;">Copy Config</button>
        </div>
      </div>
    `;

    return panel;
  }

  private createSlider(key: string, label: string, min: number, max: number, step: number, value: number): string {
    return `
      <div class="slider-group">
        <label>
          ${label}: <span id="${key}-value">${value}</span>
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
      if (e.key === 'Escape' && this.isVisible) {
        this.hide();
      }
    });

    // Slider inputs
    const sliders = this.panel.querySelectorAll('input[type="range"]');
    sliders.forEach((slider) => {
      slider.addEventListener('input', (e) => {
        const input = e.target as HTMLInputElement;
        const key = input.id as keyof typeof CONFIG;
        const value = parseFloat(input.value);
        
        // Update CONFIG
        (CONFIG as any)[key] = value;
        
        // Update display value
        const valueDisplay = this.panel.querySelector(`#${key}-value`);
        if (valueDisplay) {
          valueDisplay.textContent = value.toString();
        }
        
        // Save to local storage
        this.settingsManager.savePhysicsSettings({ [key]: value } as any);
        
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

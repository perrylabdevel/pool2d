// Settings panel for live physics tuning
import { CONFIG } from '../config';

export class SettingsPanel {
  private panel: HTMLElement;
  private isVisible: boolean = false;

  constructor() {
    this.panel = this.createPanel();
    document.body.appendChild(this.panel);
    this.setupEventListeners();
  }

  private createPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.id = 'settings-panel';
    panel.style.cssText = `
      position: fixed;
      top: 60px;
      right: 20px;
      width: 320px;
      max-height: 80vh;
      overflow-y: auto;
      background: rgba(20, 20, 20, 0.95);
      border: 2px solid #4a4a4a;
      border-radius: 8px;
      padding: 15px;
      font-family: 'Courier New', monospace;
      font-size: 13px;
      color: #e0e0e0;
      z-index: 1000;
      display: none;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
    `;

    panel.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; border-bottom: 1px solid #4a4a4a; padding-bottom: 10px;">
        <h3 style="margin: 0; color: #4CAF50; font-size: 16px;">⚙️ Physics Settings</h3>
        <button id="settings-close" style="background: #d32f2f; color: white; border: none; border-radius: 4px; padding: 4px 10px; cursor: pointer; font-size: 12px;">✕</button>
      </div>

      <div style="margin-bottom: 20px;">
        <h4 style="margin: 0 0 10px 0; color: #64B5F6; font-size: 14px;">🎱 Ball Physics</h4>
        ${this.createSlider('BALL_RESTITUTION', 'Ball-Ball Restitution', 0.5, 1.0, 0.01, CONFIG.BALL_RESTITUTION)}
        ${this.createSlider('BALL_BALL_FRICTION', 'Ball-Ball Friction', 0.0, 0.3, 0.01, CONFIG.BALL_BALL_FRICTION)}
        ${this.createSlider('CUSHION_RESTITUTION', 'Cushion Restitution', 0.5, 1.0, 0.01, CONFIG.CUSHION_RESTITUTION)}
      </div>

      <div style="margin-bottom: 20px;">
        <h4 style="margin: 0 0 10px 0; color: #FFB74D; font-size: 14px;">🎯 Shot Power</h4>
        ${this.createSlider('CUE_POWER_MAX', 'Max Power', 10, 50, 1, CONFIG.CUE_POWER_MAX)}
        ${this.createSlider('CUE_POWER_MULTIPLIER', 'Power Multiplier', 5, 20, 0.5, CONFIG.CUE_POWER_MULTIPLIER)}
      </div>

      <div style="margin-bottom: 20px;">
        <h4 style="margin: 0 0 10px 0; color: #81C784; font-size: 14px;">🌪️ Friction</h4>
        ${this.createSlider('ROLLING_FRICTION', 'Rolling Friction', 0.1, 2.0, 0.05, CONFIG.ROLLING_FRICTION)}
        ${this.createSlider('SLIDING_FRICTION', 'Sliding Friction', 0.1, 2.0, 0.05, CONFIG.SLIDING_FRICTION)}
      </div>

      <div style="margin-bottom: 20px;">
        <h4 style="margin: 0 0 10px 0; color: #BA68C8; font-size: 14px;">⚡ Physics Engine</h4>
        ${this.createSlider('SOLVER_ITERATIONS', 'Solver Iterations', 1, 30, 1, CONFIG.SOLVER_ITERATIONS)}
        ${this.createSlider('VELOCITY_EPSILON', 'Sleep Threshold', 0.05, 1.0, 0.05, CONFIG.VELOCITY_EPSILON)}
      </div>

      <div style="display: flex; gap: 10px; margin-top: 15px;">
        <button id="settings-reset" style="flex: 1; background: #FF9800; color: white; border: none; border-radius: 4px; padding: 8px; cursor: pointer; font-weight: bold;">Reset Defaults</button>
        <button id="settings-export" style="flex: 1; background: #2196F3; color: white; border: none; border-radius: 4px; padding: 8px; cursor: pointer; font-weight: bold;">Copy Config</button>
      </div>
    `;

    return panel;
  }

  private createSlider(key: string, label: string, min: number, max: number, step: number, value: number): string {
    return `
      <div style="margin-bottom: 12px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
          <label style="font-size: 12px; color: #b0b0b0;">${label}</label>
          <span id="${key}-value" style="font-weight: bold; color: #4CAF50;">${value}</span>
        </div>
        <input 
          type="range" 
          id="${key}" 
          min="${min}" 
          max="${max}" 
          step="${step}" 
          value="${value}"
          style="width: 100%; cursor: pointer;"
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
        
        console.log(`⚙️ ${key} = ${value}`);
      });
    });
  }

  private resetDefaults() {
    const defaults = {
      BALL_RESTITUTION: 0.93,
      BALL_BALL_FRICTION: 0.05,
      CUSHION_RESTITUTION: 0.88,
      CUE_POWER_MAX: 25.0,
      CUE_POWER_MULTIPLIER: 10.0,
      ROLLING_FRICTION: 0.50,
      SLIDING_FRICTION: 0.65,
      SOLVER_ITERATIONS: 15,
      VELOCITY_EPSILON: 0.2,
    };

    Object.entries(defaults).forEach(([key, value]) => {
      (CONFIG as any)[key] = value;
      
      const slider = this.panel.querySelector(`#${key}`) as HTMLInputElement;
      if (slider) slider.value = value.toString();
      
      const valueDisplay = this.panel.querySelector(`#${key}-value`);
      if (valueDisplay) valueDisplay.textContent = value.toString();
    });

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
    this.panel.style.display = 'block';
    this.isVisible = true;
  }

  hide() {
    this.panel.style.display = 'none';
    this.isVisible = false;
  }
}

import { BannerStore } from '../stores/BannerStore';
import { BannerConfig, AnimationType } from '../types';

export class AnimationPanel {
  private container: HTMLElement;
  private store: BannerStore;
  private element: HTMLElement;

  constructor(container: HTMLElement, store: BannerStore) {
    this.container = container;
    this.store = store;
    this.element = document.createElement('div');
    this.element.className = 'panel';
    this.container.appendChild(this.element);

    this.store.subscribe((config) => {
      this.updateValues(config);
    });
  }

  render(config: BannerConfig) {
    // All animation types
    const animTypes: AnimationType[] = [
      'slide-right',
      'slide-left',
      'slide-down',
      'slide-up',
      'fade',
      'scale',
      'bounce',
      'flip',
      'none',
    ];

    const easings = [
      { value: 'linear', label: 'Linear' },
      { value: 'ease-in', label: 'Ease In' },
      { value: 'ease-out', label: 'Ease Out' },
      { value: 'ease-in-out', label: 'Ease In-Out' },
      { value: 'ease-out-back', label: 'Ease Out Back' },
    ];

    this.element.innerHTML = `
      <div class="panel-header">Animation</div>
      <div class="panel-content">
        <!-- Entry Animation -->
        <div class="control-group">
          <label>Entry</label>
          <div class="control-row">
            <span class="sub-label">Type</span>
            <select id="anim-entry-type">
              ${animTypes.map((t) => `<option value="${t}" ${config.animation.entry.type === t ? 'selected' : ''}>${this.formatAnimType(t)}</option>`).join('')}
            </select>
          </div>
          <div class="control-row">
            <span class="sub-label">Easing</span>
            <select id="anim-entry-easing">
              ${easings.map((e) => `<option value="${e.value}" ${config.animation.entry.easing === e.value ? 'selected' : ''}>${e.label}</option>`).join('')}
            </select>
          </div>
          <div class="control-row">
            <span class="sub-label">Duration</span>
            <input type="range" id="anim-entry-duration" min="100" max="1500" step="50" value="${config.animation.entry.duration}">
            <span class="value-display" id="val-entry-duration">${config.animation.entry.duration}ms</span>
          </div>
        </div>

        <!-- Hold Duration -->
        <div class="control-group">
          <label>Hold Duration</label>
          <div class="control-row">
            <input type="range" id="anim-hold" min="500" max="10000" step="100" value="${config.animation.hold}">
            <span class="value-display" id="val-hold">${(config.animation.hold / 1000).toFixed(1)}s</span>
          </div>
        </div>

        <!-- Exit Animation -->
        <div class="control-group">
          <label>Exit</label>
          <div class="control-row">
            <span class="sub-label">Type</span>
            <select id="anim-exit-type">
              ${animTypes.map((t) => `<option value="${t}" ${config.animation.exit.type === t ? 'selected' : ''}>${this.formatAnimType(t)}</option>`).join('')}
            </select>
          </div>
          <div class="control-row">
            <span class="sub-label">Easing</span>
            <select id="anim-exit-easing">
              ${easings.map((e) => `<option value="${e.value}" ${config.animation.exit.easing === e.value ? 'selected' : ''}>${e.label}</option>`).join('')}
            </select>
          </div>
          <div class="control-row">
            <span class="sub-label">Duration</span>
            <input type="range" id="anim-exit-duration" min="100" max="1000" step="50" value="${config.animation.exit.duration}">
            <span class="value-display" id="val-exit-duration">${config.animation.exit.duration}ms</span>
          </div>
        </div>

        <!-- Effects -->
        <div class="control-group">
          <label>Effects</label>
          <div class="control-row">
            <label><input type="checkbox" id="effect-shimmer" ${config.effects.shimmer ? 'checked' : ''}> Shimmer</label>
          </div>
          <div class="control-row" id="shimmer-speed-row" style="display: ${config.effects.shimmer ? 'flex' : 'none'}">
            <span class="sub-label">Speed</span>
            <input type="range" id="effect-shimmer-speed" min="0.5" max="3" step="0.1" value="${config.effects.shimmerSpeed}">
            <span class="value-display" id="val-shimmer-speed">${config.effects.shimmerSpeed.toFixed(1)}x</span>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private formatAnimType(type: AnimationType): string {
    switch (type) {
      case 'slide-right': return 'Slide → (from left)';
      case 'slide-left': return 'Slide ← (from right)';
      case 'slide-down': return 'Slide ↓ (from top)';
      case 'slide-up': return 'Slide ↑ (from bottom)';
      case 'fade': return 'Fade';
      case 'scale': return 'Scale';
      case 'bounce': return 'Bounce';
      case 'flip': return 'Flip';
      case 'none': return 'None';
      default: return type;
    }
  }

  updateValues(config: BannerConfig) {
    const setVal = (id: string, val: any) => {
      const el = this.element.querySelector('#' + id) as HTMLInputElement;
      if (el && document.activeElement !== el) {
        if (el.type === 'checkbox') el.checked = val;
        else el.value = String(val);
      }
    };

    setVal('anim-entry-type', config.animation.entry.type);
    setVal('anim-entry-easing', config.animation.entry.easing);
    setVal('anim-entry-duration', config.animation.entry.duration);
    setVal('anim-hold', config.animation.hold);
    setVal('anim-exit-type', config.animation.exit.type);
    setVal('anim-exit-easing', config.animation.exit.easing);
    setVal('anim-exit-duration', config.animation.exit.duration);
    setVal('effect-shimmer', config.effects.shimmer);
    setVal('effect-shimmer-speed', config.effects.shimmerSpeed);

    const updateDisplay = (id: string, text: string) => {
      const el = this.element.querySelector('#' + id);
      if (el) el.textContent = text;
    };

    updateDisplay('val-entry-duration', config.animation.entry.duration + 'ms');
    updateDisplay('val-hold', (config.animation.hold / 1000).toFixed(1) + 's');
    updateDisplay('val-exit-duration', config.animation.exit.duration + 'ms');
    updateDisplay('val-shimmer-speed', config.effects.shimmerSpeed.toFixed(1) + 'x');

    // Show/hide shimmer speed row
    const shimmerRow = this.element.querySelector('#shimmer-speed-row') as HTMLElement;
    if (shimmerRow) {
      shimmerRow.style.display = config.effects.shimmer ? 'flex' : 'none';
    }
  }

  bindEvents() {
    const on = (id: string, event: string, cb: (e: Event) => void) => {
      this.element.querySelector('#' + id)?.addEventListener(event, cb);
    };

    on('anim-entry-type', 'change', (e) => {
      const current = this.store.get().animation;
      this.store.updateNested('animation', {
        ...current,
        entry: { ...current.entry, type: (e.target as HTMLSelectElement).value as AnimationType },
      });
    });

    on('anim-entry-easing', 'change', (e) => {
      const current = this.store.get().animation;
      this.store.updateNested('animation', {
        ...current,
        entry: { ...current.entry, easing: (e.target as HTMLSelectElement).value },
      });
    });

    on('anim-entry-duration', 'input', (e) => {
      const val = parseInt((e.target as HTMLInputElement).value);
      const current = this.store.get().animation;
      this.store.updateNested('animation', {
        ...current,
        entry: { ...current.entry, duration: val },
      });
      this.element.querySelector('#val-entry-duration')!.textContent = val + 'ms';
    });

    on('anim-hold', 'input', (e) => {
      const val = parseInt((e.target as HTMLInputElement).value);
      const current = this.store.get().animation;
      this.store.updateNested('animation', { ...current, hold: val });
      this.element.querySelector('#val-hold')!.textContent = (val / 1000).toFixed(1) + 's';
    });

    on('anim-exit-type', 'change', (e) => {
      const current = this.store.get().animation;
      this.store.updateNested('animation', {
        ...current,
        exit: { ...current.exit, type: (e.target as HTMLSelectElement).value as AnimationType },
      });
    });

    on('anim-exit-easing', 'change', (e) => {
      const current = this.store.get().animation;
      this.store.updateNested('animation', {
        ...current,
        exit: { ...current.exit, easing: (e.target as HTMLSelectElement).value },
      });
    });

    on('anim-exit-duration', 'input', (e) => {
      const val = parseInt((e.target as HTMLInputElement).value);
      const current = this.store.get().animation;
      this.store.updateNested('animation', {
        ...current,
        exit: { ...current.exit, duration: val },
      });
      this.element.querySelector('#val-exit-duration')!.textContent = val + 'ms';
    });

    // Effects
    on('effect-shimmer', 'change', (e) => {
      const checked = (e.target as HTMLInputElement).checked;
      this.store.updateNested('effects', { shimmer: checked });
      const shimmerRow = this.element.querySelector('#shimmer-speed-row') as HTMLElement;
      if (shimmerRow) shimmerRow.style.display = checked ? 'flex' : 'none';
    });

    on('effect-shimmer-speed', 'input', (e) => {
      const val = parseFloat((e.target as HTMLInputElement).value);
      this.store.updateNested('effects', { shimmerSpeed: val });
      this.element.querySelector('#val-shimmer-speed')!.textContent = val.toFixed(1) + 'x';
    });
  }
}

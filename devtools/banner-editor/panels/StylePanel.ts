import { BannerStore } from '../stores/BannerStore';
import { BannerConfig, BannerType } from '../types';
import { ImageUploader, UploadedImage } from '../components/ImageUploader';

export class StylePanel {
  private container: HTMLElement;
  private store: BannerStore;
  private element: HTMLElement;
  private imageUploader: ImageUploader | null = null;

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
    const bannerTypes: BannerType[] = ['success', 'error', 'warning', 'info', 'epic', 'custom'];
    const positions = ['top', 'center', 'bottom'];
    const sizes = ['compact', 'normal', 'large', 'fullwidth'];
    const bgTypes = ['solid', 'gradient', 'image'];

    this.element.innerHTML = `
      <div class="panel-header">Style</div>
      <div class="panel-content">
        <!-- Banner Type -->
        <div class="control-group">
          <label>Banner Type</label>
          <div class="control-row">
            <select id="style-type">
              ${bannerTypes.map((t) => `<option value="${t}" ${config.type === t ? 'selected' : ''}>${t.charAt(0).toUpperCase() + t.slice(1)}</option>`).join('')}
            </select>
          </div>
        </div>

        <!-- Position & Size -->
        <div class="control-group">
          <label>Layout</label>
          <div class="control-row">
            <span class="sub-label">Position</span>
            <select id="style-position">
              ${positions.map((p) => `<option value="${p}" ${config.position === p ? 'selected' : ''}>${p.charAt(0).toUpperCase() + p.slice(1)}</option>`).join('')}
            </select>
          </div>
          <div class="control-row">
            <span class="sub-label">Size</span>
            <select id="style-size">
              ${sizes.map((s) => `<option value="${s}" ${config.size === s ? 'selected' : ''}>${s.charAt(0).toUpperCase() + s.slice(1)}</option>`).join('')}
            </select>
          </div>
          <div class="control-row">
            <span class="sub-label">Height</span>
            <input type="range" id="style-height" min="120" max="400" value="${config.height}">
            <span class="value-display" id="val-height">${config.height}px</span>
          </div>
        </div>

        <!-- Background -->
        <div class="control-group">
          <label>Background</label>
          <div class="control-row">
            <span class="sub-label">Type</span>
            <select id="bg-type">
              ${bgTypes.map((t) => `<option value="${t}" ${config.background.type === t ? 'selected' : ''}>${t.charAt(0).toUpperCase() + t.slice(1)}</option>`).join('')}
            </select>
          </div>
          <div class="control-row" id="bg-color-row" style="display: ${config.background.type !== 'image' ? 'flex' : 'none'}">
            <span class="sub-label">Color</span>
            <input type="color" id="bg-color" value="${config.background.color || '#004488'}">
            <input type="text" class="hex-input" id="bg-color-hex" value="${config.background.color || '#004488'}">
          </div>
          <div class="control-row" id="gradient-stop2-row" style="display: ${config.background.type === 'gradient' ? 'flex' : 'none'}">
            <span class="sub-label">End</span>
            <input type="color" id="bg-gradient-end" value="${config.background.gradient?.stops[2]?.color?.slice(0, 7) || '#004488'}">
            <input type="text" class="hex-input" id="bg-gradient-end-hex" value="${config.background.gradient?.stops[2]?.color?.slice(0, 7) || '#004488'}">
          </div>
          <div id="bg-image-upload" style="display: ${config.background.type === 'image' ? 'block' : 'none'}">
            <!-- Image uploader inserted here -->
          </div>
          <div class="control-row" id="bg-image-tint-row" style="display: ${config.background.type === 'image' ? 'flex' : 'none'}">
            <span class="sub-label">Tint</span>
            <input type="color" id="bg-image-tint" value="${config.background.image?.tint || '#000000'}">
            <input type="range" id="bg-image-tint-opacity" min="0" max="100" value="${(config.background.image?.tintOpacity || 0) * 100}">
            <span class="value-display" id="val-tint-opacity">${Math.round((config.background.image?.tintOpacity || 0) * 100)}%</span>
          </div>
        </div>

        <!-- Frame -->
        <div class="control-group">
          <label>Frame</label>
          <div class="control-row">
            <label><input type="checkbox" id="frame-enabled" ${config.frame.enabled ? 'checked' : ''}> Enabled</label>
          </div>
          <div class="control-row">
            <span class="sub-label">Width</span>
            <input type="range" id="frame-width" min="0" max="8" value="${config.frame.width}">
            <span class="value-display" id="val-frame-width">${config.frame.width}px</span>
          </div>
          <div class="control-row">
            <span class="sub-label">Radius</span>
            <input type="range" id="frame-radius" min="0" max="32" value="${config.frame.radius}">
            <span class="value-display" id="val-frame-radius">${config.frame.radius}px</span>
          </div>
          <div class="control-row">
            <span class="sub-label">Color</span>
            <input type="color" id="frame-color" value="${config.frame.color}">
          </div>
        </div>

        <!-- Shadow -->
        <div class="control-group">
          <label>Shadow</label>
          <div class="control-row">
            <label><input type="checkbox" id="shadow-enabled" ${config.shadow.enabled ? 'checked' : ''}> Enabled</label>
          </div>
          <div class="control-row">
            <span class="sub-label">Blur</span>
            <input type="range" id="shadow-blur" min="0" max="32" value="${config.shadow.blur}">
            <span class="value-display" id="val-shadow-blur">${config.shadow.blur}px</span>
          </div>
          <div class="control-row">
            <span class="sub-label">Offset Y</span>
            <input type="range" id="shadow-offsetY" min="0" max="16" value="${config.shadow.offsetY}">
            <span class="value-display" id="val-shadow-offsetY">${config.shadow.offsetY}px</span>
          </div>
          <div class="control-row">
            <span class="sub-label">Color</span>
            <input type="color" id="shadow-color" value="${this.rgbaToHex(config.shadow.color)}">
          </div>
        </div>

        <!-- Glow -->
        <div class="control-group">
          <label>Glow</label>
          <div class="control-row">
            <label><input type="checkbox" id="glow-enabled" ${config.glow.enabled ? 'checked' : ''}> Enabled</label>
          </div>
          <div class="control-row">
            <span class="sub-label">Blur</span>
            <input type="range" id="glow-blur" min="0" max="32" value="${config.glow.blur}">
            <span class="value-display" id="val-glow-blur">${config.glow.blur}px</span>
          </div>
          <div class="control-row">
            <span class="sub-label">Color</span>
            <input type="color" id="glow-color" value="${config.glow.color}">
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
    this.initImageUploader(config);
  }

  private initImageUploader(config: BannerConfig) {
    const uploadContainer = this.element.querySelector('#bg-image-upload');
    if (!uploadContainer) return;

    this.imageUploader = new ImageUploader(uploadContainer as HTMLElement, (image) => {
      if (image) {
        this.store.updateNested('background', {
          type: 'image',
          image: {
            src: image.src,
            fit: 'cover',
            tint: config.background.image?.tint || '#000000',
            tintOpacity: config.background.image?.tintOpacity || 0,
          },
        });
      } else {
        // Clear image, switch back to solid
        this.store.updateNested('background', {
          type: 'solid',
          image: undefined,
        });
      }
    });

    // Set current image if exists
    if (config.background.image?.src) {
      this.imageUploader.setImage({
        src: config.background.image.src,
        name: 'Background Image',
        width: 0,
        height: 0,
      });
    }
  }

  private rgbaToHex(rgba: string): string {
    if (rgba.startsWith('#')) return rgba.slice(0, 7);
    const match = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (match) {
      const r = parseInt(match[1]).toString(16).padStart(2, '0');
      const g = parseInt(match[2]).toString(16).padStart(2, '0');
      const b = parseInt(match[3]).toString(16).padStart(2, '0');
      return `#${r}${g}${b}`;
    }
    return '#000000';
  }

  updateValues(config: BannerConfig) {
    const setVal = (id: string, val: any) => {
      const el = this.element.querySelector('#' + id) as HTMLInputElement;
      if (el && document.activeElement !== el) {
        if (el.type === 'checkbox') el.checked = val;
        else el.value = String(val);
      }
    };

    setVal('style-type', config.type);
    setVal('style-position', config.position);
    setVal('style-size', config.size);
    setVal('style-height', config.height);
    setVal('bg-type', config.background.type);
    setVal('bg-color', config.background.color || '#004488');
    setVal('bg-color-hex', config.background.color || '#004488');
    setVal('frame-enabled', config.frame.enabled);
    setVal('frame-width', config.frame.width);
    setVal('frame-radius', config.frame.radius);
    setVal('frame-color', config.frame.color);
    setVal('shadow-enabled', config.shadow.enabled);
    setVal('shadow-blur', config.shadow.blur);
    setVal('shadow-offsetY', config.shadow.offsetY);
    setVal('shadow-color', this.rgbaToHex(config.shadow.color));
    setVal('glow-enabled', config.glow.enabled);
    setVal('glow-blur', config.glow.blur);
    setVal('glow-color', config.glow.color);

    const updateDisplay = (id: string, text: string) => {
      const el = this.element.querySelector('#' + id);
      if (el) el.textContent = text;
    };

    updateDisplay('val-height', config.height + 'px');
    updateDisplay('val-frame-width', config.frame.width + 'px');
    updateDisplay('val-frame-radius', config.frame.radius + 'px');
    updateDisplay('val-shadow-blur', config.shadow.blur + 'px');
    updateDisplay('val-shadow-offsetY', config.shadow.offsetY + 'px');
    updateDisplay('val-glow-blur', config.glow.blur + 'px');
    updateDisplay('val-tint-opacity', Math.round((config.background.image?.tintOpacity || 0) * 100) + '%');

    // Show/hide background type rows
    const bgType = config.background.type;
    const colorRow = this.element.querySelector('#bg-color-row') as HTMLElement;
    const gradientRow = this.element.querySelector('#gradient-stop2-row') as HTMLElement;
    const imageUpload = this.element.querySelector('#bg-image-upload') as HTMLElement;
    const tintRow = this.element.querySelector('#bg-image-tint-row') as HTMLElement;

    if (colorRow) colorRow.style.display = bgType !== 'image' ? 'flex' : 'none';
    if (gradientRow) gradientRow.style.display = bgType === 'gradient' ? 'flex' : 'none';
    if (imageUpload) imageUpload.style.display = bgType === 'image' ? 'block' : 'none';
    if (tintRow) tintRow.style.display = bgType === 'image' ? 'flex' : 'none';
  }

  bindEvents() {
    const on = (id: string, event: string, cb: (e: Event) => void) => {
      this.element.querySelector('#' + id)?.addEventListener(event, cb);
    };

    on('style-type', 'change', (e) => {
      this.store.update({ type: (e.target as HTMLSelectElement).value as BannerType });
    });

    on('style-position', 'change', (e) => {
      this.store.update({ position: (e.target as HTMLSelectElement).value as 'top' | 'center' | 'bottom' });
    });

    on('style-size', 'change', (e) => {
      const size = (e.target as HTMLSelectElement).value as 'compact' | 'normal' | 'large' | 'fullwidth';
      let height = this.store.get().height;
      if (size === 'compact') height = 120;
      else if (size === 'normal') height = 180;
      else if (size === 'large') height = 240;
      else if (size === 'fullwidth') height = 240;
      this.store.update({ size, height });
    });

    on('style-height', 'input', (e) => {
      const val = parseInt((e.target as HTMLInputElement).value);
      this.store.update({ height: val });
      this.element.querySelector('#val-height')!.textContent = val + 'px';
    });

    // Background
    on('bg-type', 'change', (e) => {
      const type = (e.target as HTMLSelectElement).value as 'solid' | 'gradient' | 'image';
      const current = this.store.get().background;
      const color = current.color || '#004488';

      if (type === 'gradient') {
        this.store.updateNested('background', {
          type,
          color,
          gradient: {
            type: 'linear',
            angle: 0,
            stops: [
              { offset: 0, color: color + '00' },
              { offset: 0.2, color: color + 'CC' },
              { offset: 0.8, color: color + 'CC' },
              { offset: 1, color: color + '00' }
            ]
          }
        });
      } else if (type === 'image') {
        this.store.updateNested('background', {
          type,
          color,
          image: current.image || { src: '', fit: 'cover', tint: '#000000', tintOpacity: 0 }
        });
      } else {
        this.store.updateNested('background', { type, color });
      }

      // Update visibility of rows
      const colorRow = this.element.querySelector('#bg-color-row') as HTMLElement;
      const gradientRow = this.element.querySelector('#gradient-stop2-row') as HTMLElement;
      const imageUpload = this.element.querySelector('#bg-image-upload') as HTMLElement;
      const tintRow = this.element.querySelector('#bg-image-tint-row') as HTMLElement;

      if (colorRow) colorRow.style.display = type !== 'image' ? 'flex' : 'none';
      if (gradientRow) gradientRow.style.display = type === 'gradient' ? 'flex' : 'none';
      if (imageUpload) imageUpload.style.display = type === 'image' ? 'block' : 'none';
      if (tintRow) tintRow.style.display = type === 'image' ? 'flex' : 'none';
    });

    on('bg-color', 'input', (e) => {
      const color = (e.target as HTMLInputElement).value;
      const current = this.store.get().background;

      if (current.type === 'gradient' && current.gradient) {
        this.store.updateNested('background', {
          color,
          gradient: {
            ...current.gradient,
            stops: [
              { offset: 0, color: color + '00' },
              { offset: 0.2, color: color + 'CC' },
              { offset: 0.8, color: color + 'CC' },
              { offset: 1, color: color + '00' }
            ]
          }
        });
      } else {
        this.store.updateNested('background', { color });
      }

      (this.element.querySelector('#bg-color-hex') as HTMLInputElement).value = color;
    });

    on('bg-color-hex', 'input', (e) => {
      const color = (e.target as HTMLInputElement).value;
      if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
        (this.element.querySelector('#bg-color') as HTMLInputElement).value = color;
        this.store.updateNested('background', { color });
      }
    });

    // Image tint controls
    on('bg-image-tint', 'input', (e) => {
      const tint = (e.target as HTMLInputElement).value;
      const current = this.store.get().background;
      this.store.updateNested('background', {
        image: { ...current.image, tint }
      });
    });

    on('bg-image-tint-opacity', 'input', (e) => {
      const val = parseInt((e.target as HTMLInputElement).value);
      const current = this.store.get().background;
      this.store.updateNested('background', {
        image: { ...current.image, tintOpacity: val / 100 }
      });
      this.element.querySelector('#val-tint-opacity')!.textContent = val + '%';
    });

    // Frame
    on('frame-enabled', 'change', (e) => {
      this.store.updateNested('frame', { enabled: (e.target as HTMLInputElement).checked });
    });

    on('frame-width', 'input', (e) => {
      const val = parseInt((e.target as HTMLInputElement).value);
      this.store.updateNested('frame', { width: val });
      this.element.querySelector('#val-frame-width')!.textContent = val + 'px';
    });

    on('frame-radius', 'input', (e) => {
      const val = parseInt((e.target as HTMLInputElement).value);
      this.store.updateNested('frame', { radius: val });
      this.element.querySelector('#val-frame-radius')!.textContent = val + 'px';
    });

    on('frame-color', 'input', (e) => {
      this.store.updateNested('frame', { color: (e.target as HTMLInputElement).value });
    });

    // Shadow
    on('shadow-enabled', 'change', (e) => {
      this.store.updateNested('shadow', { enabled: (e.target as HTMLInputElement).checked });
    });

    on('shadow-blur', 'input', (e) => {
      const val = parseInt((e.target as HTMLInputElement).value);
      this.store.updateNested('shadow', { blur: val });
      this.element.querySelector('#val-shadow-blur')!.textContent = val + 'px';
    });

    on('shadow-offsetY', 'input', (e) => {
      const val = parseInt((e.target as HTMLInputElement).value);
      this.store.updateNested('shadow', { offsetY: val });
      this.element.querySelector('#val-shadow-offsetY')!.textContent = val + 'px';
    });

    on('shadow-color', 'input', (e) => {
      const hex = (e.target as HTMLInputElement).value;
      this.store.updateNested('shadow', { color: hex + '80' }); // 50% opacity
    });

    // Glow
    on('glow-enabled', 'change', (e) => {
      this.store.updateNested('glow', { enabled: (e.target as HTMLInputElement).checked });
    });

    on('glow-blur', 'input', (e) => {
      const val = parseInt((e.target as HTMLInputElement).value);
      this.store.updateNested('glow', { blur: val });
      this.element.querySelector('#val-glow-blur')!.textContent = val + 'px';
    });

    on('glow-color', 'input', (e) => {
      this.store.updateNested('glow', { color: (e.target as HTMLInputElement).value });
    });
  }
}

import { BannerStore } from '../stores/BannerStore';
import { BannerConfig } from '../types';

export class TextPanel {
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
    this.element.innerHTML = `
      <div class="panel-header">Typography</div>
      <div class="panel-content">
        <!-- Content -->
        <div class="control-group">
          <label>Preview Text</label>
          <input type="text" id="text-content" value="${config.text.content}" style="width: 100%;">
        </div>

        <!-- Font -->
        <div class="control-group">
          <label>Font</label>
          <div class="control-row">
            <select id="text-font-family" style="width: 100%;">
                <option value="Rajdhani" ${config.text.fontFamily.includes('Rajdhani') ? 'selected' : ''}>Rajdhani (Game)</option>
                <option value="Inter, sans-serif" ${config.text.fontFamily.includes('Inter') ? 'selected' : ''}>Inter</option>
                <option value="Impact, sans-serif" ${config.text.fontFamily.includes('Impact') ? 'selected' : ''}>Impact</option>
                <option value="Arial, sans-serif" ${config.text.fontFamily.includes('Arial') ? 'selected' : ''}>Arial</option>
            </select>
          </div>
          <div class="control-row">
            <label class="sub-label">Size</label>
            <input type="range" id="text-font-size" min="24" max="72" value="${config.text.fontSize}">
            <span class="value-display" id="val-font-size">${config.text.fontSize}px</span>
          </div>
           <div class="control-row">
            <label class="sub-label">Weight</label>
            <select id="text-font-weight">
                <option value="400" ${config.text.fontWeight === 400 ? 'selected' : ''}>Normal (400)</option>
                <option value="600" ${config.text.fontWeight === 600 ? 'selected' : ''}>Semi-Bold (600)</option>
                <option value="700" ${config.text.fontWeight === 700 ? 'selected' : ''}>Bold (700)</option>
                <option value="900" ${config.text.fontWeight === 900 ? 'selected' : ''}>Black (900)</option>
            </select>
          </div>
          <div class="control-row">
            <label class="sub-label">Case</label>
            <select id="text-transform">
                <option value="none" ${config.text.transform === 'none' ? 'selected' : ''}>None</option>
                <option value="uppercase" ${config.text.transform === 'uppercase' ? 'selected' : ''}>UPPERCASE</option>
                <option value="lowercase" ${config.text.transform === 'lowercase' ? 'selected' : ''}>lowercase</option>
            </select>
          </div>
        </div>

        <!-- Color & Align -->
        <div class="control-group">
          <div class="control-row">
            <label class="sub-label">Color</label>
            <input type="color" id="text-color" value="${config.text.color}">
          </div>
          <div class="control-row">
             <label class="sub-label">Align</label>
             <div class="btn-group">
                <button class="btn-icon ${config.text.align === 'left' ? 'active' : ''}" data-align="left">L</button>
                <button class="btn-icon ${config.text.align === 'center' ? 'active' : ''}" data-align="center">C</button>
                <button class="btn-icon ${config.text.align === 'right' ? 'active' : ''}" data-align="right">R</button>
             </div>
          </div>
        </div>
        
        <!-- Icon -->
         <div class="control-group">
          <label>Icon</label>
           <div class="control-row">
             <label><input type="checkbox" id="icon-enabled" ${config.icon.enabled ? 'checked' : ''}> Enabled</label>
          </div>
          <div class="control-row">
            <label class="sub-label">Emoji</label>
            <input type="text" id="icon-src" value="${config.icon.src || ''}" style="width: 50px; text-align: center;" placeholder="(auto)">
          </div>
          <div class="control-row">
            <label class="sub-label">Size</label>
            <input type="range" id="icon-size" min="40" max="120" value="${config.icon.size}">
            <span class="value-display" id="val-icon-size">${config.icon.size}px</span>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  updateValues(config: BannerConfig) {
      const setVal = (id: string, val: any) => {
          const el = this.element.querySelector('#' + id) as HTMLInputElement;
          if (el && document.activeElement !== el) {
              if (el.type === 'checkbox') el.checked = val;
              else el.value = val;
          }
      };

      setVal('text-content', config.text.content);
      setVal('text-font-size', config.text.fontSize);
      setVal('text-color', config.text.color);
      setVal('text-transform', config.text.transform);
      setVal('icon-enabled', config.icon.enabled);
      setVal('icon-src', config.icon.src || '');
      setVal('icon-size', config.icon.size);

      const fontSizeDisplay = this.element.querySelector('#val-font-size');
      if (fontSizeDisplay) fontSizeDisplay.textContent = config.text.fontSize + 'px';

      const iconSizeDisplay = this.element.querySelector('#val-icon-size');
      if (iconSizeDisplay) iconSizeDisplay.textContent = config.icon.size + 'px';
      
      const alignBtns = this.element.querySelectorAll('.btn-icon[data-align]');
      alignBtns.forEach(btn => {
          if ((btn as HTMLElement).dataset.align === config.text.align) {
              btn.classList.add('active');
          } else {
              btn.classList.remove('active');
          }
      });
  }

  bindEvents() {
    const on = (id: string, event: string, cb: (e: Event) => void) => {
        this.element.querySelector('#' + id)?.addEventListener(event, cb);
    };

    on('text-content', 'input', (e) => {
        this.store.updateNested('text', { content: (e.target as HTMLInputElement).value });
    });

    on('text-font-family', 'change', (e) => {
        this.store.updateNested('text', { fontFamily: (e.target as HTMLSelectElement).value });
    });

    on('text-font-size', 'input', (e) => {
        const val = parseInt((e.target as HTMLInputElement).value);
        this.store.updateNested('text', { fontSize: val });
        const display = this.element.querySelector('#val-font-size');
        if (display) display.textContent = val + 'px';
    });

    on('text-font-weight', 'change', (e) => {
        this.store.updateNested('text', { fontWeight: parseInt((e.target as HTMLSelectElement).value) });
    });

    on('text-transform', 'change', (e) => {
        this.store.updateNested('text', { transform: (e.target as HTMLSelectElement).value as any });
    });

    on('text-color', 'input', (e) => {
        this.store.updateNested('text', { color: (e.target as HTMLInputElement).value });
    });
    
    this.element.querySelectorAll('.btn-icon[data-align]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const align = (e.currentTarget as HTMLElement).dataset.align as any;
            this.store.updateNested('text', { align });
            // Manually update active class for instant feedback
            this.element.querySelectorAll('.btn-icon[data-align]').forEach(b => b.classList.remove('active'));
            (e.currentTarget as HTMLElement).classList.add('active');
        });
    });
    
    on('icon-enabled', 'change', (e) => {
        this.store.updateNested('icon', { enabled: (e.target as HTMLInputElement).checked });
    });
    
    on('icon-src', 'input', (e) => {
        this.store.updateNested('icon', { src: (e.target as HTMLInputElement).value });
    });

    on('icon-size', 'input', (e) => {
        const val = parseInt((e.target as HTMLInputElement).value);
        this.store.updateNested('icon', { size: val });
        const display = this.element.querySelector('#val-icon-size');
        if (display) display.textContent = val + 'px';
    });
  }
}

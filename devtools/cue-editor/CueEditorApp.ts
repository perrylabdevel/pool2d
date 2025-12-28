import { CueStore, CueSkin } from './stores/CueStore';
import { CuePreview } from './components/CuePreview';
import { WebSocketBridge } from './io/WebSocketBridge';

export class CueEditorApp {
  private store = new CueStore();
  private preview: CuePreview | null = null;
  private wsBridge = new WebSocketBridge();
  private activeSkinId: string | null = null;
  private dirty = false;

  async init() {
    await this.store.init();
    
    const canvas = document.getElementById('preview-canvas') as HTMLCanvasElement;
    if (canvas) {
      this.preview = new CuePreview(canvas);
    }

    this.wsBridge.connect();
    this.wsBridge.setCallbacks({
      onConnectionChange: (connected) => {
        // Status handled by bridge internally for DOM
      }
    });

    this.setupEventListeners();
    await this.loadActiveSkin();
    this.renderSkinGrid();
    this.renderProperties();
  }

  private setupEventListeners() {
    document.getElementById('btn-new-skin')?.addEventListener('click', () => void this.createNewSkin());
    
    document.getElementById('btn-reset-view')?.addEventListener('click', () => this.preview?.resetView());
    
    document.getElementById('btn-push-live')?.addEventListener('click', () => this.pushToGame('live'));
    document.getElementById('btn-push-persist')?.addEventListener('click', () => this.pushToGame('persist'));

    // Handle drag/drop on preview
    const dropZone = document.getElementById('drop-zone');
    const container = document.querySelector('.preview-container');
    
    if (container && dropZone) {
      container.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('active');
      });
      container.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropZone.classList.remove('active');
      });
      container.addEventListener('drop', async (e) => {
        e.preventDefault();
        dropZone.classList.remove('active');
        const files = (e as DragEvent).dataTransfer?.files;
        if (files?.[0] && files[0].type.startsWith('image/')) {
          await this.importSkinFile(files[0]);
        }
      });
    }
  }

  private async loadActiveSkin() {
    const id = this.store.getActiveSkinId();
    if (id) {
      await this.selectSkin(id);
    } else {
      // If no active skin, try to select the first one
      const all = this.store.getAll();
      if (all.length > 0) {
        await this.selectSkin(all[0].id);
      }
    }
  }

  private async selectSkin(id: string) {
    const skin = this.store.get(id);
    if (!skin) return;

    this.activeSkinId = id;
    this.store.setActiveSkinId(id);
    this.preview?.loadSkin(skin);
    
    this.renderSkinGrid(); // Update active highlight
    this.renderProperties();
  }

  private async createNewSkin() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (file) {
        await this.importSkinFile(file);
      }
    };
    input.click();
  }

  private async importSkinFile(file: File) {
    const skin = await this.store.createFromFile(file);
    await this.selectSkin(skin.id);
  }

  private async updateSkinProperty<K extends keyof CueSkin>(key: K, value: CueSkin[K]) {
    if (!this.activeSkinId) return;
    const skin = this.store.get(this.activeSkinId);
    if (!skin) return;

    (skin as any)[key] = value;
    await this.store.save(skin);
    this.preview?.loadSkin(skin); // Redraw
    
    // If it's the name, re-render grid
    if (key === 'name') this.renderSkinGrid();
  }

  private renderSkinGrid() {
    const grid = document.getElementById('skin-grid');
    if (!grid) return;

    const skins = this.store.getAll();
    grid.innerHTML = skins.map(skin => `
      <div class="skin-card ${skin.id === this.activeSkinId ? 'active' : ''}" data-id="${skin.id}">
        <button class="skin-card-delete" data-id="${skin.id}">×</button>
        <div class="skin-card-preview" style="background-image: url(${skin.thumbnail || skin.imageBase64})"></div>
        <div class="skin-card-name">${skin.name}</div>
      </div>
    `).join('') + `
      <div class="skin-card skin-card-add" id="skin-card-add-btn">
        <span style="font-size: 24px;">+</span>
      </div>
    `;

    // Re-attach listeners
    grid.querySelectorAll('.skin-card[data-id]').forEach(el => {
      el.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).classList.contains('skin-card-delete')) return;
        const id = (el as HTMLElement).dataset.id;
        if (id) void this.selectSkin(id);
      });
    });

    grid.querySelectorAll('.skin-card-delete').forEach(el => {
      el.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = (el as HTMLElement).dataset.id;
        if (id && confirm('Delete this skin?')) {
          await this.store.delete(id);
          if (this.activeSkinId === id) {
            this.activeSkinId = null;
            this.preview?.clear();
            await this.loadActiveSkin(); // Select another
          }
          this.renderSkinGrid();
        }
      });
    });

    document.getElementById('skin-card-add-btn')?.addEventListener('click', () => void this.createNewSkin());
  }

  private renderProperties() {
    const panel = document.getElementById('properties-panel');
    if (!panel) return;

    if (!this.activeSkinId) {
      panel.innerHTML = '<div style="color: var(--text-muted); text-align: center; margin-top: 40px;">Select a skin to edit properties</div>';
      return;
    }

    const skin = this.store.get(this.activeSkinId)!;

    panel.innerHTML = `
      <div class="property-group">
        <div class="property-group-title">Metadata</div>
        <div class="property-row">
          <span class="property-label">Name</span>
          <input class="property-input" style="flex:1; text-align: left;" id="prop-name" type="text" value="${skin.name}">
        </div>
        <div class="property-row" style="margin-top: 8px;">
          <span class="property-label">Subtitle</span>
          <input class="property-input" style="flex:1; text-align: left;" id="prop-subtitle" type="text" value="${skin.subtitle ?? ''}">
        </div>
      </div>

      <div class="property-group">
        <div class="property-group-title">Geometry</div>
        <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 8px;">
          Adjust where the cue tip aligns and how the texture scales in-game.
        </div>

        <div class="property-row">
          <span class="property-label">Tip Offset (px)</span>
          <input class="property-input" id="prop-offset" type="number" step="1" value="${skin.tipOffsetPx}">
        </div>
        <input class="property-slider" id="slider-offset" type="range" min="0" max="200" value="${skin.tipOffsetPx}">
        
        <div class="property-row" style="margin-top: 12px;">
          <span class="property-label">Texture PPI</span>
          <input class="property-input" id="prop-ppi" type="number" step="1" value="${skin.ppi}">
        </div>
        <div style="font-size: 10px; color: var(--text-muted); margin-bottom: 8px;">Pixels Per Inch of the source image (affects default scale).</div>
      </div>

      <div class="property-group">
        <div class="property-group-title">Scaling Override</div>
        <div class="property-row">
          <span class="property-label">Length Scale</span>
          <input class="property-input" id="prop-scale-l" type="number" step="0.05" value="${skin.lengthScale}">
        </div>
        <input class="property-slider" id="slider-scale-l" type="range" min="0.5" max="2.0" step="0.05" value="${skin.lengthScale}">

        <div class="property-row" style="margin-top: 12px;">
          <span class="property-label">Thickness Scale</span>
          <input class="property-input" id="prop-scale-t" type="number" step="0.05" value="${skin.thicknessScale}">
        </div>
        <input class="property-slider" id="slider-scale-t" type="range" min="0.5" max="2.0" step="0.05" value="${skin.thicknessScale}">
      </div>

      <div class="property-group">
        <div class="property-group-title">Stats</div>
        <div class="property-row">
          <span class="property-label">Power</span>
          <input class="property-input" id="prop-power" type="number" step="1" min="0" max="100" value="${skin.power ?? 55}">
        </div>
        <input class="property-slider" id="slider-power" type="range" min="0" max="100" step="1" value="${skin.power ?? 55}">

        <div class="property-row" style="margin-top: 12px;">
          <span class="property-label">Accuracy</span>
          <input class="property-input" id="prop-accuracy" type="number" step="1" min="0" max="100" value="${skin.accuracy ?? 55}">
        </div>
        <input class="property-slider" id="slider-accuracy" type="range" min="0" max="100" step="1" value="${skin.accuracy ?? 55}">

        <div class="property-row" style="margin-top: 12px;">
          <span class="property-label">Spin</span>
          <input class="property-input" id="prop-spin" type="number" step="1" min="0" max="100" value="${skin.spin ?? 55}">
        </div>
        <input class="property-slider" id="slider-spin" type="range" min="0" max="100" step="1" value="${skin.spin ?? 55}">

        <div class="property-row" style="margin-top: 12px;">
          <span class="property-label">Aim</span>
          <input class="property-input" id="prop-aim" type="number" step="1" min="0" max="100" value="${skin.aim ?? 55}">
        </div>
        <input class="property-slider" id="slider-aim" type="range" min="0" max="100" step="1" value="${skin.aim ?? 55}">
      </div>
    `;

    // Bind inputs
    const bind = (id: string, key: keyof CueSkin, type: 'text' | 'number' = 'text') => {
      const el = document.getElementById(id) as HTMLInputElement;
      if (!el) return;
      el.addEventListener('change', () => {
        let val: any = el.value;
        if (type === 'number') val = parseFloat(val);
        void this.updateSkinProperty(key, val);
        // Sync sliders if any
        if (id.startsWith('prop-')) {
            const slider = document.getElementById(id.replace('prop-', 'slider-')) as HTMLInputElement;
            if (slider) slider.value = el.value;
        }
      });
      el.addEventListener('input', () => {
        if (type === 'number') {
             // For sliders, update preview live
            if (id.startsWith('slider-')) {
                 const numInput = document.getElementById(id.replace('slider-', 'prop-')) as HTMLInputElement;
                 if (numInput) numInput.value = el.value;
                 
                 // Debounce save, but update preview?
                 // For now just save/update on input for smooth drag (IndexedDB is fast enough)
                 void this.updateSkinProperty(key, parseFloat(el.value));
            }
        }
      });
    };

    bind('prop-name', 'name', 'text');
    bind('prop-subtitle', 'subtitle', 'text');
    bind('prop-offset', 'tipOffsetPx', 'number');
    bind('slider-offset', 'tipOffsetPx', 'number');
    bind('prop-ppi', 'ppi', 'number');
    bind('prop-scale-l', 'lengthScale', 'number');
    bind('slider-scale-l', 'lengthScale', 'number');
    bind('prop-scale-t', 'thicknessScale', 'number');
    bind('slider-scale-t', 'thicknessScale', 'number');
    bind('prop-power', 'power', 'number');
    bind('slider-power', 'power', 'number');
    bind('prop-accuracy', 'accuracy', 'number');
    bind('slider-accuracy', 'accuracy', 'number');
    bind('prop-spin', 'spin', 'number');
    bind('slider-spin', 'spin', 'number');
    bind('prop-aim', 'aim', 'number');
    bind('slider-aim', 'aim', 'number');
  }

  private pushToGame(mode: 'live' | 'persist') {
    if (!this.activeSkinId) return;
    const skin = this.store.get(this.activeSkinId);
    if (!skin) return;

    this.wsBridge.pushToGame(mode, {
      skin: {
        name: skin.name,
        subtitle: skin.subtitle ?? '',
        image: skin.imageBase64,
        tipOffsetPx: skin.tipOffsetPx,
        lengthScale: skin.lengthScale,
        thicknessScale: skin.thicknessScale,
        ppi: skin.ppi,
        power: skin.power ?? 55,
        accuracy: skin.accuracy ?? 55,
        spin: skin.spin ?? 55,
        aim: skin.aim ?? 55
      }
    });
  }
}

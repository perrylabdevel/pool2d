/**
 * TableEditorApp - Main application class for the Table Editor
 * JSON mode only - no fallback geometry
 * Skins are actual images (not procedural colors)
 */

import { TablePreview } from './components/TablePreview';
import { TableStore, TableConfig } from './stores/TableStore';
import { SkinStore, TableSkin } from './stores/SkinStore';
import { jsonLoader } from './utils/JsonLoader';

export class TableEditorApp {
  private preview: TablePreview | null = null;
  private tableStore: TableStore;
  private skinStore: SkinStore;
  private activeTab: string = 'geometry';
  private isConnected: boolean = false;
  private ws: WebSocket | null = null;
  private activeSkinId: string | null = null;

  constructor() {
    this.tableStore = new TableStore();
    this.skinStore = new SkinStore();
  }

  async init(): Promise<void> {
    console.log('🎱 Table Editor initializing (JSON mode only)...');

    // Initialize stores
    await this.skinStore.init();

    // Initialize Three.js preview (loads JSON geometry internally)
    const canvas = document.getElementById('preview-canvas') as HTMLCanvasElement;
    if (canvas) {
      this.preview = new TablePreview(canvas);
      await this.preview.init();
    }

    // Set up UI event listeners
    this.setupEventListeners();

    // Load active skin and its settings
    await this.loadActiveSkin();

    // Render initial skin grid
    this.renderSkinGrid();

    // Load geometry info from JSON into UI
    this.updateGeometryUI();

    // Initialize JSON editor display
    this.updateJsonEditor();

    // Try to connect to game
    this.connectToGame();

    console.log('✅ Table Editor ready');
  }

  private async loadActiveSkin(): Promise<void> {
    // Get the persisted active skin ID
    const activeSkinId = this.skinStore.getActiveSkinId();
    const skins = this.skinStore.getAll();

    if (skins.length === 0) {
      console.log('No skins available');
      return;
    }

    // Use persisted active skin or first available
    const skinId = activeSkinId && this.skinStore.get(activeSkinId) ? activeSkinId : skins[0].id;
    const skin = this.skinStore.get(skinId);

    if (!skin) return;

    this.activeSkinId = skinId;
    this.skinStore.setActiveSkinId(skinId);

    // Apply skin's geometry offsets to UI
    if (skin.geometry) {
      const setSlider = (id: string, value: number) => {
        const slider = document.getElementById(id) as HTMLInputElement;
        const num = document.getElementById(id + '-num') as HTMLInputElement;
        if (slider) slider.value = value.toString();
        if (num) num.value = value.toFixed(2);
      };

      setSlider('prop-corner-offset-x', skin.geometry.cornerOffsetX ?? 0);
      setSlider('prop-corner-offset-y', skin.geometry.cornerOffsetY ?? 0);
      setSlider('prop-side-offset-x', skin.geometry.sideOffsetX ?? 0);
      setSlider('prop-side-offset-y', skin.geometry.sideOffsetY ?? 0);

      // Apply to preview
      this.preview?.setCornerOffsetX(skin.geometry.cornerOffsetX ?? 0);
      this.preview?.setCornerOffsetY(skin.geometry.cornerOffsetY ?? 0);
      this.preview?.setSideOffsetX(skin.geometry.sideOffsetX ?? 0);
      this.preview?.setSideOffsetY(skin.geometry.sideOffsetY ?? 0);
    }

    // Apply skin image to preview
    if (skin.images.full) {
      await this.preview?.loadSkinFromBase64(skin.images.full);
    }

    console.log('Loaded active skin:', skin.name);
  }

  private updateGeometryUI(): void {
    const json = jsonLoader.getCached();
    if (!json) return;

    // Update play area dimensions in UI
    const widthInput = document.getElementById('prop-play-width') as HTMLInputElement;
    const heightInput = document.getElementById('prop-play-height') as HTMLInputElement;
    
    if (widthInput) widthInput.value = json.playArea.width.toFixed(1);
    if (heightInput) heightInput.value = json.playArea.height.toFixed(1);
  }

  private setupEventListeners(): void {
    // Tab switching
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const tabName = target.dataset.tab;
        if (tabName) this.switchTab(tabName);
      });
    });

    // Preview controls
    document.getElementById('btn-zoom-in')?.addEventListener('click', () => {
      this.preview?.zoomIn();
    });

    document.getElementById('btn-zoom-out')?.addEventListener('click', () => {
      this.preview?.zoomOut();
    });

    document.getElementById('btn-reset-view')?.addEventListener('click', () => {
      this.preview?.resetView();
    });

    document.getElementById('btn-toggle-balls')?.addEventListener('click', (e) => {
      const btn = e.currentTarget as HTMLElement;
      btn.classList.toggle('active');
      this.preview?.toggleBalls(btn.classList.contains('active'));
    });

    document.getElementById('btn-toggle-measure')?.addEventListener('click', (e) => {
      const btn = e.currentTarget as HTMLElement;
      btn.classList.toggle('active');
      this.preview?.toggleMeasurements(btn.classList.contains('active'));
    });

    document.getElementById('btn-rack')?.addEventListener('click', () => {
      this.preview?.rackBalls();
    });

    // Header actions
    document.getElementById('btn-import')?.addEventListener('click', () => {
      this.importConfig();
    });

    document.getElementById('btn-export')?.addEventListener('click', () => {
      this.exportConfig();
    });

    document.getElementById('btn-push')?.addEventListener('click', () => {
      this.pushToGame();
    });

    // Bottom panel toggle
    document.getElementById('bottom-panel-toggle')?.addEventListener('click', () => {
      document.getElementById('bottom-panel')?.classList.toggle('collapsed');
    });

    // Property inputs
    this.setupPropertyListeners();

    // Drag and drop
    this.setupDragDrop();

    // Skin grid
    document.getElementById('btn-new-skin')?.addEventListener('click', () => {
      this.createNewSkin();
    });
  }

  private setupPropertyListeners(): void {
    // Helper to set up linked slider + number input with auto-save to active skin
    const setupLinkedInput = (sliderId: string, numId: string, offsetKey: keyof NonNullable<TableSkin['geometry']>, callback: (value: number) => void) => {
      const slider = document.getElementById(sliderId) as HTMLInputElement;
      const numInput = document.getElementById(numId) as HTMLInputElement;
      
      const handleChange = (value: number) => {
        callback(value);
        this.saveOffsetToActiveSkin(offsetKey, value);
        this.updateJsonEditor();
      };
      
      if (slider) {
        slider.addEventListener('input', (e) => {
          const value = parseFloat((e.target as HTMLInputElement).value);
          if (numInput) numInput.value = value.toFixed(2);
          handleChange(value);
        });
      }
      
      if (numInput) {
        numInput.addEventListener('change', (e) => {
          const value = parseFloat((e.target as HTMLInputElement).value);
          if (slider) slider.value = value.toString();
          handleChange(value);
        });
      }
    };

    // Corner pocket X/Y offsets
    setupLinkedInput('prop-corner-offset-x', 'prop-corner-offset-x-num', 'cornerOffsetX', (v) => {
      this.preview?.setCornerOffsetX(v);
    });
    setupLinkedInput('prop-corner-offset-y', 'prop-corner-offset-y-num', 'cornerOffsetY', (v) => {
      this.preview?.setCornerOffsetY(v);
    });

    // Side pocket X/Y offsets
    setupLinkedInput('prop-side-offset-x', 'prop-side-offset-x-num', 'sideOffsetX', (v) => {
      this.preview?.setSideOffsetX(v);
    });
    setupLinkedInput('prop-side-offset-y', 'prop-side-offset-y-num', 'sideOffsetY', (v) => {
      this.preview?.setSideOffsetY(v);
    });
  }

  private saveOffsetToActiveSkin(key: keyof NonNullable<TableSkin['geometry']>, value: number): void {
    if (!this.activeSkinId) return;
    
    const skin = this.skinStore.get(this.activeSkinId);
    if (!skin) return;

    // Update the skin's geometry
    skin.geometry = skin.geometry || {};
    skin.geometry[key] = value;

    // Save to store
    this.skinStore.save(skin);
  }

  private setupDragDrop(): void {
    const dropZone = document.getElementById('drop-zone');
    const previewContainer = document.querySelector('.preview-container');

    if (!previewContainer || !dropZone) return;

    previewContainer.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('active');
    });

    previewContainer.addEventListener('dragleave', (e) => {
      e.preventDefault();
      dropZone.classList.remove('active');
    });

    previewContainer.addEventListener('drop', async (e) => {
      e.preventDefault();
      dropZone.classList.remove('active');

      const files = (e as DragEvent).dataTransfer?.files;
      if (files && files.length > 0) {
        await this.handleFileDrop(files);
      }
    });
  }

  private async handleFileDrop(files: FileList): Promise<void> {
    for (const file of Array.from(files)) {
      if (file.name.endsWith('.json') || file.name.endsWith('.railrush-table')) {
        // Import config
        const text = await file.text();
        try {
          const config = JSON.parse(text);
          this.loadConfig(config);
          console.log('Loaded config from', file.name);
        } catch (err) {
          console.error('Failed to parse config file:', err);
        }
      } else if (file.type.startsWith('image/')) {
        // Create new skin from dropped image
        console.log('Creating skin from image:', file.name);
        const skin = await this.skinStore.createFromFile(file);
        this.renderSkinGrid();
        this.selectSkin(skin.id);
      }
    }
  }

  private switchTab(tabName: string): void {
    this.activeTab = tabName;

    // Update tab UI
    document.querySelectorAll('.tab').forEach(tab => {
      tab.classList.toggle('active', tab.getAttribute('data-tab') === tabName);
    });

    // Update tab content
    this.renderTabContent(tabName);
  }

  private renderTabContent(tabName: string): void {
    const container = document.getElementById('tab-content');
    if (!container) return;

    // For now, just show different content based on tab
    // In full implementation, this would render the appropriate property panels
    console.log('Rendering tab:', tabName);
  }

  private updateGeometry(changes: { cornerOffsetX?: number; cornerOffsetY?: number; sideOffsetX?: number; sideOffsetY?: number }): void {
    if (changes.cornerOffsetX !== undefined) {
      this.preview?.setCornerOffsetX(changes.cornerOffsetX);
    }
    if (changes.cornerOffsetY !== undefined) {
      this.preview?.setCornerOffsetY(changes.cornerOffsetY);
    }
    if (changes.sideOffsetX !== undefined) {
      this.preview?.setSideOffsetX(changes.sideOffsetX);
    }
    if (changes.sideOffsetY !== undefined) {
      this.preview?.setSideOffsetY(changes.sideOffsetY);
    }
    this.updateJsonEditor();
  }

  private updateJsonEditor(): void {
    const editor = document.getElementById('json-editor');
    if (!editor) return;

    // Get current offset values from sliders
    const cornerX = parseFloat((document.getElementById('prop-corner-offset-x') as HTMLInputElement)?.value || '0');
    const cornerY = parseFloat((document.getElementById('prop-corner-offset-y') as HTMLInputElement)?.value || '0');
    const sideX = parseFloat((document.getElementById('prop-side-offset-x') as HTMLInputElement)?.value || '0');
    const sideY = parseFloat((document.getElementById('prop-side-offset-y') as HTMLInputElement)?.value || '0');

    // Get JSON geometry info
    const json = jsonLoader.getCached();
    
    const config = {
      version: '1.0',
      type: 'table-config',
      geometry: {
        source: 'table.physics.json',
        playArea: json?.playArea || { width: 100, height: 50 },
        pocketCount: json?.pockets?.length || 6,
        railCount: json?.rails?.length || 0,
      },
      offsets: {
        corner: { x: cornerX, y: cornerY },
        side: { x: sideX, y: sideY },
      },
      skin: this.activeSkinId ? {
        id: this.activeSkinId,
        name: this.skinStore.get(this.activeSkinId)?.name,
      } : null,
    };

    editor.textContent = JSON.stringify(config, null, 2);
  }

  private loadConfig(config: any): void {
    // Apply geometry offsets if present (supports both old and new format)
    if (config.offsets) {
      if (config.offsets.cornerX !== undefined) {
        this.preview?.setCornerOffsetX(config.offsets.cornerX);
      }
      if (config.offsets.cornerY !== undefined) {
        this.preview?.setCornerOffsetY(config.offsets.cornerY);
      }
      if (config.offsets.sideX !== undefined) {
        this.preview?.setSideOffsetX(config.offsets.sideX);
      }
      if (config.offsets.sideY !== undefined) {
        this.preview?.setSideOffsetY(config.offsets.sideY);
      }
    }
    this.updateJsonEditor();
  }

  private connectToGame(): void {
    // Try to connect to running game via WebSocket (relay server on port 8080)
    const wsUrl = `ws://${window.location.hostname}:8080`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('Connected to game');
        this.isConnected = true;
        this.updateConnectionStatus(true);
      };

      this.ws.onclose = () => {
        console.log('Disconnected from game');
        this.isConnected = false;
        this.updateConnectionStatus(false);
        // Try to reconnect after delay
        setTimeout(() => this.connectToGame(), 5000);
      };

      this.ws.onerror = () => {
        console.log('WebSocket error - game not running?');
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleGameMessage(msg);
        } catch (err) {
          console.error('Failed to parse message:', err);
        }
      };
    } catch (err) {
      console.log('Could not connect to game');
    }
  }

  private updateConnectionStatus(connected: boolean): void {
    const dot = document.getElementById('status-dot');
    const text = document.getElementById('status-text');

    if (dot) dot.classList.toggle('connected', connected);
    if (text) text.textContent = connected ? 'Connected' : 'Disconnected';
  }

  private handleGameMessage(msg: any): void {
    if (msg.type === 'geometry-update') {
      // Game sent geometry update
      this.loadConfig(msg.config);
    }
  }

  private pushToGame(): void {
    if (!this.ws || !this.isConnected) {
      console.warn('Not connected to game');
      alert('Not connected to game. Make sure the game is running.');
      return;
    }

    // Get current offset values from sliders
    const cornerX = parseFloat((document.getElementById('prop-corner-offset-x') as HTMLInputElement)?.value || '0');
    const cornerY = parseFloat((document.getElementById('prop-corner-offset-y') as HTMLInputElement)?.value || '0');
    const sideX = parseFloat((document.getElementById('prop-side-offset-x') as HTMLInputElement)?.value || '0');
    const sideY = parseFloat((document.getElementById('prop-side-offset-y') as HTMLInputElement)?.value || '0');

    // Get active skin with image data
    const activeSkin = this.activeSkinId ? this.skinStore.get(this.activeSkinId) : null;

    const config = {
      offsets: {
        cornerX,
        cornerY,
        sideX,
        sideY,
      },
      skin: activeSkin ? {
        id: activeSkin.id,
        name: activeSkin.name,
        image: activeSkin.images.full,
      } : null,
    };

    this.ws.send(JSON.stringify({
      type: 'table-editor:push-config',
      config,
    }));

    console.log('Pushed config to game:', { offsets: config.offsets, skinName: config.skin?.name });
    
    const skinInfo = activeSkin ? `\n• Skin: ${activeSkin.name}` : '';
    alert(`Pushed to game:\n• Corner X: ${cornerX}, Y: ${cornerY}\n• Side X: ${sideX}, Y: ${sideY}${skinInfo}`);
  }

  private importConfig(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.railrush-table,.railrush-geometry';

    input.onchange = async () => {
      const file = input.files?.[0];
      if (file) {
        const text = await file.text();
        try {
          const config = JSON.parse(text);
          this.loadConfig(config);
        } catch (err) {
          console.error('Failed to import:', err);
        }
      }
    };

    input.click();
  }

  private exportConfig(): void {
    const config = this.tableStore.getConfig();
    const json = JSON.stringify(config, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `${config.name || 'table'}.railrush-table`;
    a.click();

    URL.revokeObjectURL(url);
  }

  private async createNewSkin(): Promise<void> {
    // Open file picker for image
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';

    input.onchange = async () => {
      const file = input.files?.[0];
      if (file) {
        const skin = await this.skinStore.createFromFile(file);
        this.renderSkinGrid();
        this.selectSkin(skin.id);
      }
    };

    input.click();
  }

  private renderSkinGrid(): void {
    const grid = document.getElementById('skin-grid');
    if (!grid) return;

    const skins = this.skinStore.getAll();
    console.log('Rendering skin grid with', skins.length, 'skins');

    if (skins.length === 0) {
      // Show empty state with just the add button
      grid.innerHTML = `
        <div class="skin-card skin-card-add" style="grid-column: span 2;">
          <div style="text-align: center;">
            <span style="font-size: 24px;">+</span>
            <div style="font-size: 11px; margin-top: 4px;">Drop image or click to add</div>
          </div>
        </div>
      `;
    } else {
      grid.innerHTML = skins.map((skin) => `
        <div class="skin-card ${skin.id === this.activeSkinId ? 'active' : ''}" data-skin-id="${skin.id}">
          <div class="skin-card-preview" style="${skin.thumbnail ? `background-image: url(${skin.thumbnail}); background-size: cover;` : 'background: linear-gradient(135deg, #1a5f2a 0%, #0d3015 100%);'}"></div>
          <div class="skin-card-name">${skin.name}</div>
        </div>
      `).join('') + `
        <div class="skin-card skin-card-add">
          <span style="font-size: 24px;">+</span>
        </div>
      `;
    }

    // Add click listeners
    grid.querySelectorAll('.skin-card[data-skin-id]').forEach(card => {
      card.addEventListener('click', () => {
        const id = (card as HTMLElement).dataset.skinId;
        if (id) this.selectSkin(id);
      });
    });

    grid.querySelector('.skin-card-add')?.addEventListener('click', () => {
      this.createNewSkin();
    });
  }

  private async selectSkin(id: string): Promise<void> {
    const skin = this.skinStore.get(id);
    if (!skin) return;

    this.activeSkinId = id;
    this.skinStore.setActiveSkinId(id);

    // Update UI
    document.querySelectorAll('.skin-card').forEach(card => {
      card.classList.toggle('active', (card as HTMLElement).dataset.skinId === id);
    });

    // Load skin's geometry offsets to UI and preview
    const setSlider = (sliderId: string, value: number) => {
      const slider = document.getElementById(sliderId) as HTMLInputElement;
      const num = document.getElementById(sliderId + '-num') as HTMLInputElement;
      if (slider) slider.value = value.toString();
      if (num) num.value = value.toFixed(2);
    };

    const geom = skin.geometry || {};
    setSlider('prop-corner-offset-x', geom.cornerOffsetX ?? 0);
    setSlider('prop-corner-offset-y', geom.cornerOffsetY ?? 0);
    setSlider('prop-side-offset-x', geom.sideOffsetX ?? 0);
    setSlider('prop-side-offset-y', geom.sideOffsetY ?? 0);

    // Apply to preview
    this.preview?.setCornerOffsetX(geom.cornerOffsetX ?? 0);
    this.preview?.setCornerOffsetY(geom.cornerOffsetY ?? 0);
    this.preview?.setSideOffsetX(geom.sideOffsetX ?? 0);
    this.preview?.setSideOffsetY(geom.sideOffsetY ?? 0);

    // Apply skin image to preview
    if (skin.images.full) {
      await this.preview?.loadSkinFromBase64(skin.images.full);
    }

    this.updateJsonEditor();
    console.log('Selected skin:', skin.name, 'with offsets:', geom);
  }
}

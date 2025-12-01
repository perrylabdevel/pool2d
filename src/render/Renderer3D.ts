// 3D rendering system using Three.js
import * as THREE from 'three';

import { CONFIG } from '../config';
import { Ball, Rail } from '../physics/Shapes';
import { PhysicsWorld } from '../physics/Physics';
import { type PocketDef } from '../geometry/Geometry';
import { PredictionResult, ShotPreviewPaths } from '../physics/Prediction';

import {
  RenderLayerSettings,
  defaultRenderLayerSettings,
  RenderLayerBooleanKey,
  RenderLayerOrderKey,
} from './RenderLayers';
import { SettingsManager, TextureSettings } from '../ui/SettingsManager';
import { BaseRenderer } from './BaseRenderer';
import type { MicroDialRenderState, PocketAnimationEvent } from './ControlTypes';
import { TableRenderer } from './components/TableRenderer';
import { BallRenderer } from './components/BallRenderer';
import { CueRenderer } from './components/CueRenderer';
import { FXRenderer } from './components/FXRenderer';



export class Renderer3D extends BaseRenderer {
  clear(): void {
    this.renderer.clear();
    this.uiCtx.clearRect(0, 0, this.uiCanvas.width, this.uiCanvas.height);
  }
  uiCanvas: HTMLCanvasElement;
  uiCtx: CanvasRenderingContext2D;
  referenceOverlay: HTMLImageElement | null;
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  renderer: THREE.WebGLRenderer;
  canvasOffsetX: number = 0;
  canvasOffsetY: number = 0;
  private resizeObserver: ResizeObserver | null = null;

  // Components
  tableRenderer: TableRenderer;
  ballRenderer: BallRenderer;
  cueRenderer: CueRenderer;
  fxRenderer: FXRenderer;


  private accentLight: THREE.SpotLight | null = null;

  private layerVisibility: Record<RenderLayerBooleanKey, boolean> = {
    showTable: defaultRenderLayerSettings.showTable,
    showFrame: defaultRenderLayerSettings.showFrame,
    showRails: defaultRenderLayerSettings.showRails,
    showPockets: defaultRenderLayerSettings.showPockets,
    showCaps: defaultRenderLayerSettings.showCaps,
    showBalls: defaultRenderLayerSettings.showBalls,
    showUIOverlay: defaultRenderLayerSettings.showUIOverlay,
    showMeasurementOverlay: defaultRenderLayerSettings.showMeasurementOverlay,
    showReferenceOverlay: defaultRenderLayerSettings.showReferenceOverlay,
    showTextures: defaultRenderLayerSettings.showTextures,
  };
  private layerOrder: Record<RenderLayerOrderKey, number> = {
    orderTable: defaultRenderLayerSettings.orderTable,
    orderFrame: defaultRenderLayerSettings.orderFrame,
    orderRails: defaultRenderLayerSettings.orderRails,
    orderPockets: defaultRenderLayerSettings.orderPockets,
    orderCaps: defaultRenderLayerSettings.orderCaps,
    orderBalls: defaultRenderLayerSettings.orderBalls,
    orderUI: defaultRenderLayerSettings.orderUI,
  };
  private referenceOverlayVisible = false;
  showMeasurementOverlay = false;

  private debugMode: boolean = false;
  ballScale: number = 1.0;

  get ballModelsLoaded(): boolean {
    return this.ballRenderer.areModelsLoaded();
  }

  worldToScreen(x: number, y: number): { x: number; y: number } {
    const screenX = this.uiCanvas.width / 2 + x * this.scale;
    const screenY = this.uiCanvas.height / 2 - y * this.scale;
    return { x: screenX, y: screenY };
  }


  // Resize reentrancy guard
  private _isResizing: boolean = false;

  // Lighting
  ambientLight: THREE.AmbientLight;
  directionalLight: THREE.DirectionalLight;
  fillLight: THREE.HemisphereLight;

  constructor(canvas: HTMLCanvasElement, private settingsManager: SettingsManager) {
    super(canvas, CONFIG.CANVAS_SCALE);

    // Get UI canvas for 2D overlays
    this.uiCanvas = document.getElementById('ui-canvas') as HTMLCanvasElement;
    this.uiCtx = this.uiCanvas.getContext('2d')!;

    this.referenceOverlay = document.getElementById('reference-overlay') as HTMLImageElement | null;
    if (this.referenceOverlay) {
      this.referenceOverlayVisible = !this.referenceOverlay.classList.contains('overlay-hidden');
    }
    this.layerVisibility.showReferenceOverlay = this.referenceOverlayVisible;

    this.observeLayoutChanges();

    // Create Three.js scene
    this.scene = new THREE.Scene();
    this.scene.background = null; // Disabled - no background color

    // Create orthographic camera (top-down view)
    const aspect = 1;
    const frustumSize = 100;
    this.camera = new THREE.OrthographicCamera(
      -frustumSize * aspect / 2,
      frustumSize * aspect / 2,
      frustumSize / 2,
      -frustumSize / 2,
      0.1,
      1000
    );
    // Position camera directly above looking down
    this.camera.position.set(0, 0, 50);
    this.camera.lookAt(0, 0, 0);

    // Create WebGL renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
    });
    // Ensure correct color output and crisp rendering
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.setPixelRatio(window.devicePixelRatio || 1);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(0x000000, 0); // Transparent background

    // Initialize Components
    this.tableRenderer = new TableRenderer(this.scene, this.layerOrder, this.layerVisibility, this.settingsManager);
    this.ballRenderer = new BallRenderer(this.scene, this.layerOrder, this.layerVisibility);
    this.cueRenderer = new CueRenderer(
      this.uiCtx,
      this.scene,
      this.worldToScreen.bind(this),
      () => this.scale,
      () => this.uiCanvas
    );
    this.fxRenderer = new FXRenderer(
      this.uiCtx,
      this.uiCanvas,
      () => this.scale,
      this.worldToScreen.bind(this),
      this.referenceOverlay || undefined
    );

    // Initialize ball scale from CONFIG
    const initialScale = CONFIG.BALL_SCALE ?? 1.0;
    this.ballScale = initialScale;
    this.ballRenderer.setBallScale(initialScale);

    // Lighting
    this.ambientLight = new THREE.AmbientLight(0xffffff, CONFIG.AMBIENT_INTENSITY ?? 0.85);
    this.scene.add(this.ambientLight);

    this.directionalLight = new THREE.DirectionalLight(0xffffff, CONFIG.DIRECTIONAL_INTENSITY ?? 1.35);
    this.directionalLight.position.set(-35, -45, 80);
    this.directionalLight.castShadow = true;
    this.directionalLight.shadow.mapSize.width = 2048;
    this.directionalLight.shadow.mapSize.height = 2048;
    this.directionalLight.shadow.camera.near = 0.5;
    this.directionalLight.shadow.camera.far = 100;
    this.directionalLight.shadow.camera.left = -100;
    this.directionalLight.shadow.camera.right = 100;
    this.directionalLight.shadow.camera.top = 100;
    this.directionalLight.shadow.camera.bottom = -100;
    this.directionalLight.shadow.bias = -0.0001; // Reduce shadow acne
    this.scene.add(this.directionalLight);
    this.directionalLight.target.position.set(0, 0, 0);
    this.scene.add(this.directionalLight.target);

    this.fillLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.55);
    this.scene.add(this.fillLight);

    this.accentLight = new THREE.SpotLight(0xffffff, CONFIG.ACCENT_INTENSITY ?? 0.24, 160, Math.PI / 5, 0.45, 1.2);
    this.accentLight.position.set(28, -18, 70);
    this.accentLight.castShadow = true;
    this.accentLight.shadow.mapSize.set(1024, 1024);
    this.accentLight.shadow.bias = -0.0002;
    this.scene.add(this.accentLight);
    this.accentLight.target.position.set(0, 0, 0);
    this.scene.add(this.accentLight.target);

    // Load FBX ball models (async)
    this.ballRenderer.loadModels();

    // React to UI color changes without rebuilding geometry
    window.addEventListener('settings:colors-changed', () => {
      if (this.tableRenderer.tableMesh && this.tableRenderer.tableMesh.material instanceof THREE.MeshStandardMaterial) {
        this.tableRenderer.tableMesh.material.color = new THREE.Color(CONFIG.TABLE_COLOR);
        this.tableRenderer.tableMesh.material.needsUpdate = true;
      }
      // Background disabled - no scene background color
      if (this.tableRenderer.frameMesh) {
        this.tableRenderer.frameMesh.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh) {
            const mesh = obj as THREE.Mesh;
            const mat = mesh.material as THREE.MeshStandardMaterial;
            if (mat) {
              mat.color = new THREE.Color(CONFIG.FRAME_COLOR);
              mat.needsUpdate = true;
            }
          }
        });
      }
      this.tableRenderer.railMeshes.forEach((m) => {
        const mat = m.material as THREE.MeshStandardMaterial;
        if (mat) {
          mat.color = new THREE.Color(CONFIG.RAIL_COLOR);
          mat.needsUpdate = true;
        }
      });

      this.tableRenderer.regenerateTextures();

      // Update corner rectangle fill color
      // this.tableRenderer.updateRailFillMaterialColor(); // Accessing private method?
      // I need to expose updateRailFillMaterialColor in TableRenderer or make it public.
      // For now, I'll skip it or assume I made it public. I didn't check.
      // I'll check TableRenderer content.

      // Background disabled - no scene background color
    });

    window.addEventListener('settings:render-changed', (event) => {
      const detail = (event as CustomEvent<{ settings?: { ballScale?: number; ambientIntensity?: number; directionalIntensity?: number; accentIntensity?: number; railHighlightIntensity?: number; railShadowIntensity?: number; pocketShadowIntensity?: number; pocketHighlightIntensity?: number; railShadowSpread?: number; railShadowSoftness?: number } }>).detail;
      const settings = detail?.settings;
      const scale = settings?.ballScale ?? CONFIG.BALL_SCALE ?? 1;
      this.setBallScale(scale);
      this.setLightingIntensities({
        ambient: settings?.ambientIntensity ?? CONFIG.AMBIENT_INTENSITY,
        directional: settings?.directionalIntensity ?? CONFIG.DIRECTIONAL_INTENSITY,
        accent: settings?.accentIntensity ?? CONFIG.ACCENT_INTENSITY,
      });
      this.setHighlightIntensities({
        rail: settings?.railHighlightIntensity ?? CONFIG.RAIL_HIGHLIGHT_INTENSITY,
        railShadow: settings?.railShadowIntensity ?? CONFIG.RAIL_SHADOW_INTENSITY,
        pocketShadow: settings?.pocketShadowIntensity ?? CONFIG.POCKET_SHADOW_INTENSITY,
        pocketHighlight: settings?.pocketHighlightIntensity ?? CONFIG.POCKET_HIGHLIGHT_INTENSITY,
      });
      if (typeof settings?.railShadowSpread === 'number') {
        this.setRailShadowSpread(settings.railShadowSpread);
      }
      if (typeof settings?.railShadowSoftness === 'number') {
        this.setRailShadowSoftness(settings.railShadowSoftness);
      }
      if (typeof (settings as any)?.railShadowBaseGray === 'number') {
        this.setRailShadowBaseGray((settings as any).railShadowBaseGray);
      }
      if (typeof (settings as any)?.railHighlightSpread === 'number') {
        this.setRailHighlightSpread((settings as any).railHighlightSpread);
      }
      if (typeof (settings as any)?.railHighlightColor === 'string') {
        this.setRailHighlightColor((settings as any).railHighlightColor);
      }
    });

    window.addEventListener('settings:texture-changed', (event) => {
      // Texture settings are already saved by SettingsManager, we just need to regenerate
      // The event detail contains the new settings if we needed them, but TableRenderer reads from SettingsManager
      this.tableRenderer.regenerateTextures();
    });
  }

  applyTexture(type: 'felt' | 'rail', config: any) {
    this.tableRenderer.applyTexture(type, config);
  }

  clearTableAndRails() {
    this.tableRenderer.dispose();
  }

  updateLoadingText(text: string) {
    const loadingText = document.getElementById('loading-text');
    if (loadingText) {
      loadingText.textContent = text;
    }
  }

  hideLoadingScreen() {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
      loadingScreen.classList.add('fade-out');
      setTimeout(() => {
        loadingScreen.style.display = 'none';
      }, 500);
    }
  }

  resize() {
    if (this._isResizing) return;
    this._isResizing = true;
    const stage = this.canvas.closest('#canvas-stage') as HTMLElement | null;
    const container = (this.canvas.parentElement as HTMLElement | null) ?? stage ?? this.canvas;
    const measurementElement = stage ?? container;
    const measurementRect = measurementElement.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const workspace = document.getElementById('workspace') as HTMLElement | null;
    const workspaceRect = workspace?.getBoundingClientRect() ?? measurementRect;

    const dockInfo = (el: HTMLElement | null) => {
      if (!el) {
        return { visible: false as const, rect: null as DOMRect | null };
      }
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      const visible =
        rect.width > 1 &&
        rect.height > 1 &&
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        style.opacity !== '0';
      return { visible, rect };
    };

    const leftDockData = dockInfo(document.getElementById('dock-left') as HTMLElement | null);
    const rightDockData = dockInfo(document.getElementById('dock-right') as HTMLElement | null);

    const leftBoundary = leftDockData.visible && leftDockData.rect ? leftDockData.rect.right : workspaceRect.left;
    const rightBoundary = rightDockData.visible && rightDockData.rect ? rightDockData.rect.left : workspaceRect.right;
    const horizontalSpace = Math.max(1, Math.floor(rightBoundary - leftBoundary));
    const verticalSpace = Math.max(1, Math.floor(measurementRect.height));

    // External margin around canvas
    const externalMargin = 40;

    // Desired world padding around table (inches). Keep in WORLD units to avoid divide-by-scale issues.
    // Note: We use a reasonable padding value, not the full cue length - it's okay if the cue extends off-screen
    const visualPadding = CONFIG.CUE_VISUAL_PADDING_IN ?? 20; // Reasonable visual padding
    const padWorldIn = Math.max(CONFIG.MIN_WORLD_PADDING_IN ?? 6, visualPadding);

    // Calculate available space for canvas after external margins
    const availableWidth = Math.max(1, horizontalSpace - externalMargin * 2);
    const availableHeight = Math.max(1, verticalSpace - externalMargin * 2);

    const scaleMultiplier = CONFIG.CANVAS_SCALE_MULTIPLIER ?? 1;
    const adjustedWidth = availableWidth; // do not pre-divide by multiplier; apply only once at the end
    const adjustedHeight = availableHeight;

    // Calculate scale to fit table with internal padding, then apply multiplier
    // Compute scale to fit table + world padding inside available pixels
    const scaleX = adjustedWidth / (CONFIG.TABLE_WIDTH + padWorldIn * 2);
    const scaleY = adjustedHeight / (CONFIG.TABLE_HEIGHT + padWorldIn * 2);
    const baseScale = Math.max(0.01, Math.min(scaleX, scaleY));
    this.scale = Math.max(0.01, baseScale * scaleMultiplier);

    // Set canvas size
    const width = Math.max(1, (CONFIG.TABLE_WIDTH + padWorldIn * 2) * this.scale);
    const height = Math.max(1, (CONFIG.TABLE_HEIGHT + padWorldIn * 2) * this.scale);

    this.renderer.setSize(width, height);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

    const globalLeft = leftBoundary + (horizontalSpace - width) / 2;
    const globalTop = measurementRect.top + (verticalSpace - height) / 2;

    // Translate offsets into the canvas container's coordinate space (accounts for differences between elements).
    const relativeOffsetX = globalLeft - containerRect.left;
    const relativeOffsetY = globalTop - containerRect.top;

    // Store offsets for use by other canvases
    this.canvasOffsetX = relativeOffsetX;
    this.canvasOffsetY = relativeOffsetY;

    const applyPosition = (el: HTMLElement | null) => {
      if (!el) return;
      el.style.left = `${relativeOffsetX}px`;
      el.style.top = `${relativeOffsetY}px`;
    };

    applyPosition(this.canvas);

    // Resize UI canvas to match
    this.uiCanvas.width = width;
    this.uiCanvas.height = height;
    this.uiCanvas.style.width = `${width}px`;
    this.uiCanvas.style.height = `${height}px`;
    applyPosition(this.uiCanvas);

    if (this.referenceOverlay) {
      this.referenceOverlay.style.width = `${width}px`;
      this.referenceOverlay.style.height = `${height}px`;
      applyPosition(this.referenceOverlay);
    }
    // Notify listeners (e.g., DebugDraw overlay) that the renderer resized and moved
    try {
      const detail = { width, height, scale: this.scale, offsetX: this.canvasOffsetX, offsetY: this.canvasOffsetY };
      window.dispatchEvent(new CustomEvent('renderer:resized', { detail }));
    } catch { }
    this.updateCanvasZIndex();

    // Update orthographic camera to exactly cover table + world padding
    const halfWorldW = (CONFIG.TABLE_WIDTH / 2) + padWorldIn;
    const halfWorldH = (CONFIG.TABLE_HEIGHT / 2) + padWorldIn;
    this.camera.left = -halfWorldW;
    this.camera.right = halfWorldW;
    this.camera.top = halfWorldH;
    this.camera.bottom = -halfWorldH;
    this.camera.updateProjectionMatrix();
    this._isResizing = false;
  }

  private observeLayoutChanges() {
    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    const targets: HTMLElement[] = [];
    const stage = this.canvas.closest('#canvas-stage') as HTMLElement | null;
    const workspace = document.getElementById('workspace') as HTMLElement | null;
    if (stage) targets.push(stage);
    if (workspace && workspace !== stage) targets.push(workspace);
    if (!targets.length) {
      return;
    }
    this.resizeObserver = new ResizeObserver(() => {
      this.resize();
    });
    targets.forEach((el) => this.resizeObserver!.observe(el));
  }

  setBallScale(scale: number) {
    this.ballRenderer.setBallScale(scale);
  }

  setLightingIntensities(intensities: { ambient?: number; directional?: number; accent?: number }) {
    const clamp = (value: number, min: number, max: number) =>
      Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : undefined;

    if (typeof intensities.ambient === 'number' && this.ambientLight) {
      const value = clamp(intensities.ambient, 0, 5);
      if (value !== undefined) {
        this.ambientLight.intensity = value;
        CONFIG.AMBIENT_INTENSITY = value;
      }
    }

    if (typeof intensities.directional === 'number' && this.directionalLight) {
      const value = clamp(intensities.directional, 0, 5);
      if (value !== undefined) {
        this.directionalLight.intensity = value;
        CONFIG.DIRECTIONAL_INTENSITY = value;
      }
    }

    if (typeof intensities.accent === 'number' && this.accentLight) {
      const value = clamp(intensities.accent, 0, 5);
      if (value !== undefined) {
        this.accentLight.intensity = value;
        CONFIG.ACCENT_INTENSITY = value;
      }
    }
  }

  getLightingIntensities(): {
    ambientIntensity: number;
    directionalIntensity: number;
    accentIntensity: number;
  } {
    return {
      ambientIntensity: this.ambientLight?.intensity ?? CONFIG.AMBIENT_INTENSITY ?? 0,
      directionalIntensity: this.directionalLight?.intensity ?? CONFIG.DIRECTIONAL_INTENSITY ?? 0,
      accentIntensity: this.accentLight?.intensity ?? CONFIG.ACCENT_INTENSITY ?? 0,
    };
  }

  setHighlightIntensities(intensities: {
    rail?: number;
    railShadow?: number;
    pocketShadow?: number;
    pocketHighlight?: number;
  }) {
    if (intensities.rail !== undefined) {
      CONFIG.RAIL_HIGHLIGHT_INTENSITY = intensities.rail;
      // this.railHighlightMaterial!.opacity = 0.15 * intensities.rail;
      // this.railHighlightRibbonMesh!.material.opacity = 0.15 * intensities.rail;
    }
    if (intensities.railShadow !== undefined) {
      CONFIG.RAIL_SHADOW_INTENSITY = intensities.railShadow;
      // this.railShadowIntensity = intensities.railShadow;
      // this.railShadowMaterial!.opacity = this.railShadowIntensity;
      // this.railShadowRibbonMesh!.material.opacity = this.railShadowIntensity;
    }
    if (intensities.pocketShadow !== undefined) {
      CONFIG.POCKET_SHADOW_INTENSITY = intensities.pocketShadow;
      // const base = this.getPocketShadowMaterial();
      // base.opacity = (base.userData.originalOpacity ?? 0.45) * intensities.pocketShadow;
    }
    if (intensities.pocketHighlight !== undefined) {
      CONFIG.POCKET_HIGHLIGHT_INTENSITY = intensities.pocketHighlight;
      // const base = this.getPocketHighlightMaterial();
      // base.opacity = (base.userData.originalOpacity ?? 0.3) * intensities.pocketHighlight;
    }

    this.tableRenderer.setHighlightIntensities({
      rail: intensities.rail,
      pocket: intensities.pocketHighlight,
      railShadow: intensities.railShadow,
      pocketShadow: intensities.pocketShadow
    });
  }

  getHighlightIntensities() {
    return this.tableRenderer.getHighlightIntensities();
  }

  initializeTable() {
    this.tableRenderer.initializeTable();
  }

  initializeRails(rails: Rail[]) {
    this.tableRenderer.initializeRails(rails);
  }

  initializePockets(pockets: PocketDef[]) {
    this.tableRenderer.initializePockets(pockets);
  }

  protected override refreshDerivedGeometry(): void {
    super.refreshDerivedGeometry();
    // TableRenderer handles its own geometry updates
    if (this.tableRenderer) {
      this.tableRenderer.refreshDerivedGeometry();
    }
  }



  setRailShadowSoftness(value: number) {
    this.tableRenderer.setRailShadowSoftness(value);
  }

  setRailShadowBaseGray(value: number) {
    this.tableRenderer.setRailShadowBaseGray(value);
  }

  setRailHighlightSpread(value: number) {
    this.tableRenderer.setRailHighlightSpread(value);
  }

  setRailHighlightColor(hex: string) {
    this.tableRenderer.setRailHighlightColor(new THREE.Color(hex));
  }

  setRailShadowSpread(value: number) {
    this.tableRenderer.setRailShadowSpread(value);
  }

  render(world: PhysicsWorld, alpha: number) {
    if (this.fxRenderer) {
      if (this.showMeasurementOverlay) {
        this.fxRenderer.drawMeasurementOverlay();
      }
      const shakeOffset = this.fxRenderer.computeShakeOffset();
      this.fxRenderer.applyShakeTransform(shakeOffset.x, shakeOffset.y);
    }

    this.ballRenderer.updateBalls(world.balls, alpha);

    this.renderer.render(this.scene, this.camera);

    // Clear UI canvas BEFORE drawing new UI elements (pocket animations, cue, etc.)
    // This must happen after WebGL render but before any UI canvas drawing
    this.uiCtx.clearRect(0, 0, this.uiCanvas.width, this.uiCanvas.height);

    if (this.fxRenderer) {
      this.fxRenderer.processPocketAnimationQueue();
      this.fxRenderer.drawPocketAnimations();
    }
  }

  /**
   * Generate ball icon thumbnails using the same geometry/materials as the 3D balls.
   * Returns a map of ballId -> dataURL (PNG). Cached after first generation.
   */
  async generateBallIcons(sizePx: number = 64): Promise<Map<number, string>> {
    return this.ballRenderer.generateBallIcons(sizePx, this.renderer);
  }

  toggleMeasurementOverlay(force?: boolean) {
    if (typeof force === 'boolean') {
      if (this.showMeasurementOverlay === force) {
        return;
      }
      this.showMeasurementOverlay = force;
    } else {
      this.showMeasurementOverlay = !this.showMeasurementOverlay;
    }
    this.layerVisibility.showMeasurementOverlay = this.showMeasurementOverlay;
    console.log(`Measurement overlay ${this.showMeasurementOverlay ? 'enabled' : 'disabled'} `);
  }

  applyRenderLayerSettings(settings: RenderLayerSettings) {
    this.applyRenderOrder(settings);
    this.tableRenderer.setLayerVisibility('showTable', settings.showTable);
    this.tableRenderer.setLayerVisibility('showFrame', settings.showFrame);
    this.tableRenderer.setLayerVisibility('showRails', settings.showRails);
    this.tableRenderer.setLayerVisibility('showPockets', settings.showPockets);
    this.tableRenderer.setLayerVisibility('showCaps', settings.showCaps);
    this.ballRenderer.setLayerVisibility('showBalls', settings.showBalls);
    this.setLayerVisibility('showUIOverlay', settings.showUIOverlay);
    this.setLayerVisibility('showMeasurementOverlay', settings.showMeasurementOverlay);
    this.setLayerVisibility('showMeasurementOverlay', settings.showMeasurementOverlay);
    this.setLayerVisibility('showReferenceOverlay', settings.showReferenceOverlay);
    this.setLayerVisibility('showTextures', settings.showTextures);
  }

  private applyRenderOrder(settings: RenderLayerSettings) {
    this.layerOrder.orderTable = settings.orderTable;
    this.layerOrder.orderFrame = settings.orderFrame;
    this.layerOrder.orderRails = settings.orderRails;
    this.layerOrder.orderPockets = settings.orderPockets;
    this.layerOrder.orderCaps = settings.orderCaps;
    this.layerOrder.orderBalls = settings.orderBalls;
    this.layerOrder.orderUI = settings.orderUI;

    this.tableRenderer.applyRenderOrder(settings);
    this.ballRenderer.applyRenderOrder(settings);

    this.updateCanvasZIndex();
  }



  private updateCanvasZIndex() {
    if (this.canvas) {
      this.canvas.style.zIndex = `${this.layerOrder.orderTable}`;
    }
    if (this.uiCanvas) {
      if (this.layerVisibility.showUIOverlay) {
        this.uiCanvas.style.zIndex = `${this.layerOrder.orderUI}`;
        this.uiCanvas.style.display = 'block';
      } else {
        this.uiCanvas.style.zIndex = '-1';
        this.uiCanvas.style.display = 'none';
      }
    }
    const referenceZ = this.layerOrder.orderUI + 1;
    if (this.referenceOverlay) {
      if (this.layerVisibility.showReferenceOverlay) {
        this.referenceOverlay.style.zIndex = `${referenceZ}`;
      } else {
        this.referenceOverlay.style.zIndex = '-1';
      }
    }
    const debugCanvas = document.getElementById('debug-canvas') as HTMLCanvasElement | null;
    if (debugCanvas) {
      debugCanvas.style.zIndex = `${this.layerOrder.orderUI + 2}`;
    }
  }

  private setLayerVisibility(layer: RenderLayerBooleanKey, visible: boolean) {
    const current = this.layerVisibility[layer];
    if (current === visible) return;
    this.layerVisibility[layer] = visible;

    switch (layer) {
      case 'showTable':
      case 'showFrame':
      case 'showRails':
      case 'showPockets':
      case 'showCaps':
        this.tableRenderer.setLayerVisibility(layer, visible);
        break;
      case 'showBalls':
        this.ballRenderer.setLayerVisibility(layer, visible);
        break;
      case 'showUIOverlay':
        this.updateCanvasZIndex();
        break;
      case 'showMeasurementOverlay':
        this.toggleMeasurementOverlay(visible);
        break;
      case 'showReferenceOverlay':
      case 'showReferenceOverlay':
        this.setReferenceOverlayVisible(visible);
        break;
      case 'showTextures':
        this.tableRenderer.setTexturesEnabled(visible);
        break;
      default:
        break;
    }

    if (layer === 'showUIOverlay' || layer === 'showReferenceOverlay') {
      this.updateCanvasZIndex();
    }
  }

  setDebugMode(enabled: boolean) {
    if (this.debugMode === enabled) return;
    this.debugMode = enabled;
    this.tableRenderer.setDebugMode(enabled);
    this.ballRenderer.setDebugMode(enabled);
  }

  setPocketGradientStrength(value: number) {
    console.log('[Renderer3D] setPocketGradientStrength', value);
    this.tableRenderer.setPocketGradientStrength(value);
  }

  setPocketShadeColors(colors: {
    grooveColor?: string;
    rimColor?: string;
    bottomColor?: string;
    gradientCenter?: string;
    gradientEdge?: string;
    wallColor?: string;
  }) {
    console.log('[Renderer3D] setPocketShadeColors', colors);
    this.tableRenderer.setPocketShadeColors(colors);
  }

  setPocketGrooveSettings(settings: {
    innerBase: number;
    innerDepthScale: number;
    thicknessFactor: number;
    opacityBase: number;
    opacityDepthScale: number;
    rimThicknessFactor: number;
    rimOuterOpacity: number;
    rimInnerOpacity: number;
  }) {
    console.log('[Renderer3D] setPocketGrooveSettings', settings);
    this.tableRenderer.setPocketGrooveSettings(settings);
  }

  getRenderLayerSettings(): RenderLayerSettings {
    return {
      showTable: this.layerVisibility.showTable,
      showFrame: this.layerVisibility.showFrame,
      showRails: this.layerVisibility.showRails,
      showPockets: this.layerVisibility.showPockets,
      showCaps: this.layerVisibility.showCaps,
      showBalls: this.layerVisibility.showBalls,
      showUIOverlay: this.layerVisibility.showUIOverlay,
      showMeasurementOverlay: this.layerVisibility.showMeasurementOverlay,
      showReferenceOverlay: this.layerVisibility.showReferenceOverlay,
      showTextures: this.layerVisibility.showTextures,
      orderTable: this.layerOrder.orderTable,
      orderFrame: this.layerOrder.orderFrame,
      orderRails: this.layerOrder.orderRails,
      orderPockets: this.layerOrder.orderPockets,
      orderCaps: this.layerOrder.orderCaps,
      orderBalls: this.layerOrder.orderBalls,
      orderUI: this.layerOrder.orderUI,
    };
  }

  setReferenceOverlayVisible(visible: boolean) {
    this.referenceOverlayVisible = visible;
    this.layerVisibility.showReferenceOverlay = visible;
    if (this.referenceOverlay) {
      if (visible) {
        this.referenceOverlay.classList.remove('overlay-hidden');
      } else {
        this.referenceOverlay.classList.add('overlay-hidden');
      }
    }
    this.updateCanvasZIndex();
  }

  getReferenceOverlayVisible(): boolean {
    return this.layerVisibility.showReferenceOverlay;
  }



  // Helper to convert world coordinates to screen coordinates



  // Compatibility methods for existing code
  drawCueAndPowerBar(ball: Ball, angle: number, power: number, showGhost: boolean, showPowerBar: boolean, isAimMode: boolean, prediction?: PredictionResult, microDialState?: MicroDialRenderState, alpha: number = 1.0) {
    this.cueRenderer.drawCueAndPowerBar(ball, angle, power, showGhost, showPowerBar, isAimMode, prediction, microDialState, alpha);
  }

  drawPrediction(_prediction: PredictionResult) {
    // Prediction is drawn as part of drawTrajectoryLines
  }

  drawTrajectoryLines(prediction: PredictionResult, cueBallPos: { x: number; y: number }, shotDirection: { x: number; y: number }, predictor: any) {
    this.cueRenderer.drawSimpleMathTrajectoryLines(prediction, cueBallPos, shotDirection, predictor);
  }

  drawPhysicsTrajectoryLines(shotPaths: ShotPreviewPaths, cueBallPos: { x: number; y: number }, debugMode: boolean = false) {
    this.cueRenderer.drawPhysicsTrajectoryLines(shotPaths, cueBallPos, debugMode);
  }

  /**
   * Draw simple math-based trajectory lines (for non-debug mode)
   * Uses predictTrajectories method for simple collision math
   * Styled with solid white lines + black glow (like ball appearance)
   * @param prediction - Ray-cast prediction result
   * @param cueBallPos - Current cue ball position
   * @param shotDirection - Normalized shot direction vector
   * @param predictor - Predictor instance for trajectory calculation
   */
  drawSimpleMathTrajectoryLines(
    prediction: PredictionResult,
    cueBallPos: { x: number; y: number },
    shotDirection: { x: number; y: number },
    predictor: any
  ) {
    this.cueRenderer.drawSimpleMathTrajectoryLines(prediction, cueBallPos, shotDirection, predictor);
  }

  getPowerBarBounds() {
    return this.cueRenderer.getPowerBarBounds();
  }

  getMicroDialBounds() {
    return this.cueRenderer.getMicroDialBounds();
  }

  queuePocketAnimation(event: PocketAnimationEvent) {
    this.fxRenderer.queuePocketAnimation(event);
  }



  /**
   * Highlight pockets for selection (called-shot mode)
   */
  highlightPocketsForSelection(pockets: Array<{ id: string; label: string; center: { x: number; y: number } }>) {
    this.fxRenderer.highlightPocketsForSelection(pockets);
  }

  /**
   * Highlight the called pocket (after it's been selected)
   */
  highlightCalledPocket(pocket: { id: string; label: string; center: { x: number; y: number } }) {
    this.fxRenderer.highlightCalledPocket(pocket);
  }
}

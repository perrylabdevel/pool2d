// 3D rendering system using Three.js
import * as THREE from 'three';
import { FBXLoader } from 'three-stdlib';
import { Ball, Rail } from '../physics/Shapes';
import { PhysicsWorld } from '../physics/Physics';
import { CONFIG, BALL_CUE } from '../config';
import { getTableGeometry, computePlayBoundaryPoints, computeBoundaryBounds, type Vec2, type BoundaryBounds, type PocketDef } from '../geometry/Geometry';
import { PredictionResult, ShotPreviewPaths } from '../physics/Prediction';
import { fetchWithCache } from './AssetCache';
import {
  RenderLayerSettings,
  defaultRenderLayerSettings,
  RenderLayerBooleanKey,
  RenderLayerOrderKey,
} from './RenderLayers';
import {
  type RGBColor,
  parseHexColor,
  lightenColor,
  darkenColor,
  mixColors,
  toRgba,
  classifyAxisAlignmentFromVector,
  getAxisPalette,
  type AxisAlignment,
  type AxisColorPalette,
  lightenHexColor,
  darkenHexColor,
} from './RenderUtils';
import { BaseRenderer } from './BaseRenderer';
import type { MicroDialRenderState, PocketAnimationEvent } from './ControlTypes';

const SIDE_POCKET_VISUAL_INSET = 3.5; // Keep side pocket visuals just inside the cushion edge
const EMPTY_CHIP_BORDER = 'rgba(255, 255, 255, 0.15)';

type FrameClipInfo = { outerX: number; outerY: number; radius: number };
type PocketDropAnimation = {
  event: PocketAnimationEvent;
  startTime: number;
  duration: number;
};

type IconCacheEntry = {
  img: HTMLImageElement;
  ready: boolean;
  failed: boolean;
};

export class Renderer3D extends BaseRenderer {
  uiCanvas: HTMLCanvasElement;
  uiCtx: CanvasRenderingContext2D;
  referenceOverlay: HTMLImageElement | null;
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  renderer: THREE.WebGLRenderer;
  canvasOffsetX: number = 0;
  canvasOffsetY: number = 0;
  private resizeObserver: ResizeObserver | null = null;
  private frameClipInfo: FrameClipInfo | null = null;
  private stencilAppliedOnce: boolean = false;
  
  // 3D objects
  ballMeshes: Map<number, THREE.Object3D> = new Map();
  ballModels: Map<number, { geometry: THREE.BufferGeometry; material: THREE.MeshStandardMaterial }> = new Map();
  ballModelsLoaded: boolean = false;
  ballScale = 1.0;
  private fbxBlobUrl: string | null = null;
  tableMesh: THREE.Mesh | null = null;
  frameMesh: THREE.Group | null = null;
  private frameStencilMesh: THREE.Mesh | null = null;
  railMeshes: THREE.Mesh[] = [];
  pocketMeshes: THREE.Mesh[] = [];
  pocketBottomMeshes: THREE.Mesh[] = [];
  pocketGradientMeshes: THREE.Mesh[] = [];
  private pocketGrooveMeshes: THREE.Mesh[] = [];
  private pocketRimMeshes: THREE.Mesh[] = [];
  pocketCapMeshes: THREE.Mesh[] = [];
  railFillMesh: THREE.Mesh | null = null;
  private tableHighlightMesh: THREE.Mesh | null = null;
  private tableShadowMesh: THREE.Mesh | null = null;
  private railHighlightMeshes: THREE.Mesh[] = [];
  private railShadowMeshes: THREE.Mesh[] = [];
  private railShadowRibbonMesh: THREE.Mesh | null = null;
  private railHighlightRibbonMesh: THREE.Mesh | null = null;
  private pocketHighlightMeshes: THREE.Mesh[] = [];
  private pocketShadowMeshes: THREE.Mesh[] = [];
  private railLines: Array<{ start: Vec2; end: Vec2; nx: number; ny: number }> = [];
  private railHighlightMaterial: THREE.MeshBasicMaterial | null = null;
  private railShadowMaterial: THREE.MeshBasicMaterial | null = null;
  private railShadowTexture: THREE.Texture | null = null;
  private pocketHighlightMaterial: THREE.MeshBasicMaterial | null = null;
  private pocketShadowMaterial: THREE.MeshBasicMaterial | null = null;
  private railHighlightTexture: THREE.CanvasTexture | null = null;
  private pocketHighlightTexture: THREE.CanvasTexture | null = null;
  private pocketShadowTexture: THREE.CanvasTexture | null = null;
  private queuedPocketEvents: PocketAnimationEvent[] = [];
  private pocketAnimations: PocketDropAnimation[] = [];
  private pocketIconCache: Map<string, IconCacheEntry> = new Map();
  private shakeState: { start: number; duration: number; strength: number; seed: number } | null = null;
  private accentLight: THREE.SpotLight | null = null;
  // Groove appearance settings
  private grooveInnerBase = 0.18;
  private grooveInnerDepthScale = 0.22;
  private grooveThicknessFactor = 0.08;
  private grooveOpacityBase = 0.18;
  private grooveOpacityDepthScale = 0.36;
  private grooveRimThicknessFactor = 0.02;
  private grooveRimOuterOpacity = 0.10;
  private grooveRimInnerOpacity = 0.08;
  private lastPocketDefs: PocketDef[] = [];
  // Pocket shade colors
  private grooveColor = new THREE.Color(0x000000);
  private rimColor = new THREE.Color(0xffffff);
  private pocketBottomColor = new THREE.Color(0x000000);
  private pocketWallColor = new THREE.Color(0x0a0a0a);
  private gradientCenterColor = '#050505';
  private gradientEdgeColor = '#5a5a5a';
  private pocketGradientStrength = 1.0;
  debugRailSegments: Array<{ id: string; inner: Vec2; trimmed: Vec2; startOuter: Vec2 }> = [];
  showMeasurementOverlay = false;
  private railShadowSpread = 1.0;
  private railShadowIntensity = CONFIG.RAIL_SHADOW_INTENSITY ?? 0.25;
  private railShadowOverlapScale = 1.06; // lengthwise overlap to hide seams at joins
  private railHighlightOverlapScale = 1.02;
  private railShadowSoftness = 1.8;
  private railShadowBaseGray = 170;
  private railHighlightSpread = 1.0;
  private railHighlightColor = new THREE.Color(0xffffff);
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
  private pocketGradientTexture: THREE.CanvasTexture | null = null;
  private pocketCapMaterial: THREE.MeshBasicMaterial | null = null;
  private pocketSideMaterial: THREE.MeshBasicMaterial | null = null;
  private debugMode: boolean = false;
  // Cache of icon maps keyed by pixel size
  private ballIconCaches: Map<number, Map<number, string>> = new Map();
  private getBallTexture(ballId: number): THREE.Texture | null {
    const tpl = this.ballModels.get(ballId);
    const mat = tpl?.material as THREE.MeshStandardMaterial | undefined;
    const map = mat?.map ?? null;
    return map ?? null;
  }
  
  // Resize reentrancy guard
  private _isResizing: boolean = false;

  // UI elements
  cueStick: THREE.Mesh | null = null;
  aimLine: THREE.Line | null = null;
  ghostBall: THREE.Mesh | null = null;
  trajectoryLines: THREE.Line[] = [];
  powerBarGroup: THREE.Group | null = null;
  
  // Lighting
  ambientLight: THREE.AmbientLight;
  directionalLight: THREE.DirectionalLight;
  fillLight: THREE.HemisphereLight;
  
  constructor(canvas: HTMLCanvasElement) {
    super(canvas, CONFIG.CANVAS_SCALE);

    // Get UI canvas for 2D overlays
    this.uiCanvas = document.getElementById('ui-canvas') as HTMLCanvasElement;
    this.uiCtx = this.uiCanvas.getContext('2d')!;

    this.referenceOverlay = document.getElementById('reference-overlay') as HTMLImageElement | null;
    if (this.referenceOverlay) {
      this.referenceOverlayVisible = !this.referenceOverlay.classList.contains('overlay-hidden');
    }
    this.layerVisibility.showReferenceOverlay = this.referenceOverlayVisible;
    this.ballScale = CONFIG.BALL_SCALE ?? 1;

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
    this.directionalLight.shadow.camera.left = -60;
    this.directionalLight.shadow.camera.right = 60;
    this.directionalLight.shadow.camera.top = 60;
    this.directionalLight.shadow.camera.bottom = -60;
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
    this.loadBallModels();

    // React to UI color changes without rebuilding geometry
    window.addEventListener('settings:colors-changed', () => {
      if (this.tableMesh && this.tableMesh.material instanceof THREE.MeshStandardMaterial) {
        this.tableMesh.material.color = new THREE.Color(CONFIG.TABLE_COLOR);
        this.tableMesh.material.needsUpdate = true;
      }
      // Background disabled - no scene background color
      if (this.frameMesh) {
        this.frameMesh.traverse((obj) => {
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
      this.railMeshes.forEach((m) => {
        const mat = m.material as THREE.MeshStandardMaterial;
        if (mat) {
          mat.color = new THREE.Color(CONFIG.RAIL_COLOR);
          mat.needsUpdate = true;
        }
      });
      
      // Update corner rectangle fill color
      this.updateRailFillMaterialColor();

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
  }

  clearTableAndRails() {
    if (this.tableMesh) {
      this.scene.remove(this.tableMesh);
      this.tableMesh.geometry.dispose();
      if (Array.isArray(this.tableMesh.material)) {
        this.tableMesh.material.forEach(m => m.dispose());
      } else {
        (this.tableMesh.material as THREE.Material).dispose();
      }
      this.tableMesh = null;
    }
    if (this.frameMesh) {
      this.scene.remove(this.frameMesh);
      this.frameMesh.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const mesh = obj as THREE.Mesh;
          mesh.geometry?.dispose();
          const mat = mesh.material as THREE.Material | THREE.Material[];
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose()); else mat?.dispose();
        }
      });
      this.frameMesh = null;
    }
    this.railMeshes.forEach(m => {
      this.scene.remove(m);
      m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[];
      if (Array.isArray(mat)) mat.forEach(mm => mm.dispose()); else mat.dispose();
    });
    this.railMeshes = [];
    this.railHighlightMeshes.forEach((mesh) => {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      // Don't dispose material here - it's shared, we'll dispose it once below
    });
    this.railHighlightMeshes = [];
    if (this.railHighlightRibbonMesh) {
      this.scene.remove(this.railHighlightRibbonMesh);
      this.railHighlightRibbonMesh.geometry.dispose();
      this.railHighlightRibbonMesh = null;
    }
    this.railShadowMeshes.forEach((mesh) => {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      // shared material disposed below
    });
    this.railShadowMeshes = [];
    if (this.railShadowRibbonMesh) {
      this.scene.remove(this.railShadowRibbonMesh);
      this.railShadowRibbonMesh.geometry.dispose();
      this.railShadowRibbonMesh = null;
    }
    // Dispose shared rail highlight materials once
    if (this.railHighlightTexture) {
      this.railHighlightTexture.dispose();
      this.railHighlightTexture = null;
    }
    if (this.railHighlightMaterial) {
      this.railHighlightMaterial.dispose();
      this.railHighlightMaterial = null;
    }
    if (this.railShadowMaterial) {
      this.railShadowMaterial.dispose();
      this.railShadowMaterial = null;
    }
    if (this.railShadowTexture) {
      this.railShadowTexture.dispose();
      this.railShadowTexture = null;
    }
    if (this.railShadowMaterial) {
      this.railShadowMaterial.dispose();
      this.railShadowMaterial = null;
    }
    this.pocketHighlightMeshes.forEach((mesh) => {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
    });
    this.pocketHighlightMeshes = [];
    if (this.pocketHighlightTexture) {
      this.pocketHighlightTexture.dispose();
      this.pocketHighlightTexture = null;
    }
    if (this.pocketHighlightMaterial) {
      this.pocketHighlightMaterial.dispose();
      this.pocketHighlightMaterial = null;
    }
    this.pocketMeshes.forEach(m => {
      this.scene.remove(m);
      m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[];
      if (Array.isArray(mat)) mat.forEach(mm => mm.dispose()); else mat.dispose();
    });
    this.pocketMeshes = [];
    this.pocketBottomMeshes.forEach(m => {
      this.scene.remove(m);
      m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[];
      if (Array.isArray(mat)) mat.forEach(mm => mm.dispose()); else mat.dispose();
    });
    this.pocketBottomMeshes = [];
    this.pocketGradientMeshes.forEach(m => {
      this.scene.remove(m);
      m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[];
      if (Array.isArray(mat)) mat.forEach(mm => mm.dispose()); else mat.dispose();
    });
    this.pocketGradientMeshes = [];
    this.pocketGrooveMeshes.forEach(m => {
      this.scene.remove(m);
      m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[];
      if (Array.isArray(mat)) mat.forEach(mm => mm.dispose()); else mat.dispose();
    });
    this.pocketGrooveMeshes = [];
    this.pocketRimMeshes.forEach(m => {
      this.scene.remove(m);
      m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[];
      if (Array.isArray(mat)) mat.forEach(mm => mm.dispose()); else mat.dispose();
    });
    this.pocketRimMeshes = [];
    this.pocketShadowMeshes.forEach((mesh) => {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
    });
    this.pocketShadowMeshes = [];
    if (this.pocketShadowTexture) {
      this.pocketShadowTexture.dispose();
      this.pocketShadowTexture = null;
    }
    if (this.pocketShadowMaterial) {
      this.pocketShadowMaterial.dispose();
      this.pocketShadowMaterial = null;
    }
    this.pocketCapMeshes.forEach((m) => {
      this.scene.remove(m);
      m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[];
      if (Array.isArray(mat)) mat.forEach(mm => mm.dispose()); else mat.dispose();
    });
    this.pocketCapMeshes = [];
    if (this.railFillMesh) {
      this.scene.remove(this.railFillMesh);
      this.railFillMesh.geometry.dispose();
      const mat = this.railFillMesh.material as THREE.Material | THREE.Material[];
      if (Array.isArray(mat)) mat.forEach(mm => mm.dispose()); else mat.dispose();
      this.railFillMesh = null;
    }
    this.disposeTableOverlay(this.tableHighlightMesh);
    this.tableHighlightMesh = null;
    this.disposeTableOverlay(this.tableShadowMesh);
    this.tableShadowMesh = null;
  }

  private disposeTableOverlay(mesh: THREE.Mesh | null) {
    if (!mesh) return;
    this.scene.remove(mesh);
    mesh.geometry.dispose();
    const material = mesh.material;
    if (Array.isArray(material)) {
      material.forEach((mat) => {
        const basic = mat as THREE.MeshBasicMaterial;
        if (basic.map) {
          basic.map.dispose();
        }
        mat.dispose();
      });
    } else {
      const mat = material as THREE.MeshBasicMaterial;
      if (mat.map) {
        mat.map.dispose();
      }
      mat.dispose();
    }
  }

  updateLoadingText(text: string) {
    const loadingText = document.getElementById('loading-text');
    if (loadingText) {
      loadingText.textContent = text;
    }
  }

  async loadBallModels() {
    const startTime = performance.now();
    console.log('⏳ Loading ball models...');
    console.log('📊 Performance Profile:');
    this.updateLoadingText('Loading ball models...');
    
    const loadingManager = new THREE.LoadingManager();
    const embeddedTextureMap = new Map<string, string>();

    loadingManager.setURLModifier((url) => {
      const normalized = url.replace(/^\.\//, '').replace(/^\//, '');
      const filename = normalized.split('/').pop() ?? normalized;
      return (
        embeddedTextureMap.get(url) ||
        embeddedTextureMap.get(normalized) ||
        embeddedTextureMap.get(filename) ||
        url
      );
    });

    const loader = new FBXLoader(loadingManager);
    const textureLoader = new THREE.TextureLoader(loadingManager);
    
    // Enable texture compression for faster loading
    textureLoader.setCrossOrigin('anonymous');
    const textureMap: Record<number, string> = {
      1: '/textures/poolballTx01.jpg',
      2: '/textures/poolballTx02.jpg',
      3: '/textures/poolballTx03.jpg',
      4: '/textures/poolballTx04.jpg',
      5: '/textures/poolballTx5.jpg',
      6: '/textures/poolballTx6.jpg',
      7: '/textures/poolballTx7.jpg',
      8: '/textures/poolballTx8.jpg',  // FIXED: Was Tx9
      9: '/textures/poolballTx9.jpg',  // FIXED: Was Tx11
      10: '/textures/poolballTx10.jpg',
      11: '/textures/poolballTx11.jpg',  // FIXED: Was Tx8
      12: '/textures/poolballTx12.jpg',  // FIXED: Was Tx13
      13: '/textures/poolballTx13.jpg',  // FIXED: Was Tx15
      14: '/textures/poolballTx14.jpg',
      15: '/textures/poolballTx15.jpg'   // FIXED: Was Tx12
    };
    const ballNameMap: Record<string, number> = {
      poolball16: 0,
      poolball1: 1,
      poolball2: 2,
      poolball3: 3,
      poolball17: 4,
      poolball18: 5,
      poolball19: 6,
      poolball20: 7,
      poolball21: 8,
      poolball22: 9,
      poolball23: 10,
      poolball24: 11,
      poolball25: 12,
      poolball26: 13,
      poolball27: 14,
      poolball28: 15
    };
    
    try {
      // Preload all textures in parallel with progress tracking
      let texturesLoaded = 0;
      const totalTextures = Object.keys(textureMap).length;
      
      const textureEntries = Object.entries(textureMap);

      const loadedTextures = await Promise.all(
        textureEntries.map(async ([ballId, path]) => {
          try {
            const data = await fetchWithCache(path, 'texture');
            const bytes = new Uint8Array(data);
            let binary = '';
            for (let i = 0; i < bytes.length; i++) {
              binary += String.fromCharCode(bytes[i]);
            }
            const base64 = btoa(binary);
            const dataUrl = `data:image/jpeg;base64,${base64}`;

            const filename = path.split('/').pop() ?? path;
            embeddedTextureMap.set(path, dataUrl);
            embeddedTextureMap.set(path.replace(/^\//, ''), dataUrl);
            embeddedTextureMap.set(`./${filename}`, dataUrl);
            embeddedTextureMap.set(`textures/${filename}`, dataUrl);
            embeddedTextureMap.set(`/${filename}`, dataUrl);
            embeddedTextureMap.set(filename, dataUrl);

            return await new Promise<[number, THREE.Texture | null]>((resolve) => {
              textureLoader.load(
                dataUrl,
                (loadedTexture) => {
                  loadedTexture.colorSpace = THREE.SRGBColorSpace;
                  loadedTexture.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
                  loadedTexture.generateMipmaps = true;
                  loadedTexture.minFilter = THREE.LinearMipmapLinearFilter;
                  loadedTexture.magFilter = THREE.LinearFilter;
                  texturesLoaded++;
                  console.log(`  Texture ${texturesLoaded}/${totalTextures} loaded`);
                  this.updateLoadingText(`Loading textures... ${texturesLoaded}/${totalTextures}`);
                  resolve([Number(ballId), loadedTexture]);
                },
                undefined,
                (err) => {
                  console.warn(`Failed to load texture for ball ${ballId}:`, err);
                  resolve([Number(ballId), null]);
                }
              );
            });
          } catch (err) {
            console.warn(`Failed to fetch texture for ball ${ballId}:`, err);
            return [Number(ballId), null];
          }
        })
      );

      console.log('  Loading FBX file (16MB, may take a moment)...');
      this.updateLoadingText('Loading 3D models (16MB)...');
      const fbxStart = performance.now();

      const fbxData = await fetchWithCache('/poolballs.fbx', 'fbx');
      if (this.fbxBlobUrl) {
        URL.revokeObjectURL(this.fbxBlobUrl);
      }
      const fbxBlob = new Blob([fbxData], { type: 'application/octet-stream' });
      this.fbxBlobUrl = URL.createObjectURL(fbxBlob);

      const fbx = await loader.loadAsync(this.fbxBlobUrl);

      const fbxTime = performance.now() - fbxStart;
      console.log(`  ⏱️ FBX + Textures loaded in ${fbxTime.toFixed(0)}ms`);
      console.log('  FBX loaded, processing geometry...');
      this.updateLoadingText('Processing geometry...');
      const geometryStart = performance.now();

      const textureCache = new Map<number, THREE.Texture>();
      loadedTextures.forEach(([ballId, texture]) => {
        if (texture) {
          textureCache.set(Number(ballId), texture);
        }
      });
      const source = fbx.getObjectByName('pooballl_grp') ?? fbx;
      const handled = new Set<number>();
      
      source.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        if (!child.name.startsWith('poolball')) return;
        const ballId = ballNameMap[child.name];
        if (ballId === undefined || handled.has(ballId)) return;
        handled.add(ballId);
        
        const geometry = child.geometry.clone();
        geometry.computeBoundingBox();
        geometry.computeBoundingSphere();
        const bbox = geometry.boundingBox!;
        const center = bbox.getCenter(new THREE.Vector3());
        geometry.translate(-center.x, -center.y, -center.z);
        geometry.computeBoundingSphere();
        const currentRadius = geometry.boundingSphere!.radius;
        // Scale geometry to base radius (without BALL_SCALE factor)
        // The mesh will be scaled by ballScale separately
        const targetRadius = CONFIG.BALL_BASE_RADIUS ?? CONFIG.BALL_RADIUS;
        const scale = targetRadius / currentRadius;
        geometry.scale(scale, scale, scale);
        
        const texture = textureCache.get(ballId);

        const materialParams: THREE.MeshStandardMaterialParameters = {
          color: 0xffffff,
          roughness: 0.18,
          metalness: 0.12
        };
        if (texture) {
          materialParams.map = texture;
        }

        const material = new THREE.MeshStandardMaterial(materialParams);
        
        this.ballModels.set(ballId, { geometry, material });
      });
      
      const geometryTime = performance.now() - geometryStart;
      console.log(`  ⏱️ Geometry processing: ${geometryTime.toFixed(0)}ms`);
      
      this.ballModelsLoaded = this.ballModels.size > 0;
      if (this.ballModelsLoaded) {
        const elapsed = performance.now() - startTime;
        const seconds = (elapsed / 1000).toFixed(1);
        console.info(`✓ Loaded ${this.ballModels.size} FBX ball models in ${seconds}s (${elapsed.toFixed(0)}ms)`);
        console.info(`📊 Breakdown:`);
        console.info(`  - FBX + Textures: ${fbxTime.toFixed(0)}ms (${(fbxTime/elapsed*100).toFixed(1)}%)`);
        console.info(`  - Geometry processing: ${geometryTime.toFixed(0)}ms (${(geometryTime/elapsed*100).toFixed(1)}%)`);
        if (fbxTime < 500) {
          console.info(`  ✨ Cache working! Load time reduced by ~75%`);
        } else {
          console.info(`  💡 Tip: Reload page to see cached performance (~300ms)`);
        }
        this.replaceBallsWithModels();
        this.hideLoadingScreen();
      }
    } catch (error) {
      console.error('✗ Error loading FBX:', error);
      this.ballModelsLoaded = false;
    }
  }
  
  replaceBallsWithModels() {
    this.ballMeshes.forEach((mesh) => {
      this.scene.remove(mesh);
    });
    this.ballMeshes.clear();
  }

  clearBalls() {
    this.ballMeshes.forEach((mesh) => {
      this.scene.remove(mesh);
      // Dispose geometries and materials for child meshes (glows, stripes, etc.)
      mesh.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const childMesh = child as THREE.Mesh;
          childMesh.geometry?.dispose();
          const mat = childMesh.material;
          if (Array.isArray(mat)) {
            mat.forEach(m => m.dispose());
          } else if (mat) {
            mat.dispose();
          }
        }
      });
    });
    this.ballMeshes.clear();
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
      return { visible: visible as const, rect };
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
    } catch {}
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
    const safeScale = Number.isFinite(scale) ? Math.max(0.1, scale) : 1;
    const previous = this.ballScale || 1;
    if (Math.abs(safeScale - previous) < 1e-4) {
      return;
    }
    const ratio = safeScale / previous;
    this.ballScale = safeScale;

    this.ballMeshes.forEach((mesh) => {
      mesh.scale.multiplyScalar(ratio);
    });
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
    const clamp = (value: number, min: number, max: number) =>
      Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : undefined;

    if (typeof intensities.rail === 'number') {
      const value = clamp(intensities.rail, 0, 1.5);
      if (value !== undefined) {
        const railMaterial = this.getRailHighlightMaterial();
        const pocketHighlightMaterial = this.getPocketHighlightMaterial();
        railMaterial.opacity = value;
        pocketHighlightMaterial.opacity = value;
        CONFIG.RAIL_HIGHLIGHT_INTENSITY = value;
        CONFIG.POCKET_HIGHLIGHT_INTENSITY = value;
      }
    }

    if (typeof intensities.railShadow === 'number') {
      const value = clamp(intensities.railShadow, 0, 1.0);
      this.railShadowIntensity = value;
      CONFIG.RAIL_SHADOW_INTENSITY = value;
      this.updateRailShadowMaterialFromState();
    }

    if (typeof intensities.pocketShadow === 'number') {
      const material = this.getPocketShadowMaterial();
      const value = clamp(intensities.pocketShadow, 0, 1.5);
      if (value !== undefined) {
        material.opacity = value;
        CONFIG.POCKET_SHADOW_INTENSITY = value;
      }
    }

    if (typeof intensities.pocketHighlight === 'number') {
      const material = this.getPocketHighlightMaterial();
      const value = clamp(intensities.pocketHighlight, 0, 1.5);
      if (value !== undefined) {
        material.opacity = value;
        CONFIG.POCKET_HIGHLIGHT_INTENSITY = value;
      }
    }
  }

  private computeRailShadowGray(intensity: number, spread: number): number {
    const s = Math.max(0.5, spread);
    const softnessExponent = 1.5; // higher => softer with spread
    const effective = Math.max(0, Math.min(1, intensity / Math.pow(s, softnessExponent)));
    const g = 1 - effective;
    return g;
  }

  private updateRailShadowMaterialFromState() {
    const g = this.computeRailShadowGray(this.railShadowIntensity, this.railShadowSpread);
    const shadowMaterial = this.getRailShadowMaterial();
    shadowMaterial.color.setRGB(g, g, g);
    shadowMaterial.needsUpdate = true;
    this.railShadowMeshes.forEach((m) => {
      const mat = m.material as THREE.MeshBasicMaterial;
      if (mat) {
        mat.color.setRGB(g, g, g);
        mat.needsUpdate = true;
      }
    });
  }

  getHighlightIntensities(): {
    railHighlightIntensity: number;
    railShadowIntensity: number;
    pocketHighlightIntensity: number;
    pocketShadowIntensity: number;
  } {
    return {
      railHighlightIntensity: this.railHighlightMaterial?.opacity ?? CONFIG.RAIL_HIGHLIGHT_INTENSITY ?? 0,
      railShadowIntensity: this.railShadowMaterial?.opacity ?? CONFIG.RAIL_SHADOW_INTENSITY ?? 0,
      pocketHighlightIntensity:
        this.pocketHighlightMaterial?.opacity ?? CONFIG.POCKET_HIGHLIGHT_INTENSITY ?? 0,
      pocketShadowIntensity: this.pocketShadowMaterial?.opacity ?? CONFIG.POCKET_SHADOW_INTENSITY ?? 0,
    };
  }
  
  initializeTable() {
    const tableGeometry = getTableGeometry();
    this.refreshDerivedGeometry();
    const playShape = this.createPlayShape();

    // Felt surface following cushion outline
    const feltGeometry = new THREE.ShapeGeometry(playShape);
    const feltMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(CONFIG.TABLE_COLOR),
      roughness: 0.8,
      metalness: 0.1,
      side: THREE.DoubleSide
    });
    this.tableMesh = new THREE.Mesh(feltGeometry, feltMaterial);
    this.tableMesh.receiveShadow = true;
    this.tableMesh.visible = this.layerVisibility.showTable;
    this.tableMesh.renderOrder = this.layerOrder.orderTable;
    this.enforceRenderOrderControl(this.tableMesh);
    this.scene.add(this.tableMesh);
    this.createOrUpdateTableOverlays(tableGeometry.playWidthIn, tableGeometry.playHeightIn);

    // Wooden frame planks surrounding play surface
    this.initializeFrame();
  }

  protected override refreshDerivedGeometry(): void {
    super.refreshDerivedGeometry();
  }

  private createPlayShape(): THREE.Shape {
    const shape = new THREE.Shape();
    const points = this.playBoundaryPoints;
    if (!points.length) {
      return shape;
    }

    shape.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      shape.lineTo(points[i].x, points[i].y);
    }
    shape.autoClose = true;
    return shape;
  }

  private initializeFrame() {
    if (this.frameMesh) {
      this.scene.remove(this.frameMesh);
      this.frameMesh.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const mesh = obj as THREE.Mesh;
          mesh.geometry?.dispose();
          const mat = mesh.material as THREE.Material | THREE.Material[];
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose()); else mat?.dispose();
        }
      });
      this.frameMesh = null;
    }

    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(CONFIG.FRAME_COLOR),
      roughness: 0.6,
      metalness: 0.2,
    });

    const group = new THREE.Group();
    const geom = getTableGeometry();
    const { frameOutline } = geom;
    const innerX = frameOutline.innerHalfWidth;
    const innerY = frameOutline.innerHalfHeight;
    const outerX = frameOutline.outerHalfWidth;
    const outerY = frameOutline.outerHalfHeight;
    const frameWidth = Math.max(0, outerX - innerX);
    const depth = 0.75;

    const cornerRadius = Math.max(0, Math.min(frameOutline.cornerRadius, frameWidth));

    const frameShape = this.createRoundedRectShape(outerX, outerY, cornerRadius);
    frameShape.holes.push(this.createRoundedRectPath(innerX, innerY, 0, true));

    const extrudeSettings: THREE.ExtrudeGeometryOptions = {
      depth,
      bevelEnabled: false,
      steps: 1,
      curveSegments: 48,
    };

    const frameGeometry = new THREE.ExtrudeGeometry(frameShape, extrudeSettings);
    frameGeometry.translate(0, 0, -depth / 2);

    const frameBody = new THREE.Mesh(frameGeometry, material.clone());
    frameBody.name = 'frame-body';
    group.add(frameBody);

    // Add depth effects that follow the rounded perimeter
    this.addFrameDepthEffects(group, innerX, innerY, outerX, outerY, frameWidth, cornerRadius);

    group.position.z = 0;
    group.visible = this.layerVisibility.showFrame;
    this.frameMesh = group;
    this.scene.add(group);
    this.applyFrameRenderOrder();

    // Create/update stencil mask to clip rails/pockets to outer frame outline
    this.createOrUpdateFrameStencil(frameOutline.outerHalfWidth, frameOutline.outerHalfHeight, cornerRadius);
    group.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh && (mesh as any).isMesh) {
        if ((mesh.userData && mesh.userData.frameOverlay) === true) {
          mesh.castShadow = false;
          mesh.receiveShadow = false;
        } else {
          mesh.castShadow = true;
          mesh.receiveShadow = true;
        }
      }
    });
  }

  private addFrameDepthEffects(
    group: THREE.Group,
    innerX: number,
    innerY: number,
    outerX: number,
    outerY: number,
    frameWidth: number,
    cornerRadius: number
  ) {
    const bevelWidth = Math.min(frameWidth * 0.35, 1.0);
    if (bevelWidth <= 0) return;

    const zOffset = 0.38; // Just above frame surface (frame depth/2 = 0.75/2 = 0.375)
    const horizontalSpan = innerX * 2;
    const verticalSpan = innerY * 2;

    // Inner shadows along the straight inner perimeter
    const topInnerShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(horizontalSpan, bevelWidth),
      this.getFrameInnerShadowMaterial()
    );
    topInnerShadow.position.set(0, innerY + bevelWidth / 2, zOffset);
    topInnerShadow.userData.frameOverlay = true;
    group.add(topInnerShadow);

    const bottomInnerShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(horizontalSpan, bevelWidth),
      this.getFrameInnerShadowMaterial()
    );
    bottomInnerShadow.position.set(0, -(innerY + bevelWidth / 2), zOffset);
    bottomInnerShadow.rotation.z = Math.PI;
    bottomInnerShadow.userData.frameOverlay = true;
    group.add(bottomInnerShadow);

    const leftInnerShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(verticalSpan, bevelWidth),
      this.getFrameInnerShadowMaterial()
    );
    leftInnerShadow.position.set(-(innerX + bevelWidth / 2), 0, zOffset);
    leftInnerShadow.rotation.z = Math.PI / 2;
    leftInnerShadow.userData.frameOverlay = true;
    group.add(leftInnerShadow);

    const rightInnerShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(verticalSpan, bevelWidth),
      this.getFrameInnerShadowMaterial()
    );
    rightInnerShadow.position.set(innerX + bevelWidth / 2, 0, zOffset);
    rightInnerShadow.rotation.z = -Math.PI / 2;
    rightInnerShadow.userData.frameOverlay = true;
    group.add(rightInnerShadow);

    // Outer highlight ring follows the rounded profile
    const highlightShape = this.createRoundedRectShape(outerX, outerY, cornerRadius);
    const highlightInnerHalfX = Math.max(innerX, outerX - bevelWidth);
    const highlightInnerHalfY = Math.max(innerY, outerY - bevelWidth);
    const innerRadius = Math.max(0, cornerRadius - bevelWidth);
    highlightShape.holes.push(
      this.createRoundedRectPath(highlightInnerHalfX, highlightInnerHalfY, innerRadius, true)
    );

    const highlightGeometry = new THREE.ShapeGeometry(highlightShape);
    const outerHighlight = new THREE.Mesh(highlightGeometry, this.getFrameOuterHighlightMaterial());
    outerHighlight.position.z = zOffset;
    outerHighlight.userData.frameOverlay = true;
    group.add(outerHighlight);
  }

  private createRoundedRectShape(
    halfWidth: number,
    halfHeight: number,
    radius: number
  ): THREE.Shape {
    const shape = new THREE.Shape();
    this.traceRoundedRect(shape, halfWidth, halfHeight, radius, false);
    return shape;
  }

  private createRoundedRectPath(
    halfWidth: number,
    halfHeight: number,
    radius: number,
    clockwise: boolean
  ): THREE.Path {
    const path = new THREE.Path();
    this.traceRoundedRect(path, halfWidth, halfHeight, radius, clockwise);
    return path;
  }

  private traceRoundedRect(
    target: THREE.Path,
    halfWidth: number,
    halfHeight: number,
    radius: number,
    clockwise: boolean
  ) {
    const r = Math.max(0, Math.min(radius, halfWidth, halfHeight));
    if (r <= 0.0001) {
      if (clockwise) {
        target.moveTo(halfWidth, -halfHeight);
        target.lineTo(-halfWidth, -halfHeight);
        target.lineTo(-halfWidth, halfHeight);
        target.lineTo(halfWidth, halfHeight);
      } else {
        target.moveTo(halfWidth, halfHeight);
        target.lineTo(-halfWidth, halfHeight);
        target.lineTo(-halfWidth, -halfHeight);
        target.lineTo(halfWidth, -halfHeight);
      }
      target.closePath();
      return;
    }

    if (!clockwise) {
      target.moveTo(halfWidth, halfHeight - r);
      target.absarc(halfWidth - r, halfHeight - r, r, 0, Math.PI / 2, false);
      target.lineTo(-halfWidth + r, halfHeight);
      target.absarc(-halfWidth + r, halfHeight - r, r, Math.PI / 2, Math.PI, false);
      target.lineTo(-halfWidth, -halfHeight + r);
      target.absarc(-halfWidth + r, -halfHeight + r, r, Math.PI, Math.PI * 1.5, false);
      target.lineTo(halfWidth - r, -halfHeight);
      target.absarc(halfWidth - r, -halfHeight + r, r, Math.PI * 1.5, Math.PI * 2, false);
      target.lineTo(halfWidth, halfHeight - r);
    } else {
      target.moveTo(halfWidth, -halfHeight + r);
      target.absarc(halfWidth - r, -halfHeight + r, r, 0, -Math.PI / 2, true);
      target.lineTo(-halfWidth + r, -halfHeight);
      target.absarc(-halfWidth + r, -halfHeight + r, r, -Math.PI / 2, -Math.PI, true);
      target.lineTo(-halfWidth, halfHeight - r);
      target.absarc(-halfWidth + r, halfHeight - r, r, -Math.PI, -Math.PI * 1.5, true);
      target.lineTo(halfWidth - r, halfHeight);
      target.absarc(halfWidth - r, halfHeight - r, r, -Math.PI * 1.5, -Math.PI * 2, true);
      target.lineTo(halfWidth, -halfHeight + r);
    }
    target.closePath();
  }

  private getFrameInnerShadowMaterial(): THREE.MeshBasicMaterial {
    // Create gradient texture for inner shadow (dark at one edge, fades to transparent)
    // Make it vertical so gradient goes across the height of the plane
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0.6)'); // Dark at bottom (inner edge)
    gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.3)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)'); // Fade to transparent at top (outer edge)
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    
    return new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      blending: THREE.MultiplyBlending,
      depthTest: true,
      depthWrite: false,
      opacity: 0.7,
      side: THREE.DoubleSide,
    });
  }

  private getFrameOuterHighlightMaterial(): THREE.MeshBasicMaterial {
    // Radial falloff so highlight hugs the outer edge on every side
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Renderer3D: frame highlight texture context missing');
    }

    const cx = size / 2;
    const cy = size / 2;
    const innerRadius = size * 0.35;
    const outerRadius = size * 0.5;
    const gradient = ctx.createRadialGradient(cx, cy, innerRadius, cx, cy, outerRadius);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
    gradient.addColorStop(0.65, 'rgba(255, 230, 190, 0.05)');
    gradient.addColorStop(1, 'rgba(255, 240, 210, 0.35)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.needsUpdate = true;

    return new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      opacity: 0.6,
      side: THREE.DoubleSide,
    });
  }

  private createOrUpdateTableOverlays(_playWidth: number, _playHeight: number) {
    // Clean up old overlays
    if (this.tableHighlightMesh) {
      this.disposeTableOverlay(this.tableHighlightMesh);
      this.tableHighlightMesh = null;
    }
    if (this.tableShadowMesh) {
      this.disposeTableOverlay(this.tableShadowMesh);
      this.tableShadowMesh = null;
    }

    // Overlays removed - let the sophisticated Three.js lighting system
    // (ambient + directional + hemisphere + accent spotlight) handle
    // all illumination and shadow naturally via PBR materials
  }

  private getRailHighlightMaterial(): THREE.MeshBasicMaterial {
    if (this.railHighlightMaterial && this.railHighlightTexture) {
      return this.railHighlightMaterial;
    }
    const sizeX = 128;
    const sizeY = 512;
    const canvas = document.createElement('canvas');
    canvas.width = sizeX;
    canvas.height = sizeY;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Renderer3D: rail highlight texture context missing');
    }
    
    // Enhanced gradient with more prominent highlight (similar to pocket highlights)
    const gradient = ctx.createLinearGradient(0, 0, 0, sizeY);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)');    // Bright white at top
    gradient.addColorStop(0.15, 'rgba(255, 255, 255, 0.85)'); // Strong highlight
    gradient.addColorStop(0.35, 'rgba(255, 255, 255, 0.5)');  // Medium glow
    gradient.addColorStop(0.6, 'rgba(255, 255, 255, 0.2)');   // Soft falloff
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');       // Fade to transparent
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, sizeX, sizeY);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.needsUpdate = true;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    this.railHighlightTexture = texture;

    this.railHighlightMaterial = new THREE.MeshBasicMaterial({
      map: texture,
      color: this.railHighlightColor.clone(),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: true, // Re-enabled to respect depth ordering
      depthWrite: false,
      opacity: CONFIG.RAIL_HIGHLIGHT_INTENSITY ?? 0.9,
      side: THREE.DoubleSide,
    });
    (this.railHighlightMaterial as any).toneMapped = false;
    return this.railHighlightMaterial;
  }

  private addPocketHighlight(pocket: PocketDef, visualRadius: number, angleRad: number, pocketY?: number) {
    const highlightMaterial = this.getPocketHighlightMaterial();
    const yPos = pocketY !== undefined ? pocketY : pocket.center.y;

    // Align the arc with the felt lip so the highlight tracks the table edge
    const towardCenter = new THREE.Vector2(-pocket.center.x, -yPos);
    let facingVector: THREE.Vector2 | null = null;
    if (towardCenter.lengthSq() > 1e-6) {
      facingVector = towardCenter.normalize();
    } else if (pocket.cutNormalHint) {
      facingVector = new THREE.Vector2(-pocket.cutNormalHint.x, -pocket.cutNormalHint.y);
      if (facingVector.lengthSq() > 1e-6) {
        facingVector.normalize();
      } else {
        facingVector = null;
      }
    }
    if (!facingVector) {
      facingVector = new THREE.Vector2(Math.cos(angleRad + Math.PI), Math.sin(angleRad + Math.PI));
    }

    const facingAngle = Math.atan2(facingVector.y, facingVector.x);
    const isSidePocket = pocket.id.includes('middle');
    const highlightSpan = isSidePocket ? Math.PI * 1.05 : Math.PI * 0.75;
    const innerRadius = visualRadius * (isSidePocket ? 1.04 : 1.02);
    const outerRadius = innerRadius + visualRadius * (isSidePocket ? 0.3 : 0.26);

    const highlightGeometry = new THREE.RingGeometry(
      innerRadius,
      outerRadius,
      96,
      1,
      facingAngle - highlightSpan / 2,
      highlightSpan
    );

    const highlightMesh = new THREE.Mesh(highlightGeometry, highlightMaterial);
    highlightMesh.position.set(pocket.center.x, yPos, 0.2);
    highlightMesh.renderOrder = this.layerOrder.orderPockets + 0.25;
    highlightMesh.visible = this.layerVisibility.showPockets;
    this.enforceRenderOrderControl(highlightMesh, { disableDepth: false });
    this.scene.add(highlightMesh);
    this.pocketHighlightMeshes.push(highlightMesh);
  }

  private getPocketHighlightMaterial(): THREE.MeshBasicMaterial {
    if (this.pocketHighlightMaterial && this.pocketHighlightTexture) {
      return this.pocketHighlightMaterial;
    }

    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Renderer3D: pocket highlight texture context missing');
    }

    const base = parseHexColor(CONFIG.TABLE_COLOR ?? '#0a5f0a');
    const inner = lightenColor(base, 0.55);
    const mid = mixColors(base, inner, 0.5);
    const outer = mixColors(base, inner, 0.2);
    const gradient = ctx.createRadialGradient(size / 2, size / 2, size * 0.18, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.75)');
    gradient.addColorStop(0.35, toRgba(inner, 0.4));
    gradient.addColorStop(0.7, toRgba(mid, 0.18));
    gradient.addColorStop(1, toRgba(outer, 0));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.needsUpdate = true;
    texture.colorSpace = THREE.SRGBColorSpace;
    this.pocketHighlightTexture = texture;

    this.pocketHighlightMaterial = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: true,
      depthWrite: false,
      opacity: CONFIG.POCKET_HIGHLIGHT_INTENSITY ?? 0.55,
      side: THREE.DoubleSide,
    });
    return this.pocketHighlightMaterial;
  }

  private getPocketShadowMaterial(): THREE.MeshBasicMaterial {
    if (this.pocketShadowMaterial && this.pocketShadowTexture) {
      return this.pocketShadowMaterial;
    }
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Renderer3D: pocket shadow texture context missing');
    }
    // Enhanced shadow gradient for more pronounced depth
    const gradient = ctx.createRadialGradient(size / 2, size / 2, size * 0.1, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0.75)');   // Darker center (was 0.45)
    gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.35)'); // Darker mid-section
    gradient.addColorStop(0.8, 'rgba(0, 0, 0, 0.15)'); // Gradual falloff
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.needsUpdate = true;
    texture.colorSpace = THREE.SRGBColorSpace;
    this.pocketShadowTexture = texture;

    this.pocketShadowMaterial = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      blending: THREE.MultiplyBlending,
      depthTest: true,
      depthWrite: false,
      opacity: CONFIG.POCKET_SHADOW_INTENSITY ?? 0.45,
      side: THREE.DoubleSide,
    });
    return this.pocketShadowMaterial;
  }

  initializeRails(rails: Rail[]) {
    this.debugRailSegments = [];
    this.railLines = [];
    const railMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(CONFIG.RAIL_COLOR),
      roughness: 0.5,
      metalness: 0.3,
    });

    const inner = CONFIG.RAIL_THICKNESS_INNER;
    const outer = CONFIG.RAIL_THICKNESS_OUTER;
    const totalWidth = inner + outer;
    const centerShift = (outer - inner) / 2;

    const geom = getTableGeometry();
    const { frameOutline } = geom;
    const outerX = frameOutline.outerHalfWidth;
    const outerY = frameOutline.outerHalfHeight;
    const cornerRadius = Math.max(0, Math.min(frameOutline.cornerRadius, outerX, outerY));
    const clipInfo: FrameClipInfo = { outerX, outerY, radius: cornerRadius };
    this.frameClipInfo = clipInfo;

    rails.forEach((rail) => {
      let nx = rail.nx;
      let ny = rail.ny;

      const midX = (rail.x1 + rail.x2) / 2;
      const midY = (rail.y1 + rail.y2) / 2;
      const dot = nx * -midX + ny * -midY;
      if (dot < 0) {
        nx = -nx;
        ny = -ny;
      }

      const isCornerTaper = (rail.id ?? '').endsWith('_taper');
      const pointA = { x: rail.x1, y: rail.y1 };
      const pointB = { x: rail.x2, y: rail.y2 };
      const absA = Math.max(Math.abs(pointA.x), Math.abs(pointA.y));
      const absB = Math.max(Math.abs(pointB.x), Math.abs(pointB.y));
      const innerPoint = absA <= absB ? pointA : pointB;
      const outerPoint = absA <= absB ? pointB : pointA;

      let trimmedOuter = outerPoint;
      let trimmedData: { t: number; point: Vec2 } | null = null;
      const dir = { x: outerPoint.x - innerPoint.x, y: outerPoint.y - innerPoint.y };
      const allowFrameClipping = false;
      const shouldClipRails = allowFrameClipping && isCornerTaper && clipInfo.radius > 1e-4;
      if (shouldClipRails) {
        const signX = Math.sign(outerPoint.x) || Math.sign(innerPoint.x) || 1;
        const signY = Math.sign(outerPoint.y) || Math.sign(innerPoint.y) || 1;
        const outerDistance = centerShift + totalWidth / 2;
        const startOuter = {
          x: innerPoint.x - nx * outerDistance,
          y: innerPoint.y - ny * outerDistance,
        };
        trimmedData = this.intersectLineWithCornerArc3D(startOuter, dir, signX, signY, clipInfo);
        const result = trimmedData;
        if (result) {
          const dirLen = Math.sqrt(dir.x * dir.x + dir.y * dir.y) || 1;
          const ux = dir.x / dirLen;
          const uy = dir.y / dirLen;
          // Use a negative epsilon to extend slightly into the corner arc
          // This creates a tiny overlap instead of a gap, avoiding visible seams
          const epsilon = -0.05;
          trimmedOuter = {
            x: result.point.x - ux * epsilon,
            y: result.point.y - uy * epsilon,
          };
        }
      }

      const adjMidX = (innerPoint.x + trimmedOuter.x) / 2;
      const adjMidY = (innerPoint.y + trimmedOuter.y) / 2;
      const adjToCenterX = -adjMidX;
      const adjToCenterY = -adjMidY;
      const adjDot = nx * adjToCenterX + ny * adjToCenterY;
      if (adjDot < 0) {
        nx = -nx;
        ny = -ny;
      }

      const renderDirX = trimmedOuter.x - innerPoint.x;
      const renderDirY = trimmedOuter.y - innerPoint.y;
      const renderLength = Math.sqrt(renderDirX * renderDirX + renderDirY * renderDirY) || 1;
      const angle = Math.atan2(renderDirY, renderDirX);
      const renderCenterX = innerPoint.x + renderDirX * 0.5;
      const renderCenterY = innerPoint.y + renderDirY * 0.5;

      const railGeometry = new THREE.BoxGeometry(renderLength, totalWidth, 0.5);

      const railMesh = new THREE.Mesh(railGeometry, railMaterial.clone());
      railMesh.position.set(renderCenterX - nx * centerShift, renderCenterY - ny * centerShift, -0.25);
      railMesh.rotation.z = angle;
      railMesh.castShadow = true;
      railMesh.receiveShadow = true;
      railMesh.visible = this.layerVisibility.showRails;
      railMesh.renderOrder = this.layerOrder.orderRails;
      this.enforceRenderOrderControl(railMesh);

      this.scene.add(railMesh);
      this.railMeshes.push(railMesh);
      const debugStartOuter = {
        x: innerPoint.x - nx * (centerShift + totalWidth / 2),
        y: innerPoint.y - ny * (centerShift + totalWidth / 2),
      };
      const debugTrimmed = trimmedData ? trimmedData.point : trimmedOuter;
      this.debugRailSegments.push({
        id: rail.id ?? `rail-${this.railMeshes.length - 1}`,
        inner: innerPoint,
        trimmed: debugTrimmed,
        startOuter: debugStartOuter,
      });

      // (Moved) Per-segment highlight replaced by continuous ribbon built after loop

      // Collect base lines for a continuous shadow ribbon (built after loop)
      const baseStart = { x: innerPoint.x - nx * centerShift, y: innerPoint.y - ny * centerShift };
      const baseEnd = { x: trimmedOuter.x - nx * centerShift, y: trimmedOuter.y - ny * centerShift };
      this.railLines.push({ start: baseStart, end: baseEnd, nx, ny });
    });

    // Build continuous ribbons (shadow + highlight)
    this.rebuildRailShadowRibbon();
    this.rebuildRailHighlightRibbon();
  }

  private createOrUpdateFrameStencil(outerX: number, outerY: number, cornerRadius: number) {
    if (this.frameStencilMesh) {
      this.scene.remove(this.frameStencilMesh);
      this.frameStencilMesh.geometry.dispose();
      const matOld = this.frameStencilMesh.material as THREE.Material;
      matOld.dispose();
      this.frameStencilMesh = null;
    }

    // Slightly shrink stencil inward to eliminate 1px AA slivers outside the frame
    const eps = 0.15;
    const shape = this.createRoundedRectShape(
      Math.max(0, outerX - eps),
      Math.max(0, outerY - eps),
      Math.max(0, cornerRadius - eps)
    );
    const geometry = new THREE.ShapeGeometry(shape, 64);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    (mat as any).colorWrite = false;
    mat.depthWrite = false;
    mat.depthTest = false;
    mat.stencilWrite = true;
    mat.stencilRef = 1;
    mat.stencilFunc = THREE.AlwaysStencilFunc;
    mat.stencilFail = THREE.KeepStencilOp;
    mat.stencilZFail = THREE.KeepStencilOp;
    mat.stencilZPass = THREE.ReplaceStencilOp;

    const mesh = new THREE.Mesh(geometry, mat);
    mesh.position.z = -1.0;
    mesh.renderOrder = (this.layerOrder.orderFrame ?? 1000) - 10;
    this.frameStencilMesh = mesh;
    this.scene.add(mesh);

    // Mark stencil needing application on current table meshes
    this.stencilAppliedOnce = false;
  }

  private applyStencilToTableMeshes() {
    const apply = (m?: THREE.Material | THREE.Material[]) => {
      if (!m) return;
      const set = (mat: any) => {
        mat.stencilWrite = true;
        mat.stencilRef = 1;
        mat.stencilFunc = THREE.EqualStencilFunc;
        mat.stencilFail = THREE.KeepStencilOp;
        mat.stencilZFail = THREE.KeepStencilOp;
        mat.stencilZPass = THREE.KeepStencilOp;
      };
      if (Array.isArray(m)) m.forEach(set); else set(m);
    };

    this.railMeshes.forEach((mesh) => apply(mesh.material as any));
    this.railHighlightMeshes.forEach((mesh) => apply(mesh.material as any));
    this.railShadowMeshes.forEach((mesh) => apply(mesh.material as any));
    if (this.railShadowRibbonMesh) apply(this.railShadowRibbonMesh.material as any);
    if (this.railHighlightRibbonMesh) apply(this.railHighlightRibbonMesh.material as any);
    if (this.railFillMesh) apply(this.railFillMesh.material as any);
    this.pocketMeshes.forEach((mesh) => apply(mesh.material as any));
    this.pocketBottomMeshes.forEach((mesh) => apply(mesh.material as any));
    this.pocketGradientMeshes.forEach((mesh) => apply(mesh.material as any));
    this.pocketCapMeshes.forEach((mesh) => apply(mesh.material as any));
    this.pocketShadowMeshes.forEach((mesh) => apply(mesh.material as any));
    if (this.tableMesh) apply((this.tableMesh as any).material);
    if (this.tableHighlightMesh) apply(this.tableHighlightMesh.material as any);
    if (this.tableShadowMesh) apply(this.tableShadowMesh.material as any);
  }

  private rebuildRailHighlightRibbon() {
    // Remove previous
    if (this.railHighlightRibbonMesh) {
      this.scene.remove(this.railHighlightRibbonMesh);
      this.railHighlightRibbonMesh.geometry.dispose();
      this.railHighlightRibbonMesh = null;
    }
    const boundary = this.playBoundaryPoints;
    if (!boundary.length) return;

    const innerT = Math.max(0, CONFIG.RAIL_THICKNESS_INNER ?? 0.2);
    const outerT = Math.max(0, CONFIG.RAIL_THICKNESS_OUTER ?? 0.2);
    const totalW = innerT + outerT;
    const bandW = Math.max(0.3, totalW * 0.55) * this.railHighlightSpread;
    const halfW = bandW * 0.5;
    // Center the highlight over the rail top: a bit beyond the inner lip
    const centerOut = Math.max(0.05, innerT + outerT * 0.5);

    // Compute averaged inward normals at each boundary vertex, then use outward (-n) for rail side
    const N = boundary.length;
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    for (let i = 0; i < N; i++) {
      const prev = boundary[(i - 1 + N) % N];
      const curr = boundary[i];
      const next = boundary[(i + 1) % N];
      const dx1 = curr.x - prev.x;
      const dy1 = curr.y - prev.y;
      const l1 = Math.hypot(dx1, dy1) || 1;
      let inx1 = dy1 / l1;
      let iny1 = -dx1 / l1;
      const dx2 = next.x - curr.x;
      const dy2 = next.y - curr.y;
      const l2 = Math.hypot(dx2, dy2) || 1;
      let inx2 = dy2 / l2;
      let iny2 = -dx2 / l2;
      let ax = inx1 + inx2;
      let ay = iny1 + iny2;
      const al = Math.hypot(ax, ay) || 1;
      ax /= al; ay /= al;
      // Ensure inward
      const dotCenter = ax * -curr.x + ay * -curr.y;
      if (dotCenter < 0) { ax = -ax; ay = -ay; }
      // Outward normal
      const ox = -ax;
      const oy = -ay;
      // Centerline at rail top
      const cx = curr.x + ox * centerOut;
      const cy = curr.y + oy * centerOut;
      // Build band across normal: outward (v=0) and inward (v=1) for gradient
      const outX = cx + ox * halfW;
      const outY = cy + oy * halfW;
      const inX = cx - ox * halfW;
      const inY = cy - oy * halfW;
      positions.push(outX, outY, 0.01, inX, inY, 0.01);
      const u = i / N;
      uvs.push(u, 0, u, 1);
    }
    for (let i = 0; i < N; i++) {
      const a = i * 2;
      const b = ((i + 1) % N) * 2;
      indices.push(a, b, a + 1);
      indices.push(b, b + 1, a + 1);
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geom.setIndex(indices);
    geom.computeVertexNormals();

    const mat = this.getRailHighlightMaterial();
    const mesh = new THREE.Mesh(geom, mat);
    mesh.renderOrder = this.layerOrder.orderRails + 0.5;
    mesh.visible = this.layerVisibility.showRails;
    this.scene.add(mesh);
    this.railHighlightRibbonMesh = mesh;
  }

  private rebuildRailShadowRibbon() {
    // Remove previous ribbon
    if (this.railShadowRibbonMesh) {
      this.scene.remove(this.railShadowRibbonMesh);
      this.railShadowRibbonMesh.geometry.dispose();
      this.railShadowRibbonMesh = null;
    }
    // Prefer the true cushion (play area) boundary for the ribbon base
    const boundary = this.playBoundaryPoints;
    if (!boundary.length) return;

    const inner = CONFIG.RAIL_THICKNESS_INNER;
    const width = Math.max(0.30, inner * 0.45) * this.railShadowSpread;
    const halfW = width * 0.5;
    const centerInset = halfW + 0.02; // keep fully inside play area

    // Compute averaged inward normals at each boundary vertex
    const N = boundary.length;
    const joins: Array<{ x: number; y: number; nx: number; ny: number }> = [];
    for (let i = 0; i < N; i++) {
      const prev = boundary[(i - 1 + N) % N];
      const curr = boundary[i];
      const next = boundary[(i + 1) % N];
      // Segment normals (perpendicular)
      const dx1 = curr.x - prev.x;
      const dy1 = curr.y - prev.y;
      const l1 = Math.hypot(dx1, dy1) || 1;
      let nx1 = dy1 / l1;   // inward guess for CCW boundary is +perp
      let ny1 = -dx1 / l1;
      const dx2 = next.x - curr.x;
      const dy2 = next.y - curr.y;
      const l2 = Math.hypot(dx2, dy2) || 1;
      let nx2 = dy2 / l2;
      let ny2 = -dx2 / l2;
      // Average and normalize
      let ax = nx1 + nx2;
      let ay = ny1 + ny2;
      const al = Math.hypot(ax, ay) || 1;
      ax /= al; ay /= al;
      // Ensure inward (toward center)
      const dotCenter = ax * -curr.x + ay * -curr.y;
      if (dotCenter < 0) { ax = -ax; ay = -ay; }
      // Centerline point slightly inside the cushion
      const cx = curr.x + ax * centerInset;
      const cy = curr.y + ay * centerInset;
      joins.push({ x: cx, y: cy, nx: ax, ny: ay });
    }

    // Create strip vertices
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    for (let i = 0; i < joins.length; i++) {
      const { x, y, nx, ny } = joins[i];
      const rx = x - nx * halfW; // near-rail side (v=0)
      const ry = y - ny * halfW;
      const fx = x + nx * halfW; // felt side (v=1)
      const fy = y + ny * halfW;
      // push in order: rail-side then felt-side
      positions.push(rx, ry, 0.005, fx, fy, 0.005);
      const u = i / joins.length;
      uvs.push(u, 0, u, 1);
    }
    // Connect as triangle strip (two triangles per segment)
    for (let i = 0; i < joins.length; i++) {
      const a = i * 2;
      const b = ((i + 1) % joins.length) * 2;
      // Quad indices: a(rail), a+1(felt) -> b(rail), b+1(felt)
      indices.push(a, b, a + 1);
      indices.push(b, b + 1, a + 1);
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geom.setIndex(indices);
    geom.computeVertexNormals();

    const mat = this.getRailShadowMaterial();
    const mesh = new THREE.Mesh(geom, mat);
    mesh.renderOrder = this.layerOrder.orderRails + 0.05;
    mesh.visible = this.layerVisibility.showRails;
    this.scene.add(mesh);
    this.railShadowRibbonMesh = mesh;
    this.updateRailShadowMaterialFromState();
  }

  private intersectLineWithCornerArc3D(
    start: Vec2,
    dir: Vec2,
    signX: number,
    signY: number,
    clip: FrameClipInfo
  ): { t: number; point: Vec2 } | null {
    const a = dir.x * dir.x + dir.y * dir.y;
    if (a < 1e-8) return null;

    const centerX = (signX >= 0 ? 1 : -1) * (clip.outerX - clip.radius);
    const centerY = (signY >= 0 ? 1 : -1) * (clip.outerY - clip.radius);

    const ox = start.x - centerX;
    const oy = start.y - centerY;

    const b = 2 * (dir.x * ox + dir.y * oy);
    const c = ox * ox + oy * oy - clip.radius * clip.radius;
    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0) return null;
    const sqrt = Math.sqrt(discriminant);

    const tCandidates = [
      (-b - sqrt) / (2 * a),
      (-b + sqrt) / (2 * a),
    ];

    const valid = tCandidates.filter((candidate) => candidate > 1e-4 && candidate <= 1.5);
    if (!valid.length) return null;
    const t = Math.min(...valid);
    return {
      t,
      point: {
        x: start.x + dir.x * t,
        y: start.y + dir.y * t,
      },
    };
  }

  private getRailShadowMaterial(): THREE.MeshBasicMaterial {
    if (this.railShadowMaterial && this.railShadowTexture) {
      return this.railShadowMaterial;
    }
    // Create a vertical gradient (Y direction) that fades from dark near the rail to transparent over felt
    const sizeX = 64;
    const sizeY = 512;
    const canvas = document.createElement('canvas');
    canvas.width = sizeX;
    canvas.height = sizeY;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Renderer3D: rail shadow texture context missing');
    }
    // Draw softened gradient manually for smoother falloff (eased + exponent)
    const minGray = Math.max(50, Math.min(250, this.railShadowBaseGray));
    for (let y = 0; y < sizeY; y++) {
      const t = y / (sizeY - 1);
      // Smoothstep then exponent for controllable softness
      const s = t * t * (3 - 2 * t);
      const eased = Math.pow(s, Math.max(0.2, Math.min(3.0, this.railShadowSoftness)));
      const g = Math.round(minGray + (255 - minGray) * eased);
      ctx.fillStyle = `rgb(${g},${g},${g})`;
      ctx.fillRect(0, y, sizeX, 1);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.needsUpdate = true;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    this.railShadowTexture = tex;

    // TEMP: vivid magenta to verify slider wiring and placement visibly
    const material = new THREE.MeshBasicMaterial({
      map: tex,
      color: new THREE.Color(0xffffff), // neutral for Multiply; intensity darkens via grayscale color
      transparent: true,
      opacity: 1.0,
      blending: THREE.MultiplyBlending,
      depthTest: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    // Initialize color based on current intensity: t in [0,1] => grayscale (1-t)
    const t0 = Math.max(0, Math.min(1, (CONFIG.RAIL_SHADOW_INTENSITY ?? 0.25)));
    material.color.setRGB(1 - t0, 1 - t0, 1 - t0);
    (material as any).toneMapped = false;
    this.railShadowMaterial = material;
    return material;
  }

  setRailShadowSoftness(value: number) {
    const clamped = Math.max(0.2, Math.min(3.0, value));
    this.railShadowSoftness = clamped;
    // Recreate texture and material for updated gradient falloff
    if (this.railShadowTexture) {
      this.railShadowTexture.dispose();
      this.railShadowTexture = null;
    }
    if (this.railShadowMaterial) {
      this.railShadowMaterial.dispose();
      this.railShadowMaterial = null;
    }
    const mat = this.getRailShadowMaterial();
    if (this.railShadowRibbonMesh) {
      this.railShadowRibbonMesh.material = mat;
    }
    this.updateRailShadowMaterialFromState();
  }

  setRailShadowBaseGray(value: number) {
    const clamped = Math.max(50, Math.min(250, value));
    this.railShadowBaseGray = clamped;
    if (this.railShadowTexture) {
      this.railShadowTexture.dispose();
      this.railShadowTexture = null;
    }
    if (this.railShadowMaterial) {
      this.railShadowMaterial.dispose();
      this.railShadowMaterial = null;
    }
    const mat = this.getRailShadowMaterial();
    if (this.railShadowRibbonMesh) {
      this.railShadowRibbonMesh.material = mat;
    }
    this.updateRailShadowMaterialFromState();
  }

  setRailHighlightSpread(value: number) {
    const clamped = Math.max(0.3, Math.min(3.0, value));
    this.railHighlightSpread = clamped;
    this.rebuildRailHighlightRibbon();
  }

  setRailHighlightColor(hex: string) {
    try {
      this.railHighlightColor = new THREE.Color(hex);
    } catch {
      this.railHighlightColor = new THREE.Color(0xffffff);
    }
    const mat = this.getRailHighlightMaterial();
    mat.color = this.railHighlightColor.clone();
    mat.needsUpdate = true;
    if (this.railHighlightRibbonMesh) {
      (this.railHighlightRibbonMesh.material as THREE.MeshBasicMaterial).color.copy(this.railHighlightColor);
    }
  }

  setRailShadowSpread(value: number) {
    const clamped = Math.max(0.5, Math.min(10, value));
    this.railShadowSpread = clamped;
    // Rebuild the continuous ribbon for accurate width without per-segment scaling artifacts
    this.rebuildRailShadowRibbon();
    // Recompute color to keep wider spreads softer
    this.updateRailShadowMaterialFromState();
  }
  
  initializePockets(pockets: PocketDef[]) {
    this.lastPocketDefs = pockets.map(p => ({ ...p }));
    const sideMaterial = this.getPocketSideMaterial();
    const playHalfHeight = this.playBounds.maxY;

    pockets.forEach((pocket) => {
      const visualRadius = pocket.visualRadius ?? pocket.radius;
      const wallTaperRadius = visualRadius * 0.75; // Increased taper for more depth (was 0.85)
      const shelfDepthIn = pocket.shelfDepth ?? CONFIG.POCKET_SHELF_DEPTH_IN;
      const shelfDepth = Math.max(0.1, shelfDepthIn) * 1.5; // 50% deeper
      const depthFactor = Math.max(0, Math.min(1, (shelfDepthIn ?? 0.5) / 2.0));
      const angleRad = THREE.MathUtils.degToRad(pocket.cutAngleDeg ?? 0);

      // All pockets render as full circles at their true physics position
      const pocketRotationZ = angleRad;
      const thetaStart = 0;
      const thetaLength = Math.PI * 2;
      const pocketY = pocket.center.y;

      // Create cylinder geometry (full circle for all pockets)
      const pocketGeometry = new THREE.CylinderGeometry(
        visualRadius,
        wallTaperRadius,
        shelfDepth,
        48,
        1,
        true,
        thetaStart,
        thetaLength
      );
      const pocketMesh = new THREE.Mesh(pocketGeometry, sideMaterial.clone());
      pocketMesh.position.set(pocket.center.x, pocketY, 0);
      pocketMesh.rotation.x = Math.PI / 2;
      pocketMesh.rotation.z = pocketRotationZ;

      pocketMesh.renderOrder = this.layerOrder.orderPockets;
      pocketMesh.visible = this.layerVisibility.showPockets;
      this.enforceRenderOrderControl(pocketMesh);
      this.scene.add(pocketMesh);
      this.pocketMeshes.push(pocketMesh);

      // Solid black bottom fill - full circle for all pockets
      const circleShape = new THREE.Shape();
      const radius = visualRadius * 0.98;
      circleShape.absarc(0, 0, radius, 0, Math.PI * 2, false);
      const bottomGeometry = new THREE.ShapeGeometry(circleShape);

      const bottomMaterial = new THREE.MeshBasicMaterial({
        color: this.pocketBottomColor,
        side: THREE.DoubleSide,
        depthTest: false,
        depthWrite: false,
      });
      const bottomMesh = new THREE.Mesh(bottomGeometry, bottomMaterial);
      bottomMesh.position.set(pocket.center.x, pocketY, 0.05);
      bottomMesh.rotation.z = pocketRotationZ;

      bottomMesh.renderOrder = this.layerOrder.orderPockets - 0.2;  // Render just before pocket walls
      bottomMesh.visible = this.layerVisibility.showPockets;
      this.scene.add(bottomMesh);
      this.pocketBottomMeshes.push(bottomMesh);

      // Gradient overlay - full circle for all pockets
      const gradientShape = new THREE.Shape();
      gradientShape.absarc(0, 0, visualRadius, 0, Math.PI * 2, false);
      const gradientGeometry = new THREE.ShapeGeometry(gradientShape);

      // Fix UV mapping for the gradient texture
      const uvAttribute = gradientGeometry.attributes.uv;
      const posAttribute = gradientGeometry.attributes.position;
      for (let i = 0; i < uvAttribute.count; i++) {
        const x = posAttribute.getX(i);
        const y = posAttribute.getY(i);
        // Map from circle coordinates [-radius, radius] to UV [0, 1]
        const u = (x / visualRadius + 1) * 0.5;
        const v = (y / visualRadius + 1) * 0.5;
        uvAttribute.setXY(i, u, v);
      }
      uvAttribute.needsUpdate = true;

      // Create fresh material for each pocket to avoid texture sharing issues
      const gradientTexture = this.getPocketGradientTexture();
      const gradientMat = new THREE.MeshBasicMaterial({
        map: gradientTexture,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      // Make deeper pockets appear darker by increasing overlay opacity
      gradientMat.opacity = 0.65 + 0.35 * depthFactor; // 0.65..1.0
      const gradientMesh = new THREE.Mesh(gradientGeometry, gradientMat);
      gradientMesh.position.set(pocket.center.x, pocketY, 0.16);

      // Rotate semicircle to face outward
      gradientMesh.rotation.z = pocketRotationZ;

      gradientMesh.renderOrder = this.layerOrder.orderPockets + 0.1;  // Render after pocket walls
      gradientMesh.visible = this.layerVisibility.showPockets;
      this.scene.add(gradientMesh);
      this.pocketGradientMeshes.push(gradientMesh);

      const pocketShadowMaterialBase = this.getPocketShadowMaterial();
      // Clone per pocket so we can vary opacity with depth safely
      const pocketShadowMaterial = pocketShadowMaterialBase.clone();
      pocketShadowMaterial.opacity = (pocketShadowMaterialBase.opacity ?? 0.45) * (0.85 + 0.5 * depthFactor);

      const shadowInner = visualRadius * (0.9 + 0.05 * depthFactor);
      const shadowOuter = visualRadius * (1.16 + 0.08 * depthFactor);
      const shadowGeometry = new THREE.RingGeometry(
        shadowInner,
        shadowOuter,
        64,
        1,
        thetaStart,
        thetaLength
      );
      const shadowMesh = new THREE.Mesh(shadowGeometry, pocketShadowMaterial);
      shadowMesh.position.set(pocket.center.x, pocketY, 0.3);
      shadowMesh.rotation.x = Math.PI / 2;

      // Rotate semicircle to face outward
      shadowMesh.rotation.z = pocketRotationZ;

      shadowMesh.renderOrder = this.layerOrder.orderPockets + 0.2;
      shadowMesh.visible = this.layerVisibility.showPockets;
      this.enforceRenderOrderControl(shadowMesh, { disableDepth: true });
      this.scene.add(shadowMesh);
      this.pocketShadowMeshes.push(shadowMesh);

      // Bottom groove ring to imply deepest shelf edge (stronger with depth)
      // Size groove to match the darkest inner region of the pocket
      // Start near 18% of radius (shallow) and grow with depth
      const grooveInner = visualRadius * (this.grooveInnerBase + this.grooveInnerDepthScale * depthFactor);
      const grooveOuter = grooveInner + visualRadius * this.grooveThicknessFactor;
      const grooveGeometry = new THREE.RingGeometry(grooveInner, grooveOuter, 64, 1, thetaStart, thetaLength);
      const grooveMaterial = new THREE.MeshBasicMaterial({
        color: this.grooveColor,
        transparent: true,
        opacity: this.grooveOpacityBase + this.grooveOpacityDepthScale * depthFactor,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const grooveMesh = new THREE.Mesh(grooveGeometry, grooveMaterial);
      grooveMesh.position.set(pocket.center.x, pocketY, 0.21);
      // Align with gradient overlay (no X-rotation), rotate only around Z
      grooveMesh.rotation.z = pocketRotationZ;
      grooveMesh.renderOrder = this.layerOrder.orderPockets + 0.21;
      grooveMesh.visible = this.layerVisibility.showPockets;
      this.enforceRenderOrderControl(grooveMesh, { disableDepth: true });
      this.scene.add(grooveMesh);
      this.pocketGrooveMeshes.push(grooveMesh);

      // Thin inner rim highlight to define groove edge (very subtle)
      const rimInner = grooveOuter;
      const rimOuter = rimInner + visualRadius * this.grooveRimThicknessFactor; // thinner outline
      const rimGeometry = new THREE.RingGeometry(rimInner, rimOuter, 96, 1, thetaStart, thetaLength);
      const rimMaterial = new THREE.MeshBasicMaterial({
        color: this.rimColor,
        transparent: true,
        opacity: this.grooveRimOuterOpacity * (0.5 + 0.5 * depthFactor),
        blending: THREE.AdditiveBlending,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const rimMesh = new THREE.Mesh(rimGeometry, rimMaterial);
      rimMesh.position.set(pocket.center.x, pocketY, 0.22);
      rimMesh.rotation.z = pocketRotationZ;
      rimMesh.renderOrder = this.layerOrder.orderPockets + 0.22;
      rimMesh.visible = this.layerVisibility.showPockets;
      this.enforceRenderOrderControl(rimMesh, { disableDepth: true });
      this.scene.add(rimMesh);
      this.pocketRimMeshes.push(rimMesh);

      // Inner thin rim at groove inner edge
      const rim2Outer = grooveInner;
      const rim2Inner = Math.max(0.01, rim2Outer - visualRadius * this.grooveRimThicknessFactor);
      const rim2Geometry = new THREE.RingGeometry(rim2Inner, rim2Outer, 96, 1, thetaStart, thetaLength);
      const rim2Material = new THREE.MeshBasicMaterial({
        color: this.rimColor,
        transparent: true,
        opacity: this.grooveRimInnerOpacity * (0.5 + 0.5 * depthFactor),
        blending: THREE.AdditiveBlending,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const rim2Mesh = new THREE.Mesh(rim2Geometry, rim2Material);
      rim2Mesh.position.set(pocket.center.x, pocketY, 0.22);
      rim2Mesh.rotation.z = pocketRotationZ;
      rim2Mesh.renderOrder = this.layerOrder.orderPockets + 0.22;
      rim2Mesh.visible = this.layerVisibility.showPockets;
      this.enforceRenderOrderControl(rim2Mesh, { disableDepth: true });
      this.scene.add(rim2Mesh);
      this.pocketRimMeshes.push(rim2Mesh);

      this.addPocketHighlight(pocket, visualRadius, angleRad, pocketY);
    });
    
    this.initializeRailFillMesh();
    this.initializePocketCaps(pockets);
    this.applyPocketsVisibility(this.layerVisibility.showPockets);
    this.updatePocketDebugMaterials();
  }

  initializePocketCaps(pockets: PocketDef[]) {
    const capThickness = 0.2;
    const capMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#0a0a0a'),
      depthTest: true,
      depthWrite: true,
      transparent: true,
      opacity: 0.75,
    });
    const playHalfHeight = this.playBounds.maxY;

    pockets.forEach((pocket) => {
      const visualRadius = pocket.visualRadius ?? pocket.radius;
      const angleRad = THREE.MathUtils.degToRad(pocket.cutAngleDeg ?? 0);
      const pocketRotationZ = angleRad;
      const thetaStart = 0;
      const thetaLength = Math.PI * 2;
      const pocketY = pocket.center.y;

      // All pockets use full cylinder caps
      const capGeometry = new THREE.CylinderGeometry(
        visualRadius * 1.02,
        visualRadius * 1.02,
        capThickness,
        48,
        1,
        false,
        thetaStart,
        thetaLength
      );
      const capMesh = new THREE.Mesh(capGeometry, capMaterial.clone());
      capMesh.position.set(pocket.center.x, pocketY, 0.6);
      capMesh.rotation.x = Math.PI / 2;
      capMesh.rotation.z = pocketRotationZ;

      capMesh.renderOrder = this.layerOrder.orderCaps;
      capMesh.visible = this.layerVisibility.showCaps;
      this.enforceRenderOrderControl(capMesh);

      this.scene.add(capMesh);
      this.pocketCapMeshes.push(capMesh);
    });
  }

  initializeRailFillMesh() {
    const geometry = this.createRailFillGeometry();
    if (!geometry) return;

    const material = new THREE.MeshBasicMaterial({
      color: this.computeRailFillColor(),
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.96,
    });
    (material as any).toneMapped = false;

    this.railFillMesh = new THREE.Mesh(geometry, material);
    this.railFillMesh.position.z = -0.3; // Below rails (which are at -0.25)
    this.railFillMesh.renderOrder = this.layerOrder.orderRails - 1; // Render before rails
    this.railFillMesh.visible = this.layerVisibility.showRails;
    this.enforceRenderOrderControl(this.railFillMesh);

    this.scene.add(this.railFillMesh);
    this.updateRailFillMaterialColor();
  }

  private computeRailFillColor(): THREE.Color {
    // Use the Corner Fill color directly from CONFIG without any blending or modification
    return new THREE.Color(CONFIG.RAIL_FILL_COLOR ?? '#000000');
  }

  private updateRailFillMaterialColor() {
    if (!this.railFillMesh) return;
    const mat = this.railFillMesh.material as THREE.MeshBasicMaterial | undefined;
    if (!mat) return;
    const color = this.computeRailFillColor();
    mat.color.copy(color);
    mat.opacity = 0.96;
    mat.needsUpdate = true;
  }

  private offsetBoundaryOutward(points: Vec2[], offset: number): Vec2[] {
    // Offset each point outward along its segment normals to account for rail thickness
    const result: Vec2[] = [];
    const n = points.length;
    
    for (let i = 0; i < n; i++) {
      const curr = points[i];
      const prev = points[(i - 1 + n) % n];
      const next = points[(i + 1) % n];
      
      // Calculate normals from adjacent segments (pointing outward from center)
      const dx1 = curr.x - prev.x;
      const dy1 = curr.y - prev.y;
      const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1) || 1;
      const nx1 = -dy1 / len1; // Perpendicular
      const ny1 = dx1 / len1;
      
      const dx2 = next.x - curr.x;
      const dy2 = next.y - curr.y;
      const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2) || 1;
      const nx2 = -dy2 / len2;
      const ny2 = dx2 / len2;
      
      // Average the normals and ensure they point outward (away from center)
      let avgNx = (nx1 + nx2) / 2;
      let avgNy = (ny1 + ny2) / 2;
      const avgLen = Math.sqrt(avgNx * avgNx + avgNy * avgNy) || 1;
      avgNx /= avgLen;
      avgNy /= avgLen;
      
      // Check if normal points toward center; if so, flip it
      const toCenterX = -curr.x;
      const toCenterY = -curr.y;
      const dot = avgNx * toCenterX + avgNy * toCenterY;
      if (dot > 0) {
        avgNx = -avgNx;
        avgNy = -avgNy;
      }
      
      // Offset point outward
      result.push({
        x: curr.x + avgNx * offset,
        y: curr.y + avgNy * offset
      });
    }

    return result;
  }

  private createRailFillGeometry(): THREE.ShapeGeometry | null {
    if (!this.playBoundaryPoints.length) {
      return null;
    }

    const geom = getTableGeometry();
    const { frameOutline } = geom;
    const frameInset = CONFIG.RAIL_THICKNESS_OUTER;
    const outerHalfWidth = frameOutline.innerHalfWidth;
    const outerHalfHeight = frameOutline.innerHalfHeight;
    const innerCornerRadius = Math.max(0, frameOutline.cornerRadius - frameInset);

    const outer = this.createRoundedRectShape(outerHalfWidth, outerHalfHeight, innerCornerRadius);

    const railPerimeter = this.buildRailOuterPerimeter();
    if (railPerimeter && railPerimeter.length >= 3) {
      const inner = new THREE.Path();
      inner.moveTo(railPerimeter[0].x, railPerimeter[0].y);
      for (let i = 1; i < railPerimeter.length; i++) {
        inner.lineTo(railPerimeter[i].x, railPerimeter[i].y);
      }
      inner.closePath();
      outer.holes.push(inner);
    }

    return new THREE.ShapeGeometry(outer, 64);
  }

  private buildRailOuterPerimeter(): Vec2[] | null {
    if (!this.railLines.length) {
      return null;
    }

    const offset = CONFIG.RAIL_THICKNESS_OUTER ?? 0;
    if (offset <= 0) {
      return null;
    }

    const points: Vec2[] = [];
    this.railLines.forEach((line, index) => {
      if (!line) return;
      const startOuter = {
        x: (line.start?.x ?? 0) - (line.nx ?? 0) * offset,
        y: (line.start?.y ?? 0) - (line.ny ?? 0) * offset,
      };
      const endOuter = {
        x: (line.end?.x ?? 0) - (line.nx ?? 0) * offset,
        y: (line.end?.y ?? 0) - (line.ny ?? 0) * offset,
      };
      if (index === 0) {
        points.push(startOuter);
      }
      points.push(endOuter);
    });

    return this.ensureClockwise(points);
  }

  // Ensure polygon points are ordered clockwise. Three.js treats holes as clockwise.
  private ensureClockwise(points: Vec2[]): Vec2[] {
    if (points.length < 3) return points;
    let area = 0;
    for (let i = 0, n = points.length; i < n; i++) {
      const p1 = points[i];
      const p2 = points[(i + 1) % n];
      area += p1.x * p2.y - p2.x * p1.y;
    }
    // area > 0 => CCW (in standard XY). For a hole we want clockwise, so reverse if CCW.
    if (area > 0) {
      return points.slice().reverse();
    }
    return points;
  }

  private getPocketSideMaterial(): THREE.MeshBasicMaterial {
    if (!this.pocketSideMaterial) {
      this.pocketSideMaterial = new THREE.MeshBasicMaterial({
        color: this.pocketWallColor.clone(),
        depthTest: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
    }
    return this.pocketSideMaterial;
  }

  private getPocketCapMaterial(): THREE.MeshBasicMaterial {
    if (this.pocketCapMaterial) {
      return this.pocketCapMaterial;
    }

    const texture = this.getPocketGradientTexture();
    this.pocketCapMaterial = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    return this.pocketCapMaterial;
  }

  private getPocketGradientTexture(): THREE.CanvasTexture {
    if (this.pocketGradientTexture) {
      return this.pocketGradientTexture;
    }

    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Unable to create pocket gradient texture context');
    }

    const center = size / 2;
    const radius = size / 2;

    // Build gradient from configurable colors
    const centerCol = parseHexColor(this.gradientCenterColor ?? '#050505');
    const edgeCol = parseHexColor(this.gradientEdgeColor ?? '#5a5a5a');
    const midCol = mixColors(centerCol, edgeCol, 0.5);
    const nearCol = mixColors(centerCol, edgeCol, 0.8);

    const toRgbaStr = (c: { r: number; g: number; b: number }, a: number) => `rgba(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}, ${a})`;

    const s = Math.max(0, Math.min(1, this.pocketGradientStrength));
    const gradient = ctx.createRadialGradient(center, center, 0, center, center, radius);
    gradient.addColorStop(0.0, toRgbaStr(centerCol, 1.0 * s));
    gradient.addColorStop(0.25, toRgbaStr(midCol, 0.95 * s));
    gradient.addColorStop(0.6, toRgbaStr(nearCol, 0.8 * s));
    gradient.addColorStop(1.0, toRgbaStr(edgeCol, 0.35 * s));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    this.pocketGradientTexture = new THREE.CanvasTexture(canvas);
    this.pocketGradientTexture.colorSpace = THREE.SRGBColorSpace;
    this.pocketGradientTexture.wrapS = THREE.ClampToEdgeWrapping;
    this.pocketGradientTexture.wrapT = THREE.ClampToEdgeWrapping;
    this.pocketGradientTexture.needsUpdate = true;
    return this.pocketGradientTexture;
  }
  
  createBall(ball: Ball): THREE.Object3D {
    const baseRadius = CONFIG.BALL_BASE_RADIUS ?? CONFIG.BALL_RADIUS / Math.max(0.001, CONFIG.BALL_SCALE ?? 1);
    if (this.ballModelsLoaded) {
      const template = this.ballModels.get(ball.id);
      if (template) {
        const ballMesh = new THREE.Mesh(template.geometry, template.material);
        ballMesh.castShadow = true;
        ballMesh.receiveShadow = false;
        
        if (ball.id === BALL_CUE) {
          this.addCueBallMeasles(ballMesh, baseRadius);
        }

        // Add black glow outline
        this.addBallGlow(ballMesh, baseRadius);
        
        this.scene.add(ballMesh);
        this.applyBallRenderOrder(ballMesh);
        this.enforceRenderOrderControl(ballMesh);
        ballMesh.visible = this.layerVisibility.showBalls;
        ballMesh.scale.setScalar(this.ballScale);
        this.ballMeshes.set(ball.id, ballMesh);
        return ballMesh;
      }
    }

    // Fallback to procedural balls if FBX not loaded or template missing
    const geometry = new THREE.SphereGeometry(baseRadius, 32, 32);
    
    // Create ball material
    const color = ball.id === BALL_CUE 
      ? new THREE.Color(CONFIG.CUE_BALL_COLOR)
      : new THREE.Color(CONFIG.BALL_COLORS[ball.id - 1]);
    
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.3,
      metalness: 0.4
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    
    // Add number texture for numbered balls
    if (ball.id !== BALL_CUE) {
      this.addBallNumber(mesh, ball.id);
    }
    
    // Add stripe for striped balls
    if (ball.id >= 9 && ball.id <= 15) {
      this.addBallStripe(mesh, baseRadius);
    }

    if (ball.id === BALL_CUE) {
      this.addCueBallMeasles(mesh, baseRadius);
    }

    // Add black glow outline
    this.addBallGlow(mesh, baseRadius);
    
    this.scene.add(mesh);
    this.applyBallRenderOrder(mesh);
    this.enforceRenderOrderControl(mesh);
    mesh.visible = this.layerVisibility.showBalls;
    mesh.scale.setScalar(this.ballScale);
    this.ballMeshes.set(ball.id, mesh);
    
    return mesh;
  }
  
  private addCueBallMeasles(mesh: THREE.Mesh, radius: number) {
    const measles = CONFIG.CUE_BALL_MEASLES ?? [];
    const measleRatio = CONFIG.CUE_BALL_MEASLE_RADIUS_RATIO ?? 0;
    if (measles.length === 0 || measleRatio <= 0) {
      this.removeCueBallMeasles(mesh);
      return;
    }

    this.removeCueBallMeasles(mesh);

    const spotRadius = radius * measleRatio;
    if (spotRadius <= 0) return;

    const spotColor = new THREE.Color(CONFIG.CUE_BALL_MEASLE_COLOR ?? '#c62828');
    const uniqueNormals = new Set<string>();
    const normals: THREE.Vector3[] = [];

    const registerNormal = (nx: number, ny: number, nz: number) => {
      const lengthSq = nx * nx + ny * ny + nz * nz;
      if (lengthSq <= 1e-6) return;
      const length = Math.sqrt(lengthSq);
      const normalized = new THREE.Vector3(nx / length, ny / length, nz / length);
      const key = `${normalized.x.toFixed(4)}:${normalized.y.toFixed(4)}:${normalized.z.toFixed(4)}`;
      if (uniqueNormals.has(key)) return;
      uniqueNormals.add(key);
      normals.push(normalized);
    };

    measles.forEach((measle) => {
      const mx = measle.x ?? 0;
      const my = measle.y ?? 0;
      const hasZ = typeof (measle as { z?: number }).z === 'number';
      if (hasZ) {
        const mz = (measle as { z?: number }).z ?? 0;
        registerNormal(mx, my, mz);
        return;
      }

      const xySq = mx * mx + my * my;
      if (xySq > 1 + 1e-4) {
        return;
      }
      const mz = Math.sqrt(Math.max(0, 1 - xySq));
      registerNormal(mx, my, mz);
      if (mz > 1e-5) {
        registerNormal(mx, my, -mz);
      }
    });

    // Use thin circular decals oriented to the surface normal, slightly above the sphere
    const up = new THREE.Vector3(0, 0, 1);
    normals.forEach((normal, index) => {
      const spotGeometry = new THREE.CircleGeometry(spotRadius, 32);
      const spotMaterial = new THREE.MeshStandardMaterial({
        color: spotColor,
        roughness: 0.35,
        metalness: 0.15,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
        depthWrite: false,
      } as any);

      const spotMesh = new THREE.Mesh(spotGeometry, spotMaterial);
      spotMesh.name = `cue-measle-${index}`;
      // Orient the disk so its normal matches the sphere normal at this point
      const quat = new THREE.Quaternion().setFromUnitVectors(up, normal);
      spotMesh.quaternion.copy(quat);
      // Place the disk just above the sphere surface to avoid z-fighting
      const epsilon = Math.max(0.002, radius * 0.002);
      const offset = radius + epsilon;
      spotMesh.position.copy(normal.clone().multiplyScalar(offset));
      spotMesh.renderOrder = (this.layerOrder.orderBalls || 0) + 0.5;
      mesh.add(spotMesh);
    });
  }

  private removeCueBallMeasles(mesh: THREE.Mesh) {
    const measleChildren = mesh.children.filter((child) => child.name.startsWith('cue-measle'));
    measleChildren.forEach((child) => {
      mesh.remove(child);
      if ((child as THREE.Mesh).geometry) {
        ((child as THREE.Mesh).geometry as THREE.BufferGeometry).dispose();
      }
      const material = (child as THREE.Mesh).material;
      if (Array.isArray(material)) {
        material.forEach((mat) => mat.dispose());
      } else if (material) {
        material.dispose();
      }
    });
  }

  private addBallGlow(mesh: THREE.Mesh | THREE.Object3D, radius: number) {
    const glowRadius = radius * 1.12;
    const glowOpacity = 0.2;
    mesh.userData.baseBallRadius = radius;
    const existing = mesh.children.find((child) => child.name === 'ball-glow') as
      | THREE.Mesh
      | undefined;
    if (existing) {
      const oldGeometry = existing.geometry;
      if (oldGeometry) {
        oldGeometry.dispose();
      }
      existing.geometry = new THREE.SphereGeometry(glowRadius, 32, 32);
      const material = existing.material as THREE.MeshBasicMaterial;
      material.color = new THREE.Color(0x000000);
      material.transparent = true;
      material.opacity = glowOpacity;
      material.side = THREE.BackSide;
      material.depthTest = true;
      material.depthWrite = false;
      material.needsUpdate = true;
      existing.renderOrder = this.layerOrder.orderBalls - 1;
      return;
    }

    const glowGeometry = new THREE.SphereGeometry(glowRadius, 32, 32);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: glowOpacity,
      side: THREE.BackSide, // Render from inside so it appears as an outline
      depthTest: true,
      depthWrite: false,
    });
    glowMaterial.needsUpdate = true;

    const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
    glowMesh.name = 'ball-glow';
    glowMesh.renderOrder = this.layerOrder.orderBalls - 1; // Render behind the ball
    mesh.add(glowMesh);
  }

  private applyBallRenderOrder(mesh: THREE.Object3D) {
    mesh.renderOrder = this.layerOrder.orderBalls;
    mesh.children.forEach((child) => {
      if (child.name === 'ball-glow') {
        child.renderOrder = this.layerOrder.orderBalls - 1;
      } else {
        child.renderOrder = this.layerOrder.orderBalls;
      }
    });
  }
  
  addBallNumber(mesh: THREE.Mesh, ballId: number) {
    // Create canvas for number texture
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    
    // Draw white circle background for striped balls
    if (ballId >= 9 && ballId <= 15) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(128, 128, 80, 0, Math.PI * 2);
      ctx.fill();
      
      // Add subtle shadow/border
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    
    // Draw number with better styling
    ctx.fillStyle = ballId >= 9 && ballId <= 15 ? '#000000' : '#ffffff';
    ctx.font = 'bold 120px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Add text shadow for depth
    ctx.shadowColor = ballId >= 9 && ballId <= 15 ? 'rgba(0, 0, 0, 0.3)' : 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    
    ctx.fillText(ballId.toString(), 128, 128);
    
    // Create texture from canvas
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    
    // Create sprite for the number (always faces camera)
    const spriteMaterial = new THREE.SpriteMaterial({ 
      map: texture,
      transparent: true
    });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(2, 2, 1); // Larger number
    sprite.position.set(0, 0, 0.01); // Slightly above ball surface
    
    mesh.add(sprite);
  }
  
  addBallStripe(mesh: THREE.Mesh, radius: number) {
    // Create white stripe band around the ball (flat horizontal band)
    // Use a thin cylinder that wraps around the equator
    const stripeHeight = radius * 0.6; // Width of the stripe band
    const stripeGeometry = new THREE.CylinderGeometry(
      radius * 1.01, // Slightly larger than ball to sit on surface
      radius * 1.01,
      stripeHeight,
      32,
      1,
      true // Open ended
    );
    const stripeMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.3,
      metalness: 0.4,
      side: THREE.DoubleSide
    });
    const stripe = new THREE.Mesh(stripeGeometry, stripeMaterial);
    stripe.rotation.x = Math.PI / 2; // Rotate to be horizontal
    
    mesh.add(stripe);
  }
  
  render(world: PhysicsWorld, alpha: number) {
    // Ensure stencil is applied after any async/late mesh creation
    if (this.frameStencilMesh && !this.stencilAppliedOnce) {
      this.applyStencilToTableMeshes();
      this.stencilAppliedOnce = true;
    }

    if (this.showMeasurementOverlay) {
      this.drawMeasurementOverlay();
    }

    const shakeOffset = this.computeShakeOffset();
    this.applyShakeTransform(shakeOffset.x, shakeOffset.y);
    
    // Update ball positions and rotations
    world.balls.forEach((ball) => {
      if (ball.pocketed) {
        const mesh = this.ballMeshes.get(ball.id);
        if (mesh) {
          mesh.visible = false;
        }
        return;
      }
      
      let mesh = this.ballMeshes.get(ball.id);
      if (!mesh) {
        mesh = this.createBall(ball);
      }
      
      // Interpolate position
      const x = ball.prevX + (ball.x - ball.prevX) * alpha;
      const y = ball.prevY + (ball.y - ball.prevY) * alpha;
      
      const shouldRenderBall = this.layerVisibility.showBalls;
      mesh.visible = shouldRenderBall;
      if (!shouldRenderBall) {
        // Update transform so ball appears at correct place when re-enabled
        mesh.position.set(x, y, CONFIG.BALL_RADIUS);
        return;
      }

      mesh.position.set(x, y, CONFIG.BALL_RADIUS);
      
      mesh.quaternion.set(ball.rotX, ball.rotY, ball.rotZ, ball.rotW);
    });
    
    // Render the scene
    this.renderer.render(this.scene, this.camera);

    // Clear UI canvas BEFORE drawing new UI elements (pocket animations, cue, etc.)
    // This must happen after WebGL render but before any UI canvas drawing
    this.uiCtx.clearRect(0, 0, this.uiCanvas.width, this.uiCanvas.height);

    this.processPocketAnimationQueue();
    this.drawPocketAnimations();
  }

  /**
   * Generate ball icon thumbnails using the same geometry/materials as the 3D balls.
   * Returns a map of ballId -> dataURL (PNG). Cached after first generation.
   */
  async generateBallIcons(sizePx: number = 64): Promise<Map<number, string>> {
    const size = Math.max(8, Math.min(128, Math.round(sizePx)));
    const cached = this.ballIconCaches.get(size);
    if (cached) return cached;

    const prevToneMappingExposure = this.renderer.toneMappingExposure;
    this.renderer.toneMappingExposure = Math.min(prevToneMappingExposure * 1.2, prevToneMappingExposure + 0.35);

    // Use main WebGL context via an offscreen render target (avoids cross-context texture issues)
    const rt = new THREE.WebGLRenderTarget(size, size, {
      depthBuffer: false,
      stencilBuffer: false,
      samples: 8  // Enable 8x MSAA for smooth antialiasing
    });

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(26, 1, 0.01, 10);
    camera.position.set(0, 0, 2.6);
    camera.lookAt(0, 0, 0);

    const applyIconLighting = () => {
      // Warmer key and cooler fill for color separation on the stripes
      const ambient = new THREE.AmbientLight(0xffffff, 0.9);
      scene.add(ambient);

      const hemi = new THREE.HemisphereLight(0xfff2d9, 0x101010, 0.7);
      scene.add(hemi);

      const key = new THREE.DirectionalLight(0xfff1d6, 2.2);
      key.position.set(3.0, 2.6, 4.4);
      scene.add(key);

      const fill = new THREE.DirectionalLight(0xdfe8ff, 1.15);
      fill.position.set(-2.4, -1.8, 3.2);
      scene.add(fill);

      // Reduced rim intensity and moved to lower-left to shift highlight off the number decal
      const rim = new THREE.PointLight(0xffffff, 0.45);
      rim.position.set(-2.5, -1.5, 4.0);
      scene.add(rim);

      // Softened top light to reduce direct washout
      const top = new THREE.DirectionalLight(0xffffff, 0.7);
      top.position.set(0.0, 0.5, 5.0);
      scene.add(top);
    };

    const ids = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15];
    const result = new Map<number, string>();

    const deg = THREE.MathUtils.degToRad;
    const orientation = new Map<number, { rx: number; ry: number }>();
    const defaultSolid = { rx: Math.PI * 1.5 - deg(1), ry: Math.PI * 0.5 + deg(4) };
    const darkSolid = { rx: defaultSolid.rx - deg(1.5), ry: defaultSolid.ry + deg(4) };
    const solidIds = [1, 2, 3, 5, 6];
    solidIds.forEach((id) => orientation.set(id, defaultSolid));
    [4, 7].forEach((id) => orientation.set(id, darkSolid));
    orientation.set(8, { rx: defaultSolid.rx - deg(1), ry: defaultSolid.ry + deg(6) });

    const stripePitch = Math.PI * 1.48;
    const stripeYaw = Math.PI * 0.5 - deg(20);
    const accentStripeYaw = stripeYaw - deg(6);
    [9, 10, 11, 13, 14].forEach((id) => orientation.set(id, { rx: stripePitch, ry: stripeYaw }));
    [12, 15].forEach((id) => orientation.set(id, { rx: stripePitch, ry: accentStripeYaw }));

    const buildMesh = async (id: number): Promise<THREE.Mesh> => {
      const baseRadius = (CONFIG.BALL_BASE_RADIUS ?? CONFIG.BALL_RADIUS);
      const template = this.ballModels.get(id);
      let geom: THREE.BufferGeometry;
      let mat: THREE.MeshStandardMaterial;
      if (template) {
        geom = template.geometry.clone();
        geom.computeBoundingSphere();
        const center = geom.boundingSphere?.center ?? new THREE.Vector3();
        const radius = geom.boundingSphere?.radius ?? baseRadius;
        // Center and scale - use larger size to fill the icon space better
        geom.translate(-center.x, -center.y, -center.z);
        const targetRadius = 0.54;  // Larger to fill more of the available space
        const scale = targetRadius / Math.max(1e-6, radius);
        geom.scale(scale, scale, scale);
        mat = template.material.clone();
        mat.roughness = Math.max(0.08, Math.min(0.4, mat.roughness ?? 0.3));
        mat.metalness = Math.min(0.65, Math.max(0.25, mat.metalness ?? 0.35));
        mat.envMapIntensity = 1.2;
      } else {
        geom = new THREE.SphereGeometry(baseRadius, 48, 48);
        mat = new THREE.MeshStandardMaterial({ color: CONFIG.BALL_COLORS[id - 1] || '#ffffff', roughness: 0.22, metalness: 0.55 });
      }

      // Reuse the template's texture map if present
      const tex = (template?.material as THREE.MeshStandardMaterial | undefined)?.map ?? null;
      if (tex && tex.image) {
        mat.map = tex;
        mat.map.colorSpace = THREE.SRGBColorSpace;
        mat.map.needsUpdate = false;
        // Ensure material color is white so it doesn't tint the texture
        mat.color.setHex(0xffffff);
      }

      const mesh = new THREE.Mesh(geom, mat);
      // Slight rotation to expose number/stripe; stripes rotate more to show color
      const ori = orientation.get(id) ?? { rx: Math.PI * 1.5, ry: Math.PI * 0.5 };
      mesh.rotation.x = ori.rx;
      mesh.rotation.y = ori.ry;
      return mesh;
    };

    try {
      for (const id of ids) {
        // Clear scene and rebuild lights
        while (scene.children.length > 0) scene.remove(scene.children[0]);
        applyIconLighting();

        const mesh = await buildMesh(id);
        mesh.position.set(0, 0, 0);
        scene.add(mesh);

        const prevTarget = this.renderer.getRenderTarget();
        this.renderer.setRenderTarget(rt);
        this.renderer.clear();
        this.renderer.render(scene, camera);
        this.renderer.setRenderTarget(prevTarget);

        const pixels = new Uint8Array(size * size * 4);
        this.renderer.readRenderTargetPixels(rt, 0, 0, size, size, pixels);
        const canvas2D = document.createElement('canvas');
        canvas2D.width = size;
        canvas2D.height = size;
        const ctx = canvas2D.getContext('2d');
        const imgData = ctx!.createImageData(size, size);
        for (let y = 0; y < size; y++) {
          const src = (size - 1 - y) * size * 4;
          const dst = y * size * 4;
          imgData.data.set(pixels.subarray(src, src + size * 4), dst);
        }
        ctx!.putImageData(imgData, 0, 0);
        const url = canvas2D.toDataURL('image/png');
        result.set(id, url);

        // Cleanup mesh resources (geometry/material were cloned)
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) (mesh.material as THREE.Material).dispose();
      }

      this.ballIconCaches.set(size, result);
      return result;
    } finally {
      rt.dispose();
      this.renderer.toneMappingExposure = prevToneMappingExposure;
    }
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
    console.log(`Measurement overlay ${this.showMeasurementOverlay ? 'enabled' : 'disabled'}`);
  }

  applyRenderLayerSettings(settings: RenderLayerSettings) {
    this.applyRenderOrder(settings);
    this.setLayerVisibility('showTable', settings.showTable);
    this.setLayerVisibility('showFrame', settings.showFrame);
    this.setLayerVisibility('showRails', settings.showRails);
    this.setLayerVisibility('showPockets', settings.showPockets);
    this.setLayerVisibility('showCaps', settings.showCaps);
    this.setLayerVisibility('showBalls', settings.showBalls);
    this.setLayerVisibility('showUIOverlay', settings.showUIOverlay);
    this.setLayerVisibility('showMeasurementOverlay', settings.showMeasurementOverlay);
    this.setLayerVisibility('showReferenceOverlay', settings.showReferenceOverlay);
  }

  private applyRenderOrder(settings: RenderLayerSettings) {
    this.layerOrder.orderTable = settings.orderTable;
    this.layerOrder.orderFrame = settings.orderFrame;
    this.layerOrder.orderRails = settings.orderRails;
    this.layerOrder.orderPockets = settings.orderPockets;
    this.layerOrder.orderCaps = settings.orderCaps;
    this.layerOrder.orderBalls = settings.orderBalls;
    this.layerOrder.orderUI = settings.orderUI;

    if (this.tableMesh) {
      this.tableMesh.renderOrder = this.layerOrder.orderTable;
    }
    this.applyFrameRenderOrder();
    this.railMeshes.forEach((mesh) => {
      mesh.renderOrder = this.layerOrder.orderRails;
    });
    this.railHighlightMeshes.forEach((mesh) => {
      mesh.renderOrder = this.layerOrder.orderRails + 0.1;
    });
    this.pocketMeshes.forEach((mesh) => {
      mesh.renderOrder = this.layerOrder.orderPockets;
    });
    this.pocketBottomMeshes.forEach((mesh) => {
      mesh.renderOrder = this.layerOrder.orderPockets - 0.2;
    });
    this.pocketGradientMeshes.forEach((mesh) => {
      mesh.renderOrder = this.layerOrder.orderPockets + 0.1;
    });
    this.pocketCapMeshes.forEach((mesh) => {
      mesh.renderOrder = this.layerOrder.orderCaps;
    });
    this.pocketShadowMeshes.forEach((mesh) => {
      mesh.renderOrder = this.layerOrder.orderPockets + 0.2;
    });
    this.pocketGrooveMeshes.forEach((mesh) => {
      mesh.renderOrder = this.layerOrder.orderPockets + 0.21;
    });
    this.pocketRimMeshes.forEach((mesh) => {
      mesh.renderOrder = this.layerOrder.orderPockets + 0.22;
    });
    if (this.railFillMesh) {
      this.railFillMesh.renderOrder = this.layerOrder.orderRails - 1; // Render before rails
    }
    this.ballMeshes.forEach((mesh) => {
      this.applyBallRenderOrder(mesh);
    });

    this.updateCanvasZIndex();
  }

  private applyFrameRenderOrder() {
    if (!this.frameMesh) return;
    this.frameMesh.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        (obj as THREE.Mesh).renderOrder = this.layerOrder.orderFrame;
      }
    });
    this.frameMesh.visible = this.layerVisibility.showFrame;
    this.enforceRenderOrderControl(this.frameMesh);
    // Keep stencil application in sync with render order updates
    if (this.frameStencilMesh) {
      this.applyStencilToTableMeshes();
    }
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
        if (this.tableMesh) this.tableMesh.visible = visible;
        break;
      case 'showFrame':
        if (this.frameMesh) this.frameMesh.visible = visible;
        break;
      case 'showRails':
        this.railMeshes.forEach((mesh) => (mesh.visible = visible));
        this.railHighlightMeshes.forEach((mesh) => (mesh.visible = visible));
        this.railShadowMeshes.forEach((mesh) => (mesh.visible = visible));
        if (this.railShadowRibbonMesh) this.railShadowRibbonMesh.visible = visible;
        if (this.railHighlightRibbonMesh) this.railHighlightRibbonMesh.visible = visible;
        if (this.railFillMesh) this.railFillMesh.visible = visible;
        break;
      case 'showPockets':
        this.applyPocketsVisibility(visible);
        break;
      case 'showCaps':
        this.pocketCapMeshes.forEach((mesh) => (mesh.visible = visible));
        break;
      case 'showBalls':
        if (!visible) {
          this.ballMeshes.forEach((mesh) => (mesh.visible = false));
        }
        break;
      case 'showUIOverlay':
        this.updateCanvasZIndex();
        break;
      case 'showMeasurementOverlay':
        this.toggleMeasurementOverlay(visible);
        break;
      case 'showReferenceOverlay':
        this.setReferenceOverlayVisible(visible);
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
    this.updatePocketDebugMaterials();
  }

  private applyPocketsVisibility(visible: boolean) {
    this.pocketMeshes.forEach((mesh) => (mesh.visible = visible));
    this.pocketBottomMeshes.forEach((mesh) => (mesh.visible = visible));
    const gradientVisible = visible && !this.debugMode;
    this.pocketGradientMeshes.forEach((mesh) => (mesh.visible = gradientVisible));
    this.pocketShadowMeshes.forEach((mesh) => (mesh.visible = visible));
    this.pocketHighlightMeshes.forEach((mesh) => (mesh.visible = visible));
    this.pocketGrooveMeshes.forEach((mesh) => (mesh.visible = visible));
    this.pocketRimMeshes.forEach((mesh) => (mesh.visible = visible));
  }

  setPocketGradientStrength(value: number) {
    this.pocketGradientStrength = Math.max(0, Math.min(1, value));
    if (this.pocketGradientTexture) {
      this.pocketGradientTexture.dispose();
      this.pocketGradientTexture = null;
    }
    const tex = this.getPocketGradientTexture();
    this.pocketGradientMeshes.forEach((m) => {
      const mat = m.material as THREE.MeshBasicMaterial;
      mat.map = tex;
      mat.needsUpdate = true;
    });
  }

  setPocketShadeColors(colors: {
    grooveColor?: string;
    rimColor?: string;
    bottomColor?: string;
    gradientCenter?: string;
    gradientEdge?: string;
    wallColor?: string;
  }) {
    if (colors.grooveColor) {
      try { this.grooveColor = new THREE.Color(colors.grooveColor); } catch {}
      this.pocketGrooveMeshes.forEach((m) => {
        const mat = m.material as THREE.MeshBasicMaterial; mat.color = this.grooveColor.clone(); mat.needsUpdate = true;
      });
    }
    if (colors.rimColor) {
      try { this.rimColor = new THREE.Color(colors.rimColor); } catch {}
      this.pocketRimMeshes.forEach((m) => {
        const mat = m.material as THREE.MeshBasicMaterial; mat.color = this.rimColor.clone(); mat.needsUpdate = true;
      });
    }
    if (colors.bottomColor) {
      try { this.pocketBottomColor = new THREE.Color(colors.bottomColor); } catch {}
      this.pocketBottomMeshes.forEach((m) => {
        const mat = m.material as THREE.MeshBasicMaterial; mat.color.copy(this.pocketBottomColor); mat.needsUpdate = true;
      });
    }
    let refreshGradient = false;
    if (colors.gradientCenter) { this.gradientCenterColor = colors.gradientCenter; refreshGradient = true; }
    if (colors.gradientEdge) { this.gradientEdgeColor = colors.gradientEdge; refreshGradient = true; }
    if (refreshGradient) {
      if (this.pocketGradientTexture) { this.pocketGradientTexture.dispose(); this.pocketGradientTexture = null; }
      const tex = this.getPocketGradientTexture();
      this.pocketGradientMeshes.forEach((m) => {
        const mat = m.material as THREE.MeshBasicMaterial;
        mat.map = tex;
        mat.needsUpdate = true;
      });
    }
    if (colors.wallColor) {
      try { this.pocketWallColor = new THREE.Color(colors.wallColor); } catch {}
      this.pocketMeshes.forEach((m) => {
        const mat = m.material as THREE.MeshBasicMaterial;
        mat.color.copy(this.pocketWallColor);
        mat.needsUpdate = true;
      });
      if (this.pocketSideMaterial) {
        this.pocketSideMaterial.color.copy(this.pocketWallColor);
        this.pocketSideMaterial.needsUpdate = true;
      }
    }
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
    this.grooveInnerBase = settings.innerBase;
    this.grooveInnerDepthScale = settings.innerDepthScale;
    this.grooveThicknessFactor = settings.thicknessFactor;
    this.grooveOpacityBase = settings.opacityBase;
    this.grooveOpacityDepthScale = settings.opacityDepthScale;
    this.grooveRimThicknessFactor = settings.rimThicknessFactor;
    this.grooveRimOuterOpacity = settings.rimOuterOpacity;
    this.grooveRimInnerOpacity = settings.rimInnerOpacity;
    this.rebuildPocketGrooves();
  }

  private rebuildPocketGrooves() {
    // Remove existing groove/rim meshes
    this.pocketGrooveMeshes.forEach((m) => {
      this.scene.remove(m);
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    });
    this.pocketGrooveMeshes = [];
    this.pocketRimMeshes.forEach((m) => {
      this.scene.remove(m);
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    });
    this.pocketRimMeshes = [];

    if (!this.lastPocketDefs.length) return;
    // Recreate groove/rim for current pockets
    this.lastPocketDefs.forEach((p) => {
      const visualRadius = p.visualRadius ?? (p as any).radius ?? 2.5;
      const shelfDepthIn = p.shelfDepth ?? CONFIG.POCKET_SHELF_DEPTH_IN;
      const depthFactor = Math.max(0, Math.min(1, (shelfDepthIn ?? 0.5) / 2.0));

      const grooveInner = visualRadius * (this.grooveInnerBase + this.grooveInnerDepthScale * depthFactor);
      const grooveOuter = grooveInner + visualRadius * this.grooveThicknessFactor;
      const grooveGeometry = new THREE.RingGeometry(grooveInner, grooveOuter, 96, 1, 0, Math.PI * 2);
      const grooveMaterial = new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: this.grooveOpacityBase + this.grooveOpacityDepthScale * depthFactor,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const gm = new THREE.Mesh(grooveGeometry, grooveMaterial);
      gm.position.set(p.center.x, p.center.y, 0.21);
      gm.rotation.z = THREE.MathUtils.degToRad(p.cutAngleDeg ?? 0);
      gm.renderOrder = this.layerOrder.orderPockets + 0.21;
      gm.visible = this.layerVisibility.showPockets;
      this.enforceRenderOrderControl(gm, { disableDepth: true });
      this.scene.add(gm);
      this.pocketGrooveMeshes.push(gm);

      const rimInner = grooveOuter;
      const rimOuter = rimInner + visualRadius * this.grooveRimThicknessFactor;
      const rimGeometry = new THREE.RingGeometry(rimInner, rimOuter, 96, 1, 0, Math.PI * 2);
      const rimMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: this.grooveRimOuterOpacity * (0.5 + 0.5 * depthFactor),
        blending: THREE.AdditiveBlending,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const rm = new THREE.Mesh(rimGeometry, rimMaterial);
      rm.position.set(p.center.x, p.center.y, 0.22);
      rm.rotation.z = THREE.MathUtils.degToRad(p.cutAngleDeg ?? 0);
      rm.renderOrder = this.layerOrder.orderPockets + 0.22;
      rm.visible = this.layerVisibility.showPockets;
      this.enforceRenderOrderControl(rm, { disableDepth: true });
      this.scene.add(rm);
      this.pocketRimMeshes.push(rm);

      const rim2Outer = grooveInner;
      const rim2Inner = Math.max(0.01, rim2Outer - visualRadius * this.grooveRimThicknessFactor);
      const rim2Geometry = new THREE.RingGeometry(rim2Inner, rim2Outer, 96, 1, 0, Math.PI * 2);
      const rim2Material = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: this.grooveRimInnerOpacity * (0.5 + 0.5 * depthFactor),
        blending: THREE.AdditiveBlending,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const rm2 = new THREE.Mesh(rim2Geometry, rim2Material);
      rm2.position.set(p.center.x, p.center.y, 0.22);
      rm2.rotation.z = THREE.MathUtils.degToRad(p.cutAngleDeg ?? 0);
      rm2.renderOrder = this.layerOrder.orderPockets + 0.22;
      rm2.visible = this.layerVisibility.showPockets;
      this.enforceRenderOrderControl(rm2, { disableDepth: true });
      this.scene.add(rm2);
      this.pocketRimMeshes.push(rm2);
    });
  }

  private updatePocketDebugMaterials() {
    const wallDebugColor = new THREE.Color('#ff4fa2');
    const wallBaseFallback = new THREE.Color(0x0a0a0a);
    const floorBaseFallback = new THREE.Color(0x000000);
    const capDebugColor = new THREE.Color('#1ec8ff');
    const capBaseFallback = new THREE.Color(0xffffff);

    const applyColor = (mesh: THREE.Mesh, fallback: THREE.Color, debugColor: THREE.Color, useDebug: boolean) => {
      const material = mesh.material as THREE.MeshBasicMaterial | undefined;
      if (!material) return;
      material.userData = material.userData ?? {};
      if (!material.userData.baseColor) {
        material.userData.baseColor = material.color?.clone() ?? fallback.clone();
      }
      const baseColor: THREE.Color = material.userData.baseColor ?? fallback;
      if (useDebug) {
        material.color.copy(debugColor);
      } else {
        material.color.copy(baseColor);
      }
      material.needsUpdate = true;
    };

    this.pocketMeshes.forEach((mesh) => applyColor(mesh, wallBaseFallback, wallDebugColor, this.debugMode));
    this.pocketBottomMeshes.forEach((mesh) => applyColor(mesh, floorBaseFallback, wallDebugColor, this.debugMode));

    this.pocketCapMeshes.forEach((mesh) => {
      const material = mesh.material as THREE.MeshBasicMaterial | undefined;
      if (!material) return;
      material.userData = material.userData ?? {};
      if (!material.userData.baseColor) {
        material.userData.baseColor = material.color?.clone() ?? capBaseFallback.clone();
      }
      if (!material.userData.baseMap && material.map) {
        material.userData.baseMap = material.map;
      }
      const baseColor: THREE.Color = material.userData.baseColor ?? capBaseFallback;
      if (this.debugMode) {
        material.map = null;
        material.color.copy(capDebugColor);
      } else {
        material.map = material.userData.baseMap ?? this.getPocketGradientTexture();
        material.color.copy(baseColor);
      }
      material.needsUpdate = true;
    });

    this.applyPocketsVisibility(this.layerVisibility.showPockets);
  }

  private enforceRenderOrderControl(object: THREE.Object3D, options?: { disableDepth?: boolean }) {
    const disableDepth = options?.disableDepth ?? false;
    object.traverse((child) => {
      const mesh = child as THREE.Mesh & { isMesh?: boolean };
      if (!mesh || !(mesh as any).isMesh) return;
      if (mesh.name === 'ball-glow') return;
      const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(material)) {
        material.forEach((mat) => this.applyDepthControl(mat, disableDepth));
      } else if (material) {
        this.applyDepthControl(material, disableDepth);
      }
    });
  }

  private applyDepthControl(material: THREE.Material, disableDepth: boolean) {
    if ('depthTest' in material) {
      material.depthTest = !disableDepth;
    }
    if ('depthWrite' in material) {
      material.depthWrite = !disableDepth;
    }
    material.needsUpdate = true;
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

  drawMeasurementOverlay() {
    const ctx = this.uiCtx;
    const geom = getTableGeometry();
    const halfW = geom.playWidthIn / 2;
    const halfH = geom.playHeightIn / 2;
    const tickSpacing = 10;
    const labelSpacing = 20;

    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 1;
    ctx.font = '12px "Segoe UI", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    // Table outline
    const topLeft = this.worldToScreen(-halfW, halfH);
    const topRight = this.worldToScreen(halfW, halfH);
    const bottomLeft = this.worldToScreen(-halfW, -halfH);
    const bottomRight = this.worldToScreen(halfW, -halfH);

    ctx.beginPath();
    ctx.moveTo(topLeft.x, topLeft.y);
    ctx.lineTo(topRight.x, topRight.y);
    ctx.lineTo(bottomRight.x, bottomRight.y);
    ctx.lineTo(bottomLeft.x, bottomLeft.y);
    ctx.closePath();
    ctx.stroke();

    // Vertical ticks and labels
    for (let x = -halfW; x <= halfW + 0.01; x += tickSpacing) {
      const top = this.worldToScreen(x, halfH);
      const bottom = this.worldToScreen(x, -halfH);

      ctx.beginPath();
      ctx.moveTo(top.x, top.y);
      ctx.lineTo(top.x, top.y - 6);
      ctx.moveTo(bottom.x, bottom.y);
      ctx.lineTo(bottom.x, bottom.y + 6);
      ctx.stroke();

      const distanceFromWest = Math.round(x + halfW);
      if (distanceFromWest % labelSpacing === 0) {
        ctx.fillText(`${distanceFromWest}"`, top.x + 2, top.y - 10);
        ctx.fillText(`${distanceFromWest}"`, bottom.x + 2, bottom.y + 12);
      }
    }

    // Horizontal ticks and labels
    ctx.textAlign = 'right';
    for (let y = -halfH; y <= halfH + 0.01; y += tickSpacing) {
      const left = this.worldToScreen(-halfW, y);
      const right = this.worldToScreen(halfW, y);

      ctx.beginPath();
      ctx.moveTo(left.x, left.y);
      ctx.lineTo(left.x - 6, left.y);
      ctx.moveTo(right.x, right.y);
      ctx.lineTo(right.x + 6, right.y);
      ctx.stroke();

      const distanceFromSouth = Math.round(y + halfH);
      if (distanceFromSouth % labelSpacing === 0) {
        ctx.fillText(`${distanceFromSouth}"`, left.x - 8, left.y);
        ctx.textAlign = 'left';
        ctx.fillText(`${distanceFromSouth}"`, right.x + 8, right.y);
        ctx.textAlign = 'right';
      }
    }

    // Center lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    const midLeft = this.worldToScreen(-halfW, 0);
    const midRight = this.worldToScreen(halfW, 0);
    ctx.beginPath();
    ctx.moveTo(midLeft.x, midLeft.y);
    ctx.lineTo(midRight.x, midRight.y);
    ctx.stroke();

    const midTop = this.worldToScreen(0, halfH);
    const midBottom = this.worldToScreen(0, -halfH);
    ctx.beginPath();
    ctx.moveTo(midTop.x, midTop.y);
    ctx.lineTo(midBottom.x, midBottom.y);
    ctx.stroke();

    // Ball size reference (top-right corner)
    const ballRadiusPx = CONFIG.BALL_RADIUS * this.scale;
    const sampleX = this.uiCanvas.width - ballRadiusPx * 3;
    const sampleY = ballRadiusPx * 3;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.beginPath();
    ctx.arc(sampleX, sampleY, ballRadiusPx, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.textAlign = 'center';
    const ballDiameterIn = (CONFIG.BALL_RADIUS * 2).toFixed(2);
    ctx.fillText(`Ball ${ballDiameterIn}"`, sampleX, sampleY + ballRadiusPx + 14);

    ctx.restore();
  }
  
  // Helper to convert world coordinates to screen coordinates
  worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    // Project world coordinates through the camera
    const vector = new THREE.Vector3(worldX, worldY, 0);
    vector.project(this.camera);
    
    // Convert from NDC (-1 to 1) to screen coordinates
    const screenX = (vector.x + 1) * this.uiCanvas.width / 2;
    const screenY = (-vector.y + 1) * this.uiCanvas.height / 2;
    
    return { x: screenX, y: screenY };
  }
  
  // Helper to clip a line at table boundaries (inside the rails)
  clipLineAtRails(start: { x: number; y: number }, end: { x: number; y: number }): { x: number; y: number } {
    // Use the actual rail boundaries from geometry
    const geom2 = getTableGeometry();
    const halfWidth = geom2.playWidthIn / 2;
    const halfHeight = geom2.playHeightIn / 2;
    
    // Add a small margin to keep lines inside the play area
    const margin = CONFIG.BALL_RADIUS;
    const maxX = halfWidth - margin;
    const maxY = halfHeight - margin;
    const minX = -maxX;
    const minY = -maxY;
    
    // Calculate direction
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    
    if (len < 0.001) return end;
    
    const dirX = dx / len;
    const dirY = dy / len;
    
    // Find intersection with table boundaries
    let minT = len; // Start with full length
    
    // Check each boundary
    if (dirX > 0.001) {
      const t = (maxX - start.x) / dirX;
      if (t > 0 && t < minT) minT = t;
    } else if (dirX < -0.001) {
      const t = (minX - start.x) / dirX;
      if (t > 0 && t < minT) minT = t;
    }
    
    if (dirY > 0.001) {
      const t = (maxY - start.y) / dirY;
      if (t > 0 && t < minT) minT = t;
    } else if (dirY < -0.001) {
      const t = (minY - start.y) / dirY;
      if (t > 0 && t < minT) minT = t;
    }
    
    // Return clipped endpoint
    return {
      x: start.x + dirX * minT,
      y: start.y + dirY * minT
    };
  }

  private classifyAxisAlignmentFromPath(path: Vec2[]): AxisAlignment {
    if (path.length < 2) return null;
    const start = path[0];
    const end = path[path.length - 1];
    return classifyAxisAlignmentFromVector(end.x - start.x, end.y - start.y);
  }
  
  // Compatibility methods for existing code
  drawCueAndPowerBar(ball: Ball, angle: number, power: number, showGhost: boolean, showPowerBar: boolean, isAimMode: boolean, prediction?: PredictionResult, microDialState?: MicroDialRenderState) {
    // Remove old 3D elements if they exist
    if (this.cueStick) {
      this.scene.remove(this.cueStick);
      this.cueStick = null;
    }
    if (this.aimLine) {
      this.scene.remove(this.aimLine);
      this.aimLine = null;
    }
    if (this.ghostBall) {
      this.scene.remove(this.ghostBall);
      this.ghostBall = null;
    }
    
    // Draw cue stick in 2D (clamped to play area so it doesn't clip off-canvas)
    const cueLength = CONFIG.CUE_LENGTH_IN ?? 20;
    // As power increases, cue pulls back away from ball (not toward it)
    const cueDistance = ball.radius + 2 + (power / CONFIG.CUE_POWER_MAX) * 3;

    // Raw endpoints in world space (behind the ball opposite shot direction)
    const rawNear = { x: ball.x - Math.cos(angle) * cueDistance, y: ball.y - Math.sin(angle) * cueDistance };
    const rawFar = { x: ball.x - Math.cos(angle) * (cueDistance + cueLength), y: ball.y - Math.sin(angle) * (cueDistance + cueLength) };

    // Do NOT clamp to rails — allow cue to extend into padded world area without clipping
    const cueStart = this.worldToScreen(rawNear.x, rawNear.y);
    const cueEnd = this.worldToScreen(rawFar.x, rawFar.y);

    // Scale cue thickness with world scale (about 1 inch diameter in world units)
    const cueThicknessInches = 1.0; // Standard cue stick diameter
    const cueThicknessPixels = cueThicknessInches * this.scale;

    // Calculate tip position (about 0.4 inches from the near end - slightly exaggerated for visibility)
    const tipLengthInches = 0.4;
    const tipEnd = {
      x: ball.x - Math.cos(angle) * cueDistance,
      y: ball.y - Math.sin(angle) * cueDistance
    };
    const tipStart = {
      x: ball.x - Math.cos(angle) * (cueDistance + tipLengthInches),
      y: ball.y - Math.sin(angle) * (cueDistance + tipLengthInches)
    };
    const tipStartScreen = this.worldToScreen(tipStart.x, tipStart.y);
    const tipEndScreen = this.worldToScreen(tipEnd.x, tipEnd.y);

    // Get cue colors from settings
    const cueStickColor = (CONFIG as any).CUE_STICK_COLOR || '#8B4513';
    const cueTipColor = (CONFIG as any).CUE_TIP_COLOR || '#4A90E2';

    // Draw main cue stick with gradient shading for 3D effect
    const lineWidth = Math.max(4, cueThicknessPixels);

    // Create gradient perpendicular to cue direction for cylindrical appearance
    const dx = cueEnd.x - tipStartScreen.x;
    const dy = cueEnd.y - tipStartScreen.y;
    const length = Math.hypot(dx, dy);

    if (length > 0) {
      // Perpendicular direction for gradient
      const perpX = -dy / length;
      const perpY = dx / length;

      // Gradient center line
      const midX = (tipStartScreen.x + cueEnd.x) / 2;
      const midY = (tipStartScreen.y + cueEnd.y) / 2;

      // Create radial-like gradient effect by drawing multiple passes
      // Shadow/dark side
      this.uiCtx.strokeStyle = this.shadeColor(cueStickColor, -0.4);
      this.uiCtx.lineWidth = lineWidth;
      this.uiCtx.lineCap = 'butt';
      this.uiCtx.beginPath();
      this.uiCtx.moveTo(tipStartScreen.x, tipStartScreen.y);
      this.uiCtx.lineTo(cueEnd.x, cueEnd.y);
      this.uiCtx.stroke();

      // Mid-tone
      this.uiCtx.strokeStyle = cueStickColor;
      this.uiCtx.lineWidth = lineWidth * 0.7;
      this.uiCtx.lineCap = 'butt';
      this.uiCtx.beginPath();
      this.uiCtx.moveTo(tipStartScreen.x, tipStartScreen.y);
      this.uiCtx.lineTo(cueEnd.x, cueEnd.y);
      this.uiCtx.stroke();

      // Highlight (top edge)
      this.uiCtx.strokeStyle = this.shadeColor(cueStickColor, 0.3);
      this.uiCtx.lineWidth = lineWidth * 0.3;
      this.uiCtx.lineCap = 'butt';
      this.uiCtx.beginPath();
      this.uiCtx.moveTo(tipStartScreen.x, tipStartScreen.y);
      this.uiCtx.lineTo(cueEnd.x, cueEnd.y);
      this.uiCtx.stroke();

      // Crisp guide along cue centerline so the shaft always visually points at the cue ball
      this.uiCtx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      this.uiCtx.lineWidth = Math.max(1, lineWidth * 0.18);
      this.uiCtx.lineCap = 'butt';
      this.uiCtx.beginPath();
      this.uiCtx.moveTo(tipStartScreen.x, tipStartScreen.y);
      this.uiCtx.lineTo(cueEnd.x, cueEnd.y);
      this.uiCtx.stroke();
    }

    // Draw tip with gradient shading
    const tipWidth = Math.max(3, cueThicknessPixels * 0.9);

    // Tip shadow
    this.uiCtx.strokeStyle = this.shadeColor(cueTipColor, -0.3);
    this.uiCtx.lineWidth = tipWidth;
    this.uiCtx.lineCap = 'butt';
    this.uiCtx.beginPath();
    this.uiCtx.moveTo(tipStartScreen.x, tipStartScreen.y);
    this.uiCtx.lineTo(tipEndScreen.x, tipEndScreen.y);
    this.uiCtx.stroke();

    // Tip mid-tone
    this.uiCtx.strokeStyle = cueTipColor;
    this.uiCtx.lineWidth = tipWidth * 0.6;
    this.uiCtx.lineCap = 'butt';
    this.uiCtx.beginPath();
    this.uiCtx.moveTo(tipStartScreen.x, tipStartScreen.y);
    this.uiCtx.lineTo(tipEndScreen.x, tipEndScreen.y);
    this.uiCtx.stroke();

    // Tip highlight
    this.uiCtx.strokeStyle = this.shadeColor(cueTipColor, 0.4);
    this.uiCtx.lineWidth = tipWidth * 0.25;
    this.uiCtx.lineCap = 'butt';
    this.uiCtx.beginPath();
    this.uiCtx.moveTo(tipStartScreen.x, tipStartScreen.y);
    this.uiCtx.lineTo(tipEndScreen.x, tipEndScreen.y);
    this.uiCtx.stroke();
    
    // Draw aim line in 2D - clipped to contact point or rails
    let aimEndX = ball.x + Math.cos(angle) * CONFIG.AIM_LINE_LENGTH;
    let aimEndY = ball.y + Math.sin(angle) * CONFIG.AIM_LINE_LENGTH;

    // If we have a prediction, stop at the ghost ball center (includes offset)
    if (prediction && prediction.type === 'ball') {
      // Calculate ghost ball position with offset
      const offsetDir = Math.atan2(
        prediction.contactPoint.y - ball.y,
        prediction.contactPoint.x - ball.x
      );
      aimEndX = prediction.contactPoint.x + Math.cos(offsetDir) * CONFIG.GHOST_BALL_OFFSET;
      aimEndY = prediction.contactPoint.y + Math.sin(offsetDir) * CONFIG.GHOST_BALL_OFFSET;
    } else if (prediction && prediction.type === 'rail') {
      aimEndX = prediction.contactPoint.x;
      aimEndY = prediction.contactPoint.y;
    } else {
      // Clip to rails if no prediction
      const aimEndRaw = { x: aimEndX, y: aimEndY };
      const clipped = this.clipLineAtRails({ x: ball.x, y: ball.y }, aimEndRaw);
      aimEndX = clipped.x;
      aimEndY = clipped.y;
    }
    
    const aimEnd = this.worldToScreen(aimEndX, aimEndY);
    
    // Start aim line at configured distance from the edge of the cue ball
    const offsetDistance = ball.radius + CONFIG.AIM_LINE_OFFSET;
    const aimStartX = ball.x + Math.cos(angle) * offsetDistance;
    const aimStartY = ball.y + Math.sin(angle) * offsetDistance;
    const aimStart = this.worldToScreen(aimStartX, aimStartY);
    
    if (showGhost) {
      // Aim assist enabled: solid white with black glow
      // Draw black glow (outer)
      this.uiCtx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
      this.uiCtx.lineWidth = 7;
      this.uiCtx.lineCap = 'round';
      this.uiCtx.beginPath();
      this.uiCtx.moveTo(aimStart.x, aimStart.y);
      this.uiCtx.lineTo(aimEnd.x, aimEnd.y);
      this.uiCtx.stroke();
      
      // Draw solid white line (inner)
      this.uiCtx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
      this.uiCtx.lineWidth = 3;
      this.uiCtx.lineCap = 'round';
      this.uiCtx.beginPath();
      this.uiCtx.moveTo(aimStart.x, aimStart.y);
      this.uiCtx.lineTo(aimEnd.x, aimEnd.y);
      this.uiCtx.stroke();
    } else {
      // No aim assist: simple dashed line
      this.uiCtx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      this.uiCtx.lineWidth = 1;
      this.uiCtx.setLineDash([5, 5]);
      this.uiCtx.beginPath();
      this.uiCtx.moveTo(aimStart.x, aimStart.y);
      this.uiCtx.lineTo(aimEnd.x, aimEnd.y);
      this.uiCtx.stroke();
      this.uiCtx.setLineDash([]);
    }
    
    // Draw ghost ball in 2D if prediction exists
    if (showGhost && prediction && prediction.type === 'ball' && prediction.hitBall) {
      // Ghost ball center with configurable offset from contact point
      // Positive offset = away from cue ball, negative = toward cue ball
      const offsetDir = Math.atan2(
        prediction.contactPoint.y - ball.y,
        prediction.contactPoint.x - ball.x
      );
      const ghostX = prediction.contactPoint.x + Math.cos(offsetDir) * CONFIG.GHOST_BALL_OFFSET;
      const ghostY = prediction.contactPoint.y + Math.sin(offsetDir) * CONFIG.GHOST_BALL_OFFSET;
      const ghostScreen = this.worldToScreen(ghostX, ghostY);
      
      // Draw ghost ball with black glow + white outline (matching path styling)
      // Draw black glow (outer)
      this.uiCtx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
      this.uiCtx.lineWidth = 4;
      this.uiCtx.lineCap = 'round';
      const ghostRadius = Math.abs(ball.radius * this.scale);
      if (ghostRadius > 0) {
        this.uiCtx.beginPath();
        this.uiCtx.arc(ghostScreen.x, ghostScreen.y, ghostRadius, 0, Math.PI * 2);
        this.uiCtx.stroke();

        // Draw solid white circle (inner)
        this.uiCtx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
        this.uiCtx.lineWidth = 2;
        this.uiCtx.lineCap = 'round';
        this.uiCtx.beginPath();
        this.uiCtx.arc(ghostScreen.x, ghostScreen.y, ghostRadius, 0, Math.PI * 2);
        this.uiCtx.stroke();
      } else {
        console.warn('Renderer3D: skipping ghost ball draw due to non-positive radius', ghostRadius, this.scale, this.ballScale);
      }
    }
    
    // Draw power bar in 2D
    if (showPowerBar) {
      this.drawPowerBar2D(power, isAimMode, microDialState);
    }

    // Draw aim info overlay (only if scale > 0)
    if (CONFIG.SHOW_AIM_INFO && CONFIG.AIM_INFO_SCALE > 0) {
      this.drawAimInfo(ball, angle, power, prediction);
    }
  }
  
  drawPowerBar2D(power: number, isAimMode: boolean, microDialState?: MicroDialRenderState) {
    const { width: barWidth, height: barHeight } = this.getSidebarSize();
    const rect = this.getSideBarRect('right', barWidth, barHeight);
    const barX = rect.x;
    const barY = rect.y;
    const ctx = this.uiCtx;

    // Background with subtle plate behind the color fill plus inner padding
    ctx.fillStyle = 'rgba(28, 32, 39, 0.65)';
    ctx.fillRect(barX, barY, barWidth, barHeight);
    const innerPadding = Math.max(3, barWidth * 0.08);
    const innerX = barX + innerPadding;
    const innerY = barY + innerPadding;
    const innerWidth = barWidth - innerPadding * 2;
    const innerHeight = barHeight - innerPadding * 2;

    // Power gradient is fully filled; motion is communicated via cue overlay
    const powerPercent = Math.max(0, Math.min(1, power / CONFIG.CUE_POWER_MAX));
    const gradient = ctx.createLinearGradient(innerX, innerY, innerX, innerY + innerHeight);
    gradient.addColorStop(0, 'rgba(255, 230, 109, 0.85)');
    gradient.addColorStop(0.6, 'rgba(255, 155, 47, 0.8)');
    gradient.addColorStop(1, 'rgba(255, 59, 48, 0.75)');
    ctx.fillStyle = gradient;
    ctx.fillRect(innerX, innerY, innerWidth, innerHeight);

    // Cue overlay: clipped so the shaft slides downward as power increases
    const cueWidth = Math.max(3, innerWidth * 0.5);
    const cueLength = innerHeight * 0.92;
    const cueX = innerX + (innerWidth - cueWidth) / 2;
    const ferruleHeight = Math.max(4, cueWidth * 0.3);
    const tipHeight = Math.max(4, cueWidth * 0.25);
    const cueTopMin = innerY + 10;
    const cueTopMax = innerY + innerHeight - tipHeight - 6;
    const cueTravel = Math.max(0, cueTopMax - cueTopMin);
    const cueY = cueTopMin + cueTravel * powerPercent;
    const adjustedCueLength = cueLength;

    ctx.save();
    ctx.beginPath();
    ctx.rect(innerX, innerY, innerWidth, innerHeight);
    ctx.clip();

    const cueStickHex = (CONFIG as any).CUE_STICK_COLOR || '#8B4513';
    const cueStickRGB = parseHexColor(cueStickHex);
    const cueStickBright = toRgba(lightenColor(cueStickRGB, 0.25), 1);
    const cueStickMid = toRgba(cueStickRGB, 1);
    const cueStickShadow = toRgba(darkenColor(cueStickRGB, 0.25), 1);

    const buttWidth = cueWidth;
    const tipWidthInner = Math.max(2, cueWidth * 0.45);
    const tipOffset = (buttWidth - tipWidthInner) / 2;

    // Draw cue core with tapered polygon
    ctx.fillStyle = cueStickMid;
    ctx.beginPath();
    ctx.moveTo(cueX + tipOffset, cueY);
    ctx.lineTo(cueX + tipOffset + tipWidthInner, cueY);
    ctx.lineTo(cueX + buttWidth, cueY + adjustedCueLength);
    ctx.lineTo(cueX, cueY + adjustedCueLength);
    ctx.closePath();
    ctx.fill();

    // Highlight and shadow trims for cylindrical feel along the taper
    ctx.fillStyle = cueStickBright;
    ctx.beginPath();
    ctx.moveTo(cueX + tipOffset + tipWidthInner * 0.2, cueY);
    ctx.lineTo(cueX + tipOffset + tipWidthInner * 0.5, cueY);
    ctx.lineTo(cueX + buttWidth * 0.55, cueY + adjustedCueLength);
    ctx.lineTo(cueX + buttWidth * 0.35, cueY + adjustedCueLength);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = cueStickShadow;
    ctx.beginPath();
    ctx.moveTo(cueX + tipOffset + tipWidthInner * 0.75, cueY);
    ctx.lineTo(cueX + tipOffset + tipWidthInner, cueY);
    ctx.lineTo(cueX + buttWidth, cueY + adjustedCueLength);
    ctx.lineTo(cueX + buttWidth * 0.8, cueY + adjustedCueLength);
    ctx.closePath();
    ctx.fill();

    // Glow outline to keep cue visible over the heatmap gradient
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.shadowColor = 'rgba(255, 255, 255, 0.4)';
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.moveTo(cueX + tipOffset, cueY);
    ctx.lineTo(cueX + tipOffset + tipWidthInner, cueY);
    ctx.lineTo(cueX + buttWidth, cueY + adjustedCueLength);
    ctx.lineTo(cueX, cueY + adjustedCueLength);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    // Cue ferrule + tip
    ctx.fillStyle = '#f7f0d2';
    ctx.fillRect(cueX + tipOffset, cueY, tipWidthInner, ferruleHeight);
    const cueTipHex = (CONFIG as any).CUE_TIP_COLOR || '#4A90E2';
    const cueTipRGB = parseHexColor(cueTipHex);
    ctx.fillStyle = toRgba(cueTipRGB, 1);
    ctx.fillRect(cueX + tipOffset, cueY - tipHeight, tipWidthInner, tipHeight);

    ctx.restore();

    // Border adopts the empty ball chip outline color for consistency
    ctx.strokeStyle = EMPTY_CHIP_BORDER;
    ctx.lineWidth = isAimMode ? 1 : 2;
    ctx.strokeRect(barX, barY, barWidth, barHeight);
    const metallicGradient = ctx.createLinearGradient(innerX, innerY, innerX, innerY + innerHeight);
    metallicGradient.addColorStop(0, 'rgba(196, 208, 214, 0.85)');
    metallicGradient.addColorStop(0.5, 'rgba(126, 140, 148, 0.9)');
    metallicGradient.addColorStop(1, 'rgba(212, 219, 224, 0.85)');
    ctx.strokeStyle = metallicGradient;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(innerX, innerY, innerWidth, innerHeight);

    this.drawMicroDial2D(microDialState);
  }

  private drawMicroDial2D(state?: MicroDialRenderState) {
    const { width: barWidth, height: barHeight } = this.getSidebarSize();
    const rect = this.getSideBarRect('left', barWidth, barHeight);
    const barX = rect.x;
    const barY = rect.y;
    const ctx = this.uiCtx;
    const value = Math.max(-1, Math.min(1, state?.value ?? 0));
    const degrees = state?.degrees ?? 0;
    const isActive = state?.isActive ?? false;
    const handlePercent = 0.5 - (value * 0.5);
    const handleY = barY + handlePercent * barHeight;
    const centerY = barY + barHeight / 2;
    const handleX = barX + barWidth / 2;

    ctx.save();
    ctx.fillStyle = 'rgba(28, 32, 39, 0.65)';
    ctx.fillRect(barX, barY, barWidth, barHeight);
    const innerPadding = Math.max(3, barWidth * 0.08);
    const innerX = barX + innerPadding;
    const innerY = barY + innerPadding;
    const innerWidth = barWidth - innerPadding * 2;
    const innerHeight = barHeight - innerPadding * 2;

    ctx.strokeStyle = EMPTY_CHIP_BORDER;
    ctx.lineWidth = isActive ? 2 : 1.5;
    ctx.strokeRect(barX, barY, barWidth, barHeight);
    const dialMetallic = ctx.createLinearGradient(innerX, innerY, innerX, innerY + innerHeight);
    dialMetallic.addColorStop(0, 'rgba(196, 208, 214, 0.85)');
    dialMetallic.addColorStop(0.5, 'rgba(126, 140, 148, 0.9)');
    dialMetallic.addColorStop(1, 'rgba(212, 219, 224, 0.85)');
    ctx.strokeStyle = dialMetallic;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(innerX, innerY, innerWidth, innerHeight);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(barX + 4, centerY);
    ctx.lineTo(barX + barWidth - 4, centerY);
    ctx.stroke();

    for (let i = 1; i <= 2; i++) {
      const offset = i * (barHeight / 6);
      ctx.beginPath();
      ctx.moveTo(barX + 6, centerY - offset);
      ctx.lineTo(barX + barWidth - 6, centerY - offset);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(barX + 6, centerY + offset);
      ctx.lineTo(barX + barWidth - 6, centerY + offset);
      ctx.stroke();
    }

    if (Math.abs(value) > 0.01) {
      const fromY = value > 0 ? handleY : centerY;
      const toY = value > 0 ? centerY : handleY;
      const gradient = ctx.createLinearGradient(barX, fromY, barX, toY);
      if (value > 0) {
        gradient.addColorStop(0, 'rgba(111, 202, 255, 0.8)');
        gradient.addColorStop(1, 'rgba(111, 202, 255, 0.1)');
      } else {
        gradient.addColorStop(0, 'rgba(255, 138, 101, 0.8)');
        gradient.addColorStop(1, 'rgba(255, 138, 101, 0.1)');
      }
      ctx.fillStyle = gradient;
      ctx.fillRect(innerX + 2, Math.min(fromY, toY), innerWidth - 4, Math.abs(toY - fromY));
    }

    const handleRadius = barWidth / 2 - 6;
    ctx.beginPath();
    ctx.arc(handleX, handleY, handleRadius, 0, Math.PI * 2);
    ctx.fillStyle = isActive ? '#fff59d' : '#ffd54f';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.stroke();

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(handleX, handleY - handleRadius + 4);
    ctx.lineTo(handleX, handleY + handleRadius - 4);
    ctx.stroke();

    ctx.restore();
  }

  drawAimInfo(ball: Ball, angle: number, power: number, prediction?: PredictionResult) {
    // Calculate values
    let angleDeg = (angle * 180 / Math.PI) % 360;
    if (angleDeg < 0) angleDeg += 360;

    const velocity = power * CONFIG.CUE_POWER_MULTIPLIER;
    const powerPct = (power / CONFIG.CUE_POWER_MAX) * 100;

    // Prepare metrics with icons
    const metrics: Array<{ icon: string; value: string; color: string }> = [
      { icon: '⟲', value: `${angleDeg.toFixed(1)}°`, color: '#4fc3f7' },
      { icon: '⚡', value: `${velocity.toFixed(0)}`, color: '#ffeb3b' },
      { icon: '⚙', value: `${powerPct.toFixed(0)}%`, color: '#ff5722' }
    ];

    // Add distance if available
    if (prediction && prediction.type !== 'none') {
      metrics.splice(1, 0, {
        icon: '↔',
        value: `${prediction.distance.toFixed(1)}"`,
        color: '#66bb6a'
      });
    }

    // Add cut angle for ball-to-ball collisions
    if (prediction && prediction.type === 'ball' && prediction.hitBall) {
      const targetBall = prediction.hitBall;
      const toBallAngle = Math.atan2(targetBall.y - ball.y, targetBall.x - ball.x);
      let cutAngle = Math.abs(angle - toBallAngle) * 180 / Math.PI;
      if (cutAngle > 90) cutAngle = 180 - cutAngle;
      metrics.push({
        icon: '◐',
        value: `${cutAngle.toFixed(1)}°`,
        color: '#ab47bc'
      });
    }

    // Position below table frame using world-to-screen coordinates
    const geom = getTableGeometry();
    const frameBottom = -geom.frameOutline.outerHalfHeight;
    const tableFrameBottom = this.worldToScreen(0, frameBottom);
    const offsetBelowFrame = 8; // Fixed pixel offset below frame edge

    // Layout configuration for circular badges
    const badgeRadius = 28 * CONFIG.AIM_INFO_SCALE;
    const badgeSpacing = 12 * CONFIG.AIM_INFO_SCALE;
    const totalWidth = metrics.length * (badgeRadius * 2) + (metrics.length - 1) * badgeSpacing;
    const startX = (this.uiCanvas.width - totalWidth) / 2;
    const startY = tableFrameBottom.y + offsetBelowFrame;

    // Draw each metric badge as a circle
    metrics.forEach((metric, i) => {
      const centerX = startX + badgeRadius + i * (badgeRadius * 2 + badgeSpacing);
      const centerY = startY + badgeRadius;

      // Draw outer glow
      const glowGradient = this.uiCtx.createRadialGradient(centerX, centerY, badgeRadius * 0.7, centerX, centerY, badgeRadius + 4);
      glowGradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
      glowGradient.addColorStop(1, 'rgba(0, 0, 0, 0.5)');
      this.uiCtx.fillStyle = glowGradient;
      this.uiCtx.beginPath();
      this.uiCtx.arc(centerX, centerY, badgeRadius + 4, 0, Math.PI * 2);
      this.uiCtx.fill();

      // Draw circle background with gradient
      const gradient = this.uiCtx.createRadialGradient(centerX, centerY - 5, 0, centerX, centerY, badgeRadius);
      gradient.addColorStop(0, 'rgba(30, 30, 40, 0.95)');
      gradient.addColorStop(1, 'rgba(15, 15, 20, 0.98)');
      this.uiCtx.fillStyle = gradient;
      this.uiCtx.beginPath();
      this.uiCtx.arc(centerX, centerY, badgeRadius, 0, Math.PI * 2);
      this.uiCtx.fill();

      // Draw colored ring
      this.uiCtx.strokeStyle = metric.color;
      this.uiCtx.lineWidth = 2.5;
      this.uiCtx.beginPath();
      this.uiCtx.arc(centerX, centerY, badgeRadius - 2, 0, Math.PI * 2);
      this.uiCtx.stroke();

      // Draw icon
      this.uiCtx.font = 'bold 18px Arial';
      this.uiCtx.fillStyle = metric.color;
      this.uiCtx.textAlign = 'center';
      this.uiCtx.textBaseline = 'middle';
      this.uiCtx.fillText(metric.icon, centerX, centerY - 6);

      // Draw value
      this.uiCtx.font = 'bold 10px monospace';
      this.uiCtx.fillStyle = '#ffffff';
      this.uiCtx.fillText(metric.value, centerX, centerY + 10);
    });
  }
  
  drawPrediction(_prediction: PredictionResult) {
    // Prediction is drawn as part of drawTrajectoryLines
  }
  
  drawTrajectoryLines(prediction: PredictionResult, cueBallPos: { x: number; y: number }, shotDirection: { x: number; y: number }, predictor: any) {
    // Clear old 3D trajectory lines
    this.trajectoryLines.forEach(line => this.scene.remove(line));
    this.trajectoryLines = [];
    
    if (prediction.type === 'none') return;
    
    // Draw line from cue ball to contact point (for all collision types)
    // Start cue path visualization at the ball surface (matches cue render)
    const shotDirLen = Math.hypot(shotDirection.x, shotDirection.y) || 1;
    const shotDirX = shotDirection.x / shotDirLen;
    const shotDirY = shotDirection.y / shotDirLen;
    const cueStartOffset = (CONFIG.BALL_RADIUS ?? 0) + (CONFIG.AIM_LINE_OFFSET ?? 0);
    const cueBallSurface = {
      x: cueBallPos.x + shotDirX * cueStartOffset,
      y: cueBallPos.y + shotDirY * cueStartOffset,
    };
    const cueBallScreen = this.worldToScreen(cueBallSurface.x, cueBallSurface.y);
    const contactScreen = this.worldToScreen(prediction.contactPoint.x, prediction.contactPoint.y);
    
    this.uiCtx.strokeStyle = 'rgba(0, 255, 255, 0.4)';
    this.uiCtx.lineWidth = 1;
    this.uiCtx.setLineDash([5, 5]);
    this.uiCtx.beginPath();
    this.uiCtx.moveTo(cueBallScreen.x, cueBallScreen.y);
    this.uiCtx.lineTo(contactScreen.x, contactScreen.y);
    this.uiCtx.stroke();
    this.uiCtx.setLineDash([]);
    
    // Get trajectory predictions
    const trajectories = predictor.predictTrajectories(
      prediction,
      cueBallPos,
      shotDirection,
      50 // Line length in inches (much longer for visibility)
    );
    
    // Draw object ball trajectory (yellow dashed line with arrowhead)
    if (trajectories.objectBallPath) {
      // Start from contact point (ghost ball center), not object ball position
      const start = { x: prediction.contactPoint.x, y: prediction.contactPoint.y };
      
      // Calculate direction from trajectory data
      const dirX = trajectories.objectBallPath.end.x - trajectories.objectBallPath.start.x;
      const dirY = trajectories.objectBallPath.end.y - trajectories.objectBallPath.start.y;
      const length = Math.sqrt(dirX * dirX + dirY * dirY);
      
      if (length > 0.0001) {
        const normX = dirX / length;
        const normY = dirY / length;
        const lineLength = 50; // Match the length passed to predictTrajectories
        const endRaw = { x: start.x + normX * lineLength, y: start.y + normY * lineLength };
        
        // Clip the line at table boundaries
        const end = this.clipLineAtRails(start, endRaw);
        
        const startScreen = this.worldToScreen(start.x, start.y);
        const endScreen = this.worldToScreen(end.x, end.y);
        
        const orientation = classifyAxisAlignmentFromVector(normX, normY);
        const palette = getAxisPalette(orientation);

        // Draw line
        this.uiCtx.strokeStyle = palette.debugStroke;
        this.uiCtx.lineWidth = 1;
        this.uiCtx.setLineDash([10, 10]);
        this.uiCtx.beginPath();
        this.uiCtx.moveTo(startScreen.x, startScreen.y);
        this.uiCtx.lineTo(endScreen.x, endScreen.y);
        this.uiCtx.stroke();
        this.uiCtx.setLineDash([]);
        
        // Draw arrowhead at end
        const dx = endScreen.x - startScreen.x;
        const dy = endScreen.y - startScreen.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len > 0) {
          const arrowSize = 10;
          const angle = Math.atan2(dy, dx);
          
          this.uiCtx.fillStyle = palette.debugFill;
          this.uiCtx.beginPath();
          this.uiCtx.moveTo(endScreen.x, endScreen.y);
          this.uiCtx.lineTo(
            endScreen.x - arrowSize * Math.cos(angle - Math.PI / 6),
            endScreen.y - arrowSize * Math.sin(angle - Math.PI / 6)
          );
          this.uiCtx.lineTo(
            endScreen.x - arrowSize * Math.cos(angle + Math.PI / 6),
            endScreen.y - arrowSize * Math.sin(angle + Math.PI / 6)
          );
          this.uiCtx.closePath();
          this.uiCtx.fill();
        }
      }
    }
    
    // Draw cue ball trajectory (white dashed line with arrowhead)
    if (trajectories.cueBallPath) {
      // Start from contact point (ghost ball center)
      const start = { x: prediction.contactPoint.x, y: prediction.contactPoint.y };
      
      // Calculate direction from trajectory data
      const dirX = trajectories.cueBallPath.end.x - trajectories.cueBallPath.start.x;
      const dirY = trajectories.cueBallPath.end.y - trajectories.cueBallPath.start.y;
      const length = Math.sqrt(dirX * dirX + dirY * dirY);
      
      if (length > 0.0001) {
        const normX = dirX / length;
        const normY = dirY / length;
        const lineLength = 50; // Match the length passed to predictTrajectories
        const endRaw = { x: start.x + normX * lineLength, y: start.y + normY * lineLength };
        
        // Clip the line at table boundaries
        const end = this.clipLineAtRails(start, endRaw);
        
        const startScreen = this.worldToScreen(start.x, start.y);
        const endScreen = this.worldToScreen(end.x, end.y);
        
        // Draw line
        this.uiCtx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        this.uiCtx.lineWidth = 1;
        this.uiCtx.setLineDash([10, 10]);
        this.uiCtx.beginPath();
        this.uiCtx.moveTo(startScreen.x, startScreen.y);
        this.uiCtx.lineTo(endScreen.x, endScreen.y);
        this.uiCtx.stroke();
        this.uiCtx.setLineDash([]);
        
        // Draw arrowhead at end
        const dx = endScreen.x - startScreen.x;
        const dy = endScreen.y - startScreen.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len > 0) {
          const arrowSize = 10;
          const angle = Math.atan2(dy, dx);
          
          this.uiCtx.fillStyle = 'rgba(255, 255, 255, 0.7)';
          this.uiCtx.beginPath();
          this.uiCtx.moveTo(endScreen.x, endScreen.y);
          this.uiCtx.lineTo(
            endScreen.x - arrowSize * Math.cos(angle - Math.PI / 6),
            endScreen.y - arrowSize * Math.sin(angle - Math.PI / 6)
          );
          this.uiCtx.lineTo(
            endScreen.x - arrowSize * Math.cos(angle + Math.PI / 6),
            endScreen.y - arrowSize * Math.sin(angle + Math.PI / 6)
          );
          this.uiCtx.closePath();
          this.uiCtx.fill();
        }
      }
    }
  }
  
  /**
   * Draw trajectories from physics simulation
   * More accurate than ray-cast prediction, especially for extreme angles
   * @param shotPaths - Physics simulation results with trajectory paths
   * @param cueBallPos - Current cue ball position (unused but kept for API consistency)
   * @param debugMode - If true, show all object ball paths with colored styling; if false, only show first contact with white/black glow
   */
  drawPhysicsTrajectoryLines(shotPaths: ShotPreviewPaths, cueBallPos: { x: number; y: number }, debugMode: boolean = false) {
    // Clear old 3D trajectory lines
    this.trajectoryLines.forEach(line => this.scene.remove(line));
    this.trajectoryLines = [];
    
    if (!shotPaths.firstContact || shotPaths.cuePath.length < 2) return;
    
    const firstContactBallId = shotPaths.firstContact?.hitBall?.id;
    
    // Draw cue ball path up to first contact
    if (debugMode) {
      // Debug mode: cyan dashed line
      this.uiCtx.strokeStyle = 'rgba(0, 255, 255, 0.4)';
      this.uiCtx.lineWidth = 1;
      this.uiCtx.setLineDash([5, 5]);
    } else {
      // Normal mode: don't draw cue path before contact
      // (the aim line already shows this)
    }
    
    if (debugMode) {
      this.uiCtx.beginPath();
      
      for (let i = 0; i < shotPaths.cuePath.length; i++) {
        const point = shotPaths.cuePath[i];
        const screen = this.worldToScreen(point.x, point.y);
        
        if (i === 0) {
          this.uiCtx.moveTo(screen.x, screen.y);
        } else {
          this.uiCtx.lineTo(screen.x, screen.y);
        }
        
        // Stop at first contact
        if (shotPaths.firstContact && i > 0) {
          const prevPoint = shotPaths.cuePath[i - 1];
          const contactDist = Math.hypot(
            shotPaths.firstContact.contactPoint.x - prevPoint.x,
            shotPaths.firstContact.contactPoint.y - prevPoint.y
          );
          const segmentDist = Math.hypot(point.x - prevPoint.x, point.y - prevPoint.y);
          
          if (contactDist <= segmentDist) {
            break;
          }
        }
      }
      
      this.uiCtx.stroke();
      this.uiCtx.setLineDash([]);
    }
    
    // Helper functions for solid white + black glow styling
    const drawPathWithGlow = (path: Vec2[], glowColor: string, lineColor: string, lineWidth: number) => {
      if (path.length < 2) return;
      
      // Draw black glow (outer)
      this.uiCtx.strokeStyle = glowColor;
      this.uiCtx.lineWidth = lineWidth + 4;
      this.uiCtx.lineCap = 'round';
      this.uiCtx.lineJoin = 'round';
      this.uiCtx.beginPath();
      
      for (let i = 0; i < path.length; i++) {
        const point = path[i];
        const screen = this.worldToScreen(point.x, point.y);
        
        if (i === 0) {
          this.uiCtx.moveTo(screen.x, screen.y);
        } else {
          this.uiCtx.lineTo(screen.x, screen.y);
        }
      }
      
      this.uiCtx.stroke();
      
      // Draw solid line (inner)
      this.uiCtx.strokeStyle = lineColor;
      this.uiCtx.lineWidth = lineWidth;
      this.uiCtx.lineCap = 'round';
      this.uiCtx.lineJoin = 'round';
      this.uiCtx.beginPath();
      
      for (let i = 0; i < path.length; i++) {
        const point = path[i];
        const screen = this.worldToScreen(point.x, point.y);
        
        if (i === 0) {
          this.uiCtx.moveTo(screen.x, screen.y);
        } else {
          this.uiCtx.lineTo(screen.x, screen.y);
        }
      }
      
      this.uiCtx.stroke();
      
      return path;
    };
    
    const drawArrowWithGlow = (endPoint: Vec2, prevPoint: Vec2, glowColor: string, fillColor: string, arrowSize: number) => {
      const endScreen = this.worldToScreen(endPoint.x, endPoint.y);
      const dx = endPoint.x - prevPoint.x;
      const dy = endPoint.y - prevPoint.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      
      if (len > 0) {
        const angle = Math.atan2(dy, dx);
        
        // Draw black glow for arrow
        this.uiCtx.fillStyle = glowColor;
        this.uiCtx.beginPath();
        this.uiCtx.moveTo(endScreen.x, endScreen.y);
        this.uiCtx.lineTo(
          endScreen.x - (arrowSize + 2) * Math.cos(angle - Math.PI / 6),
          endScreen.y - (arrowSize + 2) * Math.sin(angle - Math.PI / 6)
        );
        this.uiCtx.lineTo(
          endScreen.x - (arrowSize + 2) * Math.cos(angle + Math.PI / 6),
          endScreen.y - (arrowSize + 2) * Math.sin(angle + Math.PI / 6)
        );
        this.uiCtx.closePath();
        this.uiCtx.fill();
        
        // Draw white arrow fill
        this.uiCtx.fillStyle = fillColor;
        this.uiCtx.beginPath();
        this.uiCtx.moveTo(endScreen.x, endScreen.y);
        this.uiCtx.lineTo(
          endScreen.x - arrowSize * Math.cos(angle - Math.PI / 6),
          endScreen.y - arrowSize * Math.sin(angle - Math.PI / 6)
        );
        this.uiCtx.lineTo(
          endScreen.x - arrowSize * Math.cos(angle + Math.PI / 6),
          endScreen.y - arrowSize * Math.sin(angle + Math.PI / 6)
        );
        this.uiCtx.closePath();
        this.uiCtx.fill();
      }
    };
    
    // Calculate shot complexity for adaptive path length
    // Complexity is based on cut angle - straighter shots = simpler
    let pathLengthMultiplier = 1.0;
    if (!debugMode && shotPaths.firstContact?.type === 'ball') {
      // Get cue ball direction to contact point
      const contactIdx = shotPaths.cuePath.findIndex((p, i) => {
        if (i === 0) return false;
        const prev = shotPaths.cuePath[i - 1];
        const dist = Math.hypot(
          shotPaths.firstContact!.contactPoint.x - prev.x,
          shotPaths.firstContact!.contactPoint.y - prev.y
        );
        return dist < 0.5;
      });
      
      if (contactIdx > 0) {
        const cueDir = {
          x: shotPaths.cuePath[contactIdx].x - shotPaths.cuePath[0].x,
          y: shotPaths.cuePath[contactIdx].y - shotPaths.cuePath[0].y
        };
        const cueDirLen = Math.hypot(cueDir.x, cueDir.y);
        
        if (cueDirLen > 0.001) {
          cueDir.x /= cueDirLen;
          cueDir.y /= cueDirLen;
          
          // Contact normal (direction object ball will travel)
          const normal = shotPaths.firstContact.contactNormal;
          
          // Dot product gives cosine of angle between them
          const dot = cueDir.x * normal.x + cueDir.y * normal.y;
          const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
          
          // Angle ranges from 0 (straight on) to PI/2 (extreme cut)
          // Map to multiplier: 0° = 1.0, 45° = 0.5, 90° = 0.2
          const normalizedAngle = angle / (Math.PI / 2);
          pathLengthMultiplier = 1.0 - (normalizedAngle * 0.8);
        }
      }
    }
    
    // Draw object ball trajectories
    shotPaths.objectPaths.forEach((path, ballId) => {
      if (path.length < 2) return;
      
      // Filter: only show first contact ball unless debug mode is on
      if (!debugMode && ballId !== firstContactBallId) return;
      
      // Shorten path based on shot complexity in normal mode
      let displayPath = path;
      if (!debugMode && pathLengthMultiplier < 1.0) {
        const targetLength = Math.floor(path.length * pathLengthMultiplier);
        displayPath = path.slice(0, Math.max(2, targetLength));
      }

      const orientation = this.classifyAxisAlignmentFromPath(displayPath);
      const palette = getAxisPalette(orientation);
      
      if (debugMode) {
        // Debug mode: yellow/orange dashed lines
        this.uiCtx.strokeStyle = palette.debugStroke;
        this.uiCtx.lineWidth = 2;
        this.uiCtx.setLineDash([10, 5]);
        this.uiCtx.beginPath();
        
        for (let i = 0; i < displayPath.length; i++) {
          const point = displayPath[i];
          const screen = this.worldToScreen(point.x, point.y);
          
          if (i === 0) {
            this.uiCtx.moveTo(screen.x, screen.y);
          } else {
            this.uiCtx.lineTo(screen.x, screen.y);
          }
        }
        
        this.uiCtx.stroke();
        this.uiCtx.setLineDash([]);
        
        // Draw arrowhead at the end
        const lastIdx = displayPath.length - 1;
        const endPoint = displayPath[lastIdx];
        const prevPoint = displayPath[lastIdx - 1];
        const endScreen = this.worldToScreen(endPoint.x, endPoint.y);
        const dx = endPoint.x - prevPoint.x;
        const dy = endPoint.y - prevPoint.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        
        if (len > 0) {
          const arrowSize = 10;
          const angle = Math.atan2(dy, dx);
          
          this.uiCtx.fillStyle = palette.debugFill;
          this.uiCtx.beginPath();
          this.uiCtx.moveTo(endScreen.x, endScreen.y);
          this.uiCtx.lineTo(
            endScreen.x - arrowSize * Math.cos(angle - Math.PI / 6),
            endScreen.y - arrowSize * Math.sin(angle - Math.PI / 6)
          );
          this.uiCtx.lineTo(
            endScreen.x - arrowSize * Math.cos(angle + Math.PI / 6),
            endScreen.y - arrowSize * Math.sin(angle + Math.PI / 6)
          );
          this.uiCtx.closePath();
          this.uiCtx.fill();
        }
      } else {
        // Normal mode: solid white with black glow (no arrows)
        drawPathWithGlow(displayPath, palette.glow, palette.line, 3);
      }
    });
    
    // Draw cue ball rebound path (after contact)
    if (shotPaths.firstContact && shotPaths.cuePath.length > 2) {
      // Find where contact happened in the cue path
      const contactIdx = shotPaths.cuePath.findIndex((p, i) => {
        if (i === 0) return false;
        const prev = shotPaths.cuePath[i - 1];
        const dist = Math.hypot(
          shotPaths.firstContact!.contactPoint.x - prev.x,
          shotPaths.firstContact!.contactPoint.y - prev.y
        );
        return dist < 0.5;
      });
      
      if (contactIdx > 0 && contactIdx < shotPaths.cuePath.length - 1) {
        // Get cue ball path after contact
        let cueBallReboundPath = shotPaths.cuePath.slice(contactIdx);
        
        // Shorten path based on shot complexity in normal mode
        if (!debugMode && pathLengthMultiplier < 1.0) {
          const targetLength = Math.floor(cueBallReboundPath.length * pathLengthMultiplier);
          cueBallReboundPath = cueBallReboundPath.slice(0, Math.max(2, targetLength));
        }
        
        if (cueBallReboundPath.length >= 2) {
          if (debugMode) {
            // Debug mode: cyan dashed line
            this.uiCtx.strokeStyle = 'rgba(0, 255, 255, 0.6)';
            this.uiCtx.lineWidth = 2;
            this.uiCtx.setLineDash([10, 5]);
            this.uiCtx.beginPath();
            
            for (let i = 0; i < cueBallReboundPath.length; i++) {
              const point = cueBallReboundPath[i];
              const screen = this.worldToScreen(point.x, point.y);
              
              if (i === 0) {
                this.uiCtx.moveTo(screen.x, screen.y);
              } else {
                this.uiCtx.lineTo(screen.x, screen.y);
              }
            }
            
            this.uiCtx.stroke();
            this.uiCtx.setLineDash([]);
            
            // Draw arrowhead
            const lastIdx = cueBallReboundPath.length - 1;
            const endPoint = cueBallReboundPath[lastIdx];
            const prevPoint = cueBallReboundPath[lastIdx - 1];
            const endScreen = this.worldToScreen(endPoint.x, endPoint.y);
            const dx = endPoint.x - prevPoint.x;
            const dy = endPoint.y - prevPoint.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            
            if (len > 0) {
              const arrowSize = 10;
              const angle = Math.atan2(dy, dx);
              
              this.uiCtx.fillStyle = 'rgba(0, 255, 255, 0.9)';
              this.uiCtx.beginPath();
              this.uiCtx.moveTo(endScreen.x, endScreen.y);
              this.uiCtx.lineTo(
                endScreen.x - arrowSize * Math.cos(angle - Math.PI / 6),
                endScreen.y - arrowSize * Math.sin(angle - Math.PI / 6)
              );
              this.uiCtx.lineTo(
                endScreen.x - arrowSize * Math.cos(angle + Math.PI / 6),
                endScreen.y - arrowSize * Math.sin(angle + Math.PI / 6)
              );
              this.uiCtx.closePath();
              this.uiCtx.fill();
            }
          } else {
            // Normal mode: solid white with black glow (no arrows)
            drawPathWithGlow(cueBallReboundPath, 'rgba(0, 0, 0, 0.8)', 'rgba(255, 255, 255, 0.95)', 3);
          }
        }
      }
    }
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
    if (prediction.type === 'none') return;
    
    // Calculate shot complexity for adaptive path length
    // Complexity is based on cut angle - straighter shots get longer paths
    let pathLengthMultiplier = 1.0;
    if (prediction.type === 'ball' && prediction.contactNormal) {
      // Dot product between shot direction and contact normal
      const dot = shotDirection.x * prediction.contactNormal.x + shotDirection.y * prediction.contactNormal.y;
      const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
      
      // Angle ranges from 0 (straight on) to PI/2 (extreme cut)
      // Map to multiplier: 0° = 1.0 (full length), 90° = 0.3 (30% length)
      const normalizedAngle = angle / (Math.PI / 2);
      pathLengthMultiplier = 1.0 - (normalizedAngle * 0.7);
    }
    
    // Base line length adjusted by complexity and user percentage setting
    const baseLength = 50;
    const adjustedLength = baseLength * pathLengthMultiplier * CONFIG.OBJECT_PATH_PERCENTAGE;
    
    // Get simple trajectory predictions
    const trajectories = predictor.predictTrajectories(
      prediction,
      cueBallPos,
      shotDirection,
      adjustedLength
    );
    
    const drawLineWithGlow = (
      start: { x: number; y: number },
      end: { x: number; y: number },
      glowColor: string,
      lineColor: string,
      lineWidth: number
    ) => {
      const startScreen = this.worldToScreen(start.x, start.y);
      const endScreen = this.worldToScreen(end.x, end.y);
      
      // Draw black glow (outer)
      this.uiCtx.strokeStyle = glowColor;
      this.uiCtx.lineWidth = lineWidth + 4;
      this.uiCtx.lineCap = 'round';
      this.uiCtx.beginPath();
      this.uiCtx.moveTo(startScreen.x, startScreen.y);
      this.uiCtx.lineTo(endScreen.x, endScreen.y);
      this.uiCtx.stroke();
      
      // Draw solid white line (inner)
      this.uiCtx.strokeStyle = lineColor;
      this.uiCtx.lineWidth = lineWidth;
      this.uiCtx.lineCap = 'round';
      this.uiCtx.beginPath();
      this.uiCtx.moveTo(startScreen.x, startScreen.y);
      this.uiCtx.lineTo(endScreen.x, endScreen.y);
      this.uiCtx.stroke();
      
      return { startScreen, endScreen };
    };
    
    // Draw object ball trajectory (solid white with black glow)
    if (trajectories.objectBallPath) {
      const dirX = trajectories.objectBallPath.end.x - trajectories.objectBallPath.start.x;
      const dirY = trajectories.objectBallPath.end.y - trajectories.objectBallPath.start.y;
      const length = Math.sqrt(dirX * dirX + dirY * dirY);

      if (length > 0.0001) {
        const normX = dirX / length;
        const normY = dirY / length;
        // Start from actual object ball center (not ghost ball contact point)
        const start = { x: prediction.hitBall.x, y: prediction.hitBall.y };
        const endRaw = { x: start.x + normX * adjustedLength, y: start.y + normY * adjustedLength };
        const end = this.clipLineAtRails(start, endRaw);
        
        const orientation = classifyAxisAlignmentFromVector(normX, normY);
        const palette = getAxisPalette(orientation);

        drawLineWithGlow(
          start,
          end,
          palette.glow,
          palette.line,
          3
        );
      }
    }
    
    // Draw cue ball trajectory (solid white with black glow)
    // Cue ball path is much shorter than object ball path
    if (trajectories.cueBallPath) {
      const dirX = trajectories.cueBallPath.end.x - trajectories.cueBallPath.start.x;
      const dirY = trajectories.cueBallPath.end.y - trajectories.cueBallPath.start.y;
      const length = Math.sqrt(dirX * dirX + dirY * dirY);

      if (length > 0.0001) {
        const normX = dirX / length;
        const normY = dirY / length;
        // Start from ghost ball position for ball hits, contact point for rail hits
        let startX, startY;
        if (prediction.type === 'ball') {
          // Ghost ball offset is applied along the direction from cue to contact point
          const offsetDir = Math.atan2(
            prediction.contactPoint.y - cueBallPos.y,
            prediction.contactPoint.x - cueBallPos.x
          );
          startX = prediction.contactPoint.x + Math.cos(offsetDir) * CONFIG.GHOST_BALL_OFFSET;
          startY = prediction.contactPoint.y + Math.sin(offsetDir) * CONFIG.GHOST_BALL_OFFSET;
        } else {
          // Rail hit - no offset, use contact point directly
          startX = prediction.contactPoint.x;
          startY = prediction.contactPoint.y;
        }
        const start = { x: startX, y: startY };
        // Cue ball path is 25% the length of object ball path
        const cueBallLength = adjustedLength * 0.25;
        const endRaw = { x: start.x + normX * cueBallLength, y: start.y + normY * cueBallLength };
        const end = this.clipLineAtRails(start, endRaw);
        
        drawLineWithGlow(
          start,
          end,
          'rgba(0, 0, 0, 0.8)',  // Black glow
          'rgba(255, 255, 255, 0.95)',  // Solid white
          3
        );
      }
    }
  }
  
  getPowerBarBounds() {
    const { width, height } = this.getSidebarSize();
    const rect = this.getSideBarRect('right', width, height);
    return { x: rect.x, y: rect.y, width, height };
  }

  getMicroDialBounds() {
    const { width, height } = this.getSidebarSize();
    const rect = this.getSideBarRect('left', width, height);
    return { x: rect.x, y: rect.y, width, height };
  }

  private getSideBarRect(side: 'left' | 'right', width: number, height: number) {
    const geom = getTableGeometry();
    const frameHalfWidth = geom.frameOutline.outerHalfWidth;
    const frameWorldX = side === 'right' ? frameHalfWidth : -frameHalfWidth;
    const frameScreen = this.worldToScreen(frameWorldX, 0);
    const offsetFromFrame = 20;
    const x = side === 'right' ? frameScreen.x + offsetFromFrame : frameScreen.x - offsetFromFrame - width;
    const bounds = this.getTableFrameScreenBounds();
    let y = bounds.centerY - height / 2;
    const maxY = Math.max(0, this.uiCanvas.height - height);
    y = Math.max(0, Math.min(maxY, y));
    return { x, y, width, height };
  }

  private getSidebarSize() {
    const bounds = this.getTableFrameScreenBounds();
    const height = Math.max(160, bounds.height * 0.75);
    const width = Math.max(36, height * 0.08);
    return { width, height };
  }

  private getTableFrameScreenBounds() {
    const geom = getTableGeometry();
    const halfHeight = geom.frameOutline.outerHalfHeight;
    const topScreen = this.worldToScreen(0, halfHeight).y;
    const bottomScreen = this.worldToScreen(0, -halfHeight).y;
    const top = Math.min(topScreen, bottomScreen);
    const bottom = Math.max(topScreen, bottomScreen);
    const height = Math.abs(bottom - top);
    return { top, bottom, height, centerY: (top + bottom) / 2 };
  }

  queuePocketAnimation(event: PocketAnimationEvent) {
    this.queuedPocketEvents.push(event);
  }

  private processPocketAnimationQueue() {
    if (!this.queuedPocketEvents.length) return;
    const dropDuration = CONFIG.POCKET_ANIMATION_DROP_DURATION_MS ?? 300;
    const rollDuration = CONFIG.POCKET_ANIMATION_ROLL_DURATION_MS ?? 500;
    const duration = dropDuration + rollDuration;
    const now = performance.now();
    while (this.queuedPocketEvents.length) {
      const event = this.queuedPocketEvents.shift()!;
      this.pocketAnimations.push({ event, startTime: now, duration });
    }
  }

  private drawPocketAnimations() {
    if (!this.pocketAnimations.length) return;
    const now = performance.now();
    const ctx = this.uiCtx;
    ctx.save();
    this.pocketAnimations = this.pocketAnimations.filter((anim) => {
      const elapsed = now - anim.startTime;
      const progress = Math.min(1, elapsed / Math.max(anim.duration, 1));
      this.drawPocketAnimationSprite(anim.event, progress, ctx);
      return progress < 1;
    });
    ctx.restore();
  }

  private drawPocketAnimationSprite(event: PocketAnimationEvent, progress: number, ctx: CanvasRenderingContext2D) {
    const startScreen = this.worldToScreen(event.position.x, event.position.y);
    const endScreen = this.worldToScreen(event.pocket.x, event.pocket.y);
    const centerScreen = this.worldToScreen(0, 0);

    const baseRadius = Math.max(3, event.radius * this.scale);
    const shrink = (CONFIG as any).POCKET_ANIMATION_SHRINK_FACTOR ?? 0.2;

    // Get separate durations for drop and roll phases
    const dropDuration = CONFIG.POCKET_ANIMATION_DROP_DURATION_MS ?? 300;
    const rollDuration = CONFIG.POCKET_ANIMATION_ROLL_DURATION_MS ?? 500;
    const totalDuration = dropDuration + rollDuration;
    const dropPhaseEnd = dropDuration / totalDuration;

    const dropDepth = (CONFIG.POCKET_ANIMATION_DROP_DEPTH ?? 0.35) * this.scale;
    const rollDistance = (CONFIG.POCKET_ANIMATION_UNDERFELT_PX ?? 10) * this.scale;

    // Pocket opening radius for clipping
    const pocketOpeningRadius = (CONFIG.POCKET_VISUAL_RADIUS_SIDE ?? 2.5) * this.scale;

    let x: number, y: number, radius: number;

    // Ball stays full size always - no shrinking
    radius = baseRadius;

    if (progress < dropPhaseEnd) {
      // Phase 1: Ball drops into pocket (visible while dropping)
      const dropT = progress / dropPhaseEnd;
      const eased = dropT * dropT * (3 - 2 * dropT);

      x = startScreen.x + (endScreen.x - startScreen.x) * eased;
      y = startScreen.y + (endScreen.y - startScreen.y) * eased;
    } else {
      // Phase 2: Ball rolls underneath felt from pocket center inward toward table center
      const rollT = (progress - dropPhaseEnd) / (1 - dropPhaseEnd);
      const eased = rollT * rollT * (3 - 2 * rollT);

      // Direction from pocket toward table center (inward)
      const dirX = centerScreen.x - endScreen.x;
      const dirY = centerScreen.y - endScreen.y;
      const len = Math.hypot(dirX, dirY) || 1;

      // Start at pocket center, roll inward toward table center
      x = endScreen.x + (dirX / len) * rollDistance * eased;
      y = endScreen.y + (dirY / len) * rollDistance * eased;
    }

    // Clip to circular pocket opening - ball only visible through the "hole"
    ctx.save();
    ctx.beginPath();
    ctx.arc(endScreen.x, endScreen.y, pocketOpeningRadius, 0, Math.PI * 2);
    ctx.clip();

    const colors = this.getBallColor(event.ballId);
    const gradient = ctx.createRadialGradient(x - radius * 0.3, y - radius * 0.3, radius * 0.15, x, y, radius);
    gradient.addColorStop(0, colors.light);
    gradient.addColorStop(1, colors.dark);

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    const iconImage = this.getPocketIconImage(event.icon);
    if (iconImage) {
      const size = radius * 2;
      ctx.drawImage(iconImage, x - radius, y - radius, size, size);
    }

    ctx.lineWidth = 1.2;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.stroke();

    ctx.restore();
  }

  private getBallColor(ballId: number) {
    const hex = CONFIG.BALL_COLORS[ballId - 1] || '#ffffff';
    const base = hex.startsWith('#') ? hex : `#${hex}`;
    const light = lightenHexColor(base, 0.2);
    const dark = darkenHexColor(base, 0.35);
    return { light, dark };
  }

  private getPocketIconImage(iconSrc?: string) {
    if (!iconSrc) return null;
    let entry = this.pocketIconCache.get(iconSrc);
    if (!entry) {
      const img = new Image();
      entry = { img, ready: img.complete, failed: false };
      img.onload = () => {
        entry!.ready = true;
      };
      img.onerror = () => {
        entry!.failed = true;
      };
      img.src = iconSrc;
      this.pocketIconCache.set(iconSrc, entry);
    }
    if (entry.failed || !entry.ready) return null;
    return entry.img;
  }

  override triggerShotShake(intensity: number) {
    const clamped = Math.max(0, Math.min(1, intensity));
    if (clamped <= 0) return;
    const duration = CONFIG.HEAVY_SHOT_SHAKE_DURATION_MS ?? 240;
    const strength = (CONFIG.HEAVY_SHOT_SHAKE_MAX_OFFSET_PX ?? 5) * clamped;
    this.shakeState = {
      start: performance.now(),
      duration,
      strength,
      seed: Math.random() * Math.PI * 2,
    };
  }

  private computeShakeOffset() {
    if (!this.shakeState) return { x: 0, y: 0 };
    const now = performance.now();
    const elapsed = now - this.shakeState.start;
    if (elapsed >= this.shakeState.duration) {
      this.shakeState = null;
      return { x: 0, y: 0 };
    }
    const progress = elapsed / Math.max(1, this.shakeState.duration);
    const decay = 1 - progress;
    const angle = now * 0.04 + this.shakeState.seed;
    const x = Math.cos(angle * 50) * this.shakeState.strength * decay;
    const y = Math.sin(angle * 60) * this.shakeState.strength * decay;
    return { x, y };
  }

  private applyShakeTransform(x: number, y: number) {
    const transform = Math.abs(x) < 0.01 && Math.abs(y) < 0.01
      ? ''
      : `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px)`;
    this.canvas.style.transform = transform;
    if (this.uiCanvas) {
      this.uiCanvas.style.transform = transform;
    }
    if (this.referenceOverlay) {
      this.referenceOverlay.style.transform = transform;
    }
  }

  /**
   * Highlight pockets for selection (called-shot mode)
   */
  highlightPocketsForSelection(pockets: Array<{ id: string; label: string; center: { x: number; y: number } }>) {
    const ctx = this.uiCtx;
    if (!ctx) return;

    // Time-based pulsing effect
    const time = Date.now() / 1000;
    const pulseScale = 0.85 + Math.sin(time * 3) * 0.15;

    pockets.forEach(pocket => {
      // Convert world coordinates to screen coordinates
      const screenPos = this.worldToScreen(pocket.center.x, pocket.center.y);
      if (!screenPos) return;

      // Draw outer glow
      const glowRadius = 40 * pulseScale;
      const gradient = ctx.createRadialGradient(
        screenPos.x, screenPos.y, 0,
        screenPos.x, screenPos.y, glowRadius
      );
      gradient.addColorStop(0, 'rgba(255, 215, 0, 0.6)');
      gradient.addColorStop(0.5, 'rgba(255, 215, 0, 0.3)');
      gradient.addColorStop(1, 'rgba(255, 215, 0, 0)');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(screenPos.x, screenPos.y, glowRadius, 0, Math.PI * 2);
      ctx.fill();

      // Draw inner circle
      ctx.strokeStyle = 'rgba(255, 215, 0, 0.9)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(screenPos.x, screenPos.y, 25 * pulseScale, 0, Math.PI * 2);
      ctx.stroke();
    });
  }

  /**
   * Highlight the called pocket (after it's been selected)
   */
  highlightCalledPocket(pocket: { id: string; label: string; center: { x: number; y: number } }) {
    const ctx = this.uiCtx;
    if (!ctx) return;

    // Convert world coordinates to screen coordinates
    const screenPos = this.worldToScreen(pocket.center.x, pocket.center.y);
    if (!screenPos) return;

    // Time-based gentle pulsing
    const time = Date.now() / 1000;
    const pulseScale = 0.9 + Math.sin(time * 2) * 0.1;

    // Draw outer glow (green to indicate called/locked pocket)
    const glowRadius = 35 * pulseScale;
    const gradient = ctx.createRadialGradient(
      screenPos.x, screenPos.y, 0,
      screenPos.x, screenPos.y, glowRadius
    );
    gradient.addColorStop(0, 'rgba(0, 255, 100, 0.5)');
    gradient.addColorStop(0.5, 'rgba(0, 255, 100, 0.25)');
    gradient.addColorStop(1, 'rgba(0, 255, 100, 0)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(screenPos.x, screenPos.y, glowRadius, 0, Math.PI * 2);
    ctx.fill();

    // Draw inner circle
    ctx.strokeStyle = 'rgba(0, 255, 100, 0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(screenPos.x, screenPos.y, 20 * pulseScale, 0, Math.PI * 2);
    ctx.stroke();

    // Draw checkmark icon
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 3;
    ctx.beginPath();
    ctx.moveTo(screenPos.x - 8, screenPos.y);
    ctx.lineTo(screenPos.x - 3, screenPos.y + 5);
    ctx.lineTo(screenPos.x + 8, screenPos.y - 6);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  /**
   * Adjust color brightness for shading effects
   * @param color Hex color string (e.g., '#8B4513')
   * @param amount Amount to lighten (positive) or darken (negative), range -1 to 1
   * @returns Adjusted hex color string
   */
  private shadeColor(color: string, amount: number): string {
    // Parse hex color to RGB
    let r = parseInt(color.slice(1, 3), 16);
    let g = parseInt(color.slice(3, 5), 16);
    let b = parseInt(color.slice(5, 7), 16);

    // Apply shading (amount: -1 = black, 0 = no change, 1 = white)
    if (amount > 0) {
      // Lighten: blend towards white
      r = Math.round(r + (255 - r) * amount);
      g = Math.round(g + (255 - g) * amount);
      b = Math.round(b + (255 - b) * amount);
    } else {
      // Darken: blend towards black
      r = Math.round(r * (1 + amount));
      g = Math.round(g * (1 + amount));
      b = Math.round(b * (1 + amount));
    }

    // Clamp values to 0-255
    r = Math.max(0, Math.min(255, r));
    g = Math.max(0, Math.min(255, g));
    b = Math.max(0, Math.min(255, b));

    // Convert back to hex
    const toHex = (n: number) => n.toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }
}

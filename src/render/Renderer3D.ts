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

type AxisAlignment = 'horizontal' | 'vertical' | null;

interface AxisColorPalette {
  line: string;
  glow: string;
  debugStroke: string;
  debugFill: string;
}

type RGBColor = { r: number; g: number; b: number };

function clampChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function parseHexColor(hex: string): RGBColor {
  const normalized = hex.replace('#', '').trim();
  const expanded =
    normalized.length === 3
      ? normalized
          .split('')
          .map((ch) => ch + ch)
          .join('')
      : normalized.padEnd(6, '0');
  const value = parseInt(expanded.slice(0, 6), 16);
  return {
    r: (value >> 16) & 0xff,
    g: (value >> 8) & 0xff,
    b: value & 0xff,
  };
}

function lightenColor(color: RGBColor, amount: number): RGBColor {
  return {
    r: clampChannel(color.r + (255 - color.r) * amount),
    g: clampChannel(color.g + (255 - color.g) * amount),
    b: clampChannel(color.b + (255 - color.b) * amount),
  };
}

function darkenColor(color: RGBColor, amount: number): RGBColor {
  return {
    r: clampChannel(color.r * (1 - amount)),
    g: clampChannel(color.g * (1 - amount)),
    b: clampChannel(color.b * (1 - amount)),
  };
}

function mixColors(colorA: RGBColor, colorB: RGBColor, factor: number): RGBColor {
  const clamped = Math.max(0, Math.min(1, factor));
  return {
    r: clampChannel(colorA.r + (colorB.r - colorA.r) * clamped),
    g: clampChannel(colorA.g + (colorB.g - colorA.g) * clamped),
    b: clampChannel(colorA.b + (colorB.b - colorA.b) * clamped),
  };
}

function toRgba(color: RGBColor, alpha: number): string {
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
}

export class Renderer3D {
  canvas: HTMLCanvasElement;
  uiCanvas: HTMLCanvasElement;
  uiCtx: CanvasRenderingContext2D;
  referenceOverlay: HTMLImageElement | null;
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  renderer: THREE.WebGLRenderer;
  scale: number;
  canvasOffsetX: number = 0;
  canvasOffsetY: number = 0;
  private resizeObserver: ResizeObserver | null = null;
  private playBoundaryPoints: Vec2[] = [];
  private playBounds: BoundaryBounds = { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  
  // 3D objects
  ballMeshes: Map<number, THREE.Object3D> = new Map();
  ballModels: Map<number, { geometry: THREE.BufferGeometry; material: THREE.MeshStandardMaterial }> = new Map();
  ballModelsLoaded: boolean = false;
  ballScale = 1.0;
  private fbxBlobUrl: string | null = null;
  tableMesh: THREE.Mesh | null = null;
  frameMesh: THREE.Group | null = null;
  railMeshes: THREE.Mesh[] = [];
  pocketMeshes: THREE.Mesh[] = [];
  pocketCapMeshes: THREE.Mesh[] = [];
  railFillMesh: THREE.Mesh | null = null;
  private tableHighlightMesh: THREE.Mesh | null = null;
  private tableShadowMesh: THREE.Mesh | null = null;
  private railHighlightMeshes: THREE.Mesh[] = [];
  private pocketHighlightMeshes: THREE.Mesh[] = [];
  private pocketShadowMeshes: THREE.Mesh[] = [];
  private railHighlightMaterial: THREE.MeshBasicMaterial | null = null;
  private pocketHighlightMaterial: THREE.MeshBasicMaterial | null = null;
  private pocketShadowMaterial: THREE.MeshBasicMaterial | null = null;
  private railHighlightTexture: THREE.CanvasTexture | null = null;
  private pocketHighlightTexture: THREE.CanvasTexture | null = null;
  private pocketShadowTexture: THREE.CanvasTexture | null = null;
  private accentLight: THREE.SpotLight | null = null;
  showMeasurementOverlay = false;
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
    this.canvas = canvas;
    this.scale = CONFIG.CANVAS_SCALE;
    
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
    this.refreshDerivedGeometry();
    
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
      const detail = (event as CustomEvent<{ settings?: { ballScale?: number; ambientIntensity?: number; directionalIntensity?: number; accentIntensity?: number; railHighlightIntensity?: number; pocketShadowIntensity?: number } }>).detail;
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
        pocket: settings?.pocketShadowIntensity ?? CONFIG.POCKET_SHADOW_INTENSITY,
      });
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
    // Dispose shared rail highlight materials once
    if (this.railHighlightTexture) {
      this.railHighlightTexture.dispose();
      this.railHighlightTexture = null;
    }
    if (this.railHighlightMaterial) {
      this.railHighlightMaterial.dispose();
      this.railHighlightMaterial = null;
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
      4: '/textures/poolballTx5.jpg',
      5: '/textures/poolballTx7.jpg',
      6: '/textures/poolballTx6.jpg',
      7: '/textures/poolballTx04.jpg',
      8: '/textures/poolballTx9.jpg',
      9: '/textures/poolballTx11.jpg',
      10: '/textures/poolballTx10.jpg',
      11: '/textures/poolballTx8.jpg',
      12: '/textures/poolballTx13.jpg',
      13: '/textures/poolballTx15.jpg',
      14: '/textures/poolballTx14.jpg',
      15: '/textures/poolballTx12.jpg'
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
    
    // Internal padding within canvas (around table)
    const internalPadding = 40;
    
    // Calculate available space for canvas after external margins
    const availableWidth = Math.max(1, horizontalSpace - externalMargin * 2);
    const availableHeight = Math.max(1, verticalSpace - externalMargin * 2);
    
    const scaleMultiplier = CONFIG.CANVAS_SCALE_MULTIPLIER ?? 1;
    const adjustedWidth = availableWidth / Math.max(0.01, scaleMultiplier);
    const adjustedHeight = availableHeight / Math.max(0.01, scaleMultiplier);

    // Calculate scale to fit table with internal padding, then apply multiplier
    const scaleX = (adjustedWidth - internalPadding * 2) / CONFIG.TABLE_WIDTH;
    const scaleY = (adjustedHeight - internalPadding * 2) / CONFIG.TABLE_HEIGHT;
    const baseScale = Math.max(0.01, Math.min(scaleX, scaleY));
    this.scale = Math.max(0.01, baseScale * scaleMultiplier);
    
    // Set canvas size
    const width = Math.max(1, CONFIG.TABLE_WIDTH * this.scale + internalPadding * 2);
    const height = Math.max(1, CONFIG.TABLE_HEIGHT * this.scale + internalPadding * 2);
    
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
    this.updateCanvasZIndex();
    
    // Update camera aspect ratio
    const aspect = width / height;
    const frustumSize = CONFIG.TABLE_HEIGHT * 1.2;
    this.camera.left = -frustumSize * aspect / 2;
    this.camera.right = frustumSize * aspect / 2;
    this.camera.top = frustumSize / 2;
    this.camera.bottom = -frustumSize / 2;
    this.camera.updateProjectionMatrix();
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

  getHighlightIntensities(): {
    railHighlightIntensity: number;
    pocketHighlightIntensity: number;
    pocketShadowIntensity: number;
  } {
    return {
      railHighlightIntensity: this.railHighlightMaterial?.opacity ?? CONFIG.RAIL_HIGHLIGHT_INTENSITY ?? 0,
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
    const frameWidth = Math.max(0.1, CONFIG.FRAME_OFFSET_IN);
    this.initializeFrame(frameWidth);
  }

  private refreshDerivedGeometry() {
    this.playBoundaryPoints = computePlayBoundaryPoints(getTableGeometry().rails);
    this.playBounds = computeBoundaryBounds(this.playBoundaryPoints);
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

  private initializeFrame(frameWidth: number) {
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
    const playHalfW = geom.playWidthIn / 2;
    const playHalfH = geom.playHeightIn / 2;
    const innerX = playHalfW + CONFIG.RAIL_THICKNESS_OUTER;
    const innerY = playHalfH + CONFIG.RAIL_THICKNESS_OUTER;
    const outerX = innerX + frameWidth;
    const outerY = innerY + frameWidth;
    const depth = 0.75;

    const horizontalWidth = outerX * 2;
    const horizontalHeight = frameWidth;
    const verticalWidth = frameWidth;
    const verticalHeight = outerY * 2;

    const topGeom = new THREE.BoxGeometry(horizontalWidth, horizontalHeight, depth);
    const topMesh = new THREE.Mesh(topGeom, material.clone());
    topMesh.position.set(0, innerY + horizontalHeight / 2, 0);
    group.add(topMesh);

    const bottomMesh = new THREE.Mesh(topGeom.clone(), material.clone());
    bottomMesh.position.set(0, -(innerY + horizontalHeight / 2), 0);
    group.add(bottomMesh);

    const verticalGeom = new THREE.BoxGeometry(verticalWidth, verticalHeight, depth);

    const leftMesh = new THREE.Mesh(verticalGeom.clone(), material.clone());
    leftMesh.position.set(-(innerX + verticalWidth / 2), 0, 0);
    group.add(leftMesh);

    const rightMesh = new THREE.Mesh(verticalGeom.clone(), material.clone());
    rightMesh.position.set(innerX + verticalWidth / 2, 0, 0);
    group.add(rightMesh);

    // Add depth effects to frame planks
    this.addFrameDepthEffects(group, innerX, innerY, outerX, outerY, frameWidth);

    group.position.z = 0;
    group.visible = this.layerVisibility.showFrame;
    this.frameMesh = group;
    this.scene.add(group);
    this.applyFrameRenderOrder();
    group.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh && (mesh as any).isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
  }

  private addFrameDepthEffects(
    group: THREE.Group,
    innerX: number,
    innerY: number,
    outerX: number,
    outerY: number,
    frameWidth: number
  ) {
    const bevelWidth = Math.min(frameWidth * 0.35, 1.0); // Width of bevel effect
    const zOffset = 0.38; // Just above frame surface (frame depth/2 = 0.75/2 = 0.375)

    // Calculate dimensions for each plank (excluding corners to avoid overlap)
    const horizontalPlankWidth = (innerX * 2); // Width of just the horizontal section (between vertical planks)
    const verticalPlankHeight = (innerY * 2); // Height of just the vertical section (between horizontal planks)

    // Inner shadow (dark edge along inner perimeter - creates recessed look)
    // Gradient goes from dark (at inner edge) to transparent (outward)
    
    // Top plank: inner shadow on bottom edge (facing play area) - only horizontal section
    const topInnerShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(horizontalPlankWidth, bevelWidth),
      this.getFrameInnerShadowMaterial()
    );
    topInnerShadow.position.set(0, innerY + bevelWidth / 2, zOffset);
    group.add(topInnerShadow);

    // Bottom plank: inner shadow on top edge (facing play area) - only horizontal section
    const bottomInnerShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(horizontalPlankWidth, bevelWidth),
      this.getFrameInnerShadowMaterial()
    );
    bottomInnerShadow.position.set(0, -(innerY + bevelWidth / 2), zOffset);
    bottomInnerShadow.rotation.z = Math.PI; // Flip to point inward
    group.add(bottomInnerShadow);

    // Left plank: inner shadow on right edge (facing play area) - only vertical section
    const leftInnerShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(verticalPlankHeight, bevelWidth),
      this.getFrameInnerShadowMaterial()
    );
    leftInnerShadow.position.set(-(innerX + bevelWidth / 2), 0, zOffset);
    leftInnerShadow.rotation.z = Math.PI / 2; // Rotate to vertical, gradient points right
    group.add(leftInnerShadow);

    // Right plank: inner shadow on left edge (facing play area) - only vertical section
    const rightInnerShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(verticalPlankHeight, bevelWidth),
      this.getFrameInnerShadowMaterial()
    );
    rightInnerShadow.position.set(innerX + bevelWidth / 2, 0, zOffset);
    rightInnerShadow.rotation.z = -Math.PI / 2; // Rotate to vertical, gradient points left
    group.add(rightInnerShadow);

    // Outer highlight (bright edge along outer perimeter - creates raised/beveled look)
    // Gradient goes from transparent (inside) to bright (at outer edge)
    
    // Top plank: outer highlight on top edge (away from play area) - full width
    const topOuterHighlight = new THREE.Mesh(
      new THREE.PlaneGeometry(outerX * 2, bevelWidth),
      this.getFrameOuterHighlightMaterial()
    );
    topOuterHighlight.position.set(0, outerY - bevelWidth / 2, zOffset);
    topOuterHighlight.rotation.z = Math.PI; // Flip so gradient points outward
    group.add(topOuterHighlight);

    // Bottom plank: outer highlight on bottom edge (away from play area) - full width
    const bottomOuterHighlight = new THREE.Mesh(
      new THREE.PlaneGeometry(outerX * 2, bevelWidth),
      this.getFrameOuterHighlightMaterial()
    );
    bottomOuterHighlight.position.set(0, -(outerY - bevelWidth / 2), zOffset);
    // No rotation needed - gradient already points down
    group.add(bottomOuterHighlight);

    // Left plank: outer highlight on left edge (away from play area) - only vertical section
    const leftOuterHighlight = new THREE.Mesh(
      new THREE.PlaneGeometry(verticalPlankHeight + (frameWidth * 2), bevelWidth),
      this.getFrameOuterHighlightMaterial()
    );
    leftOuterHighlight.position.set(-(outerX - bevelWidth / 2), 0, zOffset);
    leftOuterHighlight.rotation.z = -Math.PI / 2; // Rotate to vertical, gradient points left (outward)
    group.add(leftOuterHighlight);

    // Right plank: outer highlight on right edge (away from play area) - only vertical section
    const rightOuterHighlight = new THREE.Mesh(
      new THREE.PlaneGeometry(verticalPlankHeight + (frameWidth * 2), bevelWidth),
      this.getFrameOuterHighlightMaterial()
    );
    rightOuterHighlight.position.set(outerX - bevelWidth / 2, 0, zOffset);
    rightOuterHighlight.rotation.z = Math.PI / 2; // Rotate to vertical, gradient points right (outward)
    group.add(rightOuterHighlight);
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
    });
  }

  private getFrameOuterHighlightMaterial(): THREE.MeshBasicMaterial {
    // Create gradient texture for outer highlight (bright at one edge, fades inward)
    // Make it vertical so gradient goes across the height of the plane
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0)'); // Transparent at bottom (inner side)
    gradient.addColorStop(0.5, 'rgba(200, 180, 150, 0.15)'); // Subtle warm highlight
    gradient.addColorStop(1, 'rgba(255, 235, 200, 0.3)'); // Brighter at top (outer edge)
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    
    return new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: true,
      depthWrite: false,
      opacity: 0.5,
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
    const sizeX = 64;
    const sizeY = 256;
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
    this.railHighlightTexture = texture;

    this.railHighlightMaterial = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: true, // Re-enabled to respect depth ordering
      depthWrite: false,
      opacity: CONFIG.RAIL_HIGHLIGHT_INTENSITY ?? 0.9,
      side: THREE.DoubleSide,
    });
    return this.railHighlightMaterial;
  }

  private addPocketHighlight(pocket: PocketDef, visualRadius: number, angleRad: number) {
    const highlightMaterial = this.getPocketHighlightMaterial();

    // Align the arc with the felt lip so the highlight tracks the table edge
    const towardCenter = new THREE.Vector2(-pocket.center.x, -pocket.center.y);
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
    highlightMesh.position.set(pocket.center.x, pocket.center.y, 0.2);
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
    const railMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(CONFIG.RAIL_COLOR),
      roughness: 0.5,
      metalness: 0.3,
    });

    const inner = CONFIG.RAIL_THICKNESS_INNER;
    const outer = CONFIG.RAIL_THICKNESS_OUTER;
    const totalWidth = inner + outer;
    const centerShift = (outer - inner) / 2;

    rails.forEach((rail) => {
      const dx = rail.x2 - rail.x1;
      const dy = rail.y2 - rail.y1;
      const length = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);

      let nx = rail.nx;
      let ny = rail.ny;
      const midX = (rail.x1 + rail.x2) / 2;
      const midY = (rail.y1 + rail.y2) / 2;
      const toCenterX = -midX;
      const toCenterY = -midY;
      const dot = nx * toCenterX + ny * toCenterY;
      if (dot < 0) {
        nx = -nx;
        ny = -ny;
      }

      const railGeometry = new THREE.BoxGeometry(length, totalWidth, 0.5);

      const railMesh = new THREE.Mesh(railGeometry, railMaterial.clone());
      railMesh.position.set(midX - nx * centerShift, midY - ny * centerShift, -0.25);
      railMesh.rotation.z = angle;
      railMesh.castShadow = true;
      railMesh.receiveShadow = true;
      railMesh.visible = this.layerVisibility.showRails;
      railMesh.renderOrder = this.layerOrder.orderRails;
      this.enforceRenderOrderControl(railMesh);

      this.scene.add(railMesh);
      this.railMeshes.push(railMesh);

      // Highlight on top surface of rail
      const highlightMaterial = this.getRailHighlightMaterial(); // Share material (don't clone) so slider can control all
      const highlightWidth = Math.max(0.3, totalWidth * 0.55); // Wider highlight (was 0.35)
      const highlightGeometry = new THREE.PlaneGeometry(length, highlightWidth);
      const highlightMesh = new THREE.Mesh(highlightGeometry, highlightMaterial);
      // Rails are at Z=-0.25 with height 0.5, so top is at 0. Place highlight just above at 0.01
      highlightMesh.position.set(railMesh.position.x, railMesh.position.y, 0.01);
      highlightMesh.rotation.z = angle;
      highlightMesh.visible = this.layerVisibility.showRails;
      highlightMesh.renderOrder = this.layerOrder.orderRails + 0.5; // Higher render order
      this.scene.add(highlightMesh);
      this.railHighlightMeshes.push(highlightMesh);

      // Add subtle shadow along inner edge for depth
      const shadowWidth = totalWidth * 0.25;
      const shadowGeometry = new THREE.PlaneGeometry(length, shadowWidth);
      const shadowMaterial = new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.15,
        blending: THREE.MultiplyBlending,
        depthTest: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const shadowMesh = new THREE.Mesh(shadowGeometry, shadowMaterial);
      // Position shadow on inner edge (toward felt) for depth
      const shadowOffset = (totalWidth * 0.3) * (nx * -1); // Toward felt side
      const shadowOffsetY = (totalWidth * 0.3) * (ny * -1);
      shadowMesh.position.set(
        railMesh.position.x + shadowOffset,
        railMesh.position.y + shadowOffsetY,
        railMesh.position.z + 0.15
      );
      shadowMesh.rotation.z = angle;
      shadowMesh.visible = this.layerVisibility.showRails;
      shadowMesh.renderOrder = this.layerOrder.orderRails + 0.05;
      this.scene.add(shadowMesh);
      this.railHighlightMeshes.push(shadowMesh);
    });
  }
  
  initializePockets(pockets: PocketDef[]) {
    const sideMaterial = this.getPocketSideMaterial();

    pockets.forEach((pocket) => {
      const visualRadius = pocket.visualRadius ?? pocket.radius;
      const wallTaperRadius = visualRadius * 0.75; // Increased taper for more depth (was 0.85)
      const shelfDepth = Math.max(0.1, pocket.shelfDepth ?? CONFIG.POCKET_SHELF_DEPTH_IN) * 1.5; // 50% deeper
      const angleRad = THREE.MathUtils.degToRad(pocket.cutAngleDeg ?? 0);
      const pocketGeometry = new THREE.CylinderGeometry(
        visualRadius,
        wallTaperRadius,
        shelfDepth,
        48,
        1,
        true
      );
      const pocketMesh = new THREE.Mesh(pocketGeometry, sideMaterial.clone());
      pocketMesh.position.set(pocket.center.x, pocket.center.y, 0);
      pocketMesh.rotation.x = Math.PI / 2;
      pocketMesh.rotation.z = angleRad;
      pocketMesh.renderOrder = this.layerOrder.orderPockets;
      pocketMesh.visible = this.layerVisibility.showPockets;
      this.enforceRenderOrderControl(pocketMesh);
      this.scene.add(pocketMesh);
      this.pocketMeshes.push(pocketMesh);

      // Solid black bottom fill for the pocket hole using ShapeGeometry
      const circleShape = new THREE.Shape();
      const radius = visualRadius * 0.98;
      circleShape.absarc(0, 0, radius, 0, Math.PI * 2, false);
      const bottomGeometry = new THREE.ShapeGeometry(circleShape);
      
      const bottomMaterial = new THREE.MeshBasicMaterial({
        color: 0x000000,
        side: THREE.DoubleSide,
        depthTest: false,
        depthWrite: false,
      });
      const bottomMesh = new THREE.Mesh(bottomGeometry, bottomMaterial);
      bottomMesh.position.set(pocket.center.x, pocket.center.y, 0.05); // Lower for more depth (was 0.15)
      bottomMesh.rotation.z = angleRad;
      bottomMesh.renderOrder = this.layerOrder.orderTable + 5;
      bottomMesh.visible = this.layerVisibility.showPockets;
      this.scene.add(bottomMesh);
      this.pocketMeshes.push(bottomMesh);

      // Gradient overlay using ShapeGeometry with proper UV mapping
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
      const gradientMesh = new THREE.Mesh(gradientGeometry, gradientMat);
      gradientMesh.position.set(pocket.center.x, pocket.center.y, 0.16);
      gradientMesh.rotation.z = angleRad;
      gradientMesh.renderOrder = this.layerOrder.orderPockets;
      gradientMesh.visible = this.layerVisibility.showPockets;
      this.scene.add(gradientMesh);
      this.pocketMeshes.push(gradientMesh);

      const pocketShadowMaterial = this.getPocketShadowMaterial();
      const shadowInner = visualRadius * 0.92;
      const shadowOuter = visualRadius * 1.2;
      const shadowGeometry = new THREE.RingGeometry(shadowInner, shadowOuter, 64);
      const shadowMesh = new THREE.Mesh(shadowGeometry, pocketShadowMaterial);
      shadowMesh.position.set(pocket.center.x, pocket.center.y, 0.3);
      shadowMesh.rotation.x = Math.PI / 2;
      shadowMesh.rotation.z = angleRad;
      shadowMesh.renderOrder = this.layerOrder.orderPockets + 0.2;
      shadowMesh.visible = this.layerVisibility.showPockets;
      this.enforceRenderOrderControl(shadowMesh, { disableDepth: true });
      this.scene.add(shadowMesh);
      this.pocketShadowMeshes.push(shadowMesh);

      this.addPocketHighlight(pocket, visualRadius, angleRad);
    });
    
    this.initializeRailFillMesh();
    this.initializePocketCaps(pockets);
  }

  initializePocketCaps(pockets: PocketDef[]) {
    const capThickness = 0.2;
    const capMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#0a0a0a'),
      depthTest: false,
      depthWrite: false,
      transparent: true,
      opacity: 0.75,
    });

    pockets.forEach((pocket) => {
      const visualRadius = pocket.visualRadius ?? pocket.radius;
      const capGeometry = new THREE.CylinderGeometry(
        visualRadius * 1.02,
        visualRadius * 1.02,
        capThickness,
        48
      );
      const capMesh = new THREE.Mesh(capGeometry, capMaterial.clone());
      capMesh.position.set(pocket.center.x, pocket.center.y, 0.6);
      capMesh.rotation.x = Math.PI / 2;
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

    const { minX, maxX, minY, maxY } = this.playBounds;

    // Outer rectangle goes to frame INNER edge (not beyond the frame)
    // Frame inner edge is at: play area + rail outer thickness
    const outer = new THREE.Shape();
    const frameInnerOffset = CONFIG.RAIL_THICKNESS_OUTER; // Just the rail thickness, not + frameWidth
    outer.moveTo(minX - frameInnerOffset, maxY + frameInnerOffset);
    outer.lineTo(maxX + frameInnerOffset, maxY + frameInnerOffset);
    outer.lineTo(maxX + frameInnerOffset, minY - frameInnerOffset);
    outer.lineTo(minX - frameInnerOffset, minY - frameInnerOffset);
    outer.closePath();

    // Inner hole follows cushion OUTER edge (offset outward by rail thickness)
    // This leaves room for the rail cushions and only fills the gap to the frame
    const railOuterThickness = CONFIG.RAIL_THICKNESS_OUTER;
    const offsetPoints = this.offsetBoundaryOutward(this.playBoundaryPoints, railOuterThickness);
    
    const inner = new THREE.Path();
    if (offsetPoints.length > 0) {
      inner.moveTo(offsetPoints[0].x, offsetPoints[0].y);
      for (let i = 1; i < offsetPoints.length; i++) {
        inner.lineTo(offsetPoints[i].x, offsetPoints[i].y);
      }
      inner.closePath();
      outer.holes.push(inner);
    }

    return new THREE.ShapeGeometry(outer);
  }

  private getPocketSideMaterial(): THREE.MeshBasicMaterial {
    if (!this.pocketSideMaterial) {
      this.pocketSideMaterial = new THREE.MeshBasicMaterial({
        color: 0x0a0a0a, // Darker walls for more depth (was 0x151515)
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
    
    // Enhanced radial gradient with darker center for more depth
    const gradient = ctx.createRadialGradient(center, center, 0, center, center, radius);
    gradient.addColorStop(0, 'rgba(5, 5, 5, 1.0)');      // Much darker center (near black)
    gradient.addColorStop(0.2, 'rgba(15, 15, 15, 0.98)'); // Very dark inner area
    gradient.addColorStop(0.5, 'rgba(40, 40, 40, 0.9)');  // Dark middle
    gradient.addColorStop(0.75, 'rgba(70, 70, 70, 0.75)'); // Lighter toward edge
    gradient.addColorStop(1, 'rgba(90, 90, 90, 0.3)');    // Fade out at edge
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
  
  addBallGlow(mesh: THREE.Mesh | THREE.Object3D, radius: number) {
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
    // Clear UI canvas
    this.uiCtx.clearRect(0, 0, this.uiCanvas.width, this.uiCanvas.height);

    if (this.showMeasurementOverlay) {
      this.drawMeasurementOverlay();
    }
    
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
    this.pocketCapMeshes.forEach((mesh) => {
      mesh.renderOrder = this.layerOrder.orderCaps;
    });
    this.pocketShadowMeshes.forEach((mesh) => {
      mesh.renderOrder = this.layerOrder.orderPockets + 0.2;
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
        if (this.railFillMesh) this.railFillMesh.visible = visible;
        break;
      case 'showPockets':
        this.pocketMeshes.forEach((mesh) => (mesh.visible = visible));
        this.pocketShadowMeshes.forEach((mesh) => (mesh.visible = visible));
        this.pocketHighlightMeshes.forEach((mesh) => (mesh.visible = visible));
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

  private classifyAxisAlignmentFromVector(dx: number, dy: number, tolerance: number = 0.02): AxisAlignment {
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1e-4) return null;
    const nx = dx / len;
    const ny = dy / len;
    if (Math.abs(ny) <= tolerance && Math.abs(nx) > tolerance) {
      return 'horizontal';
    }
    if (Math.abs(nx) <= tolerance && Math.abs(ny) > tolerance) {
      return 'vertical';
    }
    return null;
  }

  private classifyAxisAlignmentFromPath(path: Vec2[]): AxisAlignment {
    if (path.length < 2) return null;
    const start = path[0];
    const end = path[path.length - 1];
    return this.classifyAxisAlignmentFromVector(end.x - start.x, end.y - start.y);
  }

  private getAxisPalette(alignment: AxisAlignment): AxisColorPalette {
    switch (alignment) {
      case 'horizontal':
        return {
          line: 'rgba(80, 255, 180, 0.95)',
          glow: 'rgba(0, 120, 90, 0.85)',
          debugStroke: 'rgba(80, 255, 180, 0.7)',
          debugFill: 'rgba(80, 255, 180, 0.9)',
        };
      case 'vertical':
        return {
          line: 'rgba(255, 170, 80, 0.95)',
          glow: 'rgba(140, 70, 0, 0.85)',
          debugStroke: 'rgba(255, 170, 80, 0.7)',
          debugFill: 'rgba(255, 170, 80, 0.9)',
        };
      default:
        return {
          line: 'rgba(255, 255, 255, 0.95)',
          glow: 'rgba(0, 0, 0, 0.8)',
          debugStroke: 'rgba(255, 230, 120, 0.7)',
          debugFill: 'rgba(255, 230, 120, 0.9)',
        };
    }
  }
  
  // Compatibility methods for existing code
  drawCueAndPowerBar(ball: Ball, angle: number, power: number, showGhost: boolean, showPowerBar: boolean, _isAimMode: boolean, prediction?: PredictionResult) {
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
    
    // Draw cue stick in 2D
    const cueLength = 20;
    const cueDistance = ball.radius + 2 + (1 - power / CONFIG.CUE_POWER_MAX) * 3;
    
    const cueStartX = ball.x - Math.cos(angle) * cueDistance;
    const cueStartY = ball.y - Math.sin(angle) * cueDistance;
    const cueEndX = ball.x - Math.cos(angle) * (cueDistance + cueLength);
    const cueEndY = ball.y - Math.sin(angle) * (cueDistance + cueLength);
    
    const cueStart = this.worldToScreen(cueStartX, cueStartY);
    const cueEnd = this.worldToScreen(cueEndX, cueEndY);
    
    this.uiCtx.strokeStyle = '#8B4513';
    this.uiCtx.lineWidth = 4;
    this.uiCtx.lineCap = 'round';
    this.uiCtx.beginPath();
    this.uiCtx.moveTo(cueStart.x, cueStart.y);
    this.uiCtx.lineTo(cueEnd.x, cueEnd.y);
    this.uiCtx.stroke();
    
    // Draw aim line in 2D - clipped to contact point or rails
    let aimEndX = ball.x + Math.cos(angle) * CONFIG.AIM_LINE_LENGTH;
    let aimEndY = ball.y + Math.sin(angle) * CONFIG.AIM_LINE_LENGTH;
    
    // If we have a prediction, stop at the contact point
    if (prediction && prediction.type === 'ball') {
      aimEndX = prediction.contactPoint.x;
      aimEndY = prediction.contactPoint.y;
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
      this.drawPowerBar2D(power);
    }
  }
  
  drawPowerBar2D(power: number) {
    const barWidth = 30;
    const barHeight = 200;
    const barX = this.uiCanvas.width - 60;
    const barY = (this.uiCanvas.height - barHeight) / 2;
    
    // Background
    this.uiCtx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    this.uiCtx.fillRect(barX, barY, barWidth, barHeight);
    
    // Power fill with gradient (bottom to top)
    const fillHeight = (power / CONFIG.CUE_POWER_MAX) * barHeight;
    const gradient = this.uiCtx.createLinearGradient(barX, barY + barHeight - fillHeight, barX, barY + barHeight);
    gradient.addColorStop(0, '#ff0000');
    gradient.addColorStop(0.5, '#ffff00');
    gradient.addColorStop(1, '#00ff00');
    
    this.uiCtx.fillStyle = gradient;
    this.uiCtx.fillRect(barX, barY + barHeight - fillHeight, barWidth, fillHeight);
    
    // Border
    this.uiCtx.strokeStyle = '#ffffff';
    this.uiCtx.lineWidth = 2;
    this.uiCtx.strokeRect(barX, barY, barWidth, barHeight);
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
    const cueBallScreen = this.worldToScreen(cueBallPos.x, cueBallPos.y);
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
        
        const orientation = this.classifyAxisAlignmentFromVector(normX, normY);
        const palette = this.getAxisPalette(orientation);

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
      const palette = this.getAxisPalette(orientation);
      
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
        const start = { x: prediction.contactPoint.x, y: prediction.contactPoint.y };
        const endRaw = { x: start.x + normX * adjustedLength, y: start.y + normY * adjustedLength };
        const end = this.clipLineAtRails(start, endRaw);
        
        const orientation = this.classifyAxisAlignmentFromVector(normX, normY);
        const palette = this.getAxisPalette(orientation);

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
        const start = { x: prediction.contactPoint.x, y: prediction.contactPoint.y };
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
    const canvas = this.renderer.domElement;
    const barWidth = 30;
    const barHeight = 200;
    const barX = canvas.width - 60;
    const barY = (canvas.height - barHeight) / 2;
    return { x: barX, y: barY, width: barWidth, height: barHeight };
  }
}

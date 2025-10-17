// 3D rendering system using Three.js
import * as THREE from 'three';
import { FBXLoader } from 'three-stdlib';
import { Ball, Rail, Pocket } from '../physics/Shapes';
import { PhysicsWorld } from '../physics/Physics';
import { CONFIG, BALL_CUE } from '../config';
import { getTableGeometry, computePlayBoundaryPoints, computeBoundaryBounds, type Vec2, type BoundaryBounds } from '../geometry/Geometry';
import { PredictionResult, ShotPreviewPaths } from '../physics/Prediction';

export class Renderer3D {
  canvas: HTMLCanvasElement;
  uiCanvas: HTMLCanvasElement;
  uiCtx: CanvasRenderingContext2D;
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  renderer: THREE.WebGLRenderer;
  scale: number;
  private playBoundaryPoints: Vec2[] = [];
  private playBounds: BoundaryBounds = { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  
  // 3D objects
  ballMeshes: Map<number, THREE.Object3D> = new Map();
  ballModels: Map<number, { geometry: THREE.BufferGeometry; material: THREE.MeshStandardMaterial }> = new Map();
  ballModelsLoaded: boolean = false;
  ballVisualScale = 1.0; // Visual radius matches physics radius to avoid overlap
  tableMesh: THREE.Mesh | null = null;
  frameMesh: THREE.Mesh | null = null;
  railMeshes: THREE.Mesh[] = [];
  pocketMeshes: THREE.Mesh[] = [];
  cornerRectangleMesh: THREE.Mesh | null = null;
  showMeasurementOverlay = false;
  
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
    
    // Create Three.js scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0a0a);
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
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    // Lighting
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    this.scene.add(this.ambientLight);

    this.directionalLight = new THREE.DirectionalLight(0xffffff, 1.35);
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

    this.fillLight = new THREE.HemisphereLight(0xffffff, 0x1a1a1a, 0.55);
    this.scene.add(this.fillLight);

    // Load FBX ball models (async)
    this.loadBallModels();

    // React to UI color changes without rebuilding geometry
    window.addEventListener('settings:colors-changed', () => {
      if (this.tableMesh && this.tableMesh.material instanceof THREE.MeshStandardMaterial) {
        this.tableMesh.material.color = new THREE.Color(CONFIG.TABLE_COLOR);
        this.tableMesh.material.needsUpdate = true;
      }
      if (this.frameMesh && this.frameMesh.material instanceof THREE.MeshStandardMaterial) {
        this.frameMesh.material.color = new THREE.Color(CONFIG.FRAME_COLOR);
        this.frameMesh.material.needsUpdate = true;
      }
      this.railMeshes.forEach((m) => {
        const mat = m.material as THREE.MeshStandardMaterial;
        if (mat) {
          mat.color = new THREE.Color(CONFIG.RAIL_COLOR);
          mat.needsUpdate = true;
        }
      });
      
      // Update corner rectangle fill color
      if (this.cornerRectangleMesh) {
        const mat = this.cornerRectangleMesh.material as THREE.MeshBasicMaterial;
        if (mat) {
          mat.color = new THREE.Color(CONFIG.RAIL_FILL_COLOR);
          mat.needsUpdate = true;
        }
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
      this.frameMesh.geometry.dispose();
      if (Array.isArray(this.frameMesh.material)) {
        this.frameMesh.material.forEach(m => m.dispose());
      } else {
        (this.frameMesh.material as THREE.Material).dispose();
      }
      this.frameMesh = null;
    }
    this.railMeshes.forEach(m => {
      this.scene.remove(m);
      m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[];
      if (Array.isArray(mat)) mat.forEach(mm => mm.dispose()); else mat.dispose();
    });
    this.railMeshes = [];
    this.pocketMeshes.forEach(m => {
      this.scene.remove(m);
      m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[];
      if (Array.isArray(mat)) mat.forEach(mm => mm.dispose()); else mat.dispose();
    });
    this.pocketMeshes = [];
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
    this.updateLoadingText('Loading ball models...');
    
    const loader = new FBXLoader();
    const textureLoader = new THREE.TextureLoader();
    
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
      
      const texturePromises = Object.entries(textureMap).map(([ballId, path]) => {
        return new Promise<[number, THREE.Texture]>((resolve) => {
          const texture = textureLoader.load(
            path,
            () => {
              texture.colorSpace = THREE.SRGBColorSpace;
              texture.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy()); // Limit anisotropy for performance
              texture.generateMipmaps = true;
              texture.minFilter = THREE.LinearMipmapLinearFilter;
              texture.magFilter = THREE.LinearFilter;
              texturesLoaded++;
              console.log(`  Texture ${texturesLoaded}/${totalTextures} loaded`);
              this.updateLoadingText(`Loading textures... ${texturesLoaded}/${totalTextures}`);
              resolve([Number(ballId), texture]);
            },
            undefined,
            (err) => {
              console.warn(`Failed to load texture for ball ${ballId}:`, err);
              resolve([Number(ballId), undefined as any]);
            }
          );
        });
      });

      console.log('  Loading FBX file (16MB, may take a moment)...');
      this.updateLoadingText('Loading 3D models (16MB)...');
      const [fbx, loadedTextures] = await Promise.all([
        loader.loadAsync('/poolballs.fbx'),
        Promise.all(texturePromises)
      ]);
      console.log('  FBX loaded, processing geometry...');
      this.updateLoadingText('Processing geometry...');

      const textureCache = new Map<number, THREE.Texture>(loadedTextures);
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
        const targetRadius = CONFIG.BALL_RADIUS * this.ballVisualScale;
        const scale = targetRadius / currentRadius;
        geometry.scale(scale, scale, scale);
        
        const texture = textureCache.get(ballId);
        
        const material = new THREE.MeshStandardMaterial({
          map: texture,
          color: ballId === 0 ? 0xffffff : 0xffffff,
          roughness: 0.18,
          metalness: 0.12
        });
        
        this.ballModels.set(ballId, { geometry, material });
      });
      
      this.ballModelsLoaded = this.ballModels.size > 0;
      if (this.ballModelsLoaded) {
        const elapsed = performance.now() - startTime;
        const seconds = (elapsed / 1000).toFixed(1);
        console.info(`✓ Loaded ${this.ballModels.size} FBX ball models in ${seconds}s (${elapsed.toFixed(0)}ms)`);
        console.info(`  💡 Tip: For faster loading, consider optimizing the FBX file size (currently 16MB)`);
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
    const container = this.canvas.parentElement!;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    
    // External margin around canvas
    const externalMargin = 40;
    
    // Internal padding within canvas (around table)
    const internalPadding = 40;
    
    // Calculate available space for canvas after external margins
    const availableWidth = containerWidth - externalMargin * 2;
    const availableHeight = containerHeight - externalMargin * 2;
    
    // Calculate scale to fit table with internal padding
    const scaleX = (availableWidth - internalPadding * 2) / CONFIG.TABLE_WIDTH;
    const scaleY = (availableHeight - internalPadding * 2) / CONFIG.TABLE_HEIGHT;
    this.scale = Math.min(scaleX, scaleY);
    
    // Set canvas size
    const width = CONFIG.TABLE_WIDTH * this.scale + internalPadding * 2;
    const height = CONFIG.TABLE_HEIGHT * this.scale + internalPadding * 2;
    
    this.renderer.setSize(width, height);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    
    // Resize UI canvas to match
    this.uiCanvas.width = width;
    this.uiCanvas.height = height;
    this.uiCanvas.style.width = `${width}px`;
    this.uiCanvas.style.height = `${height}px`;
    
    // Update camera aspect ratio
    const aspect = width / height;
    const frustumSize = CONFIG.TABLE_HEIGHT * 1.2;
    this.camera.left = -frustumSize * aspect / 2;
    this.camera.right = frustumSize * aspect / 2;
    this.camera.top = frustumSize / 2;
    this.camera.bottom = -frustumSize / 2;
    this.camera.updateProjectionMatrix();
  }
  
  initializeTable() {
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
    this.scene.add(this.tableMesh);

    // Wooden frame as shape with hole matching play surface
    const frameWidth = 4;
    const frameMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(CONFIG.FRAME_COLOR),
      roughness: 0.6,
      metalness: 0.2,
      side: THREE.DoubleSide
    });

    const frameShape = this.createFrameShape(frameWidth, playShape);
    const frameGeometry = new THREE.ShapeGeometry(frameShape);
    this.frameMesh = new THREE.Mesh(frameGeometry, frameMaterial);
    this.frameMesh.position.z = -0.5; // Slightly below felt
    this.frameMesh.receiveShadow = true;
    this.scene.add(this.frameMesh);
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

  private createFrameShape(frameWidth: number, playShape: THREE.Shape): THREE.Shape {
    const outer = new THREE.Shape();
    const { minX, maxX, minY, maxY } = this.playBounds;
    outer.moveTo(minX - frameWidth, minY - frameWidth);
    outer.lineTo(maxX + frameWidth, minY - frameWidth);
    outer.lineTo(maxX + frameWidth, maxY + frameWidth);
    outer.lineTo(minX - frameWidth, maxY + frameWidth);
    outer.lineTo(minX - frameWidth, minY - frameWidth);

    const hole = new THREE.Path();
    const holePoints = playShape.getPoints();
    if (holePoints.length) {
      hole.moveTo(holePoints[0].x, holePoints[0].y);
      for (let i = 1; i < holePoints.length; i++) {
        hole.lineTo(holePoints[i].x, holePoints[i].y);
      }
      hole.closePath();
      outer.holes.push(hole);
    }

    return outer;
  }
  
  initializeRails(rails: Rail[]) {
    const railMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(CONFIG.RAIL_COLOR),
      roughness: 0.5,
      metalness: 0.3
    });
    
    rails.forEach((rail) => {
      const dx = rail.x2 - rail.x1;
      const dy = rail.y2 - rail.y1;
      const length = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);
      
      const railGeometry = new THREE.BoxGeometry(length, CONFIG.RAIL_THICKNESS * 2, 1.5);
      const railMesh = new THREE.Mesh(railGeometry, railMaterial);
      
      railMesh.position.set(
        (rail.x1 + rail.x2) / 2,
        (rail.y1 + rail.y2) / 2,
        0.75
      );
      railMesh.rotation.z = angle;
      
      this.scene.add(railMesh);
      this.railMeshes.push(railMesh);
    });
  }
  
  initializePockets(pockets: Pocket[]) {
    const pocketMaterial = new THREE.MeshBasicMaterial({
      color: 0x000000,
      depthTest: false // This forces it to render on top
    });
    
    pockets.forEach((pocket) => {
      const pocketGeometry = new THREE.CylinderGeometry(
        pocket.radius,
        pocket.radius * 0.8,
        2,
        32
      );
      const pocketMesh = new THREE.Mesh(pocketGeometry, pocketMaterial);
      
      // Position pockets at table level
      pocketMesh.position.set(pocket.x, pocket.y, 0);
      pocketMesh.rotation.x = Math.PI / 2;
      
      // Set high render order to ensure pockets draw last
      pocketMesh.renderOrder = 999;
      
      this.scene.add(pocketMesh);
      this.pocketMeshes.push(pocketMesh);
    });
    
    // Create corner pocket rectangle (between rails and pockets)
    this.initializeCornerRectangle();
  }
  
  initializeCornerRectangle() {
    // Create a plane connecting the four corner pockets
    const shape = new THREE.Shape();
    shape.moveTo(-50, 25);  // NW
    shape.lineTo(50, 25);   // NE
    shape.lineTo(50, -25);  // SE
    shape.lineTo(-50, -25); // SW
    shape.closePath();
    
    const geometry = new THREE.ShapeGeometry(shape);
    const material = new THREE.MeshBasicMaterial({
      color: new THREE.Color(CONFIG.RAIL_FILL_COLOR),
      side: THREE.DoubleSide,
      depthTest: true,  // Enable depth testing so it respects Z-order
      transparent: false
    });
    
    this.cornerRectangleMesh = new THREE.Mesh(geometry, material);
    // Position below table felt
    this.cornerRectangleMesh.position.z = -0.1; // Below table, above rails, below pockets
    
    // Render order: after rails but before pockets
    this.cornerRectangleMesh.renderOrder = 500;
    
    this.scene.add(this.cornerRectangleMesh);
  }
  
  rotationAxis = new THREE.Vector3();
  rotationQuat = new THREE.Quaternion();

  createBall(ball: Ball): THREE.Object3D {
    const visualRadius = CONFIG.BALL_RADIUS * this.ballVisualScale;
    if (this.ballModelsLoaded) {
      const template = this.ballModels.get(ball.id);
      if (template) {
        const ballMesh = new THREE.Mesh(template.geometry, template.material);
        ballMesh.castShadow = false;
        ballMesh.receiveShadow = false;
        
        // Add black glow outline
        this.addBallGlow(ballMesh, visualRadius);
        
        this.scene.add(ballMesh);
        this.ballMeshes.set(ball.id, ballMesh);
        return ballMesh;
      }
    }

    // Fallback to procedural balls if FBX not loaded or template missing
    const geometry = new THREE.SphereGeometry(visualRadius, 32, 32);
    
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
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    
    // Add number texture for numbered balls
    if (ball.id !== BALL_CUE) {
      this.addBallNumber(mesh, ball.id);
    }
    
    // Add stripe for striped balls
    if (ball.id >= 9 && ball.id <= 15) {
      this.addBallStripe(mesh, visualRadius);
    }
    
    // Add black glow outline
    this.addBallGlow(mesh, visualRadius);
    
    this.scene.add(mesh);
    this.ballMeshes.set(ball.id, mesh);
    
    return mesh;
  }
  
  addBallGlow(mesh: THREE.Mesh | THREE.Object3D, radius: number) {
    // Create a slightly larger sphere with black outline material
    const glowGeometry = new THREE.SphereGeometry(radius * 1.12, 32, 32);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.35,
      side: THREE.BackSide, // Render from inside so it appears as an outline
      depthTest: true,
      depthWrite: false
    });
    
    const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
    glowMesh.renderOrder = -1; // Render behind the ball
    mesh.add(glowMesh);
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
      
      mesh.visible = true;
      
      // Interpolate position
      const x = ball.prevX + (ball.x - ball.prevX) * alpha;
      const y = ball.prevY + (ball.y - ball.prevY) * alpha;
      
      mesh.position.set(x, y, CONFIG.BALL_RADIUS * this.ballVisualScale);
      
      // Update rotation based on velocity
      if (ball.angularVelocity > 0.001) {
        const vx = ball.vx;
        const vy = ball.vy;
        const speed = Math.sqrt(vx * vx + vy * vy);
        if (speed > 0.001) {
          this.rotationAxis.set(-vy, vx, 0).normalize();
          this.rotationQuat.setFromAxisAngle(this.rotationAxis, ball.angle);
          mesh.setRotationFromQuaternion(this.rotationQuat);
          // Store last rotation axis for when ball stops
          mesh.userData.lastRotationAxis = this.rotationAxis.clone();
        }
      } else {
        // Stationary ball: use stored rotation from ball.angle
        // Use last known rotation axis, or a random one if not set
        if (!mesh.userData.lastRotationAxis) {
          // Create a random rotation axis in XY plane for visual variety
          const randomAngle = Math.random() * Math.PI * 2;
          mesh.userData.lastRotationAxis = new THREE.Vector3(
            Math.cos(randomAngle),
            Math.sin(randomAngle),
            0
          );
        }
        this.rotationQuat.setFromAxisAngle(mesh.userData.lastRotationAxis, ball.angle);
        mesh.setRotationFromQuaternion(this.rotationQuat);
      }
    });
    
    // Render the scene
    this.renderer.render(this.scene, this.camera);
  }

  toggleMeasurementOverlay(force?: boolean) {
    if (typeof force === 'boolean') {
      this.showMeasurementOverlay = force;
    } else {
      this.showMeasurementOverlay = !this.showMeasurementOverlay;
    }
    console.log(`Measurement overlay ${this.showMeasurementOverlay ? 'enabled' : 'disabled'}`);
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
    ctx.fillText('Ball 2.25"', sampleX, sampleY + ballRadiusPx + 14);

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
      this.uiCtx.beginPath();
      this.uiCtx.arc(ghostScreen.x, ghostScreen.y, ball.radius * this.scale, 0, Math.PI * 2);
      this.uiCtx.stroke();
      
      // Draw solid white circle (inner)
      this.uiCtx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
      this.uiCtx.lineWidth = 2;
      this.uiCtx.lineCap = 'round';
      this.uiCtx.beginPath();
      this.uiCtx.arc(ghostScreen.x, ghostScreen.y, ball.radius * this.scale, 0, Math.PI * 2);
      this.uiCtx.stroke();
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
        
        // Draw line
        this.uiCtx.strokeStyle = 'rgba(255, 255, 0, 0.6)';
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
          
          this.uiCtx.fillStyle = 'rgba(255, 255, 0, 0.8)';
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
      
      if (debugMode) {
        // Debug mode: yellow/orange dashed lines
        this.uiCtx.strokeStyle = 'rgba(255, 200, 0, 0.7)';
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
          
          this.uiCtx.fillStyle = 'rgba(255, 200, 0, 0.9)';
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
        drawPathWithGlow(displayPath, 'rgba(0, 0, 0, 0.8)', 'rgba(255, 255, 255, 0.95)', 3);
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
        
        drawLineWithGlow(
          start,
          end,
          'rgba(0, 0, 0, 0.8)',  // Black glow
          'rgba(255, 255, 255, 0.95)',  // Solid white
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

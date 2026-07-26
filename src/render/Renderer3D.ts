// 3D rendering system using Three.js
import * as THREE from 'three';
import { Ball, Rail, Pocket } from '../physics/Shapes';
import { PhysicsWorld } from '../physics/Physics';
import { CONFIG, BALL_CUE } from '../config';
import { TABLE_GEOMETRY } from '../geometry/Geometry';
import { PredictionResult, Predictor } from '../physics/Prediction';
import { PALETTE, token } from '../ui/palette';

/** Extra world-space margin around the play area, so the rails have room. */
const TABLE_MARGIN_IN = 9;

/** Pockets read larger than their capture radius so balls look like they fall in. */
const POCKET_VISUAL_SCALE = 1.35;

export class Renderer3D {
  canvas: HTMLCanvasElement;
  uiCanvas: HTMLCanvasElement;
  uiCtx: CanvasRenderingContext2D;
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  renderer: THREE.WebGLRenderer;
  scale: number;

  /** CSS-pixel size of the viewport. worldToScreen returns coordinates in these. */
  viewWidth = 0;
  viewHeight = 0;

  /** Aim overlay state, pushed in by Game. The renderer never derives it. */
  cueDrawBack = 0; // 0..1, how far the cue is pulled back
  cueVisible = true;
  guidelineFraction = 1; // tier gate: 0..1 of the full guideline length

  /** Built once and reused — never regenerated per frame. */
  private feltTexture: THREE.CanvasTexture | null = null;
  private scratchVec = new THREE.Vector3();

  // 3D objects
  ballMeshes: Map<number, THREE.Object3D> = new Map();
  ballRotations: Map<number, THREE.Quaternion> = new Map();
  ballModels: Map<number, THREE.Mesh> = new Map();
  ballModelsLoaded: boolean = false;
  ballVisualScale = 1.0; // Visual radius matches physics radius to avoid overlap
  tableMesh: THREE.Mesh | null = null;
  railMeshes: THREE.Mesh[] = [];
  pocketMeshes: THREE.Mesh[] = [];
  frameMeshes: THREE.Mesh[] = [];
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
    this.scene.background = new THREE.Color(PALETTE.bg900);

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
    // Position camera at a slight angle to see 3D rolling motion
    // (0, 0, 50) = straight down, (0, -10, 45) = tilted view
    this.camera.position.set(0, 0, 50);
    this.camera.lookAt(0, 0, 0);
    
    // Create WebGL renderer. Cap the pixel ratio at 2 — beyond that the cost
    // outruns the visible gain on the shot-replay frame budget.
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Lighting: warm key from above-left, cool fill, so the felt reads "lit pool
    // hall" rather than "flat green rectangle".
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.62);
    this.scene.add(this.ambientLight);

    this.directionalLight = new THREE.DirectionalLight(0xfff1d8, 1.45);
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

    this.fillLight = new THREE.HemisphereLight(0xdbeafe, 0x0b0e14, 0.5);
    this.scene.add(this.fillLight);
  }

  /**
   * Procedural felt: radial highlight from --felt-hi at centre out to --felt-lo
   * at the edges, plus a cloth-fiber noise pass and an edge vignette so the play
   * area sits in a pool of light.
   *
   * Generated once into an offscreen canvas and reused as a texture. This is the
   * WebGL equivalent of blitting a pre-rendered static layer — the felt never
   * costs anything per frame.
   */
  private buildFeltTexture(): THREE.CanvasTexture {
    const size = 1024;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d')!;

    const feltHi = token('--felt-hi', PALETTE.feltHi);
    const felt = token('--felt', CONFIG.TABLE_COLOR || PALETTE.felt);
    const feltLo = token('--felt-lo', PALETTE.feltLo);

    const grad = ctx.createRadialGradient(
      size / 2,
      size / 2,
      size * 0.04,
      size / 2,
      size / 2,
      size * 0.62
    );
    grad.addColorStop(0, feltHi);
    grad.addColorStop(0.5, felt);
    grad.addColorStop(1, feltLo);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    // Cloth fibers: fine directional noise, deliberately low contrast.
    const img = ctx.getImageData(0, 0, size, size);
    const data = img.data;
    for (let i = 0; i < data.length; i += 4) {
      const n = (Math.random() - 0.5) * 15;
      data[i] = Math.max(0, Math.min(255, data[i] + n));
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + n));
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + n));
    }
    ctx.putImageData(img, 0, 0);

    // Weave: faint crosshatch to catch the light.
    ctx.globalAlpha = 0.05;
    ctx.strokeStyle = feltHi;
    ctx.lineWidth = 1;
    for (let i = 0; i < size; i += 4) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, size);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Vignette baked in, so the cloth darkens toward the cushions.
    const vig = ctx.createRadialGradient(
      size / 2,
      size / 2,
      size * 0.28,
      size / 2,
      size / 2,
      size * 0.74
    );
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.42)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, size, size);

    const texture = new THREE.CanvasTexture(c);
    texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  /** Convert a viewport (client) point into table world coordinates. */
  screenToWorld(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;

    this.scratchVec.set(ndcX, ndcY, 0).unproject(this.camera);
    return { x: this.scratchVec.x, y: this.scratchVec.y };
  }

  setBallAssets(fbx: THREE.Group, textures: Map<number, THREE.Texture>) {
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
      const source = fbx.getObjectByName('pooballl_grp') ?? fbx;
      const handled = new Set<number>();
      
      
      source.traverse((child: THREE.Object3D) => {
        if (!(child instanceof THREE.Mesh)) {
          return;
        }
        if (!child.name.startsWith('poolball')) return;
        const ballId = ballNameMap[child.name];
        if (ballId === undefined || handled.has(ballId)) return;
        handled.add(ballId);
        
        
        // Use the ORIGINAL mesh with its material, just clone and scale it
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
        geometry.computeBoundingSphere();
        
        // Clone the original material and upgrade to StandardMaterial
        const originalMaterial = Array.isArray(child.material) ? child.material[0] : child.material;
        const originalMap = (originalMaterial as THREE.Material & { map?: THREE.Texture | null }).map; // Get original texture if it exists
        
        
        // Get our loaded texture
        let texture: THREE.Texture | undefined;
        if (ballId !== 0) {
          texture = textures.get(ballId);
          if (texture) {
            texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
            // CRITICAL: Ensure texture uses UV mapping (rotates with mesh)
            texture.mapping = THREE.UVMapping;
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
          }
        }
        
        // Use our texture if we have it, otherwise use original
        const finalTexture = texture || originalMap;
        
        // Create upgraded material
        const material = new THREE.MeshStandardMaterial({
          ...(finalTexture && { map: finalTexture }),
          color: 0xffffff,
          roughness: 0.18,
          metalness: 0.12
        });
        
        
        const templateMesh = new THREE.Mesh(geometry, material);
        templateMesh.castShadow = true;
        templateMesh.receiveShadow = true;
        templateMesh.name = `ball-template-${ballId}`;
        
        this.ballModels.set(ballId, templateMesh);
        
        // Debug: Check mesh structure
      });
      
      this.ballModelsLoaded = this.ballModels.size > 0;
      
      if (this.ballModelsLoaded) {
        this.replaceBallsWithModels();
      }
    } catch (error) {
      console.error('Error loading FBX:', error);
      this.ballModelsLoaded = false;
    }
  }
  
  replaceBallsWithModels() {
    this.ballMeshes.forEach((mesh) => {
      this.scene.remove(mesh);
    });
    this.ballMeshes.clear();
  }
  
  /**
   * The canvas fills the viewport; the table is letterboxed inside the camera
   * frustum instead of inside a smaller canvas. The felt vignette therefore
   * bleeds all the way to the screen edges.
   */
  resize() {
    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);

    this.viewWidth = width;
    this.viewHeight = height;

    // setSize scales the backing store by the pixel ratio; CSS keeps the element
    // at 100%/100%, so nothing looks soft on retina.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(width, height, false);

    // The 2D overlay needs the same treatment: scale the backing store, draw in
    // CSS pixels.
    this.uiCanvas.width = Math.round(width * dpr);
    this.uiCanvas.height = Math.round(height * dpr);
    this.uiCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Fit the whole table plus its rail margin, whichever axis is tighter.
    const aspect = width / height;
    const contentWidth = TABLE_GEOMETRY.playWidthIn + TABLE_MARGIN_IN * 2;
    const contentHeight = TABLE_GEOMETRY.playHeightIn + TABLE_MARGIN_IN * 2;
    const frustumHeight = Math.max(contentHeight, contentWidth / aspect);

    this.camera.left = (-frustumHeight * aspect) / 2;
    this.camera.right = (frustumHeight * aspect) / 2;
    this.camera.top = frustumHeight / 2;
    this.camera.bottom = -frustumHeight / 2;
    this.camera.updateProjectionMatrix();

    // Screen pixels per table inch — used for overlay stroke widths.
    this.scale = height / frustumHeight;
  }
  
  initializeTable() {
    // Remove previous table/frame meshes so restart doesn't duplicate scene objects
    if (this.tableMesh) {
      this.scene.remove(this.tableMesh);
      this.tableMesh = null;
    }
    this.frameMeshes.forEach((m) => this.scene.remove(m));
    this.frameMeshes = [];

    // Felt texture is built once for the lifetime of the renderer.
    if (!this.feltTexture) {
      this.feltTexture = this.buildFeltTexture();
    }

    const tableGeometry = new THREE.PlaneGeometry(
      TABLE_GEOMETRY.playWidthIn,
      TABLE_GEOMETRY.playHeightIn
    );
    const tableMaterial = new THREE.MeshStandardMaterial({
      map: this.feltTexture,
      roughness: 0.94,
      metalness: 0.0,
    });
    this.tableMesh = new THREE.Mesh(tableGeometry, tableMaterial);
    this.tableMesh.receiveShadow = true;
    this.scene.add(this.tableMesh);

    this.buildWoodFrame();
  }

  /**
   * Beveled wood band around the cloth: a dark base, a lighter top bevel, and a
   * near-black shadow lip where the cloth meets the rail. Diamond sight markers
   * are inlaid along the top face.
   */
  private buildWoodFrame() {
    const halfW = TABLE_GEOMETRY.playWidthIn / 2;
    const halfH = TABLE_GEOMETRY.playHeightIn / 2;

    const railBase = new THREE.MeshStandardMaterial({
      color: new THREE.Color(token('--rail', CONFIG.RAIL_COLOR || PALETTE.rail)),
      roughness: 0.62,
      metalness: 0.14,
    });
    const railBevel = new THREE.MeshStandardMaterial({
      color: new THREE.Color(token('--rail-hi', PALETTE.railHi)),
      roughness: 0.46,
      metalness: 0.2,
    });
    const shadowLip = new THREE.MeshBasicMaterial({
      color: new THREE.Color(PALETTE.bg900),
      transparent: true,
      opacity: 0.55,
    });

    const bandWidth = 7;
    const bevelWidth = 2.2;
    const bandZ = 1.9;
    const lipWidth = 0.5;

    const add = (mesh: THREE.Mesh) => {
      this.scene.add(mesh);
      this.frameMeshes.push(mesh);
    };

    // Each side: base band, lighter inner bevel strip, dark contact lip.
    const sides: Array<{
      horizontal: boolean;
      sign: number;
    }> = [
      { horizontal: true, sign: 1 },
      { horizontal: true, sign: -1 },
      { horizontal: false, sign: 1 },
      { horizontal: false, sign: -1 },
    ];

    for (const { horizontal, sign } of sides) {
      const along = horizontal ? TABLE_GEOMETRY.playWidthIn + bandWidth * 2 : bandWidth;
      const across = horizontal ? bandWidth : TABLE_GEOMETRY.playHeightIn + bandWidth * 2;
      const edge = horizontal ? halfH : halfW;

      const cx = horizontal ? 0 : sign * (edge + bandWidth / 2);
      const cy = horizontal ? sign * (edge + bandWidth / 2) : 0;

      const base = new THREE.Mesh(new THREE.BoxGeometry(along, across, bandZ), railBase);
      base.position.set(cx, cy, bandZ / 2);
      base.receiveShadow = true;
      add(base);

      // Bevel sits proud on the inner lip of the band and catches the key light.
      // It spans only the play dimension — extending it into the corners like
      // the base band does would draw the four bevels crossing over each other.
      const bevelAlong = horizontal ? TABLE_GEOMETRY.playWidthIn : bevelWidth;
      const bevelAcross = horizontal ? bevelWidth : TABLE_GEOMETRY.playHeightIn;
      const bevelX = horizontal ? 0 : sign * (edge + bevelWidth / 2 + 0.05);
      const bevelY = horizontal ? sign * (edge + bevelWidth / 2 + 0.05) : 0;

      const bevel = new THREE.Mesh(
        new THREE.BoxGeometry(bevelAlong, bevelAcross, bandZ + 0.35),
        railBevel
      );
      bevel.position.set(bevelX, bevelY, (bandZ + 0.35) / 2);
      add(bevel);

      // Dark hairline where cloth meets cushion.
      const lipAlong = horizontal ? TABLE_GEOMETRY.playWidthIn : lipWidth;
      const lipAcross = horizontal ? lipWidth : TABLE_GEOMETRY.playHeightIn;
      const lip = new THREE.Mesh(
        new THREE.PlaneGeometry(lipAlong, lipAcross),
        shadowLip
      );
      lip.position.set(
        horizontal ? 0 : sign * (halfW - lipWidth / 2),
        horizontal ? sign * (halfH - lipWidth / 2) : 0,
        0.02
      );
      add(lip);
    }

    this.buildDiamonds(halfW, halfH, bandWidth);
  }

  /** Inlaid diamond sights: 3 per short rail, 6 per long rail (quarter points). */
  private buildDiamonds(halfW: number, halfH: number, bandWidth: number) {
    const diamondMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(PALETTE.textHi),
      roughness: 0.3,
      metalness: 0.35,
    });

    // A square rotated 45 degrees reads as a diamond from straight above.
    const diamondGeometry = new THREE.PlaneGeometry(1.05, 1.05);
    const offset = bandWidth * 0.52;

    const place = (x: number, y: number) => {
      const d = new THREE.Mesh(diamondGeometry, diamondMaterial);
      d.position.set(x, y, 2.05);
      d.rotation.z = Math.PI / 4;
      this.scene.add(d);
      this.frameMeshes.push(d);
    };

    // Long rails: eighth-points, skipping the side pockets at x = 0.
    for (let i = 1; i <= 7; i++) {
      if (i === 4) continue;
      const x = -halfW + (TABLE_GEOMETRY.playWidthIn * i) / 8;
      place(x, halfH + offset);
      place(x, -halfH - offset);
    }

    // Short rails: quarter-points.
    for (let i = 1; i <= 3; i++) {
      const y = -halfH + (TABLE_GEOMETRY.playHeightIn * i) / 4;
      place(halfW + offset, y);
      place(-halfW - offset, y);
    }
  }

  /**
   * Pockets: a dark hole with a soft inner shadow lip, drawn slightly larger
   * than the physics capture radius so balls read as falling in rather than
   * vanishing at an invisible boundary.
   */
  initializePockets(pockets: Pocket[]) {
    this.pocketMeshes.forEach((m) => this.scene.remove(m));
    this.pocketMeshes = [];

    const holeMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0x05070b),
    });
    const lipMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0x05070b),
      transparent: true,
      opacity: 0.45,
    });

    pockets.forEach((pocket) => {
      const visual = pocket.radius * POCKET_VISUAL_SCALE;

      // Soft outer lip: a ring feathering the hole into the cloth.
      const lip = new THREE.Mesh(
        new THREE.RingGeometry(visual, visual * 1.42, 40),
        lipMaterial
      );
      lip.position.set(pocket.x, pocket.y, 0.03);
      lip.renderOrder = 998;
      this.scene.add(lip);
      this.pocketMeshes.push(lip);

      const hole = new THREE.Mesh(new THREE.CircleGeometry(visual, 40), holeMaterial);
      hole.position.set(pocket.x, pocket.y, 0.05);
      hole.renderOrder = 999;
      this.scene.add(hole);
      this.pocketMeshes.push(hole);
    });
  }

  /**
   * Rails are drawn as part of the wood frame; the physics rail list is kept
   * only so a geometry change upstream still lines the visuals up.
   */
  initializeRails(rails: Rail[]) {
    this.railMeshes.forEach((m) => this.scene.remove(m));
    this.railMeshes = [];
    void rails;
  }
  
  rotationAxis = new THREE.Vector3();
  rotationQuat = new THREE.Quaternion();

  createBall(ball: Ball): THREE.Object3D {
    const visualRadius = CONFIG.BALL_RADIUS * this.ballVisualScale;
    if (this.ballModelsLoaded) {
      const template = this.ballModels.get(ball.id);
      if (template) {
        // Clone mesh - need to clone both geometry and material for proper texture application
        const material = template.material as THREE.MeshStandardMaterial;
        const ballMesh = new THREE.Mesh(
          template.geometry.clone(),
          material.clone()
        );
        ballMesh.castShadow = true;
        ballMesh.receiveShadow = true;
        this.scene.add(ballMesh);
        this.ballMeshes.set(ball.id, ballMesh);
        const initialQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(ball.rotationX, ball.rotationY, ball.rotationZ));
        this.ballRotations.set(ball.id, initialQuat);
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
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    
    // Add number texture for numbered balls
    if (ball.id !== BALL_CUE) {
      this.addBallNumber(mesh, ball.id);
    }
    
    // Add stripe for striped balls
    if (ball.id >= 9 && ball.id <= 15) {
      this.addBallStripe(mesh, visualRadius);
    }
    
    this.scene.add(mesh);
    this.ballMeshes.set(ball.id, mesh);
    this.ballRotations.set(ball.id, new THREE.Quaternion().setFromEuler(new THREE.Euler(ball.rotationX, ball.rotationY, ball.rotationZ)));
    
    return mesh;
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
    // Clear UI canvas (in CSS pixels — the context carries the DPR transform)
    this.uiCtx.clearRect(0, 0, this.viewWidth, this.viewHeight);

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
      
      // Apply stored orientation quaternion
      const storedQuat = this.ballRotations.get(ball.id);
      if (storedQuat) {
        mesh.quaternion.copy(storedQuat);
      } else {
        const fallbackQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(ball.rotationX, ball.rotationY, ball.rotationZ));
        mesh.quaternion.copy(fallbackQuat);
        this.ballRotations.set(ball.id, fallbackQuat);
      }

      // Update rotation based on actual distance traveled (true rolling motion)
      const dx = ball.x - ball.prevX;
      const dy = ball.y - ball.prevY;
      const distanceTraveled = Math.sqrt(dx * dx + dy * dy);
      
      if (distanceTraveled > 0.001 && ball.angularVelocity > 0.001) {
        // Calculate rotation amount based on distance: angle = distance / radius
        // This ensures the ball rotates exactly the right amount for rolling motion
        const rotationMultiplier3D = CONFIG.BALL_ROTATION_MULTIPLIER_3D ?? CONFIG.BALL_ROTATION_MULTIPLIER ?? 1;
        const rotationAmount = (distanceTraveled / ball.radius) * rotationMultiplier3D;
        
        // Calculate rotation axis perpendicular to direction of travel
        // For a ball moving in direction (dx, dy), it should rotate around axis perpendicular to that
        // The axis should be (-dy, dx, 0) normalized
        const length = Math.sqrt(dx * dx + dy * dy);
        if (length > 0.001) {
          this.rotationAxis.set(
            -dy / length,  // X component (perpendicular to travel)
            dx / length,   // Y component (perpendicular to travel)
            0              // Z component (no rotation around vertical)
          );
        }
        
        // Rotate the mesh around the world axis (perpendicular to travel direction)
        mesh.rotateOnWorldAxis(this.rotationAxis, rotationAmount);
        mesh.updateMatrixWorld(true);
        
        // Persist the new orientation so future frames start from the correct pose
        const updatedEuler = mesh.rotation;
        ball.rotationX = updatedEuler.x;
        ball.rotationY = updatedEuler.y;
        ball.rotationZ = updatedEuler.z;
        this.ballRotations.set(ball.id, mesh.quaternion.clone());
      } else {
        // Ball at rest - stored orientation already applied above
      }
    });
    
    // Render the scene
    this.renderer.render(this.scene, this.camera);

    // The cue ball gets a ring so it is instantly identifiable among 16 spheres.
    const cue = world.balls.find((b) => b.id === BALL_CUE);
    if (cue && !cue.pocketed) {
      const x = cue.prevX + (cue.x - cue.prevX) * alpha;
      const y = cue.prevY + (cue.y - cue.prevY) * alpha;
      this.drawCueBallRing(x, y, cue.radius);
    }
  }

  private drawCueBallRing(x: number, y: number, radius: number) {
    const p = this.worldToScreen(x, y);
    const r = radius * this.scale;
    const ctx = this.uiCtx;

    ctx.save();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)'; // --cyan-400 at low alpha
    ctx.lineWidth = Math.max(1.25, r * 0.09);
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * 1.28, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  toggleMeasurementOverlay(force?: boolean) {
    if (typeof force === 'boolean') {
      this.showMeasurementOverlay = force;
    } else {
      this.showMeasurementOverlay = !this.showMeasurementOverlay;
    }
    console.log(`Measurement overlay ${this.showMeasurementOverlay ? 'enabled' : 'disabled'}`);
  }
  
  debugRotation() {
    console.log('\n═══════════════════════════════════════');
    console.log('🔍 BALL ROTATION DEBUG SNAPSHOT');
    console.log('═══════════════════════════════════════');
    console.log(`Ball Models Loaded: ${this.ballModelsLoaded}`);
    console.log(`Number of Templates: ${this.ballModels.size}`);
    console.log(`Number of Active Balls: ${this.ballMeshes.size}`);
    console.log(`Rotation Multiplier: ${CONFIG.BALL_ROTATION_MULTIPLIER}`);
    console.log('\nActive Balls:');
    this.ballMeshes.forEach((mesh, ballId) => {
      console.log(`  Ball ${ballId}:`);
      console.log(`    Position: (${mesh.position.x.toFixed(2)}, ${mesh.position.y.toFixed(2)}, ${mesh.position.z.toFixed(2)})`);
      console.log(`    Rotation: (${mesh.rotation.x.toFixed(3)}, ${mesh.rotation.y.toFixed(3)}, ${mesh.rotation.z.toFixed(3)}) rad`);
      console.log(`    Mesh Type: ${mesh.type}`);
      console.log(`    Is THREE.Mesh: ${mesh instanceof THREE.Mesh}`);
      if (mesh instanceof THREE.Mesh) {
        console.log(`    Has Material: ${mesh.material !== null}`);
        const mat = mesh.material as THREE.MeshStandardMaterial;
        console.log(`    Has Texture: ${mat.map !== null && mat.map !== undefined}`);
        console.log(`    Children: ${mesh.children.length}`);
      }
    });
    console.log('═══════════════════════════════════════\n');
  }
  
  testRotation(ballId: number, angle: number = 1.0) {
    const mesh = this.ballMeshes.get(ballId);
    if (!mesh) {
      console.error(`❌ Ball ${ballId} not found!`);
      return;
    }
    console.log(`🔄 Manually rotating ball ${ballId} by ${angle} radians around Y axis...`);
    console.log(`   BEFORE: (${mesh.rotation.x.toFixed(3)}, ${mesh.rotation.y.toFixed(3)}, ${mesh.rotation.z.toFixed(3)})`);
    mesh.rotation.y += angle;
    console.log(`   AFTER:  (${mesh.rotation.x.toFixed(3)}, ${mesh.rotation.y.toFixed(3)}, ${mesh.rotation.z.toFixed(3)})`);
    
    // Force material update
    if (mesh instanceof THREE.Mesh) {
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.needsUpdate = true;
      if (mat.map) {
        mat.map.needsUpdate = true;
        console.log(`   Texture matrix:`, mat.map.matrix);
      }
    }
    
    console.log('✅ Rotation applied! Watch the ball - does the NUMBER/PATTERN rotate with it?');
  }
  
  replaceWithTestBall(ballId: number) {
    const oldMesh = this.ballMeshes.get(ballId);
    if (!oldMesh) {
      console.error(`❌ Ball ${ballId} not found!`);
      return;
    }
    
    // Create a simple test ball with a stripe pattern
    const geometry = new THREE.SphereGeometry(CONFIG.BALL_RADIUS * this.ballVisualScale, 32, 32);
    
    // Create a canvas texture with stripes
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    
    // Red background
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(0, 0, 512, 512);
    
    // White stripes
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 512; i += 64) {
      ctx.fillRect(i, 0, 32, 512);
    }
    
    // Add text
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 200px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ballId.toString(), 256, 256);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.mapping = THREE.UVMapping;
    
    const material = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.3,
      metalness: 0.1
    });
    
    const testMesh = new THREE.Mesh(geometry, material);
    testMesh.position.copy(oldMesh.position);
    testMesh.rotation.copy(oldMesh.rotation);
    testMesh.castShadow = true;
    testMesh.receiveShadow = true;
    
    this.scene.remove(oldMesh);
    this.scene.add(testMesh);
    this.ballMeshes.set(ballId, testMesh);
    
    console.log(`✅ Replaced ball ${ballId} with striped test ball. Try testRotation(${ballId}) now!`);
  }
  
  testRotationX(ballId: number, angle: number = 1.0) {
    const mesh = this.ballMeshes.get(ballId);
    if (!mesh) {
      console.error(`❌ Ball ${ballId} not found!`);
      return;
    }
    console.log(`🔄 Rotating ball ${ballId} by ${angle} rad around X axis (horizontal rolling)`);
    mesh.rotation.x += angle;
    console.log('✅ Watch - does it look like the ball is rolling forward/back?');
  }

  drawMeasurementOverlay() {
    const ctx = this.uiCtx;
    const halfW = TABLE_GEOMETRY.playWidthIn / 2;
    const halfH = TABLE_GEOMETRY.playHeightIn / 2;
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
    const sampleX = this.viewWidth - ballRadiusPx * 3;
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
  
  /**
   * World -> CSS pixels. Reuses one scratch vector: this runs several times per
   * frame for the guideline and must not allocate.
   */
  worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    this.scratchVec.set(worldX, worldY, 0).project(this.camera);
    return {
      x: ((this.scratchVec.x + 1) * this.viewWidth) / 2,
      y: ((-this.scratchVec.y + 1) * this.viewHeight) / 2,
    };
  }
  
  // Helper to clip a line at table boundaries (inside the rails)
  clipLineAtRails(start: { x: number; y: number }, end: { x: number; y: number }): { x: number; y: number } {
    // Use the actual rail boundaries from geometry
    const halfWidth = TABLE_GEOMETRY.playWidthIn / 2;
    const halfHeight = TABLE_GEOMETRY.playHeightIn / 2;
    
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
  
  /**
   * Draw the cue and the ghost ball onto the 2D overlay.
   *
   * `power` is 0..1. The cue draws back proportionally along the aim vector, so
   * charging the slider is visible on the table itself.
   */
  drawAimAndCue(
    ball: Ball,
    angle: number,
    power: number,
    showGhost: boolean,
    prediction?: PredictionResult
  ) {
    const ctx = this.uiCtx;

    // Ghost ball at the contact position — the single most useful aiming aid.
    if (showGhost && prediction && prediction.type === 'ball' && prediction.hitBall) {
      const ghostX = prediction.contactPoint.x - prediction.contactNormal.x * ball.radius;
      const ghostY = prediction.contactPoint.y - prediction.contactNormal.y * ball.radius;
      const ghost = this.worldToScreen(ghostX, ghostY);
      const r = ball.radius * this.scale;

      ctx.save();
      ctx.strokeStyle = 'rgba(241, 245, 249, 0.75)'; // --text-hi
      ctx.lineWidth = Math.max(1.25, r * 0.11);
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(ghost.x, ghost.y, r, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = 'rgba(241, 245, 249, 0.09)';
      ctx.fill();
      ctx.restore();
    }

    if (!this.cueVisible) return;

    // Cue geometry, in table inches.
    const cueLength = 34;
    const tipGap = ball.radius + 0.9;
    const maxDraw = 9;
    const drawBack = tipGap + power * maxDraw;

    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    const tip = this.worldToScreen(ball.x - cos * drawBack, ball.y - sin * drawBack);
    const joint = this.worldToScreen(
      ball.x - cos * (drawBack + cueLength * 0.42),
      ball.y - sin * (drawBack + cueLength * 0.42)
    );
    const butt = this.worldToScreen(
      ball.x - cos * (drawBack + cueLength),
      ball.y - sin * (drawBack + cueLength)
    );

    const shaftWidth = Math.max(2.5, ball.radius * this.scale * 0.42);

    ctx.save();
    ctx.lineCap = 'butt';

    // Butt: dark stained wood, tapering into a pale maple shaft.
    const grad = ctx.createLinearGradient(butt.x, butt.y, tip.x, tip.y);
    grad.addColorStop(0, '#241408');
    grad.addColorStop(0.34, '#3d2413');
    grad.addColorStop(0.36, '#c9a227'); // inlay ring
    grad.addColorStop(0.4, '#d9c39a');
    grad.addColorStop(1, '#f0dfba');

    ctx.strokeStyle = grad;
    ctx.lineWidth = shaftWidth;
    ctx.beginPath();
    ctx.moveTo(butt.x, butt.y);
    ctx.lineTo(tip.x, tip.y);
    ctx.stroke();

    // Ferrule + tip.
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = shaftWidth * 0.92;
    ctx.beginPath();
    ctx.moveTo(joint.x + (tip.x - joint.x) * 0.86, joint.y + (tip.y - joint.y) * 0.86);
    ctx.lineTo(tip.x, tip.y);
    ctx.stroke();

    ctx.strokeStyle = '#38BDF8'; // --cyan-400 tip
    ctx.lineWidth = shaftWidth * 0.92;
    ctx.beginPath();
    ctx.moveTo(tip.x - cos * 1.5, tip.y + sin * 1.5);
    ctx.lineTo(tip.x, tip.y);
    ctx.stroke();

    ctx.restore();
  }
  
  /**
   * The guideline: cue-ball path to first contact, the object ball's predicted
   * departure line, and the cue ball's tangent/deflection line in a dimmer
   * stroke.
   *
   * `guidelineFraction` gates how far the aids project — full at low tiers,
   * shortened at high ones.
   */
  drawTrajectoryLines(
    prediction: PredictionResult,
    cueBallPos: { x: number; y: number },
    shotDirection: { x: number; y: number },
    predictor: Predictor
  ) {
    // Clear old 3D trajectory lines
    this.trajectoryLines.forEach((line) => this.scene.remove(line));
    this.trajectoryLines = [];

    if (prediction.type === 'none') return;

    const gate = Math.max(0, Math.min(1, this.guidelineFraction));
    if (gate <= 0) return;

    const ctx = this.uiCtx;
    const cueBallScreen = this.worldToScreen(cueBallPos.x, cueBallPos.y);

    // Primary aim line, gated by tier: it stops short when the gate is tight.
    const gatedContact = {
      x: cueBallPos.x + (prediction.contactPoint.x - cueBallPos.x) * gate,
      y: cueBallPos.y + (prediction.contactPoint.y - cueBallPos.y) * gate,
    };
    const contactScreen = this.worldToScreen(gatedContact.x, gatedContact.y);

    ctx.save();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)'; // --cyan-400
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 7]);
    ctx.beginPath();
    ctx.moveTo(cueBallScreen.x, cueBallScreen.y);
    ctx.lineTo(contactScreen.x, contactScreen.y);
    ctx.stroke();
    ctx.restore();

    // Post-contact aids only make sense when the full line reached the object.
    if (gate < 1) return;

    const trajectories = predictor.predictTrajectories(
      prediction,
      cueBallPos,
      shotDirection,
      50
    );

    // Object ball departure — the important one, so it gets the accent color.
    if (trajectories.objectBallPath) {
      this.drawPathLine(
        trajectories.objectBallPath.start,
        trajectories.objectBallPath.end,
        'rgba(240, 180, 41, 0.85)', // --gold-500
        2.2,
        true
      );
    }

    // Cue ball tangent / deflection — deliberately dimmer.
    if (trajectories.cueBallPath) {
      this.drawPathLine(
        trajectories.cueBallPath.start,
        trajectories.cueBallPath.end,
        'rgba(241, 245, 249, 0.34)', // --text-hi, low alpha
        1.6,
        false
      );
    }
  }

  private drawPathLine(
    start: { x: number; y: number },
    endRaw: { x: number; y: number },
    color: string,
    width: number,
    arrowHead: boolean
  ) {
    const end = this.clipLineAtRails(start, endRaw);
    const a = this.worldToScreen(start.x, start.y);
    const b = this.worldToScreen(end.x, end.y);
    const ctx = this.uiCtx;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash([10, 9]);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.setLineDash([]);

    if (arrowHead) {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      if (Math.hypot(dx, dy) > 1) {
        const angle = Math.atan2(dy, dx);
        const size = 9;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(
          b.x - size * Math.cos(angle - Math.PI / 6),
          b.y - size * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
          b.x - size * Math.cos(angle + Math.PI / 6),
          b.y - size * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fill();
      }
    }

    ctx.restore();
  }

  /** Translucent preview of where the cue ball would be placed (ball in hand). */
  drawPlacementPreview(x: number, y: number, radius: number, valid: boolean) {
    const p = this.worldToScreen(x, y);
    const r = radius * this.scale;
    const ctx = this.uiCtx;

    ctx.save();
    ctx.fillStyle = valid ? 'rgba(52, 211, 153, 0.22)' : 'rgba(239, 68, 68, 0.28)';
    ctx.strokeStyle = valid ? 'rgba(52, 211, 153, 0.9)' : 'rgba(239, 68, 68, 0.95)';
    ctx.lineWidth = Math.max(1.5, r * 0.14);
    ctx.setLineDash(valid ? [] : [5, 4]);
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * 1.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

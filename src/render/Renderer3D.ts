// 3D rendering system using Three.js
import * as THREE from 'three';
import { Ball, Rail, Pocket } from '../physics/Shapes';
import { PhysicsWorld } from '../physics/Physics';
import { CONFIG, BALL_CUE } from '../config';
import { TABLE_GEOMETRY } from '../geometry/Geometry';
import { PredictionResult, ShotPreviewPaths } from '../physics/Prediction';

export class Renderer3D {
  canvas: HTMLCanvasElement;
  uiCanvas: HTMLCanvasElement;
  uiCtx: CanvasRenderingContext2D;
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  renderer: THREE.WebGLRenderer;
  scale: number;
  
  // 3D objects
  ballMeshes: Map<number, THREE.Object3D> = new Map();
  ballRotations: Map<number, THREE.Quaternion> = new Map();
  ballModels: Map<number, THREE.Mesh> = new Map();
  ballModelsLoaded: boolean = false;
  ballVisualScale = 1.0; // Visual radius matches physics radius to avoid overlap
  tableMesh: THREE.Mesh | null = null;
  railMeshes: THREE.Mesh[] = [];
  pocketMeshes: THREE.Mesh[] = [];
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
      
      console.log('🔍 FBX Structure:');
      console.log('  Root children:', fbx.children.length);
      fbx.children.forEach((c, i) => console.log(`    ${i}: ${c.name} (${c.type}), children: ${c.children.length}`));
      
      source.traverse((child: THREE.Object3D) => {
        if (!(child instanceof THREE.Mesh)) {
          console.log(`  Skipping non-mesh: ${child.name} (${child.type})`);
          return;
        }
        if (!child.name.startsWith('poolball')) return;
        const ballId = ballNameMap[child.name];
        if (ballId === undefined || handled.has(ballId)) return;
        handled.add(ballId);
        
        console.log(`📦 Processing mesh: ${child.name}, children: ${child.children.length}`);
        
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
        const originalMap = (originalMaterial as any).map; // Get original texture if it exists
        
        console.log(`   Original has embedded texture:`, originalMap !== null && originalMap !== undefined);
        
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
            console.log(`   Texture mapping mode: ${texture.mapping} (should be ${THREE.UVMapping})`);
          }
        }
        
        // Use our texture if we have it, otherwise use original
        const finalTexture = texture || originalMap;
        
        if (finalTexture) {
          console.log(`   Final texture mapping: ${finalTexture.mapping}`);
          console.log(`   Final texture wrap: ${finalTexture.wrapS}, ${finalTexture.wrapT}`);
        }
        
        // Create upgraded material
        const material = new THREE.MeshStandardMaterial({
          ...(finalTexture && { map: finalTexture }),
          color: 0xffffff,
          roughness: 0.18,
          metalness: 0.12
        });
        
        console.log(`   Using texture:`, finalTexture !== null && finalTexture !== undefined);
        
        const templateMesh = new THREE.Mesh(geometry, material);
        templateMesh.castShadow = true;
        templateMesh.receiveShadow = true;
        templateMesh.name = `ball-template-${ballId}`;
        
        this.ballModels.set(ballId, templateMesh);
        
        // Debug: Check mesh structure
        console.log(`🔍 Ball ${ballId} mesh structure:`);
        console.log(`   Geometry type: ${geometry.type}`);
        console.log(`   Has UVs: ${geometry.attributes.uv !== undefined}`);
        console.log(`   Material type: ${material.type}`);
        console.log(`   Texture: ${texture ? 'yes' : 'no'}`);
        if (texture) {
          console.log(`   Texture size: ${texture.image?.width}x${texture.image?.height}`);
        }
        
        // Test manual rotation
        const testMesh = templateMesh.clone();
        testMesh.rotation.y = Math.PI / 4; // 45 degrees
        console.log(`   Test rotation applied: ${testMesh.rotation.y} rad`);
      });
      
      this.ballModelsLoaded = this.ballModels.size > 0;
      console.log(`🎱 Ball models loaded: ${this.ballModels.size} templates created`);
      
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
    // Create table felt
    const tableGeometry = new THREE.ShapeGeometry(this.createPlaySurfaceShape(), 48);
    const tableMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(CONFIG.TABLE_COLOR),
      roughness: 0.8,
      metalness: 0.1
    });
    this.tableMesh = new THREE.Mesh(tableGeometry, tableMaterial);
    this.tableMesh.receiveShadow = true;
    this.scene.add(this.tableMesh);
    
    // Create wooden frame
    const frameWidth = 4;
    const frameHeight = 2;
    const frameMaterial = new THREE.MeshStandardMaterial({
      color: 0x3d2413,
      roughness: 0.6,
      metalness: 0.2
    });
    
    const halfW = TABLE_GEOMETRY.playWidthIn / 2;
    const halfH = TABLE_GEOMETRY.playHeightIn / 2;
    
    // Top frame
    const topFrame = new THREE.Mesh(
      new THREE.BoxGeometry(TABLE_GEOMETRY.playWidthIn + frameWidth * 2, frameWidth, frameHeight),
      frameMaterial
    );
    topFrame.position.set(0, halfH + frameWidth / 2, frameHeight / 2);
    this.scene.add(topFrame);
    
    // Bottom frame
    const bottomFrame = new THREE.Mesh(
      new THREE.BoxGeometry(TABLE_GEOMETRY.playWidthIn + frameWidth * 2, frameWidth, frameHeight),
      frameMaterial
    );
    bottomFrame.position.set(0, -halfH - frameWidth / 2, frameHeight / 2);
    this.scene.add(bottomFrame);
    
    // Left frame
    const leftFrame = new THREE.Mesh(
      new THREE.BoxGeometry(frameWidth, TABLE_GEOMETRY.playHeightIn, frameHeight),
      frameMaterial
    );
    leftFrame.position.set(-halfW - frameWidth / 2, 0, frameHeight / 2);
    this.scene.add(leftFrame);
    
    // Right frame
    const rightFrame = new THREE.Mesh(
      new THREE.BoxGeometry(frameWidth, TABLE_GEOMETRY.playHeightIn, frameHeight),
      frameMaterial
    );
    rightFrame.position.set(halfW + frameWidth / 2, 0, frameHeight / 2);
    this.scene.add(rightFrame);
  }
  
  initializeRails(_rails: Rail[]) {
    if (this.railMeshes.length > 0) {
      this.railMeshes.forEach(mesh => {
        this.scene.remove(mesh);
        mesh.geometry.dispose();
        if (mesh.material instanceof THREE.Material) {
          mesh.material.dispose();
        }
      });
      this.railMeshes = [];
    }

    // Different colors for each cushion to help with debugging geometry
    const cushionColors = [
      0xff00ff,  // N_west - Magenta
      0x00ffff,  // N_east - Cyan
      0xffff00,  // S_west - Yellow
      0xff8800,  // S_east - Orange
      0x00ff00,  // W - Green
      0x0088ff   // E - Blue
    ];

    TABLE_GEOMETRY.rails.forEach((railDef, index) => {
      const shape = new THREE.Shape();
      const { points } = railDef;
      shape.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        shape.lineTo(points[i].x, points[i].y);
      }
      shape.closePath();

      const geometry = new THREE.ShapeGeometry(shape);
      const mesh = new THREE.Mesh(
        geometry,
        new THREE.MeshStandardMaterial({
          color: new THREE.Color(cushionColors[index]),
          roughness: 0.5,
          metalness: 0.3
        })
      );
      mesh.position.z = 0.1;
      mesh.renderOrder = 1000;  // Render above pockets (which are at 999)
      this.scene.add(mesh);
      this.railMeshes.push(mesh);
    });
  }

  private createPlaySurfaceShape(): THREE.Shape {
    const halfW = TABLE_GEOMETRY.playWidthIn / 2;
    const halfH = TABLE_GEOMETRY.playHeightIn / 2;

    const shape = new THREE.Shape();
    shape.moveTo(-halfW, -halfH);
    shape.lineTo(halfW, -halfH);
    shape.lineTo(halfW, halfH);
    shape.lineTo(-halfW, halfH);
    shape.closePath();

    TABLE_GEOMETRY.pockets.forEach((pocket) => {
      const radius = pocket.captureRadiusIn ?? TABLE_GEOMETRY.pocketCaptureRadiusIn;
      const hole = new THREE.Path();
      hole.absarc(pocket.center.x, pocket.center.y, radius, 0, Math.PI * 2, true);
      shape.holes.push(hole);
    });

    return shape;
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
        
        // Debug occasionally
        if (ball.id === 0 && Math.random() < 0.01) {
          console.log(`🔄 Ball ${ball.id} rolling:`);
          console.log(`  Travel: (${dx.toFixed(3)}, ${dy.toFixed(3)}) = ${distanceTraveled.toFixed(3)}`);
          console.log(`  Rotation amount: ${rotationAmount.toFixed(4)} rad`);
          console.log(`  Axis: (${this.rotationAxis.x.toFixed(3)}, ${this.rotationAxis.y.toFixed(3)}, ${this.rotationAxis.z.toFixed(3)})`);
          console.log(`  Updated Euler: (${ball.rotationX.toFixed(3)}, ${ball.rotationY.toFixed(3)}, ${ball.rotationZ.toFixed(3)})`);
        }
      } else {
        // Ball at rest - stored orientation already applied above
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

    // Draw cushion polygon vertices with colored dots
    const cushionColors = [
      '#ff00ff',  // N_west - Magenta
      '#00ffff',  // N_east - Cyan
      '#ffff00',  // S_west - Yellow
      '#ff8800',  // S_east - Orange
      '#00ff00',  // W - Green
      '#0088ff'   // E - Blue
    ];

    TABLE_GEOMETRY.rails.forEach((cushionDef, cushionIndex) => {
      const color = cushionColors[cushionIndex];

      // Draw each polygon vertex
      cushionDef.points.forEach((point, pointIndex) => {
        const screen = this.worldToScreen(point.x, point.y);

        // Draw filled circle for vertex
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, 6, 0, Math.PI * 2);
        ctx.fill();

        // Draw black border for visibility
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw point number label
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const label = `${pointIndex}`;
        // Stroke text for outline
        ctx.strokeText(label, screen.x, screen.y - 12);
        ctx.fillText(label, screen.x, screen.y - 12);
      });
    });

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
  
  // Compatibility methods for existing code
  drawCueAndPowerBar(ball: Ball, angle: number, power: number, showGhost: boolean, showPowerBar: boolean, isAimMode: boolean, prediction?: PredictionResult, isFineAimMode?: boolean, isUltraFineMode?: boolean, isSpacebarMode?: boolean, previewPower?: number) {
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
    
    const ballScreen = this.worldToScreen(ball.x, ball.y);
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
    
    // Draw aim line in 2D
    const aimLineLength = CONFIG.AIM_LINE_LENGTH;
    const aimEndX = ball.x + Math.cos(angle) * aimLineLength;
    const aimEndY = ball.y + Math.sin(angle) * aimLineLength;
    const aimEnd = this.worldToScreen(aimEndX, aimEndY);
    
    this.uiCtx.strokeStyle = 'rgba(255, 255, 0, 0.6)';
    this.uiCtx.lineWidth = 2;
    this.uiCtx.setLineDash([5, 5]);
    this.uiCtx.beginPath();
    this.uiCtx.moveTo(ballScreen.x, ballScreen.y);
    this.uiCtx.lineTo(aimEnd.x, aimEnd.y);
    this.uiCtx.stroke();
    this.uiCtx.setLineDash([]);
    
    // Draw ghost ball in 2D if prediction exists
    if (showGhost && prediction && prediction.type === 'ball' && prediction.hitBall) {
      // Ghost ball should be positioned where the cue ball will be at contact
      // That's one ball radius away from the contact point, in the opposite direction of the normal
      const ghostX = prediction.contactPoint.x - prediction.contactNormal.x * ball.radius;
      const ghostY = prediction.contactPoint.y - prediction.contactNormal.y * ball.radius;
      const ghostScreen = this.worldToScreen(ghostX, ghostY);
      
      this.uiCtx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      this.uiCtx.lineWidth = 2;
      this.uiCtx.beginPath();
      this.uiCtx.arc(ghostScreen.x, ghostScreen.y, ball.radius * this.scale, 0, Math.PI * 2);
      this.uiCtx.stroke();
    }
    
    // Draw power bar in 2D
    if (showPowerBar) {
      this.drawPowerBar2D(power, isAimMode, previewPower, isFineAimMode, isUltraFineMode, isSpacebarMode);
    }
  }
  
  drawPowerBar2D(power: number, isAimMode?: boolean, previewPower?: number, isFineAimMode?: boolean, isUltraFineMode?: boolean, isSpacebarMode?: boolean) {
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
    
    // Show preview power in aim mode
    if (isAimMode && previewPower !== undefined) {
      this.uiCtx.textAlign = 'center';
      this.uiCtx.textBaseline = 'middle';
      this.uiCtx.font = 'bold 12px Arial';
      this.uiCtx.fillStyle = '#00ffff'; // Cyan
      this.uiCtx.fillText('Preview:', barX + barWidth / 2, barY - 25);
      this.uiCtx.font = 'bold 14px Arial';
      this.uiCtx.fillStyle = '#ffffff';
      this.uiCtx.fillText(`${previewPower.toFixed(1)}`, barX + barWidth / 2, barY - 8);
      
      // Hint text
      this.uiCtx.font = '10px Arial';
      this.uiCtx.fillStyle = '#aaaaaa';
      this.uiCtx.fillText('Mouse wheel', barX + barWidth / 2, barY + barHeight + 15);
      this.uiCtx.fillText('to adjust', barX + barWidth / 2, barY + barHeight + 28);
    }
  }
  
  drawPrediction(_prediction: PredictionResult) {
    // Prediction is drawn as part of drawTrajectoryLines
  }
  
  drawTrajectoryLines(
    prediction: PredictionResult,
    cueBallPos: { x: number; y: number },
    shotDirection: { x: number; y: number },
    preview?: ShotPreviewPaths
  ) {
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
    
    if (preview) {
      const drawPath = (points: { x: number; y: number }[], strokeStyle: string, arrowFill: string) => {
        if (!points || points.length < 2) return;

        const sampled: { x: number; y: number }[] = [];
        for (let i = 0; i < points.length; i++) {
          if (i === 0 || i === points.length - 1 || i % 2 === 0) {
            sampled.push(points[i]);
          }
        }

        if (sampled.length === 1 && points.length >= 2) {
          sampled.push(points[points.length - 1]);
        }

        if (sampled.length < 2) return;

        this.uiCtx.strokeStyle = strokeStyle;
        this.uiCtx.lineWidth = 2;
        this.uiCtx.setLineDash([10, 10]);

        const first = this.worldToScreen(sampled[0].x, sampled[0].y);
        this.uiCtx.beginPath();
        this.uiCtx.moveTo(first.x, first.y);

        let lastScreen = first;
        for (let i = 1; i < sampled.length; i++) {
          const point = sampled[i];
          const screen = this.worldToScreen(point.x, point.y);
          this.uiCtx.lineTo(screen.x, screen.y);
          lastScreen = screen;
        }

        this.uiCtx.stroke();
        this.uiCtx.setLineDash([]);

        const prevPoint = this.worldToScreen(sampled[sampled.length - 2].x, sampled[sampled.length - 2].y);
        const dx = lastScreen.x - prevPoint.x;
        const dy = lastScreen.y - prevPoint.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len > 0.01) {
          const arrowSize = 10;
          const angle = Math.atan2(dy, dx);

          this.uiCtx.fillStyle = arrowFill;
          this.uiCtx.beginPath();
          this.uiCtx.moveTo(lastScreen.x, lastScreen.y);
          this.uiCtx.lineTo(
            lastScreen.x - arrowSize * Math.cos(angle - Math.PI / 6),
            lastScreen.y - arrowSize * Math.sin(angle - Math.PI / 6)
          );
          this.uiCtx.lineTo(
            lastScreen.x - arrowSize * Math.cos(angle + Math.PI / 6),
            lastScreen.y - arrowSize * Math.sin(angle + Math.PI / 6)
          );
          this.uiCtx.closePath();
          this.uiCtx.fill();
        }
      };

      const trimPathFromContact = (path: { x: number; y: number }[], contact: { x: number; y: number }) => {
        if (!path || path.length === 0) return path;
        let closestIndex = 0;
        let closestDist = Number.MAX_VALUE;
        for (let i = 0; i < path.length; i++) {
          const dx = path[i].x - contact.x;
          const dy = path[i].y - contact.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < closestDist) {
            closestDist = distSq;
            closestIndex = i;
          }
        }

        const trimmed = path.slice(closestIndex);
        if (trimmed.length === 0 || closestDist > 0.25) {
          trimmed.unshift({ x: contact.x, y: contact.y });
        }
        return trimmed;
      };

      let cuePath = trimPathFromContact(preview.cuePath, prediction.contactPoint);
      if (cuePath.length < 2) {
        const fallbackDistance = 6;
        cuePath = [
          { x: prediction.contactPoint.x, y: prediction.contactPoint.y },
          {
            x: prediction.contactPoint.x + shotDirection.x * fallbackDistance,
            y: prediction.contactPoint.y + shotDirection.y * fallbackDistance,
          },
        ];
      }
      if (cuePath.length > 1) {
        const cueStroke = prediction.type === 'rail' ? 'rgba(0, 255, 255, 0.4)' : 'rgba(255, 255, 255, 0.5)';
        const cueArrow = prediction.type === 'rail' ? 'rgba(0, 255, 255, 0.6)' : 'rgba(255, 255, 255, 0.7)';
        drawPath(cuePath, cueStroke, cueArrow);
      }

      if (prediction.type === 'ball' && prediction.hitBall) {
        let objectPath = preview.objectPaths.get(prediction.hitBall.id);
        if (!objectPath || objectPath.length < 2) {
          const fallbackDistance = 12;
          objectPath = [
            { x: prediction.hitBall.x, y: prediction.hitBall.y },
            {
              x: prediction.hitBall.x + prediction.contactNormal.x * fallbackDistance,
              y: prediction.hitBall.y + prediction.contactNormal.y * fallbackDistance,
            },
          ];
        }
        if (objectPath && objectPath.length > 0) {
          drawPath(objectPath, 'rgba(255, 255, 0, 0.6)', 'rgba(255, 255, 0, 0.8)');
        }
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

/**
 * TablePreview - Three.js table rendering for the editor
 * Uses JSON geometry only (no fallback) and real skin images
 */

import * as THREE from 'three';
import { TableGeometry } from '../stores/TableStore';
import { TableSkin } from '../stores/SkinStore';
import { PhysicsJson, jsonLoader } from '../utils/JsonLoader';

export class TablePreview {
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.OrthographicCamera | null = null;
  private animationId: number = 0;

  // Table meshes
  private tableMesh: THREE.Mesh | null = null;  // Full table with skin texture
  private pocketMeshes: THREE.Mesh[] = [];
  private railOutlineMeshes: THREE.Line[] = [];
  private ballMeshes: THREE.Mesh[] = [];

  // Skin texture
  private skinTexture: THREE.Texture | null = null;

  // State
  private showBalls: boolean = true;
  private showMeasurements: boolean = false;
  private zoom: number = 1;
  private panX: number = 0;
  private panY: number = 0;

  // JSON geometry (the only source of truth)
  private physicsJson: PhysicsJson | null = null;
  
  // Skin physical dimensions (calculated from texture size / PPI)
  private skinPhysicalWidth: number = 0;
  private skinPhysicalHeight: number = 0;

  // Geometry offsets (applied on top of JSON)
  private cornerOffsetX: number = 0;
  private cornerOffsetY: number = 0;
  private sideOffsetX: number = 0;
  private sideOffsetY: number = 0;
  // Legacy diagonal outward offsets to better match in-game geometry defaults
  private cornerPocketOutwardOffset: number = -1.0;
  private sidePocketOutwardOffset: number = -1.3;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  async init(): Promise<void> {
    // Set up renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
    });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setClearColor(0x11111b);

    // Set up scene
    this.scene = new THREE.Scene();

    // Set up camera (orthographic top-down)
    const aspect = this.canvas.clientWidth / this.canvas.clientHeight;
    const viewSize = 70; // inches visible vertically
    this.camera = new THREE.OrthographicCamera(
      -viewSize * aspect / 2,
      viewSize * aspect / 2,
      viewSize / 2,
      -viewSize / 2,
      0.1,
      1000
    );
    this.camera.position.set(0, 100, 0);
    this.camera.lookAt(0, 0, 0);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(0, 100, 50);
    this.scene.add(directionalLight);

    // Load JSON geometry
    try {
      this.physicsJson = await jsonLoader.load();
    } catch (err) {
      console.error('Failed to load physics.json - table preview will be limited');
    }

    // Load default skin
    await this.loadDefaultSkin();

    // Build table from JSON
    this.buildTable();
    this.buildBalls();

    // Handle resize
    window.addEventListener('resize', () => this.handleResize());
    this.handleResize();

    // Start render loop
    this.animate();

    // Mouse controls for pan/zoom
    this.setupMouseControls();
  }

  private async loadDefaultSkin(): Promise<void> {
    try {
      const loader = new THREE.TextureLoader();
      this.skinTexture = await loader.loadAsync('/src/assets/tmp/skin.png');
      this.skinTexture.colorSpace = THREE.SRGBColorSpace;
      console.log('✅ Loaded skin texture');
    } catch (err) {
      console.warn('Could not load default skin texture');
    }
  }

  private handleResize(): void {
    if (!this.renderer || !this.camera) return;

    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;

    this.renderer.setSize(width, height, false);

    const aspect = width / height;
    const viewSize = 70 / this.zoom;

    this.camera.left = -viewSize * aspect / 2 + this.panX;
    this.camera.right = viewSize * aspect / 2 + this.panX;
    this.camera.top = viewSize / 2 + this.panY;
    this.camera.bottom = -viewSize / 2 + this.panY;
    this.camera.updateProjectionMatrix();
  }

  private setupMouseControls(): void {
    let isDragging = false;
    let lastX = 0;
    let lastY = 0;

    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      this.zoom = Math.max(0.5, Math.min(5, this.zoom * delta));
      this.handleResize();
    });

    this.canvas.addEventListener('mousedown', (e) => {
      // Left-click, middle-click, or shift+left-click all enable panning
      if (e.button === 0 || e.button === 1) {
        isDragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
        this.canvas.style.cursor = 'grabbing';
        e.preventDefault();
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;

      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;

      const scale = 70 / this.zoom / this.canvas.clientHeight;
      this.panX -= dx * scale;
      this.panY += dy * scale;
      this.handleResize();
    });

    window.addEventListener('mouseup', () => {
      isDragging = false;
      this.canvas.style.cursor = 'default';
    });
  }

  private animate(): void {
    this.animationId = requestAnimationFrame(() => this.animate());

    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  private buildTable(): void {
    if (!this.scene) return;

    // Clear existing meshes
    if (this.tableMesh) this.scene.remove(this.tableMesh);
    this.pocketMeshes.forEach(m => this.scene!.remove(m));
    this.railOutlineMeshes.forEach(m => this.scene!.remove(m));
    this.pocketMeshes = [];
    this.railOutlineMeshes = [];

    // Use JSON geometry if available
    const playWidth = this.physicsJson?.playArea?.width ?? 100;
    const playHeight = this.physicsJson?.playArea?.height ?? 50;
    const halfW = playWidth / 2;
    const halfH = playHeight / 2;

    // Create table plane with skin texture
    // Use skin physical dimensions if available, otherwise estimate from play area + frame
    const tableWidth = this.skinPhysicalWidth > 0 ? this.skinPhysicalWidth : playWidth + 20;
    const tableHeight = this.skinPhysicalHeight > 0 ? this.skinPhysicalHeight : playHeight + 20;
    const tableGeom = new THREE.PlaneGeometry(tableWidth, tableHeight);
    
    let tableMat: THREE.Material;
    if (this.skinTexture) {
      tableMat = new THREE.MeshStandardMaterial({
        map: this.skinTexture,
        roughness: 0.7,
        metalness: 0.0,
      });
    } else {
      // Fallback to green felt if no skin
      tableMat = new THREE.MeshStandardMaterial({
        color: 0x1a5f2a,
        roughness: 0.8,
        metalness: 0.0,
      });
    }

    this.tableMesh = new THREE.Mesh(tableGeom, tableMat);
    this.tableMesh.rotation.x = -Math.PI / 2;
    this.tableMesh.position.y = 0;
    this.scene.add(this.tableMesh);

    // Build pockets from JSON
    if (this.physicsJson?.pockets) {
      this.buildPocketsFromJson();
    }

    // Build rail outlines from JSON
    if (this.physicsJson?.rails) {
      this.buildRailOutlinesFromJson();
    }
  }

  private buildPocketsFromJson(): void {
    if (!this.scene || !this.physicsJson) return;

    const pocketMat = new THREE.MeshStandardMaterial({
      color: 0x111111,
      roughness: 0.9,
      transparent: true,
      opacity: 0.8,
    });

    const halfW = this.physicsJson.playArea.width / 2;

    for (const pocket of this.physicsJson.pockets) {
      // Determine if corner or side pocket
      const isCorner = Math.abs(pocket.center.x) > halfW * 0.25;
      
      // Apply offset based on pocket type
      let offsetX = 0;
      let offsetY = 0;
      
      if (isCorner) {
        // Corner pockets: apply X/Y offsets with sign based on quadrant
        const signX = pocket.center.x > 0 ? 1 : -1;
        const signY = pocket.center.y > 0 ? 1 : -1;
        offsetX = signX * (this.cornerOffsetX + this.cornerPocketOutwardOffset);
        offsetY = signY * (this.cornerOffsetY + this.cornerPocketOutwardOffset);
      } else {
        // Side pockets: apply X/Y offsets with sign based on position
        const signX = pocket.center.x > 0 ? 1 : (pocket.center.x < 0 ? -1 : 0);
        const signY = pocket.center.y > 0 ? 1 : -1;
        offsetX = signX * this.sideOffsetX;
        offsetY = signY * (this.sideOffsetY + this.sidePocketOutwardOffset);
      }

      const pocketGeom = new THREE.CircleGeometry(pocket.radius, 32);
      const pocketMesh = new THREE.Mesh(pocketGeom, pocketMat);
      pocketMesh.rotation.x = -Math.PI / 2;
      // Note: JSON uses Y for vertical, Three.js preview uses Z
      pocketMesh.position.set(
        pocket.center.x + offsetX,
        0.1,
        -(pocket.center.y + offsetY)  // Flip Y to Z
      );
      
      this.scene.add(pocketMesh);
      this.pocketMeshes.push(pocketMesh);

      // Draw pocket outline if available
      if (pocket.outline && pocket.outline.length > 0) {
        const points = pocket.outline.map(p => 
          new THREE.Vector3(p.x + offsetX, 0.15, -(p.y + offsetY))
        );
        points.push(points[0]); // Close the loop

        const outlineGeom = new THREE.BufferGeometry().setFromPoints(points);
        const outlineMat = new THREE.LineBasicMaterial({ color: 0x666666 });
        const outlineLine = new THREE.Line(outlineGeom, outlineMat);
        this.scene.add(outlineLine);
        this.railOutlineMeshes.push(outlineLine);
      }
    }
  }

  private buildRailOutlinesFromJson(): void {
    if (!this.scene || !this.physicsJson) return;

    const railMat = new THREE.LineBasicMaterial({ color: 0x888888, linewidth: 2 });

    for (const rail of this.physicsJson.rails) {
      // Only draw cushion outlines (skip play_area rails as they're just boundaries)
      if (!rail.id.includes('cushion')) continue;
      
      // Draw rail outline if available
      if (rail.outline && rail.outline.length > 0) {
        const points = rail.outline.map(p => 
          new THREE.Vector3(p.x, 0.2, -p.y)  // Flip Y to Z (Three.js Y is up)
        );
        // Close the loop
        if (points.length > 2) {
          points.push(points[0].clone());
        }

        const outlineGeom = new THREE.BufferGeometry().setFromPoints(points);
        const outlineLine = new THREE.Line(outlineGeom, railMat);
        this.scene.add(outlineLine);
        this.railOutlineMeshes.push(outlineLine);
      }
    }
  }

  private buildBalls(): void {
    if (!this.scene) return;

    // Clear existing balls
    this.ballMeshes.forEach(m => this.scene!.remove(m));
    this.ballMeshes = [];

    if (!this.showBalls) return;

    const ballRadius = 1.125; // Standard pool ball radius in inches
    const ballGeom = new THREE.SphereGeometry(ballRadius, 32, 32);

    // Ball colors (simplified)
    const ballColors = [
      0xffffff, // Cue ball
      0xffd700, // 1 - Yellow
      0x0000ff, // 2 - Blue
      0xff0000, // 3 - Red
      0x800080, // 4 - Purple
      0xffa500, // 5 - Orange
      0x008000, // 6 - Green
      0x8b4513, // 7 - Brown
      0x000000, // 8 - Black
    ];

    // Place cue ball
    const cueMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0.1 });
    const cueBall = new THREE.Mesh(ballGeom, cueMat);
    cueBall.position.set(-25, ballRadius, 0);
    this.scene.add(cueBall);
    this.ballMeshes.push(cueBall);

    // Place racked balls (triangle formation)
    const rackX = 25; // Foot spot
    const spacing = ballRadius * 2 + 0.05;
    let ballIndex = 1;

    for (let row = 0; row < 5; row++) {
      for (let col = 0; col <= row; col++) {
        const x = rackX + row * spacing * Math.cos(Math.PI / 6);
        const z = (col - row / 2) * spacing;

        const colorIndex = ballIndex < ballColors.length ? ballIndex : ballIndex % 7 + 1;
        const ballMat = new THREE.MeshStandardMaterial({
          color: ballColors[colorIndex],
          roughness: 0.3,
          metalness: 0.1,
        });

        const ball = new THREE.Mesh(ballGeom, ballMat);
        ball.position.set(x, ballRadius, z);
        this.scene.add(ball);
        this.ballMeshes.push(ball);
        ballIndex++;
      }
    }
  }

  updateGeometry(geometry: Partial<TableGeometry>): void {
    this.buildTable();
  }

  // Corner pocket X/Y offset setters
  setCornerOffsetX(offset: number): void {
    this.cornerOffsetX = offset;
    this.buildTable();
  }

  setCornerOffsetY(offset: number): void {
    this.cornerOffsetY = offset;
    this.buildTable();
  }

  // Side pocket X/Y offset setters
  setSideOffsetX(offset: number): void {
    this.sideOffsetX = offset;
    this.buildTable();
  }

  setSideOffsetY(offset: number): void {
    this.sideOffsetY = offset;
    this.buildTable();
  }

  // Get current offsets for push to game
  getOffsets(): { cornerX: number; cornerY: number; sideX: number; sideY: number } {
    return {
      cornerX: this.cornerOffsetX,
      cornerY: this.cornerOffsetY,
      sideX: this.sideOffsetX,
      sideY: this.sideOffsetY,
    };
  }

  async applySkin(skin: TableSkin): Promise<void> {
    // Load skin image as texture
    if (skin.images.full) {
      const loader = new THREE.TextureLoader();
      this.skinTexture = await loader.loadAsync(skin.images.full);
      this.skinTexture.colorSpace = THREE.SRGBColorSpace;
    }

    if (skin.geometry) {
      if (skin.geometry.cornerOffsetX !== undefined) {
        this.cornerOffsetX = skin.geometry.cornerOffsetX;
      }
      if (skin.geometry.cornerOffsetY !== undefined) {
        this.cornerOffsetY = skin.geometry.cornerOffsetY;
      }
      if (skin.geometry.sideOffsetX !== undefined) {
        this.sideOffsetX = skin.geometry.sideOffsetX;
      }
      if (skin.geometry.sideOffsetY !== undefined) {
        this.sideOffsetY = skin.geometry.sideOffsetY;
      }
    }

    this.buildTable();
  }

  async loadSkinFromUrl(url: string): Promise<void> {
    const loader = new THREE.TextureLoader();
    this.skinTexture = await loader.loadAsync(url);
    this.skinTexture.colorSpace = THREE.SRGBColorSpace;
    this.buildTable();
  }

  async loadSkinFromBase64(base64: string): Promise<void> {
    const loader = new THREE.TextureLoader();
    this.skinTexture = await loader.loadAsync(base64);
    this.skinTexture.colorSpace = THREE.SRGBColorSpace;
    
    // Calculate physical size from texture dimensions and PPI
    const image = this.skinTexture.image;
    if (image && image.width && image.height) {
      const PPI = this.physicsJson?.meta?.pixelsPerInch ?? 7.68;
      this.skinPhysicalWidth = image.width / PPI;
      this.skinPhysicalHeight = image.height / PPI;
    }
    
    this.buildTable();
  }

  zoomIn(): void {
    this.zoom = Math.min(5, this.zoom * 1.2);
    this.handleResize();
  }

  zoomOut(): void {
    this.zoom = Math.max(0.5, this.zoom / 1.2);
    this.handleResize();
  }

  resetView(): void {
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    this.handleResize();
  }

  toggleBalls(show: boolean): void {
    this.showBalls = show;
    this.buildBalls();
  }

  toggleMeasurements(show: boolean): void {
    this.showMeasurements = show;
    // TODO: Add measurement overlay
  }

  rackBalls(): void {
    this.showBalls = true;
    this.buildBalls();
  }

  dispose(): void {
    cancelAnimationFrame(this.animationId);
    this.renderer?.dispose();
  }
}

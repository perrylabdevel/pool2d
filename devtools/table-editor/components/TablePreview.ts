/**
 * TablePreview - Three.js table rendering for the editor
 * Uses JSON geometry only (no fallback) and real skin images
 */

import * as THREE from 'three';
import { TableGeometry } from '../stores/TableStore';
import { TableSkin } from '../stores/SkinStore';
import { PhysicsJson, jsonLoader } from '../utils/JsonLoader';
import { isDerivedPlayAreaRailId } from '../utils/TableGeometryUtils';
import type { GeometryEdit, GeometrySelection } from '../utils/TableGeometryUtils';

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
  private playAreaOutlineMesh: THREE.Line | null = null;
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
  private selection: GeometrySelection | null = null;
  
  // Skin physical dimensions (calculated from texture size / PPI)
  private skinPhysicalWidth: number = 0;
  private skinPhysicalHeight: number = 0;

  // Geometry offsets (applied on top of JSON)
  private cornerOffsetX: number = 0;
  private cornerOffsetY: number = 0;
  private sideOffsetX: number = 0;
  private sideOffsetY: number = 0;
  // Legacy outward offsets (kept for compatibility; editor preview renders raw physicsJson)
  private cornerPocketOutwardOffset: number = 0.0;
  private sidePocketOutwardOffset: number = 0.0;

  // Editing state
  private editingEnabled: boolean = false;

  // Dragging state
  private draggingHandle: {
    selection: GeometrySelection;
    last: { x: number; y: number };
  } | null = null;

  // Handle meshes
  private handleMeshes: THREE.Mesh[] = [];
  private raycaster = new THREE.Raycaster();
  private dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); // y=0 plane
  private planeIntersect = new THREE.Vector3();

  private onEdit: ((edit: GeometryEdit) => void) | null = null;
  private onSelect: ((selection: GeometrySelection | null) => void) | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  setCallbacks(callbacks: {
    onEdit?: (edit: GeometryEdit) => void;
    onSelect?: (selection: GeometrySelection | null) => void;
  }): void {
    this.onEdit = callbacks.onEdit ?? null;
    this.onSelect = callbacks.onSelect ?? null;
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
    if (this.editingEnabled) {
      this.rebuildHandles();
    }

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

  private rebuildHandles(): void {
    if (!this.scene || !this.physicsJson) return;

    // Remove existing handles
    this.handleMeshes.forEach(m => this.scene!.remove(m));
    this.handleMeshes = [];

    const handleMatPocket = new THREE.MeshBasicMaterial({ color: 0x00bcd4 }); // cyan
    const handleMatPocketSelected = new THREE.MeshBasicMaterial({ color: 0x89b4fa }); // blue
    const handleMatRail = new THREE.MeshBasicMaterial({ color: 0xffc107 }); // amber
    const handleMatRailSelected = new THREE.MeshBasicMaterial({ color: 0xb4befe }); // light blue
    const handleMatRailMove = new THREE.MeshBasicMaterial({ color: 0xf38ba8 }); // pink/red
    const handleMatRailMoveSelected = new THREE.MeshBasicMaterial({ color: 0xfae3b0 }); // pale yellow
    const pocketGeom = new THREE.SphereGeometry(0.8, 12, 12);
    const railGeom = new THREE.BoxGeometry(0.8, 0.8, 0.8);

    const sameSelection = (a: GeometrySelection, b: GeometrySelection | null) => {
      if (!b) return false;
      return JSON.stringify(a) === JSON.stringify(b);
    };

    const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
    const isFinitePoint = (p: any): p is { x: number; y: number } => !!p && isFiniteNumber(p.x) && isFiniteNumber(p.y);

    const selectedPocketIndex = (() => {
      if (!this.selection) return null;
      if (this.selection.kind === 'pocket') return this.selection.pocketIndex;
      if (this.selection.kind === 'pocket-outline') return this.selection.pocketIndex;
      if (this.selection.kind === 'pocket-radius') return this.selection.pocketIndex;
      return null;
    })();

    const selectedRailIndex = (() => {
      if (!this.selection) return null;
      if (this.selection.kind === 'rail') return this.selection.railIndex;
      if (this.selection.kind === 'rail-end') return this.selection.railIndex;
      if (this.selection.kind === 'rail-outline') return this.selection.railIndex;
      return null;
    })();

    // Pocket center handles (always visible), plus detail handles only for selected pocket.
    this.physicsJson.pockets.forEach((pocket, pocketIndex) => {
      if (!isFinitePoint(pocket.center) || !isFiniteNumber(pocket.radius)) return;
      const centerSel: GeometrySelection = { kind: 'pocket', pocketIndex };
      const centerMesh = new THREE.Mesh(pocketGeom, sameSelection(centerSel, this.selection) ? handleMatPocketSelected : handleMatPocket);
      centerMesh.position.set(pocket.center.x, 0.4, -pocket.center.y);
      (centerMesh as any).userData = { selection: centerSel };
      this.scene!.add(centerMesh);
      this.handleMeshes.push(centerMesh);

      if (selectedPocketIndex !== pocketIndex) return;

      if (pocket.outline) {
        pocket.outline.forEach((pt, pointIndex) => {
          if (!isFinitePoint(pt)) return;
          const sel: GeometrySelection = { kind: 'pocket-outline', pocketIndex, pointIndex };
          const mesh = new THREE.Mesh(railGeom, sameSelection(sel, this.selection) ? handleMatPocketSelected : handleMatPocket);
          mesh.position.set(pt.x, 0.4, -pt.y);
          (mesh as any).userData = { selection: sel };
          this.scene!.add(mesh);
          this.handleMeshes.push(mesh);
        });
      }

      const radiusSel: GeometrySelection = { kind: 'pocket-radius', pocketIndex };
      const radiusMesh = new THREE.Mesh(railGeom, sameSelection(radiusSel, this.selection) ? handleMatPocketSelected : handleMatPocket);
      radiusMesh.position.set(pocket.center.x + pocket.radius, 0.4, -pocket.center.y);
      (radiusMesh as any).userData = { selection: radiusSel };
      this.scene!.add(radiusMesh);
      this.handleMeshes.push(radiusMesh);
    });

    // Rail midpoint handles (always visible), plus detail handles only for selected rail.
    this.physicsJson.rails.forEach((rail, railIndex) => {
      if (isDerivedPlayAreaRailId(rail.id)) return;
      if (!isFinitePoint(rail.from) || !isFinitePoint(rail.to)) return;
      const midSel: GeometrySelection = { kind: 'rail', railIndex };
      const midMesh = new THREE.Mesh(railGeom, sameSelection(midSel, this.selection) ? handleMatRailMoveSelected : handleMatRailMove);
      midMesh.position.set((rail.from.x + rail.to.x) / 2, 0.4, -((rail.from.y + rail.to.y) / 2));
      (midMesh as any).userData = { selection: midSel };
      this.scene!.add(midMesh);
      this.handleMeshes.push(midMesh);

      if (selectedRailIndex !== railIndex) return;

      const fromSel: GeometrySelection = { kind: 'rail-end', railIndex, endpoint: 'from' };
      const toSel: GeometrySelection = { kind: 'rail-end', railIndex, endpoint: 'to' };

      const fromMesh = new THREE.Mesh(railGeom, sameSelection(fromSel, this.selection) ? handleMatRailSelected : handleMatRail);
      fromMesh.position.set(rail.from.x, 0.4, -rail.from.y);
      (fromMesh as any).userData = { selection: fromSel };
      this.scene!.add(fromMesh);
      this.handleMeshes.push(fromMesh);

      const toMesh = new THREE.Mesh(railGeom, sameSelection(toSel, this.selection) ? handleMatRailSelected : handleMatRail);
      toMesh.position.set(rail.to.x, 0.4, -rail.to.y);
      (toMesh as any).userData = { selection: toSel };
      this.scene!.add(toMesh);
      this.handleMeshes.push(toMesh);

      if (!rail.outline || rail.outline.length === 0) return;
      rail.outline.forEach((pt, pointIndex) => {
        if (!isFinitePoint(pt)) return;
        const sel: GeometrySelection = { kind: 'rail-outline', railIndex, pointIndex };
        const mesh = new THREE.Mesh(railGeom, sameSelection(sel, this.selection) ? handleMatRailSelected : handleMatRail);
        mesh.position.set(pt.x, 0.4, -pt.y);
        (mesh as any).userData = { selection: sel };
        this.scene!.add(mesh);
        this.handleMeshes.push(mesh);
      });
    });
  }

  private pickHandle(clientX: number, clientY: number, getMouseNDC: (x: number, y: number) => { x: number; y: number }) {
    if (!this.camera) return null;
    const ndc = getMouseNDC(clientX, clientY);
    this.raycaster.setFromCamera(ndc, this.camera);
    const intersects = this.raycaster.intersectObjects(this.handleMeshes, false);
    if (intersects.length === 0) return null;

    const selectionPriority = (sel: GeometrySelection | undefined): number => {
      if (!sel) return 99;
      // Prefer rails when overlapping; rail move-handle first.
      if (sel.kind === 'rail') return 0;
      if (sel.kind === 'rail-end') return 1;
      if (sel.kind === 'rail-outline') return 2;
      if (sel.kind === 'pocket') return 3;
      if (sel.kind === 'pocket-radius') return 4;
      if (sel.kind === 'pocket-outline') return 5;
      return 99;
    };

    const best = intersects
      .map((i) => ({ obj: i.object, sel: ((i.object as any).userData || {}).selection as GeometrySelection | undefined }))
      .sort((a, b) => selectionPriority(a.sel) - selectionPriority(b.sel))[0];

    const hit = best.obj;
    const data = (hit as any).userData || {};
    const selection = data.selection as GeometrySelection | undefined;
    if (!selection || !this.physicsJson) return null;

    const getSelectionAnchor = (sel: GeometrySelection): { x: number; y: number } | null => {
      if (!this.physicsJson) return null;
      if (sel.kind === 'pocket') return this.physicsJson.pockets[sel.pocketIndex]?.center ?? null;
      if (sel.kind === 'pocket-outline') return this.physicsJson.pockets[sel.pocketIndex]?.outline?.[sel.pointIndex] ?? null;
      if (sel.kind === 'pocket-radius') {
        const p = this.physicsJson.pockets[sel.pocketIndex];
        if (!p) return null;
        return { x: p.center.x + p.radius, y: p.center.y };
      }
      if (sel.kind === 'rail') {
        const r = this.physicsJson.rails[sel.railIndex];
        if (!r) return null;
        return { x: (r.from.x + r.to.x) / 2, y: (r.from.y + r.to.y) / 2 };
      }
      if (sel.kind === 'rail-end') return this.physicsJson.rails[sel.railIndex]?.[sel.endpoint] ?? null;
      if (sel.kind === 'rail-outline') return this.physicsJson.rails[sel.railIndex]?.outline?.[sel.pointIndex] ?? null;
      return null;
    };

    const anchor = getSelectionAnchor(selection);
    if (!anchor) return null;
    return { selection, last: { x: anchor.x, y: anchor.y } };
  }

  private applyDragUpdate(newX: number, newY: number): void {
    if (!this.physicsJson || !this.draggingHandle) return;

    const sel = this.draggingHandle.selection;

    if (sel.kind === 'pocket') {
      this.onEdit?.({ type: 'move-pocket-center', pocketIndex: sel.pocketIndex, x: newX, y: newY });
      return;
    }

    if (sel.kind === 'pocket-outline') {
      this.onEdit?.({ type: 'move-pocket-outline', pocketIndex: sel.pocketIndex, pointIndex: sel.pointIndex, x: newX, y: newY });
      return;
    }

    if (sel.kind === 'pocket-radius') {
      const pocket = this.physicsJson.pockets[sel.pocketIndex];
      if (!pocket) return;
      const dx = newX - pocket.center.x;
      const dy = newY - pocket.center.y;
      const radius = Math.max(0.25, Math.sqrt(dx * dx + dy * dy));
      this.onEdit?.({ type: 'set-pocket-radius', pocketIndex: sel.pocketIndex, radius, scaleOutline: true });
      return;
    }

    if (sel.kind === 'rail-end') {
      this.onEdit?.({ type: 'move-rail-end', railIndex: sel.railIndex, endpoint: sel.endpoint, x: newX, y: newY });
      return;
    }

    if (sel.kind === 'rail-outline') {
      this.onEdit?.({ type: 'move-rail-outline', railIndex: sel.railIndex, pointIndex: sel.pointIndex, x: newX, y: newY });
      return;
    }

    if (sel.kind === 'rail') {
      const dx = newX - this.draggingHandle.last.x;
      const dy = newY - this.draggingHandle.last.y;
      this.draggingHandle.last = { x: newX, y: newY };
      this.onEdit?.({ type: 'move-rail', railIndex: sel.railIndex, dx, dy });
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
    let isPanning = false;
    let lastX = 0;
    let lastY = 0;

    const getMouseNDC = (clientX: number, clientY: number) => {
      const rect = this.canvas.getBoundingClientRect();
      return {
        x: ((clientX - rect.left) / rect.width) * 2 - 1,
        y: -((clientY - rect.top) / rect.height) * 2 + 1,
      };
    };

    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      this.zoom = Math.max(0.5, Math.min(5, this.zoom * delta));
      this.handleResize();
    });

    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0 && this.editingEnabled) {
        // Try to pick a handle first
        const hit = this.pickHandle(e.clientX, e.clientY, getMouseNDC);
        if (hit) {
          this.draggingHandle = hit;
          this.selection = hit.selection;
          this.onSelect?.(this.selection);
          this.rebuildHandles();
          this.canvas.style.cursor = 'grabbing';
          e.preventDefault();
          return;
        }
      }

      // Fall back to panning
      if (e.button === 0 || e.button === 1) {
        isPanning = true;
        lastX = e.clientX;
        lastY = e.clientY;
        this.canvas.style.cursor = 'grabbing';
        e.preventDefault();
      }
    });

    window.addEventListener('mousemove', (e) => {
      // Dragging a handle?
      if (this.draggingHandle && this.camera) {
        const ndc = getMouseNDC(e.clientX, e.clientY);
        this.raycaster.setFromCamera(ndc, this.camera);
        if (this.raycaster.ray.intersectPlane(this.dragPlane, this.planeIntersect)) {
          const newX = this.planeIntersect.x;
          const newY = -this.planeIntersect.z; // flip back to JSON Y
          this.applyDragUpdate(newX, newY);
        }
        return;
      }

      if (!isPanning) return;

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
      this.draggingHandle = null;
      isPanning = false;
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
    if (this.playAreaOutlineMesh) this.scene.remove(this.playAreaOutlineMesh);
    this.handleMeshes.forEach(m => this.scene!.remove(m));
    this.pocketMeshes = [];
    this.railOutlineMeshes = [];
    this.playAreaOutlineMesh = null;
    this.handleMeshes = [];

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

    // Derived play area outline (toggle via Measurements)
    if (this.showMeasurements) {
      this.buildPlayAreaOutline();
    }

    // Rebuild handles if editing
    if (this.editingEnabled) {
      this.rebuildHandles();
    }
  }

  private buildPocketsFromJson(): void {
    if (!this.scene || !this.physicsJson) return;

    const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
    const isFinitePoint = (p: any): p is { x: number; y: number } => !!p && isFiniteNumber(p.x) && isFiniteNumber(p.y);

    const pocketMat = new THREE.MeshStandardMaterial({
      color: 0x111111,
      roughness: 0.9,
      transparent: true,
      opacity: 0.8,
    });

    for (const pocket of this.physicsJson.pockets) {
      if (!isFinitePoint(pocket.center) || !isFiniteNumber(pocket.radius)) continue;
      // Editor preview renders raw physicsJson (no additional offsets)
      const offsetX = 0;
      const offsetY = 0;

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
        const points = pocket.outline
          .filter((p) => isFinitePoint(p))
          .map((p) => new THREE.Vector3(p.x + offsetX, 0.15, -(p.y + offsetY)));
        if (points.length < 2) continue;
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

    const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
    const isFinitePoint = (p: any): p is { x: number; y: number } => !!p && isFiniteNumber(p.x) && isFiniteNumber(p.y);

    const railMat = new THREE.LineBasicMaterial({ color: 0x888888, linewidth: 2 });

    for (const rail of this.physicsJson.rails) {
      if (isDerivedPlayAreaRailId(rail.id)) continue;
      if (rail.outline && rail.outline.length > 0) {
        const points = rail.outline
          .filter((p) => isFinitePoint(p))
          .map((p) => new THREE.Vector3(p.x, 0.2, -p.y)); // Flip Y to Z (Three.js Y is up)
        if (points.length < 2) {
          // Outline is present but invalid/degenerate; fall back to from->to so the rail stays visible/editable.
          if (!isFinitePoint(rail.from) || !isFinitePoint(rail.to)) continue;
          const fallback = [
            new THREE.Vector3(rail.from.x, 0.2, -rail.from.y),
            new THREE.Vector3(rail.to.x, 0.2, -rail.to.y),
          ];
          const outlineGeom = new THREE.BufferGeometry().setFromPoints(fallback);
          const outlineLine = new THREE.Line(outlineGeom, railMat);
          this.scene.add(outlineLine);
          this.railOutlineMeshes.push(outlineLine);
          continue;
        }
        // Close the loop
        if (points.length > 2) {
          points.push(points[0].clone());
        }

        const outlineGeom = new THREE.BufferGeometry().setFromPoints(points);
        const outlineLine = new THREE.Line(outlineGeom, railMat);
        this.scene.add(outlineLine);
        this.railOutlineMeshes.push(outlineLine);
      } else {
        if (!isFinitePoint(rail.from) || !isFinitePoint(rail.to)) continue;
        const points = [
          new THREE.Vector3(rail.from.x, 0.2, -rail.from.y),
          new THREE.Vector3(rail.to.x, 0.2, -rail.to.y),
        ];
        const outlineGeom = new THREE.BufferGeometry().setFromPoints(points);
        const outlineLine = new THREE.Line(outlineGeom, railMat);
        this.scene.add(outlineLine);
        this.railOutlineMeshes.push(outlineLine);
      }
    }
  }

  private buildPlayAreaOutline(): void {
    if (!this.scene || !this.physicsJson) return;
    const playWidth = this.physicsJson?.playArea?.width ?? 100;
    const playHeight = this.physicsJson?.playArea?.height ?? 50;
    const halfW = playWidth / 2;
    const halfH = playHeight / 2;

    const points = [
      new THREE.Vector3(-halfW, 0.25, -halfH),
      new THREE.Vector3(halfW, 0.25, -halfH),
      new THREE.Vector3(halfW, 0.25, halfH),
      new THREE.Vector3(-halfW, 0.25, halfH),
      new THREE.Vector3(-halfW, 0.25, -halfH),
    ];
    const geom = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({ color: 0x45475a });
    this.playAreaOutlineMesh = new THREE.Line(geom, mat);
    this.scene.add(this.playAreaOutlineMesh);
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

  setEditingEnabled(enabled: boolean): void {
    this.editingEnabled = enabled;
    this.rebuildHandles();
  }

  setSelection(selection: GeometrySelection | null): void {
    this.selection = selection;
    if (this.editingEnabled) this.rebuildHandles();
  }

  setPhysicsJson(json: PhysicsJson): void {
    this.physicsJson = json;
    this.buildTable();
    if (this.editingEnabled) this.rebuildHandles();
  }

  toggleBalls(show: boolean): void {
    this.showBalls = show;
    this.buildBalls();
  }

  toggleMeasurements(show: boolean): void {
    this.showMeasurements = show;
    this.buildTable();
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

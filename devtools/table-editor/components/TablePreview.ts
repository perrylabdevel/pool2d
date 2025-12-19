/**
 * TablePreview - Three.js table rendering for the editor
 * Uses JSON geometry only (no fallback) and real skin images
 */

import * as THREE from 'three';
import { TableSkin } from '../stores/SkinStore';
import { PhysicsJson, jsonLoader } from '../utils/JsonLoader';
import { isDerivedPlayAreaRailId } from '../utils/TableGeometryUtils';
import type { GeometryEdit, GeometrySelection } from '../utils/TableGeometryUtils';
import { DEFAULT_EDITOR_ASSIST_SETTINGS, type EditorAssistSettings } from '../utils/EditorAssistSettings';
import { getCollisionRails, type DerivedRail } from '../utils/CollisionDerivation';

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
  private measurementMeshes: THREE.Object3D[] = [];
  private ballMeshes: THREE.Mesh[] = [];
  private gridMinorMesh: THREE.LineSegments | null = null;
  private gridMajorMesh: THREE.LineSegments | null = null;

  // Skin texture
  private skinTexture: THREE.Texture | null = null;

  // State
  private showBalls: boolean = true;
  private showMeasurements: boolean = false;
  private showCollisionOverlay: boolean = false;

  // Collision overlay meshes
  private collisionOverlayMeshes: THREE.Object3D[] = [];
  private zoom: number = 1;
  private panX: number = 0;
  private panY: number = 0;
  private assistSettings: EditorAssistSettings = structuredClone(DEFAULT_EDITOR_ASSIST_SETTINGS);

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
    start: { x: number; y: number };
    axisLock: 'x' | 'y' | null;
    railStartMid?: { x: number; y: number };
    railLastApplied?: { dx: number; dy: number };
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

  setAssistSettings(settings: EditorAssistSettings): void {
    this.assistSettings = structuredClone(settings);
    this.updateGrid();
    if (this.editingEnabled) this.rebuildHandles();
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
    const handleMatPocketRadius = new THREE.MeshBasicMaterial({ color: 0xa6e3a1 }); // green
    const handleMatPocketRadiusSelected = new THREE.MeshBasicMaterial({ color: 0xf9e2af }); // yellow
    const handleMatRail = new THREE.MeshBasicMaterial({ color: 0xffc107 }); // amber
    const handleMatRailSelected = new THREE.MeshBasicMaterial({ color: 0xb4befe }); // light blue
    const handleMatRailMove = new THREE.MeshBasicMaterial({ color: 0xf38ba8 }); // pink/red
    const handleMatRailMoveSelected = new THREE.MeshBasicMaterial({ color: 0xfae3b0 }); // pale yellow
    const pocketGeom = new THREE.SphereGeometry(0.8, 12, 12);
    const railGeom = new THREE.BoxGeometry(0.8, 0.8, 0.8);
    const radiusGeom = new THREE.BoxGeometry(1.2, 1.2, 1.2);

    const handleScale = (() => {
      // Ortho zoom makes handles visually larger as you zoom in; damp that and make them smaller at high zoom.
      const s = 0.95 * Math.pow(this.zoom, -1.15);
      return Math.max(0.12, Math.min(1.1, s));
    })();

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
      centerMesh.scale.setScalar(handleScale);
      (centerMesh as any).userData = { selection: centerSel };
      this.scene!.add(centerMesh);
      this.handleMeshes.push(centerMesh);

      if (selectedPocketIndex !== pocketIndex) return;

      const radiusSel: GeometrySelection = { kind: 'pocket-radius', pocketIndex };
      const radiusPos = { x: pocket.center.x + pocket.radius, y: pocket.center.y };

      // Avoid a confusing overlap: many outlines include a point exactly at (center.x + radius, center.y).
      // Skip the nearest outline handle to the radius handle so dragging scales the whole pocket reliably.
      let skipOutlineIndex: number | null = null;
      if (pocket.outline && pocket.outline.length) {
        let best: { i: number; d: number } | null = null;
        for (let i = 0; i < pocket.outline.length; i++) {
          const pt = pocket.outline[i];
          if (!isFinitePoint(pt)) continue;
          const dx = pt.x - radiusPos.x;
          const dy = pt.y - radiusPos.y;
          const d = dx * dx + dy * dy;
          if (!best || d < best.d) best = { i, d };
        }
        if (best && best.d <= 1e-6) skipOutlineIndex = best.i;
      }

      if (pocket.outline) {
        pocket.outline.forEach((pt, pointIndex) => {
          if (!isFinitePoint(pt)) return;
          if (skipOutlineIndex === pointIndex) return;
          const sel: GeometrySelection = { kind: 'pocket-outline', pocketIndex, pointIndex };
          const mesh = new THREE.Mesh(railGeom, sameSelection(sel, this.selection) ? handleMatPocketSelected : handleMatPocket);
          mesh.position.set(pt.x, 0.4, -pt.y);
          mesh.scale.setScalar(handleScale);
          (mesh as any).userData = { selection: sel };
          this.scene!.add(mesh);
          this.handleMeshes.push(mesh);
        });
      }

      const radiusMesh = new THREE.Mesh(
        radiusGeom,
        sameSelection(radiusSel, this.selection) ? handleMatPocketRadiusSelected : handleMatPocketRadius
      );
      radiusMesh.position.set(radiusPos.x, 0.4, -radiusPos.y);
      radiusMesh.scale.setScalar(handleScale);
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
      midMesh.scale.setScalar(handleScale);
      (midMesh as any).userData = { selection: midSel };
      this.scene!.add(midMesh);
      this.handleMeshes.push(midMesh);

      if (selectedRailIndex !== railIndex) return;

      const fromSel: GeometrySelection = { kind: 'rail-end', railIndex, endpoint: 'from' };
      const toSel: GeometrySelection = { kind: 'rail-end', railIndex, endpoint: 'to' };

      const fromMesh = new THREE.Mesh(railGeom, sameSelection(fromSel, this.selection) ? handleMatRailSelected : handleMatRail);
      fromMesh.position.set(rail.from.x, 0.4, -rail.from.y);
      fromMesh.scale.setScalar(handleScale);
      (fromMesh as any).userData = { selection: fromSel };
      this.scene!.add(fromMesh);
      this.handleMeshes.push(fromMesh);

      const toMesh = new THREE.Mesh(railGeom, sameSelection(toSel, this.selection) ? handleMatRailSelected : handleMatRail);
      toMesh.position.set(rail.to.x, 0.4, -rail.to.y);
      toMesh.scale.setScalar(handleScale);
      (toMesh as any).userData = { selection: toSel };
      this.scene!.add(toMesh);
      this.handleMeshes.push(toMesh);

      if (!rail.outline || rail.outline.length === 0) return;
      rail.outline.forEach((pt, pointIndex) => {
        if (!isFinitePoint(pt)) return;
        const sel: GeometrySelection = { kind: 'rail-outline', railIndex, pointIndex };
        const mesh = new THREE.Mesh(railGeom, sameSelection(sel, this.selection) ? handleMatRailSelected : handleMatRail);
        mesh.position.set(pt.x, 0.4, -pt.y);
        mesh.scale.setScalar(handleScale);
        (mesh as any).userData = { selection: sel };
        this.scene!.add(mesh);
        this.handleMeshes.push(mesh);
      });
    });
  }

  private pickHandle(
    clientX: number,
    clientY: number,
    getMouseNDC: (x: number, y: number) => { x: number; y: number }
  ): {
    selection: GeometrySelection;
    last: { x: number; y: number };
    start: { x: number; y: number };
    axisLock: 'x' | 'y' | null;
    railStartMid?: { x: number; y: number };
    railLastApplied?: { dx: number; dy: number };
  } | null {
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
      if (sel.kind === 'pocket-outline') return 6;
      return 99;
    };

    const best = intersects
      .map((i) => ({ obj: i.object, sel: ((i.object as any).userData || {}).selection as GeometrySelection | undefined }))
      .sort((a, b) => selectionPriority(a.sel) - selectionPriority(b.sel))[0];

    const hitObj = best.obj;
    const data = (hitObj as any).userData || {};
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
    const dragHit: {
      selection: GeometrySelection;
      last: { x: number; y: number };
      start: { x: number; y: number };
      axisLock: 'x' | 'y' | null;
      railStartMid?: { x: number; y: number };
      railLastApplied?: { dx: number; dy: number };
    } = { selection, last: { x: anchor.x, y: anchor.y }, start: { x: anchor.x, y: anchor.y }, axisLock: null };

    if (selection.kind === 'rail') {
      dragHit.railStartMid = { x: anchor.x, y: anchor.y };
      dragHit.railLastApplied = { dx: 0, dy: 0 };
    }

    return dragHit;
  }

  private getSnapToleranceWorld(): number {
    if (!this.camera) return 0;
    const viewH = Math.abs(this.camera.top - this.camera.bottom);
    const worldPerPx = viewH / Math.max(1, this.canvas.clientHeight);
    return worldPerPx * this.assistSettings.snapTolerancePx;
  }

  private snapAxis(v: number, candidates: number[], tolerance: number): number {
    let best: { d: number; v: number } | null = null;
    for (const c of candidates) {
      const d = Math.abs(v - c);
      if (d > tolerance) continue;
      if (!best || d < best.d) best = { d, v: c };
    }
    return best ? best.v : v;
  }

  private getAlignmentCandidates(exclude?: GeometrySelection): { xs: number[]; ys: number[] } {
    const xs: number[] = [];
    const ys: number[] = [];
    if (!this.physicsJson) return { xs, ys };

    const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
    const pushPoint = (p: any) => {
      if (!p || !isFiniteNumber(p.x) || !isFiniteNumber(p.y)) return;
      xs.push(p.x);
      ys.push(p.y);
    };

    for (let i = 0; i < this.physicsJson.pockets.length; i++) {
      const p = this.physicsJson.pockets[i];
      pushPoint(p.center);
      if (Array.isArray(p.outline)) {
        for (let j = 0; j < p.outline.length; j++) {
          if (exclude?.kind === 'pocket-outline' && exclude.pocketIndex === i && exclude.pointIndex === j) continue;
          pushPoint(p.outline[j]);
        }
      }
    }

    for (let i = 0; i < this.physicsJson.rails.length; i++) {
      const r = this.physicsJson.rails[i];
      if (isDerivedPlayAreaRailId(r.id)) continue;
      if (!(exclude?.kind === 'rail-end' && exclude.railIndex === i && exclude.endpoint === 'from')) pushPoint(r.from);
      if (!(exclude?.kind === 'rail-end' && exclude.railIndex === i && exclude.endpoint === 'to')) pushPoint(r.to);
      if (Array.isArray(r.outline)) {
        for (let j = 0; j < r.outline.length; j++) {
          if (exclude?.kind === 'rail-outline' && exclude.railIndex === i && exclude.pointIndex === j) continue;
          pushPoint(r.outline[j]);
        }
      }
    }

    return { xs, ys };
  }

  private applyAssistToPoint(
    input: { x: number; y: number },
    modifiers: { shiftKey: boolean; altKey: boolean },
    sel: GeometrySelection
  ): { x: number; y: number } {
    let x = input.x;
    let y = input.y;

    if (this.draggingHandle?.start && modifiers.shiftKey) {
      if (!this.draggingHandle.axisLock) {
        const dx = x - this.draggingHandle.start.x;
        const dy = y - this.draggingHandle.start.y;
        this.draggingHandle.axisLock = Math.abs(dx) >= Math.abs(dy) ? 'y' : 'x';
      }
      if (this.draggingHandle.axisLock === 'x') x = this.draggingHandle.start.x;
      if (this.draggingHandle.axisLock === 'y') y = this.draggingHandle.start.y;
    } else if (this.draggingHandle) {
      this.draggingHandle.axisLock = null;
    }

    if (!this.assistSettings.snapEnabled || modifiers.altKey) return { x, y };

    const tol = this.getSnapToleranceWorld();
    const halfW = (this.physicsJson?.playArea?.width ?? 100) / 2;
    const halfH = (this.physicsJson?.playArea?.height ?? 50) / 2;

    if (this.assistSettings.snapToGrid) {
      const s = this.assistSettings.gridSpacingIn;
      const gx = Math.round(x / s) * s;
      const gy = Math.round(y / s) * s;
      if (Math.abs(gx - x) <= tol) x = gx;
      if (Math.abs(gy - y) <= tol) y = gy;
    }

    const candidates = this.assistSettings.snapToAlign ? this.getAlignmentCandidates(sel) : { xs: [], ys: [] };

    if (this.assistSettings.snapToPlayArea) {
      candidates.xs.push(-halfW, 0, halfW);
      candidates.ys.push(-halfH, 0, halfH);
    }

    x = this.snapAxis(x, candidates.xs, tol);
    y = this.snapAxis(y, candidates.ys, tol);

    return { x, y };
  }

  private applyDragUpdate(newX: number, newY: number, modifiers: { shiftKey: boolean; altKey: boolean }): void {
    if (!this.physicsJson || !this.draggingHandle) return;

    const sel = this.draggingHandle.selection;

    if (sel.kind === 'pocket') {
      const p = this.applyAssistToPoint({ x: newX, y: newY }, modifiers, sel);
      this.onEdit?.({ type: 'move-pocket-center', pocketIndex: sel.pocketIndex, x: p.x, y: p.y });
      return;
    }

    if (sel.kind === 'pocket-outline') {
      const p = this.applyAssistToPoint({ x: newX, y: newY }, modifiers, sel);
      this.onEdit?.({ type: 'move-pocket-outline', pocketIndex: sel.pocketIndex, pointIndex: sel.pointIndex, x: p.x, y: p.y });
      return;
    }

    if (sel.kind === 'pocket-radius') {
      const pocket = this.physicsJson.pockets[sel.pocketIndex];
      if (!pocket) return;
      const p = this.applyAssistToPoint({ x: newX, y: newY }, modifiers, sel);
      const dx = p.x - pocket.center.x;
      const dy = p.y - pocket.center.y;
      const radius = Math.max(0.25, Math.sqrt(dx * dx + dy * dy));
      this.onEdit?.({ type: 'set-pocket-radius', pocketIndex: sel.pocketIndex, radius, scaleOutline: true });
      return;
    }

    if (sel.kind === 'rail-end') {
      const p = this.applyAssistToPoint({ x: newX, y: newY }, modifiers, sel);
      this.onEdit?.({ type: 'move-rail-end', railIndex: sel.railIndex, endpoint: sel.endpoint, x: p.x, y: p.y });
      return;
    }

    if (sel.kind === 'rail-outline') {
      const p = this.applyAssistToPoint({ x: newX, y: newY }, modifiers, sel);
      this.onEdit?.({ type: 'move-rail-outline', railIndex: sel.railIndex, pointIndex: sel.pointIndex, x: p.x, y: p.y });
      return;
    }

    if (sel.kind === 'rail') {
      const start = this.draggingHandle.start;
      const railStartMid = this.draggingHandle.railStartMid ?? start;
      const lastApplied = this.draggingHandle.railLastApplied ?? { dx: 0, dy: 0 };

      let totalDx = newX - start.x;
      let totalDy = newY - start.y;

      if (modifiers.shiftKey) {
        if (!this.draggingHandle.axisLock) {
          this.draggingHandle.axisLock = Math.abs(totalDx) >= Math.abs(totalDy) ? 'y' : 'x';
        }
        if (this.draggingHandle.axisLock === 'x') totalDx = 0;
        if (this.draggingHandle.axisLock === 'y') totalDy = 0;
      } else {
        this.draggingHandle.axisLock = null;
      }

      const mid = this.applyAssistToPoint({ x: railStartMid.x + totalDx, y: railStartMid.y + totalDy }, modifiers, sel);
      const snappedTotalDx = mid.x - railStartMid.x;
      const snappedTotalDy = mid.y - railStartMid.y;

      const dx = snappedTotalDx - lastApplied.dx;
      const dy = snappedTotalDy - lastApplied.dy;
      this.draggingHandle.railLastApplied = { dx: snappedTotalDx, dy: snappedTotalDy };

      if (dx !== 0 || dy !== 0) this.onEdit?.({ type: 'move-rail', railIndex: sel.railIndex, dx, dy });
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
      if (this.editingEnabled) this.rebuildHandles();
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
          this.applyDragUpdate(newX, newY, { shiftKey: e.shiftKey, altKey: e.altKey });
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
    this.measurementMeshes.forEach((m) => this.scene!.remove(m));
    this.handleMeshes.forEach(m => this.scene!.remove(m));
    if (this.gridMinorMesh) this.scene.remove(this.gridMinorMesh);
    if (this.gridMajorMesh) this.scene.remove(this.gridMajorMesh);
    this.pocketMeshes = [];
    this.railOutlineMeshes = [];
    this.playAreaOutlineMesh = null;
    this.measurementMeshes = [];
    this.handleMeshes = [];
    this.gridMinorMesh = null;
    this.gridMajorMesh = null;

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

    // Configurable grid overlay (assist feature)
    this.updateGrid();

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

    const makeLabelSprite = (text: string) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      const fontSize = 28;
      const pad = 10;
      ctx.font = `${fontSize}px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial`;
      const metrics = ctx.measureText(text);

      canvas.width = Math.ceil(metrics.width + pad * 2);
      canvas.height = fontSize + pad * 2;

      const ctx2 = canvas.getContext('2d');
      if (!ctx2) return null;
      ctx2.font = ctx.font;
      ctx2.fillStyle = 'rgba(17, 17, 27, 0.7)';
      ctx2.fillRect(0, 0, canvas.width, canvas.height);
      ctx2.fillStyle = 'rgba(205, 214, 244, 0.95)';
      ctx2.textBaseline = 'middle';
      ctx2.fillText(text, pad, canvas.height / 2);

      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false });
      const sprite = new THREE.Sprite(mat);

      const worldH = 2.2;
      const worldW = worldH * (canvas.width / canvas.height);
      sprite.scale.set(worldW, worldH, 1);
      return sprite;
    };

    const wLabel = makeLabelSprite(`W ${playWidth.toFixed(2)} in`);
    if (wLabel) {
      wLabel.position.set(0, 0.35, -(halfH + 2.2));
      this.scene.add(wLabel);
      this.measurementMeshes.push(wLabel);
    }

    const hLabel = makeLabelSprite(`H ${playHeight.toFixed(2)} in`);
    if (hLabel) {
      hLabel.position.set(halfW + 3.5, 0.35, 0);
      this.scene.add(hLabel);
      this.measurementMeshes.push(hLabel);
    }
  }

  private updateGrid(): void {
    if (!this.scene || !this.physicsJson) return;

    if (!this.assistSettings.gridEnabled) {
      if (this.gridMinorMesh) this.scene.remove(this.gridMinorMesh);
      if (this.gridMajorMesh) this.scene.remove(this.gridMajorMesh);
      this.gridMinorMesh = null;
      this.gridMajorMesh = null;
      return;
    }

    const playWidth = this.physicsJson?.playArea?.width ?? 100;
    const playHeight = this.physicsJson?.playArea?.height ?? 50;
    const halfW = playWidth / 2;
    const halfH = playHeight / 2;

    const spacing = this.assistSettings.gridSpacingIn;
    const majorEvery = Math.max(1, Math.round(this.assistSettings.gridMajorEvery));

    const minor: number[] = [];
    const major: number[] = [];

    const pushLine = (arr: number[], ax: number, ay: number, bx: number, by: number) => {
      arr.push(ax, 0.16, -ay, bx, 0.16, -by);
    };

    const minX = -halfW;
    const maxX = halfW;
    const minY = -halfH;
    const maxY = halfH;

    const stepsX = Math.floor((maxX - minX) / spacing);
    const stepsY = Math.floor((maxY - minY) / spacing);

    for (let i = 0; i <= stepsX; i++) {
      const x = minX + i * spacing;
      const isMajor = i % majorEvery === 0;
      pushLine(isMajor ? major : minor, x, minY, x, maxY);
    }

    for (let i = 0; i <= stepsY; i++) {
      const y = minY + i * spacing;
      const isMajor = i % majorEvery === 0;
      pushLine(isMajor ? major : minor, minX, y, maxX, y);
    }

    const build = (positions: number[], color: number, opacity: number) => {
      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthTest: false, depthWrite: false });
      return new THREE.LineSegments(geom, mat);
    };

    if (this.gridMinorMesh) this.scene.remove(this.gridMinorMesh);
    if (this.gridMajorMesh) this.scene.remove(this.gridMajorMesh);

    this.gridMinorMesh = build(minor, 0xffff00, 0.28);
    this.gridMajorMesh = build(major, 0xffd700, 0.48);
    this.scene.add(this.gridMinorMesh);
    this.scene.add(this.gridMajorMesh);
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

  /**
   * Build the collision overlay showing game-derived geometry:
   * - Play area rails (boundary used for collision)
   * - Pocket capture zones (may differ from visual radius)
   * - Normal vectors for rails
   */
  private buildCollisionOverlay(): void {
    console.log('[CollisionOverlay] buildCollisionOverlay called, showCollisionOverlay:', this.showCollisionOverlay);
    if (!this.scene) return;

    // Clear existing collision overlay meshes
    this.collisionOverlayMeshes.forEach((m) => {
      this.scene!.remove(m);
      if (m instanceof THREE.Line || m instanceof THREE.LineSegments) {
        m.geometry?.dispose();
        if (m.material instanceof THREE.Material) m.material.dispose();
      }
    });
    this.collisionOverlayMeshes = [];

    if (!this.showCollisionOverlay || !this.physicsJson) return;

    const json = this.physicsJson;
    const OVERLAY_Z = 0.15; // Slightly above table surface

    // Colors for collision overlay
    const COLLISION_RAIL_COLOR = 0xcc0000; // Deep red for all collision rails
    const CAPTURE_ZONE_COLOR = 0xff6600;   // Orange for pocket capture zones
    const NORMAL_VECTOR_COLOR = 0x00ffff;  // Cyan for normal vectors

    // Get all collision rails using the same derivation logic as the game
    // This includes play_area rails AND derived jaw rails from cushion outlines
    const collisionRails = getCollisionRails(json);
    console.log('[CollisionOverlay] Drawing', collisionRails.length, 'collision rails:', collisionRails.map(r => r.id));

    // 1. Draw collision rails (all in unified deep red) as thick tube meshes
    const RAIL_THICKNESS = 0.3; // inches - visible thickness
    for (const rail of collisionRails) {
      // Create a tube/cylinder mesh for reliable thickness (WebGL linewidth is unreliable)
      const start = new THREE.Vector3(rail.from.x, OVERLAY_Z, -rail.from.y);
      const end = new THREE.Vector3(rail.to.x, OVERLAY_Z, -rail.to.y);
      const direction = new THREE.Vector3().subVectors(end, start);
      const length = direction.length();
      if (length < 0.001) continue;

      // Create cylinder geometry along the rail
      const cylGeom = new THREE.CylinderGeometry(RAIL_THICKNESS, RAIL_THICKNESS, length, 8, 1);
      const cylMat = new THREE.MeshBasicMaterial({
        color: COLLISION_RAIL_COLOR,
        transparent: true,
        opacity: 0.9,
      });
      const cylinder = new THREE.Mesh(cylGeom, cylMat);

      // Position at midpoint and rotate to align with rail direction
      const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
      cylinder.position.copy(midpoint);

      // Rotate cylinder to point along rail (cylinder is Y-axis aligned by default)
      const axis = new THREE.Vector3(0, 1, 0);
      const quaternion = new THREE.Quaternion().setFromUnitVectors(axis, direction.normalize());
      cylinder.quaternion.copy(quaternion);

      this.scene.add(cylinder);
      this.collisionOverlayMeshes.push(cylinder);

      // Draw normal vector at midpoint
      const midX = (rail.from.x + rail.to.x) / 2;
      const midY = (rail.from.y + rail.to.y) / 2;
      const normalLen = 2; // inches
      const normalPoints = [
        new THREE.Vector3(midX, OVERLAY_Z + 0.01, -midY),
        new THREE.Vector3(
          midX + rail.normal.x * normalLen,
          OVERLAY_Z + 0.01,
          -(midY + rail.normal.y * normalLen)
        ),
      ];
      const normalGeom = new THREE.BufferGeometry().setFromPoints(normalPoints);
      const normalMat = new THREE.LineBasicMaterial({
        color: NORMAL_VECTOR_COLOR,
        linewidth: 2,
      });
      const normalLine = new THREE.Line(normalGeom, normalMat);
      this.scene.add(normalLine);
      this.collisionOverlayMeshes.push(normalLine);
    }

    // 2. Draw pocket capture zones (circles showing actual capture radius)
    // Note: captureRadius may differ from visual radius
    const captureRadiusCorner = 2.8; // Default, should come from config
    const captureRadiusSide = 3.3;   // Default, should come from config

    for (const pocket of json.pockets) {
      const isCorner = Math.abs(pocket.center.x) > (json.playArea.width / 4);
      const captureRadius = (pocket as any).captureRadius ??
        (isCorner ? captureRadiusCorner : captureRadiusSide);

      // Draw capture zone circle
      const circlePoints: THREE.Vector3[] = [];
      const segments = 32;
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        circlePoints.push(new THREE.Vector3(
          pocket.center.x + Math.cos(theta) * captureRadius,
          OVERLAY_Z + 0.02,
          -(pocket.center.y + Math.sin(theta) * captureRadius)
        ));
      }
      const circleGeom = new THREE.BufferGeometry().setFromPoints(circlePoints);
      const circleMat = new THREE.LineBasicMaterial({
        color: CAPTURE_ZONE_COLOR,
        linewidth: 2,
        transparent: true,
        opacity: 0.8,
      });
      const circle = new THREE.Line(circleGeom, circleMat);
      this.scene.add(circle);
      this.collisionOverlayMeshes.push(circle);

      // Draw visual radius for comparison (if different from capture)
      if (Math.abs(pocket.radius - captureRadius) > 0.01) {
        const visualPoints: THREE.Vector3[] = [];
        for (let i = 0; i <= segments; i++) {
          const theta = (i / segments) * Math.PI * 2;
          visualPoints.push(new THREE.Vector3(
            pocket.center.x + Math.cos(theta) * pocket.radius,
            OVERLAY_Z + 0.01,
            -(pocket.center.y + Math.sin(theta) * pocket.radius)
          ));
        }
        const visualGeom = new THREE.BufferGeometry().setFromPoints(visualPoints);
        const visualMat = new THREE.LineBasicMaterial({
          color: 0xff00ff, // Magenta for visual radius
          linewidth: 1,
          transparent: true,
          opacity: 0.5,
        });
        const visualCircle = new THREE.Line(visualGeom, visualMat);
        this.scene.add(visualCircle);
        this.collisionOverlayMeshes.push(visualCircle);
      }
    }
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
      console.log(`[TablePreview] Skin loaded: ${image.width}x${image.height}px, PPI=${PPI}, Physical=${this.skinPhysicalWidth.toFixed(2)}x${this.skinPhysicalHeight.toFixed(2)}in`);
    }

    this.buildTable();
  }

  zoomIn(): void {
    this.zoom = Math.min(5, this.zoom * 1.2);
    this.handleResize();
    if (this.editingEnabled) this.rebuildHandles();
  }

  zoomOut(): void {
    this.zoom = Math.max(0.5, this.zoom / 1.2);
    this.handleResize();
    if (this.editingEnabled) this.rebuildHandles();
  }

  resetView(): void {
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    this.handleResize();
    if (this.editingEnabled) this.rebuildHandles();
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

    // Recalculate skin physical dimensions when PPI changes
    if (this.skinTexture?.image) {
      const image = this.skinTexture.image;
      if (image.width && image.height) {
        const PPI = json?.meta?.pixelsPerInch ?? 7.68;
        this.skinPhysicalWidth = image.width / PPI;
        this.skinPhysicalHeight = image.height / PPI;
      }
    }

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

  toggleCollisionOverlay(show: boolean): void {
    this.showCollisionOverlay = show;
    this.buildCollisionOverlay();
  }

  rackBalls(): void {
    this.showBalls = true;
    this.buildBalls();
  }

  /**
   * Dispose of all Three.js resources to prevent memory leaks.
   * Call this when the editor is destroyed or unmounted.
   */
  dispose(): void {
    // Cancel animation loop
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = 0;
    }

    // Helper to dispose geometry and material from a mesh/line
    const disposeMesh = (obj: THREE.Object3D | null) => {
      if (!obj) return;
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Line || obj instanceof THREE.LineSegments) {
        obj.geometry?.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      }
    };

    // Dispose all tracked meshes
    disposeMesh(this.tableMesh);
    this.pocketMeshes.forEach(disposeMesh);
    this.railOutlineMeshes.forEach(disposeMesh);
    disposeMesh(this.playAreaOutlineMesh);
    this.measurementMeshes.forEach(disposeMesh);
    this.ballMeshes.forEach(disposeMesh);
    this.handleMeshes.forEach(disposeMesh);
    this.collisionOverlayMeshes.forEach(disposeMesh);
    disposeMesh(this.gridMinorMesh);
    disposeMesh(this.gridMajorMesh);

    // Dispose textures
    this.skinTexture?.dispose();
    this.skinTexture = null;

    // Clear arrays
    this.pocketMeshes = [];
    this.railOutlineMeshes = [];
    this.measurementMeshes = [];
    this.ballMeshes = [];
    this.handleMeshes = [];
    this.collisionOverlayMeshes = [];

    // Dispose scene (removes all children)
    if (this.scene) {
      this.scene.clear();
      this.scene = null;
    }

    // Dispose renderer
    this.renderer?.dispose();
    this.renderer = null;

    // Nullify camera
    this.camera = null;
  }
}

import * as THREE from 'three';
import { TextureGenerator } from '../TextureGenerator';
import { SettingsManager } from '../../ui/SettingsManager';
import { CONFIG } from '../../config';
import { getTableGeometry, computePlayBoundaryPoints, computeBoundaryBounds, type Vec2, type BoundaryBounds, type PocketDef } from '../../geometry/Geometry';
import { Rail } from '../../physics/Shapes';
import { RenderLayerSettings, RenderLayerOrderKey, RenderLayerBooleanKey } from '../RenderLayers';
import { parseHexColor, lightenColor, mixColors, toRgba } from '../RenderUtils';
// Legacy imports removed - now using TableTextureManager
import { TableTextureManager } from '../../textures/TableTextureManager';
import type { TableAppearance } from '../../textures/TableAppearance';

type FrameClipInfo = { outerX: number; outerY: number; radius: number };

export class TableRenderer {
    // Mesh references
    tableMesh: THREE.Mesh | null = null;
    frameMesh: THREE.Group | null = null;
    private frameStencilMesh: THREE.Mesh | null = null;
    railMeshes: THREE.Mesh[] = [];
    pocketMeshes: THREE.Mesh[] = [];
    pocketBottomMeshes: THREE.Mesh[] = [];
    private pocketMaskMeshes: THREE.Mesh[] = [];
    private pocketOccluderMeshes: THREE.Mesh[] = [];
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

    // Data
    private railLines: Array<{ start: Vec2; end: Vec2; nx: number; ny: number }> = [];
    private debugRailSegments: Array<{ id: string; inner: Vec2; trimmed: Vec2; startOuter: Vec2 }> = [];
    private frameClipInfo: FrameClipInfo | null = null;
    private lastPocketDefs: PocketDef[] = [];
    private playBoundaryPoints: Vec2[] = [];
    private playBounds: BoundaryBounds = { minX: 0, maxX: 0, minY: 0, maxY: 0 };

    // Materials & Textures
    private railHighlightMaterial: THREE.MeshBasicMaterial | null = null;
    private railShadowMaterial: THREE.MeshBasicMaterial | null = null;
    private railShadowTexture: THREE.Texture | null = null;
    private pocketHighlightMaterial: THREE.MeshBasicMaterial | null = null;
    private pocketShadowMaterial: THREE.MeshBasicMaterial | null = null;
    private railHighlightTexture: THREE.CanvasTexture | null = null;
    private pocketHighlightTexture: THREE.CanvasTexture | null = null;
    private pocketShadowTexture: THREE.CanvasTexture | null = null;
    private pocketGradientTexture: THREE.CanvasTexture | null = null;
    private pocketCapMaterial: THREE.MeshBasicMaterial | null = null;
    private pocketSideMaterial: THREE.MeshBasicMaterial | null = null;
    private feltMaterial: THREE.MeshStandardMaterial | null = null;
    private frameMaterial: THREE.MeshStandardMaterial | null = null;
    private feltTexture: THREE.CanvasTexture | null = null;
    private frameTexture: THREE.CanvasTexture | null = null;

    // Texture Manager (new unified system)
    private textureManager: TableTextureManager;

    // Settings

    // Settings
    private railShadowSpread = 1.0;
    private railShadowIntensity = CONFIG.RAIL_SHADOW_INTENSITY ?? 0.25;
    private railShadowSoftness = 1.8;
    private railShadowBaseGray = 170;
    private railHighlightSpread = 1.0;
    private railHighlightColor = new THREE.Color(0xffffff);
    private railHighlightIntensity = CONFIG.RAIL_HIGHLIGHT_INTENSITY ?? 1.0;
    private pocketHighlightIntensity = CONFIG.POCKET_HIGHLIGHT_INTENSITY ?? 1.0;
    private pocketShadowIntensity = CONFIG.POCKET_SHADOW_INTENSITY ?? 1.0;

    // Pocket settings
    private grooveInnerBase = 0.18;
    private grooveInnerDepthScale = 0.22;
    private grooveThicknessFactor = 0.08;
    private grooveOpacityBase = 0.18;
    private grooveOpacityDepthScale = 0.36;
    private grooveRimThicknessFactor = 0.02;
    private grooveRimOuterOpacity = 0.10;
    private grooveRimInnerOpacity = 0.08;
    private grooveColor = new THREE.Color(0x000000);
    private rimColor = new THREE.Color(0xffffff);
    private pocketBottomColor = new THREE.Color(0x000000);
    private pocketWallColor = new THREE.Color(0x0a0a0a);
    private gradientCenterColor = '#000000';
    private gradientEdgeColor = '#141414';
    private pocketGradientStrength = 1.0;

    private stencilAppliedOnce: boolean = false;
    private debugMode: boolean = false;

    constructor(
        private scene: THREE.Scene,
        private layerVisibility: Record<RenderLayerBooleanKey, boolean>,
        private layerOrder: Record<RenderLayerOrderKey, number>,
        private settingsManager: SettingsManager
    ) {
        // Initialize texture manager with saved appearance
        const appearance = settingsManager.getTableAppearance();
        this.textureManager = new TableTextureManager(appearance);

        this.initializeTable();
        this.refreshDerivedGeometry();
        this.exposePlayBoundaryDebug();

        // Listen for appearance changes
        window.addEventListener('settings:appearance-changed', (e: Event) => {
            try {
                const event = e as CustomEvent<{ appearance: TableAppearance }>;
                this.applyAppearance(event.detail.appearance);
            } catch (err) {
                console.error('Error applying appearance change:', err);
            }
        });
    }

    refreshDerivedGeometry(): void {
        this.playBoundaryPoints = computePlayBoundaryPoints(getTableGeometry().rails);
        this.playBounds = computeBoundaryBounds(this.playBoundaryPoints);
    }

    initializeTable() {
        const tableGeometry = getTableGeometry();
        this.refreshDerivedGeometry();
        const playShape = this.createPlayShape();

        // Felt surface following cushion outline
        const feltGeometry = new THREE.ShapeGeometry(playShape);

        // Generate proper world-aligned UVs for consistent tiling
        this.applyWorldAlignedUVs(feltGeometry, this.playBounds);

        // Force textures enabled
        this.layerVisibility.showTextures = true;

        // Generate textures from appearance settings
        const textures = this.textureManager.generateTextures();
        this.feltTexture = textures.felt;

        const appearance = this.settingsManager.getTableAppearance();
        this.feltMaterial = new THREE.MeshStandardMaterial({
            color: new THREE.Color(appearance.felt.color),
            map: this.layerVisibility.showTextures ? this.feltTexture : null,
            roughness: appearance.felt.roughness,
            metalness: 0.1,
            side: THREE.DoubleSide,
            stencilWrite: true,
            stencilFunc: THREE.AlwaysStencilFunc,
            stencilRef: 1,
            stencilZPass: THREE.ReplaceStencilOp,
        });
        this.tableMesh = new THREE.Mesh(feltGeometry, this.feltMaterial);
        this.tableMesh.receiveShadow = true;
        this.tableMesh.visible = this.layerVisibility.showTable;
        this.tableMesh.renderOrder = this.layerOrder.orderTable;
        this.enforceRenderOrderControl(this.tableMesh);
        this.scene.add(this.tableMesh);
        this.createOrUpdateTableOverlays(tableGeometry.playWidthIn, tableGeometry.playHeightIn);

        // Wooden frame planks surrounding play surface
        this.initializeFrame();
    }

    /**
     * Expose a debugging helper to inspect the play boundary polygon produced from the SVG/rails.
     * Call `dumpPlayBoundary()` in the browser console to see the points, bounds, and a copyable SVG string.
     */
    private exposePlayBoundaryDebug(): void {
        const win = window as unknown as { dumpPlayBoundary?: () => { points: Array<{ x: number; y: number }>; bounds: BoundaryBounds; svg: string } };
        win.dumpPlayBoundary = () => {
            const points = this.playBoundaryPoints
                .filter((p) => Number.isFinite(p?.x) && Number.isFinite(p?.y))
                .map((p) => ({ x: p.x, y: p.y }));
            const bounds = this.playBounds;

            const scale = 6; // px per inch for the preview
            const pad = 32;
            const width = Math.max(200, bounds.width * scale + pad * 2);
            const height = Math.max(200, bounds.height * scale + pad * 2);

            const toSvgCoord = (p: { x: number; y: number }) => {
                // Flip Y for SVG (screen space)
                const sx = (p.x * scale + width / 2).toFixed(2);
                const sy = (-p.y * scale + height / 2).toFixed(2);
                return `${sx},${sy}`;
            };

            const path =
                points.length > 0
                    ? points
                          .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toSvgCoord(p)}`)
                          .join(' ') + ' Z'
                    : '';

            const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect x="0" y="0" width="${width}" height="${height}" fill="#0b1220" />
  <path d="${path}" fill="rgba(0,255,255,0.16)" stroke="#00e7ff" stroke-width="2" />
</svg>`;

            console.log('[TableRenderer] Play boundary points:', points);
            console.log('[TableRenderer] Play boundary bounds:', bounds);
            console.log('[TableRenderer] Inline SVG (copy to a file to view):\n', svg);
            return { points, bounds, svg };
        };
    }

    private createPlayShape(): THREE.Shape {
        const shape = new THREE.Shape();
        const points = this.playBoundaryPoints.filter(
            (p) => Number.isFinite(p?.x) && Number.isFinite(p?.y)
        );
        if (points.length < 3) {
            const halfW = (CONFIG.TABLE_WIDTH ?? 100) * 0.5;
            const halfH = (CONFIG.TABLE_HEIGHT ?? 50) * 0.5;
            const fallback = [
                { x: -halfW, y: -halfH },
                { x: halfW, y: -halfH },
                { x: halfW, y: halfH },
                { x: -halfW, y: halfH },
            ];
            console.warn('[TableRenderer] Invalid play boundary (<3 points). Using fallback rectangle.', {
                points,
                fallback,
            });
            if (!fallback.length) return shape;
            shape.moveTo(fallback[0].x, fallback[0].y);
            for (let i = 1; i < fallback.length; i++) {
                shape.lineTo(fallback[i].x, fallback[i].y);
            }
            shape.autoClose = true;
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

        // Get frame texture from texture manager
        const textures = this.textureManager.generateTextures();
        this.frameTexture = textures.frame;

        const appearance = this.settingsManager.getTableAppearance();
        const glossiness = appearance.frame.glossiness;

        this.frameMaterial = new THREE.MeshStandardMaterial({
            color: new THREE.Color(appearance.frame.color),
            map: this.layerVisibility.showTextures ? this.frameTexture : null,
            roughness: 1.0 - glossiness * 0.6, // Convert glossiness to roughness
            metalness: appearance.frame.material === 'metal' ? 0.8 : 0.2,
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

        const frameBody = new THREE.Mesh(frameGeometry, this.frameMaterial.clone());
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

    initializeRails(rails: Rail[]) {
        this.debugRailSegments = [];
        this.railLines = [];

        // Clear existing per-rail highlight meshes
        this.railHighlightMeshes.forEach(mesh => {
            this.scene.remove(mesh);
            mesh.geometry.dispose();
            const mat = mesh.material as THREE.Material;
            mat.dispose();
        });
        this.railHighlightMeshes = [];

        const railMaterial = new THREE.MeshStandardMaterial({
            color: new THREE.Color(CONFIG.RAIL_COLOR),
            roughness: 0.5,
            metalness: 0.3,
            stencilWrite: true,
            stencilFunc: THREE.NotEqualStencilFunc,
            stencilRef: 2,
            stencilZPass: THREE.ReplaceStencilOp,
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

            const baseStart = { x: innerPoint.x - nx * centerShift, y: innerPoint.y - ny * centerShift };
            const baseEnd = { x: trimmedOuter.x - nx * centerShift, y: trimmedOuter.y - ny * centerShift };
            this.railLines.push({ start: baseStart, end: baseEnd, nx, ny });
        });

        this.rebuildRailShadowRibbon();
        this.rebuildRailHighlightRibbon();
        this.updateRailLighting();
    }

    initializePockets(pockets: PocketDef[]) {
        // Clean up existing pocket meshes before creating new ones
        this.cleanupPocketMeshes();

        this.lastPocketDefs = pockets.map(p => ({ ...p }));
        const sideMaterial = this.getPocketSideMaterial();

        pockets.forEach((pocket) => {
            const visualRadius = pocket.visualRadius ?? pocket.radius;
            const wallTaperRadius = visualRadius * 0.75;
            const shelfDepthIn = pocket.shelfDepth ?? CONFIG.POCKET_SHELF_DEPTH_IN;
            const shelfDepth = Math.max(0.1, shelfDepthIn) * 1.5;
            // Normalize shelf depth for groove geometry using full 0-3 slider range
            const depthFactor = Math.max(0, Math.min(1, (shelfDepthIn ?? 0.5) / 3.0));
            const angleRad = THREE.MathUtils.degToRad(pocket.cutAngleDeg ?? 0);

            const pocketRotationZ = angleRad;
            const thetaStart = 0;
            const thetaLength = Math.PI * 2;
            const pocketY = pocket.center.y;

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
            // Raise the pocket so the top edge is flush with the frame surface (Z=0.38)
            // Cylinder center is at 0, height is shelfDepth. Top is at +shelfDepth/2.
            // We want top at 0.38, so center should be at 0.38 - shelfDepth/2.
            pocketMesh.position.set(pocket.center.x, pocketY, 0.38 - shelfDepth / 2);
            pocketMesh.rotation.x = Math.PI / 2;
            pocketMesh.rotation.z = pocketRotationZ;

            pocketMesh.renderOrder = this.layerOrder.orderPockets;
            pocketMesh.visible = this.layerVisibility.showPockets;
            this.enforceRenderOrderControl(pocketMesh);
            this.scene.add(pocketMesh);
            this.pocketMeshes.push(pocketMesh);

            // Stencil mask disc to prevent rails from rendering in pocket area
            // Uses stencil buffer: this disc writes stencil=2, rails check stencil!=2
            const stencilMaskMaterial = new THREE.MeshBasicMaterial({
                colorWrite: false,  // Don't write to color buffer
                depthWrite: false,
                depthTest: false,
                stencilWrite: true,
                stencilFunc: THREE.AlwaysStencilFunc,
                stencilRef: 2,
                stencilZPass: THREE.ReplaceStencilOp,
            });
            // Size slightly larger than visual radius to ensure full coverage of rail overlap
            const stencilMaskGeometry = new THREE.CircleGeometry(visualRadius * 1.08, 64);
            const stencilMaskMesh = new THREE.Mesh(stencilMaskGeometry, stencilMaskMaterial);
            stencilMaskMesh.position.set(pocket.center.x, pocketY, 0.01);
            stencilMaskMesh.rotation.z = pocketRotationZ;
            // Render BEFORE rails so stencil is set before rail rendering
            stencilMaskMesh.renderOrder = this.layerOrder.orderRails - 2;
            stencilMaskMesh.visible = this.layerVisibility.showPockets;
            this.scene.add(stencilMaskMesh);
            this.pocketOccluderMeshes.push(stencilMaskMesh);

            // Solid opaque black disc to occlude elements behind the pocket
            // This actually draws black to cover the table/frame/etc beneath
            const occluderMaterial = new THREE.MeshBasicMaterial({
                color: 0x000000,
                transparent: false,
                depthTest: true,
                depthWrite: true,
                side: THREE.FrontSide,
            });
            const occluderGeometry = new THREE.CircleGeometry(visualRadius, 64);
            const occluderMesh = new THREE.Mesh(occluderGeometry, occluderMaterial);
            occluderMesh.position.set(pocket.center.x, pocketY, 0.385); // Just above frame surface
            occluderMesh.rotation.z = pocketRotationZ;
            occluderMesh.renderOrder = this.layerOrder.orderPockets - 0.3;
            occluderMesh.visible = this.layerVisibility.showPockets;
            this.scene.add(occluderMesh);
            this.pocketMaskMeshes.push(occluderMesh);

            // Calculate groove inner radius first (needed for both gradient and bottom sizing)
            const grooveInner = visualRadius * (this.grooveInnerBase + this.grooveInnerDepthScale * depthFactor);

            // Bottom fill should only cover the center (inside the groove)
            const circleShape = new THREE.Shape();
            const radius = grooveInner * 0.98; // Slightly smaller than groove inner
            circleShape.absarc(0, 0, radius, 0, Math.PI * 2, false);
            const bottomGeometry = new THREE.ShapeGeometry(circleShape);

            const bottomMaterial = new THREE.MeshBasicMaterial({
                color: this.pocketBottomColor,
                side: THREE.DoubleSide,
                depthTest: true,
                depthWrite: true,
                stencilWrite: true,
                stencilFunc: THREE.NotEqualStencilFunc,
                stencilRef: 1,
            });
            const bottomMesh = new THREE.Mesh(bottomGeometry, bottomMaterial);
            bottomMesh.position.set(pocket.center.x, pocketY, 0.388);
            bottomMesh.rotation.z = pocketRotationZ;

            bottomMesh.renderOrder = this.layerOrder.orderPockets - 0.2;
            bottomMesh.visible = this.layerVisibility.showPockets;
            this.scene.add(bottomMesh);
            this.pocketBottomMeshes.push(bottomMesh);

            // Create gradient as a ring that stops at the groove inner radius
            // This makes the center (inside groove) show the bottom fill color for depth
            const gradientInnerRadius = Math.max(0.01, grooveInner * 0.99); // Just inside groove

            const gradientGeometry = new THREE.RingGeometry(
                gradientInnerRadius,
                visualRadius,
                64,
                1,
                thetaStart,
                thetaLength
            );

            const uvAttribute = gradientGeometry.attributes.uv;
            const posAttribute = gradientGeometry.attributes.position;
            for (let i = 0; i < uvAttribute.count; i++) {
                const x = posAttribute.getX(i);
                const y = posAttribute.getY(i);
                // Map UV from inner radius to outer radius of the ring
                const distFromCenter = Math.sqrt(x * x + y * y);
                const normalizedDist = (distFromCenter - gradientInnerRadius) / (visualRadius - gradientInnerRadius);
                const u = (x / visualRadius + 1) * 0.5;
                const v = (y / visualRadius + 1) * 0.5;
                // Remap so gradient goes from inner edge (0) to outer edge (1)
                const remappedU = 0.5 + (u - 0.5) * (1 - normalizedDist);
                const remappedV = 0.5 + (v - 0.5) * (1 - normalizedDist);
                uvAttribute.setXY(i, remappedU, remappedV);
            }
            uvAttribute.needsUpdate = true;

            const gradientTexture = this.getPocketGradientTexture();
            const gradientMat = new THREE.MeshBasicMaterial({
                map: gradientTexture,
                transparent: true,
                depthTest: true,
                depthWrite: false,
                side: THREE.DoubleSide,
            });
            const baseOpacity = 0.65 + 0.35 * depthFactor;
            gradientMat.userData = gradientMat.userData ?? {};
            gradientMat.userData.baseOpacity = baseOpacity;
            gradientMat.opacity = baseOpacity * this.pocketGradientStrength;
            const gradientMesh = new THREE.Mesh(gradientGeometry, gradientMat);
            gradientMesh.position.set(pocket.center.x, pocketY, 0.39);
            gradientMesh.rotation.z = pocketRotationZ;

            gradientMesh.renderOrder = this.layerOrder.orderPockets + 0.1;
            gradientMesh.visible = this.layerVisibility.showPockets && !this.debugMode && this.pocketGradientStrength > 1e-3;
            this.scene.add(gradientMesh);
            this.pocketGradientMeshes.push(gradientMesh);

            const pocketShadowMaterialBase = this.getPocketShadowMaterial();
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
            shadowMesh.position.set(pocket.center.x, pocketY, 0.392);
            shadowMesh.rotation.x = Math.PI / 2;
            shadowMesh.rotation.z = pocketRotationZ;

            shadowMesh.renderOrder = this.layerOrder.orderPockets + 0.2;
            shadowMesh.visible = this.layerVisibility.showPockets;
            this.enforceRenderOrderControl(shadowMesh);
            this.scene.add(shadowMesh);
            this.pocketShadowMeshes.push(shadowMesh);

            // Reuse grooveInner from gradient calculation above
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
            grooveMesh.position.set(pocket.center.x, pocketY, 0.395);
            grooveMesh.rotation.z = pocketRotationZ;
            grooveMesh.renderOrder = this.layerOrder.orderPockets + 0.21;
            grooveMesh.visible = this.layerVisibility.showPockets;
            this.enforceRenderOrderControl(grooveMesh);
            this.scene.add(grooveMesh);
            this.pocketGrooveMeshes.push(grooveMesh);

            const rimInner = grooveOuter;
            const rimOuter = rimInner + visualRadius * this.grooveRimThicknessFactor;
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
            rimMesh.position.set(pocket.center.x, pocketY, 0.398);
            rimMesh.rotation.z = pocketRotationZ;
            rimMesh.renderOrder = this.layerOrder.orderPockets + 0.22;
            rimMesh.visible = this.layerVisibility.showPockets;
            this.enforceRenderOrderControl(rimMesh, { disableDepth: true });
            this.scene.add(rimMesh);
            this.pocketRimMeshes.push(rimMesh);

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
            rim2Mesh.position.set(pocket.center.x, pocketY, 0.398);
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
        this.updatePocketLighting();
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
            stencilWrite: true,
            stencilFunc: THREE.NotEqualStencilFunc,
            stencilRef: 1,
        });

        pockets.forEach((pocket) => {
            const visualRadius = pocket.visualRadius ?? pocket.radius;
            const angleRad = THREE.MathUtils.degToRad(pocket.cutAngleDeg ?? 0);
            const pocketRotationZ = angleRad;
            const thetaStart = 0;
            const thetaLength = Math.PI * 2;
            const pocketY = pocket.center.y;

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
            capMesh.position.set(pocket.center.x, pocketY, 0.42); // Just above overlays
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

    private ensureClockwise(points: Vec2[]): Vec2[] {
        if (points.length < 3) return points;
        let area = 0;
        for (let i = 0, n = points.length; i < n; i++) {
            const p1 = points[i];
            const p2 = points[(i + 1) % n];
            area += p1.x * p2.y - p2.x * p1.y;
        }
        if (area > 0) {
            return points.slice().reverse();
        }
        return points;
    }

    private computeRailFillColor(): THREE.Color {
        return new THREE.Color(CONFIG.RAIL_FILL_COLOR ?? '#000000');
    }

    updateRailFillMaterialColor() {
        if (!this.railFillMesh) return;
        const mat = this.railFillMesh.material as THREE.MeshBasicMaterial | undefined;
        if (!mat) return;
        const color = this.computeRailFillColor();
        mat.color.copy(color);
        mat.opacity = 0.96;
        mat.needsUpdate = true;
    }

    private cleanupPocketMeshes() {
        const disposeArray = (arr: THREE.Mesh[]) => {
            arr.forEach(m => {
                this.scene.remove(m);
                m.geometry.dispose();
                const mat = m.material as THREE.Material | THREE.Material[];
                if (Array.isArray(mat)) mat.forEach(mm => mm.dispose()); else mat.dispose();
            });
        };

        disposeArray(this.pocketMeshes);
        this.pocketMeshes = [];

        disposeArray(this.pocketBottomMeshes);
        this.pocketBottomMeshes = [];

        disposeArray(this.pocketMaskMeshes);
        this.pocketMaskMeshes = [];

        disposeArray(this.pocketOccluderMeshes);
        this.pocketOccluderMeshes = [];

        disposeArray(this.pocketGradientMeshes);
        this.pocketGradientMeshes = [];

        disposeArray(this.pocketGrooveMeshes);
        this.pocketGrooveMeshes = [];

        disposeArray(this.pocketRimMeshes);
        this.pocketRimMeshes = [];

        disposeArray(this.pocketCapMeshes);
        this.pocketCapMeshes = [];

        disposeArray(this.pocketShadowMeshes);
        this.pocketShadowMeshes = [];

        disposeArray(this.pocketHighlightMeshes);
        this.pocketHighlightMeshes = [];
    }

    dispose() {
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
            const mat = mesh.material as THREE.Material | THREE.Material[];
            if (Array.isArray(mat)) mat.forEach(mm => mm.dispose()); else mat?.dispose();
        });
        this.railHighlightMeshes = [];

        if (this.railHighlightRibbonMesh) {
            this.scene.remove(this.railHighlightRibbonMesh);
            this.railHighlightRibbonMesh.geometry.dispose();
            this.railHighlightRibbonMesh = null;
        }

        if (this.railShadowRibbonMesh) {
            this.scene.remove(this.railShadowRibbonMesh);
            this.railShadowRibbonMesh.geometry.dispose();
            this.railShadowRibbonMesh = null;
        }

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

        this.pocketMaskMeshes.forEach(m => {
            this.scene.remove(m);
            m.geometry.dispose();
            const mat = m.material as THREE.Material | THREE.Material[];
            if (Array.isArray(mat)) mat.forEach(mm => mm.dispose()); else mat.dispose();
        });
        this.pocketMaskMeshes = [];

        this.pocketOccluderMeshes.forEach(m => {
            this.scene.remove(m);
            m.geometry.dispose();
            const mat = m.material as THREE.Material | THREE.Material[];
            if (Array.isArray(mat)) mat.forEach(mm => mm.dispose()); else mat.dispose();
        });
        this.pocketOccluderMeshes = [];

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

        this.pocketCapMeshes.forEach(m => {
            this.scene.remove(m);
            m.geometry.dispose();
            const mat = m.material as THREE.Material | THREE.Material[];
            if (Array.isArray(mat)) mat.forEach(mm => mm.dispose()); else mat.dispose();
        });
        this.pocketCapMeshes = [];

        this.pocketShadowMeshes.forEach(m => {
            this.scene.remove(m);
            m.geometry.dispose();
            const mat = m.material as THREE.Material | THREE.Material[];
            if (Array.isArray(mat)) mat.forEach(mm => mm.dispose()); else mat.dispose();
        });
        this.pocketShadowMeshes = [];

        if (this.railFillMesh) {
            this.scene.remove(this.railFillMesh);
            this.railFillMesh.geometry.dispose();
            (this.railFillMesh.material as THREE.Material).dispose();
            this.railFillMesh = null;
        }
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

    private getFrameInnerShadowMaterial(): THREE.MeshBasicMaterial {
        return new THREE.MeshBasicMaterial({
            color: 0x000000,
            transparent: true,
            opacity: 0.0, // Disabled by default, use frame depth geometry instead
            side: THREE.DoubleSide,
        });
    }

    private getFrameOuterHighlightMaterial(): THREE.MeshBasicMaterial {
        const material = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.15,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
        });
        material.userData = material.userData ?? {};
        material.userData.baseOpacity = material.userData.baseOpacity ?? material.opacity;
        return material;
    }

    private getPocketSideMaterial(): THREE.MeshBasicMaterial {
        if (!this.pocketSideMaterial) {
            this.pocketSideMaterial = new THREE.MeshBasicMaterial({
                color: this.pocketWallColor.clone(),
                transparent: false,
                opacity: 1.0,
                depthTest: true,
                depthWrite: true,
                side: THREE.DoubleSide,
            });
        }
        return this.pocketSideMaterial;
    }

    private getPocketGradientTexture(forceRegen: boolean = false): THREE.CanvasTexture {
        if (this.pocketGradientTexture && !forceRegen) {
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

        const centerCol = parseHexColor(this.gradientCenterColor ?? '#050505');
        const edgeCol = parseHexColor(this.gradientEdgeColor ?? '#5a5a5a');
        const midCol = mixColors(centerCol, edgeCol, 0.5);
        const nearCol = mixColors(centerCol, edgeCol, 0.8);

        const toRgbaStr = (c: { r: number; g: number; b: number }, a: number) => `rgba(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}, ${a})`;

        // Apply gradient strength directly to texture alpha for reliable updates
        const s = Math.max(0, Math.min(1, this.pocketGradientStrength));
        const baseAlpha = 0.85;
        const gradient = ctx.createRadialGradient(center, center, 0, center, center, radius);
        gradient.addColorStop(0.0, toRgbaStr(centerCol, baseAlpha * s));
        gradient.addColorStop(0.25, toRgbaStr(midCol, baseAlpha * s));
        gradient.addColorStop(0.6, toRgbaStr(nearCol, baseAlpha * s));
        gradient.addColorStop(1.0, toRgbaStr(edgeCol, baseAlpha * s));
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);

        if (this.pocketGradientTexture) {
            this.pocketGradientTexture.dispose();
        }
        this.pocketGradientTexture = new THREE.CanvasTexture(canvas);
        this.pocketGradientTexture.colorSpace = THREE.SRGBColorSpace;
        this.pocketGradientTexture.wrapS = THREE.ClampToEdgeWrapping;
        this.pocketGradientTexture.wrapT = THREE.ClampToEdgeWrapping;
        this.pocketGradientTexture.needsUpdate = true;
        return this.pocketGradientTexture;
    }

    private getPocketShadowMaterial(): THREE.MeshBasicMaterial {
        if (this.pocketShadowMaterial) {
            return this.pocketShadowMaterial;
        }
        const size = 128;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d')!;
        const center = size / 2;
        const gradient = ctx.createRadialGradient(center, center, size * 0.3, center, center, size * 0.5);
        gradient.addColorStop(0, 'rgba(0,0,0,0.8)');
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);

        const texture = new THREE.CanvasTexture(canvas);
        this.pocketShadowMaterial = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            blending: THREE.MultiplyBlending,
            depthTest: false,
            depthWrite: false,
            side: THREE.DoubleSide,
            stencilWrite: true,
            stencilFunc: THREE.NotEqualStencilFunc,
            stencilRef: 1,
        });
        this.pocketShadowMaterial.userData = this.pocketShadowMaterial.userData ?? {};
        this.pocketShadowMaterial.userData.baseOpacity = this.pocketShadowMaterial.userData.baseOpacity ?? (this.pocketShadowMaterial.opacity ?? 1);
        return this.pocketShadowMaterial;
    }

    private addPocketHighlight(pocket: PocketDef, visualRadius: number, angleRad: number, pocketY: number) {
        const highlightMaterial = this.getPocketHighlightMaterial();
        const yPos = pocketY;

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
        highlightMesh.position.set(pocket.center.x, yPos, 0.49);
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
        this.pocketHighlightMaterial.userData = this.pocketHighlightMaterial.userData ?? {};
        this.pocketHighlightMaterial.userData.baseOpacity = this.pocketHighlightMaterial.userData.baseOpacity ?? (this.pocketHighlightMaterial.opacity ?? 1);
        return this.pocketHighlightMaterial;
    }



    private rebuildRailShadowRibbon() {
        if (this.railShadowRibbonMesh) {
            this.scene.remove(this.railShadowRibbonMesh);
            this.railShadowRibbonMesh.geometry.dispose();
            this.railShadowRibbonMesh = null;
        }

        const boundary = this.playBoundaryPoints;
        if (!boundary.length) return;

        const inner = CONFIG.RAIL_THICKNESS_INNER;
        const width = Math.max(0.30, inner * 0.45) * this.railShadowSpread;

        // We want the shadow to start at the rail edge and extend INWARDS onto the felt.
        // nx/ny point OUTWARDS (into the rail).
        // So we want vertices at:
        // 1. Rail Edge (V=0, Dark)
        // 2. Rail Edge - Normal * Width (V=1, Light)

        const joins: Array<{ x: number; y: number; nx: number; ny: number }> = [];
        const N = boundary.length;
        for (let i = 0; i < N; i++) {
            const prev = boundary[(i - 1 + N) % N];
            const curr = boundary[i];
            const next = boundary[(i + 1) % N];
            const dx1 = curr.x - prev.x;
            const dy1 = curr.y - prev.y;
            const l1 = Math.hypot(dx1, dy1) || 1;
            let nx1 = dy1 / l1;
            let ny1 = -dx1 / l1;
            const dx2 = next.x - curr.x;
            const dy2 = next.y - curr.y;
            const l2 = Math.hypot(dx2, dy2) || 1;
            let nx2 = dy2 / l2;
            let ny2 = -dx2 / l2;
            let ax = nx1 + nx2;
            let ay = ny1 + ny2;
            const al = Math.hypot(ax, ay) || 1;
            ax /= al; ay /= al;
            // Ensure normal points INWARD (towards table center)
            if (ax * -curr.x + ay * -curr.y < 0) { ax = -ax; ay = -ay; }

            // Anchor at the rail edge
            joins.push({ x: curr.x, y: curr.y, nx: ax, ny: ay });
        }

        const positions: number[] = [];
        const uvs: number[] = [];
        const indices: number[] = [];
        for (let i = 0; i < joins.length; i++) {
            const { x, y, nx, ny } = joins[i];

            // Vertex 1: At Rail Edge
            const railSideX = x;
            const railSideY = y;

            // Vertex 2: On Felt (Inwards)
            // Add normal to go inwards (since nx is Inward)
            const feltSideX = x + nx * width;
            const feltSideY = y + ny * width;

            positions.push(railSideX, railSideY, 0.015, feltSideX, feltSideY, 0.015);

            const u = i / joins.length;
            // V=1 at Rail (Dark), V=0 at Felt (Light)
            uvs.push(u, 1, u, 0);
        }
        for (let i = 0; i < joins.length; i++) {
            const a = i * 2;
            const b = ((i + 1) % joins.length) * 2;
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
        this.updateRailShadowRibbonMaterial();
        this.applyStencilToTableMeshes();
    }

    private rebuildRailHighlightRibbon() {
        if (this.railHighlightRibbonMesh) {
            this.scene.remove(this.railHighlightRibbonMesh);
            this.railHighlightRibbonMesh.geometry.dispose();
            this.railHighlightRibbonMesh = null;
        }

        const boundary = this.playBoundaryPoints;
        if (!boundary.length) return;

        // Highlight sits on the rail edge, slightly overlapping the cushion
        const inner = CONFIG.RAIL_THICKNESS_INNER;
        const width = Math.max(0.15, inner * 0.25) * this.railHighlightSpread;
        const halfW = width * 0.5;

        // Position the ribbon exactly on the rail edge (play boundary)
        // We want it to be centered on the edge, or slightly biased towards the rail top
        const centerInset = 0;

        const joins: Array<{ x: number; y: number; nx: number; ny: number }> = [];
        const N = boundary.length;
        for (let i = 0; i < N; i++) {
            const prev = boundary[(i - 1 + N) % N];
            const curr = boundary[i];
            const next = boundary[(i + 1) % N];
            const dx1 = curr.x - prev.x;
            const dy1 = curr.y - prev.y;
            const l1 = Math.hypot(dx1, dy1) || 1;
            let nx1 = dy1 / l1;
            let ny1 = -dx1 / l1;
            const dx2 = next.x - curr.x;
            const dy2 = next.y - curr.y;
            const l2 = Math.hypot(dx2, dy2) || 1;
            let nx2 = dy2 / l2;
            let ny2 = -dx2 / l2;
            let ax = nx1 + nx2;
            let ay = ny1 + ny2;
            const al = Math.hypot(ax, ay) || 1;
            ax /= al; ay /= al;
            // Ensure normal points inward (towards table center)
            if (ax * -curr.x + ay * -curr.y < 0) { ax = -ax; ay = -ay; }

            const cx = curr.x + ax * centerInset;
            const cy = curr.y + ay * centerInset;
            joins.push({ x: cx, y: cy, nx: ax, ny: ay });
        }

        const positions: number[] = [];
        const uvs: number[] = [];
        const indices: number[] = [];

        // Z-height: slightly above the rail shadow to avoid z-fighting, 
        // but below the ball. Rail mesh is at -0.25, shadow at 0.005.
        // Let's put highlight at 0.1 to be safe and visible.
        const zHeight = 0.1;

        for (let i = 0; i < joins.length; i++) {
            const { x, y, nx, ny } = joins[i];

            // "Inner" edge is towards the table center (felt)
            // "Outer" edge is towards the rail top
            const innerX = x + nx * halfW;
            const innerY = y + ny * halfW;
            const outerX = x - nx * halfW;
            const outerY = y - ny * halfW;

            positions.push(outerX, outerY, zHeight, innerX, innerY, zHeight);

            // UVs: 0 = outer (sharp), 1 = inner (fade)
            uvs.push(0, 0, 1, 0); // We might want a gradient across the width, so use V for width
        }

        // Fix UVs to use V for width gradient
        for (let i = 0; i < uvs.length; i += 4) {
            uvs[i + 1] = 0; // Outer edge
            uvs[i + 3] = 1; // Inner edge
        }

        for (let i = 0; i < joins.length; i++) {
            const a = i * 2;
            const b = ((i + 1) % joins.length) * 2;
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
        mesh.renderOrder = this.layerOrder.orderRails + 0.15; // Above shadow
        mesh.visible = this.layerVisibility.showRails;
        this.scene.add(mesh);
        this.railHighlightRibbonMesh = mesh;
        this.updateRailHighlightRibbonMaterial();
        this.applyStencilToTableMeshes();
    }

    private getRailHighlightMaterial(): THREE.MeshBasicMaterial {
        if (this.railHighlightMaterial && this.railHighlightTexture) {
            return this.railHighlightMaterial;
        }

        const sizeX = 64;
        const sizeY = 64;
        const canvas = document.createElement('canvas');
        canvas.width = sizeX;
        canvas.height = sizeY;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Unable to create rail highlight texture context');

        // Create a gradient that fades out
        // V=0 is outer edge (bright), V=1 is inner edge (transparent)
        const gradient = ctx.createLinearGradient(0, 0, 0, sizeY);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
        gradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.4)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, sizeX, sizeY);

        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = THREE.ClampToEdgeWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
        tex.needsUpdate = true;
        tex.colorSpace = THREE.SRGBColorSpace;
        this.railHighlightTexture = tex;

        const material = new THREE.MeshBasicMaterial({
            map: tex,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthTest: true,
            depthWrite: false,
            side: THREE.DoubleSide,
            stencilWrite: false,
            stencilFunc: THREE.NotEqualStencilFunc,  // Only render where stencil != 2
            stencilRef: 2,
        });
        material.userData = material.userData ?? {};
        material.userData.baseOpacity = material.userData.baseOpacity ?? material.opacity;
        (material as any).toneMapped = false;
        this.railHighlightMaterial = material;
        return material;
    }

    private updateRailHighlightRibbonMaterial() {
        const mat = this.railHighlightMaterial;
        if (!mat) return;
        const t = Math.max(0, this.railHighlightIntensity);
        mat.opacity = (mat.userData?.baseOpacity ?? 1) * t;
        mat.color.copy(this.railHighlightColor);
        mat.needsUpdate = true;
    }

    private getRailShadowMaterial(): THREE.MeshBasicMaterial {
        if (this.railShadowMaterial && this.railShadowTexture) {
            return this.railShadowMaterial;
        }
        const sizeX = 64;
        const sizeY = 512;
        const canvas = document.createElement('canvas');
        canvas.width = sizeX;
        canvas.height = sizeY;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Unable to create rail shadow texture context');
        }
        const minGray = Math.max(50, Math.min(250, this.railShadowBaseGray));
        for (let y = 0; y < sizeY; y++) {
            const t = y / (sizeY - 1);
            const s = t * t * (3 - 2 * t); // smoothstep
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
        this.railShadowTexture = tex;

        const material = new THREE.MeshBasicMaterial({
            map: tex,
            transparent: true,
            blending: THREE.MultiplyBlending,
            depthTest: true,
            depthWrite: false,
            side: THREE.DoubleSide,
            polygonOffset: true,
            polygonOffsetFactor: -2,
            polygonOffsetUnits: -2,
            stencilWrite: true,
            stencilFunc: THREE.EqualStencilFunc,
            stencilRef: 1,
        });
        material.userData = material.userData ?? {};
        material.userData.baseOpacity = material.userData.baseOpacity ?? material.opacity;
        (material as any).toneMapped = false;
        this.railShadowMaterial = material;
        return material;
    }

    private updateRailShadowRibbonMaterial() {
        const mat = this.railShadowMaterial;
        if (!mat) return;
        const t = Math.max(0, Math.min(1, this.railShadowIntensity));
        mat.opacity = (mat.userData?.baseOpacity ?? 1) * t;
        mat.color.setRGB(1 - t, 1 - t, 1 - t);
        mat.needsUpdate = true;
    }

    private resetRailShadowMaterial() {
        if (this.railShadowMaterial) {
            this.railShadowMaterial.dispose();
            this.railShadowMaterial = null;
        }
        if (this.railShadowTexture) {
            this.railShadowTexture.dispose();
            this.railShadowTexture = null;
        }
    }

    private createOrUpdateTableOverlays(_width: number, _height: number) {
        // Placeholder for table overlays (felt texture, markings, etc.)
    }

    private createOrUpdateFrameStencil(outerX: number, outerY: number, radius: number) {
        if (this.frameStencilMesh) {
            this.scene.remove(this.frameStencilMesh);
            this.frameStencilMesh.geometry.dispose();
            this.frameStencilMesh = null;
        }

        const shape = this.createRoundedRectShape(outerX, outerY, radius);
        const geometry = new THREE.ShapeGeometry(shape);

        const material = new THREE.MeshBasicMaterial({
            color: 0x000000,
            colorWrite: false,
            depthWrite: false,
            stencilWrite: true,
            stencilFunc: THREE.AlwaysStencilFunc,
            stencilRef: 1,
            stencilZPass: THREE.ReplaceStencilOp,
        });

        this.frameStencilMesh = new THREE.Mesh(geometry, material);
        // Render before everything else that needs clipping
        this.frameStencilMesh.renderOrder = -1;
        this.frameStencilMesh.visible = this.layerVisibility.showFrame;
        this.scene.add(this.frameStencilMesh);

        this.applyStencilToTableMeshes();
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
        if (this.frameStencilMesh) {
            this.applyStencilToTableMeshes();
        }
    }

    private applyStencilToTableMeshes() {
        if (!this.frameStencilMesh) return;

        const applyStencil = (mesh: THREE.Mesh) => {
            const mat = mesh.material as THREE.Material | THREE.Material[];
            const materials = Array.isArray(mat) ? mat : [mat];
            materials.forEach(m => {
                if (m.stencilWrite !== true || m.stencilFunc !== THREE.EqualStencilFunc || m.stencilRef !== 1) {
                    m.stencilWrite = true;
                    m.stencilFunc = THREE.EqualStencilFunc;
                    m.stencilRef = 1;
                    m.needsUpdate = true;
                }
            });
        };

        this.railMeshes.forEach(applyStencil);
        this.railShadowMeshes.forEach(applyStencil);
        if (this.railShadowRibbonMesh) applyStencil(this.railShadowRibbonMesh);


        this.pocketMeshes.forEach(applyStencil);
        this.pocketShadowMeshes.forEach(applyStencil);
        this.pocketHighlightMeshes.forEach(applyStencil);
        this.pocketGrooveMeshes.forEach(applyStencil);
        this.pocketRimMeshes.forEach(applyStencil);
        this.pocketBottomMeshes.forEach(applyStencil);
        this.pocketGradientMeshes.forEach(applyStencil);
        this.pocketCapMeshes.forEach(applyStencil);

        if (this.railFillMesh) applyStencil(this.railFillMesh);
        if (this.tableMesh) applyStencil(this.tableMesh);
    }

    setDebugMode(enabled: boolean) {
        if (this.debugMode === enabled) return;
        this.debugMode = enabled;
        this.updatePocketDebugMaterials();
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
                const tex = material.userData.baseMap ?? this.getPocketGradientTexture();
                material.userData.baseMap = tex;
                material.map = tex;
                material.color.copy(baseColor);
            }
            material.needsUpdate = true;
        });

        this.applyPocketsVisibility(this.layerVisibility.showPockets);
    }

    private applyPocketsVisibility(visible: boolean) {
        this.pocketMeshes.forEach((mesh) => (mesh.visible = visible));
        this.pocketBottomMeshes.forEach((mesh) => (mesh.visible = visible));
        this.pocketMaskMeshes.forEach((mesh) => (mesh.visible = visible));
        this.pocketOccluderMeshes.forEach((mesh) => (mesh.visible = visible));
        const gradientVisible = visible && !this.debugMode && this.pocketGradientStrength > 1e-3;
        this.pocketGradientMeshes.forEach((mesh) => (mesh.visible = gradientVisible));
        this.pocketShadowMeshes.forEach((mesh) => (mesh.visible = visible));
        this.pocketHighlightMeshes.forEach((mesh) => (mesh.visible = visible));
        this.pocketGrooveMeshes.forEach((mesh) => (mesh.visible = visible));
        this.pocketRimMeshes.forEach((mesh) => (mesh.visible = visible));
    }

    setLayerVisibility(layer: RenderLayerBooleanKey, visible: boolean) {
        this.layerVisibility[layer] = visible;
        switch (layer) {
            case 'showTable':
                if (this.tableMesh) this.tableMesh.visible = visible;
                break;
            case 'showFrame':
                if (this.frameMesh) this.frameMesh.visible = visible;
                this.applyFrameRenderOrder();
                break;
            case 'showRails':
                this.railMeshes.forEach((m) => (m.visible = visible));
                this.railHighlightMeshes.forEach((m) => (m.visible = visible));
                this.railShadowMeshes.forEach((m) => (m.visible = visible));
                if (this.railFillMesh) this.railFillMesh.visible = visible;
                break;
            case 'showPockets':
                this.applyPocketsVisibility(visible);
                break;
            case 'showCaps':
                this.pocketCapMeshes.forEach((m) => (m.visible = visible));
                break;
        }
    }

    setPocketGradientStrength(value: number) {
        this.pocketGradientStrength = Math.max(0, Math.min(1, value));
        console.log('[TableRenderer] setPocketGradientStrength', this.pocketGradientStrength, 'meshes', this.pocketGradientMeshes.length);
        const tex = this.getPocketGradientTexture(true);
        const gradientVisible = this.pocketGradientStrength > 1e-3 && !this.debugMode && this.layerVisibility.showPockets;
        this.pocketGradientMeshes.forEach((m, idx) => {
            const mat = m.material as THREE.MeshBasicMaterial;
            const baseOpacity = mat.userData?.baseOpacity ?? mat.opacity ?? 1;
            mat.map = tex;
            mat.opacity = baseOpacity * this.pocketGradientStrength;
            mat.transparent = true;
            if (mat.map) {
                mat.map.needsUpdate = true;
            }
            mat.needsUpdate = true;
            m.visible = gradientVisible;
            console.log('[TableRenderer] gradient mesh', idx, 'opacity', mat.opacity.toFixed(3), 'visible', m.visible);
        });
        this.pocketCapMeshes.forEach((m, idx) => {
            const mat = m.material as THREE.MeshBasicMaterial;
            mat.map = tex;
            mat.userData = mat.userData ?? {};
            mat.userData.baseMap = tex;
            if (mat.map) {
                mat.map.needsUpdate = true;
            }
            mat.needsUpdate = true;
            console.log('[TableRenderer] cap mesh', idx, 'map refreshed');
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
        console.log('[TableRenderer] setPocketShadeColors', colors);
        if (colors.grooveColor) {
            try { this.grooveColor = new THREE.Color(colors.grooveColor); } catch { }
            this.pocketGrooveMeshes.forEach((m) => {
                const mat = m.material as THREE.MeshBasicMaterial; mat.color = this.grooveColor.clone(); mat.needsUpdate = true;
            });
        }
        if (colors.rimColor) {
            try { this.rimColor = new THREE.Color(colors.rimColor); } catch { }
            this.pocketRimMeshes.forEach((m) => {
                const mat = m.material as THREE.MeshBasicMaterial; mat.color = this.rimColor.clone(); mat.needsUpdate = true;
            });
        }
        if (colors.bottomColor) {
            try { this.pocketBottomColor = new THREE.Color(colors.bottomColor); } catch { }
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
                if (mat.map) {
                    mat.map.needsUpdate = true;
                }
                mat.needsUpdate = true;
            });
            this.pocketCapMeshes.forEach((m) => {
                const mat = m.material as THREE.MeshBasicMaterial;
                mat.map = tex;
                mat.userData = mat.userData ?? {};
                mat.userData.baseMap = tex;
                if (mat.map) {
                    mat.map.needsUpdate = true;
                }
                mat.needsUpdate = true;
            });
        }
        if (colors.wallColor) {
            try { this.pocketWallColor = new THREE.Color(colors.wallColor); } catch { }
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

    applyRenderOrder(settings: RenderLayerSettings) {
        this.layerOrder.orderTable = settings.orderTable;
        this.layerOrder.orderFrame = settings.orderFrame;
        this.layerOrder.orderRails = settings.orderRails;
        this.layerOrder.orderPockets = settings.orderPockets;
        this.layerOrder.orderCaps = settings.orderCaps;

        if (this.tableMesh) this.tableMesh.renderOrder = this.layerOrder.orderTable;
        this.applyFrameRenderOrder();
        this.railMeshes.forEach(m => m.renderOrder = this.layerOrder.orderRails);
        this.railHighlightMeshes.forEach(m => m.renderOrder = this.layerOrder.orderRails + 0.1);
        this.railShadowMeshes.forEach(m => m.renderOrder = this.layerOrder.orderRails - 0.05);
        this.pocketMeshes.forEach(m => m.renderOrder = this.layerOrder.orderPockets);
        this.pocketBottomMeshes.forEach(m => m.renderOrder = this.layerOrder.orderPockets + 0.05);
        this.pocketGradientMeshes.forEach(m => m.renderOrder = this.layerOrder.orderPockets + 0.1);
        this.pocketCapMeshes.forEach(m => m.renderOrder = this.layerOrder.orderCaps);
        this.pocketShadowMeshes.forEach(m => m.renderOrder = this.layerOrder.orderPockets + 0.2);
        this.pocketGrooveMeshes.forEach(m => m.renderOrder = this.layerOrder.orderPockets + 0.21);
        this.pocketRimMeshes.forEach(m => m.renderOrder = this.layerOrder.orderPockets + 0.22);
        if (this.railFillMesh) this.railFillMesh.renderOrder = this.layerOrder.orderRails - 1;
    }

    setHighlightIntensities(intensities: { rail?: number; pocket?: number; railShadow?: number; pocketShadow?: number }) {
        if (intensities.rail !== undefined) {
            this.railHighlightIntensity = Math.max(0, intensities.rail);
        }
        if (intensities.railShadow !== undefined) {
            this.railShadowIntensity = Math.max(0, intensities.railShadow);
        }
        if (intensities.pocket !== undefined) {
            this.pocketHighlightIntensity = Math.max(0, intensities.pocket);
        }
        if (intensities.pocketShadow !== undefined) {
            this.pocketShadowIntensity = Math.max(0, intensities.pocketShadow);
        }
        this.updateRailLighting();
        this.updatePocketLighting();
    }

    getHighlightIntensities() {
        return {
            railHighlightIntensity: this.railHighlightIntensity,
            railShadowIntensity: this.railShadowIntensity,
            pocketHighlightIntensity: this.pocketHighlightIntensity,
            pocketShadowIntensity: this.pocketShadowIntensity,
        };
    }

    private updateRailLighting() {
        if (!this.railMeshes.length) return;
        const highlight = Math.max(0, this.railHighlightIntensity * this.railHighlightSpread);
        this.railMeshes.forEach((mesh) => {
            const mat = mesh.material as THREE.MeshStandardMaterial | undefined;
            if (!mat) return;
            mat.userData = mat.userData ?? {};
            if (!mat.userData.baseColor) {
                mat.userData.baseColor = (mat.color as THREE.Color).clone();
            }
            const baseColor: THREE.Color = (mat.userData.baseColor as THREE.Color).clone();
            mat.color.copy(baseColor);
            // Rail shadow handled by ribbon; leave base rail color untouched here
            mat.emissive = mat.emissive ?? new THREE.Color(0x000000);
            mat.emissive.copy(this.railHighlightColor);
            mat.emissiveIntensity = Math.max(0, Math.min(2, highlight * 0.7));
            mat.needsUpdate = true;
        });

        // Update overlay ribbons (additive highlight and multiply shadow)
        this.railHighlightMeshes.forEach((mesh) => {
            const mat = mesh.material as THREE.MeshBasicMaterial | undefined;
            if (!mat) return;
            mat.color.copy(this.railHighlightColor);
            mat.userData = mat.userData ?? {};
            const baseOpacity: number = mat.userData.baseOpacity ?? mat.opacity ?? 0.15;
            mat.opacity = Math.max(0, baseOpacity * this.railHighlightIntensity);
            const widthScale = Math.max(0.1, 0.8 + this.railHighlightSpread * 0.6);
            mesh.scale.y = widthScale;
            const basePos = mesh.userData.basePos as { x: number; y: number } | undefined;
            const normal = mesh.userData.normal as { x: number; y: number } | undefined;
            if (basePos && normal) {
                const shift = -Math.max(0, this.railHighlightSpread - 1) * ((mesh.userData.baseWidth ?? 1) * 0.25);
                mesh.position.x = basePos.x + normal.x * shift;
                mesh.position.y = basePos.y + normal.y * shift;
            }
            mat.needsUpdate = true;
        });
        this.updateRailShadowRibbonMaterial();
        this.updateRailHighlightRibbonMaterial();
    }

    private updatePocketLighting() {
        const applyOpacity = (mesh: THREE.Mesh, intensity: number) => {
            const mat = mesh.material as THREE.MeshBasicMaterial | undefined;
            if (!mat) return;
            mat.userData = mat.userData ?? {};
            if (mat.userData.baseOpacity === undefined) {
                mat.userData.baseOpacity = mat.opacity ?? 1;
            }
            const baseOpacity: number = mat.userData.baseOpacity as number;
            mat.opacity = Math.max(0, baseOpacity * intensity);
            mat.needsUpdate = true;
        };

        const pocketHighlight = Math.max(0, this.pocketHighlightIntensity);
        const pocketShadow = Math.max(0, this.pocketShadowIntensity);

        this.pocketHighlightMeshes.forEach((mesh) => applyOpacity(mesh, pocketHighlight));
        this.pocketShadowMeshes.forEach((mesh) => applyOpacity(mesh, pocketShadow));
    }

    setRailShadowSoftness(val: number) {
        this.railShadowSoftness = val;
        this.resetRailShadowMaterial();
        this.rebuildRailShadowRibbon();
        this.updateRailShadowRibbonMaterial();
    }
    setRailShadowBaseGray(val: number) {
        this.railShadowBaseGray = Math.max(0, Math.min(255, val));
        this.resetRailShadowMaterial();
        this.rebuildRailShadowRibbon();
        this.updateRailShadowRibbonMaterial();
    }
    setRailHighlightSpread(val: number) {
        this.railHighlightSpread = Math.max(0, val);
        this.rebuildRailHighlightRibbon();
        this.updateRailLighting();
    }
    setRailHighlightColor(val: THREE.Color | string) {
        try {
            this.railHighlightColor = typeof val === 'string' ? new THREE.Color(val) : val;
        } catch {
            this.railHighlightColor = new THREE.Color(0xffffff);
        }
        this.updateRailLighting();
    }
    setRailShadowSpread(val: number) { this.railShadowSpread = Math.max(0, val); this.rebuildRailShadowRibbon(); this.updateRailShadowRibbonMaterial(); }

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

        // Remove existing bottom/gradient meshes as they depend on groove inner radius
        this.pocketBottomMeshes.forEach((m) => {
            this.scene.remove(m);
            m.geometry.dispose();
            (m.material as THREE.Material).dispose();
        });
        this.pocketBottomMeshes = [];
        this.pocketGradientMeshes.forEach((m) => {
            this.scene.remove(m);
            m.geometry.dispose();
            (m.material as THREE.Material).dispose();
        });
        this.pocketGradientMeshes = [];

        if (!this.lastPocketDefs.length) return;
        // Recreate groove/rim/bottom/gradient for current pockets
        this.lastPocketDefs.forEach((p) => {
            const visualRadius = p.visualRadius ?? (p as any).radius ?? 2.5;
            const shelfDepthIn = p.shelfDepth ?? CONFIG.POCKET_SHELF_DEPTH_IN;
            // Normalize shelf depth for groove geometry using full 0-3 slider range
            const depthFactor = Math.max(0, Math.min(1, (shelfDepthIn ?? 0.5) / 3.0));

            const grooveInner = visualRadius * (this.grooveInnerBase + this.grooveInnerDepthScale * depthFactor);
            const grooveOuter = grooveInner + visualRadius * this.grooveThicknessFactor;
            const grooveGeometry = new THREE.RingGeometry(grooveInner, grooveOuter, 96, 1, 0, Math.PI * 2);
            const grooveMaterial = new THREE.MeshBasicMaterial({
                color: this.grooveColor,
                transparent: true,
                opacity: this.grooveOpacityBase + this.grooveOpacityDepthScale * depthFactor,
                depthTest: false,
                depthWrite: false,
                side: THREE.DoubleSide,
            });
            const gm = new THREE.Mesh(grooveGeometry, grooveMaterial);
            gm.position.set(p.center.x, p.center.y, 0.46);
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
                color: this.rimColor,
                transparent: true,
                opacity: this.grooveRimOuterOpacity * (0.5 + 0.5 * depthFactor),
                blending: THREE.AdditiveBlending,
                depthTest: false,
                depthWrite: false,
                side: THREE.DoubleSide,
            });
            const rm = new THREE.Mesh(rimGeometry, rimMaterial);
            rm.position.set(p.center.x, p.center.y, 0.47);
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
                color: this.rimColor,
                transparent: true,
                opacity: this.grooveRimInnerOpacity * (0.5 + 0.5 * depthFactor),
                blending: THREE.AdditiveBlending,
                depthTest: false,
                depthWrite: false,
                side: THREE.DoubleSide,
            });
            const rm2 = new THREE.Mesh(rim2Geometry, rim2Material);
            rm2.position.set(p.center.x, p.center.y, 0.47);
            rm2.rotation.z = THREE.MathUtils.degToRad(p.cutAngleDeg ?? 0);
            rm2.renderOrder = this.layerOrder.orderPockets + 0.22;
            rm2.visible = this.layerVisibility.showPockets;
            this.enforceRenderOrderControl(rm2, { disableDepth: true });
            this.scene.add(rm2);
            this.pocketRimMeshes.push(rm2);

            // Rebuild Bottom Mesh
            const circleShape = new THREE.Shape();
            const radius = grooveInner * 0.98; // Slightly smaller than groove inner
            circleShape.absarc(0, 0, radius, 0, Math.PI * 2, false);
            const bottomGeometry = new THREE.ShapeGeometry(circleShape);

            const bottomMaterial = new THREE.MeshBasicMaterial({
                color: this.pocketBottomColor,
                side: THREE.DoubleSide,
                depthTest: true,
                depthWrite: true,
            });
            const bottomMesh = new THREE.Mesh(bottomGeometry, bottomMaterial);
            bottomMesh.position.set(p.center.x, p.center.y, 0.43);
            bottomMesh.rotation.z = THREE.MathUtils.degToRad(p.cutAngleDeg ?? 0);

            bottomMesh.renderOrder = this.layerOrder.orderPockets - 0.2;
            bottomMesh.visible = this.layerVisibility.showPockets;
            this.scene.add(bottomMesh);
            this.pocketBottomMeshes.push(bottomMesh);

            // Rebuild Gradient Mesh
            const gradientInnerRadius = Math.max(0.01, grooveInner * 0.99); // Just inside groove
            const gradientGeometry = new THREE.RingGeometry(
                gradientInnerRadius,
                visualRadius,
                64,
                1,
                0,
                Math.PI * 2
            );

            const uvAttribute = gradientGeometry.attributes.uv;
            const posAttribute = gradientGeometry.attributes.position;
            for (let i = 0; i < uvAttribute.count; i++) {
                const x = posAttribute.getX(i);
                const y = posAttribute.getY(i);
                // Map UV from inner radius to outer radius of the ring
                const distFromCenter = Math.sqrt(x * x + y * y);
                const normalizedDist = (distFromCenter - gradientInnerRadius) / (visualRadius - gradientInnerRadius);
                const u = (x / visualRadius + 1) * 0.5;
                const v = (y / visualRadius + 1) * 0.5;
                // Remap so gradient goes from inner edge (0) to outer edge (1)
                const remappedU = 0.5 + (u - 0.5) * (1 - normalizedDist);
                const remappedV = 0.5 + (v - 0.5) * (1 - normalizedDist);
                uvAttribute.setXY(i, remappedU, remappedV);
            }
            uvAttribute.needsUpdate = true;

            const gradientTexture = this.getPocketGradientTexture();
            const gradientMat = new THREE.MeshBasicMaterial({
                map: gradientTexture,
                transparent: true,
                depthTest: true,
                depthWrite: false,
                side: THREE.DoubleSide,
            });
            const baseOpacity = 0.65 + 0.35 * depthFactor;
            gradientMat.userData = gradientMat.userData ?? {};
            gradientMat.userData.baseOpacity = baseOpacity;
            gradientMat.opacity = baseOpacity * this.pocketGradientStrength;
            const gradientMesh = new THREE.Mesh(gradientGeometry, gradientMat);
            gradientMesh.position.set(p.center.x, p.center.y, 0.44);
            gradientMesh.rotation.z = THREE.MathUtils.degToRad(p.cutAngleDeg ?? 0);

            gradientMesh.renderOrder = this.layerOrder.orderPockets + 0.1;
            gradientMesh.visible = this.layerVisibility.showPockets && !this.debugMode && this.pocketGradientStrength > 1e-3;
            this.scene.add(gradientMesh);
            this.pocketGradientMeshes.push(gradientMesh);
        });
    }
    /**
     * Legacy method for backward compatibility.
     * Delegates to the new appearance system.
     */
    regenerateTextures() {
        console.log('♻️ Regenerating textures (using new appearance system)...');
        const appearance = this.settingsManager.getTableAppearance();
        this.applyAppearance(appearance);
    }

    setTexturesEnabled(enabled: boolean) {
        this.layerVisibility.showTextures = enabled;

        if (this.feltMaterial) {
            this.feltMaterial.map = enabled ? this.feltTexture : null;
            this.feltMaterial.needsUpdate = true;
        }

        if (this.frameMaterial) {
            this.frameMaterial.map = enabled ? this.frameTexture : null;
            this.frameMaterial.needsUpdate = true;
        }

        if (this.frameMesh) {
            this.frameMesh.traverse((obj) => {
                if ((obj as THREE.Mesh).isMesh && obj.name === 'frame-body') {
                    const mesh = obj as THREE.Mesh;
                    const mat = mesh.material as THREE.MeshStandardMaterial;
                    mat.map = enabled ? this.frameTexture : null;
                    mat.needsUpdate = true;
                }
            });
        }
    }

    // ─────────────────────────────────────────────────────────────
    // New Texture System Methods
    // ─────────────────────────────────────────────────────────────

    /**
     * Apply world-aligned UVs to a geometry so textures tile uniformly
     * regardless of mesh shape or position.
     */
    private applyWorldAlignedUVs(geometry: THREE.BufferGeometry, bounds: BoundaryBounds): void {
        const positions = geometry.attributes.position;
        const uvs = new Float32Array(positions.count * 2);

        const width = bounds.maxX - bounds.minX;
        const height = bounds.maxY - bounds.minY;

        for (let i = 0; i < positions.count; i++) {
            const x = positions.getX(i);
            const y = positions.getY(i);

            // Normalize to 0-1 based on world bounds
            uvs[i * 2] = (x - bounds.minX) / width;
            uvs[i * 2 + 1] = (y - bounds.minY) / height;
        }

        geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    }

    /**
     * Apply new appearance settings - regenerates textures and updates materials
     */
    applyAppearance(appearance: TableAppearance): void {
        console.log('🎨 Applying table appearance:', appearance);


        // Update texture manager and regenerate
        this.textureManager.setAppearance(appearance);
        const textures = this.textureManager.generateTextures();

        // Ensure textures are enabled when applying appearance
        this.layerVisibility.showTextures = true;

        // Update felt
        this.feltTexture?.dispose();
        this.feltTexture = textures.felt;

        if (this.feltMaterial) {
            this.feltMaterial.color.set(appearance.felt.color);
            this.feltMaterial.map = this.layerVisibility.showTextures ? this.feltTexture : null;
            this.feltMaterial.roughness = appearance.felt.roughness;
            this.feltMaterial.needsUpdate = true;
        }

        // Update frame
        this.frameTexture?.dispose();
        this.frameTexture = textures.frame;

        if (this.frameMaterial) {
            this.frameMaterial.color.set(appearance.frame.color);
            this.frameMaterial.map = this.layerVisibility.showTextures ? this.frameTexture : null;
            this.frameMaterial.roughness = 1.0 - appearance.frame.glossiness * 0.6;
            this.frameMaterial.needsUpdate = true;
        }

        // Update frame mesh materials
        if (this.frameMesh) {
            this.frameMesh.traverse((obj) => {
                if ((obj as THREE.Mesh).isMesh && obj.name === 'frame-body') {
                    const mat = (obj as THREE.Mesh).material as THREE.MeshStandardMaterial;
                    mat.color.set(appearance.frame.color);
                    mat.map = this.layerVisibility.showTextures ? this.frameTexture : null;
                    mat.roughness = 1.0 - appearance.frame.glossiness * 0.6;
                    mat.needsUpdate = true;
                }
            });
        }

        // Update corner fill color (cushion controls this)
        CONFIG.RAIL_FILL_COLOR = appearance.cushion.color;
        this.updateRailFillMaterialColor();

        // Update pocket colors
        this.pocketBottomColor.set(appearance.pocket.color);
        this.pocketBottomMeshes.forEach(mesh => {
            const mat = mesh.material as THREE.MeshBasicMaterial;
            mat.color.set(appearance.pocket.color);
            mat.needsUpdate = true;
        });

        // Sync with CONFIG for other systems
        CONFIG.TABLE_COLOR = appearance.felt.color;
        CONFIG.FRAME_COLOR = appearance.frame.color;
    }
}

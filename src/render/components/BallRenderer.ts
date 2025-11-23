import * as THREE from 'three';
import { FBXLoader } from 'three-stdlib';
import { fetchWithCache } from '../AssetCache';
import { CONFIG, BALL_CUE } from '../../config';
import { Ball } from '../../physics/Shapes';
import { RenderLayerSettings, RenderLayerOrderKey, RenderLayerBooleanKey } from '../RenderLayers';

export class BallRenderer {
    private scene: THREE.Scene;
    private layerOrder: Record<RenderLayerOrderKey, number>;
    private layerVisibility: Record<RenderLayerBooleanKey, boolean>;

    ballMeshes: Map<number, THREE.Mesh> = new Map();
    ballModels: Map<number, { geometry: THREE.BufferGeometry; material: THREE.MeshStandardMaterial }> = new Map();
    ballModelsLoaded: boolean = false;
    ballScale: number = 1.0;

    private ballIconCaches: Map<number, Map<number, string>> = new Map();

    constructor(
        scene: THREE.Scene,
        layerOrder: Record<RenderLayerOrderKey, number>,
        layerVisibility: Record<RenderLayerBooleanKey, boolean>
    ) {
        this.scene = scene;
        this.layerOrder = layerOrder;
        this.layerVisibility = layerVisibility;
    }

    createBall(ball: Ball): THREE.Mesh {
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
            const quat = new THREE.Quaternion().setFromUnitVectors(up, normal);
            spotMesh.quaternion.copy(quat);
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
            side: THREE.BackSide,
            depthTest: true,
            depthWrite: false,
        });
        glowMaterial.needsUpdate = true;

        const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
        glowMesh.name = 'ball-glow';
        glowMesh.renderOrder = this.layerOrder.orderBalls - 1;
        mesh.add(glowMesh);
    }

    applyBallRenderOrder(mesh: THREE.Object3D) {
        mesh.renderOrder = this.layerOrder.orderBalls;
        mesh.children.forEach((child) => {
            if (child.name === 'ball-glow') {
                child.renderOrder = this.layerOrder.orderBalls - 1;
            } else {
                child.renderOrder = this.layerOrder.orderBalls;
            }
        });
    }

    private addBallNumber(mesh: THREE.Mesh, ballId: number) {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d')!;

        if (ballId >= 9 && ballId <= 15) {
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(128, 128, 80, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        ctx.fillStyle = ballId >= 9 && ballId <= 15 ? '#000000' : '#ffffff';
        ctx.font = 'bold 120px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.shadowColor = ballId >= 9 && ballId <= 15 ? 'rgba(0, 0, 0, 0.3)' : 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;

        ctx.fillText(ballId.toString(), 128, 128);

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;

        const spriteMaterial = new THREE.SpriteMaterial({
            map: texture,
            transparent: true
        });
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.scale.set(2, 2, 1);
        sprite.position.set(0, 0, 0.01);

        mesh.add(sprite);
    }

    private addBallStripe(mesh: THREE.Mesh, radius: number) {
        const stripeHeight = radius * 0.6;
        const stripeGeometry = new THREE.CylinderGeometry(
            radius * 1.01,
            radius * 1.01,
            stripeHeight,
            32,
            1,
            true
        );
        const stripeMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.3,
            metalness: 0.4,
            side: THREE.DoubleSide
        });
        const stripe = new THREE.Mesh(stripeGeometry, stripeMaterial);
        stripe.rotation.x = Math.PI / 2;

        mesh.add(stripe);
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

    setBallScale(scale: number) {
        this.ballScale = scale;
        this.ballMeshes.forEach((mesh) => {
            mesh.scale.setScalar(scale);
        });
    }

    updateBalls(balls: Ball[], alpha: number) {
        balls.forEach((ball) => {
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

            const x = ball.prevX + (ball.x - ball.prevX) * alpha;
            const y = ball.prevY + (ball.y - ball.prevY) * alpha;

            const shouldRenderBall = this.layerVisibility.showBalls;
            mesh.visible = shouldRenderBall;
            if (!shouldRenderBall) {
                mesh.position.set(x, y, CONFIG.BALL_RADIUS);
                return;
            }

            mesh.position.set(x, y, CONFIG.BALL_RADIUS);
            mesh.quaternion.set(ball.rotX, ball.rotY, ball.rotZ, ball.rotW);
        });
    }

    clearBalls() {
        this.ballMeshes.forEach((mesh) => {
            this.scene.remove(mesh);
            mesh.geometry.dispose();
            const material = mesh.material as THREE.Material | THREE.Material[];
            if (Array.isArray(material)) {
                material.forEach((m) => m.dispose());
            } else {
                material.dispose();
            }
        });
        this.ballMeshes.clear();
    }

    registerBallModel(id: number, geometry: THREE.BufferGeometry, material: THREE.MeshStandardMaterial) {
        this.ballModels.set(id, { geometry, material });
    }

    setModelsLoaded(loaded: boolean) {
        this.ballModelsLoaded = loaded;
    }

    areModelsLoaded(): boolean {
        return this.ballModelsLoaded;
    }

    getModelCount(): number {
        return this.ballModels.size;
    }

    async loadModels(onProgress?: (msg: string) => void) {
        const startTime = performance.now();
        console.log('⏳ Loading ball models...');
        console.log('📊 Performance Profile:');
        if (onProgress) onProgress('Loading ball models...');

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
            8: '/textures/poolballTx8.jpg',
            9: '/textures/poolballTx9.jpg',
            10: '/textures/poolballTx10.jpg',
            11: '/textures/poolballTx11.jpg',
            12: '/textures/poolballTx12.jpg',
            13: '/textures/poolballTx13.jpg',
            14: '/textures/poolballTx14.jpg',
            15: '/textures/poolballTx15.jpg'
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
                                    loadedTexture.anisotropy = 4;
                                    loadedTexture.generateMipmaps = true;
                                    loadedTexture.minFilter = THREE.LinearMipmapLinearFilter;
                                    loadedTexture.magFilter = THREE.LinearFilter;
                                    texturesLoaded++;
                                    console.log(`  Texture ${texturesLoaded}/${totalTextures} loaded`);
                                    if (onProgress) onProgress(`Loading textures... ${texturesLoaded}/${totalTextures}`);
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
            if (onProgress) onProgress('Loading 3D models (16MB)...');
            const fbxStart = performance.now();

            const fbxData = await fetchWithCache('/poolballs.fbx', 'fbx');
            const fbxBlob = new Blob([fbxData], { type: 'application/octet-stream' });
            const fbxBlobUrl = URL.createObjectURL(fbxBlob);

            const fbx = await loader.loadAsync(fbxBlobUrl);
            URL.revokeObjectURL(fbxBlobUrl);

            const fbxTime = performance.now() - fbxStart;
            console.log(`  ⏱️ FBX + Textures loaded in ${fbxTime.toFixed(0)}ms`);
            console.log('  FBX loaded, processing geometry...');
            if (onProgress) onProgress('Processing geometry...');

            const geometryStart = performance.now();
            const textureCache = new Map<number, THREE.Texture>();
            loadedTextures.forEach(([id, tex]) => {
                if (tex) textureCache.set(id, tex);
            });

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

                this.registerBallModel(ballId, geometry, material);
            });

            const geometryTime = performance.now() - geometryStart;
            console.log(`  ⏱️ Geometry processing: ${geometryTime.toFixed(0)}ms`);

            this.setModelsLoaded(true);
            if (this.areModelsLoaded()) {
                const elapsed = performance.now() - startTime;
                const seconds = (elapsed / 1000).toFixed(1);
                console.info(`✓ Loaded ${this.getModelCount()} FBX ball models in ${seconds}s (${elapsed.toFixed(0)}ms)`);
                console.info(`📊 Breakdown:`);
                console.info(`  - FBX + Textures: ${fbxTime.toFixed(0)}ms (${(fbxTime / elapsed * 100).toFixed(1)}%)`);
                console.info(`  - Geometry processing: ${geometryTime.toFixed(0)}ms (${(geometryTime / elapsed * 100).toFixed(1)}%)`);

                this.clearBalls();
            }
        } catch (error) {
            console.error('✗ Error loading FBX:', error);
            this.setModelsLoaded(false);
        }
    }

    async generateBallIcons(sizePx: number, renderer: THREE.WebGLRenderer): Promise<Map<number, string>> {
        if (this.ballIconCaches.has(sizePx)) {
            return this.ballIconCaches.get(sizePx)!;
        }

        const icons = new Map<number, string>();
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
        camera.position.set(0, 0, 3.5 * CONFIG.BALL_RADIUS);
        camera.lookAt(0, 0, 0);

        const light = new THREE.DirectionalLight(0xffffff, 1.2);
        light.position.set(1, 1, 2);
        scene.add(light);
        scene.add(new THREE.AmbientLight(0xffffff, 0.4));

        const renderTarget = new THREE.WebGLRenderTarget(sizePx, sizePx, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
            colorSpace: THREE.SRGBColorSpace
        });

        const balls = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

        const originalTarget = renderer.getRenderTarget();
        const originalClearColor = renderer.getClearColor(new THREE.Color());
        const originalClearAlpha = renderer.getClearAlpha();

        renderer.setClearColor(0x000000, 0);

        for (const ballId of balls) {
            let mesh: THREE.Mesh;
            if (this.ballModelsLoaded && this.ballModels.has(ballId)) {
                const template = this.ballModels.get(ballId)!;
                mesh = new THREE.Mesh(template.geometry, template.material);
                if (ballId === BALL_CUE) {
                    this.addCueBallMeasles(mesh, CONFIG.BALL_RADIUS);
                }
            } else {
                const geometry = new THREE.SphereGeometry(CONFIG.BALL_RADIUS, 32, 32);
                const color = ballId === BALL_CUE
                    ? new THREE.Color(CONFIG.CUE_BALL_COLOR)
                    : new THREE.Color(CONFIG.BALL_COLORS[ballId - 1]);
                const material = new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.4 });
                mesh = new THREE.Mesh(geometry, material);
                if (ballId !== BALL_CUE) this.addBallNumber(mesh, ballId);
                if (ballId >= 9 && ballId <= 15) this.addBallStripe(mesh, CONFIG.BALL_RADIUS);
                if (ballId === BALL_CUE) this.addCueBallMeasles(mesh, CONFIG.BALL_RADIUS);
            }

            mesh.position.set(0, 0, 0);
            // Rotate to show number nicely
            mesh.rotation.x = Math.PI / 4;
            mesh.rotation.z = Math.PI / 4;

            scene.add(mesh);

            renderer.setRenderTarget(renderTarget);
            renderer.clear();
            renderer.render(scene, camera);

            const buffer = new Uint8Array(sizePx * sizePx * 4);
            renderer.readRenderTargetPixels(renderTarget, 0, 0, sizePx, sizePx, buffer);

            const canvas = document.createElement('canvas');
            canvas.width = sizePx;
            canvas.height = sizePx;
            const ctx = canvas.getContext('2d')!;
            const imageData = ctx.createImageData(sizePx, sizePx);

            for (let y = 0; y < sizePx; y++) {
                for (let x = 0; x < sizePx; x++) {
                    const srcIdx = ((sizePx - 1 - y) * sizePx + x) * 4;
                    const dstIdx = (y * sizePx + x) * 4;
                    imageData.data[dstIdx] = buffer[srcIdx];
                    imageData.data[dstIdx + 1] = buffer[srcIdx + 1];
                    imageData.data[dstIdx + 2] = buffer[srcIdx + 2];
                    imageData.data[dstIdx + 3] = buffer[srcIdx + 3];
                }
            }
            ctx.putImageData(imageData, 0, 0);
            icons.set(ballId, canvas.toDataURL());

            scene.remove(mesh);
        }

        renderer.setRenderTarget(originalTarget);
        renderer.setClearColor(originalClearColor, originalClearAlpha);
        renderTarget.dispose();

        this.ballIconCaches.set(sizePx, icons);
        return icons;
    }
    setLayerVisibility(layer: RenderLayerBooleanKey, visible: boolean) {
        this.layerVisibility[layer] = visible;
        if (layer === 'showBalls') {
            this.ballMeshes.forEach((mesh) => {
                mesh.visible = visible;
            });
        }
    }

    setDebugMode(enabled: boolean) {
        // Placeholder for future debug visualization on balls
    }

    applyRenderOrder(settings: RenderLayerSettings) {
        this.layerOrder.orderBalls = settings.orderBalls;
        this.ballMeshes.forEach((mesh) => {
            this.applyBallRenderOrder(mesh);
        });
    }
}

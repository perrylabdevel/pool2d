// Main game controller

import { PhysicsWorld } from '../physics/Physics';
import { Ball } from '../physics/Shapes';
import { Renderer3D } from '../render/Renderer3D';
import { InputManager } from '../input/Input';
import { DebugDraw } from '../debug/DebugDraw';
import { HUD } from '../ui/HUD';
import { CONFIG, CUE_BALL_POSITION, RACK_POSITIONS } from '../config';
import { getTableGeometry } from '../geometry/Geometry';
import { clampBallInHand } from '../geometry/Placement';
import { EightBallRules } from '../rules/EightBall';
import { physicsRecorder } from '../debug/PhysicsRecorder';
import { Predictor } from '../physics/Prediction';
import { shotCapture } from '../debug/ShotCapture';
import { SettingsPanel } from '../ui/SettingsPanel';
import { GeometryPanel } from '../ui/GeometryPanel';
import { ModernGeometryPanel } from '../ui/ModernGeometryPanel';
import { RenderLayerPanel } from '../ui/RenderLayerPanel';
import { scenarioManager } from '../debug/ScenarioManager';

export enum GameMode {
  PRACTICE,
  EIGHT_BALL,
}

function randomizeBallOrientation(ball: Ball) {
  const axisZ = Math.random() * 2 - 1;
  const axisRadius = Math.sqrt(Math.max(0, 1 - axisZ * axisZ));
  const axisTheta = Math.random() * Math.PI * 2;
  const axisX = axisRadius * Math.cos(axisTheta);
  const axisY = axisRadius * Math.sin(axisTheta);
  const angle = Math.random() * Math.PI * 2;
  const halfAngle = angle * 0.5;
  const sinHalf = Math.sin(halfAngle);
  ball.rotX = axisX * sinHalf;
  ball.rotY = axisY * sinHalf;
  ball.rotZ = axisZ * sinHalf;
  ball.rotW = Math.cos(halfAngle);
}

export class Game {
  world: PhysicsWorld;
  renderer: Renderer3D;
  input: InputManager;
  hud: HUD;
  debug: DebugDraw;
  settings: SettingsPanel;
  geometryPanel: GeometryPanel;
  modernGeometryPanel: ModernGeometryPanel;
  renderLayersPanel: RenderLayerPanel;
  rules: EightBallRules;
  predictor: Predictor;
  mode: GameMode;
  private lastBallScale: number;
  private _lastCanvasScale?: number;
  
  // Game loop
  accumulator: number = 0;
  lastTime: number = 0;
  fpsFrames: number = 0;
  fpsTime: number = 0;
  upsSteps: number = 0;
  upsTime: number = 0;
  
  // Shooting state
  canShoot: boolean = true;
  cueBall: Ball | null = null;
  aimAssist: boolean = true;
  currentPower: number = 0;
  isDraggingPower: boolean = false;
  isAimMode: boolean = true; // true = aim, false = power
  lockedAngle: number = 0; // Locked angle when in power mode
  isSpacePowerMode: boolean = false;
  wasAimModeBeforeSpace: boolean = true;
  powerDragStartY: number = 0;
  spaceKeyHeld: boolean = false;
  
  // Cached prediction for frozen paths in power mode (normal mode only)
  cachedPrediction: ReturnType<Predictor['predictFirstContact']> | null = null;
  cachedDirection: { x: number; y: number } | null = null;
  
  // Ball dragging (practice mode only)
  isDraggingBall: boolean = false;
  
  constructor(gameCanvas: HTMLCanvasElement, debugCanvas: HTMLCanvasElement) {
    // Create HUD first - it initializes SettingsManager which loads and applies saved CONFIG values
    this.hud = new HUD();
    
    // Now create physics world - it will read the correct CONFIG values
    this.world = new PhysicsWorld();
    this.renderer = new Renderer3D(gameCanvas);
    this.input = new InputManager(gameCanvas);
    this.debug = new DebugDraw(debugCanvas);
    this.settings = new SettingsPanel(this.hud.settingsManager);
    this.geometryPanel = new GeometryPanel(this.hud.settingsManager, () => this.restart());
    this.modernGeometryPanel = new ModernGeometryPanel(this.hud.settingsManager, () => this.restart());
    this.renderLayersPanel = new RenderLayerPanel(this.hud.settingsManager, this.renderer);
    this.rules = new EightBallRules();
    this.predictor = new Predictor();
    this.mode = GameMode.PRACTICE;
    this.lastBallScale = CONFIG.BALL_SCALE ?? 1;

    this.registerPanels();

    this.setupCallbacks();
    this.setupEventListeners();
    this.initializeGame();
    scenarioManager.attach(this);
    
    // Log helpful tips
    if (this.mode === GameMode.PRACTICE) {
      console.log('💡 Tips:');
      console.log('  - Hold SHIFT and drag the cue ball to reposition it');
      console.log('  - Press G to open Geometry panel (live pocket adjustments)');
      console.log('  - Press M to open Modern Geometry panel (angle-based controls)');
      console.log('  - Press S to open Physics Settings panel');
      console.log('  - Press D for Debug view');
    }
  }
  
  setupCallbacks() {
    // Handle mouse events (power bar, ball dragging)
    this.input.canvas.addEventListener('mousedown', (e) => {
      this.handleBallDragStart(e);
      this.handlePowerBarMouseDown(e);
    });
    this.input.canvas.addEventListener('mousemove', (e) => {
      this.handleBallDrag(e);
      this.handlePowerBarMouseMove(e);
    });
    this.input.canvas.addEventListener('mouseup', (e) => {
      this.handleBallDragEnd(e);
      this.handlePowerBarMouseUp(e);
    });
    
    // Handle A key to toggle aim/power mode
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Shift') {
        this.input.setFineAimActive(true);
      }
      if (e.key === 'a' || e.key === 'A') {
        if (this.isAimMode && this.cueBall && !this.cueBall.pocketed) {
          this.lockedAngle = this.input.getAimAngle(this.cueBall);
        }
        this.isAimMode = !this.isAimMode;
        return;
      }
      if (e.code === 'Space') {
        if (e.repeat) return;
        if (!this.canShoot || !this.cueBall || this.cueBall.pocketed) return;
        e.preventDefault();
        this.spaceKeyHeld = true;
        this.wasAimModeBeforeSpace = this.isAimMode;
        if (this.isAimMode) {
          this.lockedAngle = this.input.getAimAngle(this.cueBall);
        }
        this.isAimMode = false;
        this.isSpacePowerMode = true;
        this.currentPower = 0;
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.key === 'Shift') {
        this.input.setFineAimActive(false);
      }
      if (e.code === 'Space') {
        if (!this.isSpacePowerMode) {
          this.spaceKeyHeld = false;
          return;
        }
        e.preventDefault();
        this.spaceKeyHeld = false;
        if (this.isDraggingPower) {
          return;
        }
        this.isSpacePowerMode = false;
        this.isAimMode = this.wasAimModeBeforeSpace;
        if (this.wasAimModeBeforeSpace) {
          this.currentPower = 0;
        }
      }
    });
    
    this.rules.onFoul = (message) => {
      this.hud.showFoul(message);
    };
    
    this.rules.onTurnChange = (player) => {
      this.hud.setTurn(player);
    };
    
    this.rules.onGameOver = (winner) => {
      this.hud.showFoul(`Player ${winner} wins!`);
    };
  }
  
  setupEventListeners() {
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('renderer:resized', (event: Event) => {
      const detail = (event as CustomEvent<{ width: number; height: number; scale: number; offsetX: number; offsetY: number }>).detail;
      if (!detail) return;
      // Keep input and debug overlay aligned with renderer canvas
      this.input.updateScale(detail.scale);
      this.debug.resize(detail.width, detail.height, detail.scale, detail.offsetX, detail.offsetY);
    });
    window.addEventListener('settings:render-changed', (event) => {
      const detail = (event as CustomEvent<{ settings?: { ballScale?: number; canvasScale?: number } }>).detail;
      const newBallScale = detail?.settings?.ballScale ?? CONFIG.BALL_SCALE ?? 1;
      const newCanvasScale = detail?.settings?.canvasScale ?? CONFIG.CANVAS_SCALE_MULTIPLIER ?? 1;

      // If ball visual scale changes, physics radius changes — restart world/renderer
      if (Math.abs(newBallScale - this.lastBallScale) > 1e-4) {
        this.lastBallScale = newBallScale;
        this.restart();
        return;
      }

      // Only resize if canvas scale actually changed; color/intensity changes should not trigger a resize
      this._lastCanvasScale = this._lastCanvasScale ?? (CONFIG.CANVAS_SCALE_MULTIPLIER ?? 1);
      if (Math.abs(newCanvasScale - this._lastCanvasScale) > 1e-4) {
        this._lastCanvasScale = newCanvasScale;
        this.resize();
      }
      // No action for pure color/intensity/layer changes
    });
    
    // Instant geometry apply: rebuild world and renderer without full reload
    window.addEventListener('settings:geometry-apply', () => {
      this.restart();
    });
    
    window.addEventListener('keydown', (e) => {
      if (e.key === 'd' || e.key === 'D') {
        this.debug.toggle();
        this.syncDebugModeWithRenderer();
      }
      if (e.key === 'r' || e.key === 'R') {
        this.restart();
      }
      if (e.key === 'm' || e.key === 'M') {
        const next = !this.renderer.showMeasurementOverlay;
        this.renderLayersPanel.setMeasurementOverlayVisible(next);
      }
      if ((e.key === 'o' || e.key === 'O') && e.shiftKey) {
        e.preventDefault();
        this.renderLayersPanel.toggleReferenceOverlay();
      }
      if (e.key === 'b' || e.key === 'B') {
        // Toggle ball-in-hand overlay (enables debug overlay if needed)
        const next = !this.debug.isBallInHandOverlayEnabled();
        this.debug.setBallInHandOverlayEnabled(next);
        this.syncDebugModeWithRenderer();
      }
      if (e.key === 'l' || e.key === 'L') {
        // Toggle verbose BIH console logging at runtime via a global flag
        const w: any = (typeof window !== 'undefined') ? window : {};
        w.__BIH_LOG__ = !w.__BIH_LOG__;
        if (w.__BIH_LOG__) {
          if (!this.debug.isBallInHandOverlayEnabled()) {
            this.debug.setBallInHandOverlayEnabled(true);
          }
          // eslint-disable-next-line no-console
          console.log('BIH logging ENABLED. Hold SHIFT and drag anywhere to test.');
        } else {
          // eslint-disable-next-line no-console
          console.log('BIH logging disabled.');
        }
        this.syncDebugModeWithRenderer();
      }
    });
    
    // Wire up debug toggle button
    const debugBtn = document.getElementById('debug-toggle');
    if (debugBtn) {
      debugBtn.addEventListener('click', () => {
        this.debug.toggle();
        this.syncDebugModeWithRenderer();
      });
    }
    
    // Wire up restart button
    const restartBtn = document.getElementById('restart-btn');
    if (restartBtn) {
      restartBtn.addEventListener('click', () => this.restart());
    }
    
    // Wire up shot capture button
    const captureShotBtn = document.getElementById('capture-shot-btn');
    if (captureShotBtn) {
      captureShotBtn.addEventListener('click', () => {
        shotCapture.startCapture();
        captureShotBtn.style.background = '#4CAF50'; // Highlight when active
        setTimeout(() => {
          captureShotBtn.style.background = '';
        }, 300);
      });
    }
  }

  private syncDebugModeWithRenderer() {
    this.renderer.setDebugMode(this.debug.isEnabled());
  }

  private registerPanels() {
    this.hud.registerPanel('physics-settings', this.settings.getController(), {
      hotkeys: ['s'],
      persistState: true,
    });
    this.hud.registerPanel('geometry-panel', this.geometryPanel.getController(), {
      hotkeys: ['g'],
      persistState: true,
    });
    this.hud.registerPanel('modern-geometry-panel', this.modernGeometryPanel.getController(), {
      hotkeys: ['p'],
      persistState: true,
    });
    this.hud.registerPanel('render-layer-panel', this.renderLayersPanel.getController(), {
      hotkeys: ['l'],
      persistState: true,
    });

    this.hud.panelManager.restoreLastPanel();
  }
  
  initializeGame() {
    this.world.balls = [];
    
    // Create cue ball with randomized initial rotation
    this.cueBall = new Ball(
      0,
      CUE_BALL_POSITION.x,
      CUE_BALL_POSITION.y,
      CONFIG.BALL_RADIUS,
      CONFIG.BALL_MASS
    );
    // Randomize initial rotation angle for visual variety
    this.cueBall.angle = Math.random() * Math.PI * 2;
    randomizeBallOrientation(this.cueBall);
    this.world.addBall(this.cueBall);

    const currentRadius = CONFIG.BALL_RADIUS;
    const radiusSafe = Math.max(currentRadius, 1e-6);
    const diameter = radiusSafe * 2;
    const rowSpacingX =
      diameter *
      Math.cos(Math.PI / 6); // Maintain equilateral triangle spacing regardless of base radius rounding
    const apexX = RACK_POSITIONS[0]?.x ?? 0;
    const apexY = RACK_POSITIONS[0]?.y ?? 0;

    // Create racked balls with randomized initial rotations
    const rowStarts = [0, 1, 3, 6, 10];
    rowStarts.forEach((startIndex, row) => {
      const endIndex = rowStarts[row + 1] ?? RACK_POSITIONS.length;
      const rowBalls = RACK_POSITIONS.slice(startIndex, endIndex);
      const rowX = apexX + rowSpacingX * row;
      rowBalls.forEach((pos, index) => {
        const ordinal = (rowBalls.length - 1) / 2 - index;
        const rowCenterOffset = ordinal * diameter;
        const scaledY = apexY + rowCenterOffset;
        const ball = new Ball(pos.id, rowX, scaledY, currentRadius, CONFIG.BALL_MASS);
        // Randomize initial rotation angle for visual variety
        ball.angle = Math.random() * Math.PI * 2;
        randomizeBallOrientation(ball);
        this.world.addBall(ball);
      });
    });
    
    // Initialize 3D scene
    this.renderer.initializeTable();
    this.renderer.initializeRails(this.world.rails);
    const geometry = getTableGeometry();
    this.renderer.initializePockets(geometry.pockets);
    
    // Connect debug overlay to renderer for coordinate projection
    this.debug.setRenderer(this.renderer);

    this.resize();
    this.rules.startGame();
    this.hud.setMode(this.mode === GameMode.PRACTICE ? 'Practice Mode' : '8-Ball');
    this.hud.setTurn(1);
    this.lastBallScale = CONFIG.BALL_SCALE ?? 1;
  }
  
  restart() {
    // Rebuild physics world (recomputes rails/pockets from current CONFIG)
    this.world = new PhysicsWorld();
    // Reset renderer table and rails to avoid duplicates
    const renderer3D = this.renderer as Renderer3D & { clearTableAndRails?: () => void; clearBalls?: () => void };
    if (typeof renderer3D.clearTableAndRails === 'function') {
      renderer3D.clearTableAndRails();
    }
    // Clear existing ball meshes so they get recreated with current settings
    if (typeof renderer3D.clearBalls === 'function') {
      renderer3D.clearBalls();
    }
    this.initializeGame();
  }

  private respawnCueBall() {
    if (!this.cueBall) return;

    this.cueBall.pocketed = false;
    this.cueBall.sleeping = true;
    this.cueBall.vx = 0;
    this.cueBall.vy = 0;
    this.cueBall.angularVelocity = 0;
    this.cueBall.angle = 0;
    this.cueBall.x = CUE_BALL_POSITION.x;
    this.cueBall.y = CUE_BALL_POSITION.y;
    this.cueBall.prevX = this.cueBall.x;
    this.cueBall.prevY = this.cueBall.y;
  }
  
  resize() {
    this.renderer.resize();
    this.input.updateScale(this.renderer.scale);
    this.debug.resize(
      this.renderer.uiCanvas.width,
      this.renderer.uiCanvas.height,
      this.renderer.scale,
      this.renderer.canvasOffsetX,
      this.renderer.canvasOffsetY
    );
  }
  
  shoot(angle: number, power: number) {
    if (!this.cueBall || this.cueBall.pocketed) return;
    
    // Clear cached prediction
    this.cachedPrediction = null;
    this.cachedDirection = null;
    
    // Record shot for capture system if active
    if (shotCapture.isCapturing()) {
      // Prefer physics-based prediction for capture (more accurate at glancing/rail cases)
      let prediction: ReturnType<typeof this.predictor.predictFirstContact>;
      const sim = this.predictor.simulateShotPaths(this.world, this.cueBall, angle, power);
      if (sim && sim.firstContact) {
        prediction = sim.firstContact;
      } else {
        const direction = { x: Math.cos(angle), y: Math.sin(angle) };
        prediction = this.predictor.predictFirstContact(
          { x: this.cueBall.x, y: this.cueBall.y },
          direction,
          this.world,
          this.cueBall
        );
      }
      shotCapture.recordShotStart(this.cueBall, angle, power, prediction);
    }
    
    // Apply power multiplier for realistic velocity
    const velocity = power * CONFIG.CUE_POWER_MULTIPLIER;
    const vx = Math.cos(angle) * velocity;
    const vy = Math.sin(angle) * velocity;
    
    this.cueBall.setVelocity(vx, vy);
    this.world.logShotSnapshot(angle, power);
    physicsRecorder.recordShot(angle, power);
    this.canShoot = false;
    if (this.mode === GameMode.EIGHT_BALL) {
      this.rules.startShot();
    }
  }
  
  update(dt: number) {
    this.accumulator += dt;
    
    while (this.accumulator >= CONFIG.PHYSICS_DT) {
      this.world.step(CONFIG.PHYSICS_DT);
      physicsRecorder.recordFrame(this.world);
      this.accumulator -= CONFIG.PHYSICS_DT;
      this.upsSteps++;
    }
    
    // Check if all balls are sleeping
    const allSleeping = this.world.balls.every(b => b.pocketed || b.sleeping);
    if (allSleeping && !this.canShoot) {
      this.canShoot = true;
      
      // Check for shot capture completion
      if (shotCapture.isCapturing() && this.cueBall) {
        const targetBall = this.world.balls.find(b => b.id !== 0 && !b.pocketed);
        shotCapture.checkForRest(this.cueBall, targetBall || null);
      }
      
      if (this.mode === GameMode.EIGHT_BALL) {
        this.rules.endShot(this.world.balls);
      }

      if (this.cueBall && this.cueBall.pocketed) {
        this.respawnCueBall();
      }
    }
  }
  
  render() {
    const alpha = this.accumulator / CONFIG.PHYSICS_DT;
    
    this.renderer.render(this.world, alpha);
    
    // Draw cue line and power bar if can shoot
    if (this.canShoot && this.cueBall && !this.cueBall.pocketed) {
      // Use locked angle in power mode, live angle in aim mode
      const angle = this.isAimMode ? this.input.getAimAngle(this.cueBall) : this.lockedAngle;
      
      // Predict first contact (always run to clip aim line at rails/balls)
      const direction = {
        x: Math.cos(angle),
        y: Math.sin(angle),
      };
      
      // In normal mode (not debug), use cached prediction when in power mode
      // This freezes the trajectory paths when transitioning from aim to power
      let prediction;
      let useCachedPrediction = false;
      
      if (this.isAimMode || this.debug.isEnabled()) {
        // Aim mode or debug mode: always recalculate
        prediction = this.predictor.predictFirstContact(
          { x: this.cueBall.x, y: this.cueBall.y },
          direction,
          this.world,
          this.cueBall
        );
        
        // Cache for power mode (normal mode only)
        if (this.isAimMode && !this.debug.isEnabled()) {
          this.cachedPrediction = prediction;
          this.cachedDirection = direction;
        }
      } else {
        // Power mode in normal mode: use cached prediction
        if (this.cachedPrediction && this.cachedDirection) {
          prediction = this.cachedPrediction;
          useCachedPrediction = true;
        } else {
          // Fallback if no cache
          prediction = this.predictor.predictFirstContact(
            { x: this.cueBall.x, y: this.cueBall.y },
            direction,
            this.world,
            this.cueBall
          );
        }
      }
      
      // Use physics simulation for aim assist, fall back to ray-cast for cue line clipping
      let shotPaths = null;
      if (this.aimAssist && this.debug.isEnabled()) {
        // Debug mode: always run physics simulation
        shotPaths = this.predictor.simulateShotPaths(
          this.world,
          this.cueBall,
          angle,
          this.currentPower
        );
      }
      
      // Draw trajectory lines if aim assist is enabled
      if (this.aimAssist) {
        if (this.debug.isEnabled() && shotPaths) {
          // Debug mode: use full physics simulation with colored styling
          this.renderer.drawPhysicsTrajectoryLines(shotPaths, { x: this.cueBall.x, y: this.cueBall.y }, true);
        } else if (prediction) {
          // Normal mode: use simple straight-line math with white/black glow
          // Use cached direction in power mode
          const drawDirection = useCachedPrediction && this.cachedDirection ? this.cachedDirection : direction;
          this.renderer.drawSimpleMathTrajectoryLines(prediction, { x: this.cueBall.x, y: this.cueBall.y }, drawDirection, this.predictor);
        }
      }
      
      this.renderer.drawCueAndPowerBar(this.cueBall, angle, this.currentPower, this.aimAssist, true, this.isAimMode, prediction);
    }
    
    this.debug.draw(this.world);
    
    this.fpsFrames++;
  }
  
  start() {
    this.lastTime = performance.now();
    this.fpsTime = this.lastTime;
    this.upsTime = this.lastTime;
    
    this.loop();
  }
  
  loop = () => {
    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;
    
    this.update(dt);
    this.render();
                          
    // Update FPS
    if (now - this.fpsTime >= 1000) {
      this.hud.updateFPS(this.fpsFrames);
      this.fpsFrames = 0;
      this.fpsTime = now;
    }
    
    // Update UPS
    if (now - this.upsTime >= 1000) {
      this.hud.updateUPS(this.upsSteps);
      this.upsSteps = 0;
      this.upsTime = now;
    }
    
    requestAnimationFrame(this.loop);
  };
  
  handlePowerBarMouseDown(e: MouseEvent) {
    if (!this.canShoot || !this.cueBall || this.cueBall.pocketed) return;
    
    if (this.isSpacePowerMode) {
      this.isDraggingPower = true;
      this.powerDragStartY = e.clientY;
      this.currentPower = CONFIG.CUE_POWER_MIN;
      return;
    }

    const bounds = this.renderer.getPowerBarBounds();
    const rect = this.input.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    if (
      mouseX >= bounds.x &&
      mouseX <= bounds.x + bounds.width &&
      mouseY >= bounds.y &&
      mouseY <= bounds.y + bounds.height
    ) {
      this.isDraggingPower = true;
      // Reverse: pulling down increases power (mouseY closer to bottom = higher power)
      this.currentPower = ((mouseY - bounds.y) / bounds.height) * CONFIG.CUE_POWER_MAX;
      this.currentPower = Math.max(CONFIG.CUE_POWER_MIN, Math.min(CONFIG.CUE_POWER_MAX, this.currentPower));
    }
  }
  
  handlePowerBarMouseMove(e: MouseEvent) {
    if (!this.isDraggingPower) return;
    
    if (this.isSpacePowerMode) {
      const dragDistance = Math.abs(this.powerDragStartY - e.clientY);
      this.currentPower = Math.max(
        CONFIG.CUE_POWER_MIN,
        Math.min(CONFIG.CUE_POWER_MAX, dragDistance * CONFIG.CUE_DRAG_SCALE)
      );
      return;
    }

    const bounds = this.renderer.getPowerBarBounds();
    const rect = this.input.canvas.getBoundingClientRect();
    const mouseY = e.clientY - rect.top;
    
    // Reverse: pulling down increases power (mouseY closer to bottom = higher power)
    this.currentPower = ((mouseY - bounds.y) / bounds.height) * CONFIG.CUE_POWER_MAX;
    this.currentPower = Math.max(CONFIG.CUE_POWER_MIN, Math.min(CONFIG.CUE_POWER_MAX, this.currentPower));
  }
  
  handlePowerBarMouseUp(_e: MouseEvent) {
    if (!this.isDraggingPower) return;

    this.isDraggingPower = false;

    const canShootNow =
      this.currentPower >= CONFIG.CUE_POWER_MIN &&
      this.cueBall &&
      !this.cueBall.pocketed;

    if (canShootNow) {
      this.shoot(this.lockedAngle, this.currentPower);
      this.currentPower = 0;
      this.isAimMode = true; // Reset to aim mode after shooting
    }

    if (this.isSpacePowerMode && !this.spaceKeyHeld) {
      this.isSpacePowerMode = false;
      this.isAimMode = this.wasAimModeBeforeSpace;
      if (this.wasAimModeBeforeSpace) {
        this.currentPower = 0;
      }
    }
  }
  
  handleBallDragStart(e: MouseEvent) {
    // Only in practice mode, when balls are at rest, and Shift is held
    if (!this.canShoot) return;
    if (!e.shiftKey) return;
    if (!this.cueBall || this.cueBall.pocketed) return;
    
    // Convert screen coords to game coords (same transform as renderer)
    const rect = this.input.canvas.getBoundingClientRect();
    const canvasCenterX = this.renderer.canvas.width / 2;
    const canvasCenterY = this.renderer.canvas.height / 2;
    
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    
    const mouseX = (screenX - canvasCenterX) / this.renderer.scale;
    const mouseY = -(screenY - canvasCenterY) / this.renderer.scale; // Flip Y
    
    // Check if clicking on cue ball, or allow free drag when BIH overlay/logging is on
    const dx = mouseX - this.cueBall.x;
    const dy = mouseY - this.cueBall.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const allowFreeDrag = CONFIG.DEBUG_BIH_LOG || this.debug.isBallInHandOverlayEnabled();

    if (dist <= this.cueBall.radius * 1.5 || allowFreeDrag) {
      this.isDraggingBall = true;
      this.input.canvas.style.cursor = 'move';
      // Suppress cue pocketing while dragging
      this.world.skipCuePocketCheck = true;
      // If BIH overlay hasn't been enabled explicitly, enable it for this drag session
      if (!this.debug.isBallInHandOverlayEnabled()) {
        this.debug.setBallInHandOverlayEnabled(true);
        this.syncDebugModeWithRenderer();
      }
      if (allowFreeDrag) {
        // Immediately place once at start so we can see initial clamp
        const result = clampBallInHand(
          { x: mouseX, y: mouseY },
          this.cueBall.radius,
          this.world.rails,
          this.world.pockets,
          { iterations: CONFIG.BALL_IN_HAND_ITERATIONS, pocketMargin: CONFIG.BALL_IN_HAND_POCKET_MARGIN_IN }
        );
        const geom = getTableGeometry();
        const halfW = (geom.playWidthIn ?? CONFIG.TABLE_WIDTH) / 2;
        const halfH = (geom.playHeightIn ?? CONFIG.TABLE_HEIGHT) / 2;
        const margin = this.cueBall.radius;
        const clampedX = Math.max(-halfW + margin, Math.min(halfW - margin, result.x));
        const clampedY = Math.max(-halfH + margin, Math.min(halfH - margin, result.y));
        this.cueBall.x = clampedX;
        this.cueBall.y = clampedY;
        if (CONFIG.DEBUG_BIH_LOG) {
          // eslint-disable-next-line no-console
          console.log('BIH drag start', { raw: { x: mouseX, y: mouseY }, clamped: { x: clampedX, y: clampedY } });
        }
      }
    }
  }
  
  handleBallDrag(e: MouseEvent) {
    if (!this.isDraggingBall || !this.cueBall) return;

    // Convert screen coords to game coords (same transform as renderer)
    const rect = this.input.canvas.getBoundingClientRect();
    const canvasCenterX = this.renderer.canvas.width / 2;
    const canvasCenterY = this.renderer.canvas.height / 2;
    
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    
    const mouseX = (screenX - canvasCenterX) / this.renderer.scale;
    const mouseY = -(screenY - canvasCenterY) / this.renderer.scale; // Flip Y
    
    // If it was flagged pocketed due to a previous step, un-pocket during manual placement
    // and zero motion so it renders and stays put.
    if (this.cueBall.pocketed) {
      this.cueBall.pocketed = false;
      this.cueBall.vx = 0;
      this.cueBall.vy = 0;
      this.cueBall.sleeping = true;
    }

    // Compute clamped position using authoritative placement helper
    const result = clampBallInHand(
      { x: mouseX, y: mouseY },
      this.cueBall.radius,
      this.world.rails,
      this.world.pockets,
      { iterations: CONFIG.BALL_IN_HAND_ITERATIONS, pocketMargin: CONFIG.BALL_IN_HAND_POCKET_MARGIN_IN }
    );
    // Final safety clamp to rectangular play bounds
    const geom = getTableGeometry();
    const halfW = (geom.playWidthIn ?? CONFIG.TABLE_WIDTH) / 2;
    const halfH = (geom.playHeightIn ?? CONFIG.TABLE_HEIGHT) / 2;
    const margin = this.cueBall.radius;
    const clampedX = Math.max(-halfW + margin, Math.min(halfW - margin, result.x));
    const clampedY = Math.max(-halfH + margin, Math.min(halfH - margin, result.y));
    this.cueBall.x = clampedX;
    this.cueBall.y = clampedY;

    // Round-trip coordinate check (screen->world->screen)
    // screenX/screenY defined above; compare with renderer's projection
    const re = this.renderer.worldToScreen(mouseX, mouseY);
    const rtErrorPx = Math.hypot(re.x - screenX, re.y - screenY);
    this.debug.setBallInHandData({ raw: { x: mouseX, y: mouseY }, clamped: { x: clampedX, y: clampedY }, radius: this.cueBall.radius, hits: result.hits.length, rtErrorPx });
    if (CONFIG.DEBUG_BIH_LOG) {
      // eslint-disable-next-line no-console
      console.log('BIH drag', { raw: { x: mouseX, y: mouseY }, clamped: { x: clampedX, y: clampedY }, hits: result.hits.length, rtErrorPx: Number(rtErrorPx.toFixed(2)) });
    }
  }

  // Push a ball inside the play area defined by rail segments using inward normals.
  
  handleBallDragEnd(_e: MouseEvent) {
    if (this.isDraggingBall) {
      this.isDraggingBall = false;
      this.input.canvas.style.cursor = 'default';
      // Re-enable pocketing for cue ball
      this.world.skipCuePocketCheck = false;
    }
  }
}

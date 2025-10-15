// Main game controller

import { PhysicsWorld } from '../physics/Physics';
import { Ball } from '../physics/Shapes';
import { Renderer3D } from '../render/Renderer3D';
import { InputManager } from '../input/Input';
import { DebugDraw } from '../debug/DebugDraw';
import { HUD } from '../ui/HUD';
import { CONFIG, CUE_BALL_POSITION, RACK_POSITIONS } from '../config';
import { EightBallRules } from '../rules/EightBall';
import { physicsRecorder } from '../debug/PhysicsRecorder';
import { Predictor, ShotPreviewPaths, PredictionResult } from '../physics/Prediction';
import { shotCapture } from '../debug/ShotCapture';
import { SettingsPanel } from '../ui/SettingsPanel';

export enum GameMode {
  PRACTICE,
  EIGHT_BALL,
}

export class Game {
  world: PhysicsWorld;
  renderer: Renderer3D;
  input: InputManager;
  hud: HUD;
  debug: DebugDraw;
  settings: SettingsPanel;
  rules: EightBallRules;
  predictor: Predictor;
  mode: GameMode;
  trajectoryPreview: ShotPreviewPaths | null = null;
  lastPrediction: PredictionResult | null = null;
  lastDirection: { x: number; y: number } = { x: 1, y: 0 };
  lockedPrediction: PredictionResult | null = null;
  lockedDirection: { x: number; y: number } | null = null;
  previewPowerSnapshot: number | null = null;
  
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
  isCtrlPressed: boolean = false; // Track Ctrl key state
  isSpacebarHeld: boolean = false; // Spacebar for instant power mode
  spacebarLockedAngle: number = 0; // Angle locked when spacebar is pressed
  spacebarStartMouseY: number = 0; // Mouse Y position when spacebar was pressed
  
  // Ball dragging (practice mode only)
  isDraggingBall: boolean = false;
  
  constructor(gameCanvas: HTMLCanvasElement, debugCanvas: HTMLCanvasElement) {
    this.world = new PhysicsWorld();
    this.renderer = new Renderer3D(gameCanvas);
    this.input = new InputManager(gameCanvas);
    this.hud = new HUD();
    this.debug = new DebugDraw(debugCanvas);
    this.settings = new SettingsPanel(this.hud.settingsManager);
    this.rules = new EightBallRules();
    this.predictor = new Predictor();
    this.mode = GameMode.PRACTICE;
    
    this.setupCallbacks();
    this.setupEventListeners();
    this.initializeGame();
    
    // Log helpful tips
    if (this.mode === GameMode.PRACTICE) {
      console.log('💡 Tips:');
      console.log('  - Hold SHIFT and drag the cue ball to reposition it');
      console.log('  - Press S to open Physics Settings panel');
      console.log('  - Press D for Debug view');
      console.log('  - Type debugRotation() in console for rotation diagnostics');
    }
    
    // Expose debug functions globally
    (window as any).debugRotation = () => this.renderer.debugRotation();
    (window as any).testRotation = (ballId: number, angle: number = 1.0) => this.renderer.testRotation(ballId, angle);
    (window as any).testRotationX = (ballId: number, angle: number = 1.0) => this.renderer.testRotationX(ballId, angle);
    (window as any).replaceWithTestBall = (ballId: number) => this.renderer.replaceWithTestBall(ballId);
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

    // Capture pointer release even if it happens off the canvas (e.g. trackpad drags)
    window.addEventListener('mousemove', (e) => this.handlePowerBarMouseMove(e));
    window.addEventListener('mouseup', (e) => this.handlePowerBarMouseUp(e));
    
    // Handle A key to toggle aim/power mode
    window.addEventListener('keydown', (e) => {
      // Track Ctrl state
      if (e.key === 'Control') {
        this.isCtrlPressed = true;
      }

      // Spacebar: Hold for instant power mode with frozen aim
      if (e.key === ' ' && !this.isSpacebarHeld && this.canShoot && this.cueBall && !this.cueBall.pocketed) {
        e.preventDefault();
        this.isSpacebarHeld = true;
        // Lock the current aim angle - get it directly and store it
        this.spacebarLockedAngle = this.input.getAimAngle(this.cueBall);

        // Also set it as manual angle to prevent mouse movements from changing it
        this.input.setManualAngle(this.spacebarLockedAngle);

        // Snapshot prediction/direction for locked overlays
        this.lockedPrediction = this.lastPrediction;
        this.lockedDirection = { ...this.lastDirection };
        this.previewPowerSnapshot = null;

        // Store current mouse Y position for power control
        const rect = this.input.canvas.getBoundingClientRect();
        this.spacebarStartMouseY = this.input.lastMouseY || (this.input.canvas.height / 2);

        // Start at minimum power
        this.currentPower = CONFIG.CUE_POWER_MIN;
        this.previewPowerSnapshot = this.currentPower;
      }

      if (e.key === 'a' || e.key === 'A') {
        const switchingToPower = this.isAimMode && this.cueBall && !this.cueBall.pocketed;
        if (switchingToPower) {
          // Switching from aim to power: lock the current angle and prediction snapshot
          this.lockedAngle = this.input.getAimAngle(this.cueBall);
          this.lockedPrediction = this.lastPrediction;
          this.lockedDirection = { ...this.lastDirection };
          this.previewPowerSnapshot = Math.max(this.currentPower, CONFIG.CUE_POWER_MIN);
        } else {
          this.lockedPrediction = null;
          this.lockedDirection = null;
          this.previewPowerSnapshot = null;
        }
        this.isAimMode = !this.isAimMode;
        if (this.isAimMode) {
          this.lockedPrediction = null;
          this.lockedDirection = null;
          this.previewPowerSnapshot = null;
        }
      }

      // Arrow key micro-aim adjustments (only in aim mode and not holding spacebar)
      if (this.isAimMode && !this.isSpacebarHeld && this.canShoot && this.cueBall && !this.cueBall.pocketed) {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();

          // Initialize manual angle if not set
          if (this.input.manualAngle === null) {
            this.input.setManualAngle(this.input.getAimAngle(this.cueBall));
          }

          // Determine increment based on modifier keys
          let increment: number;
          if (e.shiftKey && e.ctrlKey) {
            // Ultra-fine: Shift + Ctrl for pixel-perfect precision
            increment = CONFIG.AIM_ARROW_KEY_INCREMENT_ULTRA;
          } else if (e.shiftKey) {
            // Fine: Shift for detailed adjustments
            increment = CONFIG.AIM_ARROW_KEY_INCREMENT_FINE;
          } else {
            // Normal: Base increment for quick adjustments
            increment = CONFIG.AIM_ARROW_KEY_INCREMENT_BASE;
          }

          // Apply adjustment
          const direction = e.key === 'ArrowLeft' ? -1 : 1;
          this.input.adjustAngle(direction * increment);
        }
      }

      // Arrow keys to adjust power when spacebar is held
      if (this.isSpacebarHeld && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault();
        const powerDelta = 0.5; // Power increment per key press
        if (e.key === 'ArrowUp') {
          this.currentPower = Math.min(CONFIG.CUE_POWER_MAX, this.currentPower + powerDelta);
        } else {
          this.currentPower = Math.max(CONFIG.CUE_POWER_MIN, this.currentPower - powerDelta);
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      // Track Ctrl state
      if (e.key === 'Control') {
        this.isCtrlPressed = false;
      }

      // Spacebar release: shoot with current power
      if (e.key === ' ' && this.isSpacebarHeld) {
        e.preventDefault();
        this.isSpacebarHeld = false;

        // Clear manual angle so mouse aim works again
        this.input.clearManualAngle();

        this.lockedPrediction = null;
        this.lockedDirection = null;
        this.previewPowerSnapshot = null;

        // Shoot if power is sufficient
        if (this.currentPower >= CONFIG.CUE_POWER_MIN && this.cueBall && !this.cueBall.pocketed) {
          this.shoot(this.spacebarLockedAngle, this.currentPower);
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

    window.addEventListener('keydown', (e) => {
      if (e.key === 'd' || e.key === 'D' || e.key === 'm' || e.key === 'M') {
        this.toggleDebugOverlays();
        return;
      }

      if (e.key === 'r' || e.key === 'R') {
        this.restart();
      }
      if (e.key === 's' || e.key === 'S') {
        this.settings.toggle();
      }
    });

    window.addEventListener('game:debug-toggle', () => {
      this.toggleDebugOverlays();
    });

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
    
    // Wire up physics settings button
    const physicsSettingsBtn = document.getElementById('physics-settings-btn');
    if (physicsSettingsBtn) {
      physicsSettingsBtn.addEventListener('click', () => this.settings.toggle());
    }
  }

  toggleDebugOverlays(force?: boolean) {
    const enabled = this.debug.toggle(force);
    this.renderer.toggleMeasurementOverlay(enabled);
    return enabled;
  }

  initializeGame() {
    this.world.balls = [];

    this.trajectoryPreview = null;
    this.lastPrediction = null;
    this.lockedPrediction = null;
    this.lockedDirection = null;
    this.lastDirection = { x: 1, y: 0 };
    this.previewPowerSnapshot = null;
    
    // Create cue ball
    this.cueBall = new Ball(
      0,
      CUE_BALL_POSITION.x,
      CUE_BALL_POSITION.y,
      CONFIG.BALL_RADIUS,
      CONFIG.BALL_MASS
    );
    this.world.addBall(this.cueBall);
    
    // Create racked balls
    RACK_POSITIONS.forEach((pos) => {
      const ball = new Ball(pos.id, pos.x, pos.y, CONFIG.BALL_RADIUS, CONFIG.BALL_MASS);
      this.world.addBall(ball);
    });
    
    // Initialize 3D scene
    this.renderer.initializeTable();
    this.renderer.initializeRails(this.world.rails);
    this.renderer.initializePockets(this.world.pockets);
    
    this.resize();
    this.rules.startGame();
    this.hud.setMode(this.mode === GameMode.PRACTICE ? 'Practice Mode' : '8-Ball');
    this.hud.setTurn(1);
  }
  
  restart() {
    this.world.balls = [];
    this.initializeGame();
  }
  
  resize() {
    this.renderer.resize();
    this.input.updateScale(this.renderer.scale);
    this.debug.resize(this.renderer.canvas.width, this.renderer.canvas.height, this.renderer.scale);
  }
  
  shoot(angle: number, power: number) {
    if (!this.cueBall || this.cueBall.pocketed) return;
    
    // Record shot for capture system if active
    if (shotCapture.isCapturing()) {
      const direction = { x: Math.cos(angle), y: Math.sin(angle) };
      const prediction = this.predictor.predictFirstContact(
        { x: this.cueBall.x, y: this.cueBall.y },
        direction,
        this.world,
        this.cueBall
      );
      shotCapture.recordShotStart(this.cueBall, angle, power, prediction);
    }
    
    // Apply power multiplier for realistic velocity
    const velocity = power * CONFIG.CUE_POWER_MULTIPLIER;
    const vx = Math.cos(angle) * velocity;
    const vy = Math.sin(angle) * velocity;
    
    this.cueBall.setVelocity(vx, vy);
    physicsRecorder.recordShot(angle, power);
    this.canShoot = false;
    this.trajectoryPreview = null;
    this.lockedPrediction = null;
    this.lockedDirection = null;
    this.previewPowerSnapshot = null;
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
    }
  }
  
  render() {
    const alpha = this.accumulator / CONFIG.PHYSICS_DT;
    
    this.renderer.render(this.world, alpha);
    
    // Draw cue line and power bar if can shoot
    if (this.canShoot && this.cueBall && !this.cueBall.pocketed) {
      // Determine angle and mode
      let angle: number;
      let effectiveAimMode: boolean;

      if (this.isSpacebarHeld) {
        // Spacebar mode: use frozen angle, show as power mode
        angle = this.spacebarLockedAngle;
        effectiveAimMode = false;
      } else if (this.isAimMode) {
        // Normal aim mode: use live angle
        angle = this.input.getAimAngle(this.cueBall);
        effectiveAimMode = true;
      } else {
        // Normal power mode: use locked angle
        angle = this.lockedAngle;
        effectiveAimMode = false;
      }

      // Predict first contact and optionally freeze for locked power mode
      let direction = {
        x: Math.cos(angle),
        y: Math.sin(angle),
      };

      const lockedMode = this.isSpacebarHeld || !this.isAimMode;
      let prediction: PredictionResult | null = null;

      if (this.aimAssist) {
        if (lockedMode) {
          if (!this.lockedPrediction) {
            const computed =
              this.lastPrediction ??
              this.predictor.predictFirstContact(
                { x: this.cueBall.x, y: this.cueBall.y },
                direction,
                this.world,
                this.cueBall
              );
            this.lockedPrediction = computed;

            if (!this.lockedDirection) {
              if (this.lastPrediction) {
                this.lockedDirection = { ...this.lastDirection };
              } else {
                this.lockedDirection = { ...direction };
              }
            }
          }

          prediction = this.lockedPrediction;
          if (this.lockedDirection) {
            direction = { ...this.lockedDirection };
          }

          if (!this.trajectoryPreview) {
            const lockedAngle = this.isSpacebarHeld ? this.spacebarLockedAngle : this.lockedAngle;
            const previewPower = this.previewPowerSnapshot ?? this.currentPower;
            this.previewPowerSnapshot = previewPower;
            this.trajectoryPreview = this.predictor.simulateShotPaths(
              this.world,
              this.cueBall,
              lockedAngle,
              previewPower
            );
          }
        } else {
          const computed = this.predictor.predictFirstContact(
            { x: this.cueBall.x, y: this.cueBall.y },
            direction,
            this.world,
            this.cueBall
          );
          prediction = computed;
          this.lastPrediction = computed;
          this.lastDirection = { ...direction };
          this.lockedPrediction = null;
          this.lockedDirection = null;
          this.trajectoryPreview = this.predictor.simulateShotPaths(
            this.world,
            this.cueBall,
            angle,
            this.currentPower
          );
          this.previewPowerSnapshot = this.currentPower;
        }

        if (prediction) {
          this.renderer.drawTrajectoryLines(
            prediction,
            { x: this.cueBall.x, y: this.cueBall.y },
            direction,
            this.trajectoryPreview ?? undefined
          );
        } else {
          this.trajectoryPreview = null;
          this.previewPowerSnapshot = null;
        }
      } else {
        this.trajectoryPreview = null;
        this.previewPowerSnapshot = null;
        this.lockedPrediction = null;
        this.lockedDirection = null;
      }

      const cuePrediction =
        prediction ??
        this.lockedPrediction ??
        this.lastPrediction ??
        this.predictor.predictFirstContact(
          { x: this.cueBall.x, y: this.cueBall.y },
          direction,
          this.world,
          this.cueBall
        );

      this.renderer.drawCueAndPowerBar(
        this.cueBall,
        angle,
        this.currentPower,
        this.aimAssist,
        true,
        effectiveAimMode,
        cuePrediction,
        this.input.isFineAimMode,
        this.input.isFineAimMode && this.isCtrlPressed,
        this.isSpacebarHeld
      );
    }

    this.debug.draw(this.world, this.renderer);
    
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

    const bounds = this.renderer.getPowerBarBounds();
    const rect = this.input.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Check if clicking on power bar
    if (
      mouseX >= bounds.x &&
      mouseX <= bounds.x + bounds.width &&
      mouseY >= bounds.y &&
      mouseY <= bounds.y + bounds.height
    ) {
      this.isDraggingPower = true;

      // If spacebar mode is active, use that locked angle; otherwise lock current angle
      if (this.isSpacebarHeld) {
        // Already locked, just update power
      } else {
        // Not in spacebar mode - lock angle for normal power mode
        this.lockedAngle = this.input.getAimAngle(this.cueBall);
      }

      // Reverse: pulling down increases power (mouseY closer to bottom = higher power)
      this.currentPower = ((mouseY - bounds.y) / bounds.height) * CONFIG.CUE_POWER_MAX;
      this.currentPower = Math.max(CONFIG.CUE_POWER_MIN, Math.min(CONFIG.CUE_POWER_MAX, this.currentPower));
    }
  }
  
  handlePowerBarMouseMove(e: MouseEvent) {
    // Allow power adjustment during spacebar mode OR regular dragging
    if (!this.isDraggingPower && !this.isSpacebarHeld) return;
    if (!this.canShoot || !this.cueBall || this.cueBall.pocketed) return;

    const rect = this.input.canvas.getBoundingClientRect();
    const mouseY = e.clientY - rect.top;

    // During spacebar mode, use vertical mouse movement anywhere on screen
    if (this.isSpacebarHeld) {
      // Calculate power based on vertical distance from start position
      // Moving down = more power, moving up = less power
      const deltaY = mouseY - this.spacebarStartMouseY;
      const canvasHeight = this.input.canvas.height;

      // Map mouse movement to power range
      // Allow full screen height to cover full power range
      const powerRange = CONFIG.CUE_POWER_MAX - CONFIG.CUE_POWER_MIN;
      const powerDelta = (deltaY / canvasHeight) * powerRange * 2; // 2x multiplier for sensitivity

      this.currentPower = CONFIG.CUE_POWER_MIN + powerRange / 2 + powerDelta; // Start at mid-range
      this.currentPower = Math.max(CONFIG.CUE_POWER_MIN, Math.min(CONFIG.CUE_POWER_MAX, this.currentPower));
    } else if (this.isDraggingPower) {
      // Normal drag mode - only on power bar
      const bounds = this.renderer.getPowerBarBounds();
      this.currentPower = ((mouseY - bounds.y) / bounds.height) * CONFIG.CUE_POWER_MAX;
      this.currentPower = Math.max(CONFIG.CUE_POWER_MIN, Math.min(CONFIG.CUE_POWER_MAX, this.currentPower));
    }
  }
  
  handlePowerBarMouseUp(_e: MouseEvent) {
    if (!this.isDraggingPower) return;

    this.isDraggingPower = false;

    // Don't shoot if spacebar is held - user will release spacebar to shoot
    if (this.isSpacebarHeld) return;

    // Shoot with the current power using locked angle
    if (this.currentPower >= CONFIG.CUE_POWER_MIN && this.cueBall && !this.cueBall.pocketed) {
      this.shoot(this.lockedAngle, this.currentPower);
      this.currentPower = 0;
      this.isAimMode = true; // Reset to aim mode after shooting
    }
  }
  
  handleBallDragStart(e: MouseEvent) {
    // Only in practice mode, when balls are at rest, and Shift is held
    if (this.mode !== GameMode.PRACTICE) return;
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
    
    // Check if clicking on cue ball
    const dx = mouseX - this.cueBall.x;
    const dy = mouseY - this.cueBall.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist <= this.cueBall.radius * 1.5) {
      this.isDraggingBall = true;
      this.input.canvas.style.cursor = 'move';
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
    
    // Move cue ball to mouse position
    this.cueBall.x = mouseX;
    this.cueBall.y = mouseY;
    
    // Ensure it stays within table bounds (with margin for ball radius)
    const margin = this.cueBall.radius;
    this.cueBall.x = Math.max(-50 + margin, Math.min(50 - margin, this.cueBall.x));
    this.cueBall.y = Math.max(-25 + margin, Math.min(25 - margin, this.cueBall.y));
  }
  
  handleBallDragEnd(_e: MouseEvent) {
    if (this.isDraggingBall) {
      this.isDraggingBall = false;
      this.input.canvas.style.cursor = 'default';
    }
  }
}

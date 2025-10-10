// Main game controller

import { PhysicsWorld } from '../physics/Physics';
import { Ball } from '../physics/Shapes';
import { Renderer } from '../render/Renderer';
import { InputManager } from '../input/Input';
import { DebugDraw } from '../debug/DebugDraw';
import { HUD } from '../ui/HUD';
import { CONFIG, CUE_BALL_POSITION, RACK_POSITIONS } from '../config';
import { EightBallRules } from '../rules/EightBall';
import { physicsRecorder } from '../debug/PhysicsRecorder';
import { Predictor } from '../physics/Prediction';
import { shotCapture } from '../debug/ShotCapture';
import { SettingsPanel } from '../ui/SettingsPanel';

export enum GameMode {
  PRACTICE,
  EIGHT_BALL,
}

export class Game {
  world: PhysicsWorld;
  renderer: Renderer;
  input: InputManager;
  hud: HUD;
  debug: DebugDraw;
  settings: SettingsPanel;
  rules: EightBallRules;
  predictor: Predictor;
  mode: GameMode;
  
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
  
  // Ball dragging (practice mode only)
  isDraggingBall: boolean = false;
  
  constructor(gameCanvas: HTMLCanvasElement, debugCanvas: HTMLCanvasElement) {
    this.world = new PhysicsWorld();
    this.renderer = new Renderer(gameCanvas);
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
      if (e.key === 'a' || e.key === 'A') {
        if (this.isAimMode && this.cueBall && !this.cueBall.pocketed) {
          // Switching from aim to power: lock the current angle
          this.lockedAngle = this.input.getAimAngle(this.cueBall);
        }
        this.isAimMode = !this.isAimMode;
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
      if (e.key === 'd' || e.key === 'D') {
        this.debug.toggle();
      }
      if (e.key === 'r' || e.key === 'R') {
        this.restart();
      }
      if (e.key === 's' || e.key === 'S') {
        this.settings.toggle();
      }
    });
    
    // Wire up debug toggle button
    const debugBtn = document.getElementById('debug-toggle');
    if (debugBtn) {
      debugBtn.addEventListener('click', () => this.debug.toggle());
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
    
    // Wire up physics settings button
    const physicsSettingsBtn = document.getElementById('physics-settings-btn');
    if (physicsSettingsBtn) {
      physicsSettingsBtn.addEventListener('click', () => this.settings.toggle());
    }
  }
  
  initializeGame() {
    this.world.balls = [];
    
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
      // Use locked angle in power mode, live angle in aim mode
      const angle = this.isAimMode ? this.input.getAimAngle(this.cueBall) : this.lockedAngle;
      
      // Predict first contact (always run to clip aim line at rails/balls)
      const direction = {
        x: Math.cos(angle),
        y: Math.sin(angle),
      };
      
      const prediction = this.predictor.predictFirstContact(
        { x: this.cueBall.x, y: this.cueBall.y },
        direction,
        this.world,
        this.cueBall
      );
      
      // Draw trajectory lines only if aim assist is enabled
      if (this.aimAssist && prediction) {
        this.renderer.drawTrajectoryLines(
          prediction,
          { x: this.cueBall.x, y: this.cueBall.y },
          direction,
          this.predictor
        );
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
      // Reverse: pulling down increases power (mouseY closer to bottom = higher power)
      this.currentPower = ((mouseY - bounds.y) / bounds.height) * CONFIG.CUE_POWER_MAX;
      this.currentPower = Math.max(CONFIG.CUE_POWER_MIN, Math.min(CONFIG.CUE_POWER_MAX, this.currentPower));
    }
  }
  
  handlePowerBarMouseMove(e: MouseEvent) {
    if (!this.isDraggingPower) return;
    
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

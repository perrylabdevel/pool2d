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
  rules: EightBallRules;
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
  
  constructor(gameCanvas: HTMLCanvasElement, debugCanvas: HTMLCanvasElement) {
    this.world = new PhysicsWorld();
    this.renderer = new Renderer(gameCanvas);
    this.input = new InputManager(gameCanvas);
    this.hud = new HUD();
    this.debug = new DebugDraw(debugCanvas);
    this.rules = new EightBallRules();
    this.mode = GameMode.PRACTICE;
    
    this.setupCallbacks();
    this.setupEventListeners();
    this.initializeGame();
  }
  
  setupCallbacks() {
    // Handle power bar dragging
    this.input.canvas.addEventListener('mousedown', (e) => this.handlePowerBarMouseDown(e));
    this.input.canvas.addEventListener('mousemove', (e) => this.handlePowerBarMouseMove(e));
    this.input.canvas.addEventListener('mouseup', (e) => this.handlePowerBarMouseUp(e));
    
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
    });
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
  
  update(deltaTime: number) {
    this.accumulator += deltaTime;
    
    let steps = 0;
    while (this.accumulator >= CONFIG.PHYSICS_DT && steps < CONFIG.MAX_SUBSTEPS) {
      this.world.step(CONFIG.PHYSICS_DT);
      physicsRecorder.recordFrame(this.world);
      this.accumulator -= CONFIG.PHYSICS_DT;
      steps++;
      this.upsSteps++;
    }
    
    // Check if can shoot again
    if (!this.canShoot && this.world.isAtRest()) {
      this.canShoot = true;
      
      if (this.mode === GameMode.EIGHT_BALL) {
        this.rules.endShot(this.world.balls);
      }
      
      // Handle cue ball pocketed
      if (this.cueBall && this.cueBall.pocketed) {
        this.cueBall.pocketed = false;
        this.cueBall.x = CUE_BALL_POSITION.x;
        this.cueBall.y = CUE_BALL_POSITION.y;
        this.cueBall.vx = 0;
        this.cueBall.vy = 0;
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
      this.renderer.drawCueAndPowerBar(this.cueBall, angle, this.currentPower, this.aimAssist, true, this.isAimMode);
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
}

// Main game controller.
//
// This file owns presentation wiring: input -> shot, physics events -> feedback,
// rules callbacks -> HUD. It reads the physics world and the rules engine; it
// never mutates physics state from the render path.

import { PhysicsWorld } from '../physics/Physics';
import { Ball } from '../physics/Shapes';
import { Renderer3D } from '../render/Renderer3D';
import { InputManager } from '../input/Input';
import { DebugDraw } from '../debug/DebugDraw';
import { HUD, Group } from '../ui/HUD';
import { PowerSlider } from '../ui/PowerSlider';
import { sound } from '../ui/Sound';
import { CONFIG, CUE_BALL_POSITION, RACK_POSITIONS, BALL_CUE, BALL_8 } from '../config';
import { EightBallRules, GameState, PlayerGroup } from '../rules/EightBall';
import { physicsRecorder } from '../debug/PhysicsRecorder';
import { Predictor } from '../physics/Prediction';
import { shotCapture } from '../debug/ShotCapture';
import { SettingsPanel } from '../ui/SettingsPanel';
import { TABLE_GEOMETRY } from '../geometry/Geometry';

export enum GameMode {
  PRACTICE,
  EIGHT_BALL,
}

/** Head string: on a break scratch the cue ball goes behind this line. */
const HEAD_STRING_X = -TABLE_GEOMETRY.playWidthIn / 4;

/** Cue snaps forward over this long before the strike registers visually. */
const CUE_SNAP_MS = 90;

/** Speed change across one frame that reads as a cushion hit. */
const CUSHION_IMPACT_EPSILON = 4;

function groupToLabel(group: PlayerGroup): Group {
  if (group === PlayerGroup.SOLIDS) return 'solids';
  if (group === PlayerGroup.STRIPES) return 'stripes';
  return 'none';
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
  powerSlider: PowerSlider;
  mode: GameMode;

  // Game loop
  accumulator = 0;
  lastTime = 0;
  fpsFrames = 0;
  fpsTime = 0;
  upsSteps = 0;
  upsTime = 0;

  // Shooting state
  canShoot = true;
  cueBall: Ball | null = null;
  aimAssist = true;
  aimAngle = 0;
  currentPower = 0; // 0..1
  cueSnapUntil = 0;

  // Ball in hand
  ballInHand = false;
  isPlacingBall = false;
  placementValid = true;

  // Match stats, derived client-side for the end-of-match card.
  private potted = new Set<number>();
  private shotsTaken = 0;
  private currentRun = 0;
  private bestRun = 0;

  // Cushion-sound detection (physics exposes no rail-contact hook, so we derive
  // it from read-only ball state — this never writes back into the simulation).
  private prevVel = new Map<number, { vx: number; vy: number }>();

  constructor(gameCanvas: HTMLCanvasElement, debugCanvas: HTMLCanvasElement) {
    this.world = new PhysicsWorld();
    this.renderer = new Renderer3D(gameCanvas);
    this.input = new InputManager(gameCanvas, (x, y) => this.renderer.screenToWorld(x, y));
    this.hud = new HUD(['You', 'Rival']);
    this.debug = new DebugDraw(debugCanvas);
    this.settings = new SettingsPanel(this.hud.settingsManager);
    this.rules = new EightBallRules();
    this.predictor = new Predictor();
    this.mode = GameMode.EIGHT_BALL;

    this.aimAssist = this.hud.settingsManager.getGameSettings().aimAssist;

    this.powerSlider = new PowerSlider(document.getElementById('power-slider')!, {
      onChange: (p) => {
        this.currentPower = p;
      },
      onRelease: (p) => this.releaseShot(p),
      canShoot: () => this.isShotAllowed(),
      onFirstGesture: () => sound.resume(),
    });

    this.input.onFirstGesture = () => sound.resume();

    this.setupCallbacks();
    this.setupEventListeners();
    this.initializeGame();

    // Dev-only handles for driving UI states without playing a whole rack.
    // Stripped from production builds.
    if (import.meta.env.DEV) {
      const w = window as unknown as Record<string, unknown>;
      w.__game = this;
      w.__hud = this.hud;
    }
  }

  // -- wiring ----------------------------------------------------------------

  setupCallbacks() {
    this.world.onBallPocketed = (ballId) => this.handleBallPocketed(ballId);

    this.world.onBallBallContact = (idA, idB) => {
      const a = this.world.balls.find((b) => b.id === idA);
      const b = this.world.balls.find((b) => b.id === idB);
      const speed = Math.max(a?.getSpeed() ?? 0, b?.getSpeed() ?? 0);
      sound.clack(Math.min(1, speed / 120));

      if (this.mode !== GameMode.EIGHT_BALL) return;
      const cueId = this.cueBall ? this.cueBall.id : BALL_CUE;
      if (idA === cueId) this.rules.recordFirstContact(idB);
      else if (idB === cueId) this.rules.recordFirstContact(idA);
    };

    this.rules.onFoul = (message) => {
      this.hud.showFoul(message);
      this.currentRun = 0;
    };

    this.rules.onTurnChange = (player) => {
      this.hud.setTurn(player, { announce: true, name: player === 1 ? 'You' : 'Rival' });
      this.currentRun = 0;
      this.syncBallInHand();
    };

    this.rules.onGroupAssigned = (player, group) => {
      this.hud.setGroups(
        groupToLabel(this.rules.player1Group),
        groupToLabel(this.rules.player2Group)
      );
      this.hud.setPotted(this.potted);
      if (player === this.rules.currentPlayer) {
        this.hud.showGroupAssigned(player, groupToLabel(group));
      }
    };

    this.rules.onGameOver = (winner) => this.handleGameOver(winner);

    this.hud.onShotClockExpired = () => {
      if (this.mode !== GameMode.EIGHT_BALL) return;
      if (!this.canShoot || this.rules.gameState === GameState.GAME_OVER) return;
      this.hud.feedback.show('Time', { sub: 'Turn forfeited', variant: 'foul', hold: 1300 });
      sound.foul();
      this.powerSlider.cancel();
      this.rules.switchPlayer();
    };

    this.hud.endOverlay.onRematch = () => this.restart();
  }

  setupEventListeners() {
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => this.resize());

    window.addEventListener('game:restart', () => this.restart());
    window.addEventListener('game:debug-toggle', () => this.debug.toggle());
    window.addEventListener('game:aim-assist-toggle', (e) => {
      this.aimAssist = (e as CustomEvent<{ enabled: boolean }>).detail.enabled;
    });

    // Colors are tokens; when they change, rebuild the felt and rails.
    window.addEventListener('settings:colors-changed', () => {
      this.renderer.initializeTable();
      this.renderer.initializePockets(this.world.pockets);
    });

    window.addEventListener('keydown', (e) => {
      // Never steal keys while the user is typing in the settings modal.
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;

      switch (e.key.toLowerCase()) {
        case 'd':
          this.debug.toggle();
          break;
        case 'r':
          this.restart();
          break;
        case 's':
          this.settings.toggle();
          break;
        case 'm':
          sound.resume();
          this.hud.feedback.show(sound.toggleMute() ? 'Muted' : 'Sound on', {
            variant: 'info',
            hold: 700,
          });
          break;
      }
    });

    // Table pointer: aim, or place the cue ball when we have ball in hand.
    const canvas = this.renderer.canvas;
    canvas.addEventListener('pointerdown', (e) => this.handleTablePointerDown(e));
    canvas.addEventListener('pointerup', () => this.handleTablePointerUp());
    canvas.addEventListener('pointercancel', () => this.handleTablePointerUp());

    document.getElementById('physics-settings-btn')!.addEventListener('click', () => {
      this.settings.toggle();
    });

    const captureShotBtn = document.getElementById('capture-shot-btn')!;
    captureShotBtn.addEventListener('click', () => {
      shotCapture.startCapture();
      captureShotBtn.classList.add('on');
      setTimeout(() => captureShotBtn.classList.remove('on'), 400);
    });
  }

  // -- setup -----------------------------------------------------------------

  initializeGame() {
    this.world.balls = [];
    this.potted.clear();
    this.prevVel.clear();
    this.shotsTaken = 0;
    this.currentRun = 0;
    this.bestRun = 0;
    this.canShoot = true;
    this.ballInHand = false;
    this.isPlacingBall = false;
    this.currentPower = 0;

    this.cueBall = new Ball(
      BALL_CUE,
      CUE_BALL_POSITION.x,
      CUE_BALL_POSITION.y,
      CONFIG.BALL_RADIUS,
      CONFIG.BALL_MASS
    );
    this.world.addBall(this.cueBall);

    RACK_POSITIONS.forEach((pos) => {
      this.world.addBall(new Ball(pos.id, pos.x, pos.y, CONFIG.BALL_RADIUS, CONFIG.BALL_MASS));
    });

    this.renderer.initializeTable();
    this.renderer.initializeRails(this.world.rails);
    this.renderer.initializePockets(this.world.pockets);

    this.resize();
    this.rules.startGame();

    this.hud.reset();
    this.hud.setMode(this.mode === GameMode.PRACTICE ? 'Practice' : '8-Ball');
    this.hud.setShotClockRunning(this.mode === GameMode.EIGHT_BALL);
    this.hud.showBreak();

    this.powerSlider.setLocked(false);
  }

  restart() {
    this.world.balls = [];
    this.initializeGame();
  }

  resize() {
    this.renderer.resize();
    this.input.updateScale(this.renderer.scale);
    this.debug.resize(this.renderer.viewWidth, this.renderer.viewHeight, this.renderer.scale);
  }

  // -- shooting --------------------------------------------------------------

  private isShotAllowed(): boolean {
    return (
      this.canShoot &&
      !this.ballInHand &&
      !!this.cueBall &&
      !this.cueBall.pocketed &&
      this.rules.gameState !== GameState.GAME_OVER &&
      !this.hud.endOverlay.isOpen
    );
  }

  private releaseShot(power01: number) {
    if (!this.isShotAllowed()) return;

    // Below the minimum the release is treated as a cancel, not a soft tap.
    const minFraction = CONFIG.CUE_POWER_MIN / CONFIG.CUE_POWER_MAX;
    if (power01 < minFraction) {
      this.currentPower = 0;
      return;
    }

    this.shoot(this.aimAngle, power01 * CONFIG.CUE_POWER_MAX);
    this.currentPower = 0;
  }

  shoot(angle: number, power: number) {
    if (!this.cueBall || this.cueBall.pocketed) return;

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

    const velocity = power * CONFIG.CUE_POWER_MULTIPLIER;
    this.cueBall.setVelocity(Math.cos(angle) * velocity, Math.sin(angle) * velocity);
    physicsRecorder.recordShot(angle, power);

    sound.cueStrike(power / CONFIG.CUE_POWER_MAX);
    this.shotsTaken++;

    // Cue snaps forward, then hides for the duration of the simulation.
    this.cueSnapUntil = performance.now() + CUE_SNAP_MS;
    this.canShoot = false;
    this.powerSlider.setLocked(true);
    this.hud.setShotClockRunning(false);
    this.hud.setHintVisible(false);

    if (this.mode === GameMode.EIGHT_BALL) {
      this.rules.startShot();
    }
  }

  // -- events ----------------------------------------------------------------

  private handleBallPocketed(ballId: number) {
    sound.pocketDrop();

    if (ballId !== BALL_CUE) {
      this.potted.add(ballId);
      this.hud.setPotted(this.potted);

      // Fly the ball icon from the pocket it fell into up to the pod.
      const ball = this.world.balls.find((b) => b.id === ballId);
      if (ball) {
        const pocket = this.nearestPocket(ball.x, ball.y);
        const screen = this.renderer.worldToScreen(pocket.x, pocket.y);
        this.hud.showPot(ballId, screen, this.rules.currentPlayer);
      }

      if (ballId !== BALL_8) {
        this.currentRun++;
        this.bestRun = Math.max(this.bestRun, this.currentRun);
      }
    }

    if (this.mode === GameMode.EIGHT_BALL) {
      this.rules.recordBallPocketed(ballId);
    }
  }

  private nearestPocket(x: number, y: number) {
    let best = this.world.pockets[0];
    let bestDist = Infinity;
    for (const p of this.world.pockets) {
      const d = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d < bestDist) {
        bestDist = d;
        best = p;
      }
    }
    return best;
  }

  private handleGameOver(winner: number) {
    this.powerSlider.setLocked(true);
    this.hud.setShotClockRunning(false);

    const won = winner === 1;
    this.hud.showMatchEnd({
      headline: won ? 'You Win' : 'You Lose',
      eyebrow: won ? 'Match complete' : 'Better luck next rack',
      won,
      ballsCleared: this.potted.size,
      shotsTaken: this.shotsTaken,
      bestRun: this.bestRun,
    });
  }

  /** Reflect the rules engine's ball-in-hand state into the UI. */
  private syncBallInHand() {
    const granted = this.rules.gameState === GameState.BALL_IN_HAND;
    if (granted && !this.ballInHand) {
      this.ballInHand = true;
      this.powerSlider.setLocked(true);
      this.hud.showBallInHand();
    } else if (!granted) {
      this.ballInHand = false;
    }
  }

  // -- ball in hand ----------------------------------------------------------

  private handleTablePointerDown(e: PointerEvent) {
    if (!this.ballInHand || !this.canShoot || !this.cueBall) return;
    e.preventDefault();
    this.isPlacingBall = true;
  }

  private handleTablePointerUp() {
    if (!this.isPlacingBall) return;
    this.isPlacingBall = false;

    // Confirm on release, but only onto a legal spot.
    if (this.placementValid && this.cueBall) {
      this.ballInHand = false;
      this.cueBall.setVelocity(0, 0);
      this.cueBall.sleeping = true;
      this.cueBall.saveState();
      sound.blip();
      this.hud.feedback.show('Placed', { variant: 'pot', hold: 600 });
      // Placement is what was blocking the shot — hand the slider back.
      this.powerSlider.setLocked(false);
    }
  }

  /** Legal placement: on the cloth, clear of every other ball, behind the head
   *  string while the table is still being broken. */
  private isPlacementValid(x: number, y: number): boolean {
    const r = CONFIG.BALL_RADIUS;
    const halfW = TABLE_GEOMETRY.playWidthIn / 2 - r;
    const halfH = TABLE_GEOMETRY.playHeightIn / 2 - r;

    if (x < -halfW || x > halfW || y < -halfH || y > halfH) return false;
    if (!CONFIG.BALL_IN_HAND_ANYWHERE && this.rules.gameState === GameState.BREAK && x > HEAD_STRING_X) {
      return false;
    }

    for (const ball of this.world.balls) {
      if (ball.id === BALL_CUE || ball.pocketed) continue;
      if (Math.hypot(ball.x - x, ball.y - y) < r * 2.05) return false;
    }

    for (const pocket of this.world.pockets) {
      if (Math.hypot(pocket.x - x, pocket.y - y) < pocket.radius + r) return false;
    }

    return true;
  }

  // -- loop ------------------------------------------------------------------

  update(dt: number) {
    this.accumulator += dt;

    while (this.accumulator >= CONFIG.PHYSICS_DT) {
      this.world.step(CONFIG.PHYSICS_DT);
      physicsRecorder.recordFrame(this.world);
      this.accumulator -= CONFIG.PHYSICS_DT;
      this.upsSteps++;
    }

    this.detectCushionHits();
    this.hud.tickShotClock(dt);

    const allSleeping = this.world.balls.every((b) => b.pocketed || b.sleeping);
    if (allSleeping && !this.canShoot) {
      this.canShoot = true;

      if (shotCapture.isCapturing() && this.cueBall) {
        const targetBall = this.world.balls.find((b) => b.id !== BALL_CUE && !b.pocketed);
        shotCapture.checkForRest(this.cueBall, targetBall || null);
      }

      if (this.mode === GameMode.EIGHT_BALL) {
        this.rules.endShot(this.world.balls);
        this.syncBallInHand();
      }

      // A scratch hands the cue ball back to the incoming player.
      if (this.cueBall && this.cueBall.pocketed) {
        this.cueBall.pocketed = false;
        this.cueBall.sleeping = true;
        this.cueBall.setVelocity(0, 0);
        this.cueBall.x = CUE_BALL_POSITION.x;
        this.cueBall.y = CUE_BALL_POSITION.y;
        this.cueBall.saveState();
        this.ballInHand = true;
        this.hud.showBallInHand();
      }

      if (this.rules.gameState !== GameState.GAME_OVER) {
        this.powerSlider.setLocked(this.ballInHand);
        this.hud.setShotClockRunning(this.mode === GameMode.EIGHT_BALL);
        this.hud.resetShotClock();
        this.hud.setHintVisible(true);
      }
    }
  }

  /**
   * Derive cushion impacts from ball velocity reversals. Read-only: this looks
   * at state the physics step already produced and only emits a sound.
   */
  private detectCushionHits() {
    const halfW = TABLE_GEOMETRY.playWidthIn / 2;
    const halfH = TABLE_GEOMETRY.playHeightIn / 2;
    const near = CONFIG.BALL_RADIUS * 3;

    for (const ball of this.world.balls) {
      const prev = this.prevVel.get(ball.id);
      if (!ball.pocketed && prev) {
        const flippedX = prev.vx * ball.vx < 0 && Math.abs(prev.vx - ball.vx) > CUSHION_IMPACT_EPSILON;
        const flippedY = prev.vy * ball.vy < 0 && Math.abs(prev.vy - ball.vy) > CUSHION_IMPACT_EPSILON;
        const nearVerticalRail = Math.abs(Math.abs(ball.x) - halfW) < near;
        const nearHorizontalRail = Math.abs(Math.abs(ball.y) - halfH) < near;

        if ((flippedX && nearVerticalRail) || (flippedY && nearHorizontalRail)) {
          sound.cushion(Math.min(1, ball.getSpeed() / 120));
        }
      }

      if (prev) {
        prev.vx = ball.vx;
        prev.vy = ball.vy;
      } else {
        this.prevVel.set(ball.id, { vx: ball.vx, vy: ball.vy });
      }
    }
  }

  render() {
    const alpha = this.accumulator / CONFIG.PHYSICS_DT;
    this.renderer.render(this.world, alpha);

    const idle = this.canShoot && this.cueBall && !this.cueBall.pocketed;

    if (idle && this.ballInHand) {
      // Placing the cue ball: translucent preview with an invalid state.
      const pointer = this.input.getPointerWorld();
      this.placementValid = this.isPlacementValid(pointer.x, pointer.y);

      if (this.isPlacingBall && this.cueBall) {
        this.cueBall.x = pointer.x;
        this.cueBall.y = pointer.y;
        this.cueBall.saveState();
      }

      this.renderer.drawPlacementPreview(
        pointer.x,
        pointer.y,
        CONFIG.BALL_RADIUS,
        this.placementValid
      );
    } else if (idle && this.cueBall) {
      // Aim: the pointer sets the angle, Shift damps it 5x for thin cuts.
      this.aimAngle = this.input.getAimAngle(this.cueBall, this.aimAngle);

      const direction = { x: Math.cos(this.aimAngle), y: Math.sin(this.aimAngle) };
      const prediction = this.predictor.predictFirstContact(
        { x: this.cueBall.x, y: this.cueBall.y },
        direction,
        this.world,
        this.cueBall
      );

      // No tier system exists in this build, so the guideline gate is driven by
      // the aim-assist setting: full aids on, a short stub off.
      this.renderer.guidelineFraction = this.aimAssist ? 1 : 0.34;
      this.renderer.cueVisible = true;

      this.renderer.drawTrajectoryLines(
        prediction,
        { x: this.cueBall.x, y: this.cueBall.y },
        direction,
        this.predictor
      );

      // Cue snaps forward over ~90ms after release, then power reads zero.
      const snapping = performance.now() < this.cueSnapUntil;
      this.renderer.drawAimAndCue(
        this.cueBall,
        this.aimAngle,
        snapping ? 0 : this.currentPower,
        this.aimAssist,
        prediction
      );
    } else if (this.cueBall) {
      // Shot in progress: guideline and cue are hidden, input is locked.
      this.renderer.cueVisible = false;
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

    if (now - this.fpsTime >= 1000) {
      this.hud.updateFPS(this.fpsFrames);
      this.fpsFrames = 0;
      this.fpsTime = now;
    }

    if (now - this.upsTime >= 1000) {
      this.hud.updateUPS(this.upsSteps);
      this.upsSteps = 0;
      this.upsTime = now;
    }

    requestAnimationFrame(this.loop);
  };
}

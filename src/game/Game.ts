// Main game controller

import { PhysicsWorld, type PocketCaptureDetails } from '../physics/Physics';
import { Ball } from '../physics/Shapes';
import { Renderer3D } from '../render/Renderer3D';
import { InputManager } from '../input/Input';
import { DebugDraw } from '../debug/DebugDraw';
import { HUD } from '../ui/HUD';
import { CONFIG, CUE_BALL_POSITION, RACK_POSITIONS, BALL_8, BALL_CUE, DEFAULT_USER_NAME, DEFAULT_OPPONENT_NAME } from '../config';
import { getTableGeometry } from '../geometry/Geometry';
import { clampBallInHand } from '../geometry/Placement';
import { EightBallRules, GameState as RulesGameState, type BallInHandPlacement } from '../rules/EightBall';
import { RULES_PRESETS, getRulesDescription } from '../rules/RulesConfig';
import { physicsRecorder } from '../debug/PhysicsRecorder';
import { Predictor } from '../physics/Prediction';
import { shotCapture } from '../debug/ShotCapture';
import { SettingsPanel } from '../ui/SettingsPanel';
import { ModernGeometryPanel } from '../ui/ModernGeometryPanel';
import { AudioPanel } from '../ui/AudioPanel';
import { HelpPanel } from '../ui/HelpPanel';
import { RenderLayerPanel } from '../ui/RenderLayerPanel';
import { scenarioManager } from '../debug/ScenarioManager';
import { Player, PlayerType, BallGroup } from './Player';
import { GameStateMachine, GameState } from './GameStateMachine';
import { PoolAI } from '../ai/PoolAI';
import { GameModeBase } from './modes/GameModeBase';
import { TimeAttackMode, TimeAttackDifficulty } from './modes/TimeAttackMode';
import { PerfectGameMode } from './modes/PerfectGameMode';
import { SpeedPoolMode } from './modes/SpeedPoolMode';
import type { PocketAnimationEvent } from '../render/ControlTypes';
import { AudioManager } from '../sound/AudioManager';
import type { AudioSettings } from '../ui/SettingsManager';
import { PlaybackController } from './PlaybackController';
import { MatchData } from '../debug/PhysicsRecorder';
import { PlaybackPanel } from '../ui/PlaybackPanel';
import { uiStateMachine, UIState } from '../ui/UIStateMachine';
import { db, getChestSlots, updateChestSlot } from '../data/db';
import { MatchRecord } from '../data/models';
import { getChestForLeague, CHEST_DEFINITIONS } from './economy/ChestSystem';
import { getClampedTrophyChange, getLeagueForTrophies } from './economy/TrophySystem';
import { getClubById } from './clubs/ClubRegistry';
import { AssetRegistry } from '../assets/AssetRegistry';
import { currencyStore } from '../ui/CurrencyStore';

export enum GameMode {
  PRACTICE,
  EIGHT_BALL,
  TIME_ATTACK,
  PERFECT_GAME,
  SPEED_POOL,
  PLAYBACK,
}

const POCKET_LABELS: Record<string, string> = {
  NW_corner: 'Head left corner',
  NE_corner: 'Head right corner',
  SW_corner: 'Foot left corner',
  SE_corner: 'Foot right corner',
  N_middle: 'Head side pocket',
  S_middle: 'Foot side pocket',
};

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
  modernGeometryPanel: ModernGeometryPanel;
  renderLayerPanel: RenderLayerPanel;
  audioPanel: AudioPanel;
  helpPanel: HelpPanel;
  rules: EightBallRules;
  predictor: Predictor;
  audio: AudioManager;
  mode: GameMode;
  currentClubId: string | null = null; // Track which club the current match is in
  currentEntryFee: number = 0; // Entry fee for prize calculation
  currentRuleset: string = 'TOURNAMENT'; // Tournament rules as default
  private lastBallScale: number;
  private _lastCanvasScale?: number;
  private currentCalledPocketId: string | null = null;
  private waitingForPocketCall: boolean = false;
  private pendingBallInHandForAI: boolean = false;
  private pausedByBlur: boolean = false;

  // Turn-based gameplay
  players: Player[];
  currentPlayerIndex: number;
  stateMachine: GameStateMachine | null;
  ai: PoolAI | null;
  aiThinkingStartTime: number;
  aiSelectedShot: any | null;
  private aiShotAnim!: { phase: 'warmup' | 'approach' | 'pause' | 'strike'; elapsed: number; aimAngle: number; targetPower: number; seed: number; w1: number; w2: number; aAmpDeg: number; pAmp: number; warmupDur: number; approachDur: number; pauseDur: number; strikeDur: number } | null;

  // Arcade modes
  arcadeMode: GameModeBase | null;

  // Playback
  playbackController: PlaybackController;
  playbackPanelUI: PlaybackPanel;

  // UI
  gameSettingsPanel: any; // Should be GameSettingsPanel type but avoiding import cycle if possible, or just import it.

  // Game loop
  accumulator: number = 0;
  lastTime: number = 0;
  fpsFrames: number = 0;
  fpsTime: number = 0;
  upsSteps: number = 0;
  upsTime: number = 0;
  isPaused: boolean = false;

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
  hasStartedRack: boolean = false;
  microAimDialValue: number = 0;
  isDraggingMicroDial: boolean = false;

  // Cached prediction for frozen paths in power mode (normal mode only)
  cachedPrediction: ReturnType<Predictor['predictFirstContact']> | null = null;
  cachedDirection: { x: number; y: number } | null = null;
  pocketAnimationEvents: PocketAnimationEvent[] = [];

  // Ball dragging (practice mode only)
  isDraggingBall: boolean = false;

  get settingsManager() {
    return this.hud.settingsManager;
  }

  constructor(gameCanvas: HTMLCanvasElement, debugCanvas: HTMLCanvasElement) {
    // Create HUD first - it initializes SettingsManager which loads and applies saved CONFIG values
    this.hud = new HUD();

    this.world = new PhysicsWorld();
    this.world.onBallPocketed = (details) => this.handleBallPocketed(details);
    this.renderer = new Renderer3D(gameCanvas, this.hud.settingsManager);
    this.input = new InputManager(gameCanvas);
    this.debug = new DebugDraw(debugCanvas);
    this.settings = new SettingsPanel(this.hud.settingsManager);
    this.modernGeometryPanel = new ModernGeometryPanel(this.hud.settingsManager, () => this.restart());
    this.renderLayerPanel = new RenderLayerPanel(this.hud.settingsManager, this.renderer);
    this.audioPanel = new AudioPanel(this.hud.settingsManager);
    this.helpPanel = new HelpPanel();
    this.rules = new EightBallRules(RULES_PRESETS[this.currentRuleset]);
    this.predictor = new Predictor();
    this.playbackController = new PlaybackController(this.world);
    this.playbackPanelUI = new PlaybackPanel(this.playbackController, () => {
      this.stopPlayback();
    });
    this.audio = new AudioManager();
    this.audio.setSettings(this.hud.settingsManager.getAudioSettings());
    window.addEventListener('settings:audio-changed', (event) => {
      const detail = (event as CustomEvent<{ settings: AudioSettings }>).detail;
      if (detail?.settings) {
        this.audio.setSettings(detail.settings);
      }
    });
    window.addEventListener('settings:game-changed', (event) => {
      const detail = (event as CustomEvent<{ settings: any }>).detail;
      if (detail?.settings) {
        this.aimAssist = !!detail.settings.aimAssist;
        // Update other live game settings if needed
        if (this.ai) {
          const opponentId = this.mapDifficultyToOpponentId(detail.settings.aiDifficulty ?? 'MEDIUM');
          this.ai.setOpponent(opponentId);
        }
      }
    });
    window.addEventListener('audio:preview', (event) => {
      const detail = (event as CustomEvent<{ event: string }>).detail;
      if (!detail?.event) return;
      this.handleAudioPreview(detail.event);
    });
    this.mode = GameMode.PRACTICE;
    this.lastBallScale = CONFIG.BALL_SCALE ?? 1;

    // Initialize settings
    const initialGameSettings = this.hud.settingsManager.getGameSettings();
    this.aimAssist = initialGameSettings.aimAssist;

    // Initialize turn-based gameplay components (only for EIGHT_BALL mode)
    this.players = [];
    this.currentPlayerIndex = 0;
    this.stateMachine = null;
    this.ai = null;
    this.aiThinkingStartTime = 0;
    this.aiSelectedShot = null;

    // Initialize arcade mode
    this.arcadeMode = null;

    this.registerPanels();

    this.setupCallbacks();
    this.setupEventListeners();
    this.setupCollisionTracking();
    this.initializeGame();
    scenarioManager.attach(this);

    // Log helpful tips
    console.log('💡 Tips:');
    if (this.mode === GameMode.PRACTICE) {
      console.log('  - Hold SHIFT and drag the cue ball to reposition it');
      console.log('  - Press 8 to play against AI opponent (8-Ball mode)');
      console.log('  - Press T for Time Attack mode');
      console.log('  - Press P for Perfect Game mode');
      console.log('  - Press V for Speed Pool mode');
    } else if (this.mode === GameMode.EIGHT_BALL) {
      console.log('  - Playing 8-Ball vs AI');
      console.log('  - Current ruleset:', getRulesDescription(this.rules.config));
      console.log('  - Press 1/2/3/4 to switch rulesets (Casual/Tournament/APA/Practice)');
      console.log('  - Press 8 to return to Practice mode');
    } else if (this.mode === GameMode.TIME_ATTACK) {
      console.log('  - Clear all balls as fast as possible!');
      console.log('  - Press T to return to Practice mode');
    } else if (this.mode === GameMode.PERFECT_GAME) {
      console.log('  - Run the table without missing!');
      console.log('  - Press P to return to Practice mode');
    } else if (this.mode === GameMode.SPEED_POOL) {
      console.log('  - Score points with combos! Each ball adds time.');
      console.log('  - Press V to return to Practice mode');
    }
    console.log('  - Press G to open Modern Geometry panel (angle-based controls)');
    console.log('  - Press J to open Legacy Geometry panel (live pocket adjustments)');
    console.log('  - Press S to open Physics Settings panel');
    console.log('  - Press Shift+D for Debug view');
  }

  isPlayerInputBlocked(): boolean {
    // Block input during playback
    if (this.mode === GameMode.PLAYBACK) {
      return true;
    }
    // Block input during AI's turn in 8-ball mode
    if (this.mode === GameMode.EIGHT_BALL) {
      if (this.pendingBallInHandForAI) {
        return true;
      }
      if (this.stateMachine) {
        return this.stateMachine.isAITurn();
      }
    }
    return false;
  }

  setupCallbacks() {
    // Handle clicks for pocket selection (only when waiting for pocket call)
    this.input.onClick = (worldX, worldY, _event) => {
      // Only process clicks when we're actually waiting for a pocket call
      if (this.waitingForPocketCall) {
        return this.handleClick(worldX, worldY);
      }
      return false;
    };

    const isUIBlockingGameplay = () => uiStateMachine.state !== UIState.IN_GAME;

    // Handle mouse events (power bar, ball dragging)
    this.input.canvas.addEventListener('mousedown', (e) => {
      if (isUIBlockingGameplay()) return;
      if (this.isPlayerInputBlocked()) return;
      // Don't handle ball drag or power bar during pocket selection
      if (this.waitingForPocketCall) return;
      this.handleBallDragStart(e);
      this.handlePowerBarMouseDown(e);
      this.handleMicroDialMouseDown(e);
    });
    const isPointerOverHudHeader = (e: MouseEvent) => {
      const header = document.querySelector('.hud-header') as HTMLElement | null;
      if (!header) return false;
      const rect = header.getBoundingClientRect();
      const x = e.clientX;
      const y = e.clientY;
      return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    };

    window.addEventListener('mousemove', (e) => {
      if (isUIBlockingGameplay()) return;
      if (this.isPlayerInputBlocked()) return;
      if (this.waitingForPocketCall) return;
      if (isPointerOverHudHeader(e)) return;
      this.handleBallDrag(e);
      this.handlePowerBarMouseMove(e);
      this.handleMicroDialMouseMove(e);
    });
    window.addEventListener('mouseup', (e) => {
      if (isUIBlockingGameplay()) return;
      if (this.isPlayerInputBlocked()) return;
      if (this.waitingForPocketCall) return;
      if (isPointerOverHudHeader(e)) return;
      this.handleBallDragEnd(e);
      this.handlePowerBarMouseUp(e);
      this.handleMicroDialMouseUp(e);
    });

    // Handle A key to toggle aim/power mode
    window.addEventListener('keydown', (e) => {
      // ESC key - show in-game menu (only when UI is not already blocking)
      if (e.key === 'Escape') {
        // Only show menu if we're currently in-game (not in lobby/other UI)
        if (uiStateMachine.state === UIState.IN_GAME) {
          uiStateMachine.transitionTo(UIState.IN_GAME_MENU);
        }
        return;
      }

      if (isUIBlockingGameplay()) return;
      if (e.key === 'Shift') {
        this.input.setFineAimActive(true);
      }


      if (e.key === 'a' || e.key === 'A') {
        if (this.isPlayerInputBlocked()) return;
        if (this.waitingForPocketCall) return;
        if (this.isAimMode && this.cueBall && !this.cueBall.pocketed) {
          const aimSensitivity = this.calculateAimSensitivity();
          this.lockedAngle = this.input.getAimAngle(this.cueBall, aimSensitivity);
        }
        this.isAimMode = !this.isAimMode;
        // Reset aim smoothing when entering aim mode for fresh aim
        if (this.isAimMode) {
          this.input.resetAimAngle();
        }
        return;
      }
      if (e.code === 'Space') {
        // Always prevent default to avoid page scrolling
        e.preventDefault();
        if (this.isPlayerInputBlocked()) return;
        if (this.waitingForPocketCall) return;
        if (e.repeat) return;
        if (!this.canShoot || !this.cueBall || this.cueBall.pocketed) return;
        this.spaceKeyHeld = true;
        this.wasAimModeBeforeSpace = this.isAimMode;
        if (this.isAimMode) {
          const aimSensitivity = this.calculateAimSensitivity();
          this.lockedAngle = this.input.getAimAngle(this.cueBall, aimSensitivity);
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
        // Always prevent default to avoid page scrolling
        e.preventDefault();
        if (!this.isSpacePowerMode) {
          this.spaceKeyHeld = false;
          return;
        }
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
      this.hud.showFoul(this.formatFoulMessage(message));
    };

    this.rules.onTurnChange = (player) => {
      this.hud.setTurn(player);
    };

    this.rules.onGameOver = (winner) => {
      const winnerName = this.players?.find(p => p.id === winner)?.name || `Player ${winner}`;
      this.hud.showFoul(`${winnerName} wins!`);
    };
  }

  setupEventListeners() {
    window.addEventListener('resize', () => this.resize());
    window.addEventListener(
      'pointerdown',
      () => {
        this.audio.startBackgroundLoop().catch(() => {
          /* ignore */
        });
        this.audio.startMusicLoop().catch(() => {
          /* ignore */
        });
      },
      { once: true }
    );
    window.addEventListener('renderer:resized', (event: Event) => {
      const detail = (event as CustomEvent<{ width: number; height: number; scale: number; offsetX: number; offsetY: number }>).detail;
      if (!detail) return;
      // Keep input and debug overlay aligned with renderer canvas
      this.input.updateScale(detail.scale);
      this.debug.resize(detail.width, detail.height, detail.scale, detail.offsetX, detail.offsetY);

      // Sync HUD ball chip size (in CSS) with configured default rather than table scale
      const chipSizePx = this.getHudChipSizePx();
      document.documentElement.style.setProperty('--ball-chip-size', `${chipSizePx}px`);

      // Regenerate icons if size changed materially
      const regen = () => {
        const iconSizePx = this.getHudChipIconSizePx();
        if ((this as any)._lastChipIconSizePx === iconSizePx) return;
        if (!(this.renderer as any).ballModelsLoaded) return; // defer until textures ready
        (this as any)._lastChipIconSizePx = iconSizePx;
        if ((this.renderer as any).generateBallIcons) {
          (this.renderer as any).generateBallIcons(iconSizePx).then((map: Map<number, string>) => {
            (window as any).__BALL_ICONS__ = map;
            this.updateHUDPlayerBalls();
          }).catch(() => {/* ignore */ });
        }
      };
      clearTimeout((this as any)._chipIconTimer);
      (this as any)._chipIconTimer = setTimeout(regen, 150);
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

    // Remote Playback Commands
    window.addEventListener('playback:play', () => this.playbackController.play());
    window.addEventListener('playback:pause', () => this.playbackController.pause());
    window.addEventListener('playback:toggle', () => this.playbackController.togglePlay());
    window.addEventListener('playback:seek', (e: any) => {
      this.playbackController.pause();
      this.playbackController.seek(e.detail);
    });
    window.addEventListener('playback:nextShot', () => {
      this.playbackController.pause();
      this.playbackController.nextShot();
    });
    window.addEventListener('playback:prevShot', () => {
      this.playbackController.pause();
      this.playbackController.prevShot();
    });
    window.addEventListener('playback:speed', (e: any) => this.playbackController.setSpeed(e.detail));
    window.addEventListener('playback:load', (e: any) => {
      if (e.detail) {
        this.startPlayback(e.detail);
      }
    });

    window.addEventListener('keydown', (e) => {
      // Require Shift+D to toggle debug mode (prevents accidental triggers)
      if ((e.key === 'd' || e.key === 'D') && e.shiftKey) {
        this.debug.toggle();
        this.syncDebugModeWithRenderer();
      }
      if (e.key === 's' || e.key === 'S') {
        if (e.shiftKey) {
          // Shift+S: Open Settings Scene
          uiStateMachine.transitionTo(UIState.SETTINGS);
          return;
        }
        // Regular S: Toggle Physics Settings Panel (existing behavior)
      }

      if ((e.key === 'p' || e.key === 'P') && e.shiftKey) {
        // Shift+P: Open Profile Scene
        uiStateMachine.transitionTo(UIState.PROFILE);
        return;
      }

      if ((e.key === 'c' || e.key === 'C') && e.shiftKey) {
        // Shift+C: Open Shop (Cues)
        uiStateMachine.transitionTo(UIState.SHOP);
        return;
      }

      // Playback Controls
      if (e.key === 'F5') {
        e.preventDefault();
        if (physicsRecorder.isRecording()) {
          physicsRecorder.stop();
          console.log('📼 Recording stopped. Press F6 to play back.');
        } else {
          physicsRecorder.start();
          console.log('📼 Recording started...');
        }
      }
      if (e.key === 'F6') {
        e.preventDefault();
        if (this.mode === GameMode.PLAYBACK) {
          this.playbackController.togglePlay();
          // Ensure panel is open
          if (!this.hud.panelManager.isPanelOpen('playback-panel')) {
            this.hud.panelManager.openPanel('playback-panel');
          }
        } else if (physicsRecorder.getMatchData()?.snapshots?.length > 0) {
          this.startPlayback(physicsRecorder.getMatchData());
        } else {
          console.warn('⚠️ No recording to play. Press F5 to record first.');
        }
      }
      if (e.key === '[') {
        this.playbackController.pause();
        this.playbackController.prevShot();
      }
      if (e.key === ']') {
        this.playbackController.pause();
        this.playbackController.nextShot();
      }

      // Existing shortcuts
      if (e.key === 'r' || e.key === 'R') {
        this.restart();
      }
      if (e.key === '8') {
        // Toggle between PRACTICE and EIGHT_BALL mode
        this.mode = this.mode === GameMode.PRACTICE ? GameMode.EIGHT_BALL : GameMode.PRACTICE;
        this.restart();
      }
      if (e.key === 't' || e.key === 'T') {
        // Toggle Time Attack mode
        this.mode = this.mode === GameMode.PRACTICE ? GameMode.TIME_ATTACK : GameMode.PRACTICE;
        this.restart();
      }
      if (e.key === 'p' || e.key === 'P') {
        // Toggle Perfect Game mode
        this.mode = this.mode === GameMode.PRACTICE ? GameMode.PERFECT_GAME : GameMode.PRACTICE;
        this.restart();
      }
      if (e.key === 'v' || e.key === 'V') {
        // Toggle Speed Pool mode
        this.mode = this.mode === GameMode.PRACTICE ? GameMode.SPEED_POOL : GameMode.PRACTICE;
        this.restart();
      }
      // Ruleset switching (affects 8-Ball mode rules)
      if (e.key === '1') {
        this.currentRuleset = 'CASUAL';
        console.log('🎱 Ruleset: CASUAL (relaxed bar rules)');
        this.restart();
      }
      if (e.key === '2') {
        this.currentRuleset = 'TOURNAMENT';
        console.log('🎱 Ruleset: TOURNAMENT (strict BCA/WPA rules)');
        this.restart();
      }
      if (e.key === '3') {
        this.currentRuleset = 'APA';
        console.log('🎱 Ruleset: APA (league rules)');
        this.restart();
      }
      if (e.key === '4') {
        this.currentRuleset = 'PRACTICE';
        console.log('🎱 Ruleset: PRACTICE (very relaxed, for learning)');
        this.restart();
      }

      if (e.key === 'm' || e.key === 'M') {
        currencyStore.addCoins(10000);
        console.log('💰 Added 10,000 coins!');
        this.hud.showFoul('💰 Added 10,000 coins!');
      }

      if (e.key === 'b' || e.key === 'B') {
        // Toggle ball-in-hand overlay (enables debug overlay if needed)
        const next = !this.debug.isBallInHandOverlayEnabled();
        this.debug.setBallInHandOverlayEnabled(next);
        this.syncDebugModeWithRenderer();
      }
      if ((e.key === 'l' || e.key === 'L') && !e.shiftKey) {
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

    // React to AI difficulty changes from settings panel
    window.addEventListener('game:ai-difficulty-changed', (e: Event) => {
      const value = (e as CustomEvent<{ value: 'EASY' | 'MEDIUM' | 'HARD' | 'EXPERT' }>).detail?.value ?? 'MEDIUM';
      const opponentId = this.mapDifficultyToOpponentId(value);
      if (this.ai) {
        this.ai.setOpponent(opponentId);
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

    // Listen for pause/resume events from UI
    window.addEventListener('game:pause', () => {
      this.isPaused = true;
      // Reset drag states to prevent stuck interactions
      this.isDraggingBall = false;
      this.isDraggingPower = false;
      this.isDraggingMicroDial = false;
      this.input.canvas.style.cursor = 'default';
      this.world.skipCuePocketCheck = false;
    });

    window.addEventListener('game:resume', () => {
      this.isPaused = false;
      // Reset lastTime to avoid huge time jump delta
      this.lastTime = performance.now();
      this.pausedByBlur = false;
    });

    // Auto-pause on window blur
    window.addEventListener('blur', () => {
      // Don't auto-pause in playback mode (allows using devtools)
      if (this.mode === GameMode.PLAYBACK) return;

      if (!this.isPaused) {
        this.pausedByBlur = true;
        window.dispatchEvent(new CustomEvent('game:pause'));
      }
    });

    const tryResumeFromFocus = () => {
      if (this.pausedByBlur) {
        window.dispatchEvent(new CustomEvent('game:resume'));
      }
    };

    window.addEventListener('focus', tryResumeFromFocus);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        tryResumeFromFocus();
      } else if (!this.isPaused) {
        this.pausedByBlur = true;
        window.dispatchEvent(new CustomEvent('game:pause'));
      }
    });
  }

  private syncDebugModeWithRenderer() {
    this.renderer.setDebugMode(this.debug.isEnabled());
  }

  private registerPanels() {
    // Debug hotkey for playback
    window.addEventListener('keydown', (e) => {
      if (e.shiftKey && (e.key === 'R' || e.key === 'r')) {
        console.log('📼 Starting playback from recorder...');
        const data = physicsRecorder.getMatchData();
        this.startPlayback(data);
      }
    });



    this.hud.registerPanel('playback-panel', this.playbackPanelUI.getController(), {
      hotkeys: [],
      persistState: false,
    });
    this.hud.registerPanel('physics-settings', this.settings.getController(), {
      hotkeys: ['s'],
      persistState: true,
    });
    this.hud.registerPanel('modern-geometry-panel', this.modernGeometryPanel.getController(), {
      hotkeys: ['g'],
      persistState: true,
    });
    this.hud.registerPanel('render-layer-panel', this.renderLayerPanel.getController(), {
      hotkeys: ['l'],
      persistState: true,
    });

    this.hud.registerPanel('audio-panel', this.audioPanel.getController(), {
      hotkeys: ['u'],
      persistState: true,
    });
    this.hud.registerPanel('help-panel', this.helpPanel.getController(), {
      hotkeys: ['h', '?'],
      persistState: true,
    });
    this.hud.panelManager.restoreLastPanel();
  }

  public startMatch(clubId: string) {
    console.log(`Starting match for club: ${clubId}`);
    this.mode = GameMode.EIGHT_BALL;
    this.currentClubId = clubId; // Store for trophy calculations

    // Map club difficulty to AI difficulty
    // This is a simplified mapping for now
    // In a real implementation, we'd look up the club def and get specific AI settings
    if (this.ai) {
      // Default to medium
      let difficulty = 'MEDIUM';
      if (clubId.includes('basement')) difficulty = 'EASY';
      else if (clubId.includes('shark')) difficulty = 'HARD';
      else if (clubId.includes('legend')) difficulty = 'EXPERT';

      const opponentId = this.mapDifficultyToOpponentId(difficulty as any);
      this.ai.setOpponent(opponentId);
    }

    this.restart();
  }

  initializeGame() {
    try {
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
        Math.sin(Math.PI / 3) *
        1.02; // Slightly looser rack

      console.log(`[Game] InitializeGame: radius=${currentRadius} diameter=${diameter} spacing=${rowSpacingX} configRadius=${CONFIG.BALL_RADIUS} configScale=${CONFIG.BALL_SCALE}`);

      // Build rack of 15 balls
      const rackX = RACK_POSITIONS[0].x;
      const apexY = RACK_POSITIONS[0].y;

      // 5 rows: 1, 2, 3, 4, 5 balls
      const rows = [
        [{ id: 1 }], // Row 1 (Apex)
        [{ id: 9 }, { id: 2 }], // Row 2
        [{ id: 3 }, { id: 8 }, { id: 10 }], // Row 3 (8-ball in center)
        [{ id: 11 }, { id: 4 }, { id: 12 }, { id: 5 }], // Row 4
        [{ id: 6 }, { id: 13 }, { id: 7 }, { id: 14 }, { id: 15 }], // Row 5
      ];

      rows.forEach((rowBalls, rowIndex) => {
        const rowX = rackX + rowIndex * rowSpacingX;
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

      // Initialize HUD player balls at game start
      this.updateHUDPlayerBalls();

      // Generate ball icon thumbnails for HUD and update once ready
      if ((this.renderer as any).generateBallIcons) {
        const tryGenerate = () => {
          const iconSizePx = this.getHudChipIconSizePx();
          (this.renderer as any).generateBallIcons(iconSizePx).then((map: Map<number, string>) => {
            (window as any).__BALL_ICONS__ = map;
            this.updateHUDPlayerBalls();
          }).catch(() => {/* ignore icon errors */ });
        };

        // Defer until ball models/textures are loaded to ensure real textures are used
        const waitForTextures = () => {
          if ((this.renderer as any).ballModelsLoaded) {
            tryGenerate();
            return true;
          }
          return false;
        };

        if (!waitForTextures()) {
          let attempts = 0;
          const poll = () => {
            if (waitForTextures() || attempts++ > 50) {
              clearInterval((this as any)._chipPollTimer);
            }
          };
          (this as any)._chipPollTimer = setInterval(poll, 120);
        }
      }

      this.resize();
      this.rules.startGame();

      this.currentCalledPocketId = null;
      this.rules.setCalledPocket(null);

      // Set mode display with ruleset if in 8-Ball mode
      if (this.mode === GameMode.PRACTICE) {
        this.hud.setMode('Practice Mode');
        this.hud.hideTurnIndicator();
        this.hud.setTurn(1, false, true); // Suppress notification on init
        this.hud.setPlayer2Visible(false);

        // Set default player name and visuals, then load from DB
        this.hud.setPlayerName(1, DEFAULT_USER_NAME);
        this.hud.setPlayerVisuals(1, this.getAvatarUrl(), this.getFrameForLeague());

        // Load user profile visuals async and update when ready
        db.user.get(1).then((user) => {
          if (!user) return;
          this.hud.setPlayerName(1, user.name || DEFAULT_USER_NAME);
          this.hud.setPlayerVisuals(1, this.getAvatarUrl(user.avatarId), this.getFrameForLeague(user.leagueId));
        }).catch((err) => {
          console.warn('Failed to load user profile for practice mode visuals', err);
        });
      } else if (this.mode === GameMode.PLAYBACK) {
        // Playback mode initialization handled by startPlayback
        // We just need to ensure we don't overwrite it
        return;
      } else if (this.mode === GameMode.TIME_ATTACK) {
        this.initializeTimeAttack();
        this.hud.setPlayer2Visible(false); // Hide Player 2 in arcade modes
      } else if (this.mode === GameMode.PERFECT_GAME) {
        this.initializePerfectGame();
        this.hud.setPlayer2Visible(false); // Hide Player 2 in arcade modes
      } else if (this.mode === GameMode.SPEED_POOL) {
        this.initializeSpeedPool();
        this.hud.setPlayer2Visible(false); // Hide Player 2 in arcade modes
      } else if (this.mode === GameMode.EIGHT_BALL) {
        this.hud.setMode('8-Ball Pool');
        // Show Player 2 and turn indicator for 8-Ball mode
        this.hud.setPlayer2Visible(true);
        this.initializePlayers();
      }

      this.lastBallScale = CONFIG.BALL_SCALE ?? 1;

    } catch (error) {
      console.error('Failed to initialize game:', error);
    } finally {
      // Hide loading screen once initialization is complete (or failed)
      this.renderer.hideLoadingScreen();
    }
  }

  initializePlayers() {
    // Create human player and AI opponent
    const humanPlayer = new Player(1, DEFAULT_USER_NAME, PlayerType.HUMAN);
    const aiPlayer = new Player(2, DEFAULT_OPPONENT_NAME, PlayerType.AI);

    this.players = [humanPlayer, aiPlayer];
    this.currentPlayerIndex = 0; // Human starts

    // Update HUD player names with defaults while data loads
    this.hud.setPlayerName(1, humanPlayer.name);
    this.hud.setPlayerName(2, aiPlayer.name);
    this.hud.setPlayerVisuals(1, this.getAvatarUrl(), this.getFrameForLeague());
    this.hud.setPlayerVisuals(2, this.getAvatarUrl('rookie_rick'), this.getFrameForLeague('bronze_1'));

    console.log('[8-Ball] Players initialized:', {
      player0: { id: this.players[0].id, type: this.players[0].type, isAI: this.players[0].isAI() },
      player1: { id: this.players[1].id, type: this.players[1].type, isAI: this.players[1].isAI() },
      currentPlayerIndex: this.currentPlayerIndex,
      rulesCurrentPlayer: this.rules.currentPlayer,
    });

    // Initialize AI with selected opponent from preview, or fall back to difficulty setting
    const selectedOpponentId = (window as any).__selectedOpponentId;
    let opponentId: string;
    if (selectedOpponentId) {
      opponentId = selectedOpponentId;
      // Clear for next match
      (window as any).__selectedOpponentId = null;
    } else {
      const gs = this.hud.settingsManager.getGameSettings();
      opponentId = this.mapDifficultyToOpponentId(gs.aiDifficulty ?? 'MEDIUM');
    }
    this.ai = new PoolAI(opponentId);
    const opponentDef = this.ai.getOpponentDef();
    aiPlayer.name = opponentDef.name;
    this.hud.setPlayerName(2, aiPlayer.name);
    this.hud.setPlayerVisuals(2, this.getAvatarUrl(opponentDef.avatarId), this.getFrameForLeague(opponentDef.leagueId));

    // Load user profile visuals async and update HUD when ready
    db.user.get(1).then((user) => {
      if (!user) return;
      humanPlayer.name = user.name || humanPlayer.name;
      this.hud.setPlayerName(1, humanPlayer.name);
      this.hud.setPlayerVisuals(1, this.getAvatarUrl(user.avatarId), this.getFrameForLeague(user.leagueId));
    }).catch((err) => {
      console.warn('Failed to load user profile for HUD visuals', err);
    });

    // Set up rules callbacks
    this.rules.onGroupAssigned = (playerId: number, group: number) => {
      // Ignore NONE (0)
      if (group === 0) return;

      const player = this.players.find(p => p.id === playerId);
      if (player) {
        const ballGroup = group === 1 ? BallGroup.SOLIDS : BallGroup.STRIPES;
        player.assignGroup(ballGroup);
        const setName = ballGroup === BallGroup.SOLIDS ? 'SOLIDS' : 'STRIPES';
        console.log('[8-Ball] Player', playerId, 'assigned', setName);

        // Show notification to user
        const playerName = this.players?.find(p => p.id === playerId)?.name || `Player ${playerId}`;
        const message = playerId === 1
          ? `${setName.toUpperCase()} ARE YOURS!`
          : `${playerName} has ${setName}`;
        this.hud.showFoul(message);

        // Update HUD ball chips to reflect assigned groups
        this.updateHUDPlayerBalls();
      }
    };

    this.rules.onFoul = (message: string) => {
      this.hud.showFoul(this.formatFoulMessage(message));
    };

    this.rules.onGameOver = async (winner: number) => {
      console.log('[8-Ball] Game over! Winner:', winner);
      this.canShoot = false;
      if (this.stateMachine && this.stateMachine.state !== GameState.GAME_OVER) {
        this.stateMachine.transitionTo(GameState.GAME_OVER);
      }

      // Check if winner is AI or human player
      const winningPlayer = this.players.find(p => p.id === winner);
      const humanPlayer = this.players.find(p => !p.isAI());
      const aiPlayer = this.players.find(p => p.isAI());

      // Save match record if it's a valid Human vs AI game
      if (humanPlayer && aiPlayer) {
        const isWin = winningPlayer?.id === humanPlayer.id;
        const record: MatchRecord = {
          timestamp: Date.now(),
          opponentId: this.ai?.getOpponentDef().id || 'unknown',
          opponentName: aiPlayer.name,
          userScore: isWin ? 1 : 0,
          opponentScore: isWin ? 0 : 1,
          result: isWin ? 'win' : 'loss',
          earnings: isWin ? this.currentEntryFee * 2 : 0, // Winner gets 2x entry fee, loser gets nothing
          leagueId: this.currentClubId || 'club_basement', // Use tracked club
        };

        let chestAwarded: string | null = null;
        let trophyChange = 0;

        try {
          await db.matches.add(record);

          // Get current user for trophy calculation
          const currentUser = await db.user.get(1);
          const currentTrophies = currentUser?.trophies || 0;

          // Calculate trophy change based on club and result
          trophyChange = getClampedTrophyChange(
            this.currentClubId || 'club_basement',
            isWin,
            currentTrophies
          );

          // Update user stats and trophies
          await db.user.where('id').equals(1).modify(user => {
            user.stats.gamesPlayed++;
            user.stats.totalEarnings += record.earnings;

            // Update trophies
            user.trophies = Math.max(0, (user.trophies || 0) + trophyChange);

            // Update league based on new trophy count
            const newLeague = getLeagueForTrophies(user.trophies);
            user.leagueId = newLeague.id;

            if (isWin) {
              user.stats.wins++;
              user.stats.winStreak++;
              user.coins += record.earnings;
            } else {
              user.stats.losses++;
              user.stats.winStreak = 0; // Reset streak on loss
              user.coins += record.earnings;
            }
          });
          console.log('Match saved to DB:', record, `Trophies: ${trophyChange > 0 ? '+' : ''}${trophyChange}`);

          // Award chest for winning (Miniclip style)
          if (isWin) {
            chestAwarded = await this.awardChestForWin(this.currentClubId || 'club_basement');
          }

          // Sync currency store with database (including trophies)
          const user = await db.user.get(1);
          if (user) {
            const { currencyStore } = await import('../ui/CurrencyStore');
            currencyStore.setBalances({
              coins: user.coins,
              gold: user.gold,
              trophies: user.trophies || 0
            });
          }
        } catch (e) {
          console.error('Failed to save match:', e);
        }

        // Transition to match result screen
        const matchResultData = {
          isWin,
          earnings: record.earnings,
          trophyChange,
          opponentName: aiPlayer.name,
          opponentId: record.opponentId,
          chestAwarded,
          clubId: this.currentClubId,
        };
        (window as any).__lastMatchResult = matchResultData;

        // Small delay before transitioning to result screen
        setTimeout(() => {
          uiStateMachine.transitionTo(UIState.MATCH_RESULT);
        }, 1500);
      }

      let winnerMessage: string;
      if (winningPlayer && winningPlayer.isAI()) {
        winnerMessage = 'Better luck next time!';
      } else if (winner === 1) {
        winnerMessage = 'VICTORY! You cleared the table!';
      } else {
        const winnerName = winningPlayer?.name || `Player ${winner}`;
        winnerMessage = `${winnerName} wins the match!`;
      }

      console.log('[8-Ball] Winner message:', winnerMessage);
      this.hud.showFoul(winnerMessage);
    };

    // Initialize state machine
    this.stateMachine = new GameStateMachine(humanPlayer);
    this.stateMachine.onBreak();

    // Update HUD to show player's turn
    this.hud.setTurn(1, false);
  }

  private mapDifficultyToOpponentId(value: 'EASY' | 'MEDIUM' | 'HARD' | 'EXPERT'): string {
    switch (value) {
      case 'EASY': return 'rookie_rick';
      case 'HARD': return 'shark_sally';
      case 'EXPERT': return 'the_machine';
      case 'MEDIUM':
      default: return 'steady_steve';
    }
  }

  private getFrameForLeague(leagueId?: string): string {
    const id = (leagueId || '').toLowerCase();
    if (id.includes('diamond')) return AssetRegistry.frames.diamond();
    if (id.includes('platinum')) return AssetRegistry.frames.platinum();
    if (id.includes('gold')) return AssetRegistry.frames.gold();
    if (id.includes('silver')) return AssetRegistry.frames.silver();
    if (id.includes('master')) return AssetRegistry.frames.master();
    if (id.includes('elite')) return AssetRegistry.frames.elite();
    if (id.includes('emerald')) return AssetRegistry.frames.emerald();
    if (id.includes('crystal')) return AssetRegistry.frames.crystal();
    return AssetRegistry.frames.bronze();
  }

  private getAvatarUrl(avatarId?: string): string {
    const normalized = this.normalizeAvatarKey(avatarId);
    const avatarFn = (AssetRegistry.avatars as Record<string, () => string>)[normalized] || AssetRegistry.avatars.player;
    return avatarFn();
  }

  private normalizeAvatarKey(avatarId?: string): string {
    if (!avatarId) return 'player';
    // Just strip the 'avatar_' prefix if present, keep snake_case format
    return avatarId.replace(/^avatar_/, '');
  }

  initializeTimeAttack() {
    // Create Time Attack mode instance
    this.arcadeMode = new TimeAttackMode(TimeAttackDifficulty.EASY);
    this.arcadeMode.onStart();

    // Update HUD
    this.hud.setMode('Time Attack');
    this.hud.hideTurnIndicator();
    // Set player 1 as active in Time Attack mode
    this.hud.setTurn(1, false);

    console.log('⏱️ Time Attack mode initialized');
  }

  initializePerfectGame() {
    // Create Perfect Game mode instance
    this.arcadeMode = new PerfectGameMode();
    this.arcadeMode.onStart();

    // Update HUD
    this.hud.setMode('Perfect Game');
    this.hud.hideTurnIndicator();
    // Set player 1 as active in Perfect Game mode
    this.hud.setTurn(1, false);

    console.log('🎯 Perfect Game mode initialized');
  }

  initializeSpeedPool() {
    // Create Speed Pool mode instance
    this.arcadeMode = new SpeedPoolMode();
    this.arcadeMode.onStart();

    // Update HUD
    this.hud.setMode('Speed Pool');
    this.hud.hideTurnIndicator();
    // Set player 1 as active in Speed Pool mode
    this.hud.setTurn(1, false);

    console.log('⚡ Speed Pool mode initialized');
  }

  restart() {
    // Reset all game loop state
    this.accumulator = 0;
    this.lastTime = 0;
    this.fpsFrames = 0;
    this.fpsTime = 0;
    this.upsSteps = 0;
    this.upsTime = 0;

    // Reset shooting state
    this.canShoot = true;
    this.currentPower = 0;
    this.isDraggingPower = false;
    this.isAimMode = true;
    this.lockedAngle = 0;
    this.isSpacePowerMode = false;
    this.wasAimModeBeforeSpace = true;
    this.powerDragStartY = 0;
    this.spaceKeyHeld = false;
    this.hasStartedRack = false;

    // Reset prediction cache
    this.cachedPrediction = null;
    this.cachedDirection = null;

    // Reset ball dragging state
    this.isDraggingBall = false;

    // Reset pocket calling state
    this.currentCalledPocketId = null;
    this.waitingForPocketCall = false;
    this.pendingBallInHandForAI = false;

    // Reset AI state
    this.aiThinkingStartTime = 0;
    this.aiSelectedShot = null;
    this.aiShotAnim = null;

    // Reset input state
    this.input.resetAimAngle();
    this.input.isDraggingPowerBar = false;
    this.input.canvas.style.cursor = 'default';

    // Clear HUD messages
    // notificationService handles this automatically


    // Rebuild physics world (recomputes rails/pockets from current CONFIG)
    this.world = new PhysicsWorld();
    this.world.onBallPocketed = (details) => this.handleBallPocketed(details);

    // Recreate rules with current ruleset config
    this.rules = new EightBallRules(RULES_PRESETS[this.currentRuleset]);
    this.rules.setCalledPocket(null);

    // Re-attach collision callback after world recreation
    this.setupCollisionTracking();

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

  setupCollisionTracking() {
    // Hook up ball collision tracking for rules engine
    this.world.onBallCollision = (ballA, ballB) => {
      this.playBallCollisionAudio(ballA, ballB);
      if (this.mode !== GameMode.EIGHT_BALL) return;

      // Track first contact with cue ball
      const cueBallId = 0;
      if (ballA.id === cueBallId && !ballB.pocketed) {
        this.rules.recordFirstContact(ballB.id);
      } else if (ballB.id === cueBallId && !ballA.pocketed) {
        this.rules.recordFirstContact(ballA.id);
      }
    };
    // Track rail contact
    if (this.world) {
      this.world.onRailCollision = (ball, _rail) => {
        this.playRailCollisionAudio(ball);
        if (this.mode !== GameMode.EIGHT_BALL) return;
        this.rules.recordRailContact(ball?.id);
      };
    }
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
    this.cueBall.lastPocketId = null;
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
    if (!this.canShoot) return;
    if (this.mode === GameMode.EIGHT_BALL && this.rules.gameState === RulesGameState.GAME_OVER) return;
    if (this.mode === GameMode.EIGHT_BALL) {
      const hasCalledPocket = this.ensureCalledPocketIfNeeded();
      if (!hasCalledPocket) {
        return;
      }
    }

    this.hasStartedRack = true;

    // Ensure audio is fully unlocked and ready on first shot
    // This primes the audio pipeline to prevent silent first collision
    this.audio.ensureUnlocked().catch(() => {
      // Silently ignore - audio will work on next attempt
    });

    // Clear cached prediction and aim angle smoothing state
    this.cachedPrediction = null;
    this.cachedDirection = null;
    this.input.resetAimAngle();
    this.isAimMode = false;

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
    const intensity = Math.max(0, Math.min(1, power / CONFIG.CUE_POWER_MAX));
    if (CONFIG.HEAVY_SHOT_SHAKE_MAX_OFFSET_PX && this.renderer && typeof (this.renderer as any).triggerShotShake === 'function') {
      (this.renderer as any).triggerShotShake(intensity);
    }
    this.audio.playCueHit(intensity);
    this.canShoot = false;

    if (this.mode === GameMode.EIGHT_BALL) {
      this.rules.startShot(this.world.balls);
    }

    // Track shot in arcade mode
    if (this.arcadeMode) {
      this.arcadeMode.onShotTaken(angle, power);
    }
  }

  update(dt: number) {
    if (this.mode === GameMode.PLAYBACK) {
      this.playbackController.update(dt);
      return;
    }

    this.accumulator += dt;

    // Skip physics simulation while dragging cue ball during ball-in-hand
    // to prevent other balls from being pushed by the dragged cue ball
    if (!this.isDraggingBall) {
      while (this.accumulator >= CONFIG.PHYSICS_DT) {
        this.world.step(CONFIG.PHYSICS_DT);
        physicsRecorder.recordFrame(this.world);
        this.accumulator -= CONFIG.PHYSICS_DT;
        this.upsSteps++;
      }
    }

    // Check if all balls are sleeping
    const allSleeping = this.world.balls.every(b => b.pocketed || b.sleeping);
    const matchOver =
      this.mode === GameMode.EIGHT_BALL && this.rules.gameState === RulesGameState.GAME_OVER;

    if (allSleeping && !this.canShoot && !matchOver) {
      // Check for shot capture completion
      if (shotCapture.isCapturing() && this.cueBall) {
        const targetBall = this.world.balls.find(b => b.id !== 0 && !b.pocketed);
        shotCapture.checkForRest(this.cueBall, targetBall || null);
      }

      if (this.mode === GameMode.EIGHT_BALL) {
        this.handleShotComplete();
      }

      // Handle arcade mode shot completion
      if (this.arcadeMode) {
        this.arcadeMode.onShotComplete(this.world.balls);
      }

      this.canShoot = !matchOver;
      if (!matchOver) {
        this.isAimMode = true;
        this.wasAimModeBeforeSpace = true;
        this.input.resetAimAngle();
      }

      if (this.cueBall && this.cueBall.pocketed && !matchOver) {
        this.respawnCueBall();
      }
    } else if (!this.canShoot && this.rules.gameState === RulesGameState.GAME_OVER) {
      this.canShoot = false;
    }

    // Handle AI turn
    if (this.mode === GameMode.EIGHT_BALL && this.canShoot) {
      this.handleAITurn(dt);
    }

    // Update arcade mode (timers, etc.)
    if (this.arcadeMode) {
      this.arcadeMode.update(dt);

      // Update HUD with arcade stats
      const hudData = this.arcadeMode.getHUDData();
      this.hud.showArcadeStats(hudData);

      // Check completion
      const completion = this.arcadeMode.checkCompletion(this.world.balls);
      if (completion.isComplete && !this.arcadeMode.isComplete) {
        this.arcadeMode.isComplete = true;
        this.hud.showFoul(completion.message || 'Complete!');
        console.log('🏁', completion.message);
      }
    }
  }

  /**
   * Handle shot completion in EIGHT_BALL mode
   */
  handleShotComplete() {
    this.rules.endShot(this.world.balls);
    this.clearCalledPocketAfterShot();
    // Update HUD player balls after any pocketing
    this.updateHUDPlayerBalls();

    // Update turn management based on rules state
    if (this.stateMachine && this.players.length > 0) {
      const currentPlayer = this.players[this.currentPlayerIndex];

      console.log('[8-Ball] Shot complete:', {
        currentPlayerIndex: this.currentPlayerIndex,
        currentPlayerId: currentPlayer.id,
        currentPlayerType: currentPlayer.type,
        currentPlayerGroup: currentPlayer.group,
        rulesCurrentPlayer: this.rules.currentPlayer,
        stateMachineState: this.stateMachine.state,
      });

      // Check if game is over
      if (this.rules.gameState === RulesGameState.GAME_OVER) {
        this.stateMachine.transitionTo(GameState.GAME_OVER);
        return;
      }

      // Check if turn changed (rules handle turn switching)
      if (this.rules.currentPlayer !== currentPlayer.id) {
        console.log('[8-Ball] Turn changed to player', this.rules.currentPlayer);
        this.switchToPlayer(this.rules.currentPlayer - 1);
      } else {
        console.log('[8-Ball] Same player continues');
        // Same player continues - transition from BREAK to appropriate turn state
        if (this.stateMachine.state === GameState.BREAK) {
          if (currentPlayer.isAI()) {
            console.log('[8-Ball] Transitioning BREAK -> AI_TURN');
            this.stateMachine.transitionTo(GameState.AI_TURN);
            this.aiThinkingStartTime = performance.now();
            this.aiSelectedShot = null;
            this.hud.setTurn(currentPlayer.id, true);
            this.hud.showAIThinking();
          } else {
            console.log('[8-Ball] Transitioning BREAK -> PLAYER_TURN');
            this.stateMachine.transitionTo(GameState.PLAYER_TURN);
            this.hud.setTurn(currentPlayer.id, false);
          }
        }
      }

      // Check if current player needs to call pocket (after turn is determined)
      this.checkAndPromptPocketCall();
      this.updateBallInHandAssistState();
    }
  }

  /**
   * Switch to a specific player
   */
  switchToPlayer(playerIndex: number) {
    this.currentPlayerIndex = playerIndex;
    const currentPlayer = this.players[this.currentPlayerIndex];

    if (this.stateMachine) {
      this.stateMachine.switchPlayer(currentPlayer);

      if (currentPlayer.isAI()) {
        this.stateMachine.transitionTo(GameState.AI_TURN);
        this.aiThinkingStartTime = performance.now();
        this.aiSelectedShot = null;
        this.hud.setTurn(currentPlayer.id, true);
        this.hud.showAIThinking();
      } else {
        this.stateMachine.transitionTo(GameState.PLAYER_TURN);
        this.hud.setTurn(currentPlayer.id, false);
      }
    }
  }

  /**
   * Compute and push remaining group balls per player to HUD.
   */
  private updateHUDPlayerBalls() {
    if (!this.hud) return;
    const balls = this.world?.balls ?? [];

    // In practice mode or arcade modes, show all remaining balls on the table
    if (this.mode !== GameMode.EIGHT_BALL) {
      const allRemainingIds = balls
        .filter(b => b.id > 0 && !b.pocketed) // Exclude cue ball (id=0) and pocketed balls
        .map(b => b.id);

      // Show all balls in player 1's panel only (player 2 panel is hidden)
      this.hud.updateAllBalls(1, allRemainingIds);
      return;
    }

    // 8-Ball mode: show grouped balls
    const remainingForGroup = (group: BallGroup | null): number[] | null => {
      if (group === null) return null;
      const targetIds = group === BallGroup.SOLIDS
        ? [1, 2, 3, 4, 5, 6, 7]
        : [9, 10, 11, 12, 13, 14, 15];
      const remaining = targetIds.filter(id => {
        const b = balls.find(x => x.id === id);
        return b && !b.pocketed;
      });

      // If player has cleared all their group balls, add the 8-ball
      if (remaining.length === 0) {
        const eightBall = balls.find(b => b.id === 8);
        if (eightBall && !eightBall.pocketed) {
          remaining.push(8);
        }
      }

      return remaining;
    };

    const p1 = this.players && this.players.length > 0 ? this.players[0] : undefined;
    const p2 = this.players && this.players.length > 1 ? this.players[1] : undefined;

    if (!p1 || !p2) {
      // Players not initialized yet – show placeholders
      this.hud.updatePlayerBalls(1, null);
      this.hud.updatePlayerBalls(2, null);
      return;
    }

    this.hud.updatePlayerBalls(1, remainingForGroup(p1.group ?? null));
    this.hud.updatePlayerBalls(2, remainingForGroup(p2.group ?? null));
  }

  private handleBallPocketed(details: PocketCaptureDetails) {
    const { ball, pocket, position, velocity } = details;
    const iconMap: Map<number, string> | undefined = (window as any).__BALL_ICONS__;
    const iconSrc = iconMap?.get(ball.id);
    const event: PocketAnimationEvent = {
      ballId: ball.id,
      position: { x: position.x, y: position.y },
      velocity: { x: velocity.x, y: velocity.y },
      pocket: { id: pocket.id ?? null, x: pocket.x, y: pocket.y },
      radius: ball.radius,
      timestamp: performance.now(),
      icon: iconSrc,
    };

    this.pocketAnimationEvents.push(event);
    if (this.pocketAnimationEvents.length > 48) {
      this.pocketAnimationEvents.splice(0, this.pocketAnimationEvents.length - 48);
    }

    if (typeof this.renderer.queuePocketAnimation === 'function') {
      this.renderer.queuePocketAnimation(event);
    }

    const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
    const intensity = Math.max(0, Math.min(1, speed / 220));
    if (intensity > 0.05) {
      this.audio.playPocketDrop(intensity);
    }

    // Track balls potted by human player (exclude cue ball)
    if (ball.id !== BALL_CUE && this.mode === GameMode.EIGHT_BALL) {
      // Check if current shooter is human
      const currentPlayer = this.players[this.currentPlayerIndex];
      if (currentPlayer && !currentPlayer.isAI()) {
        this.trackBallPotted();
      }
    }

    // Update HUD to show pocketed balls in ball chips
    this.updateHUDPlayerBalls();
  }

  /**
   * Track a ball potted by the human player
   */
  private async trackBallPotted(): Promise<void> {
    try {
      await db.user.where('id').equals(1).modify(user => {
        user.stats.ballsPotted++;
      });
    } catch (e) {
      console.error('Failed to track ball potted:', e);
    }
  }

  private playBallCollisionAudio(ballA: Ball, ballB: Ball) {
    const relVx = ballA.vx - ballB.vx;
    const relVy = ballA.vy - ballB.vy;
    const relSpeed = Math.sqrt(relVx * relVx + relVy * relVy);
    const intensity = Math.max(0, Math.min(1, relSpeed / 200));
    if (intensity > 0.03) {
      this.audio.playBallCollision(intensity);
    }
  }

  private playRailCollisionAudio(ball?: Ball | null) {
    if (!ball) return;
    const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
    const intensity = Math.max(0, Math.min(1, speed / 180));
    if (intensity > 0.02) {
      this.audio.playRailHit(intensity);
    }
  }

  private handleAudioPreview(eventKey: string) {
    const intensity = 0.75;
    switch (eventKey) {
      case 'CUE':
        this.audio.playCueHit(intensity);
        break;
      case 'BALL':
        this.audio.playBallCollision(intensity);
        break;
      case 'RAIL':
        this.audio.playRailHit(intensity);
        break;
      case 'POCKET':
        this.audio.playPocketDrop(intensity);
        break;
      case 'MUSIC':
        this.audio.startMusicLoop().catch(() => {
          /* ignore */
        });
        break;
      case 'BACKGROUND':
        this.audio.startBackgroundLoop().catch(() => {
          /* ignore */
        });
        break;
      default:
        break;
    }
  }

  private getHudChipSizePx(): number {
    return Math.max(8, Math.min(128, CONFIG.HUD_BALL_CHIP_SIZE_PX ?? 28));
  }

  private getHudChipIconSizePx(): number {
    const baseSizePx = this.getHudChipSizePx();
    // Multiply by device pixel ratio for retina displays to generate higher quality icons
    // Also multiply by 1.5 to account for the CSS scale transform
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    return Math.max(8, Math.min(256, Math.round(baseSizePx * dpr * 1.5)));
  }

  /**
   * Handle AI turn logic
   */
  handleAITurn(dt: number) {
    if (!this.ai || !this.stateMachine) return;
    if (!this.stateMachine.isAITurn()) return;
    if (!this.cueBall || this.cueBall.pocketed) return;

    const currentPlayer = this.players[this.currentPlayerIndex];
    if (!currentPlayer.isAI()) return;

    if (this.pendingBallInHandForAI) {
      const placed = this.placeCueBallForAI();
      if (!placed) {
        return;
      }
    }

    // If AI hasn't selected a shot yet, wait for thinking time
    if (!this.aiSelectedShot) {
      const elapsed = performance.now() - this.aiThinkingStartTime;

      if (elapsed >= this.ai.getThinkingTime()) {
        // Select shot
        console.log('[AI] Selecting shot for player', currentPlayer.id, 'group:', currentPlayer.group);

        this.aiSelectedShot = this.ai.selectShot(this.world, currentPlayer);

        if (!this.aiSelectedShot) {
          // No valid shot found - should play safety or pass
          console.warn('[AI] Could not find a valid shot, switching turn');
          // Sync rules engine before switching game state
          this.rules.switchPlayer();
          this.switchToPlayer((this.currentPlayerIndex + 1) % this.players.length);
          return;
        }
        console.log('[AI] Selected shot:', this.aiSelectedShot);

        // Check if AI needs to call pocket for 8-ball AFTER selecting shot
        const config = this.rules.config;
        const requiresCall = config.requireCalled8Ball || config.requireCalledShots;
        if (requiresCall && !this.currentCalledPocketId) {
          const hasCleared = this.rules.hasPlayerClearedGroup(currentPlayer.id, this.world.balls);
          if (hasCleared) {
            const eightBall = this.world.balls.find((ball) => ball.id === BALL_8);
            if (eightBall && !eightBall.pocketed && this.aiSelectedShot.targetBall.id === BALL_8) {
              // Call the pocket the AI is actually aiming for
              const targetPocketId = this.aiSelectedShot.pocket.id;
              if (targetPocketId) {
                this.setCalledPocket(targetPocketId, false);
                console.log(`🤖 AI called pocket: ${this.getPocketLabel(targetPocketId)}`);
              }
            }
          }
        }
      }
    } else {
      // Animate cue like a real player, then execute the shot
      if (!this.aiShotAnim) {
        const r = Math.random;
        const stats = this.ai?.getOpponentDef().stats;
        const accuracy = stats?.accuracy ?? 0.5;

        // Per-shot randomized dynamics
        const baseW1 = 1.0 + r() * 1.5; // cycles/sec
        const baseW2 = 2.0 + r() * 2.0;

        // Angle waggle amplitude in degrees based on accuracy (inverse relationship)
        // High accuracy (1.0) -> low waggle (~0.15 deg)
        // Low accuracy (0.0) -> high waggle (~2.5 deg)
        const aAmpDeg = (2.5 - (accuracy * 2.35)) + r() * (1 - accuracy) * 0.5;
        const pAmp = Math.min(this.aiSelectedShot.power * (0.10 + r() * 0.08), 3.2);
        const warmupDur = 0.45 + r() * 0.35; // 0.45-0.8s
        const approachDur = 0.35 + r() * 0.25; // 0.35-0.6s
        const pauseDur = 0.12 + r() * 0.15; // 0.12-0.27s
        const strikeDur = 0.16 + r() * 0.10; // 0.16-0.26s

        this.aiShotAnim = {
          phase: 'warmup',
          elapsed: 0,
          aimAngle: this.aiSelectedShot.aimAngle,
          targetPower: this.aiSelectedShot.power,
          seed: r(),
          w1: baseW1 * 2 * Math.PI,
          w2: baseW2 * 2 * Math.PI,
          aAmpDeg,
          pAmp,
          warmupDur,
          approachDur,
          pauseDur,
          strikeDur,
        };
        // Drive UI state to show cue/power bar for AI
        this.canShoot = true;
        this.isAimMode = false;
        this.lockedAngle = this.aiSelectedShot.aimAngle;
        this.currentPower = 0;
        // Ensure prediction recalculates each frame for AI animation
        this.cachedPrediction = null;
        this.cachedDirection = null;
      }

      if (this.aiShotAnim) {
        this.aiShotAnim.elapsed += dt;
        const p = this.aiShotAnim;
        const warmupDuration = p.warmupDur;
        const approachDuration = p.approachDur;
        const pauseDuration = p.pauseDur;
        const strikeDuration = p.strikeDur;

        if (p.phase === 'warmup') {
          // Gentle oscillation in power and slight angle waggle
          // Two-frequency LFO with random seed phases and gentle decay envelope
          const phase1 = p.w1 * p.elapsed + p.seed * Math.PI * 2;
          const phase2 = p.w2 * p.elapsed + (1 - p.seed) * Math.PI * 2;
          const env = 0.85 + 0.15 * Math.cos(Math.min(1, p.elapsed / warmupDuration) * Math.PI); // subtle decay
          const waggle = (p.aAmpDeg * Math.PI / 180) * env * (Math.sin(phase1) * 0.7 + Math.sin(phase2) * 0.3);
          const base = Math.min(p.targetPower * 0.22, 3.6);
          this.lockedAngle = p.aimAngle + waggle;
          this.currentPower = base + p.pAmp * (0.5 + 0.5 * Math.sin(phase1 * 0.85 + 0.3 * Math.sin(phase2)));
          // force fresh prediction (align aim line with cue)
          this.cachedPrediction = null;
          this.cachedDirection = null;
          if (p.elapsed >= warmupDuration) {
            p.phase = 'approach';
            p.elapsed = 0;
          }
        } else if (p.phase === 'approach') {
          const t = Math.min(1, p.elapsed / approachDuration);
          const eased = t * t * (3 - 2 * t); // smoothstep
          this.lockedAngle = p.aimAngle; // keep aligning
          this.currentPower = p.targetPower * 0.7 * eased; // approach to 70%
          // force fresh prediction (align aim line with cue)
          this.cachedPrediction = null;
          this.cachedDirection = null;
          if (t >= 1) {
            p.phase = 'pause';
            p.elapsed = 0;
          }
        } else if (p.phase === 'pause') {
          if (p.elapsed >= pauseDuration) {
            p.phase = 'strike';
            p.elapsed = 0;
          }
        } else if (p.phase === 'strike') {
          const t = Math.min(1, p.elapsed / strikeDuration);
          const eased = t * t; // accelerate in
          // Final micro-refinement on high accuracy: ease angle back to precise aim
          const stats = this.ai?.getOpponentDef().stats;
          const isHighSkill = (stats?.accuracy ?? 0) > 0.7;
          const refine = isHighSkill ? (1 - (1 - eased) * 0.5) : eased;
          this.currentPower = p.targetPower * (0.7 + 0.3 * eased);
          this.lockedAngle = p.aimAngle * refine + this.lockedAngle * (1 - refine);
          // force fresh prediction (align aim line with cue)
          this.cachedPrediction = null;
          this.cachedDirection = null;
          if (t >= 1) {
            // Fire the shot
            console.log('[AI] Executing shot');
            const finalAngle = this.lockedAngle;
            const finalPower = Math.max(p.targetPower, this.currentPower);
            this.shoot(finalAngle, finalPower);
            this.aiSelectedShot = null;
            this.aiShotAnim = null;
            // Reset UI shot controls
            this.isAimMode = true;
            this.currentPower = 0;
          }
        }
      }
    }
  }

  /**
   * Calculate aim sensitivity multiplier based on distance to nearest object ball
   * Returns 1.0 for short shots, lower values (finer control) for long shots
   */
  private calculateAimSensitivity(): number {
    if (!CONFIG.DISTANCE_AIM_SCALING_ENABLED || !this.cueBall) {
      return 1.0;
    }

    // Find nearest non-cue ball
    let minDistance = Infinity;
    for (const ball of this.world.balls) {
      if (ball.id === 0 || ball.pocketed) continue; // Skip cue ball and pocketed balls
      const dx = ball.x - this.cueBall.x;
      const dy = ball.y - this.cueBall.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < minDistance) {
        minDistance = distance;
      }
    }

    // If no object balls found, use default sensitivity
    if (minDistance === Infinity) {
      return 1.0;
    }

    // Map distance to sensitivity using linear interpolation
    // Short shots (< MIN_DISTANCE): full sensitivity (1.0)
    // Long shots (> MAX_DISTANCE): minimum sensitivity (MIN_SENSITIVITY)
    if (minDistance <= CONFIG.DISTANCE_AIM_MIN_DISTANCE) {
      return 1.0;
    } else if (minDistance >= CONFIG.DISTANCE_AIM_MAX_DISTANCE) {
      return CONFIG.DISTANCE_AIM_MIN_SENSITIVITY;
    } else {
      // Linear interpolation between min and max distance
      const t = (minDistance - CONFIG.DISTANCE_AIM_MIN_DISTANCE) /
        (CONFIG.DISTANCE_AIM_MAX_DISTANCE - CONFIG.DISTANCE_AIM_MIN_DISTANCE);
      return 1.0 - t * (1.0 - CONFIG.DISTANCE_AIM_MIN_SENSITIVITY);
    }
  }

  private getMicroAimOffsetDegrees(): number {
    const maxDegrees = CONFIG.MICRO_AIM_MAX_DEGREES ?? 0;
    return maxDegrees * this.microAimDialValue;
  }

  private getMicroAimOffsetRadians(): number {
    return this.getMicroAimOffsetDegrees() * Math.PI / 180;
  }

  private applyMicroAimOffset(angle: number): number {
    if (!this.microAimDialValue) return angle;
    let adjusted = angle + this.getMicroAimOffsetRadians();
    const tau = Math.PI * 2;
    while (adjusted <= -Math.PI) adjusted += tau;
    while (adjusted > Math.PI) adjusted -= tau;
    return adjusted;
  }

  startPlayback(data: MatchData) {
    if (!data || (!data.shots.length && !data.snapshots?.length)) {
      console.warn('⚠️ No playback data available');
      // @ts-ignore - notificationService is global or imported in HUD but we need access
      // Actually, we can import it or just use console for now, or access via HUD if exposed.
      // HUD doesn't expose it directly.
      // Let's just log for now and maybe alert.
      alert('No recording data found! Please play a few shots first.');
      return;
    }

    this.mode = GameMode.PLAYBACK;

    // Update PlaybackController's world reference to current world
    // (in case world was recreated since controller initialization)
    this.playbackController.world = this.world;

    this.playbackController.loadMatch(data);
    this.playbackController.play();
    this.hud.setMode('Replay');
    this.hud.hideTurnIndicator();

    // Show Playback UI
    this.hud.panelManager.openPanel('playback-panel');
    this.playbackPanelUI.updateDuration(data.duration);
  }

  stopPlayback() {
    console.log('📼 stopPlayback called');
    this.playbackController.pause();
    this.mode = GameMode.PRACTICE; // Default back to practice
    this.restart();

    this.hud.panelManager.closePanel('playback-panel');
  }

  private setMicroAimDialValue(value: number) {
    const clamped = Math.max(-1, Math.min(1, value));
    const snapped = Math.abs(clamped) < 0.01 ? 0 : clamped;
    if (Math.abs(snapped - this.microAimDialValue) < 1e-4) return;
    this.microAimDialValue = snapped;
    this.cachedPrediction = null;
    this.cachedDirection = null;
  }

  private updateMicroDialFromMouse(bounds: { x: number; y: number; width: number; height: number }, mouseY: number) {
    const relative = Math.max(0, Math.min(1, (mouseY - bounds.y) / bounds.height));
    const normalized = (0.5 - relative) * 2;
    this.setMicroAimDialValue(normalized);
  }

  render() {
    // In playback mode, use alpha=1.0 since we're setting exact positions via seek()
    // In normal mode, use accumulator for physics interpolation
    const alpha = this.mode === GameMode.PLAYBACK ? 1.0 : this.accumulator / CONFIG.PHYSICS_DT;

    this.renderer.render(this.world, alpha);

    // Only draw UI overlays (cue, power bar, dial) when in actual gameplay, not in lobby/menu scenes
    if (uiStateMachine.state !== UIState.IN_GAME) {
      return;
    }

    // Draw cue line and power bar if can shoot (hide during ball-in-hand drag only)
    if (this.mode !== GameMode.PLAYBACK && this.canShoot && this.cueBall && !this.cueBall.pocketed && !this.isDraggingBall) {
      // Calculate aim sensitivity based on distance to nearest object ball
      const aimSensitivity = this.calculateAimSensitivity();

      // Use locked angle in power mode, live angle in aim mode
      const baseAngle = this.isAimMode ? this.input.getAimAngle(this.cueBall, aimSensitivity) : this.lockedAngle;
      const angle = this.applyMicroAimOffset(baseAngle);

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

      const microDialState = {
        value: this.microAimDialValue,
        degrees: this.getMicroAimOffsetDegrees(),
        isActive: this.isDraggingMicroDial,
      };
      this.renderer.drawCueAndPowerBar(this.cueBall, angle, this.currentPower, this.aimAssist, true, this.isAimMode, prediction, microDialState, alpha);
    }

    // Highlight pockets when waiting for pocket call
    if (this.waitingForPocketCall) {
      this.renderer.highlightPocketsForSelection(this.getPocketChoices());
    }

    // Show called pocket indicator if a pocket has been called
    if (this.currentCalledPocketId && !this.waitingForPocketCall) {
      const allPockets = this.getPocketChoices();
      const calledPocket = allPockets.find(p => p.id === this.currentCalledPocketId);
      if (calledPocket) {
        this.renderer.highlightCalledPocket(calledPocket);
      }
    }

    this.debug.draw(this.world);

    this.fpsFrames++;
  }

  /**
   * Check if a game is currently in progress and should warn before leaving
   */
  isInProgress(): boolean {
    // Practice mode doesn't need warning
    if (this.mode === GameMode.PRACTICE) return false;

    // If game is over, no warning needed
    if (this.stateMachine && this.stateMachine.state === GameState.GAME_OVER) return false;

    // If we haven't started the rack (break shot not taken), maybe safe?
    // But usually once we enter the game scene in 8-ball, we are "in game".
    // Let's be strict: if we are in 8-Ball mode and not Game Over, we are in progress.
    if (this.mode === GameMode.EIGHT_BALL) return true;

    // Arcade modes
    if (this.arcadeMode && !this.arcadeMode.isComplete) return true;

    return false;
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

    if (!this.isPaused) {
      if (this.playbackController.isPlaying) {
        this.playbackController.update(dt);
      } else {
        this.update(dt);
        if (physicsRecorder.isRecording()) {
          physicsRecorder.recordFrame(this.world);
        }
      }
    }
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
      this.input.setAimSuppressed(true);
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
      this.input.setAimSuppressed(true);
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
    this.input.setAimSuppressed(false);

    const canShootNow =
      this.currentPower >= CONFIG.CUE_POWER_MIN &&
      this.cueBall &&
      !this.cueBall.pocketed;

    let shotFired = false;
    if (canShootNow) {
      const shotAngle = this.applyMicroAimOffset(this.lockedAngle);
      this.shoot(shotAngle, this.currentPower);
      this.currentPower = 0;
      shotFired = true;
    }

    if (this.isSpacePowerMode && !this.spaceKeyHeld) {
      this.isSpacePowerMode = false;
      if (!shotFired) {
        this.isAimMode = this.wasAimModeBeforeSpace;
        if (this.wasAimModeBeforeSpace) {
          this.currentPower = 0;
        }
      }
    }
  }

  handleMicroDialMouseDown(e: MouseEvent) {
    if (!this.canShoot || !this.cueBall || this.cueBall.pocketed) return;
    const bounds = this.renderer.getMicroDialBounds();
    if (!bounds) return;

    const rect = this.input.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (
      mouseX >= bounds.x &&
      mouseX <= bounds.x + bounds.width &&
      mouseY >= bounds.y &&
      mouseY <= bounds.y + bounds.height
    ) {
      if (e.detail >= 2) {
        this.setMicroAimDialValue(0);
        this.isDraggingMicroDial = false;
        return;
      }
      this.isDraggingMicroDial = true;
      this.updateMicroDialFromMouse(bounds, mouseY);
    }
  }

  handleMicroDialMouseMove(e: MouseEvent) {
    if (!this.isDraggingMicroDial) return;
    const bounds = this.renderer.getMicroDialBounds();
    if (!bounds) return;

    const rect = this.input.canvas.getBoundingClientRect();
    const mouseY = e.clientY - rect.top;
    this.updateMicroDialFromMouse(bounds, mouseY);
  }

  handleMicroDialMouseUp(_e: MouseEvent) {
    if (!this.isDraggingMicroDial) return;
    this.isDraggingMicroDial = false;
  }

  handleBallDragStart(e: MouseEvent) {
    const isBallInHandPhase = this.isBallInHandPhase();
    // Allow drag during official ball-in-hand or practice mode when balls are at rest
    if (!this.canShoot && !isBallInHandPhase) return;
    if (!e.shiftKey && !isBallInHandPhase) return;
    if (!this.cueBall || this.cueBall.pocketed) return;

    // Convert screen coords to game coords (same transform as renderer)
    const rect = this.input.canvas.getBoundingClientRect();
    const canvasCenterX = this.renderer.canvas.width / 2;
    const canvasCenterY = this.renderer.canvas.height / 2;

    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    const mouseX = (screenX - canvasCenterX) / this.renderer.scale;
    const mouseY = -(screenY - canvasCenterY) / this.renderer.scale; // Flip Y

    // Check if clicking on cue ball - must click directly on the ball
    const dx = mouseX - this.cueBall.x;
    const dy = mouseY - this.cueBall.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Only allow drag if clicking within the ball radius (not extended radius)
    if (dist <= this.cueBall.radius) {
      const allowBallInHandDrag = isBallInHandPhase;
      const allowFreeDrag =
        allowBallInHandDrag || CONFIG.DEBUG_BIH_LOG || this.debug.isBallInHandOverlayEnabled();
      this.isDraggingBall = true;
      this.input.canvas.style.cursor = 'move';
      // Suppress cue pocketing while dragging
      this.world.skipCuePocketCheck = true;
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
        const kitchenLimitedX = this.applyKitchenLimit(clampedX, margin);
        this.cueBall.x = kitchenLimitedX;
        this.cueBall.y = clampedY;

        if (CONFIG.DEBUG_BIH_LOG) {
          // eslint-disable-next-line no-console
          console.log('BIH drag start', {
            raw: { x: mouseX, y: mouseY },
            clamped: { x: kitchenLimitedX, y: clampedY },
          });
        }
      }
    }
  }

  handleBallDrag(e: MouseEvent) {
    if (!this.isDraggingBall || !this.cueBall) return;

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
    const kitchenLimitedX = this.applyKitchenLimit(clampedX, margin);
    this.cueBall.x = kitchenLimitedX;
    this.cueBall.y = clampedY;

    // Round-trip coordinate check (screen->world->screen)
    // screenX/screenY defined above; compare with renderer's projection
    const re = this.renderer.worldToScreen(mouseX, mouseY);
    const rtErrorPx = Math.hypot(re.x - screenX, re.y - screenY);
    this.debug.setBallInHandData({
      raw: { x: mouseX, y: mouseY },
      clamped: { x: kitchenLimitedX, y: clampedY },
      radius: this.cueBall.radius,
      hits: result.hits.length,
      rtErrorPx,
    });
    if (CONFIG.DEBUG_BIH_LOG) {
      // eslint-disable-next-line no-console
    }
  }

  handleBallDragEnd(_e: MouseEvent) {
    if (!this.isDraggingBall) return;
    this.isDraggingBall = false;
    this.input.canvas.style.cursor = 'default';
    this.world.skipCuePocketCheck = false;
  }

  /**
   * Proactively check if pocket needs to be called and show prompt
   * Called after shot completion when turn is determined
   */
  private checkAndPromptPocketCall(): void {
    // Only check for human players
    if (this.isCurrentShooterAI()) return;

    // Only if not already waiting
    if (this.waitingForPocketCall) return;

    if (this.mode !== GameMode.EIGHT_BALL) return;
    const config = this.rules.config;
    const requiresCall = config.requireCalled8Ball || config.requireCalledShots;
    if (!requiresCall) return;

    // Check if player has cleared their group
    const hasCleared = this.rules.hasPlayerClearedGroup(this.rules.currentPlayer, this.world.balls);
    if (!hasCleared) return;

    // Check if 8-ball is still on table
    const eightBall = this.world.balls.find((ball) => ball.id === BALL_8);
    if (!eightBall || eightBall.pocketed) return;

    // Check if pocket already called
    if (this.currentCalledPocketId) return;

    // Show pocket selection prompt
    this.promptCalledPocket();
  }

  /**
   * Ensure pocket is called before allowing shot (blocks shooting if not called)
   */
  private ensureCalledPocketIfNeeded(): boolean {
    if (this.mode !== GameMode.EIGHT_BALL) return true;
    const config = this.rules.config;
    const requiresCall = config.requireCalled8Ball || config.requireCalledShots;
    if (!requiresCall) return true;

    // TODO: when requireCalledShots = true, extend beyond 8-ball-only workflow.
    const hasCleared = this.rules.hasPlayerClearedGroup(this.rules.currentPlayer, this.world.balls);
    if (!hasCleared) return true;

    const eightBall = this.world.balls.find((ball) => ball.id === BALL_8);
    if (!eightBall || eightBall.pocketed) return true;

    if (this.currentCalledPocketId) return true;

    // Handle AI auto-call
    if (this.isCurrentShooterAI()) {
      const autoPocket = this.pickNearestPocketId(eightBall);
      if (autoPocket) {
        this.setCalledPocket(autoPocket, true);
        console.log(`🤖 AI auto-called pocket: ${this.getPocketLabel(autoPocket)}`);
      }
      return true;
    }

    // Human player hasn't called yet - block the shot
    // (prompt should have been shown already by checkAndPromptPocketCall)
    if (!this.waitingForPocketCall) {
      this.promptCalledPocket();
    }
    return false;
  }

  private promptCalledPocket(): boolean {
    const choices = this.getPocketChoices();
    if (choices.length === 0) {
      return true;
    }

    // Enable pocket selection mode - pockets will be clickable (only if not already waiting)
    if (!this.waitingForPocketCall) {
      this.waitingForPocketCall = true;
      this.hud.showFoul('Call your pocket!');
    }

    // Return false to block the shot until a pocket is called
    return false;
  }

  private getPocketChoices() {
    const geom = getTableGeometry();
    return geom.pockets
      .filter((pocket) => pocket.id && POCKET_LABELS[pocket.id])
      .map((pocket) => ({
        id: pocket.id,
        label: this.getPocketLabel(pocket.id),
        center: { x: pocket.center.x, y: pocket.center.y },
      }));
  }

  private getPocketLabel(pocketId: string): string {
    return POCKET_LABELS[pocketId] ?? pocketId ?? 'Unknown pocket';
  }

  private setCalledPocket(pocketId: string | null, silent: boolean = false) {
    this.currentCalledPocketId = this.mode === GameMode.EIGHT_BALL ? pocketId : null;
    this.rules.setCalledPocket(this.currentCalledPocketId);
    if (!silent && pocketId) {
      console.log(`🎯 Called pocket: ${this.getPocketLabel(pocketId)}`);
    }
  }

  private clearCalledPocketAfterShot() {
    if (this.mode !== GameMode.EIGHT_BALL) return;
    this.setCalledPocket(null, true);
  }

  private handleClick(worldX: number, worldY: number): boolean {
    // Only handle clicks when waiting for pocket call
    if (!this.waitingForPocketCall) return false;

    // Check if click is near any pocket
    const geom = getTableGeometry();
    const pockets = geom.pockets.filter(p => p.id && POCKET_LABELS[p.id]);

    // Use a generous click radius (in inches)
    const clickRadius = 3.0;

    for (const pocket of pockets) {
      const dx = worldX - pocket.center.x;
      const dy = worldY - pocket.center.y;
      const distance = Math.hypot(dx, dy);

      if (distance <= clickRadius) {
        // Pocket clicked!
        this.waitingForPocketCall = false;
        this.setCalledPocket(pocket.id);
        console.log(`🎯 Called pocket: ${this.getPocketLabel(pocket.id)}`);
        return true; // Click was handled
      }
    }

    return false; // Click was not on a pocket
  }

  private pickNearestPocketId(eightBall: Ball): string | null {
    const choices = this.getPocketChoices();
    if (choices.length === 0) return null;
    let nearest: { id: string; distance: number } | null = null;
    for (const choice of choices) {
      const dx = eightBall.x - choice.center.x;
      const dy = eightBall.y - choice.center.y;
      const distance = Math.hypot(dx, dy);
      if (!nearest || distance < nearest.distance) {
        nearest = { id: choice.id, distance };
      }
    }
    return nearest ? nearest.id : null;
  }

  private isCurrentShooterAI(): boolean {
    if (this.mode !== GameMode.EIGHT_BALL) return false;
    if (
      this.players.length === 0 ||
      this.currentPlayerIndex < 0 ||
      this.currentPlayerIndex >= this.players.length
    ) {
      return false;
    }
    const player = this.players[this.currentPlayerIndex];
    return player ? player.isAI() : false;
  }

  private isBallInHandPhase(): boolean {
    return (
      this.mode === GameMode.EIGHT_BALL &&
      this.rules.gameState === RulesGameState.BALL_IN_HAND
    );
  }

  private shouldRestrictToKitchen(): boolean {
    return this.isBallInHandPhase() && this.rules.getBallInHandPlacement() === 'KITCHEN';
  }

  private applyKitchenLimit(x: number, radius: number): number {
    if (!this.shouldRestrictToKitchen()) {
      return x;
    }
    const geom = getTableGeometry();
    const playWidth = geom.playWidthIn ?? CONFIG.TABLE_WIDTH;
    const headStringX = -(playWidth / 4);
    const limit = headStringX - radius + 1e-3;
    return Math.min(x, limit);
  }

  private formatFoulMessage(message: string): string {
    if (!this.isBallInHandPhase()) {
      return message;
    }

    if (this.rules.getBallInHandPlacement() === 'KITCHEN') {
      return `${message} Place the cue ball behind the head string.`;
    }
    return message;
  }

  /**
   * Award a chest for winning a match (Miniclip style)
   * Chests are stored in slots and need to be unlocked with time or gold
   * Returns the chest type awarded, or null if no slot available
   */
  private async awardChestForWin(clubId: string): Promise<string | null> {
    try {
      // Get tier from club difficulty (1-10 maps to chest tiers 1-5)
      const club = getClubById(clubId);
      let tier = 1;
      if (club) {
        // Map difficulty 1-10 to tier 1-5
        // difficulty 1-2 = tier 1, 3-4 = tier 2, 5-6 = tier 3, 7-8 = tier 4, 9-10 = tier 5
        tier = Math.min(5, Math.ceil(club.difficulty / 2));
      }

      // Determine chest type based on league
      const chestType = getChestForLeague(tier);
      const chestDef = CHEST_DEFINITIONS[chestType];

      // Get current chest slots
      const slots = await getChestSlots();

      // Find first empty slot
      const emptySlot = slots.find(s => s.status === 'empty');
      if (!emptySlot) {
        console.log('📦 Chest earned but no empty slots! Player needs to open existing chests.');
        return null;
      }

      // Award chest to empty slot
      await updateChestSlot(emptySlot.slotIndex, {
        chestType: chestType,
        status: 'locked',
        unlockStartTime: null,
        unlockEndTime: null
      });

      console.log(`📦 ${chestDef.name} awarded to slot ${emptySlot.slotIndex}!`);
      return chestType;
    } catch (e) {
      console.error('Failed to award chest:', e);
      return null;
    }
  }

  private updateBallInHandAssistState(): void {
    if (this.mode !== GameMode.EIGHT_BALL) {
      this.pendingBallInHandForAI = false;
      return;
    }
    if (this.isBallInHandPhase() && this.isCurrentShooterAI()) {
      this.pendingBallInHandForAI = true;
    } else {
      this.pendingBallInHandForAI = false;
    }
  }

  private placeCueBallForAI(): boolean {
    if (!this.pendingBallInHandForAI || !this.cueBall) {
      return this.pendingBallInHandForAI ? false : true;
    }

    const placement = this.rules.getBallInHandPlacement();
    const geom = getTableGeometry();
    const radius = this.cueBall.radius;
    const halfW = (geom.playWidthIn ?? CONFIG.TABLE_WIDTH) / 2;
    const halfH = (geom.playHeightIn ?? CONFIG.TABLE_HEIGHT) / 2;

    const candidates = this.getAIBallInHandCandidates(placement, radius);
    let fallback: { x: number; y: number } | null = null;

    const clampTarget = (target: { x: number; y: number }) => {
      const clampResult = clampBallInHand(
        target,
        radius,
        this.world.rails,
        this.world.pockets,
        {
          iterations: CONFIG.BALL_IN_HAND_ITERATIONS,
          pocketMargin: CONFIG.BALL_IN_HAND_POCKET_MARGIN_IN,
        }
      );
      const boundedX = Math.max(-halfW + radius, Math.min(halfW - radius, clampResult.x));
      const boundedY = Math.max(-halfH + radius, Math.min(halfH - radius, clampResult.y));
      const kitchenLimitedX = this.applyKitchenLimit(boundedX, radius);
      return { x: kitchenLimitedX, y: boundedY };
    };

    for (const candidate of candidates) {
      const spot = clampTarget(candidate);
      if (this.isCueBallSpotOpen(spot.x, spot.y, radius)) {
        this.commitAIBallPlacement(spot.x, spot.y);
        return true;
      }
      if (!fallback) {
        fallback = spot;
      }
    }

    if (fallback) {
      this.commitAIBallPlacement(fallback.x, fallback.y);
      return true;
    }

    return false;
  }

  private commitAIBallPlacement(x: number, y: number) {
    if (!this.cueBall) return;
    this.cueBall.x = x;
    this.cueBall.y = y;
    this.cueBall.vx = 0;
    this.cueBall.vy = 0;
    this.cueBall.angularVelocity = 0;
    this.cueBall.sleeping = true;
    this.cueBall.pocketed = false;
    this.cueBall.lastPocketId = null;
    this.pendingBallInHandForAI = false;
    console.log('[AI] Ball-in-hand placement', { x: x.toFixed(2), y: y.toFixed(2) });
  }

  private getAIBallInHandCandidates(
    placement: BallInHandPlacement,
    radius: number
  ): Array<{ x: number; y: number }> {
    const geom = getTableGeometry();
    const headStringX = -(geom.playWidthIn ?? CONFIG.TABLE_WIDTH) / 4;
    const safeKitchenX = headStringX - radius - 0.5;
    const yOffsets = [0, 6, -6, 12, -12, 18, -18, 24, -24];
    const candidates: Array<{ x: number; y: number }> = [];
    const kitchenXs = [safeKitchenX, safeKitchenX - 4, safeKitchenX - 8];
    const anywhereXs = [CUE_BALL_POSITION.x, -15, -10, -5, 0, 5, 10, 15];
    const bases = placement === 'KITCHEN' ? kitchenXs : anywhereXs;
    for (const baseX of bases) {
      for (const offset of yOffsets) {
        candidates.push({ x: baseX, y: offset });
      }
    }
    if (placement === 'ANYWHERE') {
      candidates.push({ x: 0, y: 0 });
    }
    return candidates;
  }

  private isCueBallSpotOpen(x: number, y: number, radius: number): boolean {
    const minClearance = radius * 2 + 0.1;
    for (const ball of this.world.balls) {
      if (ball === this.cueBall) continue;
      if (ball.pocketed) continue;
      const dist = Math.hypot(ball.x - x, ball.y - y);
      if (dist < minClearance) {
        return false;
      }
    }
    return true;
  }
}
// React to AI difficulty changes from settings panel

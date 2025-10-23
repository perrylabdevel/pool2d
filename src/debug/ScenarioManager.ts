// Scenario manager for reproducible shot setups
// Provides console-accessible helpers to load and play curated test shots

import { CONFIG } from '../config';
import type { Game } from '../game/Game';
import { Ball } from '../physics/Shapes';
import { PhysicsWorld } from '../physics/Physics';
import { shotCapture } from './ShotCapture';
import type { Renderer3D } from '../render/Renderer3D';
import { getTableGeometry } from '../geometry/Geometry';

type ScenarioId =
  | 'straight-mid'
  | 'quarter-cut'
  | 'thin-slice'
  | 'rail-ride'
  | 'rail-ride-long';

interface ScenarioBall {
  id: number;
  x: number;
  y: number;
  label?: string;
}

interface ShotPlan {
  angleDeg: number;
  power: number;
  targetBallId?: number;
  description: string;
  tags: string[];
  autoAimAtTarget?: boolean;
}

interface ScenarioDefinition {
  id: ScenarioId;
  label: string;
  description: string;
  cueBall: { x: number; y: number };
  balls: ScenarioBall[];
  shot: ShotPlan;
  notes?: string[];
}

interface LoadOptions {
  autoAim?: boolean;
  autoPower?: boolean;
  startCapture?: boolean;
  log?: boolean;
}

interface ShootOptions {
  startCapture?: boolean;
  log?: boolean;
}

class ScenarioManager {
  private game: Game | null = null;
  private activeScenario: ScenarioDefinition | null = null;

  private readonly scenarios: Record<ScenarioId, ScenarioDefinition> = {
    'straight-mid': {
      id: 'straight-mid',
      label: 'Straight-in center cut',
      description: 'Cue ball to 1-ball straight into the east corner. Good baseline comparison shot.',
      cueBall: { x: -34, y: 0 },
      balls: [
        { id: 1, x: -6, y: 0, label: '1-ball' },
      ],
      shot: {
        angleDeg: 2.5,
        power: 7,
        targetBallId: 1,
        description: 'Dead-straight drive toward the right corner pocket',
        tags: ['baseline', 'no-rail'],
      },
      notes: [
        'Line up the ghost ball exactly through the 1-ball center.',
        'Object ball should run cleanly toward the east corner without rail contact.',
      ],
    },
    'quarter-cut': {
      id: 'quarter-cut',
      label: 'Quarter-ball cut to side',
      description: 'Moderate cut on the 2-ball toward the north side pocket. Exercises object-ball deflection math.',
      cueBall: { x: -32, y: -4 },
      balls: [
        { id: 2, x: -8, y: 6, label: '2-ball' },
      ],
      shot: {
        angleDeg: Math.atan2(10, 24) * (180 / Math.PI),
        power: 6,
        targetBallId: 2,
        description: 'Aim slightly above center; expect object ball through the upper side pocket line.',
        tags: ['cut', 'side-pocket'],
      },
      notes: [
        'Great for checking aim line offset vs. actual deflection at ~25°.',
        'Watch cue-ball follow to confirm spin-free tangent behaviour.',
      ],
    },
    'thin-slice': {
      id: 'thin-slice',
      label: 'Thin slice to corner',
      description: 'Extremely thin contact on the 3-ball close to the south rail. Tests ghost-ball offset accuracy.',
      cueBall: { x: -37, y: -8 },
      balls: [
        { id: 3, x: -8, y: -21.3, label: '3-ball' },
      ],
      shot: {
        angleDeg: Math.atan2(-13.3, 29) * (180 / Math.PI),
        power: 7.5,
        targetBallId: 3,
        description: 'Feather the 3-ball toward the southeast corner; expect long travel before pocket.',
        tags: ['thin-cut', 'corner-pocket'],
      },
      notes: [
        'Ball is a ball-radius off the rail; slight overcut sends it rail-first.',
        'Cue ball should run three rails—useful for validating post-collision path.',
      ],
    },
    'rail-ride': {
      id: 'rail-ride',
      label: 'Rail rider cut',
      description: 'Cue ball bumps a ball that is nearly frozen to the north cushion so the object traces the rail.',
      cueBall: { x: -39, y: 24 - CONFIG.BALL_RADIUS * 1.5 },
      balls: [
        { id: 4, x: -14, y: 24 - CONFIG.BALL_RADIUS, label: '4-ball' },
      ],
      shot: {
        angleDeg: 0,
        power: 7.0,
        targetBallId: 4,
        description: 'Punch slightly upward through the 4-ball; it should skim the top rail into the corner.',
        tags: ['rail', 'glancing', 'object-ride'],
        autoAimAtTarget: true,
      },
      notes: [
        'Cue ball start is slightly off the cushion so you can swing freely.',
        'Verifies prediction accuracy when the object ball stays in contact with the rail after impact.',
        'Cue ball should glance off and drift to the center; tweak y-offsets to explore cling vs. separation.',
      ],
    },
    'rail-ride-long': {
      id: 'rail-ride-long',
      label: 'Rail rider deep cut',
      description: 'Cue ball starts far back and drives the object ball along the north rail into the corner.',
      cueBall: { x: -46, y: 24 - CONFIG.BALL_RADIUS * 1.2 },
      balls: [
        { id: 5, x: -12, y: 24 - CONFIG.BALL_RADIUS, label: '5-ball' },
      ],
      shot: {
        angleDeg: 0,
        power: 11.0,
        targetBallId: 5,
        description: 'Accelerate from distance; object should pick up the rail and run long to the corner pocket.',
        tags: ['rail', 'glancing', 'long-distance'],
        autoAimAtTarget: true,
      },
      notes: [
        'Long approach highlights prediction drift over travel distance.',
        'Use shot capture to compare energy loss before the rail contact.',
      ],
    },
  };

  attach(game: Game) {
    this.game = game;
    (window as any).shotScenarios = this;
    console.info('🎯 Scenario manager ready. Call shotScenarios.list() to see available setups.');
  }

  list() {
    const rows = Object.values(this.scenarios).map((scenario) => ({
      id: scenario.id,
      label: scenario.label,
      focus: scenario.shot.tags.join(', '),
    }));
    console.table(rows);
  }

  getActiveScenario(): ScenarioDefinition | null {
    return this.activeScenario;
  }

  load(id: ScenarioId, options: LoadOptions = {}) {
    if (!this.game) {
      console.warn('Scenario manager not attached yet.');
      return;
    }

    const scenario = this.scenarios[id];
    if (!scenario) {
      console.warn(`Unknown scenario "${id}". Call shotScenarios.list() for valid ids.`);
      return;
    }

    const world = new PhysicsWorld();
    world.balls = [];

    const cueBall = this.createBall(0, scenario.cueBall.x, scenario.cueBall.y);
    world.addBall(cueBall);
    this.game.cueBall = cueBall;

    scenario.balls.forEach((ballDef) => {
      const ball = this.createBall(ballDef.id, ballDef.x, ballDef.y);
      world.addBall(ball);
    });

    if (scenario.id === 'rail-ride' || scenario.id === 'rail-ride-long') {
      const geom = getTableGeometry();
      const targetBall = world.balls.find((ball) => ball.id === scenario.shot.targetBallId) || null;
      if (targetBall) {
        const desiredX = targetBall.x;
        let bestPoint: { x: number; y: number; nx: number; ny: number; tx: number; ty: number } | null = null;

        for (const rail of geom.rails) {
          if (rail.normal.y >= -0.2) continue; // Only consider rails with inward normal pointing downward (top cushion)
          const rx = rail.to.x - rail.from.x;
          const ry = rail.to.y - rail.from.y;
          const lenSq = rx * rx + ry * ry;
          if (lenSq < 1e-6) continue;
          const len = Math.sqrt(lenSq);
          let t = ((desiredX - rail.from.x) * rx + (targetBall.y - rail.from.y) * ry) / lenSq;
          t = Math.max(0, Math.min(1, t));
          const px = rail.from.x + rx * t;
          const py = rail.from.y + ry * t;
          if (!bestPoint || Math.abs(px - desiredX) < Math.abs(bestPoint.x - desiredX)) {
            bestPoint = { x: px, y: py, nx: rail.normal.x, ny: rail.normal.y, tx: rx / len, ty: ry / len };
          }
        }

        if (bestPoint) {
          const cushionInset =
            scenario.id === 'rail-ride-long'
              ? CONFIG.BALL_RADIUS + 0.18
              : CONFIG.BALL_RADIUS + 0.06;
          const cueInsetExtra = 0.18;
          targetBall.x = bestPoint.x + bestPoint.nx * cushionInset;
          targetBall.y = bestPoint.y + bestPoint.ny * cushionInset;
          const cueNormalInset = cushionInset + cueInsetExtra;
          let cueX = bestPoint.x + bestPoint.nx * cueNormalInset;
          let cueY = bestPoint.y + bestPoint.ny * cueNormalInset;
          const cueLeadMultiplier = scenario.id === 'rail-ride-long' ? 18.0 : 4.0;
          const cueLead = CONFIG.BALL_RADIUS * cueLeadMultiplier; // keep distance along tangent
          cueX -= bestPoint.tx * cueLead;
          cueY -= bestPoint.ty * cueLead;
          cueBall.x = cueX;
          cueBall.y = cueY;

          if (scenario.id === 'rail-ride-long') {
            const extremeAngleDrop = CONFIG.BALL_RADIUS * 5.0; // pull down for steep approach while keeping accurate prediction
            cueBall.y -= extremeAngleDrop;
          }
        }
      }
    }

    world.balls.forEach((ball) => {
      ball.vx = 0;
      ball.vy = 0;
      ball.sleeping = false;
      ball.pocketed = false;
      ball.saveState();
    });

    this.game.world = world;
    this.syncRenderer(world);
    this.game.canShoot = true;
    this.game.isAimMode = true;
    this.game.isSpacePowerMode = false;
    this.game.isDraggingPower = false;
    const targetBall = scenario.shot.targetBallId != null
      ? world.balls.find((ball) => ball.id === scenario.shot.targetBallId) || null
      : null;

    let effectiveAngleDeg = scenario.shot.angleDeg;
    if (scenario.shot.autoAimAtTarget && targetBall) {
      effectiveAngleDeg = this.radToDeg(Math.atan2(targetBall.y - cueBall.y, targetBall.x - cueBall.x));
    }

    this.game.currentPower = options.autoPower === false ? this.game.currentPower : scenario.shot.power;
    this.game.lockedAngle = this.degToRad(effectiveAngleDeg);
    this.game.cachedPrediction = null;
    this.game.cachedDirection = null;

    if (options.autoAim !== false) {
      this.applyAim(this.game, cueBall, this.degToRad(effectiveAngleDeg));
    }

    const liveBallStates = scenario.balls.map((ballDef) => {
      const live = world.balls.find((ball) => ball.id === ballDef.id);
      return live
        ? { ...ballDef, x: live.x, y: live.y }
        : ballDef;
    });

    this.activeScenario = {
      ...scenario,
      shot: {
        ...scenario.shot,
        angleDeg: effectiveAngleDeg,
      },
      balls: liveBallStates,
      cueBall: { ...scenario.cueBall, x: cueBall.x, y: cueBall.y },
    };

    if (options.startCapture) {
      shotCapture.startCapture();
    }

    if (options.log !== false) {
      this.printScenarioLog(this.activeScenario);
    }
  }

  shoot(options: ShootOptions = {}) {
    if (!this.game || !this.activeScenario) {
      console.warn('Load a scenario before shooting. Call shotScenarios.list() to inspect options.');
      return;
    }

    if (!this.game.cueBall || this.game.cueBall.pocketed) {
      console.warn('Cue ball unavailable; reload the scenario before shooting.');
      return;
    }

    if (!this.game.canShoot) {
      console.warn('Game state disallows shooting (balls likely moving). Wait or reload scenario.');
      return;
    }

    const shot = this.activeScenario.shot;

    if (options.startCapture) {
      shotCapture.startCapture();
    }

    this.game.shoot(this.degToRad(shot.angleDeg), shot.power);

    if (options.log !== false) {
      console.info(
        `🎬 Fired "${this.activeScenario.label}" | angle=${shot.angleDeg.toFixed(2)}°, power=${shot.power.toFixed(2)}`
      );
    }
  }

  describe(id?: ScenarioId) {
    if (id) {
      const scenario = this.scenarios[id];
      if (!scenario) {
        console.warn(`Unknown scenario "${id}".`);
        return;
      }
      this.printScenarioLog(scenario);
      return;
    }

    if (!this.activeScenario) {
      console.info('No active scenario. Call shotScenarios.load(id) first.');
      return;
    }

    this.printScenarioLog(this.activeScenario);
  }

  private createBall(id: number, x: number, y: number): Ball {
    const ball = new Ball(id, x, y, CONFIG.BALL_RADIUS, CONFIG.BALL_MASS);
    ball.angle = 0;
    ball.angularVelocity = 0;
    ball.angularAxisX = 0;
    ball.angularAxisY = 1;
    ball.angularAxisZ = 0;
    ball.rotX = 0;
    ball.rotY = 0;
    ball.rotZ = 0;
    ball.rotW = 1;
    return ball;
  }

  private applyAim(game: Game, cueBall: Ball, angleRad: number) {
    const aimDistance = 36;
    const aimTargetX = cueBall.x + Math.cos(angleRad) * aimDistance;
    const aimTargetY = cueBall.y + Math.sin(angleRad) * aimDistance;
    game.input.mouseX = aimTargetX;
    game.input.mouseY = aimTargetY;
    game.input.mouseTargetX = aimTargetX;
    game.input.mouseTargetY = aimTargetY;
  }

  private degToRad(angleDeg: number): number {
    return (angleDeg * Math.PI) / 180;
  }

  private radToDeg(angleRad: number): number {
    return (angleRad * 180) / Math.PI;
  }

  private printScenarioLog(scenario: ScenarioDefinition) {
    console.group(`🎱 Scenario: ${scenario.label}`);
    console.info(scenario.description);
    console.info(`Cue ball @ (${scenario.cueBall.x.toFixed(2)}, ${scenario.cueBall.y.toFixed(2)})`);
    if (scenario.balls.length) {
      scenario.balls.forEach((ball) => {
        console.info(
          `Ball ${ball.id}${ball.label ? ` (${ball.label})` : ''} @ (${ball.x.toFixed(2)}, ${ball.y.toFixed(2)})`
        );
      });
    } else {
      console.info('No object balls in play.');
    }
    console.info(
      `Shot: angle ${scenario.shot.angleDeg.toFixed(2)}° | power ${scenario.shot.power.toFixed(2)} | ${scenario.shot.tags.join(', ')}`
    );
    console.info(`Plan: ${scenario.shot.description}`);
    if (scenario.notes?.length) {
      scenario.notes.forEach((note) => console.info(`• ${note}`));
    }
    console.info('Commands: shotScenarios.shoot({ startCapture: true }) to auto-fire with capture.');
    console.groupEnd();
  }

  private syncRenderer(world: PhysicsWorld) {
    if (!this.game) return;
    const renderer = this.game.renderer as Renderer3D;
    if (!renderer || !renderer.ballMeshes) return;

    renderer.ballMeshes.forEach((mesh, id) => {
      const retain = world.balls.some((ball) => ball.id === id);
      if (!retain) {
        if (mesh.parent) {
          mesh.parent.remove(mesh);
        } else {
          renderer.scene.remove(mesh);
        }
        renderer.ballMeshes.delete(id);
      } else {
        mesh.visible = true;
      }
    });
  }
}

export const scenarioManager = new ScenarioManager();

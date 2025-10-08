import { Ball, Pocket, Rail } from './Shapes';
import { PredictionPath, Predictor } from './Prediction';
import { PhysicsWorld } from './Physics';

export interface TrajectorySample {
  t: number;
  position: { x: number; y: number };
  velocity: { x: number; y: number };
}

export interface TrajectoryRecord {
  ballId: number;
  samples: TrajectorySample[];
}

export interface CaptureReport {
  prediction: PredictionPath;
  actual: TrajectoryRecord[];
}

function cloneBall(source: Ball): Ball {
  const clone = new Ball(source.id, source.x, source.y, source.radius, source.mass);
  clone.vx = source.vx;
  clone.vy = source.vy;
  clone.prevX = source.prevX;
  clone.prevY = source.prevY;
  clone.pocketed = source.pocketed;
  clone.sleeping = source.sleeping;
  return clone;
}

function cloneRail(source: Rail): Rail {
  const clone = new Rail(source.x1, source.y1, source.x2, source.y2);
  if (clone.nx !== source.nx || clone.ny !== source.ny) {
    // Match original normal orientation
    clone.nx = source.nx;
    clone.ny = source.ny;
  }
  return clone;
}

function clonePocket(source: Pocket): Pocket {
  return new Pocket(source.x, source.y, source.radius);
}

export function cloneWorld(source: PhysicsWorld): PhysicsWorld {
  const clone = new PhysicsWorld();
  clone.balls = source.balls.map((ball) => cloneBall(ball));
  clone.rails = source.rails.map((rail) => cloneRail(rail));
  clone.pockets = source.pockets.map((pocket) => clonePocket(pocket));
  return clone;
}

export function capturePrediction(
  cueBall: Ball,
  angle: number,
  power: number,
  balls: Ball[],
  rails: Rail[]
): PredictionPath {
  return Predictor.predictFullPath(cueBall, angle, power, balls, rails);
}

export function captureActualTrajectories(
  world: PhysicsWorld,
  duration: number,
  step: number = 0.01,
  initializer?: (clone: PhysicsWorld) => void
): TrajectoryRecord[] {
  const simWorld = cloneWorld(world);
  initializer?.(simWorld);
  const records: TrajectoryRecord[] = simWorld.balls
    .map((ball) => ({
      ballId: ball.id,
      samples: [{
        t: 0,
        position: { x: Number(ball.x.toFixed(3)), y: Number(ball.y.toFixed(3)) },
        velocity: { x: Number(ball.vx.toFixed(3)), y: Number(ball.vy.toFixed(3)) },
      }],
    }));

  const maxSteps = Math.max(1, Math.floor(duration / step));
  let stepsTaken = 0;
  while (stepsTaken < maxSteps) {
    simWorld.step(step);
    stepsTaken++;

    records.forEach((record) => {
      const ball = simWorld.balls.find((b) => b.id === record.ballId);
      if (!ball) return;
      record.samples.push({
        t: Number((stepsTaken * step).toFixed(3)),
        position: { x: Number(ball.x.toFixed(3)), y: Number(ball.y.toFixed(3)) },
        velocity: { x: Number(ball.vx.toFixed(3)), y: Number(ball.vy.toFixed(3)) },
      });
    });

    if (simWorld.isAtRest()) {
      break;
    }
  }

  return records.filter((record) => {
    if (record.samples.length <= 1) return false;
    const first = record.samples[0];
    return record.samples.some((sample) => {
      const dx = sample.position.x - first.position.x;
      const dy = sample.position.y - first.position.y;
      const speed = Math.sqrt(sample.velocity.x * sample.velocity.x + sample.velocity.y * sample.velocity.y);
      return Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001 || speed > 0.005;
    });
  });
}

export function captureFullReport(
  world: PhysicsWorld,
  prediction: PredictionPath,
  duration: number,
  step: number = 0.01,
  initializer?: (clone: PhysicsWorld) => void
): CaptureReport {
  const actual = captureActualTrajectories(world, duration, step, initializer);
  return { prediction, actual };
}

export function formatCaptureReport(report: CaptureReport): Record<string, unknown> {
  return {
    prediction: {
      firstContact: report.prediction.firstContact,
      segments: report.prediction.segments,
    },
    actual: report.actual.map((record) => ({
      ballId: record.ballId,
      samples: record.samples,
    })),
  };
}

// Rule-based AI for pool gameplay
// Refactored to use data-driven Opponent Personas

import { Ball } from '../physics/Shapes';
import { PhysicsWorld } from '../physics/Physics';
import { Player, BallGroup } from '../game/Player';
import { getTableGeometry, PocketDef } from '../geometry/Geometry';
import { BALL_CUE, BALL_8, BALLS_SOLID, BALLS_STRIPE, CONFIG } from '../config';
import { OpponentDef } from '../data/models';
import { OPPONENTS } from './OpponentRegistry';

export interface ShotOption {
  targetBall: Ball;
  pocket: PocketDef;
  aimAngle: number;      // Angle to shoot the cue ball
  power: number;         // Shot power
  expectedSuccess: number; // 0-1 probability of making the shot
  isSafe: boolean;       // Is this a safety shot?
  positioningScore: number; // 0-100 for cue ball leave
  cutAngle: number;      // Cut angle in radians
  distance: number;      // Distance from cue ball to target ball
  spinSide?: number;     // -1..1 side english
  spinTop?: number;      // -1..1 top/back english
}

export class PoolAI {
  private opponent: OpponentDef;
  private thinkingTime: number;

  constructor(opponentId: string = 'rookie_rick') {
    // Default to first opponent if ID not found
    this.opponent = OPPONENTS.find(o => o.id === opponentId) || OPPONENTS[0];
    this.thinkingTime = this.calculateThinkingTime();
  }

  setOpponent(opponentId: string) {
    this.opponent = OPPONENTS.find(o => o.id === opponentId) || OPPONENTS[0];
    this.thinkingTime = this.calculateThinkingTime();
  }

  getOpponentDef(): OpponentDef {
    return this.opponent;
  }

  getThinkingTime(): number {
    return this.thinkingTime;
  }

  /**
   * Calculate thinking time based on AI speed stat
   * Higher speed = lower delay
   */
  private calculateThinkingTime(): number {
    const speed = this.opponent.stats.speed; // 0-1
    // Map 0 -> 3000ms, 1 -> 500ms
    const baseDelay = 3000 - (speed * 2500);
    // Add some randomness
    return baseDelay + Math.random() * 500;
  }




  /**
   * Main entry point: select the best shot for the current game state
   */
  selectShot(world: PhysicsWorld, player: Player): ShotOption | null {
    const cueBall = world.balls.find(b => b.id === BALL_CUE);
    if (!cueBall || cueBall.pocketed) {
      console.log('[AI] No cue ball found');
      return null;
    }

    // Get legal target balls
    const legalBalls = this.getLegalBalls(world.balls, player);
    if (legalBalls.length === 0) {
      console.log('[AI] No legal balls');
      return null;
    }

    // Evaluate all possible shots
    const shotOptions = this.evaluateShots(cueBall, legalBalls, world);

    // Check for random major error (blunder) based on errorRate
    if (Math.random() < this.opponent.stats.errorRate) {
      console.log('[AI] Making a blunder!');
      // Pick a random bad shot or just return null to simulate a miss/foul
      // For now, we'll just pick a random sub-optimal shot if available
      if (shotOptions.length > 0) {
        const randomShot = shotOptions[Math.floor(Math.random() * shotOptions.length)];
      return this.addSpinPreference(this.addHumanError(randomShot));
    }
    }

    if (shotOptions.length === 0) {
      console.log('[AI] No shot options generated');
      const fallback = this.createFallbackBreakShot(cueBall, world);
      if (fallback) {
        console.log('[AI] Using fallback power shot');
        return fallback;
      }
      return null;
    }

    // Decide whether to play safe
    if (this.shouldPlaySafe(shotOptions)) {
      const safety = this.chooseSafetyShot(world, player, cueBall);
      if (safety) return safety;
      // Fall back to weakest offensive option
      const worst = shotOptions.reduce((w, s) => (s.expectedSuccess < w.expectedSuccess ? s : w));
      return this.addSpinPreference(this.addHumanError(worst));
    }

    // Choose the best offensive shot based on stats
    const best = this.chooseBestShot(shotOptions);
    return this.addSpinPreference(this.addHumanError(best));
  }

  private createFallbackBreakShot(cueBall: Ball, world: PhysicsWorld): ShotOption | null {
    const availableBalls = world.balls.filter((ball) => !ball.pocketed && ball.id !== BALL_CUE);
    if (availableBalls.length === 0) return null;

    // Aim for the ball furthest down-table
    const targetBall = availableBalls.reduce((best, ball) => (ball.x > best.x ? ball : best), availableBalls[0]);
    const geom = getTableGeometry();
    const fallbackPocket = geom.pockets.find((p) => p.id === 'SE_corner') ?? geom.pockets[0];

    const dx = targetBall.x - cueBall.x;
    const dy = targetBall.y - cueBall.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance < 1e-3) return null;

    const aimAngle = Math.atan2(dy, dx);
    // Power based on aggression
    const power = 15 + (this.opponent.stats.aggression * 10);

      return {
        targetBall,
        pocket: fallbackPocket,
        aimAngle,
        power,
        expectedSuccess: 0.15,
        isSafe: false,
        positioningScore: 0,
        cutAngle: 0,
        distance,
        spinSide: 0,
        spinTop: 0,
      };
  }

  private getLegalBalls(balls: Ball[], player: Player): Ball[] {
    if (player.group === null) {
      return balls.filter(b => !b.pocketed && b.id !== BALL_CUE && b.id !== BALL_8);
    }
    const groupBalls = player.group === BallGroup.SOLIDS ? BALLS_SOLID : BALLS_STRIPE;
    const remainingGroupBalls = balls.filter(b => !b.pocketed && groupBalls.includes(b.id));

    if (remainingGroupBalls.length === 0) {
      const eightBall = balls.find(b => b.id === BALL_8 && !b.pocketed);
      return eightBall ? [eightBall] : [];
    }
    return remainingGroupBalls;
  }

  private evaluateShots(cueBall: Ball, targetBalls: Ball[], world: PhysicsWorld): ShotOption[] {
    const geometry = getTableGeometry();
    const shots: ShotOption[] = [];

    for (const targetBall of targetBalls) {
      for (const pocket of geometry.pockets) {
        const shot = this.calculateShot(cueBall, targetBall, pocket, world);
        if (shot) {
          shots.push(shot);
        }
      }
    }
    return shots;
  }

  private calculateShot(cueBall: Ball, targetBall: Ball, pocket: PocketDef, world: PhysicsWorld): ShotOption | null {
    const toPocketX = pocket.center.x - targetBall.x;
    const toPocketY = pocket.center.y - targetBall.y;
    const toPocketDist = Math.sqrt(toPocketX * toPocketX + toPocketY * toPocketY);

    if (toPocketDist < 0.1) return null;

    const contactX = targetBall.x - (toPocketX / toPocketDist) * targetBall.radius * 2;
    const contactY = targetBall.y - (toPocketY / toPocketDist) * targetBall.radius * 2;

    const toContactX = contactX - cueBall.x;
    const toContactY = contactY - cueBall.y;
    const toContactDist = Math.sqrt(toContactX * toContactX + toContactY * toContactY);

    if (toContactDist < cueBall.radius) return null;

    const aimAngle = Math.atan2(toContactY, toContactX);

    const cueToTargetX = targetBall.x - cueBall.x;
    const cueToTargetY = targetBall.y - cueBall.y;
    const cueToTargetAngle = Math.atan2(cueToTargetY, cueToTargetX);
    const targetToPocketAngle = Math.atan2(toPocketY, toPocketX);
    let cutAngle = Math.abs(targetToPocketAngle - cueToTargetAngle);
    if (cutAngle > Math.PI) cutAngle = 2 * Math.PI - cutAngle;

    if (this.checkObstruction(cueBall, targetBall, contactX, contactY, world)) return null;
    if (this.checkTargetToPocketObstruction(targetBall, pocket, world)) return null;
    if (!this.isPocketApproachViable(targetBall, pocket)) return null;

    const approachCos = this.computeApproachCos(targetBall, pocket);
    const expectedSuccess = this.estimateSuccess(toContactDist, cutAngle, toPocketDist, approachCos);

    let power = this.calculatePower(toContactDist, cutAngle);
    power = Math.max(power, this.minPowerForDistance(toContactDist));

    const positioningScore = Math.max(0, 100 - toContactDist);

    return {
      targetBall,
      pocket,
      aimAngle,
      power,
      expectedSuccess,
      isSafe: false,
      positioningScore,
      cutAngle,
      distance: toContactDist,
      spinSide: 0,
      spinTop: 0,
    };
  }

  private computeApproachCos(targetBall: Ball, pocket: PocketDef): number {
    const vX = pocket.center.x - targetBall.x;
    const vY = pocket.center.y - targetBall.y;
    const vLen = Math.sqrt(vX * vX + vY * vY) || 1;
    const ux = vX / vLen;
    const uy = vY / vLen;
    const nx = pocket.cutNormalHint.x;
    const ny = pocket.cutNormalHint.y;
    const nLen = Math.sqrt(nx * nx + ny * ny) || 1;
    const nux = nx / nLen;
    const nuy = ny / nLen;
    const cos = ux * nux + uy * nuy;
    return Math.max(-1, Math.min(1, cos));
  }

  private checkObstruction(cueBall: Ball, targetBall: Ball, contactX: number, contactY: number, world: PhysicsWorld): boolean {
    const dirX = contactX - cueBall.x;
    const dirY = contactY - cueBall.y;
    const dist = Math.sqrt(dirX * dirX + dirY * dirY);
    const normDirX = dirX / dist;
    const normDirY = dirY / dist;

    for (const ball of world.balls) {
      if (ball.id === BALL_CUE || ball.id === targetBall.id || ball.pocketed) continue;
      const toBallX = ball.x - cueBall.x;
      const toBallY = ball.y - cueBall.y;
      const projection = toBallX * normDirX + toBallY * normDirY;
      if (projection < 0 || projection > dist) continue;
      const perpX = toBallX - normDirX * projection;
      const perpY = toBallY - normDirY * projection;
      const perpDist = Math.sqrt(perpX * perpX + perpY * perpY);
      if (perpDist < cueBall.radius + ball.radius + 0.1) return true;
    }
    return false;
  }

  private checkTargetToPocketObstruction(targetBall: Ball, pocket: PocketDef, world: PhysicsWorld): boolean {
    const dirX = pocket.center.x - targetBall.x;
    const dirY = pocket.center.y - targetBall.y;
    const dist = Math.sqrt(dirX * dirX + dirY * dirY);
    if (dist < 1e-3) return false;
    const nx = dirX / dist;
    const ny = dirY / dist;
    const clearance = targetBall.radius * 2 - 0.05;

    for (const ball of world.balls) {
      if (ball.pocketed || ball.id === targetBall.id) continue;
      const toBallX = ball.x - targetBall.x;
      const toBallY = ball.y - targetBall.y;
      const proj = toBallX * nx + toBallY * ny;
      if (proj < 0 || proj > dist) continue;
      const perpX = toBallX - nx * proj;
      const perpY = toBallY - ny * proj;
      const d = Math.sqrt(perpX * perpX + perpY * perpY);
      if (d < clearance) return true;
    }
    return false;
  }

  private isPocketApproachViable(targetBall: Ball, pocket: PocketDef): boolean {
    const vX = pocket.center.x - targetBall.x;
    const vY = pocket.center.y - targetBall.y;
    const vLen = Math.sqrt(vX * vX + vY * vY) || 1;
    const ux = vX / vLen;
    const uy = vY / vLen;
    const nx = pocket.cutNormalHint.x;
    const ny = pocket.cutNormalHint.y;
    const nLen = Math.sqrt(nx * nx + ny * ny) || 1;
    const nux = nx / nLen;
    const nuy = ny / nLen;
    const cos = ux * nux + uy * nuy;
    const angle = Math.acos(Math.max(-1, Math.min(1, cos)));
    const isSide = Math.abs(pocket.center.x) < 1e-3;
    const maxDeg = isSide ? 55 : 70;
    return (angle * 180) / Math.PI <= maxDeg;
  }

  private estimateSuccess(distance: number, cutAngle: number, pocketDistance: number, approachCos: number = 0.0): number {
    const cutDeg = (cutAngle * 180) / Math.PI;
    const cutTerm = 1 / (1 + Math.exp((cutDeg - 18) / 5));
    const cueDistTerm = 1 / (1 + Math.exp((distance - 26) / 7));
    const objDistTerm = 1 / (1 + Math.exp((pocketDistance - 30) / 7));
    const approachTerm = (approachCos + 1) / 2;

    let success = 0.12 + 0.88 * (0.45 * cutTerm + 0.25 * cueDistTerm + 0.2 * objDistTerm + 0.10 * approachTerm);

    // Ceiling based on accuracy stat
    const ceiling = 0.5 + (this.opponent.stats.accuracy * 0.5); // 0.5 to 1.0
    success = Math.min(success, ceiling);

    return Math.max(0.05, Math.min(1.0, success));
  }

  private calculatePower(distance: number, cutAngle: number): number {
    let power = 8 + distance * 0.15;
    const cutAngleDeg = (cutAngle * 180) / Math.PI;
    if (cutAngleDeg > 30) {
      // Bonus power based on aggression
      const bonus = this.opponent.stats.aggression * 2.5;
      power += bonus;
    }
    return Math.max(CONFIG.CUE_POWER_MIN, Math.min(CONFIG.CUE_POWER_MAX, power));
  }

  private minPowerForDistance(distance: number): number {
    const base = 6 + distance * 0.22;
    // Aggressive players hit harder
    const bump = this.opponent.stats.aggression * 3.0;
    return Math.min(CONFIG.CUE_POWER_MAX, base + bump);
  }

  private shouldPlaySafe(shotOptions: ShotOption[]): boolean {
    // Aggression determines willingness to take risks
    // High aggression = low safety threshold (rarely plays safe)
    // Low aggression = high safety threshold (plays safe often)

    // Safety threshold: 0.0 (never safe) to 0.4 (often safe)
    const safetyThreshold = 0.4 - (this.opponent.stats.aggression * 0.4);

    const bestShot = shotOptions.reduce((best, shot) => shot.expectedSuccess > best.expectedSuccess ? shot : best);

    // If easy shot available, take it
    const easy = shotOptions.some(s => (s.cutAngle * 180 / Math.PI) <= 12 && s.expectedSuccess >= 0.4);
    if (easy) return false;

    return bestShot.expectedSuccess < safetyThreshold;
  }

  private chooseSafetyShot(world: PhysicsWorld, player: Player, cueBall: Ball): ShotOption | null {
    const legal = this.getLegalBalls(world.balls, player).filter(b => !b.pocketed);
    if (!legal.length) return null;
    const sorted = [...legal].sort((a, b) => {
      const da = Math.hypot(a.x - cueBall.x, a.y - cueBall.y);
      const db = Math.hypot(b.x - cueBall.x, b.y - cueBall.y);
      return da - db;
    });

    for (const targetBall of sorted) {
      const toTargetX = targetBall.x - cueBall.x;
      const toTargetY = targetBall.y - cueBall.y;
      const baseAngle = Math.atan2(toTargetY, toTargetX);
      const thinOffset = (Math.random() * 0.15 + 0.1) * (Math.random() < 0.5 ? 1 : -1);
      const aimAngle = baseAngle + thinOffset;
      const distance = Math.hypot(toTargetX, toTargetY);
      const power = Math.max(CONFIG.CUE_POWER_MIN, Math.min(5.0, this.minPowerForDistance(distance) * 0.6));

      return {
        targetBall,
        pocket: getTableGeometry().pockets[0],
        aimAngle,
        power,
        expectedSuccess: 0.0,
        isSafe: true,
        positioningScore: 0,
        cutAngle: 0,
        distance,
        spinSide: 0,
        spinTop: 0,
      };
    }
    return null;
  }

  private addHumanError(shot: ShotOption): ShotOption {
    // Stats:
    // Accuracy (0-1): Determines angle noise. 1 = low noise.
    // Consistency (0-1): Determines power noise. 1 = low noise.

    const angleNoiseDeg = 5.0 - (this.opponent.stats.accuracy * 4.9); // 5.0 deg to 0.1 deg
    const powerNoise = 2.0 - (this.opponent.stats.consistency * 1.9); // 2.0 to 0.1

    const angleJitter = ((Math.random() * 2 - 1) * angleNoiseDeg * Math.PI) / 180;
    const powerJitter = (Math.random() * 2 - 1) * powerNoise;

    return {
      ...shot,
      aimAngle: shot.aimAngle + angleJitter,
      power: Math.max(CONFIG.CUE_POWER_MIN, Math.min(CONFIG.CUE_POWER_MAX, shot.power + powerJitter)),
    };
  }

  private addSpinPreference(shot: ShotOption): ShotOption {
    const spinPreference = this.opponent.stats.spinPreference ?? 0;
    if (spinPreference <= 0 || shot.isSafe) {
      return { ...shot, spinSide: 0, spinTop: 0 };
    }

    const useSpin = Math.random() < spinPreference;
    if (!useSpin || shot.expectedSuccess < 0.35) {
      return { ...shot, spinSide: 0, spinTop: 0 };
    }

    const cutDeg = (shot.cutAngle * 180) / Math.PI;
    const longShot = shot.distance > 24;

    let spinTop = longShot ? 0.3 : 0.18;
    if (cutDeg < 6 && longShot) {
      spinTop = 0.4;
    } else if (cutDeg > 35) {
      spinTop = 0.1;
    }

    let spinSide = 0;
    if (cutDeg > 18) {
      const sign = Math.random() < 0.5 ? -1 : 1;
      spinSide = sign * 0.25;
    }

    return {
      ...shot,
      spinSide: spinSide * spinPreference,
      spinTop: spinTop * spinPreference,
    };
  }

  private chooseBestShot(shotOptions: ShotOption[]): ShotOption {
    // Aggression affects preference for difficult shots vs positioning
    // High aggression: favors success/potting over positioning
    // Low aggression: favors positioning (if skilled)

    const aggression = this.opponent.stats.aggression;

    const scoredShots = shotOptions.map(shot => ({
      shot,
      // Score = Success * (0.5 + Aggression*0.5) + Positioning * (0.5 - Aggression*0.5)
      score: shot.expectedSuccess * (0.5 + aggression * 0.4) + (shot.positioningScore / 100) * (0.5 - aggression * 0.4),
    }));

    scoredShots.sort((a, b) => b.score - a.score);
    return scoredShots[0].shot;
  }
}

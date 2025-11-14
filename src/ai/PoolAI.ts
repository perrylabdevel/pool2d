// Rule-based AI for pool gameplay

import { Ball } from '../physics/Shapes';
import { PhysicsWorld } from '../physics/Physics';
import { Player, BallGroup } from '../game/Player';
import { getTableGeometry, PocketDef, Vec2 } from '../geometry/Geometry';
import { BALL_CUE, BALL_8, BALLS_SOLID, BALLS_STRIPE, CONFIG } from '../config';

export enum AIDifficulty {
  EASY,     // 40% success, poor positioning
  MEDIUM,   // 65% success, decent positioning
  HARD,     // 85% success, good positioning
  EXPERT,   // 95% success, excellent positioning
}

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
}

export class PoolAI {
  difficulty: AIDifficulty;
  thinkingTime: number; // Simulated delay in milliseconds

  constructor(difficulty: AIDifficulty = AIDifficulty.MEDIUM) {
    this.difficulty = difficulty;
    this.thinkingTime = this.getThinkingTime(difficulty);
  }

  /**
   * Get thinking time based on difficulty (harder AI thinks faster)
   */
  private getThinkingTime(difficulty: AIDifficulty): number {
    switch (difficulty) {
      case AIDifficulty.EASY: return 1500 + Math.random() * 1500; // 1.5-3s
      case AIDifficulty.MEDIUM: return 1000 + Math.random() * 1000; // 1-2s
      case AIDifficulty.HARD: return 500 + Math.random() * 500; // 0.5-1s
      case AIDifficulty.EXPERT: return 300 + Math.random() * 400; // 0.3-0.7s
    }
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
    console.log('[AI] Legal balls:', legalBalls.map(b => b.id));
    if (legalBalls.length === 0) {
      console.log('[AI] No legal balls');
      return null;
    }

    // Evaluate all possible shots
    const shotOptions = this.evaluateShots(cueBall, legalBalls, world);
    console.log('[AI] Shot options found:', shotOptions.length);
    if (shotOptions.length === 0) {
      console.log('[AI] No shot options generated');
      const fallback = this.createFallbackBreakShot(cueBall, world);
      if (fallback) {
        console.log('[AI] Using fallback power shot');
        return fallback;
      }
      return null;
    }

    // Decide whether to play safe or go for a shot
    if (this.shouldPlaySafe(shotOptions, player)) {
      const safety = this.chooseSafetyShot(world, player, cueBall);
      if (safety) return safety;
      // Fall back to weakest offensive option if we couldn't craft a safety
      const worst = shotOptions.reduce((w, s) => (s.expectedSuccess < w.expectedSuccess ? s : w));
      return this.addHumanError(worst);
    }

    // Choose the best offensive shot and add difficulty-based human error
    const best = this.chooseBestShot(shotOptions);
    return this.addHumanError(best);
  }

  private createFallbackBreakShot(cueBall: Ball, world: PhysicsWorld): ShotOption | null {
    const availableBalls = world.balls.filter((ball) => !ball.pocketed && ball.id !== BALL_CUE);
    if (availableBalls.length === 0) {
      return null;
    }

    // Aim for the ball furthest down-table (most positive X) so we mimic a break-style blast
    const targetBall = availableBalls.reduce((best, ball) => (ball.x > best.x ? ball : best), availableBalls[0]);
    const geom = getTableGeometry();
    const fallbackPocket = geom.pockets.find((p) => p.id === 'SE_corner') ?? geom.pockets[0];

    const dx = targetBall.x - cueBall.x;
    const dy = targetBall.y - cueBall.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance < 1e-3) {
      return null;
    }

    const aimAngle = Math.atan2(dy, dx);
    const power = Math.max(12, Math.min(20, distance * 0.5));

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
    };
  }

  /**
   * Get legal balls the AI can shoot at based on player's group
   */
  private getLegalBalls(balls: Ball[], player: Player): Ball[] {
    // If no group assigned yet, any ball except 8-ball is legal
    if (player.group === null) {
      return balls.filter(b =>
        !b.pocketed &&
        b.id !== BALL_CUE &&
        b.id !== BALL_8
      );
    }

    // Get balls from player's group
    const groupBalls = player.group === BallGroup.SOLIDS ? BALLS_SOLID : BALLS_STRIPE;
    const remainingGroupBalls = balls.filter(b =>
      !b.pocketed &&
      groupBalls.includes(b.id)
    );

    // If all group balls are pocketed, can shoot 8-ball
    if (remainingGroupBalls.length === 0) {
      const eightBall = balls.find(b => b.id === BALL_8 && !b.pocketed);
      return eightBall ? [eightBall] : [];
    }

    return remainingGroupBalls;
  }

  /**
   * Evaluate all possible shots for the given target balls
   */
  private evaluateShots(cueBall: Ball, targetBalls: Ball[], world: PhysicsWorld): ShotOption[] {
    const geometry = getTableGeometry();
    const shots: ShotOption[] = [];

    for (const targetBall of targetBalls) {
      // Try each pocket
      for (const pocket of geometry.pockets) {
        const shot = this.calculateShot(cueBall, targetBall, pocket, world);
        if (shot) {
          shots.push(shot);
        }
      }
    }

    return shots;
  }

  /**
   * Calculate a specific shot: cue ball → target ball → pocket
   */
  private calculateShot(
    cueBall: Ball,
    targetBall: Ball,
    pocket: PocketDef,
    world: PhysicsWorld
  ): ShotOption | null {
    // Vector from target ball to pocket
    const toPocketX = pocket.center.x - targetBall.x;
    const toPocketY = pocket.center.y - targetBall.y;
    const toPocketDist = Math.sqrt(toPocketX * toPocketX + toPocketY * toPocketY);

    if (toPocketDist < 0.1) return null; // Ball is already at pocket

    // Contact point on target ball (opposite side from pocket)
    const contactX = targetBall.x - (toPocketX / toPocketDist) * targetBall.radius * 2;
    const contactY = targetBall.y - (toPocketY / toPocketDist) * targetBall.radius * 2;

    // Vector from cue ball to contact point
    const toContactX = contactX - cueBall.x;
    const toContactY = contactY - cueBall.y;
    const toContactDist = Math.sqrt(toContactX * toContactX + toContactY * toContactY);

    if (toContactDist < cueBall.radius) return null; // Too close

    // Aim angle
    const aimAngle = Math.atan2(toContactY, toContactX);

    // Calculate cut angle (angle between cue ball path and target ball path)
    const cueToTargetX = targetBall.x - cueBall.x;
    const cueToTargetY = targetBall.y - cueBall.y;
    const cueToTargetAngle = Math.atan2(cueToTargetY, cueToTargetX);
    const targetToPocketAngle = Math.atan2(toPocketY, toPocketX);
    let cutAngle = Math.abs(targetToPocketAngle - cueToTargetAngle);
    if (cutAngle > Math.PI) cutAngle = 2 * Math.PI - cutAngle;

    // Check for obstructions on cue->contact path
    const hasObstruction = this.checkObstruction(cueBall, targetBall, contactX, contactY, world);
    if (hasObstruction) return null;

    // Check that target->pocket path is viable (no immediate blocks and reasonable pocket approach)
    if (this.checkTargetToPocketObstruction(targetBall, pocket, world)) return null;
    if (!this.isPocketApproachViable(targetBall, pocket)) return null;

    // Estimate success probability (include approach alignment)
    const approachCos = this.computeApproachCos(targetBall, pocket);
    const expectedSuccess = this.estimateSuccess(toContactDist, cutAngle, toPocketDist, approachCos);

    // Determine power based on distance, clamp to avoid under-hits
    let power = this.calculatePower(toContactDist, cutAngle);
    power = Math.max(power, this.minPowerForDistance(toContactDist));

    // Score positioning (simple for now: prefer shorter cue distances)
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

  /**
   * Check if there are any balls blocking the shot path
   */
  private checkObstruction(
    cueBall: Ball,
    targetBall: Ball,
    contactX: number,
    contactY: number,
    world: PhysicsWorld
  ): boolean {
    const dirX = contactX - cueBall.x;
    const dirY = contactY - cueBall.y;
    const dist = Math.sqrt(dirX * dirX + dirY * dirY);
    const normDirX = dirX / dist;
    const normDirY = dirY / dist;

    // Check each ball for intersection with shot path
    for (const ball of world.balls) {
      if (ball.id === BALL_CUE || ball.id === targetBall.id || ball.pocketed) continue;

      // Vector from cue ball to obstacle ball
      const toBallX = ball.x - cueBall.x;
      const toBallY = ball.y - cueBall.y;

      // Project onto shot direction
      const projection = toBallX * normDirX + toBallY * normDirY;

      // Skip if ball is behind cue ball or past target
      if (projection < 0 || projection > dist) continue;

      // Calculate perpendicular distance to shot line
      const perpX = toBallX - normDirX * projection;
      const perpY = toBallY - normDirY * projection;
      const perpDist = Math.sqrt(perpX * perpX + perpY * perpY);

      // Obstruction if ball is within combined radii
      if (perpDist < cueBall.radius + ball.radius + 0.1) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check for obstructions between the target ball and the pocket center.
   * A simple linear clearance test with tolerance of ball radius.
   */
  private checkTargetToPocketObstruction(targetBall: Ball, pocket: PocketDef, world: PhysicsWorld): boolean {
    const dirX = pocket.center.x - targetBall.x;
    const dirY = pocket.center.y - targetBall.y;
    const dist = Math.sqrt(dirX * dirX + dirY * dirY);
    if (dist < 1e-3) return false;
    const nx = dirX / dist;
    const ny = dirY / dist;

    const clearance = targetBall.radius * 2 - 0.05; // allow slight tolerance

    for (const ball of world.balls) {
      if (ball.pocketed || ball.id === targetBall.id) continue;

      const toBallX = ball.x - targetBall.x;
      const toBallY = ball.y - targetBall.y;
      const proj = toBallX * nx + toBallY * ny;
      if (proj < 0 || proj > dist) continue;
      const perpX = toBallX - nx * proj;
      const perpY = toBallY - ny * proj;
      const d = Math.sqrt(perpX * perpX + perpY * perpY);
      if (d < clearance) {
        return true; // obstructed
      }
    }
    return false;
  }

  /**
   * Pocket approach sanity: prefer shots entering close to pocket's cut normal.
   * Side pockets are stricter; corners are more forgiving.
   */
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

    // cos(theta) between approach and cut normal
    const cos = ux * nux + uy * nuy;
    const angle = Math.acos(Math.max(-1, Math.min(1, cos))); // radians

    // Lenient viability: only reject extreme glancing entries
    const isSide = Math.abs(pocket.center.x) < 1e-3; // side pocket near x≈0
    const maxDeg = isSide ? 55 : 70;
    return (angle * 180) / Math.PI <= maxDeg;
  }

  /**
   * Estimate success probability based on shot difficulty factors
   */
  private estimateSuccess(distance: number, cutAngle: number, pocketDistance: number, approachCos: number = 0.0): number {
    // Factors that affect difficulty:
    // 1. Distance to target (longer = harder)
    // 2. Cut angle (steeper = harder)
    // 3. Distance from target to pocket (longer = harder)

    // Base success as product of three logistic terms for stability
    const cutDeg = (cutAngle * 180) / Math.PI;

    const cutTerm = 1 / (1 + Math.exp((cutDeg - 18) / 5)); // favor near-straight more strongly
    const cueDistTerm = 1 / (1 + Math.exp((distance - 26) / 7));
    const objDistTerm = 1 / (1 + Math.exp((pocketDistance - 30) / 7));
    const approachTerm = (approachCos + 1) / 2; // [-1,1] -> [0,1]

    let success = 0.12 + 0.88 * (0.45 * cutTerm + 0.25 * cueDistTerm + 0.2 * objDistTerm + 0.10 * approachTerm);

    // Difficulty scaling: cap achievable ceiling per level
    const ceiling = {
      [AIDifficulty.EASY]: 0.65,
      [AIDifficulty.MEDIUM]: 0.78,
      [AIDifficulty.HARD]: 0.9,
      [AIDifficulty.EXPERT]: 0.97,
    }[this.difficulty];
    success = Math.min(success, ceiling);

    return Math.max(0.05, Math.min(1.0, success));
  }

  /**
   * Calculate appropriate power for the shot
   */
  private calculatePower(distance: number, cutAngle: number): number {
    // Base power on distance
    let power = 8 + distance * 0.15;

    // Add power for big cuts (positioning/stun), scale by difficulty
    const cutAngleDeg = (cutAngle * 180) / Math.PI;
    if (cutAngleDeg > 30) {
      const bonus = {
        [AIDifficulty.EASY]: 2.0,
        [AIDifficulty.MEDIUM]: 1.4,
        [AIDifficulty.HARD]: 0.8,
        [AIDifficulty.EXPERT]: 0.4,
      }[this.difficulty];
      power += bonus;
    }

    return Math.max(CONFIG.CUE_POWER_MIN, Math.min(CONFIG.CUE_POWER_MAX, power));
  }

  private minPowerForDistance(distance: number): number {
    // Ensure cue reaches contact reliably; scale by difficulty
    const base = 6 + distance * 0.22;
    const bump = {
      [AIDifficulty.EASY]: 0,
      [AIDifficulty.MEDIUM]: 1.0,
      [AIDifficulty.HARD]: 2.0,
      [AIDifficulty.EXPERT]: 2.6,
    }[this.difficulty];
    return Math.min(CONFIG.CUE_POWER_MAX, base + bump);
  }

  /**
   * Decide whether to play safe based on available shot quality
   */
  private shouldPlaySafe(shotOptions: ShotOption[], player: Player): boolean {
    // Never play safe on easy difficulty
    if (this.difficulty === AIDifficulty.EASY) return false;

    // Find best shot
    const bestShot = shotOptions.reduce((best, shot) =>
      shot.expectedSuccess > best.expectedSuccess ? shot : best
    );

    // Thresholds based on difficulty
    const safetyThreshold = {
      [AIDifficulty.EASY]: 0,
      [AIDifficulty.MEDIUM]: 0.22,
      [AIDifficulty.HARD]: 0.22,
      [AIDifficulty.EXPERT]: 0.28,
    }[this.difficulty];

    // If there's an easy, unobstructed shot, never play safe
    const easy = shotOptions.some(s => (s.cutAngle * 180 / Math.PI) <= 12 && s.expectedSuccess >= 0.35);
    if (easy) return false;

    // Play safe if best shot is below threshold
    return bestShot.expectedSuccess < safetyThreshold;
  }

  /**
   * Choose a safety shot: thin tap on nearest legal ball with low power.
   */
  private chooseSafetyShot(world: PhysicsWorld, player: Player, cueBall: Ball): ShotOption | null {
    // Nearest legal ball
    const legal = this.getLegalBalls(world.balls, player).filter(b => !b.pocketed);
    if (!legal.length) return null;
    const sorted = [...legal].sort((a, b) => {
      const da = Math.hypot(a.x - cueBall.x, a.y - cueBall.y);
      const db = Math.hypot(b.x - cueBall.x, b.y - cueBall.y);
      return da - db;
    });

    for (const targetBall of sorted) {
      // Aim at a slight offset to create a thin hit
      const toTargetX = targetBall.x - cueBall.x;
      const toTargetY = targetBall.y - cueBall.y;
      const baseAngle = Math.atan2(toTargetY, toTargetX);
      const thinOffset = (Math.random() * 0.15 + 0.1) * (Math.random() < 0.5 ? 1 : -1); // ~6-14 degrees
      const aimAngle = baseAngle + thinOffset;

      // Minimal power to ensure contact; still relatively soft
      const distance = Math.hypot(toTargetX, toTargetY);
      const power = Math.max(CONFIG.CUE_POWER_MIN, Math.min(5.0, this.minPowerForDistance(distance) * 0.6));

      return {
        targetBall,
        pocket: getTableGeometry().pockets[0], // placeholder; not used by shoot()
        aimAngle,
        power,
        expectedSuccess: 0.0,
        isSafe: true,
        positioningScore: 0,
        cutAngle: 0,
        distance,
      };
    }

    return null;
  }

  /**
   * Add difficulty-based imperfection to aim and power so AI feels human.
   */
  private addHumanError(shot: ShotOption): ShotOption {
    const angleNoiseDeg = {
      [AIDifficulty.EASY]: 4.0,
      [AIDifficulty.MEDIUM]: 1.8,
      [AIDifficulty.HARD]: 0.35,
      [AIDifficulty.EXPERT]: 0.12,
    }[this.difficulty];
    const powerNoise = {
      [AIDifficulty.EASY]: 1.6,
      [AIDifficulty.MEDIUM]: 0.8,
      [AIDifficulty.HARD]: 0.35,
      [AIDifficulty.EXPERT]: 0.15,
    }[this.difficulty];

    const angleJitter = ((Math.random() * 2 - 1) * angleNoiseDeg * Math.PI) / 180;
    const powerJitter = (Math.random() * 2 - 1) * powerNoise;

    return {
      ...shot,
      aimAngle: shot.aimAngle + angleJitter,
      power: Math.max(CONFIG.CUE_POWER_MIN, Math.min(CONFIG.CUE_POWER_MAX, shot.power + powerJitter)),
    };
  }

  /**
   * Choose the best offensive shot
   */
  private chooseBestShot(shotOptions: ShotOption[]): ShotOption {
    // Score each shot based on success probability and positioning
    const scoredShots = shotOptions.map(shot => ({
      shot,
      score: shot.expectedSuccess * 0.7 + (shot.positioningScore / 100) * 0.3,
    }));

    // Sort by score (highest first)
    scoredShots.sort((a, b) => b.score - a.score);

    // Return best shot (noise added by caller)
    return scoredShots[0].shot;
  }

  /**
   * Add aim and power error based on difficulty level
   */
  private addHumanErrorLegacy(shot: ShotOption): ShotOption {
    const errorRange = {
      [AIDifficulty.EASY]: 15,    // ±15° aim error
      [AIDifficulty.MEDIUM]: 8,   // ±8° aim error
      [AIDifficulty.HARD]: 3,     // ±3° aim error
      [AIDifficulty.EXPERT]: 1,   // ±1° aim error
    }[this.difficulty];

    const angleError = (Math.random() - 0.5) * 2 * errorRange * (Math.PI / 180);
    const powerError = (Math.random() - 0.5) * 0.2; // ±10% power

    return {
      ...shot,
      aimAngle: shot.aimAngle + angleError,
      power: shot.power * (1 + powerError),
    };
  }

  /**
   * Set difficulty level
   */
  setDifficulty(difficulty: AIDifficulty): void {
    this.difficulty = difficulty;
    this.thinkingTime = this.getThinkingTime(difficulty);
  }
}

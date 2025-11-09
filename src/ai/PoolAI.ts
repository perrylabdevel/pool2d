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
      return null;
    }

    // Decide whether to play safe or go for a shot
    if (this.shouldPlaySafe(shotOptions, player)) {
      return this.chooseSafetyShot(shotOptions);
    }

    // Choose the best offensive shot
    return this.chooseBestShot(shotOptions);
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

    // Check for obstructions
    const hasObstruction = this.checkObstruction(cueBall, targetBall, contactX, contactY, world);
    if (hasObstruction) return null;

    // Estimate success probability
    const expectedSuccess = this.estimateSuccess(toContactDist, cutAngle, toPocketDist);

    // Determine power based on distance
    const power = this.calculatePower(toContactDist, cutAngle);

    // Score positioning (simple for now: prefer shorter shots)
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
   * Estimate success probability based on shot difficulty factors
   */
  private estimateSuccess(distance: number, cutAngle: number, pocketDistance: number): number {
    // Factors that affect difficulty:
    // 1. Distance to target (longer = harder)
    // 2. Cut angle (steeper = harder)
    // 3. Distance from target to pocket (longer = harder)

    let success = 1.0;

    // Distance penalty (shots over 40 inches get harder)
    if (distance > 40) {
      success *= 0.9 - ((distance - 40) / 100) * 0.3;
    }

    // Cut angle penalty (straight shots are easier)
    const cutAngleDeg = (cutAngle * 180) / Math.PI;
    if (cutAngleDeg > 15) {
      success *= 0.95 - ((cutAngleDeg - 15) / 75) * 0.4;
    }

    // Pocket distance penalty
    if (pocketDistance > 30) {
      success *= 0.95 - ((pocketDistance - 30) / 70) * 0.2;
    }

    return Math.max(0.1, Math.min(1.0, success));
  }

  /**
   * Calculate appropriate power for the shot
   */
  private calculatePower(distance: number, cutAngle: number): number {
    // Base power on distance
    let power = 8 + distance * 0.15;

    // Add power for cut shots (need more speed for position)
    const cutAngleDeg = (cutAngle * 180) / Math.PI;
    if (cutAngleDeg > 30) {
      power += 2;
    }

    return Math.max(CONFIG.CUE_POWER_MIN, Math.min(CONFIG.CUE_POWER_MAX, power));
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
      [AIDifficulty.MEDIUM]: 0.3,
      [AIDifficulty.HARD]: 0.4,
      [AIDifficulty.EXPERT]: 0.5,
    }[this.difficulty];

    // Play safe if best shot is below threshold
    return bestShot.expectedSuccess < safetyThreshold;
  }

  /**
   * Choose a safety shot (not implemented yet - just return weakest shot)
   */
  private chooseSafetyShot(shotOptions: ShotOption[]): ShotOption {
    // For now, just return the shot with lowest success
    // In future, implement actual safety logic
    return shotOptions.reduce((worst, shot) =>
      shot.expectedSuccess < worst.expectedSuccess ? shot : worst
    );
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

    // Return best shot with human error applied
    return this.addHumanError(scoredShots[0].shot);
  }

  /**
   * Add aim and power error based on difficulty level
   */
  private addHumanError(shot: ShotOption): ShotOption {
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

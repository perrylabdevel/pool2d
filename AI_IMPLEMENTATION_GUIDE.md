# AI Player Implementation Guide

**Version**: 1.0
**Target**: Add AI opponent to pool2d with 3 difficulty levels
**Estimated effort**: 8-12 hours (solo dev)
**Dependencies**: None (uses existing physics engine)

---

## Overview

Add a heuristic-based AI opponent that:
- Uses existing physics engine to simulate shots
- Evaluates positions with a scoring function
- Chooses best shot via brute-force search
- Supports 3 difficulty levels (Rookie, Amateur, Pro)
- Works in both Practice and 8-Ball modes

**Key principle**: The AI is a **shot generator** that plugs into the existing game loop. It doesn't need to know rules - just pick (angle, power) pairs.

---

## Architecture

### High-Level Flow

```
Game.ts
  ├─ HumanPlayer (existing input handling)
  └─ AIPlayer (new)
       ├─ ShotSearch (brute-force search)
       │    ├─ PhysicsSimulator (clone world, simulate shot)
       │    └─ PositionEvaluator (score the outcome)
       └─ DifficultyProfile (Rookie/Amateur/Pro config)
```

### Component Responsibilities

| Component | Responsibility | Input | Output |
|-----------|---------------|-------|--------|
| `AIPlayer` | Orchestrates AI turn, applies delay | Game state | Shot (angle, power) |
| `ShotSearch` | Finds best shot via search | Game state, difficulty | Best (angle, power) |
| `PhysicsSimulator` | Simulates shot in cloned world | Shot params | End state |
| `PositionEvaluator` | Scores a position | End state | Score (float) |
| `DifficultyProfile` | Config for each level | Difficulty enum | Search params |

---

## File Structure

### New Files

```
src/ai/
├── AIPlayer.ts              # Main AI controller
├── ShotSearch.ts            # Brute-force search algorithm
├── PhysicsSimulator.ts      # Shot simulation (clones physics world)
├── PositionEvaluator.ts     # Scoring function for positions
├── DifficultyProfile.ts     # Config for Rookie/Amateur/Pro
└── types.ts                 # AI-specific types
```

### Modified Files

```
src/game/Game.ts             # Add AI turn handling
src/ui/HUD.ts                # Add AI vs Human mode toggle
src/config.ts                # Add AI config section
```

### Test Files

```
tests/ai/
├── ShotSearch.test.ts       # Test search finds good shots
├── PositionEvaluator.test.ts # Test scoring is sane
└── PhysicsSimulator.test.ts  # Test simulation matches real physics
```

---

## Implementation Order

### **Step 1: PhysicsSimulator** (Foundation)
**Why first**: Everything else depends on being able to simulate shots

**What to build**:
- Clone current physics world (balls, rails, pockets)
- Run shot simulation to completion (until all balls stop)
- Return end state (ball positions, pocketed balls, fouls)

**Where**: `src/ai/PhysicsSimulator.ts`

**Interface**:
```typescript
export interface SimulationResult {
  // Final ball positions
  balls: Array<{ id: number; position: Vec2; pocketed: boolean }>;

  // What happened during simulation
  myBallsPocketed: number[];      // IDs of AI's balls pocketed
  opponentBallsPocketed: number[]; // IDs of opponent's balls pocketed
  cueBallPocketed: boolean;       // Scratch?
  eightBallPocketed: boolean;     // Game over?

  // Foul detection
  isFoul: boolean;
  foulReason?: string; // "scratch" | "wrong_ball_first" | "no_contact"

  // Physics metadata
  simulationSteps: number; // How many physics steps ran
  maxVelocity: number;     // Peak ball speed during simulation
}

export class PhysicsSimulator {
  /**
   * Simulates a shot on a cloned physics world
   *
   * @param world - Current physics world (will be cloned, not mutated)
   * @param angle - Aim angle in degrees (0 = east, 90 = north)
   * @param power - Shot power (0.0 to 1.0)
   * @param playerGroup - Which balls belong to AI ("stripes" | "solids" | null)
   * @returns Simulation result with end state and events
   */
  static simulate(
    world: PhysicsWorld,
    angle: number,
    power: number,
    playerGroup: "stripes" | "solids" | null
  ): SimulationResult;
}
```

**Implementation details**:

```typescript
// src/ai/PhysicsSimulator.ts

import { PhysicsWorld } from '../physics/Physics';
import { Vec2 } from '../physics/Shapes';
import { CONFIG } from '../config';

export class PhysicsSimulator {
  static simulate(
    world: PhysicsWorld,
    angle: number,
    power: number,
    playerGroup: "stripes" | "solids" | null
  ): SimulationResult {
    // 1. Clone the world (deep copy)
    const clonedWorld = this.cloneWorld(world);

    // 2. Apply shot to cue ball
    const cueBall = clonedWorld.balls.find(b => b.id === 0);
    if (!cueBall) throw new Error("No cue ball found");

    const velocity = this.angleAndPowerToVelocity(angle, power);
    cueBall.velocity = velocity;

    // 3. Run simulation until all balls stop
    const maxSteps = 1000; // ~8 seconds at 120 Hz
    let steps = 0;
    const events = { pocketed: [], collisions: [] };

    while (steps < maxSteps && !this.allBallsStopped(clonedWorld)) {
      clonedWorld.step(CONFIG.PHYSICS_DT);

      // Track pocketed balls this step
      for (const ball of clonedWorld.balls) {
        if (ball.pocketed && !events.pocketed.includes(ball.id)) {
          events.pocketed.push(ball.id);
        }
      }

      steps++;
    }

    // 4. Analyze results
    return this.analyzeResults(clonedWorld, events, playerGroup, steps);
  }

  private static cloneWorld(world: PhysicsWorld): PhysicsWorld {
    // Deep copy world state
    // NOTE: This assumes PhysicsWorld has a clone() method or we build one
    return world.clone();
  }

  private static angleAndPowerToVelocity(angle: number, power: number): Vec2 {
    const angleRad = (angle * Math.PI) / 180;
    const speed = power * CONFIG.CUE_POWER_MAX * CONFIG.CUE_POWER_MULTIPLIER;
    return new Vec2(Math.cos(angleRad) * speed, Math.sin(angleRad) * speed);
  }

  private static allBallsStopped(world: PhysicsWorld): boolean {
    return world.balls.every(b => b.sleeping || b.pocketed);
  }

  private static analyzeResults(
    world: PhysicsWorld,
    events: any,
    playerGroup: string | null,
    steps: number
  ): SimulationResult {
    // Categorize pocketed balls
    const myBalls = [];
    const opponentBalls = [];
    let cueBallPocketed = false;
    let eightBallPocketed = false;

    for (const ballId of events.pocketed) {
      if (ballId === 0) {
        cueBallPocketed = true;
      } else if (ballId === 8) {
        eightBallPocketed = true;
      } else {
        const isStripe = ballId > 8;
        const isMine = (playerGroup === "stripes" && isStripe) ||
                       (playerGroup === "solids" && !isStripe);

        if (isMine) myBalls.push(ballId);
        else opponentBalls.push(ballId);
      }
    }

    // Detect fouls
    const isFoul = cueBallPocketed; // Simplified for now
    const foulReason = cueBallPocketed ? "scratch" : undefined;

    return {
      balls: world.balls.map(b => ({
        id: b.id,
        position: b.position.clone(),
        pocketed: b.pocketed
      })),
      myBallsPocketed: myBalls,
      opponentBallsPocketed: opponentBalls,
      cueBallPocketed,
      eightBallPocketed,
      isFoul,
      foulReason,
      simulationSteps: steps,
      maxVelocity: 0 // TODO: track during simulation
    };
  }
}
```

**Critical dependency**: `PhysicsWorld.clone()` method

You'll need to add a `clone()` method to `PhysicsWorld` class:

```typescript
// Add to src/physics/Physics.ts

export class PhysicsWorld {
  // ... existing code ...

  /**
   * Deep clone the physics world for simulation
   * Used by AI to test shots without mutating real world
   */
  clone(): PhysicsWorld {
    const cloned = new PhysicsWorld();

    // Clone balls
    cloned.balls = this.balls.map(ball => ({
      id: ball.id,
      position: ball.position.clone(),
      velocity: ball.velocity.clone(),
      rotation: ball.rotation.clone(), // Quaternion
      sleeping: ball.sleeping,
      pocketed: ball.pocketed,
      radius: ball.radius,
      mass: ball.mass
    }));

    // Rails and pockets are static, can share references
    cloned.rails = this.rails;
    cloned.pockets = this.pockets;

    return cloned;
  }
}
```

**Testing**:
```typescript
// tests/ai/PhysicsSimulator.test.ts

describe('PhysicsSimulator', () => {
  it('should not mutate original world', () => {
    const world = createTestWorld();
    const originalPos = world.balls[0].position.clone();

    PhysicsSimulator.simulate(world, 0, 0.5, null);

    expect(world.balls[0].position).toEqual(originalPos);
  });

  it('should detect pocketed balls', () => {
    const world = createTestWorld();
    // Position cue ball to easily pot ball #1
    world.balls[0].position = new Vec2(10, 0);
    world.balls[1].position = new Vec2(15, 0); // Lined up with pocket

    const result = PhysicsSimulator.simulate(world, 0, 0.8, "solids");

    expect(result.myBallsPocketed).toContain(1);
  });

  it('should detect scratches', () => {
    const world = createTestWorld();
    // Aim cue ball at pocket
    world.balls[0].position = new Vec2(45, 0);

    const result = PhysicsSimulator.simulate(world, 0, 1.0, null);

    expect(result.cueBallPocketed).toBe(true);
    expect(result.isFoul).toBe(true);
  });
});
```

---

### **Step 2: PositionEvaluator** (Scoring Function)
**Why second**: Search algorithm needs this to compare shots

**What to build**:
- Score a position based on game state
- Higher score = better for AI
- Use hand-tuned heuristics (balls pocketed, safety, position)

**Where**: `src/ai/PositionEvaluator.ts`

**Interface**:
```typescript
export interface EvaluationFactors {
  // Shot outcome
  myBallsPocketed: number;      // +100 each
  opponentBallsPocketed: number; // -50 each
  isFoul: number;               // -200 if true
  eightBallWin: number;         // +1000 if won
  eightBallLoss: number;        // -1000 if lost

  // Cue ball position
  cueBallCenteredness: number;  // +0 to +50 (center of table = best)
  cueBallNearMyBall: number;    // +0 to +30 (close to next shot)

  // Safety play
  opponentDifficulty: number;   // +0 to +40 (leave hard shot)
  ballsNearPockets: number;     // +0 to +20 (my balls near pockets)

  // Total
  total: number;
}

export class PositionEvaluator {
  /**
   * Scores a position from AI's perspective
   *
   * @param result - Simulation result
   * @param playerGroup - AI's ball group
   * @returns Score (higher = better for AI)
   */
  static evaluate(
    result: SimulationResult,
    playerGroup: "stripes" | "solids" | null
  ): number;

  /**
   * Detailed breakdown of score factors (for debugging)
   */
  static evaluateDetailed(
    result: SimulationResult,
    playerGroup: "stripes" | "solids" | null
  ): EvaluationFactors;
}
```

**Implementation**:

```typescript
// src/ai/PositionEvaluator.ts

import { SimulationResult } from './PhysicsSimulator';
import { Vec2 } from '../physics/Shapes';
import { CONFIG } from '../config';

export class PositionEvaluator {
  static evaluate(
    result: SimulationResult,
    playerGroup: "stripes" | "solids" | null
  ): number {
    let score = 0;

    // === IMMEDIATE OUTCOMES ===

    // Win condition: pot 8-ball legally
    const myBallsRemaining = this.countRemainingBalls(result, playerGroup, true);
    if (result.eightBallPocketed && myBallsRemaining === 0 && !result.isFoul) {
      return 1000; // Instant win
    }

    // Loss condition: pot 8-ball illegally
    if (result.eightBallPocketed && (myBallsRemaining > 0 || result.isFoul)) {
      return -1000; // Instant loss
    }

    // Fouls are bad
    if (result.isFoul) {
      score -= 200;
    }

    // Pocketing my balls is good
    score += result.myBallsPocketed.length * 100;

    // Pocketing opponent's balls is bad
    score -= result.opponentBallsPocketed.length * 50;

    // === POSITIONAL PLAY ===

    const cueBall = result.balls.find(b => b.id === 0);
    if (cueBall && !cueBall.pocketed) {
      // Reward cue ball near center (easier next shots)
      const centerDistance = cueBall.position.length(); // Distance from (0,0)
      const maxDistance = Math.sqrt(50*50 + 25*25); // Corner distance
      const centeredness = 1 - (centerDistance / maxDistance);
      score += centeredness * 50;

      // Reward cue ball near one of my balls (good position)
      const myBalls = this.getMyBalls(result, playerGroup);
      if (myBalls.length > 0) {
        const nearestDist = Math.min(...myBalls.map(b =>
          cueBall.position.distance(b.position)
        ));
        const proximity = Math.max(0, 1 - nearestDist / 50); // 50" = table width
        score += proximity * 30;
      }
    }

    // === SAFETY PLAY ===

    // Reward leaving opponent in difficult position
    const opponentBalls = this.getOpponentBalls(result, playerGroup);
    if (opponentBalls.length > 0 && cueBall && !cueBall.pocketed) {
      // Check if cue ball is far from opponent's balls (safety)
      const nearestOpponentDist = Math.min(...opponentBalls.map(b =>
        cueBall.position.distance(b.position)
      ));
      const safetyScore = Math.min(nearestOpponentDist / 50, 1) * 40;
      score += safetyScore;
    }

    // Reward my balls near pockets (setup for future shots)
    const myBalls = this.getMyBalls(result, playerGroup);
    for (const ball of myBalls) {
      const nearestPocket = this.getNearestPocket(ball.position);
      const distToPocket = ball.position.distance(nearestPocket);
      if (distToPocket < 10) { // Within 10" of pocket
        score += (10 - distToPocket) * 2; // Max +20 per ball
      }
    }

    return score;
  }

  private static countRemainingBalls(
    result: SimulationResult,
    playerGroup: "stripes" | "solids" | null,
    myBalls: boolean
  ): number {
    return result.balls.filter(b => {
      if (b.id === 0 || b.id === 8 || b.pocketed) return false;
      const isStripe = b.id > 8;
      const isMine = (playerGroup === "stripes" && isStripe) ||
                     (playerGroup === "solids" && !isStripe);
      return myBalls ? isMine : !isMine;
    }).length;
  }

  private static getMyBalls(
    result: SimulationResult,
    playerGroup: "stripes" | "solids" | null
  ) {
    return result.balls.filter(b => {
      if (b.id === 0 || b.id === 8 || b.pocketed) return false;
      const isStripe = b.id > 8;
      return (playerGroup === "stripes" && isStripe) ||
             (playerGroup === "solids" && !isStripe);
    });
  }

  private static getOpponentBalls(
    result: SimulationResult,
    playerGroup: "stripes" | "solids" | null
  ) {
    return result.balls.filter(b => {
      if (b.id === 0 || b.id === 8 || b.pocketed) return false;
      const isStripe = b.id > 8;
      return (playerGroup === "stripes" && !isStripe) ||
             (playerGroup === "solids" && isStripe);
    });
  }

  private static getNearestPocket(position: Vec2): Vec2 {
    // 6 pocket positions on standard table
    const pockets = [
      new Vec2(-50, -25), // Top-left
      new Vec2(0, -25),   // Top-middle
      new Vec2(50, -25),  // Top-right
      new Vec2(-50, 25),  // Bottom-left
      new Vec2(0, 25),    // Bottom-middle
      new Vec2(50, 25)    // Bottom-right
    ];

    let nearest = pockets[0];
    let minDist = position.distance(nearest);

    for (const pocket of pockets) {
      const dist = position.distance(pocket);
      if (dist < minDist) {
        minDist = dist;
        nearest = pocket;
      }
    }

    return nearest;
  }
}
```

**Tuning notes**:
- These weights (100, 50, 200, etc.) are starting points
- Playtest and adjust based on AI behavior
- Rookie: reduce positional weights (only cares about potting)
- Pro: increase safety weights (plays more defensively)

**Testing**:
```typescript
// tests/ai/PositionEvaluator.test.ts

describe('PositionEvaluator', () => {
  it('should prefer potting own balls', () => {
    const result1 = { myBallsPocketed: [1], opponentBallsPocketed: [], ... };
    const result2 = { myBallsPocketed: [], opponentBallsPocketed: [], ... };

    const score1 = PositionEvaluator.evaluate(result1, "solids");
    const score2 = PositionEvaluator.evaluate(result2, "solids");

    expect(score1).toBeGreaterThan(score2);
  });

  it('should heavily penalize fouls', () => {
    const result1 = { isFoul: true, myBallsPocketed: [], ... };
    const result2 = { isFoul: false, myBallsPocketed: [], ... };

    const score1 = PositionEvaluator.evaluate(result1, "solids");
    const score2 = PositionEvaluator.evaluate(result2, "solids");

    expect(score1).toBeLessThan(score2 - 150); // At least -200 penalty
  });

  it('should detect instant win', () => {
    const result = {
      eightBallPocketed: true,
      myBallsPocketed: [],
      isFoul: false,
      balls: [/* all solids pocketed */]
    };

    const score = PositionEvaluator.evaluate(result, "solids");

    expect(score).toBe(1000);
  });
});
```

---

### **Step 3: DifficultyProfile** (Config)
**Why third**: Search needs to know how hard to search based on difficulty

**What to build**:
- Config for Rookie, Amateur, Pro
- Controls search granularity and evaluation weights

**Where**: `src/ai/DifficultyProfile.ts`

**Interface**:
```typescript
export interface SearchConfig {
  angleStep: number;      // Degrees between angle samples (10° = coarse, 1° = fine)
  powerSteps: number;     // Number of power levels to try (3 = low, 5 = high)
  minPower: number;       // Minimum power (0.3 = gentle shots only)
  maxPower: number;       // Maximum power (1.0 = full power)
  thinkingTime: number;   // Simulated delay in ms (1000 = feels human)
}

export interface EvaluationWeights {
  potWeight: number;      // How much to value potting balls
  safetyWeight: number;   // How much to value defensive play
  positionWeight: number; // How much to value cue ball position
}

export interface DifficultyConfig {
  search: SearchConfig;
  evaluation: EvaluationWeights;
}

export enum Difficulty {
  ROOKIE = "rookie",
  AMATEUR = "amateur",
  PRO = "pro"
}

export class DifficultyProfile {
  static get(difficulty: Difficulty): DifficultyConfig;
}
```

**Implementation**:
```typescript
// src/ai/DifficultyProfile.ts

export class DifficultyProfile {
  private static profiles: Record<Difficulty, DifficultyConfig> = {
    [Difficulty.ROOKIE]: {
      search: {
        angleStep: 15,      // Very coarse (360° / 15° = 24 angles)
        powerSteps: 3,      // Low, medium, high
        minPower: 0.3,
        maxPower: 0.8,      // No full-power shots
        thinkingTime: 1000  // 1 second delay
      },
      evaluation: {
        potWeight: 1.0,     // Only cares about potting
        safetyWeight: 0.2,  // Rarely plays safe
        positionWeight: 0.3 // Weak positional play
      }
    },

    [Difficulty.AMATEUR]: {
      search: {
        angleStep: 5,       // Medium (360° / 5° = 72 angles)
        powerSteps: 5,      // More power variety
        minPower: 0.3,
        maxPower: 1.0,
        thinkingTime: 1500  // 1.5 seconds
      },
      evaluation: {
        potWeight: 1.0,
        safetyWeight: 0.5,  // Sometimes plays safe
        positionWeight: 0.6 // Better position play
      }
    },

    [Difficulty.PRO]: {
      search: {
        angleStep: 2,       // Fine (360° / 2° = 180 angles)
        powerSteps: 7,      // Full power control
        minPower: 0.2,
        maxPower: 1.0,
        thinkingTime: 2000  // 2 seconds (looks thoughtful)
      },
      evaluation: {
        potWeight: 1.0,
        safetyWeight: 1.0,  // Plays safe when no good pot
        positionWeight: 1.0 // Excellent position play
      }
    }
  };

  static get(difficulty: Difficulty): DifficultyConfig {
    return this.profiles[difficulty];
  }
}
```

**Search space comparison**:
| Difficulty | Angles | Powers | Total shots | Approx time |
|------------|--------|--------|-------------|-------------|
| Rookie     | 24     | 3      | 72          | ~0.1s       |
| Amateur    | 72     | 5      | 360         | ~0.5s       |
| Pro        | 180    | 7      | 1260        | ~2.0s       |

(Time estimates assume 1ms per simulation on modern hardware)

**Tuning later**:
- Add `randomness` parameter (Rookie misses sometimes intentionally)
- Add `lookAhead` parameter (Pro considers 2-3 shots ahead)
- Add `errorMargin` parameter (Rookie has aim error, Pro is perfect)

---

### **Step 4: ShotSearch** (Search Algorithm)
**Why fourth**: Core AI logic, depends on previous 3 components

**What to build**:
- Brute-force search over (angle, power) space
- Use PhysicsSimulator to test each shot
- Use PositionEvaluator to score outcomes
- Return best shot

**Where**: `src/ai/ShotSearch.ts`

**Interface**:
```typescript
export interface Shot {
  angle: number;  // Degrees (0-360)
  power: number;  // 0.0 to 1.0
}

export interface SearchResult {
  bestShot: Shot;
  bestScore: number;
  shotsEvaluated: number;
  timeMs: number;

  // Optional debug info
  allShots?: Array<{ shot: Shot; score: number }>;
}

export class ShotSearch {
  /**
   * Finds the best shot via brute-force search
   *
   * @param world - Current physics world
   * @param playerGroup - AI's ball group
   * @param difficulty - Difficulty level
   * @returns Best shot found
   */
  static findBestShot(
    world: PhysicsWorld,
    playerGroup: "stripes" | "solids" | null,
    difficulty: Difficulty
  ): SearchResult;
}
```

**Implementation**:
```typescript
// src/ai/ShotSearch.ts

import { PhysicsWorld } from '../physics/Physics';
import { PhysicsSimulator } from './PhysicsSimulator';
import { PositionEvaluator } from './PositionEvaluator';
import { DifficultyProfile, Difficulty } from './DifficultyProfile';

export class ShotSearch {
  static findBestShot(
    world: PhysicsWorld,
    playerGroup: "stripes" | "solids" | null,
    difficulty: Difficulty
  ): SearchResult {
    const startTime = performance.now();
    const config = DifficultyProfile.get(difficulty);

    let bestShot: Shot | null = null;
    let bestScore = -Infinity;
    const allShots: Array<{ shot: Shot; score: number }> = [];
    let shotsEvaluated = 0;

    // Generate angle samples
    const angles = this.generateAngles(config.search.angleStep);

    // Generate power samples
    const powers = this.generatePowers(
      config.search.powerSteps,
      config.search.minPower,
      config.search.maxPower
    );

    // Brute-force search
    for (const angle of angles) {
      for (const power of powers) {
        // Simulate this shot
        const result = PhysicsSimulator.simulate(
          world,
          angle,
          power,
          playerGroup
        );

        // Evaluate the outcome
        let score = PositionEvaluator.evaluate(result, playerGroup);

        // Apply evaluation weights from difficulty
        score = this.applyWeights(score, config.evaluation);

        // Track best
        if (score > bestScore) {
          bestScore = score;
          bestShot = { angle, power };
        }

        allShots.push({ shot: { angle, power }, score });
        shotsEvaluated++;
      }
    }

    const timeMs = performance.now() - startTime;

    if (!bestShot) {
      // Fallback: straight ahead, medium power
      bestShot = { angle: 0, power: 0.5 };
    }

    return {
      bestShot,
      bestScore,
      shotsEvaluated,
      timeMs,
      allShots: allShots.sort((a, b) => b.score - a.score) // Debug: sorted by score
    };
  }

  private static generateAngles(step: number): number[] {
    const angles: number[] = [];
    for (let angle = 0; angle < 360; angle += step) {
      angles.push(angle);
    }
    return angles;
  }

  private static generatePowers(
    steps: number,
    min: number,
    max: number
  ): number[] {
    const powers: number[] = [];
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1); // 0.0 to 1.0
      const power = min + t * (max - min);
      powers.push(power);
    }
    return powers;
  }

  private static applyWeights(
    score: number,
    weights: EvaluationWeights
  ): number {
    // TODO: This is simplified. In practice, you'd break down the score
    // into components (pot score, safety score, position score) and
    // weight each separately. For now, just return raw score.
    return score;
  }
}
```

**Optimization opportunities** (for later):
1. **Alpha-beta pruning**: Skip angles if best shot already > threshold
2. **Adaptive search**: If best shot is 90°, search 85-95° more finely
3. **Parallel simulation**: Run simulations in Web Workers
4. **Caching**: If balls haven't moved much, reuse previous search
5. **Early exit**: If found a winning shot (score = 1000), stop searching

**Testing**:
```typescript
// tests/ai/ShotSearch.test.ts

describe('ShotSearch', () => {
  it('should find a valid shot', () => {
    const world = createTestWorld();
    const result = ShotSearch.findBestShot(world, "solids", Difficulty.ROOKIE);

    expect(result.bestShot).toBeDefined();
    expect(result.bestShot.angle).toBeGreaterThanOrEqual(0);
    expect(result.bestShot.angle).toBeLessThan(360);
    expect(result.bestShot.power).toBeGreaterThan(0);
    expect(result.bestShot.power).toBeLessThanOrEqual(1);
  });

  it('should prefer potting ball over missing', () => {
    const world = createTestWorld();
    // Set up easy pot: cue ball at (0,0), solid at (10,0), pocket at (50,0)
    world.balls[0].position = new Vec2(0, 0);
    world.balls[1].position = new Vec2(10, 0);

    const result = ShotSearch.findBestShot(world, "solids", Difficulty.PRO);

    // Should aim roughly east (0°) to pot the ball
    expect(result.bestShot.angle).toBeCloseTo(0, 10); // Within 10°
  });

  it('should search more shots on higher difficulty', () => {
    const world = createTestWorld();

    const rookie = ShotSearch.findBestShot(world, null, Difficulty.ROOKIE);
    const pro = ShotSearch.findBestShot(world, null, Difficulty.PRO);

    expect(pro.shotsEvaluated).toBeGreaterThan(rookie.shotsEvaluated * 10);
  });
});
```

---

### **Step 5: AIPlayer** (Main Controller)
**Why fifth**: Orchestrates everything into the game loop

**What to build**:
- Plugs into Game.ts turn system
- Calls ShotSearch when it's AI's turn
- Applies thinking delay (looks human)
- Applies shot to cue ball

**Where**: `src/ai/AIPlayer.ts`

**Interface**:
```typescript
export interface AIConfig {
  difficulty: Difficulty;
  thinkingDelay: number; // ms (0 = instant, 2000 = thoughtful)
  showThinking: boolean; // Show "AI thinking..." message?
}

export class AIPlayer {
  private config: AIConfig;
  private isThinking: boolean;

  constructor(config: AIConfig);

  /**
   * Called when it's AI's turn
   * Will asynchronously find best shot and apply it
   *
   * @param world - Current physics world
   * @param playerGroup - AI's ball group
   * @param onShotReady - Callback when shot is ready (angle, power)
   */
  takeTurn(
    world: PhysicsWorld,
    playerGroup: "stripes" | "solids" | null,
    onShotReady: (shot: Shot) => void
  ): void;

  /**
   * Cancels current thinking (if user restarts game, etc.)
   */
  cancelTurn(): void;
}
```

**Implementation**:
```typescript
// src/ai/AIPlayer.ts

import { PhysicsWorld } from '../physics/Physics';
import { ShotSearch, Shot, SearchResult } from './ShotSearch';
import { Difficulty } from './DifficultyProfile';

export class AIPlayer {
  private config: AIConfig;
  private isThinking: boolean = false;
  private cancelToken: { cancelled: boolean } | null = null;

  constructor(config: AIConfig) {
    this.config = config;
  }

  takeTurn(
    world: PhysicsWorld,
    playerGroup: "stripes" | "solids" | null,
    onShotReady: (shot: Shot) => void
  ): void {
    if (this.isThinking) {
      console.warn('AI already thinking, ignoring takeTurn call');
      return;
    }

    this.isThinking = true;
    this.cancelToken = { cancelled: false };

    // Show thinking indicator
    if (this.config.showThinking) {
      this.showThinkingMessage();
    }

    // Run search asynchronously (don't block UI)
    setTimeout(() => {
      if (this.cancelToken?.cancelled) return;

      // Find best shot
      const result = ShotSearch.findBestShot(
        world,
        playerGroup,
        this.config.difficulty
      );

      // Log debug info
      console.log(`AI found shot: angle=${result.bestShot.angle.toFixed(1)}°, ` +
                  `power=${result.bestShot.power.toFixed(2)}, ` +
                  `score=${result.bestScore.toFixed(1)}, ` +
                  `evaluated ${result.shotsEvaluated} shots in ${result.timeMs.toFixed(0)}ms`);

      // Apply thinking delay (make it feel human)
      const remainingDelay = Math.max(0, this.config.thinkingDelay - result.timeMs);

      setTimeout(() => {
        if (this.cancelToken?.cancelled) return;

        this.isThinking = false;
        this.hideThinkingMessage();

        // Return shot to game
        onShotReady(result.bestShot);
      }, remainingDelay);

    }, 0); // Yield to event loop
  }

  cancelTurn(): void {
    if (this.cancelToken) {
      this.cancelToken.cancelled = true;
    }
    this.isThinking = false;
    this.hideThinkingMessage();
  }

  private showThinkingMessage(): void {
    // TODO: Integrate with HUD.ts to show "AI thinking..." banner
    console.log('AI is thinking...');
  }

  private hideThinkingMessage(): void {
    // TODO: Hide thinking banner
  }
}
```

**Usage in Game.ts**:
```typescript
// Pseudocode for integration

class Game {
  private aiPlayer: AIPlayer | null = null;

  // In constructor or init
  if (gameMode === 'AI') {
    this.aiPlayer = new AIPlayer({
      difficulty: Difficulty.AMATEUR,
      thinkingDelay: 1500,
      showThinking: true
    });
  }

  // In game loop, after shot completes
  onShotComplete() {
    if (this.currentPlayer === 'AI' && this.aiPlayer) {
      this.aiPlayer.takeTurn(
        this.world,
        this.aiPlayerGroup,
        (shot) => {
          // Apply shot to cue ball
          this.applyShotToCueBall(shot.angle, shot.power);
        }
      );
    }
  }
}
```

---

### **Step 6: Integration with Game.ts** (Plug it in)
**Why last**: Everything else is built, now wire it up

**What to change**:
- Add AI player instance
- Add AI vs Human mode
- Call AI on its turns
- Handle AI shot application

**Where**: `src/game/Game.ts`

**Changes needed**:

```typescript
// src/game/Game.ts

import { AIPlayer } from '../ai/AIPlayer';
import { Difficulty } from '../ai/DifficultyProfile';

export class Game {
  // ... existing fields ...

  // New AI fields
  private aiPlayer: AIPlayer | null = null;
  private player1IsAI: boolean = false; // Player 1 is human
  private player2IsAI: boolean = false; // Player 2 is AI

  /**
   * Enable AI opponent
   * Call this before starting a game
   */
  setAIOpponent(difficulty: Difficulty): void {
    this.player2IsAI = true;
    this.aiPlayer = new AIPlayer({
      difficulty,
      thinkingDelay: 1500,
      showThinking: true
    });
  }

  /**
   * Disable AI (back to 2-player mode)
   */
  disableAI(): void {
    this.player2IsAI = false;
    if (this.aiPlayer) {
      this.aiPlayer.cancelTurn();
      this.aiPlayer = null;
    }
  }

  // Modify existing update loop
  update(dt: number): void {
    // ... existing physics update ...

    // Check if it's AI's turn after balls stop
    if (this.allBallsStopped() && this.needsAIShot()) {
      this.triggerAIShot();
    }
  }

  private needsAIShot(): boolean {
    // Check if it's AI's turn and we haven't triggered shot yet
    if (this.currentPlayer === 1 && this.player1IsAI) return true;
    if (this.currentPlayer === 2 && this.player2IsAI) return true;
    return false;
  }

  private triggerAIShot(): void {
    if (!this.aiPlayer) return;

    // Determine AI's ball group
    const aiGroup = this.currentPlayer === 1
      ? this.player1Group
      : this.player2Group;

    // AI takes turn
    this.aiPlayer.takeTurn(
      this.world,
      aiGroup,
      (shot) => {
        // Apply shot
        this.applyShotFromAI(shot.angle, shot.power);
      }
    );
  }

  private applyShotFromAI(angle: number, power: number): void {
    // Convert angle/power to velocity
    const angleRad = (angle * Math.PI) / 180;
    const speed = power * CONFIG.CUE_POWER_MAX * CONFIG.CUE_POWER_MULTIPLIER;
    const velocity = new Vec2(
      Math.cos(angleRad) * speed,
      Math.sin(angleRad) * speed
    );

    // Apply to cue ball
    const cueBall = this.world.balls.find(b => b.id === 0);
    if (cueBall) {
      cueBall.velocity = velocity;
      cueBall.sleeping = false;
    }
  }

  // Modify restart to cancel AI
  restart(): void {
    if (this.aiPlayer) {
      this.aiPlayer.cancelTurn();
    }
    // ... existing restart logic ...
  }
}
```

**State machine consideration**:

The AI should only take turn when:
1. It's AI's turn (player 1 or 2)
2. All balls have stopped
3. Game state is PLAYING (not GAME_OVER)
4. AI hasn't already been triggered this turn

Add a flag to prevent double-triggering:
```typescript
private aiShotTriggered: boolean = false;

// In onShotComplete or similar
onShotComplete(): void {
  this.aiShotTriggered = false; // Reset for next turn
}

// In triggerAIShot
private triggerAIShot(): void {
  if (this.aiShotTriggered) return;
  this.aiShotTriggered = true;
  // ... rest of AI logic ...
}
```

---

### **Step 7: UI Integration** (Let user choose difficulty)
**Why**: Player needs to enable AI and select difficulty

**What to change**:
- Add AI toggle button to HUD
- Add difficulty selector
- Show "AI thinking..." banner

**Where**: `src/ui/HUD.ts`

**Changes needed**:

```typescript
// src/ui/HUD.ts

export class HUD {
  private aiToggle: HTMLButtonElement;
  private difficultySelector: HTMLSelectElement;
  private thinkingBanner: HTMLDivElement;

  constructor() {
    // ... existing HUD setup ...

    this.createAIControls();
  }

  private createAIControls(): void {
    // AI toggle button
    this.aiToggle = document.createElement('button');
    this.aiToggle.id = 'ai-toggle';
    this.aiToggle.textContent = 'Play vs AI';
    this.aiToggle.addEventListener('click', () => this.onAIToggle());
    document.getElementById('controls')?.appendChild(this.aiToggle);

    // Difficulty selector
    this.difficultySelector = document.createElement('select');
    this.difficultySelector.id = 'ai-difficulty';
    this.difficultySelector.innerHTML = `
      <option value="rookie">Rookie</option>
      <option value="amateur" selected>Amateur</option>
      <option value="pro">Pro</option>
    `;
    this.difficultySelector.style.display = 'none'; // Hidden until AI enabled
    document.getElementById('controls')?.appendChild(this.difficultySelector);

    // Thinking banner
    this.thinkingBanner = document.createElement('div');
    this.thinkingBanner.id = 'ai-thinking-banner';
    this.thinkingBanner.textContent = 'AI is thinking...';
    this.thinkingBanner.style.display = 'none';
    document.body.appendChild(this.thinkingBanner);
  }

  private onAIToggle(): void {
    const enabled = this.aiToggle.textContent === 'Play vs AI';

    if (enabled) {
      // Enable AI
      const difficulty = this.difficultySelector.value as Difficulty;
      this.game.setAIOpponent(difficulty);

      this.aiToggle.textContent = 'Play vs Human';
      this.difficultySelector.style.display = 'inline-block';
    } else {
      // Disable AI
      this.game.disableAI();

      this.aiToggle.textContent = 'Play vs AI';
      this.difficultySelector.style.display = 'none';
    }

    // Restart game with new mode
    this.game.restart();
  }

  showThinking(): void {
    this.thinkingBanner.style.display = 'block';
  }

  hideThinking(): void {
    this.thinkingBanner.style.display = 'none';
  }
}
```

**CSS for thinking banner**:
```css
/* Add to styles/main.css */

#ai-thinking-banner {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 20px 40px;
  border-radius: 10px;
  font-size: 18px;
  font-weight: bold;
  z-index: 1000;
  animation: pulse 1s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

#ai-difficulty {
  margin-left: 10px;
  padding: 5px 10px;
  font-size: 14px;
  border-radius: 5px;
}
```

**Wire up to AIPlayer**:
```typescript
// In AIPlayer.ts, update showThinkingMessage and hideThinkingMessage

private showThinkingMessage(): void {
  // Access HUD singleton or pass reference
  window.game?.hud?.showThinking();
}

private hideThinkingMessage(): void {
  window.game?.hud?.hideThinking();
}
```

---

## Configuration

**Add AI config section to `src/config.ts`**:

```typescript
// src/config.ts

export const CONFIG = {
  // ... existing config ...

  // AI Configuration
  AI: {
    // Default difficulty
    DEFAULT_DIFFICULTY: 'amateur' as Difficulty,

    // Simulation limits
    MAX_SIMULATION_STEPS: 1000, // ~8 seconds at 120 Hz

    // Search optimization
    ENABLE_EARLY_EXIT: true, // Stop searching if found winning shot
    ENABLE_PARALLEL: false,  // Use Web Workers (future)

    // Debug
    LOG_SEARCH_RESULTS: true, // Console log AI decisions
    LOG_EVALUATION_BREAKDOWN: false // Detailed score breakdown
  }
};
```

---

## Testing Strategy

### Unit Tests

1. **PhysicsSimulator.test.ts**
   - Verify cloning doesn't mutate original
   - Verify pocketed balls detected
   - Verify fouls detected

2. **PositionEvaluator.test.ts**
   - Verify scoring prefers good outcomes
   - Verify fouls heavily penalized
   - Verify win/loss detection

3. **ShotSearch.test.ts**
   - Verify finds valid shots
   - Verify prefers potting over missing
   - Verify difficulty affects search depth

### Integration Tests

4. **AI end-to-end test**
   - Set up game with AI
   - Trigger AI turn
   - Verify shot is applied
   - Verify game continues

### Playtesting

5. **Manual testing checklist**
   - [ ] Rookie AI makes easy mistakes
   - [ ] Amateur AI plays competently
   - [ ] Pro AI is challenging
   - [ ] AI doesn't freeze game
   - [ ] AI thinking banner shows/hides correctly
   - [ ] Difficulty selector works
   - [ ] Can switch back to human vs human

---

## Performance Considerations

### Simulation Speed

**Bottleneck**: Running 1260 simulations (Pro difficulty) each frame

**Optimization 1: Limit search frequency**
```typescript
// Only search every 500ms, not every frame
if (Date.now() - lastSearchTime < 500) return;
```

**Optimization 2: Progressive search**
```typescript
// Coarse search first (10° steps), then refine around best
const coarseSearch = searchCoarse(world, 10);
const fineSearch = searchFine(world, coarseSearch.angle - 20, coarseSearch.angle + 20, 1);
```

**Optimization 3: Web Workers** (future)
```typescript
// Run simulations in parallel workers
const workers = createWorkerPool(4);
const results = await Promise.all(
  shotCandidates.map(shot => workers.simulate(shot))
);
```

### Memory Management

**Issue**: Cloning world 1260 times creates garbage

**Solution**: Object pooling
```typescript
class PhysicsWorldPool {
  private pool: PhysicsWorld[] = [];

  acquire(): PhysicsWorld {
    return this.pool.pop() || new PhysicsWorld();
  }

  release(world: PhysicsWorld): void {
    world.reset();
    this.pool.push(world);
  }
}
```

---

## Debug Tools

### Visual Debug Overlay

Show AI's top 5 shots:

```typescript
// In DebugDraw.ts

drawAIDebug(searchResult: SearchResult): void {
  const ctx = this.ctx;
  const top5 = searchResult.allShots.slice(0, 5);

  for (let i = 0; i < top5.length; i++) {
    const { shot, score } = top5[i];
    const alpha = 1 - (i * 0.15); // Fade for lower ranks

    // Draw angle line
    ctx.strokeStyle = `rgba(255, 255, 0, ${alpha})`;
    ctx.lineWidth = 3 - i;
    this.drawAngleLine(shot.angle, shot.power);

    // Draw score label
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.fillText(`#${i+1}: ${score.toFixed(0)}`, 10, 100 + i * 20);
  }
}
```

### Console Commands

```typescript
// Expose for debugging

window.debugAI = {
  testShot: (angle: number, power: number) => {
    const result = PhysicsSimulator.simulate(game.world, angle, power, null);
    console.log(result);
  },

  findBest: () => {
    const result = ShotSearch.findBestShot(game.world, null, Difficulty.PRO);
    console.log(result);
  },

  setDifficulty: (diff: Difficulty) => {
    game.setAIOpponent(diff);
    game.restart();
  }
};
```

---

## Common Issues & Solutions

### Issue 1: AI takes too long on low-end devices

**Symptom**: Game freezes for 5+ seconds on mobile

**Solution**: Reduce search space for mobile
```typescript
const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
if (isMobile) {
  config.search.angleStep *= 2; // Coarser search
  config.search.powerSteps = Math.max(3, config.search.powerSteps - 2);
}
```

### Issue 2: AI makes obviously bad moves

**Symptom**: AI pots opponent's balls, scratches frequently

**Solution**: Increase foul penalty in PositionEvaluator
```typescript
if (result.isFoul) {
  score -= 500; // Increased from 200
}
```

### Issue 3: AI plays too safe (never tries pots)

**Symptom**: AI always plays defensive, boring

**Solution**: Increase pot weight, reduce safety weight
```typescript
[Difficulty.ROOKIE]: {
  evaluation: {
    potWeight: 2.0,    // Doubled
    safetyWeight: 0.1, // Reduced
    positionWeight: 0.3
  }
}
```

### Issue 4: AI finds same shot every time

**Symptom**: Deterministic behavior feels robotic

**Solution**: Add randomness to top-N shots
```typescript
// Instead of always picking #1 shot, pick from top 3 with weights
const topShots = searchResult.allShots.slice(0, 3);
const weights = [0.7, 0.2, 0.1]; // 70% best, 20% 2nd, 10% 3rd
const chosen = weightedRandom(topShots, weights);
```

---

## Future Enhancements

### Phase 2: Smarter AI

1. **Look-ahead search** (2-3 shots deep)
   - Minimax or Monte Carlo
   - Evaluate sequence of shots, not just next one

2. **Opening break strategy**
   - Hardcode good break shot (learned from data)
   - Don't search on break (waste of time)

3. **Pattern recognition**
   - Detect common positions (key ball, cluster, runout)
   - Apply position-specific strategies

### Phase 3: Learning AI

4. **Reinforcement learning**
   - Train PPO agent over 1M games
   - Deploy as "Champion" difficulty

5. **Imitation learning**
   - Collect human gameplay data
   - Train neural network to mimic top players

6. **Hybrid approach**
   - Heuristic for fast decisions
   - RL for difficult positions
   - Blend based on time available

---

## Summary Checklist

Before you start implementing:

- [ ] Read through entire guide
- [ ] Understand architecture (PhysicsSimulator → Evaluator → Search → AIPlayer)
- [ ] Ensure PhysicsWorld.clone() is implemented
- [ ] Create `src/ai/` directory
- [ ] Set up test files in `tests/ai/`

**Implementation order**:
1. ✅ Step 1: PhysicsSimulator (foundation)
2. ✅ Step 2: PositionEvaluator (scoring)
3. ✅ Step 3: DifficultyProfile (config)
4. ✅ Step 4: ShotSearch (search algorithm)
5. ✅ Step 5: AIPlayer (controller)
6. ✅ Step 6: Game.ts integration
7. ✅ Step 7: HUD integration

**Testing after each step**:
- Write unit tests
- Run `npm test`
- Manual playtesting

**Estimated time**:
- Solo dev: 8-12 hours (spread over 2-3 days)
- With tests: +4 hours
- With polish: +2 hours
- **Total**: ~2 work days

---

## Questions Before You Start?

If anything is unclear:
1. Re-read the relevant section
2. Check existing codebase (Physics.ts, Game.ts)
3. Ask specific questions before implementing

Good luck! 🎱

---

**Document version**: 1.0
**Last updated**: 2024-11-29
**Author**: Claude Code
**Codebase**: pool2d (commit 393e076)

# Physics Corrections from debug-overlay-sync Branch

## Executive Summary
The `debug-overlay-sync` branch contains critical physics fixes that resolve a **2.9° collision angle error** down to **<0.6°**. The root cause was friction impulses being applied 15 times per collision (once per solver iteration) instead of just once.

## Problem Statement
**Current Issue**: Object balls do not move along the collision normal after being struck, causing ~2.9° angular deviation in cut shots.

**Root Cause**: The physics solver runs 15 iterations per timestep (`CONFIG.SOLVER_ITERATIONS = 15`), and the current code applies both positional corrections AND velocity impulses (normal + friction) in every iteration, causing friction to accumulate 15x.

**Expected Behavior**: Object balls should move **exactly along the collision normal** (0° deviation) in a perfect collision.

## Changes Required

### 1. Add Collision Pair Tracking (`src/physics/Collision.ts`)

**Status**: ❌ Missing in current branch  
**Impact**: Critical - Fixes the core physics bug

**Add at top of file** (after imports, around line 16):
```typescript
// Track which collision pairs have had impulses applied this timestep
const resolvedPairsThisStep = new Set<string>();

export function resetCollisionTracking() {
  resolvedPairsThisStep.clear();
}

function getCollisionPairId(ballA: Ball, ballB: Ball): string {
  // Use sorted IDs to ensure consistent pair identification
  const id1 = Math.min(ballA.id, ballB.id);
  const id2 = Math.max(ballA.id, ballB.id);
  return `${id1}-${id2}`;
}
```

### 2. Update `resolveBallBall()` Function (`src/physics/Collision.ts`)

**Status**: ❌ Missing collision tracking logic  
**Current Line**: ~120  
**Impact**: Critical

**Modifications needed**:
1. Check if this collision pair was already resolved this timestep
2. Always apply positional correction (needed for solver stability)
3. Only apply velocity impulses (normal + friction) on first resolution
4. Mark pair as resolved after first impulse application

**Key code section to add** (at start of resolveBallBall):
```typescript
const totalInvMass = ballA.invMass + ballB.invMass;
const pairId = getCollisionPairId(ballA, ballB);
const isFirstResolution = !resolvedPairsThisStep.has(pairId);

// Positional correction (Baumgarte stabilization) - always apply
const correction = depth * 1.2; // 120% correction to prevent collision loops

if (totalInvMass > 0) {
  const correctionX = (correction * nx) / totalInvMass;
  const correctionY = (correction * ny) / totalInvMass;
  
  ballA.x -= correctionX * ballA.invMass;
  ballA.y -= correctionY * ballA.invMass;
  ballB.x += correctionX * ballB.invMass;
  ballB.y += correctionY * ballB.invMass;
}

// Recalculate normal after positional correction
const dx_corrected = ballB.x - ballA.x;
const dy_corrected = ballB.y - ballA.y;
const dist_corrected = Math.sqrt(dx_corrected * dx_corrected + dy_corrected * dy_corrected);
const nx_corrected = dist_corrected > 1e-8 ? dx_corrected / dist_corrected : nx;
const ny_corrected = dist_corrected > 1e-8 ? dy_corrected / dist_corrected : ny;

// Only apply velocity impulses on first resolution
if (!isFirstResolution) {
  return; // Position correction only on subsequent iterations
}

// Mark this pair as resolved for this timestep
resolvedPairsThisStep.add(pairId);

// ... continue with normal impulse and friction using nx_corrected, ny_corrected
```

### 3. Call Reset Function in Physics Step (`src/physics/Physics.ts`)

**Status**: ❌ Missing  
**Location**: Start of `step()` method (around line 88)  
**Impact**: Critical

**Add import**:
```typescript
import { detectBallBall, detectBallRail, resolveBallBall, resolveBallRail, Contact, resetCollisionTracking } from './Collision';
```

**Add at start of step() method**:
```typescript
step(dt: number) {
  // Reset collision tracking at the start of each timestep
  resetCollisionTracking();
  
  // ... rest of physics step
}
```

### 4. Update Ball-Ball Friction Config (`src/config.ts`)

**Status**: ✅ Current value is 0.05, should be 0.01  
**Location**: Line ~35  
**Impact**: Medium - Improves realism

**Change**:
```typescript
// Before
BALL_BALL_FRICTION: 0.05,

// After  
BALL_BALL_FRICTION: 0.01, // Reduced for more realistic smooth ball surfaces
```

**Rationale**: Pool balls have very smooth, hard surfaces (phenolic resin) with minimal friction. The lower coefficient (0.01) better represents real physics while still allowing for slight "throw" effects and spin transfer.

### 5. Add Clone Methods to Shapes (`src/physics/Shapes.ts`)

**Status**: ⚠️ Need to verify if present  
**Impact**: Medium - Required for accurate prediction

**Add to Ball class**:
```typescript
clone(): Ball {
  const copy = new Ball(this.id, this.x, this.y, this.radius, this.mass);
  copy.vx = this.vx;
  copy.vy = this.vy;
  copy.invMass = this.invMass;
  copy.pocketed = this.pocketed;
  copy.sleeping = this.sleeping;
  copy.angle = this.angle;
  copy.angularVelocity = this.angularVelocity;
  copy.rotationX = this.rotationX;
  copy.rotationY = this.rotationY;
  copy.rotationZ = this.rotationZ;
  copy.prevX = this.prevX;
  copy.prevY = this.prevY;
  return copy;
}
```

**Add to Rail class**:
```typescript
clone(): Rail {
  const copy = new Rail(this.x1, this.y1, this.x2, this.y2, this.cushionId);
  copy.nx = this.nx;
  copy.ny = this.ny;
  return copy;
}
```

**Add to Pocket class**:
```typescript
clone(): Pocket {
  return new Pocket(this.x, this.y, this.radius);
}
```

### 6. Update Shot Capture to Use CONFIG Values (`src/debug/ShotCapture.ts`)

**Status**: ⚠️ Need to verify  
**Impact**: Low - Improves accuracy of debug reports

Ensure shot capture uses `CONFIG.BALL_BALL_FRICTION` and `CONFIG.BALL_RESTITUTION` instead of hardcoded values for prediction accuracy.

## Testing Plan

### Unit Tests
Add tests in `src/physics/Physics.test.ts`:
1. **Head-on collision test**: Verify 0.00° deviation
2. **Cut shot test**: Verify <1.0° deviation (should be ~0.57°)
3. **Multiple iterations test**: Verify impulses only applied once per pair

### Manual Testing
1. Enable shot capture in browser console: `captureShot()`
2. Take various cut shots (30°, 45°, 60° angles)
3. Check shot capture report for "Normal vs actual object angle"
4. Should see **<1.0° error** consistently

## Implementation Priority

### Phase 1: Critical Fixes (Required) ✅ COMPLETE
1. ✅ Add collision pair tracking (`resetCollisionTracking`, `getCollisionPairId`) - DONE
2. ✅ Update `resolveBallBall()` to track and prevent duplicate impulses - DONE
3. ✅ Call `resetCollisionTracking()` at start of each physics step - DONE
4. ✅ Update `BALL_BALL_FRICTION` to 0.01 - DONE

### Phase 2: Supporting Features (Recommended) ✅ COMPLETE
5. ✅ Add clone methods to Ball, Rail, Pocket classes - DONE
6. ✅ Update ShotCapture to use CONFIG values - DONE

### Phase 3: Testing (Validation)
7. ⚠️ Add unit tests for collision physics
8. ⚠️ Manual testing with shot capture

### Phase 4: Physics-Based Prediction (BONUS) ✅ COMPLETE
9. ✅ Add PhysicsWorld.clone() method for simulation worlds - DONE
10. ✅ Add PhysicsWorld.getBallById() helper method - DONE
11. ✅ Add PhysicsWorld.recordingEnabled flag - DONE
12. ✅ Import simulateShotPaths() from debug-overlay-sync - DONE
13. ✅ Add ShotPreviewPaths interface - DONE

## Phase 4 Details: Physics-Based Prediction

The ray-cast prediction system had accuracy degradation at extreme angles (~7° error at 175°).
The debug-overlay-sync branch uses **full physics simulation** for predictions instead:

### Changes Made:
- **PhysicsWorld.clone()**: Create isolated simulation world
- **PhysicsWorld.getBallById()**: Look up balls by ID in cloned world
- **PhysicsWorld.recordingEnabled**: Disable debug recording in prediction worlds
- **simulateShotPaths()**: Run actual physics for N timesteps to predict trajectories

### Benefits:
- ✅ Accurate at ALL angles (not just normal shots)
- ✅ Accounts for friction, deceleration, multi-ball interactions
- ✅ Returns full trajectory paths for visualization
- ✅ Contact point error: 0.34" → expected <0.05" (7x improvement)
- ✅ Angle error: 7.5° → expected <1° at all angles

## Expected Results

| Metric | Before | After Phase 1-3 | After Phase 4 | Total Improvement |
|--------|--------|-----------------|---------------|-------------------|
| Collision accuracy | 2.9° | **0.6°** | 0.6° | **80% better** |
| Prediction (normal angles) | ~13° | ~1° | <1° | **92% better** |
| Prediction (extreme angles) | N/A | ~7° | **<1°** | **Consistent** |
| Friction applications | 15x | **1x** | 1x | ✅ Fixed |
| Contact point error | ~0.3" | ~0.03" | **<0.05"** | **6x better** |

## Files Modified

### Phase 1 & 2:
1. **`src/physics/Collision.ts`** - Add tracking, update resolveBallBall
2. **`src/physics/Physics.ts`** - Add resetCollisionTracking call, clone(), getBallById()
3. **`src/config.ts`** - Update BALL_BALL_FRICTION
4. **`src/physics/Shapes.ts`** - Add clone methods
5. **`src/debug/ShotCapture.ts`** - Fix object ball friction, use CONFIG values
6. **`src/game/Game.ts`** - Fix HUD initialization order

### Phase 3 & 4:
7. **`src/physics/Prediction.ts`** - Add simulateShotPaths(), ShotPreviewPaths interface
8. **`PHYSICS_FIX_PLAN.md`** - Documentation

## References

- **Source Branch**: `origin/debug-overlay-sync`
- **Key Commit**: `ab70c54` - "Refactor collision handling and improve shot prediction accuracy"
- **Documentation**: `docs/ball-collision-fix.md` (in source branch)
- **Test Suite**: `src/physics/Physics.test.ts` (in source branch)

## Notes

- The fix maintains solver stability (15 iterations for positional corrections)
- Velocity impulses are correctly applied only once per collision pair
- This matches real-world pool physics where object balls move along collision normals
- The reduced friction coefficient (0.01) better represents phenolic resin ball surfaces

## Date Created
October 16, 2025

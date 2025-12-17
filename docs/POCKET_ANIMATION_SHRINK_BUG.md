# Pocket Animation Ball Shrinking Bug

## Status
**Fix Implemented (Needs Verification)** - Icon generation now frames a 1.0-scale ball to (almost) fill the icon, so pocket animation sprites drawn at ball radius no longer look “shrunk”.

## Issue Description
When a ball is pocketed, the pocket animation shows the ball shrinking to a small dot before disappearing, creating an undesirable "dropping miles" visual effect.

## Confirmed Root Cause
The “shrinking” look comes from the **icon content being smaller than the drawn sprite radius**:

- The icon generator used a camera distance that framed a full-size ball at ~69% of the icon diameter.
- HUD generation additionally scaled the mesh to `iconScale = 0.7`, making the ball inside HUD icons effectively ~48% of the icon diameter.
- Pocket animations that drew these icons at the expected on-screen radius therefore showed a smaller ball than the physics ball, which reads as a shrink/drop effect.

The animation can start drawing the gradient fallback and then switch to the icon once the `Image` finishes loading; with correct icon framing, that swap should no longer change perceived size.

## What Was Verified Through Testing

1. **FX overlay radius stays constant** during the animation.
2. **Gradient fallback renders at the correct size**, confirming the issue was the icon content (not world-to-screen scaling).
3. **The shrink effect correlates with using the 70%-scale HUD icons**.

## Earlier Changes (Still Relevant)

### Changes Made

1. **`BallRenderer.generateBallIcons`** (`src/render/components/BallRenderer.ts`)
   - Added optional `iconScale` parameter (default 0.7 for backward compatibility)
   - Cache key includes scale so different icon sets don’t collide

2. **`Renderer3D.generatePocketAnimationIcons`** (`src/render/Renderer3D.ts`)
   - Generates icons at 100% scale (`iconScale = 1.0`) for pocket animations

3. **`Game.ts`** (`src/game/Game.ts`)
   - Generates HUD chip icons into `window.__BALL_ICONS__` (70% scale)
   - Generates pocket animation icons into `window.__POCKET_ANIM_ICONS__` (100% scale)

4. **`Game.handleBallPocketed`** (`src/game/Game.ts`)
   - Uses `__POCKET_ANIM_ICONS__` instead of `__BALL_ICONS__`

5. **`FXRenderer`** (`src/render/components/FXRenderer.ts`)
   - Draws the pocket icon at the animation radius (no extra scale compensation needed)
   - Falls back to a gradient ball if the icon isn’t ready/available

6. **`Renderer3D.queuePocketAnimation`** (`src/render/Renderer3D.ts`)
   - Immediately hides 3D ball mesh when animation starts to prevent visual overlap

## Fix Implemented

1. **Icon framing corrected** (`src/render/components/BallRenderer.ts`)
   - `generateBallIcons` now computes the camera distance so a 1.0-scale ball nearly fills the icon (small safety margin).

## How to Test

1. Start a game and pocket a ball early (before/while assets are still loading) and late (after everything is loaded).
2. Compare behavior when the pocket animation draws an icon vs when it draws the gradient fallback.
3. If you can reproduce only on “early” pockets, it strongly suggests an async icon readiness issue.

Quick console checks:

- `window.__POCKET_ANIM_ICONS__?.size` should be `16` (including cue ball) once generated.
- If you see the shrink effect, check whether `window.__POCKET_ANIM_ICONS__` is missing/empty at that moment.

## Workaround

If icon generation/loading is ever problematic, the gradient fallback path in `FXRenderer.drawPocketAnimationSprite` already avoids the shrink effect.

## Related Files

- `src/render/components/FXRenderer.ts` - Pocket animation rendering
- `src/render/components/BallRenderer.ts` - Ball icon generation
- `src/render/Renderer3D.ts` - 3D renderer and icon generation wrapper
- `src/game/Game.ts` - Pocket event handling and icon initialization


# 8-Ball Rules Implementation Status

This document tracks the implementation status of standard 8-ball rules in Pool 2D.

## Overview

8-ball is a call-shot game played with a cue ball and fifteen object balls, numbered 1 through 15. One player must pocket balls 1-7 (solids), while the other player has 9-15 (stripes). The player pocketing their group first and then legally pocketing the 8-ball wins the game.

**Implementation Status:** ⚠️ **PARTIAL** - Core rules working, many edge cases and standard rules missing

**Rules Philosophy:** Pool rules vary widely by venue (bar rules, tournament rules, league rules). We've implemented a **configurable rules system** (`RulesConfig.ts`) that allows switching between presets:
- **CASUAL** - Relaxed bar rules, slop counts, no rail contact
- **TOURNAMENT** - Strict BCA/WPA rules, rail contact required, called 8-ball
- **APA** - League rules, middle ground between casual and tournament
- **PRACTICE** - Very relaxed for learning
- **CUSTOM** - Pick and choose individual rules

---

## ✅ Implemented Rules

### Game Setup & Break
- ✅ **Triangle rack** - All 15 balls racked in standard triangle formation
- ✅ **Break shot** - Game starts with break from behind head string
- ✅ **8-ball on break win** - Pocketing 8-ball on legal break = instant win
- ✅ **8-ball on break scratch** - Honors `scratch8BallOnBreakLoss` (loss when enabled, otherwise spotted + foul)

### Group Assignment
- ✅ **Open table after break** - Table is open until first ball pocketed
- ✅ **Group assignment by first pocket** - First ball pocketed determines groups
  - Player pocketing a solid gets solids (1-7)
  - Player pocketing a stripe gets stripes (9-15)
- ✅ **Group tracking** - Both players' groups tracked in `Player.group` and `EightBallRules`

### Legal Shots
- ✅ **Must hit own group first** - After groups assigned, must contact your group before any other ball
- ✅ **Can shoot any ball before groups assigned** - Any ball (except 8) is legal before group assignment
- ✅ **8-ball legal only after clearing group** - Can only shoot 8-ball after all your balls are pocketed

### Fouls
- ✅ **Cue ball scratch** - Pocketing cue ball = foul
- ✅ **No ball contact** - Cue ball doesn't contact any ball = foul
- ✅ **Wrong group first** - Hitting opponent's group first = foul
- ✅ **Ball-in-hand after foul** - Opponent gets cue ball in hand anywhere on table

### Win/Loss Conditions
- ✅ **Legal 8-ball win** - Pocketing 8-ball after clearing your group = win
- ✅ **Early 8-ball loss** - Pocketing 8-ball before clearing your group = loss
- ✅ **8-ball foul loss** - Pocketing 8-ball with a foul = loss

### Turn Management
- ✅ **Turn switching on miss** - Miss or foul = turn switches to opponent
- ✅ **Continue on legal pocket** - Legally pocketing your ball = continue shooting
- ✅ **Foul handling** - Fouls trigger ball-in-hand and turn switch

---

## ⚙️ Configurable Rules Overview

`RulesConfig.ts` is fully wired into `EightBallRules` and `Game.ts`. Numeric keys (`1`–`4`) restart the current table with CASUAL / TOURNAMENT / APA / PRACTICE presets, and the HUD logs the active ruleset in the console. The sections below summarize how each toggle behaves today.

### Optional Rules

#### 1. **Rail Contact Rule** ✅ (with caveats)
- **Behavior:** `PhysicsWorld` raises `onRailCollision`, `Game.setupCollisionTracking()` forwards it to `EightBallRules.recordRailContact()`, and `endShot()` enforces `config.requireRailContact` whenever no ball drops.
- **Gaps:** No per-ball attribution yet—very light grazes can be missed if the collision callback does not fire.
- **Relevant files:** `Physics.ts`, `Game.ts`, `EightBallRules.ts`

#### 2. **Legal Break Requirements** ⚠️ PARTIAL
- **Behavior:** If `config.requireLegalBreak` is true, we validate that either a ball is pocketed or at least four object balls contact cushions (tracked via `onRailCollision`). Otherwise it's a foul with ball-in-hand.
- **Missing:** Cushion counts are tracked, but opponent choices (accept / re-rack / re-break) are not exposed.
- **Relevant files:** `EightBallRules.handleBreak()`, `Physics.ts` (future rail-count tracking)

#### 3. **Called 8-Ball Pocket** ✅ (focused)
- **Behavior:** When `requireCalled8Ball` (or `requireCalledShots`) is enabled and a player has cleared their group, humans are prompted to select one of the six pockets before shooting the 8-ball and AI auto-selects the nearest pocket. `EightBallRules` compares the actual pocket to the declared call.
- **Missing:** Still no UX for calling *every* shot (`requireCalledShots` simply piggybacks on the 8-ball workflow), and the prompt is a blocking dialog rather than an in-HUD control.
- **Relevant files:** `Game.ts`, `Physics.ts`, `EightBallRules.ts`

#### 4. **Ball-in-Hand Placement Rules** ⚠️ PARTIAL
- **Behavior:** Cue ball dragging now enforces kitchen-only placement after a break scratch whenever the ruleset requires it (using `breakScratchPlacement` / `ballInHandAnywhere`), including HUD guidance.
- **Needed:** Validate ball-in-hand placement against other balls (`bihDisallowTouchingBalls`) and extend placement UI beyond the break-scratch scenario.
- **Relevant files:** `Game.ts` ball-drag logic, `geometry/Placement.ts`

### Advanced / Missing Rules

1. **Jumped Balls** – Not modeled (2D physics cannot leave the table), so fouls/jump recovery are skipped.
2. **Push-Out Rule** – Requires new `GameStateMachine` state and UI toggle; not started.
3. **Three-Foul Rule** – Need consecutive foul tracking per player and auto-loss logic; not started.
4. **Shot Clock** – No timer UI or enforcement yet; would hook into `RulesConfig.shotClockSeconds`.
5. **Stalemate / Re-Rack Detection** – No position history tracking.
6. **Intentional Foul Penalties** – Not planned (difficult to detect input intent).

---

## 🐛 Known Issues

### Issue 1: Legal Break Still Lacks Opponent Choice
**Current Behavior:** Failure to meet legal break requirements always becomes ball-in-hand for the opponent.
**Expected Behavior:** Should present options (accept table, request re-rack, shooter re-break) per league/tournament rules.
**Location:** `EightBallRules.handleBreak()`
**Priority:** MEDIUM

### Issue 2: `requireCalledShots` Still Ignored
**Current Behavior:** Only the 8-ball workflow uses the new call mechanic; enabling `requireCalledShots` behaves the same as `requireCalled8Ball`.
**Expected Behavior:** When `requireCalledShots` is true, every shot (not just the 8-ball) should require a declared pocket via an in-game UI, not the temporary dialog.
**Location:** `Game.ts`, `EightBallRules.handle8BallPocketed()`
**Priority:** MEDIUM

---

## 📋 Implementation Priority List

Based on gameplay impact and how close the systems already are:

### Phase 1: Legal Break UX + Placement Polish
1. ✅ `RulesConfig.ts` presets + wiring (done)
2. ✅ **Honor `scratch8BallOnBreakLoss`** – now follows config.
3. ✅ **Improve legal-break check** – counts cushion contacts for the “four balls to rails” requirement.
4. ✅ **Kitchen-only ball-in-hand** – clamps cue ball placement when configs demand it.
5. 🔧 **Offer post-break options** – accept table / re-rack / re-break prompt after illegal break.

### Phase 2: Add Missing UI / Rule Hooks
6. ⏳ **Called-shots UI upgrade** – replace the temporary dialog with an in-HUD selector and make `requireCalledShots` apply to every ball, not just the 8-ball.
7. ⏳ **Ruleset indicator in HUD** – optional quality-of-life reminder.

### Phase 3: Advanced / Tournament Features
8. ⏳ **Shot clock** – timer UI + foul on timeout (`shotClockSeconds`).
9. ⏳ **Push-out support** – new GameState after break, UI toggle, and turn handoff.
10. ⏳ **Three-foul tracking** – consecutive foul counters + auto-loss.

### Phase 4: Stretch Goals
11. ⏳ Jumped ball handling (once physics supports verticality)
12. ⏳ Stalemate / three-position detection
13. ⏳ Intentional foul penalties (potentially manual admin control)

---

## 🎯 Recommended Next Steps

For a configurable, fair 8-ball experience:

### Option A: Finish the “almost there” rules
1. Offer proper illegal-break resolutions (accept / re-rack / re-break) including UI affordance.
2. Surface the active ruleset in the HUD so players know which preset is live.
3. Expand ball-in-hand validation to cover all fouls (touching other balls) when `bihDisallowTouchingBalls` is set.
4. Replace the prompt-based called-pocket workflow with an in-HUD selector and extend it to every shot when `requireCalledShots` is enabled.

### HUD Progress Chips (New)

- The HUD header shows each player’s group progress as 7 fixed chips.
- Remaining balls display realistic thumbnails rendered offscreen with the same materials as gameplay, with a front-facing centered number for legibility.
- Potted balls remain as empty rings to retain spatial consistency.
- Before groups are assigned, chips render as neutral placeholders.

### Option B: Add competitive/tournament polish
1. Upgrade the called-pocket UI (non-blocking HUD picker) and extend it to fully support `requireCalledShots`.
2. Layer in optional timers, push-out turns, and three-foul tracking for TOURNAMENT preset.
3. Explore jump-ball / stalemate handling if/when the physics model supports it.

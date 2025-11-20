# 8-Ball Rules – Current Implementation & Roadmap

This document tracks how the RailRush rules engine behaves today and what gaps remain.

## Overview

8-ball is a call-shot game played with a cue ball and fifteen object balls, numbered 1 through 15. One player must pocket balls 1-7 (solids), while the other player has 9-15 (stripes). The player pocketing their group first and then legally pocketing the 8-ball wins the game.

**Implementation Status:** ✅ **Core rules complete** – advanced UX (illegal-break choices, non-blocking called shots, full preset UI) still pending.

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
- ✅ **8-ball on break win** - Honors preset (`allow8BallBreakWin`)
- ✅ **8-ball on break scratch** - Honors `scratch8BallOnBreakLoss` (loss when enabled, otherwise spotted + foul)
- ⚠️ **Illegal break resolution** - Cushion contact counts are tracked, but the opponent is auto-granted BIH instead of choosing accept/re-rack/re-break (see roadmap)

### Group Assignment
- ✅ **Open table after break** - Table is open until first ball pocketed
- ✅ **Group assignment by first pocket** - First made ball determines solids/stripes
- ✅ **HUD chips** - Remaining balls per player are surfaced in the HUD header using Renderer3D-generated thumbnails

### Legal Shots & Pocket Calls
- ✅ **Must hit own group first** (post assignment)
- ✅ **Open table until assignment**
- ✅ **8-ball locked until group cleared**
- ✅ **Called-pocket workflow**
  - When a shot requires a call (8-ball or `requireCalledShots`), the HUD prompts the player to click one of six pockets
  - Renderer highlights pockets during selection; Game remembers `currentCalledPocketId`
  - During the shot the renderer highlights the called pocket; rules validate actual capture vs. call
- ⚠️ **Non-blocking selector** – Current approach suppresses aim/power inputs until a pocket is chosen; roadmap aims to provide HUD-side buttons so aiming can continue during selection

### Fouls & Ball-In-Hand
- ✅ **Cue ball scratch** - Pocketing the cue ball is a foul
- ✅ **No ball contact** - Shot that contacts nothing is a foul
- ✅ **Wrong group first** - Contacting opponent ball first after assignment triggers foul
- ✅ **Ball-in-hand** - Opponent receives cue ball in hand anywhere (`ballInHandAnywhere`) or kitchen-only (`breakScratchPlacement`) depending on preset; kitchen clamping enforced after break scratches
- ⚠️ **BIH collision clamp** - `bihDisallowTouchingBalls` is partially enforced (HUD messaging warns, but drag UI still allows overlaps); needs collision-aware placement

### Win/Loss Conditions
- ✅ **Legal 8-ball win** - Pocket 8 after clearing your group and calling the correct pocket (when required)
- ✅ **Early 8-ball loss**
- ✅ **8-ball foul loss**
- ✅ **8-ball on break behavior** - Honors preset for win vs. spot

### Turn Management & AI
- ✅ **Turn switching** - Miss or foul flips turn
- ✅ **Continue on legal pocket**
- ✅ **AI scratch recovery** - AI immediately takes over break shots after human scratch
- ✅ **AI + presets** - AI respects the active preset, including kitchen BIH and called-pocket requirements

---

## ⚙️ Configurable Rules Overview

`RulesConfig.ts` is fully wired into `EightBallRules` and `Game.ts`. Numeric keys (`1`–`4`) restart the current table with CASUAL / TOURNAMENT / APA / PRACTICE presets, and the HUD logs the active ruleset in the console. The sections below summarize how each toggle behaves today.

### Optional Rules – Implementation Notes

1. **Rail Contact Rule** – ✅ enforced via `PhysicsWorld` rail callbacks; light contact misses remain rare
2. **Legal Break Requirements** – ⚠️ counts cushion impacts + pockets but always grants BIH (no accept/re-rack UI yet)
3. **Called 8-Ball / Called Shots** – ✅ blocking HUD selector ensures calls are recorded; needs non-blocking UX + full-table workflow when `requireCalledShots` is `true`
4. **Ball-In-Hand Placement** – ⚠️ kitchen clamp implemented; collision-free placement flagged as future work when `bihDisallowTouchingBalls` is `true`

### Advanced / Missing Rules

1. **Jumped Balls** – Not modeled (2D physics cannot leave the table), so fouls/jump recovery are skipped.
2. **Push-Out Rule** – Requires new `GameStateMachine` state and UI toggle; not started.
3. **Three-Foul Rule** – Need consecutive foul tracking per player and auto-loss logic; not started.
4. **Shot Clock** – No timer UI or enforcement yet; would hook into `RulesConfig.shotClockSeconds`.
5. **Stalemate / Re-Rack Detection** – No position history tracking.
6. **Intentional Foul Penalties** – Not planned (difficult to detect input intent).

---

## 🐛 Known Gaps

1. **Illegal Break Options** – Need a ModalService dialog to offer accept/re-rack/re-break per preset instead of auto BIH.
2. **Non-blocking Pocket Calls** – Current HUD prompt pauses input; selector should live in the HUD header or modal footer so aiming continues.
3. **Full Called-Shot Support** – When `requireCalledShots` is enabled, the system should request pockets for every ball, not piggyback on the 8-ball workflow.
4. **BIH Collision Guard** – Enforce `bihDisallowTouchingBalls` by preventing drag placements that intersect other balls.
5. **Shots Clock / Push-Out / Three-Foul** – Config keys exist but UI + state machines still missing.

---

## 📋 Implementation Priority List

Based on gameplay impact and how close the systems already are:

### Phase 1 – UX polish
1. ✅ Presets + wiring
2. ✅ Legal-break cushion tracking + `scratch8BallOnBreakLoss`
3. ✅ Kitchen-only BIH enforcement
4. 🔧 Illegal-break options dialog (accept / re-rack / re-break)
5. 🔧 Non-blocking pocket selector + full called-shot UI

### Phase 2 – HUD surfacing
6. 🔧 HUD rules indicator (active preset + called-pocket status)
7. 🔧 BIH placement guard (prevent overlaps when `bihDisallowTouchingBalls`)

### Phase 3 – Advanced levers
8. ⏳ Shot clock UI + foul on timeout (`shotClockSeconds`)
9. ⏳ Push-out turn state + UI toggle
10. ⏳ Three-foul tracking + auto-loss messaging

### Phase 4 – Stretch & tournament extras
11. ⏳ Jumped ball handling (requires vertical physics)
12. ⏳ Stalemate / three-position detection
13. ⏳ Intentional foul penalties / admin overrides

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

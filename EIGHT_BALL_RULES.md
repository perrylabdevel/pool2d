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
- ✅ **8-ball on break scratch** - Scratch while pocketing 8-ball on break = loss (currently gives win, needs fix)

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

## ⚙️ Configurable Rules (Not Yet Connected)

**Status:** `RulesConfig.ts` created with 4 presets, but **not yet integrated** with `EightBallRules.ts`

The following rules should be **configurable options** that players can toggle:

### Optional Rules (Should Be Configurable)

#### 1. **Rail Contact Rule** ⚠️ HIGH PRIORITY
**Standard Rule:** On every shot (unless a ball is pocketed), either:
- The cue ball must contact a rail after hitting the object ball, OR
- An object ball must contact a rail after being hit

**Config Option:** `config.requireRailContact`
**Enabled By Default In:** TOURNAMENT only
**Current Status:** Not implemented
**Impact:** Players can tap balls without proper follow-through
**Implementation Location:** `EightBallRules.endShot()` + `PhysicsWorld` (track rail collisions)

#### 2. **Legal Break Requirements** ⚠️ HIGH PRIORITY
**Standard Rule:** On the break shot:
- Must hit the rack with sufficient force
- At least 4 object balls must contact cushions OR a ball must be pocketed
- Otherwise, it's a foul and opponent can:
  - Accept the table as-is, OR
  - Re-rack and break themselves, OR
  - Request you re-break

**Config Option:** `config.requireLegalBreak`
**Enabled By Default In:** TOURNAMENT, APA
**Current Status:** Not implemented - any contact counts as legal break
**Impact:** Can make weak breaks with no penalty
**Implementation Location:** `EightBallRules.handleBreak()` + `PhysicsWorld` (count balls hitting rails)

#### 3. **Called 8-Ball Pocket** ⚠️ MEDIUM PRIORITY
**Standard Rule:** When shooting the 8-ball, player must call which pocket they're aiming for
- If 8-ball goes in wrong pocket = loss
- If 8-ball goes in called pocket = win

**Config Option:** `config.requireCalled8Ball`
**Enabled By Default In:** TOURNAMENT, APA
**Current Status:** Not implemented - any pocket wins
**Impact:** 8-ball win is easier than it should be
**Implementation Location:** `Game.ts` (need UI for calling pocket) + `EightBallRules.handle8BallPocketed()`
**Alternative Option:** `config.requireCalledShots` - Call ALL shots (rarely used)

#### 4. **Ball-in-Hand Placement Rules** ⚠️ MEDIUM PRIORITY
**Standard Rule:**
- After scratch on break: ball-in-hand behind the head string (kitchen)
- After other fouls: ball-in-hand anywhere on table
- Cannot place cue ball on top of or touching another ball

**Config Option:** `config.ballInHandAnywhere`
- `true` = Can place anywhere on table (casual rules)
- `false` = Behind head string after break scratch (tournament rules)
**Enabled By Default In:** CASUAL (true), TOURNAMENT (false)
**Current Status:** Partially implemented - can place anywhere, no validation
**Impact:** Unfair advantage after scratch on break in tournament mode
**Implementation Location:** `Game.ts` ball dragging logic

### Additional Missing Rules

#### 5. **Jumped Balls**
**Standard Rule:**
- If cue ball jumps off table = foul, ball-in-hand to opponent
- If object ball jumps off table = foul OR removed from play (varies by ruleset)
- If 8-ball jumps off table = loss

**Current Status:** Not implemented (balls don't jump in 2D physics)
**Impact:** Low (physics doesn't support jump shots yet)
**Implementation Location:** `PhysicsWorld` boundary checking

#### 6. **Push-Out Rule**
**Standard Rule:** After the break, player at table can declare a "push-out"
- Can hit any ball or no ball
- Does not have to hit a rail
- Opponent then chooses to shoot or pass back

**Config Option:** `config.enablePushOut`
**Enabled By Default In:** TOURNAMENT only
**Current Status:** Not implemented
**Impact:** Medium (adds strategic depth but not essential)
**Implementation Location:** New state in `GameStateMachine`

#### 7. **Three-Foul Rule**
**Standard Rule:** If a player commits three consecutive fouls, they lose the game

**Config Option:** `config.enableThreeFoulRule`
**Enabled By Default In:** TOURNAMENT only
**Current Status:** Not implemented
**Impact:** Low (rare occurrence)
**Implementation Location:** `EightBallRules` - track consecutive fouls

#### 8. **Shot Clock**
**Standard Rule:** Players have 30-60 seconds to take a shot (varies by competition)

**Config Option:** `config.shotClockSeconds` (0 = disabled)
**Enabled By Default In:** TOURNAMENT (60s), others (0 = off)
**Current Status:** Not implemented
**Impact:** Medium (prevents slow play in online modes)
**Implementation Location:** New `ShotClock` class

#### 8. **Stalemate / Same Position Rule**
**Standard Rule:** If the same position occurs three times (all balls return to same spots), the game is re-racked

**Current Status:** Not implemented
**Impact:** Very low (extremely rare)
**Implementation Location:** `PhysicsWorld` - track ball positions after each shot

#### 9. **Shot Clock**
**Standard Rule:** Players have 30-60 seconds to take a shot (varies by competition)

**Current Status:** Not implemented
**Impact:** Medium (prevents slow play in online modes)
**Implementation Location:** New `ShotClock` class

#### 10. **Intentional Foul Penalties**
**Standard Rule:** Intentionally fouling (e.g., touching balls with hand) = loss of game

**Current Status:** Not implemented
**Impact:** Low (hard to detect in digital game)
**Implementation Location:** N/A (may not be needed)

---

## 🐛 Known Issues

### Issue 1: 8-Ball on Break Scratch Should Be Loss
**Current Behavior:** Pocketing 8-ball on break with scratch = win
**Expected Behavior:** Should be a loss
**Location:** `EightBallRules.handleBreak()` lines 156-164
**Priority:** HIGH

### Issue 2: No Rail Contact Enforcement
**Current Behavior:** Can make "tap shots" with no follow-through
**Expected Behavior:** If no ball pocketed, cue or object ball must hit rail
**Location:** `EightBallRules.endShot()`
**Priority:** HIGH

### Issue 3: Ball-in-Hand Anywhere After Break Scratch
**Current Behavior:** Ball-in-hand anywhere on table
**Expected Behavior:** Ball-in-hand behind head string (kitchen) only
**Location:** `Game.ts` ball placement logic
**Priority:** MEDIUM

### Issue 4: No Break Validation
**Current Behavior:** Any contact on break is legal
**Expected Behavior:** Must drive 4+ balls to rails or pocket a ball
**Location:** `EightBallRules.handleBreak()`
**Priority:** MEDIUM

---

---

## 🔌 Integrating RulesConfig with EightBallRules

**Current State:** `RulesConfig.ts` exists with 4 presets, but `EightBallRules.ts` doesn't use it yet.

**Integration Steps:**

### 1. Add config to EightBallRules
```typescript
// src/rules/EightBall.ts
import { RulesConfig, getDefaultRulesConfig } from './RulesConfig';

export class EightBallRules {
  config: RulesConfig;

  constructor(config?: RulesConfig) {
    this.config = config || getDefaultRulesConfig();
  }
}
```

### 2. Update Game.ts to pass config
```typescript
// src/game/Game.ts
import { RULES_PRESETS } from '../rules/RulesConfig';

class Game {
  currentRuleset: string = 'CASUAL'; // Can be changed via UI

  initializeEightBall() {
    const config = RULES_PRESETS[this.currentRuleset];
    this.rules = new EightBallRules(config);
  }
}
```

### 3. Add UI for changing rulesets
```typescript
// Add keyboard shortcuts or menu
// 'C' = Casual, 'B' = BCA/Tournament, 'A' = APA, etc.
window.addEventListener('keydown', (e) => {
  if (e.key === 'c') {
    this.currentRuleset = 'CASUAL';
    this.restart();
  }
  if (e.key === 'b') {
    this.currentRuleset = 'TOURNAMENT';
    this.restart();
  }
});
```

### 4. Respect config in rules enforcement
```typescript
// src/rules/EightBall.ts
endShot(balls: Ball[]) {
  // ... existing foul checks ...

  // Only check rail contact if configured
  if (this.config.requireRailContact && !ballPocketed) {
    const railContact = this.checkRailContact();
    if (!railContact) {
      foul = true;
      foulMessage = 'Foul! No rail contact.';
    }
  }

  // Only enforce wrong ball first if configured
  if (this.config.wrongBallFirstIsFoul && wrongBallHit) {
    foul = true;
    foulMessage = 'Foul! Wrong group hit first.';
  }
}
```

---

## 📋 Implementation Priority List

Based on gameplay impact and configurability:

### Phase 1: Integrate RulesConfig System (Foundation) - **HIGH PRIORITY**
1. ✅ Create `RulesConfig.ts` with 4 presets
2. ❌ **Update `EightBallRules` constructor to accept config** (1 hour)
3. ❌ **Update `Game.ts` to pass config to rules** (1 hour)
4. ❌ **Add keyboard shortcuts to switch rulesets** (1 hour)
   - `C` = Casual, `B` = BCA/Tournament, `A` = APA
5. ❌ **Show current ruleset in HUD** (1 hour)

**Total:** 4 hours - Enables all future configurable rules

### Phase 2: Implement Configurable Rules (Core Features)
6. ❌ **Fix 8-ball on break scratch bug** (1 hour) - Always enforce
7. ❌ **Rail contact tracking in PhysicsWorld** (3 hours)
   - Track when balls hit rails
   - Expose to rules engine
8. ❌ **Rail contact enforcement** (1 hour)
   - Check `config.requireRailContact` in `endShot()`
9. ❌ **Legal break validation** (3 hours)
   - Count balls hitting rails on break
   - Check `config.requireLegalBreak`
   - Give opponent options (accept/re-rack/you-break)
10. ❌ **Ball-in-hand placement restrictions** (2 hours)
    - Check `config.ballInHandAnywhere`
    - Validate placement behind head string when required

**Total:** 10 hours

### Phase 3: UI-Dependent Rules (Requires User Input)
11. ❌ **Called 8-ball pocket UI** (4 hours)
    - Click pocket or auto-detect aim
    - Store called pocket
    - Check `config.requireCalled8Ball` in win condition
12. ❌ **Called shots UI** (4 hours)
    - Check `config.requireCalledShots`
    - UI for calling ball + pocket on every shot
    - Very rare ruleset, low priority

**Total:** 8 hours

### Phase 4: Advanced Features (Tournament Play)
13. ❌ **Shot clock** (4 hours)
    - New `ShotClock` class
    - Check `config.shotClockSeconds`
    - UI countdown timer
    - Auto-foul on timeout
14. ❌ **Push-out rule** (3 hours)
    - Check `config.enablePushOut`
    - New game state after break
    - UI for declaring push-out
15. ❌ **Three-foul tracking** (2 hours)
    - Check `config.enableThreeFoulRule`
    - Track consecutive fouls per player
    - Auto-loss on third foul

**Total:** 9 hours

### Phase 5: Edge Cases (Very Low Priority)
16. ❌ Stalemate detection (same position 3x)
17. ❌ Jumped ball handling
18. ❌ Intentional foul penalties

---

## 🎯 Recommended Next Steps

For a configurable, fair 8-ball implementation with multiple rulesets:

### Option A: Quick Integration (Get config system working)
**Goal:** Enable ruleset switching (4 hours)

1. **Integrate RulesConfig with EightBallRules** (1 hour)
   - Add `config: RulesConfig` to constructor
   - Use `getDefaultRulesConfig()` if no config provided

2. **Update Game.ts to support rulesets** (1 hour)
   - Add `currentRuleset: string` property
   - Pass config to `EightBallRules` constructor
   - Add keyboard shortcuts (C/B/A) to switch rulesets

3. **Show ruleset in HUD** (1 hour)
   - Display "Ruleset: CASUAL" or "Ruleset: TOURNAMENT" in HUD

4. **Test ruleset switching** (1 hour)
   - Verify each preset loads correctly
   - Currently only core rules work (groups, fouls, win/loss)
   - Configurable rules (rail contact, etc.) not yet implemented

**Result:** Foundation in place for all future configurable rules

### Option B: Full Implementation (Complete core configurable rules)
**Goal:** Implement the most important configurable rules (14 hours)

Do Option A (4 hours), then:

5. **Fix 8-ball on break scratch bug** (1 hour)
   - Always enforce, regardless of config

6. **Track rail collisions in PhysicsWorld** (3 hours)
   - Add `lastRailHit` tracking to Ball class
   - Detect cushion collisions in physics loop
   - Expose to rules engine

7. **Enforce rail contact rule** (1 hour)
   - Check `config.requireRailContact` in `endShot()`
   - Only applies if no ball pocketed

8. **Legal break validation** (3 hours)
   - Count balls hitting rails during break
   - Check `config.requireLegalBreak`
   - Add re-break options

9. **Ball-in-hand placement** (2 hours)
   - Check `config.ballInHandAnywhere`
   - Restrict to kitchen when required

**Total:** 14 hours for core configurable rules system

### Recommended: **Option A** first
Get the config system integrated, then add individual rules as needed. This allows you to:
- Switch between CASUAL (current behavior) and TOURNAMENT (stricter) modes
- Test with different rulesets
- Add new rules incrementally without breaking existing code

---

## 📚 Reference

**Standard Rules Sources:**
- World Pool-Billiard Association (WPA) Official Rules
- Billiard Congress of America (BCA) Rulebook
- American Poolplayers Association (APA) Rules

**Key Differences by Ruleset:**
- **BCA/WPA:** Called pocket required for 8-ball only
- **APA:** More casual rules, slop counts (don't have to call shots)
- **Bar Rules:** Varies widely, often simplified

**Current Implementation:** Closest to BCA/WPA rules, but incomplete

---

## 🔧 Code Locations

**Main Rules Engine:**
- `src/rules/EightBall.ts` - Core 8-ball logic
  - `startShot()` - Initialize shot tracking
  - `endShot()` - Evaluate shot results and fouls
  - `handleBreak()` - Break shot handling
  - `handle8BallPocketed()` - Win/loss on 8-ball
  - `assignGroups()` - Assign solids/stripes

**Game State:**
- `src/game/Game.ts` - Main game loop
  - `handleShotComplete()` - Process shot results
  - `handleBallInHand()` - Ball placement
  - Ball dragging event handlers

**Physics:**
- `src/physics/Physics.ts` - Ball collisions and movement
  - Need to track rail collisions here
  - Need to track balls hitting cushions on break

**Player Management:**
- `src/game/Player.ts` - Player data and group assignment

---

Last Updated: 2025-11-09
Status: Active Development




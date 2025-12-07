# Trophy, Chest & Club System - Fix Plan

## Executive Summary

The progression systems are scattered and disconnected. Trophies are never awarded, clubs require trophies but players can't earn them, and "Leagues" vs "Clubs" serve overlapping purposes with no clear integration.

---

## Current State Analysis

### 🏆 Trophy System — BROKEN

| Component | Status | Issue |
|-----------|--------|-------|
| `UserProfile.trophies` | ✅ Exists | Stored in DB, displayed in NavBar |
| `CurrencyStore.addTrophies()` | ✅ Exists | **Never called anywhere** |
| Trophy earning logic | ❌ Missing | No mechanism to earn trophies |
| Trophy display | ✅ Works | Shows in NavigationBar currency row |

**Root Problem:** Trophies are gated content (clubs require `minTrophies`) but there's no way to earn them.

### 📦 Chest System — MOSTLY WORKING

| Component | Status | Issue |
|-----------|--------|-------|
| `ChestSystem.ts` | ✅ Complete | Well-designed with slots, timers, rewards |
| `ChestSlotsBar.ts` | ✅ Works | UI for 4 chest slots |
| `awardChestForWin()` | ⚠️ Called | In `Game.ts` line 995, but only on win |
| Type definitions | ⚠️ Duplicated | `ChestDef` in `models.ts` ≠ `ChestDefinition` in `ChestSystem.ts` |
| Chest opening | ✅ Works | Generates rewards (coins, gold) |

**Issues:**
1. Duplicate type definitions create confusion
2. Items from chests are placeholders (`'random_item_placeholder'`)
3. No chest opening animation/celebration

### 🏛️ Club System — CONCEPTUALLY CONFUSED

| Component | Status | Issue |
|-----------|--------|-------|
| `ClubRegistry.ts` | ✅ Exists | 12 clubs with `minTrophies` requirements |
| `ClubSelectionScene.ts` | ✅ Works | Shows cards, checks trophies |
| Club unlock logic | ❌ Broken | Trophies never earned = clubs stay locked |
| Club vs League | ⚠️ Confused | Overlapping concepts, different gating |

### 🎖️ League System — PARALLEL SYSTEM

| Component | Status | Issue |
|-----------|--------|-------|
| `LeagueSystem.ts` | ✅ Exists | 30 leagues (Bronze→Crystal) with `minLevel` |
| `LeagueScene.ts` | ✅ Works | Shows standings, season timer |
| Chest tie-in | ✅ Works | `getChestForLeague()` awards based on tier |
| Progression | ❌ Missing | No promotion/relegation logic |

---

## Core Problem: What Are "Clubs" vs "Leagues"?

Currently they're two parallel systems:

| Aspect | Clubs | Leagues |
|--------|-------|---------|
| File | `ClubRegistry.ts` | `LeagueSystem.ts` |
| Count | 12 | 30 |
| Gating | `minTrophies` | `minLevel` |
| Purpose | Play venue selection | Ranking/standings |
| UI | ClubSelectionScene | LeagueScene |

**This creates confusion.** In Miniclip 8 Ball Pool:
- **Clubs = Rooms/Venues** where you play (like "London", "Tokyo", "Vegas")
- **Leagues = Ranking tiers** based on trophies earned

**Recommended Model:**
- **Clubs** = The venue you select to play a match (entry fee determines stakes)
- **Trophies** = Earned/lost from wins/losses in clubs
- **Leagues** = Auto-assigned ranking tier based on total trophies

---

## Fix Plan

### Phase 1: Trophy System Implementation

#### 1.1 Create `TrophySystem.ts`

```
Location: src/game/progression/TrophySystem.ts

Purpose: 
- Define trophy rewards per club tier
- Calculate trophy gain/loss based on match result
- Handle league tier changes based on trophy count
```

**Trophy Formula (Miniclip-style):**
```typescript
// Win: Gain trophies based on club tier
// Loss: Lose trophies (capped so you don't go negative)

getTrophyChange(clubId: string, isWin: boolean): number {
  const club = getClubById(clubId);
  if (!club) return 0;
  
  const baseTrophy = club.difficulty * 5; // 5-50 trophies
  
  if (isWin) {
    return baseTrophy;
  } else {
    // Lose half of what you'd win, minimum 0 total
    return -Math.floor(baseTrophy * 0.5);
  }
}
```

#### 1.2 Integrate Trophy Awarding in `Game.ts`

**Location:** `onGameOver` handler (~line 978)

```typescript
// After updating user stats
if (isWin) {
  const trophyGain = TrophySystem.getTrophyChange(this.currentClubId, true);
  currencyStore.addTrophies(trophyGain);
} else {
  const trophyLoss = TrophySystem.getTrophyChange(this.currentClubId, false);
  // Only lose trophies if player has enough
  const currentTrophies = currencyStore.getBalances().trophies;
  const actualLoss = Math.min(-trophyLoss, currentTrophies);
  currencyStore.addTrophies(-actualLoss);
}
```

#### 1.3 Track Club ID in Match Flow

**Problem:** `Game.ts` uses hardcoded `leagueId: 'bronze_1'` instead of tracking which club was selected.

**Fix:**
1. Add `currentClubId: string` to Game class
2. Set it in `startMatch(clubId)` 
3. Use it for trophy calculations and chest rewards

---

### Phase 2: Unify Leagues as Trophy Tiers

#### 2.1 Simplify League Model

**Current:** 30 leagues with `minLevel` gating
**Proposed:** Leagues become trophy-based tiers (auto-assigned)

```typescript
// New league tiers based on trophy count
const LEAGUE_TIERS = [
  { id: 'bronze',   name: 'Bronze',   minTrophies: 0,    icon: '🏆' },
  { id: 'silver',   name: 'Silver',   minTrophies: 100,  icon: '🥈' },
  { id: 'gold',     name: 'Gold',     minTrophies: 300,  icon: '🥇' },
  { id: 'platinum', name: 'Platinum', minTrophies: 600,  icon: '💠' },
  { id: 'diamond',  name: 'Diamond',  minTrophies: 1000, icon: '💎' },
  { id: 'master',   name: 'Master',   minTrophies: 2000, icon: '👑' },
  { id: 'legend',   name: 'Legend',   minTrophies: 5000, icon: '🔥' },
];

function getLeagueForTrophies(trophies: number): LeagueTier {
  for (let i = LEAGUE_TIERS.length - 1; i >= 0; i--) {
    if (trophies >= LEAGUE_TIERS[i].minTrophies) {
      return LEAGUE_TIERS[i];
    }
  }
  return LEAGUE_TIERS[0];
}
```

#### 2.2 Update User's League Automatically

After every trophy change:
```typescript
const newLeague = getLeagueForTrophies(currentTrophies);
if (newLeague.id !== user.leagueId) {
  await db.user.where('id').equals(1).modify({ leagueId: newLeague.id });
  // Trigger promotion/demotion animation
}
```

---

### Phase 3: Clean Up Type Definitions

#### 3.1 Remove Duplicate ChestDef

**File:** `src/data/models.ts`

Delete lines 111-117 (the unused `ChestDef` interface):
```typescript
// DELETE THIS
export interface ChestDef {
    id: string;
    type: 'bronze' | 'gold' | 'platinum' | 'diamond';
    minCoins: number;
    maxCoins: number;
    unlockTimeMs: number;
}
```

Use `ChestDefinition` from `ChestSystem.ts` everywhere.

#### 3.2 Consolidate ClubDef

Keep `ClubDef` in `models.ts` but ensure it's the single source of truth.

---

### Phase 4: Connect Entry Fee Flow

#### 4.1 Current Problem

Entry fees are displayed but never deducted.

#### 4.2 Fix in ClubSelectionScene

```typescript
// In handleClubSelect()
const canAfford = currencyStore.getBalances().coins >= club.entryFee;
if (!canAfford) {
  notificationService.show('Not enough coins!', 'error');
  return;
}

// Deduct before starting match
currencyStore.spendCoins(club.entryFee);
```

#### 4.3 Award Prize on Win

```typescript
// In Game.ts onGameOver
if (isWin) {
  const prize = club.entryFee * 2; // Winner takes all
  currencyStore.addCoins(prize);
}
// On loss, entry fee is already deducted, nothing returned
```

---

### Phase 5: Polish Chest System

#### 5.1 Add Real Item Rewards

Replace `'random_item_placeholder'` with actual cue/avatar unlocks.

#### 5.2 Chest Opening Animation

Add a modal/scene for opening chests with:
- Chest shake animation
- Lid open reveal
- Reward particles/confetti
- Itemized reward list

---

## Implementation Order

| Order | Task | Effort | Impact |
|-------|------|--------|--------|
| 1 | **Create TrophySystem.ts** | Medium | Critical |
| 2 | **Integrate trophy awarding in Game.ts** | Small | Critical |
| 3 | **Track clubId through match flow** | Small | Required |
| 4 | **Simplify leagues to trophy tiers** | Medium | High |
| 5 | **Implement entry fee deduction** | Small | High |
| 6 | **Remove duplicate ChestDef** | Tiny | Cleanup |
| 7 | **Add chest opening animation** | Medium | Polish |
| 8 | **Real item rewards from chests** | Medium | Feature |

---

## Files to Modify/Create

| File | Action |
|------|--------|
| `src/game/progression/TrophySystem.ts` | **CREATE** |
| `src/game/Game.ts` | Modify - add trophy logic, track clubId |
| `src/game/leagues/LeagueSystem.ts` | Refactor - trophy-based tiers |
| `src/ui/scenes/ClubSelectionScene.ts` | Modify - entry fee deduction |
| `src/data/models.ts` | Modify - remove ChestDef |
| `src/ui/CurrencyStore.ts` | Already has addTrophies (no change) |
| `src/ui/scenes/ChestOpenScene.ts` | **CREATE** (optional polish) |

---

## Visual Flow After Fix

```
                    ┌─────────────────────────────────────┐
                    │         CLUB SELECTION              │
                    │  (Gated by minTrophies + entryFee)  │
                    └──────────────┬──────────────────────┘
                                   │
                                   ▼
                    ┌─────────────────────────────────────┐
                    │           PLAY MATCH                │
                    │     Entry fee DEDUCTED on start     │
                    └──────────────┬──────────────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    ▼                             ▼
          ┌─────────────────┐           ┌─────────────────┐
          │      WIN        │           │      LOSE       │
          │ +Trophies       │           │ -Trophies (cap) │
          │ +Prize (2x fee) │           │ +0 coins        │
          │ +Chest slot     │           │ No chest        │
          └────────┬────────┘           └────────┬────────┘
                   │                             │
                   └──────────────┬──────────────┘
                                  ▼
                    ┌─────────────────────────────────────┐
                    │        MATCH RESULT SCREEN          │
                    │  Trophies +/-, coins, chest shown   │
                    └──────────────┬──────────────────────┘
                                   │
                                   ▼
                    ┌─────────────────────────────────────┐
                    │   AUTO-LEAGUE UPDATE (if changed)   │
                    │   Bronze → Silver → Gold → ...      │
                    └─────────────────────────────────────┘
```

---

## Summary

The core fix is simple: **trophies need to be earned on match completion**. Everything else (clubs, leagues, chests) is already built—they just need to be connected properly.

Priority actions:
1. Create TrophySystem with gain/loss formulas
2. Call `currencyStore.addTrophies()` in `Game.ts` `onGameOver`
3. Track the selected club through the match flow
4. Implement entry fee deduction
5. Clean up duplicate type definitions

---

## ✅ Implementation Complete (2024-11-27)

All core fixes have been implemented:

### Files Created
- `src/game/economy/TrophySystem.ts` - Trophy gain/loss formulas, league tiers

### Files Modified
- `src/game/Game.ts` - Trophy awarding, club tracking, entry fee handling
- `src/game/leagues/LeagueSystem.ts` - Re-exports from TrophySystem
- `src/ui/scenes/ClubSelectionScene.ts` - Entry fee deduction
- `src/data/models.ts` - Removed duplicate ChestDef

### Files Removed
- `src/game/rewards/ChestRegistry.ts` - Unused duplicate

### How It Works Now

1. **Select Club** → Entry fee deducted from coins
2. **Win Match** → 
   - Earn trophies (5-50 based on club difficulty)
   - Win 2x entry fee as prize
   - Chest awarded to slot
   - League updated based on new trophy count
3. **Lose Match** → 
   - Lose trophies (~40% of win amount, capped at 0)
   - Entry fee already lost
   - No chest

### Trophy Formula
- Win: `club.difficulty * 5` trophies (5-50)
- Loss: `-club.difficulty * 2` trophies (capped at current total)

### League Tiers (Auto-assigned by trophy count)
| Tier | Min Trophies |
|------|-------------|
| Bronze | 0 |
| Silver | 100 |
| Gold | 300 |
| Platinum | 600 |
| Diamond | 1000 |
| Master | 2000 |
| Elite | 5000 |
| Legend | 10000 |

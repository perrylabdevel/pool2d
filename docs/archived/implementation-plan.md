      # RailRush - Implementation Plan

## Executive Summary

This document outlines the incomplete features and missing components needed to create a full Miniclip 8 Ball Pool-style experience. The goal is to have persistent player progression, meaningful AI opponents, proper league standings, and all UI elements fully functional.

---

## 1. PLAYER STATS SYSTEM

### Current State

- ✅ `UserProfile` model exists with basic stats
- ✅ `UserStats` interface tracks: gamesPlayed, wins, losses, winStreak, ballsPotted, tournamentsWon, totalEarnings
- ✅ ProfileScene displays stats
- ⚠️ Stats are only partially updated during gameplay
- ❌ `ballsPotted` never incremented
- ❌ `winStreak` logic incomplete (not reset on loss properly)
- ❌ XP/Level system not implemented
- ❌ Per-match stats not shown in post-game

### Implementation Tasks

#### 1.1 Complete Stats Tracking (`Game.ts`)

```
- Track balls potted per shot and increment user.stats.ballsPotted
- Properly track win streaks (increment on win, reset on loss)
- Calculate XP earned per match based on performance
- Update user level based on XP thresholds
```

#### 1.2 Post-Game Stats Screen

```
- New scene: MatchResultScene
- Shows: Win/Loss, Coins earned, Chest earned, XP gained
- Shows: Balls potted, Fouls, Best streak
- Compare stats with opponent
- "Play Again" and "Back to Lobby" buttons
```

#### 1.3 XP & Leveling System

```
- Add XP thresholds for levels (e.g., Level 1: 0, Level 2: 100, Level 3: 250...)
- XP earned: Base (win/loss) + Balls potted bonus + Streak bonus
- Level up rewards: Coins, Gold, Unlock items
- Show level progress bar in ProfileScene and NavigationBar
```

---

## 2. AI OPPONENT SYSTEM

### Current State

- ✅ 20 unique AI opponents defined in `OpponentRegistry.ts`
- ✅ AI uses stats for accuracy, consistency, aggression, speed, spinPreference, errorRate
- ✅ `PoolAI.ts` is fully functional with data-driven behavior
- ✅ All 20 avatar images exist (High quality assets integrated)
- ❌ No opponent selection before match
- ❌ No opponent stats display
- ❌ No match history vs specific opponents

### Implementation Tasks

#### 2.1 Missing Avatar Images (15 needed)

```
Required avatars for OpponentRegistry:
- avatar_ned.png (Nervous Ned - Bronze)
- avatar_carl.png (Casual Carl - Bronze)
- avatar_sam.png (Slow Sam - Bronze)
- avatar_lucy.png (Lucky Lucy - Bronze)
- avatar_steve.png (Steady Steve - Silver)
- avatar_betty.png (Bank Shot Betty - Silver)
- avatar_andy.png (Angle Andy - Silver)
- avatar_chris.png (Combo Chris - Silver)
- avatar_dan.png (Defensive Dan - Silver)
- avatar_sid.png (Spin Doctor Sid - Gold)
- avatar_pete.png (Power Pete - Gold)
- avatar_fiona.png (Finesse Fiona - Gold)
- avatar_tim.png (Trickshot Tim - Platinum)
- avatar_paul.png (Precision Paul - Platinum)
- avatar_vicky.png (Viper Vicky - Platinum)
- avatar_mike.png (Master Mike - Diamond)
- avatar_larry.png (Legend Larry - Diamond)

Style: Stylized portraits, consistent art style with existing avatars
```

#### 2.2 Pre-Match Opponent Preview

```
- Shown after clicking "Play Ranked"
- Display: Avatar, Name, League, Bio
- Show opponent stats as bars (Accuracy, Power, Defense)
- "Play" button to start match
- Auto-selects opponent based on player's current league
```

#### 2.3 Opponent Stats Display In-Game

```
- Show opponent avatar in HUD during match
- Display opponent name below avatar
- Optional: Show AI "thinking" indicator during shot calculation
```

#### 2.4 Match History Enhancement

```
- Store opponent ID in MatchRecord (already done)
- Add "Rivals" section to ProfileScene
- Show win/loss record against each opponent played
- Highlight nemesis (most losses) and easy wins (most wins)
```

---

## 3. LEAGUE STANDINGS SYSTEM

### Current State

- ✅ 15 leagues defined (Bronze I-III, Silver I-III, etc.) + Master/Elite/Emerald/Crystal
- ✅ LeagueScene exists with premium visual styling
- ✅ Entry fees and prize pools defined
- ✅ Dynamic headers and sticky section headers implemented
- ✅ Mock standings data with user highlighting
- ❌ Standings are mock data, not persisted in DB
- ❌ No weekly reset mechanism
- ❌ No league progression (promotion/relegation) logic
- ❌ No leaderboard persistence

### Implementation Tasks

#### 3.1 Dynamic Standings Data Model

```typescript
// Add to models.ts
interface LeagueStanding {
  id?: number;
  leagueId: string;
  playerId: string; // 'user' or AI opponent ID
  playerName: string;
  avatarId: string;
  score: number; // Total earnings this period
  gamesPlayed: number;
  wins: number;
  isUser: boolean;
}
```

#### 3.2 League Standings Logic

```
- Populate standings with user + AI opponents in same league
- Update standings when matches complete
- AI opponents earn simulated points over time
- Top 3 get promoted, bottom 3 get relegated (weekly)
```

#### 3.3 League Rewards

```
- End of week: Award prizes based on rank
- 1st place: 100% of prize pool
- 2nd place: 60% of prize pool
- 3rd place: 40% of prize pool
- Promotion bonus: Extra coins + Rare chest
```

#### 3.4 League Season Timer

```
- Display "Ends in: Xd Xh" (currently hardcoded)
- Weekly reset on Sunday midnight
- Store season end timestamp
- Notification when season ends
```

---

## 4. MISSING ICONS & ASSETS

### Current State

- ✅ League frame sprites (bronze, silver, gold, platinum, diamond, plus master/elite/emerald variants) exist in `src/assets/img/avatar-frames-Recovered.png`
- ⚠️ Need to slice/export individual frame PNGs for use in-game
- ⚠️ Existing `frame_bronze/silver/gold.png` in `src/assets/img/frames/` are placeholders that should be replaced
- ✅ 3 chest images (common, rare, epic)
- ❌ Missing legendary chest image
- ⚠️ Using emoji fallbacks for league icons (🏆, 🥈, 🥇, 💠, 💎)

### Implementation Tasks

#### 4.1 League Frame Images

```
Required (rounded-rectangle frames only; no inner circles):
- frame_bronze.png
- frame_silver.png
- frame_gold.png
- frame_platinum.png
- frame_diamond.png
- frame_master.png
- frame_elite.png
- frame_emerald.png
- frame_crystal.png (extra unlabeled blue variant from the sheet)

Notes:
- Frames are applied to HUD player/opponent and navigation profile without additional CSS borders.

Replace placeholder bronze/silver/gold assets with new exports sliced from `avatar-frames-Recovered.png`.

Update AssetRegistry.ts:
frames: {
    bronze: () => new URL('./img/frames/frame_bronze.png', ...),
    silver: () => new URL('./img/frames/frame_silver.png', ...),
    gold: () => new URL('./img/frames/frame_gold.png', ...),
    platinum: () => new URL('./img/frames/frame_platinum.png', ...),
    diamond: () => new URL('./img/frames/frame_diamond.png', ...),
    master: () => new URL('./img/frames/frame_master.png', ...),
    elite: () => new URL('./img/frames/frame_elite.png', ...),
    emerald: () => new URL('./img/frames/frame_emerald.png', ...),
}
```

#### 4.2 Legendary Chest Image

```
Required:
- chest_legendary.png (golden/ornate style)

Update AssetRegistry.ts:
economy: {
    chestLegendary: () => new URL('./img/economy/chest_legendary.png', ...),
}
```

#### 4.3 Currency Icons

```
Consider adding:
- coin_icon.png (for currency displays)
- gold_icon.png (for premium currency)
```

---

## 5. CURRENCY & ECONOMY SYNC

### Current State

- ✅ CurrencyStore exists (in-memory)
- ✅ Database has coins/gold in UserProfile
- ❌ CurrencyStore doesn't sync with database
- ❌ Entry fee deduction not implemented
- ❌ Prize pool winnings not fully implemented

### Implementation Tasks

#### 5.1 Sync CurrencyStore with Database

```typescript
// On app load:
const user = await db.user.get(1);
currencyStore.setBalances({ coins: user.coins, gold: user.gold });

// On currency change:
currencyStore.subscribe(async (balances) => {
  await db.user.where('id').equals(1).modify({
    coins: balances.coins,
    gold: balances.gold,
  });
});
```

#### 5.2 Match Entry Fee Flow

```
1. Before match: Check if user can afford entry fee
2. Deduct entry fee when match starts
3. On win: Add prize pool to winnings
4. On loss: Entry fee already deducted
```

---

## 6. GAME MODE COMPLETION

### Current State

- ✅ Practice mode works
- ✅ 8-Ball vs AI works
- ✅ Time Attack mode exists
- ✅ Speed Pool mode exists
- ⚠️ Perfect Game mode partially implemented
- ❌ Online multiplayer not implemented (future)

### Implementation Tasks

#### 6.1 Polish Arcade Modes

```
- Add high score persistence for each mode
- Add leaderboards for arcade modes
- Add rewards for beating personal bests
```

#### 6.2 Tournament Mode (Future)

```
- Bracket-style knockout tournament
- 8 or 16 player brackets
- Mix of AI opponents
- Increasing entry fees and prizes
```

---

## 7. INVENTORY SYSTEM

### Current State

- ✅ InventoryItem model exists
- ✅ Shop shows cues and chips
- ❌ Purchased items not saved to inventory
- ❌ No "owned" indicators in shop
- ❌ Inventory view not implemented

### Implementation Tasks

#### 7.1 Complete Inventory Flow

```
1. When equipping cue/chip, save to inventory if not owned
2. Mark owned items in shop
3. Add "Inventory" tab or button in shop/profile
4. Show all owned items with equip option
```

---

## 8. EVENTS SYSTEM

### Current State

- ✅ Golden Spin event works
- ⚠️ Bullseye marked "Coming Soon"
- ⚠️ Win Streak marked "Coming Soon"

### Implementation Tasks

#### 8.1 Bullseye Event

```
- Aim-based challenge: Hit targets on table
- Increasing difficulty levels
- Time limit per shot
- Rewards based on score
```

#### 8.2 Win Streak Event

```
- Track consecutive wins
- Multiplying rewards for each win
- Lose streak on loss
- Daily/weekly reset
```

---

## 9. ONLINE MULTIPLAYER (Future Phase)

### Preparation Tasks

```
- Abstract Player to support remote players
- Add WebSocket connection layer
- Add matchmaking queue UI
- Add friend list and invites
- Add chat system
- Add report/block functionality
```

---

## IMPLEMENTATION PRIORITY

### Phase 1: Core Polish (1-2 weeks)

1. ✅ Complete stats tracking in Game.ts

#### 4.2 Legendary Chest Image

```
Required:
- chest_legendary.png (golden/ornate style)

Update AssetRegistry.ts:
economy: {
    chestLegendary: () => new URL('./img/economy/chest_legendary.png', ...),
}
```

#### 4.3 Currency Icons

```
Consider adding:
- coin_icon.png (for currency displays)
- gold_icon.png (for premium currency)
```

---

## 5. CURRENCY & ECONOMY SYNC

### Current State

- ✅ CurrencyStore exists (in-memory)
- ✅ Database has coins/gold in UserProfile
- ❌ CurrencyStore doesn't sync with database
- ❌ Entry fee deduction not implemented
- ❌ Prize pool winnings not fully implemented

### Implementation Tasks

#### 5.1 Sync CurrencyStore with Database

```typescript
// On app load:
const user = await db.user.get(1);
currencyStore.setBalances({ coins: user.coins, gold: user.gold });

// On currency change:
currencyStore.subscribe(async (balances) => {
  await db.user.where('id').equals(1).modify({
    coins: balances.coins,
    gold: balances.gold,
  });
});
```

#### 5.2 Match Entry Fee Flow

```
1. Before match: Check if user can afford entry fee
2. Deduct entry fee when match starts
3. On win: Add prize pool to winnings
4. On loss: Entry fee already deducted
```

---

## 6. GAME MODE COMPLETION

### Current State

- ✅ Practice mode works
- ✅ 8-Ball vs AI works
- ✅ Time Attack mode exists
- ✅ Speed Pool mode exists
- ⚠️ Perfect Game mode partially implemented
- ❌ Online multiplayer not implemented (future)

### Implementation Tasks

#### 6.1 Polish Arcade Modes

```
- Add high score persistence for each mode
- Add leaderboards for arcade modes
- Add rewards for beating personal bests
```

#### 6.2 Tournament Mode (Future)

```
- Bracket-style knockout tournament
- 8 or 16 player brackets
- Mix of AI opponents
- Increasing entry fees and prizes
```

---

## 7. INVENTORY SYSTEM

### Current State

- ✅ InventoryItem model exists
- ✅ Shop shows cues and chips
- ❌ Purchased items not saved to inventory
- ❌ No "owned" indicators in shop
- ❌ Inventory view not implemented

### Implementation Tasks

#### 7.1 Complete Inventory Flow

```
1. When equipping cue/chip, save to inventory if not owned
2. Mark owned items in shop
3. Add "Inventory" tab or button in shop/profile
4. Show all owned items with equip option
```

---

## 8. EVENTS SYSTEM

### Current State

- ✅ Golden Spin event works
- ⚠️ Bullseye marked "Coming Soon"
- ⚠️ Win Streak marked "Coming Soon"

### Implementation Tasks

#### 8.1 Bullseye Event

```
- Aim-based challenge: Hit targets on table
- Increasing difficulty levels
- Time limit per shot
- Rewards based on score
```

#### 8.2 Win Streak Event

```
- Track consecutive wins
- Multiplying rewards for each win
- Lose streak on loss
- Daily/weekly reset
```

---

## 9. ONLINE MULTIPLAYER (Future Phase)

### Preparation Tasks

```
- Abstract Player to support remote players
- Add WebSocket connection layer
- Add matchmaking queue UI
- Add friend list and invites
- Add chat system
- Add report/block functionality
```

---

## IMPLEMENTATION PRIORITY

### Phase 1: Core Polish (1-2 weeks)

1. ✅ Complete stats tracking in Game.ts
2. ✅ Sync CurrencyStore with database
3. ✅ Add Match Result screen
4. ✅ Generate missing AI avatar images
5. ✅ Add pre-match opponent preview
6. ✅ Player 1 setup as 'sosumidude' with custom avatar

### Phase 2: Progression (1-2 weeks)

1. XP & Leveling system
2. ✅ Dynamic league standings (UI Complete, Logic Pending)
3. ✅ League season timer (UI Complete)
4. Promotion/relegation logic
5. Missing frame/chest assets

### Phase 3: Features (1-2 weeks)

1. Complete inventory system
2. Bullseye event
3. Win Streak event
4. Match history improvements

### Phase 4: Online (Future)

1. WebSocket infrastructure
2. Matchmaking
3. Friend system

---

## FILE CHANGES SUMMARY

| File                                    | Changes Needed                           |
| --------------------------------------- | ---------------------------------------- |
| `src/game/Game.ts`                      | Track ballsPotted, winStreak, entry fees |
| `src/data/db.ts`                        | Add LeagueStanding table, sync currency  |
| `src/data/models.ts`                    | Add LeagueStanding interface             |
| `src/ui/CurrencyStore.ts`               | Sync with database                       |
| `src/ui/scenes/MatchResultScene.ts`     | NEW - Post-game screen                   |
| `src/ui/scenes/OpponentPreviewScene.ts` | NEW - Pre-match preview                  |
| `src/ui/scenes/LeagueScene.ts`          | ✅ Dynamic standings, timer, sticky headers |
| `src/ui/scenes/ProfileScene.ts`         | XP bar, level display, rivals            |
| `src/assets/AssetRegistry.ts`           | Add missing asset refs                   |
| `src/assets/img/avatars/`               | Add 15 missing avatars                   |
| `src/assets/img/frames/`                | Add platinum, diamond frames             |
| `src/assets/img/economy/`               | Add legendary chest                      |

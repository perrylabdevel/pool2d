# Currency + League Systems Audit

## Scope
- Code paths reviewed: `src/ui/CurrencyStore.ts`, `src/data/db.ts`, `src/game/controllers/MatchManager.ts`, `src/game/Game.ts`, `src/game/economy/TrophySystem.ts`, `src/game/leagues/LeagueSystem.ts`, `src/game/leagues/LeagueService.ts`, `src/game/economy/ChestSystem.ts`, `src/ui/scenes/LeagueScene.ts`, `src/ui/scenes/ClubSelectionScene.ts`, `src/ui/components/ChestSlotsBar.ts`, `src/ui/components/NavigationBar.ts`.

## System Map (Current Behavior)
- **Currencies**: coins, gold, trophies stored in `UserProfile` (`src/data/models.ts`) and mirrored in `currencyStore` (`src/ui/CurrencyStore.ts`).
- **Coins**: entry fee deducted on club selection (`src/ui/scenes/ClubSelectionScene.ts`), winnings credited on match end (`src/game/controllers/MatchManager.ts` and duplicate logic in `src/game/Game.ts`).
- **Gold**: only earned via chests (`src/ui/components/ChestSlotsBar.ts`); spend path for skipping unlocks is not implemented.
- **Trophies**: awarded on match end using `TrophySystem` (`src/game/economy/TrophySystem.ts`); used for club gating and league tier assignment.
- **Leagues**:
  - `TrophySystem` defines **tier ids** (bronze/silver/etc.) and assigns `user.leagueId` based on trophies.
  - `LeagueSystem` defines **30 legacy leagues** (`bronze_1`...`crystal_3`) for standings, entryFee/prizePool, and promotion/relegation.
  - `LeagueService` manages standings + seasons, keyed by `leagueId`.

## Findings (Gaps, Mismatches, Risks)
### 1) League ID mismatch breaks standings and season logic
- `TrophySystem` returns `leagueId` like `"bronze"`, while `LeagueSystem`/`LeagueService` expect `"bronze_1"` (`src/game/economy/TrophySystem.ts`, `src/game/leagues/LeagueSystem.ts`, `src/game/leagues/LeagueService.ts`).
- Consequences:
  - `LeagueService.checkSeasonEnd()` exits early because `getLeagueById(user.leagueId)` returns `undefined` (no promotions/rewards).
  - Standings seeded under the wrong key (`"bronze"`) and can’t reference `LeagueDef` data (prize pools, tiers).
  - `LeagueScene` displays mixed data: sections are tier-based but prize pools use `getLeagueById(section.id + '_1')`, which will never match when user league is just `"bronze"`.

### 2) Parallel league models create conflicting tiers and visuals
- `TrophySystem` tiers: 8 tiers (`bronze` → `legend`).
- `LeagueSystem` tiers: 10 tiers x 3 divisions (`bronze_1` → `crystal_3`).
- UI frame selection doesn’t recognize `legend` (`src/ui/components/NavigationBar.ts`, `src/ui/scenes/ProfileScene.ts`), so `legend` users fall back to bronze frames.

### 3) Standings do not reflect actual matches
- `LeagueService.updateUserScore()` is never called anywhere (`src/game/leagues/LeagueService.ts`).
- `LeagueService.simulateAIProgress()` adds random scores, but match results never influence standings.
- Net effect: league table is cosmetic and disconnected from gameplay results.

### 4) Currency sources of truth are split and occasionally unsynchronized
- `currencyStore` syncs to DB on every update but does **not** observe DB changes after initialization (`src/ui/CurrencyStore.ts`).
- Some systems update DB directly (e.g., `LeagueService.checkSeasonEnd()` coin rewards) without updating `currencyStore`, so UI can show stale balances.
- `ClubSelectionScene` uses a cached `userProfile` from DB and doesn’t re-read or subscribe to `currencyStore`, so lock states can be stale until scene reload.

### 5) Duplicate match-end logic increases drift risk
- Match end currency + trophy logic exists in both `src/game/controllers/MatchManager.ts` and `src/game/Game.ts`.
- Any future changes can easily diverge, and only one code path may be active depending on which method is used.

### 6) Gold is earned but not spendable (economy dead-end)
- Skip-unlock is hinted in UI but never actually spends gold (`src/ui/components/ChestSlotsBar.ts`).
- Gold has no sink, undermining currency balance and progression.

### 7) Automatic negative-balance reset can mask economy bugs
- `CurrencyStore.initialize()` silently sets negative coins to 10,000 (`src/ui/CurrencyStore.ts`).
- This hides underlying logic errors and can be exploited by intentionally going negative.

## Opportunities for Improvement (Proposed Direction)
### A) Unify league identity
- Choose **one canonical league id** format and make all systems use it:
  - Option 1: **Tier-only ids** (`bronze`, `silver`, ...). Adapt `LeagueSystem` + `LeagueService` to store by tier and rework prize pools/fees.
  - Option 2: **Division ids** (`bronze_1`, ...). Update `TrophySystem` to map trophies → division ids and provide helper `getTierFromLeagueId()`.
- Add a single conversion helper in a shared module (e.g., `LeagueIdentity.ts`) and use it everywhere.

### B) Collapse to one league model
- Decide whether leagues are **trophy tiers** or **season standings divisions**.
- If standings are the real progression, use standings to drive tier changes and keep trophies as a currency or reward.
- If trophies are the real progression, drop division-level standings or derive them from trophies.

### C) Connect matches → standings
- Call `LeagueService.updateUserScore()` on match end and score based on entry fee or trophy change.
- Make AI progress deterministic or time-based instead of pure random to avoid wild score swings.

### D) Make currency store authoritative
- Pick a single source of truth (DB or `currencyStore`) and route all writes through it.
- If DB is authoritative, add a `currencyStore.refresh()` on important DB writes (season rewards, admin grants).

### E) Remove duplicate match-end code paths
- Route all match-end handling through `MatchManager.processMatchEnd()` and have `Game.ts` call it.
- Delete or clearly deprecate the duplicate block in `Game.ts` to prevent drift.

### F) Close the gold loop
- Implement skip-unlock spending and confirm dialogs for gold usage in `ChestSlotsBar`.
- Add other gold sinks (cosmetics, limited-time offers) if intended.

### G) Replace negative-balance auto-fix with guardrails
- Clamp balances at 0 on spend and log errors instead of crediting 10k.
- If recovery is required, move it into a dev-only debug flag or migration step.

## Quick Wins (Low Effort, High Impact)
- Fix league id mismatch by aligning `TrophySystem` ids with `LeagueSystem` (`bronze_1` etc.).
- Ensure `LeagueService.checkSeasonEnd()` updates `currencyStore` after rewards.
- Remove or gate the negative-balance auto-fix.
- Wire `LeagueService.updateUserScore()` into match end handling.


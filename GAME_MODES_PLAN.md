# Game Modes & Features Roadmap

## Vision

Transform Pool 2D from a physics sandbox into a full-featured billiards game with:
- ✅ Single-player practice (current)
- 🎯 AI opponents for testing and gameplay refinement
- 🕹️ Multiple arcade-style game modes
- 🌐 Online multiplayer with matchmaking
- 🏆 Progression systems (ranks, leagues, tournaments)
- 🎱 Customization (cue upgrades, cosmetics)

---

## Current State Analysis

### Existing Infrastructure

**Game Modes:**
```typescript
enum GameMode {
  PRACTICE,    // ✅ Implemented - free play, unlimited shots
  EIGHT_BALL,  // ⚠️ Partial - rules exist, no turn management
}
```

**What Works:**
- ✅ Physics simulation (120 Hz fixed timestep)
- ✅ Ball-in-hand after fouls
- ✅ Foul detection (scratches, wrong ball first)
- ✅ 8-ball rules engine (group assignment, legal shots)
- ✅ Shot prediction and aim assist
- ✅ Basic HUD (FPS, player turn indicator)
- ✅ Geometry tuning panel for testing

**What's Missing:**
- ❌ Turn-based gameplay loop
- ❌ AI opponents
- ❌ Win conditions enforcement
- ❌ Game state management (breaks, turns, fouls)
- ❌ Shot timer
- ❌ Match scoring
- ❌ Replay system
- ❌ Menu system

---

## Phase 1: AI Opponent (Priority: Immediate)

### Goal
Implement a computer opponent for testing physics and refining gameplay, allowing you to play full 8-ball games during development.

### Why AI First?
1. **Testing utility** - Need to test turn-based logic and win conditions
2. **Game feel** - Can't judge pacing without full match flow
3. **Balance tuning** - Need to play against something to refine difficulty
4. **Foundation** - AI logic needed for arcade modes anyway

### Implementation Steps

#### Step 1.1: Game State Machine
Create structured game states to manage turns and flow.

**New File:** `src/game/GameStateMachine.ts`
```typescript
enum GameState {
  BREAK,           // Opening break shot
  PLAYER_TURN,     // Player is shooting
  AI_TURN,         // AI is shooting
  BALL_IN_HAND,    // Placing cue ball after foul
  GAME_OVER,       // Match finished
  PAUSED,          // Game paused
}

interface GameStateData {
  currentPlayer: Player;
  currentState: GameState;
  turnNumber: number;
  shotClock: number;
  lastFoul: FoulType | null;
}

class GameStateMachine {
  state: GameState;
  data: GameStateData;

  transitionTo(newState: GameState): void;
  onBreak(): void;
  onPlayerTurn(): void;
  onAITurn(): void;
  onBallInHand(): void;
  onGameOver(winner: Player): void;
}
```

**Integration:**
- Replace current `Game.mode` checks with state machine
- Add state transition callbacks
- Handle foul → ball-in-hand flow

#### Step 1.2: Player Management
Formalize player data and tracking.

**New File:** `src/game/Player.ts`
```typescript
enum PlayerType {
  HUMAN,
  AI,
}

interface PlayerStats {
  shotsAttempted: number;
  shotsMade: number;
  fouls: number;
  maxStreak: number;
  averagePositioning: number; // 0-100 score
}

class Player {
  id: number;
  name: string;
  type: PlayerType;
  group: BallGroup | null; // solids, stripes, or null
  stats: PlayerStats;

  isHuman(): boolean;
  isAI(): boolean;
  assignGroup(group: BallGroup): void;
  recordShot(success: boolean): void;
  recordFoul(): void;
}

enum BallGroup {
  SOLIDS,   // 1-7
  STRIPES,  // 9-15
}
```

**Integration:**
- Update `Game` class to use `Player[]` instead of implicit tracking
- Update HUD to show player names and stats
- Track which player has solids/stripes

#### Step 1.3: Basic AI (Rule-Based)
Implement simple but competent AI for testing.

**New File:** `src/ai/PoolAI.ts`
```typescript
interface ShotOption {
  targetBall: Ball;
  aimAngle: number;
  power: number;
  expectedSuccess: number; // 0-1 probability
  isSafe: boolean;
  positioningScore: number; // 0-100 for leave
}

class PoolAI {
  difficulty: AIDifficulty;
  thinkingTime: number; // Simulated delay

  // Core methods
  selectShot(world: PhysicsWorld, player: Player): ShotOption;
  evaluateShots(legalBalls: Ball[]): ShotOption[];
  calculateCutAngle(cueBall: Ball, targetBall: Ball, pocket: Pocket): number;
  estimateSuccess(shot: ShotOption): number;

  // Decision making
  shouldPlaySafe(options: ShotOption[]): boolean;
  chooseBestShot(options: ShotOption[]): ShotOption;
  addHumanError(shot: ShotOption): ShotOption; // Make AI imperfect
}

enum AIDifficulty {
  EASY,     // 40% success, poor positioning
  MEDIUM,   // 65% success, decent positioning
  HARD,     // 85% success, good positioning
  EXPERT,   // 95% success, excellent positioning
}
```

**AI Strategy (Simplified):**
1. **Identify legal shots** - Use existing `rules.getLegalBalls()`
2. **Find pockets for each ball** - Raycast to 6 pockets
3. **Calculate cut angle** - Geometry from cue → target → pocket
4. **Estimate difficulty:**
   - Distance to target (closer = easier)
   - Cut angle (straight shots easier)
   - Obstructions (ball-on-ball collisions)
   - Pocket distance (closer = easier)
5. **Score positioning** - Where cue ball ends up
6. **Add noise** - Based on difficulty, add aim error
7. **Execute shot** - Set aim angle and power

**Difficulty Implementation:**
```typescript
addHumanError(shot: ShotOption): ShotOption {
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
```

**Thinking Time:**
```typescript
async takeShot(world: PhysicsWorld): Promise<void> {
  // Show "AI thinking..." indicator
  this.hud.showAIThinking();

  // Simulate human thinking time
  await this.delay(1000 + Math.random() * 2000); // 1-3 seconds

  const shot = this.ai.selectShot(world, this.currentPlayer);

  // Animate to shot position
  await this.animateAimToShot(shot);
  await this.delay(500); // Brief pause

  // Execute shot
  this.executeShot(shot.aimAngle, shot.power);
}
```

#### Step 1.4: Turn-Based Game Loop
Implement proper turn management.

**Updated:** `src/game/Game.ts`
```typescript
class Game {
  stateMachine: GameStateMachine;
  players: Player[];
  currentPlayerIndex: number;
  ai: PoolAI;

  async startMatch(): Promise<void> {
    this.resetTable();
    this.stateMachine.transitionTo(GameState.BREAK);
    await this.playBreakShot();
    this.beginTurnLoop();
  }

  async beginTurnLoop(): Promise<void> {
    while (this.stateMachine.state !== GameState.GAME_OVER) {
      const currentPlayer = this.players[this.currentPlayerIndex];

      if (currentPlayer.isHuman()) {
        this.stateMachine.transitionTo(GameState.PLAYER_TURN);
        await this.waitForPlayerShot();
      } else {
        this.stateMachine.transitionTo(GameState.AI_TURN);
        await this.ai.takeShot(this.world);
      }

      // Evaluate shot result
      const result = this.rules.evaluateShot(this.world);

      if (result.isWin) {
        this.stateMachine.transitionTo(GameState.GAME_OVER);
        this.handleWin(currentPlayer);
        break;
      }

      if (result.isFoul || !result.ballPocketed) {
        this.switchTurns();
      }
      // else: same player continues

      if (result.isFoul) {
        this.handleFoul(result.foulType);
      }
    }
  }

  switchTurns(): void {
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
    this.hud.updateTurnIndicator(this.players[this.currentPlayerIndex]);
  }
}
```

### Testing Checklist
- [ ] Can start new AI match
- [ ] AI selects legal shots
- [ ] AI aims and shoots automatically
- [ ] Turn switches after missed shot
- [ ] Fouls trigger ball-in-hand
- [ ] Game ends when 8-ball pocketed
- [ ] Can adjust AI difficulty
- [ ] AI "thinking" delay feels natural

### Estimated Effort
**Total:** 16-20 hours
- State machine: 4 hours
- Player management: 3 hours
- Basic AI: 8 hours
- Turn loop integration: 3 hours
- Testing & polish: 2 hours

---

## Phase 2: Game Mode Variations (Arcade Modes)

### Goal
Add varied single-player modes for different playstyles and skill progression.

### Mode Ideas

#### 2.1: Time Attack
**Concept:** Clear all balls as fast as possible.

**Rules:**
- Start with break
- Timer starts on first shot
- No fouls (just warnings)
- Goal: Pocket all 15 balls + 8-ball

**UI Additions:**
- Large timer display
- Best time tracking
- Split times per ball

**Difficulty Variants:**
- Easy: Unlimited time, aim assist
- Hard: 5-minute limit, no aim assist
- Expert: 3-minute limit, random ball placement

#### 2.2: Perfect Game
**Concept:** Run the table without missing.

**Rules:**
- Must pocket all assigned balls + 8-ball in one turn
- One miss = game over
- Ball-in-hand after break
- Strict rules (fouls count as miss)

**Progression:**
- Track longest streak
- Leaderboard for perfect games
- Unlock harder table setups

#### 2.3: Challenge Mode
**Concept:** Pre-set scenarios to solve.

**Examples:**
- "The Hook" - Cue ball behind 8-ball, must hit solids
- "Corner Pocket Only" - Can only use two corner pockets
- "The Combo" - Must pocket 3 balls with combo shots
- "Rail Master" - Must use 3+ rails on every shot

**Structure:**
- 50+ pre-designed challenges
- Star rating (1-3 stars) based on shots used
- Unlock new challenges by completing previous ones
- Workshop mode: Create and share challenges

#### 2.4: Speed Pool
**Concept:** Fast-paced scoring mode.

**Rules:**
- 60-second timer per turn
- Each pocketed ball adds 5 seconds
- Score = balls × combo multiplier
- Combo breaks on miss or timeout
- Random ball rack (not triangle)

**Power-ups (optional):**
- Freeze Time (5 seconds)
- Slow Motion (10 seconds)
- Ball Reveal (highlight easiest shot)

#### 2.5: Trick Shot Gallery
**Concept:** Execute famous trick shots.

**Content:**
- 30+ iconic trick shots to replicate
- Ghost ball shows target position
- Multiple camera angles
- Slow-motion replay on success
- Rate your shots (AI judges accuracy)

**Examples:**
- Masse shots (curve cue ball)
- Jump shots over obstacles
- Multi-rail combo shots
- Butterfly shot
- Figure-8 pattern

#### 2.6: Survival Mode
**Concept:** Play against increasingly difficult AI.

**Rules:**
- Start vs Easy AI
- Win → face harder AI
- Lose → game over
- Track highest level reached
- Special "boss" opponents every 5 levels

**Progression:**
- Level 1-5: Easy AI
- Level 6-10: Medium AI
- Level 11-15: Hard AI
- Level 16-20: Expert AI
- Level 21+: Expert AI with handicaps (you start with fewer balls)

---

## Phase 3: Online Multiplayer Foundation

### Goal
Enable two players to compete over the internet with matchmaking and progression.

### Architecture

#### 3.1: Server Infrastructure
**Technology choices:**
- **Backend:** Node.js + Express
- **Real-time:** Socket.io or WebSockets
- **Database:** PostgreSQL (users, matches, stats)
- **Hosting:** Cloud provider (AWS, GCP, or Heroku)

**Core Services:**
```
┌─────────────────┐
│  Game Client    │ ←→ WebSocket ←→ ┌──────────────┐
│  (Browser)      │                  │ Game Server  │
└─────────────────┘                  │              │
                                     │ - Matchmaking│
                                     │ - Auth       │
                                     │ - Physics    │
                                     │ - Validation │
                                     └──────┬───────┘
                                            │
                                     ┌──────▼───────┐
                                     │  Database    │
                                     │ - Users      │
                                     │ - Matches    │
                                     │ - Rankings   │
                                     └──────────────┘
```

#### 3.2: Client-Server Model
**Approach:** Authoritative server with client-side prediction

**Why:** Prevent cheating while maintaining responsiveness

**Flow:**
```
Client                          Server
  │                              │
  ├─ Aim & Power ──────────────→ │ Validate shot legality
  │                              │
  │ ←──────────── Shot Approved ─┤
  │                              │
  ├─ Simulate Physics ────────→  │ Simulate Physics (authoritative)
  │  (prediction)                │
  │                              │
  │ ←────────── Physics State ───┤ Send final ball positions
  │                              │
  └─ Reconcile (if mismatch)     │
```

**Client:**
- Sends shot inputs (angle, power, spin)
- Predicts physics locally for instant feedback
- Receives authoritative state from server
- Reconciles differences (rollback if needed)

**Server:**
- Validates shot legality
- Runs authoritative physics simulation
- Broadcasts final state to both clients
- Detects and prevents cheating

#### 3.3: Matchmaking System
**Features:**
- Quick Play (random opponent)
- Ranked (skill-based matching)
- Friend Challenge (invite code)
- Practice Lobby (spectate ongoing matches)

**Matchmaking Algorithm:**
```typescript
interface MatchmakingCriteria {
  skillRating: number;        // ELO or similar
  searchRange: number;        // ±50 initially, expands over time
  gameMode: GameMode;
  region?: string;            // For latency
}

class Matchmaker {
  queue: Map<string, MatchmakingCriteria>;

  findMatch(player: Player): Match | null {
    // 1. Exact skill match (±50 rating)
    const exactMatch = this.findInRange(player.rating, 50);
    if (exactMatch) return this.createMatch(player, exactMatch);

    // 2. Expand search after 30s (±100 rating)
    if (player.waitTime > 30000) {
      const wideMatch = this.findInRange(player.rating, 100);
      if (wideMatch) return this.createMatch(player, wideMatch);
    }

    // 3. Expand search after 60s (anyone)
    if (player.waitTime > 60000) {
      const anyMatch = this.findAnyOpponent();
      if (anyMatch) return this.createMatch(player, anyMatch);
    }

    return null;
  }
}
```

#### 3.4: User Accounts & Authentication
**Minimal MVP:**
- Username + password (or OAuth)
- Guest mode (no account required)
- Profile page (stats, match history)

**Future:**
- Social login (Google, Discord, Steam)
- Profile customization (avatar, bio)
- Friend lists
- Block/report system

**Data Model:**
```typescript
interface User {
  id: string;
  username: string;
  email: string;
  createdAt: Date;

  // Stats
  gamesPlayed: number;
  gamesWon: number;
  winRate: number;
  currentStreak: number;
  bestStreak: number;

  // Progression
  level: number;
  experience: number;
  rank: Rank;

  // Customization
  equippedCue: string;
  ownedCues: string[];
  tableTheme: string;
}
```

#### 3.5: Match Protocol
**Pre-Match:**
```
1. Client: Request match (mode, ranked/unranked)
2. Server: Add to matchmaking queue
3. Server: Find opponent
4. Server: Create match room
5. Server → Clients: Match found! (opponent info)
6. Clients: Accept match (30s timeout)
7. Server: Initialize match
```

**During Match:**
```
Client                              Server                              Opponent
  │                                   │                                   │
  ├─ Shot input ─────────────────────→│                                   │
  │                                   ├─ Validate                          │
  │                                   ├─ Simulate physics                 │
  │                                   ├──────────── Ball positions ───────→│
  │←────────── Ball positions ────────┤                                   │
  │                                   │                                   │
  │                                   │←────────── Shot input ─────────────┤
  │                                   ├─ Validate                          │
  │                                   ├─ Simulate physics                 │
  │←────────── Ball positions ────────┤                                   │
  │                                   ├──────────── Ball positions ───────→│
```

**Post-Match:**
```
1. Server: Detect win condition
2. Server → Clients: Match result
3. Server: Update ratings (if ranked)
4. Server: Award XP and rewards
5. Clients: Show match summary
6. Clients: Option to rematch or find new opponent
```

#### 3.6: Anti-Cheat Measures
**Server-Side Validation:**
- ✅ Check shot is player's turn
- ✅ Verify cue ball position (ball-in-hand)
- ✅ Validate physics (impossible shots = disconnect)
- ✅ Rate limiting (prevent spam)
- ✅ Timeout detection (30s shot clock)

**Client-Side Detection:**
- Monitor for impossible input patterns
- Flag suspiciously perfect shots
- Report system for players

**Penalty System:**
- Warning → 30-minute ban → 24-hour ban → Permanent

### Estimated Effort
**Total:** 80-120 hours (with server + client)
- Server setup: 16 hours
- Authentication: 12 hours
- Matchmaking: 16 hours
- Network protocol: 20 hours
- Client integration: 20 hours
- Anti-cheat: 8 hours
- Testing & polish: 16 hours

---

## Phase 4: Progression & Customization

### Goal
Give players long-term goals and ways to express themselves.

### 4.1: Ranking System
**Concept:** Skill-based ranking with visual progression.

**Ranks (Inspired by competitive games):**
```
Rookie       [0-999]      - Starting rank
Amateur      [1000-1499]  - Learning fundamentals
Semi-Pro     [1500-1999]  - Consistent player
Professional [2000-2499]  - Skilled player
Expert       [2500-2999]  - Very skilled
Master       [3000-3499]  - Top tier
Grandmaster  [3500+]      - Elite
```

**ELO-Style Rating:**
```typescript
function updateRating(winner: Player, loser: Player): void {
  const K = 32; // Rating change factor
  const expectedWin = 1 / (1 + Math.pow(10, (loser.rating - winner.rating) / 400));

  const ratingChange = K * (1 - expectedWin);

  winner.rating += ratingChange;
  loser.rating -= ratingChange;
}
```

**Rank Decay (Optional):**
- Prevents rating inflation
- Lose points if inactive for 30 days
- Encourages regular play

### 4.2: Experience & Leveling
**XP Sources:**
- Win match: 100 XP
- Lose match: 25 XP (participation)
- First win of the day: +50 XP bonus
- Complete daily challenge: 150 XP
- Break and run: +100 XP bonus
- Perfect game: +200 XP bonus

**Leveling Curve:**
```typescript
function getXPForLevel(level: number): number {
  return 1000 + (level * 100); // Level 1 = 1000 XP, Level 10 = 2000 XP
}
```

**Level Rewards:**
- Every 5 levels: Unlock new cue skin
- Every 10 levels: Unlock table theme
- Milestones (25, 50, 100): Special titles and cosmetics

### 4.3: Leagues & Seasons
**Concept:** Time-limited competitive seasons.

**Structure:**
- **Season Duration:** 3 months
- **Divisions:** Bronze, Silver, Gold, Platinum, Diamond
- **Placement:** 5 placement matches determine starting division
- **Promotion/Demotion:** Top 20% promote, bottom 20% demote
- **Season Rewards:**
  - Exclusive cue skins
  - Titles
  - Avatar borders
  - Season-specific badges

**Weekly Challenges:**
- "Win 5 ranked matches"
- "Pocket 50 balls this week"
- "Win a match with all bank shots"
- Reward: Bonus XP and cosmetic items

### 4.4: Cue Upgrades & Customization
**Important:** Purely cosmetic - no pay-to-win!

**Cue Properties (Visual Only):**
- Stick color/pattern
- Wrap texture (leather, rubber, cloth)
- Butt cap design
- Ferrule material look
- Tip color

**Unlock Methods:**
- Level rewards
- Season rewards
- Achievement rewards
- Purchase with earned currency
- Special event rewards

**Example Cues:**
- Classic Maple (default)
- Carbon Fiber (Level 10)
- Pearl Inlay (Win 50 ranked games)
- Dragon Design (Season 1 Master rank)
- Gold Edition (Level 100)

**Table Themes (Also Cosmetic):**
- Classic Green (default)
- Tournament Blue (Level 20)
- Red Felt (Win 100 games)
- Black Luxury (Master rank)
- Custom tables for special events

### 4.5: Achievements
**Categories:**

**Beginner:**
- First Break
- First Ball Pocketed
- First Win
- Play 10 Matches

**Skill:**
- Break and Run
- Perfect Game (run table)
- Bank Shot Master (50 bank shots)
- Rail Runner (50 rail-first shots)
- No Miss (win without missing)

**Streak:**
- Win 5 in a row
- Win 10 in a row
- Win 25 in a row (very rare!)

**Specialty:**
- Pocket 8-ball on break
- Win with a combo on 8-ball
- Comeback win (opponent had 1 ball left)
- Style Points (execute a trick shot in match)

**Lifetime:**
- 100 Wins
- 500 Wins
- 1,000 Wins
- 10,000 Balls Pocketed
- 1,000 Hours Played

---

## Phase 5: Advanced Features (Long-Term)

### 5.1: Tournaments
**Structure:**
- Single elimination bracket
- Entry fee (in-game currency or free)
- Prize pool for top 3
- Special cosmetic rewards for winner

**Types:**
- Daily Mini-Tournament (8 players)
- Weekly Tournament (32 players)
- Monthly Championship (128 players)
- Special Events (256+ players)

### 5.2: Spectator Mode
**Features:**
- Watch top-ranked matches live
- View replays of famous matches
- Friends can spectate your matches
- Twitch integration for streaming

### 5.3: Replay System
**Functionality:**
- Save last 10 matches automatically
- Manual save for highlight reel
- Share replays via link
- Slow motion and camera controls
- Add annotations/comments

### 5.4: Social Features
**Friend System:**
- Add friends
- Challenge friends to private match
- See friends' online status
- Compare stats and rankings

**Clubs/Teams:**
- Create or join a club (max 20 members)
- Club rankings (total wins)
- Club vs Club matches
- Private club chat

### 5.5: Mobile Support
**Considerations:**
- Touch controls (drag for aim, swipe for power)
- Simplified UI for smaller screens
- Cross-platform play (mobile vs desktop)
- Performance optimization

### 5.6: Modding & Community
**Workshop System:**
- Custom table layouts
- Custom challenge scenarios
- Custom cue designs (approved by mods)
- Share and rate community content

**Leaderboards:**
- Global rankings
- Regional rankings
- Friends-only rankings
- Mode-specific rankings (Time Attack, Survival, etc.)

---

## Implementation Priority

### Immediate (Phase 1) - Next 2-3 Weeks
✅ Get AI opponent working so you can test game feel
- Core state machine
- Turn-based gameplay
- Basic AI (rule-based)
- Win condition handling

### Short Term (Phase 2) - 1-2 Months
🎯 Add game mode variety for single-player content
- Time Attack mode
- Challenge Mode (10-20 scenarios)
- Survival mode

### Medium Term (Phase 3) - 3-6 Months
🌐 Launch online multiplayer beta
- Server infrastructure
- Matchmaking
- User accounts
- Basic ranking system

### Long Term (Phase 4-5) - 6-12 Months
🏆 Build out progression and community
- Full ranking/league system
- Tournaments
- Advanced customization
- Social features

---

## Technical Considerations

### Code Organization
Suggested new structure:
```
src/
├── game/
│   ├── Game.ts (main game orchestrator)
│   ├── GameStateMachine.ts (state management)
│   ├── Player.ts (player data)
│   └── modes/
│       ├── PracticeMode.ts
│       ├── EightBallMode.ts
│       ├── TimeAttackMode.ts
│       └── ChallengeMode.ts
├── ai/
│   ├── PoolAI.ts (main AI logic)
│   ├── ShotEvaluator.ts (evaluate shot quality)
│   └── Difficulty.ts (difficulty settings)
├── network/ (Phase 3)
│   ├── Client.ts (websocket client)
│   ├── Protocol.ts (message definitions)
│   └── Sync.ts (state synchronization)
├── progression/ (Phase 4)
│   ├── Ranking.ts
│   ├── Experience.ts
│   └── Achievements.ts
└── ui/
    ├── MainMenu.ts
    ├── ModeSelect.ts
    ├── Matchmaking.ts (Phase 3)
    └── Profile.ts (Phase 3)
```

### Performance Considerations
- **Physics determinism:** Crucial for online play
- **State compression:** Minimize network bandwidth
- **Prediction:** Client-side prediction for responsive feel
- **Rollback:** Handle latency gracefully

### Testing Requirements
- **AI Testing:** Ensure AI plays legal shots
- **Network Testing:** Simulate latency and packet loss
- **Balance Testing:** Ensure no mode is too easy/hard
- **Load Testing:** Server can handle 1000+ concurrent players

---

## Success Metrics

### Player Engagement
- **DAU (Daily Active Users):** Target 1,000+ after launch
- **Session Length:** Average 20+ minutes
- **Retention:**
  - Day 1: 60%
  - Day 7: 30%
  - Day 30: 15%

### Match Quality
- **Average Match Duration:** 10-15 minutes
- **Close Matches:** 60%+ of matches decided by <3 balls difference
- **Timeout Rate:** <5% of matches end in timeout
- **Disconnect Rate:** <2% of matches end in disconnect

### Monetization (Future)
- **Conversion Rate:** 5%+ of players purchase cosmetics
- **ARPU (Average Revenue Per User):** $2-5
- **Free-to-play friendly:** No pay-to-win elements

---

## Questions to Consider

### Gameplay
- ❓ Should AI difficulty auto-adjust based on player performance?
- ❓ Should we have a shot clock in practice mode?
- ❓ Do we need aim assist in ranked mode?
- ❓ Should fouls be more/less punishing?

### Progression
- ❓ How fast should leveling be?
- ❓ Should there be a daily XP cap?
- ❓ Do we need both ranks and levels?
- ❓ Should seasonal rank reset fully or partially?

### Online
- ❓ Cross-region matching allowed?
- ❓ Voice chat or text only?
- ❓ Allow rematch after close games?
- ❓ Penalize rage quits?

### Monetization
- ❓ Battle pass system?
- ❓ One-time premium unlock?
- ❓ Free cosmetics vs paid cosmetics ratio?
- ❓ Ads for free players?

---

## Next Steps

1. ✅ **Review this plan** - Discuss priorities and scope
2. 🎯 **Start Phase 1** - Implement AI opponent (highest priority)
3. 📝 **Create detailed Phase 1 spec** - Break down into small tasks
4. 🔧 **Refactor game state** - Prepare codebase for turn-based logic
5. 🤖 **Build basic AI** - Get computer opponent working
6. 🧪 **Test & iterate** - Play against AI, refine feel
7. 🎮 **Add first arcade mode** - Time Attack as proof-of-concept
8. 🌐 **Plan Phase 3** - Begin researching server architecture

---

**Let's start with AI so you can actually play the game!** 🎱

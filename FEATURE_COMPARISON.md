# Feature Comparison: pool2d vs 8 Ball Brawl

**Date**: 2025-11-27
**pool2d Commit**: 9b85777

---

## Executive Summary

**pool2d** is a **tournament-grade physics simulator** with professional-level accuracy and comprehensive developer tooling. It's built for **realism and technical excellence**.

**8 Ball Brawl** is a **fully-loaded live-ops F2P mobile game** with extensive metagame systems, social features, and monetization. It's built for **engagement and retention**.

**Strategic Position**: pool2d has superior core physics. 8 Ball Brawl has everything else.

---

## Feature Matrix

| Category | pool2d | 8 Ball Brawl | Winner |
|----------|--------|--------------|--------|
| **Physics Accuracy** | ✅ Tournament-grade (120Hz, quaternion rotation, dual friction) | ⚠️ "True 3D" (likely simplified for mobile) | **pool2d** |
| **Online Multiplayer** | ❌ Local only | ✅ Real-time global PvP | **8BB** |
| **Game Modes** | 🟡 2 (Practice, 8-Ball) | ✅ 7+ (Standard, Tournaments, Hustler Quest, VIP Brawl, Win Streak, Seasons, Offline) | **8BB** |
| **Progression Systems** | ❌ None | ✅ 5+ (Clubs, Trophy Road, Cue Collection, Season Pass, Like a Pro) | **8BB** |
| **Economy/Monetization** | ❌ None (open-source) | ✅ Full (coins, gold, season pass, boosts, tickets) | **8BB** |
| **Social Features** | ❌ None | ✅ Friends, chat, emotes, global leaderboards | **8BB** |
| **Customization** | 🟡 Physics tuning + basic visual | ✅ Cues, tables, assistants, cosmetics, crowns | **8BB** |
| **Events & Live Ops** | ❌ None | ✅ Seasonal events, themed content, weekend tournaments | **8BB** |
| **Developer Tools** | ✅ Best-in-class (shot capture, physics recorder, debug overlay) | ❌ N/A (retail product) | **pool2d** |
| **UX Polish** | 🟡 Functional but basic | ✅ Extensive onboarding, animations, skip systems | **8BB** |
| **Anti-Cheat** | ❌ Client-side only | ✅ Server-validated, marketed heavily | **8BB** |
| **Platform Support** | 🟡 Web (desktop + mobile) | ✅ Mobile-first (iOS/Android) | **8BB** |

**Legend**: ✅ Full feature | 🟡 Partial/basic | ❌ Not implemented | ⚠️ Implemented but weaker

---

## 1. CORE GAMEPLAY & PHYSICS

### pool2d Has
- **120 Hz fixed timestep** with adaptive substepping
- **Quaternion-based 3D ball rotation** (visually accurate rolling)
- **Dual friction model** (rolling vs sliding)
- **Impulse-based collision** with 15 solver iterations
- **Baumgarte correction** to prevent overlap/tunneling
- **Sleep detection** for performance
- **Sphere-sphere sweep prediction** for aim assist
- **Shot capture system** measuring prediction error (<0.2" contact point, 1-3° angle)
- **Physics recorder** with JSON/Markdown export
- **20+ tunable physics parameters** exposed in runtime UI

### 8 Ball Brawl Has
- "True 3D physics" (marketing claim, likely simplified for mobile performance)
- "Lifelike rotation and angles" (probably not quaternion-based)
- "Pro-level gameplay" with spin control, banking, skill shots
- **Offline practice mode** (pool2d only has practice, not offline PvP)

### Assessment
**pool2d wins on technical rigor**. The physics implementation is tournament-grade and exceeds what most F2P mobile games need. 8BB focuses on "feels good" physics rather than simulation accuracy.

**Key Difference**: pool2d can **prove** its accuracy with shot capture data. 8BB relies on player perception.

---

## 2. GAME MODES

### pool2d Has
1. **Practice Mode** - Free play with no rules, ball repositioning, full debug access
2. **8-Ball Mode** - Standard rules with break detection, fouls, turn system, win/loss conditions

### 8 Ball Brawl Has
1. **Standard 1v1 PvP** - Head-to-head matches for coins and rewards
2. **Tournaments** - Multi-match runs with escalating stakes
3. **Hustler Quest** - Solo campaign with themed levels and rebalanced difficulty
4. **Frozen Hustle** - Hustler Quest expansion with "Frozen Balls" mechanic
5. **VIP Brawl** - Ticket-gated premium weekend event with crown cosmetic
6. **Win Streak** - 4-day timed ladder with chain win rewards
7. **Seasons** - Battle-pass-style cadence with themed content
8. **Offline Mode** - Practice without connection

### Gap Analysis
**pool2d is missing**:
- ❌ Any online multiplayer
- ❌ Tournament/competitive modes
- ❌ PvE campaign/progression
- ❌ Event modes (timed, premium, seasonal)
- ❌ Offline vs online distinction (everything is offline)

**8 Ball Brawl is missing**:
- ❌ True practice mode with ball repositioning
- ❌ Physics tuning/sandbox mode
- ❌ Developer tooling for shot analysis

**Winner**: **8BB** by a landslide for player engagement. pool2d is a sandbox/simulator, not a game.

---

## 3. PROGRESSION SYSTEMS

### pool2d Has
- Turn tracking (who's shooting)
- Ball tracking (pocketed balls per player)
- Group assignment (solids/stripes)
- Game state machine (BREAK → PLAYING → BALL_IN_HAND → GAME_OVER)
- FPS/UPS performance metrics

**No long-term progression**. No unlocks, no rewards, no leveling.

### 8 Ball Brawl Has
1. **Clubs/Tables** - Tiered rooms with increasing stakes and difficulty
2. **Trophy Road** - Long-term milestone track with rewards
3. **Cue Collection** - Collection tracker for all cues
4. **Season Pass** - Free and premium tracks with daily spins
5. **"Like a Pro"** - Skill-challenge/mastery track
6. **Currencies**:
   - Coins (earned in matches, spent on entry fees)
   - Gold (premium currency)
   - Event rewards (cosmetics, cues, boosts)
   - Assistant Energy (powers meta-abilities)
7. **Assistants** - Unlockable gameplay modifiers (aim help, better break, extra rewards)
8. **Last Chance** - End-of-season catch-up mechanic
9. **Patch Notes Reward** - Gold for reading updates

### Gap Analysis
**pool2d has zero metagame**. It's a pure skill game with no extrinsic motivation.

**Winner**: **8BB** for player retention. Multiple overlapping progression rails = more hooks.

---

## 4. CUSTOMIZATION

### pool2d Has
- **Physics Tuning** (20+ parameters):
  - Ball-ball restitution, friction
  - Cushion restitution
  - Rolling/sliding friction
  - Max power, power multiplier
  - Solver iterations, sleep threshold
  - Rotation speed multiplier
  - Pocket jaw gap
  - Export/import config as JSON
- **Visual Customization**:
  - Table felt color
  - Rail wood color
  - UI colors (active player, turn indicator)
  - Pocket jaw gap (runtime tunable)
- **Settings Persistence** (LocalStorage)

### 8 Ball Brawl Has
- **Cues** - Dozens with unique stats/abilities (power, spin, aim, rewards)
- **Assistants** - Special abilities powered by Assistant Energy
- **Tables/Halls** - Dozens of themed clubs with different aesthetics
- **Crowns** - Prestige cosmetic for VIP Brawl winners
- **Seasonal Cosmetics** - Limited-time skins and themes
- **Boosts** - Performance enhancers

### Assessment
**pool2d customizes the simulation**. 8BB customizes the player experience.

**For developers**: pool2d is superior (tune physics to match real tables).
**For players**: 8BB is superior (unlockable cues/skins = progression dopamine).

**Winner**: Depends on audience. **8BB for mass market**, pool2d for engineers/enthusiasts.

---

## 5. SOCIAL & MULTIPLAYER

### pool2d Has
- ❌ **Nothing**
- Local 2-player hotseat only
- No networking, no chat, no friends, no leaderboards

### 8 Ball Brawl Has
- ✅ **Real-time global PvP** with quick 1v1 matchmaking
- ✅ **Friend challenges** (dedicated 2-player matches)
- ✅ **Chat & emotes** during matches (mind games / banter)
- ✅ **Leaderboards** (global, club, event)
- ✅ **Community** (Facebook, support system)
- ✅ **Fair Play & Anti-Cheat** (server-validated, marketed heavily)

### Gap Analysis
**This is pool2d's biggest weakness**. A pool game is inherently competitive and social. Without multiplayer:
- No stakes (coins, rankings)
- No bragging rights
- No emergent player stories
- Limited replayability

**Winner**: **8BB** by default. pool2d isn't competing in this space.

---

## 6. UX & POLISH

### pool2d Has
- **HUD**: Top bar with mode/turn/balls, FPS/UPS counters, foul banner
- **Controls**: Mouse, touch, 5 keyboard shortcuts (A, D, R, S, M)
- **Settings Modal**: Game settings + UI color customization
- **Loading Screen**: Animated progress bar with asset names
- **Visual Feedback**: Player highlighting, foul animations, button hover effects
- **Responsive Canvas**: Scales to screen, preserves 2:1 aspect
- **Aim Assist**: Ghost ball, trajectory lines, directional arrows

### 8 Ball Brawl Has
- **New Player Experience**: Easier start, introduction system, smarter tips
- **Adjustable Sensitivity**: Cue control fine-tuning
- **Animation Skipping**: Skip reward animations in Trophy Road, Seasons, etc.
- **Patch Notes Screen**: In-game viewer with gold reward
- **Smooth Controls**: Repeatedly mentioned in updates
- **Extensive Onboarding**: Multi-stage tutorial for new players

### Assessment
**pool2d is functional but basic**. It has the essentials but doesn't hold your hand.

**8BB is highly polished**. Constant UX iteration in patch notes (onboarding, controls, animation skipping) shows they care about player comfort.

**Winner**: **8BB for onboarding/retention**, pool2d for power users who want minimal UI.

---

## 7. MONETIZATION & ECONOMY

### pool2d Has
- ❌ **None**
- Free and open-source
- No IAP, no ads, no premium currency

### 8 Ball Brawl Has
- **Coins** - Core currency (earned in matches, spent on entry fees)
- **Gold** - Premium currency with first-purchase bonus per pack
- **Season Pass** - Free and premium tiers
- **Tickets** - Event entry (VIP Brawl)
- **Boosts** - Performance enhancers (purchased or earned)
- **Seasonal Offers** - Black Friday / Cyber Monday sales
- **Assistant Energy** - Resource to power assistants (premium pass gives more)
- **Daily Free Spin** - Season pass perk

### Assessment
**8BB is a full F2P game** with all the expected monetization systems. The economy drives:
- Match stakes (risk/reward with coins)
- Progression gates (unlock clubs with trophies)
- Premium events (VIP Brawl tickets)
- Cosmetic purchases (cues, tables, crowns)

**pool2d has no economy** because it's not trying to monetize. It's a simulator/tool, not a product.

**Winner**: **8BB for business model**, pool2d for open-source ethos.

---

## 8. EVENTS & LIVE OPS

### pool2d Has
- ❌ **None**
- No seasonal content, no limited-time challenges, no themed events

### 8 Ball Brawl Has
- **Seasons** - Named seasons (e.g., "Stars & Stripes") with exclusive rewards
- **VIP Brawl** - 3-day weekend event (Fri–Sun) with crown cosmetic
- **Win Streak** - 4-day timed challenge
- **Themed Events** - Holiday content (implied by seasonal offers)
- **Last Chance** - End-of-season catch-up event
- **Patch Notes Reward** - Incentivizes reading updates

### Assessment
**Live ops are 8BB's lifeblood**. They create:
- **Urgency** (timed events)
- **FOMO** (limited cosmetics)
- **Routine** (weekly VIP Brawl, daily spins)
- **Reengagement** (Last Chance at season end)

**pool2d has no retention hooks**. Once you've mastered the physics, there's no reason to come back.

**Winner**: **8BB**. Live ops are essential for F2P retention.

---

## 9. DEVELOPER TOOLS & DEBUGGING

### pool2d Has
- **Shot Capture System**:
  - Records prediction vs actual collision
  - Measures contact point error (<0.2" for short shots)
  - Calculates angle error (1-3° on cuts)
  - Tracks velocities before/after
  - Auto-copies report to clipboard
- **Physics Recorder**:
  - Frame-by-frame state tracking
  - Collision/pocket event logging
  - Export to JSON/Markdown
  - Console commands (`startRecording()`, `stopRecording()`)
- **Debug Overlay** (D key):
  - Rail normals (green arrows)
  - Ball velocities (magenta arrows)
  - Pocket capture radii (yellow circles)
  - AABB boxes, contact points
- **Measurement Overlay** (M key)
- **Console Debug Functions**:
  - `debugRotation()`, `testRotation()`, `replaceWithTestBall()`, `captureShot()`, `marker()`
- **Overlap Warnings** (physics instability detection)
- **20+ Tunable Physics Parameters** with JSON export

### 8 Ball Brawl Has
- ❌ **None** (retail product)
- Players have no access to internals
- Devs presumably have internal tools (not public)

### Assessment
**pool2d is a developer's dream**. The tooling is production-grade:
- Prove physics accuracy with shot capture
- Debug issues with visual overlays
- Record and replay sessions with physics recorder
- Tune parameters in real-time with instant export

**This is pool2d's killer feature** for anyone building a pool game or researching physics.

**Winner**: **pool2d** by a mile. 8BB has nothing here.

---

## 10. TECHNICAL ARCHITECTURE

### pool2d Has
- **TypeScript** - Fully typed
- **Vite** - Modern build with HMR
- **Three.js** - 3D rendering (v0.160.1)
- **Vitest** - Unit testing
- **ESLint + Prettier** - Code quality
- **Modular Architecture** - Clean separation (physics, rendering, UI, state)
- **Authoritative Geometry Contract** - Single source of truth for table dimensions
- **Coordinate Transform Utilities** - Canvas ↔ World conversion
- **Fixed Timestep Accumulator** - Decouples rendering from physics
- **Asset System** - FBX loader, texture loader, progress tracking
- **Performance Optimizations** - Adaptive substepping, sleep detection, object reuse

### 8 Ball Brawl Has
- Unknown (likely Unity or custom engine)
- Mobile-first (iOS/Android)
- Server-authoritative for anti-cheat
- Presumably uses client-server architecture for multiplayer

### Assessment
**pool2d is well-engineered** for a solo/small team project. Clean code, good architecture, professional tooling.

**8BB is a production game** with server infrastructure, live ops systems, analytics, and a much larger codebase.

**Winner**: Apples to oranges. Both are appropriate for their goals.

---

## 11. WHAT POOL2D DOES **BETTER** THAN 8 BALL BRAWL

Despite being a smaller project, pool2d has clear advantages:

### 1. Physics Accuracy
- **120 Hz timestep** (8BB likely uses 30-60 Hz for battery life)
- **Quaternion rotation** (8BB probably uses sprite rotation or simplified 3D)
- **Dual friction model** (rolling vs sliding)
- **Baumgarte correction** (prevents tunneling/overlap)
- **Provable accuracy** via shot capture (8BB has no validation system)

### 2. Developer Tooling
- Shot capture, physics recorder, debug overlays
- 8BB has none of this (players can't analyze physics)

### 3. Open Source
- Inspect all code, modify anything, no black boxes
- 8BB is proprietary

### 4. Physics Customization
- 20+ tunable parameters with JSON export
- 8BB has fixed physics (players can't experiment)

### 5. Web Platform
- No app store friction, instant access
- 8BB requires download and permissions

### 6. No Dark Patterns
- No energy systems, no wait timers, no paywalls
- 8BB has all the F2P hooks (tickets, energy, season pass)

### 7. Practice Mode
- True practice with ball repositioning and debug tools
- 8BB's offline mode is still bound to game rules (no free repositioning)

---

## 12. STRATEGIC GAPS TO FILL

If pool2d wanted to compete with 8BB, here's what it needs (in priority order):

### Tier 1: Essential for Competitiveness
1. **Online Multiplayer** - Real-time PvP with matchmaking
2. **Accounts & Persistence** - Save progress across devices
3. **Basic Progression** - Clubs/tiers with increasing stakes
4. **Currency System** - Coins for entry fees and rewards
5. **Leaderboards** - Global and weekly rankings

### Tier 2: Engagement & Retention
6. **Tournament Mode** - Multi-match runs with elimination
7. **Win Streak** - Timed chain-win challenge
8. **Friends & Challenges** - Social layer for replayability
9. **Season Pass** - Free track with rewards
10. **Cue Collection** - Unlockable cues with stats

### Tier 3: Monetization & Live Ops
11. **Premium Currency** - For IAP
12. **Season Pass (Premium)** - Paid track
13. **Event Modes** - Weekend tournaments, themed challenges
14. **Seasonal Content** - Holiday themes and cosmetics
15. **Assistants/Boosts** - Gameplay modifiers

### Tier 4: Polish & UX
16. **Onboarding** - Tutorial for new players
17. **Animation Skipping** - Respect player time
18. **Adjustable Sensitivity** - Aim/power controls
19. **Chat & Emotes** - Mid-match interaction
20. **Anti-Cheat** - Server-validated physics (critical for stakes)

---

## 13. WHAT TO **NOT** COPY FROM 8 BALL BRAWL

Some 8BB features are retention hacks that might hurt pool2d's identity:

### 1. Energy/Ticket Systems
- **Why 8BB has it**: Limit play sessions → drive IAP
- **Why pool2d shouldn't**: Kills the sandbox/simulator vibe

### 2. Simplified Physics
- **Why 8BB has it**: Mobile battery life, broader skill floor
- **Why pool2d shouldn't**: Physics accuracy is the core differentiator

### 3. Pay-to-Win Cues
- **Why 8BB has it**: Monetization > competitive integrity
- **Why pool2d shouldn't**: Competitive players will leave

### 4. Grinding for Basic Features
- **Why 8BB has it**: Maximize DAU and session length
- **Why pool2d shouldn't**: Developers/enthusiasts will resent it

### 5. Intrusive Notifications
- **Why 8BB has it**: Reengagement
- **Why pool2d shouldn't**: Web platform doesn't need this

---

## 14. RECOMMENDED ROADMAP FOR POOL2D

If the goal is to **compete with 8BB** while **preserving pool2d's strengths**:

### Phase 1: Foundation (3-6 months)
- Implement WebSocket-based real-time multiplayer
- Add user accounts (Firebase or Supabase)
- Build basic matchmaking (skill-based)
- Add simple progression (XP, ranks)
- Create coin economy for match stakes

### Phase 2: Engagement (3-6 months)
- Add tournament mode (bracket-based)
- Implement leaderboards (global, weekly)
- Create friends system with challenges
- Add cue collection (cosmetic only, no P2W)
- Build replay system (leverage physics recorder)

### Phase 3: Monetization (3-6 months)
- Add season pass (free track only to start)
- Implement cosmetic shop (tables, cues, ball skins)
- Create premium season pass
- Add optional ads for coin boosts
- Implement gifting system

### Phase 4: Live Ops (ongoing)
- Launch seasonal events
- Add themed content (holiday tables, special cues)
- Run limited-time tournaments
- Introduce community challenges
- Build esports tooling (spectator mode, highlights)

### Key Principle
**Preserve physics accuracy and developer tools**. These are pool2d's moat. Don't compromise them for retention metrics.

---

## 15. CONCLUSION

| What | pool2d | 8 Ball Brawl |
|------|--------|--------------|
| **Vision** | Tournament-grade physics simulator | Casual F2P mobile pool game |
| **Audience** | Developers, physics enthusiasts, serious players | Mass market mobile gamers |
| **Strength** | Physics accuracy, developer tools | Metagame systems, social features, live ops |
| **Weakness** | No multiplayer, no progression, no social | Likely simplified physics, mobile-only |
| **Monetization** | None (open-source) | Full F2P (coins, gold, season pass, IAP) |
| **Retention** | Low (no extrinsic motivation) | High (multiple progression hooks) |
| **Unique Value** | Provable physics accuracy + tooling | Complete live-ops game with years of content |

### Can pool2d compete with 8 Ball Brawl?

**Not directly**. They're solving different problems:
- **8BB** is a mobile F2P game optimized for DAU, retention, and monetization.
- **pool2d** is a web-based physics simulator optimized for accuracy and developer ergonomics.

### Where pool2d can win:
1. **Esports/Competitive Scene** - If physics accuracy matters (tournaments, leagues)
2. **Developer Community** - As a reference implementation for physics
3. **Web-First Market** - Instant access, no app store friction
4. **Skill-First Players** - Who want zero P2W and pure competition
5. **Education** - Teaching physics, game dev, or competitive pool

### Where 8BB will always win:
1. **Mass Market Appeal** - Progression systems hook casual players
2. **Mobile Dominance** - App stores + push notifications = engagement
3. **Live Ops** - Years of content updates and seasonal events
4. **Social Layer** - Friends, chat, guilds create stickiness
5. **Monetization** - F2P model generates revenue to fund development

### Strategic Recommendation:
**Lean into pool2d's strengths** rather than chase 8BB feature-for-feature:
- Position as the "sim racer of pool games" (accuracy over accessibility)
- Build multiplayer but **keep it skill-based** (no P2W)
- Add progression but **keep it transparent** (no energy systems)
- Monetize with **cosmetics only** (preserve competitive integrity)
- Emphasize **esports potential** (spectator mode, replays, tournaments)

**Bottom Line**: pool2d is already better at physics. Don't ruin that chasing retention metrics.

---

**End of Comparison**

Generated: 2025-11-27
For: pool2d repository
By: Claude Code

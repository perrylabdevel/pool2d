# Pool2D Mobile F2P Roadmap

**Vision**: Transform pool2d from a tournament-grade physics simulator into a mobile-first, real-time multiplayer pool game with F2P monetization.

**Timeline**: 6-9 months to soft launch
**Platform**: Mobile (iOS + Android via React Native or Capacitor)
**Business Model**: F2P with cosmetic IAP + optional season pass
**Core Differentiator**: Tournament-grade physics in a mobile F2P game

---

## Current State (Milestones 1-7 ✅ Complete)

From `specs.md`, the original 7 milestones are complete:

1. ✅ **Scaffold** - Repo, configs, canvas, static rendering
2. ✅ **Physics Core v1** - Ball-ball, ball-rail, friction, sleep, fixed timestep
3. ✅ **Cue & Shot** - Aim, power meter, prediction line
4. ✅ **Pockets** - Capture, removal, sink animation
5. ✅ **Rules (8-Ball)** - Turns, fouls, ball-in-hand, win/lose
6. ✅ **Debug Overlay** - Shot capture, physics recorder, visual debugging
7. ✅ **Polish Pass** - Shadows, UI, settings, performance tuning, tests

**Additional completed work**:
- ✅ 3D ball rendering with Three.js
- ✅ Quaternion-based ball rotation
- ✅ 20+ tunable physics parameters
- ✅ Shot capture system (<0.2" accuracy)
- ✅ Physics recorder with JSON/Markdown export
- ✅ Comprehensive developer tooling

---

## Phase 1: Mobile Foundation (Months 1-2)

**Goal**: Port to mobile, establish tech stack, validate physics on mobile hardware

### Milestone 8: Mobile Platform Setup
**Duration**: 2-3 weeks

- [ ] **Tech Stack Decision**
  - [ ] Evaluate React Native + Expo (easier deployment, smaller bundle)
  - [ ] Evaluate Capacitor (reuse existing web code)
  - [ ] Decision: Recommend **Capacitor** (preserves existing canvas/Three.js code)
- [ ] **Mobile Build Pipeline**
  - [ ] Set up Capacitor for iOS
  - [ ] Set up Capacitor for Android
  - [ ] Configure app icons, splash screens
  - [ ] Test builds on physical devices
- [ ] **Touch Input Refactor**
  - [ ] Replace mouse-based aim with touch gestures
  - [ ] Implement pinch-to-zoom for table view
  - [ ] Add touch-friendly power slider (larger hit zones)
  - [ ] Test on various screen sizes (phone, tablet)
- [ ] **Performance Validation**
  - [ ] Benchmark physics on low-end Android (120 UPS target)
  - [ ] Profile rendering on iOS (60 FPS target)
  - [ ] Optimize for battery life (reduce draw calls)
  - [ ] Add performance presets (low/medium/high)

**Deliverable**: Installable APK/IPA running at 60 FPS on mid-tier devices

### Milestone 9: Mobile UX Polish
**Duration**: 2-3 weeks

- [ ] **Responsive Layout**
  - [ ] Portrait mode support (vertical screen)
  - [ ] Landscape mode optimization (horizontal screen)
  - [ ] Safe area handling (notch, home indicator)
  - [ ] Dynamic font scaling
- [ ] **Haptic Feedback**
  - [ ] Vibration on ball collisions (intensity based on impact)
  - [ ] Haptic on ball pocketing
  - [ ] Subtle haptics on UI interactions
- [ ] **Mobile-First UI**
  - [ ] Redesign HUD for small screens
  - [ ] Bottom sheet for settings (native feel)
  - [ ] Swipe gestures for menu navigation
  - [ ] Larger touch targets (44pt minimum)
- [ ] **Sound Effects**
  - [ ] Ball collision sounds (intensity based on velocity)
  - [ ] Pocket drop sound
  - [ ] Break sound
  - [ ] UI interaction sounds
  - [ ] Background music (optional, toggle in settings)
- [ ] **Loading & Transitions**
  - [ ] Optimize asset loading (lazy load 3D models)
  - [ ] Add skeleton screens for async content
  - [ ] Smooth scene transitions (fade, slide)

**Deliverable**: Polished mobile experience with sound, haptics, responsive UI

---

## Phase 2: Backend & Multiplayer Infrastructure (Months 2-3)

**Goal**: Build real-time multiplayer with server-authoritative physics

### Milestone 10: Backend Setup
**Duration**: 2-3 weeks

- [ ] **Tech Stack**
  - [ ] Backend: Node.js + TypeScript
  - [ ] Database: PostgreSQL (user accounts, match history)
  - [ ] Real-time: Socket.io or WebSockets
  - [ ] Hosting: Railway, Render, or fly.io (start small, scale later)
- [ ] **User Accounts**
  - [ ] Email/password registration
  - [ ] OAuth (Google, Apple Sign-In for mobile)
  - [ ] JWT authentication
  - [ ] Profile system (username, avatar, stats)
- [ ] **Database Schema**
  - [ ] Users table (id, username, email, avatar, created_at)
  - [ ] Matches table (id, player1_id, player2_id, winner_id, coins_wagered, created_at)
  - [ ] User_stats table (user_id, wins, losses, total_coins, current_streak)
  - [ ] Cues table (id, name, rarity, unlock_cost)
  - [ ] User_cues table (user_id, cue_id, unlocked_at)
- [ ] **API Endpoints**
  - [ ] POST /auth/register
  - [ ] POST /auth/login
  - [ ] GET /user/profile
  - [ ] GET /user/stats
  - [ ] GET /leaderboard (global, weekly)

**Deliverable**: Deployed backend with user accounts, login flow in mobile app

### Milestone 11: Real-Time Multiplayer
**Duration**: 3-4 weeks

- [ ] **Matchmaking**
  - [ ] Simple queue (first-come-first-served to start)
  - [ ] Skill-based matchmaking (use ELO or similar)
  - [ ] Match coins wager selection (10, 50, 100, 500, 1000)
  - [ ] Timeout handling (30s to find opponent, else abort)
- [ ] **Game Room System**
  - [ ] Room creation on match found
  - [ ] Player join/leave handling
  - [ ] Room state synchronization (ball positions, turn, timer)
  - [ ] Graceful disconnect handling (reconnect within 30s)
- [ ] **Server-Authoritative Physics**
  - [ ] Port core physics engine to server (reuse TypeScript code)
  - [ ] Server validates every shot (prevent cheating)
  - [ ] Server broadcasts physics state to both clients
  - [ ] Client-side prediction with server reconciliation
- [ ] **Shot Submission**
  - [ ] Client sends: aim angle, power, (future: spin)
  - [ ] Server simulates shot
  - [ ] Server broadcasts: ball positions, velocities, pocketed balls
  - [ ] Client renders server-authoritative state
- [ ] **Turn Management**
  - [ ] Turn timer (30s per shot)
  - [ ] Automatic forfeit on timeout
  - [ ] Turn indicator synced across clients
- [ ] **Anti-Cheat**
  - [ ] Server-only physics simulation (client can't fake results)
  - [ ] Shot validation (no illegal shots)
  - [ ] Rate limiting on shot submissions
  - [ ] Ban system for repeated infractions

**Deliverable**: Working 1v1 real-time multiplayer with server-authoritative physics

---

## Phase 3: Economy & Progression (Month 4)

**Goal**: Add F2P economy loops to drive engagement and monetization

### Milestone 12: Currency & Economy
**Duration**: 2-3 weeks

- [ ] **Currency System**
  - [ ] Coins (earned in matches, spent on entry fees)
  - [ ] Gems (premium currency, purchased with real money)
  - [ ] Starting balance: 1000 coins for new players
- [ ] **Match Stakes**
  - [ ] Entry fee deducted when match starts
  - [ ] Winner takes 80% of pot (20% house rake to balance economy)
  - [ ] Loss = lose entry fee (creates risk/reward)
- [ ] **Daily Rewards**
  - [ ] Login bonus (50 coins/day, streak multiplier)
  - [ ] Day 1: 50 coins
  - [ ] Day 2: 75 coins
  - [ ] Day 3: 100 coins
  - [ ] Day 7: 250 coins + 10 gems
  - [ ] Reset on missed day
- [ ] **Free Coin Sources**
  - [ ] Daily quest (e.g., "Win 3 matches") → 100 coins
  - [ ] Watch ad for 50 coins (optional, 3x per day)
  - [ ] Level up rewards
- [ ] **Coin Sinks**
  - [ ] Match entry fees (10, 50, 100, 500, 1000)
  - [ ] Cue purchases
  - [ ] Table unlocks (higher tiers)
- [ ] **Bankruptcy Protection**
  - [ ] If coins < 10, grant 50 coins (1x per day)
  - [ ] Tutorial reminder: "Play lower stakes to rebuild"

**Deliverable**: Working economy with coins, gems, daily rewards, match stakes

### Milestone 13: Clubs & Progression
**Duration**: 2-3 weeks

- [ ] **Clubs System** (like 8 Ball Pool's rooms)
  - [ ] Club 1: Rookie Room (10 coin entry, unlock at level 1)
  - [ ] Club 2: Amateur Hall (50 coin entry, unlock at level 5)
  - [ ] Club 3: Pro Club (100 coin entry, unlock at level 10)
  - [ ] Club 4: Elite Lounge (500 coin entry, unlock at level 20)
  - [ ] Club 5: Champion Arena (1000 coin entry, unlock at level 30)
- [ ] **Club Features**
  - [ ] Each club has unique table theme (felt color, rail design)
  - [ ] Higher clubs = higher skill opponents (matchmaking pools)
  - [ ] Visual progression (locked clubs show requirements)
- [ ] **XP & Leveling**
  - [ ] Earn XP for matches (win = 100 XP, loss = 25 XP)
  - [ ] Level up unlocks clubs, cues, cosmetics
  - [ ] Level rewards (coins, gems, cues)
  - [ ] Max level: 50 (for now, can increase later)
- [ ] **Trophy System**
  - [ ] Win match → +trophies (amount based on opponent's trophies)
  - [ ] Lose match → -trophies
  - [ ] Club unlock based on trophy count (alternative to level)
  - [ ] Leaderboard ranks by trophies
- [ ] **Leaderboards**
  - [ ] Global leaderboard (top 100 by trophies)
  - [ ] Weekly leaderboard (resets Monday, rewards top 10)
  - [ ] Friends leaderboard
  - [ ] Club-specific leaderboards

**Deliverable**: Clubs unlocking, XP/leveling, trophy system, leaderboards

---

## Phase 4: Monetization & Live Ops (Month 5)

**Goal**: Implement F2P monetization systems (non-P2W)

### Milestone 14: In-App Purchases
**Duration**: 2-3 weeks

- [ ] **IAP Setup**
  - [ ] Integrate Apple In-App Purchase (StoreKit)
  - [ ] Integrate Google Play Billing
  - [ ] Server-side receipt validation (prevent fraud)
- [ ] **Gem Packs**
  - [ ] Starter Pack: $0.99 → 100 gems (first-purchase bonus: +50 gems)
  - [ ] Small Pack: $4.99 → 550 gems
  - [ ] Medium Pack: $9.99 → 1200 gems
  - [ ] Large Pack: $19.99 → 2500 gems
  - [ ] Mega Pack: $49.99 → 7000 gems (best value)
- [ ] **Coin Packs** (purchasable with gems)
  - [ ] 1000 coins = 100 gems
  - [ ] 5000 coins = 450 gems (10% discount)
  - [ ] 10000 coins = 800 gems (20% discount)
- [ ] **No Pay-to-Win**
  - [ ] Gems CANNOT buy better physics (no aim assist, no power boost)
  - [ ] Gems buy cosmetics, time-savers, variety (cues, tables, emotes)
  - [ ] All gameplay cues available via coins (grinding path)

**Deliverable**: Working IAP for gems, coin packs, server validation

### Milestone 15: Cue Collection & Customization
**Duration**: 2-3 weeks

- [ ] **Cue Rarity Tiers**
  - [ ] Common (gray) - Starting cues, low cost
  - [ ] Rare (blue) - Mid-tier, unlock via level or coins
  - [ ] Epic (purple) - High-tier, unlock via gems or achievements
  - [ ] Legendary (gold) - Premium, gems only or season pass
- [ ] **Cue Stats** (visual only, NO gameplay advantage)
  - [ ] All cues have identical physics
  - [ ] Stats are cosmetic labels: "Power", "Spin", "Aim" (all = 100)
  - [ ] Players understand: "It's all skill, not stats"
- [ ] **Cue Shop**
  - [ ] Browse cues by rarity
  - [ ] Preview cue in 3D viewer
  - [ ] Purchase with coins or gems
  - [ ] "Equip" to use in matches
- [ ] **Table Themes**
  - [ ] Unlock alternate table felts (red, blue, green, black)
  - [ ] Unlock rail designs (wood, marble, neon)
  - [ ] Purchase with coins or gems
- [ ] **Ball Skins** (optional, may defer)
  - [ ] Themed ball sets (e.g., galaxy, neon, sports teams)
  - [ ] Purchasable with gems

**Deliverable**: Cue shop, cosmetic cues, table themes, all cosmetic (no P2W)

### Milestone 16: Season Pass
**Duration**: 2-3 weeks

- [ ] **Season Structure**
  - [ ] Season length: 4 weeks
  - [ ] 50 tier progression (1 tier per ~10 matches)
  - [ ] Free track + Premium track
- [ ] **Season Pass Tiers**
  - [ ] Free Track: Coins, common cues, small gem rewards
  - [ ] Premium Track: Epic/legendary cues, gems, exclusive cosmetics
  - [ ] Premium cost: $9.99 (or 1000 gems)
- [ ] **Season Challenges**
  - [ ] Daily: "Win 1 match" → 50 coins
  - [ ] Daily: "Sink 5 balls" → 25 coins
  - [ ] Weekly: "Win 10 matches" → 200 coins + 1 tier skip
  - [ ] Weekly: "Win a match in Club 3+" → Epic cue
- [ ] **Season Rewards**
  - [ ] Tier 10: Rare cue (free track)
  - [ ] Tier 25: 500 coins (free), Epic cue (premium)
  - [ ] Tier 50: Legendary cue (premium), 1000 coins (free)
- [ ] **Season Themes**
  - [ ] Each season has a theme (e.g., "Neon Nights", "Wild West", "Ocean")
  - [ ] Themed cues, tables, emotes
  - [ ] Marketing assets for each season

**Deliverable**: Working season pass with free/premium tracks, timed challenges

---

## Phase 5: Social & Retention (Month 6)

**Goal**: Add social features to increase retention and virality

### Milestone 17: Friends & Social
**Duration**: 2-3 weeks

- [ ] **Friends System**
  - [ ] Add friend by username or friend code
  - [ ] Friend requests (send, accept, decline)
  - [ ] Friends list (online status, last played)
  - [ ] Unfriend option
- [ ] **Friend Challenges**
  - [ ] Challenge friend to 1v1 match
  - [ ] Custom stakes for friendly matches (or no stakes)
  - [ ] Challenge notifications (push notification or in-app)
- [ ] **Chat & Emotes**
  - [ ] Pre-match lobby chat (text, 100 char limit)
  - [ ] In-match emotes (8 slots: GG, Nice Shot, Oops, Thinking, etc.)
  - [ ] No mid-match text chat (reduces toxicity)
  - [ ] Mute opponent option
- [ ] **Gifting**
  - [ ] Send coins to friends (max 100/day to prevent abuse)
  - [ ] Gift cues (purchased cues only, not unlocked ones)
  - [ ] Notification when gift received
- [ ] **Clans/Clubs** (optional, may defer to Phase 6)
  - [ ] Create clan (100 gems or 5000 coins)
  - [ ] Invite friends to clan
  - [ ] Clan leaderboard (aggregate trophies)
  - [ ] Clan chat

**Deliverable**: Friends system, challenges, emotes, gifting

### Milestone 18: Retention Mechanics
**Duration**: 2-3 weeks

- [ ] **Win Streak**
  - [ ] Track consecutive wins
  - [ ] Bonus rewards at 3, 5, 10, 25 win streaks
  - [ ] Streak display in profile (bragging rights)
  - [ ] Streak protection: 1 free loss per week (gems or premium perk)
- [ ] **Daily Login Rewards**
  - [ ] Day 1: 50 coins
  - [ ] Day 2: 75 coins
  - [ ] Day 3: 100 coins
  - [ ] Day 7: 250 coins + 10 gems
  - [ ] Animated reward modal on login
- [ ] **Quest System**
  - [ ] 3 daily quests (auto-refresh at midnight)
  - [ ] 3 weekly quests (refresh Monday)
  - [ ] Examples:
    - "Win 5 matches" → 100 coins
    - "Sink 20 balls" → 50 coins
    - "Play in Club 3" → 75 coins
  - [ ] Quest UI (progress bars, claim button)
- [ ] **Lucky Spin** (free daily reward wheel)
  - [ ] Spin wheel once per day (free)
  - [ ] Prizes: 50-500 coins, 5-25 gems, cues, table themes
  - [ ] Additional spins: 50 gems each
  - [ ] Animated wheel with suspense
- [ ] **Push Notifications**
  - [ ] "Your daily reward is ready!"
  - [ ] "Friend challenged you to a match!"
  - [ ] "Season ending in 2 days!"
  - [ ] "Your energy is full!" (if energy system added later)
  - [ ] User can toggle notification types

**Deliverable**: Win streak, daily login, quests, lucky spin, push notifications

---

## Phase 6: Events & Live Ops (Month 7)

**Goal**: Add limited-time events to create urgency and FOMO

### Milestone 19: Tournament Mode
**Duration**: 2-3 weeks

- [ ] **Single-Elimination Tournaments**
  - [ ] 8-player bracket (3 rounds to win)
  - [ ] Entry fee: 100 coins
  - [ ] Prize pool: 600 coins (1st), 200 coins (2nd)
  - [ ] Auto-matchmake 8 players, start when full
- [ ] **Swiss-Style Tournaments** (optional)
  - [ ] 16 players, 4 rounds
  - [ ] Pairing based on record (1-0 plays 1-0, etc.)
  - [ ] Top 4 by record get prizes
- [ ] **Tournament UI**
  - [ ] Bracket visualization
  - [ ] "Live" indicator for active matches
  - [ ] Spectator mode (watch friend's tournament match)
  - [ ] Tournament history (past results)
- [ ] **Scheduled Tournaments**
  - [ ] Hourly free tournaments (no entry fee, small prizes)
  - [ ] Daily premium tournaments (200 coin entry, big prizes)
  - [ ] Weekend grand tournaments (500 coin entry, legendary cues)

**Deliverable**: Working tournament mode with brackets, prizes, scheduling

### Milestone 20: Seasonal Events
**Duration**: 2-3 weeks

- [ ] **Event Types**
  - [ ] **Weekend Brawl** (VIP Brawl-style)
    - Fri-Sun, ticket entry (100 gems or 5000 coins)
    - Leaderboard by wins
    - Top 3 get Crown cosmetic (visible in profile until next event)
  - [ ] **Win Streak Challenge**
    - 4-day event, chain wins for escalating rewards
    - 3 wins → 100 coins
    - 5 wins → 250 coins
    - 10 wins → Epic cue
  - [ ] **Themed Challenges**
    - Halloween: "Spooky Shots" (special table, themed cues)
    - Xmas: "Holiday Hustle" (snow table, gift cues)
- [ ] **Event UI**
  - [ ] Event banner on home screen
  - [ ] Timer showing time remaining
  - [ ] Leaderboard with live rankings
  - [ ] Reward preview
- [ ] **Limited-Time Offers**
  - [ ] Black Friday: 50% off all gem packs
  - [ ] Season start: Premium pass + bonus tier for $14.99
  - [ ] Event bundles: Themed cue + table for 500 gems

**Deliverable**: Weekend events, themed challenges, limited offers

---

## Phase 7: Polish & Soft Launch (Month 8)

**Goal**: Final polish, stability, onboarding, soft launch in 1-2 markets

### Milestone 21: Onboarding & Tutorial
**Duration**: 2 weeks

- [ ] **Tutorial Flow**
  - [ ] Step 1: "Aim with your finger"
  - [ ] Step 2: "Drag power slider to set power"
  - [ ] Step 3: "Sink the stripes to win"
  - [ ] Step 4: "Don't sink the 8-ball early!"
  - [ ] Reward: 500 coins + Common cue
- [ ] **FTUE (First-Time User Experience)**
  - [ ] Auto-start tutorial on first launch
  - [ ] Skip button (for returning players or impatient users)
  - [ ] Tooltips for UI elements (clubs, shop, quests)
  - [ ] Progressive disclosure (don't show everything at once)
- [ ] **Returning Player Experience**
  - [ ] "Welcome back!" modal with daily reward
  - [ ] Highlight new features since last login
  - [ ] Show friends who are online

**Deliverable**: Polished onboarding, tutorial, FTUE

### Milestone 22: Stability & Performance
**Duration**: 2 weeks

- [ ] **Performance Optimization**
  - [ ] Reduce texture memory (compress ball textures)
  - [ ] Lazy load 3D assets (only load when needed)
  - [ ] Object pooling (reuse balls, avoid GC)
  - [ ] Profile on low-end devices, optimize bottlenecks
- [ ] **Crash Reporting**
  - [ ] Integrate Sentry or Bugsnag
  - [ ] Track crash rate (target: <0.1%)
  - [ ] Monitor ANRs (Android Not Responding)
- [ ] **Analytics**
  - [ ] Integrate Firebase Analytics or Amplitude
  - [ ] Track key events:
    - App open, match start, match end, coins earned, IAP
  - [ ] Track funnels:
    - Install → Tutorial → First match → Second match → IAP
  - [ ] Monitor retention (D1, D7, D30)
- [ ] **Testing**
  - [ ] QA pass on iOS (iPhone 12+, iPad)
  - [ ] QA pass on Android (Samsung, Pixel, OnePlus)
  - [ ] Load testing (1000 concurrent matches on server)
  - [ ] Edge case testing (disconnect mid-match, timeout, etc.)

**Deliverable**: Stable build with crash reporting, analytics, tested on devices

### Milestone 23: Soft Launch
**Duration**: 2 weeks

- [ ] **Soft Launch Markets**
  - [ ] Canada (English-speaking, smaller market)
  - [ ] Philippines (large mobile gaming market, low CPI)
- [ ] **App Store Optimization**
  - [ ] Icon (A/B test 2-3 variants)
  - [ ] Screenshots (5-6 showing key features)
  - [ ] App preview video (15-30s gameplay)
  - [ ] Description (keywords: pool, billiards, 8-ball, multiplayer)
- [ ] **Launch Metrics to Track**
  - [ ] Install conversion rate (store page → install)
  - [ ] D1 retention (% who return next day)
  - [ ] D7 retention (% who return after 1 week)
  - [ ] ARPU (average revenue per user)
  - [ ] Session length, sessions per day
- [ ] **Iterate Based on Data**
  - [ ] If D1 retention < 40%: improve onboarding
  - [ ] If ARPU < $0.10: test IAP pricing, add more sinks
  - [ ] If session length < 10 min: add more hooks (quests, events)

**Deliverable**: Soft launch in 2 markets, data-driven iteration

---

## Phase 8: Global Launch & Growth (Month 9+)

**Goal**: Scale to global launch, growth marketing, live ops cadence

### Milestone 24: Global Launch
- [ ] Expand to all markets (US, EU, Asia, LATAM)
- [ ] Localization (Spanish, French, German, Portuguese, Chinese, Japanese)
- [ ] Launch marketing (influencer partnerships, ads, PR)
- [ ] Monitor server load, scale infrastructure

### Milestone 25: Live Ops Cadence (Ongoing)
- [ ] Weekly events (Win Streak, Weekend Brawl)
- [ ] Monthly seasons (new themes, cues, pass rewards)
- [ ] Quarterly major updates (new modes, features)
- [ ] Community engagement (social media, Discord, Reddit)

### Milestone 26: Advanced Features (Post-Launch)
- [ ] **9-Ball Mode** (from stretch goals in specs.md)
- [ ] **AI Opponent** (practice vs bot, from stretch goals)
- [ ] **English/Spin** (advanced shot control, from stretch goals)
- [ ] **Clans** (guilds, clan wars, clan leaderboards)
- [ ] **Spectator Mode** (watch live matches, esports potential)
- [ ] **Replays** (save & share epic shots)
- [ ] **Custom Tables** (user-created themes via editor)
- [ ] **Cross-Platform** (web, mobile, desktop sync)

---

## Success Metrics

### Engagement
- **D1 Retention**: >40% (industry avg: 30-35%)
- **D7 Retention**: >20% (industry avg: 15-20%)
- **D30 Retention**: >10%
- **Session Length**: >15 min
- **Sessions/Day**: >3

### Monetization
- **Conversion Rate**: >3% (% who make IAP)
- **ARPU**: >$0.50 (all users)
- **ARPPU**: >$15 (paying users only)
- **LTV (Lifetime Value)**: >$5

### Quality
- **Crash Rate**: <0.1%
- **App Store Rating**: >4.5 stars
- **NPS (Net Promoter Score)**: >50

---

## Team & Resources

### Solo/Small Team Path
If building solo or with 1-2 devs:
- **Prioritize**: Phases 1-4 (mobile, multiplayer, economy, basic monetization)
- **Defer**: Clans, advanced events, localization
- **Tools**: Use no-code/low-code where possible (Firebase for backend, Capacitor for mobile)

### Larger Team Path
If building with 3-5+ devs:
- **Parallelize**: Work on mobile (1 dev), backend (1 dev), economy (1 dev) simultaneously
- **Add**: Dedicated designer for UI/UX, marketing for ASO/UA
- **Tools**: Custom backend (Node.js), native mobile (React Native or Flutter)

---

## Risk Mitigation

### Technical Risks
- **Physics on mobile**: Solved (already runs at 120 UPS on web, should port fine)
- **Real-time sync**: Use battle-tested libraries (Socket.io, Colyseus)
- **Cheating**: Server-authoritative physics prevents client-side hacks

### Business Risks
- **Monetization balance**: No P2W, only cosmetics (preserves competitive integrity)
- **Retention**: Multi-layered hooks (streaks, quests, events, seasons, friends)
- **Market saturation**: Differentiate with "tournament-grade physics" messaging

### Execution Risks
- **Scope creep**: Stick to roadmap, defer nice-to-haves
- **Burnout**: Set realistic timelines, celebrate milestones
- **Tech debt**: Maintain code quality, refactor as you go

---

## Next Steps

1. **Review this roadmap**: Adjust timelines, priorities, or scope
2. **Choose tech stack**: Capacitor vs React Native for mobile
3. **Start Milestone 8**: Mobile platform setup
4. **Set up project tracking**: GitHub Projects or Linear for task management
5. **Create design mockups**: Mobile UI wireframes, icon, screenshots

**Ready to start? Let's build!**

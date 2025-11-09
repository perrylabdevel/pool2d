// Configurable rules for 8-Ball gameplay
// Allows switching between casual, tournament, and custom rulesets

export interface RulesConfig {
  // Core rules (always enforced)
  enforceGroupAssignment: boolean;        // Must shoot your group (solids/stripes)
  enforceEarly8BallLoss: boolean;         // Pocketing 8-ball early = loss

  // Break rules
  requireLegalBreak: boolean;             // Must drive 4+ balls to rails or pocket ball
  allow8BallBreakWin: boolean;            // Pocketing 8-ball on break = win
  scratch8BallOnBreakLoss: boolean;       // Scratch while pocketing 8-ball on break = loss

  // Shot rules
  requireRailContact: boolean;            // If no ball pocketed, must hit rail
  requireCalledShots: boolean;            // Must call pocket for every shot
  requireCalled8Ball: boolean;            // Must call pocket for 8-ball only
  allowSlop: boolean;                     // Accidentally pocketed balls count

  // Ball-in-hand rules
  ballInHandAnywhere: boolean;            // true = anywhere, false = behind head string after break scratch

  // Advanced rules
  enablePushOut: boolean;                 // Allow push-out after break
  enableThreeFoulRule: boolean;           // Three consecutive fouls = loss
  shotClockSeconds: number;               // 0 = disabled, >0 = time limit per shot

  // Foul penalties
  scratchIsFoul: boolean;                 // Pocketing cue ball = foul
  noContactIsFoul: boolean;               // Not hitting any ball = foul
  wrongBallFirstIsFoul: boolean;          // Hitting opponent's ball first = foul
}

// Preset configurations
export const RULES_PRESETS: { [key: string]: RulesConfig } = {
  // Casual bar rules - relaxed, slop counts, no rail contact
  CASUAL: {
    enforceGroupAssignment: true,
    enforceEarly8BallLoss: true,

    requireLegalBreak: false,
    allow8BallBreakWin: true,
    scratch8BallOnBreakLoss: true,

    requireRailContact: false,
    requireCalledShots: false,
    requireCalled8Ball: false,
    allowSlop: true,

    ballInHandAnywhere: true,

    enablePushOut: false,
    enableThreeFoulRule: false,
    shotClockSeconds: 0,

    scratchIsFoul: true,
    noContactIsFoul: true,
    wrongBallFirstIsFoul: true,
  },

  // BCA/WPA tournament rules - strict
  TOURNAMENT: {
    enforceGroupAssignment: true,
    enforceEarly8BallLoss: true,

    requireLegalBreak: true,
    allow8BallBreakWin: true,
    scratch8BallOnBreakLoss: true,

    requireRailContact: true,
    requireCalledShots: false,              // Only 8-ball needs to be called in BCA
    requireCalled8Ball: true,
    allowSlop: false,

    ballInHandAnywhere: false,              // Kitchen only after break scratch

    enablePushOut: true,
    enableThreeFoulRule: true,
    shotClockSeconds: 60,

    scratchIsFoul: true,
    noContactIsFoul: true,
    wrongBallFirstIsFoul: true,
  },

  // APA league rules - middle ground
  APA: {
    enforceGroupAssignment: true,
    enforceEarly8BallLoss: true,

    requireLegalBreak: true,
    allow8BallBreakWin: true,
    scratch8BallOnBreakLoss: true,

    requireRailContact: false,              // APA doesn't require rail contact
    requireCalledShots: false,
    requireCalled8Ball: true,               // 8-ball must be called
    allowSlop: true,

    ballInHandAnywhere: true,

    enablePushOut: false,
    enableThreeFoulRule: false,
    shotClockSeconds: 0,

    scratchIsFoul: true,
    noContactIsFoul: true,
    wrongBallFirstIsFoul: true,
  },

  // Practice mode - very relaxed, focus on learning
  PRACTICE: {
    enforceGroupAssignment: false,          // Can shoot any ball
    enforceEarly8BallLoss: false,

    requireLegalBreak: false,
    allow8BallBreakWin: true,
    scratch8BallOnBreakLoss: false,

    requireRailContact: false,
    requireCalledShots: false,
    requireCalled8Ball: false,
    allowSlop: true,

    ballInHandAnywhere: true,

    enablePushOut: false,
    enableThreeFoulRule: false,
    shotClockSeconds: 0,

    scratchIsFoul: true,                    // Still penalize scratches
    noContactIsFoul: false,                 // Allow no contact for experimentation
    wrongBallFirstIsFoul: false,
  },
};

// Default config (casual rules)
export function getDefaultRulesConfig(): RulesConfig {
  return { ...RULES_PRESETS.CASUAL };
}

// Helper to validate config
export function validateRulesConfig(config: RulesConfig): boolean {
  if (config.shotClockSeconds < 0) return false;
  if (config.requireCalledShots && !config.requireCalled8Ball) {
    // If all shots must be called, 8-ball definitely must be called
    config.requireCalled8Ball = true;
  }
  return true;
}

// Helper to get config description
export function getRulesDescription(config: RulesConfig): string {
  // Try to match a preset
  for (const [name, preset] of Object.entries(RULES_PRESETS)) {
    if (JSON.stringify(preset) === JSON.stringify(config)) {
      return name;
    }
  }
  return 'CUSTOM';
}

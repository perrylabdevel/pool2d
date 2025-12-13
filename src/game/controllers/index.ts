/**
 * Game Controllers
 * 
 * Extracted controllers from the monolithic Game.ts
 */

export {
  type ShootingState,
  type ShootingDependencies,
  createInitialShootingState,
  calculateAimSensitivity,
  isTouchAimOnly,
  getMicroAimOffsetDegrees,
  getMicroAimOffsetRadians,
  applyMicroAimOffset,
  setMicroAimDialValue,
  executeShot,
  resetAfterShotComplete,
  resetShootingState,
  toggleAimMode,
  enterSpacePowerMode,
  exitSpacePowerMode,
} from './ShootingController';

export {
  type BallInHandState,
  type BallInHandDependencies,
  type BallInHandPlacement,
  createInitialBallInHandState,
  isInKitchen,
  applyKitchenLimit,
  clampToPlayArea,
  isSpotOpen,
  getAIPlacementCandidates,
  findAIPlacement,
  placeCueBall,
  startDrag,
  endDrag,
  setPendingForAI,
  setPlacement,
  resetBallInHandState,
} from './BallInHandController';

export {
  type AIState,
  type AIShotAnimation,
  type AIShotAnimPhase,
  type AISelectedShot,
  type AIUpdateResult,
  createInitialAIState,
  startAIThinking,
  resetAIState,
  createShotAnimation,
  updateAITurn,
} from './AIController';

export {
  type MatchState,
  type MatchResultData,
  type MatchEndParams,
  createInitialMatchState,
  startMatch,
  endMatch,
  resetMatchState,
  calculateEarnings,
  createMatchRecord,
  awardChestForWin,
  processMatchEnd,
  getWinnerMessage,
  isMatchInProgress,
} from './MatchManager';

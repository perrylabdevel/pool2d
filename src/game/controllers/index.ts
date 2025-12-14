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
  type ScreenToWorldDeps,
  createInitialBallInHandState,
  isInKitchen,
  applyKitchenLimit as applyKitchenLimitBIH,
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
  screenToWorld,
  isClickOnCueBall,
  processDragPosition,
  applyDragToCueBall,
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

export {
  type PocketCallState,
  type PocketChoice,
  type PocketCallDeps,
  createInitialPocketCallState,
  getPocketLabel,
  getPocketChoices,
  requiresPocketCall,
  shouldPromptPocketCall,
  shouldBlockShot,
  pickNearestPocketId,
  handlePocketClick,
  setCalledPocket,
  startWaitingForPocketCall,
  clearPocketCallAfterShot,
  resetPocketCallState,
} from './PocketCallController';

export {
  type PowerBarState,
  type MicroDialState,
  type InputControllerDeps,
  createInitialPowerBarState,
  createInitialMicroDialState,
  handlePowerBarMouseDown,
  handlePowerBarMouseMove,
  handlePowerBarMouseUp,
  handleMicroDialMouseDown,
  handleMicroDialMouseMove,
  handleMicroDialMouseUp,
  getMicroAimOffsetDegrees as getInputMicroAimOffsetDegrees,
  getMicroAimOffsetRadians as getInputMicroAimOffsetRadians,
  applyMicroAimOffset as applyInputMicroAimOffset,
} from './InputController';

export {
  type TurnState,
  type TurnControllerDeps,
  createInitialTurnState,
  switchToPlayer,
  checkTurnChange,
  handleBreakTransition,
  isCurrentShooterAI,
  getCurrentPlayer,
  getRemainingBallsForGroup,
  getAllRemainingBalls,
  resetAIState as resetTurnAIState,
  setAISelectedShot,
  clearAISelectedShot,
} from './TurnController';

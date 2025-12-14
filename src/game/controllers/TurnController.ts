/**
 * TurnController - Turn-based gameplay logic extracted from Game.ts
 * 
 * Handles:
 * - Player switching
 * - Turn state management
 * - Shot completion logic
 */

import { Ball } from '../../physics/Shapes';
import { Player, BallGroup } from '../Player';
import { GameState } from '../GameStateMachine';

export interface TurnState {
  currentPlayerIndex: number;
  aiThinkingStartTime: number;
  aiSelectedShot: any | null;
}

export interface TurnControllerDeps {
  players: Player[];
  stateMachine: { 
    state: GameState; 
    isAITurn: () => boolean;
    transitionTo: (state: GameState) => void;
    switchPlayer: (player: Player) => void;
  } | null;
  rules: {
    currentPlayer: number;
    gameState: any;
    hasPlayerClearedGroup: (playerId: number, balls: Ball[]) => boolean;
  };
  hud: {
    setTurn: (playerId: number, isAI?: boolean) => void;
    showAIThinking: () => void;
  };
}

/**
 * Create initial turn state
 */
export function createInitialTurnState(): TurnState {
  return {
    currentPlayerIndex: 0,
    aiThinkingStartTime: 0,
    aiSelectedShot: null,
  };
}

/**
 * Switch to a specific player
 */
export function switchToPlayer(
  playerIndex: number,
  state: TurnState,
  deps: TurnControllerDeps
): TurnState {
  const newState = { ...state, currentPlayerIndex: playerIndex };
  const currentPlayer = deps.players[playerIndex];

  if (deps.stateMachine) {
    deps.stateMachine.switchPlayer(currentPlayer);

    if (currentPlayer.isAI()) {
      deps.stateMachine.transitionTo(GameState.AI_TURN);
      deps.hud.setTurn(currentPlayer.id, true);
      deps.hud.showAIThinking();
      return {
        ...newState,
        aiThinkingStartTime: performance.now(),
        aiSelectedShot: null,
      };
    } else {
      deps.stateMachine.transitionTo(GameState.PLAYER_TURN);
      deps.hud.setTurn(currentPlayer.id, false);
    }
  }

  return newState;
}

/**
 * Check if turn should change based on rules state
 * Returns new player index if turn changed, or current index if same player continues
 */
export function checkTurnChange(
  state: TurnState,
  deps: TurnControllerDeps
): { shouldSwitch: boolean; newPlayerIndex: number } {
  const currentPlayer = deps.players[state.currentPlayerIndex];
  
  if (deps.rules.currentPlayer !== currentPlayer.id) {
    // Turn changed
    return {
      shouldSwitch: true,
      newPlayerIndex: deps.rules.currentPlayer - 1,
    };
  }

  return {
    shouldSwitch: false,
    newPlayerIndex: state.currentPlayerIndex,
  };
}

/**
 * Handle transition from BREAK state to appropriate turn state
 */
export function handleBreakTransition(
  state: TurnState,
  deps: TurnControllerDeps
): TurnState {
  if (!deps.stateMachine) return state;
  if (deps.stateMachine.state !== GameState.BREAK) return state;

  const currentPlayer = deps.players[state.currentPlayerIndex];

  if (currentPlayer.isAI()) {
    deps.stateMachine.transitionTo(GameState.AI_TURN);
    deps.hud.setTurn(currentPlayer.id, true);
    deps.hud.showAIThinking();
    return {
      ...state,
      aiThinkingStartTime: performance.now(),
      aiSelectedShot: null,
    };
  } else {
    deps.stateMachine.transitionTo(GameState.PLAYER_TURN);
    deps.hud.setTurn(currentPlayer.id, false);
  }

  return state;
}

/**
 * Check if current shooter is AI
 */
export function isCurrentShooterAI(
  state: TurnState,
  deps: Pick<TurnControllerDeps, 'players' | 'stateMachine'>
): boolean {
  if (deps.players.length === 0) return false;
  if (state.currentPlayerIndex < 0 || state.currentPlayerIndex >= deps.players.length) {
    return false;
  }

  const player = deps.players[state.currentPlayerIndex];
  return player.isAI();
}

/**
 * Get current player
 */
export function getCurrentPlayer(
  state: TurnState,
  deps: Pick<TurnControllerDeps, 'players'>
): Player | null {
  if (deps.players.length === 0) return null;
  if (state.currentPlayerIndex < 0 || state.currentPlayerIndex >= deps.players.length) {
    return null;
  }
  return deps.players[state.currentPlayerIndex];
}

/**
 * Compute remaining balls for a player group
 */
export function getRemainingBallsForGroup(
  group: BallGroup | null,
  balls: Ball[]
): number[] | null {
  if (group === null) return null;
  
  const targetIds = group === BallGroup.SOLIDS
    ? [1, 2, 3, 4, 5, 6, 7]
    : [9, 10, 11, 12, 13, 14, 15];
    
  return targetIds.filter(id => {
    const b = balls.find(x => x.id === id);
    return b && !b.pocketed;
  });
}

/**
 * Get all remaining balls on table (excluding cue ball)
 */
export function getAllRemainingBalls(balls: Ball[]): number[] {
  return balls
    .filter(b => b.id > 0 && !b.pocketed)
    .map(b => b.id);
}

/**
 * Reset AI shot state for new turn
 */
export function resetAIState(state: TurnState): TurnState {
  return {
    ...state,
    aiThinkingStartTime: performance.now(),
    aiSelectedShot: null,
  };
}

/**
 * Set AI selected shot
 */
export function setAISelectedShot(state: TurnState, shot: any): TurnState {
  return {
    ...state,
    aiSelectedShot: shot,
  };
}

/**
 * Clear AI selected shot after execution
 */
export function clearAISelectedShot(state: TurnState): TurnState {
  return {
    ...state,
    aiSelectedShot: null,
  };
}

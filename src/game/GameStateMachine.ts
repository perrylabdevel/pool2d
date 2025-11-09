// Game state machine for managing turn-based flow

import { Player } from './Player';

export enum GameState {
  BREAK,           // Opening break shot
  PLAYER_TURN,     // Player is shooting
  AI_TURN,         // AI is shooting
  BALL_IN_HAND,    // Placing cue ball after foul
  GAME_OVER,       // Match finished
  PAUSED,          // Game paused
}

export enum FoulType {
  SCRATCH,         // Cue ball pocketed
  NO_BALL_HIT,     // No ball contacted
  WRONG_BALL,      // Wrong group hit first
  EIGHT_BALL_EARLY, // 8-ball pocketed before clearing group
}

export interface GameStateData {
  currentPlayer: Player;
  currentState: GameState;
  turnNumber: number;
  shotClock: number;
  lastFoul: FoulType | null;
}

export type StateChangeCallback = (newState: GameState, oldState: GameState) => void;

export class GameStateMachine {
  state: GameState;
  data: GameStateData;
  private stateChangeCallbacks: StateChangeCallback[] = [];

  constructor(initialPlayer: Player) {
    this.state = GameState.BREAK;
    this.data = {
      currentPlayer: initialPlayer,
      currentState: GameState.BREAK,
      turnNumber: 1,
      shotClock: 0,
      lastFoul: null,
    };
  }

  /**
   * Register a callback to be called when state changes
   */
  onStateChange(callback: StateChangeCallback): void {
    this.stateChangeCallbacks.push(callback);
  }

  /**
   * Transition to a new state
   */
  transitionTo(newState: GameState): void {
    const oldState = this.state;

    if (oldState === newState) {
      return; // No transition needed
    }

    this.state = newState;
    this.data.currentState = newState;

    // Reset shot clock on state change
    this.data.shotClock = 0;

    // Notify callbacks
    this.stateChangeCallbacks.forEach(cb => cb(newState, oldState));
  }

  /**
   * Handle break shot state
   */
  onBreak(): void {
    this.transitionTo(GameState.BREAK);
    this.data.turnNumber = 1;
    this.data.lastFoul = null;
  }

  /**
   * Handle player turn
   */
  onPlayerTurn(): void {
    this.transitionTo(GameState.PLAYER_TURN);
  }

  /**
   * Handle AI turn
   */
  onAITurn(): void {
    this.transitionTo(GameState.AI_TURN);
  }

  /**
   * Handle ball-in-hand after foul
   */
  onBallInHand(foulType: FoulType): void {
    this.data.lastFoul = foulType;
    this.transitionTo(GameState.BALL_IN_HAND);
  }

  /**
   * Handle game over
   */
  onGameOver(winner: Player): void {
    this.data.currentPlayer = winner;
    this.transitionTo(GameState.GAME_OVER);
  }

  /**
   * Switch to the next player
   */
  switchPlayer(nextPlayer: Player): void {
    this.data.currentPlayer = nextPlayer;
    this.data.turnNumber++;
  }

  /**
   * Update shot clock (in seconds)
   */
  updateShotClock(deltaTime: number): void {
    this.data.shotClock += deltaTime;
  }

  /**
   * Reset shot clock
   */
  resetShotClock(): void {
    this.data.shotClock = 0;
  }

  /**
   * Check if game is in progress
   */
  isPlaying(): boolean {
    return this.state !== GameState.GAME_OVER && this.state !== GameState.PAUSED;
  }

  /**
   * Check if it's currently a player's turn (human or AI)
   */
  isPlayerTurn(): boolean {
    return this.state === GameState.PLAYER_TURN;
  }

  /**
   * Check if it's currently AI's turn
   */
  isAITurn(): boolean {
    return this.state === GameState.AI_TURN;
  }

  /**
   * Check if waiting for ball-in-hand placement
   */
  isBallInHand(): boolean {
    return this.state === GameState.BALL_IN_HAND;
  }
}

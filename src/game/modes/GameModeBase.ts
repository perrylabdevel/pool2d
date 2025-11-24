// Base interface for game modes

import { Ball } from '../../physics/Shapes';

export interface GameModeConfig {
  name: string;
  description: string;
  allowBallDragging: boolean;
  showAimAssist: boolean;
  allowUndo: boolean;
}

export interface GameModeStats {
  shotsAttempted: number;
  shotsMade: number;
  timeElapsed: number;
  ballsPocketed: number;
  fouls: number;
}

export abstract class GameModeBase {
  config: GameModeConfig;
  stats: GameModeStats;
  isComplete: boolean = false;
  isPaused: boolean = false;

  constructor(config: GameModeConfig) {
    this.config = config;
    this.stats = {
      shotsAttempted: 0,
      shotsMade: 0,
      timeElapsed: 0,
      ballsPocketed: 0,
      fouls: 0,
    };
  }

  /**
   * Called when the mode starts
   */
  abstract onStart(): void;

  /**
   * Called when a shot is taken
   */
  abstract onShotTaken(_angle: number, _power: number): void;

  /**
   * Called when all balls come to rest after a shot
   */
  abstract onShotComplete(balls: Ball[]): void;

  /**
   * Called every frame to update mode-specific logic (timers, etc.)
   */
  abstract update(_dt: number): void;

  /**
   * Check if the mode has a win/lose condition met
   */
  abstract checkCompletion(balls: Ball[]): { isComplete: boolean; success: boolean; message?: string };

  /**
   * Get HUD overlay data to display (timer, score, etc.)
   */
  abstract getHUDData(): { [key: string]: string | number };

  /**
   * Reset the mode
   */
  reset(): void {
    this.stats = {
      shotsAttempted: 0,
      shotsMade: 0,
      timeElapsed: 0,
      ballsPocketed: 0,
      fouls: 0,
    };
    this.isComplete = false;
    this.isPaused = false;
  }

  /**
   * Pause the mode (stops timers, etc.)
   */
  pause(): void {
    this.isPaused = true;
  }

  /**
   * Resume the mode
   */
  resume(): void {
    this.isPaused = false;
  }
}

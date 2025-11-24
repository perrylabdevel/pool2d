// Time Attack mode - Clear all balls as fast as possible

import { Ball } from '../../physics/Shapes';
import { GameModeBase, GameModeConfig } from './GameModeBase';
import { BALL_CUE } from '../../config';

export enum TimeAttackDifficulty {
  EASY,     // Unlimited time, aim assist on
  MEDIUM,   // 10 minutes, aim assist on
  HARD,     // 5 minutes, no aim assist
}

export class TimeAttackMode extends GameModeBase {
  difficulty: TimeAttackDifficulty;
  timeLimit: number; // seconds, 0 = unlimited
  startTime: number = 0;
  bestTime: number = 0; // Track personal best

  constructor(difficulty: TimeAttackDifficulty = TimeAttackDifficulty.EASY) {
    const config: GameModeConfig = {
      name: 'Time Attack',
      description: 'Clear all balls as fast as possible',
      allowBallDragging: false,
      showAimAssist: difficulty !== TimeAttackDifficulty.HARD,
      allowUndo: false,
    };

    super(config);
    this.difficulty = difficulty;

    // Set time limits based on difficulty
    switch (difficulty) {
      case TimeAttackDifficulty.EASY:
        this.timeLimit = 0; // Unlimited
        break;
      case TimeAttackDifficulty.MEDIUM:
        this.timeLimit = 600; // 10 minutes
        break;
      case TimeAttackDifficulty.HARD:
        this.timeLimit = 300; // 5 minutes
        break;
    }
  }

  onStart(): void {
    this.startTime = performance.now();
    this.stats.timeElapsed = 0;
    console.log('⏱️ Time Attack started!');
  }

  onShotTaken(_angle: number, _power: number): void {
    this.stats.shotsAttempted++;
  }

  onShotComplete(balls: Ball[]): void {
    // Count pocketed balls (excluding cue ball)
    const pocketedCount = balls.filter(b => b.pocketed && b.id !== BALL_CUE).length;
    this.stats.ballsPocketed = pocketedCount;

    // Check if at least one ball was pocketed this shot
    const previousPocketed = this.stats.ballsPocketed;
    if (pocketedCount > previousPocketed) {
      this.stats.shotsMade++;
    }
  }

  update(_dt: number): void {
    if (this.isPaused || this.isComplete) return;

    // Update elapsed time
    this.stats.timeElapsed = (performance.now() - this.startTime) / 1000;
  }

  checkCompletion(balls: Ball[]): { isComplete: boolean; success: boolean; message?: string } {
    // Check if time limit exceeded
    if (this.timeLimit > 0 && this.stats.timeElapsed >= this.timeLimit) {
      this.isComplete = true;
      return {
        isComplete: true,
        success: false,
        message: 'Time\'s up! Try again.',
      };
    }

    // Check if all balls are pocketed (excluding cue ball)
    const allPocketed = balls.every(b => b.id === BALL_CUE || b.pocketed);

    if (allPocketed) {
      this.isComplete = true;
      const timeStr = this.formatTime(this.stats.timeElapsed);

      // Check if it's a new best time
      if (this.bestTime === 0 || this.stats.timeElapsed < this.bestTime) {
        this.bestTime = this.stats.timeElapsed;
        return {
          isComplete: true,
          success: true,
          message: `🏆 New Best Time: ${timeStr}!`,
        };
      }

      return {
        isComplete: true,
        success: true,
        message: `✓ Completed in ${timeStr}`,
      };
    }

    return { isComplete: false, success: false };
  }

  getHUDData(): { [key: string]: string | number } {
    const data: { [key: string]: string | number } = {
      'Time': this.formatTime(this.stats.timeElapsed),
      'Balls': `${this.stats.ballsPocketed}/15`,
      'Shots': this.stats.shotsAttempted,
    };

    // Show time limit if not unlimited
    if (this.timeLimit > 0) {
      const remaining = Math.max(0, this.timeLimit - this.stats.timeElapsed);
      data['Time Remaining'] = this.formatTime(remaining);
    }

    if (this.bestTime > 0) {
      data['Best'] = this.formatTime(this.bestTime);
    }

    return data;
  }

  private formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  }

  reset(): void {
    super.reset();
    this.startTime = performance.now();
  }
}

// Perfect Game mode - Run the table without missing

import { Ball } from '../../physics/Shapes';
import { GameModeBase, GameModeConfig } from './GameModeBase';
import { BALL_CUE } from '../../config';

export class PerfectGameMode extends GameModeBase {
  currentStreak: number = 0;
  bestStreak: number = 0;
  attemptNumber: number = 1;
  lastShotPocketedBall: boolean = false;

  constructor() {
    const config: GameModeConfig = {
      name: 'Perfect Game',
      description: 'Run the table without missing a single shot',
      allowBallDragging: true, // Ball-in-hand after break
      showAimAssist: true,
      allowUndo: false,
    };

    super(config);
  }

  onStart(): void {
    this.currentStreak = 0;
    this.attemptNumber = 1;
    this.stats.timeElapsed = 0;
    console.log('🎯 Perfect Game started! Run the table without missing.');
  }

  onShotTaken(_angle: number, _power: number): void {
    this.stats.shotsAttempted++;
    this.lastShotPocketedBall = false;
  }

  onShotComplete(balls: Ball[]): void {
    // Check if any ball was pocketed this shot (excluding cue ball)
    const pocketedThisShot = balls.filter(b =>
      b.pocketed && b.id !== BALL_CUE
    ).length > this.stats.ballsPocketed;

    if (pocketedThisShot) {
      this.currentStreak++;
      this.stats.ballsPocketed = balls.filter(b => b.pocketed && b.id !== BALL_CUE).length;
      this.stats.shotsMade++;
      this.lastShotPocketedBall = true;

      // Update best streak
      if (this.currentStreak > this.bestStreak) {
        this.bestStreak = this.currentStreak;
      }
    } else {
      // Miss or foul - game over
      this.lastShotPocketedBall = false;
    }

    // Check if cue ball was pocketed (scratch)
    const cueBall = balls.find(b => b.id === BALL_CUE);
    if (cueBall?.pocketed) {
      this.lastShotPocketedBall = false;
    }
  }

  update(dt: number): void {
    if (this.isPaused || this.isComplete) return;
    this.stats.timeElapsed += dt;
  }

  checkCompletion(balls: Ball[]): { isComplete: boolean; success: boolean; message?: string } {
    // Check if missed or fouled
    if (this.stats.shotsAttempted > 0 && !this.lastShotPocketedBall) {
      this.isComplete = true;

      // Record this attempt
      if (this.currentStreak > 0) {
        return {
          isComplete: true,
          success: false,
          message: `Streak ended at ${this.currentStreak} ball${this.currentStreak !== 1 ? 's' : ''}. Best: ${this.bestStreak}`,
        };
      } else {
        return {
          isComplete: true,
          success: false,
          message: `Miss! Best streak: ${this.bestStreak}`,
        };
      }
    }

    // Check if all balls are pocketed (perfect game!)
    const allPocketed = balls.every(b => b.id === BALL_CUE || b.pocketed);

    if (allPocketed) {
      this.isComplete = true;
      return {
        isComplete: true,
        success: true,
        message: `🏆 PERFECT GAME! Cleared all 15 balls in ${this.stats.shotsAttempted} shot${this.stats.shotsAttempted !== 1 ? 's' : ''}!`,
      };
    }

    return { isComplete: false, success: false };
  }

  getHUDData(): { [key: string]: string | number } {
    const data: { [key: string]: string | number } = {
      'Current Streak': this.currentStreak,
      'Best Streak': this.bestStreak,
      'Balls Remaining': 15 - this.stats.ballsPocketed,
      'Shots': this.stats.shotsAttempted,
    };

    return data;
  }

  reset(): void {
    super.reset();
    this.currentStreak = 0;
    this.attemptNumber++;
    this.lastShotPocketedBall = false;
  }
}

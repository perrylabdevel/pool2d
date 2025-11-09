// Speed Pool mode - Fast-paced scoring with combo multipliers

import { Ball } from '../../physics/Shapes';
import { GameModeBase, GameModeConfig } from './GameModeBase';
import { BALL_CUE } from '../../config';

export class SpeedPoolMode extends GameModeBase {
  timeRemaining: number = 60; // seconds
  score: number = 0;
  combo: number = 0;
  highScore: number = 0;
  lastShotPocketedBall: boolean = false;

  private readonly TIME_PER_BALL = 5; // seconds added per pocketed ball
  private readonly STARTING_TIME = 60; // seconds
  private previousPocketedCount: number = 0;

  constructor() {
    const config: GameModeConfig = {
      name: 'Speed Pool',
      description: 'Fast-paced scoring with combo multipliers',
      allowBallDragging: false,
      showAimAssist: true,
      allowUndo: false,
    };

    super(config);
  }

  onStart(): void {
    this.timeRemaining = this.STARTING_TIME;
    this.score = 0;
    this.combo = 0;
    this.stats.timeElapsed = 0;
    this.previousPocketedCount = 0;
    console.log('⚡ Speed Pool started! Keep the combo going!');
  }

  onShotTaken(angle: number, power: number): void {
    this.stats.shotsAttempted++;
    this.lastShotPocketedBall = false;
  }

  onShotComplete(balls: Ball[]): void {
    // Count currently pocketed balls (excluding cue ball)
    const pocketedCount = balls.filter(b => b.pocketed && b.id !== BALL_CUE).length;
    const ballsPocketedThisShot = pocketedCount - this.previousPocketedCount;

    // Check if cue ball was pocketed (scratch)
    const cueBall = balls.find(b => b.id === BALL_CUE);
    const scratched = cueBall?.pocketed || false;

    if (ballsPocketedThisShot > 0 && !scratched) {
      // Successful shot - increase combo
      this.combo += ballsPocketedThisShot;
      this.stats.ballsPocketed = pocketedCount;
      this.stats.shotsMade++;
      this.lastShotPocketedBall = true;

      // Add time bonus
      this.timeRemaining += ballsPocketedThisShot * this.TIME_PER_BALL;

      // Calculate score: balls × combo multiplier
      const points = ballsPocketedThisShot * Math.max(1, this.combo);
      this.score += points;

      // Update high score
      if (this.score > this.highScore) {
        this.highScore = this.score;
      }
    } else {
      // Miss or scratch - break combo
      this.combo = 0;
      this.lastShotPocketedBall = false;
    }

    this.previousPocketedCount = pocketedCount;
  }

  update(dt: number): void {
    if (this.isPaused || this.isComplete) return;

    // Update timer
    this.timeRemaining -= dt;
    this.stats.timeElapsed += dt;

    // Clamp time to 0
    if (this.timeRemaining < 0) {
      this.timeRemaining = 0;
    }
  }

  checkCompletion(balls: Ball[]): { isComplete: boolean; success: boolean; message?: string } {
    // Check if time ran out
    if (this.timeRemaining <= 0) {
      this.isComplete = true;

      const message = this.score > 0
        ? `Time's up! Final Score: ${this.score} (Best: ${this.highScore})`
        : `Time's up! Score: 0`;

      return {
        isComplete: true,
        success: this.score > 0,
        message,
      };
    }

    // Check if all balls are pocketed
    const allPocketed = balls.every(b => b.id === BALL_CUE || b.pocketed);

    if (allPocketed) {
      this.isComplete = true;

      // Bonus for clearing the table
      const timeBonus = Math.floor(this.timeRemaining * 10);
      this.score += timeBonus;

      if (this.score > this.highScore) {
        this.highScore = this.score;
      }

      return {
        isComplete: true,
        success: true,
        message: `🏆 Table Cleared! Score: ${this.score} (+${timeBonus} time bonus)`,
      };
    }

    return { isComplete: false, success: false };
  }

  getHUDData(): { [key: string]: string | number } {
    const data: { [key: string]: string | number } = {
      'Time': this.formatTime(this.timeRemaining),
      'Score': this.score,
      'Combo': `x${this.combo}`,
      'Balls': `${this.stats.ballsPocketed}/15`,
    };

    if (this.highScore > 0) {
      data['Best'] = this.highScore;
    }

    return data;
  }

  private formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  reset(): void {
    super.reset();
    this.timeRemaining = this.STARTING_TIME;
    this.score = 0;
    this.combo = 0;
    this.previousPocketedCount = 0;
    this.lastShotPocketedBall = false;
  }
}

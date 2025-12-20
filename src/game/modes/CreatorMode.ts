// Creator mode - sandbox for custom shot setups

import { Ball } from '../../physics/Shapes';
import { GameModeBase, GameModeConfig } from './GameModeBase';

export class CreatorMode extends GameModeBase {
  constructor() {
    const config: GameModeConfig = {
      name: 'Creator',
      description: 'Build custom shots and practice them',
      allowBallDragging: true,
      showAimAssist: true,
      allowUndo: true,
    };
    super(config);
  }

  onStart(): void {
    // No timers or win conditions in creator mode.
  }

  onShotTaken(_angle: number, _power: number): void {
    this.stats.shotsAttempted++;
  }

  onShotComplete(_balls: Ball[]): void {
    // Creator mode does not track makes/fouls.
  }

  update(_dt: number): void {
    // No per-frame updates needed.
  }

  checkCompletion(_balls: Ball[]): { isComplete: boolean; success: boolean; message?: string } {
    return { isComplete: false, success: false };
  }

  getHUDData(): { [key: string]: string | number } {
    return {
      Shots: this.stats.shotsAttempted,
    };
  }
}

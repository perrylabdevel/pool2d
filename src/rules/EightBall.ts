// 8-Ball rules engine

import { Ball } from '../physics/Shapes';
import { BALL_CUE, BALL_8, BALLS_SOLID, BALLS_STRIPE } from '../config';
import { RulesConfig, getDefaultRulesConfig } from './RulesConfig';

export enum GameState {
  BREAK,
  PLAYING,
  BALL_IN_HAND,
  GAME_OVER,
}

export enum PlayerGroup {
  NONE,
  SOLIDS,
  STRIPES,
}

const TABLE_HALF_WIDTH_IN = 50;
const TABLE_HALF_HEIGHT_IN = 25;
const POCKET_BUFFER_IN = 2;

export type BallInHandPlacement = 'ANYWHERE' | 'KITCHEN';

export class EightBallRules {
  config: RulesConfig;
  currentPlayer: number = 1;
  player1Group: PlayerGroup = PlayerGroup.NONE;
  player2Group: PlayerGroup = PlayerGroup.NONE;
  gameState: GameState = GameState.BREAK;
  winner: number = 0;

  // Track shot state
  cueBallHit: boolean = false;
  firstBallHit: number = -1;
  ballsPocketed: number[] = [];
  private ballsPocketedBeforeShot: Set<number> = new Set();
  private railContactThisShot: boolean = false;
  private railContactBallIds: Set<number> = new Set();
  private ballInHandPlacement: BallInHandPlacement = 'ANYWHERE';
  private calledPocketId: string | null = null;

  onFoul?: (message: string) => void;
  onTurnChange?: (player: number) => void;
  onGameOver?: (winner: number) => void;
  onGroupAssigned?: (player: number, group: PlayerGroup) => void;

  constructor(config?: RulesConfig) {
    this.config = config || getDefaultRulesConfig();
  }

  startGame() {
    this.currentPlayer = 1;
    this.player1Group = PlayerGroup.NONE;
    this.player2Group = PlayerGroup.NONE;
    this.gameState = GameState.BREAK;
    this.winner = 0;
  }

  startShot(balls: Ball[]) {
    this.cueBallHit = false;
    this.firstBallHit = -1;
    this.ballsPocketed = [];
    this.railContactThisShot = false;
    this.railContactBallIds.clear();

    // Track which balls are already pocketed before this shot
    this.ballsPocketedBeforeShot = new Set(
      balls.filter(b => b.pocketed).map(b => b.id)
    );

    if (this.gameState === GameState.BALL_IN_HAND) {
      this.gameState = GameState.PLAYING;
      this.ballInHandPlacement = 'ANYWHERE';
    }
  }
  
  // Track any rail contact during the active shot
  recordRailContact(ballId?: number) {
    this.railContactThisShot = true;
    if (typeof ballId === 'number') {
      this.railContactBallIds.add(ballId);
    }
  }
  
  recordBallPocketed(ballId: number) {
    this.ballsPocketed.push(ballId);
  }
  
  recordFirstContact(ballId: number) {
    if (this.firstBallHit === -1) {
      this.firstBallHit = ballId;
    }
  }
  
  setCalledPocket(pocketId: string | null) {
    this.calledPocketId = pocketId;
  }
  
  endShot(balls: Ball[]) {
    // Detect which balls were pocketed during this shot
    const currentlyPocketed = new Set(balls.filter(b => b.pocketed).map(b => b.id));
    this.ballsPocketed = Array.from(currentlyPocketed).filter(
      id => !this.ballsPocketedBeforeShot.has(id)
    );

    console.log('[Rules] Balls pocketed this shot:', this.ballsPocketed);

    const cueBall = balls.find((b) => b.id === BALL_CUE);
    const cueBallPocketed = cueBall?.pocketed || false;
    const eightBall = balls.find((b) => b.id === BALL_8);
    const eightBallPocketedThisShot = !!(
      eightBall?.pocketed && !this.ballsPocketedBeforeShot.has(BALL_8)
    );
    const eightBallOutOfBounds = this.wasBallForcedOutOfPlay(eightBall);
    const eightBallMissing = !eightBall;
    const eightBallForcedPocket =
      !this.ballsPocketedBeforeShot.has(BALL_8) && (eightBallMissing || eightBallOutOfBounds);

    console.log('[Rules] 8-ball status', {
      pocketed: eightBall?.pocketed ?? false,
      wasPocketedBefore: this.ballsPocketedBeforeShot.has(BALL_8),
      detectedThisShot: eightBallPocketedThisShot,
      forcedPocket: eightBallForcedPocket,
      outOfBounds: eightBallOutOfBounds,
      missing: eightBallMissing,
      position: eightBall ? { x: eightBall.x.toFixed(2), y: eightBall.y.toFixed(2) } : null,
    });

    let foul = false;
    let foulMessage = '';

    // Check for fouls
    if (cueBallPocketed) {
      foul = true;
      foulMessage = 'Scratch! Cue ball pocketed.';
    } else if (this.firstBallHit === -1) {
      foul = true;
      foulMessage = 'Foul! No ball hit.';
    } else if (this.gameState === GameState.PLAYING) {
      // Check if correct group was hit first
      const currentGroup = this.getCurrentPlayerGroup();

      if (currentGroup !== PlayerGroup.NONE) {
        const hitCorrectGroup = this.isCorrectGroup(this.firstBallHit, currentGroup);

        if (!hitCorrectGroup && this.firstBallHit !== BALL_8) {
          foul = true;
          foulMessage = 'Foul! Wrong set hit first.';
        }
      }
    }
    
    // Handle break
    if (this.gameState === GameState.BREAK) {
      this.handleBreak(
        foul,
        foulMessage,
        eightBallPocketedThisShot,
        balls,
        cueBallPocketed
      );
      return;
    }

    // Handle 8-ball pocketed
    if (eightBallPocketedThisShot || eightBallForcedPocket) {
      if (eightBallForcedPocket) {
        console.warn('[Rules] Forcing 8-ball pocket (out of play)', {
          foul,
          eightBallMissing,
          eightBallOutOfBounds,
        });
        if (eightBall) {
          eightBall.pocketed = true;
        }
      } else {
        console.log('[Rules] Detected 8-ball pocketed during regular play', {
          foul,
          currentPlayer: this.currentPlayer,
          playerGroup: this.getCurrentPlayerGroup(),
        });
      }

      if (!eightBallForcedPocket && (this.config.requireCalled8Ball || this.config.requireCalledShots) && !foul) {
        const actualPocketId = eightBall?.lastPocketId ?? null;
        if (!this.calledPocketId || !actualPocketId || actualPocketId !== this.calledPocketId) {
          foul = true;
          foulMessage = 'Foul! 8-ball pocketed in uncalled pocket.';
        }
      }
      this.calledPocketId = null;

      if (!this.ballsPocketed.includes(BALL_8)) {
        this.ballsPocketed.push(BALL_8);
      }
      this.handle8BallPocketed(foul, balls);
      return;
    }
    
    // Enforce rail contact rule for normal shots (no pocket)
    if (this.config.requireRailContact && this.ballsPocketed.length === 0 && !foul) {
      if (!this.railContactThisShot) {
        foul = true;
        foulMessage = 'Foul! No rail contact.';
      }
    }

    // Assign groups if not yet assigned
    if (this.player1Group === PlayerGroup.NONE && this.ballsPocketed.length > 0) {
      this.assignGroups();
    }
    
    // Handle foul
    if (foul) {
      this.ballInHandPlacement = 'ANYWHERE';
      this.gameState = GameState.BALL_IN_HAND;
      if (this.onFoul) {
        this.onFoul(foulMessage);
      }
      this.switchPlayer();
      return;
    }
    
    // Check if player pocketed their own ball
    const currentGroup = this.getCurrentPlayerGroup();
    const pocketedOwnBall = this.ballsPocketed.some((id) => {
      if (currentGroup === PlayerGroup.NONE) return true;
      return this.isCorrectGroup(id, currentGroup);
    });
    
    // Continue turn if pocketed own ball, otherwise switch
    if (!pocketedOwnBall || this.ballsPocketed.length === 0) {
      this.switchPlayer();
    }
  }
  
  handleBreak(
    foul: boolean,
    foulMessage: string,
    eightBallPocketed: boolean,
    balls: Ball[] | null,
    cueBallPocketed: boolean
  ) {
    // Legal break: at least 4 balls hit cushions or ball pocketed
    // Simplified: just check if any ball pocketed
    let foulFlag = foul;
    let foulReason = foulMessage;
    const scratchOnBreak = cueBallPocketed;

    if (scratchOnBreak && eightBallPocketed) {
      if (this.config.scratch8BallOnBreakLoss) {
        this.winner = this.currentPlayer === 1 ? 2 : 1;
        this.gameState = GameState.GAME_OVER;
        if (this.onGameOver) {
          this.onGameOver(this.winner);
        }
        return;
      }
      foulFlag = true;
      foulReason = 'Scratch on break while pocketing the 8-ball.';
      this.spotEightBall(balls);
      this.removeBallFromPocketed(BALL_8);
    }

    if (foulFlag) {
      if (scratchOnBreak) {
        this.ballInHandPlacement = this.getBreakScratchPlacement();
      } else {
        this.ballInHandPlacement = 'ANYWHERE';
      }
      this.gameState = GameState.BALL_IN_HAND;
      if (this.onFoul) {
        this.onFoul(foulReason);
      }
      this.switchPlayer();
      return;
    }

    // Enforce legal break if required (simplified: any ball pocketed)
    if (this.config.requireLegalBreak) {
      const objectRailContacts = Array.from(this.railContactBallIds).filter(
        (id) => id !== BALL_CUE
      ).length;
      const meetsRequirement =
        this.ballsPocketed.length > 0 || objectRailContacts >= 4;

      if (!meetsRequirement) {
        this.ballInHandPlacement = 'ANYWHERE';
        this.gameState = GameState.BALL_IN_HAND;
        if (this.onFoul) this.onFoul('Illegal break');
        this.switchPlayer();
        return;
      }
    }

    // Check if 8-ball pocketed on break
    if (eightBallPocketed) {
      const behavior = this.config.breakEightBallBehavior ?? (this.config.allow8BallBreakWin ? 'WIN' : 'SPOT_LOSE_TURN');
      if (behavior === 'WIN') {
        // Win on break if allowed
        this.winner = this.currentPlayer;
        this.gameState = GameState.GAME_OVER;
        if (this.onGameOver) this.onGameOver(this.winner);
        return;
      } else {
        // Spot 8-ball back on the rack spot
        this.spotEightBall(balls);
        if (behavior === 'SPOT_LOSE_TURN') {
          this.switchPlayer();
        }
      }
    }

    this.gameState = GameState.PLAYING;

    // Assign groups if balls were pocketed on break
    if (this.ballsPocketed.length > 0 && this.player1Group === PlayerGroup.NONE) {
      this.assignGroups();
    }

    // Continue turn if ball pocketed
    if (this.ballsPocketed.length === 0) {
      this.switchPlayer();
    }
  }
  
  handle8BallPocketed(foul: boolean, balls: Ball[]) {
    // Check if player has cleared their group
    const hasCleared = this.hasPlayerClearedGroup(this.currentPlayer, balls);

    if (foul || !hasCleared) {
      console.log('[Rules] 8-ball ends game (loss)', { foul, hasCleared, currentPlayer: this.currentPlayer });
      // Lose if 8-ball pocketed early or with foul
      this.winner = this.currentPlayer === 1 ? 2 : 1;
      this.gameState = GameState.GAME_OVER;
      if (this.onGameOver) {
        this.onGameOver(this.winner);
      }
    } else {
      console.log('[Rules] 8-ball ends game (win)', { currentPlayer: this.currentPlayer });
      // Win if 8-ball pocketed legally
      this.winner = this.currentPlayer;
      this.gameState = GameState.GAME_OVER;
      if (this.onGameOver) {
        this.onGameOver(this.winner);
      }
    }
  }
  
  assignGroups() {
    // Assign based on first ball pocketed
    const firstPocketed = this.ballsPocketed[0];
    
    if (BALLS_SOLID.includes(firstPocketed)) {
      if (this.currentPlayer === 1) {
        this.player1Group = PlayerGroup.SOLIDS;
        this.player2Group = PlayerGroup.STRIPES;
      } else {
        this.player1Group = PlayerGroup.STRIPES;
        this.player2Group = PlayerGroup.SOLIDS;
      }
    } else if (BALLS_STRIPE.includes(firstPocketed)) {
      if (this.currentPlayer === 1) {
        this.player1Group = PlayerGroup.STRIPES;
        this.player2Group = PlayerGroup.SOLIDS;
      } else {
        this.player1Group = PlayerGroup.SOLIDS;
        this.player2Group = PlayerGroup.STRIPES;
      }
    }
    
    if (this.onGroupAssigned) {
      this.onGroupAssigned(1, this.player1Group);
      this.onGroupAssigned(2, this.player2Group);
    }
  }
  
  getCurrentPlayerGroup(): PlayerGroup {
    return this.currentPlayer === 1 ? this.player1Group : this.player2Group;
  }
  
  isCorrectGroup(ballId: number, group: PlayerGroup): boolean {
    if (group === PlayerGroup.SOLIDS) {
      return BALLS_SOLID.includes(ballId);
    } else if (group === PlayerGroup.STRIPES) {
      return BALLS_STRIPE.includes(ballId);
    }
    return false;
  }
  
  hasPlayerClearedGroup(player: number, balls: Ball[]): boolean {
    // Check if all balls of player's group are pocketed
    const group = player === 1 ? this.player1Group : this.player2Group;

    if (group === PlayerGroup.NONE) return false;

    const targetBalls = group === PlayerGroup.SOLIDS ? BALLS_SOLID : BALLS_STRIPE;

    // Check if all balls in the group are pocketed
    return targetBalls.every(ballId => {
      const ball = balls.find(b => b.id === ballId);
      return ball ? ball.pocketed : false;
    });
  }
  
  switchPlayer() {
    this.currentPlayer = this.currentPlayer === 1 ? 2 : 1;
    if (this.onTurnChange) {
      this.onTurnChange(this.currentPlayer);
    }
  }
  
  canShoot(): boolean {
    return this.gameState !== GameState.GAME_OVER;
  }

  getBallInHandPlacement(): BallInHandPlacement {
    return this.ballInHandPlacement;
  }

  private wasBallForcedOutOfPlay(ball: Ball | undefined): boolean {
    if (!ball) return true;
    const thresholdX = TABLE_HALF_WIDTH_IN + POCKET_BUFFER_IN;
    const thresholdY = TABLE_HALF_HEIGHT_IN + POCKET_BUFFER_IN;
    return Math.abs(ball.x) > thresholdX || Math.abs(ball.y) > thresholdY;
  }

  private getBreakScratchPlacement(): BallInHandPlacement {
    if (this.config.breakScratchPlacement) {
      return this.config.breakScratchPlacement === 'KITCHEN' ? 'KITCHEN' : 'ANYWHERE';
    }
    return this.config.ballInHandAnywhere ? 'ANYWHERE' : 'KITCHEN';
  }

  private spotEightBall(balls: Ball[] | null) {
    const eight = balls?.find((b) => b.id === BALL_8);
    if (eight) {
      eight.pocketed = false;
      eight.lastPocketId = null;
    }
  }

  private removeBallFromPocketed(ballId: number) {
    this.ballsPocketed = this.ballsPocketed.filter((id) => id !== ballId);
  }
}

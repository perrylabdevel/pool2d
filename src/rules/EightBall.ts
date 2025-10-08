// 8-Ball rules engine

import { Ball } from '../physics/Shapes';
import { BALL_CUE, BALL_8, BALLS_SOLID, BALLS_STRIPE } from '../config';

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

export class EightBallRules {
  currentPlayer: number = 1;
  player1Group: PlayerGroup = PlayerGroup.NONE;
  player2Group: PlayerGroup = PlayerGroup.NONE;
  gameState: GameState = GameState.BREAK;
  winner: number = 0;
  
  // Track shot state
  cueBallHit: boolean = false;
  firstBallHit: number = -1;
  ballsPocketed: number[] = [];
  
  onFoul?: (message: string) => void;
  onTurnChange?: (player: number) => void;
  onGameOver?: (winner: number) => void;
  onGroupAssigned?: (player: number, group: PlayerGroup) => void;
  
  startGame() {
    this.currentPlayer = 1;
    this.player1Group = PlayerGroup.NONE;
    this.player2Group = PlayerGroup.NONE;
    this.gameState = GameState.BREAK;
    this.winner = 0;
  }
  
  startShot() {
    this.cueBallHit = false;
    this.firstBallHit = -1;
    this.ballsPocketed = [];
  }
  
  recordBallPocketed(ballId: number) {
    this.ballsPocketed.push(ballId);
  }
  
  recordFirstContact(ballId: number) {
    if (this.firstBallHit === -1) {
      this.firstBallHit = ballId;
    }
  }
  
  endShot(balls: Ball[]) {
    const cueBall = balls.find((b) => b.id === BALL_CUE);
    const cueBallPocketed = cueBall?.pocketed || false;
    
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
          foulMessage = 'Foul! Wrong group hit first.';
        }
      }
    }
    
    // Handle break
    if (this.gameState === GameState.BREAK) {
      this.handleBreak(foul, foulMessage);
      return;
    }
    
    // Handle 8-ball pocketed
    if (this.ballsPocketed.includes(BALL_8)) {
      this.handle8BallPocketed(foul);
      return;
    }
    
    // Assign groups if not yet assigned
    if (this.player1Group === PlayerGroup.NONE && this.ballsPocketed.length > 0) {
      this.assignGroups();
    }
    
    // Handle foul
    if (foul) {
      if (this.onFoul) {
        this.onFoul(foulMessage);
      }
      this.gameState = GameState.BALL_IN_HAND;
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
  
  handleBreak(foul: boolean, foulMessage: string) {
    // Legal break: at least 4 balls hit cushions or ball pocketed
    // Simplified: just check if any ball pocketed
    
    if (foul) {
      if (this.onFoul) {
        this.onFoul(foulMessage);
      }
      this.gameState = GameState.BALL_IN_HAND;
      this.switchPlayer();
      return;
    }
    
    // Check if 8-ball pocketed on break
    if (this.ballsPocketed.includes(BALL_8)) {
      // Win on break if no scratch
      this.winner = this.currentPlayer;
      this.gameState = GameState.GAME_OVER;
      if (this.onGameOver) {
        this.onGameOver(this.winner);
      }
      return;
    }
    
    this.gameState = GameState.PLAYING;
    
    // Continue turn if ball pocketed
    if (this.ballsPocketed.length === 0) {
      this.switchPlayer();
    }
  }
  
  handle8BallPocketed(foul: boolean) {
    // Check if player has cleared their group
    const hasCleared = this.hasPlayerClearedGroup(this.currentPlayer);
    
    if (foul || !hasCleared) {
      // Lose if 8-ball pocketed early or with foul
      this.winner = this.currentPlayer === 1 ? 2 : 1;
      this.gameState = GameState.GAME_OVER;
      if (this.onGameOver) {
        this.onGameOver(this.winner);
      }
    } else {
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
  
  hasPlayerClearedGroup(player: number): boolean {
    // Check if all balls of player's group are pocketed
    const group = player === 1 ? this.player1Group : this.player2Group;
    
    if (group === PlayerGroup.NONE) return false;
    
    // In a real implementation, we'd check the actual ball states
    // For now, simplified - will be properly implemented when integrated with game state
    // const targetBalls = group === PlayerGroup.SOLIDS ? BALLS_SOLID : BALLS_STRIPE;
    return false;
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
}

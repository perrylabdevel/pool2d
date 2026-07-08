import { describe, it, expect } from 'vitest';
import { EightBallRules, PlayerGroup, GameState } from './EightBall';
import { Ball } from '../physics/Shapes';
import { BALLS_SOLID, BALL_8 } from '../config';

function makeBalls(pocketedIds: number[]): Ball[] {
  const balls: Ball[] = [];
  for (let id = 0; id <= 15; id++) {
    const ball = new Ball(id, 0, 0, 1.125, 1);
    ball.pocketed = pocketedIds.includes(id);
    balls.push(ball);
  }
  return balls;
}

describe('EightBallRules - clearing group and winning', () => {
  it('detects a cleared group', () => {
    const rules = new EightBallRules();
    rules.startGame();
    rules.player1Group = PlayerGroup.SOLIDS;
    rules.startShot();
    
    const balls = makeBalls(BALLS_SOLID); // all solids already down
    expect(rules.hasPlayerClearedGroup(1, balls)).toBe(true);
  });
  
  it('group not cleared if a ball fell on this same shot', () => {
    const rules = new EightBallRules();
    rules.startGame();
    rules.player1Group = PlayerGroup.SOLIDS;
    rules.startShot();
    rules.recordBallPocketed(7); // last solid falls with this stroke
    
    const balls = makeBalls(BALLS_SOLID);
    expect(rules.hasPlayerClearedGroup(1, balls)).toBe(false);
  });
  
  it('legal 8-ball pot wins the game', () => {
    const rules = new EightBallRules();
    rules.startGame();
    rules.gameState = GameState.PLAYING;
    rules.player1Group = PlayerGroup.SOLIDS;
    rules.player2Group = PlayerGroup.STRIPES;
    
    rules.startShot();
    rules.recordFirstContact(BALL_8);
    rules.recordBallPocketed(BALL_8);
    
    const balls = makeBalls([...BALLS_SOLID, BALL_8]);
    rules.endShot(balls);
    
    expect(rules.gameState).toBe(GameState.GAME_OVER);
    expect(rules.winner).toBe(1);
  });
  
  it('early 8-ball pot loses the game', () => {
    const rules = new EightBallRules();
    rules.startGame();
    rules.gameState = GameState.PLAYING;
    rules.player1Group = PlayerGroup.SOLIDS;
    rules.player2Group = PlayerGroup.STRIPES;
    
    rules.startShot();
    rules.recordFirstContact(BALL_8);
    rules.recordBallPocketed(BALL_8);
    
    const balls = makeBalls([1, 2, BALL_8]); // solids remain on table
    rules.endShot(balls);
    
    expect(rules.gameState).toBe(GameState.GAME_OVER);
    expect(rules.winner).toBe(2);
  });
});

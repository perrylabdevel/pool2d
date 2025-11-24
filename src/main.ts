// Main entry point

import { Game } from './game/Game';
import { notificationService } from './ui/NotificationService';
import './ui/ModalService';
import './ui/DockBridge';
import './ui/UISoundService';
import './ui/UIRoot';
import { uiStateMachine, UIState } from './ui/UIStateMachine';
import './ui/SceneController';

function main() {
  const gameCanvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  const debugCanvas = document.getElementById('debug-canvas') as HTMLCanvasElement;

  if (!gameCanvas || !debugCanvas) {
    console.error('Canvas elements not found');
    return;
  }

  const game = new Game(gameCanvas, debugCanvas);
  (window as any).poolGame = game;

  // Transition to lobby immediately so it's ready when loading completes
  // The loading screen will remain visible until game assets finish loading
  uiStateMachine.transitionTo(UIState.LOBBY);

  game.start();

  console.log('Pool 2D initialized');
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}

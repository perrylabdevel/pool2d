// Main entry point

import { Game } from './game/Game';
import './ui/ModalService';
import './ui/DockBridge';
import { homeHub } from './ui/HomeHub';
import './ui/UISoundService';
import './ui/UIRoot';
import './ui/UIStateMachine';
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
  (window as any).homeHub = homeHub; // Expose for global access (shortcuts)
  game.start();

  console.log('Pool 2D initialized');
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}

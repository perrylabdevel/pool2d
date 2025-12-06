// Main entry point

import { Game } from './game/Game';
import './ui/NotificationService';
import './ui/ModalService';
import './ui/DockBridge';
import './ui/UISoundService';
import './ui/UIRoot';
import { uiStateMachine, UIState } from './ui/UIStateMachine';
import './ui/SceneController';
import { Capacitor } from '@capacitor/core';

import { initializeUserIfNeeded } from './data/db';
import { currencyStore } from './ui/CurrencyStore';

async function main() {
  const gameCanvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  const debugCanvas = document.getElementById('debug-canvas') as HTMLCanvasElement;

  if (!gameCanvas || !debugCanvas) {
    console.error('Canvas elements not found');
    return;
  }

  // Initialize database
  await initializeUserIfNeeded();

  // Initialize currency store from database
  await currencyStore.initialize();

  const game = new Game(gameCanvas, debugCanvas);
  (window as any).poolGame = game;

  // Initialize RemoteBridge for DevTools (Desktop Only)
  if (Capacitor.getPlatform() !== 'ios') {
    import('./debug/RemoteBridge').then(({ RemoteBridge }) => {
      new RemoteBridge(game.settingsManager, game.renderer);
    });
  }

  // Transition to lobby immediately so it's ready when loading completes
  // The loading screen will remain visible until game assets finish loading
  uiStateMachine.transitionTo(UIState.LOBBY);

  game.start();

  console.log('Pool 2D initialized');

  // Prevent accidental tab close/reload during gameplay
  window.onbeforeunload = (e) => {
    if (game && game.isInProgress()) {
      e.preventDefault();
      e.returnValue = ''; // Standard for Chrome
      return ''; // Standard for other browsers
    }
  };
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}

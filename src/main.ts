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
  const measure = (name: string, start: string, end: string) => {
    performance.measure(name, start, end);
    const entry = performance.getEntriesByName(name).pop();
    if (entry) {
      console.log(`[Perf] ${name}: ${entry.duration.toFixed(1)}ms`);
    }
  };

  performance.mark('boot:start');

  const gameCanvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  const debugCanvas = document.getElementById('debug-canvas') as HTMLCanvasElement;

  if (!gameCanvas || !debugCanvas) {
    console.error('Canvas elements not found');
    return;
  }

  // Initialize database
  await initializeUserIfNeeded();
  performance.mark('boot:db:end');

  // Initialize currency store from database
  await currencyStore.initialize();
  performance.mark('boot:currency:end');

  performance.mark('boot:game:init:start');

  const game = new Game(gameCanvas, debugCanvas);
  (window as any).poolGame = game;
  performance.mark('boot:game:init:end');

  // Initialize RemoteBridge for DevTools (Desktop Only)
  if (Capacitor.getPlatform() !== 'ios') {
    import('./debug/RemoteBridge').then(({ RemoteBridge }) => {
      new RemoteBridge(game.settingsManager, game.renderer);
    });
  }

  // Transition to lobby immediately so it's ready when loading completes
  // The loading screen will remain visible until game assets finish loading
  uiStateMachine.transitionTo(UIState.LOBBY);
  performance.mark('boot:ui:transitioned');

  performance.mark('boot:game:start');
  game.start();
  performance.mark('boot:game:start:end');

  console.log('Pool 2D initialized');
  performance.mark('boot:end');

  measure('boot:db', 'boot:start', 'boot:db:end');
  measure('boot:currency', 'boot:db:end', 'boot:currency:end');
  measure('boot:game:init', 'boot:currency:end', 'boot:game:init:end');
  measure('boot:ui', 'boot:game:init:end', 'boot:ui:transitioned');
  measure('boot:game:start', 'boot:game:start', 'boot:game:start:end');
  measure('boot:total', 'boot:start', 'boot:end');

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

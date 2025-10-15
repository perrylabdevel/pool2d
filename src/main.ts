// Main entry point

import { Game } from './game/Game';
import { AssetLoader } from './assets/AssetLoader';
import { LoadingScreen } from './ui/LoadingScreen';
import { getCollisionTrackingStatus } from './physics/Collision';

async function main() {
  const gameCanvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  const debugCanvas = document.getElementById('debug-canvas') as HTMLCanvasElement;
  
  if (!gameCanvas || !debugCanvas) {
    console.error('Canvas elements not found');
    return;
  }
  
  // Show loading screen
  const loadingScreen = new LoadingScreen();
  
  try {
    // Load all assets
    const assetLoader = new AssetLoader();
    
    assetLoader.onProgress((progress) => {
      loadingScreen.updateProgress(
        progress.loaded, 
        progress.total, 
        `Loading ${progress.item}...`
      );
    });
    
    console.log('Loading assets...');
    const assets = await assetLoader.loadAllAssets();
    console.log('Assets loaded successfully!');
    
    // Create game
    const game = new Game(gameCanvas, debugCanvas);
    
    // Pass assets to renderer
    game.renderer.setBallAssets(assets.fbx, assets.textures);
    
    // Hide loading screen and start game
    loadingScreen.hide();
    game.start();
    
    console.log('Pool 2D initialized');
    
    // Debug helper to verify collision tracking fix is active
    (window as any).checkCollisionTracking = () => {
      const status = getCollisionTrackingStatus();
      console.log('✅ Collision tracking is ACTIVE - Fix is loaded!');
      console.log('Tracked collision pairs this step:', status.trackedCollisions);
      console.log('Pairs:', status.pairs);
      return status;
    };
  } catch (error) {
    console.error('Failed to initialize game:', error);
    loadingScreen.updateProgress(0, 100, 'Error loading assets. Please refresh.');
  }
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}

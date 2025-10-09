// HUD and UI management

export class HUD {
  fpsElement: HTMLElement;
  upsElement: HTMLElement;
  modeElement: HTMLElement;
  turnElement: HTMLElement;
  foulBanner: HTMLElement;
  player1Panel: HTMLElement;
  player2Panel: HTMLElement;
  statsElement: HTMLElement;
  
  showStats: boolean = true;
  
  constructor() {
    this.fpsElement = document.getElementById('fps')!;
    this.upsElement = document.getElementById('ups')!;
    this.modeElement = document.getElementById('mode-indicator')!;
    this.turnElement = document.getElementById('turn-indicator')!;
    this.foulBanner = document.getElementById('foul-banner')!;
    this.player1Panel = document.getElementById('player1-info')!;
    this.player2Panel = document.getElementById('player2-info')!;
    this.statsElement = document.getElementById('stats')!;
    
    this.setupControls();
  }
  
  setupControls() {
    const pauseBtn = document.getElementById('pause-btn')!;
    const restartBtn = document.getElementById('restart-btn')!;
    const settingsBtn = document.getElementById('settings-btn')!;
    const debugToggle = document.getElementById('debug-toggle')!;
    const settingsModal = document.getElementById('settings-modal')!;
    const settingsClose = document.getElementById('settings-close')!;
    
    pauseBtn.addEventListener('click', () => {
      // Will be handled by Game class
      window.dispatchEvent(new CustomEvent('game:pause'));
    });
    
    restartBtn.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('game:restart'));
    });
    
    settingsBtn.addEventListener('click', () => {
      settingsModal.classList.remove('hidden');
    });
    
    settingsClose.addEventListener('click', () => {
      settingsModal.classList.add('hidden');
    });
    
    debugToggle.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('game:debug-toggle'));
    });
    
    // Settings toggles
    const showFpsToggle = document.getElementById('show-fps-toggle') as HTMLInputElement;
    showFpsToggle.addEventListener('change', (e) => {
      this.showStats = (e.target as HTMLInputElement).checked;
      this.statsElement.style.display = this.showStats ? 'flex' : 'none';
    });
  }
  
  updateFPS(fps: number) {
    this.fpsElement.textContent = `FPS: ${Math.round(fps)}`;
  }
  
  updateUPS(ups: number) {
    this.upsElement.textContent = `UPS: ${Math.round(ups)}`;
  }
  
  setMode(mode: string) {
    this.modeElement.textContent = mode;
  }
  
  setTurn(player: number) {
    this.turnElement.textContent = `Player ${player}'s Turn`;
    
    if (player === 1) {
      this.player1Panel.classList.add('active');
      this.player2Panel.classList.remove('active');
    } else {
      this.player1Panel.classList.remove('active');
      this.player2Panel.classList.add('active');
    }
  }
  
  showFoul(message: string) {
    this.foulBanner.textContent = message;
    this.foulBanner.classList.remove('hidden');
    
    setTimeout(() => {
      this.foulBanner.classList.add('hidden');
    }, 3000);
  }
  
  updatePlayerBalls(player: number, balls: number[]) {
    const panel = player === 1 ? this.player1Panel : this.player2Panel;
    const ballsContainer = panel.querySelector('.balls-remaining')!;
    
    if (balls.length === 0) {
      ballsContainer.textContent = 'No balls assigned';
    } else {
      ballsContainer.textContent = `Balls: ${balls.join(', ')}`;
    }
  }
}

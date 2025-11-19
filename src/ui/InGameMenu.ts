import { modalService } from './ModalService';
import { homeHub } from './HomeHub';
import { HubSettings } from './HubSettings';

export class InGameMenu {
  constructor() {
    // Bind ESC to toggle menu
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
          // If a modal is already open, don't interfere (ModalService handles ESC to close itself)
          // We only want to open the menu if NO modal is open.
          // ModalService doesn't expose a "isOpen" check easily, but we can check for the overlay class
          const overlay = document.getElementById('modal-overlay');
          if (overlay && !overlay.classList.contains('hidden')) {
              return; 
          }
          
          // Also check if we are in the middle of a shot or input blocked? 
          // Maybe good to pause game here if we implement pause.
          this.open();
      }
    });
  }

  open() {
    // Pause the game
    window.dispatchEvent(new CustomEvent('game:pause'));

    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '16px';
    container.style.alignItems = 'center';
    container.style.padding = '20px';
    container.style.width = '300px';

    const createBtn = (label: string, onClick: () => void, variant: 'primary' | 'secondary' | 'danger' = 'primary') => {
      const btn = document.createElement('button');
      btn.textContent = label;
      
      let className = 'btn-arcade';
      if (variant === 'primary') className += ' btn-arcade-primary';
      else if (variant === 'secondary') className += ' btn-arcade-glass';
      else if (variant === 'danger') {
          // We don't have a danger class yet in design-tokens, let's add inline or just use glass + red overrides
          // Actually, let's use glass and add a specific style for now, or just standard glass
          className += ' btn-arcade-glass';
          btn.style.borderColor = 'rgba(255, 50, 50, 0.4)';
          btn.style.color = '#ffaaaa';
          btn.style.background = 'rgba(255, 50, 50, 0.1)';
      }
      
      btn.className = className;
      btn.style.width = '100%';
      btn.style.fontSize = '18px'; // specific override for menu
      
      btn.onclick = onClick;
      return btn;
    };

    container.appendChild(createBtn('RESUME', () => {
        // Explicitly resume immediately to prevent any modal lifecycle issues
        window.dispatchEvent(new CustomEvent('game:resume'));
        modalService.close();
    }, 'primary'));
    
    container.appendChild(createBtn('SETTINGS', () => {
        // Open settings - using existing HubSettings
         const game = (window as any).poolGame;
          if (game && game.hud && game.hud.settingsManager) {
              new HubSettings(game.hud.settingsManager).open(() => {
                  // When settings close, restore the pause menu if we are still "in game" context
                  // For now, assume we go back to pause menu
                  // Ideally we should stack modals, but ModalService is single-instance for now.
                  // Let's just re-open pause menu
                  this.open();
              });
          }
    }, 'secondary'));

    container.appendChild(createBtn('QUIT TO MENU', () => {
        window.dispatchEvent(new CustomEvent('game:resume')); // Resume so loop isn't stuck if we restart
        modalService.close();
        // Trigger Home Hub open
        homeHub.init();
    }, 'danger'));

    modalService.show({
      title: 'PAUSED',
      content: container,
      className: 'in-game-menu',
      onClose: () => {
          window.dispatchEvent(new CustomEvent('game:resume'));
      }
    });
  }
}

export const inGameMenu = new InGameMenu();

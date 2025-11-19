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
      btn.className = 'u-metallic-border';
      
      let bg = 'rgba(255,255,255,0.1)';
      let color = '#fff';
      let border = '1px solid rgba(255,255,255,0.2)';
      
      if (variant === 'primary') {
          bg = 'linear-gradient(135deg, var(--color-arcade-blue) 0%, #0077AA 100%)';
          border = '1px solid var(--color-arcade-blue)';
      } else if (variant === 'danger') {
          bg = 'rgba(255, 50, 50, 0.2)';
          border = '1px solid rgba(255, 50, 50, 0.4)';
          color = '#ffaaaa';
      }
      
      btn.style.background = bg;
      btn.style.color = color;
      btn.style.border = border;
      btn.style.borderRadius = '8px';
      btn.style.padding = '16px 32px';
      btn.style.fontSize = '18px';
      btn.style.fontWeight = 'bold';
      btn.style.cursor = 'pointer';
      btn.style.width = '100%';
      btn.style.transition = 'all 0.2s ease';
      
      btn.onmouseenter = () => {
          btn.style.transform = 'scale(1.05)';
          btn.style.boxShadow = '0 0 15px rgba(255,255,255,0.2)';
      };
      btn.onmouseleave = () => {
          btn.style.transform = 'scale(1)';
          btn.style.boxShadow = 'none';
      };
      
      btn.onclick = onClick;
      return btn;
    };

    container.appendChild(createBtn('RESUME', () => {
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

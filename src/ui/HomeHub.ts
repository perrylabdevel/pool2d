import { modalService } from './ModalService';
import { HubSettings } from './HubSettings';
import { ProfileModal } from './ProfileModal';
import { ShopModal } from './ShopModal';

export class HomeHub {
  private hubSettings: HubSettings | null = null;
  private profileModal: ProfileModal | null = null;
  private shopModal: ShopModal | null = null;

  constructor() {
    // Auto-show on instantiation (app start)
    this.init();
  }

  init() {
    const hubContent = document.createElement('div');
    hubContent.className = 'home-hub';
    hubContent.style.display = 'flex';
    hubContent.style.flexDirection = 'column';
    hubContent.style.gap = '24px';

    // Hero Banner
    const hero = document.createElement('div');
    hero.className = 'hub-hero u-neon-border-blue u-shimmer';
    hero.style.height = '180px';
    hero.style.borderRadius = '12px';
    hero.style.background = 'linear-gradient(135deg, rgba(0,11,26,0.9), rgba(0,40,80,0.6)), url(/assets/hero-bg.jpg)';
    hero.style.backgroundSize = 'cover';
    hero.style.backgroundPosition = 'center';
    hero.style.display = 'flex';
    hero.style.alignItems = 'center';
    hero.style.justifyContent = 'center';
    hero.style.position = 'relative';
    
    const title = document.createElement('h1');
    title.className = 'u-font-heading u-chrome-text';
    title.style.fontSize = '48px';
    title.style.margin = '0';
    title.style.zIndex = '1';
    title.textContent = 'RAIL RUSH';
    hero.appendChild(title);
    
    hubContent.appendChild(hero);

    // Mode Cards Grid
    const grid = document.createElement('div');
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(180px, 1fr))';
    grid.style.gap = '16px';

    const modes = [
      { id: 'practice', name: 'Practice', icon: '🎯', desc: 'Hone your skills', color: 'var(--color-arcade-gold)' },
      { id: '8ball', name: '8 Ball', icon: '🎱', desc: 'vs AI Opponent', color: 'var(--color-arcade-blue)' },
      { id: 'time-attack', name: 'Time Attack', icon: '⏱️', desc: 'Race against time', color: 'var(--color-arcade-green)' },
      { id: 'perfect', name: 'Perfect Game', icon: '🔥', desc: 'Don\'t miss', color: 'var(--color-arcade-red)' },
    ];

    modes.forEach(mode => {
      const card = document.createElement('div');
      card.className = 'hub-card u-metallic-border';
      card.style.background = 'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)';
      card.style.padding = '20px';
      card.style.borderRadius = '12px';
      card.style.cursor = 'pointer';
      card.style.textAlign = 'center';
      card.style.transition = 'all 0.2s ease';
      card.style.border = '1px solid transparent';
      
      // Hover effects
      card.onmouseenter = () => {
        card.style.transform = 'translateY(-5px)';
        card.style.borderColor = mode.color;
        card.style.boxShadow = `0 0 15px ${mode.color.replace(')', ', 0.3)')}`;
      };
      card.onmouseleave = () => {
        card.style.transform = 'translateY(0)';
        card.style.borderColor = 'transparent';
        card.style.boxShadow = 'none';
      };
      
      card.onclick = () => this.handleModeSelect(mode.id);

      const icon = document.createElement('div');
      icon.textContent = mode.icon;
      icon.style.fontSize = '42px';
      icon.style.marginBottom = '12px';

      const name = document.createElement('div');
      name.className = 'u-font-heading';
      name.textContent = mode.name;
      name.style.color = '#fff'; // mode.color;
      name.style.fontSize = '18px';
      name.style.marginBottom = '4px';

      const desc = document.createElement('div');
      desc.textContent = mode.desc;
      desc.style.fontSize = '12px';
      desc.style.color = 'rgba(255,255,255,0.6)';

      card.appendChild(icon);
      card.appendChild(name);
      card.appendChild(desc);
      grid.appendChild(card);
    });

    hubContent.appendChild(grid);

    // Show the modal
    setTimeout(() => {
      modalService.show({
        title: 'MAIN LOBBY',
        content: hubContent,
        className: 'home-hub-modal',
        // No footer for now, or maybe a settings button
        footer: this.createFooter()
      });
    }, 500); // Slight delay to let app init
  }

  createFooter() {
    const footer = document.createElement('div');
    footer.style.display = 'flex';
    footer.style.justifyContent = 'space-between';
    footer.style.alignItems = 'center';
    footer.style.width = '100%';
    
    const leftGroup = document.createElement('div');
    leftGroup.style.display = 'flex';
    leftGroup.style.gap = '12px';
    
    const settingsBtn = document.createElement('button');
    settingsBtn.innerHTML = '⚙️ Settings';
    settingsBtn.className = 'panel-btn';
    settingsBtn.style.background = 'rgba(255,255,255,0.1)';
    settingsBtn.style.border = '1px solid rgba(255,255,255,0.1)';
    settingsBtn.style.color = '#fff';
    settingsBtn.style.padding = '8px 12px';
    settingsBtn.style.borderRadius = '6px';
    settingsBtn.style.cursor = 'pointer';
    settingsBtn.style.fontSize = '14px';
    settingsBtn.onclick = () => this.openSettings();
    
    const profileBtn = document.createElement('button');
    profileBtn.innerHTML = '👤 Profile';
    profileBtn.className = 'panel-btn';
    profileBtn.style.background = 'rgba(255,255,255,0.1)';
    profileBtn.style.border = '1px solid rgba(255,255,255,0.1)';
    profileBtn.style.color = '#fff';
    profileBtn.style.padding = '8px 12px';
    profileBtn.style.borderRadius = '6px';
    profileBtn.style.cursor = 'pointer';
    profileBtn.style.fontSize = '14px';
    profileBtn.onclick = () => this.openProfile();
    
    const shopBtn = document.createElement('button');
    shopBtn.innerHTML = '🛒 Shop';
    shopBtn.className = 'panel-btn';
    shopBtn.style.background = 'linear-gradient(135deg, var(--color-arcade-gold) 0%, #FFB700 100%)';
    shopBtn.style.border = '1px solid #B8860B';
    shopBtn.style.color = '#000';
    shopBtn.style.fontWeight = 'bold';
    shopBtn.style.padding = '8px 12px';
    shopBtn.style.borderRadius = '6px';
    shopBtn.style.cursor = 'pointer';
    shopBtn.style.fontSize = '14px';
    shopBtn.style.boxShadow = '0 0 10px rgba(255, 215, 0, 0.3)';
    shopBtn.onclick = () => this.openShop();
    
    leftGroup.appendChild(settingsBtn);
    leftGroup.appendChild(profileBtn);
    leftGroup.appendChild(shopBtn);
    
    const rightGroup = document.createElement('div');
    rightGroup.style.display = 'flex';
    rightGroup.style.alignItems = 'center';
    rightGroup.style.gap = '12px';

    const status = document.createElement('div');
    status.innerHTML = '<span style="color: var(--color-arcade-green)">●</span> Online';
    status.style.fontSize = '12px';
    status.style.color = 'rgba(255,255,255,0.5)';
    
    const version = document.createElement('div');
    version.textContent = 'v2.0.0-alpha';
    version.style.fontSize = '12px';
    version.style.color = 'rgba(255,255,255,0.3)';
    
    rightGroup.appendChild(status);
    rightGroup.appendChild(version);
    
    footer.appendChild(leftGroup);
    footer.appendChild(rightGroup);
    return footer;
  }
  
  openSettings() {
      if (!this.hubSettings) {
          const game = (window as any).poolGame;
          if (game && game.hud && game.hud.settingsManager) {
              this.hubSettings = new HubSettings(game.hud.settingsManager);
          }
      }
      
      if (this.hubSettings) {
          this.hubSettings.open(() => {
              // Re-open HomeHub when settings are closed
              this.init();
          });
      } else {
          console.warn('SettingsManager not available yet');
      }
  }

  openProfile() {
      if (!this.profileModal) {
          const game = (window as any).poolGame;
          if (game && game.hud && game.hud.settingsManager) {
              this.profileModal = new ProfileModal(game.hud.settingsManager);
          }
      }
      
      if (this.profileModal) {
          this.profileModal.open(() => {
              this.init();
          });
      } else {
          console.warn('SettingsManager not available yet');
      }
  }

  openShop() {
      if (!this.shopModal) {
          const game = (window as any).poolGame;
          if (game && game.hud && game.hud.settingsManager) {
              this.shopModal = new ShopModal(game.hud.settingsManager);
          }
      }
      
      if (this.shopModal) {
          this.shopModal.open(() => {
              this.init();
          });
      } else {
          console.warn('SettingsManager not available yet');
      }
  }

  openModeDetails(mode: any) {
      const container = document.createElement('div');
      container.style.display = 'flex';
      container.style.flexDirection = 'column';
      container.style.gap = '24px';
      container.style.textAlign = 'center';
      container.style.padding = '20px 0';

      // Large Icon & Title
      const header = document.createElement('div');
      header.style.marginBottom = '10px';
      
      const icon = document.createElement('div');
      icon.textContent = mode.icon;
      icon.style.fontSize = '64px';
      icon.style.marginBottom = '16px';
      icon.style.filter = `drop-shadow(0 0 20px ${mode.color})`;
      
      const title = document.createElement('h2');
      title.textContent = mode.name;
      title.className = 'u-font-heading u-chrome-text';
      title.style.fontSize = '36px';
      title.style.margin = '0';
      
      header.appendChild(icon);
      header.appendChild(title);
      container.appendChild(header);

      // Mode Description
      const desc = document.createElement('p');
      desc.textContent = mode.desc; // Use the short desc for now, ideally we have a long one
      desc.style.fontSize = '16px';
      desc.style.color = 'rgba(255,255,255,0.8)';
      desc.style.lineHeight = '1.5';
      desc.style.maxWidth = '400px';
      desc.style.margin = '0 auto';
      container.appendChild(desc);

      // Stakes / Rules (Mock data for now)
      const rulesBox = document.createElement('div');
      rulesBox.className = 'u-frosted-glass';
      rulesBox.style.padding = '20px';
      rulesBox.style.borderRadius = '12px';
      rulesBox.style.textAlign = 'left';
      rulesBox.style.background = 'rgba(0,0,0,0.3)';
      
      const rulesTitle = document.createElement('div');
      rulesTitle.textContent = 'MATCH RULES';
      rulesTitle.style.fontSize = '12px';
      rulesTitle.style.fontWeight = 'bold';
      rulesTitle.style.color = mode.color;
      rulesTitle.style.marginBottom = '12px';
      rulesTitle.style.letterSpacing = '1px';
      
      const rulesList = document.createElement('ul');
      rulesList.style.margin = '0';
      rulesList.style.paddingLeft = '20px';
      rulesList.style.color = '#ccc';
      rulesList.style.fontSize = '14px';
      rulesList.style.lineHeight = '1.6';
      
      // Mock rules based on mode
      const rules = [
          'Standard WPA rules apply',
          'Call pocket on 8-ball',
          'Winner breaks next rack'
      ];
      if (mode.id === 'time-attack') rules[0] = 'Sink balls before time runs out';
      if (mode.id === 'perfect') rules[0] = 'Any miss ends the run';

      rules.forEach(r => {
          const li = document.createElement('li');
          li.textContent = r;
          rulesList.appendChild(li);
      });

      rulesBox.appendChild(rulesTitle);
      rulesBox.appendChild(rulesList);
      container.appendChild(rulesBox);

      // Footer with Back & Play
      const footer = document.createElement('div');
      footer.style.display = 'flex';
      footer.style.gap = '16px';
      footer.style.marginTop = '20px';
      
      const backBtn = document.createElement('button');
      backBtn.textContent = 'BACK';
      backBtn.className = 'btn-arcade btn-arcade-glass';
      backBtn.style.flex = '1';
      backBtn.onclick = () => {
          // Re-open main hub
          this.init();
      };

      const playBtn = document.createElement('button');
      playBtn.textContent = 'PLAY GAME';
      playBtn.className = 'btn-arcade btn-arcade-primary u-pulse-glow';
      // Overriding primary color with mode specific color if needed, 
      // but for consistency let's stick to the Gold Primary for "Go/Play" actions 
      // unless we really want the mode color. 
      // Actually, consistent Play buttons (Gold) are better UX than rainbow buttons.
      // Let's stick to the class.
      playBtn.style.flex = '2';
      playBtn.style.fontSize = '18px';
      playBtn.onclick = () => this.handleModeSelect(mode.id);

      footer.appendChild(backBtn);
      footer.appendChild(playBtn);

      // Show Modal
      modalService.show({
          title: 'MODE BRIEFING',
          content: container,
          footer: footer,
          className: 'mode-details-modal',
          onClose: () => {
             // If closed via X or background, we probably want to just close? 
             // Or maybe go back to Hub? 
             // Current behavior of 'onClose' in ModalService is it fires when closed.
             // If we just swap modals (like back button does), we might not want this firing doubly.
             // For now, let's assume standard close behavior is fine.
          }
      });
  }

  handleModeSelect(modeId: string) {
    console.log(`Selected mode: ${modeId}`);
    
    // Interface with Game logic
    const game = (window as any).poolGame;
    if (!game) return;

    switch (modeId) {
        case 'practice':
            // trigger practice mode
            // We need to simulate key presses or call methods on game
            // Game.ts has '8' for 8-ball toggle.
            // Ideally we should expose methods on Game class.
            // For now, let's just close the modal and let them play whatever is loaded,
            // or try to switch mode if possible.
            if (game.mode !== 0) { // 0 is PRACTICE
                game.mode = 0;
                game.restart();
            }
            break;
        case '8ball':
             if (game.mode !== 1) { // 1 is EIGHT_BALL
                game.mode = 1;
                game.restart();
            }
            break;
        case 'time-attack':
             if (game.mode !== 2) { // 2 is TIME_ATTACK
                game.mode = 2;
                game.restart();
            }
            break;
        case 'perfect':
             if (game.mode !== 3) { // 3 is PERFECT_GAME
                game.mode = 3;
                game.restart();
            }
            break;
    }

    modalService.close();
  }
}

export const homeHub = new HomeHub();

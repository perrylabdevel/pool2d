import { modalService } from './ModalService';
import { SettingsManager } from './SettingsManager';

interface CueSkin {
  id: string;
  name: string;
  rarity: 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
  stickColor: string;
  tipColor: string;
  price?: number;
  description: string;
}

const CUES: CueSkin[] = [
  {
    id: 'default',
    name: 'Standard Issue',
    rarity: 'COMMON',
    stickColor: '#8B4513',
    tipColor: '#4A90E2',
    description: 'Reliable and sturdy house cue.'
  },
  {
    id: 'midnight',
    name: 'Midnight Stealth',
    rarity: 'RARE',
    stickColor: '#1a1a1a',
    tipColor: '#FF3333',
    description: 'Sleek matte black finish for precision strikes.'
  },
  {
    id: 'royal',
    name: 'Royal Oak',
    rarity: 'RARE',
    stickColor: '#5D4037',
    tipColor: '#FFD700',
    description: 'Polished oak with gold accents.'
  },
  {
    id: 'cyber',
    name: 'Cyber Pulse',
    rarity: 'EPIC',
    stickColor: '#00B4FF',
    tipColor: '#FFFFFF',
    description: 'Neon-infused composite material.'
  },
  {
    id: 'viper',
    name: 'Viper Strike',
    rarity: 'EPIC',
    stickColor: '#66FF00',
    tipColor: '#000000',
    description: 'Toxic green finish that glows under low light.'
  },
  {
    id: 'inferno',
    name: 'Dragon\'s Breath',
    rarity: 'LEGENDARY',
    stickColor: '#FF3333',
    tipColor: '#FFD700',
    description: 'Forged in fire. Handles are hot to the touch.'
  }
];

export class ShopModal {
  private settingsManager: SettingsManager;

  constructor(settingsManager: SettingsManager) {
    this.settingsManager = settingsManager;
  }

  open(onClose?: () => void) {
    const currentColors = this.settingsManager.getUIColors();
    // Try to find current cue based on colors, default to 'default'
    const currentCueId = CUES.find(c => c.stickColor === currentColors.cueStickColor)?.id || 'default';

    const container = document.createElement('div');
    container.className = 'shop-modal';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '24px';

    // Shop Header
    const header = document.createElement('div');
    header.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <h2 class="u-font-heading" style="margin: 0; font-size: 28px;">CUE SHOP</h2>
          <div style="color: rgba(255,255,255,0.5); font-size: 14px;">Upgrade your arsenal</div>
        </div>
        <div style="display: flex; align-items: center; gap: 8px; background: rgba(0,0,0,0.3); padding: 8px 16px; borderRadius: 20px; border: 1px solid rgba(255,215,0,0.3);">
          <span style="font-size: 18px;">🪙</span>
          <span class="u-font-heading" style="color: var(--color-arcade-gold); font-size: 18px;">2,500</span>
        </div>
      </div>
    `;
    container.appendChild(header);

    // Cues Carousel Container
    const carouselContainer = document.createElement('div');
    carouselContainer.style.display = 'flex';
    carouselContainer.style.overflowX = 'auto';
    carouselContainer.style.gap = '16px';
    carouselContainer.style.padding = '10px 4px 20px 4px'; // Bottom padding for shadows
    carouselContainer.style.scrollBehavior = 'smooth';
    
    // Hide scrollbar but allow scroll
    carouselContainer.className = 'no-scrollbar';
    const style = document.createElement('style');
    style.textContent = `.no-scrollbar::-webkit-scrollbar { display: none; } .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }`;
    container.appendChild(style);

    CUES.forEach(cue => {
      const card = document.createElement('div');
      card.className = 'u-metallic-border';
      card.style.minWidth = '220px';
      card.style.background = 'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)';
      card.style.borderRadius = '12px';
      card.style.padding = '16px';
      card.style.display = 'flex';
      card.style.flexDirection = 'column';
      card.style.alignItems = 'center';
      card.style.gap = '12px';
      card.style.cursor = 'pointer';
      card.style.transition = 'all 0.2s ease';
      card.style.border = currentCueId === cue.id ? '2px solid var(--color-arcade-green)' : '2px solid transparent';
      card.style.boxShadow = currentCueId === cue.id ? '0 0 20px rgba(102, 255, 0, 0.3)' : 'none';

      // Rarity Badge
      const rarityColors: Record<string, string> = {
        COMMON: '#AAA',
        RARE: '#00B4FF',
        EPIC: '#A335EE',
        LEGENDARY: '#FFD700'
      };
      const badge = document.createElement('div');
      badge.textContent = cue.rarity;
      badge.style.fontSize = '10px';
      badge.style.fontWeight = 'bold';
      badge.style.padding = '2px 8px';
      badge.style.borderRadius = '4px';
      badge.style.background = rarityColors[cue.rarity];
      badge.style.color = '#000';
      badge.style.marginBottom = '4px';
      card.appendChild(badge);

      // Visual Representation (Simple bar for now)
      const visual = document.createElement('div');
      visual.style.width = '100%';
      visual.style.height = '120px';
      visual.style.position = 'relative';
      visual.style.display = 'flex';
      visual.style.alignItems = 'center';
      visual.style.justifyContent = 'center';
      
      // Cue stick visual
      const stick = document.createElement('div');
      stick.style.width = '100%';
      stick.style.height = '8px';
      stick.style.background = cue.stickColor;
      stick.style.borderRadius = '4px';
      stick.style.position = 'relative';
      
      // Cue tip
      const tip = document.createElement('div');
      tip.style.width = '6px';
      tip.style.height = '8px';
      tip.style.background = cue.tipColor;
      tip.style.borderRadius = '2px';
      tip.style.position = 'absolute';
      tip.style.left = '0';
      tip.style.top = '0';
      
      stick.appendChild(tip);
      visual.appendChild(stick);
      card.appendChild(visual);

      // Info
      const name = document.createElement('div');
      name.className = 'u-font-heading';
      name.textContent = cue.name;
      name.style.fontSize = '16px';
      name.style.textAlign = 'center';
      card.appendChild(name);

      const desc = document.createElement('div');
      desc.textContent = cue.description;
      desc.style.fontSize = '12px';
      desc.style.color = 'rgba(255,255,255,0.5)';
      desc.style.textAlign = 'center';
      desc.style.flex = '1';
      card.appendChild(desc);

      // Action Button
      const actionBtn = document.createElement('button');
      if (currentCueId === cue.id) {
        actionBtn.textContent = 'EQUIPPED';
        actionBtn.disabled = true;
        actionBtn.className = 'btn-arcade'; // Base class only for shape
        actionBtn.style.background = 'rgba(255,255,255,0.05)';
        actionBtn.style.color = 'var(--color-arcade-green)';
        actionBtn.style.border = '1px solid var(--color-arcade-green)';
        actionBtn.style.cursor = 'default';
      } else {
        actionBtn.textContent = 'EQUIP';
        actionBtn.className = 'btn-arcade btn-arcade-primary';
        // Remove manual styles that are now covered by class
        // actionBtn.style.background = 'var(--color-arcade-blue)';
      }
      actionBtn.style.width = '100%';
      actionBtn.style.marginTop = '8px';
      
      actionBtn.onclick = (e) => {
        e.stopPropagation();
        if (!actionBtn.disabled) {
          this.equipCue(cue);
          // Refresh modal to show new equipped state
          this.open();
        }
      };

      card.appendChild(actionBtn);
      
      // Click card to equip
      card.onclick = () => {
          if (currentCueId !== cue.id) {
              this.equipCue(cue);
              this.open();
          }
      };

      carouselContainer.appendChild(card);
    });

    container.appendChild(carouselContainer);

    modalService.show({
      title: 'PRO SHOP',
      content: container,
      className: 'shop-modal',
      footer: this.createFooter(onClose)
    });
  }

  equipCue(cue: CueSkin) {
    this.settingsManager.saveUIColors({
      cueStickColor: cue.stickColor,
      cueTipColor: cue.tipColor
    });
    // Play a sound?
  }

  createFooter(onClose?: () => void) {
    const footer = document.createElement('div');
    footer.style.display = 'flex';
    footer.style.justifyContent = 'flex-end';
    
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Back';
    closeBtn.className = 'btn-arcade btn-arcade-glass';
    closeBtn.style.padding = '10px 32px';
    closeBtn.onclick = () => {
        modalService.close();
        onClose?.();
    };
    
    footer.appendChild(closeBtn);
    return footer;
  }
}

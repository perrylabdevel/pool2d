import { modalService } from './ModalService';
import { SettingsManager } from './SettingsManager';

export class ProfileModal {
  private settingsManager: SettingsManager;

  constructor(settingsManager: SettingsManager) {
    this.settingsManager = settingsManager;
  }

  open(onClose?: () => void) {
    const stats = this.settingsManager.getGameStats();
    const winRate = stats.gamesPlayed > 0 ? Math.round((stats.wins / stats.gamesPlayed) * 100) : 0;

    const container = document.createElement('div');
    container.className = 'profile-modal';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '24px';

    // Profile Header
    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.alignItems = 'center';
    header.style.gap = '20px';
    header.style.padding = '20px';
    header.style.background = 'linear-gradient(to right, rgba(255,255,255,0.05), transparent)';
    header.style.borderRadius = '12px';
    header.style.border = '1px solid rgba(255,255,255,0.1)';

    const avatar = document.createElement('div');
    avatar.style.width = '80px';
    avatar.style.height = '80px';
    avatar.style.borderRadius = '50%';
    avatar.style.background = 'radial-gradient(circle at 30% 30%, #4CAF50, #2E7D32)';
    avatar.style.boxShadow = '0 0 20px rgba(76, 175, 80, 0.4)';
    avatar.style.border = '3px solid rgba(255,255,255,0.2)';

    const info = document.createElement('div');
    info.innerHTML = `
      <h2 class="u-font-heading" style="margin: 0 0 4px 0; font-size: 28px;">Player 1</h2>
      <div style="color: rgba(255,255,255,0.5); font-size: 14px;">Level 1 Rookie</div>
    `;

    header.appendChild(avatar);
    header.appendChild(info);
    container.appendChild(header);

    // Stats Grid
    const grid = document.createElement('div');
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = 'repeat(3, 1fr)';
    grid.style.gap = '12px';

    const createStat = (label: string, value: string | number, icon: string) => {
      const card = document.createElement('div');
      card.className = 'stat-card u-frosted-glass';
      card.style.padding = '16px';
      card.style.borderRadius = '8px';
      card.style.textAlign = 'center';
      card.style.display = 'flex';
      card.style.flexDirection = 'column';
      card.style.alignItems = 'center';
      card.style.gap = '8px';

      card.innerHTML = `
        <div style="font-size: 24px;">${icon}</div>
        <div class="u-font-heading" style="font-size: 24px; color: var(--color-arcade-blue);">${value}</div>
        <div style="font-size: 12px; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 1px;">${label}</div>
      `;
      return card;
    };

    grid.appendChild(createStat('Win Rate', `${winRate}%`, '🏆'));
    grid.appendChild(createStat('Wins', stats.wins, '✅'));
    grid.appendChild(createStat('Games', stats.gamesPlayed, '🎮'));
    grid.appendChild(createStat('Streak', stats.winStreak, '🔥'));
    grid.appendChild(createStat('Max Streak', stats.maxWinStreak, '⚡'));
    grid.appendChild(createStat('Balls Potted', stats.ballsPotted, '🎱'));

    container.appendChild(grid);

    // Recent Activity (Placeholder)
    const recent = document.createElement('div');
    recent.innerHTML = `
      <h3 class="u-font-heading" style="margin: 0 0 12px 0; font-size: 18px; color: rgba(255,255,255,0.8);">Recent Matches</h3>
      <div style="display: flex; flex-direction: column; gap: 8px;">
        ${Array.from({ length: 3 }).map(() => `
          <div style="display: flex; justify-content: space-between; padding: 12px; background: rgba(255,255,255,0.03); border-radius: 6px; border-left: 3px solid rgba(255,255,255,0.1);">
            <span style="color: rgba(255,255,255,0.7);">vs AI (Medium)</span>
            <span style="color: rgba(255,255,255,0.3);">Just now</span>
          </div>
        `).join('')}
      </div>
    `;
    container.appendChild(recent);

    modalService.show({
      title: 'PROFILE',
      content: container,
      className: 'profile-modal',
      footer: this.createFooter(onClose)
    });
  }

  createFooter(onClose?: () => void) {
    const footer = document.createElement('div');
    footer.style.display = 'flex';
    footer.style.justifyContent = 'flex-end';
    footer.style.gap = '12px';

    const resetBtn = document.createElement('button');
    resetBtn.textContent = 'Reset Stats';
    resetBtn.className = 'btn-arcade btn-arcade-danger';
    resetBtn.onclick = () => {
        modalService.confirm({
            title: 'RESET STATS',
            message: 'Are you sure you want to reset all your game statistics? This cannot be undone.',
            confirmText: 'YES, RESET',
            onConfirm: () => {
                this.settingsManager.resetGameStats();
                this.open(); // Refresh
            }
        });
    };

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Back';
    closeBtn.className = 'btn-arcade btn-arcade-glass';
    closeBtn.style.padding = '10px 32px';
    closeBtn.onclick = () => {
        modalService.close();
        onClose?.();
    };

    footer.appendChild(resetBtn);
    footer.appendChild(closeBtn);
    return footer;
  }
}

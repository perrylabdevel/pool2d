export interface NotificationOptions {
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  duration?: number;
}

import { uiSoundService } from './UISoundService';

export class NotificationService {
  private container: HTMLElement;

  constructor() {
    this.container = document.createElement('div');
    this.container.id = 'notification-container';
    this.container.style.position = 'fixed';
    this.container.style.top = '140px'; // Below HUD (increased to avoid overlap)
    this.container.style.left = '50%';
    this.container.style.transform = 'translateX(-50%)';
    this.container.style.display = 'flex';
    this.container.style.flexDirection = 'column';
    this.container.style.gap = '10px';
    this.container.style.zIndex = '9000'; // Above most things, below debug overlay
    this.container.style.pointerEvents = 'none'; // Let clicks pass through

    document.body.appendChild(this.container);
  }

  show(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info', duration: number = 3000) {
    const toast = document.createElement('div');
    toast.className = `u-frosted-glass notification-toast type-${type}`;
    toast.textContent = message;

    // Base styles
    toast.style.padding = '12px 24px';
    toast.style.borderRadius = '8px';
    toast.style.color = '#fff';
    toast.style.fontFamily = 'var(--font-heading)';
    toast.style.fontSize = '18px';
    toast.style.letterSpacing = '1px';
    toast.style.textAlign = 'center';
    toast.style.minWidth = '300px';
    toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.5)';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-20px)';
    toast.style.transition = 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';

    // Type specific styles
    if (type === 'error') { // Foul
      toast.style.border = '1px solid rgba(255, 50, 50, 0.5)';
      toast.style.background = 'rgba(100, 0, 0, 0.8)';
      toast.style.boxShadow = '0 0 20px rgba(255, 0, 0, 0.3)';
      toast.style.color = '#FFCCCC';
    } else if (type === 'success') {
      toast.style.border = '1px solid rgba(50, 255, 50, 0.5)';
      toast.style.background = 'rgba(0, 50, 0, 0.8)';
      toast.style.color = '#CCFFCC';
    } else if (type === 'warning') {
      toast.style.border = '1px solid rgba(255, 200, 0, 0.5)';
      toast.style.background = 'rgba(100, 80, 0, 0.8)';
      toast.style.color = '#FFFFCC';
    } else {
      toast.style.border = '1px solid rgba(0, 180, 255, 0.5)';
      toast.style.background = 'rgba(0, 20, 50, 0.8)';
    }

    this.container.appendChild(toast);
    uiSoundService.play('toast');

    // Animate in
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
    });

    // Remove after duration
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-20px)';

      // Wait for fade out then remove DOM
      setTimeout(() => {
        if (toast.parentNode === this.container) {
          this.container.removeChild(toast);
        }
      }, 300);
    }, duration);
  }
}

export const notificationService = new NotificationService();

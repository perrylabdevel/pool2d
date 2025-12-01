export interface NotificationOptions {
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error' | 'epic';
  duration?: number;
  size?: 'normal' | 'large';
}

import { uiSoundService } from './UISoundService';
import { LayoutConstants } from './theme/LayoutConstants';

interface BannerAnimation {
  startTime: number;
  duration: number;
  phase: 'enter' | 'active' | 'exit';
  progress: number;
}

export class NotificationService {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private currentBanner: NotificationOptions | null = null;
  private animation: BannerAnimation | null = null;
  private queue: NotificationOptions[] = [];
  private isShowing: boolean = false;
  private animationFrame: number | null = null;
  private shimmerOffset: number = 0;

  constructor() {
    // Create canvas overlay for notifications
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'notification-canvas';
    this.canvas.style.position = 'fixed';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.zIndex = '9000';
    document.body.appendChild(this.canvas);

    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D context');
    this.ctx = ctx;

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  private resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  show(message: string, type: 'info' | 'success' | 'warning' | 'error' | 'epic' = 'info', duration: number = 3000) {
    const size = type === 'epic' || type === 'success' ? 'large' : 'normal';
    // Epic/Success notifications stay longer by default
    const defaultDuration = (type === 'epic' || type === 'success') ? 4000 : 3000;
    this.queue.push({ message, type, duration: duration || defaultDuration, size });
    this.processQueue();
  }

  private processQueue() {
    if (this.isShowing || this.queue.length === 0) return;

    const next = this.queue.shift();
    if (!next) return;

    this.isShowing = true;
    this.showBanner(next);
  }

  clear() {
    this.queue = [];
    this.dismiss();
  }

  private showBanner(options: NotificationOptions) {
    this.currentBanner = options;
    const enterDuration = LayoutConstants.Animation.Notification.Enter; // e.g. 0.4s
    const activeDuration = options.duration || LayoutConstants.Animation.Notification.Active;
    const exitDuration = LayoutConstants.Animation.Notification.Exit; // e.g. 0.3s

    // Play sound
    if (options.type === 'error') {
      uiSoundService.play('error');
    } else if (options.type === 'success' || options.type === 'epic') {
      uiSoundService.play('toast');
    } else {
      uiSoundService.play('toast');
    }

    // Enter animation
    this.animation = {
      startTime: Date.now(),
      duration: enterDuration,
      phase: 'enter',
      progress: 0
    };

    this.startAnimation();

    // Transition to active phase
    setTimeout(() => {
      if (this.animation) {
        this.animation.phase = 'active';
        this.animation.startTime = Date.now();
        this.animation.duration = activeDuration;
      }
    }, enterDuration);

    // Transition to exit phase
    setTimeout(() => {
      if (this.animation) {
        this.animation.phase = 'exit';
        this.animation.startTime = Date.now();
        this.animation.duration = exitDuration;
      }
    }, enterDuration + activeDuration);

    // Complete and show next
    setTimeout(() => {
      this.dismiss();
    }, enterDuration + activeDuration + exitDuration);
  }

  private startAnimation() {
    const animate = () => {
      if (!this.currentBanner || !this.animation) {
        this.stopAnimation();
        return;
      }

      // Update animation progress
      const elapsed = Date.now() - this.animation.startTime;
      this.animation.progress = Math.min(elapsed / this.animation.duration, 1);

      // Update shimmer effect
      this.shimmerOffset += 0.015;
      if (this.shimmerOffset > 2) this.shimmerOffset = 0;

      // Clear canvas
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      // Render banner
      this.renderBanner();

      this.animationFrame = requestAnimationFrame(animate);
    };

    animate();
  }

  private stopAnimation() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private renderBanner() {
    if (!this.currentBanner || !this.animation) return;

    const ctx = this.ctx;
    const { message, type = 'info' } = this.currentBanner;
    const { phase, progress } = this.animation;

    // Layout configuration
    // Full width banner style
    const bannerWidth = this.canvas.width;
    const bannerHeight = 240; // 3x previous height

    // Target Y position (Vertically centered)
    const targetY = (this.canvas.height - bannerHeight) / 2;

    // Animation transforms
    let offsetX = 0;
    let opacity = 1;

    if (phase === 'enter') {
      // Slide in from Left (offscreen) to Center (0)
      const ease = this.easeOutBack(progress);
      offsetX = -bannerWidth * (1 - ease);
      opacity = progress;
    } else if (phase === 'exit') {
      // Slide out from Center (0) to Left (offscreen)
      const ease = this.easeInQuad(progress);
      offsetX = -bannerWidth * ease;
      opacity = 1 - ease;
    }

    const bannerX = offsetX;
    const bannerY = targetY;

    ctx.save();
    ctx.globalAlpha = opacity;

    this.drawFullWidthBanner(bannerX, bannerY, bannerWidth, bannerHeight, message, type);

    ctx.restore();
  }

  private drawFullWidthBanner(x: number, y: number, width: number, height: number, message: string, type: string) {
    const ctx = this.ctx;
    const colors = this.getTypeColors(type);

    ctx.save();

    // Background: Horizontal Gradient (Transparent -> Opaque -> Transparent)
    const bgGradient = ctx.createLinearGradient(0, y, width, y);
    // 0% transparent
    bgGradient.addColorStop(0, colors.bg + '00');
    // 20% opaque
    bgGradient.addColorStop(0.2, colors.bg + 'CC');
    // 80% opaque
    bgGradient.addColorStop(0.8, colors.bg + 'CC');
    // 100% transparent
    bgGradient.addColorStop(1, colors.bg + '00');

    ctx.fillStyle = bgGradient;
    ctx.fillRect(x, y, width, height);

    // Draw icon
    const iconSize = 80; // Scaled up
    // Position icon to the left of center, relative to the banner's current position (x)
    const centerX = x + width / 2;
    const contentWidth = 600; // Wider content area
    const iconX = centerX - contentWidth / 2;
    const iconY = y + height / 2;

    this.drawIcon(iconX, iconY, type, iconSize, '#FFFFFF');

    // Draw message text
    const fontSize = 48; // Scaled up
    ctx.font = `bold ${fontSize}px "Rajdhani", "Impact", sans-serif`;
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    // Text Shadow
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 2;

    ctx.fillText(message.toUpperCase(), iconX + 100, y + height / 2 + 3);

    ctx.restore();
  }

  private drawIcon(x: number, y: number, type: string, size: number, color: string) {
    const ctx = this.ctx;
    ctx.save();

    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 5;
    ctx.fillStyle = color;

    if (type === 'success' || type === 'epic') {
      this.drawTrophy(x, y, size);
    } else if (type === 'error') {
      this.drawWarning(x, y, size);
    } else if (type === 'warning') {
      this.drawLightning(x, y, size);
    } else {
      this.drawInfoCircle(x, y, size);
    }

    ctx.restore();
  }

  // Icon drawing helpers (simplified for brevity, reused from before but scaled)
  private drawTrophy(x: number, y: number, size: number) {
    const ctx = this.ctx;
    const scale = size / 32;
    ctx.beginPath();
    ctx.arc(x, y - 2 * scale, 10 * scale, Math.PI, 0);
    ctx.lineTo(x + 2 * scale, y + 12 * scale);
    ctx.lineTo(x - 2 * scale, y + 12 * scale);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(x - 8 * scale, y + 12 * scale, 16 * scale, 3 * scale);
  }

  private drawWarning(x: number, y: number, size: number) {
    const ctx = this.ctx;
    const scale = size / 32;
    ctx.strokeStyle = ctx.fillStyle;
    ctx.lineWidth = 4 * scale;
    ctx.beginPath();
    ctx.moveTo(x - 8 * scale, y - 8 * scale);
    ctx.lineTo(x + 8 * scale, y + 8 * scale);
    ctx.moveTo(x + 8 * scale, y - 8 * scale);
    ctx.lineTo(x - 8 * scale, y + 8 * scale);
    ctx.stroke();
  }

  private drawLightning(x: number, y: number, size: number) {
    const ctx = this.ctx;
    const scale = size / 32;
    ctx.beginPath();
    ctx.moveTo(x + 2 * scale, y - 10 * scale);
    ctx.lineTo(x - 6 * scale, y + 2 * scale);
    ctx.lineTo(x, y + 2 * scale);
    ctx.lineTo(x - 2 * scale, y + 10 * scale);
    ctx.lineTo(x + 6 * scale, y - 2 * scale);
    ctx.lineTo(x, y - 2 * scale);
    ctx.closePath();
    ctx.fill();
  }

  private drawInfoCircle(x: number, y: number, size: number) {
    const ctx = this.ctx;
    const scale = size / 32;
    ctx.beginPath();
    ctx.arc(x, y, 10 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0055AA'; // Dark text on light icon
    ctx.font = `bold ${16 * scale}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('i', x, y);
  }

  private getTypeColors(type: string): { bg: string } {
    switch (type) {
      case 'success':
      case 'epic':
      case 'info':
        return { bg: '#004488' }; // Blue
      case 'error':
      case 'warning':
        return { bg: '#880000' }; // Red
      default:
        return { bg: '#004488' }; // Blue
    }
  }

  private easeOutBack(x: number): number {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
  }

  private easeInQuad(x: number): number {
    return x * x;
  }

  private dismiss() {
    this.currentBanner = null;
    this.animation = null;
    this.isShowing = false;
    this.stopAnimation();

    // Process next in queue with a small delay
    setTimeout(() => {
      this.processQueue();
    }, 200);
  }
}

export const notificationService = new NotificationService();

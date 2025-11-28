export interface NotificationOptions {
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error' | 'epic';
  duration?: number;
  size?: 'normal' | 'large';
}

import { uiSoundService } from './UISoundService';
import { drawRoundedRect } from './components/UIComponents';
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
    this.queue.push({ message, type, duration, size });
    this.processQueue();
  }

  private processQueue() {
    if (this.isShowing || this.queue.length === 0) return;

    const next = this.queue.shift();
    if (!next) return;

    this.isShowing = true;
    this.showBanner(next);
  }

  private showBanner(options: NotificationOptions) {
    this.currentBanner = options;
    const enterDuration = LayoutConstants.Animation.Notification.Enter;
    const activeDuration = options.duration || LayoutConstants.Animation.Notification.Active;
    const exitDuration = LayoutConstants.Animation.Notification.Exit;

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
      this.shimmerOffset += 0.02;
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
    const { message, type = 'info', size = 'normal' } = this.currentBanner;
    const { phase, progress } = this.animation;

    // Calculate banner dimensions
    const isLarge = size === 'large';
    const bannerWidth = isLarge ? Math.min(800, this.canvas.width * 0.8) : Math.min(600, this.canvas.width * 0.7);
    const bannerHeight = isLarge ? 120 : 80;
    const bannerX = (this.canvas.width - bannerWidth) / 2;
    const topMargin = 20;

    // Animation transforms
    let offsetY = 0;
    let scale = 1;
    let opacity = 1;

    if (phase === 'enter') {
      // Bounce in from top
      const easeProgress = this.easeOutElastic(progress);
      offsetY = -150 * (1 - easeProgress);
      opacity = progress;
      scale = 0.8 + 0.2 * easeProgress;
    } else if (phase === 'exit') {
      // Fade and scale out
      offsetY = -50 * progress;
      opacity = 1 - progress;
      scale = 1 - 0.1 * progress;
    }

    const bannerY = topMargin + offsetY;

    ctx.save();
    ctx.globalAlpha = opacity;

    // Apply scale transform
    ctx.translate(this.canvas.width / 2, bannerY + bannerHeight / 2);
    ctx.scale(scale, scale);
    ctx.translate(-this.canvas.width / 2, -(bannerY + bannerHeight / 2));

    this.drawPremiumBanner(bannerX, bannerY, bannerWidth, bannerHeight, message, type, isLarge);

    ctx.restore();
  }

  private drawPremiumBanner(x: number, y: number, width: number, height: number, message: string, type: string, isLarge: boolean) {
    const ctx = this.ctx;
    const radius = 12;
    const frameWidth = 4;
    const bevelWidth = 2;

    ctx.save();

    // Enhanced drop shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 12;

    // Outer Frame - Metallic/Wood-grain effect
    drawRoundedRect(ctx, x, y, width, height, radius);
    const frameGradient = ctx.createLinearGradient(x, y, x, y + height);
    frameGradient.addColorStop(0, '#8B7355');
    frameGradient.addColorStop(0.5, '#6B5745');
    frameGradient.addColorStop(1, '#4B3725');
    ctx.fillStyle = frameGradient;
    ctx.fill();

    // Metallic shine
    const shineGradient = ctx.createLinearGradient(x, y, x + width / 3, y);
    shineGradient.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
    shineGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.1)');
    shineGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = shineGradient;
    ctx.fill();

    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // Bevel layer
    const bevelX = x + frameWidth;
    const bevelY = y + frameWidth;
    const bevelFullWidth = width - frameWidth * 2;
    const bevelFullHeight = height - frameWidth * 2;
    const bevelRadius = radius - frameWidth;

    drawRoundedRect(ctx, bevelX, bevelY, bevelFullWidth, bevelFullHeight, bevelRadius);
    const bevelGradient = ctx.createLinearGradient(bevelX, bevelY, bevelX, bevelY + bevelFullHeight);
    bevelGradient.addColorStop(0, '#3a3a3a');
    bevelGradient.addColorStop(0.5, '#2a2a2a');
    bevelGradient.addColorStop(1, '#4a4a4a');
    ctx.fillStyle = bevelGradient;
    ctx.fill();

    // Inner content area
    const innerX = bevelX + bevelWidth;
    const innerY = bevelY + bevelWidth;
    const innerWidth = bevelFullWidth - bevelWidth * 2;
    const innerHeight = bevelFullHeight - bevelWidth * 2;
    const innerRadius = bevelRadius - bevelWidth;

    // Background with type-specific gradient
    drawRoundedRect(ctx, innerX, innerY, innerWidth, innerHeight, innerRadius);
    const bgGradient = ctx.createLinearGradient(innerX, innerY, innerX + innerWidth, innerY);

    const colors = this.getTypeColors(type);
    bgGradient.addColorStop(0, colors.dark);
    bgGradient.addColorStop(0.5, colors.mid);
    bgGradient.addColorStop(1, colors.dark);
    ctx.fillStyle = bgGradient;
    ctx.fill();

    // Animated shimmer effect
    const shimmerX = innerX + (innerWidth + 200) * this.shimmerOffset - 200;
    const shimmerGradient = ctx.createLinearGradient(shimmerX, innerY, shimmerX + 200, innerY);
    shimmerGradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
    shimmerGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.3)');
    shimmerGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = shimmerGradient;
    ctx.fill();

    // Draw icon
    this.drawIcon(innerX + 30, innerY + innerHeight / 2, type, isLarge ? 36 : 28, colors.accent);

    // Draw message text
    const textX = innerX + (isLarge ? 80 : 70);
    const fontSize = isLarge ? 28 : 20;
    ctx.font = `900 ${fontSize}px "Rajdhani", "Impact", sans-serif`;
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    ctx.fillText(message.toUpperCase(), textX, innerY + innerHeight / 2);

    // Reset shadows
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // Corner accents
    const cornerSize = 16;
    const cornerInset = frameWidth + bevelWidth + 2;
    ctx.strokeStyle = colors.accent + '99';
    ctx.lineWidth = 2;

    // Top-left
    ctx.beginPath();
    ctx.moveTo(x + cornerInset + cornerSize, y + cornerInset);
    ctx.lineTo(x + cornerInset, y + cornerInset);
    ctx.lineTo(x + cornerInset, y + cornerInset + cornerSize);
    ctx.stroke();

    // Top-right
    ctx.beginPath();
    ctx.moveTo(x + width - cornerInset - cornerSize, y + cornerInset);
    ctx.lineTo(x + width - cornerInset, y + cornerInset);
    ctx.lineTo(x + width - cornerInset, y + cornerInset + cornerSize);
    ctx.stroke();

    ctx.restore();
  }

  private drawIcon(x: number, y: number, type: string, size: number, color: string) {
    const ctx = this.ctx;
    ctx.save();

    ctx.shadowColor = color;
    ctx.shadowBlur = 15;
    ctx.fillStyle = color;

    // Draw custom icons based on type
    if (type === 'success' || type === 'epic') {
      // Trophy icon
      this.drawTrophy(x, y, size);
    } else if (type === 'error') {
      // Warning/X icon
      this.drawWarning(x, y, size);
    } else if (type === 'warning') {
      // Lightning bolt
      this.drawLightning(x, y, size);
    } else {
      // Info circle
      this.drawInfoCircle(x, y, size);
    }

    ctx.restore();
  }

  private drawTrophy(x: number, y: number, size: number) {
    const ctx = this.ctx;
    const scale = size / 32;

    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    // Cup body
    ctx.arc(x, y, 10 * scale, Math.PI, 0);
    ctx.lineTo(x + 10 * scale, y + 10 * scale);
    ctx.lineTo(x - 10 * scale, y + 10 * scale);
    ctx.closePath();
    ctx.fill();

    // Base
    ctx.fillRect(x - 12 * scale, y + 10 * scale, 24 * scale, 3 * scale);
  }

  private drawWarning(x: number, y: number, size: number) {
    const ctx = this.ctx;
    const scale = size / 32;

    ctx.fillStyle = '#FF3333';
    ctx.strokeStyle = '#FF3333';
    ctx.lineWidth = 4 * scale;

    // X shape
    ctx.beginPath();
    ctx.moveTo(x - 10 * scale, y - 10 * scale);
    ctx.lineTo(x + 10 * scale, y + 10 * scale);
    ctx.moveTo(x + 10 * scale, y - 10 * scale);
    ctx.lineTo(x - 10 * scale, y + 10 * scale);
    ctx.stroke();
  }

  private drawLightning(x: number, y: number, size: number) {
    const ctx = this.ctx;
    const scale = size / 32;

    ctx.fillStyle = '#FF8C00';
    ctx.beginPath();
    ctx.moveTo(x, y - 12 * scale);
    ctx.lineTo(x - 6 * scale, y);
    ctx.lineTo(x + 2 * scale, y);
    ctx.lineTo(x, y + 12 * scale);
    ctx.lineTo(x + 6 * scale, y);
    ctx.lineTo(x - 2 * scale, y);
    ctx.closePath();
    ctx.fill();
  }

  private drawInfoCircle(x: number, y: number, size: number) {
    const ctx = this.ctx;
    const scale = size / 32;

    ctx.fillStyle = '#00B4FF';
    ctx.beginPath();
    ctx.arc(x, y, 12 * scale, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold ${20 * scale}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('i', x, y);
  }

  private getTypeColors(type: string): { dark: string; mid: string; accent: string } {
    switch (type) {
      case 'success':
        return { dark: '#1a5c1a', mid: '#2d8b2d', accent: '#4CAF50' };
      case 'epic':
        return { dark: '#4a2c6b', mid: '#7b3fb2', accent: '#FFD700' };
      case 'error':
        return { dark: '#5c1a1a', mid: '#8b2d2d', accent: '#FF3333' };
      case 'warning':
        return { dark: '#5c4a1a', mid: '#8b702d', accent: '#FF8C00' };
      default:
        return { dark: '#1a3a5c', mid: '#2d5a8b', accent: '#00B4FF' };
    }
  }

  private easeOutElastic(x: number): number {
    const c4 = (2 * Math.PI) / 3;
    return x === 0 ? 0 : x === 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * c4) + 1;
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

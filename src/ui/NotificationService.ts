import { uiSoundService } from './UISoundService';
import { LayoutConstants } from './theme/LayoutConstants';
import { STORAGE_KEYS } from '../settings/StorageKeys';

export type NotificationType = 'info' | 'success' | 'warning' | 'error' | 'epic';
export type NotificationChannel = 'system' | 'gameplay' | 'ui' | 'tournament';
export type NotificationPosition =
  | 'top-left'
  | 'top'
  | 'top-right'
  | 'center'
  | 'bottom-left'
  | 'bottom'
  | 'bottom-right';
export type NotificationPriority = 'low' | 'normal' | 'high' | 'critical';
export type NotificationReplaceMode = 'stack' | 'replace';
export type NotificationStylePreset = 'banner' | 'toast';

export interface NotificationRequest {
  message: string;
  type?: NotificationType;
  duration?: number;
  size?: 'normal' | 'large';
  channel?: NotificationChannel;
  priority?: NotificationPriority;
  dedupeKey?: string;
  replaceMode?: NotificationReplaceMode;
  icon?: string;
  accentColor?: string;
  sound?: 'toast' | 'error' | 'none';
}

export interface NotificationTypeSettings {
  duration?: number;
  size?: 'normal' | 'large';
  icon?: string;
  accentColor?: string;
  sound?: 'toast' | 'error' | 'none';
  channel?: NotificationChannel;
  priority?: NotificationPriority;
  replaceMode?: NotificationReplaceMode;
}

export interface NotificationConfig {
  maxQueue: number;
  maxVisiblePerPosition: number;
  dedupeWindowMs: number;
  defaultDurations: Record<NotificationType, number>;
  positions: Record<NotificationChannel, NotificationPosition>;
  stackSpacing: number;
  soundEnabled: boolean;
  nonInterruptibleChannels: NotificationChannel[];
  stylePreset: NotificationStylePreset;
  typeSettings: Record<NotificationType, NotificationTypeSettings>;
}

interface QueuedNotification {
  id: string;
  request: Required<NotificationRequest>;
  queuedAt: number;
  priorityValue: number;
  position: NotificationPosition;
}

interface ActiveNotification {
  id: string;
  element: HTMLElement;
  request: Required<NotificationRequest>;
  timeoutId: number | null;
  exitTimeoutId: number | null;
  position: NotificationPosition;
}

interface BannerAnimation {
  startTime: number;
  duration: number;
  phase: 'enter' | 'active' | 'exit';
  progress: number;
}

interface BannerEditorConfig {
  height: number;
  background: {
    type: 'solid' | 'gradient' | 'image';
    color?: string;
    gradient?: {
      type: 'linear' | 'radial';
      angle?: number;
      stops: Array<{ offset: number; color: string }>;
    };
    image?: {
      src: string;
      fit: 'cover' | 'contain' | 'stretch' | 'tile' | '9slice';
      tint?: string;
      tintOpacity?: number;
    };
  };
  frame: {
    enabled: boolean;
    width: number;
    color: string;
    radius: number;
  };
  shadow: {
    enabled: boolean;
    offsetX: number;
    offsetY: number;
    blur: number;
    color: string;
  };
  glow: {
    enabled: boolean;
    blur: number;
    color: string;
  };
  animation: {
    entry: { type: string; duration: number; easing?: string };
    hold: number;
    exit: { type: string; duration: number; easing?: string };
  };
  text: { fontSize: number; fontWeight: number; color?: string };
  icon: { enabled: boolean; size: number };
  effects: {
    shimmer: boolean;
    shimmerSpeed: number;
  };
}

const DEFAULT_CONFIG: NotificationConfig = {
  maxQueue: 8,
  maxVisiblePerPosition: 1,
  dedupeWindowMs: 1200,
  defaultDurations: {
    info: LayoutConstants.Animation.Notification.Toast,
    success: LayoutConstants.Animation.Notification.Toast + 600,
    warning: LayoutConstants.Animation.Notification.Toast,
    error: LayoutConstants.Animation.Notification.Toast + 800,
    epic: LayoutConstants.Animation.Notification.Toast + 1200,
  },
  positions: {
    system: 'top',
    gameplay: 'top',
    tournament: 'top',
    ui: 'top-right',
  },
  stackSpacing: 10,
  soundEnabled: true,
  nonInterruptibleChannels: ['tournament'],
  stylePreset: 'banner',
  typeSettings: {
    info: { channel: 'ui', priority: 'normal', replaceMode: 'stack' },
    success: { channel: 'ui', priority: 'normal', replaceMode: 'stack' },
    warning: { channel: 'gameplay', priority: 'high', replaceMode: 'stack' },
    error: { channel: 'gameplay', priority: 'critical', replaceMode: 'stack', sound: 'error' },
    epic: { channel: 'gameplay', priority: 'high', replaceMode: 'stack', size: 'large' },
  },
};

const POSITION_LIST: NotificationPosition[] = [
  'top-left',
  'top',
  'top-right',
  'center',
  'bottom-left',
  'bottom',
  'bottom-right',
];

const PRIORITY_VALUES: Record<NotificationPriority, number> = {
  low: 0,
  normal: 1,
  high: 2,
  critical: 3,
};

export class NotificationService {
  private container: HTMLElement;
  private stacks: Map<NotificationPosition, HTMLElement> = new Map();
  private queue: QueuedNotification[] = [];
  private active: Map<string, ActiveNotification> = new Map();
  private dedupeMap: Map<string, number> = new Map();
  private config: NotificationConfig = { ...DEFAULT_CONFIG };

  private bannerCanvas: HTMLCanvasElement;
  private bannerCtx: CanvasRenderingContext2D;
  private bannerAnimation: BannerAnimation | null = null;
  private currentBanner: Required<NotificationRequest> | null = null;
  private bannerAnimationFrame: number | null = null;
  private bannerTimerIds: number[] = [];
  private bannerEditorConfig: BannerEditorConfig = {
    height: 240,
    background: {
      type: 'gradient',
      color: '#004488',
      gradient: {
        type: 'linear',
        angle: 0,
        stops: [
          { offset: 0, color: '#00448800' },
          { offset: 0.2, color: '#004488CC' },
          { offset: 0.8, color: '#004488CC' },
          { offset: 1, color: '#00448800' },
        ],
      },
    },
    frame: { enabled: false, width: 0, color: '#000000', radius: 0 },
    shadow: { enabled: false, offsetX: 0, offsetY: 0, blur: 0, color: 'rgba(0,0,0,0)' },
    glow: { enabled: false, blur: 10, color: '#89b4fa' },
    animation: {
      entry: { type: 'slide-right', duration: 400, easing: 'ease-out-back' },
      hold: 3000,
      exit: { type: 'slide-left', duration: 300, easing: 'ease-in' },
    },
    text: { fontSize: 48, fontWeight: 700, color: '#ffffff' },
    icon: { enabled: true, size: 80 },
    effects: { shimmer: false, shimmerSpeed: 1 },
  };
  private cachedBannerImage: HTMLImageElement | null = null;
  private cachedBannerImageSrc: string = '';
  private shimmerOffset: number = 0;

  constructor() {
    this.container = this.ensureContainer();
    this.bannerCanvas = this.createBannerCanvas();
    const ctx = this.bannerCanvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D context');
    this.bannerCtx = ctx;

    this.loadConfigFromStorage();
    this.loadBannerEditorConfig();
    this.ensureStacks();
    this.applyStackSpacing();
    this.syncToastVisibility();
    this.resizeBannerCanvas();

    window.addEventListener('resize', () => this.resizeBannerCanvas());
    window.addEventListener('notification-editor:apply-config', (event: Event) => {
      const detail = (event as CustomEvent<{ config?: Partial<NotificationConfig> }>).detail;
      if (detail?.config) {
        this.updateConfig(detail.config);
      }
    });

    // Listen for banner editor config updates (from localStorage push in editor)
    window.addEventListener('banner-editor:push', (event: Event) => {
      const detail = (event as CustomEvent<{ config?: BannerEditorConfig }>).detail;
      if (detail?.config) {
        this.updateBannerEditorConfig(detail.config);
      }
    });

    // Listen for banner editor config updates (from RemoteBridge WebSocket)
    window.addEventListener('banner-editor:apply-config', (event: Event) => {
      const detail = (event as CustomEvent<{ config?: BannerEditorConfig }>).detail;
      if (detail?.config) {
        this.updateBannerEditorConfig(detail.config);
      }
    });
  }

  show(message: string, type: NotificationType = 'info', duration?: number): string | null;
  show(options: NotificationRequest): string | null;
  show(messageOrOptions: string | NotificationRequest, type: NotificationType = 'info', duration?: number): string | null {
    const request = typeof messageOrOptions === 'string'
      ? { message: messageOrOptions, type, duration }
      : messageOrOptions;
    return this.enqueue(request);
  }

  /**
   * Returns true if a banner is currently showing (including during exit animation).
   * Use this to block game actions like shooting while notifications are visible.
   */
  isBannerActive(): boolean {
    return this.currentBanner !== null || this.bannerAnimation !== null;
  }

  clear() {
    this.queue = [];
    this.dedupeMap.clear();
    this.active.forEach((toast) => this.removeToast(toast, true));
    this.active.clear();
    this.dismissBanner(true);
  }

  updateConfig(partial: Partial<NotificationConfig>) {
    const coerced = { ...partial };
    if (coerced.stylePreset && coerced.stylePreset !== 'banner') {
      coerced.stylePreset = 'banner';
    }
    const next = this.mergeConfig(this.config, coerced);
    const styleChanged = next.stylePreset !== this.config.stylePreset;
    this.config = next;
    this.ensureStacks();
    this.applyStackSpacing();
    this.syncToastVisibility();
    if (styleChanged) {
      this.clear();
    }
  }

  getConfig(): NotificationConfig {
    return { ...this.config };
  }

  private enqueue(request: NotificationRequest): string | null {
    const normalized = this.normalizeRequest(request);
    const dedupeKey = normalized.dedupeKey;
    const now = Date.now();

    const lastSeen = this.dedupeMap.get(dedupeKey);
    if (lastSeen && now - lastSeen < this.config.dedupeWindowMs) {
      return null;
    }
    this.dedupeMap.set(dedupeKey, now);

    const position = this.config.positions[normalized.channel];
    const priorityValue = PRIORITY_VALUES[normalized.priority];

    const queued: QueuedNotification = {
      id: this.generateId(),
      request: normalized,
      queuedAt: now,
      priorityValue,
      position,
    };

    if (this.queue.length >= this.config.maxQueue) {
      const dropIndex = this.findDropCandidateIndex(priorityValue);
      if (dropIndex === -1) {
        return null;
      }
      this.queue.splice(dropIndex, 1);
    }

    this.queue.push(queued);
    this.processQueue();
    return queued.id;
  }

  private processQueue() {
    let didShow = true;
    while (didShow) {
      didShow = false;
      const nextIndex = this.findNextEligibleIndex();
      if (nextIndex === -1) return;
      const [next] = this.queue.splice(nextIndex, 1);
      this.showToast(next);
      didShow = true;
    }
  }

  private findNextEligibleIndex(): number {
    if (!this.queue.length) return -1;

    const blockedChannel = this.getBlockingChannel();

    let bestIndex = -1;
    let bestPriority = -1;
    let bestTime = Infinity;

    for (let i = 0; i < this.queue.length; i += 1) {
      const queued = this.queue[i];
      const { request, position, priorityValue, queuedAt } = queued;

      if (blockedChannel && request.channel !== blockedChannel) {
        continue;
      }

      if (!this.hasSpaceForPosition(position)) {
        continue;
      }

      if (priorityValue > bestPriority || (priorityValue === bestPriority && queuedAt < bestTime)) {
        bestPriority = priorityValue;
        bestTime = queuedAt;
        bestIndex = i;
      }
    }

    return bestIndex;
  }

  private getBlockingChannel(): NotificationChannel | null {
    const blocking = this.config.nonInterruptibleChannels;
    for (const toast of this.active.values()) {
      if (blocking.includes(toast.request.channel)) {
        return toast.request.channel;
      }
    }
    if (this.currentBanner && blocking.includes(this.currentBanner.channel)) {
      return this.currentBanner.channel;
    }
    return null;
  }

  private showToast(queued: QueuedNotification) {
    if (this.config.stylePreset === 'banner') {
      this.showBanner(queued);
      return;
    }
    const { request, position } = queued;

    if (request.replaceMode === 'replace') {
      this.active.forEach((toast) => {
        if (toast.request.channel === request.channel) {
          this.removeToast(toast, false);
        }
      });
    }

    const stack = this.stacks.get(position);
    if (!stack) return;

    const toast = document.createElement('div');
    toast.className = `notification-toast type-${request.type} size-${request.size}`;
    if (request.accentColor) {
      toast.style.setProperty('--notify-accent', request.accentColor);
    }
    toast.dataset.channel = request.channel;

    const icon = document.createElement('div');
    icon.className = 'notification-icon';
    icon.textContent = request.icon || this.getIconForType(request.type);

    const text = document.createElement('div');
    text.className = 'notification-text';
    text.textContent = request.message;

    toast.appendChild(icon);
    toast.appendChild(text);

    stack.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add('is-visible');
    });

    if (this.config.soundEnabled) {
      this.playSound(request.type, request.sound);
    }

    const active: ActiveNotification = {
      id: queued.id,
      element: toast,
      request,
      timeoutId: null,
      exitTimeoutId: null,
      position,
    };

    const duration = request.duration;
    active.timeoutId = window.setTimeout(() => {
      this.removeToast(active, false);
    }, duration);

    this.active.set(active.id, active);
  }

  private showBanner(queued: QueuedNotification) {
    const { request } = queued;

    if (request.replaceMode === 'replace' && this.currentBanner) {
      this.dismissBanner(false);
    }

    if (this.currentBanner) {
      return;
    }

    this.currentBanner = request;

    if (this.config.soundEnabled) {
      this.playSound(request.type, request.sound);
    }

    this.startBannerAnimation();
  }

  private startBannerAnimation() {
    if (!this.currentBanner) return;
    this.stopBannerAnimation();

    const enterDuration = this.bannerEditorConfig.animation.entry.duration;
    const activeDuration = this.bannerEditorConfig.animation.hold;
    const exitDuration = this.bannerEditorConfig.animation.exit.duration;

    this.bannerAnimation = {
      startTime: Date.now(),
      duration: enterDuration,
      phase: 'enter',
      progress: 0,
    };

    this.animateBanner();

    this.bannerTimerIds.push(window.setTimeout(() => {
      if (this.bannerAnimation) {
        this.bannerAnimation.phase = 'active';
        this.bannerAnimation.startTime = Date.now();
        this.bannerAnimation.duration = activeDuration;
      }
    }, enterDuration));

    this.bannerTimerIds.push(window.setTimeout(() => {
      if (this.bannerAnimation) {
        this.bannerAnimation.phase = 'exit';
        this.bannerAnimation.startTime = Date.now();
        this.bannerAnimation.duration = exitDuration;
      }
    }, enterDuration + activeDuration));

    this.bannerTimerIds.push(window.setTimeout(() => {
      this.dismissBanner(false);
    }, enterDuration + activeDuration + exitDuration));
  }

  private animateBanner() {
    const animate = () => {
      if (!this.currentBanner || !this.bannerAnimation) {
        this.stopBannerAnimation();
        return;
      }

      const elapsed = Date.now() - this.bannerAnimation.startTime;
      this.bannerAnimation.progress = Math.min(elapsed / this.bannerAnimation.duration, 1);

      this.bannerCtx.clearRect(0, 0, this.bannerCanvas.width, this.bannerCanvas.height);
      this.renderBanner();

      this.bannerAnimationFrame = requestAnimationFrame(animate);
    };

    animate();
  }

  private stopBannerAnimation() {
    if (this.bannerAnimationFrame) {
      cancelAnimationFrame(this.bannerAnimationFrame);
      this.bannerAnimationFrame = null;
    }
    this.bannerCtx.clearRect(0, 0, this.bannerCanvas.width, this.bannerCanvas.height);
  }

  private renderBanner() {
    if (!this.currentBanner || !this.bannerAnimation) return;

    const ctx = this.bannerCtx;
    const { message, type = 'info' } = this.currentBanner;
    const { phase, progress } = this.bannerAnimation;

    // Full-width banner style
    const bannerWidth = this.bannerCanvas.width;
    const bannerHeight = this.bannerEditorConfig.height;

    // Vertically centered
    const targetY = (this.bannerCanvas.height - bannerHeight) / 2;

    // Horizontal slide animation
    let offsetX = 0;
    let opacity = 1;

    if (phase === 'enter') {
      // Slide in from left
      const ease = this.easeOutBack(progress);
      offsetX = -bannerWidth * (1 - ease);
      opacity = progress;
    } else if (phase === 'exit') {
      // Slide out to left
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
    const ctx = this.bannerCtx;
    const { background, frame, shadow, glow, text, icon, effects } = this.bannerEditorConfig;
    const fallbackColor = this.getBannerTypeColors(type).bg;

    ctx.save();

    // Glow effect (drawn first, behind everything)
    if (glow.enabled) {
      ctx.shadowColor = glow.color;
      ctx.shadowBlur = glow.blur;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    }

    // Shadow effect
    if (shadow.enabled) {
      ctx.shadowColor = shadow.color;
      ctx.shadowBlur = shadow.blur;
      ctx.shadowOffsetX = shadow.offsetX;
      ctx.shadowOffsetY = shadow.offsetY;
    }

    // Background
    const bgColor = background.color || fallbackColor;
    if (background.type === 'image' && background.image?.src) {
      // Draw image background
      const img = this.loadBannerImage(background.image.src);
      if (img) {
        // Cover fit
        const imgRatio = img.width / img.height;
        const bannerRatio = width / height;
        let drawW = width;
        let drawH = height;
        let drawX = x;
        let drawY = y;
        if (imgRatio > bannerRatio) {
          drawH = height;
          drawW = height * imgRatio;
          drawX = x + (width - drawW) / 2;
        } else {
          drawW = width;
          drawH = width / imgRatio;
          drawY = y + (height - drawH) / 2;
        }
        ctx.drawImage(img, drawX, drawY, drawW, drawH);

        // Tint overlay
        if (background.image.tint && (background.image.tintOpacity ?? 0) > 0) {
          ctx.fillStyle = background.image.tint;
          ctx.globalAlpha = background.image.tintOpacity ?? 0;
          ctx.fillRect(x, y, width, height);
          ctx.globalAlpha = 1;
        }
      } else {
        // Fallback to solid while loading
        ctx.fillStyle = bgColor;
        ctx.fillRect(x, y, width, height);
      }
    } else if (background.type === 'gradient' && background.gradient) {
      const grad = ctx.createLinearGradient(0, y, width, y);
      for (const stop of background.gradient.stops) {
        grad.addColorStop(stop.offset, stop.color);
      }
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, width, height);
    } else {
      // Solid color - create horizontal fade gradient
      const solidGrad = ctx.createLinearGradient(0, y, width, y);
      solidGrad.addColorStop(0, bgColor + '00');
      solidGrad.addColorStop(0.2, bgColor + 'CC');
      solidGrad.addColorStop(0.8, bgColor + 'CC');
      solidGrad.addColorStop(1, bgColor + '00');
      ctx.fillStyle = solidGrad;
      ctx.fillRect(x, y, width, height);
    }

    // Reset shadow for frame/content
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // Frame
    if (frame.enabled && frame.width > 0) {
      ctx.strokeStyle = frame.color;
      ctx.lineWidth = frame.width;
      if (frame.radius > 0) {
        this.roundRect(ctx, x, y, width, height, frame.radius);
        ctx.stroke();
      } else {
        ctx.strokeRect(x, y, width, height);
      }
    }

    // Shimmer effect
    if (effects.shimmer) {
      this.shimmerOffset += effects.shimmerSpeed * 1.5;
      if (this.shimmerOffset > width + 200) this.shimmerOffset = -200;

      const shimmerGrad = ctx.createLinearGradient(
        x + this.shimmerOffset - 100, y,
        x + this.shimmerOffset + 100, y
      );
      shimmerGrad.addColorStop(0, 'rgba(255,255,255,0)');
      shimmerGrad.addColorStop(0.5, 'rgba(255,255,255,0.15)');
      shimmerGrad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = shimmerGrad;
      ctx.fillRect(x, y, width, height);
    }

    // Icon
    const iconSize = icon.size;
    const centerX = x + width / 2;
    const contentWidth = 600;
    const iconX = centerX - contentWidth / 2;
    const iconY = y + height / 2;

    if (icon.enabled) {
      this.drawIcon(iconX, iconY, type, iconSize, text.color || '#FFFFFF');
    }

    // Text
    const fontSize = text.fontSize;
    ctx.font = `${text.fontWeight} ${fontSize}px "Rajdhani", "Impact", sans-serif`;
    ctx.fillStyle = text.color || '#FFFFFF';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 2;

    const textX = icon.enabled ? iconX + 100 : iconX;
    ctx.fillText(message.toUpperCase(), textX, y + height / 2 + 3);

    ctx.restore();
  }

  private loadBannerImage(src: string): HTMLImageElement | null {
    if (this.cachedBannerImageSrc === src && this.cachedBannerImage) {
      return this.cachedBannerImage;
    }
    if (this.cachedBannerImageSrc !== src) {
      this.cachedBannerImageSrc = src;
      this.cachedBannerImage = null;
      const img = new Image();
      img.onload = () => {
        this.cachedBannerImage = img;
      };
      img.src = src;
    }
    return this.cachedBannerImage;
  }

  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  private getBannerTypeColors(type: string): { bg: string } {
    switch (type) {
      case 'success':
      case 'epic':
      case 'info':
        return { bg: '#004488' }; // Blue
      case 'error':
      case 'warning':
        return { bg: '#880000' }; // Red
      default:
        return { bg: '#004488' };
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

  private drawIcon(x: number, y: number, type: string, size: number, color: string) {
    const ctx = this.bannerCtx;
    ctx.save();

    ctx.shadowColor = color;
    ctx.shadowBlur = 15;
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

  private drawTrophy(x: number, y: number, size: number) {
    const ctx = this.bannerCtx;
    const scale = size / 32;

    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.arc(x, y, 10 * scale, Math.PI, 0);
    ctx.lineTo(x + 10 * scale, y + 10 * scale);
    ctx.lineTo(x - 10 * scale, y + 10 * scale);
    ctx.closePath();
    ctx.fill();

    ctx.fillRect(x - 12 * scale, y + 10 * scale, 24 * scale, 3 * scale);
  }

  private drawWarning(x: number, y: number, size: number) {
    const ctx = this.bannerCtx;
    const scale = size / 32;

    ctx.fillStyle = '#FF3333';
    ctx.strokeStyle = '#FF3333';
    ctx.lineWidth = 4 * scale;

    ctx.beginPath();
    ctx.moveTo(x - 10 * scale, y - 10 * scale);
    ctx.lineTo(x + 10 * scale, y + 10 * scale);
    ctx.moveTo(x + 10 * scale, y - 10 * scale);
    ctx.lineTo(x - 10 * scale, y + 10 * scale);
    ctx.stroke();
  }

  private drawLightning(x: number, y: number, size: number) {
    const ctx = this.bannerCtx;
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
    const ctx = this.bannerCtx;
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

  private dismissBanner(immediate: boolean) {
    if (!this.currentBanner) {
      this.stopBannerAnimation();
      return;
    }

    if (immediate) {
      this.currentBanner = null;
      this.bannerAnimation = null;
      this.stopBannerAnimation();
      this.clearBannerTimers();
      this.processQueue();
      return;
    }

    this.currentBanner = null;
    this.bannerAnimation = null;
    this.stopBannerAnimation();
    this.clearBannerTimers();

    window.setTimeout(() => this.processQueue(), 200);
  }

  private clearBannerTimers() {
    this.bannerTimerIds.forEach((id) => window.clearTimeout(id));
    this.bannerTimerIds = [];
  }

  private removeToast(toast: ActiveNotification, immediate: boolean) {
    if (toast.timeoutId) window.clearTimeout(toast.timeoutId);
    if (toast.exitTimeoutId) window.clearTimeout(toast.exitTimeoutId);

    if (immediate) {
      toast.element.remove();
      this.active.delete(toast.id);
      this.processQueue();
      return;
    }

    toast.element.classList.remove('is-visible');
    toast.element.classList.add('is-exiting');

    toast.exitTimeoutId = window.setTimeout(() => {
      toast.element.remove();
      this.active.delete(toast.id);
      this.processQueue();
    }, 260);
  }

  private normalizeRequest(request: NotificationRequest): Required<NotificationRequest> {
    const type = request.type ?? 'info';
    const typeDefaults = this.config.typeSettings[type] ?? {};
    const size = request.size ?? typeDefaults.size ?? 'normal';
    const channel = request.channel ?? typeDefaults.channel ?? 'ui';
    const priority = request.priority ?? typeDefaults.priority ?? 'normal';
    const replaceMode = request.replaceMode ?? typeDefaults.replaceMode ?? 'stack';
    const duration = request.duration ?? typeDefaults.duration ?? this.config.defaultDurations[type];
    const dedupeKey = request.dedupeKey ?? `${channel}:${type}:${request.message}`;
    const icon = request.icon ?? typeDefaults.icon ?? '';
    const accentColor = request.accentColor ?? typeDefaults.accentColor ?? '';
    const sound = request.sound ?? typeDefaults.sound ?? 'toast';

    return {
      message: request.message,
      type,
      size,
      channel,
      priority,
      replaceMode,
      duration,
      dedupeKey,
      icon,
      accentColor,
      sound,
    };
  }

  private ensureContainer(): HTMLElement {
    let container = document.getElementById('notification-container');
    if (container) return container;

    container = document.createElement('div');
    container.id = 'notification-container';
    document.body.appendChild(container);
    return container;
  }

  private createBannerCanvas(): HTMLCanvasElement {
    let canvas = document.getElementById('notification-canvas') as HTMLCanvasElement | null;
    if (canvas) return canvas;
    canvas = document.createElement('canvas');
    canvas.id = 'notification-canvas';
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '9000';
    document.body.appendChild(canvas);
    return canvas;
  }

  private resizeBannerCanvas() {
    this.bannerCanvas.width = window.innerWidth;
    this.bannerCanvas.height = window.innerHeight;
  }

  private ensureStacks() {
    POSITION_LIST.forEach((position) => {
      if (this.stacks.has(position)) return;
      const stack = document.createElement('div');
      stack.className = `notification-stack position-${position}`;
      stack.dataset.position = position;
      this.container.appendChild(stack);
      this.stacks.set(position, stack);
    });
  }

  private applyStackSpacing() {
    this.container.style.setProperty('--notification-stack-gap', `${this.config.stackSpacing}px`);
  }

  private syncToastVisibility() {
    const showToasts = this.config.stylePreset !== 'banner';
    this.container.style.display = showToasts ? 'block' : 'none';
  }

  private hasSpaceForPosition(position: NotificationPosition): boolean {
    if (this.config.stylePreset === 'banner') {
      return !this.currentBanner;
    }
    let count = 0;
    this.active.forEach((toast) => {
      if (toast.position === position) count += 1;
    });
    return count < this.config.maxVisiblePerPosition;
  }

  private findDropCandidateIndex(newPriorityValue: number): number {
    if (!this.queue.length) return -1;

    let minPriority = Infinity;
    let oldestTime = Infinity;
    let candidateIndex = -1;

    this.queue.forEach((item, index) => {
      if (item.priorityValue < minPriority || (item.priorityValue === minPriority && item.queuedAt < oldestTime)) {
        minPriority = item.priorityValue;
        oldestTime = item.queuedAt;
        candidateIndex = index;
      }
    });

    if (newPriorityValue <= minPriority) {
      return -1;
    }

    return candidateIndex;
  }

  private playSound(type: NotificationType, override?: 'toast' | 'error' | 'none') {
    if (override === 'none') return;
    const sound = override ?? (type === 'error' ? 'error' : 'toast');
    if (sound === 'error') {
      uiSoundService.play('error');
    } else {
      uiSoundService.play('toast');
    }
  }

  private getIconForType(type: NotificationType): string {
    switch (type) {
      case 'success':
        return '✓';
      case 'warning':
        return '!';
      case 'error':
        return '×';
      case 'epic':
        return '★';
      default:
        return '•';
    }
  }

  private loadConfigFromStorage() {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.NOTIFICATION_CONFIG);
      if (!stored) return;
      const parsed = JSON.parse(stored);
      if (parsed?.stylePreset && parsed.stylePreset !== 'banner') {
        parsed.stylePreset = 'banner';
        try {
          localStorage.setItem(STORAGE_KEYS.NOTIFICATION_CONFIG, JSON.stringify(parsed));
        } catch {
          // ignore write failures
        }
      }
      this.config = this.mergeConfig(this.config, parsed);
    } catch (e) {
      console.warn('[NotificationService] Failed to load config', e);
    }
  }

  private mergeConfig(base: NotificationConfig, patch: Partial<NotificationConfig>): NotificationConfig {
    return {
      ...base,
      ...patch,
      defaultDurations: {
        ...base.defaultDurations,
        ...(patch.defaultDurations ?? {}),
      },
      positions: {
        ...base.positions,
        ...(patch.positions ?? {}),
      },
      nonInterruptibleChannels: patch.nonInterruptibleChannels ?? base.nonInterruptibleChannels,
      stylePreset: patch.stylePreset ?? base.stylePreset,
      typeSettings: {
        ...base.typeSettings,
        ...(patch.typeSettings ?? {}),
      },
    };
  }

  private generateId(): string {
    return `notify_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  private loadBannerEditorConfig() {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.BANNER_EDITOR_CONFIG);
      if (!stored) return;
      const parsed = JSON.parse(stored);
      this.bannerEditorConfig = this.mergeBannerEditorConfig(this.bannerEditorConfig, parsed);
    } catch (e) {
      console.warn('[NotificationService] Failed to load banner editor config', e);
    }
  }

  private updateBannerEditorConfig(config: Partial<BannerEditorConfig>) {
    this.bannerEditorConfig = this.mergeBannerEditorConfig(this.bannerEditorConfig, config);
    try {
      localStorage.setItem(STORAGE_KEYS.BANNER_EDITOR_CONFIG, JSON.stringify(this.bannerEditorConfig));
    } catch (e) {
      console.warn('[NotificationService] Failed to save banner editor config', e);
    }
  }

  private mergeBannerEditorConfig(base: BannerEditorConfig, patch: Partial<BannerEditorConfig>): BannerEditorConfig {
    return {
      height: patch.height ?? base.height,
      background: {
        type: patch.background?.type ?? base.background.type,
        color: patch.background?.color ?? base.background.color,
        gradient: patch.background?.gradient ?? base.background.gradient,
        image: patch.background?.image ? { ...base.background.image, ...patch.background.image } : base.background.image,
      },
      frame: { ...base.frame, ...(patch.frame ?? {}) },
      shadow: { ...base.shadow, ...(patch.shadow ?? {}) },
      glow: { ...base.glow, ...(patch.glow ?? {}) },
      animation: {
        entry: { ...base.animation.entry, ...(patch.animation?.entry ?? {}) },
        hold: patch.animation?.hold ?? base.animation.hold,
        exit: { ...base.animation.exit, ...(patch.animation?.exit ?? {}) },
      },
      text: { ...base.text, ...(patch.text ?? {}) },
      icon: { ...base.icon, ...(patch.icon ?? {}) },
      effects: { ...base.effects, ...(patch.effects ?? {}) },
    };
  }
}

export const notificationService = new NotificationService();

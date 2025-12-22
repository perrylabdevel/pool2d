import { BannerConfig, BannerType } from '../types';

export class BannerRenderer {
  private ctx: CanvasRenderingContext2D;
  private shimmerOffset: number = 0;
  private lastShimmerTime: number = 0;
  private cachedImage: HTMLImageElement | null = null;
  private cachedImageSrc: string = '';

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  private loadImage(src: string): HTMLImageElement | null {
    if (!src) return null;

    if (this.cachedImageSrc === src && this.cachedImage) {
      return this.cachedImage;
    }

    const img = new Image();
    img.src = src;

    // Cache for future renders
    img.onload = () => {
      this.cachedImage = img;
      this.cachedImageSrc = src;
    };

    // Return immediately if already loaded
    if (img.complete) {
      this.cachedImage = img;
      this.cachedImageSrc = src;
      return img;
    }

    return null;
  }

  render(
    config: BannerConfig,
    canvasWidth: number,
    canvasHeight: number,
    animationPhase: 'enter' | 'active' | 'exit',
    progress: number
  ) {
    const { ctx } = this;
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    const bannerWidth = canvasWidth;
    const bannerHeight = config.height;
    const targetY = (canvasHeight - bannerHeight) / 2;

    // Calculate animation transforms
    let offsetX = 0;
    let offsetY = 0;
    let opacity = 1;
    let scale = 1;
    let rotation = 0;

    const entryType = config.animation.entry.type;
    const exitType = config.animation.exit.type;

    if (animationPhase === 'enter') {
      const p = progress;
      const ease = this.getEasing(config.animation.entry.easing, p);

      switch (entryType) {
        case 'slide-left':
          offsetX = bannerWidth * (1 - ease);
          break;
        case 'slide-right':
          offsetX = -bannerWidth * (1 - ease);
          break;
        case 'slide-down':
          offsetY = -bannerHeight * (1 - ease);
          break;
        case 'slide-up':
          offsetY = bannerHeight * (1 - ease);
          break;
        case 'fade':
          opacity = ease;
          break;
        case 'scale':
          scale = ease;
          opacity = ease;
          break;
        case 'bounce':
          scale = this.easeOutBounce(p);
          opacity = Math.min(1, p * 2);
          break;
        case 'flip':
          rotation = Math.PI * (1 - ease);
          scale = Math.abs(Math.cos(rotation));
          opacity = ease;
          break;
        case 'none':
        default:
          break;
      }

      if (entryType.startsWith('slide')) {
        opacity = Math.min(1, p * 2);
      }
    } else if (animationPhase === 'exit') {
      const p = progress;
      const ease = this.getEasing(config.animation.exit.easing, p);

      switch (exitType) {
        case 'slide-left':
          offsetX = -bannerWidth * ease;
          break;
        case 'slide-right':
          offsetX = bannerWidth * ease;
          break;
        case 'slide-up':
          offsetY = -bannerHeight * ease;
          break;
        case 'slide-down':
          offsetY = bannerHeight * ease;
          break;
        case 'fade':
          opacity = 1 - ease;
          break;
        case 'scale':
          scale = 1 - ease;
          opacity = 1 - ease;
          break;
        case 'bounce':
          scale = 1 - ease;
          opacity = 1 - ease;
          break;
        case 'flip':
          rotation = Math.PI * ease;
          scale = Math.abs(Math.cos(rotation));
          opacity = 1 - ease;
          break;
        case 'none':
        default:
          break;
      }

      if (exitType.startsWith('slide')) {
        opacity = 1 - ease;
      }
    }

    const bannerX = offsetX;
    const bannerY = targetY + offsetY;

    ctx.save();
    ctx.globalAlpha = opacity;

    // Apply scale and rotation transforms
    if (scale !== 1 || rotation !== 0) {
      const centerX = bannerX + bannerWidth / 2;
      const centerY = bannerY + bannerHeight / 2;
      ctx.translate(centerX, centerY);
      ctx.rotate(rotation);
      ctx.scale(scale, scale);
      ctx.translate(-centerX, -centerY);
    }

    this.drawBanner(bannerX, bannerY, bannerWidth, bannerHeight, config, animationPhase);

    ctx.restore();
  }

  updateShimmer(deltaTime: number) {
    this.shimmerOffset += deltaTime * 0.001;
    if (this.shimmerOffset > 2) {
      this.shimmerOffset = -0.5;
    }
  }

  private getEasing(easing: string, t: number): number {
    switch (easing) {
      case 'linear':
        return t;
      case 'ease-in':
        return t * t;
      case 'ease-out':
        return 1 - Math.pow(1 - t, 2);
      case 'ease-in-out':
        return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      case 'ease-out-back':
        return this.easeOutBack(t);
      default:
        return this.easeOutBack(t);
    }
  }

  private drawBanner(
    x: number,
    y: number,
    width: number,
    height: number,
    config: BannerConfig,
    phase: 'enter' | 'active' | 'exit'
  ) {
    const ctx = this.ctx;
    const colors = this.getTypeColors(config.type, config.background.color);

    ctx.save();

    // Draw shadow first (behind everything)
    if (config.shadow.enabled) {
      ctx.save();
      ctx.shadowColor = config.shadow.color;
      ctx.shadowBlur = config.shadow.blur;
      ctx.shadowOffsetX = config.shadow.offsetX;
      ctx.shadowOffsetY = config.shadow.offsetY;

      // Draw a rect just for the shadow
      ctx.fillStyle = 'rgba(0,0,0,0)';
      if (config.frame.radius > 0) {
        this.roundRect(ctx, x, y, width, height, config.frame.radius);
        ctx.fill();
      } else {
        ctx.fillRect(x, y, width, height);
      }
      ctx.restore();
    }

    // Draw glow
    if (config.glow.enabled) {
      ctx.save();
      ctx.shadowColor = config.glow.color;
      ctx.shadowBlur = config.glow.blur;
      ctx.fillStyle = config.glow.color + '40';

      if (config.frame.radius > 0) {
        this.roundRect(ctx, x, y, width, height, config.frame.radius);
        ctx.fill();
      } else {
        ctx.fillRect(x, y, width, height);
      }
      ctx.restore();
    }

    // Background
    if (config.background.type === 'image' && config.background.image?.src) {
      // Draw image background
      const img = this.loadImage(config.background.image.src);
      if (img) {
        ctx.save();

        // Clip to banner shape
        if (config.frame.radius > 0) {
          this.roundRect(ctx, x, y, width, height, config.frame.radius);
          ctx.clip();
        }

        // Draw image with cover fit
        const imgAspect = img.width / img.height;
        const bannerAspect = width / height;

        let drawWidth = width;
        let drawHeight = height;
        let drawX = x;
        let drawY = y;

        if (imgAspect > bannerAspect) {
          drawHeight = height;
          drawWidth = height * imgAspect;
          drawX = x - (drawWidth - width) / 2;
        } else {
          drawWidth = width;
          drawHeight = width / imgAspect;
          drawY = y - (drawHeight - height) / 2;
        }

        ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);

        // Apply tint overlay
        if (config.background.image.tint && config.background.image.tintOpacity > 0) {
          ctx.fillStyle = config.background.image.tint;
          ctx.globalAlpha = config.background.image.tintOpacity;
          ctx.fillRect(x, y, width, height);
          ctx.globalAlpha = 1;
        }

        ctx.restore();
      } else {
        // Fallback to solid color while image loads
        ctx.fillStyle = colors.bg;
        if (config.frame.radius > 0) {
          this.roundRect(ctx, x, y, width, height, config.frame.radius);
          ctx.fill();
        } else {
          ctx.fillRect(x, y, width, height);
        }
      }
    } else {
      // Solid or gradient background
      let bgFill: string | CanvasGradient;
      if (config.background.type === 'gradient' && config.background.gradient) {
        const grad = config.background.gradient;
        const bgGradient = ctx.createLinearGradient(0, y, width, y);
        for (const stop of grad.stops) {
          bgGradient.addColorStop(stop.offset, stop.color);
        }
        bgFill = bgGradient;
      } else {
        bgFill = colors.bg;
      }

      ctx.fillStyle = bgFill;
      if (config.frame.radius > 0) {
        this.roundRect(ctx, x, y, width, height, config.frame.radius);
        ctx.fill();
      } else {
        ctx.fillRect(x, y, width, height);
      }
    }

    // Frame border
    if (config.frame.enabled && config.frame.width > 0) {
      ctx.strokeStyle = config.frame.color;
      ctx.lineWidth = config.frame.width;
      if (config.frame.radius > 0) {
        this.roundRect(ctx, x, y, width, height, config.frame.radius);
        ctx.stroke();
      } else {
        ctx.strokeRect(x, y, width, height);
      }
    }

    // Shimmer effect
    if (config.effects.shimmer && phase === 'active') {
      this.drawShimmer(x, y, width, height, config);
    }

    // Draw content
    const message = config.text.content;
    const iconSize = config.icon.size || 80;
    const centerX = x + width / 2;
    const contentWidth = 600;
    const iconX = centerX - contentWidth / 2;
    const iconY = y + height / 2;

    if (config.icon.enabled) {
      if (config.icon.src) {
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 5;
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `${iconSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(config.icon.src, iconX, iconY);
        ctx.restore();
      } else {
        this.drawIcon(iconX, iconY, config.type, iconSize, '#FFFFFF');
      }
    }

    // Text
    const fontSize = config.text.fontSize || 48;
    ctx.font = `${config.text.fontWeight} ${fontSize}px "${config.text.fontFamily}", "Rajdhani", "Impact", sans-serif`;
    ctx.fillStyle = config.text.color || '#FFFFFF';

    // Text alignment
    let textX: number;
    if (config.text.align === 'center') {
      ctx.textAlign = 'center';
      textX = centerX;
    } else if (config.text.align === 'right') {
      ctx.textAlign = 'right';
      textX = centerX + contentWidth / 2;
    } else {
      ctx.textAlign = 'left';
      textX = config.icon.enabled ? iconX + 100 : centerX - contentWidth / 2;
    }
    ctx.textBaseline = 'middle';

    // Text shadow
    if (config.text.shadow) {
      ctx.shadowColor = config.text.shadow.color;
      ctx.shadowBlur = config.text.shadow.blur;
      ctx.shadowOffsetX = config.text.shadow.offsetX;
      ctx.shadowOffsetY = config.text.shadow.offsetY;
    } else {
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetY = 2;
    }

    let textContent = message;
    if (config.text.transform === 'uppercase') textContent = textContent.toUpperCase();
    else if (config.text.transform === 'lowercase') textContent = textContent.toLowerCase();

    ctx.fillText(textContent, textX, y + height / 2 + 3);

    // Text stroke
    if (config.text.stroke && config.text.stroke.width > 0) {
      ctx.strokeStyle = config.text.stroke.color;
      ctx.lineWidth = config.text.stroke.width;
      ctx.shadowColor = 'transparent';
      ctx.strokeText(textContent, textX, y + height / 2 + 3);
    }

    ctx.restore();
  }

  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
  ) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  private drawIcon(x: number, y: number, type: BannerType, size: number, color: string) {
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
    ctx.strokeStyle = ctx.fillStyle as string;
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
    ctx.fillStyle = '#0055AA';
    ctx.font = `bold ${16 * scale}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('i', x, y);
  }

  private getTypeColors(type: BannerType, customColor?: string): { bg: string } {
    if (customColor) {
      return { bg: customColor };
    }
    switch (type) {
      case 'success':
      case 'epic':
      case 'info':
        return { bg: '#004488' };
      case 'error':
      case 'warning':
        return { bg: '#880000' };
      default:
        return { bg: '#004488' };
    }
  }

  private easeOutBack(x: number): number {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
  }

  private easeOutBounce(x: number): number {
    const n1 = 7.5625;
    const d1 = 2.75;

    if (x < 1 / d1) {
      return n1 * x * x;
    } else if (x < 2 / d1) {
      return n1 * (x -= 1.5 / d1) * x + 0.75;
    } else if (x < 2.5 / d1) {
      return n1 * (x -= 2.25 / d1) * x + 0.9375;
    } else {
      return n1 * (x -= 2.625 / d1) * x + 0.984375;
    }
  }

  private drawShimmer(x: number, y: number, width: number, height: number, config: BannerConfig) {
    const ctx = this.ctx;
    const now = performance.now();
    const delta = now - this.lastShimmerTime;
    this.lastShimmerTime = now;

    // Update shimmer position
    const speed = config.effects.shimmerSpeed || 1;
    this.shimmerOffset += (delta / 1000) * speed;
    if (this.shimmerOffset > 2) {
      this.shimmerOffset = -0.5;
    }

    // Draw shimmer sweep
    ctx.save();

    // Clip to banner area
    if (config.frame.radius > 0) {
      this.roundRect(ctx, x, y, width, height, config.frame.radius);
      ctx.clip();
    } else {
      ctx.beginPath();
      ctx.rect(x, y, width, height);
      ctx.clip();
    }

    // Create shimmer gradient
    const shimmerWidth = width * 0.3;
    const shimmerX = x + width * this.shimmerOffset - shimmerWidth / 2;

    const shimmerGradient = ctx.createLinearGradient(shimmerX, y, shimmerX + shimmerWidth, y);
    shimmerGradient.addColorStop(0, 'rgba(255,255,255,0)');
    shimmerGradient.addColorStop(0.5, 'rgba(255,255,255,0.15)');
    shimmerGradient.addColorStop(1, 'rgba(255,255,255,0)');

    ctx.fillStyle = shimmerGradient;
    ctx.fillRect(shimmerX, y, shimmerWidth, height);

    ctx.restore();
  }
}

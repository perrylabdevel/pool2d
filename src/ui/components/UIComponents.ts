import { ColorTokens, UIColors as LegacyUIColors } from '../theme/ColorTokens';
import { LayoutConstants } from '../theme/LayoutConstants';

export interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

/**
 * @deprecated Use ColorTokens from '@/ui/theme/ColorTokens' instead
 * This is kept for backward compatibility during migration
 */
export const UIColors = LegacyUIColors;

export function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
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

export function drawGlossyButton(
    ctx: CanvasRenderingContext2D,
    rect: Rect,
    text: string,
    color: string,
    isHovered: boolean = false
) {
    const { x, y, width, height } = rect;
    const r = LayoutConstants.Radii.Medium; // Slightly tighter radius for game feel

    ctx.save();

    // 1. Heavy Drop Shadow (External)
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 6;
    ctx.fillStyle = 'rgba(0,0,0,0)';
    drawRoundedRect(ctx, x, y, width, height, r);
    ctx.fill();

    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // 2. Metallic Rim (Thick Border)
    const rimWidth = 3;
    const rimGrad = ctx.createLinearGradient(x, y, x, y + height);
    rimGrad.addColorStop(0, '#ffffff');
    rimGrad.addColorStop(0.5, '#888888');
    rimGrad.addColorStop(1, '#444444');

    ctx.fillStyle = rimGrad;
    drawRoundedRect(ctx, x, y, width, height, r);
    ctx.fill();

    // 3. Main Body (Gem/Glass Effect)
    // Shrink rect for body to sit inside rim
    const bx = x + rimWidth;
    const by = y + rimWidth;
    const bw = width - (rimWidth * 2);
    const bh = height - (rimWidth * 2);
    const br = r - 2;

    const base = normalizeColor(color);
    // Much stronger contrast for gem look
    const topColor = adjustColor(base, isHovered ? 80 : 40);
    const bottomColor = adjustColor(base, isHovered ? -20 : -60);

    const bodyGrad = ctx.createLinearGradient(bx, by, bx, by + bh);
    bodyGrad.addColorStop(0, topColor);
    bodyGrad.addColorStop(0.5, base);
    bodyGrad.addColorStop(1, bottomColor);

    ctx.fillStyle = bodyGrad;
    drawRoundedRect(ctx, bx, by, bw, bh, br);
    ctx.fill();

    // 4. Inner Glow / Edge Highlight (Inside the rim)
    ctx.save();
    ctx.clip(); // Clip to body

    // Top inner highlight (sharp)
    const innerHighlight = ctx.createLinearGradient(bx, by, bx, by + bh);
    innerHighlight.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
    innerHighlight.addColorStop(0.1, 'rgba(255, 255, 255, 0.1)');
    innerHighlight.addColorStop(1, 'rgba(0, 0, 0, 0.4)');

    ctx.strokeStyle = innerHighlight;
    ctx.lineWidth = 2;
    drawRoundedRect(ctx, bx + 1, by + 1, bw - 2, bh - 2, br);
    ctx.stroke();

    // Gloss Shine (Top Half - Sharp)
    const glossGrad = ctx.createLinearGradient(bx, by, bx, by + bh / 2);
    glossGrad.addColorStop(0, 'rgba(255, 255, 255, 0.5)');
    glossGrad.addColorStop(1, 'rgba(255, 255, 255, 0.05)');
    ctx.fillStyle = glossGrad;
    ctx.fillRect(bx, by, bw, bh / 2);

    ctx.restore();

    // 5. Text with Strong Outline
    ctx.fillStyle = ColorTokens.text.primary;
    ctx.font = `bold ${LayoutConstants.Fonts.Size.Medium}px ${LayoutConstants.Fonts.Family.Default}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Text Stroke (Outline)
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.strokeText(text, x + width / 2, y + height / 2);

    // Text Fill
    ctx.fillText(text, x + width / 2, y + height / 2);

    ctx.restore();
}

export function drawPanel(ctx: CanvasRenderingContext2D, rect: Rect) {
    const { x, y, width, height } = rect;
    const r = LayoutConstants.Radii.Large;

    ctx.save();
    drawRoundedRect(ctx, x, y, width, height, r);
    ctx.fillStyle = UIColors.panelBg;
    ctx.fill();
    ctx.strokeStyle = UIColors.panelBorder;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
}

export interface CurrencyPillOptions {
    width?: number;
    height?: number;
    plusButton?: boolean;
    plusRadius?: number;
    plusSpacing?: number;
    theme?: 'default' | 'nav';
    dividerLeft?: boolean;
    dividerRight?: boolean;
}

export function drawCurrencyPill(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    amount: number,
    type: 'coins' | 'cash',
    options: CurrencyPillOptions = {}
) {
    const width = options.width ?? 100;
    const height = options.height ?? 28;
    // Squarer look: radius is smaller, e.g., 8px or 12px, not height/2
    const r = 8;
    const includePlus = options.plusButton ?? true;
    const plusRadius = options.plusRadius ?? 12;
    const plusSpacing = options.plusSpacing ?? 5;
    const theme = options.theme ?? 'default';

    const iconColor = type === 'coins' ? ColorTokens.currency.coins : ColorTokens.currency.cash;

    ctx.save();

    if (theme === 'nav') {
        // Nav theme: Dark semi-transparent background with border
        const pillRadius = 8; // Consistent squarer radius

        // Background
        const bodyGradient = ctx.createLinearGradient(x, y, x, y + height);
        bodyGradient.addColorStop(0, 'rgba(20, 30, 50, 0.8)');
        bodyGradient.addColorStop(1, 'rgba(10, 20, 40, 0.9)');

        drawRoundedRect(ctx, x, y, width, height, pillRadius);
        ctx.fillStyle = bodyGradient;
        ctx.fill();

        // Border
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Inner highlight (top edge)
        ctx.beginPath();
        ctx.moveTo(x + pillRadius, y + 1);
        ctx.lineTo(x + width - pillRadius, y + 1);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.stroke();

        // Icon
        const iconSize = height * 1.2; // Slightly larger than height for "pop"
        const iconX = x + 10; // Left aligned icon
        const iconY = y + height / 2;

        if (type === 'coins') {
            drawCoin(ctx, iconX, iconY, iconSize);
        } else {
            // Use green chip for cash
            drawChip(ctx, iconX, iconY, iconSize, '#1fbf75');
        }

        // Text stack
        const textAreaStart = iconX + iconSize / 2 + 12;
        const valueFontSize = Math.max(20, height * 0.6);
        // const label = type === 'coins' ? 'COINS' : 'CASH';

        // Label (small, above value)
        // ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        // ctx.font = `600 10px ${LayoutConstants.Fonts.Family.Display}`;
        // ctx.textAlign = 'left';
        // ctx.textBaseline = 'bottom';
        // ctx.fillText(label, textAreaStart, y + height / 2 - 2);

        // Value (large, centered vertically)
        ctx.fillStyle = ColorTokens.text.primary;
        ctx.font = `${LayoutConstants.Fonts.Weight.Bold} ${valueFontSize}px ${LayoutConstants.Fonts.Family.Display}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 4;
        ctx.fillText(amount.toLocaleString(), textAreaStart, y + height / 2 + 1);
        ctx.shadowBlur = 0;

    } else {
        // Default theme (e.g. for tooltips or other UI)
        drawRoundedRect(ctx, x, y, width, height, r);
        ctx.fillStyle = ColorTokens.background.overlayDark;
        ctx.fill();
        ctx.strokeStyle = ColorTokens.border.default;
        ctx.lineWidth = 1;
        ctx.stroke();

        // Simple icon fallback for non-nav theme
        ctx.beginPath();
        ctx.arc(x + 14, y + height / 2, 10, 0, Math.PI * 2);
        ctx.fillStyle = iconColor;
        ctx.fill();

        ctx.fillStyle = ColorTokens.text.primary;
        ctx.font = `bold ${LayoutConstants.Fonts.Size.Small}px ${LayoutConstants.Fonts.Family.Default}`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(amount.toLocaleString(), x + width - 10, y + height / 2 + 1);
    }

    if (includePlus) {
        const plusX = x + width + plusSpacing;
        const plusCenterX = plusX + plusRadius;
        const plusCenterY = y + height / 2;

        // Squarer plus button
        drawRoundedRect(ctx, plusX, y + height / 2 - plusRadius, plusRadius * 2, plusRadius * 2, 6);

        const plusGrad = ctx.createLinearGradient(plusX, y, plusX, y + height);
        plusGrad.addColorStop(0, '#4CAF50');
        plusGrad.addColorStop(1, '#388E3C');
        ctx.fillStyle = plusGrad;
        ctx.fill();

        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Plus sign
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `bold ${Math.max(14, plusRadius * 1.2)}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('+', plusCenterX, plusCenterY + 1);
    }

    ctx.restore();
}

function normalizeColor(color: string) {
    const ctx = document.createElement('canvas').getContext('2d');
    if (!ctx) return '#ffffff';
    ctx.fillStyle = color;
    return ctx.fillStyle;
}

// Simple color adjuster using parsed RGB components
function adjustColor(color: string, amount: number) {
    const normalized = normalizeColor(color);
    const match = normalized.match(/^#?([0-9a-f]{6})$/i);
    if (!match) return normalized;
    const num = parseInt(match[1], 16);
    const r = Math.min(255, Math.max(0, ((num >> 16) & 0xff) + amount));
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount));
    const b = Math.min(255, Math.max(0, (num & 0xff) + amount));
    const toHex = (v: number) => v.toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function mixColor(color1: string, color2: string, weight: number): string {
    const c1 = {
        r: parseInt(color1.slice(1, 3), 16),
        g: parseInt(color1.slice(3, 5), 16),
        b: parseInt(color1.slice(5, 7), 16)
    };
    const c2 = {
        r: parseInt(color2.slice(1, 3), 16),
        g: parseInt(color2.slice(3, 5), 16),
        b: parseInt(color2.slice(5, 7), 16)
    };

    const r = Math.round(c1.r * weight + c2.r * (1 - weight));
    const g = Math.round(c1.g * weight + c2.g * (1 - weight));
    const b = Math.round(c1.b * weight + c2.b * (1 - weight));

    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export function drawChip(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
    const radius = size / 2;

    // Colors derived from CSS .swap class
    const mainColor = '#ffffff';
    const altColor = color;

    ctx.save();
    ctx.translate(x, y);

    // 1. Base Background & Conic Gradient with Depth
    const segments = 12; // Reduced segments for chunkier, more premium look
    const segmentAngle = (Math.PI * 2) / segments;
    const offsetAngle = -15 * (Math.PI / 180);

    ctx.rotate(offsetAngle);

    // Draw base cylinder/edge depth (Shadow)
    ctx.beginPath();
    ctx.arc(0, 4, radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fill();

    for (let i = 0; i < segments; i++) {
        const start = i * segmentAngle;
        const mid = start + (segmentAngle / 2);
        const end = start + segmentAngle;

        // Alt color segment (Colored)
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, radius, start, mid);
        ctx.fillStyle = altColor;
        ctx.fill();

        // Add bevel highlight to colored segment
        ctx.beginPath();
        ctx.arc(0, 0, radius - 2, start, mid);
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Main color segment (White)
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, radius, mid, end);
        ctx.fillStyle = mainColor;
        ctx.fill();
    }

    // Reset rotation for overlays
    ctx.rotate(-offsetAngle);

    // 2. Radial Gradients Overlays (Lighting)
    // Top-left highlight
    const grad1 = ctx.createRadialGradient(-radius * 0.3, -radius * 0.3, 0, -radius * 0.3, -radius * 0.3, radius);
    grad1.addColorStop(0, 'rgba(255,255,255,0.25)');
    grad1.addColorStop(0.5, 'transparent');
    ctx.fillStyle = grad1;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    // Bottom-right shadow
    const grad2 = ctx.createRadialGradient(radius * 0.3, radius * 0.3, 0, radius * 0.3, radius * 0.3, radius);
    grad2.addColorStop(0, 'rgba(0,0,0,0.05)');
    grad2.addColorStop(0.6, 'rgba(0,0,0,0.25)');
    ctx.fillStyle = grad2;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    // 3. Inner Shadows (Box Shadow inset)
    const drawInsetRing = (r: number, width: number, color: string) => {
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.arc(0, 0, r - width, 0, Math.PI * 2, true);
        ctx.fillStyle = color;
        ctx.fill();
    };

    // Multiple rings for complex edge detail
    drawInsetRing(radius, 4, 'rgba(0,0,0,0.1)');
    drawInsetRing(radius - 4, 2, 'rgba(255,255,255,0.3)'); // Highlight ring

    // 4. Inner Disk
    const innerRadius = radius * 0.6;

    // Shadow under the inner disk
    ctx.beginPath();
    ctx.arc(0, 2, innerRadius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fill();

    // Inner disk background
    const innerGrad = ctx.createRadialGradient(
        -innerRadius * 0.2, -innerRadius * 0.2, 0,
        0, 0, innerRadius
    );
    innerGrad.addColorStop(0, altColor);
    innerGrad.addColorStop(1, mixColor(altColor, '#000000', 0.8)); // Darker edge

    ctx.beginPath();
    ctx.arc(0, 0, innerRadius, 0, Math.PI * 2);
    ctx.fillStyle = innerGrad;
    ctx.fill();

    // Inner Pattern (Dashed Ring)
    ctx.beginPath();
    ctx.arc(0, 0, innerRadius * 0.8, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Center indentation
    ctx.beginPath();
    ctx.arc(0, 0, innerRadius * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.fill();

    // Specular highlight on inner disk
    ctx.beginPath();
    ctx.ellipse(-innerRadius * 0.3, -innerRadius * 0.3, innerRadius * 0.15, innerRadius * 0.1, Math.PI / 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fill();

    // 5. Edge Notch Texture (The mask effect) - Refined
    const maskInner = radius * 0.75;
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.arc(0, 0, maskInner, 0, Math.PI * 2, true);
    ctx.clip();

    const notchSegments = 24;
    const notchAngle = (Math.PI * 2) / notchSegments;

    for (let i = 0; i < notchSegments; i++) {
        const angle = i * notchAngle;
        // Draw small notches
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, radius * 1.1, angle, angle + notchAngle * 0.2);
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.fill();
    }
    ctx.restore();

    ctx.restore();
}

export function drawCoin(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
    const radius = size / 2;
    const goldColor = '#FFD700';
    const darkGold = '#B8860B';

    ctx.save();
    ctx.translate(x, y);

    // 1. Base Coin (Gold)
    const grad = ctx.createRadialGradient(-radius * 0.3, -radius * 0.3, 0, 0, 0, radius);
    grad.addColorStop(0, '#FFFACD'); // LemonChiffon highlight
    grad.addColorStop(0.4, goldColor);
    grad.addColorStop(1, darkGold);

    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // 2. Edge Detail (Ridges)
    ctx.strokeStyle = '#DAA520';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, radius - 1, 0, Math.PI * 2);
    ctx.stroke();

    // 3. Inner Ring
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.75, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 4. Dollar Sign / Symbol
    ctx.fillStyle = 'rgba(184, 134, 11, 0.8)'; // Dark gold text
    ctx.font = `bold ${size * 0.6}px "Georgia", serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', 0, size * 0.05);

    // 5. Shine
    ctx.beginPath();
    ctx.ellipse(-radius * 0.3, -radius * 0.3, radius * 0.2, radius * 0.1, Math.PI / 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fill();

    ctx.restore();
}

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
    ctx.shadowColor = ColorTokens.effects.shadowHeavy;
    ctx.shadowBlur = LayoutConstants.Shadows.Small.blur;
    ctx.shadowOffsetY = LayoutConstants.Shadows.Small.offsetY;
    ctx.fillStyle = 'rgba(0,0,0,0)';
    drawRoundedRect(ctx, x, y, width, height, r);
    ctx.fill();

    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // 2. Metallic Rim (Thick Border)
    const rimWidth = LayoutConstants.Lines.Rim;
    const rimGrad = ctx.createLinearGradient(x, y, x, y + height);
    rimGrad.addColorStop(0, ColorTokens.metallic.light);
    rimGrad.addColorStop(0.5, ColorTokens.metallic.mid);
    rimGrad.addColorStop(1, ColorTokens.metallic.dark);

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
    innerHighlight.addColorStop(0, ColorTokens.effects.innerHighlight.start);
    innerHighlight.addColorStop(0.1, ColorTokens.effects.innerHighlight.mid);
    innerHighlight.addColorStop(1, ColorTokens.effects.innerHighlight.end);

    ctx.strokeStyle = innerHighlight;
    ctx.lineWidth = LayoutConstants.Lines.Normal;
    drawRoundedRect(ctx, bx + 1, by + 1, bw - 2, bh - 2, br);
    ctx.stroke();

    // Gloss Shine (Top Half - Sharp)
    const glossGrad = ctx.createLinearGradient(bx, by, bx, by + bh / 2);
    glossGrad.addColorStop(0, ColorTokens.effects.gloss.start);
    glossGrad.addColorStop(1, ColorTokens.effects.gloss.end);
    ctx.fillStyle = glossGrad;
    ctx.fillRect(bx, by, bw, bh / 2);

    ctx.restore();

    // 5. Text with Strong Outline
    ctx.fillStyle = ColorTokens.text.primary;
    ctx.font = `bold ${LayoutConstants.Fonts.Size.Medium}px ${LayoutConstants.Fonts.Family.Default}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Text Stroke (Outline)
    ctx.lineWidth = LayoutConstants.Lines.Thick;
    ctx.strokeStyle = ColorTokens.effects.shadowText;
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
    type: 'coins' | 'cash' | 'trophies',
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

    const iconColor = type === 'coins' ? ColorTokens.currency.coins :
        type === 'cash' ? ColorTokens.currency.cash : '#FFD700';

    ctx.save();

    if (theme === 'nav') {
        // Nav theme: Dark semi-transparent background with border
        const pillRadius = LayoutConstants.CurrencyPill.Radius;

        // Background
        const bodyGradient = ctx.createLinearGradient(x, y, x, y + height);
        bodyGradient.addColorStop(0, ColorTokens.background.nav.gradientStart);
        bodyGradient.addColorStop(1, ColorTokens.background.nav.gradientEnd);

        drawRoundedRect(ctx, x, y, width, height, pillRadius);
        ctx.fillStyle = bodyGradient;
        ctx.fill();

        // Border
        ctx.strokeStyle = ColorTokens.border.emphasis;
        ctx.lineWidth = LayoutConstants.Lines.Thin;
        ctx.stroke();

        // Inner highlight (top edge)
        ctx.beginPath();
        ctx.moveTo(x + pillRadius, y + 1);
        ctx.lineTo(x + width - pillRadius, y + 1);
        ctx.strokeStyle = ColorTokens.border.default;
        ctx.stroke();

        // Clip to pill bounds to prevent icon bleeding
        ctx.save();
        drawRoundedRect(ctx, x, y, width, height, pillRadius);
        ctx.clip();

        // Icon - sized to fit within pill, positioned with proper padding
        const iconSize = height * 0.85; // Slightly smaller than height to fit
        const iconPadding = 6;
        const iconX = x + iconPadding + iconSize / 2; // Center of icon
        const iconY = y + height / 2;

        if (type === 'coins') {
            drawCoin(ctx, iconX, iconY, iconSize);
        } else if (type === 'cash') {
            drawGoldBar(ctx, iconX, iconY, iconSize);
        } else {
            drawTrophy(ctx, iconX, iconY, iconSize);
        }

        ctx.restore(); // Remove clipping

        // Text stack - with clipping to prevent overflow
        const textAreaStart = x + iconPadding + iconSize + 6;
        const textAreaEnd = x + width - 4; // Leave small right padding
        const availableTextWidth = textAreaEnd - textAreaStart;

        // Calculate font size that fits - start with desired size and shrink if needed
        const amountStr = amount.toLocaleString();
        let valueFontSize = Math.max(14, height * 0.55);

        // Measure and shrink font until it fits
        ctx.font = `${LayoutConstants.Fonts.Weight.Black} ${valueFontSize}px ${LayoutConstants.Fonts.Family.Default}`;
        let textWidth = ctx.measureText(amountStr).width;
        while (textWidth > availableTextWidth && valueFontSize > 10) {
            valueFontSize -= 1;
            ctx.font = `${LayoutConstants.Fonts.Weight.Black} ${valueFontSize}px ${LayoutConstants.Fonts.Family.Default}`;
            textWidth = ctx.measureText(amountStr).width;
        }

        // Clip to pill bounds for text as well
        ctx.save();
        drawRoundedRect(ctx, x, y, width, height, pillRadius);
        ctx.clip();

        // Value (large, centered vertically)
        ctx.fillStyle = ColorTokens.text.primary;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        // Remove heavy shadow, use subtle one
        ctx.shadowColor = ColorTokens.effects.shadowTextLight;
        ctx.shadowBlur = 2;
        ctx.shadowOffsetY = 1;
        ctx.fillText(amountStr, textAreaStart, y + height / 2 + 1);
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;

        ctx.restore(); // Remove text clipping

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
        plusGrad.addColorStop(0, ColorTokens.action.success);
        plusGrad.addColorStop(1, ColorTokens.action.successDark);
        ctx.fillStyle = plusGrad;
        ctx.fill();

        ctx.strokeStyle = ColorTokens.border.subtle;
        ctx.lineWidth = LayoutConstants.Lines.Thin;
        ctx.stroke();

        // Plus sign
        ctx.fillStyle = ColorTokens.text.primary;
        ctx.font = `bold ${Math.max(14, plusRadius * 1.2)}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('+', plusCenterX, plusCenterY + 1);
    }

    // Draw dividers if requested
    const dividerPadding = 8;
    if (options.dividerLeft) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.fillRect(x - 5, y + dividerPadding, 1, height - dividerPadding * 2);
    }
    if (options.dividerRight) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.fillRect(x + width + 4, y + dividerPadding, 1, height - dividerPadding * 2);
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

    ctx.save();
    ctx.translate(x, y);

    // 1. Drop Shadow
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 5;
    ctx.shadowOffsetY = 3;

    // 2. Outer Ring (Gradient for Depth)
    // Create a gradient that goes from light to dark to simulate a beveled edge
    const ringGrad = ctx.createLinearGradient(-radius, -radius, radius, radius);
    // Adjust base color for gradient
    const lightColor = adjustColor(color, 40);
    const darkColor = adjustColor(color, -40);
    ringGrad.addColorStop(0, lightColor);
    ringGrad.addColorStop(1, darkColor);

    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fillStyle = ringGrad;
    ctx.fill();

    // 3. Dashes on Ring (Inset look)
    const dashCount = 8;
    const dashWidth = size * 0.15;
    const dashHeight = size * 0.08;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    for (let i = 0; i < dashCount; i++) {
        ctx.save();
        ctx.rotate((i * Math.PI * 2) / dashCount);
        ctx.translate(0, -radius + dashHeight / 2 + 3);

        // Draw rounded rect for dash
        drawRoundedRect(ctx, -dashWidth / 2, -dashHeight / 2, dashWidth, dashHeight, 2);
        ctx.fill();
        ctx.restore();
    }

    // 4. Inner Circle (White with shadow)
    const innerRadius = radius * 0.65;

    // Inner shadow (simulated by drawing a dark circle then a slightly smaller white one)
    ctx.beginPath();
    ctx.arc(0, 0, innerRadius, 0, Math.PI * 2);
    ctx.fillStyle = ColorTokens.chip.innerShadow;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(0, 0, innerRadius - 1, 0, Math.PI * 2);
    const innerFaceGrad = ctx.createLinearGradient(0, -innerRadius, 0, innerRadius);
    innerFaceGrad.addColorStop(0, ColorTokens.chip.innerFaceLight);
    innerFaceGrad.addColorStop(1, ColorTokens.chip.innerFaceDark);
    ctx.fillStyle = innerFaceGrad;
    ctx.fill();

    // 5. Symbol: Diamond (Suit shape)
    // Draw a diamond shape in the center
    const symbolSize = innerRadius * 0.6;
    ctx.fillStyle = ColorTokens.chip.symbolColor;
    ctx.shadowColor = ColorTokens.chip.innerShadow;
    ctx.shadowBlur = 2;
    ctx.shadowOffsetY = 1;

    ctx.beginPath();
    ctx.moveTo(0, -symbolSize); // Top
    ctx.lineTo(symbolSize * 0.7, 0); // Right
    ctx.lineTo(0, symbolSize); // Bottom
    ctx.lineTo(-symbolSize * 0.7, 0); // Left
    ctx.closePath();
    ctx.fill();

    // Shine/Gloss
    ctx.beginPath();
    ctx.ellipse(-radius * 0.3, -radius * 0.3, radius * 0.25, radius * 0.12, Math.PI / 4, 0, Math.PI * 2);
    ctx.fillStyle = ColorTokens.effects.shine;
    ctx.fill();

    ctx.restore();
}

export function drawCoin(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
    const radius = size / 2;
    const copperLight = '#F2A25C';
    const copperMid = '#C87034';
    const copperDark = '#7A3E1D';
    const rustAccent = '#B84A2B';

    ctx.save();
    ctx.translate(x, y);

    // 1. Drop Shadow
    ctx.shadowColor = ColorTokens.effects.shadowLight;
    ctx.shadowBlur = 5;
    ctx.shadowOffsetY = 3;

    // 2. Outer Rim (Beveled Gold)
    const rimGrad = ctx.createLinearGradient(-radius, -radius, radius, radius);
    rimGrad.addColorStop(0, copperDark);
    rimGrad.addColorStop(0.45, copperMid);
    rimGrad.addColorStop(1, copperLight);

    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fillStyle = rimGrad;
    ctx.fill();

    // 3. Inner Face (Recessed)
    const innerRadius = radius * 0.72;
    const faceGrad = ctx.createRadialGradient(0, -innerRadius * 0.45, 0, 0, 0, innerRadius);
    faceGrad.addColorStop(0, copperLight);
    faceGrad.addColorStop(1, copperDark);

    ctx.beginPath();
    ctx.arc(0, 0, innerRadius, 0, Math.PI * 2);
    ctx.fillStyle = faceGrad;
    ctx.fill();

    // Inner Rim Highlight (to separate rim from face)
    ctx.strokeStyle = ColorTokens.effects.gloss.start;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Center inlay for contrast
    const inlayRadius = innerRadius * 0.55;
    ctx.beginPath();
    ctx.arc(0, 0, inlayRadius, 0, Math.PI * 2);
    const inlayGrad = ctx.createRadialGradient(0, -inlayRadius * 0.3, 0, 0, 0, inlayRadius);
    inlayGrad.addColorStop(0, '#ffffff');
    inlayGrad.addColorStop(1, rustAccent);
    ctx.fillStyle = inlayGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 4. Symbol: Crown
    const crownSize = innerRadius * 0.5;
    const cy = size * 0.05; // slight offset

    ctx.fillStyle = copperDark;
    ctx.shadowColor = ColorTokens.chip.innerShadow;
    ctx.shadowBlur = 2;
    ctx.shadowOffsetY = 1;

    ctx.beginPath();
    // Crown points
    const w = crownSize;
    const h = crownSize * 0.8;
    const bottomY = cy + h / 2;
    const topY = cy - h / 2;

    // Base
    ctx.moveTo(-w / 2, bottomY);
    ctx.lineTo(w / 2, bottomY);
    // Right side up to point
    ctx.lineTo(w / 2, cy);
    ctx.lineTo(w / 2 + w * 0.1, topY); // Right tip
    ctx.lineTo(w / 6, cy + h * 0.2); // Dip
    ctx.lineTo(0, topY - h * 0.2); // Center tip (higher)
    ctx.lineTo(-w / 6, cy + h * 0.2); // Dip
    ctx.lineTo(-w / 2 - w * 0.1, topY); // Left tip
    ctx.lineTo(-w / 2, cy);
    ctx.closePath();

    ctx.fill();

    // 5. Shine/Gloss
    ctx.beginPath();
    ctx.ellipse(-radius * 0.3, -radius * 0.3, radius * 0.25, radius * 0.12, Math.PI / 4, 0, Math.PI * 2);
    ctx.fillStyle = ColorTokens.effects.gloss.start;
    ctx.fill();

    ctx.restore();
}

export function drawGoldBar(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
    const width = size * 0.95;
    const height = size * 0.55;
    const radius = Math.max(2, height * 0.2);

    ctx.save();
    ctx.translate(x - width / 2, y - height / 2);

    ctx.shadowColor = ColorTokens.effects.shadowLight;
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 2;

    const barGrad = ctx.createLinearGradient(0, 0, width, height);
    barGrad.addColorStop(0, ColorTokens.coin.lightGold);
    barGrad.addColorStop(0.5, ColorTokens.coin.goldenRod);
    barGrad.addColorStop(1, ColorTokens.coin.darkGold);

    drawRoundedRect(ctx, 0, 0, width, height, radius);
    ctx.fillStyle = barGrad;
    ctx.fill();

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    ctx.strokeStyle = ColorTokens.effects.gloss.start;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.save();
    ctx.beginPath();
    drawRoundedRect(ctx, 0, 0, width, height, radius);
    ctx.clip();
    const highlight = ctx.createLinearGradient(0, 0, 0, height);
    highlight.addColorStop(0, 'rgba(255, 255, 255, 0.5)');
    highlight.addColorStop(0.5, 'rgba(255, 255, 255, 0.05)');
    highlight.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = highlight;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();

    ctx.fillStyle = ColorTokens.coin.darkGold;
    ctx.font = `700 ${Math.max(8, height * 0.35)}px ${LayoutConstants.Fonts.Family.Heading}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('AU', width / 2, height / 2);

    ctx.restore();
}

export function drawTrophy(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
    const w = size * 0.8;
    const h = size * 0.8;

    ctx.save();
    ctx.translate(x, y);

    // Shadow
    ctx.shadowColor = ColorTokens.effects.shadow;
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 2;

    // Cup Gradient
    const grad = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
    grad.addColorStop(0, ColorTokens.coin.gold);
    grad.addColorStop(0.5, ColorTokens.coin.orangeGold);
    grad.addColorStop(1, ColorTokens.coin.darkGold);

    ctx.fillStyle = grad;

    // Draw Cup Shape
    ctx.beginPath();
    // Bowl
    ctx.arc(0, -h * 0.2, w * 0.4, 0, Math.PI, false);
    // Stem
    ctx.moveTo(-w * 0.1, h * 0.2);
    ctx.lineTo(-w * 0.15, h * 0.4);
    ctx.lineTo(w * 0.15, h * 0.4);
    ctx.lineTo(w * 0.1, h * 0.2);
    // Base
    ctx.moveTo(-w * 0.3, h * 0.4);
    ctx.lineTo(w * 0.3, h * 0.4);
    ctx.lineTo(w * 0.35, h * 0.5);
    ctx.lineTo(-w * 0.35, h * 0.5);

    ctx.fill();

    // Handles
    ctx.strokeStyle = ColorTokens.coin.goldenRod;
    ctx.lineWidth = LayoutConstants.Lines.Normal;
    ctx.beginPath();
    // Left Handle
    ctx.moveTo(-w * 0.4, -h * 0.2);
    ctx.bezierCurveTo(-w * 0.6, -h * 0.2, -w * 0.6, h * 0.1, -w * 0.3, h * 0.1);
    // Right Handle
    ctx.moveTo(w * 0.4, -h * 0.2);
    ctx.bezierCurveTo(w * 0.6, -h * 0.2, w * 0.6, h * 0.1, w * 0.3, h * 0.1);
    ctx.stroke();

    ctx.restore();
}

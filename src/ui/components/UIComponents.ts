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

export function drawCurrencyPill(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    amount: number,
    type: 'coins' | 'cash'
) {
    const width = 100;
    const height = 28;
    const r = height / 2;

    ctx.save();

    // Background
    drawRoundedRect(ctx, x, y, width, height, r);
    ctx.fillStyle = ColorTokens.background.overlayDark;
    ctx.fill();
    ctx.strokeStyle = ColorTokens.border.default;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Icon placeholder
    const iconColor = type === 'coins' ? ColorTokens.currency.coins : ColorTokens.currency.cash;
    ctx.beginPath();
    ctx.arc(x + 14, y + height / 2, 10, 0, Math.PI * 2);
    ctx.fillStyle = iconColor;
    ctx.fill();

    // Text
    ctx.fillStyle = ColorTokens.text.primary;
    ctx.font = `bold ${LayoutConstants.Fonts.Size.Small}px ${LayoutConstants.Fonts.Family.Default}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(amount.toLocaleString(), x + width - 10, y + height / 2 + 1);

    // Plus button
    const plusX = x + width + 5;
    const plusR = 12;
    ctx.beginPath();
    ctx.arc(plusX + plusR, y + height / 2, plusR, 0, Math.PI * 2);
    ctx.fillStyle = ColorTokens.action.success;
    ctx.fill();
    ctx.fillStyle = ColorTokens.text.primary;
    ctx.font = `bold ${LayoutConstants.Fonts.Size.Medium}px ${LayoutConstants.Fonts.Family.Default}`;
    ctx.textAlign = 'center';
    ctx.fillText('+', plusX + plusR, y + height / 2 + 1);

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

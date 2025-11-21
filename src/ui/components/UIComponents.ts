import { ColorTokens, UIColors as LegacyUIColors } from '../theme/ColorTokens';

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
    const r = 8;

    ctx.save();

    // Shadow
    drawRoundedRect(ctx, x, y + 4, width, height, r);
    ctx.fillStyle = ColorTokens.effects.shadowButton;
    ctx.fill();

    // Main Body
    drawRoundedRect(ctx, x, y, width, height, r);

    const base = normalizeColor(color);
    const topColor = adjustColor(base, isHovered ? 40 : 0);
    const bottomColor = adjustColor(base, isHovered ? 0 : -40);

    // Gradient
    const grad = ctx.createLinearGradient(x, y, x, y + height);
    grad.addColorStop(0, topColor);
    grad.addColorStop(1, bottomColor);
    ctx.fillStyle = grad;
    ctx.fill();

    // Gloss highlight (top half)
    ctx.save();
    ctx.clip();
    const glossGrad = ctx.createLinearGradient(x, y, x, y + height / 2);
    glossGrad.addColorStop(0, ColorTokens.effects.gloss.start);
    glossGrad.addColorStop(1, ColorTokens.effects.gloss.end);
    ctx.fillStyle = glossGrad;
    ctx.fillRect(x, y, width, height / 2);
    ctx.restore();

    // Border
    ctx.strokeStyle = ColorTokens.border.dark;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Text
    ctx.fillStyle = ColorTokens.text.primary;
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = ColorTokens.effects.shadow;
    ctx.shadowBlur = 2;
    ctx.shadowOffsetY = 1;
    ctx.fillText(text, x + width / 2, y + height / 2);

    ctx.restore();
}

export function drawPanel(ctx: CanvasRenderingContext2D, rect: Rect) {
    const { x, y, width, height } = rect;
    const r = 12;

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
    ctx.font = 'bold 14px Arial';
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
    ctx.font = 'bold 16px Arial';
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

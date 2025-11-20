
export interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export const UIColors = {
    primary: '#FFD700', // Gold
    primaryDark: '#B8860B',
    secondary: '#4CAF50', // Green
    accent: '#2196F3', // Blue
    danger: '#F44336', // Red
    text: '#FFFFFF',
    textDark: '#000000',
    panelBg: 'rgba(13, 20, 36, 0.85)',
    panelBorder: 'rgba(255, 255, 255, 0.15)',
};

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
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fill();

    // Main Body
    drawRoundedRect(ctx, x, y, width, height, r);

    // Gradient
    const grad = ctx.createLinearGradient(x, y, x, y + height);
    if (isHovered) {
        grad.addColorStop(0, adjustColor(color, 40));
        grad.addColorStop(1, color);
    } else {
        grad.addColorStop(0, color);
        grad.addColorStop(1, adjustColor(color, -40));
    }
    ctx.fillStyle = grad;
    ctx.fill();

    // Gloss highlight (top half)
    ctx.save();
    ctx.clip();
    const glossGrad = ctx.createLinearGradient(x, y, x, y + height / 2);
    glossGrad.addColorStop(0, 'rgba(255,255,255,0.4)');
    glossGrad.addColorStop(1, 'rgba(255,255,255,0.05)');
    ctx.fillStyle = glossGrad;
    ctx.fillRect(x, y, width, height / 2);
    ctx.restore();

    // Border
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Text
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
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
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Icon placeholder
    const iconColor = type === 'coins' ? '#FFD700' : '#4CAF50';
    ctx.beginPath();
    ctx.arc(x + 14, y + height / 2, 10, 0, Math.PI * 2);
    ctx.fillStyle = iconColor;
    ctx.fill();

    // Text
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(amount.toLocaleString(), x + width - 10, y + height / 2 + 1);

    // Plus button
    const plusX = x + width + 5;
    const plusR = 12;
    ctx.beginPath();
    ctx.arc(plusX + plusR, y + height / 2, plusR, 0, Math.PI * 2);
    ctx.fillStyle = '#4CAF50';
    ctx.fill();
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('+', plusX + plusR, y + height / 2 + 1);

    ctx.restore();
}

// Simple color adjuster
function adjustColor(color: string, amount: number) {
    return '#' + color.replace(/^#/, '').replace(/../g, color => ('0' + Math.min(255, Math.max(0, parseInt(color, 16) + amount)).toString(16)).substr(-2));
}

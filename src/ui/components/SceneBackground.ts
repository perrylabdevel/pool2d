import { ColorTokens } from '../theme/ColorTokens';

export type BackgroundTheme = 'blue' | 'red' | 'yellow' | 'purple' | 'green';

export function drawSceneBackground(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    theme: BackgroundTheme = 'red'
) {
    // Save current transform and reset for background
    // This ensures background slides with scene transitions
    ctx.save();
    const transform = ctx.getTransform();
    const offsetX = transform.e; // horizontal translation
    const offsetY = transform.f; // vertical translation

    // Define gradient colors based on theme
    let gradientStart: string;
    let gradientMid: string;
    let gradientEnd: string;

    switch (theme) {
        case 'blue':
            gradientStart = '#020710'; // Very dark blue
            gradientMid = '#071a36'; // Mid blue
            gradientEnd = '#09030f'; // Dark purple
            break;
        case 'red':
            gradientStart = '#0f0202'; // Very dark red
            gradientMid = '#2a0a0a'; // Mid red
            gradientEnd = '#1a0505'; // Dark red-purple
            break;
        case 'yellow':
            gradientStart = '#0f0a02'; // Very dark gold
            gradientMid = '#2a1f0a'; // Mid gold
            gradientEnd = '#1a1005'; // Dark brown-gold
            break;
        case 'purple':
            gradientStart = '#0a0215'; // Very dark purple
            gradientMid = '#1a0a36'; // Mid purple
            gradientEnd = '#0f030a'; // Dark purple
            break;
        case 'green':
            gradientStart = '#021007'; // Very dark green
            gradientMid = '#0a2a1a'; // Mid green
            gradientEnd = '#050f0a'; // Dark teal-green
            break;
    }

    // Gradient background (accounting for transform)
    const gradient = ctx.createLinearGradient(offsetX, offsetY, offsetX + width, offsetY + height);
    gradient.addColorStop(0, gradientStart);
    gradient.addColorStop(0.5, gradientMid);
    gradient.addColorStop(1, gradientEnd);
    ctx.fillStyle = gradient;
    ctx.fillRect(offsetX, offsetY, width, height);

    // Subtle grid overlay
    ctx.globalAlpha = 0.15;
    const gridSize = 60;
    for (let y = offsetY; y < offsetY + height; y += gridSize) {
        for (let x = offsetX; x < offsetX + width; x += gridSize) {
            ctx.strokeStyle = 'rgba(255,255,255,0.04)';
            ctx.lineWidth = 1;
            ctx.strokeRect(x, y, gridSize, gridSize);
        }
    }
    ctx.globalAlpha = 1;

    // Optional: Add subtle radial glow in center
    const centerGradient = ctx.createRadialGradient(
        offsetX + width / 2,
        offsetY + height / 2,
        0,
        offsetX + width / 2,
        offsetY + height / 2,
        Math.max(width, height) / 2
    );
    centerGradient.addColorStop(0, 'rgba(255, 255, 255, 0.02)');
    centerGradient.addColorStop(1, 'rgba(0, 0, 0, 0.1)');
    ctx.fillStyle = centerGradient;
    ctx.fillRect(offsetX, offsetY, width, height);

    ctx.restore();
}

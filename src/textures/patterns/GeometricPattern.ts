import { BasePattern, PatternConfig } from './BasePattern';

export class GeometricPattern extends BasePattern {
    constructor(config: PatternConfig) {
        super(config);
    }

    generate(): HTMLCanvasElement {
        const { ctx } = this;
        const { width, height } = this.config;
        const {
            type = 'checker', // checker, stripe, dot, hex
            color1 = '#ffffff',
            color2 = '#000000',
            scale = 50,
            rotation = 0
        } = this.config;

        // Fill background with color2
        ctx.fillStyle = color2;
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = color1;

        // Handle rotation by rotating context
        ctx.save();
        ctx.translate(width / 2, height / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.translate(-width / 2, -height / 2);

        // Draw pattern
        // We need to draw slightly larger area to cover rotation gaps
        const diag = Math.sqrt(width * width + height * height);
        const startX = -diag / 2;
        const startY = -diag / 2;
        const endX = width + diag / 2;
        const endY = height + diag / 2;

        if (type === 'checker') {
            for (let y = startY; y < endY; y += scale) {
                for (let x = startX; x < endX; x += scale) {
                    const isEvenRow = Math.floor(y / scale) % 2 === 0;
                    const isEvenCol = Math.floor(x / scale) % 2 === 0;
                    if ((isEvenRow && isEvenCol) || (!isEvenRow && !isEvenCol)) {
                        ctx.fillRect(x, y, scale, scale);
                    }
                }
            }
        } else if (type === 'stripe') {
            for (let x = startX; x < endX; x += scale * 2) {
                ctx.fillRect(x, startY, scale, endY - startY);
            }
        } else if (type === 'dot') {
            const radius = scale / 4;
            for (let y = startY; y < endY; y += scale) {
                for (let x = startX; x < endX; x += scale) {
                    ctx.beginPath();
                    ctx.arc(x + scale / 2, y + scale / 2, radius, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        } else if (type === 'hex') {
            // Simple hex grid approximation (staggered rows)
            const hexHeight = scale;
            const hexWidth = scale * 0.866; // sqrt(3)/2

            for (let y = startY; y < endY; y += hexHeight * 0.75) {
                const row = Math.floor((y - startY) / (hexHeight * 0.75));
                const xOffset = (row % 2) * (hexWidth / 2);

                for (let x = startX + xOffset; x < endX; x += hexWidth) {
                    this.drawHexagon(ctx, x, y, scale / 2);
                }
            }
        }

        ctx.restore();

        return this.canvas;
    }

    private drawHexagon(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i;
            const px = x + radius * Math.cos(angle);
            const py = y + radius * Math.sin(angle);
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
    }
}

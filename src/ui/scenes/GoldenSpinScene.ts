import { UIScene } from '../SceneController';
import { NavigationBar } from '../components/NavigationBar';
import { uiStateMachine, UIState } from '../UIStateMachine';
import { drawSceneBackground } from '../components/SceneBackground';
import { LayoutConstants } from '../theme/LayoutConstants';
import { drawRoundedRect } from '../components/UIComponents';
import { currencyStore } from '../CurrencyStore';
import { uiSoundService } from '../UISoundService';

type PrizeType = 'coins' | 'gold' | 'jackpot';

interface PrizeSlice {
    label: string;
    amount: number;
    type: PrizeType;
    weight: number;
    color: string;
}

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
    color: string;
    size: number;
}

export class GoldenSpinScene implements UIScene {
    private canvas: HTMLCanvasElement | null = null;
    private navigationBar: NavigationBar;
    private centerX = 0;
    private centerY = 0;
    private wheelRadius = 220;
    private centerInteractiveRadius = 0;
    private hoveredCenter = false;

    private prizes: PrizeSlice[] = [
        { label: '500', amount: 500, type: 'coins', weight: 14, color: '#4A90E2' },
        { label: '750', amount: 750, type: 'coins', weight: 14, color: '#50E3C2' },
        { label: '1,000', amount: 1000, type: 'coins', weight: 12, color: '#B8E986' },
        { label: '1,500', amount: 1500, type: 'coins', weight: 10, color: '#BD10E0' },
        { label: '2,500', amount: 2500, type: 'coins', weight: 8, color: '#9013FE' },
        { label: '5', amount: 5, type: 'gold', weight: 8, color: '#F5A623' },
        { label: '5,000', amount: 5000, type: 'coins', weight: 6, color: '#4A4A4A' },
        { label: '10', amount: 10, type: 'gold', weight: 5, color: '#F8E71C' },
        { label: '10,000', amount: 10000, type: 'coins', weight: 4, color: '#D0021B' },
        { label: 'JACKPOT', amount: 50000, type: 'jackpot', weight: 3, color: '#000000' },
        { label: '25', amount: 25, type: 'gold', weight: 2, color: '#8B572A' },
        { label: '100', amount: 100, type: 'gold', weight: 1, color: '#FFD700' }
    ];

    private currentRotation = 0;
    private spinStartRotation = 0;
    private spinTargetRotation = 0;
    private spinElapsed = 0;
    private spinDuration = 0;
    private isSpinning = false;
    private selectedPrize: PrizeSlice | null = null;
    private resultText = 'Spin to win golden rewards!';
    private history: PrizeSlice[] = [];
    private cooldownUntil = 0;

    // Animation state
    private pointerRotation = 0;
    private lastTickIndex = -1;
    private particles: Particle[] = [];

    private keyHandler: ((e: KeyboardEvent) => void) | null = null;

    constructor() {
        this.navigationBar = new NavigationBar({
            title: 'GOLDEN SPIN',
            showBack: true,
            backState: UIState.EVENTS,
            showProfile: true,
            showCurrencies: true,
            showSettings: true
        });
    }

    mount(): void {
        this.canvas = document.getElementById('ui-stage') as HTMLCanvasElement;
        if (!this.canvas) return;

        this.setupLayout(this.canvas.width, this.canvas.height);
        this.canvas.addEventListener('mousemove', this.onMouseMove);
        this.canvas.addEventListener('click', this.onClick);
        window.addEventListener('resize', this.onResize);

        this.keyHandler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                uiStateMachine.transitionTo(UIState.EVENTS);
            }
        };
        window.addEventListener('keydown', this.keyHandler);
    }

    unmount(): void {
        if (!this.canvas) return;
        this.canvas.removeEventListener('mousemove', this.onMouseMove);
        this.canvas.removeEventListener('click', this.onClick);
        window.removeEventListener('resize', this.onResize);
        this.canvas.style.cursor = 'default';

        if (this.keyHandler) {
            window.removeEventListener('keydown', this.keyHandler);
            this.keyHandler = null;
        }
    }

    private onResize = () => {
        if (!this.canvas) return;
        this.setupLayout(this.canvas.width, this.canvas.height);
    };

    private setupLayout(width: number, height: number) {
        this.navigationBar.setupLayout(width);
        const navHeight = this.navigationBar.getHeight();

        const availableHeight = height - navHeight - 200;
        const radius = Math.min(width * 0.3, availableHeight * 0.45);
        this.wheelRadius = Math.max(160, Math.min(radius, 240));
        this.centerX = width / 2;
        this.centerY = navHeight + this.wheelRadius + 60;
        this.centerInteractiveRadius = this.wheelRadius * 0.25;
    }

    private onMouseMove = (e: MouseEvent) => {
        if (!this.canvas) return;
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (this.navigationBar.handleMouseMove(x, y)) {
            this.canvas.style.cursor = this.navigationBar.getCursor();
            return;
        }

        const dx = x - this.centerX;
        const dy = y - this.centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const overCenter = distance <= this.centerInteractiveRadius;

        this.hoveredCenter = overCenter && !this.isSpinning && performance.now() >= this.cooldownUntil;
        this.canvas.style.cursor = this.hoveredCenter ? 'pointer' : 'default';
    };

    private onClick = (e: MouseEvent) => {
        if (!this.canvas) return;
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (this.navigationBar.handleClick(x, y)) return;

        const dx = x - this.centerX;
        const dy = y - this.centerY;
        const overCenter = Math.sqrt(dx * dx + dy * dy) <= this.centerInteractiveRadius;

        if (overCenter) {
            this.startSpin();
        }
    };

    update(dt: number): void {
        // Update particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.life -= dt;
            p.x += p.vx * dt * 60;
            p.y += p.vy * dt * 60;
            p.vy += 0.2 * dt * 60; // Gravity

            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }

        // Pointer physics decay
        this.pointerRotation *= 0.9;

        if (this.isSpinning) {
            this.spinElapsed += dt;
            const t = Math.min(1, this.spinElapsed / this.spinDuration);
            const eased = this.easeOutCubic(t);
            const delta = this.spinTargetRotation - this.spinStartRotation;
            const previousRotation = this.currentRotation;
            this.currentRotation = this.spinStartRotation + delta * eased;

            // Calculate speed for tick effect
            const speed = this.currentRotation - previousRotation;

            // Check for ticks
            const segmentAngle = (Math.PI * 2) / this.prizes.length;
            const totalSegmentsPassed = Math.floor(this.currentRotation / segmentAngle);

            if (totalSegmentsPassed > this.lastTickIndex) {
                this.lastTickIndex = totalSegmentsPassed;
                // Kick the pointer (Negative for counter-clockwise swing to the right)
                this.pointerRotation = -Math.min(0.8, speed * 10);
                uiSoundService.play('spin-tick');
            }

            if (t >= 1) {
                this.isSpinning = false;
                this.currentRotation = this.spinTargetRotation;
                this.finishSpin();
            }
        }
    }

    render(ctx: CanvasRenderingContext2D): void {
        const width = ctx.canvas.width;
        const height = ctx.canvas.height;

        drawSceneBackground(ctx, width, height, 'purple'); // Changed to purple for a richer feel
        this.navigationBar.render(ctx, width);

        this.renderWheel(ctx);
        this.renderPointer(ctx);
        this.renderCenterCTA(ctx);
        this.renderInfoPanel(ctx, width);
        this.renderParticles(ctx);
    }

    private startSpin() {
        const now = performance.now();
        if (this.isSpinning || now < this.cooldownUntil) return;

        this.selectedPrize = this.pickPrize();
        const segmentAngle = (Math.PI * 2) / this.prizes.length;
        const prizeIndex = this.prizes.indexOf(this.selectedPrize);

        // Ensure multiple full spins before landing on the target slice
        // Add random offset within the slice to make it look natural
        const randomOffset = (Math.random() - 0.5) * segmentAngle * 0.8;

        const turns = Math.ceil((this.currentRotation + prizeIndex * segmentAngle) / (Math.PI * 2)) + 5;
        this.spinStartRotation = this.currentRotation;

        // Target is: Total Turns - (Index * Segment) - (Pointer Offset which is -PI/2)
        // Actually, let's simplify: 0 is at 3 o'clock. Pointer is at -PI/2 (12 o'clock).
        // To land on index i, we need rotation R such that (R + StartOffset + i*Seg) % 2PI = PointerPos
        // But we render slices starting at rotation.
        // Let's just use the relative delta logic we had, it was working mostly.

        this.spinTargetRotation = turns * Math.PI * 2 - (prizeIndex * segmentAngle) + randomOffset;

        this.spinElapsed = 0;
        this.spinDuration = 4.5 + Math.random() * 1.0; // Longer spin
        this.isSpinning = true;
        this.resultText = 'Spinning...';
        this.cooldownUntil = now + this.spinDuration * 1000 + 400;
        this.lastTickIndex = Math.floor(this.currentRotation / segmentAngle);
    }

    private finishSpin() {
        if (!this.selectedPrize) return;
        const prize = this.selectedPrize;
        const rewardLabel = prize.type === 'coins' || prize.type === 'jackpot' ? 'coins' : 'gold';

        if (prize.type === 'coins' || prize.type === 'jackpot') {
            currencyStore.addCoins(prize.amount);
        } else {
            currencyStore.addGold(prize.amount);
        }

        this.history.unshift(prize);
        this.history = this.history.slice(0, 4);

        this.resultText = `You won ${prize.amount.toLocaleString()} ${rewardLabel}!`;

        uiSoundService.play('spin-win');
        // Spawn particles
        this.spawnParticles(50);
    }

    private spawnParticles(count: number) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 2 + Math.random() * 5;
            this.particles.push({
                x: this.centerX,
                y: this.centerY,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 5, // Initial upward burst
                life: 1.0 + Math.random() * 1.0,
                maxLife: 2.0,
                color: Math.random() > 0.5 ? '#FFD700' : '#FFFFFF',
                size: 3 + Math.random() * 4
            });
        }
    }

    private renderWheel(ctx: CanvasRenderingContext2D) {
        ctx.save();
        ctx.translate(this.centerX, this.centerY);

        // Outer Rim / Casing
        const rimSize = 16;
        ctx.beginPath();
        ctx.arc(0, 0, this.wheelRadius + rimSize, 0, Math.PI * 2);
        const rimGrad = ctx.createLinearGradient(-this.wheelRadius, -this.wheelRadius, this.wheelRadius, this.wheelRadius);
        rimGrad.addColorStop(0, '#FFD700');
        rimGrad.addColorStop(0.3, '#FDB931');
        rimGrad.addColorStop(0.6, '#FFFFE0');
        rimGrad.addColorStop(1, '#D4AF37');
        ctx.fillStyle = rimGrad;
        ctx.fill();

        // Inner dark rim
        ctx.beginPath();
        ctx.arc(0, 0, this.wheelRadius + 4, 0, Math.PI * 2);
        ctx.fillStyle = '#222';
        ctx.fill();

        // Rotate the wheel content
        ctx.rotate(this.currentRotation);

        const segmentAngle = (Math.PI * 2) / this.prizes.length;
        // Adjust start offset so index 0 is at the top when rotation is 0? 
        // The pointer is at -PI/2. 
        // If we want index 0 to be under the pointer at rotation 0, we need to shift by -PI/2 - segment/2
        const startOffset = -Math.PI / 2 - segmentAngle / 2;

        this.prizes.forEach((prize, index) => {
            const start = startOffset + index * segmentAngle;
            const end = start + segmentAngle;

            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, this.wheelRadius, start, end);
            ctx.closePath();

            // Metallic Slice Gradient
            const midAngle = (start + end) / 2;
            const gradX = Math.cos(midAngle) * this.wheelRadius;
            const gradY = Math.sin(midAngle) * this.wheelRadius;
            const sliceGrad = ctx.createLinearGradient(0, 0, gradX, gradY);

            // Parse base color to adjust for gradient
            sliceGrad.addColorStop(0, this.shade(prize.color, 40));
            sliceGrad.addColorStop(0.5, prize.color);
            sliceGrad.addColorStop(1, this.shade(prize.color, -30));

            ctx.fillStyle = sliceGrad;
            ctx.fill();

            // Inner Dark Ring Background with Depth
            const innerRadius = this.wheelRadius * 0.2; // 80% of visible slice (0.25 to 1.0 range approx)
            const outerRadius = this.wheelRadius; // Extend to edge

            ctx.beginPath();
            ctx.arc(0, 0, outerRadius, start, end);
            ctx.arc(0, 0, innerRadius, end, start, true);
            ctx.closePath();

            // Radial gradient for inset look - Darker shade of slice color
            const darkerColor = this.shade(prize.color, -60);
            const midColor = this.shade(prize.color, -40);

            const ringGrad = ctx.createRadialGradient(0, 0, innerRadius, 0, 0, outerRadius);
            ringGrad.addColorStop(0, darkerColor);   // Darker inner edge
            ringGrad.addColorStop(0.2, midColor);    // Lighter body
            ringGrad.addColorStop(0.8, midColor);    // Lighter body
            ringGrad.addColorStop(1, darkerColor);   // Darker outer edge
            ctx.fillStyle = ringGrad;
            ctx.fill();

            // Separators (Border around the segment)
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
            ctx.lineWidth = 1;
            ctx.stroke();

            // Inner Bevel (Highlight)
            ctx.beginPath();
            ctx.arc(0, 0, innerRadius, start, end);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'; // Subtle highlight
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Outer Shadow
            ctx.beginPath();
            ctx.arc(0, 0, outerRadius, start, end);
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)'; // Drop shadow
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Pattern Overlay (Dots)
            ctx.save();
            ctx.clip();
            ctx.fillStyle = 'rgba(0,0,0,0.05)';
            for (let r = 20; r < this.wheelRadius; r += 15) {
                for (let a = start; a < end; a += 0.15) {
                    if (Math.random() > 0.5) {
                        ctx.beginPath();
                        ctx.arc(Math.cos(a) * r, Math.sin(a) * r, 1, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
            }
            ctx.restore();

            // Slice borders
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
            ctx.lineWidth = 1;
            ctx.stroke();

            // Inner Bezel/Highlight
            ctx.beginPath();
            ctx.arc(0, 0, this.wheelRadius - 4, start + 0.02, end - 0.02);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Text and Icon
            const textRadius = this.wheelRadius * 0.775; // Reverted to outer position
            const textX = Math.cos(midAngle) * textRadius;
            const textY = Math.sin(midAngle) * textRadius;

            ctx.save();
            ctx.translate(textX, textY);
            ctx.rotate(midAngle + Math.PI / 2);

            // Render Custom Icon
            ctx.save();
            ctx.translate(0, -15); // Adjusted for better centering
            this.renderPrizeIcon(ctx, prize.type, prize.amount);
            ctx.restore();

            // Label
            ctx.shadowColor = 'rgba(0,0,0,0.5)';
            ctx.shadowBlur = 4;
            ctx.shadowOffsetY = 2;
            ctx.fillStyle = '#FFF';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = `bold 16px ${LayoutConstants.Fonts.Family.Display}`;
            ctx.fillText(prize.label, 0, 20); // Adjusted for better centering

            ctx.restore();
        });

        // Pegs
        for (let i = 0; i < this.prizes.length; i++) {
            const angle = startOffset + i * segmentAngle;
            const pegX = Math.cos(angle) * (this.wheelRadius - 8);
            const pegY = Math.sin(angle) * (this.wheelRadius - 8);

            ctx.beginPath();
            ctx.arc(pegX, pegY, 4, 0, Math.PI * 2);

            const pegGrad = ctx.createRadialGradient(pegX - 1, pegY - 1, 0, pegX, pegY, 4);
            pegGrad.addColorStop(0, '#FFF');
            pegGrad.addColorStop(1, '#888');
            ctx.fillStyle = pegGrad;
            ctx.fill();

            ctx.strokeStyle = '#000';
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        ctx.restore();
    }

    private renderPrizeIcon(ctx: CanvasRenderingContext2D, type: PrizeType, _amount: number) {
        if (type === 'coins') {
            // Draw Coin Stack
            const coinRadius = 12;
            const stackHeight = 3;

            ctx.fillStyle = '#FFD700';
            ctx.strokeStyle = '#DAA520';
            ctx.lineWidth = 1;

            // Draw bottom coins
            for (let i = 0; i < stackHeight; i++) {
                ctx.beginPath();
                ctx.ellipse(0, i * 4, coinRadius, coinRadius * 0.4, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();

                // Side of coin
                ctx.beginPath();
                ctx.rect(-coinRadius, i * 4, coinRadius * 2, 4);
                ctx.fill();
                ctx.stroke();
            }

            // Top coin face
            ctx.beginPath();
            ctx.ellipse(0, 0, coinRadius, coinRadius * 0.4, 0, 0, Math.PI * 2);
            const coinGrad = ctx.createRadialGradient(-2, -2, 0, 0, 0, coinRadius);
            coinGrad.addColorStop(0, '#FFF');
            coinGrad.addColorStop(1, '#FFD700');
            ctx.fillStyle = coinGrad;
            ctx.fill();
            ctx.stroke();

            // $ Symbol
            ctx.fillStyle = '#DAA520';
            ctx.font = 'bold 12px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('$', 0, 1);

        } else if (type === 'gold') {
            // Draw Gold Bar
            ctx.fillStyle = '#FFD700';
            ctx.strokeStyle = '#B8860B';
            ctx.lineWidth = 1;

            // Trapezoid shape for bar
            ctx.beginPath();
            ctx.moveTo(-12, 6);
            ctx.lineTo(12, 6);
            ctx.lineTo(10, -6);
            ctx.lineTo(-10, -6);
            ctx.closePath();

            const barGrad = ctx.createLinearGradient(-10, -10, 10, 10);
            barGrad.addColorStop(0, '#FFF');
            barGrad.addColorStop(0.5, '#FFD700');
            barGrad.addColorStop(1, '#DAA520');
            ctx.fillStyle = barGrad;
            ctx.fill();
            ctx.stroke();

            // Shine
            ctx.beginPath();
            ctx.moveTo(-5, -6);
            ctx.lineTo(0, 6);
            ctx.strokeStyle = 'rgba(255,255,255,0.4)';
            ctx.stroke();

        } else if (type === 'jackpot') {
            // Draw Diamond
            ctx.fillStyle = '#E0FFFF';
            ctx.strokeStyle = '#00CED1';
            ctx.lineWidth = 1;

            ctx.beginPath();
            ctx.moveTo(0, -15); // Top point
            ctx.lineTo(12, -5); // Right shoulder
            ctx.lineTo(0, 15);  // Bottom point
            ctx.lineTo(-12, -5); // Left shoulder
            ctx.closePath();

            const diamondGrad = ctx.createLinearGradient(-5, -10, 5, 10);
            diamondGrad.addColorStop(0, '#FFF');
            diamondGrad.addColorStop(1, '#00CED1');
            ctx.fillStyle = diamondGrad;
            ctx.fill();
            ctx.stroke();

            // Facets
            ctx.beginPath();
            ctx.moveTo(-12, -5);
            ctx.lineTo(12, -5);
            ctx.moveTo(0, -15);
            ctx.lineTo(0, 15);
            ctx.moveTo(-12, -5);
            ctx.lineTo(0, 15);
            ctx.lineTo(12, -5);
            ctx.strokeStyle = 'rgba(255,255,255,0.6)';
            ctx.stroke();
        }
    }

    private renderPointer(ctx: CanvasRenderingContext2D) {
        const pointerWidth = 40;
        const pointerHeight = 50;
        const tipX = this.centerX;
        const tipY = this.centerY - this.wheelRadius - 10;
        const pivotY = tipY - pointerHeight + 10; // Pivot near the top

        ctx.save();
        // Apply physics rotation around the top pivot
        ctx.translate(tipX, pivotY);
        ctx.rotate(this.pointerRotation);
        ctx.translate(-tipX, -pivotY);

        ctx.beginPath();
        ctx.moveTo(tipX, tipY + 15); // Tip overlapping wheel slightly
        ctx.lineTo(tipX - pointerWidth / 2, tipY - pointerHeight);
        ctx.lineTo(tipX + pointerWidth / 2, tipY - pointerHeight);
        ctx.closePath();

        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 5;

        const pointerGrad = ctx.createLinearGradient(tipX, tipY - pointerHeight, tipX, tipY);
        pointerGrad.addColorStop(0, '#D0021B');
        pointerGrad.addColorStop(0.4, '#FF4444');
        pointerGrad.addColorStop(1, '#990000');
        ctx.fillStyle = pointerGrad;
        ctx.fill();

        ctx.strokeStyle = '#FFF';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Pivot point
        ctx.beginPath();
        ctx.arc(tipX, tipY - pointerHeight + 10, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#DDD';
        ctx.fill();
        ctx.strokeStyle = '#555';
        ctx.stroke();

        ctx.restore();
    }

    private renderCenterCTA(ctx: CanvasRenderingContext2D) {
        const disabled = this.isSpinning || performance.now() < this.cooldownUntil;
        const radius = this.centerInteractiveRadius;

        ctx.save();
        ctx.translate(this.centerX, this.centerY);

        // Outer Glow if active
        if (!disabled && this.hoveredCenter) {
            ctx.shadowColor = '#FFD700';
            ctx.shadowBlur = 20;
        } else {
            ctx.shadowColor = 'rgba(0,0,0,0.5)';
            ctx.shadowBlur = 10;
            ctx.shadowOffsetY = 5;
        }

        // Button Body
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);

        const btnGrad = ctx.createRadialGradient(0, -radius * 0.5, 0, 0, 0, radius);
        if (disabled) {
            btnGrad.addColorStop(0, '#555');
            btnGrad.addColorStop(1, '#333');
        } else {
            btnGrad.addColorStop(0, '#FFD700');
            btnGrad.addColorStop(1, '#FF8C00');
        }
        ctx.fillStyle = btnGrad;
        ctx.fill();

        // Bevel
        ctx.beginPath();
        ctx.arc(0, 0, radius - 4, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Text
        ctx.fillStyle = disabled ? '#888' : '#FFF';
        ctx.font = `bold ${LayoutConstants.Fonts.Size.Large}px ${LayoutConstants.Fonts.Family.Display}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 4;
        ctx.fillText(disabled ? 'WAIT' : 'SPIN', 0, 2);

        ctx.restore();
    }

    private renderInfoPanel(ctx: CanvasRenderingContext2D, width: number) {
        const panelWidth = Math.min(width * 0.7, 500);
        const panelHeight = 80;
        const panelX = (width - panelWidth) / 2;
        const panelY = this.centerY + this.wheelRadius + 50;

        drawRoundedRect(ctx, panelX, panelY, panelWidth, panelHeight, 16);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fill();

        // Border
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#FFF';
        ctx.font = `bold 20px ${LayoutConstants.Fonts.Family.Default}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.resultText, panelX + panelWidth / 2, panelY + panelHeight / 2);
    }

    private renderParticles(ctx: CanvasRenderingContext2D) {
        ctx.save();
        for (const p of this.particles) {
            ctx.globalAlpha = p.life / p.maxLife;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    private pickPrize(): PrizeSlice {
        const totalWeight = this.prizes.reduce((acc, prize) => acc + prize.weight, 0);
        let roll = Math.random() * totalWeight;

        for (const prize of this.prizes) {
            if (roll < prize.weight) return prize;
            roll -= prize.weight;
        }
        return this.prizes[0];
    }

    private easeOutCubic(t: number) {
        const clamped = Math.min(1, Math.max(0, t));
        return 1 - Math.pow(1 - clamped, 3);
    }

    private shade(hex: string, amount: number) {
        const col = hex.replace('#', '');
        const num = parseInt(col, 16);
        const r = Math.min(255, Math.max(0, (num >> 16) + amount));
        const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + amount));
        const b = Math.min(255, Math.max(0, (num & 0x0000ff) + amount));
        return `rgb(${r}, ${g}, ${b})`;
    }
}
